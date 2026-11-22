import {
  CoopBot,
  RaceBot,
  type CharacterId,
  type CoopLevel,
  type CoopMech,
  type CoopPlayerState,
  type RaceCourse,
  type RaceTrap,
  type RunnerState,
} from '@duo/shared';
import { input } from '../input/InputState';

/**
 * Piloto automático SOLO para pruebas E2E: se compila únicamente en builds con
 * VITE_E2E=1 y se activa con ?autopilot=1. Genera entradas con los mismos bots
 * de los tests, que pasan por el mismo camino que los controles táctiles
 * (InputState → predicción → servidor). En producción este código se elimina.
 */
const ENABLED = import.meta.env.VITE_E2E === '1';

function active(): boolean {
  if (!ENABLED) return false;
  try {
    return new URLSearchParams(window.location.search).get('autopilot') === '1';
  } catch {
    return false;
  }
}

export const autopilot = {
  enabled: active,
  attachRace(course: RaceCourse, getState: () => RunnerState, getTraps: () => RaceTrap[]): void {
    if (!active()) return;
    const bot = new RaceBot(course);
    input.override = () => bot.decide(getState(), getTraps());
  },
  attachCoop(
    level: CoopLevel,
    character: CharacterId,
    getSelf: () => CoopPlayerState,
    getPartner: () => CoopPlayerState,
    getMech: () => CoopMech,
  ): void {
    if (!active()) return;
    const bot = new CoopBot(level, character);
    input.override = () => bot.decide(getSelf(), getPartner(), getMech());
  },
  detach(): void {
    input.override = null;
  },
};
