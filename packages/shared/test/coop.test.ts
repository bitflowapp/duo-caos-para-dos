import { describe, expect, it } from 'vitest';
import {
  BTN_RIGHT,
  COOP,
  CoopBot,
  TILE,
  applyCoopInteraction,
  buildCoopLevel,
  coopStars,
  createCoopMech,
  createCoopPlayer,
  stepCoopPlayer,
  updateCoopMech,
  type CharacterId,
  type CoopEvent,
  type MechEvent,
  type Pair,
} from '../src/index';

const level = buildCoopLevel();

function runBots(chars: Pair<CharacterId>): { tick: number; events: MechEvent[] } {
  const players: Pair<ReturnType<typeof createCoopPlayer>> = [createCoopPlayer(level, 0), createCoopPlayer(level, 1)];
  const mech = createCoopMech(level);
  const bots = [new CoopBot(level, chars[0]), new CoopBot(level, chars[1])];
  const all: MechEvent[] = [];
  for (let t = 1; t <= COOP.TIME_LIMIT_TICKS; t++) {
    for (const i of [0, 1] as const) {
      const ev: CoopEvent[] = [];
      const b = bots[i]!.decide(players[i], players[i === 0 ? 1 : 0], mech);
      stepCoopPlayer(players[i], b, level, mech, chars[i], i, ev);
      for (const e of ev) applyCoopInteraction(mech, level, e, i, all);
    }
    const mev: MechEvent[] = [];
    updateCoopMech(
      mech,
      level,
      [
        { state: players[0], character: chars[0] },
        { state: players[1], character: chars[1] },
      ],
      Math.min(players[0].tick, players[1].tick),
      mev,
    );
    all.push(...mev);
    if (mev.some((e) => e.t === 'exit')) return { tick: t, events: all };
  }
  return { tick: -1, events: all };
}

describe('Sincronizados: el nivel es resoluble', () => {
  it('dos bots coordinados llegan a la salida (Chispa en slot 0)', () => {
    const r = runBots(['chispa', 'bruma']);
    expect(r.tick).toBeGreaterThan(0);
    expect(r.events.filter((e) => e.t === 'room')).toHaveLength(4);
    expect(r.events.some((e) => e.t === 'synced')).toBe(true);
  });

  it('dos bots coordinados llegan a la salida (Bruma en slot 0)', () => {
    const r = runBots(['bruma', 'chispa']);
    expect(r.tick).toBeGreaterThan(0);
  });
});

describe('Sincronizados: mecanismos', () => {
  it('la placa abre la puerta solo mientras alguien la pisa', () => {
    const mech = createCoopMech(level);
    const a = createCoopPlayer(level, 0);
    const b = createCoopPlayer(level, 1);
    a.x = 9 * TILE;
    const ev: MechEvent[] = [];
    for (let i = 0; i < 40; i++) {
      updateCoopMech(mech, level, [{ state: a, character: 'chispa' }, { state: b, character: 'bruma' }], 0, ev);
    }
    expect(mech.plates[0]).toBe(true);
    expect(mech.doors[0]).toBe(1);
    a.x = 3 * TILE;
    for (let i = 0; i < 40; i++) {
      updateCoopMech(mech, level, [{ state: a, character: 'chispa' }, { state: b, character: 'bruma' }], 0, ev);
    }
    expect(mech.doors[0]).toBe(0);
  });

  it('la barrera cálida bloquea a Bruma pero no a Chispa', () => {
    const mech = createCoopMech(level);
    const gate = level.gates[0]!;
    for (const character of ['chispa', 'bruma'] as const) {
      const p = createCoopPlayer(level, 0);
      p.x = gate.x0 - 30;
      p.y = gate.y1;
      for (let i = 0; i < 40; i++) stepCoopPlayer(p, BTN_RIGHT, level, mech, character, 0);
      if (character === 'chispa') expect(p.x).toBeGreaterThan(gate.x1);
      else expect(p.x).toBeLessThan(gate.x0);
    }
  });

  it('el ascensor sube solo con los dos a bordo y se queda quieto con uno', () => {
    const mech = createCoopMech(level);
    const el = level.elevator;
    const a = createCoopPlayer(level, 0);
    const b = createCoopPlayer(level, 1);
    a.x = el.x0 + 40;
    a.y = el.yBottom;
    a.onElevator = true;
    b.x = 20 * TILE;
    const ev: MechEvent[] = [];
    const tick = (): void =>
      updateCoopMech(mech, level, [{ state: a, character: 'chispa' }, { state: b, character: 'bruma' }], 0, ev);
    for (let i = 0; i < 60; i++) tick();
    expect(mech.elevY).toBe(el.yBottom);
    b.x = el.x0 + 100;
    b.y = el.yBottom;
    b.onElevator = true;
    for (let i = 0; i < 400; i++) tick();
    expect(mech.elevY).toBe(el.yTop);
    b.onElevator = false;
    for (let i = 0; i < 60; i++) tick();
    expect(mech.elevY).toBe(el.yTop);
  });

  it('las consolas exigen dos jugadores dentro de la ventana de 0,8 s', () => {
    const mech = createCoopMech(level);
    const ev: MechEvent[] = [];
    applyCoopInteraction(mech, level, { t: 'console', id: 0, tick: 1000 }, 0, ev);
    applyCoopInteraction(mech, level, { t: 'console', id: 1, tick: 1000 + COOP.CONSOLE_WINDOW_TICKS + 5 }, 1, ev);
    expect(mech.synced).toBe(false);
    applyCoopInteraction(mech, level, { t: 'console', id: 0, tick: 1100 }, 0, ev);
    expect(mech.synced).toBe(true);
    expect(ev.some((e) => e.t === 'synced')).toBe(true);
  });

  it('un mismo jugador no puede activar ambas consolas', () => {
    const mech = createCoopMech(level);
    const ev: MechEvent[] = [];
    applyCoopInteraction(mech, level, { t: 'console', id: 0, tick: 500 }, 0, ev);
    applyCoopInteraction(mech, level, { t: 'console', id: 1, tick: 510 }, 0, ev);
    expect(mech.synced).toBe(false);
  });

  it('calcula estrellas por tiempo y caídas', () => {
    expect(coopStars(120 * 60, 2)).toBe(3);
    expect(coopStars(120 * 60, 9)).toBe(2);
    expect(coopStars(200 * 60, 0)).toBe(2);
    expect(coopStars(280 * 60, 0)).toBe(1);
  });
});
