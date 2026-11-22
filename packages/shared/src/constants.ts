/**
 * Constantes compartidas entre cliente y servidor.
 * Cambiar cualquiera de estos valores requiere desplegar cliente y servidor juntos
 * (ver PROTOCOL_VERSION).
 */

/** Versión del protocolo de red. El servidor rechaza clientes con otra versión. */
export const PROTOCOL_VERSION = 3;

// ───────────────────────── Simulación ─────────────────────────
/** Ticks de simulación por segundo (paso fijo). */
export const TICK_RATE = 60;
/** Duración de un tick en milisegundos. */
export const TICK_MS = 1000 / TICK_RATE;
/** Duración de un tick en segundos. */
export const DT = 1 / TICK_RATE;
/** Cada cuántos ticks el servidor envía un snapshot (60/3 = 20 Hz). */
export const SNAPSHOT_INTERVAL_TICKS = 3;
/** Cada cuántos ticks el cliente agrupa y envía sus entradas (30 Hz). */
export const INPUT_SEND_INTERVAL_TICKS = 2;
/** Máximo de ticks de entrada aceptados en un único mensaje. */
export const MAX_INPUT_TICKS_PER_MESSAGE = 30;
/** Cuánto puede adelantarse un cliente al reloj del servidor (anti speed-hack). */
export const INPUT_LEAD_TOLERANCE_TICKS = 30;
/** Si un jugador se atrasa más que esto, el servidor avanza su simulación sin entrada. */
export const INPUT_STALL_TICKS = 45;

// ───────────────────────── Botones (bitfield) ─────────────────────────
export const BTN_JUMP = 1;
export const BTN_DOWN = 2;
export const BTN_ITEM = 4;
export const BTN_LEFT = 8;
export const BTN_RIGHT = 16;
export const BTN_ACTION = 32;
export const BTN_MASK = 63;

// ───────────────────────── Salas ─────────────────────────
/** Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L). 31 símbolos. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** 8 símbolos de 31 ≈ 39,6 bits de entropía por código. */
export const ROOM_CODE_LENGTH = 8;
/** Bytes aleatorios de cada token de sesión (256 bits). */
export const SESSION_TOKEN_BYTES = 32;
export const MAX_NAME_LENGTH = 14;
export const MAX_PLAYERS = 2;

/** Tiempo que se espera a un jugador desconectado durante una partida (pausada). */
export const RECONNECT_GRACE_MS = 90_000;
/** Tiempo que un lugar de jugador desconectado se reserva en el lobby. */
export const LOBBY_SEAT_HOLD_MS = 10 * 60_000;
/** Sala sin actividad en lobby/resultados: se cierra. */
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60_000;
/** Vida máxima absoluta de una sala y de sus tokens. */
export const ROOM_MAX_LIFETIME_MS = 8 * 60 * 60_000;
/** Sala sin ningún jugador conectado: se cierra. */
export const EMPTY_ROOM_TTL_MS = 3 * 60_000;

export const COUNTDOWN_MS = 3_600;
export const RESUME_COUNTDOWN_MS = 3_000;

// ───────────────────────── Límites de frecuencia ─────────────────────────
export interface RateRule {
  /** Capacidad del balde (ráfaga). */
  burst: number;
  /** Fichas recargadas por segundo. */
  perSecond: number;
}

export const RATE_LIMITS = {
  input: { burst: 90, perSecond: 45 },
  lobby: { burst: 12, perSecond: 4 },
  room: { burst: 6, perSecond: 0.5 },
  answer: { burst: 6, perSecond: 2 },
  emote: { burst: 5, perSecond: 1.5 },
  ping: { burst: 6, perSecond: 2 },
} as const satisfies Record<string, RateRule>;

/** Intentos de crear/unirse por IP en una ventana de 60 s. */
export const JOIN_ATTEMPTS_PER_MINUTE = 20;
/** Si un socket supera los límites esta cantidad de veces, se desconecta. */
export const MAX_RATE_VIOLATIONS = 200;
