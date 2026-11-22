import {
  EMPTY_ROOM_TTL_MS,
  ROOM_IDLE_TIMEOUT_MS,
  ROOM_MAX_LIFETIME_MS,
  normalizeRoomCode,
  sanitizeName,
  type JoinError,
  type Slot,
} from '@duo/shared';
import { Room, type RoomIO } from './Room.js';
import { generateRoomCode, generateToken, hashToken } from './security.js';

export interface SeatRef {
  code: string;
  slot: Slot;
}

interface TokenEntry extends SeatRef {
  expiresAt: number;
}

export type JoinResult =
  | { ok: true; room: Room; slot: Slot; token: string; expiresAt: number }
  | { ok: false; error: JoinError };

/**
 * Registro de salas en memoria. Cada sala tiene un código legible (para invitar)
 * y cada asiento un token de sesión de 256 bits; el servidor solo guarda el hash.
 * El código sirve para entrar a un asiento libre; para volver a un asiento ocupado
 * (reconexión) hace falta el token.
 */
export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly tokens = new Map<string, TokenEntry>();

  constructor(
    private readonly io: RoomIO & { closeRoom(code: string, reason: 'expired' | 'idle' | 'empty' | 'shutdown'): void },
    private readonly maxRooms: number,
  ) {}

  private newRoom(now: number): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;
    let code = generateRoomCode();
    for (let i = 0; i < 8 && this.rooms.has(code); i++) code = generateRoomCode();
    if (this.rooms.has(code)) return null;
    const room = new Room(code, now, this.io);
    room.onSeatExpired = (hash) => this.tokens.delete(hash);
    this.rooms.set(code, room);
    return room;
  }

  private issueToken(room: Room, slot: Slot): { token: string; hash: string; expiresAt: number } {
    const token = generateToken();
    const hash = hashToken(token);
    const expiresAt = room.createdAt + ROOM_MAX_LIFETIME_MS;
    this.tokens.set(hash, { code: room.code, slot, expiresAt });
    return { token, hash, expiresAt };
  }

  create(rawName: unknown, socketId: string, now: number): JoinResult {
    const room = this.newRoom(now);
    if (!room) return { ok: false, error: 'server_full' };
    const name = sanitizeName(rawName, '');
    const { token, hash, expiresAt } = this.issueToken(room, 0);
    const slot = room.addPlayer(name, hash, socketId, now);
    if (slot === null) {
      this.tokens.delete(hash);
      this.rooms.delete(room.code);
      return { ok: false, error: 'server_full' };
    }
    return { ok: true, room, slot, token, expiresAt };
  }

  join(rawCode: string, rawName: unknown, socketId: string, now: number): JoinResult {
    const code = normalizeRoomCode(rawCode);
    if (!code) return { ok: false, error: 'invalid' };
    const room = this.rooms.get(code);
    if (!room || room.closed) return { ok: false, error: 'not_found' };
    if (now - room.createdAt > ROOM_MAX_LIFETIME_MS) return { ok: false, error: 'expired' };
    if (!room.canAcceptPlayer()) return { ok: false, error: 'full' };
    const freeSlot = room.freeSlot();
    if (freeSlot === null) return { ok: false, error: 'full' };
    const name = sanitizeName(rawName, '');
    const { token, hash, expiresAt } = this.issueToken(room, freeSlot);
    const slot = room.addPlayer(name, hash, socketId, now);
    if (slot === null) {
      this.tokens.delete(hash);
      return { ok: false, error: 'full' };
    }
    return { ok: true, room, slot, token, expiresAt };
  }

  /** Reconexión con token. No emite un token nuevo: el original sigue vigente. */
  resume(token: string, socketId: string, now: number): { ok: true; room: Room; slot: Slot; expiresAt: number } | { ok: false; error: JoinError } {
    const hash = hashToken(token);
    const entry = this.tokens.get(hash);
    if (!entry) return { ok: false, error: 'not_found' };
    if (now > entry.expiresAt) {
      this.tokens.delete(hash);
      return { ok: false, error: 'expired' };
    }
    const room = this.rooms.get(entry.code);
    const seat = room?.seats[entry.slot];
    if (!room || room.closed || !seat || seat.tokenHash !== hash) {
      this.tokens.delete(hash);
      return { ok: false, error: 'not_found' };
    }
    room.bindSocket(entry.slot, socketId, now);
    return { ok: true, room, slot: entry.slot, expiresAt: entry.expiresAt };
  }

  leave(ref: SeatRef, now: number): void {
    const room = this.rooms.get(ref.code);
    if (!room) return;
    const hash = room.removePlayer(ref.slot, now);
    if (hash) this.tokens.delete(hash);
    if (room.playerCount() === 0) this.close(room, 'empty');
  }

  disconnect(ref: SeatRef, socketId: string, now: number): void {
    this.rooms.get(ref.code)?.onDisconnect(ref.slot, socketId, now);
  }

  get(ref: SeatRef | undefined | null): Room | null {
    if (!ref) return null;
    const room = this.rooms.get(ref.code);
    return room && !room.closed ? room : null;
  }

  close(room: Room, reason: 'expired' | 'idle' | 'empty' | 'shutdown'): void {
    if (room.closed) return;
    room.closed = true;
    for (const seat of room.seats) if (seat) this.tokens.delete(seat.tokenHash);
    this.rooms.delete(room.code);
    this.io.closeRoom(room.code, reason);
  }

  update(now: number): void {
    for (const room of this.rooms.values()) room.update(now);
  }

  /** Limpieza periódica: expiración, inactividad y salas vacías. */
  sweep(now: number): void {
    for (const room of [...this.rooms.values()]) {
      if (now - room.createdAt > ROOM_MAX_LIFETIME_MS) {
        this.close(room, 'expired');
      } else if (room.playerCount() === 0) {
        this.close(room, 'empty');
      } else if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        this.close(room, 'empty');
      } else if (
        (room.phase === 'lobby' || room.phase === 'results') &&
        now - room.lastActivity > ROOM_IDLE_TIMEOUT_MS
      ) {
        this.close(room, 'idle');
      }
    }
    for (const [hash, entry] of this.tokens) {
      if (now > entry.expiresAt || !this.rooms.has(entry.code)) this.tokens.delete(hash);
    }
  }

  stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.connectedCount();
    return { rooms: this.rooms.size, players };
  }
}
