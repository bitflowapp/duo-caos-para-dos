import { expect, test } from '@playwright/test';
import { createRoom, joinByLink, openPlayer } from './helpers';

test('una tercera persona no puede entrar a una sala llena', async ({ browser }, info) => {
  const a = await openPlayer(browser, info);
  const b = await openPlayer(browser, info);
  const c = await openPlayer(browser, info);
  const code = await createRoom(a, 'Ana');
  await joinByLink(b, code, 'Leo');
  await expect(b.page.getByTestId('pick-bruma')).toBeVisible();
  await c.page.goto(`/#/sala/${code}`);
  await c.page.getByRole('button', { name: 'Unirme' }).click();
  await expect(c.page.getByRole('alert')).toContainText('ya tiene a sus dos jugadores');
  for (const p of [a, b, c]) await p.context.close();
});

test('recargar en plena carrera pausa la partida y se recupera con el token de la pestaña', async ({ browser }, info) => {
  const a = await openPlayer(browser, info, true);
  const b = await openPlayer(browser, info, true);
  const code = await createRoom(a, 'Ana');
  await joinByLink(b, code, 'Leo');
  await a.page.getByTestId('pick-chispa').click();
  await b.page.getByTestId('pick-bruma').click();
  await a.page.getByTestId('mode-race').click();
  await a.page.getByTestId('ready').click();
  await b.page.getByTestId('ready').click();
  await expect(b.page.getByRole('progressbar', { name: 'Progreso de la carrera' })).toBeVisible({ timeout: 15_000 });
  await b.page.waitForTimeout(5_000);

  // B recarga (pierde la conexión): A ve la pausa
  await b.page.reload();
  await expect(a.page.getByText('Partida en pausa')).toBeVisible({ timeout: 15_000 });
  // B vuelve solo (token en sessionStorage) y la carrera continúa
  await expect(b.page.getByRole('progressbar', { name: 'Progreso de la carrera' })).toBeVisible({ timeout: 20_000 });
  await expect(a.page.getByText('Partida en pausa')).toBeHidden({ timeout: 15_000 });
  await a.page.screenshot({ path: info.outputPath('reanudada.png') });
  for (const p of [a, b]) await p.context.close();
});

test('inicio en vertical: pantalla de inicio usable y sin desbordes', async ({ browser }, info) => {
  const a = await openPlayer(browser, info);
  await a.page.goto('/');
  await expect(a.page.getByRole('button', { name: /Crear partida/ })).toBeVisible();
  const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  await a.page.screenshot({ path: info.outputPath('inicio.png') });
  await a.context.close();
});
