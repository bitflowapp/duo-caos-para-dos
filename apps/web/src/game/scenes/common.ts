import Phaser from 'phaser';
import { clockTick, type ClockPayload, type Slot } from '@duo/shared';
import { net } from '../../net/NetClient';
import { store } from '../../state/store';
import { currentDpr, setDpr, viewportSize } from '../PhaserGame';
import { addImage, frameOf } from '../art/atlas';

/** Zoom de cámara para ver al menos `minW × minH` unidades de mundo. */
export function fitZoom(minW: number, minH: number): { zoom: number; cssW: number; cssH: number; portrait: boolean } {
  const { w, h } = viewportSize();
  const portrait = h > w * 1.1;
  const zoomCss = Math.min(w / minW, h / minH);
  return { zoom: zoomCss * currentDpr(), cssW: w, cssH: h, portrait };
}

export function mySlot(): Slot {
  return store.get().session?.slot ?? 0;
}

/** Tick actual de la partida según el reloj sincronizado con el servidor. */
export function currentTick(clock: ClockPayload): number {
  return clockTick(clock, net.serverNow());
}

/**
 * Capa de parallax que se repite horizontalmente con imágenes alternadas
 * (más liviano que un TileSprite gigante en GPU de celulares).
 */
export class ParallaxLayer {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly width: number;

  constructor(
    scene: Phaser.Scene,
    key: string,
    private readonly factor: number,
    private readonly baseY: number,
    depth: number,
    scale = 1,
  ) {
    const r = frameOf(key);
    this.width = r.w * scale;
    for (let i = 0; i < 4; i++) {
      const img = addImage(scene, 0, baseY, key).setOrigin(0, 1).setScrollFactor(factor, 1).setDepth(depth);
      img.setScale(img.scaleX * scale);
      this.images.push(img);
    }
  }

  setKey(key: string): void {
    const r = frameOf(key);
    for (const img of this.images) {
      if (r.frame === '__BASE') img.setTexture(r.atlas);
      else img.setTexture(r.atlas, r.frame);
    }
  }

  setAlpha(a: number): void {
    for (const img of this.images) img.setAlpha(a);
  }

  setVisible(v: boolean): void {
    for (const img of this.images) img.setVisible(v);
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, yOffset = 0): void {
    const viewLeft = cam.scrollX * this.factor;
    const start = Math.floor(viewLeft / this.width) * this.width;
    this.images.forEach((img, i) => {
      img.x = start + i * this.width;
      img.y = this.baseY + yOffset;
    });
  }
}

/** Monitor de FPS para degradar la calidad si el dispositivo no llega. */
export class PerfMonitor {
  private acc = 0;
  private frames = 0;
  private slowStreak = 0;

  tick(dtMs: number): void {
    if (store.get().settings.quality !== 'auto') return;
    this.acc += dtMs;
    this.frames++;
    if (this.acc >= 2000) {
      const fps = (this.frames * 1000) / this.acc;
      this.acc = 0;
      this.frames = 0;
      if (fps < 45) this.slowStreak++;
      else this.slowStreak = 0;
      if (this.slowStreak >= 2) {
        this.slowStreak = 0;
        const d = currentDpr();
        if (d > 1.5) setDpr(1.5);
        else if (d > 1) setDpr(1);
      }
    }
  }
}

/** Bloqueo de pantalla encendida durante la partida (si el navegador lo permite). */
let wakeLock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (on && !wakeLock && nav.wakeLock && document.visibilityState === 'visible') {
      wakeLock = await nav.wakeLock.request('screen');
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

export function makeNameTag(scene: Phaser.Scene, text: string, color: string): Phaser.GameObjects.Text {
  const dpr = currentDpr();
  return scene.add
    .text(0, 0, text, {
      fontFamily: 'Fredoka, Nunito, sans-serif',
      fontSize: '15px',
      color: '#fff6e8',
      stroke: color,
      strokeThickness: 5,
      resolution: Math.min(3, dpr * 1.5),
    })
    .setOrigin(0.5, 1)
    .setDepth(40);
}
