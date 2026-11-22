import { useSyncExternalStore } from 'react';
import type { ChaosKind, ItemId, Slot } from '@duo/shared';

/** Datos del HUD que publican las escenas (~10 veces por segundo). */
export interface HudState {
  mode: 'race' | 'coop' | 'quiz' | null;
  matchId: number;
  // Carrera
  progress: [number, number];
  place: 1 | 2;
  hearts: number;
  item: ItemId;
  itemRolling: boolean;
  chaos: { kind: ChaosKind; active: boolean } | null;
  finished: { place: 1 | 2 } | null;
  rivalFinished: boolean;
  elapsed: number;
  banner: { text: string; sub?: string; kind: 'info' | 'chaos' | 'good' | 'bad'; id: number } | null;
  // Cooperativo
  rooms: number;
  totalRooms: number;
  falls: [number, number];
  action: 'lever' | 'console' | null;
  partnerOffscreen: boolean;
  syncCount: { at: number; slot: Slot } | null;
  consoleArmed: [boolean, boolean];
  synced: boolean;
  timeLeft: number;
  hint: string | null;
  portrait: boolean;
}

const initial: HudState = {
  mode: null,
  matchId: 0,
  progress: [0, 0],
  place: 1,
  hearts: 0,
  item: 0,
  itemRolling: false,
  chaos: null,
  finished: null,
  rivalFinished: false,
  elapsed: 0,
  banner: null,
  rooms: 0,
  totalRooms: 4,
  falls: [0, 0],
  action: null,
  partnerOffscreen: false,
  syncCount: null,
  consoleArmed: [false, false],
  synced: false,
  timeLeft: 0,
  hint: null,
  portrait: false,
};

let state: HudState = initial;
const listeners = new Set<() => void>();
let bannerId = 1;

export const hud = {
  get: (): HudState => state,
  set(patch: Partial<HudState>): void {
    let changed = false;
    for (const k of Object.keys(patch) as Array<keyof HudState>) {
      if (state[k] !== patch[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...patch };
    for (const l of listeners) l();
  },
  reset(mode: HudState['mode'], matchId: number): void {
    state = { ...initial, mode, matchId };
    for (const l of listeners) l();
  },
  banner(text: string, kind: 'info' | 'chaos' | 'good' | 'bad' = 'info', sub?: string, ms = 1800): void {
    const id = bannerId++;
    hud.set({ banner: sub ? { text, sub, kind, id } : { text, kind, id } });
    setTimeout(() => {
      if (state.banner?.id === id) hud.set({ banner: null });
    }, ms);
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useHud<T>(selector: (s: HudState) => T): T {
  return useSyncExternalStore(hud.subscribe, () => selector(state), () => selector(state));
}
