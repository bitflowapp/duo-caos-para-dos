import Phaser from 'phaser';
import { store } from '../state/store';
import { frameOf } from './art/atlas';

/** Efectos de partículas reutilizables (respetan "reducir movimiento"). */
export class Fx {
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private readonly scene: Phaser.Scene) {}

  private reduced(): boolean {
    return store.get().settings.reduceMotion;
  }

  private emitter(key: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Phaser.GameObjects.Particles.ParticleEmitter {
    const id = `${key}:${JSON.stringify(config.tint ?? '')}`;
    let em = this.emitters.get(id);
    if (!em) {
      const r = frameOf(key);
      const base = 1 / r.res;
      const scale = config.scale as { start: number; end: number } | undefined;
      em = this.scene.add.particles(0, 0, r.atlas, {
        ...config,
        frame: r.frame === '__BASE' ? undefined : r.frame,
        scale: scale ? { start: scale.start * base, end: scale.end * base } : base,
        emitting: false,
      });
      em.setDepth(50);
      this.emitters.set(id, em);
    }
    return em;
  }

  burst(key: string, x: number, y: number, count: number, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}): void {
    const n = this.reduced() ? Math.ceil(count / 3) : count;
    this.emitter(key, config).explode(n, x, y);
  }

  dust(x: number, y: number, n = 6): void {
    this.burst('dust', x, y, n, {
      speedX: { min: -90, max: 30 },
      speedY: { min: -60, max: -10 },
      lifespan: 420,
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.7, end: 1.4 },
      gravityY: -40,
    });
  }

  sparkle(x: number, y: number, n = 8): void {
    this.burst('spark', x, y, n, {
      speed: { min: 60, max: 180 },
      lifespan: 520,
      alpha: { start: 1, end: 0 },
      scale: { start: 0.9, end: 0.2 },
      rotate: { min: 0, max: 180 },
    });
  }

  hearts(x: number, y: number, n = 6): void {
    this.burst('pheart', x, y, n, {
      speedX: { min: -60, max: 60 },
      speedY: { min: -150, max: -60 },
      lifespan: 1100,
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0.6 },
      gravityY: -30,
    });
  }

  confetti(x: number, y: number, n = 40): void {
    this.burst('confetti', x, y, n, {
      speedX: { min: -260, max: 260 },
      speedY: { min: -520, max: -180 },
      lifespan: 2200,
      gravityY: 520,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.2, end: 1 },
      tint: [0xff7a59, 0xffd25e, 0x9d8cff, 0x5ed6c0, 0xff6f9f, 0xffffff],
    });
  }

  splash(x: number, y: number): void {
    this.burst('drop', x, y, 12, {
      speedX: { min: -140, max: 140 },
      speedY: { min: -360, max: -160 },
      lifespan: 700,
      gravityY: 900,
      scale: { start: 1, end: 0.6 },
    });
  }

  stars(x: number, y: number): void {
    this.burst('star', x, y, 6, {
      speed: { min: 80, max: 200 },
      lifespan: 600,
      alpha: { start: 1, end: 0 },
      scale: { start: 0.9, end: 0.3 },
      rotate: { min: 0, max: 360 },
    });
  }

  shake(intensity = 0.006, ms = 180): void {
    if (this.reduced()) return;
    this.scene.cameras.main.shake(ms, intensity);
  }
}

export function vibrate(pattern: number | number[]): void {
  if (!store.get().settings.vibration) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // iOS Safari no soporta vibración: se ignora.
  }
}
