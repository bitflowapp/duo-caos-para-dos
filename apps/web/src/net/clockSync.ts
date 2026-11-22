/**
 * Estimación del reloj del servidor (tipo NTP): se queda con las muestras de
 * menor RTT para minimizar el error. Usa performance.now() (monotónico).
 */
interface Sample {
  offset: number;
  rtt: number;
}

export class ClockSync {
  private samples: Sample[] = [];
  private offset = 0;
  private hasSample = false;
  rtt: number | null = null;

  addSample(clientSend: number, serverTime: number, clientReceive: number): void {
    const rtt = Math.max(0, clientReceive - clientSend);
    const offset = serverTime - (clientSend + rtt / 2);
    this.samples.push({ offset, rtt });
    if (this.samples.length > 12) this.samples.shift();
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 4);
    const target = best.reduce((s, x) => s + x.offset, 0) / best.length;
    // Corrección suave para evitar saltos del reloj de juego.
    if (!this.hasSample || Math.abs(target - this.offset) > 250) this.offset = target;
    else this.offset += (target - this.offset) * 0.35;
    this.hasSample = true;
    this.rtt = this.rtt === null ? rtt : this.rtt * 0.7 + rtt * 0.3;
  }

  get ready(): boolean {
    return this.hasSample;
  }

  /** Hora estimada del servidor (ms). */
  now(): number {
    return performance.now() + this.offset;
  }

  /** Para ajustar con la hora que trae un estado (antes del primer ping). */
  seed(serverNow: number): void {
    if (!this.hasSample) this.offset = serverNow - performance.now();
  }
}
