/**
 * EnemyAI.js - 敵のAIステート・行動パターン定義
 */

export const ENEMY_INTENTS = {
  ATTACK: 'attack',
  DEFEND: 'defend',
  MIXED: 'mixed',
  BUFF: 'buff'
};

export class EnemyAI {
  constructor(name = 'VIRUS.BUG', maxHp = 80, instanceId = null) {
    this.name = name;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.shield = 0;
    this.strength = 0;
    this.vulnerable = 0;
    this.instanceId = instanceId || `enemy_${Date.now()}_${Math.random()}`;
    
    this.actionCycle = [
      { type: ENEMY_INTENTS.DEFEND, value: 8, desc: '防御シールドを展開 (8)' },
      { type: ENEMY_INTENTS.ATTACK, value: 10, desc: 'トロジャンアタック (10ダメージ)' },
      { type: ENEMY_INTENTS.ATTACK, value: 4, count: 3, desc: 'バッファ・スパーク (4ダメージ x3回)' },
      { type: ENEMY_INTENTS.MIXED, value: 7, shieldValue: 6, desc: 'マルウェアスキャン (7ダメージ & 6シールド)' }
    ];
    this.cycleIndex = 0;
    this.nextAction = null;
    this.decideNextAction();
  }

  /** 次のターンの行動（インテント）を決定する */
  decideNextAction() {
    this.nextAction = this.actionCycle[this.cycleIndex];
    this.cycleIndex = (this.cycleIndex + 1) % this.actionCycle.length;
  }

  /** ダメージを受ける処理。シールド優先で吸収 */
  takeDamage(amount) {
    if (this.shield > 0) {
      if (amount <= this.shield) {
        this.shield -= amount;
        amount = 0;
      } else {
        amount -= this.shield;
        this.shield = 0;
      }
    }
    
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  /** シールドを獲得する */
  gainShield(amount) {
    this.shield += amount;
  }

  /** 敵のターン開始時の処理 */
  startTurn() {
    this.shield = 0;
    if (this.vulnerable > 0) {
      this.vulnerable--;
    }
  }

  /** プレイヤーに対して行動を実行する */
  executeAction(player, combatEngine) {
    const action = this.nextAction;
    if (!action) return;

    if (action.type === ENEMY_INTENTS.ATTACK) {
      const count = action.count || 1;
      for (let i = 0; i < count; i++) {
        combatEngine.damagePlayer(action.value);
      }
    } else if (action.type === ENEMY_INTENTS.DEFEND) {
      this.gainShield(action.value);
    } else if (action.type === ENEMY_INTENTS.MIXED) {
      combatEngine.damagePlayer(action.value);
      this.gainShield(action.shieldValue);
    }

    // 次のターンの意図をあらかじめ決定
    this.decideNextAction();
  }
}
