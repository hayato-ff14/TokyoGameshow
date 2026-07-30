/**
 * CyberFX.js - ゲーム全体の演出・エフェクト処理
 * 
 * ポップアップ数値、ネオン火花、スクリーンシェイク、
 * 斬撃弧、魔法弾、シールドバリア、地面衝撃波、回復パーティクル
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

export class CyberFX {
  /**
   * @param {Container} fxLayer - エフェクトを描画するレイヤーコンテナ
   */
  constructor(fxLayer) {
    this.layer = fxLayer;
  }

  /** ダメージやシールド値などのポップアップテキストを生成し、上昇して消える演出 */
  spawnPopupText(x, y, text, color = 0xFFFFFF) {
    const textStyle = new TextStyle({
      fontFamily: 'JetBrains Mono',
      fontSize: 18,
      fontWeight: '900',
      fill: color,
      stroke: { color: 0x000000, width: 3 }
    });

    const popup = new Text({ text, style: textStyle });
    popup.anchor.set(0.5);
    popup.x = x;
    popup.y = y;
    this.layer.addChild(popup);

    gsap.timeline()
      .to(popup, { y: y - 50, duration: 0.5, ease: 'power1.out' })
      .to(popup, { alpha: 0, y: y - 80, duration: 0.4, ease: 'power1.in', onComplete: () => {
        popup.destroy();
      }});
  }

  /** ネオンカラーのスパークパーティクルを円形に放出する */
  spawnNeonSparks(x, y, color = 0x00F5FF, count = 15) {
    const container = new Container();
    this.layer.addChild(container);

    const particles = [];
    for (let i = 0; i < count; i++) {
      const p = new Graphics();
      const size = Math.random() * 4 + 2;
      p.rect(-size/2, -size/2, size, size);
      p.fill({ color });
      p.x = x;
      p.y = y;
      
      container.addChild(p);

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 80;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      particles.push({ gfx: p, vx, vy, alpha: 1.0 });
    }

    const ticker = { progress: 0 };
    gsap.to(ticker, {
      progress: 1.0,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => {
        const dt = gsap.ticker.deltaRatio() / 60;
        particles.forEach(p => {
          p.gfx.x += p.vx * dt;
          p.gfx.y += p.vy * dt;
          p.vy += 250 * dt;
          p.gfx.alpha = 1 - ticker.progress;
        });
      },
      onComplete: () => {
        container.destroy({ children: true });
      }
    });
  }

  /** スクリーンシェイク（指定したコンテナを小刻みに揺らす） */
  screenShake(targetContainer, intensity = 8, duration = 0.4) {
    const originalX = targetContainer.x;
    const originalY = targetContainer.y;
    
    const count = Math.floor(duration / 0.05);
    const tl = gsap.timeline({
      onComplete: () => {
        targetContainer.x = originalX;
        targetContainer.y = originalY;
      }
    });

    for (let i = 0; i < count; i++) {
      const dx = (Math.random() - 0.5) * intensity;
      const dy = (Math.random() - 0.5) * intensity;
      tl.to(targetContainer, {
        x: originalX + dx,
        y: originalY + dy,
        duration: 0.05,
        ease: 'none'
      });
    }
  }

  /** オーバークロック発動時のグリッチ調バックグラウンドフラッシュ */
  flashScreen(appWidth, appHeight, color = 0xFFF000) {
    const flash = new Graphics();
    flash.rect(0, 0, appWidth, appHeight);
    flash.fill({ color, alpha: 0.35 });
    this.layer.addChild(flash);

    gsap.timeline()
      .to(flash, { alpha: 0.1, duration: 0.08, repeat: 3, yoyo: true })
      .to(flash, { alpha: 0, duration: 0.2, onComplete: () => {
        flash.destroy();
      }});
  }

  // ═══════════════════════════════════════════════
  // 新エフェクト：カード種別専用
  // ═══════════════════════════════════════════════

  /** 斬撃弧エフェクト（半円弧のスラッシュ線が現れてフェードする） */
  spawnSlashArc(x, y, color = 0xFF007A) {
    const arc = new Graphics();
    // 3本の弧線を重ねて斬撃感を出す
    const arcR = 80;
    arc.arc(0, 0, arcR, -0.8, 0.8);
    arc.stroke({ color, width: 5, alpha: 1.0 });
    arc.arc(0, 0, arcR - 15, -0.6, 0.6);
    arc.stroke({ color, width: 3, alpha: 0.7 });
    arc.arc(0, 0, arcR + 15, -1.0, 1.0);
    arc.stroke({ color, width: 2, alpha: 0.4 });

    arc.x = x;
    arc.y = y;
    arc.rotation = -0.3;
    arc.scale.set(0.3);
    arc.alpha = 0;
    this.layer.addChild(arc);

    gsap.timeline()
      .to(arc, { alpha: 1, duration: 0.05 })
      .to(arc.scale, { x: 1.3, y: 1.3, duration: 0.15, ease: 'power2.out' }, '<')
      .to(arc, { rotation: 0.5, duration: 0.15, ease: 'power2.out' }, '<')
      .to(arc, { alpha: 0, duration: 0.25, delay: 0.1, onComplete: () => arc.destroy() });

    // 斬撃に合わせたスパーク
    this.spawnNeonSparks(x, y, color, 12);
  }

  /** 魔法弾エフェクト（発射元からターゲットに向かって弾が飛ぶ） */
  spawnMagicProjectile(fromX, fromY, toX, toY, color = 0xA855F7) {
    const projectile = new Graphics();
    
    // コア（光球）
    projectile.circle(0, 0, 12);
    projectile.fill({ color, alpha: 0.9 });
    // 外殻グロー
    projectile.circle(0, 0, 20);
    projectile.fill({ color, alpha: 0.25 });
    projectile.circle(0, 0, 8);
    projectile.fill({ color: 0xFFFFFF, alpha: 0.7 });

    projectile.x = fromX;
    projectile.y = fromY;
    this.layer.addChild(projectile);

    // 軌跡パーティクル生成タイマー
    const trailInterval = setInterval(() => {
      if (projectile.destroyed) { clearInterval(trailInterval); return; }
      const trail = new Graphics();
      trail.circle(0, 0, 4 + Math.random() * 4);
      trail.fill({ color, alpha: 0.5 });
      trail.x = projectile.x + (Math.random() - 0.5) * 10;
      trail.y = projectile.y + (Math.random() - 0.5) * 10;
      this.layer.addChild(trail);
      gsap.to(trail, { alpha: 0, duration: 0.3, onComplete: () => trail.destroy() });
      gsap.to(trail.scale, { x: 0.1, y: 0.1, duration: 0.3 });
    }, 30);

    // 飛行アニメーション
    gsap.to(projectile, {
      x: toX, y: toY,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        clearInterval(trailInterval);
        // 着弾時の爆発
        this.spawnNeonSparks(toX, toY, color, 25);
        projectile.destroy();
      }
    });
  }

  /** シールドバリア展開エフェクト（六角形が出現→拡大→消滅） */
  spawnShieldBarrier(x, y) {
    const barrier = new Graphics();
    const hexR = 60;
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      hexPoints.push(hexR * Math.cos(a), hexR * Math.sin(a));
    }
    barrier.poly(hexPoints);
    barrier.fill({ color: 0x00F5FF, alpha: 0.15 });
    barrier.poly(hexPoints);
    barrier.stroke({ color: 0x00F5FF, width: 3, alpha: 0.9 });

    // 内側の小さい六角
    const innerPoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      innerPoints.push(hexR * 0.5 * Math.cos(a), hexR * 0.5 * Math.sin(a));
    }
    barrier.poly(innerPoints);
    barrier.stroke({ color: 0x00F5FF, width: 1.5, alpha: 0.5 });

    barrier.x = x;
    barrier.y = y;
    barrier.scale.set(0.2);
    barrier.alpha = 0;
    this.layer.addChild(barrier);

    gsap.timeline()
      .to(barrier, { alpha: 1, duration: 0.1 })
      .to(barrier.scale, { x: 1.0, y: 1.0, duration: 0.25, ease: 'back.out(2)' }, '<')
      .to(barrier, { alpha: 0, duration: 0.5, delay: 0.3, onComplete: () => barrier.destroy() })
      .to(barrier.scale, { x: 1.3, y: 1.3, duration: 0.5 }, '<');
  }

  /** 地面衝撃波エフェクト（水平に広がるリング＋破片） */
  spawnGroundImpact(x, y, color = 0xFFF000) {
    // 横長の衝撃波リング
    const wave = new Graphics();
    wave.ellipse(0, 0, 20, 8);
    wave.stroke({ color, width: 3, alpha: 0.9 });
    wave.x = x;
    wave.y = y;
    this.layer.addChild(wave);

    gsap.timeline()
      .to(wave.scale, { x: 8, y: 3, duration: 0.4, ease: 'power2.out' })
      .to(wave, { alpha: 0, duration: 0.4, ease: 'power1.in', onComplete: () => wave.destroy() }, '<');

    // 2つ目のリング（遅延）
    const wave2 = new Graphics();
    wave2.ellipse(0, 0, 15, 6);
    wave2.stroke({ color, width: 2, alpha: 0.6 });
    wave2.x = x;
    wave2.y = y;
    this.layer.addChild(wave2);

    gsap.timeline({ delay: 0.1 })
      .to(wave2.scale, { x: 6, y: 2.5, duration: 0.35, ease: 'power2.out' })
      .to(wave2, { alpha: 0, duration: 0.35, ease: 'power1.in', onComplete: () => wave2.destroy() }, '<');

    // 破片パーティクル（上方向）
    for (let i = 0; i < 8; i++) {
      const shard = new Graphics();
      const sw = 3 + Math.random() * 4;
      const sh = 6 + Math.random() * 8;
      shard.rect(-sw/2, -sh/2, sw, sh);
      shard.fill({ color, alpha: 0.8 });
      shard.x = x + (Math.random() - 0.5) * 100;
      shard.y = y;
      shard.rotation = Math.random() * Math.PI;
      this.layer.addChild(shard);

      gsap.to(shard, {
        y: y - 40 - Math.random() * 80,
        x: shard.x + (Math.random() - 0.5) * 60,
        rotation: shard.rotation + Math.random() * 3,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.3,
        ease: 'power1.out',
        onComplete: () => shard.destroy()
      });
    }
  }

  /** 回復パーティクルエフェクト（緑の光粒が下から上へ立ち上る） */
  spawnHealParticles(x, y) {
    const color = 0x00FF88;
    
    for (let i = 0; i < 15; i++) {
      const p = new Graphics();
      const size = 2 + Math.random() * 5;
      p.circle(0, 0, size);
      p.fill({ color, alpha: 0.7 + Math.random() * 0.3 });
      
      p.x = x + (Math.random() - 0.5) * 80;
      p.y = y + 30 + Math.random() * 30;
      this.layer.addChild(p);

      const delay = Math.random() * 0.3;
      
      gsap.to(p, {
        y: y - 60 - Math.random() * 60,
        x: p.x + (Math.random() - 0.5) * 40,
        alpha: 0,
        duration: 0.8 + Math.random() * 0.4,
        delay,
        ease: 'power1.out',
        onComplete: () => p.destroy()
      });
      gsap.to(p.scale, {
        x: 0.2, y: 0.2,
        duration: 0.8 + Math.random() * 0.4,
        delay,
        ease: 'power1.in'
      });
    }

    // 中心に一瞬光るフラッシュリング
    const ring = new Graphics();
    ring.circle(0, 0, 30);
    ring.stroke({ color, width: 2, alpha: 0.8 });
    ring.x = x;
    ring.y = y;
    ring.scale.set(0.5);
    this.layer.addChild(ring);

    gsap.timeline()
      .to(ring.scale, { x: 1.5, y: 1.5, duration: 0.3, ease: 'power2.out' })
      .to(ring, { alpha: 0, duration: 0.3, onComplete: () => ring.destroy() }, '<');
  }

  // ═══════════════════════════════════════════════
  // メイジ専用：絵柄＆カード名にちなんだ専用魔法演出
  // ═══════════════════════════════════════════════

  /** SUPERNOVA (超新星爆発): 全画面中央で黄金プラズマコアが急速膨張して超新星ブラスト爆散 */
  spawnSupernovaEffect(centerX = 1470, centerY = 480) {
    const core = new Graphics();
    core.circle(0, 0, 15); core.fill({ color: 0xFFFFFF });
    core.circle(0, 0, 30); core.fill({ color: 0xFFD700, alpha: 0.8 });
    core.circle(0, 0, 50); core.fill({ color: 0xFF007A, alpha: 0.4 });
    core.x = centerX; core.y = centerY; core.scale.set(0.1);
    this.layer.addChild(core);

    // 超新星衝撃波リング
    const blast = new Graphics();
    blast.circle(0, 0, 40); blast.stroke({ color: 0xFFD700, width: 6, alpha: 1.0 });
    blast.circle(0, 0, 60); blast.stroke({ color: 0x00F5FF, width: 3, alpha: 0.7 });
    blast.x = centerX; blast.y = centerY; blast.scale.set(0.1);
    this.layer.addChild(blast);

    gsap.timeline()
      .to(core.scale, { x: 3.5, y: 3.5, duration: 0.25, ease: 'power3.out' })
      .to(blast.scale, { x: 7.0, y: 7.0, duration: 0.4, ease: 'power2.out' }, '<')
      .to(core, { alpha: 0, duration: 0.3, onComplete: () => core.destroy() }, '+=0.05')
      .to(blast, { alpha: 0, duration: 0.35, onComplete: () => blast.destroy() }, '<');

    this.spawnNeonSparks(centerX, centerY, 0xFFD700, 30);
  }

  /** CHAIN_LIGHTNING (チェインライトニング): 発射元から生存敵へジグザグのサンダービームが連鎖 */
  spawnChainLightningEffect(fromX, fromY, enemySprites = []) {
    let curX = fromX;
    let curY = fromY;

    enemySprites.forEach((sprite, idx) => {
      const toX = sprite.container.x;
      const toY = sprite.container.y;

      const beam = new Graphics();
      const segments = 6;
      beam.moveTo(curX, curY);

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const bx = curX + (toX - curX) * t + (Math.random() - 0.5) * 35;
        const by = curY + (toY - curY) * t + (Math.random() - 0.5) * 35;
        beam.lineTo(bx, by);
      }
      beam.lineTo(toX, toY);
      beam.stroke({ color: 0x00F5FF, width: 4, alpha: 1.0 });
      beam.stroke({ color: 0xFFFFFF, width: 2, alpha: 1.0 });
      this.layer.addChild(beam);

      gsap.timeline({ delay: idx * 0.08 })
        .to(beam, { alpha: 0, duration: 0.3, onComplete: () => beam.destroy() });

      this.spawnNeonSparks(toX, toY, 0x00F5FF, 12);
      curX = toX; curY = toY;
    });
  }

  /** EMP_WAVE (EMPパルス): メイジ足元から全方位へ同心円状の立体紫パルス波が拡散 */
  spawnEMPWaveEffect(x, y) {
    for (let i = 0; i < 3; i++) {
      const pulse = new Graphics();
      pulse.ellipse(0, 0, 30, 12);
      pulse.stroke({ color: 0xA855F7, width: 4, alpha: 0.9 });
      pulse.ellipse(0, 0, 45, 18);
      pulse.stroke({ color: 0x00F5FF, width: 2, alpha: 0.6 });
      pulse.x = x; pulse.y = y; pulse.scale.set(0.2);
      this.layer.addChild(pulse);

      gsap.timeline({ delay: i * 0.1 })
        .to(pulse.scale, { x: 12, y: 5, duration: 0.5, ease: 'power2.out' })
        .to(pulse, { alpha: 0, duration: 0.5, onComplete: () => pulse.destroy() }, '<');
    }
  }
}
