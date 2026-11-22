import { TICK_MS } from './constants';

/**
 * Reloj de partida compartido. El servidor define en qué hora (ms del servidor)
 * corresponde el tick `baseTick`; ambos lados derivan el tick actual igual.
 * Al pausar, `running` = false y el tick queda congelado en `baseTick`.
 */
export interface ClockPayload {
  baseTick: number;
  baseTime: number;
  running: boolean;
}

export function clockTick(clock: ClockPayload, serverNow: number): number {
  if (!clock.running) return clock.baseTick;
  // Épsilon: evita que 120 × (1000/60) caiga en 119,999… por redondeo flotante.
  return clock.baseTick + Math.floor((serverNow - clock.baseTime) / TICK_MS + 1e-6);
}

/** Hora del servidor en que comienza un tick dado (para alinear animaciones). */
export function clockTimeOfTick(clock: ClockPayload, tick: number): number {
  return clock.baseTime + (tick - clock.baseTick) * TICK_MS;
}

export class GameClock {
  private state: ClockPayload;

  constructor(startTime: number, baseTick = 0) {
    this.state = { baseTick, baseTime: startTime, running: true };
  }

  get payload(): ClockPayload {
    return { ...this.state };
  }

  tick(now: number): number {
    return clockTick(this.state, now);
  }

  pause(now: number): void {
    if (!this.state.running) return;
    this.state = { baseTick: Math.max(this.state.baseTick, this.tick(now)), baseTime: now, running: false };
  }

  /** Reanuda: el tick congelado vuelve a correr a partir de `at`. */
  resume(at: number): void {
    if (this.state.running) return;
    this.state = { baseTick: this.state.baseTick, baseTime: at, running: true };
  }
}
