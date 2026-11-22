// Empaqueta el servidor (incluido @duo/shared, que es código fuente TS del
// monorepo) en un único archivo ESM. Las dependencias de runtime quedan externas
// y se instalan con `npm ci --omit=dev -w @duo/server`.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['socket.io', 'zod'],
  banner: {
    js: "import { createRequire as __duoCreateRequire } from 'node:module'; const require = __duoCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
});
