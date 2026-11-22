import { MAX_NAME_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';

const CODE_CHARS = new Set(ROOM_CODE_ALPHABET.split(''));

/**
 * Normaliza un código de sala escrito por una persona: mayúsculas, sin espacios
 * ni guiones, y corrige confusiones típicas (O→0 no existe en el alfabeto, así que
 * se rechaza). Devuelve null si no es válido.
 */
export function normalizeRoomCode(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 32) return null;
  const cleaned = raw.toUpperCase().replace(/[\s\-_.]/g, '');
  if (cleaned.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!CODE_CHARS.has(ch)) return null;
  }
  return cleaned;
}

/** Formato legible: ABCD-EFGH */
export function formatRoomCode(code: string): string {
  if (code.length !== ROOM_CODE_LENGTH) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Limpia un nombre visible: quita caracteres de control, espacios repetidos y
 * recorta. Nunca se interpreta como HTML (React escapa), pero igual se acota.
 */
export function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  // Quita caracteres de control, de formato invisibles y separadores raros.
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('').trim();
  return chars.length > 0 ? chars : fallback;
}
