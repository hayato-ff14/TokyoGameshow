/**
 * EntitySprite.js - Slay the Spire スタイル 2D関節アニメーションモデル
 * 
 * 全面改修版: 一枚絵画像をゆらす表現を完全に排除し、
 * Slay the Spire 本編（アイアンクラッドやサイレント等）のような
 * 重厚な2Dパーツモデル（太いアウトライン＋グラデーションアーマー）が
 * 待機中の呼吸屈伸・攻撃時の一閃振り下ろしで生き生きと関節駆動するアニメーション。
 */

import { Container, Graphics, Text, TextStyle, Sprite, Assets, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { ENEMY_INTENTS } from '../core/EnemyAI.js';

/**
 * 画像の白背景を透過処理してPixiJS Textureを生成するヘルパー関数
 */
function loadTransparentAnimeTexture(url) {
  return Assets.load(url).then(texture => {
    try {
      const sourceEl = texture.source?.resource || texture.baseTexture?.resource?.source;
      const canvas = document.createElement('canvas');
      const width = texture.width || sourceEl?.width || 512;
      const height = texture.height || sourceEl?.height || 512;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (sourceEl) {
        ctx.drawImage(sourceEl, 0, 0, width, height);
      } else {
        return texture;
      }
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 215 && g > 215 && b > 215) {
          const avg = (r + g + b) / 3;
          const alphaFactor = Math.max(0, (255 - avg) / 40);
          data[i + 3] = Math.floor(data[i + 3] * alphaFactor);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return Texture.from(canvas);
    } catch (e) {
      console.warn("Chroma key processing fallback:", e);
      return texture;
    }
  });
}

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

  // ═══════════════════════════════════════════════════════════════
  // Slay the Spire 本編風の超高精細2D関節パーツモデル構築
  // ═══════════════════════════════════════════════════════════════

  /** BLADE.EXE (近接ハッカー: フルプレートアーマー ＋ バイザーヘルメット ＋ 大剣) */
  buildBladeSTS2D() {
    const root = this.skeletonContainer;

    const pelvis = new Container();     // 腰・ベルト
    const torso = new Container();      // チェストアーマー
    const head = new Container();       // バイザーヘルメット・流動髪
    const shoulderL = new Container();  // 左肩当て
    const shoulderR = new Container();  // 右肩当て
    const armR = new Container();       // 右上腕
    const foreArmR = new Container();   // 右前腕・ガントレット
    const weapon = new Container();     // ネオン大剣
    const armL = new Container();       // 左腕
    const foreArmL = new Container();   // 左前腕
    const legL = new Container();       // 左大腿 (前脚)
    const lowerLegL = new Container();  // 左下腿・ブーツ
    const legR = new Container();       // 右大腿 (後脚)
    const lowerLegR = new Container();  // 右下腿・ブーツ

    root.addChild(pelvis);
    pelvis.addChild(legR); legR.addChild(lowerLegR);
    pelvis.addChild(legL); legL.addChild(lowerLegL);
    pelvis.addChild(torso);
    torso.addChild(head);
    torso.addChild(shoulderL);
    torso.addChild(armL); armL.addChild(foreArmL);
    torso.addChild(armR); armR.addChild(foreArmR);
    foreArmR.addChild(weapon);
    torso.addChild(shoulderR);

    // 姿勢の初期アライメント (腰を深く落としたサイバーサムライ構え)
    pelvis.y = 10;
    torso.y = -14; torso.rotation = 0.12;
    head.y = -38; head.rotation = -0.08;

    // 前後の脚踏み込み
    legL.x = 16; legL.y = 12; legL.rotation = 0.35; lowerLegL.y = 26; lowerLegL.rotation = -0.52;
    legR.x = -18; legR.y = 12; legR.rotation = -0.35; lowerLegR.y = 26; lowerLegR.rotation = 0.52;

    // 左腕 (ガード構え)
    armL.x = -20; armL.y = -28; armL.rotation = 0.38; foreArmL.y = 22; foreArmL.rotation = -0.75;
    shoulderL.x = -20; shoulderL.y = -30;

    // 右腕 (大剣を斜め上前方へ構える)
    armR.x = 24; armR.y = -28; armR.rotation = -0.50;
    foreArmR.y = 24; foreArmR.rotation = 0.60;
    weapon.x = 2; weapon.y = 18; weapon.rotation = 0.90;
    shoulderR.x = 24; shoulderR.y = -30;

    // 2Dアニメキャラクタースプライトの読み込み
    loadTransparentAnimeTexture('/assets/anime_blade.png').then((texture) => {
      if (texture && !root.destroyed) {
        const animeSprite = new Sprite(texture);
        animeSprite.anchor.set(0.48, 0.82);
        animeSprite.height = 220;
        animeSprite.scale.x = animeSprite.scale.y;
        torso.addChildAt(animeSprite, 0);
        // ベクター図形の非表示化 (スプライト描画の邪魔にならないよう背景化)
        [thighL, shinL, thighR, shinR, pelGfx, tGfx, hGfx, sLGfx, sRGfx, aLGfx, faLGfx, aRGfx, faRGfx, wGfx].forEach(g => g.visible = false);
      }
    }).catch(e => console.error("Error loading anime_blade:", e));

    // ── 1. 脚部・ブーツ ──
    // 左脚 (前)
    const thighL = new Graphics();
    thighL.poly([-10, 0, 10, 0, 8, 28, -8, 28]);
    thighL.fill({ color: 0x0F172A });
    thighL.stroke({ color: 0x00F5FF, width: 2.5 });
    // 膝パッド
    thighL.rect(-8, 20, 16, 8); thighL.fill({ color: 0x00F5FF });
    legL.addChild(thighL);

    const shinL = new Graphics();
    shinL.poly([-9, 0, 9, 0, 11, 28, -7, 28]);
    shinL.fill({ color: 0x1E293B });
    shinL.stroke({ color: 0x0284C7, width: 2.5 });
    // ブーツソール (靴底)
    shinL.roundRect(-10, 24, 24, 7, 3); shinL.fill({ color: 0x00F5FF });
    lowerLegL.addChild(shinL);

    // 右脚 (後)
    const thighR = new Graphics();
    thighR.poly([-10, 0, 10, 0, 8, 28, -8, 28]);
    thighR.fill({ color: 0x0F172A });
    thighR.stroke({ color: 0x00F5FF, width: 2.5 });
    thighR.rect(-8, 20, 16, 8); thighR.fill({ color: 0x00F5FF });
    legR.addChild(thighR);

    const shinR = new Graphics();
    shinR.poly([-9, 0, 9, 0, 11, 28, -7, 28]);
    shinR.fill({ color: 0x1E293B });
    shinR.stroke({ color: 0x0284C7, width: 2.5 });
    shinR.roundRect(-10, 24, 24, 7, 3); shinR.fill({ color: 0x00F5FF });
    lowerLegR.addChild(shinR);

    // ── 2. 腰・ベルト ──
    const pelGfx = new Graphics();
    pelGfx.poly([-18, 0, 18, 0, 14, 16, -14, 16]);
    pelGfx.fill({ color: 0x0F172A });
    pelGfx.stroke({ color: 0x00F5FF, width: 2.5 });
    pelGfx.circle(0, 8, 5); pelGfx.fill({ color: 0xFF007A });
    pelvis.addChild(pelGfx);

    // ── 3. 胴体 (チェストプレート ＋ リアクターコア) ──
    const tGfx = new Graphics();
    tGfx.poly([-26, -38, 26, -38, 20, 14, -20, 14]);
    tGfx.fill({ color: 0x1E1E38 });
    tGfx.stroke({ color: 0x00F5FF, width: 3 });
    // 装甲ライン
    tGfx.moveTo(-22, -26); tGfx.lineTo(22, -26); tGfx.stroke({ color: 0x38BDF8, width: 2 });
    // パルスパワーコア
    tGfx.poly([-12, -30, 12, -30, 8, -12, -8, -12]);
    tGfx.fill({ color: 0xFF007A });
    tGfx.circle(0, -21, 6); tGfx.fill({ color: 0xFFFFFF });
    torso.addChild(tGfx);

    // ── 4. 頭部 (スレスパ風サムライバイザー ＋ 流動ヘアー) ──
    const hGfx = new Graphics();
    // 兜・後頭部
    hGfx.poly([-18, 8, -22, -24, 0, -32, 22, -24, 18, 8]);
    hGfx.fill({ color: 0x0F172A });
    hGfx.stroke({ color: 0x00F5FF, width: 2.5 });
    // シアン発光バイザー
    hGfx.rect(-16, -20, 32, 9); hGfx.fill({ color: 0x00F5FF });
    hGfx.rect(-12, -18, 24, 5); hGfx.fill({ color: 0xFFFFFF });
    // 面頬 (フェイスガード)
    hGfx.poly([-14, -8, 14, -8, 0, 6]); hGfx.fill({ color: 0x1E293B });
    // なびく流動サイバーヘアー
    hGfx.poly([-18, -22, -42, -32, -32, -8, -48, 5, -20, -5]);
    hGfx.fill({ color: 0x00F5FF, alpha: 0.95 });
    hGfx.stroke({ color: 0xFFFFFF, width: 1.5 });
    head.addChild(hGfx);

    // ── 5. 肩当て・腕部 ──
    // 左肩
    const sLGfx = new Graphics();
    sLGfx.poly([0, -14, -18, 0, 0, 14, 14, 0]);
    sLGfx.fill({ color: 0x0F172A }); sLGfx.stroke({ color: 0x00F5FF, width: 2 });
    shoulderL.addChild(sLGfx);

    // 右肩 (スパイク型)
    const sRGfx = new Graphics();
    sRGfx.poly([0, -18, 22, 0, 0, 18, -16, 0]);
    sRGfx.fill({ color: 0xFF007A });
    sRGfx.stroke({ color: 0xFFFFFF, width: 2 });
    shoulderR.addChild(sRGfx);

    // 腕パーツ
    const aLGfx = new Graphics(); aLGfx.roundRect(-8, 0, 16, 24, 4); aLGfx.fill({ color: 0x1E293B }); aLGfx.stroke({ color: 0x00F5FF, width: 2 }); armL.addChild(aLGfx);
    const faLGfx = new Graphics(); faLGfx.roundRect(-7, 0, 14, 22, 4); faLGfx.fill({ color: 0x00F5FF }); foreArmL.addChild(faLGfx);

    const aRGfx = new Graphics(); aRGfx.roundRect(-8, 0, 16, 24, 4); aRGfx.fill({ color: 0x1E293B }); aRGfx.stroke({ color: 0x00F5FF, width: 2 }); armR.addChild(aRGfx);
    const faRGfx = new Graphics(); faRGfx.roundRect(-7, 0, 14, 22, 4); faRGfx.fill({ color: 0xFF007A }); foreArmR.addChild(faRGfx);

    // ── 6. 大剣ネオンサイバーブレード ──
    const wGfx = new Graphics();
    // 柄・鍔
    wGfx.circle(0, -10, 9); wGfx.fill({ color: 0xFF007A });
    wGfx.rect(-14, -18, 28, 6); wGfx.fill({ color: 0x00F5FF });
    // 刀身 (複線光彩)
    wGfx.moveTo(0, -18); wGfx.lineTo(95, -68);
    wGfx.stroke({ color: 0x00F5FF, width: 8, alpha: 0.95 });
    wGfx.moveTo(0, -18); wGfx.lineTo(95, -68);
    wGfx.stroke({ color: 0xFFFFFF, width: 3.5, alpha: 1.0 });
    weapon.addChild(wGfx);

    this.joints = { pelvis, torso, head, armL, foreArmL, armR, foreArmR, weapon, shoulderL, shoulderR, legL, lowerLegL, legR, lowerLegR };
  }

  /** HEX.EXE (魔導ハッカー: フードローブ ＋ 紫マント ＋ 浮遊オーブ) */
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
    pelvis.addChild(legR); legR.addChild(lowerLegR);
    pelvis.addChild(legL); legL.addChild(lowerLegL);
    pelvis.addChild(mantle);
    pelvis.addChild(torso);
    torso.addChild(head);
    torso.addChild(armL); armL.addChild(foreArmL);
    torso.addChild(armR); armR.addChild(foreArmR);

    pelvis.y = 10;
    torso.y = -14; torso.rotation = 0.10;
    head.y = -38; head.rotation = -0.06;

    legL.x = 14; legL.y = 10; legL.rotation = 0.30; lowerLegL.y = 24; lowerLegL.rotation = -0.45;
    legR.x = -16; legR.y = 10; legR.rotation = -0.30; lowerLegR.y = 24; lowerLegR.rotation = 0.45;

    armL.x = -18; armL.y = -26; armL.rotation = -0.65; foreArmL.y = 22; foreArmL.rotation = 0.85;
    armR.x = 18; armR.y = -26; armR.rotation = -0.90; foreArmR.y = 22; foreArmR.rotation = 1.0;

    // 2Dアニメキャラクタースプライトの読み込み
    loadTransparentAnimeTexture('/assets/anime_hex.png').then((texture) => {
      if (texture && !root.destroyed) {
        const animeSprite = new Sprite(texture);
        animeSprite.anchor.set(0.5, 0.82);
        animeSprite.height = 220;
        animeSprite.scale.x = animeSprite.scale.y;
        torso.addChildAt(animeSprite, 0);
        // ベクター図形の非表示化
        [lL, llL, lR, llR, mGfx, tGfx, hGfx, aLGfx, faLGfx, aRGfx, faRGfx].forEach(g => g.visible = false);
      }
    }).catch(e => console.error("Error loading anime_hex:", e));

    // 1. 脚部・ローブ裾
    const lL = new Graphics(); lL.roundRect(-7, 0, 14, 26, 4); lL.fill({ color: 0x1E102A }); legL.addChild(lL);
    const llL = new Graphics(); llL.roundRect(-6, 0, 12, 26, 4); llL.fill({ color: 0x3B1D54 }); lowerLegL.addChild(llL);
    const lR = new Graphics(); lR.roundRect(-7, 0, 14, 26, 4); lR.fill({ color: 0x1E102A }); legR.addChild(lR);
    const llR = new Graphics(); llR.roundRect(-6, 0, 12, 26, 4); llR.fill({ color: 0x3B1D54 }); lowerLegR.addChild(llR);

    // 2. 風になびくマント
    const mGfx = new Graphics();
    mGfx.poly([-30, -28, -65, 45, 15, 55, 30, -28]);
    mGfx.fill({ color: 0x4C1D95 });
    mGfx.stroke({ color: 0xA855F7, width: 3 });
    mGfx.poly([-25, -20, -55, 40, -15, 45]); mGfx.fill({ color: 0x311065 });
    mantle.addChild(mGfx);

    // 3. 胴体
    const tGfx = new Graphics();
    tGfx.poly([-24, -36, 24, -36, 18, 14, -18, 14]);
    tGfx.fill({ color: 0x2E1045 });
    tGfx.stroke({ color: 0xA855F7, width: 3 });
    tGfx.circle(0, -12, 9); tGfx.fill({ color: 0xE9D5FF });
    tGfx.circle(0, -12, 4); tGfx.fill({ color: 0xFFFFFF });
    torso.addChild(tGfx);

    // 4. フード頭部
    const hGfx = new Graphics();
    hGfx.poly([-26, 12, -30, -42, 0, -48, 30, -42, 26, 12]);
    hGfx.fill({ color: 0x4C1D95 });
    hGfx.stroke({ color: 0xA855F7, width: 2.5 });
    // 暗がり顔 ＋ 光彩目
    hGfx.roundRect(-16, -24, 32, 22, 5); hGfx.fill({ color: 0x0F0518 });
    hGfx.ellipse(-6, -14, 5, 3); hGfx.fill({ color: 0xE9D5FF });
    hGfx.ellipse(6, -14, 5, 3); hGfx.fill({ color: 0xE9D5FF });
    head.addChild(hGfx);

    // 5. 腕部
    const aLGfx = new Graphics(); aLGfx.roundRect(-7, 0, 14, 22, 4); aLGfx.fill({ color: 0x3B1D54 }); armL.addChild(aLGfx);
    const faLGfx = new Graphics(); faLGfx.circle(0, 16, 7); faLGfx.fill({ color: 0xE9D5FF }); foreArmL.addChild(faLGfx);

    const aRGfx = new Graphics(); aRGfx.roundRect(-7, 0, 14, 22, 4); aRGfx.fill({ color: 0x3B1D54 }); armR.addChild(aRGfx);
    const faRGfx = new Graphics(); faRGfx.circle(0, 16, 7); faRGfx.fill({ color: 0xE9D5FF }); foreArmR.addChild(faRGfx);

    // 6. 浮遊する3つの魔導オーブ
    for (let i = 0; i < 3; i++) {
      const orbContainer = new Container();
      const orbGfx = new Graphics();
      orbGfx.circle(0, 0, 11); orbGfx.fill({ color: 0xE9D5FF });
      orbGfx.circle(0, 0, 15); orbGfx.stroke({ color: 0xA855F7, width: 2.5 });
      orbGfx.circle(0, 0, 4); orbGfx.fill({ color: 0xFFFFFF });
      orbContainer.addChild(orbGfx);
      root.addChild(orbContainer);
      this.orbs.push({ container: orbContainer, baseAngle: (i * Math.PI * 2) / 3 });
    }

    this.joints = { pelvis, torso, head, mantle, armL, foreArmL, armR, foreArmR, legL, lowerLegL, legR, lowerLegR };
  }

  /** BOSS.DEATH_RAY (大型巨神ボス) */
  buildBossSTS2D() {
    const root = this.skeletonContainer;
    const body = new Container();
    const head = new Container();
    const armL = new Container();
    const armR = new Container();
    const shoulderCannonL = new Container();
    const shoulderCannonR = new Container();

    root.addChild(body);
    body.addChild(head);
    body.addChild(shoulderCannonL);
    body.addChild(shoulderCannonR);
    body.addChild(armL);
    body.addChild(armR);

    // 2Dアニメボスキャラクタースプライトの読み込み
    loadTransparentAnimeTexture('/assets/anime_boss.png').then((texture) => {
      if (texture && !root.destroyed) {
        const animeSprite = new Sprite(texture);
        animeSprite.anchor.set(0.5, 0.70);
        animeSprite.height = 280;
        animeSprite.scale.x = animeSprite.scale.y;
        body.addChildAt(animeSprite, 0);
        // ベクター図形の非表示化
        [bGfx, hGfx, scLGfx, scRGfx, aLGfx, aRGfx].forEach(g => g.visible = false);
      }
    }).catch(e => console.error("Error loading anime_boss:", e));

    // 胸部メカプレート
    const bGfx = new Graphics();
    bGfx.poly([-60, -70, 60, -70, 72, 30, 0, 75, -72, 30]);
    bGfx.fill({ color: 0x1A0510 });
    bGfx.stroke({ color: 0xFF007A, width: 4 });
    // パワー炉心コア
    bGfx.circle(0, -10, 28); bGfx.fill({ color: 0xFF0044 });
    bGfx.circle(0, -10, 14); bGfx.fill({ color: 0xFFF000 });
    bGfx.circle(0, -10, 6); bGfx.fill({ color: 0xFFFFFF });
    body.addChild(bGfx);

    // 頭部
    const hGfx = new Graphics();
    hGfx.poly([-28, 0, -50, -60, -18, -40, 0, -50, 18, -40, 50, -60, 28, 0]);
    hGfx.fill({ color: 0x380515 });
    hGfx.stroke({ color: 0xFF007A, width: 3 });
    hGfx.rect(-20, -22, 40, 10); hGfx.fill({ color: 0xFFF000 });
    head.addChild(hGfx);
    head.y = -40;

    // 肩部キャノン
    const scLGfx = new Graphics(); scLGfx.rect(-15, -45, 30, 45); scLGfx.fill({ color: 0x4A041A }); scLGfx.stroke({ color: 0xFF007A, width: 2 }); shoulderCannonL.addChild(scLGfx);
    shoulderCannonL.x = -65; shoulderCannonL.y = -60;

    const scRGfx = new Graphics(); scRGfx.rect(-15, -45, 30, 45); scRGfx.fill({ color: 0x4A041A }); scRGfx.stroke({ color: 0xFF007A, width: 2 }); shoulderCannonR.addChild(scRGfx);
    shoulderCannonR.x = 65; shoulderCannonR.y = -60;

    // 巨大アーム
    armL.x = -80; armL.y = -30;
    const aLGfx = new Graphics(); aLGfx.poly([0, -28, -35, 0, 0, 45, 18, 0]); aLGfx.fill({ color: 0x2A0818 }); aLGfx.stroke({ color: 0xFF007A, width: 3 }); armL.addChild(aLGfx);
    
    armR.x = 80; armR.y = -30;
    const aRGfx = new Graphics(); aRGfx.poly([0, -28, 35, 0, 0, 45, -18, 0]); aRGfx.fill({ color: 0x2A0818 }); aRGfx.stroke({ color: 0xFF007A, width: 3 }); armR.addChild(aRGfx);

    this.joints = { body, head, armL, armR, shoulderCannonL, shoulderCannonR };
  }

  /** MINION (多脚ドローン) */
  buildMinion2D() {
    const root = this.skeletonContainer;
    const core = new Container(); root.addChild(core);
    const cGfx = new Graphics();
    cGfx.circle(0, 0, 24); cGfx.fill({ color: 0x181206 });
    cGfx.circle(0, 0, 24); cGfx.stroke({ color: 0xFFF000, width: 3 });
    cGfx.circle(0, 0, 11); cGfx.fill({ color: 0xFF007A });
    core.addChild(cGfx);

    this.minionLegs = [];
    const angles = [-0.75, 0.75, Math.PI - 0.75, Math.PI + 0.75];
    angles.forEach((angle, idx) => {
      const legRoot = new Container();
      const upperLeg = new Container();
      const lowerLeg = new Container();
      root.addChild(legRoot); legRoot.addChild(upperLeg); upperLeg.addChild(lowerLeg);

      const uGfx = new Graphics(); uGfx.moveTo(0, 0); uGfx.lineTo(28, -12); uGfx.stroke({ color: 0xFFF000, width: 3.5 }); upperLeg.addChild(uGfx);
      const lGfx = new Graphics(); lGfx.moveTo(0, 0); lGfx.lineTo(16, 32); lGfx.stroke({ color: 0xFF007A, width: 3 }); lowerLeg.addChild(lGfx);

      legRoot.rotation = angle; lowerLeg.x = 28; lowerLeg.y = -12;
      this.minionLegs.push({ legRoot, upperLeg, lowerLeg, index: idx });
    });
    this.joints = { core };
  }

  /** VIRUS (アゴ・触手が動くバイオウイルス) */
  buildVirus2D() {
    const root = this.skeletonContainer;
    const body = new Container(); root.addChild(body);
    const jawUpper = new Container(); body.addChild(jawUpper);
    const jawLower = new Container(); body.addChild(jawLower);

    // 2Dアニメウイルススプライトの読み込み
    loadTransparentAnimeTexture('/assets/anime_virus.png').then((texture) => {
      if (texture && !root.destroyed) {
        const animeSprite = new Sprite(texture);
        animeSprite.anchor.set(0.5, 0.5);
        animeSprite.height = 150;
        animeSprite.scale.x = animeSprite.scale.y;
        body.addChildAt(animeSprite, 0);
        // ベクター図形の非表示化
        [bGfx, jUGfx, jLGfx].forEach(g => { if (g) g.visible = false; });
      }
    }).catch(e => console.error("Error loading anime_virus:", e));

    const bGfx = new Graphics();
    const points = []; const numSpikes = 8; const r = 52;
    for (let i = 0; i < numSpikes * 2; i++) {
      const angle = (i * Math.PI) / numSpikes;
      const rad = (i % 2 === 0) ? r : (r * 0.65);
      points.push(rad * Math.cos(angle), rad * Math.sin(angle));
    }
    bGfx.poly(points); bGfx.fill({ color: 0x120614 });
    bGfx.poly(points); bGfx.stroke({ color: 0xFF007A, width: 3 });
    bGfx.circle(0, 0, 18); bGfx.fill({ color: 0x00F5FF });
    bGfx.circle(0, 0, 9); bGfx.fill({ color: 0xFF007A });
    body.addChild(bGfx);

    // 動くアゴ
    const jUGfx = new Graphics(); jUGfx.poly([0, -18, 28, -25, 18, -8]); jUGfx.fill({ color: 0xFF007A }); jawUpper.addChild(jUGfx);
    const jLGfx = new Graphics(); jLGfx.poly([0, 18, 28, 25, 18, 8]); jLGfx.fill({ color: 0xFF007A }); jawLower.addChild(jLGfx);

    this.joints = { body, jawUpper, jawLower };
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
      gsap.to(j.body, { y: -10, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      if (j.jawUpper && j.jawLower) {
        gsap.to(j.jawUpper, { rotation: -0.25, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(j.jawLower, { rotation: 0.25, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
      if (j.shoulderCannonL && j.shoulderCannonR) {
        gsap.to(j.shoulderCannonL, { y: -68, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(j.shoulderCannonR, { y: -68, duration: 1.2, delay: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
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
    if (!isPlayer && this.core.infection > 0) statusParts.push(`[☣️ DoT ${this.core.infection}]`);
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

  /** 1. 高速刺突・疾走一閃 (QUICK STRIKE / EXPLOIT 等) */
  playQuickThrustAnim() {
    const origX = this.container.x;
    const origY = this.container.y;
    const j = this.joints;

    if (j.armR && j.foreArmR && j.torso) {
      gsap.timeline()
        // 高速前進＋腕を前方突刺し
        .to(this.container, { x: origX + 130, y: origY + 5, duration: 0.08, ease: 'power3.out' })
        .to(j.armR, { rotation: 0.4, duration: 0.08 }, '<')
        .to(j.foreArmR, { rotation: 0.1, duration: 0.08 }, '<')
        .to(j.torso, { rotation: 0.25, duration: 0.08 }, '<')
        // 残像引き波・高速バックステップ
        .to(this.container, { x: origX, y: origY, duration: 0.25, ease: 'power2.inOut' })
        .to(j.armR, { rotation: -0.45, duration: 0.25 }, '<')
        .to(j.foreArmR, { rotation: 0.55, duration: 0.25 }, '<')
        .to(j.torso, { rotation: 0.14, duration: 0.25 }, '<');
    } else {
      gsap.timeline()
        .to(this.container, { x: origX + 110, duration: 0.09, ease: 'power3.out' })
        .to(this.container, { x: origX, duration: 0.25, ease: 'power2.inOut' });
    }
  }

  /** 2. 重撃・跳躍叩きつけ (HEAVY SLAM / STRIKE 等) */
  playHeavySlamAnim() {
    const origX = this.container.x;
    const origY = this.container.y;
    const j = this.joints;

    if (j.armR && j.foreArmR && j.torso && j.head) {
      gsap.timeline()
        // 1. 大きな後方溜め
        .to(j.armR, { rotation: -2.4, duration: 0.15, ease: 'power2.in' })
        .to(j.foreArmR, { rotation: 1.2, duration: 0.15 }, '<')
        .to(j.torso, { rotation: -0.4, duration: 0.15 }, '<')
        .to(j.head, { rotation: 0.2, duration: 0.15 }, '<')
        .to(this.container, { x: origX - 35, y: origY - 45, duration: 0.15, ease: 'power2.out' }, '<')
        // 2. 空中跳躍からの垂直一閃叩きつけ！
        .to(this.container, { x: origX + 160, y: origY + 15, duration: 0.12, ease: 'power4.in' })
        .to(j.armR, { rotation: 1.8, duration: 0.12 }, '<')
        .to(j.foreArmR, { rotation: 0.0, duration: 0.12 }, '<')
        .to(j.torso, { rotation: 0.5, duration: 0.12 }, '<')
        .to(j.head, { rotation: -0.3, duration: 0.12 }, '<')
        // 3. 着地ドスンと戻り
        .to(this.container, { x: origX, y: origY, duration: 0.35, ease: 'back.out(1.8)' })
        .to(j.armR, { rotation: -0.45, duration: 0.35 }, '<')
        .to(j.foreArmR, { rotation: 0.55, duration: 0.35 }, '<')
        .to(j.torso, { rotation: 0.14, duration: 0.35 }, '<')
        .to(j.head, { rotation: -0.08, duration: 0.35 }, '<');
    } else {
      this.playSlashAnim();
    }
  }

  /** 3. 全方位360度回転斬り (WHIRLWIND CUT / BUFFER OVERFLOW 等) */
  playWhirlwindSpinAnim() {
    const origX = this.container.x;
    const origY = this.container.y;
    const j = this.joints;

    gsap.timeline()
      .to(this.container, { x: origX + 80, y: origY - 20, duration: 0.15, ease: 'power2.out' })
      .to(this.skeletonContainer, { rotation: Math.PI * 2, duration: 0.28, ease: 'power1.inOut' }, '<')
      .to(this.skeletonContainer, { rotation: 0, duration: 0.001 })
      .to(this.container, { x: origX, y: origY, duration: 0.25, ease: 'back.out(1.5)' });
  }

  /** 4. 魔術詠唱・波動解放 (HEXスペル / FIREWALL / SYSTEM PURGE 等) */
  playSpellSurgeAnim() {
    const origY = this.container.y;
    const j = this.joints;

    if (j.armL && j.armR && j.torso) {
      gsap.timeline()
        // 空中ふわり浮遊 ＋ 両手拡開
        .to(this.container, { y: origY - 40, duration: 0.2, ease: 'power2.out' })
        .to(j.armL, { rotation: -1.7, duration: 0.2 }, '<')
        .to(j.armR, { rotation: -1.7, duration: 0.2 }, '<')
        .to(j.torso, { rotation: -0.2, duration: 0.2 }, '<')
        // 波動エネルギー射出ポーズ
        .to(j.armL, { rotation: 0.2, duration: 0.15, ease: 'power3.out' }, '+=0.1')
        .to(j.armR, { rotation: 0.4, duration: 0.15, ease: 'power3.out' }, '<')
        .to(j.torso, { rotation: 0.3, duration: 0.15 }, '<')
        // 緩やかな着地
        .to(this.container, { y: origY, duration: 0.35, ease: 'sine.inOut' }, '+=0.15')
        .to(j.armL, { rotation: -0.6, duration: 0.35 }, '<')
        .to(j.armR, { rotation: -0.85, duration: 0.35 }, '<')
        .to(j.torso, { rotation: 0.12, duration: 0.35 }, '<');
    } else {
      this.playMagicAnim();
    }
  }

  /** 5. 自己強化・パワーチャージ (TEMP BOOST / CLOCK DRIVER / OVERCLOCK 等) */
  playPowerUpAnim() {
    const j = this.joints;
    const origY = this.container.y;

    if (j.torso && j.head) {
      gsap.timeline()
        // 沈み込みパワーチャージ
        .to(this.container, { y: origY + 12, duration: 0.12, ease: 'power2.in' })
        .to(j.torso, { rotation: 0.4, y: -6, duration: 0.12 }, '<')
        .to(j.head, { rotation: 0.25, duration: 0.12 }, '<')
        // 大地を踏みしめ咆哮パワー解放！
        .to(this.container, { y: origY - 25, duration: 0.15, ease: 'back.out(2.5)' })
        .to(j.torso, { rotation: -0.3, y: -26, duration: 0.15 }, '<')
        .to(j.head, { rotation: -0.2, duration: 0.15 }, '<')
        // 着地安定
        .to(this.container, { y: origY, duration: 0.3, ease: 'sine.inOut' }, '+=0.2')
        .to(j.torso, { rotation: 0.14, y: -14, duration: 0.3 }, '<')
        .to(j.head, { rotation: -0.08, duration: 0.3 }, '<');
    } else {
      this.playBuffAnim();
    }
  }

  /** 6. ホログラムスキャン・ハック (QUICK SCAN / RECYCLE / DATA DRAW 等) */
  playScanHackAnim() {
    const j = this.joints;
    const origX = this.container.x;

    if (j.armR && j.foreArmR && j.head) {
      gsap.timeline()
        .to(this.container, { x: origX + 35, duration: 0.12 })
        .to(j.armR, { rotation: -1.2, duration: 0.12 }, '<')
        .to(j.foreArmR, { rotation: 0.8, duration: 0.12 }, '<')
        .to(j.head, { rotation: -0.2, duration: 0.12 }, '<')
        // 空中ハックタップ
        .to(j.foreArmR, { rotation: 0.5, duration: 0.1, repeat: 3, yoyo: true })
        // 復帰
        .to(this.container, { x: origX, duration: 0.25, ease: 'sine.inOut' })
        .to(j.armR, { rotation: -0.45, duration: 0.25 }, '<')
        .to(j.foreArmR, { rotation: 0.55, duration: 0.25 }, '<')
        .to(j.head, { rotation: -0.08, duration: 0.25 }, '<');
    }
  }

  /** 7. 鉄壁ガード・バリアクロス (DEFEND / SPIKE WALL / SHIELD SKILLS) */
  playBarrierLockAnim() {
    const j = this.joints;
    if (j.armL && j.foreArmL && j.armR && j.foreArmR) {
      gsap.timeline()
        .to(j.armL, { rotation: -0.9, duration: 0.12 })
        .to(j.foreArmL, { rotation: 0.8, duration: 0.12 }, '<')
        .to(j.armR, { rotation: -0.9, duration: 0.12 }, '<')
        .to(j.foreArmR, { rotation: 0.8, duration: 0.12 }, '<')
        .to(j.armL, { rotation: 0.35, duration: 0.35, delay: 0.35 })
        .to(j.foreArmL, { rotation: -0.7, duration: 0.35 }, '<')
        .to(j.armR, { rotation: -0.45, duration: 0.35 }, '<')
        .to(j.foreArmR, { rotation: 0.55, duration: 0.35 }, '<');
    }

    const barrier = new Graphics();
    const hexR = this.avatarSize * 0.60;
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      hexPoints.push(hexR * Math.cos(a), hexR * Math.sin(a));
    }
    barrier.poly(hexPoints);
    barrier.fill({ color: 0x00F5FF, alpha: 0.25 });
    barrier.poly(hexPoints);
    barrier.stroke({ color: 0x00F5FF, width: 3.5, alpha: 0.95 });
    // 内側リング
    barrier.circle(0, 0, hexR * 0.7);
    barrier.stroke({ color: 0xFFFFFF, width: 2, alpha: 0.8 });
    barrier.x = 35;
    barrier.scale.set(0.2);
    barrier.alpha = 0;
    this.container.addChild(barrier);

    gsap.timeline()
      .to(barrier, { alpha: 1, duration: 0.12 })
      .to(barrier.scale, { x: 1.35, y: 1.35, duration: 0.22, ease: 'back.out(2)' }, '<')
      .to(barrier, { alpha: 0, duration: 0.4, delay: 0.35, onComplete: () => barrier.destroy() });
  }

  /** 一閃 (右腕を大きく後ろ上に引き上げて一気に振り下ろす一閃モーション) */
  playSlashAnim() {
    this.playHeavySlamAnim();
  }

  playMagicAnim() {
    this.playSpellSurgeAnim();
  }

  playShieldAnim() {
    this.playBarrierLockAnim();
  }

  playBuffAnim() {
    this.playPowerUpAnim();
  }

  playAOEAnim() {
    this.playWhirlwindSpinAnim();
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
