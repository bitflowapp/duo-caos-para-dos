import Phaser from 'phaser';
import type { ArtEntry } from './props';

/**
 * Rasteriza el arte SVG (generado en código) a texturas de Phaser en tiempo de
 * carga, a la densidad de píxeles del dispositivo. Las piezas chicas se empaquetan
 * en atlas (menos cambios de textura = mejor rendimiento en celulares).
 */

export interface FrameRef {
  atlas: string;
  frame: string;
  w: number;
  h: number;
  /** Píxeles de textura por unidad de diseño. */
  res: number;
}

const refs = new Map<string, FrameRef>();
/** Densidad de rasterizado (píxeles de textura por unidad de mundo). */
export let RES = 2;

export function frameOf(key: string): FrameRef {
  const r = refs.get(key);
  if (!r) throw new Error(`Textura no generada: ${key}`);
  return r;
}

export function hasFrame(key: string): boolean {
  return refs.has(key);
}

function withSize(svg: string, pw: number, ph: number): string {
  return svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `<svg$1 width="${pw}" height="${ph}"`);
}

async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg'));
    });
  }
  return img;
}

interface Placed {
  entry: ArtEntry;
  pw: number;
  ph: number;
  x: number;
  y: number;
  sheet: number;
}

const SHEET = 2048;
const PAD = 2;

/** Construye las texturas. `standalone` = claves que van en textura propia (fondos grandes). */
export async function buildTextures(
  scene: Phaser.Scene,
  entries: readonly ArtEntry[],
  opts: { res: number; standalone: ReadonlySet<string>; resOverride?: Record<string, number>; prefix: string },
  onProgress?: (p: number) => void,
): Promise<void> {
  RES = opts.res;
  const todo = entries.filter((e) => !refs.has(e.key));
  const solo: ArtEntry[] = [];
  const packed: Placed[] = [];
  for (const entry of todo) {
    const res = opts.resOverride?.[entry.key] ?? opts.res;
    const pw = Math.max(1, Math.round(entry.w * res));
    const ph = Math.max(1, Math.round(entry.h * res));
    if (opts.standalone.has(entry.key) || pw > SHEET / 2 || ph > SHEET / 2) solo.push(entry);
    else packed.push({ entry, pw, ph, x: 0, y: 0, sheet: 0 });
  }

  // Empaquetado por estantes, de mayor a menor alto.
  packed.sort((a, b) => b.ph - a.ph);
  let sheet = 0;
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  for (const p of packed) {
    if (x + p.pw + PAD > SHEET) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    if (y + p.ph + PAD > SHEET) {
      sheet++;
      x = PAD;
      y = PAD;
      shelf = 0;
    }
    p.x = x;
    p.y = y;
    p.sheet = sheet;
    x += p.pw + PAD;
    shelf = Math.max(shelf, p.ph);
  }
  const sheets = packed.length > 0 ? sheet + 1 : 0;
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < sheets; i++) {
    const c = document.createElement('canvas');
    // Recortamos el último atlas al alto usado (menos memoria).
    const used = Math.max(...packed.filter((p) => p.sheet === i).map((p) => p.y + p.ph + PAD));
    c.width = SHEET;
    c.height = Math.min(SHEET, Phaser.Math.Pow2.GetNext(Math.max(64, used)));
    canvases.push(c);
  }

  const total = packed.length + solo.length;
  let done = 0;
  const step = (): void => {
    done++;
    onProgress?.(done / Math.max(1, total));
  };

  // Rasterizado en tandas chicas, cediendo el hilo principal entre tandas para que
  // la interfaz siga respondiendo mientras se generan las texturas.
  const BATCH = 6;
  const yieldToMain = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < packed.length; i += BATCH) {
    const chunk = packed.slice(i, i + BATCH);
    const imgs = await Promise.all(chunk.map((p) => loadSvg(withSize(p.entry.svg, p.pw, p.ph)).catch(() => null)));
    chunk.forEach((p, j) => {
      const img = imgs[j];
      const ctx = canvases[p.sheet]?.getContext('2d');
      if (img && ctx) ctx.drawImage(img, p.x, p.y, p.pw, p.ph);
      step();
    });
    await yieldToMain();
  }

  canvases.forEach((c, i) => {
    const key = `${opts.prefix}-atlas-${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.addCanvas(key, c);
    if (!tex) return;
    for (const p of packed.filter((q) => q.sheet === i)) {
      tex.add(p.entry.key, 0, p.x, p.y, p.pw, p.ph);
      refs.set(p.entry.key, { atlas: key, frame: p.entry.key, w: p.entry.w, h: p.entry.h, res: p.pw / p.entry.w });
    }
  });

  for (let i = 0; i < solo.length; i += 4) {
    const chunk = solo.slice(i, i + 4);
    const imgs = await Promise.all(
      chunk.map((entry) => {
        const res = opts.resOverride?.[entry.key] ?? opts.res;
        return loadSvg(withSize(entry.svg, Math.round(entry.w * res), Math.round(entry.h * res))).catch(() => null);
      }),
    );
    chunk.forEach((entry, j) => {
      const img = imgs[j];
      const res = opts.resOverride?.[entry.key] ?? opts.res;
      const c = document.createElement('canvas');
      c.width = Math.round(entry.w * res);
      c.height = Math.round(entry.h * res);
      if (img) c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      const key = `${opts.prefix}-solo-${entry.key}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, c);
      refs.set(entry.key, { atlas: key, frame: '__BASE', w: entry.w, h: entry.h, res: c.width / entry.w });
      step();
    });
    await yieldToMain();
  }
}

/** Escala que hay que aplicar a una imagen para verla a su tamaño de diseño. */
export function texScale(key: string): number {
  return 1 / frameOf(key).res;
}

/** Crea una imagen a tamaño de diseño. */
export function addImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const r = frameOf(key);
  const img = r.frame === '__BASE' ? scene.add.image(x, y, r.atlas) : scene.add.image(x, y, r.atlas, r.frame);
  img.setScale(texScale(key));
  return img;
}

/** Crea una imagen (sin agregarla a la escena) para contenedores. */
export function makeImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const r = frameOf(key);
  const img = r.frame === '__BASE' ? scene.make.image({ x, y, key: r.atlas }, false) : scene.make.image({ x, y, key: r.atlas, frame: r.frame }, false);
  img.setScale(texScale(key));
  return img;
}

export function setImageKey(img: Phaser.GameObjects.Image, key: string): void {
  const r = frameOf(key);
  if (r.frame === '__BASE') img.setTexture(r.atlas);
  else img.setTexture(r.atlas, r.frame);
}

/** TileSprite que repite una textura a su tamaño de diseño. */
export function addTile(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key: string): Phaser.GameObjects.TileSprite {
  const r = frameOf(key);
  const ts = r.frame === '__BASE' ? scene.add.tileSprite(x, y, w, h, r.atlas) : scene.add.tileSprite(x, y, w, h, r.atlas, r.frame);
  // El período de repetición es (ancho del cuadro en píxeles × tileScale):
  // con 1/res cada baldosa mide su tamaño de diseño.
  const s = 1 / r.res;
  ts.setTileScale(s, s);
  return ts;
}
