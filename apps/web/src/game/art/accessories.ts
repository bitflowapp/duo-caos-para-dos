import type { AccessoryId, CharacterId } from '@duo/shared';
import { INK } from './palette';

/**
 * Accesorios cosméticos desbloqueables. Cada uno se dibuja en un lienzo de
 * 64 × 48 y se ubica respecto del ancla de cabeza (o de ojos) del personaje.
 */

const L = INK;

const SHAPES: Record<Exclude<AccessoryId, 'none'>, string> = {
  flower: `<g transform="translate(32 24)">
      ${[0, 72, 144, 216, 288]
        .map((a) => `<ellipse cx="0" cy="-10" rx="7.5" ry="11" fill="#ff6f9f" stroke="${L}" stroke-width="2.4" transform="rotate(${a})"/>`)
        .join('')}
      <circle r="6" fill="#ffd25e" stroke="${L}" stroke-width="2.4"/>
      <circle cx="-2" cy="-2" r="2" fill="#fff" opacity="0.8"/>
    </g>`,
  party: `<path d="M32 2 L48 44 Q32 50 16 44 Z" fill="#5ed6c0" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 24 L40 20 M20 34 L44 30" stroke="#ff6f9f" stroke-width="4" stroke-linecap="round"/>
    <circle cx="32" cy="4" r="6" fill="#ffd25e" stroke="${L}" stroke-width="2.6"/>`,
  bandana: `<path d="M6 34 Q32 14 58 34 L56 42 Q32 30 8 42 Z" fill="#e63e4f" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="22" cy="31" r="2.4" fill="#fff"/><circle cx="34" cy="27" r="2.4" fill="#fff"/><circle cx="46" cy="31" r="2.4" fill="#fff"/>
    <path d="M56 38 L64 32 L62 44 Z M56 38 L63 46 L54 46 Z" fill="#e63e4f" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`,
  glasses: `<path d="M18 30 C6 22 9 10 18 16 C27 10 30 22 18 30 Z" fill="#ff4f8b" fill-opacity="0.55" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M46 30 C34 22 37 10 46 16 C55 10 58 22 46 30 Z" fill="#ff4f8b" fill-opacity="0.55" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M27 17 Q32 13 37 17" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/>
    <path d="M14 15 l3 -2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M42 15 l3 -2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  crown: `<path d="M12 40 L8 14 L22 26 L32 8 L42 26 L56 14 L52 40 Z" fill="#ffd25e" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="12" y="36" width="40" height="8" rx="3" fill="#f5b83c" stroke="${L}" stroke-width="3"/>
    <circle cx="32" cy="28" r="4" fill="#ff4f8b" stroke="${L}" stroke-width="2"/><circle cx="20" cy="33" r="2.6" fill="#5ed6c0"/><circle cx="44" cy="33" r="2.6" fill="#9d8cff"/>`,
  chef: `<path d="M14 44 L14 30 C4 30 4 14 16 16 C16 4 32 2 34 12 C40 4 56 8 50 20 C60 22 58 34 50 32 L50 44 Z" fill="#fffaf2" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 38 L50 38" stroke="${L}" stroke-width="2.4"/><path d="M24 30 L24 38 M32 28 L32 38 M40 30 L40 38" stroke="#e8dccb" stroke-width="2.4"/>`,
  beanie: `<path d="M8 42 Q8 12 32 12 Q56 12 56 42 Z" fill="#5ed6c0" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="6" y="36" width="52" height="10" rx="5" fill="#2fa394" stroke="${L}" stroke-width="3"/>
    <path d="M20 18 L20 36 M32 14 L32 36 M44 18 L44 36" stroke="#2fa394" stroke-width="2.6"/>
    <circle cx="32" cy="9" r="7" fill="#ff6f9f" stroke="${L}" stroke-width="2.6"/>`,
  halo: `<ellipse cx="32" cy="24" rx="22" ry="7" fill="none" stroke="#7a5a12" stroke-width="7"/>
    <ellipse cx="32" cy="24" rx="22" ry="7" fill="none" stroke="#ffe27a" stroke-width="4"/>
    <ellipse cx="24" cy="20" rx="5" ry="1.6" fill="#fff" opacity="0.8"/>`,
};

/** Dónde va cada accesorio (centro del lienzo 64×48) en unidades de diseño del cuerpo. */
export function accessoryAnchor(id: AccessoryId, character: CharacterId): { x: number; y: number; scale: number; rot: number } {
  const head = character === 'chispa' ? { x: 64, y: 34 } : { x: 62, y: 38 };
  switch (id) {
    case 'flower':
      return { x: head.x + 30, y: head.y + 10, scale: 0.8, rot: 12 };
    case 'glasses':
      return character === 'chispa' ? { x: 64, y: 74, scale: 1.12, rot: 0 } : { x: 64, y: 76, scale: 1.08, rot: 0 };
    case 'bandana':
      return { x: head.x, y: head.y + 12, scale: 1.18, rot: 0 };
    case 'halo':
      return { x: head.x + 2, y: head.y - 18, scale: 1, rot: -4 };
    case 'party':
      return { x: head.x - 12, y: head.y - 8, scale: 0.92, rot: -14 };
    case 'chef':
      return { x: head.x, y: head.y - 4, scale: 1, rot: 0 };
    default:
      return { x: head.x, y: head.y - 2, scale: 0.95, rot: 0 };
  }
}

export function accessorySvg(id: Exclude<AccessoryId, 'none'>): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48" overflow="visible">${SHAPES[id]}</svg>`;
}

/** Para componer en el retrato SVG (coordenadas del cuerpo 128×128). */
export function accessorySvgInner(id: AccessoryId, character: CharacterId): string {
  if (id === 'none') return '';
  const a = accessoryAnchor(id, character);
  return `<g transform="translate(${a.x} ${a.y}) rotate(${a.rot}) scale(${a.scale}) translate(-32 -24)">${SHAPES[id]}</g>`;
}

/** Ícono para el selector de accesorios. */
export function accessoryIconSvg(id: AccessoryId): string {
  if (id === 'none') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><circle cx="32" cy="24" r="15" fill="none" stroke="#fff6e8" stroke-opacity="0.5" stroke-width="4"/><path d="M21 35 L43 13" stroke="#fff6e8" stroke-opacity="0.5" stroke-width="4" stroke-linecap="round"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 72 56">${SHAPES[id]}</svg>`;
}
