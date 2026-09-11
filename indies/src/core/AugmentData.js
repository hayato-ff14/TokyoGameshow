/**
 * AugmentData.js - キャラクター専用プロトコル・オーグメント定義
 */

export const CHARACTER_AUGMENTS = {
  SWORDSMAN: [
    {
      id: 'BLOODLUST_OVERLOAD',
      name: 'BLOODLUST OVERLOAD',
      title: '背水超強化プロトコル',
      icon: '⚔️',
      color: '#FF007A',
      desc: '減少HPに応じた攻撃力ボーナスが2倍に強化される（10ダメージ減少毎にSTR +2）。',
      rarity: 'HERO'
    },
    {
      id: 'DUAL_BLADE_SURGE',
      name: 'DUAL BLADE SURGE',
      title: '二天一閃連撃',
      icon: '🗡️',
      color: '#00F5FF',
      desc: '攻撃カードをプレイするたび、50%の確率でそのカードがコスト0で即座にもう一度連動発動する。',
      rarity: 'HERO'
    },
    {
      id: 'VAMPIRIC_FRENZY',
      name: 'VAMPIRIC FRENZY',
      title: '吸血狂乱ドライブ',
      icon: '🩸',
      color: '#A855F7',
      desc: 'オーバークロック発動時の吸血率が60%に激増し、HP満タン時の過剰回復量がシールドに変換される。',
      rarity: 'HERO'
    },
    {
      id: 'NANO_BLADE_REFLEX',
      name: 'NANO REFLEX',
      title: '超反応ナノブレード',
      icon: '⚡',
      color: '#00F5FF',
      desc: '攻撃カードをプレイするたび、即座に シールド +3 ＆ クロック +1 を獲得。',
      rarity: 'HERO'
    },
    {
      id: 'ARMOR_PIERCER',
      name: 'ARMOR PIERCER',
      title: '甲冑破壊一閃',
      icon: '🎯',
      color: '#FF3366',
      desc: '攻撃カードのダメージが敵のシールドを 50% 無視して貫通する。',
      rarity: 'HERO'
    },
    {
      id: 'BERSERK_REGENERATION',
      name: 'BERSERK REGEN',
      title: '背水自己修復',
      icon: '💚',
      color: '#10B981',
      desc: 'HPが50%以下になった時、毎ターン開始時に HP 4 回復 ＆ STR +1。',
      rarity: 'HERO'
    },
    {
      id: 'COUNTER_MATRIX',
      name: 'COUNTER MATRIX',
      title: 'カウンターマトリクス',
      icon: '🛡️',
      color: '#3B82F6',
      desc: 'シールドを獲得するたび、敵の攻撃に反撃するスパイク（トゲ） +3 を得る。',
      rarity: 'HERO'
    },
    {
      id: 'HEAVY_SLAM_MASTERY',
      name: 'HEAVY MASTERY',
      title: '重撃の極意',
      icon: '🔨',
      color: '#F59E0B',
      desc: 'コスト2以上の攻撃カードのダメージが +6 強化される。',
      rarity: 'HERO'
    },
    {
      id: 'OVERCLOCK_RELOAD',
      name: 'OVERCLOCK RELOAD',
      title: 'オーバードライブ・リロード',
      icon: '🔄',
      color: '#FFF000',
      desc: 'オーバークロック起動時、即座にカードを2枚ドローし手札の攻撃コストを全還元。',
      rarity: 'HERO'
    }
  ],

  MAGE: [
    {
      id: 'ARCANE_CASCADE',
      name: 'ARCANE CASCADE',
      title: 'スペルカスケード',
      icon: '🔮',
      color: '#A855F7',
      desc: 'スキルまたはバフカードを使用するたび、即座に シールド +4 ＆ 追加クロック +1 を獲得。',
      rarity: 'HERO'
    },
    {
      id: 'OVERCOMPILING',
      name: 'OVERCOMPILING',
      title: '極限オーバーコンパイル',
      icon: '🌟',
      color: '#FFF000',
      desc: 'オーバークロック発動中、すべての魔法スペルカードの威力とヒット数が 2倍 に増幅される。',
      rarity: 'HERO'
    },
    {
      id: 'MANA_RECYCLER',
      name: 'MANA RECYCLER',
      title: 'マナリサイクラー',
      icon: '⚡',
      color: '#00F5FF',
      desc: 'カードを使用するたび、50%の確率で メモリ（コスト）が 1 還元される。',
      rarity: 'HERO'
    },
    {
      id: 'SPELL_ACCELERATOR',
      name: 'SPELL ACCEL',
      title: 'スペルアクセラレーター',
      icon: '⏩',
      color: '#3B82F6',
      desc: 'スキルカード使用時、そのターン手札の全攻撃スペルのコストが -1 される。',
      rarity: 'HERO'
    },
    {
      id: 'ARCANE_SHIELDING',
      name: 'ARCANE SHIELD',
      title: '魔導防護展開',
      icon: '🛡️',
      color: '#A855F7',
      desc: '魔力(STR)が1上がるたび、即座に シールド +6 を自動獲得。',
      rarity: 'HERO'
    },
    {
      id: 'ELEMENTAL_BURST',
      name: 'ELEMENTAL BURST',
      title: 'エレメンタルバースト',
      icon: '🔥',
      color: '#EF4444',
      desc: '脆弱状態の敵に対する魔法攻撃の与ダメージが +50% 増加。',
      rarity: 'HERO'
    },
    {
      id: 'MANA_OVERFLOW',
      name: 'MANA OVERFLOW',
      title: 'マナオーバーフロー',
      icon: '💎',
      color: '#00F5FF',
      desc: '毎ターン開始時、最大メモリ（コスト）+1 ＆ ドロー枚数 +1。',
      rarity: 'HERO'
    },
    {
      id: 'CASCADE_COMPILER',
      name: 'CASCADE COMPILER',
      title: 'カスケードコンパイル',
      icon: '⚙️',
      color: '#E9D5FF',
      desc: 'パッシブ【魔法コンパイル】の必要スキル数が 2枚 ➡️ 1枚 に短縮（毎スキル魔力+1）。',
      rarity: 'HERO'
    },
    {
      id: 'SPELL_DRAIN',
      name: 'SPELL DRAIN',
      title: '魔力ドレインバリア',
      icon: '🌀',
      color: '#8B5CF6',
      desc: '魔法攻撃でダメージを与えた時、そのダメージの 25% をシールドに即時変換。',
      rarity: 'HERO'
    }
  ],

  VIRUS: [
    {
      id: 'EPIDEMIC_CARRIER',
      name: 'EPIDEMIC CARRIER',
      title: 'パンデミック感染拡散',
      icon: '☣️',
      color: '#00FF66',
      desc: '敵が感染(DoT)ダメージを受けるたび、生存している他の全敵にも同量の感染が伝染・拡散する。',
      rarity: 'HERO'
    },
    {
      id: 'ACIDIC_CORROSION',
      name: 'ACIDIC CORROSION',
      title: '強酸腐食バイパス',
      icon: '🧪',
      color: '#84CC16',
      desc: '感染(DoT)ダメージが敵のシールドを完全に無視して本体HPを直接侵食する。',
      rarity: 'HERO'
    },
    {
      id: 'BIO_REGENESIS',
      name: 'BIO REGENESIS',
      title: 'バイオ生命還元',
      icon: '🦠',
      color: '#10B981',
      desc: '敵に与えた全感染(DoT)ダメージの 30% ぶん、プレイヤーのHPが自動回復する。',
      rarity: 'HERO'
    },
    {
      id: 'TOXIC_OUTBREAK',
      name: 'TOXIC OUTBREAK',
      title: 'アウトブレイク発生',
      icon: '☣️',
      color: '#22C55E',
      desc: '戦闘開始時、生存している全敵に即座に 感染(DoT) +5 を付与する。',
      rarity: 'HERO'
    },
    {
      id: 'NEURO_PARALYSIS',
      name: 'NEURO PARALYSIS',
      title: '神経麻痺毒素',
      icon: '💉',
      color: '#A855F7',
      desc: '感染(DoT)が5以上付与されている敵の攻撃力を -3 減衰させる。',
      rarity: 'HERO'
    },
    {
      id: 'BIO_SHIELD_SYNERGY',
      name: 'BIO SHIELD',
      title: 'バイオバリア共鳴',
      icon: '🛡️',
      color: '#00FF66',
      desc: '敵に感染(DoT)を付与するたび、自分に シールド +3 を獲得する。',
      rarity: 'HERO'
    },
    {
      id: 'CONTAGION_ACCELERATOR',
      name: 'CONTAGION ACCEL',
      title: '感染爆発アクセル',
      icon: '💥',
      color: '#F59E0B',
      desc: 'CONTAGION BURST による感染増幅率が 1.5倍 ➡️ 2.2倍 に激増する。',
      rarity: 'HERO'
    },
    {
      id: 'EVERLASTING_DECAY',
      name: 'EVERLASTING DECAY',
      title: '永続腐食増殖',
      icon: '🧬',
      color: '#84CC16',
      desc: '毎ターン開始時、全敵の感染(DoT)スタック数が減少せず、逆に +1 ずつ自動増殖する。',
      rarity: 'HERO'
    },
    {
      id: 'VIRAL_OVERCLOCK',
      name: 'VIRAL OVERCLOCK',
      title: 'バイラル・オーバークロック',
      icon: '⚡',
      color: '#00FF66',
      desc: 'オーバークロック発動時、即座に全敵の感染(DoT)スタック数を 2倍 に倍増させる。',
      rarity: 'HERO'
    }
  ]
};

/**
 * まだ取得していないオーグメントから3つをランダム選出する
 * @param {string} charId 
 * @param {string[]} activeAugmentIds 
 * @returns {Object[]}
 */
export function getAugmentSelectionPool(charId, activeAugmentIds = []) {
  const pool = (CHARACTER_AUGMENTS[charId] || CHARACTER_AUGMENTS.SWORDSMAN).filter(
    aug => !activeAugmentIds.includes(aug.id)
  );

  const selected = [];
  const copy = [...pool];
  while (selected.length < 3 && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(idx, 1)[0]);
  }
  return selected;
}

export function getAugmentsForCharacter(charId) {
  return CHARACTER_AUGMENTS[charId] || CHARACTER_AUGMENTS.SWORDSMAN;
}
