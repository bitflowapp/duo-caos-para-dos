import { describe, expect, it } from 'vitest';
import { INPUT_LEAD_TOLERANCE_TICKS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@duo/shared';
import { TickInputQueue } from '../src/games/InputQueue';
import { TokenBucket, WindowLimiter, generateRoomCode, generateToken, hashToken, safeEqual } from '../src/security';

describe('secretos y códigos', () => {
  it('genera códigos de sala con el alfabeto sin ambigüedades', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateRoomCode();
      expect(c).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of c) expect(ROOM_CODE_ALPHABET).toContain(ch);
      seen.add(c);
    }
    // 31^8 combinaciones: colisiones en 2000 muestras son prácticamente imposibles.
    expect(seen.size).toBe(2000);
  });

  it('genera tokens de 256 bits en base64url y solo guarda su hash', () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(t);
    const h = hashToken(t);
    expect(h).not.toContain(t);
    expect(hashToken(t)).toBe(h);
    expect(safeEqual(h, hashToken(t))).toBe(true);
    expect(safeEqual(h, hashToken(generateToken()))).toBe(false);
  });
});

describe('límites de frecuencia', () => {
  it('el balde permite ráfagas y luego limita', () => {
    const b = new TokenBucket({ burst: 3, perSecond: 1 }, 0);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(false);
    expect(b.take(1000)).toBe(true);
    expect(b.take(1000)).toBe(false);
  });

  it('la ventana por IP bloquea intentos excesivos', () => {
    const w = new WindowLimiter(3, 60_000);
    expect(w.hit('ip', 0)).toBe(0);
    expect(w.hit('ip', 1)).toBe(0);
    expect(w.hit('ip', 2)).toBe(0);
    expect(w.hit('ip', 3)).toBeGreaterThan(0);
    expect(w.hit('otra', 3)).toBe(0);
    expect(w.hit('ip', 60_001)).toBe(0);
  });
});

describe('cola de entradas por tick', () => {
  it('descarta duplicados y procesa en orden', () => {
    const q = new TickInputQueue(0);
    expect(q.accept(1, [1, 2], 100, 10_000)).toEqual([1, 2]);
    expect(q.simTick).toBe(2);
    expect(q.accept(1, [1, 2], 100, 10_000)).toEqual([]);
    expect(q.accept(2, [2, 3, 4], 100, 10_000)).toEqual([3, 4]);
    expect(q.simTick).toBe(4);
  });

  it('no deja adelantarse al reloj del servidor (anti speed-hack)', () => {
    const q = new TickInputQueue(0);
    const many = new Array<number>(30).fill(0);
    q.accept(1, many, 0, 10_000);
    expect(q.simTick).toBe(Math.min(30, INPUT_LEAD_TOLERANCE_TICKS));
    const before = q.simTick;
    q.accept(before + 1, many, 0, 10_000);
    expect(q.simTick).toBe(before);
    expect(q.rejected).toBeGreaterThan(0);
  });

  it('rellena huecos chicos con entrada neutra y rechaza saltos enormes', () => {
    const q = new TickInputQueue(0);
    expect(q.accept(4, [7], 100, 10_000)).toEqual([0, 0, 0, 7]);
    const r = q.accept(1000, [1], 2000, 10_000);
    expect(r).toEqual([]);
    expect(q.rejected).toBe(1);
  });

  it('respeta el tick final de la partida', () => {
    const q = new TickInputQueue(0);
    expect(q.accept(1, [1, 1, 1, 1], 100, 2)).toEqual([1, 1]);
  });
});
