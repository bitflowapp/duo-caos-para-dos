/** Tipos de dominio compartidos. */

export type Slot = 0 | 1;
export type Pair<T> = [T, T];

export const CHARACTER_IDS = ['chispa', 'bruma'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const GAME_MODES = ['race', 'coop', 'quiz'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const PLAY_MODES = ['race', 'coop', 'quiz', 'tour'] as const;
/** Lo que se elige en el lobby: un minijuego suelto o la Gira por la Isla (los tres seguidos). */
export type PlayMode = (typeof PLAY_MODES)[number];

export const QUIZ_DECKS = ['light', 'romance'] as const;
/** light = humor y gustos; romance = incluye preguntas románticas (siempre omitibles). */
export type QuizDeck = (typeof QUIZ_DECKS)[number];

export const ACCESSORY_IDS = [
  'none',
  'flower',
  'party',
  'bandana',
  'glasses',
  'crown',
  'chef',
  'beanie',
  'halo',
] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

export const SKIN_COUNT = 4;

export const EMOTE_IDS = ['heart', 'laugh', 'wow', 'kiss', 'grr', 'clap'] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];

export type RoomPhase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'results';

export interface PlayerPublic {
  slot: Slot;
  name: string;
  character: CharacterId | null;
  skin: number;
  accessory: AccessoryId;
  ready: boolean;
  connected: boolean;
  host: boolean;
}

export interface RaceResultDetails {
  kind: 'race';
  /** Tick (con fracción) en que cruzó la meta; null si no llegó. */
  finishTicks: Pair<number | null>;
  hearts: Pair<number>;
  hits: Pair<number>;
  falls: Pair<number>;
  itemsUsed: Pair<number>;
  /** Progreso 0..1 al terminar la carrera. */
  progress: Pair<number>;
}

export interface CoopResultDetails {
  kind: 'coop';
  success: boolean;
  timeTicks: number;
  falls: Pair<number>;
  stars: 0 | 1 | 2 | 3;
  roomsCleared: number;
  totalRooms: number;
}

export interface QuizResultDetails {
  kind: 'quiz';
  /** Predicciones acertadas por cada jugador. */
  correct: Pair<number>;
  /** Coincidencias en preguntas de sintonía. */
  matches: number;
  /** Preguntas que contaron (no omitidas ni sin respuesta). */
  scored: number;
  /** 0..100 */
  syncPercent: number;
  skipped: number;
  syncTitle: string;
}

export type MatchDetails = RaceResultDetails | CoopResultDetails | QuizResultDetails;

export interface MatchResult {
  id: number;
  mode: GameMode;
  /** Ganador; null = empate o partida cooperativa. */
  winner: Slot | null;
  cooperative: boolean;
  /** Puntos obtenidos en esta partida. */
  points: Pair<number>;
  headline: string;
  /** Jugador que abandonó (la partida terminó por abandono). */
  forfeit: Slot | null;
  details: MatchDetails;
}

export interface MatchSummary {
  id: number;
  mode: GameMode;
  winner: Slot | null;
  cooperative: boolean;
  points: Pair<number>;
  success?: boolean;
}

export interface SessionStats {
  played: number;
  wins: Pair<number>;
  ties: number;
  coopWins: number;
  totalPoints: Pair<number>;
  history: MatchSummary[];
}

export interface TourState {
  order: GameMode[];
  /** Índice del juego actual/próximo dentro de order. */
  step: number;
  points: Pair<number>;
  results: MatchSummary[];
  finished: boolean;
}

export interface PauseInfo {
  slot: Slot;
  /** Hora del servidor en que se termina la espera. */
  deadline: number;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  players: Pair<PlayerPublic | null>;
  mode: PlayMode;
  quizDeck: QuizDeck;
  /** Juego en curso o el último jugado. */
  currentGame: GameMode | null;
  /** Hora del servidor en que termina la fase actual (cuenta regresiva). */
  phaseEndsAt: number | null;
  pause: PauseInfo | null;
  tour: TourState | null;
  lastResult: MatchResult | null;
  votes: { rematch: Pair<boolean>; next: Pair<boolean> };
  stats: SessionStats;
  /** Hora del servidor al emitir este estado. */
  serverNow: number;
  /** Número de partida actual (cambia en cada inicio). */
  matchId: number;
}

export type JoinError =
  | 'invalid'
  | 'not_found'
  | 'full'
  | 'rate_limited'
  | 'expired'
  | 'version'
  | 'server_full';
