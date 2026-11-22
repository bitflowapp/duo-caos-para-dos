import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { ServerConfig } from './config.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Cabeceras de seguridad. CSP estricta: solo recursos propios; WebSocket al
 * mismo host; imágenes data:/blob: porque el arte SVG se rasteriza en el cliente.
 */
export function securityHeaders(req: IncomingMessage, config: ServerConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' wss: ws:",
      "media-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  };
  const proto = config.trustProxy ? req.headers['x-forwarded-proto'] : undefined;
  if (proto === 'https') headers['Strict-Transport-Security'] = 'max-age=15552000';
  return headers;
}

export interface StaticHandler {
  (req: IncomingMessage, res: ServerResponse): void;
}

export function createHttpHandler(config: ServerConfig, health: () => Record<string, number | boolean | string>): StaticHandler {
  const root = config.staticDir && existsSync(config.staticDir) ? path.resolve(config.staticDir) : null;

  return (req, res) => {
    const headers = securityHeaders(req, config);
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/healthz') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, ...health() }));
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
      res.end();
      return;
    }

    if (!root) {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Servidor de DUO activo. El cliente web no está compilado (npm run build).');
      return;
    }

    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400, headers);
      res.end();
      return;
    }
    if (rel.includes('\0')) {
      res.writeHead(400, headers);
      res.end();
      return;
    }
    let file = path.resolve(root, '.' + path.posix.normalize(rel));
    if (!file.startsWith(root)) {
      res.writeHead(403, headers);
      res.end();
      return;
    }
    let isIndex = false;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // Rutas de la SPA sin extensión → index.html
      if (path.extname(rel) === '' || rel.endsWith('/')) {
        file = path.join(root, 'index.html');
        isIndex = true;
      } else {
        res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No encontrado');
        return;
      }
    }
    if (path.basename(file) === 'index.html') isIndex = true;

    const ext = path.extname(file);
    const type = MIME[ext] ?? 'application/octet-stream';
    const cache = isIndex
      ? 'no-cache'
      : rel.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

    // Variantes precomprimidas generadas en el build (brotli/gzip).
    const accept = String(req.headers['accept-encoding'] ?? '');
    let served = file;
    let encoding: string | null = null;
    if (/\bbr\b/.test(accept) && existsSync(file + '.br')) {
      served = file + '.br';
      encoding = 'br';
    } else if (/\bgzip\b/.test(accept) && existsSync(file + '.gz')) {
      served = file + '.gz';
      encoding = 'gzip';
    }

    const size = statSync(served).size;
    const out: Record<string, string | number> = {
      ...headers,
      'Content-Type': type,
      'Cache-Control': cache,
      'Content-Length': size,
      Vary: 'Accept-Encoding',
    };
    if (encoding) out['Content-Encoding'] = encoding;
    res.writeHead(200, out);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(served).pipe(res);
  };
}
