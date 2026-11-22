import { INK } from './palette';

/**
 * Utilería original (obstáculos, ítems, decoración, mecanismos, efectos).
 * Cada entrada: clave de textura, SVG y tamaño de diseño en unidades de mundo.
 */
export interface ArtEntry {
  key: string;
  w: number;
  h: number;
  svg: string;
}

const L = INK;
const S = (w: number, h: number, inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const e = (key: string, w: number, h: number, inner: string): ArtEntry => ({ key, w, h, svg: S(w, h, inner) });

const heartPath = (cx: number, cy: number, s: number): string =>
  `M${cx} ${cy + 9 * s} C${cx - 15 * s} ${cy - 1 * s} ${cx - 9 * s} ${cy - 13 * s} ${cx} ${cy - 5 * s} C${cx + 9 * s} ${cy - 13 * s} ${cx + 15 * s} ${cy - 1 * s} ${cx} ${cy + 9 * s} Z`;

const star4 = (cx: number, cy: number, r: number): string =>
  `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;

function urchin(): string {
  let spikes = '';
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 - Math.PI / 2;
    if (Math.sin(a) > 0.55) continue;
    const x1 = 20 + Math.cos(a) * 11;
    const y1 = 22 + Math.sin(a) * 9;
    const x2 = 20 + Math.cos(a) * 19;
    const y2 = 22 + Math.sin(a) * 17;
    const px = Math.cos(a + Math.PI / 2) * 3;
    const py = Math.sin(a + Math.PI / 2) * 3;
    spikes += `<path d="M${x1 - px} ${y1 - py} L${x2} ${y2} L${x1 + px} ${y1 + py} Z" fill="#7d4bd6" stroke="${L}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  return `${spikes}<ellipse cx="20" cy="26" rx="15" ry="10" fill="#9a63f0" stroke="${L}" stroke-width="2.6"/>
  <ellipse cx="15" cy="22" rx="5" ry="2.5" fill="#fff" opacity="0.4"/>
  <path d="M10 23 L17 26 M30 23 L23 26" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="15" cy="28" r="2.3" fill="${L}"/><circle cx="25" cy="28" r="2.3" fill="${L}"/>`;
}

function crab(): string {
  return `<path d="M8 22 C2 14 6 4 14 8 L10 14 L16 12 C14 18 12 20 8 22 Z" fill="#ff5d4a" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M44 22 C50 14 46 4 38 8 L42 14 L36 12 C38 18 40 20 44 22 Z" fill="#ff5d4a" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M10 34 L4 38 M14 35 L10 38 M42 34 L48 38 M38 35 L42 38" stroke="${L}" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="26" cy="28" rx="17" ry="9" fill="#ff7a59" stroke="${L}" stroke-width="2.6"/>
  <path d="M21 19 L21 14 M31 19 L31 14" stroke="${L}" stroke-width="2.4"/>
  <circle cx="21" cy="12" r="3.6" fill="#fff" stroke="${L}" stroke-width="2"/><circle cx="31" cy="12" r="3.6" fill="#fff" stroke="${L}" stroke-width="2"/>
  <circle cx="21.6" cy="12.6" r="1.6" fill="${L}"/><circle cx="31.6" cy="12.6" r="1.6" fill="${L}"/>
  <path d="M22 31 Q26 28 30 31" fill="none" stroke="${L}" stroke-width="2" stroke-linecap="round"/>`;
}

function branch(): string {
  let leaves = '';
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 34;
    const flip = i % 2 === 0;
    leaves += `<path d="M${x} 30 C${x - 10} ${flip ? 48 : 46} ${x + 4} ${flip ? 66 : 60} ${x + 12} ${flip ? 70 : 62} C${x + 14} ${flip ? 52 : 48} ${x + 8} 38 ${x} 30 Z" fill="${i % 3 === 0 ? '#3fae5b' : '#58c46a'}" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return `<path d="M0 24 C60 18 120 34 180 26 C230 20 280 30 320 22 L320 36 C280 44 230 34 180 40 C120 48 60 32 0 38 Z" fill="#8a5a3c" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M10 28 C70 24 130 36 190 30" fill="none" stroke="#b07a52" stroke-width="3" stroke-linecap="round"/>${leaves}`;
}

function gull(up: boolean): string {
  const wing = up
    ? `<path d="M30 30 C22 10 10 4 2 6 C12 14 18 24 24 34 Z" fill="#f4f6ff" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/><path d="M46 30 C54 10 66 4 74 6 C64 14 58 24 52 34 Z" fill="#e3e8ff" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`
    : `<path d="M30 30 C20 38 8 44 0 40 C10 36 18 30 26 26 Z" fill="#f4f6ff" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/><path d="M46 30 C56 38 68 44 76 40 C66 36 58 30 50 26 Z" fill="#e3e8ff" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`;
  return `${wing}<ellipse cx="38" cy="32" rx="16" ry="10" fill="#fff" stroke="${L}" stroke-width="2.6"/>
  <circle cx="50" cy="26" r="8" fill="#fff" stroke="${L}" stroke-width="2.6"/>
  <path d="M56 26 L66 28 L56 31 Z" fill="#ffb52e" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="51" cy="24.5" r="2" fill="${L}"/><path d="M47 21 L54 22" stroke="${L}" stroke-width="2" stroke-linecap="round"/>`;
}

function itemIcon(kind: 'turbo' | 'peel' | 'cloud' | 'kiss' | 'shield' | 'unknown'): string {
  const bg = `<circle cx="24" cy="24" r="22" fill="#2b1650" opacity="0.0"/>`;
  switch (kind) {
    case 'turbo':
      return `${bg}<path d="M27 3 L10 27 L22 27 L18 45 L38 18 L25 18 Z" fill="#ffd25e" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M25 9 L16 22" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`;
    case 'peel':
      return `${bg}<path d="M24 12 C30 12 34 18 34 26 C40 30 44 38 40 42 C36 38 32 36 28 38 C26 44 18 44 16 40 C20 38 20 34 18 32 C12 34 6 32 6 28 C12 26 16 24 16 20 C16 15 19 12 24 12 Z" fill="#ffb52e" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><path d="M22 18 C26 20 28 26 26 30" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/><path d="M24 12 L26 5" stroke="#3fae5b" stroke-width="3" stroke-linecap="round"/>`;
    case 'cloud':
      return `${bg}<path d="M12 32 C4 32 4 22 12 22 C12 12 26 10 28 18 C32 12 44 16 40 24 C46 26 44 34 38 34 Z" fill="#8e98b8" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 23 L22 26 M34 23 L28 26" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/><path d="M20 30 Q25 27 30 30" fill="none" stroke="${L}" stroke-width="2.2" stroke-linecap="round"/><path d="M16 38 l-2 6 M26 38 l-2 6 M36 38 l-2 6" stroke="#6fc8ff" stroke-width="3" stroke-linecap="round"/>`;
    case 'kiss':
      return `${bg}<path d="${heartPath(24, 22, 1.25)}" fill="#ff4f8b" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><path d="M15 25 Q24 19 33 25 Q24 33 15 25 Z" fill="#c21f5e" stroke="${L}" stroke-width="2" stroke-linejoin="round"/><path d="M15 25 Q24 27 33 25" fill="none" stroke="${L}" stroke-width="1.8"/><path d="M38 8 l3 -4 M42 14 l5 -1" stroke="#ffd25e" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'shield':
      return `${bg}<circle cx="24" cy="24" r="19" fill="#9cefe0" fill-opacity="0.35" stroke="#5ed6c0" stroke-width="3"/><path d="${heartPath(24, 24, 1.05)}" fill="#ff6f9f" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="16" cy="14" rx="5" ry="2.6" fill="#fff" opacity="0.7" transform="rotate(-30 16 14)"/>`;
    default:
      return `${bg}<rect x="8" y="8" width="32" height="32" rx="8" fill="#ff6f9f" stroke="${L}" stroke-width="3"/><path d="M19 19 Q19 13 24 13 Q30 13 30 19 Q30 23 25 25 L25 28" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><circle cx="25" cy="34" r="2.4" fill="#fff"/>`;
  }
}

function palm(): string {
  const frond = (rot: number, color: string): string =>
    `<path d="M60 52 C80 40 104 42 116 56 C100 52 84 54 70 62 Z" fill="${color}" stroke="${L}" stroke-width="2.4" stroke-linejoin="round" transform="rotate(${rot} 60 56)"/>`;
  return `<path d="M56 198 C52 150 58 100 62 56 L70 58 C68 100 66 150 70 198 Z" fill="#a8744c" stroke="${L}" stroke-width="2.8"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${55 + (i % 2)} ${190 - i * 20} L${71} ${186 - i * 20}" stroke="#7d5232" stroke-width="2"/>`).join('')}
  ${frond(-150, '#2f9e55')}${frond(-110, '#3fb865')}${frond(-40, '#3fb865')}${frond(0, '#2f9e55')}${frond(-75, '#4cc873')}${frond(30, '#4cc873')}
  <circle cx="58" cy="62" r="6" fill="#7a4a24" stroke="${L}" stroke-width="2"/><circle cx="67" cy="64" r="6" fill="#8a5a30" stroke="${L}" stroke-width="2"/>`;
}

function tree(): string {
  return `<path d="M62 198 C60 160 64 130 66 110 L76 110 C76 130 80 160 80 198 Z" fill="#8a5a3c" stroke="${L}" stroke-width="2.8"/>
  <circle cx="70" cy="76" r="44" fill="#2f9e55" stroke="${L}" stroke-width="3"/>
  <circle cx="42" cy="96" r="28" fill="#3fb865" stroke="${L}" stroke-width="3"/>
  <circle cx="100" cy="94" r="30" fill="#3fb865" stroke="${L}" stroke-width="3"/>
  <circle cx="74" cy="44" r="26" fill="#4cc873" stroke="${L}" stroke-width="3"/>
  <circle cx="60" cy="64" r="5" fill="#ff6f9f"/><circle cx="96" cy="80" r="5" fill="#ffd25e"/><circle cx="44" cy="92" r="4" fill="#ff6f9f"/>`;
}

function sign(icon: 'jump' | 'slide' | 'spring'): string {
  const ic =
    icon === 'jump'
      ? `<path d="M28 34 L28 18 M20 25 L28 17 L36 25" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
      : icon === 'slide'
        ? `<path d="M16 22 L28 32 L40 22" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 36 L42 36" stroke="${L}" stroke-width="4" stroke-linecap="round"/>`
        : `<path d="M18 36 Q28 28 38 36" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/><path d="M28 30 L28 14 M22 19 L28 13 L34 19" fill="none" stroke="${L}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<rect x="25" y="40" width="6" height="30" fill="#8a5a3c" stroke="${L}" stroke-width="2"/>
  <rect x="4" y="6" width="48" height="38" rx="8" fill="#e8b57c" stroke="${L}" stroke-width="3"/>
  <rect x="8" y="10" width="40" height="30" rx="6" fill="#f6d39c"/>${ic}`;
}

export function propEntries(): ArtEntry[] {
  return [
    // ── Carrera ──
    e('urchin', 40, 36, urchin()),
    e('crab', 52, 40, crab()),
    e('branch', 320, 80, branch()),
    e('gull1', 76, 50, gull(true)),
    e('gull2', 76, 50, gull(false)),
    e(
      'spikes',
      32,
      24,
      `<path d="M0 24 L5 4 L10 24 Z M11 24 L16 0 L21 24 Z M22 24 L27 6 L32 24 Z" fill="#c7d2ff" stroke="${L}" stroke-width="2" stroke-linejoin="round"/><path d="M15 6 L16 2" stroke="#fff" stroke-width="2"/>`,
    ),
    e(
      'spring',
      60,
      34,
      `<rect x="24" y="18" width="12" height="16" fill="#f6e2c2" stroke="${L}" stroke-width="2.4"/><path d="M4 22 C4 4 56 4 56 22 Z" fill="#ff5d6c" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><circle cx="18" cy="13" r="4" fill="#fff"/><circle cx="34" cy="10" r="3" fill="#fff"/><circle cx="45" cy="16" r="3.4" fill="#fff"/>`,
    ),
    e(
      'boost',
      120,
      40,
      `<rect x="2" y="26" width="116" height="12" rx="6" fill="#2b1650" opacity="0.5"/>${[0, 1, 2]
        .map((i) => `<path d="M${14 + i * 34} 8 L${36 + i * 34} 22 L${14 + i * 34} 36 L${22 + i * 34} 22 Z" fill="#ffd25e" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`)
        .join('')}`,
    ),
    e(
      'mud',
      64,
      24,
      `<path d="M0 10 Q16 4 32 9 Q48 14 64 8 L64 24 L0 24 Z" fill="#7a4a2c"/><path d="M0 10 Q16 4 32 9 Q48 14 64 8" fill="none" stroke="#9a6440" stroke-width="3"/><circle cx="18" cy="15" r="3" fill="#9a6440"/><circle cx="46" cy="17" r="2" fill="#9a6440"/>`,
    ),
    e(
      'box',
      56,
      56,
      `<rect x="4" y="4" width="48" height="48" rx="10" fill="#ff6f9f" stroke="${L}" stroke-width="3.4"/><rect x="9" y="9" width="38" height="38" rx="7" fill="#ff93b8"/><path d="M4 18 L52 18 M4 38 L52 38" stroke="${L}" stroke-width="2" opacity="0.25"/><path d="M21 22 Q21 14 28 14 Q36 14 36 22 Q36 27 29 30 L29 33" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/><circle cx="29" cy="40" r="3" fill="#fff"/><path d="${star4(46, 10, 7)}" fill="#ffd25e" stroke="${L}" stroke-width="1.6"/>`,
    ),
    e(
      'heart',
      34,
      32,
      `<path d="${heartPath(17, 15, 1.3)}" fill="#ff4f8b" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="11" cy="9" rx="4" ry="2.4" fill="#fff" opacity="0.75" transform="rotate(-30 11 9)"/>`,
    ),
    e(
      'trap',
      48,
      22,
      `<path d="M24 4 C32 4 38 8 40 14 C46 14 48 20 44 20 L4 20 C0 20 2 14 8 14 C10 8 16 4 24 4 Z" fill="#ffb52e" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 14 C20 10 28 10 34 14" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/><path d="M24 4 L27 0" stroke="#3fae5b" stroke-width="3" stroke-linecap="round"/>`,
    ),
    e(
      'totem',
      54,
      116,
      `<rect x="10" y="12" width="34" height="100" rx="6" fill="#b07a52" stroke="${L}" stroke-width="3"/><rect x="6" y="6" width="42" height="18" rx="6" fill="#ff7a59" stroke="${L}" stroke-width="3"/><circle cx="20" cy="44" r="5" fill="#fff6e8" stroke="${L}" stroke-width="2"/><circle cx="34" cy="44" r="5" fill="#fff6e8" stroke="${L}" stroke-width="2"/><circle cx="20" cy="45" r="2" fill="${L}"/><circle cx="34" cy="45" r="2" fill="${L}"/><path d="M18 60 Q27 70 36 60" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/><path d="M14 84 L40 84 M14 96 L40 96" stroke="#7d5232" stroke-width="3"/>`,
    ),
    e(
      'flagpost',
      44,
      90,
      `<rect x="6" y="6" width="5" height="84" fill="#7d5232" stroke="${L}" stroke-width="2"/><path d="M11 8 L42 18 L11 30 Z" fill="#5ed6c0" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`,
    ),
    e(
      'finish',
      300,
      230,
      `<rect x="14" y="40" width="18" height="190" rx="6" fill="#f6e2c2" stroke="${L}" stroke-width="3"/><rect x="268" y="40" width="18" height="190" rx="6" fill="#f6e2c2" stroke="${L}" stroke-width="3"/>
      <path d="M8 40 Q150 0 292 40 L292 86 Q150 46 8 86 Z" fill="#ff7a59" stroke="${L}" stroke-width="3.4" stroke-linejoin="round"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${40 + i * 28}" y="${58 - Math.sin((i / 7) * Math.PI) * 18}" width="14" height="14" fill="${i % 2 ? '#fff' : L}" opacity="0.9"/>`).join('')}
      <path d="${heartPath(30, 22, 1.2)}" fill="#ff4f8b" stroke="${L}" stroke-width="2.4"/><path d="${heartPath(270, 22, 1.2)}" fill="#ff4f8b" stroke="${L}" stroke-width="2.4"/>
      <path d="M30 32 Q26 50 30 60 M270 32 Q274 50 270 60" fill="none" stroke="${L}" stroke-width="1.6"/>`,
    ),
    e(
      'startline',
      24,
      12,
      `<rect width="12" height="6" fill="#fff"/><rect x="12" width="12" height="6" fill="${L}"/><rect y="6" width="12" height="6" fill="${L}"/><rect x="12" y="6" width="12" height="6" fill="#fff"/>`,
    ),
    // ── Ítems ──
    e('item_turbo', 48, 48, itemIcon('turbo')),
    e('item_peel', 48, 48, itemIcon('peel')),
    e('item_cloud', 48, 48, itemIcon('cloud')),
    e('item_kiss', 48, 48, itemIcon('kiss')),
    e('item_shield', 48, 48, itemIcon('shield')),
    e('item_unknown', 48, 48, itemIcon('unknown')),
    e(
      'raincloud',
      110,
      64,
      `<path d="M22 54 C6 54 4 34 20 32 C20 12 46 6 54 22 C62 8 90 12 88 32 C104 32 106 54 88 54 Z" fill="#7d86a8" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M38 34 L48 39 M72 34 L62 39" stroke="${L}" stroke-width="3" stroke-linecap="round"/><path d="M46 48 Q55 42 64 48" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/><ellipse cx="40" cy="22" rx="10" ry="4" fill="#fff" opacity="0.3"/>`,
    ),
    e('raindrop', 8, 14, `<path d="M4 0 C6 5 8 8 8 10 A4 4 0 0 1 0 10 C0 8 2 5 4 0 Z" fill="#6fc8ff"/>`),
    e(
      'kissproj',
      44,
      36,
      `<path d="${heartPath(22, 17, 1.35)}" fill="#ff4f8b" stroke="${L}" stroke-width="2.6"/><path d="M12 20 Q22 13 32 20 Q22 28 12 20 Z" fill="#c21f5e" stroke="${L}" stroke-width="2"/><ellipse cx="15" cy="10" rx="4" ry="2" fill="#fff" opacity="0.7"/>`,
    ),
    e(
      'bubble',
      120,
      120,
      `<circle cx="60" cy="60" r="54" fill="#9cefe0" fill-opacity="0.16" stroke="#5ed6c0" stroke-width="5" stroke-opacity="0.85"/><path d="M28 30 Q38 18 52 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.7"/><path d="${heartPath(96, 92, 0.7)}" fill="#ff6f9f" opacity="0.9"/>`,
    ),
    // ── Decoración ──
    e('palm', 120, 200, palm()),
    e('tree', 140, 200, tree()),
    e(
      'shell',
      34,
      24,
      `<path d="M17 2 C30 2 34 14 32 22 L2 22 C0 14 4 2 17 2 Z" fill="#ffd3c2" stroke="${L}" stroke-width="2.2" stroke-linejoin="round"/><path d="M17 4 L17 22 M10 6 L8 22 M24 6 L26 22" stroke="#e8a48c" stroke-width="2"/>`,
    ),
    e(
      'flower',
      40,
      44,
      `<path d="M20 44 L20 22" stroke="#3fae5b" stroke-width="3"/><path d="M20 34 C12 30 8 34 10 38 C14 38 18 36 20 34 Z" fill="#3fae5b"/>${[0, 72, 144, 216, 288]
        .map((a) => `<ellipse cx="20" cy="10" rx="5.5" ry="8" fill="#ffd25e" stroke="${L}" stroke-width="1.8" transform="rotate(${a} 20 18)"/>`)
        .join('')}<circle cx="20" cy="18" r="5" fill="#ff7a59" stroke="${L}" stroke-width="1.8"/>`,
    ),
    e(
      'fern',
      90,
      64,
      `${[-60, -30, 0, 30, 60]
        .map((a, i) => `<path d="M45 64 C40 40 44 20 45 6 C50 22 52 42 45 64 Z" fill="${i % 2 ? '#3fb865' : '#2f9e55'}" stroke="${L}" stroke-width="2" transform="rotate(${a} 45 64)"/>`)
        .join('')}`,
    ),
    e(
      'rock',
      70,
      44,
      `<path d="M6 44 C2 30 10 14 26 10 C38 4 56 10 62 22 C68 30 66 40 62 44 Z" fill="#8c8aa8" stroke="${L}" stroke-width="2.8" stroke-linejoin="round"/><path d="M18 20 C24 16 32 14 38 16" fill="none" stroke="#b7b5d0" stroke-width="3" stroke-linecap="round"/>`,
    ),
    e(
      'flag',
      44,
      90,
      `<rect x="6" y="6" width="5" height="84" fill="#7d5232" stroke="${L}" stroke-width="2"/><path d="M11 8 C22 2 30 16 42 10 L42 30 C30 36 22 22 11 28 Z" fill="#ff6f9f" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`,
    ),
    e(
      'torch',
      30,
      92,
      `<rect x="12" y="30" width="6" height="62" fill="#7d5232" stroke="${L}" stroke-width="2"/><path d="M6 30 L24 30 L20 40 L10 40 Z" fill="#5a3a24" stroke="${L}" stroke-width="2"/><path d="M15 2 C24 12 24 22 15 28 C6 22 6 12 15 2 Z" fill="#ffb52e" stroke="${L}" stroke-width="2"/><path d="M15 12 C19 17 19 22 15 25 C11 22 11 17 15 12 Z" fill="#fff3b0"/>`,
    ),
    e(
      'lavarock',
      80,
      50,
      `<path d="M4 50 C0 34 14 16 30 14 C42 6 62 12 70 26 C78 36 76 46 72 50 Z" fill="#4a3a5c" stroke="${L}" stroke-width="2.8" stroke-linejoin="round"/><path d="M22 30 L30 36 L26 44 M48 24 L56 32 L64 30" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
    e('sign_jump', 56, 70, sign('jump')),
    e('sign_slide', 56, 70, sign('slide')),
    e('sign_spring', 56, 70, sign('spring')),
    // ── Efectos ──
    e('dust', 28, 28, `<circle cx="14" cy="14" r="11" fill="#fff6e8" opacity="0.85"/><circle cx="10" cy="11" r="4" fill="#fff" opacity="0.8"/>`),
    e('spark', 24, 24, `<path d="${star4(12, 12, 11)}" fill="#fff3b0"/><circle cx="12" cy="12" r="3" fill="#fff"/>`),
    e('pheart', 20, 18, `<path d="${heartPath(10, 8, 0.85)}" fill="#ff4f8b" stroke="${L}" stroke-width="1.4"/>`),
    e('confetti', 12, 7, `<rect width="12" height="7" rx="1.5" fill="#fff"/>`),
    e('star', 24, 24, `<path d="M12 1 L15 8.5 L23 9 L17 14.5 L19 22.5 L12 18 L5 22.5 L7 14.5 L1 9 L9 8.5 Z" fill="#ffd25e" stroke="${L}" stroke-width="1.6" stroke-linejoin="round"/>`),
    e('drop', 12, 16, `<path d="M6 0 C9 6 12 9 12 11 A6 6 0 0 1 0 11 C0 9 3 6 6 0 Z" fill="#8fd3ff" stroke="${L}" stroke-width="1.2"/>`),
    e(
      'glow',
      64,
      64,
      `<defs><radialGradient id="gl"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="32" fill="url(#gl)"/>`,
    ),
    e('ring', 64, 64, `<circle cx="32" cy="32" r="27" fill="none" stroke="#fff" stroke-width="6"/>`),
    e(
      'speedline',
      80,
      6,
      `<defs><linearGradient id="sl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.8"/></linearGradient></defs><rect width="80" height="6" rx="3" fill="url(#sl)"/>`,
    ),
  ];
}
