import Phaser from 'phaser';
import {
  COOP,
  buildCoopLevel,
  isSolidTile,
  nearInteractable,
  type CoopLevel,
  type CoopMech,
  type CoopPlayerState,
  type GameEventPayload,
  type GameStartPayload,
  type MechEvent,
  type Pair,
  type Slot,
} from '@duo/shared';
import { audio } from '../../audio';
import { input } from '../../input/InputState';
import { bus } from '../../net/bus';
import { net } from '../../net/NetClient';
import { hud } from '../../state/hud';
import { store } from '../../state/store';
import { addImage, addTile, setImageKey } from '../art/atlas';
import { CHARACTER_COLOR } from '../art/palette';
import { autopilot } from '../autopilot';
import { CharacterRig, type Pose } from '../CharacterRig';
import { Fx, vibrate } from '../fx';
import { CoopPredictor } from '../net/CoopPredictor';
import { PerfMonitor, currentTick, fitZoom, keepAwake, makeNameTag, mySlot, viewRect } from './common';

const HINTS = [
  'Uno pisa la placa y el otro cruza la puerta. ¡Después al revés!',
  'Chispa cruza la barrera cálida y pisa la placa del puente. Bruma, ¡sostené la otra placa!',
  'El ascensor sube solo si están los dos arriba.',
  'Cada uno a una consola… ¡y presionen a la vez! Usen “Contar 3, 2, 1”.',
];

export class CoopScene extends Phaser.Scene {
  private start!: GameStartPayload;
  private level!: CoopLevel;
  private pred!: CoopPredictor;
  private me: Slot = 0;
  private rigs!: Pair<CharacterRig>;
  private tags!: Pair<Phaser.GameObjects.Text>;
  private fx!: Fx;
  private plates: Phaser.GameObjects.Image[] = [];
  private doors: Phaser.GameObjects.Image[] = [];
  private gates: Array<{ tile: Phaser.GameObjects.TileSprite; icon: Phaser.GameObjects.Image }> = [];
  private bridges: Phaser.GameObjects.TileSprite[] = [];
  private levers: Phaser.GameObjects.Image[] = [];
  private consoles: Array<{ img: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image }> = [];
  private elevator!: Phaser.GameObjects.Image;
  private ropes!: Phaser.GameObjects.Graphics;
  private heartGate!: Phaser.GameObjects.Image;
  private portal!: Phaser.GameObjects.Image;
  private waters: Phaser.GameObjects.TileSprite[] = [];
  private torches: Phaser.GameObjects.Image[] = [];
  private signs: Array<{ x: number; y: number; text: Phaser.GameObjects.Text }> = [];
  private arrow!: Phaser.GameObjects.Triangle;
  private marker!: Phaser.GameObjects.Triangle;
  private arrowTag!: Phaser.GameObjects.Text;
  private unsubs: Array<() => void> = [];
  private lastHud = 0;
  private lastRespawn: Pair<number> = [0, 0];
  private perf = new PerfMonitor();
  private camX = 0;
  private camY = 0;

  constructor() {
    super('coop');
  }

  create(): void {
    const s = store.get();
    const game = s.game;
    if (!game || game.mode !== 'coop') return;
    this.start = game;
    this.me = mySlot();
    this.level = buildCoopLevel();
    this.pred = new CoopPredictor(this.level, this.me, game.characters[this.me], game.matchId);
    this.fx = new Fx(this);
    this.plates = [];
    this.doors = [];
    this.gates = [];
    this.bridges = [];
    this.levers = [];
    this.consoles = [];
    this.waters = [];
    this.torches = [];
    this.signs = [];

    this.buildLevel();
    this.buildCharacters();

    this.unsubs.push(
      bus.on('snap', (snap) => {
        if (snap.m === 'coop') this.pred.onSnapshot(snap);
      }),
      bus.on('event', (ev) => this.onServerEvent(ev)),
      bus.on('emote', (e) => {
        const r = this.rigs?.[e.slot];
        if (!r) return;
        if (e.id === 'heart' || e.id === 'kiss') this.fx.hearts(r.x, r.y - 90, 6);
        else this.fx.sparkle(r.x, r.y - 90, 6);
      }),
    );
    hud.reset('coop', game.matchId);
    hud.set({ totalRooms: this.level.rooms.length, hint: HINTS[0] ?? null });
    input.enabled = true;
    input.reset();
    autopilot.attachCoop(this.level, game.characters[this.me], () => this.pred.local, () => this.pred.partnerDisplay, () => this.pred.mech);
    void keepAwake(true);
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    const p0 = this.pred.local;
    this.camX = p0.x;
    this.camY = p0.y;
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
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const { zoom } = fitZoom(portrait ? 560 : 820, portrait ? 640 : 480);
    this.cameras.main.setZoom(zoom);
    hud.set({ portrait });
  }

  private buildLevel(): void {
    const L = this.level;
    const T = L.tile;
    this.cameras.main.setBackgroundColor('#0f2430');
    addTile(this, -400, -200, L.width + 800, L.height + 400, 't_wall').setOrigin(0, 0).setDepth(-50).setScrollFactor(0.85, 0.85).setTint(0x9fb6c8);
    const glow = this.add.graphics().setDepth(-49);
    glow.fillGradientStyle(0x16324a, 0x16324a, 0x2a5a5e, 0x2a5a5e, 0.55);
    glow.fillRect(-400, -200, L.width + 800, L.height + 400);

    // Baldosas sólidas: franjas horizontales (menos objetos que una por baldosa).
    for (let r = 0; r < L.rows; r++) {
      let c = 0;
      while (c < L.cols) {
        if (!isSolidTile(L, c, r)) {
          c++;
          continue;
        }
        let end = c;
        while (end + 1 < L.cols && isSolidTile(L, end + 1, r)) end++;
        addTile(this, c * T, r * T, (end - c + 1) * T, T, 't_brick').setOrigin(0, 0).setDepth(0);
        // Borde con musgo donde arriba hay aire
        let run = -1;
        for (let k = c; k <= end + 1; k++) {
          const open = k <= end && r > 0 && !isSolidTile(L, k, r - 1);
          if (open && run < 0) run = k;
          if (!open && run >= 0) {
            addTile(this, run * T, r * T - 8, (k - run) * T, 24, 't_bricktop').setOrigin(0, 0).setDepth(1);
            run = -1;
          }
        }
        c = end + 1;
      }
    }

    for (const p of L.platforms) addTile(this, p.x0, p.y0 - 3, p.x1 - p.x0, 32, 'plank').setOrigin(0, 0).setDepth(2);
    for (const h of L.hazards) {
      if (h.kind === 'water') {
        const body = this.add.graphics().setDepth(8);
        body.fillStyle(0x2f8fd0, 0.88);
        body.fillRect(h.x0, h.y0 + 20, h.x1 - h.x0, h.y1 - h.y0);
        const w = addTile(this, h.x0, h.y0 - 8, h.x1 - h.x0, 32, 't_water').setOrigin(0, 0).setDepth(8).setAlpha(0.95);
        this.waters.push(w);
      } else {
        addTile(this, h.x0, h.y1 - 24, h.x1 - h.x0, 24, 't_thorns').setOrigin(0, 0).setDepth(3);
      }
    }
    for (const d of L.decor) {
      const key = d.kind === 'torch' || d.kind === 'fern' ? d.kind : `t_${d.kind}`;
      const img = addImage(this, d.x, d.y, key).setDepth(-5);
      if (d.kind === 'vine') img.setOrigin(0.5, 0);
      else if (d.kind === 'torch') {
        img.setOrigin(0.5, 0.5);
        this.torches.push(addImage(this, d.x, d.y - 40, 'glow').setDepth(-4).setTint(0xffb35a).setAlpha(0.6).setScale(2.4));
      } else img.setOrigin(0.5, 1);
    }
    for (const sg of L.signs) {
      addImage(this, sg.x, sg.y + 2, 't_sign').setOrigin(0.5, 1).setDepth(-3);
      const text = this.add
        .text(sg.x, sg.y - 76, sg.text, {
          fontFamily: 'Nunito, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#2b1650',
          backgroundColor: '#fff6e8',
          padding: { x: 10, y: 6 },
          wordWrap: { width: 230 },
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(42)
        .setAlpha(0);
      this.signs.push({ x: sg.x, y: sg.y, text });
    }

    for (const p of L.plates) {
      this.plates.push(addImage(this, (p.x0 + p.x1) / 2, p.y1 + 1, 't_plate').setOrigin(0.5, 1).setDepth(4));
    }
    for (const d of L.doors) {
      this.doors.push(addImage(this, (d.x0 + d.x1) / 2, d.y0, 't_door').setOrigin(0.5, 0).setDepth(-1));
    }
    for (const g of L.gates) {
      const tile = addTile(this, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, g.character === 'chispa' ? 't_gate_warm' : 't_gate_cool')
        .setOrigin(0, 0)
        .setDepth(9);
      const icon = addImage(this, (g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, g.character === 'chispa' ? 'icon_sun' : 'icon_moon').setDepth(10);
      this.gates.push({ tile, icon });
    }
    for (const b of L.bridges) {
      this.bridges.push(addTile(this, b.x0, b.y0 - 2, 1, 24, 't_bridge').setOrigin(0, 0).setDepth(3));
    }
    for (const lv of L.levers) {
      this.levers.push(addImage(this, lv.x, lv.y + 2, 't_lever_off').setOrigin(0.5, 1).setDepth(4));
    }
    for (const c of L.consoles) {
      const ring = addImage(this, c.x, c.y - 48, 'ring').setDepth(5).setTint(0x6fe3a5).setAlpha(0);
      const img = addImage(this, c.x, c.y + 2, 't_console').setOrigin(0.5, 1).setDepth(4);
      this.consoles.push({ img, ring });
    }
    const el = L.elevator;
    this.ropes = this.add.graphics().setDepth(2);
    this.elevator = addImage(this, (el.x0 + el.x1) / 2, el.yBottom, 't_elev').setOrigin(0.5, 0).setDepth(4);
    const hg = L.heartGate;
    this.heartGate = addImage(this, (hg.x0 + hg.x1) / 2, hg.y0, 't_heartgate').setOrigin(0.5, 0).setDepth(-1);
    const ex = L.exit;
    this.portal = addImage(this, (ex.x0 + ex.x1) / 2, (ex.y0 + ex.y1) / 2 - 10, 't_portal').setDepth(-2);
  }

  private buildCharacters(): void {
    const players = store.get().room?.players;
    const mk = (slot: Slot): CharacterRig => {
      const st = slot === this.me ? this.pred.local : this.pred.partnerDisplay;
      const p = players?.[slot];
      const rig = new CharacterRig(this, st.x, st.y, this.start.characters[slot], p?.skin ?? 0, p?.accessory ?? 'none', 72);
      rig.setDepth(slot === this.me ? 21 : 20);
      return rig;
    };
    this.rigs = [mk(0), mk(1)];
    this.tags = [
      makeNameTag(this, this.start.names[0], CHARACTER_COLOR[this.start.characters[0]]),
      makeNameTag(this, this.start.names[1], CHARACTER_COLOR[this.start.characters[1]]),
    ];
    const partner: Slot = this.me === 0 ? 1 : 0;
    this.marker = this.add.triangle(0, 0, 0, 0, 16, 0, 8, 12, 0xffd25e).setDepth(41).setStrokeStyle(2, 0x2b1650);
    const color = Phaser.Display.Color.HexStringToColor(CHARACTER_COLOR[this.start.characters[partner]]).color;
    this.arrow = this.add.triangle(0, 0, 0, 0, 26, 13, 0, 26, color).setDepth(60).setStrokeStyle(3, 0xffffff).setVisible(false);
    this.arrowTag = makeNameTag(this, this.start.names[partner], CHARACTER_COLOR[this.start.characters[partner]]).setDepth(60).setVisible(false);
  }

  private nameOf(slot: Slot): string {
    return this.start.names[slot];
  }

  private onServerEvent(ev: GameEventPayload): void {
    if (ev.k === 'coop:fall') {
      if (ev.slot !== this.me) hud.banner(`¡${this.nameOf(ev.slot)} se dio un chapuzón!`, 'info', 'vuelve al último punto', 1300);
      return;
    }
    if (ev.k === 'coop:count') {
      hud.set({ syncCount: { at: ev.at, slot: ev.slot } });
      return;
    }
    if (ev.k !== 'coop:mech') return;
    this.onMech(ev.ev);
  }

  private onMech(ev: MechEvent): void {
    switch (ev.t) {
      case 'plate':
        if (ev.on) audio.play('plate', { volume: 0.7 });
        break;
      case 'door':
        audio.play('door', { volume: 0.7 });
        break;
      case 'bridge':
        audio.play('bridge', { volume: 0.7 });
        if (ev.out) hud.banner('¡Puente listo!', 'good', undefined, 1000);
        break;
      case 'lever':
        audio.play('lever');
        hud.banner(ev.slot === this.me ? '¡Palanca activada!' : `¡${this.nameOf(ev.slot)} activó la palanca!`, 'good', undefined, 1200);
        break;
      case 'gateOff':
        hud.banner('¡La barrera se apagó!', 'good', 'ahora pueden pasar los dos', 1400);
        break;
      case 'console':
        audio.play('console');
        if (ev.slot !== this.me) hud.banner(`¡${this.nameOf(ev.slot)} presionó!`, 'info', '¡ahora vos!', 900);
        break;
      case 'consoleReset':
        hud.banner('¡Casi!', 'bad', 'necesitan más sincronía', 1200);
        break;
      case 'synced':
        audio.play('synced');
        vibrate([30, 50, 30, 50, 60]);
        hud.banner('¡SINCRONIZADOS!', 'good', 'el Portal del Corazón se abre', 2200);
        for (const r of this.rigs) {
          r.react({ eyes: 'happy', mouth: 'grin' }, 2);
          r.hop();
          this.fx.hearts(r.x, r.y - 80, 8);
        }
        break;
      case 'room': {
        audio.play('checkpoint');
        const room = this.level.rooms[ev.index];
        if (room && ev.index < this.level.rooms.length - 1) hud.banner('¡Sala superada!', 'good', room.name, 1500);
        hud.set({ hint: HINTS[ev.index + 1] ?? null });
        break;
      }
      default:
        break;
    }
  }

  private poseFor(st: CoopPlayerState): Pose {
    if (!st.ground) return st.vy < 0 ? 'jump' : 'fall';
    if (Math.abs(st.vx) > 20) return 'run';
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
    if (room && (room.phase === 'playing' || room.phase === 'paused') && tick >= 1) {
      this.pred.advanceTo(tick, () => input.buttons);
      const payload = this.pred.takeInputs();
      if (payload) net.sendInput(payload);
    }
    this.handleFresh();
    this.pred.decayOffset(dt);

    const mine = this.pred.local;
    const partner = this.pred.updatePartner();
    const states: Pair<CoopPlayerState> = this.me === 0 ? [mine, partner] : [partner, mine];
    for (const slot of [0, 1] as const) {
      const st = states[slot];
      const rig = this.rigs[slot];
      const isMe = slot === this.me;
      if (st.respawn > 0) {
        if (this.lastRespawn[slot] === 0) this.fx.splash(rig.x, rig.y - 10);
        rig.setVisible(false);
        this.tags[slot].setVisible(false);
      } else {
        rig.setVisible(true);
        this.tags[slot].setVisible(!isMe);
        rig.setPosition(st.x + (isMe ? this.pred.offset.x : 0), st.y + (isMe ? this.pred.offset.y : 0));
        rig.speed = Math.abs(st.vx);
        rig.setPose(this.poseFor(st));
        if (Math.abs(st.vx) > 5) rig.setFacing(st.vx > 0 ? 1 : -1);
        else rig.setFacing(st.facing);
        this.tags[slot].setPosition(rig.x, rig.y - 98);
      }
      this.lastRespawn[slot] = st.respawn;
      rig.update(dt);
    }
    const meRig = this.rigs[this.me];
    this.marker.setPosition(meRig.x - 8, meRig.y - 100).setVisible(meRig.visible);
    this.updateMechVisuals(this.pred.mech);
    this.updateCamera(dt);
    this.updateHud(mine, partner, tick);
  }

  private handleFresh(): void {
    const r = this.rigs[this.me];
    for (const ev of this.pred.freshEvents) {
      switch (ev.t) {
        case 'jump':
          audio.play('jump');
          this.fx.dust(r.x, r.y, 4);
          break;
        case 'land':
          audio.play('land', { volume: 0.45 });
          this.fx.dust(r.x, r.y, 4);
          break;
        case 'fall':
          audio.play(ev.kind === 'water' ? 'splash' : 'hit');
          vibrate(70);
          r.react({ eyes: 'wide', mouth: 'wow' }, 1);
          break;
        case 'respawn':
          audio.play('respawn');
          this.fx.sparkle(this.pred.local.x, this.pred.local.y - 40, 10);
          break;
        case 'lever':
        case 'console':
          audio.play('click');
          break;
        default:
          break;
      }
    }
    this.pred.freshEvents.length = 0;
  }

  private updateMechVisuals(m: CoopMech): void {
    const L = this.level;
    const t = this.time.now / 1000;
    L.plates.forEach((_p, i) => setImageKey(this.plates[i] as Phaser.GameObjects.Image, m.plates[i] ? 't_plate_on' : 't_plate'));
    L.doors.forEach((d, i) => {
      const img = this.doors[i];
      if (img) img.y = d.y0 - (m.doors[i] ?? 0) * (d.y1 - d.y0);
    });
    L.gates.forEach((_g, i) => {
      const g = this.gates[i];
      if (!g) return;
      const on = m.gates[i] ?? true;
      const a = on ? 0.75 + Math.sin(t * 4 + i) * 0.2 : Math.max(0, g.tile.alpha - 0.05);
      g.tile.setAlpha(a);
      g.tile.tilePositionY -= 0.6;
      g.icon.setAlpha(on ? 1 : Math.max(0, g.icon.alpha - 0.05));
    });
    L.bridges.forEach((b, i) => {
      const tile = this.bridges[i];
      if (!tile) return;
      const w = Math.max(1, (m.bridges[i] ?? 0) * (b.x1 - b.x0));
      tile.setSize(w, 24);
      tile.setVisible((m.bridges[i] ?? 0) > 0.02);
      const hold = m.bridgeHold[i] ?? 0;
      tile.setAlpha(hold > 0 && hold < COOP.BRIDGE_HOLD_TICKS && (m.bridges[i] ?? 0) > 0.98 ? (Math.sin(t * 20) > 0 ? 1 : 0.5) : 1);
    });
    L.levers.forEach((_l, i) => setImageKey(this.levers[i] as Phaser.GameObjects.Image, m.levers[i] ? 't_lever_on' : 't_lever_off'));
    const myTick = this.pred.localTick;
    L.consoles.forEach((_c, i) => {
      const c = this.consoles[i];
      if (!c) return;
      const armed = m.synced || ((m.consoles[i] ?? -1) >= 0 && myTick - (m.consoles[i] ?? 0) < COOP.CONSOLE_WINDOW_TICKS + 30);
      setImageKey(c.img, armed ? 't_console_on' : 't_console');
      c.ring.setAlpha(armed && !m.synced ? 0.5 + Math.sin(t * 16) * 0.4 : 0);
      c.ring.setScale(c.ring.scaleX);
    });
    const el = L.elevator;
    this.elevator.y = m.elevY - 2;
    this.ropes.clear();
    this.ropes.lineStyle(4, 0x8a6a4a, 1);
    this.ropes.lineBetween(el.x0 + 18, L.tile, el.x0 + 18, m.elevY);
    this.ropes.lineBetween(el.x1 - 18, L.tile, el.x1 - 18, m.elevY);
    const hg = L.heartGate;
    this.heartGate.y = hg.y0 - m.heartGate * (hg.y1 - hg.y0);
    this.portal.setAngle(t * 20).setAlpha(m.synced ? 1 : 0.35);
    this.portal.setScale(this.portal.scaleX);
    for (const w of this.waters) w.tilePositionX += 0.8;
    this.torches.forEach((g, i) => g.setAlpha(0.45 + Math.sin(t * 9 + i * 1.7) * 0.12));
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const L = this.level;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const r = this.rigs[this.me];
    this.camX += (r.x - this.camX) * Math.min(1, dt * 6);
    this.camY += (r.y - 60 - this.camY) * Math.min(1, dt * 5);
    let left = this.camX - viewW / 2;
    let top = this.camY - viewH * 0.55;
    left = Phaser.Math.Clamp(left, 0, Math.max(0, L.width - viewW));
    top = Phaser.Math.Clamp(top, 0, Math.max(0, L.height - viewH));
    if (viewH > L.height) top = (L.height - viewH) / 2;
    cam.scrollX = left - (cam.width - viewW) / 2;
    cam.scrollY = top - (cam.height - viewH) / 2;

    // Carteles: se muestran al acercarse
    const me = this.pred.local;
    for (const sg of this.signs) {
      const near = Math.abs(me.x - sg.x) < 150 && Math.abs(me.y - sg.y) < 120;
      sg.text.setAlpha(Phaser.Math.Linear(sg.text.alpha, near ? 1 : 0, 0.15));
    }

    // Flecha al compañero fuera de cámara
    const partner = this.rigs[this.me === 0 ? 1 : 0];
    const wv = viewRect(cam);
    const inside = partner.visible && partner.x > wv.x + 10 && partner.x < wv.right - 10 && partner.y > wv.y && partner.y - 70 < wv.bottom;
    this.arrow.setVisible(!inside && partner.visible);
    this.arrowTag.setVisible(!inside && partner.visible);
    if (!inside) {
      const cx = wv.centerX;
      const cy = wv.centerY;
      const ang = Math.atan2(partner.y - 40 - cy, partner.x - cx);
      const ax = Phaser.Math.Clamp(cx + Math.cos(ang) * wv.width, wv.x + 30, wv.right - 30);
      const ay = Phaser.Math.Clamp(cy + Math.sin(ang) * wv.height, wv.y + 40, wv.bottom - 60);
      this.arrow.setPosition(ax, ay).setRotation(ang);
      this.arrowTag.setPosition(ax, ay - 20);
    }
    hud.set({ partnerOffscreen: !inside });
  }

  private updateHud(mine: CoopPlayerState, partner: CoopPlayerState, tick: number): void {
    const now = this.time.now;
    if (now - this.lastHud < 100) return;
    this.lastHud = now;
    const m = this.pred.mech;
    const falls: Pair<number> = this.me === 0 ? [mine.falls, partner.falls] : [partner.falls, mine.falls];
    const myTick = this.pred.localTick;
    const armed: Pair<boolean> = [
      (m.consoles[0] ?? -1) >= 0 && myTick - (m.consoles[0] ?? 0) < COOP.CONSOLE_WINDOW_TICKS + 20,
      (m.consoles[1] ?? -1) >= 0 && myTick - (m.consoles[1] ?? 0) < COOP.CONSOLE_WINDOW_TICKS + 20,
    ];
    hud.set({
      rooms: m.roomsCleared,
      falls,
      action: mine.respawn === 0 ? nearInteractable(mine, this.level, m) : null,
      consoleArmed: armed,
      synced: m.synced,
      timeLeft: Math.max(0, COOP.TIME_LIMIT_TICKS - Math.max(0, tick)),
    });
  }
}
