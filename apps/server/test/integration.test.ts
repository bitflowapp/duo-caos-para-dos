import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESUME_COUNTDOWN_MS, type JoinAck, type RoomState } from '@duo/shared';
import type { DuoApp } from '../src/app';
import { connect, connected, emitAck, pair, sleep, startMatch, startServer, waitFor } from './net';

let app: DuoApp;
let url: string;

beforeAll(async () => {
  ({ app, url } = await startServer());
});
afterAll(async () => {
  await app.close();
});

describe('salas privadas por red', () => {
  it('dos clientes independientes ven el mismo estado', async () => {
    const p = await pair(url);
    await sleep(150);
    const sa = p.states[0].at(-1);
    const sb = p.states[1].at(-1);
    expect(sa?.players[0]?.name).toBe('Ana');
    expect(sa?.players[1]?.name).toBe('Leo');
    expect({ ...sa, serverNow: 0 }).toEqual({ ...sb, serverNow: 0 });
    p.a.close();
    p.b.close();
  });

  it('cupo exacto de dos: un tercero no puede entrar', async () => {
    const p = await pair(url);
    const c = connect(url);
    await connected(c);
    const r = await emitAck<JoinAck>(c, 'room:join', { code: p.code });
    expect(r).toEqual({ ok: false, error: 'full' });
    for (const s of [p.a, p.b, c]) s.close();
  });

  it('códigos inválidos o inexistentes se rechazan', async () => {
    const c = connect(url);
    await connected(c);
    expect(await emitAck<JoinAck>(c, 'room:join', { code: 'hola' })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await emitAck<JoinAck>(c, 'room:join', { code: 'ZZZZ-ZZZZ' })).toMatchObject({ ok: false, error: 'not_found' });
    c.close();
  });

  it('aislamiento: los eventos de una sala no llegan a otra', async () => {
    const p1 = await pair(url);
    const p2 = await pair(url);
    expect(p1.code).not.toBe(p2.code);
    let leaked = false;
    p2.a.on('emote', () => (leaked = true));
    p2.b.on('emote', () => (leaked = true));
    const got = waitFor(p1.b, 'emote');
    p1.a.emit('emote', { id: 'heart' });
    await got;
    await sleep(200);
    expect(leaked).toBe(false);
    for (const s of [p1.a, p1.b, p2.a, p2.b]) s.close();
  });

  it('cliente con otra versión de protocolo es rechazado', async () => {
    const c = connect(url, 999);
    await expect(connected(c)).rejects.toThrow('version');
    c.close();
  });

  it('mensajes malformados o de no miembros se ignoran sin romper el servidor', async () => {
    const intruder = connect(url);
    await connected(intruder);
    const errors: string[] = [];
    intruder.on('error:msg', (e) => errors.push(e.code));
    const emitAny = intruder.emit.bind(intruder) as (e: string, ...a: unknown[]) => void;
    emitAny('lobby:select', { character: 'hacker', skin: 99 });
    emitAny('game:input', { m: 1, t: 1, b: [999] });
    emitAny('quiz:answer', { q: 0, choice: 1, extra: 'x' });
    emitAny('lobby:ready', { ready: true }); // válido pero no es miembro de ninguna sala
    emitAny('no-existe', {});
    await sleep(200);
    expect(errors).toContain('invalid');
    const r = await emitAck<JoinAck>(intruder, 'room:create', {});
    expect(r.ok).toBe(true);
    intruder.close();
  });

  it('reanudación con token: vuelve al mismo lugar; tokens falsos no sirven', async () => {
    const p = await pair(url);
    p.b.close();
    await waitFor<RoomState>(p.a, 'room:state', (s) => s.players[1]?.connected === false);
    const b2 = connect(url);
    await connected(b2);
    const fake = await emitAck<JoinAck>(b2, 'room:resume', { token: 'x'.repeat(43) });
    expect(fake).toMatchObject({ ok: false, error: 'not_found' });
    const back = waitFor<RoomState>(p.a, 'room:state', (s) => s.players[1]?.connected === true);
    const r = await emitAck<JoinAck>(b2, 'room:resume', { token: p.tokens[1] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slot).toBe(1);
    await back;
    p.a.close();
    b2.close();
  });

  it('desconexión en plena carrera: pausa y reanuda tras reconectar', async () => {
    const p = await pair(url);
    await startMatch(p, 'race');
    await waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'playing', 8_000);
    p.b.close();
    const paused = await waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'paused');
    expect(paused.pause?.slot).toBe(1);
    const b2 = connect(url);
    await connected(b2);
    const sync = waitFor(b2, 'game:start');
    const r = await emitAck<JoinAck>(b2, 'room:resume', { token: p.tokens[1] });
    expect(r.ok).toBe(true);
    await sync; // recibe de nuevo los datos de la partida
    const resumed = await waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'playing', RESUME_COUNTDOWN_MS + 3_000);
    expect(resumed.pause).toBeNull();
    p.a.close();
    b2.close();
  });

  it('abandonar libera el lugar y el código sirve para invitar a otra persona', async () => {
    const p = await pair(url);
    p.b.emit('room:leave');
    await waitFor<RoomState>(p.a, 'room:state', (s) => s.players[1] === null);
    const c = connect(url);
    await connected(c);
    const r = await emitAck<JoinAck>(c, 'room:join', { code: p.code, name: 'Mía' });
    expect(r.ok).toBe(true);
    for (const s of [p.a, p.b, c]) s.close();
  });
});

describe('límites de frecuencia por red', () => {
  it('demasiados intentos de unirse desde la misma IP se frenan', async () => {
    const server = await startServer({ JOIN_ATTEMPTS_PER_MINUTE: '20' });
    const c = connect(server.url);
    await connected(c);
    let limited = false;
    for (let i = 0; i < 30 && !limited; i++) {
      const r = await emitAck<JoinAck>(c, 'room:join', { code: 'ZZZZ-ZZZ' + 'ABCDEFGHJK'[i % 10] });
      if (!r.ok && r.error === 'rate_limited') limited = true;
    }
    expect(limited).toBe(true);
    c.close();
    await server.app.close();
  });
});
