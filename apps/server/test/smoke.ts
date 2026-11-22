/**
 * Smoke test de despliegue: juega la Gira por la Isla completa (carrera, templo y
 * quiz) y la revancha contra una URL pública, por WSS, con dos clientes automáticos
 * que usan el mismo código de predicción del navegador.
 *
 *   npm run smoke -- https://mi-app.onrender.com
 *
 * Si hay HTTPS_PROXY (entornos con proxy de salida) se usa para llegar a la URL;
 * si no, se conecta directo.
 */
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, GameStartPayload, JoinAck, RoomState, ServerToClientEvents } from '@duo/shared';
import { BotClient } from './botclient';
import type { TestSocket } from './net';

const URL = process.argv[2];
if (!URL || !/^https?:\/\//.test(URL)) {
  console.error('Uso: npm run smoke -- https://tu-app.example.com');
  process.exit(2);
}

async function proxyAgent(): Promise<object | undefined> {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!proxy) return undefined;
  try {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    return new HttpsProxyAgent(proxy);
  } catch {
    return undefined;
  }
}
const agent = await proxyAgent();
const mk = (): TestSocket =>
  io(URL, { auth: { v: 3 }, transports: ['websocket'], forceNew: true, reconnection: false, timeout: 30000, ...(agent ? { agent } : {}) } as never) as Socket<
    ServerToClientEvents,
    ClientToServerEvents
  >;
const log = (...a: unknown[]): void => console.log(new Date().toISOString().slice(11, 19), ...a);

const a = mk();
const b = mk();
const connected = (s: TestSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sin respuesta en 40 s (¿el servicio está dormido o la URL es incorrecta?)')), 40_000);
    s.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    s.once('connect_error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
try {
  await Promise.all([connected(a), connected(b)]);
} catch (e) {
  log('FALLO al conectar por WSS:', e instanceof Error ? e.message : e);
  process.exit(1);
}

// Sincroniza el reloj local con el del servidor (los bots usan Date.now()).
const samples: number[] = [];
for (let i = 0; i < 8; i++) {
  const t0 = Date.now();
  const s = await new Promise<number>((r) => a.emit('time:ping', { c: t0 }, (x) => r(x.s)));
  const t1 = Date.now();
  samples.push(s - (t0 + t1) / 2);
  await new Promise((r) => setTimeout(r, 120));
}
samples.sort((x, y) => x - y);
const offset = samples[Math.floor(samples.length / 2)] as number;
const realNow = Date.now.bind(Date);
Date.now = () => realNow() + offset;
log('desfase de reloj con el servidor (ms):', Math.round(offset));

const ack = <R>(s: TestSocket, e: 'room:create' | 'room:join', p: unknown): Promise<R> =>
  new Promise((r) => (s.emit as (e: string, p: unknown, cb: (r: R) => void) => void)(e, p, r));
const ra = await ack<JoinAck>(a, 'room:create', { name: 'Ana' });
if (!ra.ok) throw new Error('crear');
const rb = await ack<JoinAck>(b, 'room:join', { code: ra.state.code, name: 'Leo' });
if (!rb.ok) throw new Error('unirse');
log('sala creada y unida por WSS');

let botA = null as BotClient | null;
let botB = null as BotClient | null;
let state: RoomState = ra.state;
const results: string[] = [];
a.on('room:state', (s) => {
  state = s;
});
for (const [sock, slot] of [[a, 0], [b, 1]] as const) {
  sock.on('game:start', (st: GameStartPayload) => {
    if (slot === 0) log('inicia', st.mode);
    const bot = st.mode === 'quiz' ? null : new BotClient(sock, st, slot);
    if (slot === 0) {
      botA?.stop();
      botA = bot;
    } else {
      botB?.stop();
      botB = bot;
    }
  });
  sock.on('quiz:question', (q) => setTimeout(() => sock.emit('quiz:answer', { q: q.index, choice: q.index % 2 === 0 ? 0 : slot }), 400 + slot * 250));
}

a.emit('lobby:select', { character: 'chispa', skin: 0, accessory: 'none' });
b.emit('lobby:select', { character: 'bruma', skin: 1, accessory: 'none' });
a.emit('lobby:mode', { mode: 'tour' });
await new Promise((r) => setTimeout(r, 300));
a.emit('lobby:ready', { ready: true });
b.emit('lobby:ready', { ready: true });

const deadline = Date.now() + 9 * 60_000;
let lastShown = -1;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
  if (state.phase === 'results' && state.lastResult && state.lastResult.id !== lastShown) {
    lastShown = state.lastResult.id;
    results.push(`${state.lastResult.mode}: ${state.lastResult.headline} (${state.lastResult.points.join(' / ')})`);
    if (state.lastResult.mode === 'quiz' && state.lastResult.points[0] + state.lastResult.points[1] === 0) {
      log('FALLO: el quiz no otorgó puntos aunque hubo coincidencias de respuestas');
      process.exit(1);
    }
    log('resultado ->', results.at(-1));
    if (state.tour?.finished) break;
    a.emit('post:vote', { kind: 'next' });
    b.emit('post:vote', { kind: 'next' });
  }
}
botA?.stop();
botB?.stop();
if (!state.tour?.finished) {
  log('FALLO: la gira no terminó a tiempo; fase', state.phase);
  process.exit(1);
}
log('Gira completa. Puntos de la gira:', state.tour.points.join(' / '), '| partidas:', state.stats.played);
const again = new Promise((r) => a.once('game:start', r));
a.emit('post:vote', { kind: 'rematch' });
b.emit('post:vote', { kind: 'rematch' });
await again;
log('revancha iniciada sin crear sala nueva');
log('OK: despliegue verificado de punta a punta');
a.close();
b.close();
process.exit(0);
