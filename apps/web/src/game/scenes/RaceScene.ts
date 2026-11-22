import Phaser from 'phaser';
import {
  ITEM,
  RACE,
  STUN_KIND,
  buildRaceCourse,
  chaosAt,
  heartCollected,
  boxTaken,
  runnerProgress,
  themeAt,
  type GameEventPayload,
  type GameStartPayload,
  type ItemId,
  type Pair,
  type RaceCourse,
  type RaceTheme,
  type RunnerEvent,
  type RunnerState,
  type Slot,
} from '@duo/shared';
import { audio } from '../../audio';
import { input } from '../../input/InputState';
import { bus } from '../../net/bus';
import { net } from '../../net/NetClient';
import { hud } from '../../state/hud';
import { store } from '../../state/store';
import { addImage, addTile, setImageKey } from '../art/atlas';
import { THEME_COLORS } from '../art/environment';
import { CHARACTER_COLOR } from '../art/palette';
import { CharacterRig, type Pose } from '../CharacterRig';
import { Fx, vibrate } from '../fx';
import { RacePredictor } from '../net/RacePredictor';
import { autopilot } from '../autopilot';
import { ParallaxLayer, PerfMonitor, currentTick, fitZoom, keepAwake, makeNameTag, mySlot } from './common';

const COLUMN = 512;
const CHAOS_NAMES: Record<string, string> = {
  lowgrav: '¡Gravedad lunar!',
  speed: '¡Turbo para todos!',
  wind: '¡Viento en contra!',
};
const ITEM_SFX: Record<number, 'turbo' | 'peel' | 'cloud' | 'kiss' | 'shield'> = {
  [ITEM.Turbo]: 'turbo',
  [ITEM.Peel]: 'peel',
  [ITEM.Cloud]: 'cloud',
  [ITEM.Kiss]: 'kiss',
  [ITEM.Shield]: 'shield',
};

export class RaceScene extends Phaser.Scene {
  private start!: GameStartPayload;
  private course!: RaceCourse;
  private pred!: RacePredictor;
  private me: Slot = 0;
  private rigs!: Pair<CharacterRig>;
  private tags!: Pair<Phaser.GameObjects.Text>;
  private marker!: Phaser.GameObjects.Triangle;
  private fx!: Fx;
  private sky!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private farA!: ParallaxLayer;
  private midA!: ParallaxLayer;
  private theme: RaceTheme = 'beach';
  private columns = new Map<number, Phaser.GameObjects.GameObject[]>();
  private visibleCols = new Set<number>();
  private hearts: Phaser.GameObjects.Image[] = [];
  private boxes: Phaser.GameObjects.Image[] = [];
  private gulls: Phaser.GameObjects.Image[] = [];
  private boostTiles: Phaser.GameObjects.TileSprite[] = [];
  private springs: Array<{ img: Phaser.GameObjects.Image; x: number }> = [];
  private traps = new Map<number, Phaser.GameObjects.Image>();
  private statusFx!: Pair<{ cloud: Phaser.GameObjects.Image; bubble: Phaser.GameObjects.Image }>;
  private kisses: Array<{ img: Phaser.GameObjects.Image; from: Slot; to: Slot; t: number }> = [];
  private speedLines: Phaser.GameObjects.Image[] = [];
  private unsubs: Array<() => void> = [];
  private lastHud = 0;
  private lastRespawn: Pair<number> = [0, 0];
  private lastChaosAnnounce = -1;
  private camY = 0;
  private perf = new PerfMonitor();
  private finishedShown = false;
  private elapsedTick = 0;
  private lastRain = 0;

  constructor() {
    super('race');
  }

  create(): void {
    const s = store.get();
    const game = s.game;
    if (!game || game.mode !== 'race') return;
    this.start = game;
    this.me = mySlot();
    this.course = buildRaceCourse(game.seed);
    this.pred = new RacePredictor(this.course, this.me, game.matchId);
    this.fx = new Fx(this);
    this.columns.clear();
    this.visibleCols.clear();
    this.hearts = [];
    this.boxes = [];
    this.gulls = [];
    this.boostTiles = [];
    this.springs = [];
    this.traps.clear();
    this.kisses = [];
    this.clouds = [];
    this.speedLines = [];
    this.finishedShown = false;
    this.lastChaosAnnounce = -1;
    this.camY = 0;

    this.buildBackground();
    this.buildWorld();
    this.buildCharacters();

    this.unsubs.push(
      bus.on('snap', (snap) => {
        if (snap.m === 'race') this.pred.onSnapshot(snap);
      }),
      bus.on('event', (ev) => this.onServerEvent(ev)),
      bus.on('emote', (e) => this.onEmote(e.slot, e.id)),
    );

    hud.reset('race', game.matchId);
    input.enabled = true;
    input.reset();
    autopilot.attachRace(this.course, () => this.pred.local, () => this.pred.traps);
    void keepAwake(true);
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());
  }

  private cleanup(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    input.enabled = false;
    input.reset();
    autopilot.detach();
    void keepAwake(false);
    this.scale.off('resize', this.onResize, this);
  }

  private onResize(): void {
    const { zoom, portrait } = fitZoom(portraitAware(), 560);
    this.cameras.main.setZoom(zoom);
    hud.set({ portrait });
  }

  // ───────────────────────── Construcción ─────────────────────────

  private buildBackground(): void {
    this.sky = this.add.graphics().setDepth(-100);
    this.drawSky('beach');
    this.sun = addImage(this, 0, 0, 'sun').setDepth(-95);
    for (let i = 0; i < 6; i++) {
      const c = addImage(this, i * 700, -380 - (i % 3) * 90, i % 2 ? 'cloud1' : 'cloud2')
        .setScrollFactor(0.12, 0.5)
        .setDepth(-90)
        .setAlpha(0.9);
      this.clouds.push(c);
    }
    this.farA = new ParallaxLayer(this, 'far_beach', 0.22, 60, -80, 1.2);
    this.midA = new ParallaxLayer(this, 'mid_beach', 0.45, 40, -70, 1.1);
  }

  private drawSky(theme: RaceTheme): void {
    const c = THEME_COLORS[theme];
    this.sky.clear();
    this.sky.fillGradientStyle(c.skyTop, c.skyTop, c.skyBottom, c.skyBottom, 1);
    this.sky.fillRect(0, 0, 100, 100);
  }

  private setTheme(theme: RaceTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.drawSky(theme);
    this.farA.setKey(`far_${theme}`);
    this.midA.setKey(`mid_${theme}`);
    this.farA.setAlpha(0);
    this.midA.setAlpha(0);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 1;
        this.farA.setAlpha(v);
        this.midA.setAlpha(v);
      },
    });
    const names: Record<RaceTheme, string> = {
      beach: 'Playa del Inicio',
      jungle: 'Selva Enredada',
      cliffs: 'Acantilados Locos',
      volcano: 'Volcán Picante',
    };
    hud.banner(names[theme], 'info', 'Isla del Caos', 1500);
  }

  private addToColumn(obj: Phaser.GameObjects.GameObject, x0: number, x1 = x0): void {
    for (let c = Math.floor(x0 / COLUMN); c <= Math.floor(x1 / COLUMN); c++) {
      let arr = this.columns.get(c);
      if (!arr) {
        arr = [];
        this.columns.set(c, arr);
      }
      arr.push(obj);
    }
    (obj as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
  }

  private buildWorld(): void {
    const c = this.course;
    // Suelo y bloques
    for (const r of c.solids) {
      const theme = themeAt(c, r.x0 + 1);
      const bottom = Math.min(r.y1, 560);
      const fillTop = r.y0 + 22;
      if (bottom > fillTop) {
        const fill = addTile(this, r.x0, fillTop, r.x1 - r.x0, bottom - fillTop, `gfill_${theme}`).setOrigin(0, 0).setDepth(0);
        this.addToColumn(fill, r.x0, r.x1);
      }
      const top = addTile(this, r.x0 - 2, r.y0 - 6, r.x1 - r.x0 + 4, 36, `gtop_${theme}`).setOrigin(0, 0).setDepth(1);
      this.addToColumn(top, r.x0, r.x1);
    }
    for (const p of c.platforms) {
      const plank = addTile(this, p.x0, p.y0 - 2, p.x1 - p.x0, 26, 'plank').setOrigin(0, 0).setDepth(2);
      this.addToColumn(plank, p.x0, p.x1);
    }
    for (const m of c.mud) {
      const mud = addTile(this, m.x0, m.y1 - 22, m.x1 - m.x0, 24, 'mud').setOrigin(0, 0).setDepth(3);
      this.addToColumn(mud, m.x0, m.x1);
    }
    for (const b of c.boosts) {
      const t = addTile(this, b.x0, b.y1 - 40, b.x1 - b.x0, 40, 'boost').setOrigin(0, 0).setDepth(3);
      this.boostTiles.push(t);
      this.addToColumn(t, b.x0, b.x1);
    }
    for (const sp of c.springs) {
      const img = addImage(this, (sp.x0 + sp.x1) / 2, sp.y1 + 2, 'spring').setOrigin(0.5, 1).setDepth(4);
      this.springs.push({ img, x: (sp.x0 + sp.x1) / 2 });
      this.addToColumn(img, sp.x0, sp.x1);
    }
    for (const hz of c.hazards) {
      let obj: Phaser.GameObjects.GameObject;
      const cx = (hz.x0 + hz.x1) / 2;
      if (hz.kind === 'urchin') obj = addImage(this, cx, hz.y1 + 3, 'urchin').setOrigin(0.5, 1);
      else if (hz.kind === 'crab') obj = addImage(this, cx, hz.y1 + 3, 'crab').setOrigin(0.5, 1);
      else if (hz.kind === 'spikes') obj = addTile(this, hz.x0, hz.y1 - 24, hz.x1 - hz.x0, 24, 'spikes').setOrigin(0, 0);
      else if (hz.kind === 'branch') {
        const img = addImage(this, cx, (hz.y0 + hz.y1) / 2 - 4, 'branch');
        img.setDisplaySize(hz.x1 - hz.x0 + 40, 84);
        obj = img;
      } else {
        const img = addImage(this, cx, (hz.y0 + hz.y1) / 2, 'gull1');
        this.gulls.push(img);
        obj = img;
      }
      (obj as Phaser.GameObjects.Image).setDepth(5);
      this.addToColumn(obj, hz.x0 - 40, hz.x1 + 40);
    }
    for (const d of c.decor) {
      const img = addImage(this, d.x, d.y + 4, d.kind === 'totem' ? 'totem' : d.kind).setOrigin(0.5, 1).setDepth(-5);
      img.setScale(img.scaleX * d.scale, img.scaleY * d.scale);
      if (d.flip) img.setFlipX(true);
      this.addToColumn(img, d.x - 100, d.x + 100);
    }
    c.checkpoints.forEach((cp, i) => {
      if (i === 0) return;
      const flag = addImage(this, cp.x - 34, cp.y + 4, 'flagpost').setOrigin(0.5, 1).setDepth(-4);
      this.addToColumn(flag, cp.x - 60, cp.x);
    });
    const startLine = addTile(this, c.startX + 30, -2, 24, 26, 'startline').setOrigin(0, 0).setDepth(2);
    this.addToColumn(startLine, c.startX, c.startX + 60);
    const arch = addImage(this, c.finishX, 6, 'finish').setOrigin(0.5, 1).setDepth(15);
    this.addToColumn(arch, c.finishX - 160, c.finishX + 160);
    const finishLine = addTile(this, c.finishX - 12, -2, 24, 26, 'startline').setOrigin(0, 0).setDepth(2);
    this.addToColumn(finishLine, c.finishX - 20, c.finishX + 20);

    for (const h of c.hearts) {
      const img = addImage(this, h.x, h.y, 'heart').setDepth(6);
      this.hearts[h.id] = img;
      this.addToColumn(img, h.x, h.x);
    }
    for (const b of c.boxes) {
      const img = addImage(this, b.x, b.y, 'box').setDepth(6);
      this.boxes[b.id] = img;
      this.addToColumn(img, b.x, b.x);
    }
    for (let i = 0; i < 10; i++) {
      const line = addImage(this, 0, 0, 'speedline').setDepth(45).setVisible(false);
      line.setData('u', 2);
      line.setData('v', (i + 0.5) / 10);
      this.speedLines.push(line);
    }
  }

  private buildCharacters(): void {
    const room = store.get().room;
    const players = room?.players;
    const mk = (slot: Slot): CharacterRig => {
      const ch = this.start.characters[slot];
      const p = players?.[slot];
      const rig = new CharacterRig(this, this.course.startX - (slot === this.me ? 0 : 26), 0, ch, p?.skin ?? 0, p?.accessory ?? 'none', 84);
      rig.setDepth(slot === this.me ? 21 : 20);
      return rig;
    };
    this.rigs = [mk(0), mk(1)];
    this.tags = [
      makeNameTag(this, this.start.names[0], CHARACTER_COLOR[this.start.characters[0]]),
      makeNameTag(this, this.start.names[1], CHARACTER_COLOR[this.start.characters[1]]),
    ];
    this.marker = this.add.triangle(0, 0, 0, 0, 16, 0, 8, 12, 0xffd25e).setDepth(41).setStrokeStyle(2, 0x2b1650);
    const mkStatus = (): { cloud: Phaser.GameObjects.Image; bubble: Phaser.GameObjects.Image } => ({
      cloud: addImage(this, 0, 0, 'raincloud').setDepth(30).setVisible(false),
      bubble: addImage(this, 0, 0, 'bubble').setDepth(25).setVisible(false),
    });
    this.statusFx = [mkStatus(), mkStatus()];
  }

  // ───────────────────────── Eventos ─────────────────────────

  private nameOf(slot: Slot): string {
    return this.start.names[slot];
  }

  private onServerEvent(ev: GameEventPayload): void {
    const me = this.me;
    switch (ev.k) {
      case 'race:itemGot':
        if (ev.slot === me) this.time.delayedCall(RACE.ITEM_ROLL_TICKS * 16, () => audio.play('itemGet'));
        break;
      case 'race:item': {
        const sfx = ITEM_SFX[ev.item];
        if (ev.slot !== me && sfx) audio.play(sfx, { volume: 0.6 });
        if (ev.item === ITEM.Kiss) {
          const img = addImage(this, ev.x, ev.y - 60, 'kissproj').setDepth(46);
          this.kisses.push({ img, from: ev.slot, to: ev.slot === 0 ? 1 : 0, t: 0 });
          if (ev.slot !== me) hud.banner('¡Beso volador en camino!', 'bad', `de ${this.nameOf(ev.slot)}`, 1300);
        } else if (ev.item === ITEM.Cloud && ev.slot !== me) {
          hud.banner('¡Nube gruñona!', 'bad', `${this.nameOf(ev.slot)} te mandó lluvia`, 1500);
        } else if (ev.item === ITEM.Peel && ev.slot === me) {
          hud.banner('¡Cáscara al piso!', 'good', undefined, 900);
        }
        break;
      }
      case 'race:effect': {
        if (ev.target === me) {
          if (ev.result === 'blocked') {
            audio.play('shieldBreak');
            hud.banner('¡Tu escudo lo frenó!', 'good', undefined, 1200);
          } else if (ev.result === 'applied' && ev.effect === 'kiss') {
            audio.play('kiss');
            vibrate([30, 40, 30]);
            hud.banner('¡Te derritió un beso!', 'bad', '¡qué distracción!', 1500);
            const r = this.rigs[me];
            this.fx.hearts(r.x, r.y - 70, 10);
          }
        } else if (ev.result === 'applied') {
          hud.banner(ev.effect === 'kiss' ? '¡Beso certero!' : '¡Le llueve encima!', 'good', undefined, 1100);
          if (ev.effect === 'kiss') {
            const r = this.rigs[ev.target];
            this.fx.hearts(r.x, r.y - 70, 8);
          }
        } else if (ev.result === 'blocked') {
          hud.banner('¡Tenía escudo!', 'info', undefined, 1000);
        }
        break;
      }
      case 'race:trapHit':
        if (ev.slot !== me && !ev.shielded) hud.banner('¡Resbaló en tu cáscara!', 'good', undefined, 1200);
        if (ev.slot !== me) audio.play('slip', { volume: 0.5 });
        break;
      case 'race:hit':
        if (ev.slot !== me) audio.play('hit', { volume: 0.35 });
        break;
      case 'race:fall':
        if (ev.slot !== me) audio.play('fall', { volume: 0.35 });
        break;
      case 'race:finish':
        if (ev.slot === me) {
          hud.set({ finished: { place: ev.place } });
        } else {
          hud.set({ rivalFinished: true });
          hud.banner(`¡${this.nameOf(ev.slot)} llegó a la meta!`, ev.place === 1 ? 'bad' : 'info', undefined, 1600);
        }
        break;
      case 'race:lead':
        hud.banner(ev.slot === me ? '¡Vas adelante!' : `¡${this.nameOf(ev.slot)} pasa adelante!`, ev.slot === me ? 'good' : 'bad', undefined, 1100);
        break;
      default:
        break;
    }
  }

  private onEmote(slot: Slot, id: string): void {
    const r = this.rigs?.[slot];
    if (!r) return;
    if (id === 'heart' || id === 'kiss') this.fx.hearts(r.x, r.y - 90, 6);
    else this.fx.sparkle(r.x, r.y - 90, 6);
  }

  private handleFresh(events: RunnerEvent[]): void {
    const r = this.rigs[this.me];
    const st = this.pred.local;
    for (const ev of events) {
      switch (ev.t) {
        case 'jump':
          audio.play(ev.double ? 'doubleJump' : 'jump');
          this.fx.dust(r.x, r.y, ev.double ? 4 : 6);
          break;
        case 'land':
          audio.play('land', { volume: 0.5 });
          this.fx.dust(r.x, r.y, 5);
          break;
        case 'heart': {
          audio.play('heart', { pitch: 1 + ((st.hearts % 5) * 0.04) });
          const h = this.course.hearts[ev.id];
          if (h) this.fx.sparkle(h.x, h.y, 6);
          break;
        }
        case 'box':
          audio.play('box');
          audio.play('itemRoll', { volume: 0.6 });
          break;
        case 'hit':
          if (ev.shielded) {
            audio.play('shieldBreak');
          } else {
            audio.play('hit');
            vibrate(60);
            this.fx.shake(0.008, 200);
            this.fx.stars(r.x, r.y - 80);
            r.react({ eyes: 'dizzy', mouth: 'wow' }, 0.8);
          }
          break;
        case 'trap':
          audio.play(ev.shielded ? 'shieldBreak' : 'slip');
          if (!ev.shielded) vibrate([20, 30, 20]);
          break;
        case 'fall':
          audio.play('fall');
          vibrate(90);
          this.fx.shake(0.01, 250);
          break;
        case 'respawn':
          audio.play('respawn');
          this.fx.sparkle(st.x, st.y - 40, 12);
          break;
        case 'spring': {
          audio.play('spring');
          const sp = this.springs.find((s) => Math.abs(s.x - st.x) < 80);
          if (sp) this.tweens.add({ targets: sp.img, scaleY: sp.img.scaleY * 0.6, duration: 80, yoyo: true });
          break;
        }
        case 'boost':
          audio.play('boost');
          break;
        case 'checkpoint':
          audio.play('checkpoint', { volume: 0.5 });
          break;
        case 'finish':
          audio.play('finish');
          vibrate([40, 60, 40]);
          this.fx.confetti(this.course.finishX, -160, 50);
          break;
        case 'use': {
          const sfx = ITEM_SFX[ev.item];
          if (sfx) audio.play(sfx);
          break;
        }
        default:
          break;
      }
    }
    events.length = 0;
  }

  // ───────────────────────── Bucle ─────────────────────────

  private poseFor(s: RunnerState): Pose {
    if (s.stun > 0) {
      if (s.stunKind === STUN_KIND.Kiss) return 'love';
      if (s.stunKind === STUN_KIND.Slip) return 'slip';
      return 'stun';
    }
    if (s.finish >= 0 && s.vx < 40 && s.ground) return 'celebrate';
    if (!s.ground) return s.vy < 0 ? 'jump' : 'fall';
    if (s.sliding) return 'slide';
    if (s.vx > 10) return 'run';
    return 'idle';
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.pred) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    this.perf.tick(deltaMs);
    const s = store.get();
    const game = s.game;
    if (!game || game.matchId !== this.start.matchId) return;
    const room = s.room;
    const tick = currentTick(game.clock);
    const live = room && (room.phase === 'playing' || room.phase === 'paused') && tick >= 1;
    if (live) {
      this.pred.advanceTo(tick, () => input.buttons);
      const payload = this.pred.takeInputs();
      if (payload) net.sendInput(payload);
      this.elapsedTick = tick;
    }
    this.handleFresh(this.pred.freshEvents);
    this.pred.decayOffset(dt);

    const mine = this.pred.local;
    const rival = this.pred.updateRival();
    const states: Pair<RunnerState> = this.me === 0 ? [mine, rival] : [rival, mine];

    for (const slot of [0, 1] as const) {
      const st = states[slot];
      const rig = this.rigs[slot];
      const isMe = slot === this.me;
      const ox = isMe ? this.pred.offset.x : 0;
      const oy = isMe ? this.pred.offset.y : 0;
      if (st.respawn > 0) {
        if (this.lastRespawn[slot] === 0) {
          this.fx.splash(rig.x, Math.min(rig.y, 60));
        }
        rig.setVisible(false);
        this.tags[slot].setVisible(false);
      } else {
        rig.setVisible(true);
        this.tags[slot].setVisible(true);
        rig.setPosition(st.x + ox, st.y + oy);
        rig.speed = st.vx;
        rig.setPose(this.poseFor(st));
        rig.flicker = st.invuln > 0 && st.stun === 0;
        rig.shadowY = 0;
        rig.setFacing(st.vx < -20 ? -1 : 1);
        this.tags[slot].setPosition(rig.x, rig.y - 98);
      }
      this.lastRespawn[slot] = st.respawn;
      rig.update(dt);

      const fxs = this.statusFx[slot];
      fxs.cloud.setVisible(st.slow > 0 && st.respawn === 0);
      if (st.slow > 0) {
        fxs.cloud.setPosition(rig.x, rig.y - 150 + Math.sin(this.time.now / 200) * 4);
        if (this.time.now - this.lastRain > 90) {
          this.lastRain = this.time.now;
          this.fx.burst('raindrop', rig.x + Phaser.Math.Between(-40, 40), rig.y - 130, 1, {
            speedY: { min: 380, max: 460 },
            lifespan: 320,
            alpha: { start: 1, end: 0.3 },
          });
        }
      }
      fxs.bubble.setVisible(st.shield > 0 && st.respawn === 0);
      if (st.shield > 0) {
        fxs.bubble.setPosition(rig.x, rig.y - 44).setAlpha(0.65 + Math.sin(this.time.now / 120) * 0.25);
      }
      if (st.stunKind === STUN_KIND.Kiss && st.stun > 0 && Math.random() < 0.08) this.fx.hearts(rig.x, rig.y - 80, 1);
    }
    this.marker.setPosition(this.rigs[this.me].x - 8, this.rigs[this.me].y - 118);
    this.marker.setVisible(this.rigs[this.me].visible);

    this.updateKisses(dt);
    this.updateCamera(dt, mine);
    this.updateWorldVisibility(mine);
    this.updateHud(mine, rival, tick);
  }

  private updateKisses(dt: number): void {
    this.kisses = this.kisses.filter((k) => {
      k.t += dt / (RACE.KISS_FLIGHT_TICKS / 60);
      const from = this.rigs[k.from];
      const to = this.rigs[k.to];
      const t = Math.min(1, k.t);
      const x = Phaser.Math.Linear(from.x, to.x, t);
      const y = Phaser.Math.Linear(from.y - 70, to.y - 60, t) - Math.sin(t * Math.PI) * 120;
      k.img.setPosition(x, y).setAngle(Math.sin(t * 20) * 15).setScale(k.img.scaleX, k.img.scaleX);
      if (t >= 1) {
        k.img.destroy();
        return false;
      }
      return true;
    });
  }

  private updateCamera(dt: number, mine: RunnerState): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const focusX = this.rigs[this.me].x;
    const targetY = mine.y < -110 ? mine.y + 110 : 0;
    this.camY += (targetY - this.camY) * Math.min(1, dt * 4);
    cam.scrollX = focusX - viewW * 0.3 - (cam.width - viewW) / 2;
    cam.scrollY = this.camY - viewH * 0.7 - (cam.height - viewH) / 2;
    const wv = cam.worldView;
    this.sky.setPosition(wv.x - 4, wv.y - 4).setScale((wv.width + 8) / 100, (wv.height + 8) / 100);
    this.sun.setPosition(wv.x + wv.width * 0.8, wv.y + wv.height * 0.18);
    this.farA.update(cam);
    this.midA.update(cam);
    this.clouds.forEach((c, i) => {
      c.x += dt * (6 + i * 2);
      const span = 4200;
      const left = cam.scrollX * 0.12 - 300;
      if (c.x < left) c.x += span;
      if (c.x > left + span) c.x -= span;
    });
    this.setTheme(themeAt(this.course, focusX));

    // Líneas de velocidad (turbo o caos de velocidad)
    const fast = mine.boost > 0 || chaosAt(this.course, mine.tick) === 'speed';
    this.speedLines.forEach((l) => {
      if (!fast || store.get().settings.reduceMotion) {
        l.setVisible(false);
        return;
      }
      let u = l.getData('u') as number;
      if (!l.visible || u < -0.2) {
        l.setVisible(true);
        u = 1 + Math.random() * 0.6;
        l.setData('v', 0.1 + Math.random() * 0.8);
        l.setAlpha(0.35 + Math.random() * 0.4);
      }
      u -= dt * 2.2;
      l.setData('u', u);
      l.setPosition(wv.x + u * wv.width, wv.y + (l.getData('v') as number) * wv.height);
    });
  }

  private updateWorldVisibility(mine: RunnerState): void {
    const wv = this.cameras.main.worldView;
    const c0 = Math.floor((wv.x - 200) / COLUMN);
    const c1 = Math.floor((wv.right + 200) / COLUMN);
    const next = new Set<number>();
    for (let c = c0; c <= c1; c++) next.add(c);
    for (const c of this.visibleCols) {
      if (!next.has(c)) for (const o of this.columns.get(c) ?? []) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    }
    for (const c of next) {
      if (!this.visibleCols.has(c)) for (const o of this.columns.get(c) ?? []) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    }
    this.visibleCols = next;

    const t = this.time.now / 1000;
    for (const h of this.course.hearts) {
      const img = this.hearts[h.id];
      if (!img || h.x < wv.x - 100 || h.x > wv.right + 100) continue;
      const taken = heartCollected(mine, h.id);
      img.setVisible(!taken);
      if (!taken) img.y = h.y + Math.sin(t * 3 + h.id) * 4;
    }
    for (const b of this.course.boxes) {
      const img = this.boxes[b.id];
      if (!img || b.x < wv.x - 100 || b.x > wv.right + 100) continue;
      const taken = boxTaken(mine, b.id);
      img.setVisible(!taken);
      if (!taken) {
        img.y = b.y + Math.sin(t * 2.4 + b.id) * 5;
        img.setAngle(Math.sin(t * 1.7 + b.id) * 8);
      }
    }
    const flap = Math.floor(t * 7) % 2 === 0;
    for (const g of this.gulls) {
      if (!g.visible) continue;
      setImageKey(g, flap ? 'gull1' : 'gull2');
    }
    for (const tile of this.boostTiles) tile.tilePositionX -= 3;

    // Trampas según el servidor
    const alive = new Set<number>();
    for (const tr of this.pred.traps) {
      alive.add(tr.id);
      if (!this.traps.has(tr.id)) {
        const img = addImage(this, tr.x, tr.y + 2, 'trap').setOrigin(0.5, 1).setDepth(7);
        img.setScale(img.scaleX * 0.2);
        this.tweens.add({ targets: img, scaleX: img.scaleX * 5, scaleY: img.scaleY * 5, duration: 200, ease: 'Back.Out' });
        this.traps.set(tr.id, img);
      }
    }
    for (const [id, img] of this.traps) {
      if (!alive.has(id)) {
        img.destroy();
        this.traps.delete(id);
      }
    }
  }

  private updateHud(mine: RunnerState, rival: RunnerState, tick: number): void {
    const now = this.time.now;
    if (now - this.lastHud < 100) return;
    this.lastHud = now;
    const pm = runnerProgress(mine, this.course);
    const pr = runnerProgress(rival, this.course);
    const progress: Pair<number> = this.me === 0 ? [pm, pr] : [pr, pm];
    let place: 1 | 2 = pm >= pr ? 1 : 2;
    if (mine.finish >= 0 && rival.finish >= 0) place = mine.finish <= rival.finish ? 1 : 2;
    else if (rival.finish >= 0) place = 2;
    else if (mine.finish >= 0) place = 1;

    // Caos: anuncio 2 s antes y durante la ventana.
    let chaos: { kind: 'lowgrav' | 'speed' | 'wind'; active: boolean } | null = null;
    for (const w of this.course.chaos) {
      if (tick >= w.start - 120 && tick < w.end) {
        chaos = { kind: w.kind, active: tick >= w.start };
        if (tick >= w.start && this.lastChaosAnnounce !== w.start) {
          this.lastChaosAnnounce = w.start;
          audio.play('chaos');
          hud.banner(CHAOS_NAMES[w.kind] ?? '¡Caos!', 'chaos', 'Evento del caos', 1800);
        }
      }
    }
    const item: ItemId = mine.item;
    hud.set({
      progress,
      place,
      hearts: mine.hearts,
      item,
      itemRolling: item === ITEM.Pending || mine.itemRoll > 0,
      chaos,
      elapsed: Math.max(0, this.elapsedTick),
    });
    if (mine.finish >= 0 && !this.finishedShown) {
      this.finishedShown = true;
      hud.set({ finished: { place } });
    }
    audio.setMusicIntensity(pm > 0.85 && mine.finish < 0 ? 2 : pm > 0.5 ? 1 : 0);
  }
}

function portraitAware(): number {
  return window.innerHeight > window.innerWidth * 1.1 ? 660 : 980;
}
