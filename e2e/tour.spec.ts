import { expect, test } from '@playwright/test';
import { createRoom, joinByLink, openPlayer, realErrors, waitForResults } from './helpers';

/**
 * Prueba de aceptación: dos navegadores independientes juegan la Gira por la
 * Isla completa (Carrera del Caos → Sincronizados → ¿Cuánto me conocés?) y
 * después piden revancha, todo contra el servidor real. Las entradas de juego
 * las genera el piloto automático de los builds de prueba, que usa el mismo
 * camino que los controles táctiles (InputState → predicción → servidor).
 */
test('gira completa entre dos celulares con revancha', async ({ browser }, info) => {
  const a = await openPlayer(browser, info, true);
  const b = await openPlayer(browser, info, true);

  const code = await createRoom(a, 'Ana');
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await joinByLink(b, code, 'Leo');

  // Ambos ven a los dos jugadores en la sala privada
  for (const p of [a, b]) {
    await expect(p.page.getByLabel(/Ana/).first()).toBeVisible();
    await expect(p.page.getByLabel(/Leo/).first()).toBeVisible();
  }

  await a.page.getByTestId('pick-chispa').click();
  await b.page.getByTestId('pick-bruma').click();
  // Bruma ya está tomada para A
  await expect(a.page.getByTestId('pick-bruma')).toBeDisabled();
  await a.page.getByTestId('mode-tour').click();
  await expect(b.page.getByTestId('mode-tour')).toHaveAttribute('aria-pressed', 'true');
  await a.page.getByTestId('ready').click();
  await b.page.getByTestId('ready').click();

  // 1) Carrera del Caos
  await expect(a.page.getByRole('progressbar', { name: 'Progreso de la carrera' })).toBeVisible({ timeout: 15_000 });
  await a.page.screenshot({ path: info.outputPath('carrera-a.png') });
  const raceA = await waitForResults(a);
  const raceB = await waitForResults(b);
  expect(raceA).toBe(raceB);
  await a.page.screenshot({ path: info.outputPath('resultado-carrera.png') });

  // 2) Sincronizados
  await a.page.getByTestId('next').click();
  await b.page.getByTestId('next').click();
  await expect(a.page.getByText(/Sala 1\/4/)).toBeVisible({ timeout: 15_000 });
  await b.page.screenshot({ path: info.outputPath('templo-b.png') });
  const coopA = await waitForResults(a, 240_000);
  const coopB = await waitForResults(b);
  expect(coopA).toBe(coopB);
  expect(coopA).toMatch(/Lo lograron|Sincronía perfecta/);

  // 3) ¿Cuánto me conocés?
  await a.page.getByTestId('next').click();
  await b.page.getByTestId('next').click();
  await expect(a.page.getByTestId('quiz-card')).toBeVisible({ timeout: 20_000 });
  await a.page.screenshot({ path: info.outputPath('quiz-a.png') });
  const quizA = await waitForResults(a, 150_000);
  const quizB = await waitForResults(b);
  expect(quizA).toBe(quizB);
  await expect(a.page.getByRole('heading', { name: 'Copa de la Isla' })).toBeVisible();
  await a.page.screenshot({ path: info.outputPath('copa.png') });

  // Revancha: nueva gira sin crear sala
  await a.page.getByTestId('rematch').click();
  await expect(b.page.getByText(/quiere la revancha/)).toBeVisible();
  await b.page.getByTestId('rematch').click();
  await expect(a.page.getByRole('progressbar', { name: 'Progreso de la carrera' })).toBeVisible({ timeout: 15_000 });

  expect(realErrors(a)).toEqual([]);
  expect(realErrors(b)).toEqual([]);
  await a.context.close();
  await b.context.close();
});
