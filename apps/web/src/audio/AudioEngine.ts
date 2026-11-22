// Motor de audio de DUO: contexto Web Audio perezoso, buses de música y efectos,
// fundidos cruzados, jingles con atenuación ("ducking") de la música, efectos con
// polifonía limitada y ciclo de vida móvil (desbloqueo por gesto, segundo plano,
// interrupciones de iOS). Nunca lanza excepciones hacia el juego.
import { JINGLES } from './jingles';
import type { JingleKind } from './jingles';
import { MUSIC_TRACKS, Sequencer, TRACKS, compileTrack } from './music';
import type { CompiledTrack, MusicIntensity, MusicTrack } from './music';
import type { TrackDef } from './score';
import { SFX_GAIN, SFX_RECIPES } from './sfx';
import type { Sfx, SfxOptions } from './sfx';
import { Voice, chain, clamp, rampParam, voiceStats } from './synth';

export type { MusicTrack, MusicIntensity } from './music';
export type { Sfx, SfxOptions } from './sfx';
export type { JingleKind } from './jingles';

const CROSSFADE = 0.6;
const SCHEDULER_INTERVAL_MS = 25;
/** Nivel de la música mientras suena un jingle. */
const DUCK_LEVEL = 0.22;
/** Máximo de instancias simultáneas del mismo efecto. */
const SFX_MAX_PER_ID = 4;
/** Presupuesto global de voces vivas para aceptar un efecto nuevo. */
const SFX_MAX_VOICES = 96;
/** Rebote mínimo entre disparos del mismo efecto (s). */
const SFX_MIN_GAP = 0.02;
/** Ajustes de mezcla (medidos con render offline: picos < 1.0). */
const MUSIC_TRIM = 0.8;
const SFX_TRIM = 2;
const MASTER_LEVEL = 0.9;

export interface AudioStats {
  state: string;
  unlocked: boolean;
  muted: boolean;
  hidden: boolean;
  track: MusicTrack | null;
  wantedTrack: MusicTrack | null;
  intensity: MusicIntensity;
  liveVoices: number;
  peakVoices: number;
  createdVoices: number;
  sequencers: number;
  schedulerRunning: boolean;
}

/** Rango de señal cubierto por la curva del limitador suave (permite picos de hasta ±2 antes de saturar). */
const CLIP_RANGE = 2;
let clipCurve: Float32Array<ArrayBuffer> | null = null;

/** Curva lineal hasta 0.8 y rodilla tanh hasta 1.0: evita el recorte digital duro en cualquier combinación. */
function softClipCurve(): Float32Array<ArrayBuffer> {
  if (clipCurve) return clipCurve;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = ((i / (n - 1)) * 2 - 1) * CLIP_RANGE;
    const a = Math.abs(s);
    const y = a <= 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2);
    curve[i] = Math.sign(s) * y;
  }
  clipCurve = curve;
  return curve;
}

export interface Mixer {
  /** entrada de los temas (la atenúan los jingles) */
  duck: GainNode;
  /** bus de música (volumen de música; los jingles entran acá) */
  music: GainNode;
  /** bus de efectos */
  sfx: GainNode;
  compressor: DynamicsCompressorNode;
  /** volumen general / silencio */
  master: GainNode;
  /** limitador suave final (seguridad ante picos) */
  limiter: WaveShaperNode;
}

/** Cadena de mezcla: duck → música ┐ efectos ┤→ compresor → master → limitador suave → salida. */
export function createMixer(ctx: BaseAudioContext, musicGain: number, sfxGain: number, masterGain: number): Mixer {
  const duck = ctx.createGain();
  const music = ctx.createGain();
  const sfx = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const master = ctx.createGain();
  const limiter = ctx.createWaveShaper();
  limiter.curve = softClipCurve();
  limiter.oversample = 'none';
  music.gain.value = musicGain;
  sfx.gain.value = sfxGain;
  master.gain.value = masterGain / CLIP_RANGE;
  compressor.threshold.value = -14;
  compressor.knee.value = 10;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  chain(duck, music, compressor, master, limiter, ctx.destination);
  sfx.connect(compressor);
  return { duck, music, sfx, compressor, master, limiter };
}

/** Curva perceptual del control de volumen (0..1 → ganancia). */
export function volumeCurve(v: number): number {
  const x = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  return x * x;
}

/** Ganancia del bus de música para un volumen dado (incluye el ajuste de mezcla). */
export function musicBusGain(v: number): number {
  return volumeCurve(v) * MUSIC_TRIM;
}

/** Ganancia del bus de efectos para un volumen dado (incluye el ajuste de mezcla). */
export function sfxBusGain(v: number): number {
  return volumeCurve(v) * SFX_TRIM;
}

export const MASTER_GAIN = MASTER_LEVEL;

function getAudioContextCtor(): typeof AudioContext | undefined {
  // Safari antiguo (iOS < 14.5) sólo expone el prefijo webkit
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  if (typeof g.AudioContext === 'function') return g.AudioContext;
  return typeof g.webkitAudioContext === 'function' ? g.webkitAudioContext : undefined;
}

/** Sin estrechamiento de tipos: el estado cambia de forma asíncrona. */
function isRunning(ctx: BaseAudioContext): boolean {
  return ctx.state === 'running';
}

/** Sólo claves propias (evita 'constructor', '__proto__'... llegados desde JS sin tipos). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function finiteOr(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

/** Espera una promesa como máximo `ms` (iOS puede dejar resume() pendiente para siempre). */
function settle(p: Promise<unknown> | undefined, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (!p) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    p.then(done, done);
  });
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private canPan = false;
  private isUnlocked = false;
  private isMuted = false;
  private hidden = false;
  private musicVol = 0.7;
  private sfxVol = 0.9;
  private wanted: MusicTrack | null = null;
  private current: { id: MusicTrack; seq: Sequencer } | null = null;
  private fading: { seq: Sequencer; disposeAt: number }[] = [];
  private jingleSeq: Sequencer | null = null;
  private intensity: MusicIntensity = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private graceUntil = 0;
  private readonly compiled = new Map<string, CompiledTrack>();
  private readonly sfxEnds = new Map<Sfx, number[]>();
  private readonly sfxLast = new Map<Sfx, number>();

  /** true cuando el contexto llegó a reproducir al menos una vez (hubo gesto). */
  get unlocked(): boolean {
    return this.isUnlocked;
  }

  get muted(): boolean {
    return this.isMuted;
  }

  get musicVolume(): number {
    return this.musicVol;
  }

  get sfxVolume(): number {
    return this.sfxVol;
  }

  /** Tema pedido (suena cuando el audio está desbloqueado). */
  get currentTrack(): MusicTrack | null {
    return this.wanted;
  }

  /** Contexto subyacente (null hasta el primer gesto). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** true si un gesto del usuario debería (re)activar el audio. */
  get needsGesture(): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.isUnlocked) return true;
    if (this.isMuted || this.hidden) return false;
    return !isRunning(ctx);
  }

  /**
   * Desbloquea el audio. Llamar desde un gesto (pointerdown/touchend/keydown).
   * Crea el contexto de forma perezosa, lo reanuda y en iOS reproduce un buffer
   * silencioso de una muestra. Idempotente.
   */
  async unlock(): Promise<void> {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (isRunning(ctx)) {
        this.markRunning();
        return;
      }
      // Todo lo que sigue debe ocurrir sincrónicamente dentro del gesto
      this.playSilence(ctx);
      this.graceUntil = nowMs() + 400;
      const pending = typeof ctx.resume === 'function' ? ctx.resume() : undefined;
      await settle(pending, 1500);
      if (isRunning(ctx)) this.markRunning();
    } catch {
      // el audio nunca debe romper el juego
    }
  }

  setMusicVolume(v: number): void {
    this.musicVol = clamp(finiteOr(v, this.musicVol), 0, 1);
    const ctx = this.ctx;
    const mixer = this.mixer;
    if (!ctx || !mixer) return;
    try {
      rampParam(mixer.music.gain, musicBusGain(this.musicVol), ctx.currentTime, 0.08);
    } catch {
      // ignorar
    }
  }

  setSfxVolume(v: number): void {
    this.sfxVol = clamp(finiteOr(v, this.sfxVol), 0, 1);
    const ctx = this.ctx;
    const mixer = this.mixer;
    if (!ctx || !mixer) return;
    try {
      rampParam(mixer.sfx.gain, sfxBusGain(this.sfxVol), ctx.currentTime, 0.08);
    } catch {
      // ignorar
    }
  }

  /** Silencio general con fundido; con el audio silenciado se suspende el contexto (ahorra batería). */
  setMuted(m: boolean): void {
    this.isMuted = Boolean(m);
    const ctx = this.ctx;
    const mixer = this.mixer;
    if (!ctx || !mixer) return;
    try {
      rampParam(mixer.master.gain, this.isMuted ? 0 : MASTER_LEVEL / CLIP_RANGE, ctx.currentTime, 0.08);
      this.syncSuspension();
    } catch {
      // ignorar
    }
  }

  /** Fundido cruzado (~0.6 s) al tema indicado; null funde a silencio. Antes del desbloqueo sólo lo recuerda. */
  playMusic(track: MusicTrack | null): void {
    try {
      const t = track !== null && (MUSIC_TRACKS as readonly string[]).includes(track) ? track : null;
      if (t !== this.wanted) {
        this.wanted = t;
        this.intensity = 0;
      }
      this.applyWanted();
    } catch {
      // ignorar
    }
  }

  /** Capas de energía del tema actual (0 normal, 1 más percusión, 2 tramo final). Barato si no cambia. */
  setMusicIntensity(level: MusicIntensity): void {
    const l: MusicIntensity = level >= 2 ? 2 : level >= 1 ? 1 : 0;
    if (l === this.intensity) return;
    this.intensity = l;
    const ctx = this.ctx;
    if (!ctx || !this.current) return;
    try {
      this.current.seq.setIntensity(l, ctx.currentTime);
    } catch {
      // ignorar
    }
  }

  /** Dispara un efecto. No-op si el audio no está activo; nunca lanza. */
  play(sfx: Sfx, opts?: SfxOptions): void {
    try {
      const ctx = this.ctx;
      const mixer = this.mixer;
      if (!ctx || !mixer || this.isMuted || this.hidden) return;
      const resuming = ctx.state === 'suspended' && nowMs() < this.graceUntil;
      if (!isRunning(ctx) && !resuming) return;
      if (!hasOwn(SFX_RECIPES, sfx)) return;
      const recipe = SFX_RECIPES[sfx];
      const volume = clamp(finiteOr(opts?.volume, 1), 0, 2);
      if (volume <= 0.001) return;
      const pitch = clamp(finiteOr(opts?.pitch, 1), 0.25, 4);
      const pan = clamp(finiteOr(opts?.pan, 0), -1, 1);
      const t = ctx.currentTime;
      const last = this.sfxLast.get(sfx);
      if (last !== undefined && t >= last && t - last < SFX_MIN_GAP) return;
      let ends = this.sfxEnds.get(sfx);
      if (!ends) {
        ends = [];
        this.sfxEnds.set(sfx, ends);
      }
      let w = 0;
      for (const e of ends) if (e > t) ends[w++] = e;
      ends.length = w;
      if (ends.length >= SFX_MAX_PER_ID || voiceStats.live >= SFX_MAX_VOICES) return;
      const v = new Voice();
      try {
        const out = v.add(ctx.createGain());
        out.gain.value = volume * SFX_GAIN[sfx];
        if (pan !== 0 && this.canPan) {
          const p = v.add(ctx.createStereoPanner());
          p.pan.value = pan;
          chain(out, p, mixer.sfx);
        } else {
          out.connect(mixer.sfx);
        }
        recipe(ctx, out, { t: t + 0.005, pitch, voice: v });
        v.seal();
      } catch {
        v.dispose();
        return;
      }
      ends.push(v.end);
      this.sfxLast.set(sfx, t);
    } catch {
      // nunca propagar
    }
  }

  /** Remate musical corto en el bus de música, atenuando el tema actual mientras suena. */
  jingle(kind: JingleKind): void {
    try {
      const ctx = this.ctx;
      const mixer = this.mixer;
      if (!ctx || !mixer || this.isMuted || this.hidden || !isRunning(ctx)) return;
      if (!hasOwn(JINGLES, kind)) return;
      const def = JINGLES[kind];
      const now = ctx.currentTime;
      if (this.jingleSeq) {
        this.retire(this.jingleSeq, now, 0.08);
        this.jingleSeq = null;
      }
      const compiled = this.compile(def);
      const start = now + 0.06;
      const seq = new Sequencer(ctx, mixer.music, compiled, start, 0);
      this.jingleSeq = seq;
      const end = start + compiled.loopSteps * compiled.stepDur;
      const g = mixer.duck.gain;
      rampParam(g, DUCK_LEVEL, now, 0.08);
      g.setValueAtTime(DUCK_LEVEL, end);
      g.linearRampToValueAtTime(1, end + 0.9);
      seq.tick(now);
      this.startTimer();
    } catch {
      // ignorar
    }
  }

  /** Página oculta: suspende el contexto. Visible: reanuda si está desbloqueado y sin silencio. */
  setBackground(hidden: boolean): void {
    this.hidden = Boolean(hidden);
    try {
      this.syncSuspension();
    } catch {
      // ignorar
    }
  }

  /** Diagnóstico (pruebas y panel de depuración). */
  getStats(): AudioStats {
    return {
      state: this.ctx ? String(this.ctx.state) : 'none',
      unlocked: this.isUnlocked,
      muted: this.isMuted,
      hidden: this.hidden,
      track: this.current?.id ?? null,
      wantedTrack: this.wanted,
      intensity: this.intensity,
      liveVoices: voiceStats.live,
      peakVoices: voiceStats.peak,
      createdVoices: voiceStats.created,
      sequencers: (this.current ? 1 : 0) + this.fading.length + (this.jingleSeq ? 1 : 0),
      schedulerRunning: this.timer !== null,
    };
  }

  // -------------------------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      ctx = new Ctor(); // webkitAudioContext no acepta opciones
    }
    this.ctx = ctx;
    this.canPan = typeof ctx.createStereoPanner === 'function';
    this.mixer = createMixer(
      ctx,
      musicBusGain(this.musicVol),
      sfxBusGain(this.sfxVol),
      this.isMuted ? 0 : MASTER_LEVEL,
    );
    ctx.onstatechange = () => this.onStateChange();
    return ctx;
  }

  private playSilence(ctx: AudioContext): void {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.onended = () => {
        try {
          src.disconnect();
        } catch {
          // ignorar
        }
      };
      src.start(0);
    } catch {
      // ignorar
    }
  }

  private markRunning(): void {
    const first = !this.isUnlocked;
    this.isUnlocked = true;
    if (first) this.applyWanted();
    this.syncSuspension();
    this.startTimer();
  }

  private onStateChange(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (isRunning(ctx)) {
      this.markRunning();
    } else {
      this.stopTimer();
      // p. ej. una suspensión que terminó después de volver a primer plano
      this.syncSuspension();
    }
  }

  /** Alinea el estado del contexto con lo deseado (desbloqueado, visible y sin silencio). */
  private syncSuspension(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    const state = String(ctx.state);
    if (state === 'closed') return;
    const shouldRun = this.isUnlocked && !this.hidden && !this.isMuted;
    if (shouldRun) {
      if (state !== 'running') void this.tryResume(ctx);
    } else if (state === 'running') {
      if (this.hidden) {
        void this.trySuspend(ctx);
      } else {
        // silenciado: dejar terminar el fundido antes de suspender
        this.suspendTimer = setTimeout(() => {
          this.suspendTimer = null;
          if (this.isMuted || this.hidden) void this.trySuspend(ctx);
        }, 160);
      }
    }
  }

  private async tryResume(ctx: AudioContext): Promise<void> {
    try {
      if (typeof ctx.resume === 'function') await settle(ctx.resume(), 1500);
    } catch {
      // en iOS puede requerir un gesto: installAudioLifecycle lo reintenta
    }
    // Safari antiguo puede no emitir "statechange": reconciliar a mano
    if (isRunning(ctx) && this.isUnlocked) this.startTimer();
  }

  private async trySuspend(ctx: AudioContext): Promise<void> {
    try {
      if (typeof ctx.suspend === 'function') await ctx.suspend();
    } catch {
      // ignorar
    }
    if (!isRunning(ctx)) this.stopTimer();
  }

  private compile(def: TrackDef): CompiledTrack {
    let c = this.compiled.get(def.id);
    if (!c) {
      c = compileTrack(def);
      this.compiled.set(def.id, c);
    }
    return c;
  }

  private applyWanted(): void {
    const ctx = this.ctx;
    const mixer = this.mixer;
    if (!ctx || !mixer || !this.isUnlocked) return;
    const want = this.wanted;
    if ((this.current?.id ?? null) === want) return;
    const now = ctx.currentTime;
    if (this.current) {
      this.retire(this.current.seq, now, CROSSFADE);
      this.current = null;
    }
    if (want) {
      const seq = new Sequencer(ctx, mixer.duck, this.compile(TRACKS[want]), now + 0.05, this.intensity);
      seq.fadeIn(now, CROSSFADE);
      this.current = { id: want, seq };
      if (isRunning(ctx)) seq.tick(now);
    }
    this.startTimer();
  }

  /** Funde y programa la liberación de un secuenciador (máximo 3 en salida). */
  private retire(seq: Sequencer, now: number, time: number): void {
    const end = seq.fadeOut(now, time);
    this.fading.push({ seq, disposeAt: end + 0.05 });
    while (this.fading.length > 3) this.fading.shift()?.seq.dispose();
  }

  private hasWork(): boolean {
    return this.current !== null || this.fading.length > 0 || this.jingleSeq !== null;
  }

  private startTimer(): void {
    const ctx = this.ctx;
    if (this.timer !== null || !ctx || !isRunning(ctx) || !this.hasWork()) return;
    this.timer = setInterval(() => this.pump(), SCHEDULER_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Paso del planificador: programa notas en la ventana anticipada y libera lo terminado. */
  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !isRunning(ctx)) {
      this.stopTimer();
      return;
    }
    const now = ctx.currentTime;
    try {
      this.current?.seq.tick(now);
      for (const f of this.fading) f.seq.tick(now);
      this.jingleSeq?.tick(now);
    } catch {
      // nunca propagar
    }
    if (this.fading.length > 0) {
      this.fading = this.fading.filter((f) => {
        if (now < f.disposeAt) return true;
        f.seq.dispose();
        return false;
      });
    }
    const j = this.jingleSeq;
    if (j) {
      const end = j.finishedAt;
      if (end !== null && now >= end) {
        j.dispose();
        this.jingleSeq = null;
      }
    }
    if (!this.hasWork()) this.stopTimer();
  }
}

/** Instancia única del motor. */
export const audio = new AudioEngine();

/**
 * Conecta el motor al ciclo de vida de la página: desbloquea con el primer gesto
 * (y reintenta en gestos siguientes si iOS dejó el contexto "interrupted"/"suspended"),
 * y suspende/reanuda con visibilitychange y pagehide/pageshow. Devuelve la función de limpieza.
 */
export function installAudioLifecycle(engine: AudioEngine = audio): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  const onGesture = (): void => {
    if (engine.needsGesture) void engine.unlock();
  };
  const onVisibility = (): void => engine.setBackground(document.visibilityState === 'hidden');
  const onPageHide = (): void => engine.setBackground(true);
  const onPageShow = (): void => engine.setBackground(document.visibilityState === 'hidden');
  const gestureOpts: AddEventListenerOptions = { capture: true, passive: true };
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click'] as const;
  for (const type of gestures) window.addEventListener(type, onGesture, gestureOpts);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  if (document.visibilityState === 'hidden') engine.setBackground(true);
  return () => {
    for (const type of gestures) window.removeEventListener(type, onGesture, gestureOpts);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
}
