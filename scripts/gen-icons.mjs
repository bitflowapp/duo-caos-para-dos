// Genera los íconos PNG de la PWA a partir de public/favicon.svg con Chromium
// (Playwright). Se ejecuta una sola vez: los PNG quedan versionados.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('apps/web/public/favicon.svg', 'utf8');
const targets = [
  { file: 'apps/web/public/icons/icon-192.png', size: 192, pad: 0 },
  { file: 'apps/web/public/icons/icon-512.png', size: 512, pad: 0 },
  { file: 'apps/web/public/icons/icon-maskable-512.png', size: 512, pad: 64 },
  { file: 'apps/web/public/icons/apple-touch-icon.png', size: 180, pad: 0 },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = t.size - t.pad * 2;
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#1a0f35;display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  writeFileSync(t.file, await page.screenshot({ type: 'png', omitBackground: false }));
  console.log('ok', t.file);
}
await browser.close();
