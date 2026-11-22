import {
  QUIZ,
  optionCount,
  personalizeQuestion,
  planQuizRound,
  replacementQuestion,
  revealLine,
  scoreQuestion,
  syncTitle,
  type AnswerPayload,
  type CharacterId,
  type GameStartPayload,
  type InputPayload,
  type MatchResult,
  type Pair,
  type PlannedQuestion,
  type QuizDeck,
  type QuizOutcome,
  type QuizQuestionView,
  type QuizReveal,
  type Slot,
} from '@duo/shared';
import type { GameInstance, GameOutput } from './types.js';

type Phase = 'intro' | 'answering' | 'locked' | 'reveal' | 'done';

export interface QuizGameOptions {
  matchId: number;
  seed: number;
  startTime: number;
  characters: Pair<CharacterId>;
  names: Pair<string>;
  deck: QuizDeck;
  tour: { step: number; total: number } | null;
  out: GameOutput;
  /** Preguntas ya usadas en esta sala (se actualiza). */
  used: Set<string>;
}

interface Record_ {
  outcome: QuizOutcome;
  guessedRight: Pair<boolean>;
}

export class QuizGame implements GameInstance {
  readonly mode = 'quiz' as const;
  readonly matchId: number;
  private readonly plan: PlannedQuestion[];
  private index = 0;
  private phase: Phase = 'intro';
  /** Momento en que vence la fase actual (hora del servidor). */
  private phaseEnd: number;
  private answers: Pair<number | null> = [null, null];
  private totals: Pair<number> = [0, 0];
  private replacementsLeft: number = QUIZ.MAX_REPLACEMENTS;
  private replaced = false;
  private readonly records: Record_[] = [];
  private lastReveal: QuizReveal | null = null;
  private pausedAt: number | null = null;
  private forfeitSlot: Slot | null = null;
  private _result: MatchResult | null = null;

  constructor(private readonly opts: QuizGameOptions) {
    this.matchId = opts.matchId;
    this.plan = planQuizRound(opts.seed, opts.deck, opts.used);
    for (const p of this.plan) opts.used.add(p.question.id);
    this.phaseEnd = opts.startTime + QUIZ.INTRO_MS;
  }

  get result(): MatchResult | null {
    return this._result;
  }

  startPayload(): GameStartPayload {
    return {
      matchId: this.matchId,
      mode: 'quiz',
      seed: this.opts.seed,
      clock: { baseTick: 0, baseTime: this.opts.startTime, running: this.pausedAt === null },
      characters: this.opts.characters,
      names: this.opts.names,
      deck: this.opts.deck,
      tour: this.opts.tour,
    };
  }

  private current(): PlannedQuestion {
    return this.plan[this.index] as PlannedQuestion;
  }

  private viewFor(slot: Slot): QuizQuestionView {
    const { question, about } = this.current();
    const pers = personalizeQuestion(question, about, slot, this.opts.names);
    return {
      index: this.index,
      total: this.plan.length,
      kind: question.kind,
      about,
      role: pers.role,
      prompt: pers.prompt,
      options: pers.options,
      romance: question.deck === 'romance',
      deadline: this.phaseEnd,
      answered: [this.answers[0] !== null, this.answers[1] !== null],
      mine: this.answers[slot],
      totals: this.totals,
      replacementsLeft: this.replacementsLeft,
      replaced: this.replaced,
    };
  }

  private sendQuestion(): void {
    for (const slot of [0, 1] as const) this.opts.out.sendTo(slot, 'quiz:question', this.viewFor(slot));
  }

  private startQuestion(now: number): void {
    this.phase = 'answering';
    this.answers = [null, null];
    this.phaseEnd = now + QUIZ.ANSWER_MS;
    this.sendQuestion();
  }

  onInput(_slot: Slot, _p: InputPayload, _now: number): void {}
  onCount(_slot: Slot, _now: number): void {}

  onAnswer(slot: Slot, p: AnswerPayload, now: number): void {
    if (this._result || this.pausedAt !== null) return;
    if (this.phase !== 'answering' || p.q !== this.index) return;
    if (this.answers[slot] !== null) return; // la primera respuesta es la que vale
    if (p.choice < 0 || p.choice >= optionCount(this.current().question)) return;
    this.answers[slot] = p.choice;
    this.opts.out.broadcast('quiz:progress', {
      q: this.index,
      answered: [this.answers[0] !== null, this.answers[1] !== null],
    });
    if (this.answers[0] !== null && this.answers[1] !== null) {
      this.phase = 'locked';
      this.phaseEnd = now + QUIZ.REVEAL_DELAY_MS;
    }
  }

  onSkip(_slot: Slot, q: number, now: number): void {
    if (this._result || this.pausedAt !== null) return;
    if (this.phase !== 'answering' || q !== this.index) return;
    if (this.replacementsLeft > 0) {
      const cur = this.current();
      const used = this.opts.used;
      const next = replacementQuestion(this.opts.seed + this.index * 31, cur.question.kind, used);
      used.add(next.id);
      this.plan[this.index] = { question: next, about: cur.about };
      this.replacementsLeft--;
      this.replaced = true;
      this.startQuestion(now);
      return;
    }
    this.reveal(now, true);
  }

  private reveal(now: number, skipped: boolean): void {
    const { question, about } = this.current();
    const score = scoreQuestion(question, about, this.answers, skipped);
    this.totals = [this.totals[0] + score.points[0], this.totals[1] + score.points[1]];
    this.records.push({ outcome: score.outcome, guessedRight: score.guessedRight });
    this.phase = 'reveal';
    this.phaseEnd = now + QUIZ.REVEAL_MS;
    this.replaced = false;
    this.lastReveal = {
      q: this.index,
      kind: question.kind,
      about,
      answers: skipped ? [null, null] : this.answers,
      outcome: score.outcome,
      points: score.points,
      totals: this.totals,
      line: revealLine(score.outcome, this.index, this.opts.seed),
      nextAt: this.phaseEnd,
    };
    this.opts.out.broadcast('quiz:reveal', this.lastReveal);
  }

  update(now: number): void {
    if (this._result || this.pausedAt !== null) return;
    if (now < this.phaseEnd) return;
    switch (this.phase) {
      case 'intro':
        this.startQuestion(now);
        break;
      case 'answering':
      case 'locked':
        this.reveal(now, false);
        break;
      case 'reveal':
        if (this.index + 1 < this.plan.length) {
          this.index++;
          this.startQuestion(now);
        } else {
          this.finish();
        }
        break;
      default:
        break;
    }
  }

  private finish(): void {
    this.phase = 'done';
    const correct: Pair<number> = [0, 0];
    let matches = 0;
    let scored = 0;
    let skipped = 0;
    for (const r of this.records) {
      if (r.guessedRight[0]) correct[0]++;
      if (r.guessedRight[1]) correct[1]++;
      if (r.outcome === 'skipped') skipped++;
      if (r.outcome === 'match' || r.outcome === 'miss') scored++;
      if (r.outcome === 'match' && !r.guessedRight[0] && !r.guessedRight[1]) matches++;
    }
    const hits = correct[0] + correct[1] + matches;
    const syncPercent = scored > 0 ? Math.round((100 * hits) / scored) : 0;
    const [t0, t1] = this.totals;
    const names = this.opts.names;
    let winner: Slot | null = t0 === t1 ? null : t0 > t1 ? 0 : 1;
    let points: Pair<number> = [t0, t1];
    let headline: string;
    if (this.forfeitSlot !== null) {
      winner = this.forfeitSlot === 0 ? 1 : 0;
      points = this.forfeitSlot === 0 ? [0, t1] : [t0, 0];
      headline = `${names[winner]} gana por abandono`;
    } else if (winner === null) {
      headline = '¡Empate! Se conocen igual de bien.';
    } else {
      const other: Slot = winner === 0 ? 1 : 0;
      headline = `¡${names[winner]} conoce mejor a ${names[other]}!`;
    }
    this._result = {
      id: this.matchId,
      mode: 'quiz',
      winner,
      cooperative: false,
      points,
      headline,
      forfeit: this.forfeitSlot,
      details: {
        kind: 'quiz',
        correct,
        matches,
        scored,
        syncPercent,
        skipped,
        syncTitle: syncTitle(syncPercent),
      },
    };
  }

  pause(now: number): void {
    if (this.pausedAt === null) this.pausedAt = now;
  }

  resume(at: number): void {
    if (this.pausedAt === null) return;
    const shift = Math.max(0, at - this.pausedAt);
    this.pausedAt = null;
    this.phaseEnd += shift;
    if (this.phase === 'answering' || this.phase === 'locked') this.sendQuestion();
    else if (this.phase === 'reveal' && this.lastReveal) {
      this.lastReveal = { ...this.lastReveal, nextAt: this.phaseEnd };
      this.opts.out.broadcast('quiz:reveal', this.lastReveal);
    }
  }

  syncPlayer(slot: Slot, _now: number): void {
    this.opts.out.sendTo(slot, 'game:start', this.startPayload());
    if (this.phase === 'answering' || this.phase === 'locked') {
      this.opts.out.sendTo(slot, 'quiz:question', this.viewFor(slot));
    } else if (this.phase === 'reveal' && this.lastReveal) {
      this.opts.out.sendTo(slot, 'quiz:question', this.viewFor(slot));
      this.opts.out.sendTo(slot, 'quiz:reveal', this.lastReveal);
    }
  }

  forfeit(slot: Slot): void {
    if (this._result) return;
    this.forfeitSlot = slot;
    this.finish();
  }

  /** Solo pruebas: índice actual y fase. */
  debugState(): { index: number; phase: Phase; total: number } {
    return { index: this.index, phase: this.phase, total: this.plan.length };
  }
}
