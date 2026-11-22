import { BTN_ACTION, BTN_DOWN, BTN_ITEM, BTN_JUMP, BTN_LEFT, BTN_RIGHT } from '@duo/shared';

/**
 * Estado de botones del jugador local: combina teclado y controles táctiles.
 * La escena lo muestrea una vez por tick de simulación.
 */
class InputState {
  private touch = 0;
  private keys = 0;
  /** Botones forzados por el piloto automático (solo builds de prueba). */
  override: (() => number) | null = null;
  private readonly keyMap: Record<string, number> = {
    Space: BTN_JUMP,
    ArrowUp: BTN_JUMP,
    KeyW: BTN_JUMP,
    ArrowDown: BTN_DOWN,
    KeyS: BTN_DOWN,
    ArrowLeft: BTN_LEFT,
    KeyA: BTN_LEFT,
    ArrowRight: BTN_RIGHT,
    KeyD: BTN_RIGHT,
    KeyE: BTN_ACTION,
    Enter: BTN_ACTION,
    ShiftLeft: BTN_ITEM,
    ShiftRight: BTN_ITEM,
    KeyQ: BTN_ITEM,
  };
  private installed = false;
  /** Si la escena actual usa el teclado (evita capturar flechas en menús). */
  enabled = false;

  install(): void {
    if (this.installed) return;
    this.installed = true;
    window.addEventListener('keydown', (e) => {
      const bit = this.keyMap[e.code];
      if (!bit || !this.enabled) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.keys |= bit;
    });
    window.addEventListener('keyup', (e) => {
      const bit = this.keyMap[e.code];
      if (bit) this.keys &= ~bit;
    });
    // Al perder el foco se sueltan todos los botones (evita teclas "pegadas").
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  press(bit: number): void {
    this.touch |= bit;
  }

  release(bit: number): void {
    this.touch &= ~bit;
  }

  reset(): void {
    this.touch = 0;
    this.keys = 0;
  }

  get buttons(): number {
    if (this.override) return this.override();
    return this.touch | this.keys;
  }
}

export const input = new InputState();
