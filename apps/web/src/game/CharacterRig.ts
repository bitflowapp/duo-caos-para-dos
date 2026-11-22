import Phaser from 'phaser';
import type { AccessoryId, CharacterId } from '@duo/shared';
import { accessoryAnchor } from './art/accessories';
import { makeImage, setImageKey } from './art/atlas';
import { RIG, type EyeVariant, type MouthVariant } from './art/characters';
import { ck } from './art/registry';

export type Pose =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'slide'
  | 'stun'
  | 'slip'
  | 'love'
  | 'celebrate'
  | 'sad'
  | 'surprised'
  | 'hug'
  | 'walk'
  | 'think';

interface Expression {
  eyes: EyeVariant;
  mouth: MouthVariant;
  blush: boolean;
}

const BASE_EXPR: Record<Pose, Expression> = {
  idle: { eyes: 'open', mouth: 'smile', blush: false },
  walk: { eyes: 'open', mouth: 'smile', blush: false },
  run: { eyes: 'determined', mouth: 'grin', blush: false },
  jump: { eyes: 'open', mouth: 'open', blush: false },
  fall: { eyes: 'wide', mouth: 'open', blush: false },
  slide: { eyes: 'determined', mouth: 'flat', blush: false },
  stun: { eyes: 'dizzy', mouth: 'wow', blush: false },
  slip: { eyes: 'wide', mouth: 'wow', blush: false },
  love: { eyes: 'love', mouth: 'kiss', blush: true },
  celebrate: { eyes: 'happy', mouth: 'grin', blush: false },
  sad: { eyes: 'sad', mouth: 'sad', blush: false },
  surprised: { eyes: 'wide', mouth: 'wow', blush: false },
  hug: { eyes: 'happy', mouth: 'smile', blush: true },
  think: { eyes: 'open', mouth: 'flat', blush: false },
};

/**
 * Personaje animado por partes ("cutout"): squash & stretch, parpadeo, ciclo de
 * carrera, expresiones y reacciones. El origen del contenedor está en los pies.
 */
export class CharacterRig extends Phaser.GameObjects.Container {
  readonly character: CharacterId;
  private readonly torso: Phaser.GameObjects.Container;
  private readonly bodyImg: Phaser.GameObjects.Image;
  private readonly top: Phaser.GameObjects.Image;
  private readonly eyes: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly blush: Phaser.GameObjects.Image;
  private readonly armBack: Phaser.GameObjects.Image;
  private readonly armFront: Phaser.GameObjects.Image;
  private readonly footL: Phaser.GameObjects.Image;
  private readonly footR: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private accessory: Phaser.GameObjects.Image | null = null;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private pose: Pose = 'idle';
  private poseTime = 0;
  private t = Math.random() * 10;
  private nextBlink = 1.5 + Math.random() * 2;
  private blinkUntil = 0;
  private override: { expr: Partial<Expression>; until: number } | null = null;
  private squash = 0;
  private facing: 1 | -1 = 1;
  private readonly baseScale: number;
  private runPhase = 0;
  /** Velocidad horizontal (unidades/s) para el ciclo de carrera. */
  speed = 0;
  /** Parpadeo de invulnerabilidad. */
  flicker = false;
  /** Mostrar la sombra (desactivar en el aire lejos del piso). */
  shadowY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, character: CharacterId, skin: number, accessory: AccessoryId, height = 84) {
    super(scene, x, y);
    this.character = character;
    this.baseScale = height / 128;
    const rig = RIG[character];
    const px = (v: number): number => v - 64;
    const py = (v: number): number => v - 118;

    this.shadow = makeImage(scene, 0, 2, 'shadow');
    this.shadow.setScale(this.shadow.scaleX * 0.9);
    this.footL = makeImage(scene, px(rig.footL.x), py(rig.footL.y), ck.foot(character, skin));
    this.footR = makeImage(scene, px(rig.footR.x), py(rig.footR.y), ck.foot(character, skin));
    this.torso = new Phaser.GameObjects.Container(scene, 0, 0);
    this.armBack = makeImage(scene, px(rig.armR.x), py(rig.armR.y), ck.arm(character, skin));
    this.armBack.setOrigin(0.5, 0.15).setTint(0xd8d0e8);
    this.bodyImg = makeImage(scene, px(64), py(64), ck.body(character, skin));
    this.top = makeImage(scene, px(rig.top.x), py(rig.top.y) + 18, ck.top(character, skin));
    this.top.setOrigin(0.5, 0.9);
    this.eyes = makeImage(scene, px(rig.eyes.x), py(rig.eyes.y), ck.eyes(character, 'open'));
    this.mouth = makeImage(scene, px(rig.mouth.x), py(rig.mouth.y), ck.mouth('smile'));
    this.blush = makeImage(scene, px(rig.blush.x), py(rig.blush.y), 'blush');
    this.blush.setVisible(false);
    this.armFront = makeImage(scene, px(rig.armL.x), py(rig.armL.y), ck.arm(character, skin));
    this.armFront.setOrigin(0.5, 0.15);
    this.torso.add([this.armBack, this.top, this.bodyImg, this.eyes, this.mouth, this.blush, this.armFront]);
    this.add([this.shadow, this.footL, this.footR, this.torso]);
    this.setAccessory(accessory);
    this.setScale(this.baseScale);
    scene.add.existing(this);
  }

  setAccessory(id: AccessoryId): void {
    this.accessory?.destroy();
    this.accessory = null;
    if (id === 'none') return;
    const a = accessoryAnchor(id, this.character);
    const img = makeImage(this.scene, a.x - 64, a.y - 118, ck.acc(id));
    img.setScale(img.scaleX * a.scale).setAngle(a.rot);
    this.accessory = img;
    this.torso.add(img);
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
  }

  setPose(pose: Pose): void {
    if (pose === this.pose) return;
    if ((this.pose === 'jump' || this.pose === 'fall') && (pose === 'run' || pose === 'idle' || pose === 'walk')) {
      this.squash = 1; // aterrizaje
    }
    this.pose = pose;
    this.poseTime = 0;
  }

  getPose(): Pose {
    return this.pose;
  }

  /** Cambia la expresión por un rato (reacciones). */
  react(expr: Partial<Expression>, seconds = 1.2): void {
    this.override = { expr, until: this.t + seconds };
  }

  /** Pequeño salto de alegría o susto (independiente de la física). */
  hop(): void {
    this.squash = -1;
  }

  override update(dt: number): void {
    this.t += dt;
    this.poseTime += dt;
    const t = this.t;
    const pose = this.pose;
    const rig = RIG[this.character];
    const px = (v: number): number => v - 64;
    const py = (v: number): number => v - 118;

    let bodyY = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let armF = 0;
    let armB = 0;
    let fLx = 0;
    let fLy = 0;
    let fRx = 0;
    let fRy = 0;

    switch (pose) {
      case 'idle':
      case 'think': {
        const b = Math.sin(t * 2.6);
        bodyY = b * 1.6;
        sy = 1 + b * 0.025;
        sx = 1 - b * 0.02;
        armF = Math.sin(t * 2.6) * 6;
        armB = -Math.sin(t * 2.6) * 6;
        if (pose === 'think') rot = Math.sin(t * 1.3) * 0.05;
        break;
      }
      case 'walk':
      case 'run': {
        const speedFactor = Math.min(1.6, Math.max(0.4, Math.abs(this.speed) / 300));
        this.runPhase += dt * (pose === 'run' ? 15 : 10) * speedFactor;
        const p = this.runPhase;
        bodyY = -Math.abs(Math.sin(p)) * (pose === 'run' ? 6 : 3);
        rot = pose === 'run' ? 0.1 : 0.03;
        armF = Math.sin(p) * 42;
        armB = -Math.sin(p) * 42;
        fLx = Math.sin(p) * 9;
        fLy = -Math.max(0, Math.cos(p)) * 8;
        fRx = -Math.sin(p) * 9;
        fRy = -Math.max(0, -Math.cos(p)) * 8;
        sy = 1 + Math.sin(p * 2) * 0.03;
        break;
      }
      case 'jump':
        sy = 1.12;
        sx = 0.9;
        armF = -130;
        armB = 130;
        fLy = -4;
        fRy = -6;
        rot = 0.05;
        break;
      case 'fall':
        sy = 1.04;
        sx = 0.97;
        armF = -70 + Math.sin(t * 20) * 10;
        armB = 70 - Math.sin(t * 20) * 10;
        fLy = -2;
        break;
      case 'slide':
        sy = 0.62;
        sx = 1.22;
        bodyY = 4;
        rot = 0.28;
        armF = -100;
        armB = -110;
        fLx = 14;
        fRx = 20;
        break;
      case 'stun':
        rot = Math.sin(t * 9) * 0.22;
        bodyY = 0;
        armF = 40 + Math.sin(t * 12) * 30;
        armB = -40 - Math.sin(t * 12) * 30;
        break;
      case 'slip':
        rot = Math.min(1, this.poseTime * 3) * Math.PI * 2 * (this.poseTime < 0.5 ? 1 : 0) + Math.sin(t * 10) * 0.2;
        armF = -120;
        armB = 120;
        break;
      case 'love': {
        const b = Math.sin(t * 6);
        bodyY = b * 2;
        sy = 1 + b * 0.04;
        rot = Math.sin(t * 3) * 0.12;
        armF = -30;
        armB = 30;
        break;
      }
      case 'celebrate': {
        const cycle = (this.poseTime * 2.2) % 1;
        bodyY = -Math.sin(cycle * Math.PI) * 26;
        sy = cycle < 0.1 || cycle > 0.9 ? 0.85 : 1.08;
        sx = cycle < 0.1 || cycle > 0.9 ? 1.12 : 0.95;
        armF = -150 + Math.sin(t * 14) * 20;
        armB = 150 - Math.sin(t * 14) * 20;
        fLy = -Math.sin(cycle * Math.PI) * 4;
        fRy = fLy;
        rot = Math.sin(t * 5) * 0.08;
        break;
      }
      case 'sad':
        sy = 0.93;
        sx = 1.04;
        bodyY = 2;
        rot = Math.sin(t * 1.2) * 0.04;
        armF = 12;
        armB = -12;
        break;
      case 'surprised':
        bodyY = this.poseTime < 0.3 ? -Math.sin((this.poseTime / 0.3) * Math.PI) * 14 : 0;
        armF = -110;
        armB = 110;
        sy = 1.06;
        break;
      case 'hug': {
        const b = Math.sin(t * 3);
        rot = 0.16 + b * 0.04;
        armF = -60 + b * 6;
        armB = -40;
        sy = 1 + b * 0.02;
        break;
      }
    }

    // Squash al aterrizar / salto decorativo
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 6);
      sy *= 1 - this.squash * 0.22;
      sx *= 1 + this.squash * 0.18;
    } else if (this.squash < 0) {
      this.squash = Math.min(0, this.squash + dt * 3);
      const k = -this.squash;
      bodyY -= Math.sin(k * Math.PI) * 18;
    }

    this.torso.setPosition(0, bodyY);
    this.torso.setScale(sx, sy);
    this.torso.setRotation(rot);
    this.armFront.setAngle(armF);
    this.armBack.setAngle(armB);
    this.footL.setPosition(px(rig.footL.x) + fLx, py(rig.footL.y) + fLy);
    this.footR.setPosition(px(rig.footR.x) + fRx, py(rig.footR.y) + fRy);
    this.setScale(this.baseScale * this.facing, this.baseScale);

    // Llamita / rulito
    if (this.character === 'chispa') {
      this.top.setScale(this.top.scaleX, (1 + Math.sin(t * 17) * 0.07 + Math.sin(t * 29) * 0.04) * Math.abs(this.bodyImg.scaleX));
      this.top.setAngle(Math.sin(t * 7) * 5);
    } else {
      this.top.setAngle(Math.sin(t * 2.2) * 9);
    }

    // Sombra
    this.shadow.setY(2 + this.shadowY / this.baseScale);
    const shadowK = Math.max(0.35, 1 - Math.abs(this.shadowY) / 260);
    this.shadow.setAlpha(shadowK);

    // Expresión
    let expr: Expression = { ...BASE_EXPR[pose] };
    if (this.character === 'bruma' && pose === 'idle') expr = { eyes: 'open', mouth: Math.sin(t * 0.3) > 0.7 ? 'tongue' : 'smile', blush: false };
    if (this.override) {
      if (t > this.override.until) this.override = null;
      else expr = { ...expr, ...this.override.expr };
    }
    // Parpadeo
    if (t > this.nextBlink) {
      this.blinkUntil = t + 0.12;
      this.nextBlink = t + 2.2 + Math.random() * 3;
    }
    const canBlink = expr.eyes === 'open' || expr.eyes === 'determined';
    const eyes: EyeVariant = canBlink && t < this.blinkUntil ? 'blink' : expr.eyes;
    setImageKey(this.eyes, ck.eyes(this.character, eyes));
    setImageKey(this.mouth, ck.mouth(expr.mouth));
    this.blush.setVisible(expr.blush);
    if (expr.blush) this.blush.setAlpha(0.7 + Math.sin(t * 5) * 0.25);

    // Estrellitas de mareo
    if (pose === 'stun') {
      while (this.stars.length < 3) {
        const s = makeImage(this.scene, 0, 0, 'star');
        this.stars.push(s);
        this.add(s);
      }
      this.stars.forEach((s, i) => {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        s.setVisible(true).setPosition(Math.cos(a) * 46, -132 + Math.sin(a) * 12);
      });
    } else {
      for (const s of this.stars) s.setVisible(false);
    }

    this.setAlpha(this.flicker ? (Math.sin(t * 40) > 0 ? 0.35 : 0.9) : 1);
  }
}
