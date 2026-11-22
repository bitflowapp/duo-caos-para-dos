import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOIN_ATTEMPTS_PER_MINUTE } from '@duo/shared';

const here = path.dirname(fileURLToPath(import.meta.url));

function intEnvFrom(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface ServerConfig {
  port: number;
  host: string;
  production: boolean;
  /** Orígenes permitidos para Socket.IO (CORS). Vacío = solo mismo origen. */
  allowedOrigins: string[];
  /** Carpeta con el build del cliente (si existe, se sirve como estático). */
  staticDir: string | null;
  /** Confiar en X-Forwarded-For / X-Forwarded-Proto (detrás de un proxy del hosting). */
  trustProxy: boolean;
  maxRooms: number;
  maxConnectionsPerIp: number;
  /** Intentos de crear/unirse/reanudar por IP por minuto. */
  joinAttemptsPerMinute: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const intEnv = (name: string, fallback: number): number => intEnvFrom(env, name, fallback);
  const production = env.NODE_ENV === 'production';
  const defaultStatic = path.resolve(here, '../../web/dist');
  const staticDir = env.STATIC_DIR === '' ? null : path.resolve(env.STATIC_DIR ?? defaultStatic);
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!production && origins.length === 0) {
    origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return {
    port: intEnv('PORT', 3000),
    host: env.HOST ?? '0.0.0.0',
    production,
    allowedOrigins: origins,
    staticDir,
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    maxRooms: intEnv('MAX_ROOMS', 500),
    maxConnectionsPerIp: intEnv('MAX_CONNECTIONS_PER_IP', 16),
    joinAttemptsPerMinute: intEnv('JOIN_ATTEMPTS_PER_MINUTE', JOIN_ATTEMPTS_PER_MINUTE),
  };
}
