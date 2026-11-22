import { TICK_MS, type ServerToClientEvents } from '@duo/shared';
import { Room, type RoomIO } from '../src/Room';
import { hashToken } from '../src/security';

export interface Emitted {
  to: string;
  event: keyof ServerToClientEvents;
  payload: unknown;
}

/** Sala con E/S falsa y reloj manual para simular partidas completas rápido. */
export function makeRoom(): { room: Room; log: Emitted[]; clock: { now: number }; advance: (ms: number) => void } {
  const log: Emitted[] = [];
  const io: RoomIO = {
    toRoom: (code, event, ...args) => {
      log.push({ to: `room:${code}`, event, payload: args[0] });
    },
    toSocket: (socketId, event, ...args) => {
      log.push({ to: socketId, event, payload: args[0] });
    },
    unbindSocket: () => undefined,
  };
  const clock = { now: 1_000_000 };
  const room = new Room('TESTCODE', clock.now, io);
  room.addPlayer('Ana', hashToken('a'.repeat(43)), 'sock-a', clock.now);
  room.addPlayer('Leo', hashToken('b'.repeat(43)), 'sock-b', clock.now);
  const advance = (ms: number): void => {
    const end = clock.now + ms;
    while (clock.now < end) {
      clock.now = Math.min(end, clock.now + TICK_MS);
      room.update(clock.now);
    }
  };
  return { room, log, clock, advance };
}

export function lastOf<T>(log: Emitted[], event: keyof ServerToClientEvents, to?: string): T | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.event === event && (to === undefined || e.to === to)) return e.payload as T;
  }
  return undefined;
}
