import type { AccessoryId, CharacterId } from '@duo/shared';
import { accessorySvgInner } from './accessories';
import { INK, skinOf, type SkinPalette } from './palette';

/**
 * Personajes originales dibujados como SVG por partes (para animarlos en Phaser
 * como "cutout"). Espacio de diseño: 128 × 128, pies en y ≈ 118.
 */

export type EyeVariant =
  | 'open'
  | 'blink'
  | 'happy'
  | 'wide'
  | 'dizzy'
  | 'love'
  | 'determined'
  | 'sad'
  | 'sleepy';
export type MouthVariant = 'smile' | 'grin' | 'open' | 'wow' | 'sad' | 'kiss' | 'flat' | 'tongue';

export const EYE_VARIANTS: readonly EyeVariant[] = ['open', 'blink', 'happy', 'wide', 'dizzy', 'love', 'determined', 'sad', 'sleepy'];
export const MOUTH_VARIANTS: readonly MouthVariant[] = ['smile', 'grin', 'open', 'wow', 'sad', 'kiss', 'flat', 'tongue'];

/** Posiciones de anclaje de cada parte (centro, en unidades de diseño). */
export const RIG = {
  chispa: { eyes: { x: 64, y: 72 }, mouth: { x: 64, y: 92 }, blush: { x: 64, y: 88 }, top: { x: 66, y: 26 }, head: { x: 64, y: 34 }, armL: { x: 24, y: 88 }, armR: { x: 104, y: 88 }, footL: { x: 46, y: 118 }, footR: { x: 82, y: 118 } },
  bruma: { eyes: { x: 64, y: 74 }, mouth: { x: 64, y: 93 }, blush: { x: 64, y: 89 }, top: { x: 70, y: 24 }, head: { x: 62, y: 38 }, armL: { x: 20, y: 90 }, armR: { x: 108, y: 90 }, footL: { x: 46, y: 118 }, footR: { x: 82, y: 118 } },
} as const;

const svg = (w: number, h: number, inner: string, vb = `0 0 ${w} ${h}`): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`;

function bodyDefs(id: string, p: SkinPalette): string {
  return `<defs>
    <radialGradient id="${id}g" cx="0.36" cy="0.3" r="0.85">
      <stop offset="0" stop-color="${p.light}"/>
      <stop offset="0.55" stop-color="${p.base}"/>
      <stop offset="1" stop-color="${p.dark}"/>
    </radialGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.belly}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${p.belly}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>`;
}

const CHISPA_BODY = 'M64 118 C35 118 17 101 17 79 C17 55 36 35 64 35 C92 35 111 55 111 79 C111 101 93 118 64 118 Z';
const BRUMA_BODY =
  'M24 95 C13 94 9 82 16 74 C10 62 19 49 33 52 C35 38 50 31 61 37 C70 27 88 30 93 43 C107 41 117 55 110 67 C118 75 113 91 101 93 C98 109 84 118 64 118 C43 118 26 109 24 95 Z';

export function bodySvg(character: CharacterId, skin: number): string {
  const p = skinOf(character, skin);
  const id = `b${character}${skin}`;
  if (character === 'chispa') {
    return svg(
      128,
      128,
      `${bodyDefs(id, p)}
      <path d="${CHISPA_BODY}" fill="url(#${id}g)" stroke="${p.line}" stroke-width="4" stroke-linejoin="round"/>
      <ellipse cx="64" cy="103" rx="27" ry="13" fill="url(#${id}b)"/>
      <ellipse cx="42" cy="53" rx="13" ry="8" fill="#fff" opacity="0.38" transform="rotate(-28 42 53)"/>
      <circle cx="31" cy="86" r="2.2" fill="${p.dark}" opacity="0.7"/>
      <circle cx="36" cy="91" r="2" fill="${p.dark}" opacity="0.7"/>
      <circle cx="29" cy="93" r="1.8" fill="${p.dark}" opacity="0.7"/>
      <circle cx="97" cy="86" r="2.2" fill="${p.dark}" opacity="0.7"/>
      <circle cx="92" cy="91" r="2" fill="${p.dark}" opacity="0.7"/>
      <circle cx="99" cy="93" r="1.8" fill="${p.dark}" opacity="0.7"/>`,
    );
  }
  return svg(
    128,
    128,
    `${bodyDefs(id, p)}
    <path d="${BRUMA_BODY}" fill="url(#${id}g)" stroke="${p.line}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="64" cy="104" rx="26" ry="12" fill="url(#${id}b)"/>
    <ellipse cx="44" cy="54" rx="12" ry="7" fill="#fff" opacity="0.4" transform="rotate(-22 44 54)"/>
    <path d="M92 58 a9 9 0 1 0 6 13 a7 7 0 1 1 -6 -13 z" fill="${p.accentA}" opacity="0.95"/>`,
  );
}

export function topSvg(character: CharacterId, skin: number): string {
  const p = skinOf(character, skin);
  const id = `t${character}${skin}`;
  if (character === 'chispa') {
    // Llamita: se anima con un parpadeo de escala.
    return svg(
      48,
      48,
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.accentA}"/><stop offset="1" stop-color="${p.accentB}"/></linearGradient></defs>
      <path d="M24 46 C11 44 7 32 13 22 C14 29 18 31 20 27 C19 18 24 9 31 3 C30 13 39 17 38 28 C41 25 42 21 41 18 C47 27 43 44 24 46 Z"
        fill="url(#${id})" stroke="${p.line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 41 C18 40 16 34 19 29 C21 33 24 32 25 28 C28 31 31 35 29 39 C28 40 26 41 24 41 Z" fill="#fff" opacity="0.55"/>`,
    );
  }
  // Rulito de bruma con estrellita.
  return svg(
    48,
    48,
    `<path d="M14 44 C10 34 18 26 26 28 C34 30 34 40 26 40 C21 40 21 34 25 34" fill="none" stroke="${p.line}" stroke-width="7" stroke-linecap="round"/>
    <path d="M14 44 C10 34 18 26 26 28 C34 30 34 40 26 40 C21 40 21 34 25 34" fill="none" stroke="${p.light}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M38 6 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" fill="${p.accentA}" stroke="${p.line}" stroke-width="1.6" stroke-linejoin="round"/>`,
  );
}

export function armSvg(character: CharacterId, skin: number): string {
  const p = skinOf(character, skin);
  const id = `a${character}${skin}`;
  return svg(
    32,
    40,
    `<defs><radialGradient id="${id}" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.base}"/></radialGradient></defs>
    <ellipse cx="16" cy="20" rx="10" ry="15" fill="url(#${id})" stroke="${p.line}" stroke-width="3.5"/>`,
  );
}

export function footSvg(character: CharacterId, skin: number): string {
  const p = skinOf(character, skin);
  return svg(
    40,
    24,
    `<ellipse cx="20" cy="12" rx="15" ry="8.5" fill="${p.dark}" stroke="${p.line}" stroke-width="3.5"/>
    <ellipse cx="15" cy="9" rx="5" ry="2.5" fill="#fff" opacity="0.3"/>`,
  );
}

const eyeWhite = (cx: number, cy: number, rx: number, ry: number): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
const pupil = (cx: number, cy: number, r: number): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/><circle cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" r="${r * 0.38}" fill="#fff"/><circle cx="${cx + r * 0.4}" cy="${cy + r * 0.35}" r="${r * 0.16}" fill="#fff"/>`;

/** Ojos (par) en un lienzo de 72 × 40, centrados en (36, 20). */
export function eyesSvg(variant: EyeVariant, character: CharacterId): string {
  const L = 21;
  const R = 51;
  const cy = 21;
  const big = character === 'chispa';
  const rx = big ? 10 : 9;
  const ry = big ? 12.5 : 11;
  let inner = '';
  switch (variant) {
    case 'open':
      if (big) {
        inner = eyeWhite(L, cy, rx, ry) + eyeWhite(R, cy, rx, ry) + pupil(L + 1.5, cy + 1.5, 6.6) + pupil(R + 1.5, cy + 1.5, 6.6);
      } else {
        // Bruma: mirada tranquila de párpado bajo.
        inner =
          eyeWhite(L, cy + 2, rx, ry - 1) +
          eyeWhite(R, cy + 2, rx, ry - 1) +
          pupil(L + 1, cy + 5, 6) +
          pupil(R + 1, cy + 5, 6) +
          `<path d="M${L - rx} ${cy - 1} Q${L} ${cy - 5} ${L + rx} ${cy - 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
          `<path d="M${R - rx} ${cy - 1} Q${R} ${cy - 5} ${R + rx} ${cy - 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      }
      break;
    case 'sleepy':
      inner =
        `<path d="M${L - 9} ${cy + 2} Q${L} ${cy + 9} ${L + 9} ${cy + 2}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M${R - 9} ${cy + 2} Q${R} ${cy + 9} ${R + 9} ${cy + 2}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
      break;
    case 'blink':
      inner =
        `<path d="M${L - 9} ${cy + 2} Q${L} ${cy + 6} ${L + 9} ${cy + 2}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M${R - 9} ${cy + 2} Q${R} ${cy + 6} ${R + 9} ${cy + 2}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      break;
    case 'happy':
      inner =
        `<path d="M${L - 9} ${cy + 5} Q${L} ${cy - 8} ${L + 9} ${cy + 5}" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>` +
        `<path d="M${R - 9} ${cy + 5} Q${R} ${cy - 8} ${R + 9} ${cy + 5}" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>`;
      break;
    case 'wide':
      inner = eyeWhite(L, cy, 12, 14) + eyeWhite(R, cy, 12, 14) + pupil(L, cy, 4) + pupil(R, cy, 4);
      break;
    case 'dizzy': {
      const spiral = (cx: number): string =>
        `<path d="M${cx} ${cy} m-1 0 a1.5 1.5 0 1 1 3 0 a3.5 3.5 0 1 1 -7 0 a5.5 5.5 0 1 1 11 0 a7.5 7.5 0 1 1 -15 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
      inner = eyeWhite(L, cy, rx, ry) + eyeWhite(R, cy, rx, ry) + spiral(L) + spiral(R);
      break;
    }
    case 'love': {
      const heart = (cx: number): string =>
        `<path d="M${cx} ${cy + 8} C${cx - 13} ${cy - 1} ${cx - 8} ${cy - 12} ${cx} ${cy - 5} C${cx + 8} ${cy - 12} ${cx + 13} ${cy - 1} ${cx} ${cy + 8} Z" fill="#ff4f8b" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${cx - 4}" cy="${cy - 4}" r="2" fill="#fff"/>`;
      inner = heart(L) + heart(R);
      break;
    }
    case 'determined':
      inner =
        eyeWhite(L, cy + 2, rx, ry - 1) +
        eyeWhite(R, cy + 2, rx, ry - 1) +
        pupil(L + 2.5, cy + 3, 6) +
        pupil(R + 2.5, cy + 3, 6) +
        `<path d="M${L - 11} ${cy - 12} L${L + 9} ${cy - 6}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M${R + 11} ${cy - 12} L${R - 9} ${cy - 6}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
      break;
    case 'sad':
      inner =
        eyeWhite(L, cy + 3, rx - 1, ry - 2) +
        eyeWhite(R, cy + 3, rx - 1, ry - 2) +
        pupil(L, cy + 5, 5.5) +
        pupil(R, cy + 5, 5.5) +
        `<path d="M${L - 10} ${cy - 6} L${L + 8} ${cy - 11}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M${R + 10} ${cy - 6} L${R - 8} ${cy - 11}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M${R + 9} ${cy + 10} q3 6 0 9 q-3 -3 0 -9 z" fill="#8fd3ff" stroke="${INK}" stroke-width="1.4"/>`;
      break;
  }
  return svg(72, 40, inner);
}

/** Bocas en un lienzo de 40 × 28, centradas en (20, 14). */
export function mouthSvg(variant: MouthVariant): string {
  let inner = '';
  switch (variant) {
    case 'smile':
      inner = `<path d="M10 11 Q20 21 30 11" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      break;
    case 'grin':
      inner = `<path d="M8 8 Q20 8 32 8 Q31 24 20 24 Q9 24 8 8 Z" fill="${INK}"/><path d="M13 19 Q20 15 27 19 Q24 23 20 23 Q16 23 13 19 Z" fill="#ff7d9a"/><path d="M10 8.5 L30 8.5 L29 11.5 L11 11.5 Z" fill="#fff"/>`;
      break;
    case 'open':
      inner = `<ellipse cx="20" cy="15" rx="6.5" ry="7" fill="${INK}"/><ellipse cx="20" cy="18.5" rx="4" ry="2.6" fill="#ff7d9a"/>`;
      break;
    case 'wow':
      inner = `<ellipse cx="20" cy="15" rx="8.5" ry="10" fill="${INK}"/><ellipse cx="20" cy="19.5" rx="5" ry="3.4" fill="#ff7d9a"/>`;
      break;
    case 'sad':
      inner = `<path d="M11 19 Q20 9 29 19" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      break;
    case 'kiss':
      inner = `<path d="M17 8 Q24 9 21 13 Q25 16 18 20" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 6 c-2 -3 -6 -1 -4 2 l4 4 4 -4 c2 -3 -2 -5 -4 -2 z" fill="#ff4f8b"/>`;
      break;
    case 'flat':
      inner = `<path d="M12 14 L28 14" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      break;
    case 'tongue':
      inner = `<path d="M10 10 Q20 19 30 10" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M20 15 Q21 24 26 22 Q29 19 26 13 Z" fill="#ff7d9a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
      break;
  }
  return svg(40, 28, inner);
}

export function blushSvg(): string {
  return svg(
    88,
    20,
    `<ellipse cx="14" cy="10" rx="11" ry="6" fill="#ff5f8f" opacity="0.55"/><ellipse cx="74" cy="10" rx="11" ry="6" fill="#ff5f8f" opacity="0.55"/>`,
  );
}

export function shadowSvg(): string {
  return svg(96, 24, `<ellipse cx="48" cy="12" rx="44" ry="10" fill="#1a0b30" opacity="0.32"/>`);
}

/** Retrato completo para la interfaz (React), con accesorio y expresión. */
export function portraitSvg(
  character: CharacterId,
  skin: number,
  accessory: AccessoryId,
  eyes: EyeVariant = 'open',
  mouth: MouthVariant = 'smile',
  blush = false,
): string {
  const rig = RIG[character];
  const strip = (s: string): string => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const place = (s: string, x: number, y: number, w: number, h: number, extra = ''): string =>
    `<svg x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" ${extra}>${strip(s)}</svg>`;
  const parts = [
    `<ellipse cx="64" cy="121" rx="38" ry="7" fill="#1a0b30" opacity="0.28"/>`,
    place(armSvg(character, skin), rig.armL.x, rig.armL.y, 32, 40),
    place(footSvg(character, skin), rig.footL.x, rig.footL.y, 40, 24),
    place(footSvg(character, skin), rig.footR.x, rig.footR.y, 40, 24),
    place(topSvg(character, skin), rig.top.x, rig.top.y, 48, 48),
    strip(bodySvg(character, skin)),
    place(eyesSvg(eyes, character), rig.eyes.x, rig.eyes.y, 72, 40),
    place(mouthSvg(mouth), rig.mouth.x, rig.mouth.y, 40, 28),
    blush ? place(blushSvg(), rig.blush.x, rig.blush.y, 88, 20) : '',
    place(armSvg(character, skin), rig.armR.x, rig.armR.y, 32, 40),
    accessory !== 'none' ? accessorySvgInner(accessory, character) : '',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -10 140 140" role="img">${parts.join('')}</svg>`;
}
