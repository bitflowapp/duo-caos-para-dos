import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  MAX_RATE_VIOLATIONS,
  PROTOCOL_VERSION,
  RATE_LIMITS,
  type ClientToServerEvents,
  type JoinAck,
  type ServerToClientEvents,
} from '@duo/shared';
import {
  answerSchema,
  createRoomSchema,
  emoteSchema,
  inputSchema,
  joinRoomSchema,
  modeSchema,
  pingSchema,
  readySchema,
  resumeSchema,
  selectSchema,
  skipSchema,
  voteSchema,
} from '@duo/shared/schemas';
import type { ZodType } from 'zod';
import type { ServerConfig } from './config.js';
import { log } from './log.js';
import { RoomManager, type SeatRef } from './RoomManager.js';
import type { Room } from './Room.js';
import { TokenBucket, WindowLimiter } from './security.js';

type RateCategory = keyof typeof RATE_LIMITS;

interface SocketData {
  seat?: SeatRef;
  ip: string;
  buckets: Record<RateCategory, TokenBucket>;
  violations: number;
}

type DuoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type DuoIO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const channel = (code: string): string => `room:${code}`;

export interface SocketServer {
  io: DuoIO;
  manager: RoomManager;
  stop(): Promise<void>;
}

export function attachSocketServer(httpServer: HttpServer, config: ServerConfig): SocketServer {
  const io: DuoIO = new Server(httpServer, {
    serveClient: false,
    maxHttpBufferSize: 8 * 1024,
    pingInterval: 10_000,
    pingTimeout: 9_000,
    connectTimeout: 15_000,
    transports: ['websocket', 'polling'],
    cors: config.allowedOrigins.length > 0 ? { origin: config.allowedOrigins, methods: ['GET', 'POST'] } : undefined,
    allowRequest: (req, callback) => {
      // Mismo origen siempre permitido; otros orígenes solo si están en la lista.
      const origin = req.headers.origin;
      if (!origin) return callback(null, true);
      const host = req.headers.host;
      try {
        const o = new URL(origin);
        if (host && o.host === host) return callback(null, true);
      } catch {
        return callback('origin', false);
      }
      callback(null, config.allowedOrigins.includes(origin));
    },
  });

  const manager = new RoomManager(
    {
      toRoom: (code, event, ...args) => {
        io.to(channel(code)).emit(event, ...args);
      },
      toSocket: (socketId, event, ...args) => {
        io.to(socketId).emit(event, ...args);
      },
      unbindSocket: (socketId, reason) => {
        const s = io.sockets.sockets.get(socketId);
        if (!s) return;
        if (s.data.seat) s.leave(channel(s.data.seat.code));
        s.data.seat = undefined;
        if (reason === 'replaced') s.emit('session:replaced');
      },
      closeRoom: (code, reason) => {
        io.to(channel(code)).emit('room:closed', { reason });
        const ids = io.sockets.adapter.rooms.get(channel(code));
        for (const id of ids ? [...ids] : []) {
          const s = io.sockets.sockets.get(id);
          if (s) {
            s.leave(channel(code));
            s.data.seat = undefined;
          }
        }
        log.info('room_closed', { reason });
      },
    },
    config.maxRooms,
  );

  const joinLimiter = new WindowLimiter(config.joinAttemptsPerMinute, 60_000);
  const connectionsPerIp = new Map<string, number>();

  const clientIp = (socket: DuoSocket): string => {
    if (config.trustProxy) {
      const fwd = socket.handshake.headers['x-forwarded-for'];
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return socket.handshake.address || 'unknown';
  };

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { v?: unknown } | undefined;
    if (!auth || auth.v !== PROTOCOL_VERSION) return next(new Error('version'));
    const ip = clientIp(socket);
    const count = connectionsPerIp.get(ip) ?? 0;
    if (count >= config.maxConnectionsPerIp) return next(new Error('too_many_connections'));
    connectionsPerIp.set(ip, count + 1);
    const now = Date.now();
    socket.data.ip = ip;
    socket.data.violations = 0;
    socket.data.buckets = {
      input: new TokenBucket(RATE_LIMITS.input, now),
      lobby: new TokenBucket(RATE_LIMITS.lobby, now),
      room: new TokenBucket(RATE_LIMITS.room, now),
      answer: new TokenBucket(RATE_LIMITS.answer, now),
      emote: new TokenBucket(RATE_LIMITS.emote, now),
      ping: new TokenBucket(RATE_LIMITS.ping, now),
    };
    next();
  });

  io.on('connection', (socket: DuoSocket) => {
    const violation = (code: 'rate_limited' | 'invalid'): void => {
      socket.data.violations++;
      if (socket.data.violations % 20 === 1) socket.emit('error:msg', { code });
      if (socket.data.violations > MAX_RATE_VIOLATIONS) {
        log.warn('socket_abuse_disconnect', {});
        socket.disconnect(true);
      }
    };

    const allow = (category: RateCategory): boolean => {
      if (socket.data.buckets[category].take(Date.now())) return true;
      violation('rate_limited');
      return false;
    };

    function parse<T>(schema: ZodType<T>, payload: unknown): T | null {
      const r = schema.safeParse(payload);
      if (r.success) return r.data;
      violation('invalid');
      return null;
    }

    const seatRoom = (): { room: Room; seat: SeatRef } | null => {
      const seat = socket.data.seat;
      const room = manager.get(seat);
      if (!seat || !room) return null;
      return { room, seat };
    };

    const bindTo = (room: Room, slot: 0 | 1): void => {
      const prev = socket.data.seat;
      if (prev && (prev.code !== room.code || prev.slot !== slot)) {
        // El socket ya tenía otro asiento: lo abandona.
        manager.leave(prev, Date.now());
        socket.leave(channel(prev.code));
      }
      socket.data.seat = { code: room.code, slot };
      void socket.join(channel(room.code));
    };

    const safeAck = (ack: unknown, value: JoinAck): void => {
      if (typeof ack === 'function') (ack as (r: JoinAck) => void)(value);
    };

    socket.on('room:create', (payload, ack) => {
      if (!allow('room')) return safeAck(ack, { ok: false, error: 'rate_limited' });
      const p = parse(createRoomSchema, payload ?? {});
      if (!p) return safeAck(ack, { ok: false, error: 'invalid' });
      const now = Date.now();
      const wait = joinLimiter.hit(socket.data.ip, now);
      if (wait > 0) return safeAck(ack, { ok: false, error: 'rate_limited', retryAfterMs: wait });
      if (socket.data.seat) manager.leave(socket.data.seat, now);
      socket.data.seat = undefined;
      const r = manager.create(p.name, socket.id, now);
      if (!r.ok) return safeAck(ack, { ok: false, error: r.error });
      bindTo(r.room, r.slot);
      log.info('room_created', { rooms: manager.rooms.size });
      safeAck(ack, { ok: true, token: r.token, slot: r.slot, state: r.room.state(now), expiresAt: r.expiresAt });
    });

    socket.on('room:join', (payload, ack) => {
      if (!allow('room')) return safeAck(ack, { ok: false, error: 'rate_limited' });
      const p = parse(joinRoomSchema, payload);
      if (!p) return safeAck(ack, { ok: false, error: 'invalid' });
      const now = Date.now();
      const wait = joinLimiter.hit(socket.data.ip, now);
      if (wait > 0) return safeAck(ack, { ok: false, error: 'rate_limited', retryAfterMs: wait });
      const r = manager.join(p.code, p.name, socket.id, now);
      if (!r.ok) return safeAck(ack, { ok: false, error: r.error });
      bindTo(r.room, r.slot);
      safeAck(ack, { ok: true, token: r.token, slot: r.slot, state: r.room.state(now), expiresAt: r.expiresAt });
      r.room.broadcastState(now);
    });

    socket.on('room:resume', (payload, ack) => {
      if (!allow('room')) return safeAck(ack, { ok: false, error: 'rate_limited' });
      const p = parse(resumeSchema, payload);
      if (!p) return safeAck(ack, { ok: false, error: 'invalid' });
      const now = Date.now();
      // Unirse al canal ANTES de re-vincular, para recibir el estado y la sincronización.
      const r = manager.resume(p.token, socket.id, now);
      if (!r.ok) {
        joinLimiter.hit(socket.data.ip, now);
        return safeAck(ack, { ok: false, error: r.error });
      }
      socket.data.seat = { code: r.room.code, slot: r.slot };
      void socket.join(channel(r.room.code));
      safeAck(ack, { ok: true, token: p.token, slot: r.slot, state: r.room.state(now), expiresAt: r.expiresAt });
      r.room.broadcastState(now);
    });

    socket.on('room:leave', () => {
      if (!allow('room')) return;
      const seat = socket.data.seat;
      if (!seat) return;
      socket.data.seat = undefined;
      socket.leave(channel(seat.code));
      manager.leave(seat, Date.now());
    });

    socket.on('lobby:select', (payload) => {
      if (!allow('lobby')) return;
      const p = parse(selectSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.select(ctx.seat.slot, p, Date.now());
    });

    socket.on('lobby:ready', (payload) => {
      if (!allow('lobby')) return;
      const p = parse(readySchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.setReady(ctx.seat.slot, p.ready, Date.now());
    });

    socket.on('lobby:mode', (payload) => {
      if (!allow('lobby')) return;
      const p = parse(modeSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.setMode(ctx.seat.slot, p.mode, p.deck, Date.now());
    });

    socket.on('game:input', (payload) => {
      if (!allow('input')) return;
      const p = parse(inputSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.input(ctx.seat.slot, p, Date.now());
    });

    socket.on('quiz:answer', (payload) => {
      if (!allow('answer')) return;
      const p = parse(answerSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.answer(ctx.seat.slot, p, Date.now());
    });

    socket.on('quiz:skip', (payload) => {
      if (!allow('answer')) return;
      const p = parse(skipSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.skip(ctx.seat.slot, p.q, Date.now());
    });

    socket.on('coop:count', () => {
      if (!allow('emote')) return;
      const ctx = seatRoom();
      if (ctx) ctx.room.count(ctx.seat.slot, Date.now());
    });

    socket.on('post:vote', (payload) => {
      if (!allow('lobby')) return;
      const p = parse(voteSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.vote(ctx.seat.slot, p.kind, Date.now());
    });

    socket.on('post:lobby', () => {
      if (!allow('lobby')) return;
      const ctx = seatRoom();
      if (ctx) ctx.room.toLobby(ctx.seat.slot, Date.now());
    });

    socket.on('emote', (payload) => {
      if (!allow('emote')) return;
      const p = parse(emoteSchema, payload);
      const ctx = seatRoom();
      if (p && ctx) ctx.room.emote(ctx.seat.slot, p.id, Date.now());
    });

    socket.on('time:ping', (payload, ack) => {
      if (!allow('ping')) return;
      const p = parse(pingSchema, payload);
      if (p && typeof ack === 'function') ack({ c: p.c, s: Date.now() });
    });

    socket.on('disconnect', () => {
      const ip = socket.data.ip;
      const n = (connectionsPerIp.get(ip) ?? 1) - 1;
      if (n <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, n);
      const seat = socket.data.seat;
      if (seat) manager.disconnect(seat, socket.id, Date.now());
    });
  });

  const ticker = setInterval(() => manager.update(Date.now()), 8);
  const sweeper = setInterval(() => {
    const now = Date.now();
    manager.sweep(now);
    joinLimiter.sweep(now);
  }, 5_000);
  ticker.unref?.();
  sweeper.unref?.();

  return {
    io,
    manager,
    stop: async () => {
      clearInterval(ticker);
      clearInterval(sweeper);
      for (const room of [...manager.rooms.values()]) manager.close(room, 'shutdown');
      await new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
    },
  };
}
