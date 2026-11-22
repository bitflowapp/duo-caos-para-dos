import { describe, expect, it } from 'vitest';
import { QUIZ_BANK, type QuizDeckId, type QuizKind, type QuizQuestion } from '../src/quiz/bank';
import { QUIZ_DECKS } from '../src/types';

const MAX_PROMPT_CHARS = 90;
const MAX_OPTION_CHARS = 26;
/** Nombre de 10 caracteres para medir `guess` en un caso largo. */
const TEN_CHAR_NAME = 'X'.repeat(10);

const PREFIX: Record<QuizKind, string> = { predict: 'p-', whoMore: 'w-', telepathy: 't-' };

const FIELD_NAMES = ['self', 'guess', 'text', 'options'] as const;
type FieldName = (typeof FIELD_NAMES)[number];

/** Qué campos debe traer (true) o no traer (false) cada tipo de pregunta. */
const FIELDS: Record<QuizKind, Record<FieldName, boolean>> = {
  predict: { self: true, guess: true, text: false, options: true },
  whoMore: { self: false, guess: false, text: true, options: false },
  telepathy: { self: false, guess: false, text: true, options: true },
};

const MINIMUMS: Record<QuizKind, Record<QuizDeckId, number>> = {
  predict: { light: 34, romance: 16 },
  whoMore: { light: 20, romance: 8 },
  telepathy: { light: 16, romance: 8 },
};

/**
 * Palabras que delatan suposiciones de género, tuteo o temas que el banco evita a
 * propósito. Es una red de seguridad, no un filtro exhaustivo: la revisión humana manda.
 */
const BANNED_WORDS = new Set([
  // Género o estado civil (usar {name}, «tu pareja» o «de a dos»).
  'él', 'ella', 'ellos', 'ellas', 'novio', 'novia', 'novios', 'novias', 'esposo', 'esposa',
  'marido', 'mujer', 'hombre', 'juntos', 'juntas', 'nosotros', 'nosotras', 'amigo', 'amiga',
  // Temas sensibles.
  'ex', 'celos', 'celoso', 'celosa', 'infiel', 'gordo', 'gorda', 'gordi', 'flaco', 'flaca',
  'dieta', 'dinero', 'plata', 'sueldo', 'deuda', 'religión', 'dios', 'iglesia', 'política',
  'sexo', 'sexy',
  // Tuteo (el banco usa voseo).
  'tú', 'ti', 'eres', 'tienes', 'quieres', 'prefieres', 'puedes', 'sabes', 'haces', 'piensas',
]);

const chars = (s: string): number => Array.from(s).length;

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 0);

/** Enunciados de una pregunta (sin opciones). */
function prompts(q: QuizQuestion): string[] {
  return [q.self, q.guess, q.text].filter((s): s is string => s !== undefined);
}

function allStrings(q: QuizQuestion): string[] {
  return [...prompts(q), ...(q.options ?? [])];
}

describe('QUIZ_BANK', () => {
  it('tiene ids únicos, en kebab-case y con el prefijo de su tipo', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const q of QUIZ_BANK) {
      if (!/^[ptw]-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(q.id)) problems.push(`${q.id}: formato de id`);
      if (!q.id.startsWith(PREFIX[q.kind])) problems.push(`${q.id}: prefijo distinto de ${q.kind}`);
      if (seen.has(q.id)) problems.push(`${q.id}: id repetido`);
      seen.add(q.id);
    }
    expect(problems).toEqual([]);
  });

  it('cada tipo trae exactamente los campos que necesita', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      const expected = FIELDS[q.kind];
      if (expected === undefined) {
        problems.push(`${q.id}: tipo desconocido ${String(q.kind)}`);
        continue;
      }
      if (!(QUIZ_DECKS as readonly string[]).includes(q.deck)) {
        problems.push(`${q.id}: mazo desconocido ${String(q.deck)}`);
      }
      for (const field of FIELD_NAMES) {
        const present = q[field] !== undefined;
        if (present !== expected[field]) {
          problems.push(`${q.id}: ${expected[field] ? 'falta' : 'sobra'} ${field}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('las opciones son 3 o 4, de hasta 26 caracteres y sin repetir', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      if (q.options === undefined) continue;
      if (q.options.length < 3 || q.options.length > 4) {
        problems.push(`${q.id}: tiene ${q.options.length} opciones`);
      }
      const distinct = new Set(q.options.map((o) => o.trim().toLocaleLowerCase('es')));
      if (distinct.size !== q.options.length) problems.push(`${q.id}: opciones repetidas`);
      for (const option of q.options) {
        const n = chars(option);
        if (n === 0 || n > MAX_OPTION_CHARS) problems.push(`${q.id}: «${option}» mide ${n}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('los enunciados miden hasta 90 caracteres (guess con un nombre de 10)', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      const measured = [q.self, q.text, q.guess?.replaceAll('{name}', TEN_CHAR_NAME)];
      for (const s of measured) {
        if (s === undefined) continue;
        const n = chars(s);
        if (n === 0 || n > MAX_PROMPT_CHARS) problems.push(`${q.id}: «${s}» mide ${n}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('{name} aparece en cada guess y en ningún otro texto', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      if (q.guess !== undefined) {
        if (!q.guess.includes('{name}')) problems.push(`${q.id}: guess sin {name}`);
        if (/[{}]/.test(q.guess.replaceAll('{name}', ''))) {
          problems.push(`${q.id}: guess con otro marcador`);
        }
      }
      const others = [q.self, q.text, ...(q.options ?? [])];
      for (const s of others) {
        if (s !== undefined && /[{}]/.test(s)) problems.push(`${q.id}: marcador en «${s}»`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('tiene formato prolijo: preguntas con ¿…?, sin espacios de más y en NFC', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      for (const s of prompts(q)) {
        if (!s.includes('¿') || !s.endsWith('?')) problems.push(`${q.id}: «${s}» no es pregunta`);
      }
      if (q.kind === 'whoMore' && !q.text?.startsWith('¿Quién ')) {
        problems.push(`${q.id}: whoMore debe empezar con «¿Quién»`);
      }
      for (const s of allStrings(q)) {
        if (s !== s.trim() || /\s{2,}/.test(s)) problems.push(`${q.id}: espacios en «${s}»`);
        if (s !== s.normalize('NFC')) problems.push(`${q.id}: «${s}» no está en NFC`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('no repite enunciados', () => {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    for (const q of QUIZ_BANK) {
      for (const s of prompts(q)) {
        const key = s.toLocaleLowerCase('es');
        const owner = seen.get(key);
        if (owner !== undefined) problems.push(`${q.id}: repite un enunciado de ${owner}`);
        else seen.set(key, q.id);
      }
    }
    expect(problems).toEqual([]);
  });

  it('alcanza las cantidades mínimas por tipo y mazo', () => {
    const problems: string[] = [];
    for (const kind of Object.keys(MINIMUMS) as QuizKind[]) {
      for (const deck of QUIZ_DECKS) {
        const count = QUIZ_BANK.filter((q) => q.kind === kind && q.deck === deck).length;
        const min = MINIMUMS[kind][deck];
        if (count < min) problems.push(`${kind}/${deck}: ${count} < ${min}`);
      }
    }
    expect(problems).toEqual([]);
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(102);
  });

  it('usa lenguaje inclusivo, voseo y evita temas sensibles', () => {
    const problems: string[] = [];
    for (const q of QUIZ_BANK) {
      for (const s of allStrings(q)) {
        for (const w of words(s.replaceAll('{name}', ''))) {
          if (BANNED_WORDS.has(w)) problems.push(`${q.id}: «${w}» en «${s}»`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
