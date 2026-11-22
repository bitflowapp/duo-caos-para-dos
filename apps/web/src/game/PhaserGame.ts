import Phaser from 'phaser';
import { store } from '../state/store';
import { BootScene } from './scenes/BootScene';
import { CoopScene } from './scenes/CoopScene';
import { MenuScene } from './scenes/MenuScene';
import { QuizScene } from './scenes/QuizScene';
import { RaceScene } from './scenes/RaceScene';
import { startDirector } from './director';

/**
 * Lienzo a resolución nativa (hasta DPR 2) con zoom 1/DPR: nitidez en pantallas
 * retina. La calidad baja a 1.5 / 1 si los FPS caen (degradación adaptativa).
 */
export function pickDpr(): number {
  const q = store.get().settings.quality;
  const native = window.devicePixelRatio || 1;
  if (q === 'low') return 1;
  if (q === 'high') return Math.min(native, 2);
  return Math.min(native, 2);
}

let game: Phaser.Game | null = null;
let dpr = 1;

export function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return { w: Math.max(200, w), h: Math.max(200, h) };
}

export function currentDpr(): number {
  return dpr;
}

function resize(): void {
  if (!game) return;
  const { w, h } = viewportSize();
  game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
  game.scale.setZoom(1 / dpr);
}

export function setDpr(next: number): void {
  if (Math.abs(next - dpr) < 0.01) return;
  dpr = next;
  resize();
}

export function createGame(parent: HTMLElement): Phaser.Game {
  if (game) return game;
  dpr = pickDpr();
  const { w, h } = viewportSize();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a0f35',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
      zoom: 1 / dpr,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
      roundPixels: false,
      transparent: false,
    },
    audio: { noAudio: true },
    input: { activePointers: 1, keyboard: false, touch: false, mouse: false },
    fps: { target: 60, smoothStep: true },
    banner: false,
    disableContextMenu: true,
    scene: [BootScene, MenuScene, RaceScene, CoopScene, QuizScene],
  });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  startDirector(game);
  return game;
}

export function getGame(): Phaser.Game | null {
  return game;
}
