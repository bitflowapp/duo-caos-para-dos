import {
  CHARACTERS,
  COUNTDOWN_MS,
  LOBBY_SEAT_HOLD_MS,
  RECONNECT_GRACE_MS,
  RESUME_COUNTDOWN_MS,
  TOUR_ORDER,
  type AccessoryId,
  type AnswerPayload,
  type CharacterId,
  type EmoteId,
  type GameMode,
  type InputPayload,
  type MatchResult,
  type MatchSummary,
  type Pair,
  type PauseInfo,
  type PlayMode,
  type PlayerPublic,
  type QuizDeck,
  type RoomPhase,
  type RoomState,
  type SelectPayload,
  type ServerToClientEvents,
  type SessionStats,
  type Slot,
  type TourState,
} from '@duo/shared';
import { CoopGame } from './games/CoopGame.js';
import { QuizGame } from './games/QuizGame.js';
import { RaceGame } from './games/RaceGame.js';
import type { GameInstance, GameOutput } from './games/types.js';
import { generateSeed } from './security.js';

type EventArgs<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>;

/** Salida de red que provee el RoomManager (desacopla la sala de Socket.IO). */
export interface RoomIO {
  toRoom<E extends keyof ServerToClientEvents>(code: string, event: E, ...args: EventArgs<E>): void;
  toSocket<E extends keyof ServerToClientEvents>(socketId: string, event: E, ...args: EventArgs<E>): void;
  /** Desvincula un socket de la sala (sin cerrarlo). `replaced` avisa al cliente viejo. */
  unbindSocket(socketId: string, reason: 'replaced' | 'left'): void;
}

export interface Seat {
  slot: Slot;
  /** Nombre elegido (puede estar vacío: se usa el del personaje). */
  name: string;
  tokenHash: string;
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
  character: CharacterId | null;
  skin: number;
  accessory: AccessoryId;
  ready: boolean;
}

function emptyStats(): SessionStats {
  return { played: 0, wins: [0, 0], ties: 0, coopWins: 0, totalPoints: [0, 0], history: [] };
}

export class Room {
  readonly createdAt: number;
  lastActivity: number;
  /** Momento desde el que no hay nadie conectado (o null). */
  emptySince: number | null = null;
  seats: Pair<Seat | null> = [null, null];
  phase: RoomPhase = 'lobby';
  mode: PlayMode = 'race';
  deck: QuizDeck = 'light';
  game: GameInstance | null = null;
  currentGame: GameMode | null = null;
  phaseEndsAt: number | null = null;
  pause: PauseInfo | null = null;
  private resumeAt: number | null = null;
  tour: TourState | null = null;
  lastResult: MatchResult | null = null;
  votes: { rematch: Pair<boolean>; next: Pair<boolean> } = { rematch: [false, false], next: [false, false] };
  stats: SessionStats = emptyStats();
  matchCounter = 0;
  private readonly usedQuestions = new Set<string>();
  closed = false;

  constructor(
    readonly code: string,
    now: number,
    private readonly io: RoomIO,
  ) {
    this.createdAt = now;
    this.lastActivity = now;
  }

  // ───────────────────────── Asientos ─────────────────────────

  freeSlot(): Slot | null {
    if (this.seats[0] === null) return 0;
    if (this.seats[1] === null) return 1;
    return null;
  }

  canAcceptPlayer(): boolean {
    return this.freeSlot() !== null && (this.phase === 'lobby' || this.phase === 'results');
  }

  addPlayer(name: string, tokenHash: string, socketId: string, now: number): Slot | null {
    const slot = this.freeSlot();
    if (slot === null || !this.canAcceptPlayer()) return null;
    const other = this.seats[slot === 0 ? 1 : 0];
    const taken = other?.character ?? null;
    this.seats[slot] = {
      slot,
      name,
      tokenHash,
      socketId,
      connected: true,
      disconnectedAt: null,
      // Por defecto: Chispa al primero y el personaje libre al segundo (se puede cambiar).
      character: taken ? (taken === 'chispa' ? 'bruma' : 'chispa') : 'chispa',
      skin: 0,
      accessory: 'none',
      ready: false,
    };
    if (this.phase === 'results') this.backToLobby(now);
    if (other) {
      // Nueva pareja: estadísticas de sesión desde cero.
      this.stats = emptyStats();
      this.tour = null;
      this.lastResult = null;
    }
    this.emptySince = null;
    this.touch(now);
    this.broadcastState(now);
    return slot;
  }

  /** Re-vincula un asiento a un socket nuevo (reconexión). */
  bindSocket(slot: Slot, socketId: string, now: number): void {
    const seat = this.seats[slot];
    if (!seat) return;
    if (seat.socketId && seat.socketId !== socketId) {
      this.io.unbindSocket(seat.socketId, 'replaced');
    }
    seat.socketId = socketId;
    seat.connected = true;
    seat.disconnectedAt = null;
    this.emptySince = null;
    this.touch(now);

    if (this.phase === 'paused' && this.pause) {
      const other = this.seats[slot === 0 ? 1 : 0];
      if (this.pause.slot === slot) {
        if (other?.connected) this.scheduleResume(now);
        else if (other) this.pause = { slot: other.slot, deadline: this.pause.deadline };
      }
    }
    if (this.game && (this.phase === 'countdown' || this.phase === 'playing' || this.phase === 'paused')) {
      this.game.syncPlayer(slot, now);
    }
    this.broadcastState(now);
  }

  onDisconnect(slot: Slot, socketId: string, now: number): void {
    const seat = this.seats[slot];
    if (!seat || seat.socketId !== socketId) return; // socket viejo reemplazado
    seat.connected = false;
    seat.socketId = null;
    seat.disconnectedAt = now;
    if (this.seats.every((s) => !s || !s.connected)) this.emptySince = now;

    if (this.phase === 'countdown') {
      this.cancelCountdown(now);
    } else if (this.phase === 'playing' && this.game) {
      this.game.pause(now);
      this.phase = 'paused';
      this.pause = { slot, deadline: now + RECONNECT_GRACE_MS };
      this.phaseEndsAt = null;
    } else if (this.phase === 'paused' && this.game) {
      if (this.resumeAt !== null) {
        // Se estaba por reanudar y se fue el otro: volvemos a esperar.
        this.game.pause(now);
        this.resumeAt = null;
        this.phaseEndsAt = null;
        this.pause = { slot, deadline: now + RECONNECT_GRACE_MS };
      }
    } else {
      seat.ready = false;
    }
    this.broadcastState(now);
  }

  /** Abandono explícito o asiento vencido. Devuelve el hash del token liberado. */
  removePlayer(slot: Slot, now: number): string | null {
    const seat = this.seats[slot];
    if (!seat) return null;
    if (this.game && (this.phase === 'playing' || this.phase === 'paused')) {
      this.game.forfeit(slot);
      this.endGame(now);
    } else if (this.phase === 'countdown') {
      this.cancelCountdown(now);
    }
    this.seats[slot] = null;
    if (seat.socketId) this.io.unbindSocket(seat.socketId, 'left');
    const other = this.seats[slot === 0 ? 1 : 0];
    if (other) {
      other.ready = false;
      this.tour = null;
      this.votes = { rematch: [false, false], next: [false, false] };
      if (this.phase === 'results') this.backToLobby(now);
    }
    this.touch(now);
    this.broadcastState(now);
    return seat.tokenHash;
  }

  connectedCount(): number {
    return this.seats.filter((s) => s?.connected).length;
  }

  playerCount(): number {
    return this.seats.filter((s) => s !== null).length;
  }

  private touch(now: number): void {
    this.lastActivity = now;
  }

  displayName(seat: Seat): string {
    if (seat.name) return seat.name;
    if (seat.character) return CHARACTERS[seat.character].name;
    return `Jugador ${seat.slot + 1}`;
  }

  // ───────────────────────── Lobby ─────────────────────────

  select(slot: Slot, p: SelectPayload, now: number): void {
    const seat = this.seats[slot];
    if (!seat || this.phase !== 'lobby') return;
    const other = this.seats[slot === 0 ? 1 : 0];
    if (p.character !== null && other?.character === p.character) return; // cada uno con su personaje
    const changedCharacter = seat.character !== p.character;
    seat.character = p.character;
    seat.skin = p.skin;
    seat.accessory = p.accessory;
    if (changedCharacter || p.character === null) seat.ready = false;
    this.touch(now);
    this.broadcastState(now);
  }

  setReady(slot: Slot, ready: boolean, now: number): void {
    const seat = this.seats[slot];
    if (!seat || this.phase !== 'lobby') return;
    if (ready && !seat.character) return;
    seat.ready = ready;
    this.touch(now);
    this.broadcastState(now);
  }

  setMode(slot: Slot, mode: PlayMode, deck: QuizDeck | undefined, now: number): void {
    if (!this.seats[slot] || this.phase !== 'lobby') return;
    const changed = mode !== this.mode || (deck !== undefined && deck !== this.deck);
    if (!changed) return;
    this.mode = mode;
    if (deck) this.deck = deck;
    // Si cambia el juego, ambos vuelven a confirmar.
    for (const s of this.seats) if (s) s.ready = false;
    this.touch(now);
    this.broadcastState(now);
  }

  emote(slot: Slot, id: EmoteId, now: number): void {
    if (!this.seats[slot]) return;
    this.touch(now);
    this.io.toRoom(this.code, 'emote', { slot, id });
  }

  private canStart(): boolean {
    const [a, b] = this.seats;
    return (
      !!a &&
      !!b &&
      a.connected &&
      b.connected &&
      a.ready &&
      b.ready &&
      !!a.character &&
      !!b.character &&
      a.character !== b.character
    );
  }

  // ───────────────────────── Partidas ─────────────────────────

  private output(): GameOutput {
    return {
      broadcast: (event, ...args) => this.io.toRoom(this.code, event, ...args),
      sendTo: (slot, event, ...args) => {
        const sid = this.seats[slot]?.socketId;
        if (sid) this.io.toSocket(sid, event, ...args);
      },
    };
  }

  private startCountdown(now: number): void {
    const [a, b] = this.seats;
    if (!a || !b || !a.character || !b.character) return;
    let gameMode: GameMode;
    if (this.mode === 'tour') {
      if (!this.tour || this.tour.finished) {
        this.tour = { order: [...TOUR_ORDER], step: 0, points: [0, 0], results: [], finished: false };
      }
      gameMode = this.tour.order[this.tour.step] ?? 'race';
    } else {
      this.tour = null;
      gameMode = this.mode;
    }
    this.matchCounter++;
    const startTime = now + COUNTDOWN_MS;
    const common = {
      matchId: this.matchCounter,
      seed: generateSeed(),
      startTime,
      characters: [a.character, b.character] as Pair<CharacterId>,
      names: [this.displayName(a), this.displayName(b)] as Pair<string>,
      deck: this.deck,
      tour: this.tour ? { step: this.tour.step, total: this.tour.order.length } : null,
      out: this.output(),
    };
    if (gameMode === 'race') this.game = new RaceGame(common);
    else if (gameMode === 'coop') this.game = new CoopGame(common);
    else this.game = new QuizGame({ ...common, used: this.usedQuestions });
    this.currentGame = gameMode;
    this.phase = 'countdown';
    this.phaseEndsAt = startTime;
    this.pause = null;
    this.resumeAt = null;
    this.votes = { rematch: [false, false], next: [false, false] };
    this.io.toRoom(this.code, 'game:start', this.game.startPayload());
    this.broadcastState(now);
  }

  private cancelCountdown(now: number): void {
    this.game = null;
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    for (const s of this.seats) if (s) s.ready = false;
    this.broadcastState(now);
  }

  private scheduleResume(now: number): void {
    if (!this.game) return;
    const at = now + RESUME_COUNTDOWN_MS;
    this.resumeAt = at;
    this.phaseEndsAt = at;
    this.pause = null;
    this.game.resume(at);
  }

  private endGame(now: number): void {
    const result = this.game?.result;
    if (!result) return;
    this.lastResult = result;
    const s = this.stats;
    s.played++;
    if (result.cooperative) {
      if (result.details.kind === 'coop' && result.details.success) s.coopWins++;
    } else if (result.winner === null) {
      s.ties++;
    } else {
      s.wins[result.winner]++;
    }
    s.totalPoints = [s.totalPoints[0] + result.points[0], s.totalPoints[1] + result.points[1]];
    const summary: MatchSummary = {
      id: result.id,
      mode: result.mode,
      winner: result.winner,
      cooperative: result.cooperative,
      points: result.points,
      ...(result.details.kind === 'coop' ? { success: result.details.success } : {}),
    };
    s.history = [summary, ...s.history].slice(0, 20);
    if (this.tour && !this.tour.finished) {
      this.tour.points = [this.tour.points[0] + result.points[0], this.tour.points[1] + result.points[1]];
      this.tour.results.push(summary);
      this.tour.step++;
      if (this.tour.step >= this.tour.order.length || result.forfeit !== null) this.tour.finished = true;
    }
    this.game = null;
    this.phase = 'results';
    this.phaseEndsAt = null;
    this.pause = null;
    this.resumeAt = null;
    this.votes = { rematch: [false, false], next: [false, false] };
    for (const seat of this.seats) if (seat) seat.ready = false;
    this.touch(now);
    this.broadcastState(now);
  }

  private backToLobby(now: number): void {
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.game = null;
    this.votes = { rematch: [false, false], next: [false, false] };
    if (this.tour && !this.tour.finished) this.tour = null;
    for (const s of this.seats) if (s) s.ready = false;
    this.touch(now);
  }

  vote(slot: Slot, kind: 'rematch' | 'next', now: number): void {
    if (this.phase !== 'results' || !this.seats[slot]) return;
    const inTour = this.tour !== null && !this.tour.finished;
    if (kind === 'next' && !inTour) return;
    if (kind === 'rematch' && inTour) return;
    this.votes[kind][slot] = true;
    this.touch(now);
    const both = this.votes[kind][0] && this.votes[kind][1];
    const [a, b] = this.seats;
    if (both && a?.connected && b?.connected && a.character && b.character && a.character !== b.character) {
      if (kind === 'rematch' && this.tour?.finished) this.tour = null; // la revancha de una gira es una gira nueva
      this.startCountdown(now);
      return;
    }
    this.broadcastState(now);
  }

  toLobby(slot: Slot, now: number): void {
    if (this.phase !== 'results' || !this.seats[slot]) return;
    this.backToLobby(now);
    this.broadcastState(now);
  }

  input(slot: Slot, p: InputPayload, now: number): void {
    if (this.phase === 'playing' || (this.phase === 'paused' && this.resumeAt !== null)) {
      this.game?.onInput(slot, p, now);
    }
  }

  answer(slot: Slot, p: AnswerPayload, now: number): void {
    if (this.phase === 'playing') this.game?.onAnswer(slot, p, now);
  }

  skip(slot: Slot, q: number, now: number): void {
    if (this.phase === 'playing') this.game?.onSkip(slot, q, now);
  }

  count(slot: Slot, now: number): void {
    if (this.phase === 'playing') this.game?.onCount(slot, now);
  }

  // ───────────────────────── Bucle ─────────────────────────

  update(now: number): void {
    switch (this.phase) {
      case 'lobby':
        if (this.canStart()) this.startCountdown(now);
        break;
      case 'countdown':
        if (this.phaseEndsAt !== null && now >= this.phaseEndsAt) {
          this.phase = 'playing';
          this.phaseEndsAt = null;
          this.broadcastState(now);
        }
        break;
      case 'playing':
        this.game?.update(now);
        if (this.game?.result) this.endGame(now);
        break;
      case 'paused':
        if (this.resumeAt !== null) {
          this.game?.update(now);
          if (now >= this.resumeAt) {
            this.resumeAt = null;
            this.phase = 'playing';
            this.phaseEndsAt = null;
            this.broadcastState(now);
          }
        } else if (this.pause && now >= this.pause.deadline && this.game) {
          this.game.forfeit(this.pause.slot);
          this.endGame(now);
        }
        break;
      case 'results':
        break;
    }

    // Asientos desconectados demasiado tiempo fuera de partida: se liberan.
    if (this.phase === 'lobby' || this.phase === 'results') {
      for (const seat of this.seats) {
        if (seat && !seat.connected && seat.disconnectedAt !== null && now - seat.disconnectedAt > LOBBY_SEAT_HOLD_MS) {
          this.onSeatExpired?.(seat.tokenHash);
          this.removePlayer(seat.slot, now);
        }
      }
    }
  }

  /** Callback para que el RoomManager invalide tokens de asientos vencidos. */
  onSeatExpired: ((tokenHash: string) => void) | null = null;

  // ───────────────────────── Estado público ─────────────────────────

  state(now: number): RoomState {
    const pub = (seat: Seat | null, slot: Slot): PlayerPublic | null =>
      seat
        ? {
            slot,
            name: this.displayName(seat),
            character: seat.character,
            skin: seat.skin,
            accessory: seat.accessory,
            ready: seat.ready,
            connected: seat.connected,
            host: slot === 0,
          }
        : null;
    return {
      code: this.code,
      phase: this.phase,
      players: [pub(this.seats[0], 0), pub(this.seats[1], 1)],
      mode: this.mode,
      quizDeck: this.deck,
      currentGame: this.currentGame,
      phaseEndsAt: this.phaseEndsAt,
      pause: this.pause,
      tour: this.tour,
      lastResult: this.lastResult,
      votes: this.votes,
      stats: this.stats,
      serverNow: now,
      matchId: this.matchCounter,
    };
  }

  broadcastState(now: number): void {
    if (this.closed) return;
    this.io.toRoom(this.code, 'room:state', this.state(now));
  }
}
