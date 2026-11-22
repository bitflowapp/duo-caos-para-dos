import { io, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  formatRoomCode,
  type AccessoryId,
  type CharacterId,
  type ClientToServerEvents,
  type EmoteId,
  type InputPayload,
  type JoinAck,
  type JoinError,
  type PlayMode,
  type QuizDeck,
  type RoomState,
  type ServerToClientEvents,
} from '@duo/shared';
import { local, session } from '../persistence/storage';
import { store, toast, type SessionInfo } from '../state/store';
import { bus } from './bus';
import { ClockSync } from './clockSync';

type DuoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SESSION_KEY = 'duo.session';
const RESUME_KEY = 'duo.resume';

export const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  invalid: 'Ese código no parece válido. Son 8 letras y números (sin 0, O, 1, I ni L).',
  not_found: 'No encontramos esa sala. ¿Quizás ya se cerró?',
  full: 'Esa sala ya tiene a sus dos jugadores.',
  rate_limited: 'Demasiados intentos seguidos. Esperá un ratito y probá de nuevo.',
  expired: 'Esa sala expiró. Creen una nueva.',
  version: 'Hay una versión nueva del juego. Recargá la página.',
  server_full: 'El servidor está lleno en este momento. Probá en unos minutos.',
};

/** Cliente de red: única conexión Socket.IO, reloj sincronizado y reanudación por token. */
class NetClient {
  private socket: DuoSocket | null = null;
  readonly clock = new ClockSync();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingCount = 0;
  private resumeInFlight = false;

  /** URL del servidor: mismo origen por defecto (Vite hace de proxy en desarrollo). */
  private serverUrl(): string | undefined {
    const url = import.meta.env.VITE_SERVER_URL as string | undefined;
    return url && url.length > 0 ? url : undefined;
  }

  connect(): void {
    if (this.socket) return;
    store.set({ connection: 'connecting' });
    const opts = {
      transports: ['websocket', 'polling'],
      auth: { v: PROTOCOL_VERSION },
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      randomizationFactor: 0.3,
      timeout: 20_000,
    };
    const url = this.serverUrl();
    const socket: DuoSocket = url ? io(url, opts) : io(opts);
    this.socket = socket;

    socket.on('connect', () => {
      store.set({ connection: 'online', replaced: false });
      this.startPing();
      this.tryResume();
    });
    socket.on('disconnect', (reason) => {
      store.set({ connection: reason === 'io client disconnect' ? 'offline' : 'reconnecting' });
      this.stopPing();
      if (reason === 'io server disconnect') {
        // El servidor cerró la conexión (p. ej. abuso): reintentamos manualmente.
        setTimeout(() => socket.connect(), 1500);
      }
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'version') {
        store.set({ connection: 'outdated', notice: JOIN_ERROR_TEXT.version });
        socket.disconnect();
        return;
      }
      store.set({ connection: 'reconnecting' });
    });

    socket.on('room:state', (s) => this.onState(s));
    socket.on('room:closed', ({ reason }) => {
      const text =
        reason === 'idle'
          ? 'La sala se cerró por inactividad.'
          : reason === 'expired'
            ? 'La sala llegó a su tiempo máximo y se cerró.'
            : reason === 'shutdown'
              ? 'El servidor se reinició. Creen una sala nueva.'
              : 'La sala se cerró.';
      this.clearSession();
      store.set({ room: null, game: null, view: 'home', notice: text });
    });
    socket.on('session:replaced', () => {
      store.set({ replaced: true, room: null, game: null, view: 'home' });
      session.remove(SESSION_KEY);
    });
    socket.on('game:start', (p) => {
      store.set({ game: p, quiz: { question: null, progress: null, reveal: null } });
      bus.emit('start', p);
    });
    socket.on('game:clock', (p) => {
      store.set((s) => (s.game && s.game.matchId === p.matchId ? { game: { ...s.game, clock: p.clock } } : {}));
      bus.emit('clock', p);
    });
    socket.on('game:snap', (p) => bus.emit('snap', p));
    socket.on('game:event', (p) => bus.emit('event', p));
    socket.on('quiz:question', (q) =>
      store.set((s) => ({ quiz: { question: q, progress: { q: q.index, answered: q.answered }, reveal: s.quiz.reveal?.q === q.index ? s.quiz.reveal : null } })),
    );
    socket.on('quiz:progress', (p) => store.set((s) => ({ quiz: { ...s.quiz, progress: p } })));
    socket.on('quiz:reveal', (r) => store.set((s) => ({ quiz: { ...s.quiz, reveal: r } })));
    socket.on('emote', (e) => {
      store.set({ lastEmote: { slot: e.slot, id: e.id, at: performance.now() } });
      bus.emit('emote', e);
    });
    socket.on('error:msg', ({ code }) => {
      if (code === 'rate_limited') toast('¡Despacio! Demasiadas acciones seguidas.', 'error');
    });
  }

  private onState(s: RoomState): void {
    this.clock.seed(s.serverNow);
    const prev = store.get().room;
    const view = store.get().view;
    store.set({ room: s, view: view === 'settings' || view === 'profile' ? view : 'room' });
    if (prev && prev.players && s.players) {
      const me = store.get().session?.slot;
      const other = me === 0 ? 1 : 0;
      const before = prev.players[other];
      const after = s.players[other];
      if (!before && after) toast(`${after.name} se unió a la sala`);
      if (before?.connected && after && !after.connected) toast(`${after.name} perdió la conexión`, 'error');
      if (before && !before.connected && after?.connected) toast(`${after.name} volvió`);
      if (before && !after) toast(`${before.name} salió de la sala`, 'error');
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingCount = 0;
    const ping = (): void => {
      const s = this.socket;
      if (!s?.connected) return;
      const c = performance.now();
      s.timeout(5000).emit('time:ping', { c }, (err, r) => {
        if (err || !r) return;
        this.clock.addSample(r.c, r.s, performance.now());
        store.set({ rtt: this.clock.rtt === null ? null : Math.round(this.clock.rtt) });
      });
      this.pingCount++;
      if (this.pingCount === 6 && this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(ping, 4000);
      }
    };
    ping();
    this.pingTimer = setInterval(ping, 700);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  // ───────── Sesión ─────────

  private saveSession(info: SessionInfo): void {
    session.set(SESSION_KEY, info);
    local.set(RESUME_KEY, info);
    store.set({ session: info });
  }

  clearSession(): void {
    session.remove(SESSION_KEY);
    local.remove(RESUME_KEY);
    store.set({ session: null });
  }

  /** Sesión de esta pestaña (sobrevive recargas). */
  storedSession(): SessionInfo | null {
    const s = session.get<SessionInfo | null>(SESSION_KEY, null);
    if (s && s.expiresAt > Date.now()) return s;
    return null;
  }

  /** Última sala de este dispositivo (para "Volver a la partida" tras cerrar la pestaña). */
  resumableSession(): SessionInfo | null {
    const s = local.get<SessionInfo | null>(RESUME_KEY, null);
    if (s && s.expiresAt > Date.now()) return s;
    return null;
  }

  private tryResume(): void {
    const info = store.get().session ?? this.storedSession();
    if (!info || this.resumeInFlight || !this.socket) return;
    this.resumeInFlight = true;
    this.socket.timeout(10_000).emit('room:resume', { token: info.token }, (err, r) => {
      this.resumeInFlight = false;
      if (err) return; // se reintentará al reconectar
      if (r.ok) {
        this.saveSession({ ...info, slot: r.slot, code: r.state.code, expiresAt: r.expiresAt });
        this.onState(r.state);
      } else {
        this.clearSession();
        store.set({ room: null, game: null, view: 'home', notice: JOIN_ERROR_TEXT[r.error] });
      }
    });
  }

  /** Reanudar explícitamente una sala guardada (botón "Volver a la partida"). */
  resume(info: SessionInfo): void {
    store.set({ session: info });
    if (this.socket?.connected) this.tryResume();
    else this.connect();
  }

  private handleJoinAck(r: JoinAck, resolve: (ok: boolean) => void): void {
    store.set({ busy: false });
    if (r.ok) {
      this.saveSession({ token: r.token, slot: r.slot, code: r.state.code, expiresAt: r.expiresAt });
      this.onState(r.state);
      history.replaceState(null, '', `#/sala/${formatRoomCode(r.state.code)}`);
      resolve(true);
    } else {
      store.set({ notice: JOIN_ERROR_TEXT[r.error] });
      resolve(false);
    }
  }

  createRoom(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      store.set({ busy: true, notice: null });
      this.socket?.timeout(15_000).emit('room:create', { name }, (err, r) => {
        if (err) {
          store.set({ busy: false, notice: 'No pudimos conectar con el servidor. ¿Hay internet?' });
          resolve(false);
          return;
        }
        this.handleJoinAck(r, resolve);
      });
    });
  }

  joinRoom(code: string, name: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      store.set({ busy: true, notice: null });
      this.socket?.timeout(15_000).emit('room:join', { code, name }, (err, r) => {
        if (err) {
          store.set({ busy: false, notice: 'No pudimos conectar con el servidor. ¿Hay internet?' });
          resolve(false);
          return;
        }
        this.handleJoinAck(r, resolve);
      });
    });
  }

  leaveRoom(): void {
    this.socket?.emit('room:leave');
    this.clearSession();
    history.replaceState(null, '', '#/');
    store.set({ room: null, game: null, view: 'home' });
  }

  select(character: CharacterId | null, skin: number, accessory: AccessoryId): void {
    this.socket?.emit('lobby:select', { character, skin, accessory });
  }
  setReady(ready: boolean): void {
    this.socket?.emit('lobby:ready', { ready });
  }
  setMode(mode: PlayMode, deck?: QuizDeck): void {
    this.socket?.emit('lobby:mode', deck ? { mode, deck } : { mode });
  }
  sendInput(p: InputPayload): void {
    if (this.socket?.connected) this.socket.emit('game:input', p);
  }
  answer(q: number, choice: number): void {
    this.socket?.emit('quiz:answer', { q, choice });
  }
  skip(q: number): void {
    this.socket?.emit('quiz:skip', { q });
  }
  count(): void {
    this.socket?.emit('coop:count');
  }
  vote(kind: 'rematch' | 'next'): void {
    this.socket?.emit('post:vote', { kind });
  }
  toLobby(): void {
    this.socket?.emit('post:lobby');
  }
  emote(id: EmoteId): void {
    this.socket?.emit('emote', { id });
  }

  get connected(): boolean {
    return this.socket?.connected === true;
  }

  serverNow(): number {
    return this.clock.now();
  }
}

export const net = new NetClient();
