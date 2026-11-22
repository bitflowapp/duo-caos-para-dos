import Phaser from 'phaser';
import { buildTextures } from '../art/atlas';
import { RES_OVERRIDE_FACTOR, STANDALONE, allArtEntries } from '../art/registry';
import { directorReady } from '../director';
import { currentDpr } from '../PhaserGame';

/** Genera todas las texturas a partir del arte SVG y arranca el director. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    // Densidad: el lienzo ya está a DPR; el arte se ve con zoom de cámara ~0.6–1.6.
    const res = Math.min(2.5, Math.max(1.25, currentDpr() * 1.15));
    const override: Record<string, number> = {};
    for (const [k, f] of Object.entries(RES_OVERRIDE_FACTOR)) override[k] = res * f;
    // Baldosas del templo: 48 → potencia de 2 exacta para TileSprite.
    for (const k of ['t_brick', 't_wall', 't_bridge', 't_gate_warm', 't_gate_cool', 't_thorns']) {
      override[k] = k === 't_wall' ? 128 / 96 : 128 / 48;
    }
    void (async () => {
      await document.fonts?.ready?.catch(() => undefined);
      await buildTextures(this, allArtEntries(), { res, standalone: STANDALONE, resOverride: override, prefix: 'duo' });
      directorReady();
    })();
  }
}
