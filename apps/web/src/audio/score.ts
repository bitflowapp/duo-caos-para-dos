// Partituras: tipos y notación compacta para escribir la música nota por nota.
// Módulo puro (sin Web Audio ni DOM) para poder validarlo en tests de Node.
// Unidad de tiempo: "paso" = semicorchea; 16 pasos por compás de 4/4.

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

/** Un evento de nota. En percusión `n` es el número General MIDI del golpe. */
export interface NoteEvent {
  /** paso de inicio (entero) relativo al comienzo de la sección */
  s: number;
  /** nota MIDI (C4 = 60) */
  n: number;
  /** duración en pasos (> 0) */
  d: number;
  /** velocidad 0..1 */
  v: number;
}

export type InstrumentId =
  | 'marimba'
  | 'pluck'
  | 'pizz'
  | 'bass'
  | 'pad'
  | 'lead'
  | 'flute'
  | 'brass'
  | 'ep'
  | 'bell'
  | 'drums';

export const INSTRUMENT_IDS: readonly InstrumentId[] = [
  'marimba',
  'pluck',
  'pizz',
  'bass',
  'pad',
  'lead',
  'flute',
  'brass',
  'ep',
  'bell',
  'drums',
];

/** Parámetros opcionales de timbre por voz. */
export interface InstrumentOptions {
  /** forma de onda principal (bajo, lead, pad) */
  wave?: OscillatorType;
  /** frecuencia de corte del filtro propio de la nota (Hz) */
  cutoff?: number;
  /** multiplicador del decaimiento (plucks, marimba, campanas) */
  decay?: number;
  /** profundidad de vibrato en cents (lead/flute) */
  vibrato?: number;
}

export interface VoiceDef {
  /** nombre de la voz (clave en `parts`) */
  name: string;
  inst: InstrumentId;
  /** ganancia base del canal */
  gain: number;
  /** paneo estéreo -1..1 */
  pan?: number;
  /** intensidad mínima para sonar (capas de intensidad) */
  layer?: 0 | 1 | 2;
  /** multiplicador de ganancia por nivel de intensidad */
  boost?: readonly [number, number, number];
  /** filtro paso bajo fijo del canal (Hz) */
  lowpass?: number;
  /** envío al eco del tema (0..1) */
  echo?: number;
  /** fracción de la duración escrita que se sostiene (staccato < 1) */
  gate?: number;
  opts?: InstrumentOptions;
}

export interface SectionDef {
  name: string;
  bars: number;
  parts: Partial<Record<string, NoteEvent[]>>;
}

export interface TrackDef {
  id: string;
  title: string;
  bpm: number;
  /** descripción de tonalidad / modo (documentación) */
  key: string;
  /** swing: retraso en fracción de paso de las corcheas (8) o semicorcheas (16) a contratiempo */
  swing?: { amount: number; unit: 8 | 16 };
  voices: VoiceDef[];
  sections: SectionDef[];
  /** orden de reproducción (índices de `sections`) */
  order: number[];
  loop: boolean;
  /** eco sincronizado al tempo: retardo en pasos, realimentación y mezcla */
  echo?: { steps: number; feedback: number; wet: number };
}

/** Errores de notación detectados al cargar los módulos de partituras (los tests exigen que esté vacío). */
export const notationErrors: string[] = [];

const PITCH_CLASS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4", "Bb3"... a número MIDI (C4 = 60). NaN si el nombre es inválido. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) return Number.NaN;
  const base = PITCH_CLASS[m[1] ?? ''];
  if (base === undefined) return Number.NaN;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/** Frecuencia en Hz de una nota MIDI. */
export function midiToFreq(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/**
 * Melodía/acordes. Tokens separados por espacios:
 *   `C5:2`  nota de 2 pasos · `C4+E4+G4:8` acorde · `r:4` silencio
 *   sin `:n` repite la última duración · sufijo `!` acento, `?` suave
 *   `|` barra de compás (se verifica que caiga al inicio de un compás)
 */
export function mel(src: string, label = 'mel'): NoteEvent[] {
  const out: NoteEvent[] = [];
  let pos = 0;
  let dur = 2;
  for (const raw of src.trim().split(/\s+/)) {
    if (raw === '') continue;
    if (raw === '|') {
      if (pos % STEPS_PER_BAR !== 0) notationErrors.push(`${label}: barra desalineada en el paso ${pos}`);
      continue;
    }
    let tok = raw;
    let vel = 0.8;
    if (tok.endsWith('!')) {
      vel = 1;
      tok = tok.slice(0, -1);
    } else if (tok.endsWith('?')) {
      vel = 0.55;
      tok = tok.slice(0, -1);
    }
    const [head = '', durStr] = tok.split(':');
    if (durStr !== undefined) {
      const d = Number(durStr);
      if (!(d > 0) || !Number.isFinite(d)) {
        notationErrors.push(`${label}: duración inválida "${raw}"`);
        continue;
      }
      dur = d;
    }
    if (head !== 'r') {
      for (const name of head.split('+')) {
        const n = noteToMidi(name);
        if (!Number.isFinite(n)) notationErrors.push(`${label}: nota inválida "${name}" en "${raw}"`);
        else if (!Number.isInteger(pos)) notationErrors.push(`${label}: nota fuera de la grilla en el paso ${pos}`);
        else out.push({ s: pos, n, d: dur, v: vel });
      }
    }
    pos += dur;
  }
  return out;
}

/** Mapa de caracteres de percusión → General MIDI. Mayúscula = acento. */
export const DRUM_CHARS: Readonly<Record<string, number>> = {
  k: 36, // bombo
  r: 37, // aro (side stick)
  s: 38, // caja
  c: 39, // palmas
  h: 42, // hi-hat cerrado
  o: 46, // hi-hat abierto
  x: 49, // platillo
  y: 51, // ride
  b: 56, // cencerro
  g: 60, // bongó agudo
  n: 61, // bongó grave
  q: 62, // conga apagada
  u: 63, // conga abierta
  d: 64, // conga grave
  m: 70, // maracas / shaker
  l: 75, // claves
  w: 76, // bloque de madera agudo
  v: 77, // bloque de madera grave
};

/** Patrón de percusión: un carácter por semicorchea; `.` silencio; espacios ignorados; `|` barra. */
export function drum(src: string, label = 'drum'): NoteEvent[] {
  const out: NoteEvent[] = [];
  let pos = 0;
  for (const ch of src) {
    if (ch === ' ' || ch === '\n' || ch === '\t') continue;
    if (ch === '|') {
      if (pos % STEPS_PER_BAR !== 0) notationErrors.push(`${label}: barra desalineada en el paso ${pos}`);
      continue;
    }
    if (ch !== '.' && ch !== '-') {
      const lower = ch.toLowerCase();
      const n = DRUM_CHARS[lower];
      if (n === undefined) notationErrors.push(`${label}: golpe desconocido "${ch}"`);
      else out.push({ s: pos, n, d: 1, v: ch === lower ? 0.7 : 1 });
    }
    pos++;
  }
  return out;
}

/** Repite un fragmento de notación `times` veces. */
export function rep(src: string, times: number): string {
  return Array.from({ length: times }, () => src).join(' ');
}
