import { useSyncExternalStore } from 'react';
import type {
  GameStartPayload,
  QuizProgress,
  QuizQuestionView,
  QuizReveal,
  RoomState,
  Slot,
} from '@duo/shared';
import { loadSettings, type Settings } from '../persistence/settings';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'outdated';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'achievement';
}

export interface SessionInfo {
  token: string;
  slot: Slot;
  code: string;
  expiresAt: number;
}

export type View = 'home' | 'join' | 'settings' | 'profile' | 'room';

export interface QuizUiState {
  question: QuizQuestionView | null;
  progress: QuizProgress | null;
  reveal: QuizReveal | null;
}

export interface AppState {
  view: View;
  connection: ConnectionStatus;
  rtt: number | null;
  session: SessionInfo | null;
  room: RoomState | null;
  game: GameStartPayload | null;
  quiz: QuizUiState;
  toasts: Toast[];
  /** Código recibido por enlace de invitación (#/sala/CODIGO). */
  inviteCode: string | null;
  busy: boolean;
  notice: string | null;
  replaced: boolean;
  settings: Settings;
  lastEmote: { slot: Slot; id: string; at: number } | null;
  /** Logros desbloqueados en la última partida (por id de partida). */
  rewards: { matchId: number; ids: string[] } | null;
}

type Listener = () => void;

class Store {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const store = new Store({
  view: 'home',
  connection: 'idle',
  rtt: null,
  session: null,
  room: null,
  game: null,
  quiz: { question: null, progress: null, reveal: null },
  toasts: [],
  inviteCode: null,
  busy: false,
  notice: null,
  replaced: false,
  settings: loadSettings(),
  lastEmote: null,
  rewards: null,
});

/** Hook de React: el selector debe devolver valores estables (partes del estado). */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}

let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200): void {
  const t: Toast = { id: toastId++, text, kind };
  store.set((s) => ({ toasts: [...s.toasts, t].slice(-4) }));
  setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), ms);
}

/** Anuncio para lectores de pantalla. */
export function announce(text: string): void {
  const el = document.getElementById('sr-live');
  if (el) el.textContent = text;
}
