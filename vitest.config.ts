import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          include: ['packages/shared/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'server',
          include: ['apps/server/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 180_000,
          hookTimeout: 30_000,
          env: { DUO_SILENT: '1' },
        },
      },
      {
        test: {
          name: 'web',
          include: ['apps/web/test/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
