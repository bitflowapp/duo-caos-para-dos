// Primitivas de síntesis e instrumentos. Sólo usan Web Audio cuando se invocan,
// así el módulo se puede importar en Node (tests) sin AudioContext.
import { midiToFreq } from './score';
import type { InstrumentId, InstrumentOptions } from './score';

/** Ganancia mínima para rampas exponenciales (no admiten 0). */
export const MIN_GAIN = 0.0001;

/** Diagnóstico global: voces (grupos de nodos) vivas, pico y total creadas. */
export const voiceStats = { live: 0, peak: 0, created: 0 };

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Bolsa de nodos de una nota o efecto: arranca/detiene sus fuentes y
 * desconecta todo cuando terminan (evita fugas de nodos).
 */
export class Voice {
  private readonly nodes: AudioNode[] = [];
  private pending = 0;
  private disposed = false;
  /** instante absoluto en que terminan todas sus fuentes */
  end = 0;

  constructor() {
    voiceStats.live++;
    voiceStats.created++;
    if (voiceStats.live > voiceStats.peak) voiceStats.peak = voiceStats.live;
  }

  /** Registra un nodo no-fuente para desconectarlo al final. */
  add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  /** Programa una fuente (oscilador o buffer) y la registra. */
  run<T extends AudioScheduledSourceNode>(src: T, start: number, stop: number): T {
    this.track(src, stop);
    const s = Math.max(0, start);
    src.start(s);
    src.stop(Math.max(s + 0.005, stop));
    return src;
  }

  /** Igual que run() pero con desplazamiento inicial (ruido con variación). */
  runBuffer(src: AudioBufferSourceNode, start: number, stop: number, offset: number): AudioBufferSourceNode {
    this.track(src, stop);
    const s = Math.max(0, start);
    src.start(s, offset);
    src.stop(Math.max(s + 0.005, stop));
    return src;
  }

  /** Llamar al terminar de construir: si no hubo fuentes, libera ya. */
  seal(): void {
    if (this.pending <= 0) this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    voiceStats.live--;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        // ya estaba desconectado
      }
    }
    this.nodes.length = 0;
  }

  private track(src: AudioScheduledSourceNode, stop: number): void {
    this.nodes.push(src);
    this.pending++;
    if (stop > this.end) this.end = stop;
    src.onended = () => {
      this.pending--;
      if (this.pending <= 0) this.dispose();
    };
  }
}

// ---------------------------------------------------------------------------
// Ayudantes de nodos y envolventes

/** Conecta nodos en serie sin depender del valor de retorno de connect() (Safari viejo devuelve undefined). */
export function chain(...nodes: AudioNode[]): void {
  let prev: AudioNode | undefined;
  for (const n of nodes) {
    if (prev) prev.connect(n);
    prev = n;
  }
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (detune !== 0) o.detune.value = detune;
  return o;
}

export function gainNode(ctx: BaseAudioContext, v: Voice, value = 0): GainNode {
  const g = v.add(ctx.createGain());
  g.gain.value = value;
  return g;
}

export function biquad(ctx: BaseAudioContext, v: Voice, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = v.add(ctx.createBiquadFilter());
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Buffer de ruido blanco de 1 s compartido por contexto (generador determinista). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.max(1, Math.floor(ctx.sampleRate));
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x2f6b1d3;
    for (let i = 0; i < len; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Fuente de ruido en bucle, registrada en la voz. */
export function noiseSrc(ctx: BaseAudioContext, v: Voice, start: number, stop: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  return v.runBuffer(src, start, stop, Math.random() * 0.8);
}

/** Envolvente percusiva: ataque lineal y caída exponencial. Devuelve el instante final. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(Math.max(peak, MIN_GAIN), t + attack);
  p.exponentialRampToValueAtTime(MIN_GAIN, t + attack + decay);
  return t + attack + decay;
}

/**
 * Envolvente sostenida: ataque, caída hacia `sustain` (fracción del pico)
 * y liberación a partir de `releaseAt`. Devuelve el instante final.
 */
export function adsr(
  p: AudioParam,
  t: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  releaseAt: number,
  release: number,
): number {
  const pk = Math.max(peak, MIN_GAIN);
  const rel = Math.max(releaseAt, t + attack + 0.002);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + attack);
  p.setTargetAtTime(pk * sustain, t + attack, Math.max(0.004, decay / 3));
  p.setTargetAtTime(0, rel, Math.max(0.004, release / 4));
  return rel + release;
}

/** Rampa lineal desde el valor actual (cambios de volumen sin clics). */
export function rampParam(p: AudioParam, value: number, now: number, time: number): void {
  const current = p.value;
  p.cancelScheduledValues(now);
  p.setValueAtTime(current, now);
  p.linearRampToValueAtTime(value, now + Math.max(0.005, time));
}

/** Barrido exponencial de frecuencia. */
export function glide(p: AudioParam, t: number, from: number, to: number, time: number): void {
  p.setValueAtTime(Math.max(from, 1), t);
  p.exponentialRampToValueAtTime(Math.max(to, 1), t + Math.max(time, 0.001));
}

// ---------------------------------------------------------------------------
// Instrumentos melódicos

export interface NoteParams {
  /** inicio absoluto (s) */
  t: number;
  /** duración sostenida (s) */
  dur: number;
  midi: number;
  vel: number;
}

export type InstrumentFn = (
  ctx: BaseAudioContext,
  v: Voice,
  out: AudioNode,
  p: NoteParams,
  o: InstrumentOptions,
) => void;

/** Marimba: seno fundamental con leve desafinación + parcial 4x de caída rápida. */
const marimba: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const k = o.decay ?? 1;
  const dec = clamp(1.1 - (p.midi - 48) * 0.018, 0.22, 1.2) * k;
  const g1 = gainNode(ctx, v);
  const o1 = osc(ctx, 'sine', f, 4);
  chain(o1, g1, out);
  perc(g1.gain, p.t, 0.8 * p.vel, 0.003, dec);
  v.run(o1, p.t, p.t + dec + 0.02);
  const g2 = gainNode(ctx, v);
  const o2 = osc(ctx, 'sine', f * 4);
  chain(o2, g2, out);
  perc(g2.gain, p.t, 0.2 * p.vel, 0.002, 0.06 * k);
  v.run(o2, p.t, p.t + 0.1 * k);
};

/** Pluck: onda con filtro paso bajo que se cierra (kalimba/guitarra sintética). */
const pluck: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const dec = clamp(0.8 - (p.midi - 60) * 0.014, 0.18, 1) * (o.decay ?? 1);
  const flt = biquad(ctx, v, 'lowpass', f * 6, 0.9);
  glide(flt.frequency, p.t, Math.min(f * (o.cutoff ?? 8), 12000), Math.max(f * 1.3, 280), dec * 0.5);
  const g = gainNode(ctx, v);
  const os = osc(ctx, o.wave ?? 'sawtooth', f);
  chain(os, flt, g, out);
  perc(g.gain, p.t, 0.5 * p.vel, 0.002, dec);
  v.run(os, p.t, p.t + dec + 0.02);
};

/** Pizzicato: diente de sierra con filtro resonante muy rápido y caída corta. */
const pizz: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const dec = clamp(0.42 - (p.midi - 55) * 0.006, 0.14, 0.5) * (o.decay ?? 1);
  const flt = biquad(ctx, v, 'lowpass', f * 4, 2.2);
  glide(flt.frequency, p.t, Math.min(f * 6, 9000), Math.max(f * 1.05, 180), 0.09);
  const g = gainNode(ctx, v);
  const os = osc(ctx, 'sawtooth', f);
  chain(os, flt, g, out);
  perc(g.gain, p.t, 0.6 * p.vel, 0.002, dec);
  v.run(os, p.t, p.t + dec + 0.02);
};

/**
 * Bajo: sierra filtrada (armónicos audibles en parlantes de celular) con leve
 * "mordida" del filtro, más un seno sub-grave a menor nivel para el cuerpo.
 */
const bass: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const cutoff = o.cutoff ?? 700;
  const flt = biquad(ctx, v, 'lowpass', cutoff, 0.9);
  glide(flt.frequency, p.t, cutoff * 1.8, cutoff, 0.12);
  const g = gainNode(ctx, v);
  const main = osc(ctx, o.wave ?? 'sawtooth', f);
  chain(main, flt, g, out);
  const sub = osc(ctx, 'sine', f);
  const subGain = gainNode(ctx, v, 0.5);
  chain(sub, subGain, g);
  const end = adsr(g.gain, p.t, 0.42 * p.vel, 0.006, 0.12, 0.72, p.t + p.dur, 0.05);
  v.run(main, p.t, end);
  v.run(sub, p.t, end);
};

/** Pad: dos ondas suaves desafinadas, ataque y salida lentos. */
const pad: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const wave = o.wave ?? 'triangle';
  const g = gainNode(ctx, v);
  const a = osc(ctx, wave, f, -7);
  const b = osc(ctx, wave, f, 7);
  a.connect(g);
  b.connect(g);
  g.connect(out);
  const end = adsr(g.gain, p.t, 0.28 * p.vel, 0.35, 0.6, 0.8, p.t + p.dur, 0.6);
  v.run(a, p.t, end);
  v.run(b, p.t, end);
};

/** Vibrato con entrada retardada, sólo en notas largas. */
function addVibrato(ctx: BaseAudioContext, v: Voice, target: AudioParam, p: NoteParams, cents: number, end: number): void {
  if (cents <= 0 || p.dur < 0.28) return;
  const lfo = osc(ctx, 'sine', 5.4);
  const depth = gainNode(ctx, v);
  depth.gain.setValueAtTime(0, p.t);
  depth.gain.linearRampToValueAtTime(0, p.t + 0.12);
  depth.gain.linearRampToValueAtTime(cents, p.t + Math.min(0.4, p.dur * 0.7));
  chain(lfo, depth);
  depth.connect(target);
  v.run(lfo, p.t, end);
}

/** Lead: onda cuadrada (o la indicada) con vibrato; el canal aporta el filtro. */
const lead: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const g = gainNode(ctx, v);
  const a = osc(ctx, o.wave ?? 'square', f);
  chain(a, g, out);
  const end = adsr(g.gain, p.t, 0.3 * p.vel, 0.008, 0.1, 0.7, p.t + p.dur, 0.07);
  v.run(a, p.t, end);
  addVibrato(ctx, v, a.detune, p, o.vibrato ?? 10, end);
};

/** Flauta/ocarina: seno + triángulo casi al unísono, ataque suave y vibrato. */
const flute: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const g = gainNode(ctx, v);
  const a = osc(ctx, 'sine', f);
  const b = osc(ctx, 'triangle', f, 3);
  a.connect(g);
  b.connect(g);
  g.connect(out);
  const end = adsr(g.gain, p.t, 0.3 * p.vel, 0.045, 0.2, 0.8, p.t + p.dur, 0.12);
  v.run(a, p.t, end);
  v.run(b, p.t, end);
  addVibrato(ctx, v, a.detune, p, o.vibrato ?? 14, end);
};

/** Bronces: dos sierras con filtro que se abre rápido ("stab" de metales). */
const brass: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const c = o.cutoff ?? 2400;
  const flt = biquad(ctx, v, 'lowpass', c * 0.25, 1.2);
  flt.frequency.setValueAtTime(c * 0.25, p.t);
  flt.frequency.linearRampToValueAtTime(c, p.t + 0.05);
  flt.frequency.setTargetAtTime(c * 0.55, p.t + 0.06, 0.12);
  const g = gainNode(ctx, v);
  const a = osc(ctx, 'sawtooth', f, -6);
  const b = osc(ctx, 'sawtooth', f, 6);
  a.connect(flt);
  b.connect(flt);
  chain(flt, g, out);
  const end = adsr(g.gain, p.t, 0.22 * p.vel, 0.02, 0.15, 0.65, p.t + p.dur, 0.08);
  v.run(a, p.t, end);
  v.run(b, p.t, end);
};

/** Piano eléctrico FM (relación 1:1 con índice decreciente). */
const ep: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const k = o.decay ?? 1;
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f);
  const mg = gainNode(ctx, v);
  mg.gain.setValueAtTime(f * 1.3 * p.vel, p.t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.12), p.t + 0.7 * k);
  chain(mod, mg);
  mg.connect(car.frequency);
  const g = gainNode(ctx, v);
  chain(car, g, out);
  const rel = Math.max(p.t + p.dur, p.t + 0.02);
  g.gain.setValueAtTime(0, p.t);
  g.gain.linearRampToValueAtTime(0.4 * p.vel, p.t + 0.004);
  g.gain.setTargetAtTime(0.12 * p.vel, p.t + 0.004, 0.45 * k);
  g.gain.setTargetAtTime(0, rel, 0.07);
  const end = rel + 0.35;
  v.run(car, p.t, end);
  v.run(mod, p.t, end);
};

/** Campana FM (relación inarmónica 3.5): brillo y chispa. */
const bell: InstrumentFn = (ctx, v, out, p, o) => {
  const f = midiToFreq(p.midi);
  const k = o.decay ?? 1;
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f * 3.5);
  const mg = gainNode(ctx, v);
  mg.gain.setValueAtTime(f * 2 * p.vel, p.t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.08), p.t + 0.5 * k);
  chain(mod, mg);
  mg.connect(car.frequency);
  const g = gainNode(ctx, v);
  chain(car, g, out);
  const end = perc(g.gain, p.t, 0.45 * p.vel, 0.002, 1.2 * k);
  v.run(car, p.t, end + 0.02);
  v.run(mod, p.t, end + 0.02);
};

// ---------------------------------------------------------------------------
// Percusión (números General MIDI)

function noiseHit(
  ctx: BaseAudioContext,
  v: Voice,
  out: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  decay: number,
  attack = 0.001,
): void {
  const flt = biquad(ctx, v, type, freq, q);
  const g = gainNode(ctx, v);
  chain(noiseSrc(ctx, v, t, t + attack + decay + 0.02), flt, g, out);
  perc(g.gain, t, peak, attack, decay);
}

function toneHit(
  ctx: BaseAudioContext,
  v: Voice,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  bend: number,
  peak: number,
  decay: number,
): void {
  const o = osc(ctx, type, f0);
  if (f1 !== f0) glide(o.frequency, t, f0, f1, bend);
  const g = gainNode(ctx, v);
  chain(o, g, out);
  const end = perc(g.gain, t, peak, 0.0015, decay);
  v.run(o, t, end + 0.01);
}

function clap(ctx: BaseAudioContext, v: Voice, out: AudioNode, t: number, vel: number): void {
  const flt = biquad(ctx, v, 'bandpass', 1150, 1.1);
  const g = gainNode(ctx, v);
  chain(noiseSrc(ctx, v, t, t + 0.22), flt, g, out);
  const pk = 0.7 * vel;
  g.gain.setValueAtTime(0, t);
  for (const dt of [0, 0.011, 0.022]) {
    g.gain.setValueAtTime(pk, t + dt);
    g.gain.exponentialRampToValueAtTime(pk * 0.12, t + dt + 0.009);
  }
  g.gain.setValueAtTime(pk * 0.8, t + 0.031);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 0.19);
}

function cowbell(ctx: BaseAudioContext, v: Voice, out: AudioNode, t: number, vel: number): void {
  const flt = biquad(ctx, v, 'bandpass', 900, 1.4);
  const g = gainNode(ctx, v);
  const a = osc(ctx, 'square', 562);
  const b = osc(ctx, 'square', 845);
  a.connect(flt);
  b.connect(flt);
  chain(flt, g, out);
  const end = perc(g.gain, t, 0.22 * vel, 0.001, 0.14);
  v.run(a, t, end + 0.01);
  v.run(b, t, end + 0.01);
}

const drums: InstrumentFn = (ctx, v, out, p) => {
  const t = p.t;
  const vel = p.vel;
  switch (p.midi) {
    case 35:
    case 36: // bombo con clic de ataque (audible en parlantes chicos)
      toneHit(ctx, v, out, t, 'sine', 185, 47, 0.11, 0.95 * vel, 0.34);
      toneHit(ctx, v, out, t, 'triangle', 1300, 180, 0.02, 0.18 * vel, 0.025);
      break;
    case 37: // aro
      toneHit(ctx, v, out, t, 'triangle', 1750, 1650, 0.01, 0.45 * vel, 0.028);
      noiseHit(ctx, v, out, t, 'bandpass', 2600, 1.5, 0.4 * vel, 0.015);
      break;
    case 38:
    case 40: // caja: ruido + cuerpo
      noiseHit(ctx, v, out, t, 'highpass', 1100, 0.7, 0.42 * vel, 0.15);
      toneHit(ctx, v, out, t, 'triangle', 230, 175, 0.05, 0.32 * vel, 0.07);
      break;
    case 39:
      clap(ctx, v, out, t, vel);
      break;
    case 42:
    case 44:
      noiseHit(ctx, v, out, t, 'highpass', 7200, 0.7, 0.26 * vel, 0.035);
      break;
    case 46:
      noiseHit(ctx, v, out, t, 'highpass', 6500, 0.7, 0.2 * vel, 0.24);
      break;
    case 49:
    case 57:
      noiseHit(ctx, v, out, t, 'highpass', 4500, 0.6, 0.16 * vel, 1.1, 0.003);
      break;
    case 51:
    case 59: // ride: siseo + campanita
      noiseHit(ctx, v, out, t, 'bandpass', 7000, 0.6, 0.12 * vel, 0.26);
      toneHit(ctx, v, out, t, 'sine', 3150, 3150, 0, 0.05 * vel, 0.22);
      break;
    case 56:
      cowbell(ctx, v, out, t, vel);
      break;
    case 60:
      toneHit(ctx, v, out, t, 'sine', 600, 480, 0.03, 0.5 * vel, 0.12);
      break;
    case 61:
      toneHit(ctx, v, out, t, 'sine', 450, 360, 0.03, 0.5 * vel, 0.14);
      break;
    case 62:
      toneHit(ctx, v, out, t, 'sine', 420, 360, 0.02, 0.45 * vel, 0.06);
      break;
    case 63:
      toneHit(ctx, v, out, t, 'sine', 410, 330, 0.03, 0.55 * vel, 0.22);
      break;
    case 64:
      toneHit(ctx, v, out, t, 'sine', 300, 240, 0.03, 0.6 * vel, 0.25);
      break;
    case 75:
      toneHit(ctx, v, out, t, 'sine', 2500, 2500, 0, 0.25 * vel, 0.05);
      break;
    case 76:
      toneHit(ctx, v, out, t, 'triangle', 1150, 980, 0.02, 0.35 * vel, 0.06);
      break;
    case 77:
      toneHit(ctx, v, out, t, 'triangle', 820, 700, 0.02, 0.35 * vel, 0.07);
      break;
    default: // maracas / shaker
      noiseHit(ctx, v, out, t, 'bandpass', 5500, 1.2, 0.42 * vel, 0.06, 0.008);
      break;
  }
};

/** Registro de instrumentos (cada uno crea pocos nodos por nota). */
export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentFn>> = {
  marimba,
  pluck,
  pizz,
  bass,
  pad,
  lead,
  flute,
  brass,
  ep,
  bell,
  drums,
};
