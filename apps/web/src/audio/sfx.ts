// Efectos de sonido sintetizados. Las recetas sólo crean nodos al invocarse,
// así el registro se puede importar y validar en Node sin AudioContext.
import { midiToFreq, noteToMidi } from './score';
import { MIN_GAIN, biquad, chain, gainNode, noiseSrc, osc } from './synth';
import type { Voice } from './synth';

export const SFX_IDS = [
  'click',
  'back',
  'ready',
  'unready',
  'join',
  'leave',
  'countdown',
  'go',
  'jump',
  'doubleJump',
  'land',
  'heart',
  'box',
  'itemRoll',
  'itemGet',
  'turbo',
  'shield',
  'shieldBreak',
  'peel',
  'slip',
  'cloud',
  'kiss',
  'hit',
  'fall',
  'respawn',
  'spring',
  'boost',
  'checkpoint',
  'finish',
  'chaos',
  'plate',
  'door',
  'lever',
  'bridge',
  'elevator',
  'console',
  'synced',
  'splash',
  'answer',
  'reveal',
  'correct',
  'wrong',
  'skip',
  'tick',
  'whoosh',
  'emote',
  'pop',
  'confetti',
  'heartbeat',
] as const;

export type Sfx = (typeof SFX_IDS)[number];

export interface SfxOptions {
  /** paneo estéreo -1..1 */
  pan?: number;
  /** multiplicador tipo velocidad de reproducción: frecuencias × pitch, tiempos ÷ pitch */
  pitch?: number;
  /** volumen relativo 0..2 */
  volume?: number;
}

export interface SfxRecipeOptions {
  /** inicio absoluto (s) */
  t: number;
  /** multiplicador de velocidad (ver SfxOptions.pitch) */
  pitch: number;
  /** bolsa de nodos del efecto (limpieza automática) */
  voice: Voice;
}

export type SfxRecipe = (ctx: BaseAudioContext, dest: AudioNode, o: SfxRecipeOptions) => void;

type Path = ReadonlyArray<readonly [number, number]>;

/** Frecuencia de una nota por nombre ("E6"). */
const hz = (name: string): number => midiToFreq(noteToMidi(name));
/** Frecuencias seguras para AudioParam (dentro del rango nominal). */
const fq = (x: number): number => Math.min(18000, Math.max(1, x));

function applyPath(p: AudioParam, t: number, f0: number, pts: Path, k: number, mul: number): void {
  p.setValueAtTime(fq(f0 * mul), t);
  for (const [dt, f] of pts) p.exponentialRampToValueAtTime(fq(f * mul), t + Math.max(0.001, dt * k));
}

/**
 * Envolvente: 'perc' (ataque lineal y cola exponencial natural, ≈ -40 dB al cumplir `dur`)
 * u 'hold' (sostiene y cae lineal). Devuelve el instante en que ya es inaudible.
 */
function envelope(p: AudioParam, t: number, vol: number, attack: number, dur: number, env: 'perc' | 'hold'): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(vol, t + attack);
  if (env === 'hold') {
    p.setValueAtTime(vol, t + Math.max(attack, dur * 0.65));
    p.linearRampToValueAtTime(0, t + dur);
    return t + dur;
  }
  p.setTargetAtTime(0, t + attack, Math.max(0.003, dur / 4.5));
  return t + attack + dur * 1.3;
}

interface ToneSpec {
  type?: OscillatorType;
  /** frecuencia inicial (Hz) */
  f: number;
  /** frecuencia final (barrido exponencial durante `glide` o `dur`) */
  f2?: number;
  glide?: number;
  /** recorrido de frecuencia [tiempo, Hz] (reemplaza f2) */
  path?: Path;
  /** retardo (s) */
  at?: number;
  dur: number;
  vol: number;
  attack?: number;
  env?: 'perc' | 'hold';
  detune?: number;
  /** filtro paso bajo opcional y su recorrido */
  lp?: number;
  lpPath?: Path;
  q?: number;
  /** vibrato [Hz, cents] */
  vib?: readonly [number, number];
}

function tone(ctx: BaseAudioContext, dest: AudioNode, o: SfxRecipeOptions, s: ToneSpec): void {
  const p = o.pitch;
  const k = 1 / p;
  const t = o.t + (s.at ?? 0) * k;
  const os = osc(ctx, s.type ?? 'sine', fq(s.f * p), s.detune ?? 0);
  const path: Path | undefined = s.path ?? (s.f2 !== undefined ? [[s.glide ?? s.dur, s.f2]] : undefined);
  if (path) applyPath(os.frequency, t, s.f, path, k, p);
  const g = gainNode(ctx, o.voice);
  if (s.lp !== undefined) {
    const flt = biquad(ctx, o.voice, 'lowpass', fq(s.lp * p), s.q ?? 0.8);
    if (s.lpPath) applyPath(flt.frequency, t, s.lp, s.lpPath, k, p);
    chain(os, flt, g, dest);
  } else {
    chain(os, g, dest);
  }
  const end = envelope(g.gain, t, s.vol, (s.attack ?? 0.004) * k, s.dur * k, s.env ?? 'perc');
  o.voice.run(os, t, end + 0.01);
  if (s.vib) {
    const lfo = osc(ctx, 'sine', s.vib[0]);
    const depth = gainNode(ctx, o.voice, s.vib[1]);
    chain(lfo, depth);
    depth.connect(os.detune);
    o.voice.run(lfo, t, end + 0.01);
  }
}

interface HissSpec {
  type?: BiquadFilterType;
  f: number;
  f2?: number;
  path?: Path;
  q?: number;
  at?: number;
  dur: number;
  vol: number;
  attack?: number;
  env?: 'perc' | 'hold';
}

function hiss(ctx: BaseAudioContext, dest: AudioNode, o: SfxRecipeOptions, s: HissSpec): void {
  const p = o.pitch;
  const k = 1 / p;
  const t = o.t + (s.at ?? 0) * k;
  const flt = biquad(ctx, o.voice, s.type ?? 'bandpass', fq(s.f * p), s.q ?? 1);
  const path: Path | undefined = s.path ?? (s.f2 !== undefined ? [[s.dur, s.f2]] : undefined);
  if (path) applyPath(flt.frequency, t, s.f, path, k, p);
  const g = gainNode(ctx, o.voice);
  const end = envelope(g.gain, t, s.vol, (s.attack ?? 0.003) * k, s.dur * k, s.env ?? 'perc');
  chain(noiseSrc(ctx, o.voice, t, end + 0.01), flt, g, dest);
}

/** Campanita FM (brillo). */
function chime(
  ctx: BaseAudioContext,
  dest: AudioNode,
  o: SfxRecipeOptions,
  s: { f: number; at?: number; dur: number; vol: number; ratio?: number; index?: number },
): void {
  const p = o.pitch;
  const k = 1 / p;
  const t = o.t + (s.at ?? 0) * k;
  const f = fq(s.f * p);
  const dur = s.dur * k;
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', fq(f * (s.ratio ?? 3.5)));
  const mg = gainNode(ctx, o.voice);
  mg.gain.setValueAtTime(f * (s.index ?? 1.4), t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + dur * 0.6);
  chain(mod, mg);
  mg.connect(car.frequency);
  const g = gainNode(ctx, o.voice);
  chain(car, g, dest);
  const end = envelope(g.gain, t, s.vol, 0.002, dur, 'perc');
  o.voice.run(car, t, end + 0.01);
  o.voice.run(mod, t, end + 0.01);
}

/** Crujidos: una sola fuente de ruido con varios picos de volumen. */
function crackles(ctx: BaseAudioContext, dest: AudioNode, o: SfxRecipeOptions, times: readonly number[], vol: number): void {
  const k = 1 / o.pitch;
  const flt = biquad(ctx, o.voice, 'highpass', fq(5200 * o.pitch), 0.8);
  const g = gainNode(ctx, o.voice);
  let last = o.t;
  g.gain.setValueAtTime(0, o.t);
  times.forEach((dt, i) => {
    const t = o.t + dt * k;
    const v = vol * (i % 3 === 0 ? 1 : 0.6);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 0.025 * k);
    last = t + 0.03 * k;
  });
  chain(noiseSrc(ctx, o.voice, o.t, last + 0.01), flt, g, dest);
}

export const SFX_RECIPES: Readonly<Record<Sfx, SfxRecipe>> = {
  // --- Interfaz
  click: (c, d, o) => {
    tone(c, d, o, { f: 900, f2: 600, dur: 0.05, vol: 0.2, attack: 0.001 });
    tone(c, d, o, { type: 'triangle', f: 2400, dur: 0.015, vol: 0.05, attack: 0.001 });
  },
  back: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 700, dur: 0.06, vol: 0.2 });
    tone(c, d, o, { type: 'triangle', f: 480, at: 0.06, dur: 0.1, vol: 0.18 });
  },
  ready: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: hz('G5'), dur: 0.18, vol: 0.22 });
    tone(c, d, o, { type: 'triangle', f: hz('D6'), at: 0.08, dur: 0.35, vol: 0.22 });
    chime(c, d, o, { f: hz('D7'), at: 0.08, dur: 0.4, vol: 0.06 });
  },
  unready: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: hz('D6'), dur: 0.14, vol: 0.16 });
    tone(c, d, o, { type: 'triangle', f: hz('G5'), at: 0.08, dur: 0.28, vol: 0.16 });
  },
  join: (c, d, o) => {
    tone(c, d, o, { f: hz('E5'), dur: 0.22, vol: 0.2 });
    tone(c, d, o, { f: hz('G5'), at: 0.07, dur: 0.22, vol: 0.2 });
    tone(c, d, o, { f: hz('C6'), at: 0.14, dur: 0.4, vol: 0.22 });
    chime(c, d, o, { f: hz('C7'), at: 0.14, dur: 0.5, vol: 0.06 });
  },
  leave: (c, d, o) => {
    tone(c, d, o, { f: hz('C6'), dur: 0.2, vol: 0.17 });
    tone(c, d, o, { f: hz('A5'), at: 0.08, dur: 0.2, vol: 0.16 });
    tone(c, d, o, { f: hz('F5'), at: 0.16, dur: 0.38, vol: 0.16 });
  },
  countdown: (c, d, o) => {
    tone(c, d, o, { f: 880, dur: 0.16, vol: 0.28, attack: 0.005 });
    tone(c, d, o, { type: 'triangle', f: 1760, dur: 0.1, vol: 0.05 });
  },
  go: (c, d, o) => {
    tone(c, d, o, { f: 1760, dur: 0.45, vol: 0.26, attack: 0.005 });
    tone(c, d, o, { type: 'triangle', f: 880, dur: 0.4, vol: 0.14 });
    chime(c, d, o, { f: hz('E7'), at: 0.03, dur: 0.5, vol: 0.06 });
    hiss(c, d, o, { type: 'highpass', f: 6000, dur: 0.25, vol: 0.05 });
  },
  // --- Movimiento
  jump: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 330, f2: 780, glide: 0.11, dur: 0.14, vol: 0.26 });
    tone(c, d, o, { f: 660, f2: 1560, glide: 0.11, dur: 0.1, vol: 0.06 });
  },
  doubleJump: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 420, f2: 900, glide: 0.07, dur: 0.08, vol: 0.22 });
    tone(c, d, o, { type: 'triangle', f: 600, f2: 1300, glide: 0.1, at: 0.06, dur: 0.14, vol: 0.24 });
    hiss(c, d, o, { type: 'highpass', f: 7000, at: 0.06, dur: 0.12, vol: 0.05 });
  },
  land: (c, d, o) => {
    tone(c, d, o, { f: 160, f2: 70, glide: 0.08, dur: 0.1, vol: 0.35, attack: 0.002 });
    tone(c, d, o, { type: 'triangle', f: 240, f2: 120, glide: 0.06, dur: 0.07, vol: 0.2, attack: 0.002 });
    hiss(c, d, o, { type: 'lowpass', f: 900, dur: 0.06, vol: 0.12 });
    hiss(c, d, o, { f: 1300, q: 1.2, dur: 0.035, vol: 0.18 });
  },
  heart: (c, d, o) => {
    chime(c, d, o, { f: hz('E6'), dur: 0.35, vol: 0.22 });
    chime(c, d, o, { f: hz('B6'), at: 0.07, dur: 0.55, vol: 0.2 });
    hiss(c, d, o, { type: 'highpass', f: 8000, at: 0.07, dur: 0.15, vol: 0.04 });
  },
  box: (c, d, o) => {
    hiss(c, d, o, { f: 1800, f2: 600, q: 1.5, dur: 0.12, vol: 0.18 });
    tone(c, d, o, { type: 'triangle', f: 380, f2: 920, glide: 0.12, dur: 0.16, vol: 0.2 });
  },
  itemRoll: (c, d, o) => {
    const times = [0, 0.05, 0.1, 0.16, 0.23, 0.31, 0.4, 0.5, 0.62];
    const freqs = [1200, 1500, 1800];
    times.forEach((at, i) => tone(c, d, o, { f: freqs[i % 3] ?? 1500, at, dur: 0.03, vol: 0.14, attack: 0.001 }));
  },
  itemGet: (c, d, o) => {
    chime(c, d, o, { f: hz('C6'), dur: 0.3, vol: 0.17 });
    chime(c, d, o, { f: hz('E6'), at: 0.04, dur: 0.3, vol: 0.17 });
    chime(c, d, o, { f: hz('G6'), at: 0.08, dur: 0.3, vol: 0.17 });
    chime(c, d, o, { f: hz('C7'), at: 0.12, dur: 0.5, vol: 0.18 });
  },
  turbo: (c, d, o) => {
    tone(c, d, o, { type: 'sawtooth', f: 110, f2: 440, dur: 0.5, vol: 0.14, attack: 0.03, lp: 600, lpPath: [[0.45, 3000]], env: 'hold' });
    hiss(c, d, o, { f: 800, f2: 3000, dur: 0.5, vol: 0.12, attack: 0.05, env: 'hold' });
  },
  shield: (c, d, o) => {
    tone(c, d, o, { f: 600, f2: 900, dur: 0.5, vol: 0.13, attack: 0.08, vib: [7, 20] });
    tone(c, d, o, { f: 906, f2: 1350, dur: 0.5, vol: 0.1, attack: 0.08, vib: [7, 20] });
    hiss(c, d, o, { type: 'highpass', f: 5000, dur: 0.4, vol: 0.04, attack: 0.1 });
  },
  shieldBreak: (c, d, o) => {
    hiss(c, d, o, { type: 'highpass', f: 2500, dur: 0.35, vol: 0.22, attack: 0.001 });
    tone(c, d, o, { type: 'triangle', f: 900, f2: 300, dur: 0.15, vol: 0.12 });
    tone(c, d, o, { f: 3200, dur: 0.12, vol: 0.1, attack: 0.001 });
    tone(c, d, o, { f: 2500, at: 0.03, dur: 0.15, vol: 0.1, attack: 0.001 });
    tone(c, d, o, { f: 4100, at: 0.06, dur: 0.1, vol: 0.08, attack: 0.001 });
  },
  // --- Objetos y obstáculos
  peel: (c, d, o) => {
    tone(c, d, o, { f: 700, f2: 220, dur: 0.12, vol: 0.25 });
    hiss(c, d, o, { type: 'lowpass', f: 1200, dur: 0.05, vol: 0.08 });
  },
  slip: (c, d, o) => {
    // silbato de émbolo: sube y baja
    tone(c, d, o, { f: 500, path: [[0.25, 1500], [0.55, 700]], dur: 0.6, vol: 0.2, attack: 0.02, env: 'hold', vib: [6, 30] });
  },
  cloud: (c, d, o) => {
    hiss(c, d, o, { type: 'lowpass', f: 2000, f2: 400, dur: 0.45, vol: 0.2, attack: 0.02 });
    tone(c, d, o, { f: 500, f2: 350, dur: 0.5, vol: 0.08, attack: 0.05, env: 'hold', vib: [9, 80] });
  },
  kiss: (c, d, o) => {
    // "mmm-wah" + chasquido
    hiss(c, d, o, { f: 700, f2: 2400, q: 3, dur: 0.18, vol: 0.16, attack: 0.04 });
    tone(c, d, o, { type: 'triangle', f: 420, path: [[0.12, 880], [0.25, 650]], dur: 0.28, vol: 0.14, attack: 0.03, env: 'hold', lp: 1800 });
    tone(c, d, o, { f: 1400, f2: 2200, at: 0.26, dur: 0.04, vol: 0.15, attack: 0.001 });
  },
  hit: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 520, f2: 160, glide: 0.12, dur: 0.16, vol: 0.3, attack: 0.001 });
    tone(c, d, o, { f: 1200, f2: 700, dur: 0.03, vol: 0.08, attack: 0.001 });
    hiss(c, d, o, { type: 'lowpass', f: 2500, dur: 0.04, vol: 0.15 });
  },
  fall: (c, d, o) => {
    tone(c, d, o, { f: 1300, f2: 220, dur: 0.75, vol: 0.18, attack: 0.01, env: 'hold', vib: [7, 25] });
  },
  respawn: (c, d, o) => {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => chime(c, d, o, { f: hz(n), at: i * 0.06, dur: 0.35, vol: 0.14 }));
    hiss(c, d, o, { type: 'highpass', f: 6000, f2: 9000, dur: 0.5, vol: 0.05, attack: 0.1 });
  },
  spring: (c, d, o) => {
    tone(c, d, o, { f: 240, path: [[0.08, 520], [0.3, 380]], dur: 0.45, vol: 0.28, attack: 0.002, vib: [18, 120] });
    tone(c, d, o, { type: 'triangle', f: 480, path: [[0.08, 1040], [0.3, 760]], dur: 0.3, vol: 0.06 });
  },
  boost: (c, d, o) => {
    tone(c, d, o, { type: 'sawtooth', f: 300, f2: 1200, glide: 0.25, dur: 0.3, vol: 0.13, lp: 1500, lpPath: [[0.25, 4000]] });
    hiss(c, d, o, { f: 1000, f2: 4000, dur: 0.3, vol: 0.1, attack: 0.02 });
  },
  checkpoint: (c, d, o) => {
    chime(c, d, o, { f: hz('G5'), dur: 0.4, vol: 0.2 });
    chime(c, d, o, { f: hz('D6'), at: 0.08, dur: 0.6, vol: 0.2 });
    tone(c, d, o, { type: 'triangle', f: hz('B6'), at: 0.16, dur: 0.3, vol: 0.06 });
  },
  finish: (c, d, o) => {
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(c, d, o, { type: 'triangle', f: hz(n), at: i * 0.05, dur: 0.2, vol: 0.18 }));
    chime(c, d, o, { f: hz('C7'), at: 0.2, dur: 0.8, vol: 0.18 });
    hiss(c, d, o, { type: 'highpass', f: 4500, at: 0.2, dur: 0.9, vol: 0.1 });
  },
  chaos: (c, d, o) => {
    // "uh-oh" con voz cuadrada filtrada + remolino
    tone(c, d, o, { type: 'square', f: 523, dur: 0.16, vol: 0.12, attack: 0.01, env: 'hold', lp: 1400 });
    tone(c, d, o, { type: 'square', f: 392, f2: 370, at: 0.18, dur: 0.3, vol: 0.12, attack: 0.01, env: 'hold', lp: 1200 });
    tone(c, d, o, { f: 900, f2: 300, dur: 0.6, vol: 0.08, attack: 0.05, env: 'hold', vib: [10, 100] });
  },
  // --- Templo cooperativo
  plate: (c, d, o) => {
    tone(c, d, o, { f: 190, f2: 95, glide: 0.08, dur: 0.12, vol: 0.35, attack: 0.002 });
    tone(c, d, o, { type: 'triangle', f: 300, f2: 150, glide: 0.06, dur: 0.08, vol: 0.2, attack: 0.002 });
    hiss(c, d, o, { f: 900, q: 1.5, dur: 0.05, vol: 0.2 });
    hiss(c, d, o, { type: 'highpass', f: 3000, dur: 0.015, vol: 0.12 });
  },
  door: (c, d, o) => {
    hiss(c, d, o, { type: 'lowpass', f: 500, f2: 300, dur: 0.6, vol: 0.25, attack: 0.12, env: 'hold' });
    hiss(c, d, o, { f: 700, q: 2, dur: 0.55, vol: 0.14, attack: 0.1, env: 'hold' });
    tone(c, d, o, { type: 'triangle', f: 110, f2: 95, dur: 0.6, vol: 0.12, attack: 0.1, env: 'hold' });
    tone(c, d, o, { type: 'triangle', f: 220, f2: 190, dur: 0.5, vol: 0.05, attack: 0.1, env: 'hold' });
  },
  lever: (c, d, o) => {
    hiss(c, d, o, { type: 'highpass', f: 2500, dur: 0.014, vol: 0.18, attack: 0.004 });
    tone(c, d, o, { type: 'triangle', f: 900, f2: 700, dur: 0.03, vol: 0.15, attack: 0.003 });
    hiss(c, d, o, { type: 'highpass', f: 2500, at: 0.07, dur: 0.014, vol: 0.18, attack: 0.004 });
    tone(c, d, o, { type: 'triangle', f: 600, f2: 500, at: 0.07, dur: 0.04, vol: 0.15, attack: 0.003 });
  },
  bridge: (c, d, o) => {
    [420, 470, 530, 600].forEach((f, i) =>
      tone(c, d, o, { type: 'triangle', f, f2: f * 0.9, at: i * 0.08, dur: 0.07, vol: 0.22, attack: 0.001 }),
    );
  },
  elevator: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 220, f2: 330, dur: 0.6, vol: 0.12, attack: 0.08, env: 'hold', vib: [8, 15] });
    tone(c, d, o, { f: 440, f2: 660, dur: 0.6, vol: 0.04, attack: 0.08, env: 'hold' });
  },
  console: (c, d, o) => {
    [880, 1320, 1100].forEach((f, i) =>
      tone(c, d, o, { type: 'square', f, at: i * 0.08, dur: 0.07, vol: 0.1, attack: 0.002, lp: 2500 }),
    );
  },
  synced: (c, d, o) => {
    // crecida armónica mágica
    ['C5', 'G5', 'C6', 'E6'].forEach((n, i) =>
      tone(c, d, o, { f: hz(n), dur: 0.9, vol: 0.08, attack: 0.25, detune: i % 2 === 0 ? -4 : 4 }),
    );
    chime(c, d, o, { f: hz('G6'), at: 0.25, dur: 0.8, vol: 0.12 });
    hiss(c, d, o, { type: 'highpass', f: 7000, dur: 0.6, vol: 0.03, attack: 0.25 });
  },
  splash: (c, d, o) => {
    hiss(c, d, o, { f: 2500, f2: 500, q: 0.8, dur: 0.45, vol: 0.3, attack: 0.005 });
    tone(c, d, o, { f: 400, f2: 900, at: 0.08, dur: 0.06, vol: 0.08 });
    tone(c, d, o, { f: 500, f2: 1100, at: 0.16, dur: 0.05, vol: 0.07 });
    tone(c, d, o, { f: 350, f2: 800, at: 0.25, dur: 0.05, vol: 0.06 });
  },
  // --- Quiz
  answer: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: hz('E5'), dur: 0.2, vol: 0.2 });
    tone(c, d, o, { f: hz('A5'), at: 0.06, dur: 0.3, vol: 0.2 });
    tone(c, d, o, { f: hz('A5') * 4, at: 0.06, dur: 0.05, vol: 0.04 });
  },
  reveal: (c, d, o) => {
    hiss(c, d, o, { f: 800, f2: 4000, dur: 0.2, vol: 0.12, attack: 0.15 });
    for (const n of ['C6', 'E6', 'G6']) chime(c, d, o, { f: hz(n), at: 0.2, dur: 0.6, vol: 0.11 });
    tone(c, d, o, { type: 'triangle', f: hz('C5'), at: 0.2, dur: 0.5, vol: 0.12 });
  },
  correct: (c, d, o) => {
    chime(c, d, o, { f: hz('C6'), dur: 0.4, vol: 0.18 });
    chime(c, d, o, { f: hz('E6'), at: 0.06, dur: 0.4, vol: 0.18 });
    chime(c, d, o, { f: hz('G6'), at: 0.12, dur: 0.7, vol: 0.18 });
    tone(c, d, o, { type: 'triangle', f: hz('C7'), at: 0.12, dur: 0.3, vol: 0.05 });
  },
  wrong: (c, d, o) => {
    // "wah-wah" suave: sierra con filtro que abre y cierra
    tone(c, d, o, { type: 'sawtooth', f: 311, dur: 0.22, vol: 0.14, attack: 0.01, env: 'hold', lp: 400, lpPath: [[0.08, 1400], [0.2, 500]] });
    tone(c, d, o, { type: 'sawtooth', f: 277, f2: 262, at: 0.25, dur: 0.4, vol: 0.14, attack: 0.01, env: 'hold', lp: 400, lpPath: [[0.1, 1200], [0.38, 350]] });
  },
  skip: (c, d, o) => {
    hiss(c, d, o, { f: 3000, f2: 800, dur: 0.22, vol: 0.15, attack: 0.02 });
    tone(c, d, o, { type: 'triangle', f: 700, f2: 400, dur: 0.1, vol: 0.1 });
  },
  tick: (c, d, o) => {
    tone(c, d, o, { type: 'triangle', f: 1900, f2: 1700, dur: 0.025, vol: 0.15, attack: 0.001 });
    hiss(c, d, o, { type: 'highpass', f: 4000, dur: 0.008, vol: 0.06 });
  },
  // --- Genéricos
  whoosh: (c, d, o) => {
    hiss(c, d, o, { f: 400, path: [[0.15, 2500], [0.4, 600]], q: 1.2, dur: 0.4, vol: 0.2, attack: 0.12 });
  },
  emote: (c, d, o) => {
    tone(c, d, o, { f: 620, f2: 930, glide: 0.06, dur: 0.16, vol: 0.22 });
    tone(c, d, o, { type: 'triangle', f: 1240, f2: 1860, glide: 0.06, dur: 0.1, vol: 0.05 });
  },
  pop: (c, d, o) => {
    tone(c, d, o, { f: 380, f2: 1400, glide: 0.03, dur: 0.05, vol: 0.25, attack: 0.001 });
    hiss(c, d, o, { type: 'highpass', f: 3000, dur: 0.01, vol: 0.08 });
  },
  confetti: (c, d, o) => {
    crackles(c, d, o, [0, 0.05, 0.09, 0.16, 0.22, 0.3, 0.37, 0.46], 0.14);
    chime(c, d, o, { f: hz('G6'), at: 0.05, dur: 0.3, vol: 0.08 });
    chime(c, d, o, { f: hz('C7'), at: 0.15, dur: 0.3, vol: 0.08 });
    chime(c, d, o, { f: hz('E7'), at: 0.25, dur: 0.4, vol: 0.08 });
  },
  heartbeat: (c, d, o) => {
    // "lub-dub": dos golpes suaves (con armónico para parlantes chicos)
    for (const [at, vol] of [
      [0, 0.4],
      [0.2, 0.3],
    ] as const) {
      tone(c, d, o, { f: 110, f2: 60, glide: 0.08, at, dur: 0.14, vol, attack: 0.004 });
      tone(c, d, o, { type: 'triangle', f: 220, f2: 110, glide: 0.06, at, dur: 0.08, vol: vol * 0.6, attack: 0.004 });
      hiss(c, d, o, { f: 600, q: 1.2, at, dur: 0.05, vol: vol * 0.35 });
    }
  },
};

/**
 * Mezcla por efecto (multiplicador de la ganancia de salida). Calibrada con renders
 * offline ponderados A: los efectos frecuentes (salto, tic) quedan por debajo de los
 * eventos (meta, acierto), y todos por encima de la música de fondo.
 */
export const SFX_GAIN: Readonly<Record<Sfx, number>> = {
  click: 1.75, back: 1.56, ready: 0.59, unready: 0.76, join: 0.53, leave: 0.72, countdown: 1.29, go: 0.68,
  jump: 2.34, doubleJump: 1.16, land: 2.88, heart: 0.55, box: 3.05, itemRoll: 1.41, itemGet: 0.53, turbo: 1.04,
  shield: 0.78, shieldBreak: 0.89, peel: 1.71, slip: 0.38, cloud: 1.44, kiss: 0.85, hit: 2.04, fall: 0.45,
  respawn: 0.68, spring: 1.13, boost: 2.72, checkpoint: 0.54, finish: 0.58, chaos: 0.85, plate: 3.01,
  door: 1.86, lever: 2.1, bridge: 1.2, elevator: 1.32, console: 1.29, synced: 0.64, splash: 1.23,
  answer: 0.75, reveal: 0.73, correct: 0.57, wrong: 1.26, skip: 2.13, tick: 3.19, whoosh: 1.12, emote: 1.62,
  pop: 2.59, confetti: 1.21, heartbeat: 3.15,
};
