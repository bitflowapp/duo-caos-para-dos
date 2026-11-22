// Empaqueta el servidor (incluido @duo/shared) en un único archivo ESM.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // Dependencias de runtime se resuelven desde node_modules.
  packages: 'external',
  // @duo/shared es código fuente TypeScript del monorepo: se incluye en el bundle.
  plugins: [
    {
      name: 'bundle-workspace',
      setup(b) {
        b.onResolve({ filter: /^@duo\/shared/ }, async (args) => {
          if (args.pluginData?.inner) return undefined;
          const r = await b.resolve(args.path, {
            kind: args.kind,
            resolveDir: args.resolveDir,
            pluginData: { inner: true },
          });
          return { path: r.path, external: false };
        });
      },
    },
  ],
  banner: {
    js: "import { createRequire as __duoCreateRequire } from 'node:module'; const require = __duoCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
});
