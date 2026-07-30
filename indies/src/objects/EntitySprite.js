/**
 * EntitySprite.js - Slay the Spire スタイル 2D関節アニメーションモデル
 * 
 * 全面改修版: 一枚絵画像をゆらす表現を完全に排除し、
 * Slay the Spire 本編（アイアンクラッドやサイレント等）のような
 * 重厚な2Dパーツモデル（太いアウトライン＋グラデーションアーマー）が
 * 待機中の呼吸屈伸・攻撃時の一閃振り下ろしで生き生きと関節駆動するアニメーション。
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { ENEMY_INTENTS } from '../core/EnemyAI.js';

export class EntitySprite {
  /**
   * @param {string} type - 'player' | 'enemy'
   * @param {Object} coreEntity - CombatEngineのプレイヤー情報 または core/EnemyAI.js インスタンス
   */
  constructor(type, coreEntity) {
    this.type = type;
    this.core = coreEntity;

    this.container = new Container();
    
    // ベースレイヤー
    this.platformGfx = new Graphics();        // 足元台座
    this.glowGfx = new Graphics();            // 背面オーラ
    this.skeletonContainer = new Container(); // 2Dスケルトンパーツ階層
    this.hudGfx = new Graphics();             // HPバー / UI

    this.container.addChild(this.platformGfx);
    this.container.addChild(this.glowGfx);
    this.container.addChild(this.skeletonContainer);
    this.container.addChild(this.hudGfx);

    // テキストUI
    this.nameText = null;
    this.hpText = null;
    this.shieldText = null;
    this.statusText = null;
    this.intentText = null;
    this.intentIconGfx = new Graphics();
    this.container.addChild(this.intentIconGfx);

    // 関節辞書
    this.joints = {};
    this.orbs = [];
    this.minionLegs = [];

    const isPlayer = this.type === 'player';
    const isBoss = !isPlayer && this.core.name && this.core.name.includes('BOSS');
    const isMinion = !isPlayer && this.core.name && this.core.name.includes('MINION');

    if (isPlayer) {
      this.avatarSize = 175;
    } else if (isBoss) {
      this.avatarSize = 210;
    } else if (isMinion) {
      this.avatarSize = 90;
    } else {
      this.avatarSize = 140;
    }

    this.setupVisuals();
    this.updateHUD();
    this.startSTSIdleAnimation();
  }

  /** ビジュアル構築 */
  setupVisuals() {
    const isPlayer = this.type === 'player';
    const isBoss = !isPlayer && this.core.name && this.core.name.includes('BOSS');
    const isMinion = !isPlayer && this.core.name && this.core.name.includes('MINION');
    const charColor = isPlayer ? (this.core.characterData?.color || 0x00F5FF) : 0xFF007A;

    this.platformGfx.clear();
    this.glowGfx.clear();
    this.skeletonContainer.removeChildren();
    this.joints = {};

    // 1. 足元台座
    this.drawPlatform(charColor, isBoss, isMinion);

    // 2. 向き制御 (プレイヤーは右向き、敵は左向き)
    if (!isPlayer) {
      this.skeletonContainer.scale.x = -1;
    }

    // 3. Slay the Spire 本編風の重厚・精巧な2Dパーツモデル構築
    if (isPlayer) {
      const charId = this.core.characterData?.id || 'SWORDSMAN';
      if (charId === 'SWORDSMAN') {
        this.buildBladeSTS2D();
      } else {
        this.buildHexSTS2D();
      }
    } else if (isBoss) {
      this.buildBossSTS2D();
    } else if (isMinion) {
      this.buildMinion2D();
    } else {
      this.buildVirus2D();
    }

    // 4. HUD構築
    this.setupHUDText(isPlayer, isMinion);
  }

  /** 足元エネルギー台座 */
  drawPlatform(color, isBoss, isMinion) {
    const p = this.platformGfx;
    const rx = isBoss ? 95 : (isMinion ? 45 : 75);
    const ry = rx * 0.35;
    const py = isMinion ? 35 : (isBoss ? 85 : 70);

    p.ellipse(0, py, rx, ry);
    p.fill({ color: color, alpha: 0.15 });
    p.ellipse(0, py, rx + 10, ry + 4);
    p.stroke({ color: color, width: 2.5, alpha: 0.85 });
  }

  // ═══════════════════════════════════════════════════════════════
  // Slay the Spire 本編風のリッチな2D関節パーツモデル構築
  // ═══════════════════════════════════════════════════════════════

  /** BLADE.EXE (スレスパ風近接ハッカー: 太ライン＋アーマーグラデーション＋大剣) */
  buildBladeSTS2D() {
    const root = this.skeletonContainer;

    const pelvis = new Container();    // 腰
    const torso = new Container();     // チェストアーマー
    const head = new Container();      // バイザー・青髪ヘルメット
    const shoulderR = new Container(); // 右肩当て
    const armR = new Container();      // 右上腕
    const foreArmR = new Container();  // 右前腕
    const weapon = new Container();    // ネオン大剣
    const armL = new Container();      // 左腕
    const foreArmL = new Container();
    const legL = new Container();      // 左脚 (前)
    const lowerLegL = new Container();
    const legR = new Container();      // 右脚 (後)
    const lowerLegR = new Container();

    root.addChild(pelvis);
    pelvis.addChild(legL); legL.addChild(lowerLegL);
    pelvis.addChild(legR); legR.addChild(lowerLegR);
    pelvis.addChild(torso);
    torso.addChild(head);
    torso.addChild(armL); armL.addChild(foreArmL);
    torso.addChild(armR); armR.addChild(foreArmR);
    foreArmR.addChild(weapon);
    torso.addChild(shoulderR);

    // スレスパのアイアンクラッド風 対峙戦闘姿勢 (腰を低く前傾)
    pelvis.y = 12;
    torso.y = -12; torso.rotation = 0.14;
    head.y = -35; head.rotation = -0.1;

    // 前後の脚踏み込み
    legL.x = 14; legL.y = 10; legL.rotation = 0.32; lowerLegL.y = 22; lowerLegL.rotation = -0.45;
    legR.x = -16; legR.y = 10; legR.rotation = -0.32; lowerLegR.y = 22; lowerLegR.rotation = 0.45;

    // 左腕 (胸の前でガード)
    armL.x = -18; armL.y = -26; armL.rotation = 0.35; foreArmL.y = 20; foreArmL.rotation = -0.7;

    // 右腕 (大剣を敵方向へ突き出して構える)
    armR.x = 22; armR.y = -26; armR.rotation = -0.45;
    foreArmR.y = 22; foreArmR.rotation = 0.55;
    weapon.x = 0; weapon.y = 15; weapon.rotation = 0.85;
    shoulderR.x = 22; shoulderR.y = -28;

    // ── スレスパコミック風のリッチなパーツ描画 ──

    // 1. 脚部 (黒太ライン ＋ シアンネオンライン)
    const lL = new Graphics(); lL.roundRect(-8, 0, 16, 24, 4); lL.fill({ color: 0x0F172A }); lL.stroke({ color: 0x00F5FF, width: 2.5 }); legL.addChild(lL);
    const llL = new Graphics(); llL.roundRect(-7, 0, 14, 24, 4); llL.fill({ color: 0x1E293B }); llL.stroke({ color: 0x0284C7, width: 2 }); lowerLegL.addChild(llL);

    const lR = new Graphics(); lR.roundRect(-8, 0, 16, 24, 4); lR.fill({ color: 0x0F172A }); lR.stroke({ color: 0x00F5FF, width: 2.5 }); legR.addChild(lR);
    const llR = new Graphics(); llR.roundRect(-7, 0, 14, 24, 4); llR.fill({ color: 0x1E293B }); llR.stroke({ color: 0x0284C7, width: 2 }); lowerLegR.addChild(llR);

    // 2. 胴体 (チェストアーマー ＋ 発光ライン)
    const tGfx = new Graphics();
    tGfx.poly([-24, -34, 24, -34, 18, 12, -18, 12]);
    tGfx.fill({ color: 0x1E1E38 });
    tGfx.stroke({ color: 0x00F5FF, width: 3 });
    // 胸部の赤パルスプレート
    tGfx.poly([-12, -28, 12, -28, 8, -10, -8, -10]);
    tGfx.fill({ color: 0xFF007A });
    torso.addChild(tGfx);

    // 3. 頭部 (スレスパ風バイザーヘルメット ＋ ネオン流動ヘアー)
    const hGfx = new Graphics();
    hGfx.roundRect(-16, -22, 32, 24, 6); hGfx.fill({ color: 0x0F172A });
    hGfx.stroke({ color: 0x00F5FF, width: 2.5 });
    // スリットバイザー
    hGfx.rect(-14, -18, 28, 8); hGfx.fill({ color: 0x00F5FF });
    hGfx.rect(-10, -16, 20, 4); hGfx.fill({ color: 0xFFFFFF });
    // 青ネオン髪のなびき
    hGfx.poly([-18, -20, -38, -30, -28, -5]); hGfx.fill({ color: 0x00F5FF });
    head.addChild(hGfx);

    // 4. 肩当て・腕部
    const sRGfx = new Graphics();
    sRGfx.poly([0, -15, 20, 0, 0, 15, -15, 0]);
    sRGfx.fill({ color: 0xFF007A });
    sRGfx.stroke({ color: 0xFFFFFF, width: 2 });
    shoulderR.addChild(sRGfx);

    const aLGfx = new Graphics(); aLGfx.roundRect(-7, 0, 14, 22, 4); aLGfx.fill({ color: 0x1E293B }); aLGfx.stroke({ color: 0x00F5FF, width: 2 }); armL.addChild(aLGfx);
    const faLGfx = new Graphics(); faLGfx.roundRect(-6, 0, 12, 20, 3); faLGfx.fill({ color: 0x00F5FF }); foreArmL.addChild(faLGfx);

    const aRGfx = new Graphics(); aRGfx.roundRect(-7, 0, 14, 22, 4); aRGfx.fill({ color: 0x1E293B }); aRGfx.stroke({ color: 0x00F5FF, width: 2 }); armR.addChild(aRGfx);
    const faRGfx = new Graphics(); faRGfx.roundRect(-6, 0, 12, 20, 3); faRGfx.fill({ color: 0xFF007A }); foreArmR.addChild(faRGfx);

    // 5. 大剣ネオンサイバーブレード
    const wGfx = new Graphics();
    wGfx.moveTo(0, -10);
    wGfx.lineTo(85, -60);
    wGfx.stroke({ color: 0x00F5FF, width: 7, alpha: 0.95 });
    wGfx.moveTo(0, -10);
    wGfx.lineTo(85, -60);
    wGfx.stroke({ color: 0xFFFFFF, width: 3, alpha: 1.0 });
    wGfx.circle(0, -10, 8); wGfx.fill({ color: 0xFF007A });
    weapon.addChild(wGfx);

    this.joints = { pelvis, torso, head, armL, foreArmL, armR, foreArmR, weapon, shoulderR, legL, lowerLegL, legR, lowerLegR };
  }

  /** HEX.EXE (スレスパ風魔導ハッカー: 紫フードマント ＋ 揺れる裾 ＋ 3オーブ) */
  buildHexSTS2D() {
    const root = this.skeletonContainer;

    const pelvis = new Container();
    const torso = new Container();
    const head = new Container();
    const mantle = new Container();
    const armL = new Container();
    const foreArmL = new Container();
    const armR = new Container();
    const foreArmR = new Container();
    const legL = new Container();
    const lowerLegL = new Container();
    const legR = new Container();
    const lowerLegR = new Container();

    root.addChild(pelvis);
    pelvis.addChild(legL); legL.addChild(lowerLegL);
    pelvis.addChild(legR); legR.addChild(lowerLegR);
    pelvis.addChild(mantle);
    pelvis.addChild(torso);
    torso.addChild(head);
    torso.addChild(armL); armL.addChild(foreArmL);
    torso.addChild(armR); armR.addChild(foreArmR);

    pelvis.y = 12;
    torso.y = -12; torso.rotation = 0.12;
    head.y = -35; head.rotation = -0.08;

    legL.x = 12; legL.y = 8; legL.rotation = 0.28; lowerLegL.y = 22;
    legR.x = -14; legR.y = 8; legR.rotation = -0.28; lowerLegR.y = 22;

    armL.x = -16; armL.y = -24; armL.rotation = -0.6; foreArmL.y = 20; foreArmL.rotation = 0.8;
    armR.x = 16; armR.y = -24; armR.rotation = -0.85; foreArmR.y = 20; foreArmR.rotation = 0.95;

    // 1. 脚部
    const lL = new Graphics(); lL.roundRect(-6, 0, 12, 24, 4); lL.fill({ color: 0x1E102A }); legL.addChild(lL);
    const llL = new Graphics(); llL.roundRect(-5, 0, 10, 24, 3); llL.fill({ color: 0x3B1D54 }); lowerLegL.addChild(llL);
    const lR = new Graphics(); lR.roundRect(-6, 0, 12, 24, 4); lR.fill({ color: 0x1E102A }); legR.addChild(lR);
    const llR = new Graphics(); llR.roundRect(-5, 0, 10, 24, 3); llR.fill({ color: 0x3B1D54 }); lowerLegR.addChild(llR);

    // 2. スレスパ風紫マント
    const mGfx = new Graphics();
    mGfx.poly([-26, -26, -60, 40, 12, 50, 26, -26]);
    mGfx.fill({ color: 0x4C1D95 });
    mGfx.stroke({ color: 0xA855F7, width: 2.5 });
    mantle.addChild(mGfx);

    // 3. 胴体
    const tGfx = new Graphics();
    tGfx.poly([-22, -32, 22, -32, 16, 12, -16, 12]);
    tGfx.fill({ color: 0x2E1045 });
    tGfx.stroke({ color: 0xA855F7, width: 3 });
    tGfx.circle(0, -10, 8); tGfx.fill({ color: 0xE9D5FF });
    torso.addChild(tGfx);

    // 4. 頭部
    const hGfx = new Graphics();
    hGfx.poly([-24, 10, -28, -38, 0, -45, 28, -38, 24, 10]);
    hGfx.fill({ color: 0x4C1D95 });
    hGfx.stroke({ color: 0xA855F7, width: 2.5 });
    hGfx.roundRect(-14, -22, 28, 20, 4); hGfx.fill({ color: 0x0F0518 });
    hGfx.ellipse(0, -12, 12, 4); hGfx.fill({ color: 0xE9D5FF });
    head.addChild(hGfx);

    // 5. 腕部
    const aLGfx = new Graphics(); aLGfx.roundRect(-6, 0, 12, 20, 3); aLGfx.fill({ color: 0x3B1D54 }); armL.addChild(aLGfx);
    const faLGfx = new Graphics(); faLGfx.circle(0, 15, 6); faLGfx.fill({ color: 0xE9D5FF }); foreArmL.addChild(faLGfx);
    const aRGfx = new Graphics(); aRGfx.roundRect(-6, 0, 12, 20, 3); aRGfx.fill({ color: 0x3B1D54 }); armR.addChild(aRGfx);
    const faRGfx = new Graphics(); faRGfx.circle(0, 15, 6); faRGfx.fill({ color: 0xE9D5FF }); foreArmR.addChild(faRGfx);

    // 6. 浮遊する3つの魔導オーブ
    for (let i = 0; i < 3; i++) {
      const orbContainer = new Container();
      const orbGfx = new Graphics();
      orbGfx.circle(0, 0, 10); orbGfx.fill({ color: 0xE9D5FF });
      orbGfx.circle(0, 0, 14); orbGfx.stroke({ color: 0xA855F7, width: 2.5 });
      orbContainer.addChild(orbGfx);
      root.addChild(orbContainer);
      this.orbs.push({ container: orbContainer, baseAngle: (i * Math.PI * 2) / 3 });
    }

    this.joints = { pelvis, torso, head, mantle, armL, foreArmL, armR, foreArmR, legL, lowerLegL, legR, lowerLegR };
  }

  /** BOSS.DEATH_RAY (スレスパ風大型ボス) */
  buildBossSTS2D() {
    const root = this.skeletonContainer;
    const body = new Container();
    const head = new Container();
    const armL = new Container();
    const armR = new Container();

    root.addChild(body);
    body.addChild(head);
    body.addChild(armL);
    body.addChild(armR);

    const bGfx = new Graphics();
    bGfx.poly([-55, -65, 55, -65, 65, 25, 0, 65, -65, 25]);
    bGfx.fill({ color: 0x1A0510 });
    bGfx.stroke({ color: 0xFF007A, width: 3.5 });
    bGfx.circle(0, -5, 24); bGfx.fill({ color: 0xFF0044 });
    bGfx.circle(0, -5, 12); bGfx.fill({ color: 0xFFF000 });
    body.addChild(bGfx);

    const hGfx = new Graphics();
    hGfx.poly([-25, 0, -45, -55, -15, -35, 0, -45, 15, -35, 45, -55, 25, 0]);
    hGfx.fill({ color: 0x380515 });
    hGfx.stroke({ color: 0xFF007A, width: 2.5 });
    hGfx.circle(0, -15, 8); hGfx.fill({ color: 0xFFF000 });
    head.addChild(hGfx);
    head.y = -35;

    armL.x = -75; armL.y = -30;
    const aLGfx = new Graphics(); aLGfx.poly([0, -25, -30, 0, 0, 40, 15, 0]); aLGfx.fill({ color: 0x2A0818 }); aLGfx.stroke({ color: 0xFF007A, width: 2.5 }); armL.addChild(aLGfx);
    armR.x = 75; armR.y = -30;
    const aRGfx = new Graphics(); aRGfx.poly([0, -25, 30, 0, 0, 40, -15, 0]); aRGfx.fill({ color: 0x2A0818 }); aRGfx.stroke({ color: 0xFF007A, width: 2.5 }); armR.addChild(aRGfx);

    this.joints = { body, head, armL, armR };
  }

  /** ミニオン */
  buildMinion2D() {
    const root = this.skeletonContainer;
    const core = new Container(); root.addChild(core);
    const cGfx = new Graphics();
    cGfx.circle(0, 0, 22); cGfx.fill({ color: 0x181206 });
    cGfx.circle(0, 0, 22); cGfx.stroke({ color: 0xFFF000, width: 2.5 });
    cGfx.circle(0, 0, 10); cGfx.fill({ color: 0xFF007A });
    core.addChild(cGfx);

    this.minionLegs = [];
    const angles = [-0.75, 0.75, Math.PI - 0.75, Math.PI + 0.75];
    angles.forEach((angle, idx) => {
      const legRoot = new Container();
      const upperLeg = new Container();
      const lowerLeg = new Container();
      root.addChild(legRoot); legRoot.addChild(upperLeg); upperLeg.addChild(lowerLeg);

      const uGfx = new Graphics(); uGfx.moveTo(0, 0); uGfx.lineTo(25, -10); uGfx.stroke({ color: 0xFFF000, width: 3 }); upperLeg.addChild(uGfx);
      const lGfx = new Graphics(); lGfx.moveTo(0, 0); lGfx.lineTo(15, 30); lGfx.stroke({ color: 0xFF007A, width: 2.5 }); lowerLeg.addChild(lGfx);

      legRoot.rotation = angle; lowerLeg.x = 25; lowerLeg.y = -10;
      this.minionLegs.push({ legRoot, upperLeg, lowerLeg, index: idx });
    });
    this.joints = { core };
  }

  /** ウイルス敵モブ */
  buildVirus2D() {
    const root = this.skeletonContainer;
    const body = new Container(); root.addChild(body);
    const bGfx = new Graphics();
    const points = []; const numSpikes = 8; const r = 50;
    for (let i = 0; i < numSpikes * 2; i++) {
      const angle = (i * Math.PI) / numSpikes;
      const rad = (i % 2 === 0) ? r : (r * 0.65);
      points.push(rad * Math.cos(angle), rad * Math.sin(angle));
    }
    bGfx.poly(points); bGfx.fill({ color: 0x120614 });
    bGfx.poly(points); bGfx.stroke({ color: 0xFF007A, width: 2.5 });
    bGfx.circle(0, 0, 16); bGfx.fill({ color: 0x00F5FF });
    bGfx.circle(0, 0, 8); bGfx.fill({ color: 0xFF007A });
    body.addChild(bGfx);
    this.joints = { body };
  }

  /** HUDテキスト */
  setupHUDText(isPlayer, isMinion) {
    const nameStyle = new TextStyle({
      fontFamily: 'JetBrains Mono', fontSize: isMinion ? 11 : 14, fontWeight: 'bold', fill: 0xE2E8F0
    });
    const hpStyle = new TextStyle({
      fontFamily: 'JetBrains Mono', fontSize: isMinion ? 10 : 11, fontWeight: 'bold', fill: 0x94A3B8
    });

    const nameStr = isPlayer ? (this.core.characterData?.name || 'SECURITY.EXE') : this.core.name;
    this.nameText = new Text({ text: nameStr, style: nameStyle });
    this.nameText.anchor.set(0.5);
    this.nameText.y = -this.avatarSize / 2 - (isMinion ? 28 : 45);
    this.container.addChild(this.nameText);

    this.hpText = new Text({ text: '', style: hpStyle });
    this.hpText.anchor.set(0.5);
    this.hpText.y = this.avatarSize / 2 + (isMinion ? 22 : 30);
    this.container.addChild(this.hpText);

    const statusStyle = new TextStyle({
      fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold', fill: 0xFFF000
    });
    this.statusText = new Text({ text: '', style: statusStyle });
    this.statusText.anchor.set(0.5);
    this.statusText.y = this.avatarSize / 2 + (isMinion ? 36 : 48);
    this.container.addChild(this.statusText);

    const shieldStyle = new TextStyle({
      fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 'bold', fill: 0x38BDF8
    });
    this.shieldText = new Text({ text: '', style: shieldStyle });
    this.shieldText.anchor.set(0.5);
    this.shieldText.y = -this.avatarSize / 2 - 15;
    this.container.addChild(this.shieldText);

    if (!isPlayer) {
      const intentStyle = new TextStyle({
        fontFamily: 'JetBrains Mono', fontSize: 11, fill: 0xFFF000, align: 'center'
      });
      this.intentText = new Text({ text: '', style: intentStyle });
      this.intentText.anchor.set(0.5);
      this.intentText.y = -this.avatarSize / 2 - (isMinion ? 55 : 75);
      this.container.addChild(this.intentText);
    }
  }

  /** Slay the Spire スタイルの本物2D関節呼吸・屈伸アニメーション */
  startSTSIdleAnimation() {
    const isPlayer = this.type === 'player';
    const j = this.joints;

    if (isPlayer && j.torso) {
      // 1. 胴体の呼吸運動 (吸気・呼気で上下・屈伸)
      gsap.to(j.torso, {
        y: -18, rotation: 0.18, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });

      // 2. 首・頭部の微傾斜
      gsap.to(j.head, {
        rotation: -0.15, duration: 2.0, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });

      // 3. 左腕の振り
      gsap.to(j.armL, {
        rotation: -0.15, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
      gsap.to(j.foreArmL, {
        rotation: 0.25, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });

      // 4. 右腕（大剣）の敵方向への突き出し微動
      gsap.to(j.armR, {
        rotation: -0.55, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
      gsap.to(j.foreArmR, {
        rotation: 0.65, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
      if (j.weapon) {
        gsap.to(j.weapon, {
          rotation: 0.95, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut'
        });
      }

      // 5. 両膝（大腿/下腿）の呼吸屈伸
      gsap.to(j.legL, { rotation: 0.12, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(j.lowerLegL, { rotation: -0.15, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(j.legR, { rotation: -0.12, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(j.lowerLegR, { rotation: 0.15, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });

      // メイジの浮遊オーブ公転
      if (this.orbs.length > 0) {
        gsap.to({}, {
          duration: 7, repeat: -1, ease: 'none',
          onUpdate: () => {
            if (this.container.destroyed) return;
            const progress = (Date.now() % 3200) / 3200;
            const angle = progress * Math.PI * 2;
            this.orbs.forEach(orb => {
              const curA = angle + orb.baseAngle;
              orb.container.x = Math.cos(curA) * 75 + 15;
              orb.container.y = Math.sin(curA) * 30 - 20;
            });
          }
        });
      }
    } else if (this.minionLegs.length > 0) {
      this.minionLegs.forEach((leg, i) => {
        gsap.to(leg.upperLeg, { rotation: 0.35, duration: 0.35, delay: i * 0.12, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(leg.lowerLeg, { rotation: -0.4, duration: 0.35, delay: i * 0.12, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
    } else if (j.body) {
      gsap.to(j.body, { y: -8, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
  }

  /** HUDの更新 */
  updateHUD() {
    const isPlayer = this.type === 'player';
    const hp = isPlayer ? this.core.playerHP : this.core.hp;
    const maxHp = isPlayer ? this.core.playerMaxHP : this.core.maxHp;
    const shield = isPlayer ? this.core.playerShield : this.core.shield;
    const strength = isPlayer ? this.core.playerStrength : this.core.strength;
    const vulnerable = isPlayer ? this.core.playerVulnerable : this.core.vulnerable;

    this.hpText.text = `HP: ${hp}/${maxHp}`;

    const statusParts = [];
    if (strength > 0) statusParts.push(`[STR +${strength}]`);
    if (vulnerable > 0) statusParts.push(`[VULN ${vulnerable}]`);
    this.statusText.text = statusParts.join(' ');
    this.statusText.visible = statusParts.length > 0;

    if (shield > 0) {
      this.shieldText.text = `[SHIELD +${shield}]`;
      this.shieldText.visible = true;
    } else {
      this.shieldText.visible = false;
    }

    const h = this.hudGfx;
    h.clear();

    const barW = Math.min(130, this.avatarSize + 10);
    const barH = 6;
    const barX = -barW / 2;
    const barY = this.avatarSize / 2 + 12;

    h.roundRect(barX, barY, barW, barH, 3);
    h.fill({ color: 0x1E293B });

    const ratio = Math.max(0, hp / maxHp);
    if (ratio > 0) {
      const hpColor = isPlayer ? 0x00F5FF : 0xFF007A;
      h.roundRect(barX, barY, barW * ratio, barH, 3);
      h.fill({ color: hpColor });
    }

    if (!isPlayer && this.core.nextAction) {
      const intent = this.core.nextAction;
      this.intentText.text = `INTENT: ${intent.desc}`;
      this.drawIntentIcon(intent);
    }
  }

  drawIntentIcon(intent) {
    const icon = this.intentIconGfx;
    icon.clear(); icon.x = 0;
    const isMinion = this.core.name && this.core.name.includes('MINION');
    icon.y = -this.avatarSize / 2 - (isMinion ? 70 : 98);

    const size = 12;
    if (intent.type === ENEMY_INTENTS.ATTACK) {
      icon.moveTo(0, -size); icon.lineTo(size, size / 2); icon.lineTo(-size, size / 2); icon.closePath(); icon.fill({ color: 0xFF007A });
    } else if (intent.type === ENEMY_INTENTS.DEFEND) {
      icon.moveTo(0, -size); icon.lineTo(size, 0); icon.lineTo(0, size); icon.lineTo(-size, 0); icon.closePath(); icon.fill({ color: 0x00F5FF });
    } else {
      icon.circle(0, 0, size - 2); icon.fill({ color: 0xFFF000 });
    }
  }

  setTargeted(targeted) {
    if (this.type !== 'enemy') return;

    if (targeted) {
      if (!this.targetLockGfx) {
        this.targetLockGfx = new Graphics();
        this.container.addChild(this.targetLockGfx);
      }
      const lock = this.targetLockGfx;
      lock.clear(); lock.visible = true;

      const size = this.avatarSize / 2 + 18; const len = 16;
      const strokeStyle = { color: 0xFF007A, width: 3, alpha: 0.95 };

      lock.moveTo(-size, -size + len); lock.lineTo(-size, -size); lock.lineTo(-size + len, -size); lock.stroke(strokeStyle);
      lock.moveTo(size, -size + len); lock.lineTo(size, -size); lock.lineTo(size - len, -size); lock.stroke(strokeStyle);
      lock.moveTo(-size, size - len); lock.lineTo(-size, size); lock.lineTo(-size + len, size); lock.stroke(strokeStyle);
      lock.moveTo(size, size - len); lock.lineTo(size, size); lock.lineTo(size - len, size); lock.stroke(strokeStyle);

      gsap.killTweensOf(lock);
      gsap.timeline({ repeat: -1, yoyo: true }).to(lock, { rotation: 0.06, duration: 0.8, ease: 'sine.inOut' });
    } else {
      if (this.targetLockGfx) {
        this.targetLockGfx.visible = false;
        gsap.killTweensOf(this.targetLockGfx);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // スレスパ本編風 2D関節アクション演出
  // ═══════════════════════════════════════════════

  playDamageAnim() {
    const j = this.joints;
    if (j.torso && j.armR && j.head) {
      gsap.timeline()
        .to(j.torso, { rotation: -0.35, duration: 0.08, ease: 'power2.out' })
        .to(j.head, { rotation: 0.4, duration: 0.08 }, '<')
        .to(j.armR, { rotation: -0.6, duration: 0.08 }, '<')
        .to(j.torso, { rotation: 0.14, duration: 0.3, ease: 'back.out(2)' })
        .to(j.head, { rotation: -0.1, duration: 0.3 }, '<')
        .to(j.armR, { rotation: -0.45, duration: 0.3 }, '<');
    }
    gsap.timeline()
      .to(this.skeletonContainer, { x: -14, duration: 0.05 })
      .to(this.skeletonContainer, { x: 14, duration: 0.05 })
      .to(this.skeletonContainer, { x: 0, duration: 0.1 });
  }

  playAttackAnim() {
    this.playSlashAnim();
  }

  /** 一閃 (右腕を大きく後ろ上に引き上げて一気に振り下ろす一閃モーション) */
  playSlashAnim() {
    const origX = this.container.x;
    const origY = this.container.y;
    const j = this.joints;

    if (j.armR && j.foreArmR && j.torso && j.legL) {
      gsap.timeline()
        // 1. 溜め（右腕を後ろ上に大きく引き上げ、体幹が後ろに反る）
        .to(j.armR, { rotation: -2.3, duration: 0.12, ease: 'power2.in' })
        .to(j.foreArmR, { rotation: 1.0, duration: 0.12 }, '<')
        .to(j.torso, { rotation: -0.3, duration: 0.12 }, '<')
        .to(this.container, { x: origX - 40, duration: 0.12 }, '<')
        // 2. 突撃一閃（右腕を一気に振り下ろし、膝を深く曲げて踏み込む）
        .to(j.armR, { rotation: 1.7, duration: 0.1, ease: 'power3.out' })
        .to(j.foreArmR, { rotation: 0.1, duration: 0.1 }, '<')
        .to(j.torso, { rotation: 0.4, duration: 0.1 }, '<')
        .to(j.legL, { rotation: 0.5, duration: 0.1 }, '<')
        .to(this.container, { x: origX + 140, y: origY - 10, duration: 0.1 }, '<')
        // 3. 戻り
        .to(j.armR, { rotation: -0.45, duration: 0.4, ease: 'back.out(1.5)' })
        .to(j.foreArmR, { rotation: 0.55, duration: 0.4 }, '<')
        .to(j.torso, { rotation: 0.14, duration: 0.4 }, '<')
        .to(j.legL, { rotation: 0.32, duration: 0.4 }, '<')
        .to(this.container, { x: origX, y: origY, duration: 0.4, ease: 'back.out(1.5)' }, '<');
    } else {
      gsap.timeline()
        .to(this.container, { x: origX + 90, duration: 0.15, ease: 'power2.in' })
        .to(this.container, { x: origX, duration: 0.35, ease: 'back.out(1.5)' });
    }
  }

  playMagicAnim() {
    const j = this.joints;
    if (j.armL && j.armR && j.torso) {
      gsap.timeline()
        .to(j.armL, { rotation: -1.3, duration: 0.2, ease: 'power2.out' })
        .to(j.armR, { rotation: -1.3, duration: 0.2, ease: 'power2.out' }, '<')
        .to(j.torso, { rotation: 0.25, duration: 0.2 }, '<')
        .to(j.armL, { rotation: -0.6, duration: 0.4, ease: 'back.out(1.5)' }, '+=0.2')
        .to(j.armR, { rotation: -0.85, duration: 0.4, ease: 'back.out(1.5)' }, '<')
        .to(j.torso, { rotation: 0.12, duration: 0.4 }, '<');
    }
  }

  playShieldAnim() {
    const j = this.joints;
    if (j.armL && j.foreArmL) {
      gsap.timeline()
        .to(j.armL, { rotation: -0.9, duration: 0.15 })
        .to(j.foreArmL, { rotation: 0.8, duration: 0.15 }, '<')
        .to(j.armL, { rotation: 0.35, duration: 0.35, delay: 0.3 })
        .to(j.foreArmL, { rotation: -0.7, duration: 0.35 }, '<');
    }

    const barrier = new Graphics();
    const hexR = this.avatarSize * 0.55;
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      hexPoints.push(hexR * Math.cos(a), hexR * Math.sin(a));
    }
    barrier.poly(hexPoints);
    barrier.fill({ color: 0x00F5FF, alpha: 0.2 });
    barrier.poly(hexPoints);
    barrier.stroke({ color: 0x00F5FF, width: 3, alpha: 0.9 });
    barrier.x = 35;
    barrier.scale.set(0.3);
    barrier.alpha = 0;
    this.container.addChild(barrier);

    gsap.timeline()
      .to(barrier, { alpha: 1, duration: 0.15 })
      .to(barrier.scale, { x: 1.25, y: 1.25, duration: 0.2, ease: 'back.out(2)' }, '<')
      .to(barrier, { alpha: 0, duration: 0.4, delay: 0.3, onComplete: () => barrier.destroy() });
  }

  playBuffAnim() {
    const j = this.joints;
    if (j.torso) {
      gsap.timeline()
        .to(j.torso, { y: -25, rotation: 0.25, duration: 0.15 })
        .to(j.torso, { y: -12, rotation: 0.14, duration: 0.35, ease: 'back.out(1.5)' });
    }
  }

  playAOEAnim() {
    const origY = this.container.y;
    const isMage = this.core.characterData?.id === 'MAKER';
    const j = this.joints;

    if (isMage && j.armL && j.armR && j.torso) {
      // メイジ用: 踏みつけ廃止！空中にふわりと浮遊し、両手と魔力を天に捧げる詠唱ポーズ
      gsap.timeline()
        .to(this.container, { y: origY - 45, duration: 0.25, ease: 'power2.out' })
        .to(j.armL, { rotation: -1.6, duration: 0.2 }, '<')
        .to(j.armR, { rotation: -1.6, duration: 0.2 }, '<')
        .to(j.torso, { rotation: -0.2, duration: 0.2 }, '<')
        .to(this.container, { y: origY, duration: 0.35, ease: 'sine.inOut' }, '+=0.2')
        .to(j.armL, { rotation: -0.6, duration: 0.35 }, '<')
        .to(j.armR, { rotation: -0.85, duration: 0.35 }, '<')
        .to(j.torso, { rotation: 0.12, duration: 0.35 }, '<');
    } else {
      // 剣士用: 低空一気全方位回転一閃
      gsap.timeline()
        .to(this.container, { y: origY - 30, duration: 0.15, ease: 'power2.out' })
        .to(this.skeletonContainer, { rotation: 0.4, duration: 0.15 }, '<')
        .to(this.container, { y: origY, duration: 0.25, ease: 'power2.in' })
        .to(this.skeletonContainer, { rotation: 0, duration: 0.25 }, '<');
    }
  }

  playHealAnim() {
    gsap.timeline()
      .to(this.skeletonContainer, { y: -15, duration: 0.3, ease: 'power1.out' })
      .to(this.skeletonContainer, { y: 0, duration: 0.4, ease: 'sine.inOut' });
  }

  playGainShieldAnim() {
    this.playShieldAnim();
  }

  playDeathAnim(onCompleteCallback) {
    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.skeletonContainer);
    gsap.to(this.skeletonContainer.scale, { x: 0, y: 0, duration: 0.5, ease: 'power2.in' });
    gsap.to(this.container, { 
      rotation: 5, alpha: 0, duration: 0.5, ease: 'power2.in', onComplete: onCompleteCallback 
    });
  }

  destroy() {
    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.skeletonContainer);
    gsap.killTweensOf(this.glowGfx);
    Object.values(this.joints).forEach(j => gsap.killTweensOf(j));
    this.minionLegs.forEach(l => {
      gsap.killTweensOf(l.upperLeg);
      gsap.killTweensOf(l.lowerLeg);
    });
    this.container.destroy({ children: true });
  }
}
