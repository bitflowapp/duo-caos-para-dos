import { ACCESSORIES, type AccessoryId, type GameMode, type MatchResult, type Slot } from '@duo/shared';
import { local } from './storage';

/**
 * Progreso local del dispositivo (sin cuentas ni datos personales): estadísticas,
 * logros, accesorios desbloqueados e historial breve. Se guarda en localStorage.
 */

export interface HistoryEntry {
  at: number;
  mode: GameMode;
  outcome: 'win' | 'loss' | 'tie' | 'coop-ok' | 'coop-fail';
  myPoints: number;
  partner: string;
}

export interface Profile {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  coopClears: number;
  heartsTotal: number;
  bestRaceSeconds: number | null;
  bestCoopSeconds: number | null;
  bestSync: number | null;
  coupleHearts: number;
  achievements: string[];
  history: HistoryEntry[];
  lastMode: GameMode | null;
  lastMatchRoom: string | null;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Accesorio que desbloquea, si corresponde. */
  unlocks?: AccessoryId;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-game', name: 'Primera chispa', description: 'Jugá tu primera partida en pareja.', unlocks: 'party' },
  { id: 'race-win', name: 'Velocista del caos', description: 'Ganá una Carrera del Caos.', unlocks: 'bandana' },
  { id: 'flawless', name: 'Impecable', description: 'Ganá una carrera sin chocar ni caerte.', unlocks: 'halo' },
  { id: 'coop-clear', name: 'Equipo dinamita', description: 'Superen el Templo de Sincronizados.' },
  { id: 'coop-3stars', name: 'Sincronía perfecta', description: 'Consigan 3 estrellas en Sincronizados.', unlocks: 'chef' },
  { id: 'quiz-sync', name: 'Telepatía', description: 'Logren 75% de sintonía en ¿Cuánto me conocés?', unlocks: 'glasses' },
  { id: 'tour-complete', name: 'Copa de la Isla', description: 'Completen una Gira por la Isla.', unlocks: 'crown' },
  { id: 'rematch', name: '¡Revancha!', description: 'Jueguen una revancha.', unlocks: 'beanie' },
  { id: 'hearts-200', name: 'Corazón coleccionista', description: 'Juntá 200 corazones en carreras.' },
  { id: 'splash', name: 'Chapuzón', description: 'Caete 3 veces al agua o a las espinas en un templo. ¡Pasa!' },
];

const KEY = 'duo.profile.v1';

function emptyProfile(): Profile {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    coopClears: 0,
    heartsTotal: 0,
    bestRaceSeconds: null,
    bestCoopSeconds: null,
    bestSync: null,
    coupleHearts: 0,
    achievements: [],
    history: [],
    lastMode: null,
    lastMatchRoom: null,
  };
}

let cache: Profile | null = null;

export function loadProfile(): Profile {
  if (!cache) cache = { ...emptyProfile(), ...local.get<Partial<Profile>>(KEY, {}) };
  return cache;
}

function save(p: Profile): void {
  cache = p;
  local.set(KEY, p);
}

export function unlockedAccessories(p: Profile = loadProfile()): Set<AccessoryId> {
  const set = new Set<AccessoryId>();
  for (const acc of Object.values(ACCESSORIES)) {
    if (acc.unlockedBy === null || p.achievements.includes(acc.unlockedBy)) set.add(acc.id);
  }
  return set;
}

/** Registra un resultado (una vez por partida) y devuelve los logros nuevos. */
export function recordResult(
  result: MatchResult,
  mySlot: Slot,
  partnerName: string,
  context: { roomCode: string; tourFinished: boolean },
): AchievementDef[] {
  const p = { ...loadProfile() };
  const key = `${context.roomCode}:${result.id}`;
  if (p.lastMatchRoom === key) return [];
  const isRematch = p.lastMatchRoom?.startsWith(`${context.roomCode}:`) === true && p.lastMode === result.mode;
  p.lastMatchRoom = key;
  p.lastMode = result.mode;

  const earned = new Set(p.achievements);
  const add = (id: string): void => {
    earned.add(id);
  };
  const myPoints = result.points[mySlot];
  p.games++;
  p.coupleHearts += result.points[0] + result.points[1];
  let outcome: HistoryEntry['outcome'];
  if (result.cooperative) {
    const ok = result.details.kind === 'coop' && result.details.success;
    outcome = ok ? 'coop-ok' : 'coop-fail';
    if (ok) p.coopClears++;
  } else if (result.winner === null) {
    outcome = 'tie';
    p.ties++;
  } else if (result.winner === mySlot) {
    outcome = 'win';
    p.wins++;
  } else {
    outcome = 'loss';
    p.losses++;
  }

  add('first-game');
  if (isRematch) add('rematch');
  const d = result.details;
  if (d.kind === 'race') {
    p.heartsTotal += d.hearts[mySlot];
    const t = d.finishTicks[mySlot];
    if (t !== null) {
      const secs = t / 60;
      p.bestRaceSeconds = p.bestRaceSeconds === null ? secs : Math.min(p.bestRaceSeconds, secs);
    }
    if (result.winner === mySlot && result.forfeit === null) {
      add('race-win');
      if (d.hits[mySlot] === 0 && d.falls[mySlot] === 0) add('flawless');
    }
    if (p.heartsTotal >= 200) add('hearts-200');
  } else if (d.kind === 'coop') {
    if (d.success) {
      add('coop-clear');
      const secs = d.timeTicks / 60;
      p.bestCoopSeconds = p.bestCoopSeconds === null ? secs : Math.min(p.bestCoopSeconds, secs);
      if (d.stars === 3) add('coop-3stars');
    }
    if (d.falls[mySlot] >= 3) add('splash');
  } else if (d.kind === 'quiz') {
    p.bestSync = p.bestSync === null ? d.syncPercent : Math.max(p.bestSync, d.syncPercent);
    if (d.syncPercent >= 75 && d.scored >= 4) add('quiz-sync');
  }
  if (context.tourFinished) add('tour-complete');

  p.history = [{ at: Date.now(), mode: result.mode, outcome, myPoints, partner: partnerName }, ...p.history].slice(0, 30);
  const fresh = ACHIEVEMENTS.filter((a) => earned.has(a.id) && !p.achievements.includes(a.id));
  p.achievements = [...earned];
  save(p);
  return fresh;
}

export function resetProfile(): void {
  save(emptyProfile());
}
