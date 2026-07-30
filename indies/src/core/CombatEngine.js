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
  }

  /** 減少HPに応じたボーナス攻撃力を取得する */
  getBerserkStrength() {
    if (this.characterData && this.characterData.passive && this.characterData.passive.trigger === 'berserkVampire') {
      const missingHP = Math.max(0, this.playerMaxHP - this.playerHP);
      return Math.floor(missingHP / 10);
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
    this.deckManager.setupStartingDeck();
    
    this.state = 'PLAYER_TURN';
    this.startPlayerTurn();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  /** プレイヤーのターンを開始する */
  startPlayerTurn() {
    this.state = 'PLAYER_TURN';
    this.turnDamageDealt = 0;
    
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
    }

    this.memory = this.maxMemory;
    
    // 脆弱状態のデバフのカウントダウン
    if (this.playerVulnerable > 0) {
      this.playerVulnerable--;
    }
    
    // ドロー枚数決定（オーバークロック起動時は追加ドローして爆発力を上げる）
    const drawCount = showOverclockActivation ? 7 : 5;
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
      case 'onBuffCardPlayed':
        shouldTrigger = cardInstance.type === 'buff';
        break;
      case 'onSkillOrBuffPlayed':
        shouldTrigger = cardInstance.type === 'skill' || cardInstance.type === 'buff';
        break;
    }
    
    if (shouldTrigger) {
      this.passiveStacks++;
      
      // エフェクト適用
      switch (passive.effect.type) {
        case 'addStrength':
          this.playerStrength += passive.effect.value;
          break;
        case 'addClock':
          this.addClock(passive.effect.value);
          break;
        case 'addShield':
          this.playerShield += passive.effect.value;
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
    const mult = (this.isOverclock && isDouble) ? 2 : 1;

    switch (card.id) {
      case 'STRIKE':
        this.damageEnemy(card.value * mult, targetEnemy);
        break;
      case 'DEFEND':
        this.playerShield += card.value * mult;
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
    // 敵の脆弱(Vulnerable)による被ダメージ1.5倍
    if (targetEnemy.vulnerable > 0) {
      amount = Math.floor(amount * 1.5);
    }

    const isDead = targetEnemy.takeDamage(amount);
    
    // そのターンの累積与ダメージに加算
    this.turnDamageDealt += amount;

    // コールバック通知（どの敵にダメージを与えたか targetEnemy も引き渡す）
    if (this.onEnemyDamage) this.onEnemyDamage(amount, targetEnemy);
    
    // 生存している敵が0体になったら即座に戦闘終了
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      this.endCombat(true);
    }
  }

  /** プレイヤーのターンを終了し、敵のターンに移行する */
  endPlayerTurn() {
    if (this.state !== 'PLAYER_TURN') return;
    
    // 剣士パッシブ: オーバークロック中のみ、そのターンに与えたダメージの30%分HP回復
    if (this.characterData && this.characterData.passive && this.characterData.passive.trigger === 'berserkVampire' && this.turnDamageDealt > 0) {
      if (this.isOverclock) {
        const vampHeal = Math.floor(this.turnDamageDealt * 0.30);
        if (vampHeal > 0) {
          this.healPlayer(vampHeal);
          if (this.onPassiveTrigger) {
            this.onPassiveTrigger(this.characterData.passive, vampHeal);
          }
        }
      }
    }

    this.state = 'ENEMY_TURN';
    if (this.onStateChange) this.onStateChange(this.state);
    
    // 一時的な攻撃力(Temp STR)の減衰
    if (this.playerTempStrength > 0) {
      this.playerStrength = Math.max(0, this.playerStrength - this.playerTempStrength);
      this.playerTempStrength = 0;
    }

    // 手札を捨て札へ
    this.deckManager.discardHand();
    
    // 生存している敵全員が順に行動を行う（シーケンシャル処理）
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);
    
    if (aliveEnemies.length === 0) {
      // 敵がいないなら即プレイヤーのターン
      this.startPlayerTurn();
      return;
    }

    let enemyIndex = 0;
    const executeNextEnemy = () => {
      if (this.playerHP <= 0 || this.state === 'COMBAT_END') return;

      if (enemyIndex < aliveEnemies.length) {
        const currentEnemy = aliveEnemies[enemyIndex];
        currentEnemy.startTurn();
        
        // プレイヤーに攻撃（攻撃元の敵自身を渡す）
        currentEnemy.executeAction(this, this);
        
        enemyIndex++;
        // 1体の敵の行動演出完了を待って次の敵の行動へ (1秒ディレイ)
        setTimeout(executeNextEnemy, 1000);
      } else {
        // 全員行動完了後、プレイヤーのターンを開始
        if (this.playerHP > 0 && this.state !== 'COMBAT_END') {
          this.startPlayerTurn();
        }
      }
    };

    // 敵のターン開始から最初の攻撃まで少し待つ
    setTimeout(executeNextEnemy, 800);
  }

  /** 戦闘終了処理 (勝利 / 敗北) */
  endCombat(playerWon) {
    if (this.state === 'COMBAT_END' || this.state === 'GAMEOVER') return;
    this.state = 'COMBAT_END';
    if (this.onStateChange) this.onStateChange(this.state, playerWon);
  }
}
