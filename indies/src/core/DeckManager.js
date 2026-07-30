/**
 * DeckManager.js - カード定義およびデッキ配列表現の管理
 */

export const CARD_DEFS = {
  STRIKE: {
    id: 'STRIKE',
    name: 'STRIKE',
    cost: 1,
    type: 'attack',
    class: 'NEUTRAL',
    value: 6,
    clock: 1,
    desc: '敵に6ダメージを与える\nCLOCK +1'
  },
  DEFEND: {
    id: 'DEFEND',
    name: 'DEFEND',
    cost: 1,
    type: 'skill',
    class: 'NEUTRAL',
    value: 5,
    clock: 1,
    desc: 'シールドを5得る\nCLOCK +1'
  },
  OVERCLOCK: {
    id: 'OVERCLOCK',
    name: 'OVERCLOCK',
    cost: 0,
    type: 'buff',
    class: 'NEUTRAL',
    value: 0,
    clock: 3,
    desc: 'CLOCK +3\nカードを1枚引く'
  },
  BURST_SCAN: {
    id: 'BURST_SCAN',
    name: 'BURST SCAN',
    cost: 2,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 15,
    clock: 2,
    desc: '敵に15ダメージを与える\nCLOCK +2'
  },
  FIREWALL: {
    id: 'FIREWALL',
    name: 'FIREWALL',
    cost: 2,
    type: 'skill',
    class: 'SWORDSMAN',
    value: 12,
    clock: 2,
    desc: 'シールドを12得る\nCLOCK +2'
  },
  BUFFER_OVERFLOW: {
    id: 'BUFFER_OVERFLOW',
    name: 'BUFF OVERFLOW',
    cost: 1,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 3,
    clock: 2,
    desc: '敵に3ダメージを3回与える\nCLOCK +2'
  },
  REBOOT: {
    id: 'REBOOT',
    name: 'REBOOT',
    cost: 1,
    type: 'skill',
    class: 'NEUTRAL',
    value: 0,
    clock: 1,
    desc: '手札をすべて捨て\nカードを5枚引く\nCLOCK +1'
  },
  OVERLOAD_CHARGE: {
    id: 'OVERLOAD_CHARGE',
    name: 'OVERLOAD CHG',
    cost: 1,
    type: 'buff',
    class: 'SWORDSMAN',
    value: 2,
    clock: 2,
    desc: '攻撃力(STR) +2を得る\nCLOCK +2'
  },
  SYSTEM_VULN: {
    id: 'SYSTEM_VULN',
    name: 'SYS VULN',
    cost: 1,
    type: 'skill',
    class: 'SWORDSMAN',
    value: 2,
    clock: 1,
    desc: '敵に脆弱(VULN)\n2ターンを付与する\nCLOCK +1'
  },
  EXPLOIT: {
    id: 'EXPLOIT',
    name: 'EXPLOIT',
    cost: 1,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 8,
    clock: 1,
    desc: '敵に8ダメージ\n敵が脆弱なら12ダメージ\nCLOCK +1'
  },
  QUICK_SCAN: {
    id: 'QUICK_SCAN',
    name: 'QUICK SCAN',
    cost: 0,
    type: 'skill',
    class: 'NEUTRAL',
    value: 1,
    clock: 1,
    desc: 'カードを1枚引く\nCLOCK +1'
  },
  MEM_DUMP: {
    id: 'MEM_DUMP',
    name: 'MEM DUMP',
    cost: 1,
    type: 'skill',
    class: 'NEUTRAL',
    value: 2,
    clock: 2,
    desc: 'カードを2枚引く\n手札を1枚捨てる\nCLOCK +2'
  },
  TEMP_OVERBOOST: {
    id: 'TEMP_OVERBOOST',
    name: 'TEMP BOOST',
    cost: 1,
    type: 'buff',
    class: 'SWORDSMAN',
    value: 4,
    clock: 2,
    desc: 'このターンのみSTR +4\n(ターン終了時にSTR -4)\nCLOCK +2'
  },
  SPIKE_WALL: {
    id: 'SPIKE_WALL',
    name: 'SPIKE WALL',
    cost: 2,
    type: 'skill',
    class: 'SWORDSMAN',
    value: 8,
    clock: 1,
    desc: 'シールドを8得る\n被ダメージ時に4反射する\nCLOCK +1'
  },
  DELAYED_SHIELD: {
    id: 'DELAYED_SHIELD',
    name: 'DELAY SHLD',
    cost: 1,
    type: 'skill',
    class: 'SWORDSMAN',
    value: 10,
    clock: 1,
    desc: '次のターン開始時に\nシールドを10得る\nCLOCK +1'
  },
  FORCE_QUIT: {
    id: 'FORCE_QUIT',
    name: 'FORCE QUIT',
    cost: 3,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 22,
    clock: 3,
    desc: '敵に22ダメージを与える\n手札のランダムカードを\n1枚この戦闘から除外する'
  },
  SPARK_FIRE: {
    id: 'SPARK_FIRE',
    name: 'SPARK FIRE',
    cost: 1,
    type: 'attack',
    class: 'MAGE',
    value: 5,
    clock: 2,
    desc: '敵に5ダメージを与える\nCLOCK +2'
  },
  MANA_SHIELD: {
    id: 'MANA_SHIELD',
    name: 'MANA SHIELD',
    cost: 1,
    type: 'skill',
    class: 'MAGE',
    value: 4,
    clock: 2,
    desc: 'シールドを4得る\nCLOCK +2'
  },
  LIGHTNING_BOLT: {
    id: 'LIGHTNING_BOLT',
    name: 'LIGHTNING BLT',
    cost: 1,
    type: 'attack',
    class: 'MAGE',
    value: 7,
    clock: 3,
    desc: '敵に7ダメージを与える\nCLOCK +3'
  },
  MANA_REGEN: {
    id: 'MANA_REGEN',
    name: 'MANA REGEN',
    cost: 0,
    type: 'buff',
    class: 'MAGE',
    value: 1,
    clock: 1,
    desc: 'メモリを1獲得する\nCLOCK +1\n(使用後、除外される)'
  },
  FIRE_BALL: {
    id: 'FIRE_BALL',
    name: 'FIRE BALL',
    cost: 2,
    type: 'attack',
    class: 'MAGE',
    value: 12,
    clock: 2,
    desc: '敵に12ダメージを与える\n敵に脆弱 1を付与\nCLOCK +2'
  },
  ARCANE_BURST: {
    id: 'ARCANE_BURST',
    name: 'ARCANE BURST',
    cost: 3,
    type: 'attack',
    class: 'MAGE',
    value: 24,
    clock: 3,
    desc: '敵に24ダメージを与える\nCLOCK +3'
  },
  AETHER_BARRIER: {
    id: 'AETHER_BARRIER',
    name: 'AETHER BARR',
    cost: 2,
    type: 'skill',
    class: 'MAGE',
    value: 15,
    clock: 3,
    desc: 'シールドを15得る\nCLOCK +3'
  },
  WHIRLWIND_SLASH: {
    id: 'WHIRLWIND_SLASH',
    name: 'WHIRLWIND CUT',
    cost: 2,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 9,
    clock: 2,
    desc: '敵全体に9ダメージを与える\nCLOCK +2'
  },
  BLADE_STORM: {
    id: 'BLADE_STORM',
    name: 'BLADE STORM',
    cost: 3,
    type: 'attack',
    class: 'SWORDSMAN',
    value: 14,
    clock: 3,
    desc: '敵全体に14ダメージを与える\nCLOCK +3'
  },
  CHAIN_LIGHTNING: {
    id: 'CHAIN_LIGHTNING',
    name: 'CHAIN LIGHTNING',
    cost: 2,
    type: 'attack',
    class: 'MAGE',
    value: 10,
    clock: 3,
    desc: '敵全体に10ダメージを与える\nCLOCK +3'
  },
  SUPERNOVA: {
    id: 'SUPERNOVA',
    name: 'SUPERNOVA',
    cost: 3,
    type: 'attack',
    class: 'MAGE',
    value: 18,
    clock: 4,
    desc: '敵全体に18ダメージを与える\nCLOCK +4'
  },
  EMP_WAVE: {
    id: 'EMP_WAVE',
    name: 'EMP WAVE',
    cost: 1,
    type: 'attack',
    class: 'NEUTRAL',
    value: 4,
    clock: 2,
    desc: '敵全体に4ダメージを与える\n敵全体のSTR -1\nCLOCK +2'
  },
  SYSTEM_RESTORE: {
    id: 'SYSTEM_RESTORE',
    name: 'SYS RESTORE',
    cost: 1,
    type: 'skill',
    class: 'NEUTRAL',
    value: 12,
    clock: 1,
    desc: 'HPを12回復する\nCLOCK +1\n(使用後、除外される)'
  },
  OVERHEAL_BARRIER: {
    id: 'OVERHEAL_BARRIER',
    name: 'OVERHEAL',
    cost: 2,
    type: 'skill',
    class: 'SWORDSMAN',
    value: 16,
    clock: 2,
    desc: 'シールドを16得る\nHPを5回復する\nCLOCK +2'
  },
  HOLY_COMPILER: {
    id: 'HOLY_COMPILER',
    name: 'HOLY COMPILE',
    cost: 2,
    type: 'skill',
    class: 'MAGE',
    value: 12,
    clock: 2,
    desc: 'シールドを12得る\nHPを8回復する\nCLOCK +2'
  }
};

/**
 * キャラクターIDに応じた出現可能カードプールを取得する
 * @param {string} characterId - 'SWORDSMAN' | 'MAGE'
 * @returns {Object[]}
 */
export function getAvailableCardsForCharacter(characterId) {
  return Object.values(CARD_DEFS).filter(card => {
    // 基本スターターカード (STRIKE, DEFEND, SPARK_FIRE, MANA_SHIELD) はショップ/ドラフトから除外
    if (['STRIKE', 'DEFEND', 'SPARK_FIRE', 'MANA_SHIELD'].includes(card.id)) return false;
    
    const cardClass = card.class || 'NEUTRAL';
    return cardClass === 'NEUTRAL' || cardClass === characterId;
  });
}

export class DeckManager {
  constructor() {
    this.masterDeck = [];
    this.drawPile = [];
    this.hand = [];
    this.discardPile = [];
  }

  /** 
   * 初期マスターデッキの設定
   * @param {string[]} [startingDeckIds] - カードID配列。省略時はデフォルトデッキ。
   */
  initializeMasterDeck(startingDeckIds = null) {
    if (startingDeckIds && startingDeckIds.length > 0) {
      // キャラクター固有デッキ
      this.masterDeck = startingDeckIds
        .filter(id => CARD_DEFS[id])
        .map(id => ({ ...CARD_DEFS[id] }));
    } else {
      // デフォルトデッキ
      this.masterDeck = [
        { ...CARD_DEFS.STRIKE },
        { ...CARD_DEFS.STRIKE },
        { ...CARD_DEFS.STRIKE },
        { ...CARD_DEFS.STRIKE },
        { ...CARD_DEFS.DEFEND },
        { ...CARD_DEFS.DEFEND },
        { ...CARD_DEFS.DEFEND },
        { ...CARD_DEFS.OVERCLOCK },
        { ...CARD_DEFS.REBOOT },
        { ...CARD_DEFS.OVERLOAD_CHARGE },
        { ...CARD_DEFS.SYSTEM_VULN },
        { ...CARD_DEFS.EXPLOIT }
      ];
    }
  }

  /** バトル開始時にマスターデッキから山札をコピーして準備 */
  setupStartingDeck() {
    this.drawPile = this.masterDeck.map((c, idx) => ({ 
      ...c, 
      instanceId: `${c.id}_${idx}_${Date.now()}` 
    }));

    this.hand = [];
    this.discardPile = [];
    this.shuffle(this.drawPile);
  }

  /** 配列のシャッフル (フィッシャー・イェーツ) */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /** 指定枚数ドローする。山札が切れたら捨て札をシャッフルして戻す */
  drawCard(count = 1, onDrawCallback = null) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) {
          break; // 山札も捨て札も空
        }
        // 捨て札を山札に移動してシャッフル
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
        this.shuffle(this.drawPile);
      }
      
      const card = this.drawPile.pop();
      this.hand.push(card);
      drawn.push(card);
      if (onDrawCallback) onDrawCallback(card);
    }
    return drawn;
  }

  /** カードを手札から使用し、捨て札へ送る */
  useCard(cardInstance) {
    const idx = this.hand.findIndex(c => c.instanceId === cardInstance.instanceId);
    if (idx !== -1) {
      const card = this.hand.splice(idx, 1)[0];
      this.discardPile.push(card);
      return card;
    }
    return null;
  }

  /** 手札をすべて捨て札に送る */
  discardHand() {
    this.discardPile.push(...this.hand);
    this.hand = [];
  }

  /** 手札からランダムに1枚捨て札に送る */
  discardRandomCard() {
    if (this.hand.length === 0) return null;
    const rIdx = Math.floor(Math.random() * this.hand.length);
    const card = this.hand.splice(rIdx, 1)[0];
    this.discardPile.push(card);
    return card;
  }

  /** カードを戦闘から完全除外（消滅）する */
  exhaustCard(cardInstance) {
    // 手札から探す
    let idx = this.hand.findIndex(c => c.instanceId === cardInstance.instanceId);
    if (idx !== -1) {
      return this.hand.splice(idx, 1)[0];
    }
    // 山札から探す
    idx = this.drawPile.findIndex(c => c.instanceId === cardInstance.instanceId);
    if (idx !== -1) {
      return this.drawPile.splice(idx, 1)[0];
    }
    // 捨て札から探す
    idx = this.discardPile.findIndex(c => c.instanceId === cardInstance.instanceId);
    if (idx !== -1) {
      return this.discardPile.splice(idx, 1)[0];
    }
    return null;
  }
}
