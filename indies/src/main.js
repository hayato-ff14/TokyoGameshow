/**
 * main.js - OVERCLOCK / OVERLOAD メインエントリーポイント
 * 
 * シーン遷移: TITLE -> CHARACTER_SELECT -> MAP -> COMBAT / SHOP / EVENT
 */

import { Application, Container, Graphics, Sprite, Texture, Text, Assets } from 'pixi.js';
import { BloomFilter } from 'pixi-filters';
import { gsap } from 'gsap';
import { DeckManager, CARD_DEFS, getAvailableCardsForCharacter } from './core/DeckManager.js';
import { CombatEngine } from './core/CombatEngine.js';
import { EnemyAI } from './core/EnemyAI.js';
import { CardSprite } from './objects/CardSprite.js';
import { EntitySprite } from './objects/EntitySprite.js';
import { CyberFX } from './fx/CyberFX.js';
import { CHARACTER_DEFS } from './core/CharacterData.js';
import { getAugmentsForCharacter, getAugmentSelectionPool } from './core/AugmentData.js';
import { AudioManager } from './core/AudioManager.js';
import './styles/main.css';

// Service Worker の強力な古いキャッシュを自動アンインストールして最新コードを読み込ませる
// Service Worker の強力な古いキャッシュを自動アンインストールして最新コードを読み込ませる
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

// グローバルエラーハンドラ（画面を止めずコンソールログで安全に管理）
window.onerror = function(message, source, lineno, colno, error) {
  console.error(`[UNHANDLED ERROR] ${message} at ${source}:${lineno}:${colno}`, error);
  return true; // エラーのブラウザ伝播を抑止し画面フリーズを防止
};

const BASE_W = 1920;
const BASE_H = 1080;
const BG_COLOR = 0x050508;

(async () => {
  // ══════════════════════════════════════════════
  // PixiJS アプリの初期化
  // ══════════════════════════════════════════════
  const app = new Application();
  await app.init({
    background: BG_COLOR,
    width: BASE_W,
    height: BASE_H,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  document.getElementById('game-container').appendChild(app.canvas);

  // メインコンテナとスケール調整
  const worldContainer = new Container();
  worldContainer.sortableChildren = true;
  app.stage.addChild(worldContainer);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (app.renderer) {
      app.renderer.resize(w, h);
    }
    const scale = Math.min(w / BASE_W, h / BASE_H);
    worldContainer.scale.set(scale);
    worldContainer.x = (w - BASE_W * scale) / 2;
    worldContainer.y = (h - BASE_H * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  // 各種表示レイヤーのセットアップと明確なz-index割り当て
  const bgLayer = new Container();
  bgLayer.zIndex = 10;
  bgLayer.sortableChildren = true;

  const entityLayer = new Container();
  entityLayer.zIndex = 20;
  entityLayer.sortableChildren = true;

  const cardLayer = new Container();
  cardLayer.zIndex = 30;
  cardLayer.sortableChildren = true;

  const fxLayer = new Container();
  fxLayer.zIndex = 40;

  worldContainer.addChild(bgLayer);
  worldContainer.addChild(entityLayer);
  worldContainer.addChild(cardLayer);
  worldContainer.addChild(fxLayer);
  worldContainer.sortChildren();

  // ══════════════════════════════════════════════
  // グローバルゲーム状態
  // ══════════════════════════════════════════════
  let selectedCharacter = null;
  let playerGold = 100;
  let currentDepth = 0;
  let currentAct = 1;
  let currentNodeId = null;
  let mapGrid = [];
  let playerSprite = null;
  let enemySprites = [];
  let cardSprites = [];
  let currentEvent = null;
  let currentScene = 'TITLE';

  // コアシステムオブジェクトの生成
  const deckManager = new DeckManager();
  const combatEngine = new CombatEngine(deckManager);
  const fx = new CyberFX(fxLayer);
  const audioManager = new AudioManager();

  // ══════════════════════════════════════════════
  // DOM 要素の参照
  // ══════════════════════════════════════════════
  const titleScreen = document.getElementById('title-screen');
  const charselectScreen = document.getElementById('charselect-screen');
  const hudOverlay = document.getElementById('hud-overlay');
  const mapScreen = document.getElementById('map-screen');
  const shopScreen = document.getElementById('shop-screen');
  const eventScreen = document.getElementById('event-screen');

  // ══════════════════════════════════════════════
  // シーン管理 & 画面遷移
  // ══════════════════════════════════════════════
  const restScreen = document.getElementById('rest-screen');

  function showScene(scene) {
    currentScene = scene;

    // 全てのオーバーレイを非表示
    titleScreen.style.display = 'none';
    charselectScreen.style.display = 'none';
    mapScreen.style.display = 'none';
    shopScreen.style.display = 'none';
    eventScreen.style.display = 'none';
    if (restScreen) restScreen.style.display = 'none';

    // すべてのモーダルダイアログを強制的かつ確実に非表示化
    const dr = document.getElementById('draft-overlay'); if (dr) dr.style.display = 'none';
    const go = document.getElementById('gameover-overlay'); if (go) go.style.display = 'none';
    const at = document.getElementById('area-transition-overlay'); if (at) at.style.display = 'none';

    // アニメーションフェードアウトクラスの削除
    titleScreen.classList.remove('screen-fade-out');
    charselectScreen.classList.remove('screen-fade-out');

    if (scene === 'COMBAT') {
      hudOverlay.style.display = 'block';
      worldContainer.visible = true;
    } else {
      hudOverlay.style.display = 'none';
      worldContainer.visible = false;
    }

    switch (scene) {
      case 'TITLE':
        titleScreen.style.display = 'flex';
        break;
      case 'CHARACTER_SELECT':
        charselectScreen.style.display = 'flex';
        populateCharacterSelect();
        break;
      case 'MAP':
        mapScreen.style.display = 'flex';
        renderMap();
        break;
      case 'SHOP':
        shopScreen.style.display = 'flex';
        openShopUI();
        break;
      case 'EVENT':
        eventScreen.style.display = 'flex';
        openEventUI();
        break;
      case 'REST':
        if (restScreen) restScreen.style.display = 'flex';
        openRestUI();
        break;
      case 'COMBAT':
        // 戦闘時はHUDとPixiJSのみ表示
        break;
    }
  }

  function goToCharacterSelect() {
    showScene('CHARACTER_SELECT');
  }

  function goBackToTitle() {
    showScene('TITLE');
  }

  function goToMap(characterData) {
    selectedCharacter = characterData;
    playerGold = 100;
    currentDepth = 0;
    currentAct = 1;
    currentNodeId = null;
    deckManager.initializeMasterDeck(characterData.startingDeck);
    generateMap();
    showScene('MAP');
  }

  function goToCombat(nodeId) {
    currentNodeId = nodeId;
    const node = findNodeById(nodeId);
    if (node) currentDepth = node.depth;

    showScene('COMBAT');

    if (node && node.type === 'boss') {
      startBossCombat();
    } else if (node && node.type === 'elite') {
      startEliteCombat(nodeId);
    } else {
      startNormalCombat();
    }
  }

  function returnToTitle() {
    cleanupCombat();
    combatEngine.fullReset();
    showScene('TITLE');
  }

  // ══════════════════════════════════════════════
  // キャラクター選択
  // ══════════════════════════════════════════════
  function showAugmentSelectionUI(charId, onSelect) {
    const overlay = document.getElementById('augment-overlay');
    const container = document.getElementById('augment-cards-container');
    if (!overlay || !container) {
      if (onSelect) onSelect();
      return;
    }

    container.innerHTML = '';
    const activeIds = (combatEngine.activeAugments || []).map(a => a.id);
    const pool = getAugmentSelectionPool(charId, activeIds);

    if (pool.length === 0) {
      if (onSelect) onSelect();
      return;
    }

    pool.forEach(aug => {
      const cardEl = document.createElement('div');
      cardEl.className = 'augment-card-ui glass';
      cardEl.style.borderColor = aug.color;

      const actNum = (combatEngine.activeAugments?.length || 0) + 1;

      cardEl.innerHTML = `
        <div class="augment-tier-badge" style="background: ${aug.color};">
          AREA 0${actNum} PROTOCOL
        </div>
        <div class="augment-icon">${aug.icon}</div>
        <h3 class="augment-name" style="color: ${aug.color};">${aug.name}</h3>
        <div class="augment-title">${aug.title}</div>
        <p class="augment-desc">${aug.desc}</p>
        <button class="btn-neon augment-select-btn" style="border-color: ${aug.color}; color: ${aug.color}; margin-top: 12px; font-size: 11px;">
          EQUIP HERO PROTOCOL
        </button>
      `;

      cardEl.addEventListener('click', () => {
        audioManager.playSfx('overclock');
        combatEngine.addAugment(aug);
        overlay.style.display = 'none';
        updateHUD();
        if (onSelect) onSelect();
      });

      container.appendChild(cardEl);
    });

    overlay.style.display = 'flex';
  }

  function populateCharacterSelect() {
    const grid = document.getElementById('charselect-grid');
    grid.innerHTML = '';

    CHARACTER_DEFS.forEach(char => {
      const card = document.createElement('div');
      card.className = 'char-card glass';
      
      const colorHex = '#' + char.color.toString(16).padStart(6, '0');
      const accentHex = '#' + char.accentColor.toString(16).padStart(6, '0');
      card.style.borderColor = colorHex;

      card.innerHTML = `
        <div class="char-avatar-container">
          <img src="${char.avatarUrl}" class="char-avatar-img" alt="${char.name}" />
          <div class="char-icon-badge" style="color: ${accentHex}; text-shadow: 0 0 10px ${accentHex}; border-color: ${accentHex};">
            ${char.icon === 'sword' ? '⚔' : (char.icon === 'staff' ? '🔮' : '⚙')}
          </div>
        </div>
        <h3 class="char-name" style="color: ${colorHex};">${char.name}</h3>
        <p class="char-title">${char.title}</p>
        <p class="char-desc" style="white-space: pre-line;">${char.description}</p>
        <div class="char-stats">
          <span>MAX HP: ${char.maxHP}</span>
          <span>DECK: ${char.startingDeck.length} CODES</span>
        </div>
      `;

      card.addEventListener('click', () => {
        audioManager.playSfx('click');
        showAugmentSelectionUI(char.id, () => {
          goToMap(char);
        });
      });

      grid.appendChild(card);
    });
  }

  // ══════════════════════════════════════════════
  // コアエンジンのコールバック紐付け
  // ══════════════════════════════════════════════

  // ドローイベント
  combatEngine.onCardDraw = (cardData) => {
    audioManager.playSfx('card_draw');
    syncHandSprites();
  };

  // カードプレイイベント（カード種別ごとの専用アニメーション ＆ SE再生）
  const AOE_CARD_IDS_FX = ['BUFFER_OVERFLOW', 'WHIRLWIND_SLASH', 'BLADE_STORM', 'CHAIN_LIGHTNING', 'SUPERNOVA', 'EMP_WAVE'];
  const HEAL_CARD_IDS = ['SYSTEM_RESTORE', 'OVERHEAL_BARRIER', 'HOLY_COMPILER'];
  
  combatEngine.onCardPlay = (cardData) => {
    if (!playerSprite) { updateHUD(); return; }

    // ターゲット座標の取得
    let targetX = 1470;
    let targetY = 480;
    const targetSprite = enemySprites.find(s => s.targeted && s.core.hp > 0);
    if (targetSprite) {
      targetX = targetSprite.container.x;
      targetY = targetSprite.container.y;
    } else {
      const alive = enemySprites.find(s => s.core.hp > 0);
      if (alive) {
        targetX = alive.container.x;
        targetY = alive.container.y;
      }
    }

    const px = playerSprite.container.x;
    const py = playerSprite.container.y;
    const isSwordsman = selectedCharacter?.id === 'SWORDSMAN';

    if (HEAL_CARD_IDS.includes(cardData.id)) {
      // ═══ 回復カード ═══
      audioManager.playSfx('heal');
      playerSprite.playHealAnim();
      fx.spawnHealParticles(px, py);

    } else if (AOE_CARD_IDS_FX.includes(cardData.id)) {
      // ═══ AOE全体攻撃カード ═══
      if (isSwordsman) {
        audioManager.playSfx('slash');
        playerSprite.playWhirlwindSpinAnim();
      } else {
        audioManager.playSfx('magic');
        playerSprite.playSpellSurgeAnim();
      }

      if (cardData.id === 'SUPERNOVA') {
        // 超新星爆発: 全画面中央で黄金プラズマ球体が急速膨張！
        audioManager.playSfx('overclock');
        fx.spawnSupernovaEffect(1470, 480);
        fx.screenShake(worldContainer, 8, 0.4);
      } else if (cardData.id === 'CHAIN_LIGHTNING') {
        // 連鎖雷撃: プレイヤーの手から全敵へジグザグサンダーが駆け巡る！
        audioManager.playSfx('magic');
        const aliveSprites = enemySprites.filter(s => s.core.hp > 0);
        fx.spawnChainLightningEffect(px + 40, py - 30, aliveSprites);
        fx.screenShake(worldContainer, 5, 0.25);
      } else if (cardData.id === 'EMP_WAVE') {
        // EMPパルス: プレイヤー足元から同心円状の立体パルス波が拡散！
        audioManager.playSfx('overclock');
        fx.spawnEMPWaveEffect(px, py + 40);
        fx.screenShake(worldContainer, 6, 0.3);
      } else {
        // 剣士用AOE (BUFFER_OVERFLOW / WHIRLWIND_SLASH 等): 衝撃波 ＋ 全体震動
        enemySprites.filter(s => s.core.hp > 0).forEach(s => {
          setTimeout(() => {
            fx.spawnGroundImpact(s.container.x, s.container.y + 50, 0xFFF000);
            fx.spawnNeonSparks(s.container.x, s.container.y, 0xFF007A, 15);
          }, 200);
        });
        setTimeout(() => {
          fx.screenShake(worldContainer, 6, 0.3);
        }, 180);
      }

    } else if (cardData.type === 'attack') {
      // ═══ 単体攻撃カード（技の軽重・属性によりモーション分岐） ═══
      const isFastAttack = cardData.cost <= 0 || cardData.id.includes('QUICK') || cardData.id.includes('EXPLOIT');
      const isHeavyAttack = cardData.cost >= 2 || cardData.id.includes('HEAVY') || cardData.id.includes('STRIKE');

      if (isSwordsman) {
        audioManager.playSfx('slash');
        if (isFastAttack) {
          // 高速刺突・疾走一閃
          playerSprite.playQuickThrustAnim();
          setTimeout(() => {
            fx.spawnSlashArc(targetX, targetY, 0x00F5FF);
          }, 90);
        } else if (isHeavyAttack) {
          // 跳躍叩きつけ重撃
          playerSprite.playHeavySlamAnim();
          setTimeout(() => {
            fx.spawnSlashArc(targetX, targetY, 0xFF007A);
            fx.spawnGroundImpact(targetX, targetY + 30, 0xFF007A);
          }, 260);
        } else {
          // 通常一閃
          playerSprite.playQuickThrustAnim();
          setTimeout(() => {
            fx.spawnSlashArc(targetX, targetY, 0xFF007A);
          }, 150);
        }
      } else {
        // メイジ：魔術波スペル
        audioManager.playSfx('magic');
        playerSprite.playSpellSurgeAnim();
        setTimeout(() => {
          fx.spawnMagicProjectile(px + 60, py - 20, targetX, targetY, 0xA855F7);
        }, 280);
      }

    } else if (cardData.type === 'skill') {
      // ═══ スキルカード（シールド / ハックユーティリティ） ═══
      if (cardData.id.includes('SCAN') || cardData.id.includes('DRAW') || cardData.id.includes('RECYCLE')) {
        // ハック・スキャンステーション演出
        audioManager.playSfx('card_draw');
        playerSprite.playScanHackAnim();
        fx.spawnNeonSparks(px + 40, py - 20, 0x00F5FF, 16);
      } else {
        // シールド防御姿勢
        audioManager.playSfx('shield');
        playerSprite.playBarrierLockAnim();
        fx.spawnShieldBarrier(px + 30, py);
        fx.spawnNeonSparks(px, py, 0x00F5FF, 14);
      }

    } else {
      // ═══ パワー・バフカード ═══
      audioManager.playSfx('overclock');
      playerSprite.playPowerUpAnim();
      fx.spawnNeonSparks(px, py - 20, 0xFFF000, 30);
    }

    updateHUD();
  };

  // プレイヤー被弾イベント
  combatEngine.onPlayerDamage = (amount) => {
    audioManager.playSfx('attack');
    if (playerSprite) {
      playerSprite.playDamageAnim();
      fx.spawnPopupText(playerSprite.container.x, playerSprite.container.y - 60, `-${amount}`, 0xFF007A);
      fx.screenShake(worldContainer, 10, 0.4);
    }
    updateHUD();
  };

  // プレイヤー回復イベント
  combatEngine.onPlayerHeal = (amount) => {
    audioManager.playSfx('heal');
    if (playerSprite) {
      playerSprite.playHealAnim();
      fx.spawnPopupText(playerSprite.container.x, playerSprite.container.y - 60, `+${amount} HP`, 0x00FF88);
      fx.spawnHealParticles(playerSprite.container.x, playerSprite.container.y);
    }
    updateHUD();
  };

  // 敵被弾イベント
  combatEngine.onEnemyDamage = (amount, enemy) => {
    const sprite = enemySprites.find(s => s.core.instanceId === enemy.instanceId);
    if (sprite) {
      sprite.playDamageAnim();
      fx.spawnPopupText(sprite.container.x, sprite.container.y - 60, `-${amount}`, 0xFFFFFF);
      fx.spawnNeonSparks(sprite.container.x, sprite.container.y, 0xFF007A, 12);

      if (enemy.hp <= 0) {
        sprite.playDeathAnim(() => {
          const idx = enemySprites.indexOf(sprite);
          if (idx !== -1) enemySprites.splice(idx, 1);
          sprite.destroy();
        });
      } else {
        sprite.updateHUD();
      }
    }
    updateHUD();
  };

  // オーバークロックトリガーイベント
  combatEngine.onOverclockTrigger = (isPending = false) => {
    audioManager.playSfx('overclock');
    const banner = document.getElementById('battle-banner');
    const octType = selectedCharacter?.overclockType;

    if (isPending) {
      banner.textContent = "OVERCLOCK PENDING...";
      banner.className = "battle-banner pending active";
      fx.flashScreen(BASE_W, BASE_H, 0xFFF000);
    } else {
      if (octType === 'vampiricBurst') {
        banner.textContent = "OVERCLOCK ACTIVE (DAMAGE x2 & 30% DAMAGE DRAIN!)";
        banner.className = "battle-banner active";
        fx.flashScreen(BASE_W, BASE_H, 0xFF007A);
      } else if (octType === 'doubleEffect') {
        banner.textContent = "OVERCLOCK ACTIVE (ALL CARD EFFECTS x2!)";
        banner.className = "battle-banner active";
        fx.flashScreen(BASE_W, BASE_H, 0xA855F7);
      } else {
        banner.textContent = "OVERCLOCK ACTIVE (COST: 0)";
        banner.className = "battle-banner active";
        fx.flashScreen(BASE_W, BASE_H, 0x00F5FF);
        // 手札スプライトの表示コストを0に同期
        cardSprites.forEach(sprite => sprite.updateCostDisplay(true));
      }
    }

    setTimeout(() => {
      banner.className = "battle-banner";
    }, 2000);
  };

  // パッシブ発動イベント
  combatEngine.onPassiveTrigger = (passive, val) => {
    if (playerSprite) {
      if (passive.trigger === 'berserkVampire') {
        fx.spawnPopupText(playerSprite.container.x, playerSprite.container.y - 120, `+${val} HP (VAMPIRIC)`, 0x00FF88);
        fx.spawnHealParticles(playerSprite.container.x, playerSprite.container.y);
      } else {
        fx.spawnPopupText(playerSprite.container.x, playerSprite.container.y - 120, `${passive.name} (x${val})`, 0xFFF000);
        fx.spawnNeonSparks(playerSprite.container.x, playerSprite.container.y, 0xFFF000, 10);
      }
    }
    updateHUD();
  };

  // 戦闘状態変更イベント (完全フォールバック保護)
  combatEngine.onStateChange = (state, playerWon) => {
    try {
      if (state === 'GAMEOVER') {
        const go = document.getElementById('gameover-overlay');
        if (go) go.style.display = 'flex';
      } else if (state === 'COMBAT_END') {
        if (playerWon) {
          const currentNode = findNodeById(currentNodeId);
          if (currentNode && currentNode.type === 'boss') {
            onCombatVictoryCleanUp();
          } else {
            showDraftOverlay();
          }
        } else {
          const go = document.getElementById('gameover-overlay');
          if (go) go.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error("onStateChange error:", err);
      if (playerWon) {
        onCombatVictoryCleanUp();
      } else {
        const go = document.getElementById('gameover-overlay');
        if (go) go.style.display = 'flex';
      }
    }
  };

  // ══════════════════════════════════════════════
  // HUD描画 & 手札並び替え
  // ══════════════════════════════════════════════
  // ══════════════════════════════════════════════
  // Dynamic Neon City Background Engine (Safe & Protected)
  // ══════════════════════════════════════════════
  function drawBattleBackground() {
    bgLayer.removeChildren();

    try {
      // 追加のサイバーグリッド床＆アンビエントネオングロー
      const floorGrid = new Graphics();
      floorGrid.ellipse(BASE_W / 2, 750, 850, 180);
      floorGrid.fill({ color: 0x00F5FF, alpha: 0.05 });
      floorGrid.stroke({ color: 0x00F5FF, width: 2, alpha: 0.3 });

      floorGrid.ellipse(BASE_W / 2, 750, 500, 100);
      floorGrid.stroke({ color: 0xFF007A, width: 1.5, alpha: 0.4 });
      bgLayer.addChild(floorGrid);

      // パルスアニメーション
      gsap.to(floorGrid, {
        alpha: 0.7,
        duration: 2.0,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      // 非同期アセット読み込みによる背景スプライトの追加
      Assets.load('/assets/cyber_battle_bg.png').then((texture) => {
        if (texture && !bgLayer.destroyed) {
          const bgSprite = new Sprite(texture);
          bgSprite.width = BASE_W;
          bgSprite.height = BASE_H;
          bgLayer.addChildAt(bgSprite, 0);
        }
      }).catch(e => {
        console.error("Error loading battle background texture:", e);
      });
    } catch (e) {
      console.error("Error drawing battle background:", e);
    }
  }

  function updateHUD() {
    document.getElementById('hud-round').textContent = `エリア${currentAct}-${currentDepth}`;
    document.getElementById('hud-memory').textContent = `${combatEngine.memory}/${combatEngine.maxMemory}`;
    document.getElementById('hud-hp').textContent = `${combatEngine.playerHP}/${combatEngine.playerMaxHP}`;

    const ratio = Math.max(0, Math.min(1, combatEngine.currentClock / combatEngine.clockMax));
    document.getElementById('hud-clock-fill').style.width = `${ratio * 100}%`;
    document.getElementById('hud-clock-text').textContent = `${combatEngine.currentClock}/${combatEngine.clockMax}`;

    let passiveText = '---';
    if (combatEngine.characterData && combatEngine.characterData.passive) {
      const passive = combatEngine.characterData.passive;
      if (passive.trigger === 'berserkVampire') {
        const bStr = combatEngine.getBerserkStrength();
        passiveText = `${passive.name} (STR +${bStr})`;
      } else if (passive.trigger === 'onSkillCardEvery2') {
        const count = combatEngine.hexSkillCount || 0;
        passiveText = `${passive.name} (STR +${combatEngine.playerStrength}) [${count}/2]`;
      } else if (passive.maxStacks === Infinity) {
        passiveText = `${passive.name}`;
      } else {
        passiveText = `${passive.name} (${combatEngine.passiveStacks}/${passive.maxStacks})`;
      }
    }
    if (combatEngine.activeAugments && combatEngine.activeAugments.length > 0) {
      const augText = combatEngine.activeAugments.map(a => `[${a.icon} ${a.name}]`).join(' ');
      passiveText += ` | ${augText}`;
    } else if (combatEngine.activeAugment) {
      passiveText += ` | [${combatEngine.activeAugment.icon} ${combatEngine.activeAugment.name}]`;
    }
    document.getElementById('hud-passive').textContent = passiveText;

    document.getElementById('deck-count').textContent = deckManager.drawPile.length;
    document.getElementById('discard-count').textContent = deckManager.discardPile.length;

    if (playerSprite) playerSprite.updateHUD();
    enemySprites.forEach(sprite => sprite.updateHUD());
  }

  function layoutHand() {
    const count = cardSprites.length;
    if (count === 0) return;

    const maxSpread = 750;
    const spacing = Math.min(125, maxSpread / (count - 1 || 1));
    const startX = BASE_W / 2 - (spacing * (count - 1)) / 2;
    const centerY = 940;

    cardSprites.forEach((sprite, idx) => {
      if (sprite.isDragging) return;

      const x = startX + idx * spacing;
      const offsetFromCenter = idx - (count - 1) / 2;
      const y = centerY + Math.abs(offsetFromCenter) * 8;
      const rotation = offsetFromCenter * 0.06;

      sprite.handX = x;
      sprite.handY = y;
      sprite.handRotation = rotation;

      sprite.container.zIndex = idx;

      gsap.to(sprite.container, {
        x: x,
        y: y,
        rotation: rotation,
        duration: 0.35,
        ease: 'power2.out'
      });
    });
    cardLayer.sortChildren();
  }

  // ══════════════════════════════════════════════
  // 分岐マップ生成 & 描画 (ルート制限付き)
  // ══════════════════════════════════════════════
  // ══════════════════════════════════════════════
  // 分岐マップ生成 & 描画 (ランダムプロシージャル分岐)
  // ══════════════════════════════════════════════
  function generateMap() {
    mapGrid = [];

    // エリア(currentAct)が進むほどノード数が増えてマップがより重層化
    const minNodes = currentAct === 1 ? 2 : 3;
    const maxNodes = currentAct === 1 ? 4 : 4;

    // 階層1〜5の生成
    for (let d = 1; d <= 5; d++) {
      const floorNodes = [];
      let nodeCount = Math.floor(Math.random() * (maxNodes - minNodes + 1)) + minNodes;
      if (d === 1) nodeCount = Math.floor(Math.random() * 2) + 2; // 階層1: 2〜3個
      if (d === 5) nodeCount = Math.floor(Math.random() * 2) + 2; // 階層5(ボス直前): 2〜3個

      for (let i = 0; i < nodeCount; i++) {
        let type = 'battle';

        if (d === 1) {
          type = (Math.random() < 0.25) ? 'event' : 'battle';
        } else if (d === 5) {
          // ボス直前階層は必ず休息所(REST)または闇市(SHOP)
          type = (i % 2 === 0) ? 'rest' : 'shop';
        } else {
          // 中間階層 (2, 3, 4): 重み付けランダム
          const roll = Math.random();
          if (roll < 0.35) {
            type = 'battle';
          } else if (roll < 0.55) {
            type = 'elite';
          } else if (roll < 0.75) {
            type = 'event';
          } else if (roll < 0.88) {
            type = 'shop';
          } else {
            type = 'rest';
          }
        }

        floorNodes.push({
          id: `node_${d}_${i}`,
          depth: d,
          index: i,
          type: type,
          cleared: false,
          connections: []
        });
      }
      mapGrid.push(floorNodes);
    }

    // 階層6: ボス
    mapGrid.push([{
      id: 'node_6_0',
      depth: 6,
      index: 0,
      type: 'boss',
      cleared: false,
      connections: []
    }]);

    // 階層間の枝分かれコネクション生成 (完全ランダムかつ孤立不可のプロシージャルリンク)
    for (let f = 0; f < mapGrid.length - 1; f++) {
      const currentFloor = mapGrid[f];
      const nextFloor = mapGrid[f + 1];

      // 1. 各現ノードから、次階層の対応する相対位置に1〜2本の接続を作成
      currentFloor.forEach((node) => {
        node.connections = [];
        const ratio = currentFloor.length > 1 ? node.index / (currentFloor.length - 1) : 0.5;

        nextFloor.forEach((nextNode) => {
          const nextRatio = nextFloor.length > 1 ? nextNode.index / (nextFloor.length - 1) : 0.5;
          const diff = Math.abs(ratio - nextRatio);
          if (diff <= 0.6) {
            if (diff <= 0.35 || Math.random() < 0.5) {
              node.connections.push(nextNode.index);
            }
          }
        });

        // 接続数最低1つ確保
        if (node.connections.length === 0) {
          let closestIdx = 0;
          let minDiff = 999;
          nextFloor.forEach((nextNode) => {
            const nextRatio = nextFloor.length > 1 ? nextNode.index / (nextFloor.length - 1) : 0.5;
            const diff = Math.abs(ratio - nextRatio);
            if (diff < minDiff) {
              minDiff = diff;
              closestIdx = nextNode.index;
            }
          });
          node.connections.push(closestIdx);
        }
      });

      // 2. 次階層の全ノードに対して、前階層からの接続保証（孤立ノード防止）
      nextFloor.forEach((nextNode) => {
        const isConnected = currentFloor.some(node => node.connections.includes(nextNode.index));
        if (!isConnected) {
          const nextRatio = nextFloor.length > 1 ? nextNode.index / (nextFloor.length - 1) : 0.5;
          let closestNode = currentFloor[0];
          let minDiff = 999;
          currentFloor.forEach(node => {
            const ratio = currentFloor.length > 1 ? node.index / (currentFloor.length - 1) : 0.5;
            const diff = Math.abs(ratio - nextRatio);
            if (diff < minDiff) {
              minDiff = diff;
              closestNode = node;
            }
          });
          if (!closestNode.connections.includes(nextNode.index)) {
            closestNode.connections.push(nextNode.index);
          }
        }
      });
    }
  }

  function findNodeById(id) {
    for (let f = 0; f < mapGrid.length; f++) {
      const node = mapGrid[f].find(n => n.id === id);
      if (node) return node;
    }
    return null;
  }

  function renderMap() {
    if (!mapGrid || mapGrid.length === 0) {
      generateMap();
    }

    try {
      const mapSubtitle = document.querySelector('.map-subtitle');
      if (mapSubtitle) {
        mapSubtitle.innerHTML = `アクセスする電脳ノードを選択してください（<span style="color: #00F5FF; font-weight: bold;">エリア ${currentAct}</span> — 階層: <span id="map-depth-text">${currentDepth === 0 ? "1" : Math.min(6, currentDepth + 1)}</span>/6）`;
      }

      const goldText = document.getElementById('map-gold-value');
      if (goldText) goldText.textContent = `${playerGold}G`;

      const container = document.getElementById('map-nodes-container');
      if (!container) return;
      container.innerHTML = '';

      for (let f = mapGrid.length - 1; f >= 0; f--) {
        const floorNodes = mapGrid[f];
        const floorEl = document.createElement('div');
        floorEl.className = 'map-floor';

        floorNodes.forEach(node => {
          const nodeEl = document.createElement('div');
          nodeEl.dataset.nodeId = node.id;

          // ノード進路制限の判定
          let isActive = false;
          if (currentDepth === 0) {
            // 序盤階層0: 階層1のすべてのノードからスタート選択可能
            if (node.depth === 1) isActive = true;
          } else {
            const currentNode = findNodeById(currentNodeId);
            if (currentNode && node.depth === currentDepth + 1) {
              if (currentNode.connections && currentNode.connections.includes(node.index)) {
                isActive = true;
              }
            }
          }

          let nodeClass = `map-node type-${node.type}`;
          if (node.cleared) nodeClass += ' cleared';
          if (isActive) nodeClass += ' active';
          if (currentNodeId === node.id) nodeClass += ' current-position';
          nodeEl.className = nodeClass;

          let icon = '⚔';
          let label = 'COMBAT';
          if (node.type === 'elite') { icon = '⚡'; label = 'ELITE'; }
          if (node.type === 'shop') { icon = '🛒'; label = 'MARKET'; }
          if (node.type === 'rest') { icon = '🛠️'; label = 'REST'; }
          if (node.type === 'event') { icon = '❓'; label = 'SIGNAL'; }
          if (node.type === 'boss') { icon = '👑'; label = 'BOSS'; }

          nodeEl.innerHTML = `${icon}<span class="map-node-label">${label}</span>`;

          if (isActive) {
            nodeEl.onclick = () => {
              currentNodeId = node.id;
              currentDepth = node.depth;
              if (node.type === 'shop') {
                showScene('SHOP');
              } else if (node.type === 'event') {
                showScene('EVENT');
              } else if (node.type === 'rest') {
                showScene('REST');
              } else {
                goToCombat(node.id);
              }
            };
          }

          floorEl.appendChild(nodeEl);
        });
        container.appendChild(floorEl);
      }

      // DOMレンダリング確定後にノード間を結ぶサイバーコネクションライン（道）をSVG描画
      requestAnimationFrame(() => {
        drawMapPathLines(container);
      });

    } catch (err) {
      console.error("Error rendering map:", err);
    }
  }

  /** ノード間を結ぶサイバーパスライン（道）をSVG描画する */
  function drawMapPathLines(container) {
    const oldSvg = container.querySelector('.map-svg-overlay');
    if (oldSvg) oldSvg.remove();

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'map-svg-overlay');

    const nodeElements = {};
    container.querySelectorAll('.map-node').forEach(el => {
      if (el.dataset.nodeId) {
        nodeElements[el.dataset.nodeId] = el;
      }
    });

    const currentNode = findNodeById(currentNodeId);

    for (let f = 0; f < mapGrid.length - 1; f++) {
      const floorNodes = mapGrid[f];
      floorNodes.forEach(node => {
        const fromEl = nodeElements[node.id];
        if (!fromEl) return;

        const fromRect = fromEl.getBoundingClientRect();
        const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;

        if (!node.connections) return;

        node.connections.forEach(targetIdx => {
          const nextFloor = mapGrid[f + 1];
          if (!nextFloor || !nextFloor[targetIdx]) return;
          const targetNode = nextFloor[targetIdx];
          const toEl = nodeElements[targetNode.id];
          if (!toEl) return;

          const toRect = toEl.getBoundingClientRect();
          const x2 = toRect.left + toRect.width / 2 - containerRect.left;
          const y2 = toRect.top + toRect.height / 2 - containerRect.top;

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x1);
          line.setAttribute('y1', y1);
          line.setAttribute('x2', x2);
          line.setAttribute('y2', y2);

          let isActivePath = false;
          if (currentDepth === 0 && node.depth === 1) {
            isActivePath = true;
          } else if (currentNodeId === node.id && node.connections.includes(targetIdx)) {
            isActivePath = true;
          }

          line.setAttribute('class', isActivePath ? 'map-path-line active-path' : 'map-path-line');
          svg.appendChild(line);
        });
      });
    }

    container.prepend(svg);
  }

  // ══════════════════════════════════════════════
  // サイバーショップ (Shop Terminal)
  // ══════════════════════════════════════════════
  const CARD_ICONS = {
    STRIKE: '⚔️',
    DEFEND: '🛡️',
    OVERCLOCK: '⏱️',
    BURST_SCAN: '🎯',
    FIREWALL: '🔥',
    BUFFER_OVERFLOW: '💥',
    REBOOT: '🔄',
    OVERLOAD_CHARGE: '⚡',
    SYSTEM_VULN: '⚠️',
    EXPLOIT: '🗡️',
    QUICK_SCAN: '🔍',
    MEM_DUMP: '💾',
    TEMP_OVERBOOST: '🚀',
    SPIKE_WALL: '🧱',
    DELAYED_SHIELD: '⏳',
    FORCE_QUIT: '✖️',
    SPARK_FIRE: '✨',
    MANA_SHIELD: '🔮',
    LIGHTNING_BOLT: '⚡',
    MANA_REGEN: '💎',
    FIRE_BALL: '☄️',
    ARCANE_BURST: '🌟',
    AETHER_BARRIER: '🌌',
    WHIRLWIND_SLASH: '🌪️',
    BLADE_STORM: '🌀',
    CHAIN_LIGHTNING: '⚡',
    SUPERNOVA: '💥',
    EMP_WAVE: '📡',
    SYSTEM_RESTORE: '💊',
    OVERHEAL_BARRIER: '💖',
    HOLY_COMPILER: '✝️'
  };

  let shopItems = [];
  function openShopUI() {
    document.getElementById('shop-gold-value').textContent = `${playerGold}G`;
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';

    const availableCards = getAvailableCardsForCharacter(selectedCharacter?.id || 'SWORDSMAN');
    shopItems = [];

    for (let i = 0; i < 3; i++) {
      const card = availableCards[Math.floor(Math.random() * availableCards.length)];
      const price = 50 + Math.floor(Math.random() * 50);
      shopItems.push({ card, price, sold: false });
    }

    shopItems.forEach((item, idx) => {
      const card = item.card;
      const itemEl = document.createElement('div');
      const cardClass = card.class || 'NEUTRAL';
      const cardIcon = CARD_ICONS[card.id] || (card.type === 'attack' ? '⚔️' : (card.type === 'skill' ? '🛡️' : '⚡'));
      itemEl.className = `shop-card-ui type-${card.type} glass`;
      itemEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-cost" style="color: #00f5ff; font-size: 10px;">COST ${card.cost}</span>
        </div>
        <div class="card-art-banner type-${card.type}">
          <span class="art-icon">${cardIcon}</span>
        </div>
        <p class="card-desc" style="font-size:10px; margin: 6px 0; white-space: pre-line;">${card.desc}</p>
        <div class="card-footer-info">
          <span class="class-tag">[${cardClass}]</span>
          <span class="clock-tag">+${card.clock || 1} CLOCK</span>
        </div>
        <div class="shop-card-price">${item.sold ? '[SOLD OUT]' : `${item.price}G`}</div>
      `;

      if (!item.sold) {
        itemEl.addEventListener('click', () => {
          if (playerGold >= item.price) {
            playerGold -= item.price;
            deckManager.masterDeck.push({ ...card });
            item.sold = true;
            openShopUI();
          } else {
            fx.spawnPopupText(BASE_W / 2, 400, "CREDITS INSUFFICIENT", 0xFF007A);
          }
        });
      }

      container.appendChild(itemEl);
    });
  }

  document.getElementById('btn-shop-remove-card').addEventListener('click', () => {
    if (playerGold >= 75) {
      openCardRemoveModal();
    } else {
      fx.spawnPopupText(BASE_W / 2, 400, "CREDITS INSUFFICIENT", 0xFF007A);
    }
  });

  function openCardRemoveModal() {
    const overlay = document.getElementById('deck-remove-overlay');
    const list = document.getElementById('remove-cards-list');
    list.innerHTML = '';
    overlay.style.display = 'flex';

    deckManager.masterDeck.forEach((card, idx) => {
      const item = document.createElement('div');
      item.className = 'remove-card-item glass';
      item.textContent = `${card.name}`;
      item.addEventListener('click', () => {
        deckManager.masterDeck.splice(idx, 1);
        playerGold -= 75;
        overlay.style.display = 'none';
        openShopUI();
      });
      list.appendChild(item);
    });
  }

  document.getElementById('btn-cancel-remove').addEventListener('click', () => {
    document.getElementById('deck-remove-overlay').style.display = 'none';
  });

  document.getElementById('btn-shop-leave').addEventListener('click', () => {
    if (currentNodeId) {
      const node = findNodeById(currentNodeId);
      if (node) node.cleared = true;
    }
    showScene('MAP');
  });

  // ══════════════════════════════════════════════
  // REST SITE (リフレッシュ＆カード強化)
  // ══════════════════════════════════════════════
  function openRestUI() {
    audioManager.playSfx('click');

    const btnHeal = document.getElementById('btn-rest-heal');
    const btnUpgrade = document.getElementById('btn-rest-upgrade');

    if (btnHeal) {
      btnHeal.onclick = () => {
        audioManager.playSfx('heal');
        const healAmt = Math.floor(combatEngine.playerMaxHP * 0.3);
        combatEngine.healPlayer(healAmt);
        fx.spawnPopupText(BASE_W / 2, 400, `+${healAmt} HP RECOVERED`, 0x00FF88);

        if (currentNodeId) {
          const node = findNodeById(currentNodeId);
          if (node) node.cleared = true;
        }
        setTimeout(() => showScene('MAP'), 800);
      };
    }

    if (btnUpgrade) {
      btnUpgrade.onclick = () => {
        audioManager.playSfx('overclock');
        const attackCards = deckManager.masterDeck.filter(c => c.type === 'attack');
        if (attackCards.length > 0) {
          const target = attackCards[Math.floor(Math.random() * attackCards.length)];
          target.damage = (target.damage || 6) + 3;
          target.name += '+';
          fx.spawnPopupText(BASE_W / 2, 400, `${target.name} OVERCLOCKED (+3 DMG)`, 0xFFF000);
        } else {
          combatEngine.playerMaxHP += 5;
          combatEngine.playerHP += 5;
          fx.spawnPopupText(BASE_W / 2, 400, `MAX HP +5 ENHANCED`, 0x00F5FF);
        }

        if (currentNodeId) {
          const node = findNodeById(currentNodeId);
          if (node) node.cleared = true;
        }
        setTimeout(() => showScene('MAP'), 800);
      };
    }
  }

  // ══════════════════════════════════════════════
  // ══════════════════════════════════════════════
  // システムランダムイベント (Cyberpunk Choice Events)
  // ══════════════════════════════════════════════
  const EVENT_TEMPLATES = [
    {
      title: "DARK WEB BLACKMARKET (闇のサイバー闇市)",
      desc: "暗号化通信の最奥で、謎の闇ブローカーが闇ノードを展開しています。危険な取引を持ちかけられました。",
      options: [
        {
          text: "[PURCHASE CORES] 60G を支払い、ランダムな強力コードを獲得する",
          action: () => {
            if (playerGold >= 60) {
              playerGold -= 60;
              const availableCards = getAvailableCardsForCharacter(selectedCharacter?.id || 'SWORDSMAN');
              const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
              deckManager.masterDeck.push({ ...randomCard });
              return `闇市場で強力コード【${randomCard.name}】を購入しました！ (残金: ${playerGold}G)`;
            } else {
              return "クレジットが足りません（必要: 60G）。取引は失敗しました。";
            }
          }
        },
        {
          text: "[DATA BLEED] 15 ダメージ受ける代わりに、裏クレジット 80G を強奪する",
          action: () => {
            combatEngine.playerHP = Math.max(1, combatEngine.playerHP - 15);
            playerGold += 80;
            return "痛烈なカウンターログを受けましたが、裏クレジット 80G を強制獲得しました！";
          }
        },
        {
          text: "[JACK OUT] 取引に応じず、静かにノードを退出する",
          action: () => {
            return "無用なトラブルを避け、闇ノードを退出しました。";
          }
        }
      ]
    },
    {
      title: "QUANTUM DATA FORGE (量子データ鍛冶場)",
      desc: "企業によって棄てられた高出力の量子サーバーが稼働しています。デッキ内のコードを再コンパイルできます。",
      options: [
        {
          text: "[DELETION FORGE] デッキの初期コード(STRIKE)を1枚消去する",
          action: () => {
            const idx = deckManager.masterDeck.findIndex(c => c.id === 'STRIKE');
            if (idx !== -1) {
              deckManager.masterDeck.splice(idx, 1);
              return "不要な STRIKE コードを量子消去し、デッキを最適化しました！";
            } else {
              return "STRIKE コードが見つかりませんでした。";
            }
          }
        },
        {
          text: "[OVERHAUL & RECODE] HPを 15 回復し、ランダムなコードを1枚獲得する",
          action: () => {
            const oldHP = combatEngine.playerHP;
            combatEngine.playerHP = Math.min(combatEngine.playerMaxHP, combatEngine.playerHP + 15);
            const availableCards = getAvailableCardsForCharacter(selectedCharacter?.id || 'SWORDSMAN');
            const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
            deckManager.masterDeck.push({ ...randomCard });
            return `量子冷却により HPが ${combatEngine.playerHP - oldHP} 回復し、新規コード【${randomCard.name}】を入手しました！`;
          }
        }
      ]
    },
    {
      title: "UNSTABLE AI PROTOTYPE (暴走AIプロトタイプ)",
      desc: "自我を持つ野良AI『ECHO-9』が接触してきました。「私をコアに組み込めば、力と負荷を授けよう」と語りかけています。",
      options: [
        {
          text: "[ABSORB CORE] 最大HPが +12 増加するが、過酷な負荷(8ダメージ)を受ける",
          action: () => {
            combatEngine.playerMaxHP += 12;
            combatEngine.playerHP = Math.max(1, combatEngine.playerHP - 8);
            return `AIプロトタイプを統合！最大HPが ${combatEngine.playerMaxHP} に拡張されました。（8システムダメージ検知）`;
          }
        },
        {
          text: "[EXTRACT DATA] AIのメモリからランダムなスキルコードを1枚獲得する",
          action: () => {
            const availableCards = getAvailableCardsForCharacter(selectedCharacter?.id || 'SWORDSMAN');
            const skillCards = availableCards.filter(c => c.type === 'skill');
            const card = (skillCards.length > 0 ? skillCards : availableCards)[Math.floor(Math.random() * (skillCards.length || availableCards.length))];
            deckManager.masterDeck.push({ ...card });
            return `AIの残骸からスキルコード【${card.name}】を抽出し、デッキに追加しました！`;
          }
        }
      ]
    },
    {
      title: "SHADOW CASINO TERMINAL (電脳裏カジノ)",
      desc: "クラッカーたちが集う非合法ギャンブルターミナルです。ハイリスクなデータダイスに挑戦できます。",
      options: [
        {
          text: "[HIGH ROLLER] 30G を賭ける（50%の確率で 120G 獲得！）",
          action: () => {
            if (playerGold >= 30) {
              playerGold -= 30;
              const win = Math.random() < 0.5;
              if (win) {
                playerGold += 120;
                return `JACKPOT!! データ賭博に勝利し、120G の大金を手に入れました！（所持金: ${playerGold}G）`;
              } else {
                return `LOSE... ダイス勝負に敗北し、30G を失いました。（所持金: ${playerGold}G）`;
              }
            } else {
              return "賭け金(30G)が足りません。";
            }
          }
        },
        {
          text: "[SAFE BET] 10 ダメージ受ける代わりに、確実な 45G を手に入れる",
          action: () => {
            combatEngine.playerHP = Math.max(1, combatEngine.playerHP - 10);
            playerGold += 45;
            return "ターミナルのセキュリティ罠で10ダメージ受けましたが、確実に 45G を回収しました！";
          }
        }
      ]
    },
    {
      title: "NEON NANOBOT POD (ナノマシン回生ポッド)",
      desc: "医療企業の廃棄カプセルを発見しました。ナノマシンが生存者のアクセスを検知して起動準備をしています。",
      options: [
        {
          text: "[NANOBOT INJECTION] ナノマシンを注入し、HPを 18 回復 ＆ 20G 獲得する",
          action: () => {
            const oldHP = combatEngine.playerHP;
            combatEngine.playerHP = Math.min(combatEngine.playerMaxHP, combatEngine.playerHP + 18);
            playerGold += 20;
            return `ナノマシン注入！ HPが ${combatEngine.playerHP - oldHP} 回復し、残存クレジット 20G を入手しました！`;
          }
        },
        {
          text: "[ENHANCE CAPACITY] 最大HPを +8 拡張し、HPも 8 回復する",
          action: () => {
            combatEngine.playerMaxHP += 8;
            combatEngine.playerHP = Math.min(combatEngine.playerMaxHP, combatEngine.playerHP + 8);
            return `身体拡張完了！ 最大HPが +8 増加し、HPも8回復しました！（最大HP: ${combatEngine.playerMaxHP}）`;
          }
        }
      ]
    },
    {
      title: "SYSTEM CLEANUP DAEMON (クリーンアップ・デーモン)",
      desc: "セキュリティの保守ロボットが起動しています。「不正コードの消去、またはシステム補強を実行します」と応答しています。",
      options: [
        {
          text: "[PURIFY CODE] デッキから不要なコード（DEFENDなど）を1枚消去する",
          action: () => {
            const idx = deckManager.masterDeck.findIndex(c => c.id === 'DEFEND');
            if (idx !== -1) {
              deckManager.masterDeck.splice(idx, 1);
              return "DEFEND コードをクリーンアップ消去しました！";
            } else if (deckManager.masterDeck.length > 0) {
              const removed = deckManager.masterDeck.pop();
              return `デッキから【${removed.name}】をクリーンアップ消去しました！`;
            } else {
              return "消去できるコードがありません。";
            }
          }
        },
        {
          text: "[DEFRAGMENT] 30G と HP 10 回復を獲得する",
          action: () => {
            playerGold += 30;
            combatEngine.playerHP = Math.min(combatEngine.playerMaxHP, combatEngine.playerHP + 10);
            return `最適化完了！ 30G のクレジットと HP 10 回復を獲得しました！`;
          }
        }
      ]
    }
  ];

  function openEventUI() {
    const ev = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
    currentEvent = ev;

    document.getElementById('event-title').textContent = ev.title;
    document.getElementById('event-title').setAttribute('data-text', ev.title);
    document.getElementById('event-description').textContent = ev.desc;

    const optContainer = document.getElementById('event-options-container');
    optContainer.innerHTML = '';

    ev.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'event-option-btn';
      btn.textContent = opt.text;

      btn.onclick = () => {
        const resultText = opt.action();

        document.getElementById('event-description').textContent = resultText;
        optContainer.innerHTML = '';

        const leaveBtn = document.createElement('button');
        leaveBtn.className = 'event-option-btn';
        leaveBtn.style.borderColor = '#00F5FF';
        leaveBtn.style.color = '#00F5FF';
        leaveBtn.textContent = "[JACK OUT] マップ画面に戻る";
        leaveBtn.onclick = () => {
          if (currentNodeId) {
            const node = findNodeById(currentNodeId);
            if (node) node.cleared = true;
          }
          showScene('MAP');
        };
        optContainer.appendChild(leaveBtn);
      };

      optContainer.appendChild(btn);
    });
  }

  // ══════════════════════════════════════════════
  // 戦闘オーケストレーション & クリーンアップ
  // ══════════════════════════════════════════════
  function cleanupCombat() {
    try {
      gsap.killTweensOf('*');
    } catch (e) {}

    try { clearHandSprites(); } catch (e) {}
    
    if (playerSprite) { 
      try { playerSprite.destroy(); } catch (e) {}
      playerSprite = null; 
    }
    
    enemySprites.forEach(s => {
      try { s.destroy(); } catch (e) {}
    });
    enemySprites = [];

    try { entityLayer.removeChildren(); } catch (e) {}
    try {
      if (typeof bgEffectsContainer !== 'undefined' && bgEffectsContainer && !bgEffectsContainer.destroyed) {
        bgEffectsContainer.destroy({ children: true });
        bgEffectsContainer = null;
      }
    } catch (e) {}
    try {
      if (typeof bgAnimationRunning !== 'undefined') {
        bgAnimationRunning = false;
      }
    } catch (e) {}
    try { bgLayer.removeChildren(); } catch (e) {}
    try { fxLayer.removeChildren(); } catch (e) {}

    const go = document.getElementById('gameover-overlay');
    if (go) go.style.display = 'none';
    const dr = document.getElementById('draft-overlay');
    if (dr) dr.style.display = 'none';
    const hd = document.getElementById('hud-overlay');
    if (hd) hd.style.display = 'none';
  }

  function clearHandSprites() {
    cardSprites.forEach(sprite => sprite.destroy());
    cardSprites.length = 0;
    cardLayer.removeChildren().forEach(child => {
      child.destroy({ children: true });
    });
  }

  function spawnEnemiesForCombat(count, eliteMultiplier = 1.0) {
    enemySprites.forEach(s => s.destroy());
    enemySprites = [];

    // エリア(currentAct)が進むほど敵のステータスが倍率アップ！
    const actHpScale = 1.0 + (currentAct - 1) * 0.40;  // AREA 01: 1.0, AREA 02: 1.4, AREA 03: 1.8
    const actDmgScale = 1.0 + (currentAct - 1) * 0.30; // AREA 01: 1.0, AREA 02: 1.3, AREA 03: 1.6

    const depthScale = (1.0 + (currentDepth - 1) * 0.20) * actHpScale * eliteMultiplier;
    const enemiesData = [];

    let positions = [];
    if (count === 1) {
      positions = [1470];
    } else if (count === 2) {
      positions = [1380, 1560];
    } else {
      positions = [1300, 1470, 1640];
    }

    for (let i = 0; i < count; i++) {
      let hpMult = 1.0;
      let powerMult = 1.0;
      let name = `VIRUS.A${currentAct}_D${currentDepth}`;

      if (count === 2) {
        hpMult = 0.7;
        powerMult = 0.7;
        name = eliteMultiplier > 1.0 ? `ELITE.BUG_${String.fromCharCode(65 + i)}` : `VIRUS.BUG_${String.fromCharCode(65 + i)}`;
      } else if (count === 3) {
        if (i === 0) {
          hpMult = 0.7;
          powerMult = 0.7;
          name = `VIRUS.LEADER`;
        } else {
          hpMult = 0.35;
          powerMult = 0.40;
          name = `MINION.BUG_${String.fromCharCode(65 + i - 1)}`;
        }
      }

      const baseHp = (55 + Math.random() * 25) * depthScale;
      const hp = Math.max(15, Math.floor(baseHp * hpMult));

      const enemy = new EnemyAI(name, hp, `enemy_${Date.now()}_${i}`);
      const actionScale = (1.0 + (currentDepth - 1) * 0.12) * powerMult * actDmgScale * (eliteMultiplier > 1.0 ? 1.3 : 1.0);

      enemy.actionCycle = enemy.actionCycle.map(action => ({
        ...action,
        value: Math.max(2, Math.floor(action.value * actionScale)),
        shieldValue: action.shieldValue ? Math.max(2, Math.floor(action.shieldValue * actionScale)) : undefined
      }));
      enemy.decideNextAction();
      enemiesData.push(enemy);

      const sprite = new EntitySprite('enemy', enemy);
      sprite.container.x = positions[i];
      sprite.container.y = 480;
      entityLayer.addChild(sprite.container);
      enemySprites.push(sprite);
    }

    return enemiesData;
  }

  function startNormalCombat() {
    showScene('COMBAT');
    drawBattleBackground();

    combatEngine.initWithCharacter(selectedCharacter);

    if (playerSprite) playerSprite.destroy();
    playerSprite = new EntitySprite('player', combatEngine);
    playerSprite.container.x = 450;
    playerSprite.container.y = 480;
    entityLayer.addChild(playerSprite.container);

    let count = 1;
    if (currentDepth === 2) {
      count = Math.random() < 0.6 ? 1 : 2;
    } else if (currentDepth >= 3) {
      count = Math.random() < 0.4 ? 2 : 3;
    }

    const enemiesData = spawnEnemiesForCombat(count);
    combatEngine.startCombat(enemiesData);
    syncHandSprites();
    updateHUD();
  }

  function startEliteCombat(nodeId) {
    showScene('COMBAT');
    drawBattleBackground();
    audioManager.playSfx('boss_appear');

    combatEngine.initWithCharacter(selectedCharacter);

    if (playerSprite) playerSprite.destroy();
    playerSprite = new EntitySprite('player', combatEngine);
    playerSprite.container.x = 450;
    playerSprite.container.y = 480;
    entityLayer.addChild(playerSprite.container);

    const enemiesData = spawnEnemiesForCombat(2, 1.4);
    combatEngine.startCombat(enemiesData);
    syncHandSprites();
    updateHUD();
  }

  function startBossCombat() {
    showScene('COMBAT');
    drawBattleBackground();

    combatEngine.initWithCharacter(selectedCharacter);

    if (playerSprite) playerSprite.destroy();
    playerSprite = new EntitySprite('player', combatEngine);
    playerSprite.container.x = 450;
    playerSprite.container.y = 480;
    entityLayer.addChild(playerSprite.container);

    enemySprites.forEach(s => s.destroy());
    enemySprites = [];

    // ボスの進化 & ステータス拡張
    const bossNames = ["BOSS.DEATH_RAY", "BOSS.APOCALYPSE_CORE", "FINAL_BOSS.MAINFRAME_GOD"];
    const bossName = bossNames[Math.min(currentAct - 1, bossNames.length - 1)];
    const bossBaseHP = 130 + (currentAct - 1) * 65; // AREA 1: 130, AREA 2: 195, AREA 3: 260
    const bossDmgMult = 1.0 + (currentAct - 1) * 0.35;

    const boss = new EnemyAI(bossName, bossBaseHP, "enemy_boss");
    boss.actionCycle = [
      { type: 'defend', value: Math.floor(10 * bossDmgMult), desc: `ファイアウォール (${Math.floor(10 * bossDmgMult)})` },
      { type: 'attack', value: Math.floor(10 * bossDmgMult), desc: `デストロイ・ビーム (${Math.floor(10 * bossDmgMult)}Dmg)` },
      { type: 'buff', value: Math.floor(3 * bossDmgMult), desc: `クロック・ブースト (+${Math.floor(3 * bossDmgMult)} STR)` },
      { type: 'attack', value: Math.floor(18 * bossDmgMult), desc: `メガ・キャノン (${Math.floor(18 * bossDmgMult)}Dmg)` }
    ];
    boss.decideNextAction();

    const sprite = new EntitySprite('enemy', boss);
    sprite.container.x = 1470;
    sprite.container.y = 480;
    entityLayer.addChild(sprite.container);
    enemySprites.push(sprite);

    combatEngine.startCombat([boss]);
    syncHandSprites();
    updateHUD();
  }

  function showDraftOverlay() {
    const overlay = document.getElementById('draft-overlay');
    const container = document.getElementById('draft-cards-container');
    container.innerHTML = '';
    overlay.style.display = 'flex';

    const charId = selectedCharacter?.id || 'SWORDSMAN';
    const availableCards = getAvailableCardsForCharacter(charId);
    const selected = [];
    
    // 最大3枚を重複なくランダム選択
    const pool = [...availableCards];
    while (selected.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    selected.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = `draft-card-ui type-${card.type} glass`;
      const cardClass = card.class || 'NEUTRAL';
      const cardIcon = CARD_ICONS[card.id] || (card.type === 'attack' ? '⚔️' : (card.type === 'skill' ? '🛡️' : '⚡'));
      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-cost" style="color: #00f5ff; font-size: 10px;">COST ${card.cost}</span>
        </div>
        <div class="card-art-banner type-${card.type}">
          <span class="art-icon">${cardIcon}</span>
        </div>
        <p class="card-desc" style="white-space: pre-line;">${card.desc}</p>
        <div class="card-footer-info">
          <span class="class-tag">[${cardClass}]</span>
          <span class="clock-tag">+${card.clock || 1} CLOCK</span>
        </div>
        <div class="draft-card-btn" style="font-size: 10px; text-align: center; color: #FFF000; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; font-weight: bold;">[INSTALL FREE]</div>
      `;

      cardEl.onclick = () => {
        deckManager.masterDeck.push({ ...card });
        overlay.style.display = 'none';
        onCombatVictoryCleanUp();
      };

      container.appendChild(cardEl);
    });

    const skipBtn = document.getElementById('btn-draft-skip');
    if (skipBtn) {
      skipBtn.onclick = () => {
        overlay.style.display = 'none';
        onCombatVictoryCleanUp();
      };
    }
  }

  // 画面右上 RETURN TO MAP ボタンイベント
  const forceMapBtn = document.getElementById('btn-force-map');
  if (forceMapBtn) {
    forceMapBtn.onclick = () => {
      onCombatVictoryCleanUp();
    };
  }

  function onCombatVictoryCleanUp() {
    try {
      ['draft-overlay', 'gameover-overlay', 'area-transition-overlay', 'hud-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      cleanupCombat();

      const rewardGold = 20 + Math.floor(Math.random() * 16);
      playerGold += rewardGold;

      // 現在ノードのクリアフラグ
      if (currentNodeId) {
        const node = findNodeById(currentNodeId);
        if (node) node.cleared = true;
      }

      if (combatEngine && combatEngine.playerMaxHP) {
        combatEngine.playerHP = Math.min(combatEngine.playerMaxHP, combatEngine.playerHP + Math.floor(combatEngine.playerMaxHP * 0.20));
      }

      // ボス判定（階層6クリア、またはノードがbossの場合）
      const currentNode = findNodeById(currentNodeId);
      const isBossNode = (currentNode && currentNode.type === 'boss') || (currentDepth >= 6);

      if (isBossNode) {
        currentAct++;
        if (currentAct > 3) {
          showAreaTransitionOverlay(true);
          return;
        } else {
          // エリア1→2, エリア2→3: エリアクリア画面を表示してから次のマップへ遷移
          showAreaTransitionOverlay(false);
          return;
        }
      }
    } catch (err) {
      console.error("Victory cleanup error:", err);
    }

    // 100%確実にマップ画面を表示！
    showScene('MAP');
  }

  /** エリア突破モーダルを表示して次のアクトへ安全に遷移する */
  function showAreaTransitionOverlay(isFinalClear) {
    try {
      // 他の全画面オーバーレイを強制非表示化
      const dr = document.getElementById('draft-overlay');
      if (dr) dr.style.display = 'none';
      const go = document.getElementById('gameover-overlay');
      if (go) go.style.display = 'none';
      const hd = document.getElementById('hud-overlay');
      if (hd) hd.style.display = 'none';

      const overlay = document.getElementById('area-transition-overlay');
      const titleEl = document.getElementById('area-clear-title');
      const descEl = document.getElementById('area-clear-desc');
      const nextBtn = document.getElementById('btn-next-area');

      if (!overlay || !nextBtn) {
        if (isFinalClear) returnToTitle();
        else {
          combatEngine.playerHP = combatEngine.playerMaxHP;
          playerGold += 100;
          currentDepth = 0;
          currentNodeId = null;
          generateMap();
          showScene('MAP');
        }
        return;
      }

      if (isFinalClear) {
        if (titleEl) {
          titleEl.textContent = "全エリア 完全クリア！";
          if (typeof titleEl.setAttribute === 'function') titleEl.setAttribute('data-text', "全エリア 完全クリア！");
        }
        if (descEl) descEl.textContent = "すべてのセキュリティプロトコルを解除し、全電脳領域のハッキングに成功しました！";
        nextBtn.textContent = "タイトル画面に戻る ▶";
        nextBtn.onclick = () => {
          overlay.style.display = 'none';
          returnToTitle();
        };
      } else {
        const prevArea = currentAct - 1;
        if (titleEl) {
          titleEl.textContent = `エリア ${prevArea} クリア！`;
          if (typeof titleEl.setAttribute === 'function') titleEl.setAttribute('data-text', `エリア ${prevArea} クリア！`);
        }
        if (descEl) descEl.textContent = `エリア ${prevArea} のボスを撃破しました。セキュリティが解除され、次の エリア ${currentAct} への接続が完了しました。`;
        nextBtn.textContent = `エリア ${currentAct} へ進む ▶`;

        nextBtn.onclick = () => {
          try {
            overlay.style.display = 'none';
            if (combatEngine) combatEngine.playerHP = combatEngine.playerMaxHP; // 全回復
            playerGold += 100; // ボス突破ボーナス
            currentDepth = 0;
            currentNodeId = null;
            generateMap();
            const charId = selectedCharacter?.id || 'SWORDSMAN';
            showAugmentSelectionUI(charId, () => {
              showScene('MAP');
            });
          } catch (e) {
            console.error("Transition click error:", e);
            showScene('MAP');
          }
        };
      }

      overlay.style.display = 'flex';
      overlay.style.zIndex = '99999';
    } catch (e) {
      console.error("Area transition error:", e);
      combatEngine.playerHP = combatEngine.playerMaxHP;
      playerGold += 100;
      currentDepth = 0;
      currentNodeId = null;
      generateMap();
      showScene('MAP');
    }
  }

  // ══════════════════════════════════════════════
  // ドラッグ＆ドロップ カード操作インターフェース
  // ══════════════════════════════════════════════
  let draggedCard = null;
  let dragOffsetLocal = { x: 0, y: 0 };
  let dragStartScreen = { x: 0, y: 0 };
  let hoveredCard = null;
  let isTouchEvent = false;

  function screenToWorld(clientX, clientY) {
    const rect = app.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const worldX = (canvasX - worldContainer.x) / worldContainer.scale.x;
    const worldY = (canvasY - worldContainer.y) / worldContainer.scale.y;
    return { x: worldX, y: worldY };
  }

  function findCardAtWorld(wx, wy) {
    for (let i = cardSprites.length - 1; i >= 0; i--) {
      const card = cardSprites[i];
      if (!card || !card.container || card.container.destroyed) continue;
      const cx = card.container.x;
      const cy = card.container.y;
      const hw = (card.cardWidth / 2) * (card.container.scale.x || 1) * 1.15;
      const hh = (card.cardHeight / 2) * (card.container.scale.y || 1) * 1.15;
      if (wx >= cx - hw && wx <= cx + hw && wy >= cy - hh && wy <= cy + hh) {
        return card;
      }
    }
    return null;
  }

  function startCardDrag(card, clientX, clientY, isTouch = false) {
    if (hoveredCard && hoveredCard !== card) {
      hoveredCard.setHovered(false);
      hoveredCard = null;
    }

    draggedCard = card;
    card.isDragging = true;
    card.isHovered = false;
    isTouchEvent = isTouch;

    const world = screenToWorld(clientX, clientY);
    dragOffsetLocal.x = world.x - card.container.x;
    dragOffsetLocal.y = world.y - card.container.y;
    card.glideOffset = 0;

    dragStartScreen.x = clientX;
    dragStartScreen.y = clientY;

    card.container.zIndex = 200;
    cardLayer.sortChildren();
    gsap.killTweensOf(card.container);
    gsap.killTweensOf(card.container.scale);
    gsap.to(card.container.scale, { x: 1.1, y: 1.1, duration: 0.1 });
    gsap.to(card.container, { rotation: 0, duration: 0.1 });
  }

  function syncHandSprites() {
    // 古くなったスプライトの破棄
    const currentInstanceIds = deckManager.hand.map(c => c.instanceId);

    for (let i = cardSprites.length - 1; i >= 0; i--) {
      const sprite = cardSprites[i];
      if (!currentInstanceIds.includes(sprite.data.instanceId) && !sprite.isDragging) {
        gsap.to(sprite.container.scale, { x: 0, y: 0, duration: 0.15 });
        gsap.to(sprite.container, {
          alpha: 0,
          y: sprite.container.y + 80,
          duration: 0.15,
          onComplete: () => {
            if (!sprite.container.destroyed) sprite.destroy();
          }
        });
        cardSprites.splice(i, 1);
      }
    }

    // 新規カードスプライトの追加
    const existingInstanceIds = cardSprites.map(s => s.data.instanceId);
    deckManager.hand.forEach(cardData => {
      if (!existingInstanceIds.includes(cardData.instanceId)) {
        const cardSprite = new CardSprite(cardData);
        cardSprites.push(cardSprite);
        cardLayer.addChild(cardSprite.container);

        cardSprite.container.x = BASE_W / 2;
        cardSprite.container.y = BASE_H + 100;
        cardSprite.container.scale.set(0.5);
        cardSprite.container.alpha = 0.2;

        gsap.timeline()
          .to(cardSprite.container.scale, { x: 1.0, y: 1.0, duration: 0.25, ease: 'power2.out' })
          .to(cardSprite.container, { alpha: 1, duration: 0.2 }, '<');
      }
    });

    layoutHand();
    updateHUD();
  }

  function onCardPlaySuccess(card) {
    gsap.to(card.container.scale, { x: 0.1, y: 0.1, duration: 0.2, ease: 'power2.in' });
    gsap.to(card.container, {
      y: card.container.y - 120,
      alpha: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        const idx = cardSprites.indexOf(card);
        if (idx !== -1) cardSprites.splice(idx, 1);
        card.destroy();
        syncHandSprites();
      }
    });
  }

  function cancelDrag(card) {
    card.isDragging = false;
    card.container.zIndex = 1;
    gsap.to(card.container.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: 'back.out(1.2)' });
    gsap.to(card.container, {
      x: card.handX,
      y: card.handY,
      rotation: card.handRotation,
      duration: 0.3,
      ease: 'back.out(1.2)',
      onComplete: () => {
        cardLayer.sortChildren();
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (currentScene !== 'COMBAT' || combatEngine.state !== 'PLAYER_TURN') return;
    if (e.target.closest('button, .pile-count, .glass-modal-overlay, .hud-top')) return;

    const world = screenToWorld(e.clientX, e.clientY);
    const card = findCardAtWorld(world.x, world.y);
    if (!card) return;

    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    isTouchEvent = (e.pointerType === 'touch');
    startCardDrag(card, e.clientX, e.clientY, isTouchEvent);
  });

  let targetEnemySprite = null;

  document.addEventListener('pointermove', (e) => {
    if (currentScene !== 'COMBAT') return;

    const world = screenToWorld(e.clientX, e.clientY);

    if (draggedCard) {
      let targetY = world.y - dragOffsetLocal.y;
      if (isTouchEvent) {
        if (draggedCard.glideOffset === undefined) draggedCard.glideOffset = 0;
        // Smoothly glide the card 100 pixels up from the touch point to prevent finger blocking
        draggedCard.glideOffset = Math.min(100, draggedCard.glideOffset + 8);
        targetY -= draggedCard.glideOffset;
      }
      draggedCard.container.x = world.x - dragOffsetLocal.x;
      draggedCard.container.y = targetY;

      draggedCard.bgGfx.tint = draggedCard.container.y < 700 ? 0xFFFFF0 : 0xFFFFFF;

      const AOE_CARD_IDS = ['BUFFER_OVERFLOW', 'WHIRLWIND_SLASH', 'BLADE_STORM', 'CHAIN_LIGHTNING', 'SUPERNOVA', 'EMP_WAVE'];
      const isTargetedCard = (draggedCard.data.type === 'attack' && !AOE_CARD_IDS.includes(draggedCard.data.id)) || draggedCard.data.id === 'SYSTEM_VULN';
      if (isTargetedCard) {
        let closestSprite = null;
        let minDistance = 300; // Increased targeting radius for direct lock-on

        // Auto-target if only 1 enemy is alive
        const aliveEnemies = enemySprites.filter(s => s.core.hp > 0);
        if (aliveEnemies.length === 1) {
          closestSprite = aliveEnemies[0];
        } else {
          // Select closest enemy to the POINTER (finger/mouse) coordinates
          aliveEnemies.forEach(sprite => {
            const dx = world.x - sprite.container.x;
            const dy = world.y - sprite.container.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDistance) {
              minDistance = dist;
              closestSprite = sprite;
            }
          });
        }

        if (closestSprite !== targetEnemySprite) {
          if (targetEnemySprite) targetEnemySprite.setTargeted(false);
          targetEnemySprite = closestSprite;
          if (targetEnemySprite) targetEnemySprite.setTargeted(true);
        }
      }
      return;
    }

    if (combatEngine.state !== 'PLAYER_TURN') return;
    const card = findCardAtWorld(world.x, world.y);
    if (card !== hoveredCard) {
      if (hoveredCard) hoveredCard.setHovered(false);
      hoveredCard = card;
      if (hoveredCard) hoveredCard.setHovered(true);
    }
    if (hoveredCard && hoveredCard.data) {
      showTooltip(hoveredCard.data.name, `${hoveredCard.data.desc}\n[COST: ${hoveredCard.data.cost} | +${hoveredCard.data.clock || 1} CLOCK]`, e.clientX, e.clientY);
    } else if (!draggedCard) {
      hideTooltip();
    }
  });

  document.addEventListener('pointerup', (e) => {
    hideTooltip();
    if (!draggedCard) return;

    const card = draggedCard;
    draggedCard = null;
    card.bgGfx.tint = 0xFFFFFF;

    const targetSprite = targetEnemySprite;
    targetEnemySprite = null;
    if (targetSprite) targetSprite.setTargeted(false);

    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const isUpwardFlick = dy < -20;
    const playThreshold = isTouchEvent ? 15 : 25;

    if ((card.container.y < 720 || isUpwardFlick) && dist >= playThreshold) {
      if (combatEngine.state !== 'PLAYER_TURN') {
        fx.spawnPopupText(card.container.x, card.container.y - 50, "NOT YOUR TURN", 0xFF007A);
        cancelDrag(card);
        return;
      }

      const AOE_CARD_IDS = ['BUFFER_OVERFLOW', 'WHIRLWIND_SLASH', 'BLADE_STORM', 'CHAIN_LIGHTNING', 'SUPERNOVA', 'EMP_WAVE'];
      const needsTarget = (card.data.type === 'attack' && !AOE_CARD_IDS.includes(card.data.id)) || card.data.id === 'SYSTEM_VULN';
      if (needsTarget && !targetSprite) {
        fx.spawnPopupText(card.container.x, card.container.y - 50, "NO TARGET", 0xFF007A);
        cancelDrag(card);
        return;
      }

      const cost = combatEngine.isOverclock ? 0 : card.data.cost;
      if (combatEngine.memory < cost) {
        fx.spawnPopupText(card.container.x, card.container.y - 50, "MEMORY OVERFLOW", 0xFF007A);
        card.bgGfx.tint = 0xFF5555;
        gsap.timeline({
          onComplete: () => {
            card.bgGfx.tint = 0xFFFFFF;
            cancelDrag(card);
          }
        })
          .to(card.container, { x: card.container.x - 10, duration: 0.05, repeat: 5, yoyo: true })
          .to(card.container, { x: card.container.x, duration: 0.05 });
        return;
      }

      const success = combatEngine.playCard(card.data, targetSprite ? targetSprite.core : null);
      if (success) {
        onCardPlaySuccess(card);
        return;
      }
    }

    cancelDrag(card);
  });

  // ══════════════════════════════════════════════
  // 用語解説＆カードツールチップ表示システム (Mobile Touch & Desktop Hover)
  // ══════════════════════════════════════════════
  const tooltipBox = document.getElementById('tooltip-box');
  const tooltipTitle = document.getElementById('tooltip-title');
  const tooltipBody = document.getElementById('tooltip-body');

  const DICTIONARY = {
    'CLOCK': { title: 'CLOCK (クロック)', desc: 'カードプレイ時に溜まる電脳エネルギー。10に到達すると『OVERCLOCK』が自動発動！' },
    'OVERCLOCK': { title: 'OVERCLOCK (オーバークロック)', desc: 'クロック10で起動！全カードコスト0化、または与ダメージ2倍＋吸血バフが適用されます。' },
    'MEMORY': { title: 'MEMORY (メモリ / コスト)', desc: 'ターン毎に手札のカードを使用するために消費するエネルギー。毎ターン全回復します。' },
    'SHIELD': { title: 'SHIELD (シールド)', desc: '敵からのダメージを優先して吸収する防護バリア。ターン開始時にリセットされます。' },
    'VULNERABLE': { title: 'VULNERABLE (脆弱)', desc: '被ダメージが 1.5 倍に増加する危険なデバフ状態。' },
    'BERSERK': { title: 'BERSERK (背水)', desc: 'プレイヤーの減少HPに応じて攻撃力が上昇する能力（10ダメージ減少毎にSTR +1）。' }
  };

  function showTooltip(title, desc, mouseX, mouseY) {
    if (!tooltipBox || !title) return;
    tooltipTitle.textContent = title;
    tooltipBody.textContent = desc;
    tooltipBox.style.display = 'block';

    const boxWidth = 260;
    const boxHeight = 90;
    let x = mouseX + 15;
    let y = mouseY + 15;

    if (x + boxWidth > window.innerWidth) x = mouseX - boxWidth - 15;
    if (y + boxHeight > window.innerHeight) y = mouseY - boxHeight - 15;

    tooltipBox.style.left = `${Math.max(10, x)}px`;
    tooltipBox.style.top = `${Math.max(10, y)}px`;
  }

  function hideTooltip() {
    if (tooltipBox) tooltipBox.style.display = 'none';
  }

  function bindTooltip(element, termKey) {
    const data = DICTIONARY[termKey];
    if (!data || !element) return;

    element.addEventListener('pointerenter', (e) => {
      showTooltip(data.title, data.desc, e.clientX, e.clientY);
    });
    element.addEventListener('pointermove', (e) => {
      showTooltip(data.title, data.desc, e.clientX, e.clientY);
    });
    element.addEventListener('pointerleave', hideTooltip);

    element.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        showTooltip(data.title, data.desc, e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    element.addEventListener('touchend', () => {
      setTimeout(hideTooltip, 1200);
    });
  }

  // HUD要素へツールチップを接続
  bindTooltip(document.getElementById('hud-clock-bar'), 'CLOCK');
  bindTooltip(document.getElementById('hud-memory'), 'MEMORY');
  bindTooltip(document.getElementById('hud-hp'), 'VULNERABLE');
  bindTooltip(document.getElementById('hud-passive'), 'BERSERK');

  // ══════════════════════════════════════════════
  // UIボタン＆キーバインディングの登録
  // ══════════════════════════════════════════════
  document.addEventListener('pointerdown', () => {
    audioManager.startBgm();
  }, { once: true });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    audioManager.playSfx('click');
    goToCharacterSelect();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && currentScene === 'TITLE') {
      audioManager.playSfx('click');
      goToCharacterSelect();
    }
  });

  document.getElementById('btn-back-title').addEventListener('click', () => {
    audioManager.playSfx('click');
    goBackToTitle();
  });

  document.getElementById('btn-end-turn').addEventListener('click', () => {
    audioManager.playSfx('click');
    if (combatEngine.state === 'PLAYER_TURN') {
      combatEngine.endPlayerTurn();
    }
  });

  // [Space] & [1-5] キーボード操作 (PCプレイヤー用アクセシビリティ補助)
  window.addEventListener('keydown', (e) => {
    if (currentScene === 'COMBAT') {
      if (e.code === 'Space') {
        e.preventDefault();
        if (combatEngine.state === 'PLAYER_TURN') {
          audioManager.playSfx('click');
          combatEngine.endPlayerTurn();
        }
      } else if (combatEngine.state === 'PLAYER_TURN') {
        const cardKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        const keyIdx = cardKeys.indexOf(e.code);
        if (keyIdx !== -1 && cardSprites[keyIdx]) {
          const sprite = cardSprites[keyIdx];
          if (sprite.core) {
            combatEngine.playCard(sprite.core);
          }
        }
      }
    }
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    audioManager.playSfx('click');
    returnToTitle();
  });

  // ══════════════════════════════════════════════
  // オプション (OPTIONS) & 音量設定イベント
  // ══════════════════════════════════════════════
  const optionsOverlay = document.getElementById('options-overlay');
  const confirmTitleOverlay = document.getElementById('confirm-title-overlay');

  const sliderMaster = document.getElementById('slider-master-volume');
  const sliderBgm = document.getElementById('slider-bgm-volume');
  const sliderSfx = document.getElementById('slider-sfx-volume');

  const valMaster = document.getElementById('val-master-volume');
  const valBgm = document.getElementById('val-bgm-volume');
  const valSfx = document.getElementById('val-sfx-volume');

  // 初期値の同期
  if (sliderMaster && valMaster) {
    const mVal = Math.round(audioManager.masterVolume * 100);
    sliderMaster.value = mVal;
    valMaster.textContent = `${mVal}%`;
    sliderMaster.oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      valMaster.textContent = `${v}%`;
      audioManager.setMasterVolume(v / 100);
    };
  }

  if (sliderBgm && valBgm) {
    const bVal = Math.round(audioManager.bgmVolume * 100);
    sliderBgm.value = bVal;
    valBgm.textContent = `${bVal}%`;
    sliderBgm.oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      valBgm.textContent = `${v}%`;
      audioManager.setBgmVolume(v / 100);
    };
  }

  if (sliderSfx && valSfx) {
    const sVal = Math.round(audioManager.sfxVolume * 100);
    sliderSfx.value = sVal;
    valSfx.textContent = `${sVal}%`;
    sliderSfx.oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      valSfx.textContent = `${v}%`;
      audioManager.setSfxVolume(v / 100);
    };
  }

  // 音色試聴＆ミュート
  const btnTestSfx = document.getElementById('btn-test-sfx');
  if (btnTestSfx) {
    btnTestSfx.onclick = () => {
      audioManager.playSfx('card_play');
    };
  }

  const btnToggleMute = document.getElementById('btn-toggle-mute');
  if (btnToggleMute) {
    btnToggleMute.onclick = () => {
      const muted = audioManager.toggleMute();
      btnToggleMute.textContent = muted ? "🔊 UNMUTE AUDIO" : "🔇 MUTE AUDIO";
    };
  }

  // オプションダイアログの表示／非表示
  function openOptionsModal() {
    audioManager.playSfx('click');
    if (optionsOverlay) optionsOverlay.style.display = 'flex';
  }

  function closeOptionsModal() {
    audioManager.playSfx('click');
    if (optionsOverlay) optionsOverlay.style.display = 'none';
  }

  ['btn-open-options-title', 'btn-open-options-char', 'btn-open-options-map', 'btn-open-options-hud', 'btn-open-options-shop', 'btn-open-options-event', 'btn-open-options-rest'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = openOptionsModal;
  });

  const btnCloseOptions = document.getElementById('btn-close-options');
  if (btnCloseOptions) btnCloseOptions.onclick = closeOptionsModal;

  // タイトルへ戻る確認ダイアログの制御
  function openConfirmTitleModal() {
    audioManager.playSfx('click');
    if (confirmTitleOverlay) confirmTitleOverlay.style.display = 'flex';
  }

  function closeConfirmTitleModal() {
    audioManager.playSfx('click');
    if (confirmTitleOverlay) confirmTitleOverlay.style.display = 'none';
  }

  ['btn-open-title-map', 'btn-open-title-hud'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = openConfirmTitleModal;
  });

  const btnOptionsReturnTitle = document.getElementById('btn-options-return-title');
  if (btnOptionsReturnTitle) {
    btnOptionsReturnTitle.onclick = () => {
      closeOptionsModal();
      if (currentScene === 'TITLE') {
        goBackToTitle();
      } else {
        openConfirmTitleModal();
      }
    };
  }

  const btnConfirmReturnTitle = document.getElementById('btn-confirm-return-title');
  if (btnConfirmReturnTitle) {
    btnConfirmReturnTitle.onclick = () => {
      closeConfirmTitleModal();
      returnToTitle();
    };
  }

  const btnCancelReturnTitle = document.getElementById('btn-cancel-return-title');
  if (btnCancelReturnTitle) {
    btnCancelReturnTitle.onclick = closeConfirmTitleModal;
  }

  // 初期画面表示
  showScene('TITLE');
})();
