import type { RaceTheme } from '@duo/shared';
import { INK } from './palette';
import type { ArtEntry } from './props';

/**
 * Escenarios originales: capas de parallax repetibles, baldosas por zona,
 * piezas del templo de Sincronizados y del estudio de ¿Cuánto me conocés?
 */

const L = INK;
const S = (w: number, h: number, inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const e = (key: string, w: number, h: number, inner: string): ArtEntry => ({ key, w, h, svg: S(w, h, inner) });

export interface ThemeColors {
  skyTop: number;
  skyBottom: number;
  far: string;
  farShade: string;
  mid: string;
  midShade: string;
  top: string;
  topLight: string;
  fill: string;
  fillDot: string;
  sun: string;
}

export const THEME_COLORS: Record<RaceTheme | 'temple', ThemeColors> = {
  beach: { skyTop: 0x5bc8ff, skyBottom: 0xffd6a5, far: '#7fb6e8', farShade: '#6aa2d8', mid: '#3d9e7a', midShade: '#2f8466', top: '#f7d79c', topLight: '#fff0c8', fill: '#e2a86c', fillDot: '#c98a52', sun: '#fff3b0' },
  jungle: { skyTop: 0x62d6c4, skyBottom: 0xd8f7c8, far: '#5cae8e', farShade: '#4a9a7c', mid: '#2f8a52', midShade: '#226e40', top: '#5fd06e', topLight: '#9cf08a', fill: '#8a5a3c', fillDot: '#6e452c', sun: '#fffbd0' },
  cliffs: { skyTop: 0x5a7dff, skyBottom: 0xc6b8ff, far: '#8a8ee0', farShade: '#7478cc', mid: '#5a5aa8', midShade: '#4a4a92', top: '#9ae07a', topLight: '#c8f5a8', fill: '#7a7296', fillDot: '#5e5878', sun: '#ffe6f0' },
  volcano: { skyTop: 0x3a1d6e, skyBottom: 0xff8a5b, far: '#6a2a5e', farShade: '#561f4c', mid: '#3c1d44', midShade: '#2c1434', top: '#6a4a5c', topLight: '#8a6a7c', fill: '#3a2a3e', fillDot: '#ff8a3d', sun: '#ffd25e' },
  temple: { skyTop: 0x16324a, skyBottom: 0x2a5a5e, far: '#1f4a54', farShade: '#183c46', mid: '#2a5a5e', midShade: '#224c50', top: '#6f9a72', topLight: '#9cc89a', fill: '#5a6a7a', fillDot: '#47566a', sun: '#bff5e8' },
};

/** Silueta repetible: suma de senos con períodos que dividen el ancho. */
function ridge(w: number, h: number, base: number, amps: number[], phase: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 16) {
    let y = base;
    amps.forEach((a, i) => {
      y += a * Math.sin(((x / w) * (i + 1) * 2 + phase * (i + 1)) * Math.PI);
    });
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M0 ${h} L${pts.join(' L')} L${w} ${h} Z`;
}

function farLayer(theme: RaceTheme): string {
  const c = THEME_COLORS[theme];
  const w = 1024;
  const h = 320;
  if (theme === 'beach') {
    // Islas lejanas sobre el mar
    return `<path d="${ridge(w, h, 230, [26, 18, 10], 0.1)}" fill="${c.farShade}"/><path d="${ridge(w, h, 250, [20, 14, 8], 0.6)}" fill="${c.far}"/>
      <rect y="262" width="${w}" height="58" fill="#4fb3e6"/><path d="M0 262 L${w} 262" stroke="#bfe9ff" stroke-width="3"/>`;
  }
  if (theme === 'volcano') {
    return `<path d="${ridge(w, h, 210, [40, 22, 12], 0.25)}" fill="${c.farShade}"/>
      <path d="M380 320 L470 120 Q500 100 530 120 L620 320 Z" fill="${c.far}" stroke="${c.farShade}" stroke-width="4"/>
      <path d="M470 120 Q500 140 530 120 Q520 160 500 150 Q480 165 470 120 Z" fill="#ff8a3d"/>
      <path d="${ridge(w, h, 250, [18, 12, 8], 0.8)}" fill="${c.far}"/>`;
  }
  return `<path d="${ridge(w, h, 200, [44, 26, 12], 0.2)}" fill="${c.farShade}"/><path d="${ridge(w, h, 236, [30, 20, 10], 0.7)}" fill="${c.far}"/>`;
}

function midLayer(theme: RaceTheme): string {
  const c = THEME_COLORS[theme];
  const w = 1024;
  const h = 280;
  let deco = '';
  const trees = theme === 'volcano' ? 6 : 9;
  for (let i = 0; i < trees; i++) {
    const x = 40 + i * (w / trees) + (i % 3) * 18;
    const top = 120 + ((i * 37) % 50);
    if (theme === 'beach' || theme === 'jungle') {
      deco += `<path d="M${x} 280 Q${x + 6} ${top + 40} ${x + 2} ${top}" fill="none" stroke="${c.midShade}" stroke-width="9"/>`;
      deco += [0, 60, 120, 180, 240, 300]
        .map((a) => `<ellipse cx="${x + 2 + Math.cos((a * Math.PI) / 180) * 26}" cy="${top + Math.sin((a * Math.PI) / 180) * 12}" rx="30" ry="9" fill="${c.mid}" transform="rotate(${a / 3} ${x} ${top})"/>`)
        .join('');
    } else if (theme === 'cliffs') {
      deco += `<path d="M${x - 30} 280 L${x - 10} ${top} L${x + 16} ${top + 10} L${x + 34} 280 Z" fill="${c.midShade}"/>`;
    } else {
      deco += `<path d="M${x - 24} 280 L${x - 6} ${top + 30} L${x + 12} ${top + 50} L${x + 28} 280 Z" fill="${c.midShade}"/><circle cx="${x}" cy="${top + 20}" r="5" fill="#ff8a3d" opacity="0.7"/>`;
    }
  }
  return `${deco}<path d="${ridge(w, h, 228, [16, 10, 6], 0.4)}" fill="${c.mid}"/>`;
}

function groundTop(theme: RaceTheme): string {
  const c = THEME_COLORS[theme];
  if (theme === 'beach') {
    return `<rect y="6" width="64" height="30" fill="${c.top}"/><path d="M0 8 Q16 2 32 7 Q48 12 64 6 L64 0 L0 0 Z" fill="${c.topLight}"/><path d="M0 8 Q16 2 32 7 Q48 12 64 6" fill="none" stroke="${L}" stroke-width="3"/><circle cx="14" cy="20" r="2" fill="${c.fillDot}"/><circle cx="44" cy="24" r="1.6" fill="${c.fillDot}"/>`;
  }
  if (theme === 'volcano') {
    return `<rect y="6" width="64" height="30" fill="${c.top}"/><path d="M0 8 L10 4 L22 9 L36 3 L50 8 L64 5" fill="none" stroke="${L}" stroke-width="3"/><path d="M8 18 L18 22 L14 30 M40 16 L50 24" fill="none" stroke="#ff8a3d" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<rect y="12" width="64" height="24" fill="${c.fill}"/><path d="M0 16 Q8 26 16 16 Q24 26 32 16 Q40 26 48 16 Q56 26 64 16 L64 4 L0 4 Z" fill="${c.top}"/><path d="M0 4 Q16 0 32 4 Q48 8 64 4" fill="none" stroke="${L}" stroke-width="3"/><path d="M0 16 Q8 26 16 16 Q24 26 32 16 Q40 26 48 16 Q56 26 64 16" fill="none" stroke="${L}" stroke-width="2.4"/><path d="M8 8 L14 6 M40 9 L46 7" stroke="${c.topLight}" stroke-width="2.6" stroke-linecap="round"/>`;
}

function groundFill(theme: RaceTheme): string {
  const c = THEME_COLORS[theme];
  return `<rect width="64" height="64" fill="${c.fill}"/><circle cx="12" cy="14" r="3.2" fill="${c.fillDot}"/><circle cx="44" cy="10" r="2.2" fill="${c.fillDot}"/><circle cx="30" cy="38" r="3.8" fill="${c.fillDot}"/><circle cx="54" cy="50" r="2.6" fill="${c.fillDot}"/><circle cx="8" cy="54" r="2" fill="${c.fillDot}"/>`;
}

const heartPath = (cx: number, cy: number, s: number): string =>
  `M${cx} ${cy + 9 * s} C${cx - 15 * s} ${cy - 1 * s} ${cx - 9 * s} ${cy - 13 * s} ${cx} ${cy - 5 * s} C${cx + 9 * s} ${cy - 13 * s} ${cx + 15 * s} ${cy - 1 * s} ${cx} ${cy + 9 * s} Z`;

const sunIcon = (cx: number, cy: number, r: number, color: string): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${L}" stroke-width="2"/>${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `<path d="M${cx + Math.cos(rad) * (r + 3)} ${cy + Math.sin(rad) * (r + 3)} L${cx + Math.cos(rad) * (r + 8)} ${cy + Math.sin(rad) * (r + 8)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join('')}`;
const moonIcon = (cx: number, cy: number, r: number, color: string): string =>
  `<path d="M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.7} a${r * 0.8} ${r * 0.8} 0 1 1 ${-r * 0.7} ${-r * 1.7} z" fill="${color}" stroke="${L}" stroke-width="2"/>`;

export function environmentEntries(): ArtEntry[] {
  const themes: RaceTheme[] = ['beach', 'jungle', 'cliffs', 'volcano'];
  const out: ArtEntry[] = [];
  for (const t of themes) {
    out.push(e(`far_${t}`, 1024, 320, farLayer(t)));
    out.push(e(`mid_${t}`, 1024, 280, midLayer(t)));
    out.push(e(`gtop_${t}`, 64, 32, `<g transform="scale(1 0.8889)">${groundTop(t)}</g>`));
    out.push(e(`gfill_${t}`, 64, 64, groundFill(t)));
  }
  out.push(
    e(
      'cloud1',
      220,
      90,
      `<path d="M30 80 C6 80 6 52 30 50 C30 22 66 14 80 36 C92 10 140 12 146 42 C170 30 200 48 190 66 C214 70 208 80 196 80 Z" fill="#fff" opacity="0.92"/><path d="M30 80 L196 80" stroke="#e2e6ff" stroke-width="6" stroke-linecap="round"/>`,
    ),
    e(
      'cloud2',
      170,
      70,
      `<path d="M24 62 C4 62 4 40 24 38 C26 16 56 10 66 28 C78 8 116 12 120 36 C142 30 160 46 150 62 Z" fill="#fff" opacity="0.88"/>`,
    ),
    e(
      'sun',
      180,
      180,
      `<defs><radialGradient id="sg"><stop offset="0.35" stop-color="#fff6c8"/><stop offset="0.55" stop-color="#ffe27a" stop-opacity="0.8"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></radialGradient></defs><circle cx="90" cy="90" r="90" fill="url(#sg)"/><circle cx="90" cy="90" r="40" fill="#fff8d6"/>`,
    ),
    e(
      'waves',
      256,
      32,
      `<path d="M0 12 Q32 2 64 12 T128 12 T192 12 T256 12 L256 32 L0 32 Z" fill="#4fb3e6"/><path d="M0 12 Q32 2 64 12 T128 12 T192 12 T256 12" fill="none" stroke="#dff6ff" stroke-width="4"/>`,
    ),
    e(
      'plank',
      64,
      32,
      `<rect x="1" y="3" width="62" height="24" rx="5" fill="#c08a5a" stroke="${L}" stroke-width="2.6"/><path d="M6 11 L58 11" stroke="#e0aa76" stroke-width="2.4" stroke-linecap="round"/><circle cx="8" cy="19" r="2" fill="${L}"/><circle cx="56" cy="19" r="2" fill="${L}"/>`,
    ),
    // ── Templo (Sincronizados) ──
    e(
      't_brick',
      48,
      48,
      `<rect width="48" height="48" fill="#6b7a8c"/><path d="M0 0 H48 V48 H0 Z M0 16 H48 M0 32 H48 M24 0 V16 M12 16 V32 M36 16 V32 M24 32 V48" fill="none" stroke="#4a566a" stroke-width="2.4"/><rect x="2" y="2" width="20" height="4" fill="#8a9aae" opacity="0.6"/>`,
    ),
    e(
      't_bricktop',
      48,
      24,
      `<path d="M0 8 Q8 16 16 8 Q24 16 32 8 Q40 16 48 8 L48 0 L0 0 Z" fill="#6fc07a"/><path d="M0 8 Q8 16 16 8 Q24 16 32 8 Q40 16 48 8" fill="none" stroke="${L}" stroke-width="2"/><path d="M6 3 L12 2 M30 4 L36 3" stroke="#a8e6a0" stroke-width="2" stroke-linecap="round"/>`,
    ),
    e(
      't_wall',
      96,
      96,
      `<rect width="96" height="96" fill="#22404c"/><path d="M0 24 H96 M0 48 H96 M0 72 H96 M24 0 V24 M72 0 V24 M48 24 V48 M0 24 V48 M96 24 V48 M24 48 V72 M72 48 V72 M48 72 V96" fill="none" stroke="#1a323c" stroke-width="3"/>`,
    ),
    e(
      't_plate',
      96,
      14,
      `<rect x="2" y="4" width="92" height="10" rx="4" fill="#8a96a8" stroke="${L}" stroke-width="2.4"/><path d="${heartPath(48, 8, 0.4)}" fill="#46516a"/>`,
    ),
    e(
      't_plate_on',
      96,
      14,
      `<rect x="2" y="7" width="92" height="7" rx="3" fill="#a8f0d8" stroke="${L}" stroke-width="2.4"/><path d="${heartPath(48, 10, 0.4)}" fill="#ff4f8b"/>`,
    ),
    e(
      't_door',
      48,
      192,
      `<rect x="3" y="0" width="42" height="192" rx="4" fill="#9a6a44" stroke="${L}" stroke-width="3"/><path d="M14 0 V192 M34 0 V192" stroke="#7d5232" stroke-width="3"/><rect x="3" y="30" width="42" height="8" fill="#5a5a6e"/><rect x="3" y="154" width="42" height="8" fill="#5a5a6e"/><circle cx="24" cy="96" r="11" fill="#ffd25e" stroke="${L}" stroke-width="2.6"/><path d="${heartPath(24, 95, 0.45)}" fill="#ff4f8b"/>`,
    ),
    e(
      't_gate_warm',
      48,
      48,
      `<defs><linearGradient id="gw" x1="0" x2="1"><stop offset="0" stop-color="#ff7a59" stop-opacity="0.2"/><stop offset="0.5" stop-color="#ffb35a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0.2"/></linearGradient></defs><rect width="48" height="48" fill="url(#gw)"/><path d="M8 0 V48 M24 0 V48 M40 0 V48" stroke="#fff3b0" stroke-width="2" opacity="0.6"/>`,
    ),
    e(
      't_gate_cool',
      48,
      48,
      `<defs><linearGradient id="gc" x1="0" x2="1"><stop offset="0" stop-color="#9d8cff" stop-opacity="0.2"/><stop offset="0.5" stop-color="#7fd8ff" stop-opacity="0.75"/><stop offset="1" stop-color="#9d8cff" stop-opacity="0.2"/></linearGradient></defs><rect width="48" height="48" fill="url(#gc)"/><path d="M8 0 V48 M24 0 V48 M40 0 V48" stroke="#e6f4ff" stroke-width="2" opacity="0.6"/>`,
    ),
    e('icon_sun', 40, 40, sunIcon(20, 20, 9, '#ffd25e')),
    e('icon_moon', 40, 40, moonIcon(18, 20, 12, '#c9bfff')),
    e(
      't_lever_off',
      48,
      56,
      `<rect x="8" y="40" width="32" height="14" rx="4" fill="#5a6a7a" stroke="${L}" stroke-width="2.6"/><path d="M24 44 L10 14" stroke="#8a5a3c" stroke-width="6" stroke-linecap="round"/><circle cx="10" cy="12" r="7" fill="#ff5d6c" stroke="${L}" stroke-width="2.6"/>`,
    ),
    e(
      't_lever_on',
      48,
      56,
      `<rect x="8" y="40" width="32" height="14" rx="4" fill="#5a6a7a" stroke="${L}" stroke-width="2.6"/><path d="M24 44 L38 14" stroke="#8a5a3c" stroke-width="6" stroke-linecap="round"/><circle cx="38" cy="12" r="7" fill="#6fe3a5" stroke="${L}" stroke-width="2.6"/>`,
    ),
    e(
      't_bridge',
      48,
      24,
      `<rect x="1" y="2" width="46" height="20" rx="3" fill="#c08a5a" stroke="${L}" stroke-width="2.4"/><path d="M5 9 L43 9" stroke="#e0aa76" stroke-width="2.2" stroke-linecap="round"/>`,
    ),
    e(
      't_elev',
      144,
      30,
      `<rect x="2" y="2" width="140" height="26" rx="6" fill="#8a96a8" stroke="${L}" stroke-width="3"/><path d="M8 10 H136" stroke="#b0bccc" stroke-width="3" stroke-linecap="round"/><path d="${heartPath(36, 16, 0.45)} ${heartPath(108, 16, 0.45)}" fill="#ff6f9f"/><circle cx="72" cy="16" r="5" fill="#ffd25e" stroke="${L}" stroke-width="2"/>`,
    ),
    e(
      't_console',
      60,
      66,
      `<path d="M12 66 L16 30 L44 30 L48 66 Z" fill="#6b7a8c" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><rect x="6" y="20" width="48" height="14" rx="6" fill="#4a566a" stroke="${L}" stroke-width="3"/><ellipse cx="30" cy="20" rx="16" ry="8" fill="#ff5d6c" stroke="${L}" stroke-width="3"/><ellipse cx="25" cy="17" rx="5" ry="2" fill="#fff" opacity="0.6"/>`,
    ),
    e(
      't_console_on',
      60,
      66,
      `<path d="M12 66 L16 30 L44 30 L48 66 Z" fill="#6b7a8c" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><rect x="6" y="20" width="48" height="14" rx="6" fill="#4a566a" stroke="${L}" stroke-width="3"/><ellipse cx="30" cy="23" rx="16" ry="6" fill="#6fe3a5" stroke="${L}" stroke-width="3"/><ellipse cx="25" cy="21" rx="5" ry="1.6" fill="#fff" opacity="0.7"/>`,
    ),
    e(
      't_heartgate',
      96,
      432,
      `<rect x="4" y="0" width="88" height="432" rx="8" fill="#7a4a8c" stroke="${L}" stroke-width="4"/><rect x="12" y="10" width="72" height="412" rx="6" fill="#9a62ae"/><path d="M48 0 V432" stroke="${L}" stroke-width="3"/><path d="${heartPath(48, 210, 2.6)}" fill="#ff4f8b" stroke="${L}" stroke-width="4"/><path d="${heartPath(48, 210, 1.6)}" fill="#ff93b8"/>${[60, 120, 300, 360]
        .map((y) => `<circle cx="24" cy="${y}" r="5" fill="#ffd25e" stroke="${L}" stroke-width="2"/><circle cx="72" cy="${y}" r="5" fill="#ffd25e" stroke="${L}" stroke-width="2"/>`)
        .join('')}`,
    ),
    e(
      't_portal',
      150,
      150,
      `<defs><radialGradient id="pg"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.45" stop-color="#ff93b8" stop-opacity="0.8"/><stop offset="1" stop-color="#9d8cff" stop-opacity="0"/></radialGradient></defs><circle cx="75" cy="75" r="74" fill="url(#pg)"/><path d="${heartPath(75, 72, 3.2)}" fill="none" stroke="#fff" stroke-width="6" opacity="0.9"/>`,
    ),
    e(
      't_water',
      64,
      32,
      `<path d="M0 10 Q16 2 32 10 T64 10 L64 32 L0 32 Z" fill="#2f8fd0"/><path d="M0 10 Q16 2 32 10 T64 10" fill="none" stroke="#bfe9ff" stroke-width="3"/>`,
    ),
    e(
      't_thorns',
      48,
      24,
      `<path d="M0 24 L6 6 L12 24 Z M12 24 L18 2 L24 24 Z M24 24 L30 8 L36 24 Z M36 24 L42 4 L48 24 Z" fill="#b6f2e6" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>`,
    ),
    e(
      't_vine',
      30,
      150,
      `<path d="M15 0 Q4 30 15 60 Q26 90 15 120 Q8 136 15 150" fill="none" stroke="#3fae5b" stroke-width="4"/>${[20, 50, 80, 110, 136]
        .map((y, i) => `<ellipse cx="${i % 2 ? 22 : 8}" cy="${y}" rx="7" ry="4" fill="#58c46a" stroke="${L}" stroke-width="1.6"/>`)
        .join('')}`,
    ),
    e(
      't_statue',
      80,
      124,
      `<rect x="10" y="100" width="60" height="24" rx="4" fill="#5a6a7a" stroke="${L}" stroke-width="3"/><path d="M18 100 C14 60 20 30 40 22 C60 30 66 60 62 100 Z" fill="#8a96a8" stroke="${L}" stroke-width="3"/><circle cx="40" cy="22" r="16" fill="#8a96a8" stroke="${L}" stroke-width="3"/><path d="M32 22 L36 24 M48 22 L44 24" stroke="${L}" stroke-width="2.6" stroke-linecap="round"/><path d="${heartPath(40, 66, 1.2)}" fill="#ff93b8" stroke="${L}" stroke-width="2"/>`,
    ),
    e(
      't_crystal',
      52,
      72,
      `<path d="M26 4 L40 30 L32 72 L20 72 L12 30 Z" fill="#9cefe0" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 4 L26 72" stroke="#e6fff9" stroke-width="2"/><path d="M10 72 L4 44 L14 40 Z M42 72 L48 46 L38 42 Z" fill="#c9bfff" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>`,
    ),
    e(
      't_banner',
      48,
      104,
      `<rect x="4" y="2" width="40" height="6" rx="3" fill="#8a5a3c" stroke="${L}" stroke-width="2"/><path d="M8 8 H40 V96 L24 84 L8 96 Z" fill="#ff6f9f" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><path d="${heartPath(24, 40, 0.9)}" fill="#ffd25e" stroke="${L}" stroke-width="1.8"/>`,
    ),
    e(
      't_sign',
      60,
      66,
      `<rect x="27" y="36" width="6" height="30" fill="#7d5232" stroke="${L}" stroke-width="2"/><rect x="4" y="4" width="52" height="36" rx="8" fill="#e8b57c" stroke="${L}" stroke-width="3"/><path d="M14 16 H46 M14 26 H38" stroke="#a87a4c" stroke-width="4" stroke-linecap="round"/>`,
    ),
    // ── Estudio del quiz ──
    e(
      'q_podium_a',
      150,
      130,
      `<path d="M10 30 L140 30 L128 130 L22 130 Z" fill="#ff7a59" stroke="${L}" stroke-width="4" stroke-linejoin="round"/><rect x="4" y="16" width="142" height="22" rx="8" fill="#ffd25e" stroke="${L}" stroke-width="4"/><path d="M30 60 H120 M36 90 H114" stroke="#ffb38a" stroke-width="6" stroke-linecap="round"/>${[30, 55, 80, 105, 120]
        .map((x) => `<circle cx="${x}" cy="27" r="3.4" fill="#fff"/>`)
        .join('')}`,
    ),
    e(
      'q_podium_b',
      150,
      130,
      `<path d="M10 30 L140 30 L128 130 L22 130 Z" fill="#9d8cff" stroke="${L}" stroke-width="4" stroke-linejoin="round"/><rect x="4" y="16" width="142" height="22" rx="8" fill="#ffd25e" stroke="${L}" stroke-width="4"/><path d="M30 60 H120 M36 90 H114" stroke="#d4ccff" stroke-width="6" stroke-linecap="round"/>${[30, 55, 80, 105, 120]
        .map((x) => `<circle cx="${x}" cy="27" r="3.4" fill="#fff"/>`)
        .join('')}`,
    ),
    e(
      'q_spot',
      220,
      520,
      `<defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient></defs><path d="M90 0 L130 0 L220 520 L0 520 Z" fill="url(#sp)"/>`,
    ),
    e(
      'q_curtain',
      128,
      512,
      `<rect width="128" height="512" fill="#a8274f"/>${[12, 44, 76, 108].map((x) => `<path d="M${x} 0 Q${x + 12} 256 ${x} 512" fill="none" stroke="#7e1c3c" stroke-width="10"/>`).join('')}`,
    ),
    e('q_bulb', 20, 20, `<circle cx="10" cy="10" r="7" fill="#ffe27a" stroke="${L}" stroke-width="2"/><circle cx="8" cy="8" r="2.4" fill="#fff"/>`),
  );
  return out;
}
