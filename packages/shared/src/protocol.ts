/**
 * Protocolo de red entre cliente y servidor (Socket.IO).
 * Todos los mensajes cliente→servidor se validan en el servidor con los esquemas
 * de `schemas.ts`; el cliente nunca envía posiciones ni puntajes, solo entradas.
 */
import type { ClockPayload } from './clock';
import type { CoopMech, CoopPlayerState, MechEvent } from './coop/sim';
import type { QuizOutcome, QuizQuestionView } from './quiz/logic';
import type { QuizKind } from './quiz/bank';
import type { HazardKind } from './race/course';
import type { ItemId, RaceTrap, RunnerState } from './race/sim';
import type {
  AccessoryId,
  CharacterId,
  EmoteId,
  GameMode,
  JoinError,
  Pair,
  PlayMode,
  QuizDeck,
  RoomState,
  Slot,
} from './types';

export interface HandshakeAuth {
  v: number;
}

export interface CreateRoomPayload {
  name?: string;
}
export interface JoinRoomPayload {
  code: string;
  name?: string;
}
export interface ResumePayload {
  token: string;
}

export type JoinAck =
  | { ok: true; token: string; slot: Slot; state: RoomState; expiresAt: number }
  | { ok: false; error: JoinError; retryAfterMs?: number };

export interface SelectPayload {
  character: CharacterId | null;
  skin: number;
  accessory: AccessoryId;
}

export interface ModePayload {
  mode: PlayMode;
  deck?: QuizDeck;
}

/** Entradas por tick: `b[i]` son los botones del tick `t + i`. */
export interface InputPayload {
  m: number;
  t: number;
  b: number[];
}

export interface AnswerPayload {
  q: number;
  choice: number;
}

export interface GameStartPayload {
  matchId: number;
  mode: GameMode;
  seed: number;
  clock: ClockPayload;
  characters: Pair<CharacterId>;
  names: Pair<string>;
  deck: QuizDeck;
  tour: { step: number; total: number } | null;
}

export interface RaceSnapshot {
  m: 'race';
  matchId: number;
  /** Tick del reloj del servidor al enviar. */
  t: number;
  p: Pair<RunnerState>;
  traps: RaceTrap[];
}

export interface CoopSnapshot {
  m: 'coop';
  matchId: number;
  t: number;
  p: Pair<CoopPlayerState>;
  mech: CoopMech;
}

export type GameSnapshot = RaceSnapshot | CoopSnapshot;

export type GameEventPayload =
  | { k: 'race:itemGot'; slot: Slot; item: ItemId }
  | { k: 'race:item'; slot: Slot; item: ItemId; x: number; y: number }
  | { k: 'race:effect'; from: Slot; target: Slot; effect: 'slow' | 'kiss'; result: 'applied' | 'blocked' | 'ignored' }
  | { k: 'race:trapHit'; slot: Slot; id: number; shielded: boolean }
  | { k: 'race:hit'; slot: Slot; kind: HazardKind; shielded: boolean }
  | { k: 'race:fall'; slot: Slot }
  | { k: 'race:finish'; slot: Slot; time: number; place: 1 | 2 }
  | { k: 'race:lead'; slot: Slot }
  | { k: 'coop:mech'; ev: MechEvent }
  | { k: 'coop:fall'; slot: Slot; kind: 'water' | 'thorns' | 'void' }
  | { k: 'coop:count'; slot: Slot; at: number };

export interface QuizProgress {
  q: number;
  answered: Pair<boolean>;
}

export interface QuizReveal {
  q: number;
  kind: QuizKind;
  about: Slot | null;
  answers: Pair<number | null>;
  outcome: QuizOutcome;
  points: Pair<number>;
  totals: Pair<number>;
  line: string;
  /** Hora del servidor en que sigue la próxima pregunta (o el final). */
  nextAt: number;
}

export interface ClientToServerEvents {
  'room:create': (p: CreateRoomPayload, ack: (r: JoinAck) => void) => void;
  'room:join': (p: JoinRoomPayload, ack: (r: JoinAck) => void) => void;
  'room:resume': (p: ResumePayload, ack: (r: JoinAck) => void) => void;
  'room:leave': () => void;
  'lobby:select': (p: SelectPayload) => void;
  'lobby:ready': (p: { ready: boolean }) => void;
  'lobby:mode': (p: ModePayload) => void;
  'game:input': (p: InputPayload) => void;
  'quiz:answer': (p: AnswerPayload) => void;
  'quiz:skip': (p: { q: number }) => void;
  'coop:count': () => void;
  'post:vote': (p: { kind: 'rematch' | 'next' }) => void;
  'post:lobby': () => void;
  emote: (p: { id: EmoteId }) => void;
  'time:ping': (p: { c: number }, ack: (r: { c: number; s: number }) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (s: RoomState) => void;
  'room:closed': (p: { reason: 'expired' | 'idle' | 'empty' | 'shutdown' }) => void;
  'session:replaced': () => void;
  'game:start': (p: GameStartPayload) => void;
  'game:clock': (p: { matchId: number; clock: ClockPayload }) => void;
  'game:snap': (p: GameSnapshot) => void;
  'game:event': (p: GameEventPayload) => void;
  'quiz:question': (p: QuizQuestionView) => void;
  'quiz:progress': (p: QuizProgress) => void;
  'quiz:reveal': (p: QuizReveal) => void;
  emote: (p: { slot: Slot; id: EmoteId }) => void;
  'error:msg': (p: { code: 'rate_limited' | 'invalid' | 'not_in_room' | 'not_allowed' }) => void;
}
