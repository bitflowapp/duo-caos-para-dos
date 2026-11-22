// Música: registro de temas, compilación de partituras y secuenciador con
// planificación anticipada (lookahead) sobre AudioContext.currentTime.
import { STEPS_PER_BAR, STEPS_PER_BEAT } from './score';
import type { InstrumentOptions, TrackDef, VoiceDef } from './score';
import { INSTRUMENTS, Voice, chain, clamp, rampParam, voiceStats } from './synth';
import { COOP_TRACK } from './tracks/coop';
import { MENU_TRACK } from './tracks/menu';
import { QUIZ_TRACK } from './tracks/quiz';
import { RACE_TRACK } from './tracks/race';
import { RESULTS_TRACK } from './tracks/results';

export type MusicTrack = 'menu' | 'race' | 'coop' | 'quiz' | 'results';
export type MusicIntensity = 0 | 1 | 2;

export const MUSIC_TRACKS: readonly MusicTrack[] = ['menu', 'race', 'coop', 'quiz', 'results'];

export const TRACKS: Readonly<Record<MusicTrack, TrackDef>> = {
  menu: MENU_TRACK,
  race: RACE_TRACK,
  coop: COOP_TRACK,
  quiz: QUIZ_TRACK,
  results: RESULTS_TRACK,
};

/** Ventana de planificación anticipada (s). */
export const LOOKAHEAD = 0.12;
/** Presupuesto global de voces para la música (incluye efectos vivos). */
export const MAX_MUSIC_VOICES = 72;

export interface CompiledEvent {
  voice: number;
  midi: number;
  /** duración en pasos */
  dur: number;
  vel: number;
}

export interface CompiledTrack {
  def: TrackDef;
  /** pasos totales del bucle (o de la pieza, si no es bucle) */
  loopSteps: number;
  /** eventos agrupados por paso entero */
  buckets: CompiledEvent[][];
  /** duración de una semicorchea (s) */
  stepDur: number;
  /** problemas estructurales detectados (los tests exigen que esté vacío) */
  errors: string[];
}

/** Aplana secciones según `order` en una grilla de pasos. Puro: no usa Web Audio. */
export function compileTrack(def: TrackDef): CompiledTrack {
  const errors: string[] = [];
  const voiceIndex = new Map<string, number>();
  def.voices.forEach((v, i) => voiceIndex.set(v.name, i));
  const placed: { step: number; ev: CompiledEvent }[] = [];
  let offset = 0;
  for (const si of def.order) {
    const sec = def.sections[si];
    if (!sec) {
      errors.push(`${def.id}: sección inexistente ${si}`);
      continue;
    }
    const len = sec.bars * STEPS_PER_BAR;
    for (const [name, events] of Object.entries(sec.parts)) {
      const vi = voiceIndex.get(name);
      if (vi === undefined) {
        errors.push(`${def.id}/${sec.name}: voz desconocida "${name}"`);
        continue;
      }
      for (const e of events ?? []) {
        if (!Number.isInteger(e.s) || e.s < 0 || e.s + e.d > len + 1e-9) {
          errors.push(`${def.id}/${sec.name}/${name}: evento fuera de la sección (paso ${e.s}, dur ${e.d})`);
          continue;
        }
        placed.push({ step: offset + e.s, ev: { voice: vi, midi: e.n, dur: e.d, vel: e.v } });
      }
    }
    offset += len;
  }
  const buckets: CompiledEvent[][] = Array.from({ length: offset }, () => []);
  for (const { step, ev } of placed) buckets[step]?.push(ev);
  return { def, loopSteps: offset, buckets, stepDur: 60 / def.bpm / STEPS_PER_BEAT, errors };
}

/**
 * Deformación de swing: posición en pasos → posición "tocada" en pasos.
 * unit 16: retrasa la segunda semicorchea de cada par; unit 8: la segunda corchea de cada tiempo.
 * Es monótona y periódica, así que también sirve para calcular finales de nota.
 */
export function swingWarp(x: number, swing: TrackDef['swing']): number {
  if (!swing || swing.amount <= 0) return x;
  if (swing.unit === 16) {
    const base = Math.floor(x / 2) * 2;
    const f = x - base;
    const m = 1 + swing.amount;
    return base + (f <= 1 ? f * m : m + (f - 1) * (2 - m));
  }
  const base = Math.floor(x / 4) * 4;
  const f = x - base;
  const m = 2 + swing.amount;
  return base + (f <= 2 ? f * (m / 2) : m + (f - 2) * ((4 - m) / 2));
}

interface Channel {
  def: VoiceDef;
  /** nodo al que se conectan las notas */
  input: AudioNode;
  gain: GainNode;
  nodes: AudioNode[];
  opts: InstrumentOptions;
}

const NO_OPTS: InstrumentOptions = {};

function safeDisconnect(n: AudioNode): void {
  try {
    n.disconnect();
  } catch {
    // ya desconectado
  }
}

/**
 * Secuenciador de un tema. No usa temporizadores propios: el motor llama a
 * tick(now) cada ~25 ms y aquí sólo se crean nodos para las notas que caen
 * dentro de la ventana [now, now + LOOKAHEAD).
 */
export class Sequencer {
  /** ganancia propia del tema (para fundidos cruzados) */
  readonly out: GainNode;
  readonly track: CompiledTrack;
  private readonly ctx: BaseAudioContext;
  private readonly channels: Channel[] = [];
  private readonly fx: AudioNode[] = [];
  private readonly origin: number;
  private step = 0;
  private stopAt = Number.POSITIVE_INFINITY;
  private level: MusicIntensity;
  private lastEnd = 0;
  private disposed = false;

  constructor(ctx: BaseAudioContext, dest: AudioNode, track: CompiledTrack, startAt: number, level: MusicIntensity = 0) {
    this.ctx = ctx;
    this.track = track;
    this.origin = startAt;
    this.level = level;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(dest);

    // Eco sincronizado al tempo (delay con realimentación filtrada)
    let echoIn: AudioNode | null = null;
    const e = track.def.echo;
    if (e && e.wet > 0) {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = Math.min(1.9, e.steps * track.stepDur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const fb = ctx.createGain();
      fb.gain.value = clamp(e.feedback, 0, 0.8);
      const wet = ctx.createGain();
      wet.gain.value = e.wet;
      chain(delay, lp, fb, delay);
      chain(lp, wet, this.out);
      this.fx.push(delay, lp, fb, wet);
      echoIn = delay;
    }

    const canPan = typeof ctx.createStereoPanner === 'function';
    for (const vd of track.def.voices) {
      const nodes: AudioNode[] = [];
      const gain = ctx.createGain();
      gain.gain.value = this.channelGain(vd, level);
      gain.connect(this.out);
      nodes.push(gain);
      let input: AudioNode = gain;
      if (vd.pan && canPan) {
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(vd.pan, -1, 1);
        p.connect(input);
        input = p;
        nodes.push(p);
      }
      if (vd.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = vd.lowpass;
        f.Q.value = 0.5;
        f.connect(input);
        input = f;
        nodes.push(f);
      }
      if (echoIn && vd.echo) {
        const send = ctx.createGain();
        send.gain.value = vd.echo;
        chain(gain, send, echoIn);
        nodes.push(send);
      }
      this.channels.push({ def: vd, input, gain, nodes, opts: vd.opts ?? NO_OPTS });
    }
  }

  get intensity(): MusicIntensity {
    return this.level;
  }

  /** Duración nominal de la pieza (s). */
  get duration(): number {
    return this.track.loopSteps * this.track.stepDur;
  }

  /** Para piezas sin bucle: instante en que ya sonó todo (incluida la cola del eco); null si falta. */
  get finishedAt(): number | null {
    if (this.track.def.loop || this.step < this.track.loopSteps) return null;
    return Math.max(this.lastEnd, this.timeAt(this.track.loopSteps)) + (this.track.def.echo ? 1.2 : 0.1);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Instante absoluto de un paso (con swing). */
  timeAt(step: number): number {
    return this.origin + swingWarp(step, this.track.def.swing) * this.track.stepDur;
  }

  /** Programa las notas que caen dentro de la ventana anticipada. */
  tick(now: number): void {
    if (this.disposed) return;
    const { loopSteps, stepDur } = this.track;
    if (loopSteps <= 0) return;
    const loop = this.track.def.loop;
    // Si el hilo principal se trabó, saltar tiempos enteros en lugar de disparar notas atrasadas
    const late = now - this.timeAt(this.step);
    if (late > 0.25) {
      const beat = stepDur * STEPS_PER_BEAT;
      this.step += Math.floor(late / beat) * STEPS_PER_BEAT;
    }
    const horizon = now + LOOKAHEAD;
    for (let guard = 0; guard < 256; guard++) {
      if (!loop && this.step >= loopSteps) break;
      const t = this.timeAt(this.step);
      if (t >= horizon || t >= this.stopAt) break;
      if (t >= now - 0.02) this.playStep(this.step, t);
      this.step++;
    }
  }

  setIntensity(level: MusicIntensity, now: number): void {
    if (level === this.level || this.disposed) return;
    this.level = level;
    for (const ch of this.channels) rampParam(ch.gain.gain, this.channelGain(ch.def, level), now, 0.35);
  }

  fadeIn(now: number, time: number): void {
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(1, now + time);
  }

  /** Funde a silencio y deja de programar al terminar. Devuelve el instante final. */
  fadeOut(now: number, time: number): number {
    rampParam(this.out.gain, 0, now, time);
    this.stopAt = Math.min(this.stopAt, now + time);
    return now + time;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const ch of this.channels) for (const n of ch.nodes) safeDisconnect(n);
    for (const n of this.fx) safeDisconnect(n);
    safeDisconnect(this.out);
  }

  private channelGain(vd: VoiceDef, level: MusicIntensity): number {
    if ((vd.layer ?? 0) > level) return 0;
    return vd.gain * (vd.boost?.[level] ?? 1);
  }

  private playStep(step: number, t: number): void {
    const bucket = this.track.buckets[step % this.track.loopSteps];
    if (!bucket || bucket.length === 0) return;
    for (const ev of bucket) {
      const ch = this.channels[ev.voice];
      if (!ch || (ch.def.layer ?? 0) > this.level) continue;
      if (voiceStats.live >= MAX_MUSIC_VOICES) return;
      const end = this.timeAt(step + ev.dur);
      const dur = Math.max(0.03, (end - t) * (ch.def.gate ?? 1));
      const v = new Voice();
      try {
        INSTRUMENTS[ch.def.inst](this.ctx, v, ch.input, { t, dur, midi: ev.midi, vel: ev.vel }, ch.opts);
        v.seal();
      } catch {
        v.dispose();
        continue;
      }
      if (v.end > this.lastEnd) this.lastEnd = v.end;
    }
  }
}
