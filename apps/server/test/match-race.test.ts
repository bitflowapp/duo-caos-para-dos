import { afterAll, beforeAll, expect, it } from 'vitest';
import type { RoomState } from '@duo/shared';
import type { DuoApp } from '../src/app';
import { BotClient } from './botclient';
import { pair, startMatch, startServer, waitFor } from './net';

let app: DuoApp;
let url: string;
beforeAll(async () => {
  ({ app, url } = await startServer());
});
afterAll(async () => {
  await app.close();
});

it('Carrera del Caos completa por red: dos clientes, resultados idénticos y revancha', async () => {
  const p = await pair(url);
  const start = await startMatch(p, 'race');
  const ca = new BotClient(p.a, start, 0);
  const cb = new BotClient(p.b, start, 1);
  const [ra, rb] = await Promise.all([
    waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'results', 150_000),
    waitFor<RoomState>(p.b, 'room:state', (s) => s.phase === 'results', 150_000),
  ]);
  ca.stop();
  cb.stop();
  expect(ra.lastResult).toEqual(rb.lastResult);
  const res = ra.lastResult;
  expect(res?.mode).toBe('race');
  if (res?.details.kind !== 'race') throw new Error('detalle');
  // Ambos llegaron a la meta jugando por red con predicción y reconciliación.
  expect(res.details.finishTicks[0]).not.toBeNull();
  expect(res.details.finishTicks[1]).not.toBeNull();
  const [fa, fb] = res.details.finishTicks as [number, number];
  if (Math.abs(fa - fb) >= 0.01) expect(res.winner).toBe(fa < fb ? 0 : 1);
  expect(ca.inputsSent).toBeGreaterThan(1000);
  // La predicción del cliente casi nunca necesita corregirse (simulación determinista).
  expect(ca.race?.corrections ?? 99).toBeLessThan(40);

  // Revancha sin crear sala nueva
  const again = Promise.all([waitFor(p.a, 'game:start'), waitFor(p.b, 'game:start')]);
  p.a.emit('post:vote', { kind: 'rematch' });
  p.b.emit('post:vote', { kind: 'rematch' });
  const [s2] = await again;
  expect((s2 as { matchId: number }).matchId).toBe(start.matchId + 1);
  p.a.close();
  p.b.close();
}, 180_000);
