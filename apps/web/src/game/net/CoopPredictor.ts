import {
  INPUT_SEND_INTERVAL_TICKS,
  cloneCoopPlayer,
  cloneMech,
  coopPlayersMatch,
  createCoopMech,
  createCoopPlayer,
  stepCoopPlayer,
  type CharacterId,
  type CoopEvent,
  type CoopLevel,
  type CoopMech,
  type CoopPlayerState,
  type CoopSnapshot,
  type InputPayload,
  type Slot,
} from '@duo/shared';

const HISTORY = 240;
const MAX_CATCHUP = 120;

/** Predicción del jugador propio en Sincronizados (mecanismos: los del servidor). */
export class CoopPredictor {
  readonly me: Slot;
  readonly partner: Slot;
  local: CoopPlayerState;
  localTick = 0;
  mech: CoopMech;
  private mechTick = 0;
  private partnerBuf: CoopPlayerState[] = [];
  partnerDisplay: CoopPlayerState;
  private readonly inputs = new Map<number, number>();
  private readonly history = new Map<number, CoopPlayerState>();
  private sendBuf: number[] = [];
  private sendStart = 1;
  private lastServer: CoopPlayerState | null = null;
  readonly offset = { x: 0, y: 0 };
  readonly freshEvents: CoopEvent[] = [];

  constructor(
    readonly level: CoopLevel,
    me: Slot,
    private readonly character: CharacterId,
    private readonly matchId: number,
  ) {
    this.me = me;
    this.partner = me === 0 ? 1 : 0;
    this.local = createCoopPlayer(level, me);
    this.partnerDisplay = createCoopPlayer(level, this.partner);
    this.mech = createCoopMech(level);
  }

  /** Vista de mecanismos para predecir (el ascensor se extrapola). */
  private mechView(tick: number): CoopMech {
    const el = this.level.elevator;
    const dtTicks = Math.max(0, tick - this.mechTick);
    let y = this.mech.elevY + this.mech.elevVy * (dtTicks / 60);
    y = Math.min(el.yBottom, Math.max(el.yTop, y));
    return { ...this.mech, elevY: y };
  }

  advanceTo(target: number, sample: () => number): void {
    if (target < this.localTick - 6) {
      if (this.lastServer) this.adopt(this.lastServer);
      return;
    }
    if (target - this.localTick > MAX_CATCHUP) {
      if (this.lastServer && this.lastServer.tick > this.localTick) this.adopt(this.lastServer);
      this.localTick = Math.max(this.localTick, target - MAX_CATCHUP);
      this.local.tick = this.localTick;
    }
    while (this.localTick < target) {
      const t = this.localTick + 1;
      const buttons = sample();
      this.inputs.set(t, buttons);
      stepCoopPlayer(this.local, buttons, this.level, this.mechView(t), this.character, this.me, this.freshEvents);
      this.localTick = t;
      this.local.tick = t;
      this.history.set(t, cloneCoopPlayer(this.local));
      this.history.delete(t - HISTORY);
      this.inputs.delete(t - HISTORY);
      if (this.sendBuf.length === 0) this.sendStart = t;
      this.sendBuf.push(buttons);
    }
  }

  takeInputs(force = false): InputPayload | null {
    if (this.sendBuf.length === 0) return null;
    if (!force && this.sendBuf.length < INPUT_SEND_INTERVAL_TICKS) return null;
    const p: InputPayload = { m: this.matchId, t: this.sendStart, b: this.sendBuf.slice(0, 30) };
    this.sendBuf = this.sendBuf.slice(30);
    this.sendStart += p.b.length;
    return p;
  }

  private adopt(server: CoopPlayerState): void {
    this.local = cloneCoopPlayer(server);
    this.localTick = server.tick;
    this.history.clear();
    this.history.set(server.tick, cloneCoopPlayer(server));
    this.sendBuf = [];
    this.sendStart = server.tick + 1;
  }

  onSnapshot(s: CoopSnapshot): void {
    if (s.matchId !== this.matchId) return;
    this.mech = cloneMech(s.mech);
    this.mechTick = s.t;
    const server = s.p[this.me];
    this.lastServer = cloneCoopPlayer(server);
    const partner = s.p[this.partner];
    const last = this.partnerBuf[this.partnerBuf.length - 1];
    if (!last || partner.tick >= last.tick) {
      this.partnerBuf.push(cloneCoopPlayer(partner));
      if (this.partnerBuf.length > 12) this.partnerBuf.shift();
    }
    const st = server.tick;
    if (st > this.localTick) {
      this.adopt(server);
      return;
    }
    const predicted = this.history.get(st);
    if (predicted && coopPlayersMatch(predicted, server)) return;
    const bx = this.local.x;
    const by = this.local.y;
    this.local = cloneCoopPlayer(server);
    for (let t = st + 1; t <= this.localTick; t++) {
      stepCoopPlayer(this.local, this.inputs.get(t) ?? 0, this.level, this.mechView(t), this.character, this.me, undefined);
      this.local.tick = t;
      this.history.set(t, cloneCoopPlayer(this.local));
    }
    for (const k of this.history.keys()) if (k < st) this.history.delete(k);
    for (const k of this.inputs.keys()) if (k <= st) this.inputs.delete(k);
    this.offset.x += bx - this.local.x;
    this.offset.y += by - this.local.y;
    if (Math.abs(this.offset.x) > 120 || Math.abs(this.offset.y) > 120) {
      this.offset.x = 0;
      this.offset.y = 0;
    }
  }

  decayOffset(dt: number): void {
    const k = Math.min(1, dt * 12);
    this.offset.x -= this.offset.x * k;
    this.offset.y -= this.offset.y * k;
  }

  /** Compañero: interpolación entre snapshots con un pequeño retardo. */
  updatePartner(): CoopPlayerState {
    const buf = this.partnerBuf;
    const last = buf[buf.length - 1];
    if (!last) return this.partnerDisplay;
    const target = last.tick - 3;
    let shown: CoopPlayerState = last;
    for (let i = buf.length - 1; i > 0; i--) {
      const a = buf[i - 1] as CoopPlayerState;
      const b = buf[i] as CoopPlayerState;
      if (a.tick <= target && b.tick >= target) {
        const k = (target - a.tick) / Math.max(1, b.tick - a.tick);
        shown = { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        break;
      }
    }
    const d = this.partnerDisplay;
    const jump = Math.abs(shown.x - d.x) > 200 || Math.abs(shown.y - d.y) > 200;
    const k = jump ? 1 : 0.4;
    this.partnerDisplay = { ...shown, x: d.x + (shown.x - d.x) * k, y: d.y + (shown.y - d.y) * k };
    return this.partnerDisplay;
  }
}
