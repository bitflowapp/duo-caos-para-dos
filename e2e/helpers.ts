import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

export interface Player {
  context: BrowserContext;
  page: Page;
  errors: string[];
}

/** Abre un "celular" independiente (contexto aislado: sin almacenamiento compartido). */
export async function openPlayer(browser: Browser, info: TestInfo, landscape = false): Promise<Player> {
  const use = info.project.use;
  const vp = use.viewport ?? { width: 390, height: 844 };
  const context = await browser.newContext({
    ...use,
    viewport: landscape ? { width: vp.height, height: vp.width } : vp,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return { context, page, errors };
}

export async function createRoom(p: Player, name: string): Promise<string> {
  await p.page.goto('/?autopilot=1');
  await p.page.getByLabel('¿Cómo te llamás? (opcional)').fill(name);
  await p.page.getByRole('button', { name: /Crear partida/ }).click();
  const code = p.page.getByTestId('room-code');
  await expect(code).toBeVisible();
  return (await code.textContent())?.trim() ?? '';
}

export async function joinByLink(p: Player, code: string, name: string): Promise<void> {
  await p.page.goto(`/?autopilot=1#/sala/${code}`);
  await expect(p.page.getByRole('heading', { name: '¡Te invitaron a jugar!' })).toBeVisible();
  await expect(p.page.getByLabel('Código de sala')).toHaveValue(code);
  await p.page.getByLabel('¿Cómo te llamás? (opcional)').fill(name);
  await p.page.getByRole('button', { name: 'Unirme' }).click();
}

export async function waitForResults(p: Player, timeout = 200_000): Promise<string> {
  const head = p.page.getByTestId('result-headline');
  await expect(head).toBeVisible({ timeout });
  return (await head.textContent())?.trim() ?? '';
}

/** Errores de consola relevantes (se ignoran avisos de audio/autoplay de Chromium headless). */
export function realErrors(p: Player): string[] {
  return p.errors.filter((e) => !/AudioContext|autoplay|NotAllowedError|favicon/i.test(e));
}
