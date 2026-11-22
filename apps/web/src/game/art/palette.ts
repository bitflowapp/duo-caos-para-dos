import type { CharacterId } from '@duo/shared';

export interface SkinPalette {
  base: string;
  light: string;
  dark: string;
  line: string;
  belly: string;
  accentA: string;
  accentB: string;
}

/** Paletas originales de cada apariencia. Índice = skin. */
export const SKINS: Record<CharacterId, readonly SkinPalette[]> = {
  chispa: [
    { base: '#ff7a59', light: '#ffb38a', dark: '#d9483b', line: '#7a2333', belly: '#ffe0c2', accentA: '#ffe45e', accentB: '#ff8a3d' },
    { base: '#ff5d7a', light: '#ff9db0', dark: '#c83355', line: '#6e1836', belly: '#ffdbe2', accentA: '#ffe16b', accentB: '#ff6b6b' },
    { base: '#ff9f1c', light: '#ffd08a', dark: '#d9730d', line: '#7a3a08', belly: '#fff0cf', accentA: '#fff07a', accentB: '#ffb52e' },
    { base: '#f6c445', light: '#ffe7a1', dark: '#c9932a', line: '#6b4810', belly: '#fff8dc', accentA: '#fff6c2', accentB: '#ffa53c' },
  ],
  bruma: [
    { base: '#9d8cff', light: '#d4ccff', dark: '#6a5ad9', line: '#2f2378', belly: '#efeaff', accentA: '#fff3b0', accentB: '#c9bfff' },
    { base: '#5ed6c0', light: '#b6f2e6', dark: '#2fa394', line: '#13554c', belly: '#e6fff9', accentA: '#fff6c9', accentB: '#9cefe0' },
    { base: '#4c5bd4', light: '#96a2ff', dark: '#2b348f', line: '#141a52', belly: '#dfe3ff', accentA: '#ffe98a', accentB: '#8f9cff' },
    { base: '#ff9ecf', light: '#ffd3ea', dark: '#d96aa6', line: '#6e2251', belly: '#fff0f8', accentA: '#fff7c4', accentB: '#ffc4e3' },
  ],
};

/** Color de identificación de cada personaje (HUD, barreras, marcadores). */
export const CHARACTER_COLOR: Record<CharacterId, string> = {
  chispa: '#ff7a59',
  bruma: '#9d8cff',
};

export function skinOf(character: CharacterId, skin: number): SkinPalette {
  const list = SKINS[character];
  return list[Math.max(0, Math.min(list.length - 1, skin))] as SkinPalette;
}

export const INK = '#2b1650';
