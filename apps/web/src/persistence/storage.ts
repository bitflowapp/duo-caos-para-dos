/**
 * Acceso seguro a localStorage/sessionStorage: en Safari privado o con el
 * almacenamiento bloqueado puede lanzar excepciones; el juego sigue funcionando.
 */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const local = {
  get<T>(key: string, fallback: T): T {
    return safe(() => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }, fallback);
  },
  set(key: string, value: unknown): void {
    safe(() => window.localStorage.setItem(key, JSON.stringify(value)), undefined);
  },
  remove(key: string): void {
    safe(() => window.localStorage.removeItem(key), undefined);
  },
};

export const session = {
  get<T>(key: string, fallback: T): T {
    return safe(() => {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }, fallback);
  },
  set(key: string, value: unknown): void {
    safe(() => window.sessionStorage.setItem(key, JSON.stringify(value)), undefined);
  },
  remove(key: string): void {
    safe(() => window.sessionStorage.removeItem(key), undefined);
  },
};
