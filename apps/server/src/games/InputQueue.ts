import { INPUT_LEAD_TOLERANCE_TICKS, MAX_INPUT_TICKS_PER_MESSAGE } from '@duo/shared';

/**
 * Entradas por tick de un jugador. El servidor simula a cada jugador a medida
 * que llegan sus entradas (modelo "usercmd"): un jugador con más latencia no
 * pierde precisión en sus saltos, y nadie puede adelantarse al reloj del
 * servidor más que INPUT_LEAD_TOLERANCE_TICKS (anti speed-hack).
 */
export class TickInputQueue {
  /** Último tick ya simulado para este jugador. */
  simTick: number;
  /** Mensajes descartados por estar fuera de rango (métrica de abuso). */
  rejected = 0;

  constructor(startTick = 0) {
    this.simTick = startTick;
  }

  /**
   * Procesa un lote que empieza en el tick `t`. Devuelve los botones a aplicar
   * para los ticks simTick+1, simTick+2, … (en orden) y avanza simTick.
   * `serverTick` es el tick actual del reloj de la partida; `endTick` el último permitido.
   */
  accept(t: number, buttons: readonly number[], serverTick: number, endTick: number): number[] {
    const out: number[] = [];
    const maxTick = Math.min(serverTick + INPUT_LEAD_TOLERANCE_TICKS, endTick);
    const lastInBatch = t + buttons.length - 1;
    if (lastInBatch <= this.simTick) return out; // duplicado o atrasado: ya se simuló
    // Un hueco grande indica un cliente desincronizado; se rellena con neutro acotado.
    if (t - (this.simTick + 1) > MAX_INPUT_TICKS_PER_MESSAGE * 4) {
      this.rejected++;
      return out;
    }
    let tick = this.simTick + 1;
    while (tick <= lastInBatch && tick <= maxTick) {
      out.push(tick < t ? 0 : (buttons[tick - t] ?? 0));
      tick++;
    }
    if (lastInBatch > maxTick) this.rejected++;
    this.simTick += out.length;
    return out;
  }

  /** Relleno neutro hasta `targetTick` (jugador trabado o en segundo plano). */
  fillTo(targetTick: number): number {
    const n = Math.max(0, targetTick - this.simTick);
    this.simTick += n;
    return n;
  }
}
