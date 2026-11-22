import Phaser from 'phaser';
import type { Pair, Slot } from '@duo/shared';
import { audio } from '../../audio';
import { bus } from '../../net/bus';
import { store } from '../../state/store';
import { addImage, addTile } from '../art/atlas';
import { CharacterRig } from '../CharacterRig';
import { Fx } from '../fx';
import { fitZoom, keepAwake, makeNameTag, viewRect } from './common';

/** Estudio de televisión de "¿Cuánto me conocés?": podios, luces y reacciones. */
export class QuizScene extends Phaser.Scene {
  private rigs!: Pair<CharacterRig>;
  private podiums!: Pair<Phaser.GameObjects.Image>;
  private scores!: Pair<Phaser.GameObjects.Text>;
  private tags!: Pair<Phaser.GameObjects.Text>;
  private bg!: Phaser.GameObjects.Graphics;
  private floor!: Phaser.GameObjects.Graphics;
  private curtains: Phaser.GameObjects.TileSprite[] = [];
  private spots: Phaser.GameObjects.Image[] = [];
  private bulbs: Phaser.GameObjects.Image[] = [];
  private fx!: Fx;
  private unsubs: Array<() => void> = [];
  private lastQ = -1;
  private lastReveal = -1;
  private lastAnswered: Pair<boolean> = [false, false];
  private t = 0;

  constructor() {
    super('quiz');
  }

  create(): void {
    const game = store.get().game;
    if (!game || game.mode !== 'quiz') return;
    this.fx = new Fx(this);
    this.curtains = [];
    this.spots = [];
    this.bulbs = [];
    this.lastQ = -1;
    this.lastReveal = -1;
    this.bg = this.add.graphics().setDepth(-100);
    this.bg.fillGradientStyle(0x24124a, 0x24124a, 0x5a1d6e, 0x5a1d6e, 1);
    this.bg.fillRect(0, 0, 100, 100);
    this.floor = this.add.graphics().setDepth(-40);
    this.floor.fillGradientStyle(0x7a2a6e, 0x7a2a6e, 0x2a0f3e, 0x2a0f3e, 1);
    this.floor.fillRect(0, 0, 100, 100);
    for (let i = 0; i < 2; i++) this.curtains.push(addTile(this, 0, 0, 160, 1200, 'q_curtain').setOrigin(0, 0).setDepth(-30));
    for (let i = 0; i < 3; i++) this.spots.push(addImage(this, 0, 0, 'q_spot').setOrigin(0.5, 0).setDepth(-35).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5));
    for (let i = 0; i < 18; i++) this.bulbs.push(addImage(this, 0, 0, 'q_bulb').setDepth(-20));

    const players = store.get().room?.players;
    const mkRig = (slot: Slot): CharacterRig => {
      const p = players?.[slot];
      const rig = new CharacterRig(this, 0, 0, game.characters[slot], p?.skin ?? 0, p?.accessory ?? 'none', 128);
      rig.setDepth(5);
      rig.setFacing(slot === 0 ? 1 : -1);
      return rig;
    };
    this.rigs = [mkRig(0), mkRig(1)];
    const podKey = (slot: Slot): string => (game.characters[slot] === 'chispa' ? 'q_podium_a' : 'q_podium_b');
    this.podiums = [addImage(this, 0, 0, podKey(0)).setOrigin(0.5, 0).setDepth(8), addImage(this, 0, 0, podKey(1)).setOrigin(0.5, 0).setDepth(8)];
    const scoreStyle = {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#fff6e8',
      stroke: '#2b1650',
      strokeThickness: 6,
      resolution: 2,
    };
    this.scores = [this.add.text(0, 0, '0', scoreStyle).setOrigin(0.5).setDepth(9), this.add.text(0, 0, '0', scoreStyle).setOrigin(0.5).setDepth(9)];
    this.tags = [makeNameTag(this, game.names[0], '#ff7a59'), makeNameTag(this, game.names[1], '#9d8cff')];

    this.unsubs.push(
      store.subscribe(() => this.syncQuiz()),
      bus.on('emote', (e) => {
        const r = this.rigs[e.slot];
        r.hop();
        if (e.id === 'heart' || e.id === 'kiss') this.fx.hearts(r.x, r.y - 170, 8);
      }),
    );
    void keepAwake(true);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      for (const u of this.unsubs) u();
      this.unsubs = [];
      void keepAwake(false);
      this.scale.off('resize', this.layout, this);
    });
    this.layout();
    this.syncQuiz();
  }

  private layout(): void {
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const { zoom } = fitZoom(portrait ? 460 : 820, portrait ? 900 : 520);
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(0, 0);
    const wv = viewRect(cam);
    this.bg.setPosition(wv.x - 10, wv.y - 10).setScale((wv.width + 20) / 100, (wv.height + 20) / 100);
    const floorY = wv.y + wv.height * (portrait ? 0.4 : 0.5);
    this.floor.setPosition(wv.x - 10, floorY).setScale((wv.width + 20) / 100, (wv.bottom - floorY + 10) / 100);
    this.curtains[0]?.setPosition(wv.x - 40, wv.y - 20);
    this.curtains[1]?.setPosition(wv.right - 120, wv.y - 20);
    this.spots.forEach((s, i) => s.setPosition(wv.x + wv.width * (0.2 + i * 0.3), wv.y - 20));
    this.bulbs.forEach((b, i) => b.setPosition(wv.x + ((i + 0.5) / this.bulbs.length) * wv.width, wv.y + 18));
    const spread = Math.min(wv.width * 0.26, 210);
    const xs: Pair<number> = [wv.centerX - spread, wv.centerX + spread];
    for (const slot of [0, 1] as const) {
      const x = xs[slot];
      this.podiums[slot].setPosition(x, floorY - 40);
      this.rigs[slot].setPosition(x, floorY - 18);
      this.scores[slot].setPosition(x, floorY + 18);
      this.tags[slot].setPosition(x, floorY - 190);
    }
  }

  private syncQuiz(): void {
    if (!this.sys.isActive()) return;
    const q = store.get().quiz;
    const question = q.question;
    const reveal = q.reveal;
    if (question && question.index !== this.lastQ) {
      this.lastQ = question.index;
      this.lastAnswered = [false, false];
      this.rigs.forEach((r) => r.setPose('think'));
      audio.play('whoosh', { volume: 0.6 });
    }
    const answered = q.progress?.answered ?? [false, false];
    for (const slot of [0, 1] as const) {
      if (answered[slot] && !this.lastAnswered[slot]) {
        this.rigs[slot].hop();
        this.rigs[slot].setPose('idle');
        this.rigs[slot].react({ eyes: 'happy', mouth: 'smile' }, 0.8);
      }
    }
    this.lastAnswered = [answered[0], answered[1]];
    const totals = reveal?.totals ?? question?.totals;
    if (totals) {
      this.scores[0].setText(String(totals[0]));
      this.scores[1].setText(String(totals[1]));
    }
    if (reveal && reveal.q !== this.lastReveal) {
      this.lastReveal = reveal.q;
      const wv = viewRect(this.cameras.main);
      if (reveal.outcome === 'match') {
        this.rigs.forEach((r) => r.setPose('celebrate'));
        this.fx.confetti(wv.centerX, wv.y + wv.height * 0.15, 40);
        this.rigs.forEach((r) => this.fx.hearts(r.x, r.y - 160, 5));
        for (const slot of [0, 1] as const) {
          if (reveal.points[slot] > 0) {
            this.tweens.add({ targets: this.scores[slot], scale: 1.5, duration: 160, yoyo: true });
          }
        }
      } else if (reveal.outcome === 'miss') {
        this.rigs.forEach((r, i) => {
          r.setPose(i === reveal.about ? 'surprised' : 'think');
          r.react({ eyes: i === reveal.about ? 'wide' : 'sad', mouth: i === reveal.about ? 'wow' : 'sad' }, 2);
        });
      } else {
        this.rigs.forEach((r) => r.setPose('idle'));
      }
      this.time.delayedCall(2600, () => this.rigs.forEach((r) => r.setPose('idle')));
    }
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.rigs) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    this.t += dt;
    this.spots.forEach((s, i) => s.setRotation(Math.sin(this.t * 0.7 + i * 2) * 0.35));
    this.bulbs.forEach((b, i) => b.setAlpha(Math.sin(this.t * 6 + i * 0.9) > 0 ? 1 : 0.45));
    for (const r of this.rigs) r.update(dt);
  }
}
