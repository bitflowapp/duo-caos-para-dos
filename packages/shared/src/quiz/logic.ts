import { Rng, hash32 } from '../rng';
import type { Pair, QuizDeck, Slot } from '../types';
import { QUIZ_BANK, type QuizKind, type QuizQuestion } from './bank';

/** Reglas de "¿Cuánto me conocés?". */
export const QUIZ = {
  QUESTIONS_PER_ROUND: 8,
  INTRO_MS: 3_200,
  ANSWER_MS: 20_000,
  /** Pausa dramática tras la segunda respuesta antes de revelar. */
  REVEAL_DELAY_MS: 900,
  REVEAL_MS: 5_200,
  /** Cuántas veces por ronda "Pasar" reemplaza la pregunta por otra. */
  MAX_REPLACEMENTS: 3,
  POINTS_GUESS: 100,
  POINTS_KNOWN: 50,
  POINTS_MATCH: 75,
} as const;

export interface PlanSlot {
  kind: QuizKind;
  about: Slot | null;
}

/** Estructura de una ronda: alterna sobre quién se pregunta y mezcla tipos. */
export const ROUND_PLAN: readonly PlanSlot[] = [
  { kind: 'predict', about: 0 },
  { kind: 'whoMore', about: null },
  { kind: 'predict', about: 1 },
  { kind: 'telepathy', about: null },
  { kind: 'predict', about: 0 },
  { kind: 'whoMore', about: null },
  { kind: 'predict', about: 1 },
  { kind: 'telepathy', about: null },
];

export interface PlannedQuestion {
  question: QuizQuestion;
  about: Slot | null;
}

function poolFor(kind: QuizKind, deck: QuizDeck, used: ReadonlySet<string>, wantRomance: boolean): QuizQuestion[] {
  const all = QUIZ_BANK.filter((q) => q.kind === kind && (deck === 'romance' || q.deck === 'light'));
  const preferred = all.filter((q) => (wantRomance ? q.deck === 'romance' : q.deck === 'light') && !used.has(q.id));
  if (preferred.length > 0) return preferred;
  const unused = all.filter((q) => !used.has(q.id));
  return unused.length > 0 ? unused : all;
}

/**
 * Elige las preguntas de una ronda. Con el mazo romántico, aproximadamente la
 * mitad de las preguntas son románticas (siempre se pueden pasar sin castigo).
 * `used` evita repetir preguntas dentro de la misma sala.
 */
export function planQuizRound(seed: number, deck: QuizDeck, used: ReadonlySet<string>): PlannedQuestion[] {
  const rng = new Rng(hash32(seed, 0x0b1e));
  const taken = new Set(used);
  const out: PlannedQuestion[] = [];
  ROUND_PLAN.forEach((slot, i) => {
    const wantRomance = deck === 'romance' && (i % 2 === 1 || rng.next() < 0.3);
    const pool = poolFor(slot.kind, deck, taken, wantRomance);
    const q = rng.pick(pool);
    taken.add(q.id);
    out.push({ question: q, about: slot.about });
  });
  return out;
}

/** Pregunta de reemplazo (siempre del mazo liviano) cuando alguien elige "Pasar". */
export function replacementQuestion(seed: number, kind: QuizKind, used: ReadonlySet<string>): QuizQuestion {
  const rng = new Rng(hash32(seed, used.size, 0x5e1f));
  return rng.pick(poolFor(kind, 'light', used, false));
}

export type QuizRole = 'subject' | 'guesser' | 'both';

export interface QuizQuestionView {
  index: number;
  total: number;
  kind: QuizKind;
  about: Slot | null;
  role: QuizRole;
  prompt: string;
  options: string[];
  romance: boolean;
  deadline: number;
  answered: Pair<boolean>;
  mine: number | null;
  totals: Pair<number>;
  replacementsLeft: number;
  /** Si esta pregunta reemplazó a otra que alguien pasó. */
  replaced: boolean;
}

/** Texto y opciones personalizadas para quien mira. */
export function personalizeQuestion(
  q: QuizQuestion,
  about: Slot | null,
  viewer: Slot,
  names: Pair<string>,
): { role: QuizRole; prompt: string; options: string[] } {
  if (q.kind === 'predict') {
    const subject = about ?? 0;
    if (viewer === subject) {
      return { role: 'subject', prompt: q.self ?? '', options: [...(q.options ?? [])] };
    }
    return {
      role: 'guesser',
      prompt: (q.guess ?? '').split('{name}').join(names[subject]),
      options: [...(q.options ?? [])],
    };
  }
  if (q.kind === 'whoMore') {
    return { role: 'both', prompt: q.text ?? '', options: [names[0], names[1]] };
  }
  return { role: 'both', prompt: q.text ?? '', options: [...(q.options ?? [])] };
}

export function optionCount(q: QuizQuestion): number {
  return q.kind === 'whoMore' ? 2 : (q.options?.length ?? 0);
}

export type QuizOutcome = 'match' | 'miss' | 'noanswer' | 'skipped';

export interface QuestionScore {
  outcome: QuizOutcome;
  points: Pair<number>;
  /** Para predict: si quien adivinaba acertó. */
  guessedRight: Pair<boolean>;
}

export function scoreQuestion(q: QuizQuestion, about: Slot | null, answers: Pair<number | null>, skipped: boolean): QuestionScore {
  const zero: QuestionScore = { outcome: 'noanswer', points: [0, 0], guessedRight: [false, false] };
  if (skipped) return { ...zero, outcome: 'skipped' };
  const [a, b] = answers;
  if (a === null || b === null) return zero;
  const match = a === b;
  if (q.kind === 'predict') {
    const subject = about ?? 0;
    const guesser: Slot = subject === 0 ? 1 : 0;
    if (!match) return { outcome: 'miss', points: [0, 0], guessedRight: [false, false] };
    const points: Pair<number> = [0, 0];
    points[guesser] = QUIZ.POINTS_GUESS;
    points[subject] = QUIZ.POINTS_KNOWN;
    const guessedRight: Pair<boolean> = [false, false];
    guessedRight[guesser] = true;
    return { outcome: 'match', points, guessedRight };
  }
  if (!match) return { outcome: 'miss', points: [0, 0], guessedRight: [false, false] };
  return { outcome: 'match', points: [QUIZ.POINTS_MATCH, QUIZ.POINTS_MATCH], guessedRight: [false, false] };
}

const LINES: Record<QuizOutcome, readonly string[]> = {
  match: [
    '¡Telepatía total!',
    '¡Se conocen de memoria!',
    '¡Bingo! Conexión confirmada.',
    '¡Eso es leer la mente!',
    '¡Sincronía de película!',
    '¡Ni ensayado sale tan bien!',
  ],
  miss: [
    'Casi… ¡pero no!',
    '¡Plot twist!',
    'Dato nuevo desbloqueado.',
    'Mmm… esto se charla en la cena.',
    '¡Sorpresa! Siempre hay algo por descubrir.',
    'Interferencia en la telepatía…',
  ],
  noanswer: ['¡Se les fue el tiempo!', 'El reloj ganó esta vez.', 'Silencio misterioso…'],
  skipped: ['Pregunta pasada, sin drama.', 'Seguimos con otra.', 'Pasamos de largo, ¡todo bien!'],
};

export function revealLine(outcome: QuizOutcome, index: number, seed: number): string {
  const list = LINES[outcome];
  return list[hash32(seed, index) % list.length] ?? '';
}

export function syncTitle(percent: number): string {
  if (percent >= 90) return 'Almas gemelas';
  if (percent >= 75) return 'Telepatía nivel experto';
  if (percent >= 55) return 'Muy en sintonía';
  if (percent >= 35) return 'Conociéndose de a poco';
  return 'Mucho por descubrir (¡qué lindo!)';
}
