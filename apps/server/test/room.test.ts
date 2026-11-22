import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS,
  CoopBot,
  RECONNECT_GRACE_MS,
  RESUME_COUNTDOWN_MS,
  RaceBot,
  TICK_MS,
  type GameStartPayload,
  type QuizQuestionView,
  type QuizReveal,
  type RoomState,
} from '@duo/shared';
import { CoopGame } from '../src/games/CoopGame';
import { QuizGame } from '../src/games/QuizGame';
import { RaceGame } from '../src/games/RaceGame';
import { lastOf, makeRoom } from './harness';

function readyUp(h: ReturnType<typeof makeRoom>, mode: 'race' | 'coop' | 'quiz' | 'tour'): void {
  const { room, clock } = h;
  room.select(0, { character: 'chispa', skin: 1, accessory: 'none' }, clock.now);
  room.select(1, { character: 'bruma', skin: 2, accessory: 'flower' }, clock.now);
  room.setMode(0, mode, undefined, clock.now);
  room.setReady(0, true, clock.now);
  room.setReady(1, true, clock.now);
}

/** Juega la carrera con bots que deciden con el estado autoritativo del servidor. */
function playRace(h: ReturnType<typeof makeRoom>): void {
  const { room, clock } = h;
  h.advance(COUNTDOWN_MS + 50);
  expect(room.phase).toBe('playing');
  const g = room.game as RaceGame;
  const bots = [new RaceBot(g.course), new RaceBot(g.course)];
  let guard = 0;
  while (room.phase === 'playing' && guard++ < 20_000) {
    clock.now += TICK_MS;
    const serverTick = g.debugTick(clock.now);
    for (const slot of [0, 1] as const) {
      const r = g.runners[slot];
      let safety = 0;
      while (r.tick < serverTick && safety++ < 5) {
        const before = r.tick;
        room.input(slot, { m: g.matchId, t: r.tick + 1, b: [bots[slot]!.decide(r)] }, clock.now);
        if (r.tick === before) break;
      }
    }
    room.update(clock.now);
  }
}

function playCoop(h: ReturnType<typeof makeRoom>): void {
  const { room, clock } = h;
  h.advance(COUNTDOWN_MS + 50);
  const g = room.game as CoopGame;
  const bots = [new CoopBot(g.level, 'chispa'), new CoopBot(g.level, 'bruma')];
  let guard = 0;
  while (room.phase === 'playing' && guard++ < 30_000) {
    clock.now += TICK_MS;
    for (const slot of [0, 1] as const) {
      const p = g.players[slot];
      const other = g.players[slot === 0 ? 1 : 0];
      room.input(slot, { m: g.matchId, t: p.tick + 1, b: [bots[slot]!.decide(p, other, g.mech)] }, clock.now);
    }
    room.update(clock.now);
  }
}

function playQuiz(h: ReturnType<typeof makeRoom>, choose: (q: number, slot: 0 | 1) => number | 'skip' | null): void {
  const { room, clock } = h;
  h.advance(COUNTDOWN_MS + 50);
  let guard = 0;
  let lastAnswered = -1;
  while (room.phase === 'playing' && guard++ < 200_000) {
    const g = room.game as QuizGame;
    const st = g.debugState();
    if (st.phase === 'answering' && st.index !== lastAnswered) {
      lastAnswered = st.index;
      for (const slot of [0, 1] as const) {
        const c = choose(st.index, slot);
        if (c === 'skip') room.skip(slot, st.index, clock.now);
        else if (c !== null) room.answer(slot, { q: st.index, choice: c }, clock.now);
        if (c === 'skip') {
          lastAnswered = -1;
          break;
        }
      }
    }
    h.advance(100);
  }
}

describe('sala: lobby', () => {
  it('cada jugador debe tener un personaje distinto y listo para empezar', () => {
    const h = makeRoom();
    const { room, clock } = h;
    room.select(0, { character: 'chispa', skin: 0, accessory: 'none' }, clock.now);
    room.select(1, { character: 'chispa', skin: 0, accessory: 'none' }, clock.now);
    expect(room.seats[1]?.character).toBe('bruma'); // el servidor rechaza el personaje repetido
    room.select(1, { character: null, skin: 0, accessory: 'none' }, clock.now);
    room.setReady(1, true, clock.now);
    expect(room.seats[1]?.ready).toBe(false); // sin personaje no se puede estar listo
    room.select(1, { character: 'bruma', skin: 0, accessory: 'none' }, clock.now);
    room.setReady(0, true, clock.now);
    room.setReady(1, true, clock.now);
    h.advance(50);
    expect(room.phase).toBe('countdown');
  });

  it('el primero arranca con Chispa y el segundo recibe a Bruma, así nadie queda trabado', () => {
    const h = makeRoom();
    expect(h.room.seats[0]?.character).toBe('chispa');
    expect(h.room.seats[1]?.character).toBe('bruma');
    // Sin elegir nada, confirmar "listo" a los dos alcanza para empezar.
    h.room.setReady(0, true, h.clock.now);
    h.room.setReady(1, true, h.clock.now);
    h.advance(50);
    expect(h.room.phase).toBe('countdown');
  });

  it('se puede confirmar "listo" antes de que entre la pareja y se conserva al llegar', () => {
    const h = makeRoom();
    h.room.removePlayer(1, h.clock.now);
    h.room.setReady(0, true, h.clock.now);
    expect(h.room.seats[0]?.ready).toBe(true);
    h.room.addPlayer('Mía', 'h'.repeat(43), 'sock-c', h.clock.now);
    expect(h.room.seats[0]?.ready).toBe(true);
    expect(h.room.seats[1]?.character).toBe('bruma');
    h.room.setReady(1, true, h.clock.now);
    h.advance(50);
    expect(h.room.phase).toBe('countdown');
  });

  it('cambiar de juego obliga a confirmar de nuevo', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    h.room.setMode(1, 'quiz', undefined, h.clock.now);
    expect(h.room.seats[0]?.ready).toBe(false);
    expect(h.room.seats[1]?.ready).toBe(false);
    h.advance(100);
    expect(h.room.phase).toBe('lobby');
    expect(h.room.mode).toBe('quiz');
  });

  it('emite el mismo game:start a toda la sala', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    h.advance(20);
    const start = lastOf<GameStartPayload>(h.log, 'game:start', 'room:TESTCODE');
    expect(start?.mode).toBe('race');
    expect(start?.characters).toEqual(['chispa', 'bruma']);
    expect(start?.names).toEqual(['Ana', 'Leo']);
  });
});

describe('sala: partidas completas con reloj simulado', () => {
  it('Carrera del Caos: termina con ganador consistente con los tiempos', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    playRace(h);
    const { room } = h;
    expect(room.phase).toBe('results');
    const res = room.lastResult;
    expect(res?.mode).toBe('race');
    if (res?.details.kind !== 'race') throw new Error('detalle');
    const [a, b] = res.details.finishTicks;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (a !== null && b !== null && Math.abs(a - b) >= 0.01) expect(res.winner).toBe(a < b ? 0 : 1);
    expect(res.points[0]).toBeGreaterThan(0);
    expect(room.stats.played).toBe(1);
    const state = lastOf<RoomState>(h.log, 'room:state');
    expect(state?.phase).toBe('results');
    expect(state?.lastResult?.id).toBe(res.id);
  });

  it('Sincronizados: dos bots superan el templo y comparten el resultado', () => {
    const h = makeRoom();
    readyUp(h, 'coop');
    playCoop(h);
    const res = h.room.lastResult;
    expect(res?.cooperative).toBe(true);
    if (res?.details.kind !== 'coop') throw new Error('detalle');
    expect(res.details.success).toBe(true);
    expect(res.details.roomsCleared).toBe(4);
    expect(res.points[0]).toBe(res.points[1]);
    expect(h.room.stats.coopWins).toBe(1);
  });

  it('¿Cuánto me conocés?: revelación solo después de ambas respuestas', () => {
    const h = makeRoom();
    readyUp(h, 'quiz');
    h.advance(COUNTDOWN_MS + 3_500);
    const g = h.room.game as QuizGame;
    expect(g.debugState().phase).toBe('answering');
    h.room.answer(0, { q: 0, choice: 1 }, h.clock.now);
    h.advance(500);
    expect(lastOf<QuizReveal>(h.log, 'quiz:reveal')).toBeUndefined();
    // La vista de B no contiene la respuesta de A
    const viewB = lastOf<QuizQuestionView>(h.log, 'quiz:question', 'sock-b');
    expect(viewB?.mine).toBeNull();
    expect(JSON.stringify(h.log.filter((e) => e.to === 'sock-b'))).not.toContain('"answers"');
    h.room.answer(1, { q: 0, choice: 1 }, h.clock.now);
    h.advance(1_200);
    const rev = lastOf<QuizReveal>(h.log, 'quiz:reveal');
    expect(rev?.answers).toEqual([1, 1]);
    expect(rev?.outcome).toBe('match');
  });

  it('¿Cuánto me conocés?: ronda completa con puntaje y sintonía', () => {
    const h = makeRoom();
    readyUp(h, 'quiz');
    playQuiz(h, (q, slot) => (q % 3 === 0 ? 0 : slot === 0 ? 0 : 1));
    const res = h.room.lastResult;
    expect(res?.mode).toBe('quiz');
    if (res?.details.kind !== 'quiz') throw new Error('detalle');
    expect(res.details.scored).toBe(8);
    expect(res.details.syncPercent).toBeGreaterThan(0);
    expect(res.details.syncPercent).toBeLessThan(100);
  });

  it('pasar una pregunta no resta puntos y la reemplaza (hasta 3 veces)', () => {
    const h = makeRoom();
    readyUp(h, 'quiz');
    h.advance(COUNTDOWN_MS + 3_500);
    const firstQ = lastOf<QuizQuestionView>(h.log, 'quiz:question', 'sock-a');
    h.room.skip(1, 0, h.clock.now);
    const replaced = lastOf<QuizQuestionView>(h.log, 'quiz:question', 'sock-a');
    expect(replaced?.replaced).toBe(true);
    expect(replaced?.prompt).not.toBe(firstQ?.prompt);
    expect(replaced?.replacementsLeft).toBe(2);
    expect(replaced?.totals).toEqual([0, 0]);
  });
});

describe('sala: revancha, gira y reconexión', () => {
  it('revancha: ambos votan y arranca la misma partida de nuevo', () => {
    const h = makeRoom();
    readyUp(h, 'quiz');
    playQuiz(h, () => 0);
    const { room, clock } = h;
    expect(room.phase).toBe('results');
    const firstMatch = room.matchCounter;
    room.vote(0, 'rematch', clock.now);
    expect(room.phase).toBe('results');
    room.vote(1, 'rematch', clock.now);
    expect(room.phase).toBe('countdown');
    expect(room.matchCounter).toBe(firstMatch + 1);
    expect(room.currentGame).toBe('quiz');
  });

  it('Gira por la Isla: carrera → templo → quiz y copa final', () => {
    const h = makeRoom();
    readyUp(h, 'tour');
    playRace(h);
    expect(h.room.tour?.step).toBe(1);
    h.room.vote(0, 'next', h.clock.now);
    h.room.vote(1, 'next', h.clock.now);
    expect(h.room.currentGame).toBe('coop');
    playCoop(h);
    expect(h.room.tour?.step).toBe(2);
    h.room.vote(0, 'next', h.clock.now);
    h.room.vote(1, 'next', h.clock.now);
    expect(h.room.currentGame).toBe('quiz');
    playQuiz(h, () => 0);
    expect(h.room.tour?.finished).toBe(true);
    expect(h.room.tour?.results).toHaveLength(3);
    expect(h.room.stats.played).toBe(3);
  });

  it('desconexión en partida: pausa, reconexión con cuenta regresiva y continúa', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    h.advance(COUNTDOWN_MS + 2_000);
    const g = h.room.game as RaceGame;
    const tickBefore = g.debugTick(h.clock.now);
    h.room.onDisconnect(1, 'sock-b', h.clock.now);
    expect(h.room.phase).toBe('paused');
    expect(h.room.pause?.slot).toBe(1);
    h.advance(10_000);
    expect(g.debugTick(h.clock.now)).toBe(tickBefore); // reloj congelado
    h.room.bindSocket(1, 'sock-b2', h.clock.now);
    expect(h.room.phaseEndsAt).not.toBeNull();
    h.advance(RESUME_COUNTDOWN_MS + 100);
    expect(h.room.phase).toBe('playing');
    expect(g.debugTick(h.clock.now)).toBeGreaterThan(tickBefore);
    expect(h.log.some((e) => e.to === 'sock-b2' && e.event === 'game:start')).toBe(true);
  });

  it('si no vuelve a tiempo, la partida termina por abandono', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    h.advance(COUNTDOWN_MS + 1_000);
    h.room.onDisconnect(0, 'sock-a', h.clock.now);
    h.advance(RECONNECT_GRACE_MS + 500);
    expect(h.room.phase).toBe('results');
    expect(h.room.lastResult?.forfeit).toBe(0);
    expect(h.room.lastResult?.winner).toBe(1);
  });

  it('salir en plena partida cuenta como abandono y libera el lugar', () => {
    const h = makeRoom();
    readyUp(h, 'coop');
    h.advance(COUNTDOWN_MS + 1_000);
    h.room.removePlayer(1, h.clock.now);
    expect(h.room.phase).toBe('lobby');
    expect(h.room.lastResult?.forfeit).toBe(1);
    expect(h.room.seats[1]).toBeNull();
    expect(h.room.canAcceptPlayer()).toBe(true);
  });

  it('desconexión durante la cuenta regresiva vuelve al lobby', () => {
    const h = makeRoom();
    readyUp(h, 'race');
    h.advance(200);
    h.room.onDisconnect(0, 'sock-a', h.clock.now);
    expect(h.room.phase).toBe('lobby');
    expect(h.room.seats[0]?.ready).toBe(false);
  });
});
