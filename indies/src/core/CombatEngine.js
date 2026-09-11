/**
 * CombatEngine.js - バトルの進行、状態管理、カード発動ロジック
 */

import { CARD_DEFS } from './DeckManager.js';

export class CombatEngine {
  constructor(deckManager) {
    this.deckManager = deckManager;
    
    // プレイヤーのグローバルステート
    this.playerMaxHP = 80;
    this.playerHP = 80;
    this.playerShield = 0;
    this.memory = 3;
    this.maxMemory = 3;
    this.playerStrength = 0;
    this.playerVulnerable = 0;
    
    // バフ追加用の新規ステート
    this.playerTempStrength = 0;      // ターン終了時に減衰する一時的なSTR
    this.playerSpikes = 0;            // 被弾時に反撃するスパイク（トゲ）
    this.playerNextTurnShield = 0;    // 次のターン開始時に得るシールド
    
    // オーバークロックシステム
    this.currentClock = 0;
    this.clockMax = 10;
    this.isOverclock = false;
    this.isOverclockPending = false; // 次のターンにオーバークロックを控えているか
    
    // 戦闘情報
    this.round = 1;
    this.enemies = []; // 生存している敵の配列
    this.state = 'PREP'; // PREP | PLAYER_TURN | ENEMY_TURN | COMBAT_END | GAMEOVER
    
    // 吸血＆背水パッシブ用ステート
    this.turnDamageDealt = 0;         // そのターンに与えたダメージの合計

    // キャラクターデータ & パッシブ能力
    this.characterData = null;
    this.passiveStacks = 0; // パッシブ発動回数
    
    // イベントコールバック
    this.onStateChange = null;
    this.onPlayerDamage = null;
    this.onEnemyDamage = null;
    this.onOverclockTrigger = null;
    this.onCardPlay = null;
    this.onCardDraw = null;
    this.onPassiveTrigger = null; // パッシブ発動時
    this.activeAugments = [];
  }

  /** オーグメント所持チェック */
  hasAugment(id) {
    if (Array.isArray(this.activeAugments)) {
      return this.activeAugments.some(a => a.id === id);
    }
    return this.activeAugment?.id === id;
  }

  /** オーグメント追加 */
  addAugment(aug) {
    if (!this.activeAugments) this.activeAugments = [];
    if (!this.hasAugment(aug.id)) {
      this.activeAugments.push(aug);
    }
    this.activeAugment = aug; // 互換性保持
  }

  /** 減少HPに応じたボーナス攻撃力を取得する */
  getBerserkStrength() {
    if (this.characterData && this.characterData.passive && this.characterData.passive.trigger === 'berserkVampire') {
      const missingHP = Math.max(0, this.playerMaxHP - this.playerHP);
      const mult = this.hasAugment('BLOODLUST_OVERLOAD') ? 2 : 1;
      return Math.floor((missingHP / 10) * mult);
    }
    return 0;
  }

  /** キャラクターデータで初期化する */
  initWithCharacter(characterData) {
    this.characterData = characterData;
    this.playerMaxHP = characterData.maxHP;
    this.playerHP = characterData.maxHP;
    this.round = 1;
    this.passiveStacks = 0;
    this.hexSkillCount = 0;
  }

  /** フルリセット（タイトルに戻る時） */
  fullReset() {
    this.playerMaxHP = 80;
    this.playerHP = 80;
    this.playerShield = 0;
    this.playerStrength = 0;
    this.playerVulnerable = 0;
    this.playerTempStrength = 0;
    this.playerSpikes = 0;
    this.playerNextTurnShield = 0;
    this.turnDamageDealt = 0;
    this.memory = 3;
    this.maxMemory = 3;
    this.currentClock = 0;
    this.isOverclock = false;
    this.isOverclockPending = false;
    this.round = 1;
    this.enemies = [];
    this.state = 'PREP';
    this.characterData = null;
    this.passiveStacks = 0;
    this.activeAugment = null;
    this.activeAugments = [];
    this.hexSkillCount = 0;
  }

  /** 敵に感染(DoT)を付与する */
  addInfection(amount, targetEnemy = null) {
    if (!targetEnemy) {
      const alive = this.enemies.filter(e => e.hp > 0);
      if (alive.length > 0) targetEnemy = alive[0];
      else return;
    }
    targetEnemy.infection = (targetEnemy.infection || 0) + amount;
    if (this.onEnemyDamage) this.onEnemyDamage(0, targetEnemy);
  }

  /** 戦闘を開始する。引数に敵インスタンスの配列を受け取る */
  startCombat(enemies) {
    // 配列でない場合は配列にする互換性保持
    this.enemies = Array.isArray(enemies) ? enemies : [enemies];
    this.playerShield = 0;
    this.playerStrength = 0;
    this.playerVulnerable = 0;
    this.playerTempStrength = 0;
    this.playerSpikes = 0;
    this.playerNextTurnShield = 0;
    this.turnDamageDealt = 0;
    this.currentClock = 0;
    this.isOverclock = false;
    this.isOverclockPending = false;
    this.passiveStacks = 0; // パッシブカウンタリセット
    this.hexSkillCount = 0;
    this.deckManager.setupStartingDeck();
    
    // HERO AUGMENT: TOXIC_OUTBREAK (付与: 感染 +5)
    if (this.hasAugment('TOXIC_OUTBREAK')) {
      this.enemies.filter(e => e.hp > 0).forEach(e => this.addInfection(5, e));
    }

    this.state = 'PLAYER_TURN';
    this.startPlayerTurn();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  /** プレイヤーのターンを開始する */
  startPlayerTurn() {
    this.state = 'PLAYER_TURN';
    this.turnDamageDealt = 0;

    // HERO AUGMENT: BERSERK_REGENERATION (HP <= 50% で HP +4 ＆ STR +1)
    if (this.hasAugment('BERSERK_REGENERATION') && this.playerHP <= this.playerMaxHP * 0.5) {
      this.healPlayer(4);
      this.playerStrength += 1;
    }
    
    // 遅延シールドの獲得
    this.playerShield = 0;
    if (this.playerNextTurnShield > 0) {
      this.playerShield += this.playerNextTurnShield;
      this.playerNextTurnShield = 0;
    }
    
    // スパイクは毎ターンリセット
    this.playerSpikes = 0;
    
    // 前のターンにオーバークロック状態（コスト0ターン）だった場合はリセット
    if (this.isOverclock) {
      this.isOverclock = false;
      this.currentClock = 0;
    }
    
    // 前のターンにオーバークロックが「予約」されていた場合、このターンで起動！
    let showOverclockActivation = false;
    if (this.isOverclockPending) {
      this.isOverclock = true;
      this.isOverclockPending = false;
      showOverclockActivation = true;

      // HERO AUGMENT: OVERCLOCK_RELOAD (2ドロー)
      if (this.hasAugment('OVERCLOCK_RELOAD')) {
        this.deckManager.drawCard(2, (card) => {
          if (this.onCardDraw) this.onCardDraw(card);
        });
      }
      // HERO AUGMENT: VIRAL_OVERCLOCK (全敵の感染値を2倍)
      if (this.hasAugment('VIRAL_OVERCLOCK')) {
        this.enemies.filter(e => e.hp > 0).forEach(e => e.infection = (e.infection || 0) * 2);
      }
    }

    // HERO AUGMENT: MANA_OVERFLOW (最大メモリ+1)
    this.memory = this.hasAugment('MANA_OVERFLOW') ? this.maxMemory + 1 : this.maxMemory;
    
    // 脆弱状態のデバフのカウントダウン
    if (this.playerVulnerable > 0) {
      this.playerVulnerable--;
    }
    
    // ドロー枚数決定（オーバークロック起動時は追加ドローして爆発力を上げる）
    let drawCount = showOverclockActivation ? 7 : 5;
    if (this.hasAugment('MANA_OVERFLOW')) {
      drawCount += 1;
    }
    if (this.playerNextTurnDraw > 0) {
      drawCount += this.playerNextTurnDraw;
      this.playerNextTurnDraw = 0;
    }

    this.deckManager.drawCard(drawCount, (card) => {
      if (this.onCardDraw) this.onCardDraw(card);
    });

    if (this.onStateChange) this.onStateChange(this.state);
    
    // UIやメイン側でアクティベーションの演出を呼ぶため
    if (showOverclockActivation && this.onOverclockTrigger) {
      this.onOverclockTrigger();
    }
  }

  /** プレイヤーにダメージを与える。攻撃元（敵）のインスタンスを第二引数で受け取る */
  damagePlayer(amount, sourceEnemy = null) {
    // 敵のStrengthを加味
    if (sourceEnemy) {
      amount += sourceEnemy.strength;
    }
    // プレイヤーの脆弱(Vulnerable)による被ダメージ1.5倍
    if (this.playerVulnerable > 0) {
      amount = Math.floor(amount * 1.5);
    }

    if (this.playerShield > 0) {
      if (amount <= this.playerShield) {
        this.playerShield -= amount;
        amount = 0;
      } else {
        amount -= this.playerShield;
        this.playerShield = 0;
      }
    }
    
    this.playerHP = Math.max(0, this.playerHP - amount);
    if (this.onPlayerDamage) this.onPlayerDamage(amount);

    // COUNTER_PARRY 反撃ドロー
    if (amount > 0 && this.playerParryDraw) {
      this.playerParryDraw = false;
      this.deckManager.drawCard(2, (c) => { if (this.onCardDraw) this.onCardDraw(c); });
    }
    
    // 被弾時：スパイク（トゲ）による反射ダメージ（攻撃元の敵に対して反射）
    if (amount > 0 && this.playerSpikes > 0 && sourceEnemy && sourceEnemy.hp > 0) {
      // 被ダメージ後にスパイク値分のダメージを敵に反射
      setTimeout(() => {
        if (sourceEnemy.hp > 0) {
          this.damageEnemy(this.playerSpikes, sourceEnemy);
        }
      }, 300);
    }
    
    if (this.playerHP <= 0) {
      this.state = 'GAMEOVER';
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  /** プレイヤーのHPを回復する */
  healPlayer(amount) {
    if (amount <= 0) return;
    const oldHp = this.playerHP;
    this.playerHP = Math.min(this.playerMaxHP, this.playerHP + amount);
    const actualHeal = this.playerHP - oldHp;
    if (actualHeal > 0 && this.onPlayerHeal) {
      this.onPlayerHeal(actualHeal);
    }
  }

  /** カードをプレイする。特定のターゲットの敵を第二引数で指定できる */
  playCard(cardInstance, targetEnemy = null) {
    if (this.state !== 'PLAYER_TURN') return false;

    // コストの確認 (freeCostタイプのみコスト0化、それ以外は通常通りメモリを消費)
    const isFreeCost = this.isOverclock && (this.characterData?.overclockType === 'freeCost');
    const cost = isFreeCost ? 0 : cardInstance.cost;
    if (this.memory < cost) return false;

    // もし攻撃カードで、ターゲットが指定されておらず、敵が1体以上いる場合は最初の敵をデフォルトターゲットにする
    if (cardInstance.type === 'attack' && !targetEnemy) {
      const aliveEnemies = this.enemies.filter(e => e.hp > 0);
      if (aliveEnemies.length > 0) {
        targetEnemy = aliveEnemies[0];
      }
    }

    // メモリの消費
    this.memory -= cost;

    // カード効果の適用（ターゲットを指定）
    this.applyCardEffect(cardInstance, targetEnemy);

    // パッシブ能力の発動チェック
    this.checkPassiveTrigger(cardInstance);

    // 捨て札へ送る
    this.deckManager.useCard(cardInstance);

    // コールバック通知
    if (this.onCardPlay) this.onCardPlay(cardInstance);

    // クロック値の上昇
    this.addClock(cardInstance.clock);

    // 全ての敵が死亡した場合は戦闘終了（勝利）
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      this.endCombat(true);
    }
    
    return true;
  }

  /** パッシブ能力の発動チェック */
  checkPassiveTrigger(cardInstance) {
    if (!this.characterData || !this.characterData.passive) return;
    
    const passive = this.characterData.passive;
    
    // 発動回数上限チェック
    if (this.passiveStacks >= passive.maxStacks) return;
    
    let shouldTrigger = false;
    
    switch (passive.trigger) {
      case 'onAttackCardPlayed':
        shouldTrigger = cardInstance.type === 'attack';
        break;
      case 'onSkillCardPlayed':
        shouldTrigger = cardInstance.type === 'skill';
        break;
      case 'onSkillCardEvery2':
        if (cardInstance.type === 'skill') {
          this.hexSkillCount = (this.hexSkillCount || 0) + 1;
          const reqCount = this.hasAugment('CASCADE_COMPILER') ? 1 : 2;
          if (this.hexSkillCount >= reqCount) {
            this.hexSkillCount = 0;
            shouldTrigger = true;
          }
        }
        break;
      case 'onBuffCardPlayed':
        shouldTrigger = cardInstance.type === 'buff';
        break;
      case 'onSkillOrBuffPlayed':
        shouldTrigger = cardInstance.type === 'skill' || cardInstance.type === 'buff';
        break;
      case 'onSkillOrAttackPlayed':
        shouldTrigger = cardInstance.type === 'skill' || cardInstance.type === 'attack';
        break;
    }
    
    if (shouldTrigger) {
      this.passiveStacks++;
      
      // エフェクト適用
      switch (passive.effect.type) {
        case 'addStrength':
          this.playerStrength += passive.effect.value;
          // HERO AUGMENT: ARCANE_SHIELDING (STR上昇時 シールド+6)
          if (this.hasAugment('ARCANE_SHIELDING')) {
            this.playerShield += 6;
          }
          break;
        case 'addClock':
          this.addClock(passive.effect.value);
          break;
        case 'addShield':
          this.playerShield += passive.effect.value;
          break;
        case 'addInfection':
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => this.addInfection(passive.effect.value, e));
          break;
      }
      
      if (this.onPassiveTrigger) {
        this.onPassiveTrigger(passive, this.passiveStacks);
      }
    }
  }

  /** クロックを追加する。10に達すると次ターンにオーバークロック突入 */
  addClock(value) {
    if (this.isOverclock || this.isOverclockPending) {
      // すでにオーバークロック中、または起動予約中の場合はクロックは上昇しない
      return;
    }

    this.currentClock = Math.min(this.clockMax, this.currentClock + value);
    
    if (this.currentClock >= this.clockMax) {
      this.isOverclockPending = true;
      
      // UI用に予約完了通知
      if (this.onOverclockTrigger) {
        // メインスレッドでバナー警告などを出す（「OVERCLOCK PENDING...」など）
        this.onOverclockTrigger(true); // pending = true を渡す
      }
    }
  }

  /** カード効果の詳細実行ロジック */
  applyCardEffect(card, targetEnemy = null) {
    // ターゲットが指定されておらず、攻撃カード等の場合は生存している最初の敵をターゲットにする
    if (!targetEnemy && card.type === 'attack') {
      const alive = this.enemies.filter(e => e.hp > 0);
      if (alive.length > 0) targetEnemy = alive[0];
    }

    // doubleEffectまたはvampiricBurstタイプの場合はカード効果・ダメージ倍率を2倍にする
    const isDouble = this.characterData?.overclockType === 'doubleEffect' || this.characterData?.overclockType === 'vampiricBurst';
    const isOvercompiling = this.hasAugment('OVERCOMPILING');
    const mult = (this.isOverclock && isDouble) ? (isOvercompiling ? 4 : 2) : 1;

    // HERO AUGMENT: ARCANE_CASCADE
    if (this.hasAugment('ARCANE_CASCADE') && (card.type === 'skill' || card.type === 'buff')) {
      this.playerShield += 4;
      this.addClock(1);
    }

    // HERO AUGMENT: MANA_RECYCLER
    if (this.hasAugment('MANA_RECYCLER') && Math.random() < 0.5) {
      this.memory = Math.min(this.maxMemory, this.memory + 1);
    }

    // HERO AUGMENT: NANO_BLADE_REFLEX (攻撃カード時 シールド+3 ＆ クロック+1)
    if (this.hasAugment('NANO_BLADE_REFLEX') && card.type === 'attack') {
      this.playerShield += 3;
      this.addClock(1);
    }

    // HERO AUGMENT: SPELL_ACCELERATOR (スキル時 手札の全魔法スペルコスト -1)
    if (this.hasAugment('SPELL_ACCELERATOR') && card.type === 'skill') {
      this.deckManager.hand.filter(c => c.class === 'MAGE' && c.type === 'attack').forEach(c => {
        c.cost = Math.max(0, c.cost - 1);
      });
    }

    // HERO AUGMENT: BIO_SHIELD_SYNERGY (感染付与時 シールド+3)
    if (this.hasAugment('BIO_SHIELD_SYNERGY') && (card.infection || card.id === 'BIO_POISON')) {
      this.playerShield += 3;
    }

    // HERO AUGMENT: DUAL_BLADE_SURGE (50%で連動発動)
    if (this.hasAugment('DUAL_BLADE_SURGE') && card.type === 'attack' && !card._isSurge) {
      if (Math.random() < 0.5) {
        setTimeout(() => {
          this.applyCardEffect({ ...card, _isSurge: true }, targetEnemy);
        }, 200);
      }
    }

    switch (card.id) {
      case 'STRIKE':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'DEFEND':
        this.playerShield += card.value * mult;
        break;
      case 'VIRUS_STRIKE':
        this.damageEnemy(card.value * mult, targetEnemy);
        if (targetEnemy) this.addInfection((card.infection || 3) * mult, targetEnemy);
        break;
      case 'BIO_POISON':
        this.enemies.filter(e => e.hp > 0).forEach(e => {
          this.addInfection((card.infection || 5) * mult, e);
        });
        break;
      case 'CONTAGION_BURST':
        this.damageEnemy(card.value * mult, targetEnemy);
        if (targetEnemy && targetEnemy.infection) {
          const burstRate = this.hasAugment('CONTAGION_ACCELERATOR') ? 2.2 : 1.5;
          targetEnemy.infection = Math.floor(targetEnemy.infection * burstRate);
        }
        break;
      case 'TOXIC_BARRIER':
        this.playerShield += (card.value || 6) * mult;
        this.playerSpikes += 2 * mult;
        break;
      case 'NEURO_TOXIN':
        this.damageEnemy(card.value * mult, targetEnemy);
        if (targetEnemy) {
          this.addInfection((card.infection || 4) * mult, targetEnemy);
          targetEnemy.vulnerable = (targetEnemy.vulnerable || 0) + 2;
        }
        break;
      case 'OVERCLOCK':
        this.deckManager.drawCard(1 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        break;
      case 'BURST_SCAN':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'FIREWALL':
        this.playerShield += card.value * mult;
        break;
      case 'BUFFER_OVERFLOW':
        // 全体多段攻撃: 生存している敵全員に3ダメージを3回与える
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const alive = this.enemies.filter(e => e.hp > 0);
            alive.forEach(e => {
              this.damageEnemy(card.value * mult, e);
            });
          }, i * 150);
        }
        break;
      case 'REBOOT':
        this.deckManager.discardHand();
        this.deckManager.drawCard(5 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        break;
      case 'OVERLOAD_CHARGE':
        this.playerStrength += card.value * mult;
        break;
      case 'SYSTEM_VULN':
        if (targetEnemy) {
          targetEnemy.vulnerable += card.value * mult;
        }
        break;
      case 'EXPLOIT':
        if (targetEnemy) {
          const dmg = (targetEnemy.vulnerable > 0) ? 12 * mult : card.value * mult;
          this.damageEnemy(dmg, targetEnemy);
        }
        break;
      case 'QUICK_SCAN':
        this.deckManager.drawCard(1 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        break;
      case 'MEM_DUMP':
        this.deckManager.drawCard(2 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        setTimeout(() => {
          this.deckManager.discardRandomCard();
        }, 300);
        break;
      case 'TEMP_OVERBOOST':
        this.playerStrength += card.value * mult;
        this.playerTempStrength += card.value * mult;
        break;
      case 'SPIKE_WALL':
        this.playerShield += card.value * mult;
        this.playerSpikes += (4 * mult);
        break;
      case 'DELAYED_SHIELD':
        this.playerNextTurnShield += card.value * mult;
        break;
      case 'FORCE_QUIT':
        this.damageEnemy(card.value * mult, targetEnemy);
        setTimeout(() => {
          const otherCards = this.deckManager.hand.filter(c => c.instanceId !== card.instanceId);
          if (otherCards.length > 0) {
            const target = otherCards[Math.floor(Math.random() * otherCards.length)];
            this.deckManager.exhaustCard(target);
          }
        }, 200);
        break;
      case 'SPARK_FIRE':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'MANA_SHIELD':
        this.playerShield += card.value * mult;
        break;
      case 'LIGHTNING_BOLT':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'MANA_REGEN':
        this.memory += (1 * mult);
        this.deckManager.exhaustCard(card);
        break;
      case 'FIRE_BALL':
        this.damageEnemy(card.value * mult, targetEnemy);
        if (targetEnemy) {
          targetEnemy.vulnerable += (1 * mult);
        }
        break;
      case 'ARCANE_BURST':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'AETHER_BARRIER':
        this.playerShield += card.value * mult;
        break;
      case 'WHIRLWIND_SLASH':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
          });
        }
        break;
      case 'BLADE_STORM':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
          });
        }
        break;
      case 'CHAIN_LIGHTNING':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
          });
        }
        break;
      case 'SUPERNOVA':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
          });
        }
        break;
      case 'EMP_WAVE':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
            e.strength = Math.max(0, e.strength - (1 * mult));
          });
        }
        break;
      case 'SYSTEM_RESTORE':
        this.healPlayer(card.value * mult);
        this.deckManager.exhaustCard(card);
        break;
      case 'OVERHEAL_BARRIER':
        this.playerShield += (16 * mult);
        this.healPlayer(5 * mult);
        break;
      case 'HOLY_COMPILER':
        this.playerShield += (12 * mult);
        this.healPlayer(8 * mult);
        break;

      // ── 新規 SWORDSMAN カード効果 ──
      case 'PHANTOM_SLASH':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'COUNTER_PARRY':
        this.playerShield += card.value * mult;
        this.playerParryDraw = true;
        break;
      case 'BERSERK_DRIVE':
        this.damagePlayer(5);
        this.playerStrength += card.value * mult;
        this.playerTempStrength += card.value * mult;
        break;
      case 'EXECUTION_BLADE':
        {
          const isLow = targetEnemy && targetEnemy.hp <= targetEnemy.maxHp * 0.5;
          const dmg = isLow ? 28 : 16;
          this.damageEnemy(dmg * mult, targetEnemy);
        }
        break;
      case 'TITAN_SHIELD':
        this.playerShield += card.value * mult;
        break;

      // ── 新規 MAGE カード効果 ──
      case 'MAGIC_MISSILE':
        this.damageEnemy(card.value * mult, targetEnemy);
        setTimeout(() => {
          if (targetEnemy && targetEnemy.hp > 0) {
            this.damageEnemy(card.value * mult, targetEnemy);
          }
        }, 160);
        break;
      case 'ICE_BARRIER':
        this.playerShield += card.value * mult;
        if (targetEnemy) targetEnemy.vulnerable = (targetEnemy.vulnerable || 0) + (1 * mult);
        break;
      case 'ARCANE_SPELL_BOOK':
        {
          const spells = [CARD_DEFS.FIRE_BALL, CARD_DEFS.LIGHTNING_BOLT, CARD_DEFS.CHAIN_LIGHTNING, CARD_DEFS.ARCANE_BURST];
          const chosen = { ...spells[Math.floor(Math.random() * spells.length)], cost: 0, instanceId: `created_${Date.now()}` };
          this.deckManager.hand.push(chosen);
        }
        break;
      case 'THUNDER_STORM':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
            e.strength = Math.max(0, e.strength - (2 * mult));
          });
        }
        break;
      case 'CHRONO_BREAK':
        this.addClock(5 * mult);
        this.deckManager.drawCard(3 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        break;

      // ── 新規 VIRUS カード効果 ──
      case 'BIO_HAZARD':
        {
          const bonus = targetEnemy?.infection || 0;
          this.damageEnemy((card.value + bonus) * mult, targetEnemy);
        }
        break;
      case 'CORROSIVE_GAS':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            e.shield = Math.max(0, e.shield - (10 * mult));
            this.addInfection((card.infection || 4) * mult, e);
          });
        }
        break;
      case 'VIRAL_CLONE':
        if (targetEnemy && targetEnemy.infection > 0) {
          const inf = targetEnemy.infection;
          this.enemies.filter(e => e.hp > 0 && e !== targetEnemy).forEach(e => {
            this.addInfection(inf * mult, e);
          });
        }
        break;
      case 'PLAGUE_BOMB':
        {
          const alive = this.enemies.filter(e => e.hp > 0);
          alive.forEach(e => {
            this.damageEnemy(card.value * mult, e);
            this.addInfection((card.infection || 8) * mult, e);
          });
        }
        break;
      case 'MUTATION_SHIELD':
        {
          const totalInfection = this.enemies.reduce((sum, e) => sum + (e.infection || 0), 0);
          this.playerShield += (card.value + totalInfection) * mult;
        }
        break;

      // ── 新規 NEUTRAL カード効果 ──
      case 'DATA_DRAIN':
        if (targetEnemy && targetEnemy.shield > 0) {
          const stolen = Math.min(targetEnemy.shield, card.value * mult);
          targetEnemy.shield -= stolen;
          this.playerShield += stolen;
        }
        break;
      case 'ENERGY_PACK':
        this.memory += (1 * mult);
        this.deckManager.exhaustCard(card);
        break;
      case 'CYBER_HASTER':
        this.playerNextTurnDraw = (this.playerNextTurnDraw || 0) + (2 * mult);
        break;
      case 'DEEP_SCAN':
        this.deckManager.drawCard(2 * mult, (c) => {
          if (this.onCardDraw) this.onCardDraw(c);
        });
        setTimeout(() => {
          const sorted = [...this.deckManager.hand].sort((a, b) => b.cost - a.cost);
          if (sorted.length > 0) sorted[0].cost = Math.max(0, sorted[0].cost - 1);
        }, 200);
        break;
    }
  }

  /** 特定の敵にダメージを与える */
  damageEnemy(amount, targetEnemy = null) {
    if (!targetEnemy) {
      // ターゲット未指定時は最初の生存している敵を狙う
      const alive = this.enemies.filter(e => e.hp > 0);
      if (alive.length > 0) targetEnemy = alive[0];
      else return;
    }

    // プレイヤーのStrength ＆ 減少HPボーナスStrengthを加算
    amount += this.playerStrength + this.getBerserkStrength();

    // HERO AUGMENT: ARMOR_PIERCER (シールド50%貫通)
    if (this.hasAugment('ARMOR_PIERCER') && targetEnemy.shield > 0) {
      const bypassDmg = Math.floor(amount * 0.5);
      targetEnemy.hp = Math.max(0, targetEnemy.hp - bypassDmg);
      amount = Math.max(0, amount - bypassDmg);
    }

    // HERO AUGMENT: ELEMENTAL_BURST (脆弱時 +50% 与ダメージ)
    if (this.hasAugment('ELEMENTAL_BURST') && targetEnemy.vulnerable > 0) {
      amount = Math.floor(amount * 1.5);
    }

    // 敵の脆弱(Vulnerable)による被ダメージ1.5倍
    if (targetEnemy.vulnerable > 0) {
      amount = Math.floor(amount * 1.5);
    }

    const isDead = targetEnemy.takeDamage(amount);
    
    // そのターンの累積与ダメージに加算
    this.turnDamageDealt += amount;

    // HERO AUGMENT: SPELL_DRAIN (魔法ダメージの25%をシールド変換)
    if (this.hasAugment('SPELL_DRAIN') && this.characterData?.id === 'MAGE') {
      this.playerShield += Math.floor(amount * 0.25);
    }

    // コールバック通知（どの敵にダメージを与えたか targetEnemy も引き渡す）
    if (this.onEnemyDamage) this.onEnemyDamage(amount, targetEnemy);
    
    // 生存している敵が0体になったら即座に戦闘終了
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      this.endCombat(true);
    }
  }

  /** 感染(DoT)ダメージ処理 (敵ターン終了時) */
  processInfectionDoT() {
    const alive = this.enemies.filter(e => e.hp > 0);
    let totalInfectionDamage = 0;

    alive.forEach(enemy => {
      if (enemy.infection && enemy.infection > 0) {
        const dotDamage = enemy.infection;
        totalInfectionDamage += dotDamage;

        // HERO AUGMENT: ACIDIC_CORROSION (bypasses shield directly)
        const isBypass = this.hasAugment('ACIDIC_CORROSION');
        if (isBypass) {
          enemy.hp = Math.max(0, enemy.hp - dotDamage);
        } else {
          enemy.takeDamage(dotDamage);
        }

        // HERO AUGMENT: EVERLASTING_DECAY (減衰せず +1 自動増殖)
        if (this.hasAugment('EVERLASTING_DECAY')) {
          enemy.infection += 1;
        } else {
          enemy.infection = Math.max(0, enemy.infection - 1);
        }

        if (this.onEnemyDamage) {
          this.onEnemyDamage(dotDamage, enemy);
        }

        // HERO AUGMENT: EPIDEMIC_CARRIER (spreads infection to other alive enemies)
        if (this.hasAugment('EPIDEMIC_CARRIER')) {
          const others = alive.filter(other => other !== enemy && other.hp > 0);
          others.forEach(other => {
            other.infection = (other.infection || 0) + Math.ceil(dotDamage * 0.5);
          });
        }

        // HERO AUGMENT: NEURO_PARALYSIS (感染5以上で敵攻撃力 -3)
        if (this.hasAugment('NEURO_PARALYSIS') && enemy.infection >= 5) {
          enemy.strength = Math.max(0, enemy.strength - 3);
        }
      }
    });

    // HERO AUGMENT: BIO_REGENESIS (heals 30% of total DoT damage)
    if (this.hasAugment('BIO_REGENESIS') && totalInfectionDamage > 0) {
      const bioHeal = Math.floor(totalInfectionDamage * 0.3);
      if (bioHeal > 0) {
        this.healPlayer(bioHeal);
      }
    }
  }

  /** プレイヤーのターンを終了し、敵のターンに移行する */
  endPlayerTurn() {
    if (this.state !== 'PLAYER_TURN') return;
    
    // 剣士パッシブ: 吸血回復 (HERO AUGMENT: VAMPIRIC_FRENZY 60%吸血)
    if (this.characterData && this.characterData.passive && this.characterData.passive.trigger === 'berserkVampire' && this.turnDamageDealt > 0) {
      if (this.isOverclock) {
        const rate = this.hasAugment('VAMPIRIC_FRENZY') ? 0.60 : 0.30;
        const vampHeal = Math.floor(this.turnDamageDealt * rate);
        if (vampHeal > 0) {
          const oldHP = this.playerHP;
          this.healPlayer(vampHeal);
          // 超過回復のシールド変換
          if (this.hasAugment('VAMPIRIC_FRENZY')) {
            const overflow = (oldHP + vampHeal) - this.playerMaxHP;
            if (overflow > 0) {
              this.playerShield += overflow;
            }
          }
        }
      }
    }

    this.state = 'ENEMY_TURN';
    if (this.onStateChange) this.onStateChange(this.state);
    
    if (this.playerTempStrength > 0) {
      this.playerStrength = Math.max(0, this.playerStrength - this.playerTempStrength);
      this.playerTempStrength = 0;
    }

    this.deckManager.discardHand();
    
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      this.startPlayerTurn();
      return;
    }

    let enemyIndex = 0;
    const executeNextEnemy = () => {
      if (this.playerHP <= 0 || this.state === 'COMBAT_END') return;

      if (enemyIndex < aliveEnemies.length) {
        const currentEnemy = aliveEnemies[enemyIndex];
        currentEnemy.startTurn();
        currentEnemy.executeAction(this, this);
        
        enemyIndex++;
        setTimeout(executeNextEnemy, 1000);
      } else {
        // 敵のターン終了時に感染(DoT)ダメージを処理！
        this.processInfectionDoT();

        if (this.playerHP > 0 && this.state !== 'COMBAT_END') {
          this.startPlayerTurn();
        }
      }
    };

    setTimeout(executeNextEnemy, 800);
  }

  /** 戦闘終了処理 (勝利 / 敗北) */
  endCombat(playerWon) {
    if (this.state === 'COMBAT_END' || this.state === 'GAMEOVER') return;
    this.state = 'COMBAT_END';
    if (this.onStateChange) this.onStateChange(this.state, playerWon);
  }
}
