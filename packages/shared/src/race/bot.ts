import { BTN_DOWN, BTN_ITEM, BTN_JUMP } from '../constants';
import type { RaceCourse } from './course';
import { ITEM, cloneRunner, stepRunner, type RaceTrap, type RunnerEvent, type RunnerState } from './sim';

/**
 * Piloto automático para pruebas automatizadas (tests de integración y E2E).
 * Planifica simulando hacia adelante con la misma simulación del juego:
 * prueba secuencias candidatas de botones y elige la que no choca ni cae.
 * No forma parte de la jugabilidad: el cliente solo lo activa en builds de prueba.
 */

const HORIZON = 66;

function blank(): number[] {
  return new Array<number>(HORIZON).fill(0);
}

function fill(plan: number[], from: number, len: number, bit: number): void {
  for (let i = from; i < from + len && i < HORIZON; i++) plan[i] = (plan[i] ?? 0) | bit;
}

function buildCandidates(): number[][] {
  const plans: number[][] = [blank()];
  for (const wait of [0, 2, 5, 9, 14, 20]) {
    for (const hold of [4, 10, 18, 30]) {
      const p = blank();
      fill(p, wait, hold, BTN_JUMP);
      plans.push(p);
    }
  }
  for (const wait of [0, 4, 9]) {
    for (const second of [12, 18, 24, 30]) {
      const p = blank();
      fill(p, wait, second - 3, BTN_JUMP);
      fill(p, wait + second, 18, BTN_JUMP);
      plans.push(p);
    }
  }
  for (const wait of [0, 3, 7, 12]) {
    for (const hold of [20, 36, 60]) {
      const p = blank();
      fill(p, wait, hold, BTN_DOWN);
      plans.push(p);
    }
  }
  // Salto corto y luego deslizarse (ramas después de un obstáculo bajo).
  for (const wait of [0, 4, 8]) {
    const p = blank();
    fill(p, wait, 8, BTN_JUMP);
    fill(p, wait + 30, 36, BTN_DOWN);
    plans.push(p);
  }
  return plans;
}

const CANDIDATES = buildCandidates();

export class RaceBot {
  private plan: number[] = blank();
  private sinceCheck = 0;
  private readonly events: RunnerEvent[] = [];

  constructor(private readonly course: RaceCourse) {}

  private evaluate(start: RunnerState, plan: readonly number[], traps: readonly RaceTrap[]): number {
    const s = cloneRunner(start);
    let penalty = 0;
    let stuck = 0;
    for (let i = 0; i < HORIZON; i++) {
      this.events.length = 0;
      stepRunner(s, plan[i] ?? 0, this.course, traps, this.events);
      for (const e of this.events) {
        if (e.t === 'fall') return penalty + 5000 + (HORIZON - i) * 10;
        if (e.t === 'hit' && !e.shielded) penalty += 1500 + (HORIZON - i) * 5;
        if (e.t === 'trap' && !e.shielded) penalty += 900;
        if (e.t === 'heart') penalty -= 4;
        if (e.t === 'boost') penalty -= 3;
        if (e.t === 'finish') return penalty - 50;
      }
      if (s.ground && s.stun === 0 && s.respawn === 0 && s.vx < 1) {
        stuck++;
        if (stuck === 3) penalty += 700;
      } else {
        stuck = 0;
      }
    }
    // Preferimos terminar el horizonte con más avance.
    return penalty - (s.x - start.x) * 0.01;
  }

  /** Decide los botones para el próximo tick a partir del estado actual. */
  decide(state: RunnerState, traps: readonly RaceTrap[] = []): number {
    if (state.finish >= 0 || state.respawn > 0) {
      this.plan = blank();
      return 0;
    }
    this.sinceCheck++;
    if (this.sinceCheck >= 3) {
      this.sinceCheck = 0;
      const current = this.evaluate(state, this.plan, traps);
      if (current > 0) {
        let best = current;
        let bestPlan = this.plan;
        for (const cand of CANDIDATES) {
          const score = this.evaluate(state, cand, traps);
          if (score < best - 0.5) {
            best = score;
            bestPlan = cand;
          }
        }
        this.plan = bestPlan.slice();
      }
    }
    const buttons = this.plan.shift() ?? 0;
    this.plan.push(0);
    let out = buttons;
    if (state.item !== ITEM.None && state.item !== ITEM.Pending && state.itemRoll === 0 && state.stun === 0) {
      if ((state.prevButtons & BTN_ITEM) === 0) out |= BTN_ITEM;
    }
    return out;
  }
}
