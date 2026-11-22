import { describe, expect, it } from 'vitest';
import {
  GameClock,
  QUIZ,
  QUIZ_BANK,
  ROOM_CODE_ALPHABET,
  TICK_MS,
  clockTick,
  formatRoomCode,
  normalizeRoomCode,
  personalizeQuestion,
  planQuizRound,
  replacementQuestion,
  sanitizeName,
  scoreQuestion,
  syncTitle,
} from '../src/index';

describe('códigos y nombres', () => {
  it('normaliza códigos escritos por personas', () => {
    expect(normalizeRoomCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeRoomCode(' ab cd ef gh ')).toBe('ABCDEFGH');
    expect(normalizeRoomCode('ABCD-EFG')).toBeNull();
    expect(normalizeRoomCode('ABCD-EFG0')).toBeNull(); // 0 no está en el alfabeto
    expect(normalizeRoomCode('A'.repeat(40))).toBeNull();
    expect(formatRoomCode('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('sanea nombres visibles', () => {
    expect(sanitizeName('  Ana   María  ', 'x')).toBe('Ana María');
    expect(sanitizeName('\u0000​Lu‮', 'x')).toBe('Lu');
    expect(sanitizeName('', 'Jugador')).toBe('Jugador');
    expect(sanitizeName(42, 'Jugador')).toBe('Jugador');
    expect(Array.from(sanitizeName('😀'.repeat(30), 'x'))).toHaveLength(14);
  });
});

describe('reloj de partida', () => {
  it('pausa y reanuda sin perder ticks', () => {
    const c = new GameClock(10_000);
    expect(c.tick(9_000)).toBeLessThan(0);
    expect(c.tick(10_000)).toBe(0);
    const t1 = c.tick(10_000 + TICK_MS * 120);
    expect(t1).toBe(120);
    c.pause(10_000 + TICK_MS * 120);
    expect(c.tick(99_999)).toBe(120);
    c.resume(50_000);
    expect(c.tick(50_000)).toBe(120);
    expect(c.tick(50_000 + TICK_MS * 60)).toBe(180);
    expect(clockTick(c.payload, 50_000 + TICK_MS * 60)).toBe(180);
  });
});

describe('¿Cuánto me conocés?', () => {
  it('arma rondas de 8 preguntas sin repetir', () => {
    for (const deck of ['light', 'romance'] as const) {
      const plan = planQuizRound(99, deck, new Set());
      expect(plan).toHaveLength(QUIZ.QUESTIONS_PER_ROUND);
      expect(new Set(plan.map((p) => p.question.id)).size).toBe(plan.length);
      if (deck === 'light') expect(plan.every((p) => p.question.deck === 'light')).toBe(true);
      else expect(plan.some((p) => p.question.deck === 'romance')).toBe(true);
    }
  });

  it('evita preguntas ya usadas en la sala', () => {
    const first = planQuizRound(1, 'light', new Set());
    const used = new Set(first.map((p) => p.question.id));
    const second = planQuizRound(2, 'light', used);
    expect(second.some((p) => used.has(p.question.id))).toBe(false);
  });

  it('personaliza según quién mira', () => {
    const q = QUIZ_BANK.find((x) => x.kind === 'predict')!;
    const names: [string, string] = ['Ana', 'Leo'];
    const subj = personalizeQuestion(q, 0, 0, names);
    const guess = personalizeQuestion(q, 0, 1, names);
    expect(subj.role).toBe('subject');
    expect(guess.role).toBe('guesser');
    expect(guess.prompt).toContain('Ana');
    expect(guess.prompt).not.toContain('{name}');
    const w = QUIZ_BANK.find((x) => x.kind === 'whoMore')!;
    expect(personalizeQuestion(w, null, 1, names).options).toEqual(['Ana', 'Leo']);
  });

  it('puntúa: acierto de predicción, coincidencia, omisión y sin respuesta', () => {
    const p = QUIZ_BANK.find((x) => x.kind === 'predict')!;
    expect(scoreQuestion(p, 0, [2, 2], false)).toEqual({
      outcome: 'match',
      points: [QUIZ.POINTS_KNOWN, QUIZ.POINTS_GUESS],
      guessedRight: [false, true],
    });
    expect(scoreQuestion(p, 1, [0, 1], false).outcome).toBe('miss');
    expect(scoreQuestion(p, 1, [0, null], false).outcome).toBe('noanswer');
    const skipped = scoreQuestion(p, 1, [0, 0], true);
    expect(skipped.outcome).toBe('skipped');
    expect(skipped.points).toEqual([0, 0]);
    const t = QUIZ_BANK.find((x) => x.kind === 'telepathy')!;
    expect(scoreQuestion(t, null, [1, 1], false).points).toEqual([QUIZ.POINTS_MATCH, QUIZ.POINTS_MATCH]);
  });

  it('el reemplazo es del mazo liviano y del mismo tipo', () => {
    const r = replacementQuestion(5, 'telepathy', new Set());
    expect(r.kind).toBe('telepathy');
    expect(r.deck).toBe('light');
  });

  it('títulos de sintonía', () => {
    expect(syncTitle(95)).toBe('Almas gemelas');
    expect(syncTitle(10)).toMatch(/descubrir/);
  });
});
