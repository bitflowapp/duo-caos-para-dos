import { BTN_ACTION, BTN_JUMP, BTN_LEFT, BTN_RIGHT, DT } from '../constants';
import type { Rect } from '../race/course';
import type { CharacterId, Pair, Slot } from '../types';
import { isSolidTile, type CoopLevel } from './level';

/**
 * Simulación determinista de "Sincronizados" (plataformas cooperativas).
 * Cada jugador se simula con sus propias entradas (como en la carrera); los
 * mecanismos (placas, puertas, puente, ascensor, consolas) son autoritativos del
 * servidor y se envían en cada snapshot.
 */

export const COOP = {
  HALF_W: 17,
  H: 56,
  MAX_SPEED: 260,
  GROUND_ACCEL: 2600,
  AIR_ACCEL: 1800,
  FRICTION: 3000,
  GRAVITY: 2300,
  JUMP_V: 790,
  JUMP_CUT_V: 280,
  MAX_FALL: 1250,
  COYOTE_TICKS: 6,
  BUFFER_TICKS: 7,
  RESPAWN_TICKS: 40,
  /** 5 minutos. */
  TIME_LIMIT_TICKS: 300 * 60,
  /** Ventana para presionar ambas consolas (0,8 s). */
  CONSOLE_WINDOW_TICKS: 48,
  DOOR_SPEED: 3.2,
  BRIDGE_EXTEND_SPEED: 4,
  BRIDGE_RETRACT_SPEED: 2.5,
  BRIDGE_HOLD_TICKS: 72,
  HEART_GATE_SPEED: 0.8,
  INTERACT_RANGE_X: 44,
  INTERACT_RANGE_Y: 40,
} as const;

export interface CoopPlayerState {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  onElevator: boolean;
  coyote: number;
  jumpBuffer: number;
  facing: 1 | -1;
  respawn: number;
  checkpoint: number;
  falls: number;
  prevButtons: number;
}

export interface CoopMech {
  plates: boolean[];
  doors: number[];
  bridges: number[];
  bridgeHold: number[];
  levers: boolean[];
  gates: boolean[];
  elevY: number;
  elevVy: number;
  /** Tick (de simulación del jugador) en que se presionó cada consola, o -1. */
  consoles: number[];
  consoleBy: number[];
  synced: boolean;
  heartGate: number;
  roomsCleared: number;
  exitCount: number;
}

export type CoopEvent =
  | { t: 'jump' }
  | { t: 'land' }
  | { t: 'fall'; kind: 'water' | 'thorns' | 'void' }
  | { t: 'respawn' }
  | { t: 'checkpoint'; index: number }
  | { t: 'lever'; id: number }
  | { t: 'console'; id: number; tick: number };

export type MechEvent =
  | { t: 'plate'; id: number; on: boolean }
  | { t: 'door'; id: number; open: boolean }
  | { t: 'bridge'; id: number; out: boolean }
  | { t: 'lever'; id: number; slot: Slot }
  | { t: 'gateOff'; id: number }
  | { t: 'console'; id: number; slot: Slot }
  | { t: 'consoleReset' }
  | { t: 'synced' }
  | { t: 'room'; index: number }
  | { t: 'exit' };

export function createCoopPlayer(level: CoopLevel, slot: Slot): CoopPlayerState {
  const spawn = level.checkpoints[0]?.spawns[slot] ?? { x: 100, y: 12 * level.tile };
  return {
    tick: 0,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    ground: true,
    onElevator: false,
    coyote: 0,
    jumpBuffer: 0,
    facing: slot === 0 ? 1 : 1,
    respawn: 0,
    checkpoint: 0,
    falls: 0,
    prevButtons: 0,
  };
}

export function cloneCoopPlayer(s: CoopPlayerState): CoopPlayerState {
  return { ...s };
}

export function createCoopMech(level: CoopLevel): CoopMech {
  return {
    plates: level.plates.map(() => false),
    doors: level.doors.map(() => 0),
    bridges: level.bridges.map(() => 0),
    bridgeHold: level.bridges.map(() => 0),
    levers: level.levers.map(() => false),
    gates: level.gates.map(() => true),
    elevY: level.elevator.yBottom,
    elevVy: 0,
    consoles: level.consoles.map(() => -1),
    consoleBy: level.consoles.map(() => -1),
    synced: false,
    heartGate: 0,
    roomsCleared: 0,
    exitCount: 0,
  };
}

export function cloneMech(m: CoopMech): CoopMech {
  return {
    ...m,
    plates: m.plates.slice(),
    doors: m.doors.slice(),
    bridges: m.bridges.slice(),
    bridgeHold: m.bridgeHold.slice(),
    levers: m.levers.slice(),
    gates: m.gates.slice(),
    consoles: m.consoles.slice(),
    consoleBy: m.consoleBy.slice(),
  };
}

function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return v + maxDelta > target ? target : v + maxDelta;
  if (v > target) return v - maxDelta < target ? target : v - maxDelta;
  return v;
}

/** Sólidos dinámicos activos para un personaje según el estado de los mecanismos. */
export function dynamicSolids(level: CoopLevel, mech: CoopMech, character: CharacterId, out: Rect[]): Rect[] {
  out.length = 0;
  level.doors.forEach((d, i) => {
    const open = mech.doors[i] ?? 0;
    const bottom = d.y1 - open * (d.y1 - d.y0);
    if (bottom - d.y0 > 2) out.push({ x0: d.x0, y0: d.y0, x1: d.x1, y1: bottom });
  });
  level.bridges.forEach((b, i) => {
    const ext = mech.bridges[i] ?? 0;
    if (ext > 0.02) out.push({ x0: b.x0, y0: b.y0, x1: b.x0 + ext * (b.x1 - b.x0), y1: b.y1 });
  });
  level.gates.forEach((g, i) => {
    if ((mech.gates[i] ?? true) && g.character !== character) out.push(g);
  });
  const hg = level.heartGate;
  const bottom = hg.y1 - mech.heartGate * (hg.y1 - hg.y0);
  if (bottom - hg.y0 > 2) out.push({ x0: hg.x0, y0: hg.y0, x1: hg.x1, y1: bottom });
  return out;
}

const scratchDyn: Rect[] = [];
const scratchTiles: Rect[] = [];

function tilesIn(level: CoopLevel, x0: number, y0: number, x1: number, y1: number, out: Rect[]): Rect[] {
  out.length = 0;
  const T = level.tile;
  const c0 = Math.floor(x0 / T);
  const c1 = Math.floor((x1 - 0.0001) / T);
  const r0 = Math.floor(y0 / T);
  const r1 = Math.floor((y1 - 0.0001) / T);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolidTile(level, c, r)) out.push({ x0: c * T, y0: r * T, x1: (c + 1) * T, y1: (r + 1) * T });
    }
  }
  return out;
}

function respawnAt(s: CoopPlayerState, level: CoopLevel, slot: Slot): void {
  const cp = level.checkpoints[s.checkpoint] ?? level.checkpoints[0];
  const spawn = cp?.spawns[slot] ?? { x: 100, y: 12 * level.tile };
  s.x = spawn.x;
  s.y = spawn.y;
  s.vx = 0;
  s.vy = 0;
  s.ground = true;
  s.onElevator = false;
  s.coyote = 0;
  s.jumpBuffer = 0;
}

/**
 * Avanza un jugador un tick. `mech` es la vista de los mecanismos a usar
 * (autoritativa en el servidor; la última recibida en el cliente).
 */
export function stepCoopPlayer(
  s: CoopPlayerState,
  buttons: number,
  level: CoopLevel,
  mech: CoopMech,
  character: CharacterId,
  slot: Slot,
  out?: CoopEvent[],
): void {
  s.tick += 1;
  const pressed = buttons & ~s.prevButtons;
  const released = ~buttons & s.prevButtons;
  s.prevButtons = buttons;

  if (s.respawn > 0) {
    s.respawn--;
    if (s.respawn === 0) {
      respawnAt(s, level, slot);
      out?.push({ t: 'respawn' });
    }
    return;
  }

  const el = level.elevator;
  // Si estaba parado en el ascensor, lo acompaña.
  if (s.onElevator) {
    if (s.x + COOP.HALF_W > el.x0 && s.x - COOP.HALF_W < el.x1) {
      s.y = mech.elevY;
    } else {
      s.onElevator = false;
    }
  }

  // Movimiento horizontal
  const left = (buttons & BTN_LEFT) !== 0;
  const right = (buttons & BTN_RIGHT) !== 0;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir !== 0) {
    s.facing = dir > 0 ? 1 : -1;
    const accel = s.ground ? COOP.GROUND_ACCEL : COOP.AIR_ACCEL;
    s.vx = approach(s.vx, dir * COOP.MAX_SPEED, accel * DT);
  } else {
    s.vx = approach(s.vx, 0, (s.ground ? COOP.FRICTION : COOP.AIR_ACCEL * 0.6) * DT);
  }

  // Salto
  if (pressed & BTN_JUMP) s.jumpBuffer = COOP.BUFFER_TICKS;
  else if (s.jumpBuffer > 0) s.jumpBuffer--;
  if (s.ground) s.coyote = COOP.COYOTE_TICKS;
  else if (s.coyote > 0) s.coyote--;
  if (s.jumpBuffer > 0 && (s.ground || s.coyote > 0)) {
    s.vy = -COOP.JUMP_V;
    s.ground = false;
    s.onElevator = false;
    s.coyote = 0;
    s.jumpBuffer = 0;
    out?.push({ t: 'jump' });
  }
  if ((released & BTN_JUMP) !== 0 && s.vy < -COOP.JUMP_CUT_V) s.vy = -COOP.JUMP_CUT_V;

  s.vy += COOP.GRAVITY * DT;
  if (s.vy > COOP.MAX_FALL) s.vy = COOP.MAX_FALL;

  const dyn = dynamicSolids(level, mech, character, scratchDyn);
  const EPS = 0.001;

  // Eje X
  s.x += s.vx * DT;
  {
    const ax0 = s.x - COOP.HALF_W;
    const ax1 = s.x + COOP.HALF_W;
    const ay0 = s.y - COOP.H;
    const ay1 = s.y;
    const tiles = tilesIn(level, ax0, ay0 + 0.5, ax1, ay1 - 0.5, scratchTiles);
    for (const list of [tiles, dyn]) {
      for (const r of list) {
        const bx0 = s.x - COOP.HALF_W;
        const bx1 = s.x + COOP.HALF_W;
        if (bx0 < r.x1 && bx1 > r.x0 && ay0 < r.y1 - EPS && ay1 > r.y0 + 0.5) {
          const center = (r.x0 + r.x1) / 2;
          if (s.vx > 0 || (s.vx === 0 && s.x < center)) s.x = r.x0 - COOP.HALF_W - EPS;
          else s.x = r.x1 + COOP.HALF_W + EPS;
          s.vx = 0;
        }
      }
    }
  }

  // Eje Y
  const prevY = s.y;
  s.y += s.vy * DT;
  const wasGround = s.ground;
  s.ground = false;
  s.onElevator = false;
  {
    const ax0 = s.x - COOP.HALF_W;
    const ax1 = s.x + COOP.HALF_W;
    if (s.vy >= 0) {
      let land = Infinity;
      let landElev = false;
      const tiles = tilesIn(level, ax0 + 0.5, prevY - 1, ax1 - 0.5, s.y + 1, scratchTiles);
      for (const list of [tiles, dyn]) {
        for (const r of list) {
          if (ax0 < r.x1 && ax1 > r.x0 && prevY <= r.y0 + 0.5 && s.y >= r.y0 && r.y0 < land) {
            land = r.y0;
            landElev = false;
          }
        }
      }
      for (const p of level.platforms) {
        if (ax0 < p.x1 && ax1 > p.x0 && prevY <= p.y0 + 0.5 && s.y >= p.y0 && p.y0 < land) {
          land = p.y0;
          landElev = false;
        }
      }
      // Ascensor (plataforma atravesable que se mueve)
      if (ax0 < el.x1 && ax1 > el.x0 && prevY <= mech.elevY + 4 && s.y >= mech.elevY && mech.elevY <= land) {
        land = mech.elevY;
        landElev = true;
      }
      if (land !== Infinity) {
        s.y = land;
        s.vy = 0;
        s.ground = true;
        s.onElevator = landElev;
        if (!wasGround) out?.push({ t: 'land' });
      }
    } else {
      const ay0 = s.y - COOP.H;
      const tiles = tilesIn(level, ax0 + 0.5, ay0, ax1 - 0.5, prevY - COOP.H + 1, scratchTiles);
      for (const list of [tiles, dyn]) {
        for (const r of list) {
          if (ax0 < r.x1 && ax1 > r.x0 && prevY - COOP.H >= r.y1 - 0.5 && s.y - COOP.H < r.y1) {
            s.y = r.y1 + COOP.H;
            s.vy = 0;
          }
        }
      }
    }
  }

  // Interacciones (botón ACCIÓN)
  if ((pressed & BTN_ACTION) !== 0) {
    for (const lv of level.levers) {
      if (
        !mech.levers[lv.id] &&
        Math.abs(s.x - lv.x) < COOP.INTERACT_RANGE_X &&
        Math.abs(s.y - lv.y) < COOP.INTERACT_RANGE_Y
      ) {
        out?.push({ t: 'lever', id: lv.id });
      }
    }
    for (const c of level.consoles) {
      if (Math.abs(s.x - c.x) < COOP.INTERACT_RANGE_X && Math.abs(s.y - c.y) < COOP.INTERACT_RANGE_Y) {
        out?.push({ t: 'console', id: c.id, tick: s.tick });
      }
    }
  }

  // Peligros
  const ax0 = s.x - COOP.HALF_W + 3;
  const ax1 = s.x + COOP.HALF_W - 3;
  const ay0 = s.y - COOP.H + 4;
  const ay1 = s.y;
  for (const hz of level.hazards) {
    if (ax0 < hz.x1 && ax1 > hz.x0 && ay0 < hz.y1 && ay1 > hz.y0) {
      killPlayer(s, out, hz.kind);
      return;
    }
  }
  if (s.y > level.height + 120) {
    killPlayer(s, out, 'void');
    return;
  }

  // Puntos de control (cada jugador el suyo)
  while (s.checkpoint + 1 < level.checkpoints.length) {
    const next = level.checkpoints[s.checkpoint + 1];
    if (!next || s.x < next.x) break;
    s.checkpoint++;
    out?.push({ t: 'checkpoint', index: s.checkpoint });
  }
}

function killPlayer(s: CoopPlayerState, out: CoopEvent[] | undefined, kind: 'water' | 'thorns' | 'void'): void {
  s.falls++;
  s.respawn = COOP.RESPAWN_TICKS;
  s.vx = 0;
  s.vy = 0;
  s.onElevator = false;
  out?.push({ t: 'fall', kind });
}

function overlapsPlayer(s: CoopPlayerState, r: Rect, pad = 0): boolean {
  return (
    s.respawn === 0 &&
    s.x - COOP.HALF_W < r.x1 + pad &&
    s.x + COOP.HALF_W > r.x0 - pad &&
    s.y - COOP.H < r.y1 + pad &&
    s.y > r.y0 - pad
  );
}

export interface MechPlayer {
  state: CoopPlayerState;
  character: CharacterId;
}

/** Aplica un evento de interacción producido por la simulación de un jugador. */
export function applyCoopInteraction(
  mech: CoopMech,
  level: CoopLevel,
  ev: CoopEvent,
  slot: Slot,
  events: MechEvent[],
): void {
  if (ev.t === 'lever') {
    if (!mech.levers[ev.id]) {
      mech.levers[ev.id] = true;
      events.push({ t: 'lever', id: ev.id, slot });
      level.gates.forEach((g, i) => {
        if (g.disabledBy === ev.id && mech.gates[i]) {
          mech.gates[i] = false;
          events.push({ t: 'gateOff', id: i });
        }
      });
    }
  } else if (ev.t === 'console') {
    if (mech.synced) return;
    const other = ev.id === 0 ? 1 : 0;
    const otherTick = mech.consoles[other] ?? -1;
    if (otherTick >= 0 && mech.consoleBy[other] !== slot && Math.abs(ev.tick - otherTick) <= COOP.CONSOLE_WINDOW_TICKS) {
      mech.consoles[ev.id] = ev.tick;
      mech.consoleBy[ev.id] = slot;
      mech.synced = true;
      events.push({ t: 'console', id: ev.id, slot });
      events.push({ t: 'synced' });
    } else {
      mech.consoles[ev.id] = ev.tick;
      mech.consoleBy[ev.id] = slot;
      events.push({ t: 'console', id: ev.id, slot });
    }
  }
}

/**
 * Actualiza los mecanismos un tick a partir de las posiciones de los jugadores.
 * `minTick` es el menor tick procesado entre ambos jugadores (para vencer consolas).
 */
export function updateCoopMech(
  mech: CoopMech,
  level: CoopLevel,
  players: Pair<MechPlayer>,
  minTick: number,
  events: MechEvent[],
): void {
  // Placas
  level.plates.forEach((p, i) => {
    const on = players.some((pl) => pl.state.ground && overlapsPlayer(pl.state, p, 1));
    if (on !== mech.plates[i]) {
      mech.plates[i] = on;
      events.push({ t: 'plate', id: i, on });
    }
  });

  // Puertas
  level.doors.forEach((d, i) => {
    const target = d.plates.some((id) => mech.plates[id]) || d.levers.some((id) => mech.levers[id]) ? 1 : 0;
    const cur = mech.doors[i] ?? 0;
    let next = approach(cur, target, COOP.DOOR_SPEED * DT);
    if (next < cur && players.some((pl) => overlapsPlayer(pl.state, d))) next = cur; // sensor de seguridad
    if (cur < 0.99 && next >= 0.99) events.push({ t: 'door', id: i, open: true });
    if (cur > 0.01 && next <= 0.01) events.push({ t: 'door', id: i, open: false });
    mech.doors[i] = next;
  });

  // Puentes (se sostienen un ratito después de soltar la placa)
  level.bridges.forEach((b, i) => {
    const active = b.plates.some((id) => mech.plates[id]);
    if (active) mech.bridgeHold[i] = COOP.BRIDGE_HOLD_TICKS;
    else if ((mech.bridgeHold[i] ?? 0) > 0) mech.bridgeHold[i] = (mech.bridgeHold[i] ?? 0) - 1;
    const target = (mech.bridgeHold[i] ?? 0) > 0 ? 1 : 0;
    const cur = mech.bridges[i] ?? 0;
    const speed = target > cur ? COOP.BRIDGE_EXTEND_SPEED : COOP.BRIDGE_RETRACT_SPEED;
    const next = approach(cur, target, speed * DT);
    if (cur < 0.99 && next >= 0.99) events.push({ t: 'bridge', id: i, out: true });
    if (cur > 0.01 && next <= 0.01) events.push({ t: 'bridge', id: i, out: false });
    mech.bridges[i] = next;
  });

  // Ascensor: sube con los dos, baja vacío, se queda quieto con uno.
  const el = level.elevator;
  const riders = players.filter(
    (pl) => pl.state.onElevator && pl.state.respawn === 0 && pl.state.x + COOP.HALF_W > el.x0 && pl.state.x - COOP.HALF_W < el.x1,
  ).length;
  const target = riders === 2 ? el.yTop : riders === 0 ? el.yBottom : mech.elevY;
  const prevElev = mech.elevY;
  mech.elevY = approach(mech.elevY, target, el.speed * DT);
  mech.elevVy = (mech.elevY - prevElev) / DT;

  // Consolas vencidas
  if (!mech.synced) {
    let reset = false;
    mech.consoles.forEach((t, i) => {
      if (t >= 0 && minTick > t + COOP.CONSOLE_WINDOW_TICKS) {
        mech.consoles[i] = -1;
        mech.consoleBy[i] = -1;
        reset = true;
      }
    });
    if (reset) events.push({ t: 'consoleReset' });
  } else if (mech.heartGate < 1) {
    mech.heartGate = approach(mech.heartGate, 1, COOP.HEART_GATE_SPEED * DT);
  }

  // Salas superadas
  while (mech.roomsCleared < level.rooms.length - 1) {
    const room = level.rooms[mech.roomsCleared];
    if (!room) break;
    const ok = players.every(
      (pl) =>
        pl.state.respawn === 0 &&
        pl.state.x > room.clearX &&
        (room.clearMaxY === undefined || pl.state.y <= room.clearMaxY),
    );
    if (!ok) break;
    mech.roomsCleared++;
    events.push({ t: 'room', index: mech.roomsCleared - 1 });
  }

  // Salida: ambos dentro del portal
  const inside = players.filter((pl) => overlapsPlayer(pl.state, level.exit)).length;
  mech.exitCount = inside;
  if (inside === 2 && mech.synced) {
    if (mech.roomsCleared < level.rooms.length) {
      mech.roomsCleared = level.rooms.length;
      events.push({ t: 'room', index: level.rooms.length - 1 });
    }
    events.push({ t: 'exit' });
  }
}

/** Estrellas según tiempo y caídas totales. */
export function coopStars(timeTicks: number, totalFalls: number): 1 | 2 | 3 {
  const secs = timeTicks / 60;
  if (secs <= 150 && totalFalls <= 4) return 3;
  if (secs <= 240) return 2;
  return 1;
}

export function coopPlayersMatch(a: CoopPlayerState, b: CoopPlayerState, eps = 0.01): boolean {
  return (
    Math.abs(a.x - b.x) <= eps &&
    Math.abs(a.y - b.y) <= eps &&
    Math.abs(a.vx - b.vx) <= eps &&
    Math.abs(a.vy - b.vy) <= eps &&
    a.ground === b.ground &&
    a.onElevator === b.onElevator &&
    a.respawn === b.respawn &&
    a.checkpoint === b.checkpoint &&
    a.coyote === b.coyote &&
    a.jumpBuffer === b.jumpBuffer &&
    a.prevButtons === b.prevButtons &&
    a.tick === b.tick
  );
}

/** ¿Hay una palanca o consola al alcance? (para resaltar el botón ACCIÓN) */
export function nearInteractable(s: CoopPlayerState, level: CoopLevel, mech: CoopMech): 'lever' | 'console' | null {
  for (const lv of level.levers) {
    if (!mech.levers[lv.id] && Math.abs(s.x - lv.x) < COOP.INTERACT_RANGE_X && Math.abs(s.y - lv.y) < COOP.INTERACT_RANGE_Y) {
      return 'lever';
    }
  }
  if (!mech.synced) {
    for (const c of level.consoles) {
      if (Math.abs(s.x - c.x) < COOP.INTERACT_RANGE_X && Math.abs(s.y - c.y) < COOP.INTERACT_RANGE_Y) return 'console';
    }
  }
  return null;
}
