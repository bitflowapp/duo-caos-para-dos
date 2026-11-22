import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E con dos navegadores independientes (contextos aislados) contra el
 * build real servido por el servidor Node. Importante: se ejecutan en Chromium.
 * Los perfiles "iPhone" emulan viewport, táctil y user agent, pero NO son Safari:
 * la verificación en dispositivos físicos se documenta aparte.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 420_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'node apps/server/dist/index.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      STATIC_DIR: 'apps/web/dist',
      DUO_SILENT: '1',
    },
  },
  projects: [
    {
      name: 'android-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-emulado-chromium',
      use: {
        browserName: 'chromium',
        viewport: devices['iPhone 13'].viewport,
        userAgent: devices['iPhone 13'].userAgent,
        deviceScaleFactor: devices['iPhone 13'].deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
