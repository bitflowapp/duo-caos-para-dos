import { local } from './storage';

export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  name: string;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  vibration: boolean;
  reduceMotion: boolean;
  quality: Quality;
  /** Mostrar u ocultar los controles en pantalla (teclado en compu). */
  touchControls: 'auto' | 'on' | 'off';
}

const KEY = 'duo.settings.v1';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function loadSettings(): Settings {
  const defaults: Settings = {
    name: '',
    musicVolume: 0.7,
    sfxVolume: 0.9,
    muted: false,
    vibration: true,
    reduceMotion: prefersReducedMotion(),
    quality: 'auto',
    touchControls: 'auto',
  };
  const saved = local.get<Partial<Settings>>(KEY, {});
  return { ...defaults, ...saved };
}

export function saveSettings(s: Settings): void {
  local.set(KEY, s);
}
