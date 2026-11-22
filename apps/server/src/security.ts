import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SESSION_TOKEN_BYTES,
  type RateRule,
} from '@duo/shared';

/** Código de sala aleatorio criptográficamente seguro (≈39,6 bits). */
export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

/** Token de sesión de 256 bits en base64url (43 caracteres). */
export function generateToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/** Hash del token: el servidor nunca guarda el token en claro. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Semilla aleatoria de 31 bits para pistas y preguntas. */
export function generateSeed(): number {
  return randomInt(1, 0x7fffffff);
}

/** Balde de fichas (token bucket) por socket y categoría. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly rule: RateRule,
    now: number,
  ) {
    this.tokens = rule.burst;
    this.last = now;
  }

  take(now: number, cost = 1): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.rule.burst, this.tokens + elapsed * this.rule.perSecond);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }
}

/** Ventana deslizante simple por clave (p. ej., intentos de unirse por IP). */
export class WindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Registra un intento; devuelve ms a esperar si se superó el límite (0 = permitido). */
  hit(key: string, now: number): number {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return this.windowMs - (now - (arr[0] ?? now));
    }
    arr.push(now);
    this.hits.set(key, arr);
    return 0;
  }

  sweep(now: number): void {
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((t) => now - t < this.windowMs);
      if (kept.length === 0) this.hits.delete(k);
      else this.hits.set(k, kept);
    }
  }
}
