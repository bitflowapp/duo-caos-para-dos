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

it('Sincronizados completo por red: el templo se supera en equipo', async () => {
  const p = await pair(url);
  const start = await startMatch(p, 'coop');
  const ca = new BotClient(p.a, start, 0);
  const cb = new BotClient(p.b, start, 1);
  const [ra, rb] = await Promise.all([
    waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'results', 170_000),
    waitFor<RoomState>(p.b, 'room:state', (s) => s.phase === 'results', 170_000),
  ]);
  ca.stop();
  cb.stop();
  expect(ra.lastResult).toEqual(rb.lastResult);
  const res = ra.lastResult;
  if (res?.details.kind !== 'coop') throw new Error('detalle');
  expect(res.details.success).toBe(true);
  expect(res.details.roomsCleared).toBe(res.details.totalRooms);
  expect(res.points[0]).toBe(res.points[1]);
  p.a.close();
  p.b.close();
}, 180_000);
