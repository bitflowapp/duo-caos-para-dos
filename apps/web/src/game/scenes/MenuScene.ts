import Phaser from 'phaser';
import type { AccessoryId, CharacterId, RoomState, Slot } from '@duo/shared';
import { bus } from '../../net/bus';
import { store } from '../../state/store';
import { addImage, addTile } from '../art/atlas';
import { CharacterRig } from '../CharacterRig';
import { Fx } from '../fx';
import { ParallaxLayer, fitZoom, mySlot, viewRect } from './common';

interface Look {
  character: CharacterId;
  skin: number;
  accessory: AccessoryId;
}

/** Fondo vivo de los menús: playa de la Isla del Caos al atardecer. */
export class MenuScene extends Phaser.Scene {
  private rigs: Array<CharacterRig | null> = [null, null];
  private looks: Array<string> = ['', ''];
  private fx!: Fx;
  private sky!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private far!: ParallaxLayer;
  private waves!: Phaser.GameObjects.TileSprite;
  private sand!: Phaser.GameObjects.TileSprite;
  private sandFill!: Phaser.GameObjects.TileSprite;
  private palms: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  private unsubs: Array<() => void> = [];
  private lastResultId = -1;
  private lastReady: [boolean, boolean] = [false, false];
  private hugUntil = 0;
  private t = 0;

  constructor() {
    super('menu');
  }

  create(): void {
    this.fx = new Fx(this);
    this.rigs = [null, null];
    this.looks = ['', ''];
    this.palms = [];
    this.clouds = [];
    this.props = [];
    this.sky = this.add.graphics().setDepth(-100);
    this.sky.fillGradientStyle(0x3a1d6e, 0x3a1d6e, 0xff9a6e, 0xff9a6e, 1);
    this.sky.fillRect(0, 0, 100, 100);
    this.sun = addImage(this, 0, 0, 'sun').setDepth(-95);
    for (let i = 0; i < 4; i++) this.clouds.push(addImage(this, i * 420, -300 - (i % 2) * 70, i % 2 ? 'cloud1' : 'cloud2').setDepth(-90).setAlpha(0.75).setTint(0xffd6e8));
    this.far = new ParallaxLayer(this, 'far_beach', 1, 30, -80, 1);
    this.waves = addTile(this, -2000, 0, 6000, 32, 'waves').setOrigin(0, 0).setDepth(-60).setTint(0xffc0a8);
    this.sand = addTile(this, -2000, 0, 6000, 32, 'gtop_beach').setOrigin(0, 0).setDepth(-20);
    this.sandFill = addTile(this, -2000, 0, 6000, 600, 'gfill_beach').setOrigin(0, 0).setDepth(-21);
    for (let i = 0; i < 2; i++) this.palms.push(addImage(this, 0, 0, 'palm').setOrigin(0.5, 1).setDepth(-15));
    for (const k of ['shell', 'flower', 'shell']) this.props.push(addImage(this, 0, 0, k).setOrigin(0.5, 1).setDepth(-10));

    this.unsubs.push(
      store.subscribe(() => this.syncFromStore()),
      bus.on('emote', (e) => this.onEmote(e.slot, e.id)),
    );
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      for (const u of this.unsubs) u();
      this.unsubs = [];
      this.scale.off('resize', this.layout, this);
    });
    this.syncFromStore();
    this.layout();
  }

  private desiredLooks(room: RoomState | null): Array<Look | null> {
    if (!room) {
      return [
        { character: 'chispa', skin: 0, accessory: 'flower' },
        { character: 'bruma', skin: 0, accessory: 'none' },
      ];
    }
    return room.players.map((p) => (p && p.character ? { character: p.character, skin: p.skin, accessory: p.accessory } : null));
  }

  private syncFromStore(): void {
    if (!this.sys.isActive()) return;
    const room = store.get().room;
    const looks = this.desiredLooks(room);
    looks.forEach((look, i) => {
      const key = look ? `${look.character}-${look.skin}-${look.accessory}` : '';
      if (key === this.looks[i]) return;
      this.looks[i] = key;
      this.rigs[i]?.destroy();
      this.rigs[i] = null;
      if (look) {
        const rig = new CharacterRig(this, 0, 0, look.character, look.skin, look.accessory, 120);
        rig.setDepth(10 + i);
        rig.setFacing(i === 0 ? 1 : -1);
        rig.react({ eyes: 'happy', mouth: 'grin' }, 0.8);
        rig.hop();
        this.rigs[i] = rig;
      }
    });
    this.layout();

    if (room) {
      room.players.forEach((p, i) => {
        const ready = p?.ready ?? false;
        if (ready && !this.lastReady[i]) {
          this.rigs[i]?.hop();
          this.rigs[i]?.react({ eyes: 'happy', mouth: 'grin' }, 1.2);
        }
        this.lastReady[i] = ready;
      });
      const res = room.lastResult;
      if (room.phase === 'results' && res && res.id !== this.lastResultId) {
        this.lastResultId = res.id;
        this.celebrate(room);
      }
    }
  }

  private celebrate(room: RoomState): void {
    const res = room.lastResult;
    if (!res) return;
    const success = res.cooperative ? res.details.kind === 'coop' && res.details.success : true;
    this.rigs.forEach((rig, i) => {
      if (!rig) return;
      if (res.cooperative) rig.setPose(success ? 'celebrate' : 'sad');
      else if (res.winner === null) rig.setPose('celebrate');
      else rig.setPose(res.winner === i ? 'celebrate' : 'sad');
    });
    const wv = viewRect(this.cameras.main);
    this.time.delayedCall(250, () => this.fx.confetti(wv.centerX, wv.y + wv.height * 0.2, 70));
    // Después del festejo: abrazo (o consuelo) — el romance como reacción, no obligación.
    this.time.delayedCall(2600, () => {
      this.hugUntil = this.t + 3.2;
      this.rigs.forEach((r) => r?.setPose('hug'));
      const [a, b] = this.rigs;
      if (a && b) this.fx.hearts((a.x + b.x) / 2, a.y - 140, 10);
    });
    this.time.delayedCall(6000, () => this.rigs.forEach((r) => r?.setPose('idle')));
  }

  private onEmote(slot: Slot, id: string): void {
    const rig = this.rigs[slot];
    if (!rig) return;
    rig.hop();
    if (id === 'heart' || id === 'kiss') {
      rig.react({ eyes: 'love', mouth: 'kiss', blush: true }, 1.4);
      this.fx.hearts(rig.x, rig.y - 150, 8);
      const other = this.rigs[slot === 0 ? 1 : 0];
      other?.react({ eyes: 'happy', mouth: 'smile', blush: true }, 1.4);
    } else if (id === 'laugh') {
      rig.react({ eyes: 'happy', mouth: 'grin' }, 1.4);
    } else if (id === 'wow') {
      rig.react({ eyes: 'wide', mouth: 'wow' }, 1.2);
    } else if (id === 'grr') {
      rig.react({ eyes: 'determined', mouth: 'flat' }, 1.2);
      this.fx.stars(rig.x, rig.y - 150);
    } else {
      rig.react({ eyes: 'happy', mouth: 'grin' }, 1.2);
      this.fx.sparkle(rig.x, rig.y - 150, 8);
    }
  }

  private layout(): void {
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const { zoom } = fitZoom(portrait ? 420 : 760, portrait ? 760 : 470);
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(0, -120);
    const wv = viewRect(cam);
    const groundY = wv.bottom - wv.height * (portrait ? 0.15 : 0.13);
    this.sky.setPosition(wv.x - 10, wv.y - 10).setScale((wv.width + 20) / 100, (wv.height + 20) / 100);
    this.sun.setPosition(wv.centerX + wv.width * 0.18, groundY - wv.height * 0.32);
    this.far.update(cam, groundY - 30);
    this.waves.setY(groundY - 52);
    this.sand.setY(groundY - 6);
    this.sandFill.setY(groundY + 20);
    const spread = Math.min(wv.width * 0.24, 230);
    const pos = [wv.centerX - spread, wv.centerX + spread];
    this.rigs.forEach((rig, i) => rig?.setPosition(pos[i] ?? 0, groundY + 4));
    this.palms[0]?.setPosition(wv.x + wv.width * 0.06, groundY + 6);
    this.palms[1]?.setPosition(wv.right - wv.width * 0.05, groundY + 6).setFlipX(true);
    this.props[0]?.setPosition(wv.centerX - spread * 1.6, groundY + 8);
    this.props[1]?.setPosition(wv.centerX + spread * 1.5, groundY + 8);
    this.props[2]?.setPosition(wv.centerX + spread * 0.2, groundY + 14);
    this.clouds.forEach((c, i) => c.setY(wv.y + wv.height * (0.12 + (i % 2) * 0.1)));
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.t += dt;
    this.waves.tilePositionX += dt * 18;
    const wv = viewRect(this.cameras.main);
    this.clouds.forEach((c, i) => {
      c.x += dt * (8 + i * 3);
      if (c.x > wv.right + 200) c.x = wv.x - 200;
    });
    const me = mySlot();
    const [a, b] = this.rigs;
    // Durante el abrazo se acercan; si no, vuelven a su lugar.
    if (a && b) {
      const portrait = window.innerHeight > window.innerWidth * 1.1;
      const spread = Math.min(wv.width * 0.24, 230);
      const target = this.t < this.hugUntil ? 46 : spread;
      const cur = (b.x - a.x) / 2;
      const next = cur + (target - cur) * Math.min(1, dt * 3);
      a.x = wv.centerX - next;
      b.x = wv.centerX + next;
      if (Math.abs(target - cur) > 4) {
        a.setPose(this.t < this.hugUntil ? 'walk' : a.getPose() === 'walk' ? 'idle' : a.getPose());
        b.setPose(this.t < this.hugUntil ? 'walk' : b.getPose() === 'walk' ? 'idle' : b.getPose());
      } else if (this.t < this.hugUntil && a.getPose() === 'walk') {
        a.setPose('hug');
        b.setPose('hug');
      }
      void portrait;
    }
    this.rigs.forEach((r, i) => {
      if (!r) return;
      r.setFacing(i === 0 ? 1 : -1);
      r.setDepth(i === me ? 12 : 11);
      r.update(dt);
    });
  }
}
