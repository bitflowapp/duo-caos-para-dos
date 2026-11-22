import { describe, expect, it } from 'vitest';
import {
  BTN_ITEM,
  BTN_JUMP,
  ITEM,
  RACE,
  RaceBot,
  applyRunnerEffect,
  buildRaceCourse,
  cloneRunner,
  createRunner,
  runnersMatch,
  stepRunner,
  type RunnerEvent,
} from '../src/index';

describe('pista de la Carrera del Caos', () => {
  it('es determinista para una misma semilla', () => {
    const a = buildRaceCourse(1234);
    const b = buildRaceCourse(1234);
    expect(a.chunks).toEqual(b.chunks);
    expect(a.solids).toEqual(b.solids);
    expect(a.hazards).toEqual(b.hazards);
    expect(a.hearts).toEqual(b.hearts);
    expect(a.chaos).toEqual(b.chaos);
    expect(a.finishX).toBe(b.finishX);
  });

  it('varía el orden de bloques con distintas semillas', () => {
    const orders = new Set<string>();
    for (let s = 1; s <= 12; s++) orders.add(buildRaceCourse(s * 97).chunks.join(','));
    expect(orders.size).toBeGreaterThan(6);
  });

  it('ordena corazones y cajas por X con ids consecutivos', () => {
    const c = buildRaceCourse(77);
    for (let i = 1; i < c.hearts.length; i++) {
      expect(c.hearts[i]!.x).toBeGreaterThanOrEqual(c.hearts[i - 1]!.x);
      expect(c.hearts[i]!.id).toBe(i);
    }
    expect(c.boxes.length).toBeGreaterThanOrEqual(4);
  });

  it('tiene eventos de caos dentro del tiempo límite y sin superponerse', () => {
    const c = buildRaceCourse(5);
    expect(c.chaos).toHaveLength(3);
    for (let i = 0; i < c.chaos.length; i++) {
      const w = c.chaos[i]!;
      expect(w.end).toBeGreaterThan(w.start);
      expect(w.end).toBeLessThan(RACE.TIME_LIMIT_TICKS);
      if (i > 0) expect(w.start).toBeGreaterThanOrEqual(c.chaos[i - 1]!.end);
    }
  });
});

describe('simulación del corredor', () => {
  it('produce exactamente el mismo estado con las mismas entradas', () => {
    const course = buildRaceCourse(42);
    const inputs: number[] = [];
    let seed = 7;
    for (let i = 0; i < 1800; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      inputs.push(seed % 11 === 0 ? BTN_JUMP : 0);
    }
    const a = createRunner(course);
    const b = createRunner(course);
    for (const btn of inputs) stepRunner(a, btn, course, []);
    for (const btn of inputs) stepRunner(b, btn, course, []);
    expect(runnersMatch(a, b, 0)).toBe(true);
    expect(a).toEqual(b);
  });

  it('un corredor sin entradas no llega a la meta', () => {
    const course = buildRaceCourse(9);
    const r = createRunner(course);
    for (let t = 0; t < RACE.TIME_LIMIT_TICKS; t++) stepRunner(r, 0, course, []);
    expect(r.finish).toBe(-1);
  });

  it('el piloto automático completa pistas de distintas semillas sin caer', () => {
    for (const seed of [3, 1001, 65_537, 424_242]) {
      const course = buildRaceCourse(seed);
      const r = createRunner(course);
      const bot = new RaceBot(course);
      const events: RunnerEvent[] = [];
      for (let t = 0; t < RACE.TIME_LIMIT_TICKS && r.finish < 0; t++) {
        events.length = 0;
        stepRunner(r, bot.decide(r), course, [], events);
      }
      expect(r.finish).toBeGreaterThan(0);
      // Duración objetivo: alrededor de un minuto con juego perfecto.
      expect(r.finish / 60).toBeGreaterThan(45);
      expect(r.finish / 60).toBeLessThan(90);
      expect(r.falls).toBe(0);
    }
  });

  it('salta con buffer y permite doble salto', () => {
    const course = buildRaceCourse(1);
    const r = createRunner(course);
    for (let i = 0; i < 30; i++) stepRunner(r, 0, course, []);
    const ev: RunnerEvent[] = [];
    stepRunner(r, BTN_JUMP, course, [], ev);
    expect(ev.some((e) => e.t === 'jump' && !e.double)).toBe(true);
    for (let i = 0; i < 10; i++) stepRunner(r, BTN_JUMP, course, []);
    stepRunner(r, 0, course, []);
    ev.length = 0;
    stepRunner(r, BTN_JUMP, course, [], ev);
    expect(ev.some((e) => e.t === 'jump' && e.double)).toBe(true);
    expect(r.jumps).toBe(2);
  });

  it('el escudo bloquea el beso volador y la nube', () => {
    const course = buildRaceCourse(1);
    const r = createRunner(course);
    for (let i = 0; i < 20; i++) stepRunner(r, 0, course, []);
    r.shield = 100;
    expect(applyRunnerEffect(r, 'kiss')).toBe('blocked');
    expect(r.stun).toBe(0);
    expect(r.shield).toBe(0);
    expect(applyRunnerEffect(r, 'slow')).toBe('applied');
    expect(r.slow).toBe(RACE.SLOW_TICKS);
    expect(applyRunnerEffect(r, 'kiss')).toBe('applied');
    expect(r.stun).toBe(RACE.STUN_KISS);
  });

  it('usar el turbo acelera y consume el ítem', () => {
    const course = buildRaceCourse(1);
    const r = createRunner(course);
    for (let i = 0; i < 40; i++) stepRunner(r, 0, course, []);
    r.item = ITEM.Turbo;
    const ev: RunnerEvent[] = [];
    stepRunner(r, BTN_ITEM, course, [], ev);
    expect(r.item).toBe(ITEM.None);
    expect(r.boost).toBe(RACE.BOOST_TURBO_TICKS);
    expect(ev).toContainEqual(expect.objectContaining({ t: 'use', item: ITEM.Turbo }));
    const base = cloneRunner(r);
    for (let i = 0; i < 30; i++) stepRunner(r, 0, course, []);
    expect(r.vx).toBeGreaterThan(RACE.BASE_SPEED);
    expect(r.x).toBeGreaterThan(base.x);
  });

  it('pisar una cáscara de mango hace resbalar', () => {
    const course = buildRaceCourse(1);
    const r = createRunner(course);
    for (let i = 0; i < 40; i++) stepRunner(r, 0, course, []);
    const ev: RunnerEvent[] = [];
    const trap = { id: 9, x: r.x + 30, y: 0, owner: 1 as const };
    for (let i = 0; i < 20 && !ev.some((e) => e.t === 'trap'); i++) stepRunner(r, 0, course, [trap], ev);
    expect(ev).toContainEqual({ t: 'trap', id: 9, shielded: false });
    expect(r.stun).toBeGreaterThan(0);
  });
});
