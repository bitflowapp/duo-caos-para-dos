import type { CharacterId } from '../types';
import type { Rect } from '../race/course';

/**
 * Nivel de "Sincronizados": El Templo de los Dos Corazones.
 * Cuatro salas en las que cada jugador habilita el avance del otro.
 * Grilla de 110 × 15 baldosas de 48 unidades (Y hacia abajo).
 */

export const TILE = 48;
export const COOP_COLS = 110;
export const COOP_ROWS = 15;

export interface CoopPlate extends Rect {
  id: number;
}

export interface CoopDoor extends Rect {
  id: number;
  /** Placas o palancas que la abren (cualquiera alcanza). */
  plates: number[];
  levers: number[];
}

export interface CoopBridge extends Rect {
  id: number;
  plates: number[];
}

export interface CoopLever {
  id: number;
  x: number;
  y: number;
}

export interface CoopGate extends Rect {
  id: number;
  character: CharacterId;
  /** Palanca que desactiva la barrera (o -1). */
  disabledBy: number;
}

export interface CoopElevator {
  x0: number;
  x1: number;
  yBottom: number;
  yTop: number;
  speed: number;
}

export interface CoopConsole {
  id: number;
  x: number;
  y: number;
}

export interface CoopHazard extends Rect {
  kind: 'water' | 'thorns';
}

export interface CoopCheckpoint {
  x: number;
  spawns: [{ x: number; y: number }, { x: number; y: number }];
}

export interface CoopRoom {
  name: string;
  /** El grupo superó la sala cuando ambos pasan esta X. */
  clearX: number;
  /** Requisito extra: ambos por encima de esta Y (sala del ascensor). */
  clearMaxY?: number;
}

export interface CoopSign {
  x: number;
  y: number;
  text: string;
}

export type CoopDecorKind = 'torch' | 'vine' | 'statue' | 'crystal' | 'fern' | 'banner';

export interface CoopLevel {
  cols: number;
  rows: number;
  tile: number;
  /** 1 = sólido. Índice: fila * cols + columna. */
  solid: Uint8Array;
  platforms: Rect[];
  hazards: CoopHazard[];
  plates: CoopPlate[];
  doors: CoopDoor[];
  bridges: CoopBridge[];
  levers: CoopLever[];
  gates: CoopGate[];
  elevator: CoopElevator;
  consoles: CoopConsole[];
  heartGate: Rect;
  exit: Rect;
  checkpoints: CoopCheckpoint[];
  rooms: CoopRoom[];
  signs: CoopSign[];
  decor: Array<{ kind: CoopDecorKind; x: number; y: number }>;
  width: number;
  height: number;
}

const T = TILE;

function tileRect(c0: number, r0: number, c1: number, r1: number): Rect {
  return { x0: c0 * T, y0: r0 * T, x1: (c1 + 1) * T, y1: (r1 + 1) * T };
}

export function buildCoopLevel(): CoopLevel {
  const solid = new Uint8Array(COOP_COLS * COOP_ROWS);
  const fill = (c0: number, r0: number, c1: number, r1: number): void => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (c >= 0 && c < COOP_COLS && r >= 0 && r < COOP_ROWS) solid[r * COOP_COLS + c] = 1;
      }
    }
  };

  // Marco exterior
  fill(0, 0, COOP_COLS - 1, 0);
  fill(0, 0, 0, COOP_ROWS - 1);
  fill(COOP_COLS - 1, 0, COOP_COLS - 1, COOP_ROWS - 1);

  // ── Sala 1: Placa y puerta ──
  fill(0, 12, 25, 14);
  fill(13, 1, 13, 7); // muro sobre la puerta D0

  // ── Sala 2: Barreras de color y puente ──
  fill(26, 12, 31, 14); // orilla izquierda
  fill(31, 6, 36, 6); // pasillo alto (piso)
  fill(31, 1, 36, 2); // techo del pasillo alto
  fill(42, 12, 57, 14); // orilla derecha
  fill(47, 1, 47, 7); // muro sobre la barrera fría
  fill(53, 1, 53, 7); // muro sobre la puerta D1

  // ── Sala 3: El ascensor de los dos ──
  fill(58, 12, 69, 14);
  fill(70, 5, 86, 14); // nivel superior

  // ── Sala 4: Sincronía final ──
  fill(87, 12, 108, 14);
  fill(96, 7, 97, 11); // pilar de la consola 2
  fill(100, 1, 101, 2); // muro sobre el Portal del Corazón

  const plates: CoopPlate[] = [
    { id: 0, ...tileRect(8, 12, 9, 12), y0: 12 * T - 8, y1: 12 * T }, // sala 1, izquierda
    { id: 1, ...tileRect(17, 12, 18, 12), y0: 12 * T - 8, y1: 12 * T }, // sala 1, derecha
    { id: 2, ...tileRect(35, 6, 36, 6), y0: 6 * T - 8, y1: 6 * T }, // sala 2, alta (solo Chispa llega)
    { id: 3, ...tileRect(43, 12, 44, 12), y0: 12 * T - 8, y1: 12 * T }, // sala 2, orilla derecha
  ];

  const doors: CoopDoor[] = [
    { id: 0, ...tileRect(13, 8, 13, 11), plates: [0, 1], levers: [] },
    { id: 1, ...tileRect(53, 8, 53, 11), plates: [], levers: [0] },
  ];

  const bridges: CoopBridge[] = [
    { id: 0, x0: 32 * T, y0: 12 * T, x1: 42 * T, y1: 12 * T + 22, plates: [2, 3] },
  ];

  const levers: CoopLever[] = [{ id: 0, x: 50.5 * T, y: 12 * T }];

  const gates: CoopGate[] = [
    { id: 0, ...tileRect(32, 3, 32, 5), character: 'chispa', disabledBy: -1 },
    { id: 1, ...tileRect(47, 8, 47, 11), character: 'bruma', disabledBy: 0 },
  ];

  const elevator: CoopElevator = {
    x0: 67 * T,
    x1: 70 * T,
    yBottom: 12 * T,
    yTop: 5 * T,
    speed: 115,
  };

  const consoles: CoopConsole[] = [
    { id: 0, x: 89.5 * T, y: 12 * T },
    { id: 1, x: 96.9 * T, y: 7 * T },
  ];

  const platforms: Rect[] = [
    // Sala 2: escalones atravesables hacia el pasillo alto
    { x0: 27 * T, y0: 10 * T, x1: 29 * T, y1: 10 * T + 18 },
    { x0: 29 * T, y0: 8 * T, x1: 31 * T, y1: 8 * T + 18 },
    // Sala 4: sobre las espinas
    { x0: 92 * T, y0: 10 * T, x1: 94 * T, y1: 10 * T + 18 },
    { x0: 94 * T + 10, y0: 8 * T, x1: 96 * T, y1: 8 * T + 18 },
  ];

  const hazards: CoopHazard[] = [
    { kind: 'water', x0: 32 * T, y0: 12.6 * T, x1: 42 * T, y1: 15 * T },
    { kind: 'thorns', x0: 92 * T, y0: 12 * T - 20, x1: 96 * T, y1: 12 * T },
  ];

  const checkpoints: CoopCheckpoint[] = [
    { x: 0, spawns: [{ x: 2.5 * T, y: 12 * T }, { x: 4.5 * T, y: 12 * T }] },
    { x: 26 * T, spawns: [{ x: 26.5 * T, y: 12 * T }, { x: 27.4 * T, y: 12 * T }] },
    { x: 58 * T, spawns: [{ x: 59.5 * T, y: 12 * T }, { x: 61 * T, y: 12 * T }] },
    { x: 87 * T, spawns: [{ x: 87.6 * T, y: 12 * T }, { x: 88.6 * T, y: 12 * T }] },
  ];

  const rooms: CoopRoom[] = [
    { name: 'Placa y puerta', clearX: 14 * T + 4 },
    { name: 'Barreras de color', clearX: 54 * T + 4 },
    { name: 'El ascensor de los dos', clearX: 70 * T + 4, clearMaxY: 5 * T + 1 },
    { name: 'Sincronía final', clearX: 104 * T },
  ];

  const signs: CoopSign[] = [
    { x: 6 * T, y: 12 * T, text: 'Una placa abre la puerta… ¡mientras alguien la pise!' },
    { x: 27.8 * T, y: 12 * T, text: 'Barrera cálida: solo Chispa. Barrera fría: solo Bruma.' },
    { x: 45 * T, y: 12 * T, text: 'El puente aguanta mientras alguien pise una placa.' },
    { x: 62 * T, y: 12 * T, text: 'El ascensor sube solo con los dos a bordo.' },
    { x: 91 * T, y: 12 * T, text: '¡Presionen las dos consolas a la vez! Cuenten hasta 3.' },
  ];

  const decor: CoopLevel['decor'] = [
    { kind: 'torch', x: 3 * T, y: 9 * T },
    { kind: 'torch', x: 11 * T, y: 9 * T },
    { kind: 'statue', x: 21 * T, y: 12 * T },
    { kind: 'vine', x: 16 * T, y: 1 * T },
    { kind: 'fern', x: 24 * T, y: 12 * T },
    { kind: 'banner', x: 33 * T, y: 3 * T },
    { kind: 'torch', x: 44 * T, y: 9 * T },
    { kind: 'crystal', x: 56 * T, y: 12 * T },
    { kind: 'vine', x: 38 * T, y: 1 * T },
    { kind: 'statue', x: 64 * T, y: 12 * T },
    { kind: 'torch', x: 60 * T, y: 9 * T },
    { kind: 'vine', x: 66 * T, y: 1 * T },
    { kind: 'fern', x: 75 * T, y: 5 * T },
    { kind: 'torch', x: 80 * T, y: 2 * T },
    { kind: 'crystal', x: 84 * T, y: 5 * T },
    { kind: 'torch', x: 90 * T, y: 9 * T },
    { kind: 'banner', x: 98 * T, y: 4 * T },
    { kind: 'statue', x: 107 * T, y: 12 * T },
    { kind: 'vine', x: 103 * T, y: 1 * T },
  ];

  return {
    cols: COOP_COLS,
    rows: COOP_ROWS,
    tile: T,
    solid,
    platforms,
    hazards,
    plates,
    doors,
    bridges,
    levers,
    gates,
    elevator,
    consoles,
    heartGate: tileRect(100, 3, 101, 11),
    exit: { x0: 104 * T, y0: 9 * T, x1: 107 * T, y1: 12 * T },
    checkpoints,
    rooms,
    signs,
    decor,
    width: COOP_COLS * T,
    height: COOP_ROWS * T,
  };
}

export function isSolidTile(level: CoopLevel, c: number, r: number): boolean {
  if (c < 0 || c >= level.cols) return true;
  if (r < 0) return true;
  if (r >= level.rows) return false;
  return level.solid[r * level.cols + c] === 1;
}
