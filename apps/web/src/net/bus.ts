import type { GameEventPayload, GameSnapshot, GameStartPayload, Slot, ClockPayload } from '@duo/shared';

/**
 * Bus de eventos de alta frecuencia entre la red y las escenas de Phaser
 * (snapshots y eventos de juego no pasan por React para no re-renderizar).
 */
export interface BusEvents {
  start: GameStartPayload;
  clock: { matchId: number; clock: ClockPayload };
  snap: GameSnapshot;
  event: GameEventPayload;
  emote: { slot: Slot; id: string };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private readonly handlers = new Map<keyof BusEvents, Set<Handler<never>>>();

  on<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set?.delete(handler as Handler<never>);
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<BusEvents[K]>)(payload);
  }
}

export const bus = new Bus();
