/**
 * CardSprite.js - カードのビジュアル表現（描画専用・操作ロジックはmain.jsで管理）
 */

import { Container, Graphics, Text, TextStyle, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';

export class CardSprite {
  /**
   * @param {Object} cardData - core/DeckManager.js のカードデータ定義
   */
  constructor(cardData) {
    this.data = cardData;

    // メインコンテナ
    this.container = new Container();

    // 状態管理
    this.isDragging = false;
    this.isHovered = false;

    // 手札リストでの元の配置位置 (整列アニメ用)
    this.handX = 0;
    this.handY = 0;
    this.handRotation = 0;

    // カードのサイズ
    this.cardWidth = 170;
    this.cardHeight = 245;

    // グラフィック描画
    this.bgGfx = new Graphics();
    this.container.addChild(this.bgGfx);

    // テキスト情報
    this.titleText = null;
    this.descText = null;
    this.costText = null;

    this.drawCard();
  }

  /** カードのベクター描画 */
  drawCard() {
    const gfx = this.bgGfx;
    gfx.clear();

    const typeColors = {
      attack: 0xFF007A,
      skill: 0x00F5FF,
      buff: 0xFFF000
    };
    const cardColor = typeColors[this.data.type] || 0x00F5FF;

    // 1. カード背景 (ダークグラデーション)
    gfx.roundRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    gfx.fill({ color: 0x0B0F19, alpha: 0.96 });

    // 2. 外枠 (タイプ別の発光ライン)
    gfx.roundRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    gfx.stroke({ color: cardColor, width: 2, alpha: 0.9 });

    // 内側ダブルライン
    gfx.roundRect(-this.cardWidth / 2 + 4, -this.cardHeight / 2 + 4, this.cardWidth - 8, this.cardHeight - 8, 10);
    gfx.stroke({ color: cardColor, width: 1, alpha: 0.25 });

    // 3. タイトルバー
    gfx.roundRect(-this.cardWidth / 2 + 10, -this.cardHeight / 2 + 32, this.cardWidth - 20, 24, 4);
    gfx.fill({ color: cardColor, alpha: 0.12 });
    gfx.stroke({ color: cardColor, width: 1, alpha: 0.4 });

    // 4. アート枠 (イラスト領域)
    const artY = -22;
    const artW = this.cardWidth - 24;
    const artH = 68;
    gfx.roundRect(-artW / 2, artY - artH / 2, artW, artH, 6);
    gfx.fill({ color: 0x050810, alpha: 0.9 });
    gfx.stroke({ color: cardColor, width: 1.5, alpha: 0.6 });

    // カード1枚1枚の専用ベクターアートを描画
    this.drawCardArt(gfx, artY, artW, artH);

    // コストバッジ (左上)
    gfx.circle(-this.cardWidth / 2 + 18, -this.cardHeight / 2 + 18, 14);
    gfx.fill({ color: 0x0A0F1D, alpha: 0.95 });
    gfx.circle(-this.cardWidth / 2 + 18, -this.cardHeight / 2 + 18, 14);
    gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });

    // CLOCKバッジ (右上)
    gfx.roundRect(this.cardWidth / 2 - 38, -this.cardHeight / 2 + 6, 32, 22, 4);
    gfx.fill({ color: 0x1A1400, alpha: 0.9 });
    gfx.stroke({ color: 0xFFF000, width: 1.5, alpha: 0.8 });

    const clockStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xFFF000
    });
    const clockText = new Text({ text: `+${this.data.clock || 1}`, style: clockStyle });
    clockText.anchor.set(0.5);
    clockText.x = this.cardWidth / 2 - 22;
    clockText.y = -this.cardHeight / 2 + 17;
    this.container.addChild(clockText);

    // タイトルテキスト
    const textStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 11,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      align: 'center'
    });
    this.titleText = new Text({ text: this.data.name, style: textStyle });
    this.titleText.anchor.set(0.5);
    this.titleText.x = 0;
    this.titleText.y = -this.cardHeight / 2 + 44;
    this.container.addChild(this.titleText);

    // 説明テキスト
    const descStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 9.5,
      fill: 0xCBD5E1,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: this.cardWidth - 24,
      leading: 2
    });
    this.descText = new Text({ text: this.data.desc, style: descStyle });
    this.descText.anchor.set(0.5, 0);
    this.descText.x = 0;
    this.descText.y = 22;
    this.container.addChild(this.descText);

    // クラスバッジ (カード下部)
    const cardClass = this.data.class || 'NEUTRAL';
    const classStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 8,
      fontWeight: 'bold',
      fill: cardClass === 'SWORDSMAN' ? 0x00F5FF : (cardClass === 'MAGE' ? 0xA855F7 : 0x94A3B8)
    });
    const classBadgeText = new Text({ text: `[${cardClass}]`, style: classStyle });
    classBadgeText.anchor.set(0.5);
    classBadgeText.x = 0;
    classBadgeText.y = this.cardHeight / 2 - 14;
    this.container.addChild(classBadgeText);

    // コストテキスト (左上)
    const costStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
      fontWeight: '900',
      fill: 0x00F5FF
    });
    this.costText = new Text({ text: this.data.cost.toString(), style: costStyle });
    this.costText.anchor.set(0.5);
    this.costText.x = -this.cardWidth / 2 + 18;
    this.costText.y = -this.cardHeight / 2 + 18;
    this.container.addChild(this.costText);
  }

  /** コストテキスト等の再描画 */
  updateCostDisplay(isFree) {
    if (this.costText) {
      this.costText.text = isFree ? '0' : this.data.cost.toString();
      this.costText.style.fill = isFree ? 0xFFF000 : 0x00F5FF;
    }
  }

  /** ホバー状態を開始する */
  setHovered(isHovered) {
    if (this.isDragging) return;
    if (this.isHovered === isHovered) return;
    this.isHovered = isHovered;

    if (isHovered) {
      this.container.zIndex = 100;
      if (this.container.parent) this.container.parent.sortChildren();
      gsap.to(this.container.scale, { x: 1.15, y: 1.15, duration: 0.15, ease: 'power1.out' });
      gsap.to(this.container, { y: this.handY - 45, rotation: 0, duration: 0.15, ease: 'power1.out' });
    } else {
      this.container.zIndex = 1;
      gsap.to(this.container.scale, { x: 1.0, y: 1.0, duration: 0.2, ease: 'power2.out' });
      gsap.to(this.container, { 
        x: this.handX, y: this.handY, rotation: this.handRotation, 
        duration: 0.2, ease: 'power2.out',
        onComplete: () => { if (this.container.parent) this.container.parent.sortChildren(); }
      });
    }
  }

  /** カード1枚1枚の固有ベクターイラスト描画 */
  drawCardArt(gfx, artY, artW, artH) {
    const cardId = this.data.id;
    const type = this.data.type;

    switch (cardId) {
      case 'STRIKE':
        // ネオンピンクの一閃
        gfx.moveTo(-artW / 3, artY + 16);
        gfx.lineTo(artW / 3, artY - 16);
        gfx.stroke({ color: 0xFF007A, width: 4, alpha: 0.9 });
        gfx.circle(0, artY, 12);
        gfx.stroke({ color: 0xFF007A, width: 1.5, alpha: 0.6 });
        break;

      case 'DEFEND':
        // ヘキサゴンシールド
        this.drawPolyHex(gfx, 0, artY, 18, 0x00F5FF, 0.25);
        break;

      case 'OVERCLOCK':
        // ゴールド時計 ＆ 矢印
        gfx.circle(0, artY, 16);
        gfx.stroke({ color: 0xFFF000, width: 2, alpha: 0.9 });
        gfx.moveTo(0, artY);
        gfx.lineTo(0, artY - 10);
        gfx.stroke({ color: 0xFFF000, width: 2, alpha: 0.9 });
        gfx.moveTo(0, artY);
        gfx.lineTo(8, artY);
        gfx.stroke({ color: 0xFFF000, width: 2, alpha: 0.9 });
        break;

      case 'BURST_SCAN':
        // クロスヘア＋スキャン波
        gfx.circle(0, artY, 18);
        gfx.stroke({ color: 0xFF007A, width: 2, alpha: 0.9 });
        gfx.moveTo(-24, artY); gfx.lineTo(24, artY);
        gfx.moveTo(0, artY - 24); gfx.lineTo(0, artY + 24);
        gfx.stroke({ color: 0xFF007A, width: 1, alpha: 0.6 });
        break;

      case 'FIREWALL':
        // ファイアウォール格子 ＆ オレンジ炎
        gfx.rect(-artW / 3, artY - 16, (artW * 2) / 3, 32);
        gfx.fill({ color: 0xFF5500, alpha: 0.2 });
        gfx.stroke({ color: 0xFF5500, width: 2, alpha: 0.9 });
        for (let x = -artW / 3 + 10; x < artW / 3; x += 12) {
          gfx.moveTo(x, artY - 16); gfx.lineTo(x, artY + 16);
          gfx.stroke({ color: 0xFF5500, width: 1, alpha: 0.4 });
        }
        break;

      case 'BUFFER_OVERFLOW':
        // トリプル連続スラッシュ
        for (let i = -1; i <= 1; i++) {
          const offX = i * 14;
          gfx.moveTo(-artW / 4 + offX, artY + 18);
          gfx.lineTo(artW / 4 + offX, artY - 18);
          gfx.stroke({ color: 0xFF007A, width: 2.5, alpha: 0.9 });
        }
        break;

      case 'REBOOT':
        // 循環ループ矢印
        gfx.arc(0, artY, 16, 0, Math.PI * 1.5);
        gfx.stroke({ color: 0x00F5FF, width: 3, alpha: 0.9 });
        gfx.moveTo(16, artY); gfx.lineTo(22, artY - 6);
        gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });
        break;

      case 'OVERLOAD_CHARGE':
        // 強力なパワーアロー
        gfx.moveTo(0, artY + 18);
        gfx.lineTo(0, artY - 18);
        gfx.lineTo(-10, artY - 6);
        gfx.moveTo(0, artY - 18);
        gfx.lineTo(10, artY - 6);
        gfx.stroke({ color: 0xFFF000, width: 3, alpha: 0.95 });
        break;

      case 'SYSTEM_VULN':
        // 警告トライアングル (△)
        gfx.poly([0, artY - 18, 18, artY + 14, -18, artY + 14]);
        gfx.fill({ color: 0xFF007A, alpha: 0.25 });
        gfx.stroke({ color: 0xFF007A, width: 2, alpha: 0.9 });
        gfx.moveTo(0, artY - 4); gfx.lineTo(0, artY + 4);
        gfx.stroke({ color: 0xFF007A, width: 2.5, alpha: 1 });
        gfx.circle(0, artY + 9, 1.5);
        gfx.fill({ color: 0xFF007A });
        break;

      case 'EXPLOIT':
        // 穿つスパイクピン
        gfx.poly([0, artY - 20, 8, artY + 12, -8, artY + 12]);
        gfx.fill({ color: 0xFF007A, alpha: 0.8 });
        break;

      case 'QUICK_SCAN':
        // 高速横スキャン波
        gfx.rect(-artW / 3, artY - 10, (artW * 2) / 3, 20);
        gfx.stroke({ color: 0x00F5FF, width: 1.5, alpha: 0.8 });
        gfx.moveTo(-artW / 3, artY); gfx.lineTo(artW / 3, artY);
        gfx.stroke({ color: 0x00F5FF, width: 3, alpha: 0.95 });
        break;

      case 'MEM_DUMP':
        // メモリチップデータ
        gfx.rect(-16, artY - 14, 32, 28);
        gfx.fill({ color: 0xA855F7, alpha: 0.3 });
        gfx.stroke({ color: 0xA855F7, width: 2, alpha: 0.9 });
        break;

      case 'TEMP_OVERBOOST':
        // パワーライトニングアロー
        gfx.poly([0, artY - 20, 14, artY - 4, 4, artY - 4, 8, artY + 18, -12, artY + 2, -3, artY + 2]);
        gfx.fill({ color: 0xFFF000, alpha: 0.9 });
        break;

      case 'SPIKE_WALL':
        // トゲ付きシールド
        this.drawPolyHex(gfx, 0, artY, 16, 0x00F5FF, 0.3);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          gfx.moveTo(16 * Math.cos(a), artY + 16 * Math.sin(a));
          gfx.lineTo(24 * Math.cos(a), artY + 24 * Math.sin(a));
          gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });
        }
        break;

      case 'DELAYED_SHIELD':
        // 砂時計
        gfx.poly([-14, artY - 16, 14, artY - 16, -14, artY + 16, 14, artY + 16]);
        gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });
        break;

      case 'FORCE_QUIT':
        // 破断マーク [X]
        gfx.rect(-18, artY - 18, 36, 36);
        gfx.fill({ color: 0xFF007A, alpha: 0.3 });
        gfx.stroke({ color: 0xFF007A, width: 2, alpha: 0.9 });
        gfx.moveTo(-12, artY - 12); gfx.lineTo(12, artY + 12);
        gfx.moveTo(12, artY - 12); gfx.lineTo(-12, artY + 12);
        gfx.stroke({ color: 0xFFFFFF, width: 3, alpha: 0.95 });
        break;

      case 'SPARK_FIRE':
        // 火花スパーク
        gfx.circle(0, artY, 12);
        gfx.fill({ color: 0xFF3300, alpha: 0.5 });
        gfx.stroke({ color: 0xFF6600, width: 2, alpha: 0.9 });
        break;

      case 'MANA_SHIELD':
        // マナシールド円環
        gfx.circle(0, artY, 18);
        gfx.stroke({ color: 0xA855F7, width: 2.5, alpha: 0.9 });
        gfx.circle(0, artY, 10);
        gfx.stroke({ color: 0xA855F7, width: 1, alpha: 0.6 });
        break;

      case 'LIGHTNING_BOLT':
        // 稲妻サンダー
        gfx.poly([-4, artY - 20, 8, artY - 2, 0, artY - 2, 6, artY + 20, -8, artY + 2, 0, artY + 2]);
        gfx.fill({ color: 0x00F5FF });
        break;

      case 'MANA_REGEN':
        // マナクリスタル
        gfx.poly([0, artY - 18, 12, artY, 0, artY + 18, -12, artY]);
        gfx.fill({ color: 0xA855F7, alpha: 0.6 });
        gfx.stroke({ color: 0xA855F7, width: 2, alpha: 0.9 });
        break;

      case 'FIRE_BALL':
        // 火炎球
        gfx.circle(0, artY, 16);
        gfx.fill({ color: 0xFF4500, alpha: 0.8 });
        gfx.circle(0, artY, 20);
        gfx.stroke({ color: 0xFFD700, width: 2, alpha: 0.9 });
        break;

      case 'ARCANE_BURST':
        // 全方位魔法星
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          gfx.moveTo(0, artY);
          gfx.lineTo(22 * Math.cos(a), artY + 22 * Math.sin(a));
          gfx.stroke({ color: 0xA855F7, width: 2, alpha: 0.9 });
        }
        break;

      case 'AETHER_BARRIER':
        // 多角形エーテル障壁
        gfx.circle(0, artY, 20);
        gfx.fill({ color: 0xA855F7, alpha: 0.25 });
        gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });
        break;

      case 'WHIRLWIND_SLASH':
      case 'BLADE_STORM':
        // 嵐のスラッシュ
        gfx.circle(0, artY, 18);
        gfx.stroke({ color: 0xFF007A, width: 2, alpha: 0.7 });
        gfx.arc(0, artY, 14, 0, Math.PI * 1.3);
        gfx.stroke({ color: 0xFFF000, width: 3, alpha: 0.9 });
        break;

      case 'CHAIN_LIGHTNING':
        // チェーンライトニング
        gfx.moveTo(-20, artY - 12);
        gfx.lineTo(-6, artY + 12);
        gfx.lineTo(6, artY - 12);
        gfx.lineTo(20, artY + 12);
        gfx.stroke({ color: 0x00F5FF, width: 3, alpha: 0.9 });
        break;

      case 'SUPERNOVA':
        // 超新星
        gfx.circle(0, artY, 10);
        gfx.fill({ color: 0xFFFFFF });
        gfx.circle(0, artY, 20);
        gfx.stroke({ color: 0xFF007A, width: 3, alpha: 0.9 });
        break;

      case 'EMP_WAVE':
        // 電磁波パース波形
        gfx.arc(0, artY + 16, 16, Math.PI * 1.2, Math.PI * 1.8);
        gfx.stroke({ color: 0x00F5FF, width: 2, alpha: 0.9 });
        gfx.arc(0, artY + 16, 26, Math.PI * 1.2, Math.PI * 1.8);
        gfx.stroke({ color: 0x00F5FF, width: 2.5, alpha: 0.7 });
        break;

      case 'SYSTEM_RESTORE':
        // 医療回復(+)クロス
        gfx.rect(-6, artY - 18, 12, 36);
        gfx.rect(-18, artY - 6, 36, 12);
        gfx.fill({ color: 0x00FF88, alpha: 0.85 });
        break;

      case 'OVERHEAL_BARRIER':
      case 'HOLY_COMPILER':
        // シールド＋回復クロス
        this.drawPolyHex(gfx, 0, artY, 16, 0x00FF88, 0.3);
        gfx.rect(-4, artY - 10, 8, 20);
        gfx.rect(-10, artY - 4, 20, 8);
        gfx.fill({ color: 0x00FF88, alpha: 0.9 });
        break;

      default:
        // デフォルト
        if (type === 'attack') {
          gfx.moveTo(-16, artY + 16); gfx.lineTo(16, artY - 16);
          gfx.stroke({ color: 0xFF007A, width: 3, alpha: 0.9 });
        } else if (type === 'skill') {
          this.drawPolyHex(gfx, 0, artY, 16, 0x00F5FF, 0.3);
        } else {
          gfx.circle(0, artY, 14);
          gfx.stroke({ color: 0xFFF000, width: 2, alpha: 0.9 });
        }
        break;
    }
  }

  drawPolyHex(gfx, x, y, r, color, alpha) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      points.push(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    gfx.poly(points);
    gfx.fill({ color: color, alpha: alpha });
    gfx.poly(points);
    gfx.stroke({ color: color, width: 2, alpha: 0.9 });
  }

  /** カードオブジェクトの破棄 */
  destroy() {
    this.container.destroy({ children: true });
  }
}
