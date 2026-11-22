import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ServerConfig } from './config.js';
import { createHttpHandler } from './http.js';
import { attachSocketServer, type SocketServer } from './sockets.js';

export interface DuoApp {
  http: Server;
  sockets: SocketServer;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

/** Crea el servidor HTTP + Socket.IO (usado por index.ts y por los tests). */
export function createApp(config: ServerConfig): DuoApp {
  const startedAt = Date.now();
  let sockets: SocketServer | null = null;
  const handler = createHttpHandler(config, () => ({
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    rooms: sockets?.manager.stats().rooms ?? 0,
    players: sockets?.manager.stats().players ?? 0,
  }));
  const http = createServer(handler);
  http.keepAliveTimeout = 65_000;
  http.headersTimeout = 66_000;
  sockets = attachSocketServer(http, config);
  const s = sockets;

  return {
    http,
    sockets: s,
    listen: (port = config.port, host = config.host) =>
      new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => {
          http.off('error', reject);
          resolve((http.address() as AddressInfo).port);
        });
      }),
    close: async () => {
      await s.stop();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
