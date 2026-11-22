import {
  DT,
  INPUT_SEND_INTERVAL_TICKS,
  RACE,
  cloneRunner,
  copyRunnerInto,
  createRunner,
  runnersMatch,
  stepRunner,
  type InputPayload,
  type RaceCourse,
  type RaceSnapshot,
  type RaceTrap,
  type RunnerEvent,
  type RunnerState,
  type Slot,
} from '@duo/shared';

const HISTORY = 240;
const MAX_CATCHUP = 120;

/**
 * Predicción + reconciliación del corredor propio y suavizado del rival.
 * El cliente simula su personaje con sus entradas al instante; cuando llega el
 * estado autoritativo del servidor para un tick ya simulado, lo compara y, si
 * difiere, rebobina y re-simula las entradas pendientes.
 */
export class RacePredictor {
  readonly me: Slot;
  readonly rival: Slot;
  local: RunnerState;
  localTick = 0;
  traps: RaceTrap[] = [];
  /** Últimos estados del rival recibidos (por tick de su simulación). */
  private rivalBuf: RunnerState[] = [];
  rivalDisplay: RunnerState;
  private readonly inputs = new Map<number, number>();
  private readonly history = new Map<number, RunnerState>();
  private sendBuf: number[] = [];
  private sendStart = 1;
  private lastServer: RunnerState | null = null;
  /** Desfase visual que se disipa tras una corrección (suavizado). */
  readonly offset = { x: 0, y: 0 };
  /** Eventos de ticks nuevos (no de re-simulaciones) para efectos y sonido. */
  readonly freshEvents: RunnerEvent[] = [];
  corrections = 0;

  constructor(
    readonly course: RaceCourse,
    me: Slot,
    private readonly matchId: number,
  ) {
    this.me = me;
    this.rival = me === 0 ? 1 : 0;
    this.local = createRunner(course);
    this.rivalDisplay = createRunner(course);
  }

  /** Simula hasta `target` muestreando los botones una vez por tick. */
  advanceTo(target: number, sample: () => number): void {
    if (target < this.localTick - 6) {
      // El reloj retrocedió (pausa/reanudación): volvemos al último estado del servidor.
      this.rollbackToServer();
      return;
    }
    if (target - this.localTick > MAX_CATCHUP) {
      // Estuvimos congelados mucho tiempo: esperamos el estado del servidor.
      if (this.lastServer && this.lastServer.tick > this.localTick) this.adopt(this.lastServer);
      this.localTick = Math.max(this.localTick, target - MAX_CATCHUP);
      this.local.tick = this.localTick;
    }
    while (this.localTick < target) {
      const t = this.localTick + 1;
      const buttons = sample();
      this.inputs.set(t, buttons);
      stepRunner(this.local, buttons, this.course, this.traps, this.freshEvents);
      this.localTick = t;
      this.local.tick = t;
      this.history.set(t, cloneRunner(this.local));
      this.history.delete(t - HISTORY);
      this.inputs.delete(t - HISTORY);
      if (this.sendBuf.length === 0) this.sendStart = t;
      this.sendBuf.push(buttons);
    }
  }

  /** Lote de entradas listo para enviar (cada 2 ticks). */
  takeInputs(force = false): InputPayload | null {
    if (this.sendBuf.length === 0) return null;
    if (!force && this.sendBuf.length < INPUT_SEND_INTERVAL_TICKS) return null;
    const p: InputPayload = { m: this.matchId, t: this.sendStart, b: this.sendBuf.slice(0, 30) };
    this.sendBuf = this.sendBuf.slice(30);
    this.sendStart += p.b.length;
    return p;
  }

  private adopt(server: RunnerState): void {
    copyRunnerInto(this.local, server);
    this.localTick = server.tick;
    this.history.clear();
    this.history.set(server.tick, cloneRunner(server));
    this.sendBuf = [];
    this.sendStart = server.tick + 1;
  }

  private rollbackToServer(): void {
    if (this.lastServer) this.adopt(this.lastServer);
  }

  onSnapshot(s: RaceSnapshot): void {
    if (s.matchId !== this.matchId) return;
    this.traps = s.traps;
    const server = s.p[this.me];
    this.lastServer = cloneRunner(server);
    const rival = s.p[this.rival];
    const last = this.rivalBuf[this.rivalBuf.length - 1];
    if (!last || rival.tick >= last.tick) {
      this.rivalBuf.push(cloneRunner(rival));
      if (this.rivalBuf.length > 12) this.rivalBuf.shift();
    }

    const st = server.tick;
    if (st > this.localTick) {
      this.adopt(server);
      return;
    }
    const predicted = this.history.get(st);
    if (predicted && runnersMatch(predicted, server)) return;

    // Corrección: rebobinar al estado del servidor y re-simular entradas.
    this.corrections++;
    const beforeX = this.local.x;
    const beforeY = this.local.y;
    copyRunnerInto(this.local, server);
    for (let t = st + 1; t <= this.localTick; t++) {
      stepRunner(this.local, this.inputs.get(t) ?? 0, this.course, this.traps, undefined);
      this.local.tick = t;
      this.history.set(t, cloneRunner(this.local));
    }
    this.history.set(st, cloneRunner(server));
    for (const k of this.history.keys()) if (k < st) this.history.delete(k);
    for (const k of this.inputs.keys()) if (k <= st) this.inputs.delete(k);
    this.offset.x += beforeX - this.local.x;
    this.offset.y += beforeY - this.local.y;
    if (Math.abs(this.offset.x) > 160 || Math.abs(this.offset.y) > 160) {
      this.offset.x = 0;
      this.offset.y = 0;
    }
  }

  /** Disipa el desfase visual (llamar cada cuadro). */
  decayOffset(dt: number): void {
    const k = Math.min(1, dt * 12);
    this.offset.x -= this.offset.x * k;
    this.offset.y -= this.offset.y * k;
  }

  /**
   * Estado del rival a mostrar: interpolado entre snapshots y extrapolado en X
   * hasta el tick local (para que ambos se vean "al mismo tiempo").
   */
  updateRival(): RunnerState {
    const buf = this.rivalBuf;
    const last = buf[buf.length - 1];
    if (!last) return this.rivalDisplay;
    const target = Math.min(this.localTick, last.tick + 20);
    let shown: RunnerState;
    if (target <= last.tick && buf.length >= 2) {
      let a = buf[0] as RunnerState;
      let b = last;
      for (let i = buf.length - 1; i > 0; i--) {
        const prev = buf[i - 1] as RunnerState;
        const cur = buf[i] as RunnerState;
        if (prev.tick <= target && cur.tick >= target) {
          a = prev;
          b = cur;
          break;
        }
      }
      const span = Math.max(1, b.tick - a.tick);
      const k = Math.min(1, Math.max(0, (target - a.tick) / span));
      shown = { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    } else {
      const ahead = Math.max(0, target - last.tick);
      const moving = last.respawn === 0 && last.stun === 0;
      shown = { ...last, x: last.x + (moving ? last.vx * DT * ahead : 0) };
    }
    // Suavizado exponencial para evitar saltos.
    const d = this.rivalDisplay;
    const jump = Math.abs(shown.x - d.x) > 220 || Math.abs(shown.y - d.y) > 220;
    const k = jump ? 1 : 0.35;
    this.rivalDisplay = { ...shown, x: d.x + (shown.x - d.x) * k, y: d.y + (shown.y - d.y) * k };
    return this.rivalDisplay;
  }

  /** Límite de carrera conocido en el cliente (para el HUD). */
  get timeLimit(): number {
    return RACE.TIME_LIMIT_TICKS;
  }
}
