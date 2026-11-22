import { ACCESSORY_IDS, CHARACTER_IDS, SKIN_COUNT, type AccessoryId, type CharacterId } from '@duo/shared';
import { accessorySvg } from './accessories';
import {
  EYE_VARIANTS,
  MOUTH_VARIANTS,
  armSvg,
  blushSvg,
  bodySvg,
  eyesSvg,
  footSvg,
  mouthSvg,
  shadowSvg,
  topSvg,
  type EyeVariant,
  type MouthVariant,
} from './characters';
import { environmentEntries } from './environment';
import { propEntries, type ArtEntry } from './props';

/** Claves de textura de las partes de cada personaje. */
export const ck = {
  body: (c: CharacterId, s: number) => `ch-${c}-${s}-body`,
  top: (c: CharacterId, s: number) => `ch-${c}-${s}-top`,
  arm: (c: CharacterId, s: number) => `ch-${c}-${s}-arm`,
  foot: (c: CharacterId, s: number) => `ch-${c}-${s}-foot`,
  eyes: (c: CharacterId, v: EyeVariant) => `eyes-${c}-${v}`,
  mouth: (v: MouthVariant) => `mouth-${v}`,
  acc: (a: Exclude<AccessoryId, 'none'>) => `acc-${a}`,
};

export function characterEntries(): ArtEntry[] {
  const out: ArtEntry[] = [];
  for (const c of CHARACTER_IDS) {
    for (let s = 0; s < SKIN_COUNT; s++) {
      out.push({ key: ck.body(c, s), w: 128, h: 128, svg: bodySvg(c, s) });
      out.push({ key: ck.top(c, s), w: 48, h: 48, svg: topSvg(c, s) });
      out.push({ key: ck.arm(c, s), w: 32, h: 40, svg: armSvg(c, s) });
      out.push({ key: ck.foot(c, s), w: 40, h: 24, svg: footSvg(c, s) });
    }
    for (const v of EYE_VARIANTS) out.push({ key: ck.eyes(c, v), w: 72, h: 40, svg: eyesSvg(v, c) });
  }
  for (const v of MOUTH_VARIANTS) out.push({ key: ck.mouth(v), w: 40, h: 28, svg: mouthSvg(v) });
  for (const a of ACCESSORY_IDS) {
    if (a !== 'none') out.push({ key: ck.acc(a), w: 64, h: 48, svg: accessorySvg(a) });
  }
  out.push({ key: 'blush', w: 88, h: 20, svg: blushSvg() });
  out.push({ key: 'shadow', w: 96, h: 24, svg: shadowSvg() });
  return out;
}

export function allArtEntries(): ArtEntry[] {
  return [...characterEntries(), ...propEntries(), ...environmentEntries()];
}

/** Texturas grandes que van en su propia textura (no en el atlas). */
export const STANDALONE = new Set<string>([
  'far_beach',
  'far_jungle',
  'far_cliffs',
  'far_volcano',
  'mid_beach',
  'mid_jungle',
  'mid_cliffs',
  'mid_volcano',
  't_heartgate',
  'q_curtain',
  'q_spot',
]);

/** Fondos grandes a menor densidad (se ven con parallax, no necesitan tanto detalle). */
export const RES_OVERRIDE_FACTOR: Record<string, number> = {
  far_beach: 0.6,
  far_jungle: 0.6,
  far_cliffs: 0.6,
  far_volcano: 0.6,
  mid_beach: 0.7,
  mid_jungle: 0.7,
  mid_cliffs: 0.7,
  mid_volcano: 0.7,
  q_curtain: 0.6,
  q_spot: 0.5,
  t_heartgate: 0.8,
  sun: 0.8,
  cloud1: 0.8,
  cloud2: 0.8,
};
