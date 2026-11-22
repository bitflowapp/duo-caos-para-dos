import type {
  AnswerPayload,
  GameMode,
  GameStartPayload,
  InputPayload,
  MatchResult,
  ServerToClientEvents,
  Slot,
} from '@duo/shared';

type EventArgs<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>;

/** Canal de salida que el Room provee a cada juego. */
export interface GameOutput {
  broadcast<E extends keyof ServerToClientEvents>(event: E, ...args: EventArgs<E>): void;
  sendTo<E extends keyof ServerToClientEvents>(slot: Slot, event: E, ...args: EventArgs<E>): void;
}

export interface GameInstance {
  readonly mode: GameMode;
  readonly matchId: number;
  /** Datos de inicio (incluye el reloj vigente). */
  startPayload(): GameStartPayload;
  onInput(slot: Slot, payload: InputPayload, now: number): void;
  onAnswer(slot: Slot, payload: AnswerPayload, now: number): void;
  onSkip(slot: Slot, q: number, now: number): void;
  onCount(slot: Slot, now: number): void;
  update(now: number): void;
  pause(now: number): void;
  /** Reanuda; la simulación vuelve a correr desde `at` (hora del servidor). */
  resume(at: number): void;
  /** Reenvía a un jugador que se reconectó todo lo necesario para seguir. */
  syncPlayer(slot: Slot, now: number): void;
  /** Termina la partida por abandono de `slot`. */
  forfeit(slot: Slot): void;
  /** Resultado final, o null mientras se juega. */
  readonly result: MatchResult | null;
}
