import { BTN_ACTION, BTN_JUMP, BTN_LEFT, BTN_RIGHT } from '../constants';
import type { CharacterId } from '../types';
import { TILE, type CoopLevel } from './level';
import { COOP, type CoopMech, type CoopPlayerState } from './sim';

/**
 * Bot guionado que resuelve "El Templo de los Dos Corazones" en pareja.
 * Solo se usa en pruebas automatizadas (integración y E2E): demuestra que el
 * nivel es resoluble con dos clientes reales enviando entradas al servidor.
 * Cada bot decide solo con información observable (su estado, el del compañero y
 * los mecanismos), igual que una persona mirando su pantalla.
 */

const T = TILE;

interface Waypoint {
  x: number;
  /** Superficie destino (y de los pies). Si es más alta, se salta. */
  y?: number;
  tol?: number;
}

export class CoopBot {
  private route: Waypoint[] = [];
  private routeKey = '';
  private jumpHold = 0;
  private blocked = 0;
  private lastActionTick = -999;

  constructor(
    private readonly level: CoopLevel,
    private readonly character: CharacterId,
  ) {}

  private setRoute(key: string, route: Waypoint[]): void {
    if (key !== this.routeKey) {
      this.routeKey = key;
      this.route = route.slice();
    }
  }

  /** Mueve hacia el siguiente punto de la ruta; devuelve botones. */
  private follow(s: CoopPlayerState): number {
    while (this.route.length > 0) {
      const wp = this.route[0] as Waypoint;
      const dx = wp.x - s.x;
      const okY = wp.y === undefined || (s.ground && Math.abs(s.y - wp.y) < 6);
      if (Math.abs(dx) < (wp.tol ?? 10) && okY) {
        this.route.shift();
        continue;
      }
      return this.steer(s, wp);
    }
    return 0;
  }

  private steer(s: CoopPlayerState, wp: Waypoint): number {
    let buttons = 0;
    const dx = wp.x - s.x;
    const tol = wp.tol ?? 10;
    const stopDist = (s.vx * s.vx) / (2 * (s.ground ? COOP.FRICTION : COOP.AIR_ACCEL * 0.6));
    if (Math.abs(dx) > tol) {
      const movingToward = Math.sign(s.vx) === Math.sign(dx);
      if (!(movingToward && stopDist >= Math.abs(dx) - 2)) {
        buttons |= dx > 0 ? BTN_RIGHT : BTN_LEFT;
      }
    }

    // Salto: si el destino está más arriba y estamos cerca, o si estamos trabados.
    const needUp = wp.y !== undefined && wp.y < s.y - 20;
    const pushing = (buttons & (BTN_LEFT | BTN_RIGHT)) !== 0;
    if (pushing && s.ground && Math.abs(s.vx) < 4) this.blocked++;
    else this.blocked = 0;

    if (this.jumpHold > 0) {
      this.jumpHold--;
      buttons |= BTN_JUMP;
    } else if (s.ground && ((needUp && Math.abs(dx) < 78) || this.blocked >= 3)) {
      this.jumpHold = 16;
      this.blocked = 0;
      if ((s.prevButtons & BTN_JUMP) === 0) buttons |= BTN_JUMP;
      else this.jumpHold = 0;
    }
    return buttons;
  }

  private act(s: CoopPlayerState): number {
    if (s.tick - this.lastActionTick > 6 && (s.prevButtons & BTN_ACTION) === 0) {
      this.lastActionTick = s.tick;
      return BTN_ACTION;
    }
    return 0;
  }

  private at(s: CoopPlayerState, x: number, tol = 14): boolean {
    return Math.abs(s.x - x) < tol && s.ground;
  }

  decide(self: CoopPlayerState, partner: CoopPlayerState | null, mech: CoopMech): number {
    if (self.respawn > 0) {
      this.routeKey = '';
      this.jumpHold = 0;
      return 0;
    }
    const me = this.character;
    const p = partner;
    const room = mech.roomsCleared;

    if (room === 0) {
      // Sala 1: Bruma sostiene la placa izquierda, Chispa pasa y sostiene la derecha.
      if (me === 'bruma') {
        const chispaThrough = p !== null && p.x > 14 * T;
        const chispaOnPlate = p !== null && Math.abs(p.x - 18 * T) < 40;
        if (!chispaThrough || !chispaOnPlate) this.setRoute('r1-plate', [{ x: 9 * T, y: 12 * T }]);
        else this.setRoute('r1-go', [{ x: 21 * T, y: 12 * T }]);
      } else {
        if (self.x < 14 * T) {
          if ((mech.doors[0] ?? 0) > 0.95) this.setRoute('r1-pass', [{ x: 18 * T, y: 12 * T }]);
          else this.setRoute('r1-wait', [{ x: 11.6 * T, y: 12 * T }]);
        } else {
          const brumaThrough = p !== null && p.x > 14 * T + 10;
          if (!brumaThrough) this.setRoute('r1-hold', [{ x: 18 * T, y: 12 * T }]);
          else this.setRoute('r1-go', [{ x: 23 * T, y: 12 * T }]);
        }
      }
      return this.follow(self);
    }

    if (room === 1) {
      const brumaCrossed = me === 'bruma' ? self.x > 42.2 * T : p !== null && p.x > 42.2 * T;
      if (me === 'chispa') {
        const chispaCrossed = self.x > 42.2 * T;
        if (!brumaCrossed && !chispaCrossed) {
          // Subir al pasillo alto y pisar la placa del puente.
          this.setRoute('r2-up', [
            { x: 26.6 * T, y: 12 * T },
            { x: 28.2 * T, y: 10 * T },
            { x: 30.2 * T, y: 8 * T },
            { x: 33 * T, y: 6 * T },
            { x: 36 * T, y: 6 * T },
          ]);
        } else if (!chispaCrossed) {
          const brumaOnPlate = p !== null && Math.abs(p.x - 44 * T) < 40 && p.ground;
          if (!brumaOnPlate) {
            this.setRoute('r2-hold', [{ x: 36 * T, y: 6 * T }]);
          } else {
            this.setRoute('r2-down', [
              { x: 30.2 * T, y: 8 * T },
              { x: 28 * T, y: 10 * T },
              { x: 26 * T, y: 12 * T },
              { x: 45.5 * T, y: 12 * T },
            ]);
          }
        } else if (!mech.levers[0]) {
          this.setRoute('r2-wait', [{ x: 45.5 * T, y: 12 * T }]);
        } else {
          this.setRoute('r2-go', [{ x: 55.5 * T, y: 12 * T }]);
        }
      } else {
        const chispaCrossed = p !== null && p.x > 42.2 * T;
        if (!brumaCrossed) {
          const bridgeOut = (mech.bridges[0] ?? 0) > 0.98;
          if (bridgeOut) this.setRoute('r2-cross', [{ x: 44 * T, y: 12 * T }]);
          else this.setRoute('r2-wait', [{ x: 31.4 * T, y: 12 * T }]);
        } else if (!chispaCrossed) {
          this.setRoute('r2-hold', [{ x: 44 * T, y: 12 * T }]);
        } else if (!mech.levers[0]) {
          this.setRoute('r2-lever', [{ x: 50.5 * T, y: 12 * T, tol: 8 }]);
          const b = this.follow(self);
          if (this.route.length === 0 && this.at(self, 50.5 * T)) return b | this.act(self);
          return b;
        } else {
          this.setRoute('r2-go', [{ x: 56.5 * T, y: 12 * T }]);
        }
      }
      return this.follow(self);
    }

    if (room === 2) {
      // Sala 3: ambos al ascensor; arriba, ambos se bajan hacia la derecha.
      const el = this.level.elevator;
      const atTop = mech.elevY <= el.yTop + 1;
      if (!atTop && self.y > el.yTop + 4) {
        const spot = me === 'chispa' ? 67.8 * T : 69.2 * T;
        this.setRoute('r3-ride', [{ x: spot, tol: 8 }]);
      } else {
        this.setRoute('r3-off', [{ x: (me === 'chispa' ? 76 : 77) * T, y: 5 * T }]);
      }
      return this.follow(self);
    }

    // Sala 4: consolas sincronizadas y salida.
    if (!mech.synced) {
      if (me === 'chispa') {
        this.setRoute('r4-c0', [{ x: 89.5 * T, y: 12 * T, tol: 8 }]);
      } else {
        this.setRoute('r4-c1', [
          { x: 91 * T, y: 12 * T },
          { x: 93 * T, y: 10 * T },
          { x: 95.3 * T, y: 8 * T },
          { x: 96.9 * T, y: 7 * T, tol: 8 },
        ]);
      }
      const b = this.follow(self);
      const consoleX = me === 'chispa' ? 89.5 * T : 96.9 * T;
      const partnerConsoleX = me === 'chispa' ? 96.9 * T : 89.5 * T;
      const meReady = this.route.length === 0 && Math.abs(self.x - consoleX) < 30 && self.ground;
      const partnerReady = p !== null && Math.abs(p.x - partnerConsoleX) < 30 && p.ground;
      // Ambos presionan en el mismo múltiplo de 30 ticks (como contar "1, 2, 3").
      if (meReady && partnerReady && self.tick % 30 === 0) return b | BTN_ACTION;
      return b;
    }
    this.setRoute('r4-exit', [
      { x: 91 * T, y: 12 * T },
      { x: 93 * T, y: 10 * T },
      { x: 95.3 * T, y: 8 * T },
      { x: 97 * T, y: 7 * T },
      { x: 99 * T, y: 12 * T },
      { x: (me === 'chispa' ? 105 : 106) * T, y: 12 * T },
    ]);
    if (me === 'bruma' && this.routeKey === 'r4-exit' && self.y < 7 * T + 2 && self.x > 96 * T && this.route.length > 2) {
      // Bruma ya está sobre el pilar: salta directo a la bajada.
      this.route = this.route.filter((w) => w.x >= 99 * T);
    }
    return this.follow(self);
  }
}
