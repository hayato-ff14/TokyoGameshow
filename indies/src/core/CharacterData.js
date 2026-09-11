/**
 * CharacterData.js - キャラクター定義データ
 * 
 * 新キャラ追加手順:
 *   1. CHARACTER_DEFS 配列に新オブジェクトを追加
 *   2. startingDeck にカードIDの配列を指定
 *   3. passive オブジェクトでパッシブ能力を定義
 */

export const CHARACTER_DEFS = [
  {
    id: 'SWORDSMAN',
    name: 'BLADE.EXE',
    title: '近接攻撃プロトコル',
    description: '減少HPに応じて攻撃力が上昇（減少HP10ごとにSTR+1）。\nクロック10到達時：与ダメージ2倍 ＆ ターン与ダメージの30%をHP回復！',
    maxHP: 80,
    color: 0x00F5FF,
    accentColor: 0xFF007A,
    icon: 'sword',
    avatarUrl: '/assets/anime_blade.png',
    overclockType: 'vampiricBurst',

    // 初期デッキ: 攻撃寄りの構成
    startingDeck: [
      'STRIKE', 'STRIKE', 'STRIKE', 'STRIKE',
      'DEFEND', 'DEFEND', 'DEFEND',
      'WHIRLWIND_SLASH',
      'QUICK_SCAN',
      'TEMP_OVERBOOST',
      'SPIKE_WALL',
      'EXPLOIT'
    ],

    // パッシブ能力
    passive: {
      id: 'BLOOD_DRIVE',
      name: 'ブラッドドライブ',
      description: '減少HP10毎にSTR+1（オーバークロック時：与ダメージの30%をHP回復）',
      trigger: 'berserkVampire',
      maxStacks: Infinity
    }
  },
  {
    id: 'MAGE',
    name: 'HEX.EXE',
    title: 'スペル・コンパイラ',
    description: 'スキルカードを2枚使用するごとに永続的に魔力(STR)+1を獲得。\nクロック10到達時：そのターン発動する全カードの効果が2倍に倍増！',
    maxHP: 70,
    color: 0xA855F7,
    accentColor: 0xE9D5FF,
    icon: 'staff',
    avatarUrl: '/assets/anime_hex.png',
    overclockType: 'doubleEffect',

    // 初期デッキ: 魔法寄りの構成
    startingDeck: [
      'SPARK_FIRE', 'SPARK_FIRE', 'SPARK_FIRE',
      'MANA_SHIELD', 'MANA_SHIELD', 'MANA_SHIELD',
      'CHAIN_LIGHTNING',
      'LIGHTNING_BOLT',
      'MANA_REGEN',
      'FIRE_BALL'
    ],

    // パッシブ能力
    passive: {
      id: 'MANA_COMPILE',
      name: '魔法コンパイル',
      description: 'スキルカードを2枚使用するたび魔力(STR)+1獲得',
      trigger: 'onSkillCardEvery2',
      maxStacks: Infinity,
      effect: {
        type: 'addStrength',
        value: 1
      }
    }
  },
  {
    id: 'VIRUS',
    name: 'VIRUS.EXE',
    title: 'バイオ・ハッカー',
    description: 'スキルや攻撃カードを使用するたび敵に「感染 (DoT)」を与える。\n敵ターン終了時に感染値ぶんの直接ダメージ（シールド貫通）が継続発生！',
    maxHP: 75,
    color: 0x00FF66,
    accentColor: 0x84CC16,
    icon: 'circuit',
    avatarUrl: '/assets/anime_virus.png',
    overclockType: 'infectionBurst',

    // 初期デッキ: 毒・感染寄りの構成
    startingDeck: [
      'VIRUS_STRIKE', 'VIRUS_STRIKE', 'VIRUS_STRIKE',
      'DEFEND', 'DEFEND', 'DEFEND',
      'BIO_POISON',
      'CONTAGION_BURST',
      'TOXIC_BARRIER',
      'NEURO_TOXIN'
    ],

    // パッシブ能力
    passive: {
      id: 'CORROSIVE_INFECT',
      name: '腐食感染',
      description: '攻撃・スキル使用時に敵へ感染(DoT)+2付与',
      trigger: 'onSkillOrAttackPlayed',
      maxStacks: Infinity,
      effect: {
        type: 'addInfection',
        value: 2
      }
    }
  }
];

  // ── 将来のキャラクター追加例 ──
  // {
  //   id: 'HACKER',
  //   name: 'CIPHER.EXE',
  //   title: '暗号解析プロトコル',
  //   description: 'スキルカードを使うたびにCLOCK+1を追加で得る。\nオーバークロック到達が早い技巧型。',
  //   maxHP: 70,
  //   color: 0xA855F7,
  //   accentColor: 0x3B82F6,
  //   icon: 'circuit',
  //   startingDeck: [
  //     'STRIKE', 'STRIKE', 'STRIKE',
  //     'DEFEND', 'DEFEND', 'DEFEND', 'DEFEND',
  //     'OVERCLOCK', 'OVERCLOCK',
  //     'REBOOT',
  //     'SYSTEM_VULN'
  //   ],
  //   passive: {
  //     id: 'CLOCK_BOOST',
  //     name: 'クロックブースト',
  //     description: 'スキルカード使用時にCLOCK+1追加',
  //     trigger: 'onSkillCardPlayed',
  //     maxStacks: Infinity,
  //     effect: { type: 'addClock', value: 1 }
  //   }
  // }

/**
 * IDでキャラクターを検索する
 * @param {string} characterId
 * @returns {Object|undefined}
 */
export function getCharacterById(characterId) {
  return CHARACTER_DEFS.find(c => c.id === characterId);
}
