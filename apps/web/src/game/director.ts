import type Phaser from 'phaser';
import type { GameMode } from '@duo/shared';
import { audio } from '../audio';
import { store } from '../state/store';

/** Qué escena de Phaser corresponde al estado de la sala. */
export type SceneKey = 'menu' | 'race' | 'coop' | 'quiz';

let current: { key: SceneKey; matchId: number } | null = null;
let ready = false;
let gameRef: Phaser.Game | null = null;

const MUSIC: Record<SceneKey, 'menu' | 'race' | 'coop' | 'quiz'> = {
  menu: 'menu',
  race: 'race',
  coop: 'coop',
  quiz: 'quiz',
};

function desired(): { key: SceneKey; matchId: number } {
  const s = store.get();
  const room = s.room;
  const game = s.game;
  if (
    room &&
    game &&
    game.matchId === room.matchId &&
    (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'paused')
  ) {
    const key: Record<GameMode, SceneKey> = { race: 'race', coop: 'coop', quiz: 'quiz' };
    return { key: key[game.mode], matchId: game.matchId };
  }
  return { key: 'menu', matchId: 0 };
}

function apply(): void {
  if (!ready || !gameRef) return;
  const want = desired();
  if (current && current.key === want.key && current.matchId === want.matchId) return;
  const sm = gameRef.scene;
  for (const k of ['menu', 'race', 'coop', 'quiz'] as const) {
    if (k !== want.key && (sm.isActive(k) || sm.isPaused(k))) sm.stop(k);
  }
  if (sm.isActive(want.key)) sm.stop(want.key);
  sm.start(want.key);
  current = want;
  const room = store.get().room;
  if (want.key === 'menu' && room?.phase === 'results') audio.playMusic('results');
  else audio.playMusic(MUSIC[want.key]);
}

export function startDirector(game: Phaser.Game): void {
  gameRef = game;
  store.subscribe(() => apply());
}

/** Llamado por BootScene cuando las texturas están listas. */
export function directorReady(): void {
  ready = true;
  document.getElementById('game-root')?.classList.add('ready');
  if (gameRef?.scene.isActive('boot')) gameRef.scene.stop('boot');
  apply();
}

export function currentSceneKey(): SceneKey | null {
  return current?.key ?? null;
}
