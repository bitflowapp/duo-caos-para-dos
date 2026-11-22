// Pruebas del audio: validan las partituras (tempo, rango MIDI, duraciones, encaje en compases),
// la cobertura de efectos y, con un AudioContext falso mínimo, el planificador anticipado,
// los límites de voces y el comportamiento del motor (desbloqueo, fundidos, silencio, segundo plano).
import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/AudioEngine';
import { JINGLES, JINGLE_KINDS } from '../src/audio/jingles';
import type { JingleKind } from '../src/audio/jingles';
import { LOOKAHEAD, MAX_MUSIC_VOICES, MUSIC_TRACKS, Sequencer, TRACKS, compileTrack, swingWarp } from '../src/audio/music';
import { INSTRUMENT_IDS, STEPS_PER_BAR, notationErrors, noteToMidi } from '../src/audio/score';
import type { TrackDef } from '../src/audio/score';
import { SFX_GAIN, SFX_IDS, SFX_RECIPES } from '../src/audio/sfx';
import type { Sfx } from '../src/audio/sfx';
import { INSTRUMENTS, Voice, voiceStats } from '../src/audio/synth';

// ---------------------------------------------------------------------------
// AudioContext falso: valida valores finitos, rampas exponenciales > 0, stop() después de start(),
// y connect() devuelve undefined (como Safari antiguo) para detectar encadenamientos.

function finite(...xs: number[]): void {
  for (const x of xs) if (!Number.isFinite(x)) throw new TypeError(`valor no finito: ${x}`);
}

class FakeParam {
  private v: number;
  constructor(v = 0) {
    this.v = v;
  }
  get value(): number {
    return this.v;
  }
  set value(x: number) {
    finite(x);
    this.v = x;
  }
  setValueAtTime(x: number, t: number): this {
    finite(x, t);
    this.v = x;
    return this;
  }
  linearRampToValueAtTime(x: number, t: number): this {
    finite(x, t);
    return this;
  }
  exponentialRampToValueAtTime(x: number, t: number): this {
    finite(x, t);
    if (x <= 0) throw new RangeError('rampa exponencial hacia un valor <= 0');
    return this;
  }
  setTargetAtTime(x: number, t: number, tau: number): this {
    finite(x, t, tau);
    if (tau <= 0) throw new RangeError('constante de tiempo <= 0');
    return this;
  }
  cancelScheduledValues(t: number): this {
    finite(t);
    return this;
  }
}

class FakeNode {
  constructor(readonly ctx: FakeContext) {
    ctx.nodesCreated++;
  }
  connect(_dest: unknown): void {
    // sin valor de retorno a propósito
  }
  disconnect(): void {
    // nada
  }
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  startAt = -1;
  stopAt = Number.POSITIVE_INFINITY;
  ended = false;
  start(t = 0, offset = 0): void {
    finite(t, offset);
    this.startAt = t;
    this.ctx.registerStart(this, t);
  }
  stop(t = 0): void {
    finite(t);
    if (this.startAt < 0) throw new Error('stop() antes de start()');
    this.stopAt = t;
  }
}

class FakeOsc extends FakeSource {
  type = 'sine';
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
}
class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam(1);
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}
class FakePanner extends FakeNode {
  pan = new FakeParam(0);
}
class FakeDelay extends FakeNode {
  delayTime = new FakeParam(0);
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = 'none';
}
class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
}

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  onstatechange: (() => void) | null = null;
  nodesCreated = 0;
  /** mayor adelanto (inicio programado − currentTime) observado */
  maxLead = 0;
  /** menor adelanto observado (negativo = nota atrasada) */
  minLead = Number.POSITIVE_INFINITY;
  private live: FakeSource[] = [];
  readonly destination: FakeNode;
  constructor() {
    this.destination = new FakeNode(this);
  }
  registerStart(s: FakeSource, t: number): void {
    this.live.push(s);
    this.maxLead = Math.max(this.maxLead, t - this.currentTime);
    this.minLead = Math.min(this.minLead, t - this.currentTime);
  }
  /** Avanza el reloj y dispara onended de las fuentes ya detenidas. */
  advance(t: number): void {
    this.currentTime = t;
    const still: FakeSource[] = [];
    for (const s of this.live) {
      if (s.stopAt <= t) {
        s.ended = true;
        s.onended?.();
      } else still.push(s);
    }
    this.live = still;
  }
  get liveSources(): number {
    return this.live.length;
  }
  createGain(): FakeGain {
    return new FakeGain(this);
  }
  createOscillator(): FakeOsc {
    return new FakeOsc(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter(this);
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this);
  }
  createDelay(): FakeDelay {
    return new FakeDelay(this);
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this);
  }
  createWaveShaper(): FakeShaper {
    return new FakeShaper(this);
  }
  createBuffer(channels: number, length: number, sampleRate: number): object {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate, getChannelData: () => data };
  }
}

/** Variante con ciclo de vida (resume/suspend asíncronos) para probar el motor. */
class FakeAudioContext extends FakeContext {
  constructor(_opts?: unknown) {
    super();
    this.state = 'suspended';
  }
  resume(): Promise<void> {
    this.state = 'running';
    queueMicrotask(() => this.onstatechange?.());
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    queueMicrotask(() => this.onstatechange?.());
    return Promise.resolve();
  }
}

// Conversión explícita del contexto falso a los tipos de Web Audio (sólo en pruebas)
const asCtx = (c: FakeContext): BaseAudioContext => c as unknown as BaseAudioContext;
const asNode = (n: FakeNode): AudioNode => n as unknown as AudioNode;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// ---------------------------------------------------------------------------
// Partituras

function validateTrack(def: TrackDef, minBars: number, maxBars: number): void {
  expect(Number.isFinite(def.bpm)).toBe(true);
  expect(def.bpm).toBeGreaterThanOrEqual(60);
  expect(def.bpm).toBeLessThanOrEqual(200);
  if (def.swing) {
    expect(def.swing.amount).toBeGreaterThanOrEqual(0);
    expect(def.swing.amount).toBeLessThanOrEqual(def.swing.unit === 16 ? 0.5 : 0.75);
  }
  const names = new Set(def.voices.map((v) => v.name));
  expect(names.size).toBe(def.voices.length);
  for (const v of def.voices) {
    expect(INSTRUMENT_IDS).toContain(v.inst);
    expect(v.gain).toBeGreaterThan(0);
    expect(v.gain).toBeLessThanOrEqual(1.5);
    if (v.pan !== undefined) expect(Math.abs(v.pan)).toBeLessThanOrEqual(1);
    if (v.gate !== undefined) expect(v.gate).toBeGreaterThan(0);
  }
  let notes = 0;
  for (const sec of def.sections) {
    expect(Number.isInteger(sec.bars) && sec.bars > 0).toBe(true);
    const len = sec.bars * STEPS_PER_BAR;
    for (const [voice, events] of Object.entries(sec.parts)) {
      expect(names.has(voice), `${def.id}/${sec.name}: voz ${voice}`).toBe(true);
      for (const e of events ?? []) {
        const where = `${def.id}/${sec.name}/${voice} paso ${e.s}`;
        expect(Number.isFinite(e.n), where).toBe(true);
        expect(e.n, where).toBeGreaterThanOrEqual(24);
        expect(e.n, where).toBeLessThanOrEqual(108);
        expect(Number.isInteger(e.s), where).toBe(true);
        expect(e.s, where).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(e.d) && e.d > 0, where).toBe(true);
        expect(e.s + e.d, where).toBeLessThanOrEqual(len);
        expect(e.v > 0 && e.v <= 1, where).toBe(true);
        notes++;
      }
    }
  }
  expect(notes).toBeGreaterThan(0);
  const bars = def.order.reduce((n, i) => n + (def.sections[i]?.bars ?? Number.NaN), 0);
  expect(bars).toBeGreaterThanOrEqual(minBars);
  expect(bars).toBeLessThanOrEqual(maxBars);
  expect(compileTrack(def).errors).toEqual([]);
}

describe('partituras', () => {
  it('la notación no reporta errores y convierte nombres de nota correctamente', () => {
    expect(notationErrors).toEqual([]);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('F#2')).toBe(42);
    expect(Number.isNaN(noteToMidi('H2'))).toBe(true);
  });

  it.each(MUSIC_TRACKS)('el tema "%s" es válido, de 8 a 16 compases y con variación A/B', (id) => {
    const def = TRACKS[id];
    expect(def.loop).toBe(true);
    validateTrack(def, 8, 16);
    const distinct = new Set(def.order.map((i) => JSON.stringify(def.sections[i]?.parts)));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  it('los tempos respetan el carácter pedido de cada tema', () => {
    const ranges: Record<string, [number, number]> = {
      menu: [92, 98],
      race: [140, 150],
      coop: [105, 112],
      quiz: [118, 124],
      results: [84, 90],
    };
    for (const id of MUSIC_TRACKS) {
      const [lo, hi] = ranges[id] ?? [0, 0];
      expect(TRACKS[id].bpm).toBeGreaterThanOrEqual(lo);
      expect(TRACKS[id].bpm).toBeLessThanOrEqual(hi);
    }
  });

  it('la carrera tiene capas para las intensidades 1 y 2', () => {
    const layers = new Set(TRACKS.race.voices.map((v) => v.layer ?? 0));
    expect(layers).toEqual(new Set([0, 1, 2]));
  });

  it.each(JINGLE_KINDS)('el jingle "%s" es válido y dura entre 1.5 y 4 s', (kind) => {
    const def = JINGLES[kind];
    expect(def.loop).toBe(false);
    validateTrack(def, 1, 4);
    const c = compileTrack(def);
    const seconds = c.loopSteps * c.stepDur;
    expect(seconds).toBeGreaterThanOrEqual(1.5);
    expect(seconds).toBeLessThanOrEqual(4);
  });

  it('el swing es monótono, periódico y conserva los tiempos fuertes', () => {
    for (const swing of [
      { amount: 0.14, unit: 16 as const },
      { amount: 0.55, unit: 8 as const },
    ]) {
      let prev = -1;
      for (let x = 0; x <= 64; x += 0.25) {
        const y = swingWarp(x, swing);
        expect(y).toBeGreaterThan(prev);
        prev = y;
      }
      for (let beat = 0; beat <= 64; beat += 4) expect(swingWarp(beat, swing)).toBeCloseTo(beat, 9);
    }
    expect(swingWarp(2, { amount: 0.5, unit: 8 })).toBeCloseTo(2.5, 9);
    expect(swingWarp(1, { amount: 0.2, unit: 16 })).toBeCloseTo(1.2, 9);
  });

  it('cada instrumento referido existe en el registro', () => {
    for (const id of INSTRUMENT_IDS) expect(typeof INSTRUMENTS[id]).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Efectos

const EXPECTED_SFX: readonly Sfx[] = [
  'click', 'back', 'ready', 'unready', 'join', 'leave', 'countdown', 'go', 'jump', 'doubleJump', 'land',
  'heart', 'box', 'itemRoll', 'itemGet', 'turbo', 'shield', 'shieldBreak', 'peel', 'slip', 'cloud', 'kiss',
  'hit', 'fall', 'respawn', 'spring', 'boost', 'checkpoint', 'finish', 'chaos', 'plate', 'door', 'lever',
  'bridge', 'elevator', 'console', 'synced', 'splash', 'answer', 'reveal', 'correct', 'wrong', 'skip',
  'tick', 'whoosh', 'emote', 'pop', 'confetti', 'heartbeat',
];

describe('efectos', () => {
  it('cada id de efecto tiene exactamente una receta', () => {
    expect([...SFX_IDS].sort()).toEqual([...EXPECTED_SFX].sort());
    expect(new Set(SFX_IDS).size).toBe(SFX_IDS.length);
    expect(Object.keys(SFX_RECIPES).sort()).toEqual([...SFX_IDS].sort());
    for (const id of SFX_IDS) expect(typeof SFX_RECIPES[id]).toBe('function');
    expect(Object.keys(SFX_GAIN).sort()).toEqual([...SFX_IDS].sort());
    for (const id of SFX_IDS) expect(SFX_GAIN[id] > 0 && SFX_GAIN[id] <= 5).toBe(true);
  });

  it.each(SFX_IDS)('la receta "%s" genera nodos válidos, breves y que se liberan solos', (id) => {
    const base = voiceStats.live;
    for (const pitch of [0.5, 1, 2]) {
      const ctx = new FakeContext();
      ctx.advance(1);
      const v = new Voice();
      const out = ctx.createGain();
      SFX_RECIPES[id](asCtx(ctx), asNode(out), { t: 1.005, pitch, voice: v });
      v.seal();
      expect(ctx.liveSources).toBeGreaterThan(0);
      expect(v.end).toBeGreaterThan(1);
      expect(v.end - 1).toBeLessThan(3);
      ctx.advance(10);
      expect(ctx.liveSources).toBe(0);
    }
    expect(voiceStats.live).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// Planificador

describe('secuenciador', () => {
  it.each(MUSIC_TRACKS)('"%s": programa cada nota una vez por vuelta y sólo dentro de la ventana', (id) => {
    const compiled = compileTrack(TRACKS[id]);
    const total = compiled.buckets.reduce((n, b) => n + b.length, 0);
    const ctx = new FakeContext();
    const base = voiceStats.live;
    const created0 = voiceStats.created;
    const origin = 0.05;
    const seq = new Sequencer(asCtx(ctx), asNode(ctx.destination), compiled, origin, 2);
    const loopEnd = origin + compiled.loopSteps * compiled.stepDur;
    let peak = 0;
    for (let now = 0; now + LOOKAHEAD < loopEnd - 0.001; now += 0.02) {
      ctx.advance(now);
      seq.tick(now);
      peak = Math.max(peak, voiceStats.live - base);
    }
    expect(voiceStats.created - created0).toBe(total);
    expect(ctx.maxLead).toBeLessThanOrEqual(LOOKAHEAD + 1e-9);
    expect(ctx.minLead).toBeGreaterThanOrEqual(-0.021);
    expect(peak).toBeLessThan(MAX_MUSIC_VOICES);
    // fundido de salida: deja de programar, y al terminar las fuentes no queda nada vivo
    const t = ctx.currentTime;
    seq.fadeOut(t, 0.6);
    for (let now = t; now < t + 1.5; now += 0.02) {
      ctx.advance(now);
      seq.tick(now);
    }
    seq.dispose();
    ctx.advance(t + 20);
    expect(voiceStats.live).toBe(base);
  });

  it('tras un bloqueo largo del hilo principal salta sin disparar notas atrasadas', () => {
    const compiled = compileTrack(TRACKS.race);
    const ctx = new FakeContext();
    const seq = new Sequencer(asCtx(ctx), asNode(ctx.destination), compiled, 0.05, 2);
    seq.tick(0);
    const created0 = voiceStats.created;
    ctx.advance(12.34);
    ctx.minLead = Number.POSITIVE_INFINITY;
    seq.tick(12.34);
    expect(voiceStats.created - created0).toBeLessThanOrEqual(16);
    expect(ctx.minLead).toBeGreaterThanOrEqual(-0.021);
    seq.dispose();
    ctx.advance(30);
  });

  it('las capas apagadas no crean nodos', () => {
    const compiled = compileTrack(TRACKS.race);
    const ctx = new FakeContext();
    const count = (level: 0 | 2): number => {
      const before = voiceStats.created;
      const seq = new Sequencer(asCtx(ctx), asNode(ctx.destination), compiled, ctx.currentTime + 0.05, level);
      const start = ctx.currentTime;
      for (let now = start; now < start + 5; now += 0.02) {
        ctx.advance(now);
        seq.tick(now);
      }
      seq.dispose();
      return voiceStats.created - before;
    };
    const low = count(0);
    const high = count(2);
    expect(high).toBeGreaterThan(low * 1.5);
    ctx.advance(ctx.currentTime + 20);
  });
});

// ---------------------------------------------------------------------------
// Motor

describe('motor de audio', () => {
  it('desbloqueo, tema recordado, fundidos, polifonía, jingles, silencio y segundo plano', async () => {
    vi.useFakeTimers();
    const g = globalThis as { AudioContext?: unknown };
    const previous = g.AudioContext;
    g.AudioContext = FakeAudioContext;
    const baseLive = voiceStats.live;
    try {
      const engine = new AudioEngine();
      engine.play('click'); // antes del desbloqueo: no hace nada y no lanza
      engine.playMusic('menu');
      expect(engine.unlocked).toBe(false);
      expect(engine.getStats().track).toBeNull();

      await engine.unlock();
      await flush();
      expect(engine.unlocked).toBe(true);
      expect(engine.getStats().track).toBe('menu');
      expect(engine.getStats().schedulerRunning).toBe(true);
      const ctx = engine.context as unknown as FakeAudioContext;
      const step = (seconds: number): void => {
        for (let t = 0; t < seconds; t += 0.025) {
          ctx.advance(ctx.currentTime + 0.025);
          vi.advanceTimersByTime(25);
        }
      };
      step(1);

      // mismo tema: no reinicia; tema nuevo: fundido cruzado con dos secuenciadores
      engine.playMusic('menu');
      expect(engine.getStats().sequencers).toBe(1);
      engine.playMusic('race');
      expect(engine.getStats().sequencers).toBe(2);
      step(1);
      expect(engine.getStats().sequencers).toBe(1);
      expect(engine.getStats().track).toBe('race');

      // polifonía: 6 saltos cada 21 ms (cada uno dura ~150 ms) → se aceptan sólo 4 simultáneos
      // (el planificador de música no corre aquí porque los temporizadores falsos no avanzan)
      const createdBefore = voiceStats.created;
      for (let i = 0; i < 6; i++) {
        ctx.advance(ctx.currentTime + 0.021);
        engine.play('jump', { pitch: 1 + i * 0.01, pan: -0.5 });
      }
      expect(voiceStats.created - createdBefore).toBe(4);
      engine.play('land'); // otro id tiene su propio cupo
      expect(voiceStats.created - createdBefore).toBe(5);
      ctx.advance(ctx.currentTime + 0.3);
      engine.play('jump'); // terminadas las anteriores, vuelve a aceptar
      expect(voiceStats.created - createdBefore).toBe(6);
      // entradas inválidas no lanzan
      engine.play('noExiste' as Sfx, { pitch: Number.NaN, volume: Number.POSITIVE_INFINITY, pan: 7 });
      engine.play('constructor' as Sfx);
      engine.jingle('toString' as JingleKind);

      engine.setMusicIntensity(2);
      engine.setMusicIntensity(2);
      expect(engine.getStats().intensity).toBe(2);
      engine.jingle('victory');
      expect(engine.getStats().sequencers).toBe(2);
      step(0.5);

      // silencio: fundido y luego suspensión; los efectos se ignoran
      engine.setMuted(true);
      vi.advanceTimersByTime(200);
      await flush();
      expect(ctx.state).toBe('suspended');
      const created = voiceStats.created;
      engine.play('jump');
      engine.jingle('tie');
      expect(voiceStats.created).toBe(created);
      engine.setMuted(false);
      await flush();
      expect(ctx.state).toBe('running');

      // segundo plano
      engine.setBackground(true);
      await flush();
      expect(ctx.state).toBe('suspended');
      engine.setBackground(false);
      await flush();
      expect(ctx.state).toBe('running');

      // detener todo: el planificador se apaga y no quedan voces vivas
      engine.playMusic(null);
      step(6);
      expect(engine.getStats().sequencers).toBe(0);
      expect(engine.getStats().schedulerRunning).toBe(false);
      ctx.advance(ctx.currentTime + 30);
      expect(voiceStats.live).toBe(baseLive);
    } finally {
      g.AudioContext = previous;
      vi.useRealTimers();
    }
  });
});
