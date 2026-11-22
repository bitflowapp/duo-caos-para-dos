import type { AccessoryId, CharacterId, EmoteId, GameMode, PlayMode } from './types';

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  tagline: string;
  personality: string;
  /** Nombre de cada apariencia (paleta). */
  skins: readonly [string, string, string, string];
}

export const CHARACTERS: Record<CharacterId, CharacterInfo> = {
  chispa: {
    id: 'chispa',
    name: 'Chispa',
    tagline: 'Pura energía con llamita incluida',
    personality: 'Impulsiva, competitiva y cariñosa. Festeja todo, hasta los tropiezos.',
    skins: ['Atardecer', 'Frutilla', 'Mandarina', 'Dorada'],
  },
  bruma: {
    id: 'bruma',
    name: 'Bruma',
    tagline: 'Calma de nube, picardía de luna',
    personality: 'Ingeniosa, tranquila y bromista. Siempre tiene un plan (o casi).',
    skins: ['Lavanda', 'Menta', 'Medianoche', 'Algodón'],
  },
};

export interface AccessoryInfo {
  id: AccessoryId;
  name: string;
  /** Logro que lo desbloquea (null = disponible desde el inicio). */
  unlockedBy: string | null;
}

export const ACCESSORIES: Record<AccessoryId, AccessoryInfo> = {
  none: { id: 'none', name: 'Sin accesorio', unlockedBy: null },
  flower: { id: 'flower', name: 'Flor de la isla', unlockedBy: null },
  party: { id: 'party', name: 'Gorrito de fiesta', unlockedBy: 'first-game' },
  bandana: { id: 'bandana', name: 'Pañuelo pirata', unlockedBy: 'race-win' },
  glasses: { id: 'glasses', name: 'Anteojos de corazón', unlockedBy: 'quiz-sync' },
  crown: { id: 'crown', name: 'Coronita', unlockedBy: 'tour-complete' },
  chef: { id: 'chef', name: 'Gorro de chef', unlockedBy: 'coop-3stars' },
  beanie: { id: 'beanie', name: 'Gorrito de lana', unlockedBy: 'rematch' },
  halo: { id: 'halo', name: 'Aureola', unlockedBy: 'flawless' },
};

export const EMOTES: Record<EmoteId, { label: string }> = {
  heart: { label: 'Corazón' },
  laugh: { label: 'Jajaja' },
  wow: { label: '¡Wow!' },
  kiss: { label: 'Beso' },
  grr: { label: '¡Grrr!' },
  clap: { label: 'Aplausos' },
};

export interface ModeInfo {
  id: PlayMode;
  name: string;
  short: string;
  description: string;
  kind: 'competitivo' | 'cooperativo' | 'romántico' | 'serie';
  minutes: string;
}

export const MODES: Record<PlayMode, ModeInfo> = {
  race: {
    id: 'race',
    name: 'Carrera del Caos',
    short: 'Carrera',
    description: 'Corran por la isla, salten trampas y usen Cajas del Caos para complicarle la vida al otro.',
    kind: 'competitivo',
    minutes: '1–2 min',
  },
  coop: {
    id: 'coop',
    name: 'Sincronizados',
    short: 'Sincronizados',
    description: 'Un templo con placas, barreras y consolas: cada uno abre el camino del otro.',
    kind: 'cooperativo',
    minutes: '2–4 min',
  },
  quiz: {
    id: 'quiz',
    name: '¿Cuánto me conocés?',
    short: 'Quiz',
    description: 'Adiviná lo que respondería tu pareja. Revelación simultánea y cero castigo por pasar.',
    kind: 'romántico',
    minutes: '3–4 min',
  },
  tour: {
    id: 'tour',
    name: 'Gira por la Isla',
    short: 'Gira',
    description: 'Los tres juegos seguidos. Se suman los puntos y se entrega la Copa de la Isla.',
    kind: 'serie',
    minutes: '8–10 min',
  },
};

export const TOUR_ORDER: readonly GameMode[] = ['race', 'coop', 'quiz'];
