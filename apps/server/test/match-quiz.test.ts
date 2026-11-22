import { afterAll, beforeAll, expect, it } from 'vitest';
import type { QuizQuestionView, QuizReveal, RoomState } from '@duo/shared';
import type { DuoApp } from '../src/app';
import { pair, startMatch, startServer, waitFor } from './net';

let app: DuoApp;
let url: string;
beforeAll(async () => {
  ({ app, url } = await startServer());
});
afterAll(async () => {
  await app.close();
});

it('¿Cuánto me conocés? completo por red, sin fugas de respuestas antes de revelar', async () => {
  const p = await pair(url);
  await startMatch(p, 'quiz');
  const reveals: QuizReveal[] = [];
  const leaks: string[] = [];
  let answeredByA = -1;
  // B solo debería ver si A respondió (booleano), nunca qué respondió, hasta el reveal.
  p.b.on('quiz:progress', (pr) => {
    if ('answers' in (pr as object)) leaks.push('progress');
  });
  p.b.on('quiz:question', (q: QuizQuestionView) => {
    if (q.mine !== null && answeredByA === q.index) leaks.push('mine');
    setTimeout(() => p.b.emit('quiz:answer', { q: q.index, choice: q.index % 2 }), 250);
  });
  p.a.on('quiz:question', (q: QuizQuestionView) => {
    answeredByA = q.index;
    p.a.emit('quiz:answer', { q: q.index, choice: 0 });
  });
  p.a.on('quiz:reveal', (r) => reveals.push(r));
  const [ra, rb] = await Promise.all([
    waitFor<RoomState>(p.a, 'room:state', (s) => s.phase === 'results', 120_000),
    waitFor<RoomState>(p.b, 'room:state', (s) => s.phase === 'results', 120_000),
  ]);
  expect(leaks).toEqual([]);
  expect(reveals).toHaveLength(8);
  expect(ra.lastResult).toEqual(rb.lastResult);
  const res = ra.lastResult;
  if (res?.details.kind !== 'quiz') throw new Error('detalle');
  const total0 = reveals.reduce((s, r) => s + r.points[0], 0);
  expect(res.points[0]).toBe(total0);
  expect(reveals.at(-1)?.totals).toEqual(res.points);
  p.a.close();
  p.b.close();
}, 150_000);
