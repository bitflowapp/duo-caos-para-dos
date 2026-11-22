import { Rng, hash32 } from '../rng';
import { TICK_RATE } from '../constants';

/**
 * Pista de "Carrera del Caos".
 * Coordenadas del mundo con Y hacia abajo; el suelo base está en y = 0.
 * La pista se arma con bloques ("chunks") diseñados a mano, elegidos y ordenados
 * con una semilla: cliente y servidor generan exactamente la misma pista.
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type HazardKind = 'urchin' | 'crab' | 'branch' | 'gull' | 'spikes';

export interface Hazard extends Rect {
  id: number;
  kind: HazardKind;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
}

export type RaceTheme = 'beach' | 'jungle' | 'cliffs' | 'volcano';

export type DecorKind =
  | 'palm'
  | 'shell'
  | 'flower'
  | 'fern'
  | 'tree'
  | 'rock'
  | 'flag'
  | 'torch'
  | 'lavarock'
  | 'sign_jump'
  | 'sign_slide'
  | 'sign_spring'
  | 'totem';

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

export interface Checkpoint {
  x: number;
  y: number;
}

export type ChaosKind = 'lowgrav' | 'speed' | 'wind';

export interface ChaosWindow {
  kind: ChaosKind;
  /** Tick (incluido) en que empieza. */
  start: number;
  /** Tick (excluido) en que termina. */
  end: number;
}

export interface ThemeZone {
  x: number;
  theme: RaceTheme;
}

/** Índice espacial 1D por baldes para consultas rápidas por rango de X. */
export class Grid1D<T extends Rect> {
  private readonly buckets = new Map<number, T[]>();
  constructor(
    readonly items: readonly T[],
    private readonly cell = 256,
  ) {
    for (const it of items) {
      const a = Math.floor(it.x0 / cell);
      const b = Math.floor(it.x1 / cell);
      for (let c = a; c <= b; c++) {
        let arr = this.buckets.get(c);
        if (!arr) {
          arr = [];
          this.buckets.set(c, arr);
        }
        arr.push(it);
      }
    }
  }

  /** Devuelve candidatos que podrían solaparse con [x0, x1] (puede tener duplicados). */
  query(x0: number, x1: number, out: T[]): T[] {
    out.length = 0;
    const a = Math.floor(x0 / this.cell);
    const b = Math.floor(x1 / this.cell);
    for (let c = a; c <= b; c++) {
      const arr = this.buckets.get(c);
      if (!arr) continue;
      for (const it of arr) {
        if (out.indexOf(it) === -1) out.push(it);
      }
    }
    return out;
  }
}

export interface RaceCourse {
  seed: number;
  startX: number;
  finishX: number;
  endX: number;
  deathY: number;
  /** Bloques sólidos completos (suelo, escalones, muros). */
  solids: Rect[];
  /** Plataformas atravesables desde abajo. */
  platforms: Rect[];
  springs: Rect[];
  boosts: Rect[];
  mud: Rect[];
  hazards: Hazard[];
  hearts: Pickup[];
  boxes: Pickup[];
  checkpoints: Checkpoint[];
  decor: Decor[];
  zones: ThemeZone[];
  chaos: ChaosWindow[];
  /** Nombres de los bloques elegidos (útil para depurar y para tests). */
  chunks: string[];
  index: {
    solids: Grid1D<Rect>;
    platforms: Grid1D<Rect>;
    springs: Grid1D<Rect>;
    boosts: Grid1D<Rect>;
    mud: Grid1D<Rect>;
    hazards: Grid1D<Hazard>;
  };
}

// ───────────────────────── Medidas ─────────────────────────
const GROUND_DEPTH = 700;
const PLATFORM_THICKNESS = 26;

export const HAZARD_SIZE: Record<HazardKind, { w: number; h: number; lift: number }> = {
  urchin: { w: 34, h: 30, lift: 0 },
  crab: { w: 44, h: 30, lift: 0 },
  spikes: { w: 0, h: 22, lift: 0 }, // ancho variable
  branch: { w: 0, h: 70, lift: 46 }, // cuelga: base a 46 del suelo
  gull: { w: 70, h: 56, lift: 50 },
};

class CourseBuilder {
  x = 0;
  readonly solids: Rect[] = [];
  readonly platforms: Rect[] = [];
  readonly springs: Rect[] = [];
  readonly boosts: Rect[] = [];
  readonly mud: Rect[] = [];
  readonly hazards: Hazard[] = [];
  readonly hearts: Pickup[] = [];
  readonly boxes: Pickup[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly decor: Decor[] = [];
  readonly zones: ThemeZone[] = [];
  /** Rangos de X de suelo plano libre (para decoración). */
  private readonly freeGround: Array<[number, number]> = [];
  theme: RaceTheme = 'beach';

  constructor(readonly rng: Rng) {}

  setTheme(theme: RaceTheme): void {
    if (this.zones.length === 0 || this.zones[this.zones.length - 1]?.theme !== theme) {
      this.zones.push({ x: this.x, theme });
    }
    this.theme = theme;
  }

  ground(w: number): void {
    const last = this.solids[this.solids.length - 1];
    if (last && last.y0 === 0 && last.y1 === GROUND_DEPTH && last.x1 === this.x) {
      last.x1 = this.x + w;
    } else {
      this.solids.push({ x0: this.x, y0: 0, x1: this.x + w, y1: GROUND_DEPTH });
    }
    this.freeGround.push([this.x, this.x + w]);
    this.x += w;
  }

  gap(w: number): void {
    this.x += w;
  }

  /** Escalón o muro apoyado en el suelo. */
  block(dx: number, w: number, h: number): void {
    this.solids.push({ x0: this.x + dx, y0: -h, x1: this.x + dx + w, y1: 0 });
    this.markBusy(this.x + dx - 30, this.x + dx + w + 30);
  }

  /** Pilar que nace del fondo (dentro de un pozo). */
  pillar(dx: number, w: number, h: number): void {
    this.solids.push({ x0: this.x + dx, y0: -h, x1: this.x + dx + w, y1: GROUND_DEPTH });
  }

  plat(dx: number, y: number, w: number): void {
    this.platforms.push({ x0: this.x + dx, y0: y, x1: this.x + dx + w, y1: y + PLATFORM_THICKNESS });
  }

  hazard(kind: HazardKind, dx: number, opts: { w?: number; baseY?: number } = {}): void {
    const size = HAZARD_SIZE[kind];
    const w = opts.w ?? size.w;
    const base = (opts.baseY ?? 0) - size.lift;
    const x0 = this.x + dx;
    this.hazards.push({ id: this.hazards.length, kind, x0, y0: base - size.h, x1: x0 + w, y1: base });
    this.markBusy(x0 - 40, x0 + w + 40);
  }

  spring(dx: number, baseY = 0): void {
    const x0 = this.x + dx;
    this.springs.push({ x0, y0: baseY - 26, x1: x0 + 56, y1: baseY });
    this.markBusy(x0 - 20, x0 + 76);
  }

  boost(dx: number, w = 120, baseY = 0): void {
    this.boosts.push({ x0: this.x + dx, y0: baseY - 40, x1: this.x + dx + w, y1: baseY });
  }

  mudPool(dx: number, w: number): void {
    this.mud.push({ x0: this.x + dx, y0: -50, x1: this.x + dx + w, y1: 0 });
    this.markBusy(this.x + dx, this.x + dx + w);
  }

  heart(x: number, y: number): void {
    this.hearts.push({ id: this.hearts.length, x, y });
  }

  /** Corazones en arco (enseñan la trayectoria del salto). */
  heartArc(dx0: number, dx1: number, apex: number, n = 5, baseY = 0): void {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = this.x + dx0 + (dx1 - dx0) * t;
      const y = baseY - 34 - apex * 4 * t * (1 - t);
      this.heart(x, y);
    }
  }

  heartLine(dx0: number, dx1: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.heart(this.x + dx0 + (dx1 - dx0) * t, y);
    }
  }

  box(dx: number, baseY = 0): void {
    this.boxes.push({ id: this.boxes.length, x: this.x + dx, y: baseY - 48 });
  }

  checkpoint(dx = 40): void {
    this.checkpoints.push({ x: this.x + dx, y: 0 });
  }

  sign(kind: 'sign_jump' | 'sign_slide' | 'sign_spring', dx: number): void {
    this.decor.push({ kind, x: this.x + dx, y: 0, scale: 1, flip: false });
  }

  private markBusy(x0: number, x1: number): void {
    // Partimos los rangos libres para no poner decoración encima de obstáculos.
    const next: Array<[number, number]> = [];
    for (const [a, b] of this.freeGround) {
      if (x1 <= a || x0 >= b) {
        next.push([a, b]);
        continue;
      }
      if (x0 > a) next.push([a, x0]);
      if (x1 < b) next.push([x1, b]);
    }
    this.freeGround.length = 0;
    this.freeGround.push(...next);
  }

  scatterDecor(fromX: number): void {
    const kinds: Record<RaceTheme, DecorKind[]> = {
      beach: ['palm', 'shell', 'flower', 'palm', 'rock'],
      jungle: ['fern', 'tree', 'flower', 'fern', 'palm'],
      cliffs: ['rock', 'flag', 'fern', 'rock', 'tree'],
      volcano: ['lavarock', 'torch', 'rock', 'lavarock', 'torch'],
    };
    for (const [a, b] of this.freeGround) {
      if (b <= fromX) continue;
      const start = Math.max(a, fromX);
      for (let x = start + 60 + this.rng.int(0, 80); x < b - 40; x += 170 + this.rng.int(0, 160)) {
        this.decor.push({
          kind: this.rng.pick(kinds[this.theme]),
          x,
          y: 0,
          scale: 0.8 + this.rng.next() * 0.45,
          flip: this.rng.next() < 0.5,
        });
      }
    }
  }
}

type ChunkFn = (b: CourseBuilder) => void;

interface ChunkDef {
  name: string;
  build: ChunkFn;
}

// ───────────────────────── Bloques fáciles ─────────────────────────
const EASY: ChunkDef[] = [
  {
    name: 'erizos',
    build: (b) => {
      b.sign('sign_jump', 150);
      b.hazard('urchin', 400);
      b.heartArc(290, 520, 105);
      b.hazard('urchin', 790);
      b.heartArc(680, 910, 105);
      b.ground(1100);
    },
  },
  {
    name: 'hueco',
    build: (b) => {
      b.ground(380);
      b.gap(160);
      b.heartArc(-250, 90, 110, 6);
      b.ground(520);
    },
  },
  {
    name: 'escalon',
    build: (b) => {
      b.block(330, 320, 66);
      b.heartLine(380, 600, -110, 4);
      b.hazard('urchin', 820);
      b.heartArc(720, 930, 100, 4);
      b.ground(1150);
    },
  },
  {
    name: 'rama-baja',
    build: (b) => {
      b.sign('sign_slide', 170);
      b.hazard('branch', 430, { w: 150 });
      b.heartLine(430, 580, -16, 4);
      b.hazard('urchin', 860);
      b.heartArc(750, 980, 105, 4);
      b.ground(1150);
    },
  },
  {
    name: 'cangrejos',
    build: (b) => {
      b.hazard('crab', 360);
      b.heartArc(250, 490, 110);
      b.hazard('crab', 720);
      b.heartArc(610, 850, 110);
      b.ground(1080);
    },
  },
  {
    name: 'respiro',
    build: (b) => {
      b.heartLine(160, 460, -40, 5);
      b.boost(520, 130);
      b.heartLine(700, 1000, -40, 5);
      b.ground(1100);
    },
  },
];

// ───────────────────────── Bloques intermedios ─────────────────────────
const MEDIUM: ChunkDef[] = [
  {
    name: 'doble-hueco',
    build: (b) => {
      b.ground(320);
      b.gap(180);
      b.heartArc(-240, 60, 105, 5);
      b.ground(170);
      b.gap(190);
      b.heartArc(-250, 60, 110, 5);
      b.ground(420);
    },
  },
  {
    name: 'resorte-muro',
    build: (b) => {
      b.sign('sign_spring', 160);
      // El resorte está pegado al muro: si el jugador cae antes, rebota igual.
      b.spring(380);
      b.block(436, 80, 285);
      b.heartArc(390, 760, 300, 6);
      b.ground(1150);
    },
  },
  {
    name: 'gaviotas',
    build: (b) => {
      b.hazard('gull', 300);
      b.heartLine(300, 370, -16, 2);
      b.hazard('urchin', 640);
      b.heartArc(530, 760, 105, 4);
      b.hazard('gull', 960);
      b.heartLine(960, 1030, -16, 2);
      b.ground(1300);
    },
  },
  {
    name: 'barro-turbo',
    build: (b) => {
      b.mudPool(220, 380);
      b.heartArc(200, 620, 120, 6);
      b.boost(760, 130);
      b.heartLine(800, 1080, -40, 4);
      b.ground(1200);
    },
  },
  {
    name: 'plataformas',
    build: (b) => {
      b.ground(260);
      b.plat(60, -70, 150);
      b.plat(310, -125, 150);
      b.heartLine(90, 180, -110, 2);
      b.heartLine(340, 430, -165, 2);
      b.gap(540);
      b.ground(440);
    },
  },
  {
    name: 'caja-erizos',
    build: (b) => {
      b.box(170);
      b.hazard('urchin', 520);
      b.hazard('urchin', 556);
      b.heartArc(420, 700, 125, 5);
      b.hazard('crab', 930);
      b.ground(1150);
    },
  },
  {
    name: 'muro-alto',
    build: (b) => {
      b.block(420, 90, 122);
      b.heartArc(300, 560, 160, 5);
      b.heartLine(420, 500, -160, 2);
      b.hazard('urchin', 900);
      b.ground(1150);
    },
  },
];

// ───────────────────────── Bloques difíciles ─────────────────────────
const HARD: ChunkDef[] = [
  {
    name: 'escalera-de-huecos',
    build: (b) => {
      b.ground(260);
      b.gap(210);
      b.heartArc(-270, 40, 110, 4);
      b.ground(160);
      b.gap(225);
      b.heartArc(-285, 45, 115, 4);
      b.ground(160);
      b.gap(245);
      b.heartArc(-320, 60, 150, 5);
      b.ground(420);
    },
  },
  {
    name: 'tunel-de-ramas',
    build: (b) => {
      b.hazard('branch', 300, { w: 300 });
      b.heartLine(310, 590, -16, 5);
      b.hazard('urchin', 720);
      b.heartArc(640, 820, 90, 3);
      b.hazard('branch', 1000, { w: 260 });
      b.heartLine(1010, 1250, -16, 5);
      b.ground(1450);
    },
  },
  {
    name: 'ruta-alta',
    build: (b) => {
      b.spring(200);
      b.plat(330, -300, 280);
      b.plat(700, -330, 280);
      b.plat(1070, -300, 260);
      b.boost(760, 120, -330);
      b.heartLine(360, 580, -340, 4);
      b.heartLine(730, 950, -370, 4);
      b.heartLine(1090, 1300, -340, 4);
      b.mudPool(420, 640);
      b.hazard('urchin', 1180);
      b.ground(1700);
    },
  },
  {
    name: 'muro-y-foso',
    build: (b) => {
      b.ground(400);
      b.block(-160, 60, 110);
      b.heartArc(-250, 0, 150, 4);
      b.gap(150);
      b.heartArc(-200, 60, 100, 4);
      b.ground(460);
    },
  },
  {
    name: 'gaviota-y-hueco',
    build: (b) => {
      b.ground(560);
      b.hazard('gull', -320);
      b.heartLine(-320, -250, -16, 2);
      b.gap(180);
      b.heartArc(-260, 90, 120, 5);
      b.hazard('urchin', 260);
      b.heartArc(150, 380, 105, 4);
      b.ground(620);
    },
  },
  {
    name: 'pinches-y-plataformas',
    build: (b) => {
      b.hazard('spikes', 300, { w: 340 });
      b.plat(320, -95, 120);
      b.plat(520, -95, 120);
      b.heartLine(340, 620, -150, 5);
      b.ground(1050);
    },
  },
];

const START: ChunkDef = {
  name: 'largada',
  build: (b) => {
    b.ground(900);
    b.heartLine(520, 820, -40, 4);
  },
};

const FINALE: ChunkDef = {
  name: 'recta-final',
  build: (b) => {
    b.boost(180, 140);
    b.heartLine(360, 640, -40, 5);
    b.boost(700, 140);
    b.ground(2200);
  },
};

export const RACE_CHUNK_NAMES = {
  easy: EASY.map((c) => c.name),
  medium: MEDIUM.map((c) => c.name),
  hard: HARD.map((c) => c.name),
};

export const COURSE_CONSTANTS = {
  START_OFFSET: 300,
  FINISH_OFFSET: 620,
  DEATH_Y: 430,
};

function buildIndex(c: Omit<RaceCourse, 'index'>): RaceCourse['index'] {
  return {
    solids: new Grid1D(c.solids),
    platforms: new Grid1D(c.platforms),
    springs: new Grid1D(c.springs),
    boosts: new Grid1D(c.boosts),
    mud: new Grid1D(c.mud),
    hazards: new Grid1D(c.hazards),
  };
}

/**
 * Construye la pista determinista para una semilla.
 * Estructura: largada → 4 fáciles → 1 respiro → 4 intermedios → 3 difíciles
 * → 1 intermedio → 1 difícil → 1 intermedio → recta final. Cajas del Caos en bloques fijos.
 */
export function buildRaceCourse(seed: number): RaceCourse {
  const rng = new Rng(hash32(seed, 0x7ace));
  const b = new CourseBuilder(rng);

  const easy = rng.shuffle(EASY.filter((c) => c.name !== 'respiro'));
  const breather = EASY.find((c) => c.name === 'respiro') as ChunkDef;
  const medium = rng.shuffle(MEDIUM);
  const hard = rng.shuffle(HARD);

  const sequence: Array<{ def: ChunkDef; theme: RaceTheme; box: boolean }> = [
    { def: START, theme: 'beach', box: false },
    { def: easy[0] as ChunkDef, theme: 'beach', box: false },
    { def: easy[1] as ChunkDef, theme: 'beach', box: false },
    { def: easy[2] as ChunkDef, theme: 'beach', box: true },
    { def: easy[3] as ChunkDef, theme: 'beach', box: false },
    { def: breather, theme: 'jungle', box: false },
    { def: medium[0] as ChunkDef, theme: 'jungle', box: false },
    { def: medium[1] as ChunkDef, theme: 'jungle', box: true },
    { def: medium[2] as ChunkDef, theme: 'jungle', box: false },
    { def: medium[3] as ChunkDef, theme: 'cliffs', box: false },
    { def: hard[0] as ChunkDef, theme: 'cliffs', box: true },
    { def: hard[1] as ChunkDef, theme: 'cliffs', box: false },
    { def: hard[2] as ChunkDef, theme: 'cliffs', box: false },
    { def: medium[4] as ChunkDef, theme: 'volcano', box: true },
    { def: hard[3] as ChunkDef, theme: 'volcano', box: false },
    { def: medium[5] as ChunkDef, theme: 'volcano', box: false },
    { def: FINALE, theme: 'volcano', box: false },
  ];

  const chunkNames: string[] = [];
  for (const item of sequence) {
    b.setTheme(item.theme);
    const chunkStart = b.x;
    b.checkpoint(40);
    if (item.box && item.def.name !== 'caja-erizos') b.box(120);
    item.def.build(b);
    b.scatterDecor(chunkStart);
    chunkNames.push(item.def.name);
  }

  const finaleStart = b.x - 2200;
  const startX = COURSE_CONSTANTS.START_OFFSET;
  const finishX = finaleStart + COURSE_CONSTANTS.FINISH_OFFSET;
  b.decor.push({ kind: 'totem', x: startX - 60, y: 0, scale: 1, flip: false });

  // Eventos de caos: tres ventanas de 6 s con anuncio previo (el cliente lo muestra 2 s antes).
  const kinds = rng.shuffle<ChaosKind>(['lowgrav', 'speed', 'wind']);
  const chaos: ChaosWindow[] = [];
  const baseSeconds = [17, 39, 61];
  for (let i = 0; i < 3; i++) {
    const startSec = (baseSeconds[i] as number) + rng.int(0, 4);
    chaos.push({
      kind: kinds[i] as ChaosKind,
      start: startSec * TICK_RATE,
      end: (startSec + 6) * TICK_RATE,
    });
  }

  // Orden por X e ids consecutivos (la simulación recorre corazones en orden).
  const sortById = <T extends { id: number; x: number }>(arr: T[]): T[] => {
    arr.sort((a, b) => a.x - b.x);
    arr.forEach((it, i) => (it.id = i));
    return arr;
  };
  sortById(b.hearts);
  sortById(b.boxes);
  b.hazards.sort((a, c) => a.x0 - c.x0);
  b.hazards.forEach((hz, i) => (hz.id = i));

  const base = {
    seed,
    startX,
    finishX,
    endX: b.x,
    deathY: COURSE_CONSTANTS.DEATH_Y,
    solids: b.solids,
    platforms: b.platforms,
    springs: b.springs,
    boosts: b.boosts,
    mud: b.mud,
    hazards: b.hazards,
    hearts: b.hearts,
    boxes: b.boxes,
    checkpoints: b.checkpoints,
    decor: b.decor,
    zones: b.zones,
    chaos,
    chunks: chunkNames,
  };
  return { ...base, index: buildIndex(base) };
}

/** Superficie más alta (sólida o plataforma) en x, por debajo de y. */
export function groundBelow(course: RaceCourse, x: number, y: number): number | null {
  let best: number | null = null;
  const scratch: Rect[] = [];
  for (const list of [course.index.solids, course.index.platforms]) {
    list.query(x, x, scratch);
    for (const r of scratch) {
      if (x >= r.x0 && x <= r.x1 && r.y0 >= y - 1) {
        if (best === null || r.y0 < best) best = r.y0;
      }
    }
  }
  return best;
}

export function chaosAt(course: RaceCourse, tick: number): ChaosKind | null {
  for (const w of course.chaos) {
    if (tick >= w.start && tick < w.end) return w.kind;
  }
  return null;
}

export function themeAt(course: RaceCourse, x: number): RaceTheme {
  let theme: RaceTheme = 'beach';
  for (const z of course.zones) {
    if (x >= z.x) theme = z.theme;
  }
  return theme;
}
