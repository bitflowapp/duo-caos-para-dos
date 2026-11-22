import { BTN_DOWN, BTN_ITEM, BTN_JUMP, DT } from '../constants';
import type { Slot } from '../types';
import { chaosAt, type Hazard, type HazardKind, type Pickup, type RaceCourse, type Rect } from './course';

/**
 * Simulación determinista de un corredor. Solo usa aritmética básica de IEEE-754
 * para que servidor (V8) y navegadores (V8/JavaScriptCore) produzcan los mismos
 * resultados con las mismas entradas.
 */

export const RACE = {
  BASE_SPEED: 340,
  ACCEL: 1500,
  DECEL: 2600,
  GRAVITY: 2500,
  MAX_FALL: 1500,
  JUMP_V: 860,
  DJUMP_V: 720,
  JUMP_CUT_V: 320,
  DIVE_V: 1150,
  COYOTE_TICKS: 6,
  BUFFER_TICKS: 7,
  HALF_W: 18,
  H_STAND: 62,
  H_SLIDE: 32,
  SPRING_V: 1320,
  STUN_HIT: 36,
  STUN_SLIP: 50,
  STUN_KISS: 62,
  KNOCKBACK_VX: -220,
  KNOCKBACK_VY: -380,
  INVULN_HIT: 90,
  INVULN_RESPAWN: 70,
  RESPAWN_TICKS: 45,
  BOOST_PAD_TICKS: 75,
  BOOST_TURBO_TICKS: 130,
  BOOST_MULT: 1.55,
  SLOW_TICKS: 240,
  SLOW_MULT: 0.62,
  MUD_MULT: 0.55,
  MUD_JUMP_MULT: 0.85,
  SHIELD_TICKS: 420,
  ITEM_ROLL_TICKS: 48,
  HEART_R: 18,
  BOX_R: 26,
  TRAP_HALF_W: 22,
  TRAP_H: 16,
  /** Límite total de la carrera (2:40). */
  TIME_LIMIT_TICKS: 160 * 60,
  /** Tras el primer llegado, el otro tiene 12 s. */
  FINISH_GRACE_TICKS: 12 * 60,
  /** Demora del beso volador hasta impactar. */
  KISS_FLIGHT_TICKS: 30,
  HAZARD_FORGIVE: 4,
} as const;

export const ITEM = {
  None: 0,
  Turbo: 1,
  Peel: 2,
  Cloud: 3,
  Kiss: 4,
  Shield: 5,
  Pending: 9,
} as const;
export type ItemId = (typeof ITEM)[keyof typeof ITEM];
export const USABLE_ITEMS = [ITEM.Turbo, ITEM.Peel, ITEM.Cloud, ITEM.Kiss, ITEM.Shield] as const;

export const STUN_KIND = { None: 0, Hit: 1, Slip: 2, Kiss: 3 } as const;
export type StunKind = (typeof STUN_KIND)[keyof typeof STUN_KIND];

export interface RunnerState {
  /** Último tick simulado (el estado corresponde al final de ese tick). */
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  coyote: number;
  jumpBuffer: number;
  /** Saltos usados desde que tocó suelo (0, 1 o 2). */
  jumps: number;
  sliding: boolean;
  stun: number;
  stunKind: StunKind;
  invuln: number;
  boost: number;
  slow: number;
  shield: number;
  respawn: number;
  checkpoint: number;
  item: ItemId;
  itemRoll: number;
  hearts: number;
  heartMask: number[];
  boxMask: number[];
  hits: number;
  falls: number;
  itemsUsed: number;
  /** Tick con fracción en que cruzó la meta; -1 si no llegó. */
  finish: number;
  prevButtons: number;
}

export interface RaceTrap {
  id: number;
  x: number;
  y: number;
  owner: Slot;
}

export type RunnerEvent =
  | { t: 'jump'; double: boolean }
  | { t: 'land' }
  | { t: 'hit'; kind: HazardKind; shielded: boolean }
  | { t: 'trap'; id: number; shielded: boolean }
  | { t: 'fall' }
  | { t: 'respawn' }
  | { t: 'heart'; id: number }
  | { t: 'box'; id: number }
  | { t: 'use'; item: ItemId; x: number; y: number }
  | { t: 'spring' }
  | { t: 'boost' }
  | { t: 'checkpoint'; index: number }
  | { t: 'finish'; time: number };

function maskWords(n: number): number[] {
  return new Array<number>(Math.max(1, Math.ceil(n / 32))).fill(0);
}

export function createRunner(course: RaceCourse): RunnerState {
  return {
    tick: 0,
    x: course.startX,
    y: 0,
    vx: 0,
    vy: 0,
    ground: true,
    coyote: 0,
    jumpBuffer: 0,
    jumps: 0,
    sliding: false,
    stun: 0,
    stunKind: STUN_KIND.None,
    invuln: 0,
    boost: 0,
    slow: 0,
    shield: 0,
    respawn: 0,
    checkpoint: 0,
    item: ITEM.None,
    itemRoll: 0,
    hearts: 0,
    heartMask: maskWords(course.hearts.length),
    boxMask: maskWords(course.boxes.length),
    hits: 0,
    falls: 0,
    itemsUsed: 0,
    finish: -1,
    prevButtons: 0,
  };
}

export function cloneRunner(s: RunnerState): RunnerState {
  return { ...s, heartMask: s.heartMask.slice(), boxMask: s.boxMask.slice() };
}

export function copyRunnerInto(dst: RunnerState, src: RunnerState): void {
  Object.assign(dst, src);
  dst.heartMask = src.heartMask.slice();
  dst.boxMask = src.boxMask.slice();
}

function getBit(mask: number[], i: number): boolean {
  return ((mask[i >> 5] ?? 0) & (1 << (i & 31))) !== 0;
}
function setBit(mask: number[], i: number): void {
  mask[i >> 5] = (mask[i >> 5] ?? 0) | (1 << (i & 31));
}

export function heartCollected(s: RunnerState, id: number): boolean {
  return getBit(s.heartMask, id);
}
export function boxTaken(s: RunnerState, id: number): boolean {
  return getBit(s.boxMask, id);
}

function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return v + maxDelta > target ? target : v + maxDelta;
  if (v > target) return v - maxDelta < target ? target : v - maxDelta;
  return v;
}

function overlaps(ax0: number, ay0: number, ax1: number, ay1: number, r: Rect): boolean {
  return ax0 < r.x1 && ax1 > r.x0 && ay0 < r.y1 && ay1 > r.y0;
}

function circleHits(ax0: number, ay0: number, ax1: number, ay1: number, p: Pickup, r: number): boolean {
  const cx = p.x < ax0 ? ax0 : p.x > ax1 ? ax1 : p.x;
  const cy = p.y < ay0 ? ay0 : p.y > ay1 ? ay1 : p.y;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy <= r * r;
}

export function runnerHeight(s: RunnerState): number {
  return s.sliding ? RACE.H_SLIDE : RACE.H_STAND;
}

// Arreglos de trabajo reutilizables (la simulación es síncrona; no hay reentrada).
const scratchRects: Rect[] = [];
const scratchHazards: Hazard[] = [];

/** Velocidad objetivo según modificadores. */
function targetSpeed(s: RunnerState, inMud: boolean, chaosKind: string | null): number {
  let v: number = RACE.BASE_SPEED;
  if (s.boost > 0) v *= RACE.BOOST_MULT;
  if (s.slow > 0) v *= RACE.SLOW_MULT;
  if (inMud) v *= RACE.MUD_MULT;
  if (chaosKind === 'speed') v *= 1.3;
  else if (chaosKind === 'wind') v *= 0.8;
  return v;
}

function respawnRunner(s: RunnerState, course: RaceCourse): void {
  const cp = course.checkpoints[s.checkpoint] ?? { x: course.startX, y: 0 };
  s.x = cp.x;
  s.y = cp.y;
  s.vx = RACE.BASE_SPEED * 0.4;
  s.vy = 0;
  s.ground = true;
  s.coyote = 0;
  s.jumps = 0;
  s.jumpBuffer = 0;
  s.sliding = false;
  s.stun = 0;
  s.stunKind = STUN_KIND.None;
  s.boost = 0;
  s.invuln = RACE.INVULN_RESPAWN;
}

/**
 * Avanza el corredor un tick con los botones indicados. Muta `s`.
 * Los eventos producidos se agregan a `out` (si se pasa).
 */
export function stepRunner(
  s: RunnerState,
  buttons: number,
  course: RaceCourse,
  traps: readonly RaceTrap[],
  out?: RunnerEvent[],
): void {
  s.tick += 1;
  const pressed = buttons & ~s.prevButtons;
  const released = ~buttons & s.prevButtons;
  s.prevButtons = buttons;

  if (s.invuln > 0) s.invuln--;
  if (s.boost > 0) s.boost--;
  if (s.slow > 0) s.slow--;
  if (s.shield > 0) s.shield--;
  if (s.itemRoll > 0) s.itemRoll--;

  // Después de cruzar la meta: trote de festejo hasta detenerse.
  if (s.finish >= 0) {
    s.vx = approach(s.vx, 0, RACE.DECEL * 0.25 * DT);
    s.sliding = false;
    s.stun = 0;
    s.stunKind = STUN_KIND.None;
    integrate(s, course, out, 1);
    return;
  }

  if (s.respawn > 0) {
    s.respawn--;
    if (s.respawn === 0) {
      respawnRunner(s, course);
      out?.push({ t: 'respawn' });
    }
    return;
  }

  const chaos = chaosAt(course, s.tick);
  const gravMult = chaos === 'lowgrav' ? 0.55 : 1;
  const jumpChaos = chaos === 'lowgrav' ? 0.8 : 1;

  // ¿Está en barro? (con la caja del tick anterior)
  const h0 = runnerHeight(s);
  let inMud = false;
  course.index.mud.query(s.x - RACE.HALF_W, s.x + RACE.HALF_W, scratchRects);
  for (const r of scratchRects) {
    if (overlaps(s.x - RACE.HALF_W, s.y - h0, s.x + RACE.HALF_W, s.y, r)) {
      inMud = true;
      break;
    }
  }

  let target = targetSpeed(s, inMud, chaos);
  if (s.stun > 0) {
    s.stun--;
    target = 0;
    if (s.stun === 0) s.stunKind = STUN_KIND.None;
  }
  const canAct = s.stun === 0;
  s.vx = approach(s.vx, target, (target > s.vx ? RACE.ACCEL : RACE.DECEL) * DT);

  // Salto con buffer + coyote time + doble salto.
  if (pressed & BTN_JUMP) s.jumpBuffer = RACE.BUFFER_TICKS;
  else if (s.jumpBuffer > 0) s.jumpBuffer--;
  if (s.ground) {
    s.coyote = RACE.COYOTE_TICKS;
    s.jumps = 0;
  } else if (s.coyote > 0) {
    s.coyote--;
  }

  const jumpMult = (inMud ? RACE.MUD_JUMP_MULT : 1) * jumpChaos;
  if (canAct && s.jumpBuffer > 0) {
    if (s.ground || (s.coyote > 0 && s.jumps === 0)) {
      s.vy = -RACE.JUMP_V * jumpMult;
      s.ground = false;
      s.coyote = 0;
      s.jumps = 1;
      s.jumpBuffer = 0;
      s.sliding = false;
      out?.push({ t: 'jump', double: false });
    } else if (s.jumps < 2 && (pressed & BTN_JUMP) !== 0) {
      s.vy = -RACE.DJUMP_V * jumpMult;
      s.jumps = 2;
      s.jumpBuffer = 0;
      out?.push({ t: 'jump', double: true });
    }
  }
  if ((released & BTN_JUMP) !== 0 && s.vy < -RACE.JUMP_CUT_V) {
    s.vy = -RACE.JUMP_CUT_V;
  }

  // Deslizarse en el suelo o "clavado" en el aire.
  const down = (buttons & BTN_DOWN) !== 0;
  if (s.ground) {
    s.sliding = down && canAct;
  } else {
    s.sliding = false;
    if ((pressed & BTN_DOWN) !== 0 && canAct && s.vy < RACE.DIVE_V) s.vy = RACE.DIVE_V;
  }

  s.vy += RACE.GRAVITY * gravMult * DT;
  if (s.vy > RACE.MAX_FALL) s.vy = RACE.MAX_FALL;

  const prevX = s.x;
  integrate(s, course, out, gravMult);

  // Interacciones con la caja final del tick.
  const h = runnerHeight(s);
  const ax0 = s.x - RACE.HALF_W;
  const ax1 = s.x + RACE.HALF_W;
  const ay0 = s.y - h;
  const ay1 = s.y;

  // Resortes: se activan al tocarlos sin estar subiendo.
  if (s.vy >= 0) {
    course.index.springs.query(ax0, ax1, scratchRects);
    for (const r of scratchRects) {
      if (overlaps(ax0, ay0, ax1, ay1 + 1, r)) {
        s.vy = -RACE.SPRING_V * jumpChaos;
        s.ground = false;
        s.jumps = 1;
        s.coyote = 0;
        s.sliding = false;
        out?.push({ t: 'spring' });
        break;
      }
    }
  }

  // Flechas turbo.
  course.index.boosts.query(ax0, ax1, scratchRects);
  for (const r of scratchRects) {
    if (overlaps(ax0, ay0, ax1, ay1, r)) {
      if (s.boost < RACE.BOOST_PAD_TICKS - 15) out?.push({ t: 'boost' });
      if (s.boost < RACE.BOOST_PAD_TICKS) s.boost = RACE.BOOST_PAD_TICKS;
      break;
    }
  }

  // Obstáculos.
  if (s.invuln === 0 && s.stun === 0) {
    const f = RACE.HAZARD_FORGIVE;
    for (const hz of course.index.hazards.query(ax0, ax1, scratchHazards)) {
      if (ax0 < hz.x1 - f && ax1 > hz.x0 + f && ay0 < hz.y1 - f && ay1 > hz.y0 + f) {
        if (s.shield > 0) {
          s.shield = 0;
          s.invuln = 40;
          out?.push({ t: 'hit', kind: hz.kind, shielded: true });
        } else {
          s.stun = RACE.STUN_HIT;
          s.stunKind = STUN_KIND.Hit;
          s.invuln = RACE.INVULN_HIT;
          s.vx = RACE.KNOCKBACK_VX;
          if (s.vy > RACE.KNOCKBACK_VY) s.vy = RACE.KNOCKBACK_VY;
          s.ground = false;
          s.sliding = false;
          s.hits++;
          out?.push({ t: 'hit', kind: hz.kind, shielded: false });
        }
        break;
      }
    }
  }

  // Trampas (cáscaras de mango) dejadas por el rival.
  if (s.invuln === 0) {
    for (const tr of traps) {
      if (
        ax0 < tr.x + RACE.TRAP_HALF_W &&
        ax1 > tr.x - RACE.TRAP_HALF_W &&
        ay0 < tr.y &&
        ay1 > tr.y - RACE.TRAP_H
      ) {
        if (s.shield > 0) {
          s.shield = 0;
          s.invuln = 40;
          out?.push({ t: 'trap', id: tr.id, shielded: true });
        } else {
          s.stun = RACE.STUN_SLIP;
          s.stunKind = STUN_KIND.Slip;
          s.invuln = RACE.INVULN_HIT;
          s.vx = s.vx * 0.3;
          s.sliding = false;
          s.hits++;
          out?.push({ t: 'trap', id: tr.id, shielded: false });
        }
        break;
      }
    }
  }

  // Corazones y Cajas del Caos (cada jugador tiene los suyos).
  const hearts = course.hearts;
  for (let i = 0; i < hearts.length; i++) {
    const p = hearts[i] as Pickup;
    if (p.x < ax0 - 40) continue;
    if (p.x > ax1 + 40) break;
    if (!getBit(s.heartMask, p.id) && circleHits(ax0, ay0, ax1, ay1, p, RACE.HEART_R)) {
      setBit(s.heartMask, p.id);
      s.hearts++;
      out?.push({ t: 'heart', id: p.id });
    }
  }
  for (const p of course.boxes) {
    if (p.x < ax0 - 60 || p.x > ax1 + 60) continue;
    if (s.item === ITEM.None && !getBit(s.boxMask, p.id) && circleHits(ax0, ay0, ax1, ay1, p, RACE.BOX_R)) {
      setBit(s.boxMask, p.id);
      s.item = ITEM.Pending;
      s.itemRoll = RACE.ITEM_ROLL_TICKS;
      out?.push({ t: 'box', id: p.id });
    }
  }

  // Caída a un pozo.
  if (s.y > course.deathY) {
    s.falls++;
    s.respawn = RACE.RESPAWN_TICKS;
    s.vx = 0;
    s.vy = 0;
    s.sliding = false;
    s.stun = 0;
    s.stunKind = STUN_KIND.None;
    out?.push({ t: 'fall' });
    return;
  }

  // Puntos de control.
  while (s.checkpoint + 1 < course.checkpoints.length) {
    const next = course.checkpoints[s.checkpoint + 1];
    if (!next || s.x < next.x) break;
    s.checkpoint++;
    out?.push({ t: 'checkpoint', index: s.checkpoint });
  }

  // Meta: tiempo con fracción interpolada dentro del tick.
  if (s.x >= course.finishX) {
    const span = s.x - prevX;
    const frac = span > 0 ? (course.finishX - prevX) / span : 1;
    s.finish = s.tick - 1 + (frac < 0 ? 0 : frac > 1 ? 1 : frac);
    s.boost = 0;
    out?.push({ t: 'finish', time: s.finish });
    return;
  }

  // Uso de ítem.
  if ((pressed & BTN_ITEM) !== 0 && canAct && s.itemRoll === 0 && s.item !== ITEM.None && s.item !== ITEM.Pending) {
    const item = s.item;
    s.item = ITEM.None;
    s.itemsUsed++;
    if (item === ITEM.Turbo) {
      s.boost = RACE.BOOST_TURBO_TICKS;
    } else if (item === ITEM.Shield) {
      s.shield = RACE.SHIELD_TICKS;
    }
    out?.push({ t: 'use', item, x: s.x, y: s.y });
  }
}

/** Movimiento con colisiones contra sólidos y plataformas. */
function integrate(s: RunnerState, course: RaceCourse, out: RunnerEvent[] | undefined, gravMult: number): void {
  if (s.finish >= 0) {
    s.vy += RACE.GRAVITY * gravMult * DT;
    if (s.vy > RACE.MAX_FALL) s.vy = RACE.MAX_FALL;
  }
  const h = runnerHeight(s);
  const EPS = 0.001;

  // Eje X
  s.x += s.vx * DT;
  course.index.solids.query(s.x - RACE.HALF_W - 1, s.x + RACE.HALF_W + 1, scratchRects);
  for (const r of scratchRects) {
    const ax0 = s.x - RACE.HALF_W;
    const ax1 = s.x + RACE.HALF_W;
    if (ax0 < r.x1 && ax1 > r.x0 && s.y - h < r.y1 - EPS && s.y > r.y0 + 0.5) {
      if (s.vx >= 0) {
        s.x = r.x0 - RACE.HALF_W - EPS;
      } else {
        s.x = r.x1 + RACE.HALF_W + EPS;
      }
      s.vx = 0;
    }
  }

  // Eje Y
  const prevY = s.y;
  s.y += s.vy * DT;
  const wasGround = s.ground;
  s.ground = false;
  const ax0 = s.x - RACE.HALF_W;
  const ax1 = s.x + RACE.HALF_W;
  if (s.vy >= 0) {
    let landY = Infinity;
    course.index.solids.query(ax0, ax1, scratchRects);
    for (const r of scratchRects) {
      if (ax0 < r.x1 && ax1 > r.x0 && prevY <= r.y0 + 0.5 && s.y >= r.y0) {
        if (r.y0 < landY) landY = r.y0;
      }
    }
    course.index.platforms.query(ax0, ax1, scratchRects);
    for (const r of scratchRects) {
      if (ax0 < r.x1 && ax1 > r.x0 && prevY <= r.y0 + 0.5 && s.y >= r.y0) {
        if (r.y0 < landY) landY = r.y0;
      }
    }
    if (landY !== Infinity) {
      s.y = landY;
      s.vy = 0;
      s.ground = true;
      if (!wasGround) out?.push({ t: 'land' });
    }
  } else {
    course.index.solids.query(ax0, ax1, scratchRects);
    for (const r of scratchRects) {
      if (ax0 < r.x1 && ax1 > r.x0 && prevY - h >= r.y1 - 0.5 && s.y - h < r.y1) {
        s.y = r.y1 + h;
        s.vy = 0;
      }
    }
  }
}

/**
 * Efectos externos aplicados por el servidor (ítems del rival).
 * Devuelve 'blocked' si el escudo lo absorbió.
 */
export function applyRunnerEffect(s: RunnerState, effect: 'slow' | 'kiss'): 'applied' | 'blocked' | 'ignored' {
  if (s.finish >= 0 || s.respawn > 0) return 'ignored';
  if (s.shield > 0) {
    s.shield = 0;
    if (s.invuln < 30) s.invuln = 30;
    return 'blocked';
  }
  if (effect === 'slow') {
    s.slow = RACE.SLOW_TICKS;
  } else {
    s.stun = RACE.STUN_KISS;
    s.stunKind = STUN_KIND.Kiss;
    s.vx = s.vx * 0.2;
    s.sliding = false;
  }
  return 'applied';
}

/** Progreso 0..1 en la pista. */
export function runnerProgress(s: RunnerState, course: RaceCourse): number {
  if (s.finish >= 0) return 1;
  const p = (s.x - course.startX) / (course.finishX - course.startX);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

const NUMERIC_KEYS = ['x', 'y', 'vx', 'vy'] as const;
const EXACT_KEYS = [
  'tick',
  'ground',
  'jumps',
  'sliding',
  'stun',
  'invuln',
  'boost',
  'slow',
  'shield',
  'respawn',
  'checkpoint',
  'item',
  'itemRoll',
  'hearts',
  'finish',
  'coyote',
  'jumpBuffer',
  'prevButtons',
] as const;

/** Compara dos estados con tolerancia en posiciones (para reconciliación). */
export function runnersMatch(a: RunnerState, b: RunnerState, eps = 0.01): boolean {
  for (const k of NUMERIC_KEYS) {
    if (Math.abs(a[k] - b[k]) > eps) return false;
  }
  for (const k of EXACT_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
