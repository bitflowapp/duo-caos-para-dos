import {
  COOP,
  GameClock,
  INPUT_STALL_TICKS,
  SNAPSHOT_INTERVAL_TICKS,
  applyCoopInteraction,
  buildCoopLevel,
  coopStars,
  createCoopMech,
  createCoopPlayer,
  stepCoopPlayer,
  updateCoopMech,
  type AnswerPayload,
  type CharacterId,
  type CoopEvent,
  type CoopLevel,
  type CoopMech,
  type CoopPlayerState,
  type GameStartPayload,
  type InputPayload,
  type MatchResult,
  type MechEvent,
  type Pair,
  type QuizDeck,
  type Slot,
} from '@duo/shared';
import { TickInputQueue } from './InputQueue.js';
import type { GameInstance, GameOutput } from './types.js';

export interface CoopGameOptions {
  matchId: number;
  seed: number;
  startTime: number;
  characters: Pair<CharacterId>;
  names: Pair<string>;
  deck: QuizDeck;
  tour: { step: number; total: number } | null;
  out: GameOutput;
}

let cachedLevel: CoopLevel | null = null;
function level(): CoopLevel {
  cachedLevel ??= buildCoopLevel();
  return cachedLevel;
}

export class CoopGame implements GameInstance {
  readonly mode = 'coop' as const;
  readonly matchId: number;
  readonly level: CoopLevel;
  readonly players: Pair<CoopPlayerState>;
  readonly mech: CoopMech;
  private readonly queues: Pair<TickInputQueue>;
  private readonly clock: GameClock;
  private mechTick = 0;
  private lastSnapshotTick = -999;
  private lastCountAt = 0;
  private forfeitSlot: Slot | null = null;
  private exitTick: number | null = null;
  private _result: MatchResult | null = null;
  private readonly events: CoopEvent[] = [];
  private readonly mechEvents: MechEvent[] = [];

  constructor(private readonly opts: CoopGameOptions) {
    this.matchId = opts.matchId;
    this.level = level();
    this.players = [createCoopPlayer(this.level, 0), createCoopPlayer(this.level, 1)];
    this.mech = createCoopMech(this.level);
    this.queues = [new TickInputQueue(0), new TickInputQueue(0)];
    this.clock = new GameClock(opts.startTime);
  }

  get result(): MatchResult | null {
    return this._result;
  }

  startPayload(): GameStartPayload {
    return {
      matchId: this.matchId,
      mode: 'coop',
      seed: this.opts.seed,
      clock: this.clock.payload,
      characters: this.opts.characters,
      names: this.opts.names,
      deck: this.opts.deck,
      tour: this.opts.tour,
    };
  }

  onInput(slot: Slot, payload: InputPayload, now: number): void {
    if (this._result || payload.m !== this.matchId) return;
    const serverTick = this.clock.tick(now);
    if (serverTick < 0) return;
    const list = this.queues[slot].accept(payload.t, payload.b, serverTick, COOP.TIME_LIMIT_TICKS);
    for (const b of list) this.stepPlayer(slot, b);
  }

  private stepPlayer(slot: Slot, buttons: number): void {
    this.events.length = 0;
    this.mechEvents.length = 0;
    stepCoopPlayer(this.players[slot], buttons, this.level, this.mech, this.opts.characters[slot], slot, this.events);
    for (const ev of this.events) {
      if (ev.t === 'fall') {
        this.opts.out.broadcast('game:event', { k: 'coop:fall', slot, kind: ev.kind });
      } else if (ev.t === 'lever' || ev.t === 'console') {
        applyCoopInteraction(this.mech, this.level, ev, slot, this.mechEvents);
      }
    }
    this.flushMechEvents();
  }

  private flushMechEvents(): void {
    for (const ev of this.mechEvents) {
      if (ev.t === 'exit') {
        if (this.exitTick === null) this.exitTick = this.mechTick;
        continue;
      }
      this.opts.out.broadcast('game:event', { k: 'coop:mech', ev });
    }
    this.mechEvents.length = 0;
  }

  onAnswer(_slot: Slot, _p: AnswerPayload, _now: number): void {}
  onSkip(_slot: Slot, _q: number, _now: number): void {}

  /** Cuenta regresiva "3, 2, 1" compartida para coordinar las consolas. */
  onCount(slot: Slot, now: number): void {
    if (this._result || now - this.lastCountAt < 3_500) return;
    this.lastCountAt = now;
    this.opts.out.broadcast('game:event', { k: 'coop:count', slot, at: now + 600 });
  }

  update(now: number): void {
    if (this._result) return;
    const serverTick = this.clock.tick(now);
    if (serverTick < 0) return;

    for (const slot of [0, 1] as const) {
      const q = this.queues[slot];
      const target = Math.min(serverTick - INPUT_STALL_TICKS, COOP.TIME_LIMIT_TICKS);
      if (q.simTick < target) {
        const n = target - q.simTick;
        q.fillTo(target);
        for (let i = 0; i < n; i++) this.stepPlayer(slot, 0);
      }
    }

    // Mecanismos: un paso por tick de reloj transcurrido.
    const minTick = Math.min(this.players[0].tick, this.players[1].tick);
    while (this.mechTick < serverTick && this.exitTick === null) {
      this.mechTick++;
      updateCoopMech(
        this.mech,
        this.level,
        [
          { state: this.players[0], character: this.opts.characters[0] },
          { state: this.players[1], character: this.opts.characters[1] },
        ],
        minTick,
        this.mechEvents,
      );
      this.flushMechEvents();
    }

    if (serverTick - this.lastSnapshotTick >= SNAPSHOT_INTERVAL_TICKS) {
      this.lastSnapshotTick = serverTick;
      this.opts.out.broadcast('game:snap', {
        m: 'coop',
        matchId: this.matchId,
        t: serverTick,
        p: this.players,
        mech: this.mech,
      });
    }

    if (this.exitTick !== null) this.finish(true, this.exitTick);
    else if (serverTick >= COOP.TIME_LIMIT_TICKS) this.finish(false, COOP.TIME_LIMIT_TICKS);
  }

  private finish(success: boolean, timeTicks: number): void {
    const falls: Pair<number> = [this.players[0].falls, this.players[1].falls];
    const totalRooms = this.level.rooms.length;
    const rooms = success ? totalRooms : this.mech.roomsCleared;
    const stars = success ? coopStars(timeTicks, falls[0] + falls[1]) : 0;
    const pts = success ? 600 + stars * 150 : rooms * 100;
    const names = this.opts.names;
    let headline: string;
    if (this.forfeitSlot !== null) headline = `${names[this.forfeitSlot]} tuvo que irse… ¡la próxima lo logran!`;
    else if (success && stars === 3) headline = '¡Sincronía perfecta! Tres estrellas.';
    else if (success) headline = '¡Lo lograron juntos!';
    else headline = '¡Se acabó el tiempo! Casi casi…';
    this._result = {
      id: this.matchId,
      mode: 'coop',
      winner: null,
      cooperative: true,
      points: [pts, pts],
      headline,
      forfeit: this.forfeitSlot,
      details: {
        kind: 'coop',
        success,
        timeTicks,
        falls,
        stars,
        roomsCleared: rooms,
        totalRooms,
      },
    };
  }

  pause(now: number): void {
    this.clock.pause(now);
  }

  resume(at: number): void {
    this.clock.resume(at);
    this.opts.out.broadcast('game:clock', { matchId: this.matchId, clock: this.clock.payload });
  }

  syncPlayer(slot: Slot, now: number): void {
    this.opts.out.sendTo(slot, 'game:start', this.startPayload());
    this.opts.out.sendTo(slot, 'game:snap', {
      m: 'coop',
      matchId: this.matchId,
      t: this.clock.tick(now),
      p: this.players,
      mech: this.mech,
    });
  }

  forfeit(slot: Slot): void {
    if (this._result) return;
    this.forfeitSlot = slot;
    this.finish(false, this.mechTick);
  }
}
