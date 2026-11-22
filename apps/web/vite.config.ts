import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Genera variantes .br y .gz de los archivos de texto del build (las sirve el servidor). */
function precompress(): Plugin {
  let outDir = 'dist';
  return {
    name: 'duo-precompress',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = path.join(dir, f);
          return statSync(p).isDirectory() ? walk(p) : [p];
        });
      for (const file of walk(outDir)) {
        if (!/\.(js|css|html|svg|json|webmanifest|txt)$/.test(file)) continue;
        const data = readFileSync(file);
        if (data.length < 1024) continue;
        writeFileSync(`${file}.gz`, gzipSync(data, { level: 9 }));
        writeFileSync(
          `${file}.br`,
          brotliCompressSync(data, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), precompress()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/healthz': { target: 'http://localhost:3000' },
    },
  },
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
          net: ['socket.io-client'],
        },
      },
    },
  },
});
