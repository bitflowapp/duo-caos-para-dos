import {
  GameClock,
  INPUT_STALL_TICKS,
  ITEM,
  RACE,
  Rng,
  SNAPSHOT_INTERVAL_TICKS,
  applyRunnerEffect,
  buildRaceCourse,
  createRunner,
  groundBelow,
  hash32,
  runnerProgress,
  stepRunner,
  type AnswerPayload,
  type CharacterId,
  type GameStartPayload,
  type InputPayload,
  type ItemId,
  type MatchResult,
  type Pair,
  type QuizDeck,
  type RaceCourse,
  type RaceTrap,
  type RunnerEvent,
  type RunnerState,
  type Slot,
} from '@duo/shared';
import { TickInputQueue } from './InputQueue.js';
import type { GameInstance, GameOutput } from './types.js';

const MAX_TRAPS = 6;

/** Tablas de ítems con "rubber banding": quien va atrás recibe ítems más poderosos. */
const ITEM_TABLE: Record<'behind' | 'close' | 'ahead', Array<[ItemId, number]>> = {
  behind: [
    [ITEM.Turbo, 35],
    [ITEM.Cloud, 25],
    [ITEM.Kiss, 25],
    [ITEM.Peel, 8],
    [ITEM.Shield, 7],
  ],
  close: [
    [ITEM.Turbo, 24],
    [ITEM.Peel, 20],
    [ITEM.Cloud, 20],
    [ITEM.Kiss, 20],
    [ITEM.Shield, 16],
  ],
  ahead: [
    [ITEM.Peel, 40],
    [ITEM.Shield, 34],
    [ITEM.Turbo, 16],
    [ITEM.Kiss, 10],
  ],
};

interface PendingKiss {
  from: Slot;
  target: Slot;
  at: number;
}

export interface RaceGameOptions {
  matchId: number;
  seed: number;
  startTime: number;
  characters: Pair<CharacterId>;
  names: Pair<string>;
  deck: QuizDeck;
  tour: { step: number; total: number } | null;
  out: GameOutput;
}

export class RaceGame implements GameInstance {
  readonly mode = 'race' as const;
  readonly matchId: number;
  readonly course: RaceCourse;
  readonly runners: Pair<RunnerState>;
  private readonly queues: Pair<TickInputQueue>;
  private readonly clock: GameClock;
  private readonly rng: Rng;
  private traps: RaceTrap[] = [];
  private nextTrapId = 1;
  private kisses: PendingKiss[] = [];
  private leader: Slot | null = null;
  private lastSnapshotTick = -999;
  private lastLeadCheck = 0;
  private finishPlaces: Slot[] = [];
  private forfeitSlot: Slot | null = null;
  private _result: MatchResult | null = null;
  private readonly events: RunnerEvent[] = [];

  constructor(private readonly opts: RaceGameOptions) {
    this.matchId = opts.matchId;
    this.course = buildRaceCourse(opts.seed);
    this.runners = [createRunner(this.course), createRunner(this.course)];
    this.queues = [new TickInputQueue(0), new TickInputQueue(0)];
    this.clock = new GameClock(opts.startTime);
    this.rng = new Rng(hash32(opts.seed, 0x17e3));
  }

  get result(): MatchResult | null {
    return this._result;
  }

  startPayload(): GameStartPayload {
    return {
      matchId: this.matchId,
      mode: 'race',
      seed: this.opts.seed,
      clock: this.clock.payload,
      characters: this.opts.characters,
      names: this.opts.names,
      deck: this.opts.deck,
      tour: this.opts.tour,
    };
  }

  /** Último tick que cuenta para la carrera (límite o gracia tras el primer llegado). */
  private endTick(): number {
    let end: number = RACE.TIME_LIMIT_TICKS;
    for (const r of this.runners) {
      if (r.finish >= 0) end = Math.min(end, Math.ceil(r.finish) + RACE.FINISH_GRACE_TICKS);
    }
    return end;
  }

  onInput(slot: Slot, payload: InputPayload, now: number): void {
    if (this._result || payload.m !== this.matchId) return;
    const serverTick = this.clock.tick(now);
    if (serverTick < 0) return; // todavía en cuenta regresiva
    const runner = this.runners[slot];
    if (runner.finish >= 0) {
      // Ya llegó: seguimos simulando el trote, pero sin consecuencias.
      const list = this.queues[slot].accept(payload.t, payload.b, serverTick, serverTick);
      for (const b of list) stepRunner(runner, b, this.course, [], undefined);
      return;
    }
    const list = this.queues[slot].accept(payload.t, payload.b, serverTick, this.endTick());
    for (const b of list) this.stepPlayer(slot, b, serverTick);
  }

  private stepPlayer(slot: Slot, buttons: number, serverTick: number): void {
    const runner = this.runners[slot];
    if (runner.tick >= this.endTick() && runner.finish < 0) return;
    this.events.length = 0;
    stepRunner(runner, buttons, this.course, this.traps, this.events);
    for (const ev of this.events) this.handleEvent(slot, ev, serverTick);
  }

  private rival(slot: Slot): Slot {
    return slot === 0 ? 1 : 0;
  }

  private handleEvent(slot: Slot, ev: RunnerEvent, serverTick: number): void {
    const out = this.opts.out;
    const runner = this.runners[slot];
    switch (ev.t) {
      case 'box': {
        const other = this.runners[this.rival(slot)];
        const diff = runner.x - other.x;
        const band = diff < -600 ? 'behind' : diff > 600 ? 'ahead' : 'close';
        const table = ITEM_TABLE[band];
        const idx = this.rng.weighted(table.map(([, w]) => w));
        const item = (table[idx] ?? table[0])?.[0] ?? ITEM.Turbo;
        runner.item = item;
        out.broadcast('game:event', { k: 'race:itemGot', slot, item });
        break;
      }
      case 'use': {
        out.broadcast('game:event', { k: 'race:item', slot, item: ev.item, x: ev.x, y: ev.y });
        const target = this.rival(slot);
        if (ev.item === ITEM.Peel) {
          const tx = ev.x - 46;
          const gy = groundBelow(this.course, tx, ev.y - 4);
          if (gy !== null && gy < this.course.deathY) {
            this.traps.push({ id: this.nextTrapId++, x: tx, y: gy, owner: slot });
            if (this.traps.length > MAX_TRAPS) this.traps.shift();
          }
        } else if (ev.item === ITEM.Cloud) {
          const result = applyRunnerEffect(this.runners[target], 'slow');
          out.broadcast('game:event', { k: 'race:effect', from: slot, target, effect: 'slow', result });
        } else if (ev.item === ITEM.Kiss) {
          this.kisses.push({ from: slot, target, at: serverTick + RACE.KISS_FLIGHT_TICKS });
        }
        break;
      }
      case 'trap': {
        this.traps = this.traps.filter((t) => t.id !== ev.id);
        out.broadcast('game:event', { k: 'race:trapHit', slot, id: ev.id, shielded: ev.shielded });
        break;
      }
      case 'hit':
        out.broadcast('game:event', { k: 'race:hit', slot, kind: ev.kind, shielded: ev.shielded });
        break;
      case 'fall':
        out.broadcast('game:event', { k: 'race:fall', slot });
        break;
      case 'finish': {
        if (!this.finishPlaces.includes(slot)) this.finishPlaces.push(slot);
        const place = this.finishPlaces.indexOf(slot) === 0 ? 1 : 2;
        out.broadcast('game:event', { k: 'race:finish', slot, time: ev.time, place });
        break;
      }
      default:
        break;
    }
  }

  onAnswer(_slot: Slot, _p: AnswerPayload, _now: number): void {}
  onSkip(_slot: Slot, _q: number, _now: number): void {}
  onCount(_slot: Slot, _now: number): void {}

  update(now: number): void {
    if (this._result) return;
    const serverTick = this.clock.tick(now);
    if (serverTick < 0) return;
    const endTick = this.endTick();

    // Jugadores trabados (pestaña en segundo plano, red caída): avanzan con entrada neutra.
    for (const slot of [0, 1] as const) {
      const q = this.queues[slot];
      const target = Math.min(serverTick - INPUT_STALL_TICKS, endTick);
      if (q.simTick < target) {
        const n = target - q.simTick;
        q.fillTo(target);
        for (let i = 0; i < n; i++) this.stepPlayer(slot, 0, serverTick);
      }
    }

    // Besos voladores en vuelo
    if (this.kisses.length > 0) {
      const due = this.kisses.filter((k) => k.at <= serverTick);
      this.kisses = this.kisses.filter((k) => k.at > serverTick);
      for (const k of due) {
        const result = applyRunnerEffect(this.runners[k.target], 'kiss');
        this.opts.out.broadcast('game:event', { k: 'race:effect', from: k.from, target: k.target, effect: 'kiss', result });
      }
    }

    // Cambio de líder (para el relator)
    if (serverTick - this.lastLeadCheck >= 30) {
      this.lastLeadCheck = serverTick;
      const [a, b] = this.runners;
      const pa = runnerProgress(a, this.course);
      const pb = runnerProgress(b, this.course);
      const lead: Slot | null = Math.abs(pa - pb) < 0.004 ? this.leader : pa > pb ? 0 : 1;
      if (lead !== null && lead !== this.leader) {
        if (this.leader !== null) this.opts.out.broadcast('game:event', { k: 'race:lead', slot: lead });
        this.leader = lead;
      }
    }

    if (serverTick - this.lastSnapshotTick >= SNAPSHOT_INTERVAL_TICKS) {
      this.lastSnapshotTick = serverTick;
      this.opts.out.broadcast('game:snap', {
        m: 'race',
        matchId: this.matchId,
        t: serverTick,
        p: this.runners,
        traps: this.traps,
      });
    }

    // ¿Terminó?
    const done = this.runners.every((r) => r.finish >= 0 || r.tick >= endTick);
    if (done) this.finish();
  }

  private finish(): void {
    const [a, b] = this.runners;
    const fa = a.finish >= 0 ? a.finish : null;
    const fb = b.finish >= 0 ? b.finish : null;
    let winner: Slot | null;
    if (this.forfeitSlot !== null) winner = this.rival(this.forfeitSlot);
    else if (fa !== null && fb !== null) winner = Math.abs(fa - fb) < 0.01 ? null : fa < fb ? 0 : 1;
    else if (fa !== null) winner = 0;
    else if (fb !== null) winner = 1;
    else {
      const pa = runnerProgress(a, this.course);
      const pb = runnerProgress(b, this.course);
      winner = Math.abs(pa - pb) < 0.0005 ? null : pa > pb ? 0 : 1;
    }

    const points: Pair<number> = [0, 0];
    for (const slot of [0, 1] as const) {
      const r = this.runners[slot];
      let p = r.hearts * 10;
      if (winner === slot) p += 500;
      else if (winner === null) p += 400;
      else p += r.finish >= 0 ? 250 : 150;
      if (r.hits === 0 && r.falls === 0 && r.finish >= 0) p += 100;
      points[slot] = this.forfeitSlot === slot ? 0 : p;
    }

    const names = this.opts.names;
    let headline: string;
    if (this.forfeitSlot !== null) headline = `${names[this.rival(this.forfeitSlot)]} gana por abandono`;
    else if (winner === null) headline = '¡Empate de foto finish!';
    else headline = `¡${names[winner]} gana la Carrera del Caos!`;

    this._result = {
      id: this.matchId,
      mode: 'race',
      winner,
      cooperative: false,
      points,
      headline,
      forfeit: this.forfeitSlot,
      details: {
        kind: 'race',
        finishTicks: [fa, fb],
        hearts: [a.hearts, b.hearts],
        hits: [a.hits, b.hits],
        falls: [a.falls, b.falls],
        itemsUsed: [a.itemsUsed, b.itemsUsed],
        progress: [runnerProgress(a, this.course), runnerProgress(b, this.course)],
      },
    };
  }

  pause(now: number): void {
    this.clock.pause(now);
  }

  resume(at: number): void {
    // Los besos en vuelo conservan su tick relativo (el reloj se congela).
    this.clock.resume(at);
    this.opts.out.broadcast('game:clock', { matchId: this.matchId, clock: this.clock.payload });
  }

  syncPlayer(slot: Slot, now: number): void {
    this.opts.out.sendTo(slot, 'game:start', this.startPayload());
    this.opts.out.sendTo(slot, 'game:snap', {
      m: 'race',
      matchId: this.matchId,
      t: this.clock.tick(now),
      p: this.runners,
      traps: this.traps,
    });
  }

  forfeit(slot: Slot): void {
    if (this._result) return;
    this.forfeitSlot = slot;
    this.finish();
  }

  /** Solo para pruebas: tick actual del reloj. */
  debugTick(now: number): number {
    return this.clock.tick(now);
  }
}
