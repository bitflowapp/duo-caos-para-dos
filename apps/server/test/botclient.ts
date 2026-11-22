import {
  CoopBot,
  RaceBot,
  buildCoopLevel,
  buildRaceCourse,
  clockTick,
  type ClockPayload,
  type GameStartPayload,
  type RoomState,
  type Slot,
} from '@duo/shared';
import { CoopPredictor } from '../../web/src/game/net/CoopPredictor';
import { RacePredictor } from '../../web/src/game/net/RacePredictor';
import type { TestSocket } from './net';

/**
 * Cliente automático que juega por red como lo haría el navegador: predice su
 * personaje con el mismo código del cliente web (RacePredictor/CoopPredictor),
 * envía entradas por tick y reconcilia con los snapshots del servidor.
 * El servidor corre en la misma máquina, así que su reloj es Date.now().
 */
export class BotClient {
  private clock: ClockPayload;
  private timer: ReturnType<typeof setInterval> | null = null;
  phase: RoomState['phase'] = 'countdown';
  race: RacePredictor | null = null;
  coop: CoopPredictor | null = null;
  inputsSent = 0;

  constructor(
    private readonly socket: TestSocket,
    readonly start: GameStartPayload,
    readonly slot: Slot,
  ) {
    this.clock = start.clock;
    socket.on('game:clock', (c) => {
      if (c.matchId === start.matchId) this.clock = c.clock;
    });
    socket.on('room:state', (s) => (this.phase = s.phase));
    if (start.mode === 'race') {
      const course = buildRaceCourse(start.seed);
      const pred = new RacePredictor(course, slot, start.matchId);
      const bot = new RaceBot(course);
      this.race = pred;
      socket.on('game:snap', (s) => {
        if (s.m === 'race') pred.onSnapshot(s);
      });
      this.loop(() => {
        const tick = clockTick(this.clock, Date.now());
        if (tick < 1 || (this.phase !== 'playing' && this.phase !== 'paused')) return;
        pred.advanceTo(tick, () => bot.decide(pred.local, pred.traps));
        pred.freshEvents.length = 0;
        this.flush(pred.takeInputs());
        pred.updateRival();
      });
    } else if (start.mode === 'coop') {
      const level = buildCoopLevel();
      const character = start.characters[slot];
      const pred = new CoopPredictor(level, slot, character, start.matchId);
      const bot = new CoopBot(level, character);
      this.coop = pred;
      socket.on('game:snap', (s) => {
        if (s.m === 'coop') pred.onSnapshot(s);
      });
      this.loop(() => {
        const tick = clockTick(this.clock, Date.now());
        if (tick < 1 || (this.phase !== 'playing' && this.phase !== 'paused')) return;
        const partner = pred.updatePartner();
        pred.advanceTo(tick, () => bot.decide(pred.local, partner, pred.mech));
        pred.freshEvents.length = 0;
        this.flush(pred.takeInputs());
      });
    }
  }

  private flush(p: ReturnType<RacePredictor['takeInputs']>): void {
    if (!p) return;
    this.inputsSent++;
    this.socket.emit('game:input', p);
  }

  private loop(fn: () => void): void {
    this.timer = setInterval(fn, 8);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
