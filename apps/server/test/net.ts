import { io as ioc, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type ClientToServerEvents,
  type GameStartPayload,
  type JoinAck,
  type RoomState,
  type ServerToClientEvents,
} from '@duo/shared';
import { createApp, type DuoApp } from '../src/app';
import { loadConfig } from '../src/config';

export type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export async function startServer(env: Record<string, string> = {}): Promise<{ app: DuoApp; url: string }> {
  const config = loadConfig({ NODE_ENV: 'test', STATIC_DIR: '', MAX_CONNECTIONS_PER_IP: '400', JOIN_ATTEMPTS_PER_MINUTE: '1000', ...env });
  const app = createApp(config);
  const port = await app.listen(0, '127.0.0.1');
  return { app, url: `http://127.0.0.1:${port}` };
}

export function connect(url: string, version = PROTOCOL_VERSION): TestSocket {
  return ioc(url, { auth: { v: version }, transports: ['websocket'], forceNew: true, reconnection: false });
}

export function waitFor<T>(socket: TestSocket, event: keyof ServerToClientEvents, pred: (p: T) => boolean = () => true, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`timeout esperando ${String(event)}`));
    }, ms);
    const handler = (p: T): void => {
      if (!pred(p)) return;
      clearTimeout(timer);
      socket.off(event, handler as never);
      resolve(p);
    };
    socket.on(event, handler as never);
  });
}

export function connected(socket: TestSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', () => resolve());
    socket.once('connect_error', (e) => reject(e));
  });
}

export function emitAck<R>(socket: TestSocket, event: 'room:create' | 'room:join' | 'room:resume', payload: unknown): Promise<R> {
  return new Promise((resolve) => {
    (socket.emit as (e: string, p: unknown, cb: (r: R) => void) => void)(event, payload, resolve);
  });
}

export interface Pairing {
  a: TestSocket;
  b: TestSocket;
  code: string;
  tokens: [string, string];
  states: [RoomState[], RoomState[]];
  starts: [GameStartPayload[], GameStartPayload[]];
}

/** Crea una sala con A, une a B y deja registrados los estados que reciben. */
export async function pair(url: string): Promise<Pairing> {
  const a = connect(url);
  const b = connect(url);
  await Promise.all([connected(a), connected(b)]);
  const states: [RoomState[], RoomState[]] = [[], []];
  const starts: [GameStartPayload[], GameStartPayload[]] = [[], []];
  a.on('room:state', (s) => states[0].push(s));
  b.on('room:state', (s) => states[1].push(s));
  a.on('game:start', (s) => starts[0].push(s));
  b.on('game:start', (s) => starts[1].push(s));
  const ra = await emitAck<JoinAck>(a, 'room:create', { name: 'Ana' });
  if (!ra.ok) throw new Error(`create: ${ra.error}`);
  const rb = await emitAck<JoinAck>(b, 'room:join', { code: ra.state.code, name: 'Leo' });
  if (!rb.ok) throw new Error(`join: ${rb.error}`);
  return { a, b, code: ra.state.code, tokens: [ra.token, rb.token], states, starts };
}

export async function startMatch(p: Pairing, mode: 'race' | 'coop' | 'quiz' | 'tour'): Promise<GameStartPayload> {
  p.a.emit('lobby:select', { character: 'chispa', skin: 0, accessory: 'none' });
  p.b.emit('lobby:select', { character: 'bruma', skin: 1, accessory: 'none' });
  p.a.emit('lobby:mode', { mode });
  await new Promise((r) => setTimeout(r, 100));
  const startA = waitFor<GameStartPayload>(p.a, 'game:start');
  const startB = waitFor<GameStartPayload>(p.b, 'game:start');
  p.a.emit('lobby:ready', { ready: true });
  p.b.emit('lobby:ready', { ready: true });
  const [sa, sb] = await Promise.all([startA, startB]);
  if (JSON.stringify(sa) !== JSON.stringify(sb)) throw new Error('game:start distinto para cada cliente');
  return sa;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
