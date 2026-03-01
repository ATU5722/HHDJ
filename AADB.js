// ==UserScript==
// @name         AADB
// @version      3.3.6
// @author       D 
// @include      http*://hentaiverse.org/*
// @include      http*://alt.hentaiverse.org/*
// @include      https://e-hentai.org/*
// @exclude      http*://hentaiverse.org/pages/showequip.php?*
// @exclude      http*://alt.hentaiverse.org/pages/showequip.php?*
// @grant        GM_deleteValue
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @connect      e-hentai.org
// @connect      hentaiverse.org
// @connect      alt.hentaiverse.org
// @run-at       document-end
// ==/UserScript==
/* eslint-disable camelcase */

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                          AAD Modular Architecture                           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ==================== 全局常量和配置 ====================
const GAME_MECHANICS = {
  BUFF_SLOT_LIMIT: 6,              // Buff槽位上限（不要修改）
  DEBUFF_EFFECTIVE_TURNS: 2,       // Debuff有效回合阈值（谨慎修改）
  DAILY_RESET_RANDOM_MIN_MINUTES: 30, // 每日重置延迟最小分钟数
  DAILY_RESET_RANDOM_MAX_MINUTES: 150, // 每日重置延迟最大分钟数
  ENCOUNTER_INTERVAL_MIN_MINUTES: 31, // 遭遇战间隔最小分钟数（不能少于30）
  ENCOUNTER_INTERVAL_MAX_MINUTES: 50, // 遭遇战间隔最大分钟数
  AOE_T3_RANGE_ISEKAI: 9,          // 异世界T3施法范围
};

const IW_TASK_STATUS = Object.freeze({
  WAITING: 'waiting',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error'
});

const IW_TASK_STATUS_LABELS = Object.freeze({
  [IW_TASK_STATUS.WAITING]: '等待',
  [IW_TASK_STATUS.RUNNING]: '进行',
  [IW_TASK_STATUS.DONE]: '完成',
  [IW_TASK_STATUS.ERROR]: '错误'
});

// ==================== 常量定义 ====================
// 统计计算相关的数值字段定义
const STATISTICS_NUMERIC_FIELDS = [
  'rounds', 'turns', 'exp', 'credit', 'revenue', 'cost', 'profit', 'profit_without_ed',
  'artifacts', 'blood', 'chaos', 'legendary', 'peerless', 'potions', 'scrolls', 'gems', 'horse', 'spark',
  'potion_net_income', 'scroll_net_income', 'attack_spells', 'support_spells', 'heal_spells', 'debuff_spells'
];

// 战斗统计表格列定义
const dbTableColumnsAll = {
  '基础数据': [
    { column_name: '时间', field: 'timestamp', id: 'col_timestamp', default: false },
    { column_name: '类型', field: 'battle_type', id: 'col_battle_type', default: false },
    { column_name: '层数', field: 'rounds', tooltip: 'defeat_log', id: 'col_rounds', default: false },
    { column_name: '回合', field: 'turns', id: 'col_turns', default: false },
    { column_name: '时长', field: 'duration', id: 'col_duration', default: false },
    { column_name: 'TPS', field: 'tps', id: 'col_tps', default: false },
    { column_name: '小马图', field: 'horse', id: 'col_horse', default: false },
    { column_name: '火花', field: 'spark', id: 'col_spark', default: false },
    { column_name: '传说', field: 'legendary', tooltip: 'legendary_details', id: 'col_legendary', default: false },
    { column_name: '无双', field: 'peerless', tooltip: 'peerless_details', id: 'col_peerless', default: false }
  ],
  '收入消耗': [
    { column_name: '经验', field: 'exp', tooltip: 'exp_details', id: 'col_exp', default: false },
    { column_name: 'C', field: 'credit', id: 'col_credit', default: false },
    { column_name: '收入', field: 'revenue', id: 'col_revenue', default: false },
    { column_name: '消耗', field: 'cost', id: 'col_cost', default: false },
    { column_name: '利润', field: 'profit', id: 'col_profit', default: false },
    { column_name: '无ed环利润', field: 'profit_without_ed', id: 'col_profit_without_ed', default: false }
  ],
  '掉落详情': [
    { column_name: '文物', field: 'artifacts', tooltip: null, id: 'col_artifacts', default: false },
    { column_name: '血牌', field: 'blood', tooltip: null, id: 'col_blood', default: false },
    { column_name: '混牌', field: 'chaos', id: 'col_chaos', default: false }
  ],
  '消耗品使用': [
    { column_name: '药水', field: 'potions', tooltip: 'potion_details', id: 'col_potions', default: false },
    { column_name: '卷轴', field: 'scrolls', tooltip: 'scroll_details', id: 'col_scrolls', default: false },
    { column_name: '宝石', field: 'gems', tooltip: 'gem_details', id: 'col_gems', default: false },
    { column_name: '药水净收入', field: 'potion_net_income', tooltip: 'potion_net_details', id: 'col_potion_net', default: false },
    { column_name: '卷轴净收入', field: 'scroll_net_income', tooltip: 'scroll_net_details', id: 'col_scroll_net', default: false }
  ],
  '技能使用': [
    { column_name: '攻击', field: 'attack_spells', tooltip: 'attack_spell_details', id: 'col_attack_spells', default: false },
    { column_name: '辅助', field: 'support_spells', tooltip: 'support_spell_details', id: 'col_support_spells', default: false },
    { column_name: '治疗', field: 'heal_spells', tooltip: 'heal_spell_details', id: 'col_heal_spells', default: false },
    { column_name: 'Debuff', field: 'debuff_spells', tooltip: 'debuff_spell_details', id: 'col_debuff_spells', default: false }
  ]
};


// 技能列表常量
const SPELL_LISTS = {
  ATTACK: [
    'Paradise Lost', 'Banishment', 'Smite', 'Shockblast', 'Chained Lightning',
    'Wrath of Thor', 'Fiery Blast', 'Inferno', 'Flames of Loki', 'Freeze',
    'Blizzard', 'Fimbulvetr', 'Gale', 'Downburst', 'Storms of Njord',
    'Corruption', 'Disintegrate', 'Ragnarok',
    'FUS RO DAH', 'Orbital Friendship Cannon',
    'Shield Bash', 'Vital Strike', 'Merciful Blow',
    'Great Cleave', 'Rending Blow', 'Shatter Strike',
    'Iris Strike', 'Backstab', 'Frenzied Blows',
    'Skyward Sword',
    'Concussive Strike'
  ],
  SUPPORT: ['Regen', 'Arcane Focus', 'Heartseeker', 'Protection', 'Haste'],
  HEAL: ['Full-Cure', 'Cure'],
  DEBUFF: ['Sleep', 'Blind', 'Slow', 'Imperil', 'Immobilize', 'Silence', 'Drain', 'Weaken', 'Confuse']
};

// 物品列表常量
const ITEM_LISTS = {
  POTIONS: ['Health Potion', 'Mana Potion', 'Spirit Potion',
            'Health Elixir', 'Mana Elixir', 'Spirit Elixir',
            'Health Draught', 'Mana Draught', 'Spirit Draught', 'Last Elixir'],
  SCROLLS: ['Scroll of the Gods', 'Scroll of the Avatar', 'Scroll of Protection',
            'Scroll of Swiftness', 'Scroll of Life', 'Scroll of Shadows', 'Scroll of Absorption'],
  GEMS: ['Health Gem', 'Mana Gem', 'Spirit Gem', 'Mystic Gem']
};

// 可释放目录（技能/物品）
const CAST_SUPPORT = {
  Pr: { id: '411', img: 'protection' },
  SL: { id: '422', img: 'sparklife' },
  SS: { id: '423', img: 'spiritshield' },
  Ha: { id: '412', img: 'haste' },
  AF: { id: '432', img: 'arcanemeditation' },
  He: { id: '431', img: 'heartseeker' },
  Re: { id: '312', img: 'regen' },
  SV: { id: '413', img: 'shadowveil' },
  Ab: { id: '421', img: 'absorb' }
};

const CAST_BUFF_ITEMS = {
  HD: { id: 11191, img: 'healthpot' },
  MD: { id: 11291, img: 'manapot' },
  SD: { id: 11391, img: 'spiritpot' },
  FV: { id: 19111, img: 'flowers' },
  BG: { id: 19131, img: 'gum' }
};

const CAST_ITEMS = {
  Cure: { id: 311 },
  FC: { id: 313 },
  HP: { id: 11195 },
  HE: { id: 11199 },
  MP: { id: 11295 },
  ME: { id: 11299 },
  SP: { id: 11395 },
  SE: { id: 11399 },
  LE: { id: 11501 },
  ED: { id: 11401 }
};

const CAST_SCROLLS = {
  Go: { id: 13299, buffImgs: ['shadowveil'] },
  Av: { id: 13199, buffImgs: ['haste', 'protection'] },
  Pr: { id: 13111, buffImgs: ['protection'] },
  Sw: { id: 13101, buffImgs: ['haste'] },
  Li: { id: 13221, buffImgs: ['sparklife'] },
  Sh: { id: 13211, buffImgs: ['shadowveil'] },
  Ab: { id: 13201, buffImgs: ['absorb'] }
};

const CAST_INFUSIONS = [null, {
  id: 12101,img: 'fireinfusion'
}, {
  id: 12201,img: 'coldinfusion'
}, {
  id: 12301,img: 'elecinfusion'
}, {
  id: 12401,img: 'windinfusion'
}, {
  id: 12501,img: 'holyinfusion'
}, {
  id: 12601,img: 'darkinfusion'
}];

const SPECIAL_SKILLS = {
  OFC: { id: '1111', oc: 8 },
  FRD: { id: '1101', oc: 4 },
  Cor: { id: '161', oc: 0 },
  Smi: { id: '151', oc: 0 },
  T3: { idSuffix: '03', oc: 2 },
  T2: { idSuffix: '02', oc: 2 },
  T1: { idSuffix: '01', oc: 2 }
};

// 可释放Debuff目录
const DEBUFF_CAST = {
  Sle: { id: '222', img: 'sleep', conflicts: ['wpn_bleed'] },
  Bl: { id: '231', img: 'blind', conflicts: [] },
  Slo: { id: '221', img: 'slow', conflicts: [] },
  Im: { id: '213', img: 'imperil', conflicts: [] },
  MN: { id: '233', img: 'magnet', conflicts: ['sleep'] },
  Si: { id: '232', img: 'silence', conflicts: ['sleep'] },
  Dr: { id: '211', img: 'drain', conflicts: [] },
  We: { id: '212', img: 'weaken', conflicts: ['sleep'] },
  Co: { id: '223', img: 'confusion', conflicts: [] }
};

// 状态识别目录
const DEBUFF_STATUS = {
  Sle: { img: 'sleep' },
  Bl: { img: 'blind' },
  Slo: { img: 'slow' },
  Im: { img: 'imperil' },
  MN: { img: 'magnet' },
  Si: { img: 'silence' },
  Dr: { img: 'drain' },
  We: { img: 'weaken' },
  Co: { img: 'confusion' },
  CM: { img: 'coalescedmana' },
  Stun: { img: 'wpn_stun' },
  PA: { img: 'wpn_ap' },
  BW: { img: 'wpn_bleed' }
};


// ==================== 数据工具系统 ====================
//物品统计工具
const ItemStatsUtil = {  
  _cache: new WeakMap(),

  getUsageData(combatData, type = 'items') {
    let typeCache = this._cache.get(combatData);
    if (!typeCache) {
      typeCache = {};
      this._cache.set(combatData, typeCache);
    }

    if (typeCache[type]) {
      return typeCache[type];
    }

    const data = type === 'magic'
      ? (combatData.magic || {})
      : (combatData.items || {});

    typeCache[type] = data;
    return data;
  },

  countItems(combatData, itemList, type = 'items') {
    const usageData = this.getUsageData(combatData, type);
    let count = 0;
    for (let i = 0; i < itemList.length; i++) {
      count += usageData[itemList[i]] || 0;
    }
    return count;
  },

  getItemDetails(combatData, itemList, type = 'items', nameTransformer = null) {
    const usageData = this.getUsageData(combatData, type);
    const details = [];
    for (let i = 0; i < itemList.length; i++) {
      const item = itemList[i];
      const count = usageData[item];
      if (count > 0) {
        const displayName = nameTransformer ? nameTransformer(item) : item;
        details.push(`${displayName}: ${count}`);
      }
    }
    return details;
  }
};


// ==================== Global AAD Namespace ====================
const AAD = {
  NAME: "[HV]AAD Modular",

  // Runtime状态驱动系统
  Runtime: {
    pageType: null, // 'battle'(战斗) | 'main'(主世界) | 'isekai'(异世界) | 'riddle'(答题) | 'ehentai'(外部页面)
    initialized: false,
    battleActive: false,

    // 世界检测方法
    isIsekai() {
      return /\/isekai\//.test(window.location.pathname);
    },

    isBattlePage() {
      return this.pageType === 'battle';
    },

    // 页面类型检测方法
    detectPageType() {
      const host = window.location.host;

      if (host === 'e-hentai.org') {
        return 'ehentai';
      }

      if (AAD.Utils.DOM.gE('#riddlecounter')) {
        return 'riddle';
      }

      if (!AAD.Utils.DOM.gE('#navbar')) {
        return 'battle';
      }

      // 世界页面检测（主世界/异世界，基于URL路径精确判断）
      if (this.isIsekai()) {
        return 'isekai';
      } else {
        return 'main';
      }
    },

    // 初始化Runtime状态
    init() {
      this.pageType = this.detectPageType();
      this.initialized = true;
      console.log(`[AAD运行时] 页面类型: ${this.pageType}`);
    },

    // 页面刷新，重新初始化脚本
    refreshPage() {
      window.location.href = window.location;
    }
  },

  // 核心服务层 - 基础设施，按需加载不影响启动性能
  Core: {
    // ==================== 预设配置常量 ====================
    PRESET_CONFIGS: {
      config1: {
        name: '元素法师',
        description: '基本设置，可用于AR ,40锻造可用于 GF，设置法系后使用',
        config: JSON.parse('{"channelSkillSwitch":true,"buffSkillSwitch":true,"debuffSkillSwitch":true,"scrollSwitch":true,"dataRecordSwitch":true,"autoshard":true,"autoshardlist":"FC","autobuylist":"MP,SP,SW,SC,EC","staminaLow":15,"item":{"Cure":true,"FC":true,"HP":true,"HE":true,"MP":true,"ME":true,"SP":true,"SE":true,"LE":true,"ED":true,"HealthGem":true,"ManaGem":true,"SpiritGem":true,"MysticGem":true},"itemCureCondition":{"0":["hp,4,35","roundType,6,\u0027gr\u0027"],"1":["hp,4,45","hp,3,23","roundType,5,\u0027gr\u0027"],"2":["hp,4,48","_isCd_313,5,1","_isCd_11195,5,1"],"3":["hp,4,48","_isCd_313,5,1","roundNow,3,700"],"4":["hp,4,55","hp,3,23","sp,4,45"]},"itemFCCondition":{"0":["hp,4,21"],"1":["hp,4,23","roundType,5,\u0027gr\u0027"]},"itemHPCondition":{"0":["hp,4,30","roundType,6,\u0027gr\u0027"],"1":["hp,4,30","hp,3,23"],"2":["hp,4,25","_isCd_313,5,1"]},"itemHECondition":{"0":["hp,4,21","roundType,6,\u0027gr\u0027"],"1":["hp,4,1"]},"itemMPCondition":{"0":["mp,4,38"],"2":["mp,4,55","roundType,5,\u0027gr\u0027","roundNow,1,500"]},"itemMECondition":{"0":["mp,4,12"],"1":["mp,4,30","_buffTurn_sparklife,5,0"]},"itemSPCondition":{"0":["sp,4,45"],"1":["sp,4,55","roundType,5,\u0027gr\u0027"]},"itemSECondition":{"0":["sp,4,31","_scrollTurn_sparklife,5,0","roundNow,4,800"],"1":["sp,4,16","_scrollTurn_sparklife,6,0"],"2":["sp,4,31","_scrollTurn_sparklife,5,0","_isCd_13221,5,1"]},"itemLECondition":{"0":["sp,4,31","_scrollTurn_sparklife,5,0","roundNow,4,800"],"1":["sp,4,16","_scrollTurn_sparklife,6,0"],"2":["sp,4,31","_scrollTurn_sparklife,5,0","_isCd_13221,5,1"]},"itemEDCondition":{"0":["roundType,5,\u0027gr\u0027","roundNow,5,300"],"1":["roundType,5,\u0027gr\u0027","roundNow,5,600"]},"itemManaGemCondition":{"0":["mp,2,80"]},"channelSkill":{"AF":true,"Re":true},"channelSkillAFCondition":{"0":["_buffTurn_arcanemeditation,2,150"]},"channelSkillReCondition":{"0":["_buffTurn_regen,2,100"]},"buffSkill":{"HD":true,"MD":true,"SD":true,"AF":true,"Re":true},"buffSkillHDCondition":{"0":["hp,2,70"],"1":["hp,2,90","roundType,5,\u0027gr\u0027"]},"buffSkillMDCondition":{"0":["mp,2,80","roundType,6,\u0027ba\u0027"],"1":["mp,2,90","roundType,5,\u0027gr\u0027","roundNow,3,100"]},"buffSkillSDCondition":{"0":["sp,2,70","roundType,6,\u0027ba\u0027"],"1":["sp,2,90","roundType,5,\u0027gr\u0027","roundNow,3,500"]},"buffSkillAFCondition":{"0":["roundAll,6,1","monsterAlive,4,4"],"1":["roundAll,5,1","bossAll,1,1"],"2":["roundAll,6,1","bossAll,2,1","roundNow,5,1"]},"buffSkillReCondition":{"0":["roundAll,6,1","monsterAlive,4,4"],"1":["roundAll,5,1","bossAll,1,1"],"2":["roundAll,6,1","bossAll,2,1","roundNow,5,1"]},"sleepRatio":0,"magnetRatio":0,"debuffSkillAllWeak":true,"weakRatio":1,"debuffSkillallweakCondition":{"0":["roundNow,5,95","roundAll,5,95","roundType,5,\u0027ar\u0027"],"1":["roundNow,5,100","roundAll,5,100","roundType,5,\u0027ar\u0027"],"2":["sp,4,41","roundType,5,\u0027gr\u0027"],"3":["sp,4,51","roundType,5,\u0027gr\u0027","roundNow,3,600"]},"silenceRatio":0,"debuffSkillAllIm":true,"impRatio":1,"debuffSkill":{"Si":true},"debuffSkillSiCondition":{"0":["roundNow,5,100","roundType,5,\u0027ar\u0027"]},"scrollFirst":true,"scroll":{"Pr":true,"Sw":true,"Li":true,"Sh":true},"scrollPrCondition":{"0":["roundType,5,\u0027gr\u0027","roundNow,1,270"]},"scrollSwCondition":{"0":["roundType,5,\u0027gr\u0027","roundNow,1,270"]},"scrollLiCondition":{"0":["sp,2,50"],"1":["_buffTurn_sparklife,5,0","_isCd_11395,5,1","_isCd_313,5,1","_isCd_11195,5,1"]},"scrollShCondition":{"0":["roundType,5,\u0027gr\u0027","roundNow,1,630"]},"presetSelector":"","dbBackupListLast":"","themeSelector":"white","delayReload":true,"pauseButton":true,"itemOrder":["SP","LE","SE","MP","ME","Cure","FC","HP","HE"],"channelSkillOrder":["AF","Re"],"buffSkillOrder":["Re","AF"],"debuffSkillOrder":["Si"]}')
      },
      config2: {
        name: '单手盾',
        description: '重甲单手盾，对塔楼特化',
        config: JSON.parse('{"channelSkillSwitch":true,"buffSkillSwitch":true,"debuffSkillSwitch":true,"skillSwitch":true,"dataRecordSwitch":true,"attackStatus":"0","turnOnSS":true,"turnOnSSCondition":{"0":["roundType,6,\u0027tw\u0027","oc,1,230"],"1":["roundType,5,\u0027tw\u0027","oc,1,230","monsterAll,6,monsterAlive"],"2":["roundType,5,\u0027tw\u0027","oc,1,100","_monHp_20,5,1","monsterAlive,5,1"],"3":["roundType,5,\u0027tw\u0027","oc,1,230","monsterAll,5,monsterAlive","_hasDebuff_silence,5,1"]},"turnOffSS":true,"turnOffSSCondition":{"0":["roundType,5,\u0027tw\u0027","oc,2,100","monsterAlive,5,1","_monHp_90,5,0"]},"ruleOrder":true,"autobuylist":"MD,HD,SD,HP.MP,SP,SW,SM,EC","item":{"Cure":true,"FC":true,"HP":true,"HE":true,"MP":true,"ME":true,"SP":true,"SE":true,"HealthGem":true,"ManaGem":true,"SpiritGem":true,"MysticGem":true},"itemCureCondition":{"0":["hp,4,40"]},"itemFCCondition":{"0":["hp,4,32"]},"itemHPCondition":{"0":["hp,4,31"]},"itemHECondition":{"0":["hp,4,30"]},"itemMPCondition":{"0":["mp,4,21","_isCd_11299,5,1"],"1":["mp,4,50"]},"itemMECondition":{"0":["mp,4,23"]},"itemSPCondition":{"0":["sp,4,50"]},"itemSECondition":{"0":["sp,4,36"],"1":["sp,4,38","roundAll,5,50","roundNow,1,30"]},"itemManaGemCondition":{"0":["mp,2,80"]},"channelSkill":{"He":true,"Re":true},"channelSkillHeCondition":{"0":["_buffTurn_heartseeker,2,150"]},"channelSkillReCondition":{"0":["_buffTurn_regen,2,120"]},"buffSkill":{"HD":true,"MD":true,"SD":true,"He":true,"Re":true},"buffSkillHDCondition":{"0":["hp,2,85"]},"buffSkillMDCondition":{"0":["mp,2,75"],"1":["mp,2,95","roundType,5,\u0027tw\u0027","roundNow,1,15"]},"buffSkillSDCondition":{"0":["sp,2,70"],"1":["sp,2,85","roundType,5,\u0027tw\u0027","roundNow,1,30"]},"buffSkillReCondition":{"0":["hp,2,90"]},"debuffSkillAllSleep":true,"sleepRatio":1,"debuffSkillallsleepCondition":{"0":["roundType,5,\u0027tw\u0027"]},"magnetRatio":0,"debuffSkillAllWeak":true,"weakRatio":1,"debuffSkillallweakCondition":{"0":["roundType,5,\u0027tw\u0027"]},"debuffSkillAllSi":true,"silenceRatio":1,"debuffSkillallsilenceCondition":{"0":["roundType,5,\u0027tw\u0027"]},"impRatio":0,"debuffSkill":{"Im":true},"debuffSkillImCondition":{"0":["_isBoss_,5,1"]},"fightingStyle":"2","skillT2Condition":{"0":["_hasDebuff_stun,5,1","_hasDebuff_imp,5,1","_isBoss_,5,1","_isSsOn_,5,1","_monNowHp_10,5,0"],"1":["_hasDebuff_stun,5,1","_hasDebuff_ap,5,1","roundType,6,\u0027ar\u0027","_isSsOn_,5,1","_monHp_75,5,0"]},"scrollFirst":true,"scroll":{"Pr":true,"Sw":true,"Li":true,"Sh":true},"scrollPrCondition":{"0":["roundType,5,\u0027tw\u0027","monsterAll,5,monsterAlive","monsterAll,1,8","roundNow,1,45"]},"scrollSwCondition":{"0":["roundType,5,\u0027tw\u0027","monsterAll,5,monsterAlive","monsterAll,1,8","roundNow,1,45"]},"scrollLiCondition":{"0":["roundType,5,\u0027tw\u0027","monsterAll,5,monsterAlive","monsterAll,1,7","roundNow,1,40"],"1":["roundType,5,\u0027tw\u0027","monsterAll,5,monsterAlive","monsterAll,1,8","roundNow,1,30"]},"scrollShCondition":{"0":["roundType,5,\u0027tw\u0027","monsterAll,5,monsterAlive","monsterAll,1,8","roundNow,1,45"]},"presetSelector":"","dbBackupListLast":"","delayReload":true,"pauseButton":true,"itemOrder":["SP","SE","MP","ME","Cure","HP","FC","HE"],"channelSkillOrder":["He","Re"],"buffSkillOrder":["He","Re"],"debuffSkillOrder":["Im"],"skillOrder":["T2"]}')
      },
      config3: {
        name: '元素省蓝AR',
        description: '可用于AR ,40锻造可用于 GF',
        config: JSON.parse('{"channelSkillSwitch":true,"buffSkillSwitch":true,"debuffSkillSwitch":true,"scrollSwitch":true,"dataRecordSwitch":true,"middleSkillCondition":{"0":["roundType,6,\\"gr\\"","monsterAlive,1,4","mp,1,70"],"1":["roundType,5,\\"gr\\"","monsterAlive,1,2"]},"highSkillCondition":{"0":["roundType,6,\\"gr\\"","monsterAlive,1,4","mp,1,70"],"1":["roundType,5,\\"gr\\"","monsterAlive,5,monsterAll"]},"turnOnSS":true,"turnOnSSCondition":{"0":["roundType,6,\\"gr\\"","monsterAlive,2,3","sp,1,70","oc,1,220"]},"etherTap":true,"etherTapCondition":{"0":["roundType,5,\\"ar\\"","monsterAlive,2,4","mp,2,95","sp,1,60"],"1":["roundType,5,\\"ar\\"","monsterAlive,5,1","mp,2,95"]},"autoquit":true,"autoshard":true,"autoshardlist":"FC","repair":true,"repairValue":65,"autobuy":true,"autobuylist":"SC,SW,EC,MP,SP,HP","item":{"Cure":true,"FC":true,"HP":true,"HE":true,"MP":true,"ME":true,"SP":true,"SE":true,"LE":true,"HealthGem":true,"ManaGem":true,"SpiritGem":true,"MysticGem":true},"itemCureCondition":{"0":["hp,4,35","roundType,6,\u0027gr\u0027"],"1":["hp,4,45","hp,3,23","roundType,5,\u0027gr\u0027"],"2":["hp,4,48","_isCd_313,5,1","_isCd_11195,5,1"],"3":["hp,4,48","_isCd_313,5,1","roundNow,3,700"],"4":["hp,4,55","hp,3,23","sp,4,45"]},"itemFCCondition":{"0":["hp,4,21"],"2":["_buffTurn_sparklife,5,0"]},"itemHPCondition":{"0":["hp,4,35","roundType,6,\\"gr\\""],"1":["hp,4,35","hp,3,23"],"2":["hp,4,33","_isCd_313,5,1"]},"itemHECondition":{"0":["hp,4,21","roundType,6,\\"gr\\""],"1":["_buffTurn_sparklife,5,0","hp,2,51","_isCd_313,5,1"],"2":["hp,4,1"]},"itemMPCondition":{"0":["mp,4,38"]},"itemMECondition":{"0":["mp,4,12"],"1":["mp,4,30","_buffTurn_sparklife,5,0"]},"itemSPCondition":{"0":["sp,4,55","roundType,6,\\"ar\\""],"1":["_buffTurn_sparklife,5,0","_isCd_11195,5,1","_isCd_313,5,1"],"2":["sp,4,45","roundType,5,\\"ar\\""]},"itemSECondition":{"0":["sp,4,31","_buffTurn_sparklife_scroll,5,0","roundNow,4,800"],"1":["sp,4,16","_buffTurn_sparklife_scroll,6,0"],"2":["sp,4,31","_buffTurn_sparklife_scroll,5,0","_isCd_13221,5,1"]},"itemLECondition":{"0":["sp,4,31","_buffTurn_sparklife_scroll,5,0","roundNow,4,800"],"1":["sp,4,16","_buffTurn_sparklife_scroll,6,0"],"2":["sp,4,31","_buffTurn_sparklife_scroll,5,0","_isCd_13221,5,1"]},"itemHealthGemCondition":{"0":["hp,2,85"]},"itemManaGemCondition":{"0":["mp,2,90"]},"channelSkill":{"AF":true,"Re":true},"channelSkillAFCondition":{"0":["_buffTurn_arcanemeditation,4,110"]},"channelSkillReCondition":{"0":["_buffTurn_regen,4,90"]},"buffSkill":{"HD":true,"MD":true,"SD":true,"AF":true,"Re":true},"buffSkillHDCondition":{"0":["hp,2,80","roundType,6,\\"ba\\""],"1":["hp,2,90","roundType,5,\\"gr\\"","roundNow,3,100"]},"buffSkillMDCondition":{"0":["mp,2,60","roundType,6,\\"ba\\""],"1":["mp,2,90","roundType,5,\\"gr\\"","roundNow,3,100"],"2":["hp,2,80",".roundType,5,\\"rb\\""]},"buffSkillSDCondition":{"0":["sp,2,65","roundType,6,\\"ba\\""],"1":["sp,2,90","roundType,5,\\"gr\\"","roundNow,3,500"],"2":["sp,2,70","roundAll,5,95"]},"buffSkillAFCondition":{"0":["roundType,6,\\"ba\\""]},"buffSkillReCondition":{"0":["roundType,6,\\"ba\\""]},"debuffSkillAllWeak":true,"weakRatio":1,"debuffSkillallweakCondition":{"0":["roundNow,5,95","roundAll,5,95","roundType,5,\u0027ar\u0027"],"1":["roundNow,5,100","roundAll,5,100","roundType,5,\u0027ar\u0027"],"2":["sp,4,41","roundType,5,\u0027gr\u0027"],"3":["sp,4,51","roundType,5,\u0027gr\u0027","roundNow,3,600"]},"debuffSkillAllSi":true,"silenceRatio":0.76,"debuffSkillallsilenceCondition":{"0":["roundType,5,\\"ar\\"","roundAll,5,100","roundNow,5,100"]},"debuffSkillAllIm":true,"impRatio":1,"scrollFirst":true,"scroll":{"Go":false,"Av":false,"Pr":true,"Sw":true,"Li":true,"Sh":true,"Ab":false},"scrollPrCondition":{"1":["roundType,5,\\"gr\\"","roundNow,1,270"]},"scrollSwCondition":{"1":["roundType,5,\\"gr\\"","roundNow,1,270"]},"scrollLiCondition":{"0":["roundType,5,\\"gr\\"","sp,2,50"],"1":["roundType,5,\\"gr\\"","_buffTurn_sparklife,5,0","_isCd_313,5,1","_isCd_11195,5,1","_isCd_11395,5,1"]},"scrollShCondition":{"1":["roundType,5,\\"gr\\"","roundNow,1,270"]},"pauseButton":true,"pauseHotkey":true,"itemOrder":["SP","LE","SE","MP","ME","Cure","FC","HP","HE"],"channelSkillOrder":["AF","Re"],"buffSkillOrder":["Re","AF"]}')
      }
      },

    // 配置管理系统
    Config: {
      // ==================== 配置管理业务逻辑 ====================
      CONFIG_EXCLUDE_KEYS: [
        'idleArena',
        'idleArenaTime',
        'idleArenaOrder',
        'idleArenaGrTime',
        'personaConfigSwitch',
        'arPersona',
        'arEquip',
        'arConfig',
        'gfPersona',
        'gfEquip',
        'gfConfig',
        'twPersona',
        'twEquip',
        'twConfig',
        'crossWorldArena',
        'encounter',
        'encounterDailyMin',
        'encounterDailyMax',
        'dataRecordSwitch',
        'dataColumns',
        'defeatLogSwitch',
        'resistTooltipSwitch',
        'proficiencyTooltipSwitch'
      ],

      stripExcludedConfig(config) {
        const result = { ...(config || {}) };
        const keys = this.CONFIG_EXCLUDE_KEYS;
        for (let i = 0; i < keys.length; i++) {
          delete result[keys[i]];
        }
        return result;
      },

      mergeConfigWithExclusions(config) {
        const result = { ...(config || {}) };
        const current = AAD.Core.Storage.getValue('option') || {};
        const keys = this.CONFIG_EXCLUDE_KEYS;
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (Object.prototype.hasOwnProperty.call(current, key)) {
            result[key] = current[key];
          } else {
            delete result[key];
          }
        }
        return result;
      },

      backupConfig(name) {
        const code = name || AAD.Utils.Common.alert(2, '请输入当前配置代号') || Date.now();
        const backups = AAD.Core.Storage.getValue('backup') || {};
        backups[code] = this.stripExcludedConfig(this.getAll());
        AAD.Core.Storage.setValue('backup', backups);
        return code;
      },

      restoreConfig(code) {
        const backups = AAD.Core.Storage.getValue('backup') || {};
        if (!(code in backups) || !code) return false;
        const merged = this.mergeConfigWithExclusions(backups[code]);
        AAD.Core.Config.applyConfig(merged);
        return true;
      },

      deleteConfig(code) {
        const backups = AAD.Core.Storage.getValue('backup') || {};
        if (!(code in backups) || !code) return false;
        delete backups[code];
        AAD.Core.Storage.setValue('backup', backups);
        AAD.Runtime.refreshPage();
        return true;
      },

      resetConfig() {
        AAD.Core.Storage.delValue('option');
        return true;
      },

      // 获取完整配置
      getAll() {
        return AAD.Core.Storage.getValue('option') || {};
      },

      applyConfig(optionData) {
        AAD.Core.Storage.setValue('option', optionData);
        AAD.Runtime.refreshPage();
      },

      // ==================== 预设配置系统 ====================
      // 获取预设配置列表
      getPresetConfigList() {
        return Object.keys(AAD.Core.PRESET_CONFIGS).map(key => ({
          key: key,
          name: AAD.Core.PRESET_CONFIGS[key].name,
          description: AAD.Core.PRESET_CONFIGS[key].description
        }));
      },

    },

    // ===== 存储系统  =====
    // 数据流转：内存 → 页面卸载保存 → 页面恢复 → IndexedDB归档
    Storage: {

      // ===== 配置存储 (世界隔离) =====
      // 世界隔离键列表（只有这些键会被按世界隔离）
      ISOLATED_KEYS: new Set([
        'option', 'backup', 'roundType', 'roundNow', 'roundAll',
        'monsterStatus', 'arena', 'dailyReset_arena', 'disabled', 'missanswer',
        'prices', 'page_temp_data', 'iwState', 'arenaAutoStart'
      ]),

      // 世界隔离键映射
      getWorldKey(key) {
        if (this.ISOLATED_KEYS.has(key)) {
          if (AAD.Runtime.isIsekai()) {
            return `isekai_${key}`;
          } else {
            return `main_${key}`;
          }
        }
        return key;
      },

      // ===== 持久化存储接口 =====
      setValue(key, value) {
        const worldKey = this.getWorldKey(key);
        GM_setValue(worldKey, value);
      },

      getValue(key) {
        const worldKey = this.getWorldKey(key);

        const value = GM_getValue(worldKey, null);
        return value === null ? null : value;
      },

      delValue(item) {
        if (typeof item === 'string') {
          const worldKey = this.getWorldKey(item);
          GM_deleteValue(worldKey);
        } else if (typeof item === 'number') {
          // 处理预定义清理组
          if (item === 0) {
            this.delValue('disabled');
            this.delValue('missanswer');
          } else if (item === 1) {
            this.delValue('roundNow');
            this.delValue('roundAll');
            this.delValue('monsterStatus');
          } else if (item === 2) {
            this.delValue('roundType');
            this.delValue(0);
            this.delValue(1);
          }
        }
      },

      // ===== 页面生命周期存储管理器 =====
      PageLifecycle: {
        tempDataKey: null,

        // 临时数据存储键（世界隔离）
        getTempDataKey() {
          if (this.tempDataKey) {
            return this.tempDataKey;
          }
          const baseKey = 'page_temp_data';
          this.tempDataKey = AAD.Core.Storage.getWorldKey(baseKey);
          return this.tempDataKey;
        },

        shouldSaveTempData() {
          // 只有在战斗进行中且未结束时才保存临时数据
          const recorder = AAD.Data.Recorder;
          return recorder.battleStarted &&
                 !recorder.battleEnded &&
                 recorder.combat &&
                 Object.keys(recorder.combat).length > 0;
        },

        // 保存临时数据到存储
        saveTempData() {
          if (!this.shouldSaveTempData()) {
            console.log('[PageLifecycle] 无需保存临时数据');
            return;
          }

          try {
            const tempData = AAD.Data.Recorder.getCurrentState();
            const key = this.getTempDataKey();

            // 记录保存时间用于提示
            tempData.saveTimestamp = Date.now();
            AAD.Core.Storage.setValue(key, tempData);
            console.log('[PageLifecycle] 临时数据已保存到存储');
          } catch (error) {
            console.error('[PageLifecycle] 保存临时数据失败:', error);
          }
        },

        // 从存储恢复临时数据
        restoreTempData() {
          try {
            const key = this.getTempDataKey();
            const tempData = AAD.Core.Storage.getValue(key);

            if (!tempData) {
              console.log('[PageLifecycle] 未找到临时数据');
              return false;
            }

            // 验证数据有效性和完整性
            if (!this.validateDataIntegrity(tempData) || !tempData.combat || !tempData.battleStarted) {
              console.warn('[PageLifecycle] 临时数据无效或不完整，跳过恢复');
              this.delValue(key);
              return false;
            }

            // 恢复数据到记录器
            Object.assign(AAD.Data.Recorder, tempData);

            // 清理临时数据
            this.delValue(key);

            console.log(`[PageLifecycle] 从存储恢复临时数据成功，保存时间: ${new Date(tempData.saveTimestamp).toLocaleString()}`);
            return true;
          } catch (error) {
            console.error('[PageLifecycle] 恢复临时数据失败:', error);
            return false;
          }
        },

        // 删除临时数据
        delValue(key) {
          try {
            AAD.Core.Storage.delValue(key || this.getTempDataKey());
          } catch (error) {
            console.warn('[PageLifecycle] 删除临时数据失败:', error);
          }
        },

        // 初始化页面生命周期管理
        init() {
          // 添加页面卸载事件监听
          window.addEventListener('beforeunload', () => {
            this.saveTempData();
          });

          console.log('[PageLifecycle] 页面生命周期管理器已初始化');
         
        },

        // 验证数据完整性
        validateDataIntegrity(data) {
          if (!data) return false;
          const requiredFields = ['combat', 'drops', 'timelog', 'isRecording', 'battleStarted', 'battleEnded'];
          return requiredFields.every(field => data.hasOwnProperty(field));
        }
      },

    

      // ===== 缓存系统 =====
      caches: {
        dom: new Map(),           // DOM元素缓存
        domAll: new Map()        // DOM列表缓存
      },

      cacheConfig: {
        maxSize: 200
      },

      // 初始化存储系统
      init(enablePageLifecycle = false) {
        if (enablePageLifecycle && AAD.Runtime.isBattlePage()) {
          this.PageLifecycle.init();
        }
      },

      // 缓存操作
      getCache(type, key) {
        const cache = this.caches[type];
        if (!cache) return null;

        const item = cache.get(key);
        if (!item) return null;

        // 检查DOM元素连接状态
        if (type === 'dom' && item.value && !item.value.isConnected) {
          cache.delete(key);
          return null;
        }

        if (type === 'domAll' && item.value && item.value.length > 0 && !item.value[0].isConnected) {
          cache.delete(key);
          return null;
        }

        return item.value;
      },

      setCache(type, key, value) {
        const cache = this.caches[type];
        if (!cache) return;

        // 缓存大小限制
        if (cache.size >= this.cacheConfig.maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }

        cache.set(key, {
          value,
          timestamp: Date.now()
        });
      },

      // DOM缓存接口
      getElement(selector, context = document, useCache = true) {
        if (!useCache) return context.querySelector(selector);

        const cacheKey = selector + (context === document ? '' : '_ctx');
        let element = this.getCache('dom', cacheKey);

        if (element) return element;

        element = context.querySelector(selector);
        if (element) {
          this.setCache('dom', cacheKey, element);
        }

        return element;
      },

      getAllElements(selector, context = document, useCache = false) {
        if (!useCache) return context.querySelectorAll(selector);

        const cacheKey = selector + (context === document ? '' : '_ctx');
        let elements = this.getCache('domAll', cacheKey);

        if (elements) return elements;

        elements = context.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          this.setCache('domAll', cacheKey, elements);
        }

        return elements;
      },



      clearBattleCache() {
        ['dom', 'domAll'].forEach(type => {
          const cache = this.caches[type];
          const battleKeys = Array.from(cache.keys()).filter(key =>
            key.includes('btm') || key.includes('mkey_') || key.includes('battle')
          );
          battleKeys.forEach(key => cache.delete(key));
        });
      },

    },

    // ===== 持久化数据层 =====
    Database: {
      dbName: 'AADB',
      dbVersion: 2,
      storeName: 'battles',
      db: null,

      async init() {
        if (this.db) return this.db;
        console.log('[Database] 正在初始化IndexedDB数据库...');

        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, this.dbVersion);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            this.db = request.result;
            resolve(this.db);
          };

          request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(this.storeName)) {
              const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
              this._createBattlesIndexes(store);
              console.log('[Database] IndexedDB数据库创建完成');
            }
          };
        });
      },

      // 创建 battles 表的索引
      _createBattlesIndexes(store) {
        // 主索引：isekai + battleType + endTime（覆盖所有查询场景）
        if (!store.indexNames.contains('isekai_type_time')) {
          store.createIndex('isekai_type_time', ['isekai', 'battleType', 'endTime']);
        }

        // 备用索引：isekai + endTime（当不指定 battleType 时）
        if (!store.indexNames.contains('isekai_time')) {
          store.createIndex('isekai_time', ['isekai', 'endTime']);
        }

        // 按天索引：isekai + date（用于按天查询早停）
        if (!store.indexNames.contains('isekai_date')) {
          store.createIndex('isekai_date', ['isekai', 'date']);
        }

        // 按天索引：isekai + battleType + date（用于按天查询早停）
        if (!store.indexNames.contains('isekai_type_date')) {
          store.createIndex('isekai_type_date', ['isekai', 'battleType', 'date']);
        }
      },

      // 保存战斗数据（扁平化结构 + 预聚合）
      async saveBattle(battleData) {
        try {
          const db = await this.init();

          // 保存战斗记录
          const battleRecord = await this._saveBattleRecord(db, battleData);

          return battleRecord;
        } catch (error) {
          console.error('[Database] 保存战斗数据失败:', error);
          throw error;
        }
      },

      // 保存战斗记录（私有方法）
      async _saveBattleRecord(db, battleData) {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const startTime = battleData.timelog.startTime || Date.now();
        const endTime = battleData.timelog.endTime || Date.now();
        const battleType = this.extractBattleType();
        const isekai = AAD.Runtime.isIsekai() ? 1 : 0;
        const worldPrefix = isekai ? 'isk' : 'main';
        const uniqueKey = `${worldPrefix}_${startTime}_${battleType}`;
        const date = new Date(endTime).toISOString().split('T')[0];

        // 计算扁平化字段（一次性完成所有计算）
        const flatData = this._computeFlattenedData(battleData);

        const battleRecord = {
          // 主键和索引字段
          id: uniqueKey,
          isekai: isekai,
          battleType: battleType,
          startTime: startTime,
          endTime: endTime,
          date: date,

          // 基础统计（扁平）
          rounds: flatData.rounds,
          turns: flatData.turns,
          duration: flatData.duration,

          // 财务数据（预计算）
          exp: flatData.exp,
          credit: flatData.credit,
          revenue: flatData.revenue,
          cost: flatData.cost,
          profit: flatData.profit,
          profitWithoutED: flatData.profitWithoutED,

          // 掉落统计（扁平）
          artifacts: flatData.artifacts,
          blood: flatData.blood,
          chaos: flatData.chaos,
          legendary: flatData.legendary,
          peerless: flatData.peerless,

          // 消耗品统计（预计算）
          potions: flatData.potions,
          scrolls: flatData.scrolls,
          gems: flatData.gems,
          potionNetIncome: flatData.potionNetIncome,
          scrollNetIncome: flatData.scrollNetIncome,

          // 技能统计（预计算）
          attackSpells: flatData.attackSpells,
          supportSpells: flatData.supportSpells,
          healSpells: flatData.healSpells,
          debuffSpells: flatData.debuffSpells,

          // 事件统计
          horse: flatData.horse,
          spark: flatData.spark,

          // 详细数据（压缩存储，仅用于详情查看）
          detailsCompressed: {
            drops: battleData.drops,
            items: battleData.combat.items || {},
            magic: battleData.combat.magic || {},
            proficiency: battleData.combat.proficiency || {},
            resist: battleData.combat.resist || {},
            defeatLog: battleData.combat.stats?.defeatLog || null
          }
        };

        return new Promise((resolve, reject) => {
          const request = store.put(battleRecord);
          request.onsuccess = () => {
            resolve(battleRecord);
          };
          request.onerror = () => reject(request.error);
        });
      },

      // 计算扁平化数据（一次性完成所有统计）
      _computeFlattenedData(battleData) {
        const drops = battleData.drops || {};
        const combat = battleData.combat || {};
        const stats = combat.stats || {};

        // 基础统计
        const rounds = stats.totalRounds || 0;
        const turns = stats.totalTurns || 0;
        const startTime = battleData.timelog.startTime || 0;
        const endTime = battleData.timelog.endTime || 0;
        const durationSeconds = Math.round((endTime - startTime) / 10) / 100;

        // 财务计算
        const revenue = AAD.Data.Finance.calculateRevenue(drops);
        const cost = AAD.Data.Finance.calculateCost(combat);
        const profit = AAD.Utils.Format.fixPrecision(revenue - cost, 2);
        const battleType = this.extractBattleType();
        const profitWithoutED = AAD.Data.Economy.calculateProfitWithoutED(profit, battleType, rounds);
        const potionNetIncome = AAD.Data.Finance.calculatePotionNetIncome(drops, combat);
        const scrollNetIncome = AAD.Data.Finance.calculateScrollNetIncome(drops, combat);

        // 掉落统计
        const exp = drops.EXP || 0;
        const credit = (drops.Credit || 0) + (drops.CreditFromTrash || 0);
        const artifacts = drops['Artifact'] || drops['Precursor Artifact'] || 0;
        const blood = drops.Blood || 0;
        const chaos = drops.Chaos || 0;
        const legendary = drops.Legendary || 0;
        const peerless = drops.Peerless || 0;

        // 消耗品和技能统计（批量计算）
        const batchStats = AAD.Data.Statistics.batchCountItemsAndSpells(combat);

        // 事件统计
        const horse = AAD.Data.Statistics.countHorseEvents(combat);
        const spark = AAD.Data.Statistics.countSparkEvents(combat);

        return {
          rounds,
          turns,
          duration: durationSeconds,
          exp,
          credit,
          revenue,
          cost,
          profit,
          profitWithoutED,
          artifacts,
          blood,
          chaos,
          legendary,
          peerless,
          potions: batchStats.potions,
          scrolls: batchStats.scrolls,
          gems: batchStats.gems,
          potionNetIncome,
          scrollNetIncome,
          attackSpells: batchStats.attack_spells,
          supportSpells: batchStats.support_spells,
          healSpells: batchStats.heal_spells,
          debuffSpells: batchStats.debuff_spells,
          horse,
          spark
        };
      },

  

      // 查询战斗数据（记录级，达到limit后立即停止）
      async queryBattlesLimited(criteria = {}) {
        try {
          const db = await this.init();
          const transaction = db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          const limitRaw = Number(criteria.limit);
          const limit = Number.isFinite(limitRaw) ? Math.max(0, limitRaw) : 100;

          if (limit <= 0) {
            return [];
          }

          const { index, range, direction } = this._selectBestIndex(store, criteria);

          return new Promise((resolve, reject) => {
            const results = [];
            const request = index.openCursor(range, direction);

            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (!cursor) {
                resolve(results);
                return;
              }

              const record = cursor.value;
              if (this._matchesCriteria(record, criteria)) {
                results.push(record);
                if (results.length >= limit) {
                  resolve(results);
                  return;
                }
              }

              cursor.continue();
            };

            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('[Database] 查询战斗数据失败:', error);
          throw error;
        }
      },

      // 按天查询并直接返回日聚合行（达到limitDays后立即停止）
      async queryDailyAggregates(criteria = {}) {
        try {
          const db = await this.init();
          const transaction = db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          const limitDaysRaw = Number(criteria.limitDays);
          const limitDays = Number.isFinite(limitDaysRaw) ? Math.max(0, limitDaysRaw) : 50;

          if (limitDays <= 0) {
            return [];
          }

          const { index, range, direction, hasBattleType } = this._selectDailyIndex(store, criteria);

          return new Promise((resolve, reject) => {
            const results = [];
            const request = index.openCursor(range, direction);

            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (!cursor) {
                resolve(results);
                return;
              }

              const dateKey = hasBattleType ? cursor.key[2] : cursor.key[1];
              const dayRange = hasBattleType
                ? IDBKeyRange.only([criteria.isekai, criteria.battleType, dateKey])
                : IDBKeyRange.only([criteria.isekai, dateKey]);
              const dayRequest = index.getAll(dayRange);

              dayRequest.onsuccess = () => {
                const records = (dayRequest.result || []).filter(record => this._matchesCriteria(record, criteria));
                if (records.length > 0) {
                  results.push(this._aggregateDailyRow(dateKey, records));
                  if (results.length >= limitDays) {
                    resolve(results);
                    return;
                  }
                }

                cursor.continue();
              };

              dayRequest.onerror = () => reject(dayRequest.error);
            };

            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('[Database] 按天查询失败:', error);
          throw error;
        }
      },

      _aggregateDailyRow(dateKey, records) {
        const daily = {
          timestamp: dateKey,
          rawTime: AAD.Utils.Time.getUtcDayStartMs(dateKey),
          utcDate: dateKey,
          battle_type: '汇总',
          rounds: 0, turns: 0, duration: '', tps: 0,
          exp: 0, credit: 0, revenue: 0, cost: 0, profit: 0,
          profit_without_ed: 0,
          artifacts: 0, blood: 0, chaos: 0, legendary: 0, peerless: 0,
          potions: 0, scrolls: 0, gems: 0,
          potion_net_income: 0, scroll_net_income: 0,
          attack_spells: 0, support_spells: 0, heal_spells: 0, debuff_spells: 0,
          horse: 0, spark: 0, battleCount: 0, seconds: 0,
          _dropData: {},
          _usageData: { items: {}, magic: {}, proficiency: {}, resist: {} }
        };

        records.forEach(record => {
          daily.rounds += record.rounds || 0;
          daily.turns += record.turns || 0;
          daily.exp += record.exp || 0;
          daily.credit += record.credit || 0;
          daily.revenue += record.revenue || 0;
          daily.cost += record.cost || 0;
          daily.profit += record.profit || 0;
          daily.profit_without_ed += record.profitWithoutED || 0;
          daily.artifacts += record.artifacts || 0;
          daily.blood += record.blood || 0;
          daily.chaos += record.chaos || 0;
          daily.legendary += record.legendary || 0;
          daily.peerless += record.peerless || 0;
          daily.potions += record.potions || 0;
          daily.scrolls += record.scrolls || 0;
          daily.gems += record.gems || 0;
          daily.potion_net_income += record.potionNetIncome || 0;
          daily.scroll_net_income += record.scrollNetIncome || 0;
          daily.attack_spells += record.attackSpells || 0;
          daily.support_spells += record.supportSpells || 0;
          daily.heal_spells += record.healSpells || 0;
          daily.debuff_spells += record.debuffSpells || 0;
          daily.horse += record.horse || 0;
          daily.spark += record.spark || 0;
          daily.seconds += record.duration || 0;
          daily.battleCount += 1;

          if (record.detailsCompressed?.drops) {
            AAD.Utils.Aggregation.mergeDataObjects(daily._dropData, record.detailsCompressed.drops, ['Credit', 'CreditFromTrash', 'EXP']);
          }

          AAD.Utils.Aggregation.mergeDataObjects(daily._usageData, {
            items: record.detailsCompressed?.items || {},
            magic: record.detailsCompressed?.magic || {},
            proficiency: record.detailsCompressed?.proficiency || {},
            resist: record.detailsCompressed?.resist || {}
          });
        });

        ['revenue', 'cost', 'profit', 'profit_without_ed'].forEach(field => {
          daily[field] = AAD.Utils.Format.fixPrecision(daily[field], 2);
        });
        daily.duration = daily.seconds > 0 ? AAD.Utils.Format.formatDuration(daily.seconds) : '0s';
        daily.tps = daily.seconds > 0 && daily.turns > 0 ? Math.round((daily.turns / daily.seconds) * 100) / 100 : 0;

        return daily;
      },

      // 选择按天查询索引（查询优化器）
      _selectDailyIndex(store, criteria) {
        const isekai = criteria.isekai;
        const battleType = criteria.battleType;
        const startDateFromTime = criteria.startTime ? AAD.Utils.Time.getUtcDayKey(criteria.startTime) : null;
        const endDateFromTime = criteria.endTime ? AAD.Utils.Time.getUtcDayKey(criteria.endTime) : null;
        let startDate = criteria.startDate || startDateFromTime || '0000-01-01';
        let endDate = criteria.endDate || endDateFromTime || '9999-12-31';
        const direction = criteria.order === 'asc' ? 'nextunique' : 'prevunique';

        if (startDate > endDate) {
          const temp = startDate;
          startDate = endDate;
          endDate = temp;
        }

        if (isekai === undefined || isekai === null) {
          throw new Error('[Database] 按天查询缺少isekai条件，无法选择索引');
        }

        if (battleType) {
          const index = store.index('isekai_type_date');
          const range = IDBKeyRange.bound(
            [isekai, battleType, startDate],
            [isekai, battleType, endDate]
          );
          return { index, range, direction, hasBattleType: true };
        }

        const index = store.index('isekai_date');
        const range = IDBKeyRange.bound(
          [isekai, startDate],
          [isekai, endDate]
        );
        return { index, range, direction, hasBattleType: false };
      },

      // 选择最优索引（查询优化器）
      _selectBestIndex(store, criteria) {
        const isekai = criteria.isekai;
        const battleType = criteria.battleType;
        const startTime = criteria.startTime;
        const endTime = criteria.endTime;
        const direction = criteria.order === 'asc' ? 'next' : 'prev';

        // 场景1: isekai + battleType + time（最常见）
        if (isekai !== undefined && battleType) {
          const index = store.index('isekai_type_time');
          const range = IDBKeyRange.bound(
            [isekai, battleType, startTime || 0],
            [isekai, battleType, endTime || Date.now()]
          );
          return { index, range, direction };
        }

        // 场景2: isekai + time（不指定 battleType）
        if (isekai !== undefined) {
          const index = store.index('isekai_time');
          const range = IDBKeyRange.bound(
            [isekai, startTime || 0],
            [isekai, endTime || Date.now()]
          );
          return { index, range, direction };
        }

        // 未匹配到索引条件，直接中断
        throw new Error('[Database] 查询缺少isekai条件，无法选择索引');
      },

      // 检查记录是否匹配查询条件
      _matchesCriteria(record, criteria) {
        if (criteria.isekai !== undefined && record.isekai !== criteria.isekai) {
          return false;
        }
        if (criteria.battleType && record.battleType !== criteria.battleType) {
          return false;
        }
        if (criteria.startTime !== undefined && criteria.startTime !== null && record.endTime < criteria.startTime) {
          return false;
        }
        if (criteria.endTime !== undefined && criteria.endTime !== null && record.endTime > criteria.endTime) {
          return false;
        }
        return true;
      },

      // 提取战斗类型
      extractBattleType() {
        const roundType = AAD.Core.State.get('roundType');
        if (roundType) {
          return roundType.toLowerCase();
        }
        return 'na';
      }
    },

    // 每日重置调度器
    DailyReset: {
      timers: new Map(),

      getResetKey(domainKey) {
        return `dailyReset_${domainKey}`;
      },

      computeResetTime(dayKey) {
        const dayStartMs = AAD.Utils.Time.getUtcDayStartMs(dayKey);
        const minMinutes = GAME_MECHANICS.DAILY_RESET_RANDOM_MIN_MINUTES;
        const maxMinutes = GAME_MECHANICS.DAILY_RESET_RANDOM_MAX_MINUTES;
        const minMs = minMinutes * 60 * 1000;
        const maxMs = maxMinutes * 60 * 1000;
        return dayStartMs + minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      },

      loadState(domainKey) {
        return AAD.Core.Storage.getValue(this.getResetKey(domainKey), true) || {};
      },

      saveState(domainKey, state) {
        AAD.Core.Storage.setValue(this.getResetKey(domainKey), state);
      },

      clearTimer(timerKey) {
        const timerId = this.timers.get(timerKey);
        if (timerId) {
          clearTimeout(timerId);
          this.timers.delete(timerKey);
        }
      },

      getTimerKey(domainKey, scope) {
        if (scope === 'global') {
          return domainKey;
        }
        return `${domainKey}_${AAD.Runtime.isIsekai() ? 'isekai' : 'main'}`;
      },

      ensure(domainKey, scope, isEnabled, onReset) {
        const timerKey = this.getTimerKey(domainKey, scope);
        if (!isEnabled()) {
          this.clearTimer(timerKey);
          return null;
        }

        const now = Date.now();
        const todayKey = AAD.Utils.Time.getUtcDayKey(now);
        let state = this.loadState(domainKey);

        if (state.dayKey !== todayKey) {
          state = {
            dayKey: todayKey,
            resetTime: this.computeResetTime(todayKey),
            hasReset: false
          };
          this.saveState(domainKey, state);
        }

        if (!state.hasReset && now >= state.resetTime) {
          onReset({ dayKey: state.dayKey, resetTime: state.resetTime, now });
          state.hasReset = true;
          this.saveState(domainKey, state);
        }

        const delay = state.hasReset ?
          30 * 60 * 1000 :
          Math.max(1000, state.resetTime - now);

        this.clearTimer(timerKey);
        const timerId = setTimeout(() => {
          this.timers.delete(timerKey);
          this.ensure(domainKey, scope, isEnabled, onReset);
        }, delay);

        this.timers.set(timerKey, timerId);
        return state;
      }
    },

    // 网络请求模块
    Network: {
      _normalizeUrl(href) {
        let url = href;
        if (window.MAIN_URL && !url.startsWith(window.MAIN_URL)) {
          url = window.MAIN_URL + url;
        }
        if (window.location.protocol === "https:") {
          url = url.replace("http:", "https:");
        }
        return url;
      },

      _handleResponseMessagebox(data, responseType) {
        if (responseType === 'document' && AAD.Utils.DOM.gE('#messagebox_outer', data)) {
          if (AAD.Utils.DOM.gE('#messagebox_outer')) {
            AAD.Utils.DOM.gE('#mainpane').replaceChild(AAD.Utils.DOM.gE('#messagebox_outer', data), AAD.Utils.DOM.gE('#messagebox_outer'));
          } else {
            AAD.Utils.DOM.gE('#mainpane').appendChild(AAD.Utils.DOM.gE('#messagebox_outer', data));
          }
        }
      },

      _requestCore(rawHref, parm, type, handlers = {}) {
        const requestUrl = this._normalizeUrl(rawHref);
        const onSuccess = handlers.onSuccess;
        const onNetworkError = handlers.onNetworkError;
        const onStatusError = handlers.onStatusError;
        let xhr = new window.XMLHttpRequest()
        xhr.open(parm ? 'POST' : 'GET', requestUrl)
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
        xhr.responseType = type || 'document'
        xhr.onerror = () => {
          xhr = null
          if (typeof onNetworkError === 'function') {
            onNetworkError()
          }
        }
        xhr.onload = (e) => {
          if (e.target.status >= 200 && e.target.status < 400) {
            const data = e.target.response
            if (typeof onSuccess === 'function') {
              this._handleResponseMessagebox(data, xhr.responseType)
              onSuccess(data, e)
            }
          } else if (typeof onStatusError === 'function') {
            onStatusError(e)
          }
          xhr = null
        }
        xhr.send(parm)
      },

      //回调版请求
      postCallback(href, func, parm, type) {
        const rawHref = href;
        const onSuccess = typeof func === 'function' ? func : null
        this._requestCore(rawHref, parm, type, {
          onSuccess: onSuccess,
          onNetworkError: () => {
            AAD.Core.Network.postCallback(rawHref, func, parm, type)
          }
        })
      },

      // Promise版请求
      postPromise(href, parm, type) {
        return new Promise((resolve, reject) => {
          this._requestCore(href, parm, type, {
            onSuccess: resolve,
            onStatusError: (e) => reject(e.target.status)
          })
        })
      },

      // 获取商店令牌
      getstoken(data) {
        const match = data.body.innerHTML.match(/<input type="hidden" name="storetoken" value="(\w+)"/);
        if (match) {
          return match[1];
        }
        return null;
      }
    },

    // 状态管理系统 
    State: {
      // 内部状态存储 - 纯内存状态管理，不涉及持久化
      state: {},
      init() {},

      get(key, defaultValue) {
        if (key === undefined) {
          return this.state;
        }
        return this.state[key] !== undefined ? this.state[key] : defaultValue;
      },

      set(key, value) {
        this.state[key] = value;
      },


    }
  },

  // 工具库层 
  Utils: {
    // 数组工具函数
    Array: {
      // 对象数组排序函数，从小到大排序
      objArrSort: (key) => {
        return (obj1, obj2) => {
          return (obj2[key] < obj1[key]) ? 1 : (obj2[key] > obj1[key]) ? -1 : 0;
        };
      }
    },

    // 统计聚合工具函数
    Aggregation: {
      mergeDataObjects(target, source, excludeKeys = []) {
        const excludeSet = new Set(excludeKeys);
        for (const key in source) {
          if (excludeSet.has(key)) continue;
          const value = source[key];
          if (typeof value === 'number') {
            target[key] = (target[key] || 0) + value;
          } else if (typeof value === 'object' && value !== null) {
            if (!target[key]) target[key] = {};
            this.mergeDataObjects(target[key], value, excludeKeys);
          } else if (!target[key]) {
            target[key] = value;
          }
        }
      }
    },

    // 时间相关工具函数
    Time: {
      getRandomDelayMs(minMs, maxMs, roundMs = 0) {
        const delay = minMs + Math.random() * (maxMs - minMs);
        if (roundMs > 0) {
          return Math.floor(delay / roundMs) * roundMs;
        }
        return delay;
      },

      getIdleArenaDelay(minPercent = 30, maxPercent = 200) {
        const option = AAD.Core.Storage.getValue('option') || {};
        const baseSeconds = Number(option.idleArenaTime);
        const safeBaseSeconds = Number.isFinite(baseSeconds) && baseSeconds > 0 ? baseSeconds : 60;
        const minSeconds = safeBaseSeconds * (minPercent / 100);
        const maxSeconds = safeBaseSeconds * (maxPercent / 100);
        return this.getRandomDelayMs(minSeconds * 1000, maxSeconds * 1000, 1000);
      },

      getUtcDayKey(timeMs = Date.now()) {
        return new Date(timeMs).toISOString().split('T')[0];
      },

      getUtcDayStartMs(dayKey) {
        return Date.parse(`${dayKey}T00:00:00Z`);
      },

    },

    // DOM操作工具函数 - 性能关键
    DOM: {
      gE(ele, mode, parent) {
        // 兼容原有调用方式，同时保持性能
        if (typeof ele === 'object') {
          return ele;
        } else if (mode === undefined && parent === undefined) {
          if (isNaN(ele * 1)) {
            // 纯 #id 选择器直接走 getElementById
            if (ele.startsWith('#')) {
              const pureIdMatch = ele.match(/^#([\w-]+)$/);
              if (pureIdMatch) {
                return document.getElementById(pureIdMatch[1]);
              }
            }

            // 战斗相关元素使用缓存优化
            const isBattleElement = ele.includes('btm') || ele.includes('mkey_') ||
                                   ele.includes('#pane_effects') || ele.includes('#ckey_') ||
                                   ele.includes('#vbh') || ele.includes('#dvbh') ||
                                   ele.includes('#vbm') || ele.includes('#dvbm') ||  // MP条
                                   ele.includes('#vbs') || ele.includes('#dvbs') ||  // SP条
                                   ele.includes('#vcp') || ele.includes('#dvrc') ||  // OC槽
                                   ele.includes('#stamina_readout') || ele.includes('#riddlecounter');

            if (isBattleElement) {
              return AAD.Core.Storage.getElement(ele, document, true);
            } else {
              return document.querySelector(ele);
            }
          } else {
            return document.getElementById(ele);
          }
        } else if (mode === 'all') {
          // 缓存固定的 mode='all' 查询
          const cacheableAllSelectors = [
            'div.btm3>div>div',  // 怪物名字（固定）
            'div.btm6',          // 怪物buff区域容器（固定）
            'div.btm1'           // 怪物头部区域（固定）
          ];

          if (cacheableAllSelectors.includes(ele) && parent === undefined) {
            return AAD.Core.Storage.getAllElements(ele, document, true);  // 使用缓存版本
          }

          return (parent === undefined) ? document.querySelectorAll(ele) : parent.querySelectorAll(ele);
        } else if (typeof mode === 'object' && parent === undefined) {
          return mode.querySelector(ele);
        }
      },

      // 检查技能/物品是否可用
      isOn(id) {
        if (id * 1 > 10000) { // 使用物品
          return this.gE('.bti3>div[onmouseover*="' + id + '"]');
        } else { // 施放技能
          return (this.gE(id) && this.gE(id).style.opacity !== '0.5') ? this.gE(id) : false;
        }
      },

      cE(name) {
        return document.createElement(name);
      },

    },

    // 条件解析工具函数
    Condition: {
      _context: null,

      setContext(context) {
        this._context = context || null;
      },

      parseConditionValue(str) {
        // 函数调用
        if (str.match(/^_/)) {
          const arr = str.split('_');
          const funcName = arr[1];
          let args = arr.slice(2);

          // hasDebuff参数兼容：忽略前缀wpn/trio，保留真实buff关键词
          if (funcName === 'hasDebuff') {
            const normalized = args
              .filter((arg) => arg !== undefined && arg !== null && String(arg).trim() !== '')
              .map((arg) => String(arg).trim());

            while (normalized.length > 1) {
              const head = normalized[0].toLowerCase();
              if (head === 'wpn' || head === 'trio') {
                normalized.shift();
                continue;
              }
              break;
            }

            args = normalized.length > 0 ? [normalized.join('_')] : [];
          }

          if (this.ConditionFunctions[funcName]) {
            const result = this.ConditionFunctions[funcName](...args, this._context);
            return result;
          }
          return 0;
        }
        // 字符串字面量
        if (str.match(/^'.*?'$|^".*?"$/)) {
          return str.slice(1, -1);
        }
        // 全局变量
        if (isNaN(str * 1)) {
          const value = AAD.Core.State.get(str);
          return value;
        }
        // 数字字面量
        return str * 1;
      },

      // 比较操作符映射表
      COMPARISON_OPERATORS: {
        '1': (a, b) => a > b,   // 大于
        '2': (a, b) => a < b,   // 小于
        '3': (a, b) => a >= b,  // 大于等于
        '4': (a, b) => a <= b,  // 小于等于
        '5': (a, b) => a === b, // 等于
        '6': (a, b) => a !== b  // 不等于
      },

      // 条件函数库 - 用于条件评估
      ConditionFunctions: {
        // 技能冷却检查
        isCd: (id) => AAD.Utils.DOM.isOn(id) ? 0 : 1,

        // Buff 剩余回合数检查
        buffTurn: (img, suffix, context) => {
          if (context == null && suffix && typeof suffix === 'object') {
            context = suffix;
            suffix = undefined;
          }
          if (suffix !== undefined && suffix === 'scroll') {
            img = img + '_' + suffix;
          }
          const buffSnapshot = context && (context.playerBuffs ? context : context.buffSnapshot);
          if (!buffSnapshot || !buffSnapshot.playerBuffs) return 0;

          // 从快照中查找匹配的buff
          return buffSnapshot.playerBuffs[img] || 0;
        },

        // 怪物 Debuff 检查
        hasDebuff: (img) => {
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          const monsterBuff = AAD.Utils.DOM.gE('#mkey_' + monsterStatus[0].id + '>.btm6');
          return AAD.Utils.DOM.gE('img[src*="' + img + '"]', monsterBuff) ? 1 : 0;
        },

        // 怪物效果检查
        hasEffect: (effect) => {
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          const monsterBuff = AAD.Utils.DOM.gE('#mkey_' + monsterStatus[0].id + '>.btm6');
          return AAD.Utils.DOM.gE('img[onmouseover*="' + effect + '"]', monsterBuff) ? 1 : 0;
        },

        // Boss 检查
        isBoss: () => {
          const bossNames = [
            'Manbearpig', 'White Bunneh', 'Mithra', 'Dalek', 'Konata', 'Mikuru Asahina',
            'Ryouko Asakura', 'Yuki Nagato', 'Skuld', 'Urd', 'Verdandi', 'Yggdrasil',
            'Rhaegal', 'Viserion', 'Drogon', 'Real Life', 'Invisible Pink Unicorn',
            'Flying Spaghetti Monster', 'Hardcore Mode', 'Bottomless Dungeon',
            'Recycled Boss Rush', 'New Game +', 'Time Trial Mode', 'Achievement Grind',
            'Applejack', 'Gummy', 'Twilight Sparkle', 'Pinkie Pie', 'Fluttershy',
            'Angel Bunny', 'Rainbow Dash', 'Rarity', 'Spike'
          ];
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          const name = AAD.Utils.DOM.gE('#mkey_' + monsterStatus[0].id + '>.btm3').textContent;
          return bossNames.indexOf(name) !== -1 ? 1 : 0;
        },

        // 怪物血量百分比检查
        monHp: (ratio) => {
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          const hpRatio = monsterStatus[0].hpNow / monsterStatus[0].hp;
          return hpRatio * 100 <= parseInt(ratio) ? 1 : 0;
        },

        // 怪物满血值检查
        monFullHp: (amount) => {
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          return monsterStatus[0].hp <= parseInt(amount) ? 1 : 0;
        },

        // 怪物当前血值检查
        monNowHp: (amount) => {
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return 0;
          return monsterStatus[0].hpNow <= parseInt(amount) * 50000 ? 1 : 0;
        },

        // Spirit Shield状态检查
        isSsOn: () => {
          return AAD.Utils.DOM.gE('#ckey_spirit[src*="spirit_a"]') ? 1 : 0;
        }
      },

      // 条件组评估函数
      evaluateConditionGroups(parms) {
        if (!parms) return true;

        // 遍历每个条件组（OR 关系）
        for (const groupKey in parms) {
          const group = parms[groupKey];
          if (!Array.isArray(group)) continue;

          let groupResult = true;

          // 遍历组内的条件（AND 关系）
          for (let i = 0; i < group.length; i++) {
            const condition = group[i].split(',');
            if (condition.length !== 3) continue;

            const left = this.parseConditionValue(condition[0]);
            const operator = condition[1];
            const right = this.parseConditionValue(condition[2]);

            const compareFn = this.COMPARISON_OPERATORS[operator];
            if (!compareFn) continue;

            // 如果任何条件不满足，整个组失败
            if (!compareFn(left, right)) {
              groupResult = false;
              break;
            }
          }

          // 如果任何组满足，返回true
          if (groupResult) {
            return true;
          }
        }

        return false;
      },

    },

    // 格式化工具函数
    Format: {
      formatDuration(seconds) {
        if (!seconds || seconds < 0) return 'NA';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds / 60) % 60;
        const secs = seconds % 60;
        const wholeSecs = Math.floor(secs);
        const ms = Math.round((secs - wholeSecs) * 100);

        // 小时为0时不显示小时部分
        return (hours > 0 ? hours + ':' : '') +
               (minutes < 10 && hours > 0 ? '0' : '') + minutes +
               (wholeSecs < 10 ? ':0' : ':') + wholeSecs +
               (ms < 10 ? '.0' : '.') + ms;
      },



      formatLargeNumber(num) {
        if (num === 0) return '0';

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (absNum >= 1e12) {
          return sign + (absNum / 1e12).toFixed(2) + 't';
        } else if (absNum >= 1e9) {
          return sign + (absNum / 1e9).toFixed(2) + 'b';
        } else if (absNum >= 1e6) {
          return sign + (absNum / 1e6).toFixed(2) + 'm';
        } else if (absNum >= 1e3) {
          return sign + (absNum / 1e3).toFixed(1) + 'k';
        } else {
          return sign + absNum.toString();
        }
      },

      // 数值精度修复
      fixPrecision(value, decimals) {
        decimals = decimals || 2;
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
      },


    },






    // 通用工具函数
    Common: {
      // 显示状态消息
      showStatus(message) {
        console.log(`[AAD状态] ${message}`);
      },

      // 节流函数 - 限制函数执行频率
      throttle(func, delay) {
        let lastCall = 0;
        let timeoutId = null;

        return function(...args) {
          const now = Date.now();
          const timeSinceLastCall = now - lastCall;

          if (timeSinceLastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
          } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              lastCall = Date.now();
              func.apply(this, args);
            }, delay - timeSinceLastCall);
          }
        };
      },

      // 警告提示函数 (alert) 
      alert(func, l0, l2, answer) {
        if (func === -1) {
          return l0;
        } else if (func === 0) {
          window.alert(l0);
        } else if (func === 1) {
          return window.confirm(l0);
        } else if (func === 2) {
          return window.prompt(l0, answer);
        }
      },

    }
  },


  // 游戏逻辑层
  Logic: {
    // 战斗核心逻辑模块
    Battle: {
      delayReloadTimer: null,

      // 主战斗循环 
      main() {
        const roundContext = this.collectRoundState();
        if (!roundContext) return;

        this.normalizeRoundContext(roundContext);

        const actions = this.decideRoundActions(roundContext);
        this.executeRoundActions(roundContext, actions);
      },

      collectRoundState() {
        const disabled = AAD.Core.Storage.getValue('disabled');
        const missanswer = AAD.Core.Storage.getValue('missanswer');

        if (disabled || missanswer) {
          document.title = AAD.Utils.Common.alert(-1, 'hvAutoAttack暂停中');
          const pauseButton = AAD.Utils.DOM.gE('#dbBox2>button');
          if (pauseButton) {
            pauseButton.innerHTML = '继续';
          }
          return null;
        }

        AAD.Core.State.set('end', false);
        this.loadMonsterStatus();

        const currentTurn = AAD.Core.State.get('turn', 0);
        AAD.Core.State.set('turn', currentTurn + 1);

        if (AAD.Data.Recorder.combat && AAD.Data.Recorder.combat.stats) {
          AAD.Data.Recorder.combat.stats.totalTurns += 1;
        }

        const battleElements = this.ensureBattleElements();
        this.updateStatusValues(battleElements);

        const option = AAD.Core.Storage.getValue('option') || {};
        if (option.dataRecordSwitch) {
          this.processBattleLog();
        }

        this.ensureMonsterStatus();
        this.updateBattleInfo();

        const buffSnapshot = this.collectBuffSnapshot();
        //console.log('[快照] 当前回合数据:', buffSnapshot);

        return {
          option,
          buffSnapshot,
          hasGemButton: !!AAD.Utils.DOM.gE('#ikey_p'),
          hasChanneling: !!AAD.Utils.DOM.gE('#pane_effects>img[src*="channeling"]')
        };
      },

      normalizeRoundContext(roundContext) {
        AAD.Utils.Condition.setContext(roundContext.buffSnapshot);
      },

      decideRoundActions(roundContext) {
        const option = roundContext.option;
        const actions = [];

        if (option.autoFlee && AAD.Utils.Condition.evaluateConditionGroups(option.fleeCondition)) {
          actions.push('autoFlee');
          return actions;
        }

        if (option.autoPause && AAD.Utils.Condition.evaluateConditionGroups(option.pauseCondition)) {
          actions.push('autoPause');
          return actions;
        }

        if (roundContext.hasGemButton) {
          actions.push('useGem');
        }

        if (Array.isArray(option.itemOrder) && option.itemOrder.length > 0) {
          actions.push('deadSoon');
        }

        if (option.defend && AAD.Utils.Condition.evaluateConditionGroups(option.defendCondition)) {
          actions.push('defend');
          return actions;
        }

        if (option.scrollSwitch && option.scroll &&
            AAD.Utils.Condition.evaluateConditionGroups(option.scrollCondition)) {
          actions.push('scroll');
        }

        if (option.channelSkillSwitch && option.channelSkill && roundContext.hasChanneling) {
          actions.push('channelSkill');
        }

        if (option.buffSkillSwitch && option.buffSkill &&
            AAD.Utils.Condition.evaluateConditionGroups(option.buffSkillCondition)) {
          actions.push('buffSkill');
        }

        if (AAD.Core.State.get('attackStatus') !== 0 && option.item && option.item.Infusion &&
            AAD.Utils.Condition.evaluateConditionGroups(option.itemInfusionCondition)) {
          actions.push('infusion');
        }

        if (option.debuffSkillSwitch &&
            AAD.Utils.Condition.evaluateConditionGroups(option.debuffSkillCondition)) {
          actions.push('debuff');
        }

        actions.push('attack');
        return actions;
      },

      executeRoundActions(roundContext, actions) {
        for (let i = 0; i < actions.length; i++) {
          if (this.executeRoundAction(roundContext, actions[i])) return;
          if (AAD.Core.State.get('end')) return;
        }
      },

      executeRoundAction(roundContext, action) {
        const buffSnapshot = roundContext.buffSnapshot;

        switch (action) {
          case 'autoFlee':
            AAD.Utils.DOM.gE('1001').click();
            setTimeout(() => AAD.Runtime.refreshPage(), AAD.Utils.Time.getRandomDelayMs(2000, 5000));
            return true;
          case 'autoPause':
            AAD.UI.Panel.pauseChange();
            return true;
          case 'useGem':
            this.Special.useGem();
            return AAD.Core.State.get('end');
          case 'deadSoon':
            this.Special.deadSoon();
            return AAD.Core.State.get('end');
          case 'defend':
            AAD.Utils.DOM.gE('#ckey_defend').click();
            return true;
          case 'scroll':
            this.Special.useScroll(buffSnapshot);
            return AAD.Core.State.get('end');
          case 'channelSkill':
            this.useChannelSkill();
            return AAD.Core.State.get('end');
          case 'buffSkill':
            this.useBuffSkill(buffSnapshot);
            return AAD.Core.State.get('end');
          case 'infusion':
            this.Special.useInfusions();
            return AAD.Core.State.get('end');
          case 'debuff':
            this.Skills.executeDebuffStrategy(buffSnapshot);
            return AAD.Core.State.get('end');
          case 'attack':
            this.Core.attack(buffSnapshot);
            return true;
          default:
            return false;
        }
      },

      // 采集当前回合的buff快照
      collectBuffSnapshot() {
        const snapshot = {
          playerBuffs: {},
          monsters: []
        };

        // 1. 采集玩家buff
        const playerEffects = AAD.Utils.DOM.gE('#pane_effects');
        if (playerEffects) {
          const playerBuffImgs = AAD.Utils.DOM.gE('img', 'all', playerEffects);
          for (let i = 0; i < playerBuffImgs.length; i++) {
            const img = playerBuffImgs[i];
            const src = img.getAttribute('src');
            const onmouseover = img.getAttribute('onmouseover');

            // 提取buff名称（从src中提取，如 /y/e/protection.png -> protection）
            const buffMatch = src.match(/\/e\/([^.]+)\.png/);
            if (!buffMatch) continue;
            const buffKey = buffMatch[1];

            // 提取剩余回合数
            let turns = Infinity;  // 默认为永久效果
            if (onmouseover) {
              const turnMatch = onmouseover.match(/,\s*['"]*(\d+)['"]*\s*\)$/);
              if (turnMatch) {
                turns = parseInt(turnMatch[1], 10);
              }
            }

            snapshot.playerBuffs[buffKey] = turns;
          }
        }

        // 2. 采集怪物buff
        const monsterBuffContainers = AAD.Utils.DOM.gE('div.btm6', 'all');
        for (let i = 0; i < monsterBuffContainers.length; i++) {
          const container = monsterBuffContainers[i];
          const monsterData = {
            slots: 0,
            buffs: {}
          };

          const buffImgs = AAD.Utils.DOM.gE('img', 'all', container);
          monsterData.slots = 0;

          for (let j = 0; j < buffImgs.length; j++) {
            const img = buffImgs[j];
            const src = img.getAttribute('src');
            const onmouseover = img.getAttribute('onmouseover');

            // 提取buff名称
            const buffMatch = src.match(/\/e\/([^.]+)\.png/);
            if (!buffMatch) continue;
            const buffKey = buffMatch[1];
            if (buffKey.startsWith('trio_')) continue;

            // 提取剩余回合数
            let turns = 0;  // 怪物buff默认为0（无法解析时）
            if (onmouseover) {
              const turnMatch = onmouseover.match(/,\s*['"]*(\d+)['"]*\s*\)$/);
              if (turnMatch) {
                turns = parseInt(turnMatch[1], 10);
              }
            }

            monsterData.buffs[buffKey] = turns;
            monsterData.slots += 1;
          }

          snapshot.monsters.push(monsterData);
        }

        return snapshot;
      },

      // 战斗事件初始化器
      initBattleEvents() {

        const option = AAD.Core.Storage.getValue('option') || {};

        // 创建动作参数对象
        let actionObj = null;

        // 创建战斗开始事件监听器
        const eventStart = AAD.Utils.DOM.cE('a');
        eventStart.id = 'eventStart';
        eventStart.onclick = () => {
          const info = unsafeWindow.info;
          if (option.delayReload) {
            const delayReload = setTimeout(AAD.Runtime.refreshPage, option.delayReloadTime * 1000);
            // 存储延时重载ID以便后续清除
            this.delayReloadTimer = delayReload;
          }

          if (option.dataRecordSwitch) {
            // 为基础动作注入mode值
            let actionMode = info.mode;
            if (!actionMode && info.skill) {
              // 基础动作通过skill ID识别
              if (info.skill === '#ckey_focus') actionMode = 'focus';
              else if (info.skill === '#ckey_defend') actionMode = 'defend';
              else if (info.skill === '#ckey_attack') actionMode = 'attack';
            }

            actionObj = { mode: actionMode };
            if (info.mode === 'items') {
              const itemElement = AAD.Utils.DOM.gE('#pane_item div[id^="ikey"][onclick*="skill(\'' + info.skill + '\')"]');
              actionObj.item = itemElement ? itemElement.textContent : '';
            } else if (info.mode === 'magic') {
              const magicElement = AAD.Utils.DOM.gE(info.skill);
              actionObj.magic = magicElement ? magicElement.textContent : '';
              const cost = magicElement?.getAttribute('onmouseover')?.match(/\('.*', '.*', '.*', (\d+), (\d+), \d+\)/);
              if (cost) {
                actionObj.mp = parseInt(cost[1], 10);
                actionObj.oc = parseInt(cost[2], 10);
              }
            }
          }
        };
        document.body.appendChild(eventStart);

        // 创建战斗结束事件监听器
        const eventEnd = AAD.Utils.DOM.cE('a');
        eventEnd.id = 'eventEnd';
        eventEnd.onclick = () => {
          const timeNow = Date.now();
          const runSpeed = (1000 / (timeNow - AAD.Core.State.get('timeNow', timeNow))).toFixed(2);
          AAD.Core.State.set('runSpeed', runSpeed);
          AAD.Core.State.set('timeNow', timeNow);

          if (option.delayReload) {
            clearTimeout(this.delayReloadTimer);
          }

          // 更新怪物状态
          const monsterDead = AAD.Utils.DOM.gE('img[src*="nbardead"]', 'all').length;
          const monsterAlive = AAD.Core.State.get('monsterAll', 0) - monsterDead;
          AAD.Core.State.set('monsterAlive', monsterAlive);

          // 更新Boss状态
          const bossDead = AAD.Utils.DOM.gE('div.btm1[style*="opacity"] div.btm2[style*="background"]', 'all').length;
          const bossAlive = AAD.Core.State.get('bossAll', 0) - bossDead;
          AAD.Core.State.set('bossAlive', bossAlive);

          // 处理战斗日志
          const battleLog = AAD.Utils.DOM.gE('#textlog>tbody>tr>td', 'all');
          const gemElement = AAD.Utils.DOM.gE('#ikey_p');
          if (gemElement && battleLog && battleLog.length > 0) {
            for (let i = 0; i < battleLog.length; i++) {
              const logEntry = battleLog[i];
              if (logEntry.className === 'tls') break;
              if (logEntry.textContent.includes('You do not have a powerup gem.')) {
                gemElement.remove();
                break;
              }
            }
          }
          if (option.dataRecordSwitch && actionObj) {
            actionObj.log = battleLog;
            AAD.Data.Recorder.processBattleLog(actionObj);
          }

          if (AAD.Utils.DOM.gE('#btcp')) {
            if (option.dataRecordSwitch) {
              AAD.Data.Recorder.dropMonitor(battleLog);
            }

            // 检查战斗结束条件
            const currentRound = AAD.Core.State.get('roundNow', 0);
            const totalRounds = AAD.Core.State.get('roundAll', 0);
            const isDefeat = monsterAlive > 0;
            const isVictory = !isDefeat && currentRound === totalRounds;
            const isNextRound = !isDefeat && currentRound < totalRounds;

            if (isDefeat) {
              AAD.Core.State.set('endbattle', true);
            }

            if (option.dataRecordSwitch && (isVictory || isDefeat)) {
              AAD.Data.Recorder.handleBattleEnd();
            }

            if (isNextRound) {// 下一回合             
              const completionPane = AAD.Utils.DOM.gE('#pane_completion');
              if (completionPane) {
                const btcpElement = AAD.Utils.DOM.gE('#btcp');
                if (btcpElement) {
                  completionPane.removeChild(btcpElement);
                }
              }

              // 发送下一回合请求
              AAD.Core.Network.postCallback(window.location.href, (data) => {
                if (AAD.Utils.DOM.gE('#riddlecounter', data)) {
                  // 有答题页面
                  const event = new Event('DOMContentLoaded');
                  document.dispatchEvent(event);
                  AAD.Logic.PageHandler.misspony();
                  AAD.Runtime.refreshPage();
                  return;
                }

                // 更新战斗界面
                const battleMain = AAD.Utils.DOM.gE('#battle_main');
                const battleRight = AAD.Utils.DOM.gE('#battle_right', data);
                const battleLeft = AAD.Utils.DOM.gE('#battle_left', data);

                if (battleRight && battleMain) {
                  battleMain.replaceChild(battleRight, AAD.Utils.DOM.gE('#battle_right'));
                }
                if (battleLeft && battleMain) {
                  battleMain.replaceChild(battleLeft, AAD.Utils.DOM.gE('#battle_left'));
                }

                // 重新初始化战斗对象
                unsafeWindow.battle = new unsafeWindow.Battle();
                window.battle = unsafeWindow.battle;
                unsafeWindow.battle.clear_infopane();

                const event = new Event('DOMContentLoaded');
                document.dispatchEvent(event);

                AAD.Logic.Battle.newRound();
                AAD.Logic.Battle.initBattleState();
                AAD.Logic.PageHandler.misspony();
                AAD.Logic.Battle.main();
              });
            } else if (isDefeat || isVictory) {
              // 战斗结束（胜利/战败）
              AAD.Core.Storage.delValue(2); // 清理战斗相关存储
              AAD.Core.Storage.clearBattleCache(); // 清除DOM缓存

              if (option.autoquit) {
                setTimeout(AAD.Runtime.refreshPage, AAD.Utils.Time.getRandomDelayMs(2000, 5000));
              }
            }
          } else {
            AAD.Logic.PageHandler.misspony();
            AAD.Logic.Battle.main();
          }
        };
        document.body.appendChild(eventEnd);

        // 设置会话存储
        window.sessionStorage.delay = option.delay || 0;
        window.sessionStorage.delay2 = option.delay2 || 0;

        // 注入API调用劫持脚本
        const fakeApiCall = AAD.Utils.DOM.cE('script');
        fakeApiCall.textContent = 'api_call = ' + function (b, a, d) {
          const delay = window.sessionStorage.delay * 1;
          const delay2 = window.sessionStorage.delay2 * 1;
          window.info = a;
          b.open('POST', window.MAIN_URL+'json');
          b.setRequestHeader('Content-Type', 'application/json');
          b.withCredentials = true;
          b.onreadystatechange = d;
          b.onload = function () {
            document.getElementById('eventEnd').click();
          };
          document.getElementById('eventStart').click();
          if (a.mode === 'magic' && a.skill >= 200) {
            if (delay <= 0) {
              b.send(JSON.stringify(a));
            } else {
              setTimeout(function () {
                b.send(JSON.stringify(a));
              }, delay * (Math.random() * 50 + 50) / 100);
            }
          } else {
            if (delay2 <= 0) {
              b.send(JSON.stringify(a));
            } else {
              setTimeout(function () {
                b.send(JSON.stringify(a));
              }, delay2 * (Math.random() * 50 + 50) / 100);
            }
          }
        }.toString();
        document.head.appendChild(fakeApiCall);

        // 注入API响应处理脚本
        const fakeApiResponse = AAD.Utils.DOM.cE('script');
        fakeApiResponse.textContent = 'api_response = ' + function (b) {
          if (b.readyState === 4) {
            if (b.status === 200) {
              const a = JSON.parse(b.responseText);
              if (a.login !== undefined) {
                unsafeWindow.top.window.location.href = unsafeWindow.login_url;
              } else {
                if (a.error || a.reload) window.location.href = window.location.search;
                return a;
              }
            } else {
              window.location.href = window.location.search;
            }
          }
          return false;
        }.toString();
        document.head.appendChild(fakeApiResponse);
      },

      // 使用Channel技能
      useChannelSkill() {
        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option?.channelSkillSwitch || !option?.channelSkill) return;

        // 检查是否有Channeling效果
        if (!AAD.Utils.DOM.gE('#pane_effects>img[src*="channeling"]')) {
          AAD.Utils.Common.showStatus('Channel技能: 无Channeling效果');
          return;
        }

        // 按顺序检查Channel技能
        const skillPack = Array.isArray(option.channelSkillOrder) ? option.channelSkillOrder : [];
        if (skillPack.length > 0) {

          for (let i = 0; i < skillPack.length; i++) {
            const skillKey = skillPack[i].trim();
            const condition = option['channelSkill' + skillKey + 'Condition'];

            if (option.channelSkill[skillKey] &&
                AAD.Utils.Condition.evaluateConditionGroups(condition)) {
              const skill = CAST_SUPPORT[skillKey];
              if (skill && AAD.Utils.DOM.isOn(skill.id)) {
                AAD.Utils.DOM.gE(skill.id).click();
                AAD.Core.State.set('end', true);
                return;
              }
            }
          }
        }

      },

      // 使用BUFF技能
      useBuffSkill(buffSnapshot) {
        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option?.buffSkillSwitch || !option?.buffSkill) return;

        // 检查技能
        const skillPack = Array.isArray(option.buffSkillOrder) ? option.buffSkillOrder : [];
        for (let i = 0; i < skillPack.length; i++) {
          const j = skillPack[i];
          const skill = CAST_SUPPORT[j];
          if (!skill) continue;
          if (option.buffSkill[j] &&
              AAD.Utils.Condition.evaluateConditionGroups(option['buffSkill' + j + 'Condition']) &&
              !buffSnapshot.playerBuffs[skill.img] &&
              AAD.Utils.DOM.isOn(skill.id)) {
            AAD.Utils.DOM.gE(skill.id).click();
            AAD.Core.State.set('end', true);
            return;
          }
        }

        // 检查药剂
        for (const i in CAST_BUFF_ITEMS) {
          if (!buffSnapshot.playerBuffs[CAST_BUFF_ITEMS[i].img] &&
              option.buffSkill &&
              option.buffSkill[i] &&
              AAD.Utils.Condition.evaluateConditionGroups(option['buffSkill' + i + 'Condition']) &&
              AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + CAST_BUFF_ITEMS[i].id + '"]')) {
            AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + CAST_BUFF_ITEMS[i].id + '"]').click();
            AAD.Core.State.set('end', true);
            return;
          }
        }
      },

      // 初始化战斗状态
      initBattleState() {
        // 重置结束标志
        AAD.Core.State.set('end', false);
        this.ensureBattleElements();
       
      },

      // 缓存战斗相关DOM元素
      ensureBattleElements() {
        const cachedElements = AAD.Core.State.get('battleElements');
        if (cachedElements &&
            cachedElements.hpBar &&
            cachedElements.mpBar &&
            cachedElements.spBar &&
            cachedElements.ocDisplay &&
            document.contains(cachedElements.hpBar) &&
            document.contains(cachedElements.mpBar) &&
            document.contains(cachedElements.spBar) &&
            document.contains(cachedElements.ocDisplay)) {
          return cachedElements;
        }

        const battleElements = {
          isCompactMode: !AAD.Utils.DOM.gE('#vbh'),
          hpBar: null,
          mpBar: null,
          spBar: null,
          ocDisplay: null
        };

        if (!battleElements.isCompactMode) {
          battleElements.hpBar = AAD.Utils.DOM.gE('#vbh>div>img');
          battleElements.mpBar = AAD.Utils.DOM.gE('#vbm>div>img');
          battleElements.spBar = AAD.Utils.DOM.gE('#vbs>div>img');
          battleElements.ocDisplay = AAD.Utils.DOM.gE('#vcp>div>div');
        } else {
          battleElements.hpBar = AAD.Utils.DOM.gE('#dvbh>div>img');
          battleElements.mpBar = AAD.Utils.DOM.gE('#dvbm>div>img');
          battleElements.spBar = AAD.Utils.DOM.gE('#dvbs>div>img');
          battleElements.ocDisplay = AAD.Utils.DOM.gE('#dvrc');
        }

        AAD.Core.State.set('battleElements', battleElements);
        return battleElements;
      },

      // 更新状态值 (HP/MP/SP/OC)
      updateStatusValues(elements) {
        if (!elements.isCompactMode) {
          AAD.Core.State.set('hp', elements.hpBar ? elements.hpBar.offsetWidth / 500 * 100 : 0);
          AAD.Core.State.set('mp', elements.mpBar ? elements.mpBar.offsetWidth / 210 * 100 : 0);
          AAD.Core.State.set('sp', elements.spBar ? elements.spBar.offsetWidth / 210 * 100 : 0);
          AAD.Core.State.set('oc', elements.ocDisplay ? (AAD.Utils.DOM.gE('#vcp>div>div', 'all').length - AAD.Utils.DOM.gE('#vcp>div>div#vcr', 'all').length) * 25 : 0);
        } else {
          AAD.Core.State.set('hp', elements.hpBar ? elements.hpBar.offsetWidth / 418 * 100 : 0);
          AAD.Core.State.set('mp', elements.mpBar ? elements.mpBar.offsetWidth / 418 * 100 : 0);
          AAD.Core.State.set('sp', elements.spBar ? elements.spBar.offsetWidth / 418 * 100 : 0);
          AAD.Core.State.set('oc', elements.ocDisplay ? elements.ocDisplay.textContent : 0);
        }
      },

      ensureMonsterStatus() {
        const monsterHp = AAD.Utils.DOM.gE('div.btm4>div.btm5:nth-child(1)', 'all');
        const monsterCount = monsterHp.length;
        const monsterStatus = AAD.Core.State.get('monsterStatus');
        const hasHoles = Array.isArray(monsterStatus) && monsterStatus.some(item => !item);

        if (!Array.isArray(monsterStatus) || monsterStatus.length !== monsterCount || hasHoles) {
          return this.fixMonsterStatus();
        }

        return monsterStatus;
      },

      // 加载怪物状态
      loadMonsterStatus() {
        const monsterStatusStored = AAD.Core.Storage.getValue('monsterStatus');
        const monsterAll = AAD.Core.State.get('monsterAll');

        if (monsterStatusStored && monsterStatusStored.length === monsterAll) {
          AAD.Core.State.set('monsterStatus', monsterStatusStored);
        } else {
          this.fixMonsterStatus();
        }
      },


      // 处理战斗日志
      processBattleLog() {
        AAD.Data.Recorder.processBattleLog();
      },

      // 更新战斗信息显示
      updateBattleInfo() {
        // 创建或获取战斗信息显示元素
        let logElement = AAD.Utils.DOM.gE('#dbLog');
        if (!logElement) {
          const container = AAD.Utils.DOM.gE('#dbBox2');
          if (container) {
            logElement = AAD.Utils.DOM.cE('div');
            logElement.id = 'dbLog';
            logElement.className = 'dbLog';
            container.appendChild(logElement);
          }
        }

        // 攻击模式状态数组
        const attackStatusNames = [
          '物理', '火', '冰', '雷', '风', '圣', '暗'
        ];

        // 获取战斗数据
        const turn = AAD.Core.State.get('turn', 0);
        const totalTurns = AAD.Data.Recorder.combat?.stats?.totalTurns || 0;
        const runSpeed = AAD.Core.State.get('runSpeed', 0);
        const roundNow = AAD.Core.State.get('roundNow', 0);
        const roundAll = AAD.Core.State.get('roundAll', 0);
        const attackStatus = AAD.Core.State.get('attackStatus', 0);
        const monsterAlive = AAD.Core.State.get('monsterAlive', 0);
        const monsterAll = AAD.Core.State.get('monsterAll', 0);

        // 更新页面战斗信息显示
        if (logElement) {
          logElement.innerHTML = `Turns: ${turn}<br>Total: ${totalTurns} t<br>Speed: ${runSpeed} t/s<br>Round: ${roundNow}/${roundAll}<br>攻击模式: ${attackStatusNames[attackStatus] || '未知'}<br>敌人: ${monsterAlive}/${monsterAll}`;
        }

        // 更新页面标题
        document.title = `${turn}||${runSpeed}||${roundNow}/${roundAll}||${monsterAlive}/${monsterAll}`;
        this.countMonsterHP();
      },

      // 统计怪物血量
      countMonsterHP() {
        const monsterHp = AAD.Utils.DOM.gE('div.btm4>div.btm5:nth-child(1)', 'all');
        const namedivs = AAD.Utils.DOM.gE('div.btm3>div>div', 'all');
        const monsterStatus = AAD.Core.State.get('monsterStatus');
        const option = AAD.Core.Storage.getValue('option') || {};
        let hpArray = [];
        let yggdrasilOrder = null;

        // 第一次循环 - 更新血量和死亡状态
        for (let i = 0; i < monsterHp.length; i++) {
          if (AAD.Utils.DOM.gE('img[src*="nbardead.png"]', monsterHp[i])) {
            monsterStatus[i].isDead = true;
            monsterStatus[i].hpNow = Infinity;
          } else {
            monsterStatus[i].isDead = false;
            monsterStatus[i].hpNow = Math.floor(monsterStatus[i].hp * parseFloat(AAD.Utils.DOM.gE('img', monsterHp[i]).style.width) / 120) + 1;
            hpArray.push(monsterStatus[i].hpNow);
          }
        }

        AAD.Core.Storage.setValue('monsterStatus', monsterStatus);

        // 计算全局的最大最小血量（必须在第一次循环完成后）
        const hpLowest = Math.min.apply(null, hpArray);
        const hpMost = Math.max.apply(null, hpArray);
        const ruleReverse = option.ruleReverse;

        // 第二次循环 - 计算权重 + 特殊怪物调整
        for (let i = 0; i < monsterStatus.length; i++) {
          // 1. 计算基础权重
          if (monsterStatus[i].isDead) {
            monsterStatus[i].finWeight = Infinity;
          } else {
            monsterStatus[i].finWeight = ruleReverse ? hpMost / monsterStatus[i].hpNow * 10 : monsterStatus[i].hpNow / hpLowest * 10;
          }

          // 2. 特殊怪物权重调整
          const name = namedivs[i] ? namedivs[i].textContent : '';
          if (name === "Yggdrasil") {
            if (!monsterStatus[i].isDead && yggdrasilOrder === null) {
              yggdrasilOrder = i;
            }
            monsterStatus[i].finWeight += monsterStatus[i].isDead ? Infinity : -9999;
          } else if (name === "Urd") {
            monsterStatus[i].finWeight += monsterStatus[i].isDead ? Infinity : 9999;
          }
        }

        AAD.Core.State.set('yggdrasilOrder', yggdrasilOrder);

        // Debuff权重调整
        const monsterBuff = AAD.Utils.DOM.gE('div.btm6', 'all');
        const weight = option.weight || {};

        const debuffCount = Math.min(monsterStatus.length, monsterBuff.length);
        for (let i = 0; i < debuffCount; i++) {
          for (const j in DEBUFF_STATUS) {
            const weightValue = weight[j] ?? 0;
            monsterStatus[i].finWeight += (AAD.Utils.DOM.gE('img[src*="' + DEBUFF_STATUS[j].img + '"]', monsterBuff[i])) ? (ruleReverse ? -weightValue : weightValue) : 0;
          }
        }

        // 怪物头部背景权重调整
        const monsterHead = AAD.Utils.DOM.gE('div.btm1', 'all');
        const headCount = Math.min(monsterStatus.length, monsterHead.length);
        for (let i = 0; i < headCount; i++) {
          monsterStatus[i].finWeight += (AAD.Utils.DOM.gE('.btm2[style^="background"]', monsterHead[i])) ? (ruleReverse ? 1000 : -1000) : 0;
        }

        // 顺序攻击规则
        const roundType = AAD.Core.State.get('roundType');
        // 全局顺序攻击：在所有场合生效
        if (option.ruleOrderGlobal) {
          for (let i = 0; i < headCount; i++) {
            monsterStatus[i].finWeight = monsterStatus[i].isDead ? Infinity : (ruleReverse ? (monsterHead.length - i) : i);
          }
        }
        // 塔内顺序攻击：仅在塔楼生效
        else if (option.ruleOrder && (roundType === 'tw')) {
          for (let i = 0; i < headCount; i++) {
            monsterStatus[i].finWeight = monsterStatus[i].isDead ? Infinity : (ruleReverse ? (monsterHead.length - i) : i);
          }
        }

        monsterStatus.sort(AAD.Utils.Array.objArrSort('finWeight'));
        AAD.Core.State.set('monsterStatus', monsterStatus);
      },

      // 新回合初始化
      newRound() {
        AAD.Core.State.set('turn', 0);

        if (window.location.hash !== '') {
          AAD.Runtime.refreshPage();
          return;
        }

        // 统计怪物数量
        const monsterCount = AAD.Utils.DOM.gE('div.btm1', 'all').length;
        AAD.Core.State.set('monsterAll', monsterCount);

        const monsterDead = AAD.Utils.DOM.gE('img[src*="nbardead"]', 'all').length;
        AAD.Core.State.set('monsterAlive', monsterCount - monsterDead);

        // 统计Boss数量
        AAD.Core.State.set('bossAll', AAD.Utils.DOM.gE('div.btm2[style^="background"]', 'all').length);
        const bossDead = AAD.Utils.DOM.gE('div.btm1[style*="opacity"] div.btm2[style*="background"]', 'all').length;
        AAD.Core.State.set('bossAlive', AAD.Core.State.get('bossAll') - bossDead);

        // 获取战斗日志
        const battleLog = AAD.Utils.DOM.gE('#textlog>tbody>tr>td', 'all');

        // 识别回合类型
        AAD.Core.State.set('roundType', (function () {
          const option = AAD.Core.Storage.getValue('option') || {};
          if (AAD.Core.Storage.getValue('roundType')) {
            const savedRoundType = AAD.Core.Storage.getValue('roundType');
            return savedRoundType;
          } else {
            let roundType;
            const temp = battleLog[battleLog.length - 1].textContent;
            if (!temp.match(/^Initializing/)) {
              roundType = '';
            } else if (temp.match(/^Initializing The Tower/)) {
              roundType = 'tw';
            } else if (temp.match(/^Initializing arena challenge/) && temp.match(/\d+/)[0] * 1 <= 35) {
              roundType = 'ar';
            } else if (temp.match(/^Initializing arena challenge/) && temp.match(/\d+/)[0] * 1 >= 105) {
              roundType = 'rb';
            } else if (temp.match(/^Initializing random encounter/)) {
              roundType = 'ba';
              if (option?.encounter && AAD.Logic.Encounter?.recordEncounterStart) {
                AAD.Logic.Encounter.recordEncounterStart(Date.now());
              }
            } else if (temp.match(/^Initializing Item World/)) {
              roundType = 'iw';
            } else if (temp.match(/^Initializing Grindfest/)) {
              roundType = 'gr';
            } else {
              roundType = '';
            }
            AAD.Core.Storage.setValue('roundType', roundType);
            return roundType;
          }
        })());

        const skillOTOS = {};
        for (const key in SPECIAL_SKILLS) {
          skillOTOS[key] = 0;
        }
        AAD.Core.State.set('skillOTOS', skillOTOS);

        // 如果是新战斗开始，初始化战斗记录器
        if (battleLog[battleLog.length - 1].textContent.match('Initializing')) {
          // 强制开启新战斗，防止沿用上一场时间
          AAD.Data.Recorder.startBattle();

          const monsterStatus = [];
          let id = 0;

          // 解析怪物信息
          for (let i = battleLog.length - 2; i > battleLog.length - 2 - AAD.Core.State.get('monsterAll'); i--) {
            let match = battleLog[i].textContent.match(/MID=(\d+).*LV=(\d+).*HP=(\d+)$/);
            let hp = match[3] * 1;
            if (isNaN(hp)) hp = monsterStatus[monsterStatus.length - 1].hp;

            monsterStatus[id] = {
              order: id,
              id: (id === 9) ? 0 : id + 1,
              hp: hp
            };
            id = id + 1;
          }

          AAD.Core.Storage.setValue('monsterStatus', monsterStatus);
          AAD.Core.State.set('monsterStatus', monsterStatus);

          // 从Initializing日志中解析回合信息
          const round = battleLog[battleLog.length - 1].textContent.match(/\(Round (\d+) \/ (\d+)\)/);
          let roundNow, roundAll;
          if (AAD.Core.State.get('roundType') !== 'ba' && round !== null) {
            roundNow = round[1] * 1;
            roundAll = round[2] * 1;
          } else {
            roundNow = 1;
            roundAll = 1;
          }

          // 直接保存到Storage
          AAD.Core.Storage.setValue('roundNow', roundNow);
          AAD.Core.Storage.setValue('roundAll', roundAll);
        } else if (!AAD.Core.Storage.getValue('monsterStatus') ||
                   AAD.Core.Storage.getValue('monsterStatus').length !== AAD.Utils.DOM.gE('div.btm2', 'all').length) {
          // 非初始化情况：重置回合信息
          AAD.Core.Storage.setValue('roundNow', 1);
          AAD.Core.Storage.setValue('roundAll', 1);
          AAD.Logic.Battle.fixMonsterStatus();
        }

        // 同步加载到内存状态
        AAD.Core.State.set('roundNow', AAD.Core.Storage.getValue('roundNow'));
        AAD.Core.State.set('roundAll', AAD.Core.Storage.getValue('roundAll'));
        AAD.Core.State.set('roundLeft', AAD.Core.Storage.getValue('roundAll') - AAD.Core.Storage.getValue('roundNow'));

      
      },

      // 修复怪物状态
      fixMonsterStatus() {
        document.title = AAD.Utils.Common.alert(-1, 'monsterStatus错误，正在尝试修复');
        const monsterStatus = [];
        AAD.Utils.DOM.gE('div.btm2', 'all').forEach(function(monster, i) {
          monsterStatus.push({
            order: i,
            id: (i === 9) ? 0 : i + 1,
            hp: (monster.style.background === '') ? 1000 : 100000
          });
        });
        AAD.Core.Storage.setValue('monsterStatus', monsterStatus);
        AAD.Core.State.set('monsterStatus', monsterStatus);
        return monsterStatus;
      },





      // 战斗技能模块
      Skills: {

        // 使用Debuff技能
        useDeSkill(buffSnapshot) {
          const option = AAD.Core.Storage.getValue('option') || {};
          if (!option.debuffSkillSwitch || !option.debuffSkill) return false;
          if (!buffSnapshot || !Array.isArray(buffSnapshot.monsters)) return false;

          const skillPack = Array.isArray(option.debuffSkillOrder) ? option.debuffSkillOrder : [];
          const monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus || !monsterStatus[0]) return false;

          const targetOrder = monsterStatus[0].order;
          const snapshotMonsters = buffSnapshot.monsters;
          if (targetOrder < 0 || targetOrder >= snapshotMonsters.length) return false;
          const targetMonsterData = snapshotMonsters[targetOrder];
          if (!targetMonsterData) return false;
          const targetSlots = targetMonsterData.slots || 0;
          if (targetSlots >= GAME_MECHANICS.BUFF_SLOT_LIMIT) return false;

          for (let i = 0; i < skillPack.length; i++) {
            const j = skillPack[i];
            const skill = DEBUFF_CAST[j];
            if (!skill) continue;
            const buffs = targetMonsterData.buffs || {};
            const hasBuff = Object.prototype.hasOwnProperty.call(buffs, skill.img);
            if (option.debuffSkill[j] &&
                AAD.Utils.DOM.isOn(skill.id) &&
                AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkill' + j + 'Condition']) &&
                !hasBuff) {
                AAD.Utils.DOM.gE(skill.id).click();

                // 全局顺序攻击：在所有场合生效
                if (option.ruleOrderGlobal && 2 < AAD.Core.State.get('monsterAlive')) {
                  AAD.Utils.DOM.gE('#mkey_' + AAD.Core.State.get('monsterStatus')[1].id).click();
                }
                // 塔内顺序攻击：仅在塔楼生效
                else if (option.ruleOrder && AAD.Core.State.get('roundType') === 'tw' && 2 < AAD.Core.State.get('monsterAlive')) {
                  AAD.Utils.DOM.gE('#mkey_' + AAD.Core.State.get('monsterStatus')[1].id).click();
                }
                else {
                  AAD.Utils.DOM.gE('#mkey_' + AAD.Core.State.get('monsterStatus')[0].id).click();
                }

                AAD.Core.State.set('end', true);
                return true;
            }
          }
          return false;
        },

        // 快照统计某Debuff数量（槽满视为已满足）
        countBuffInSnapshot(buffSnapshot, buffKey, threshold = 0) {
          const monsters = buffSnapshot?.monsters || [];
          let count = 0;

          for (let i = 0; i < monsters.length; i++) {
            const monster = monsters[i];
            if (!monster) continue;

            const slots = monster.slots || 0;
            if (slots >= GAME_MECHANICS.BUFF_SLOT_LIMIT) {
              count += 1;
              continue;
            }

            const buffs = monster.buffs || {};
            const hasBuff = Object.prototype.hasOwnProperty.call(buffs, buffKey);
            if (threshold > 0) {
              if (hasBuff && buffs[buffKey] > threshold) count += 1;
            } else if (hasBuff) {
              count += 1;
            }
          }

          return count;
        },

        // 对所有怪物施放Debuff
        castDebuffToAll(skillKey, reverseOrder, buffSnapshot) {
          const skill = DEBUFF_CAST[skillKey];
          if (!skill) return false;
          if (!buffSnapshot || !Array.isArray(buffSnapshot.monsters)) return false;
          const skillId = skill.id;
          const imgName = skill.img;
          const conflicts = Array.isArray(skill.conflicts) ? skill.conflicts : [];
          const isSleep = (imgName === 'sleep');
          const isReverseOrder = !!reverseOrder;
          const skillAvailable = AAD.Utils.DOM.isOn(skillId);
          if (!skillAvailable) return false;

          let monsterStatus = AAD.Core.State.get('monsterStatus');
          if (!monsterStatus) return false;

          // 按照order排序
          monsterStatus = [...monsterStatus].sort((a, b) => a.order - b.order);

          const snapshotMonsters = buffSnapshot.monsters;
          const length = Math.min(monsterStatus.length, snapshotMonsters.length);
          if (length <= 0) return false;

          // 确定遍历方向和范围
          const start = isReverseOrder ? length - 1 : 0;
          const end = isReverseOrder ? 0 : length - 1;
          const step = isReverseOrder ? -1 : 1;

          for (let i = start; isReverseOrder ? i > end : i < length; i += step) {
            if (i >= length || i < 0) continue;

            // 检查是否需要施放Debuff（从快照读取）
            const monsterData = snapshotMonsters[i];
            if (!monsterData) continue;
            const slots = monsterData.slots || 0;
            const buffs = monsterData.buffs || {};
            const hasBuff = Object.prototype.hasOwnProperty.call(buffs, imgName);
            let hasConflict = false;
            for (let c = 0; c < conflicts.length; c++) {
              if (Object.prototype.hasOwnProperty.call(buffs, conflicts[c])) {
                hasConflict = true;
                break;
              }
            }
            let canCast = false;
            if (isSleep) {
              const turns = hasBuff ? (buffs[imgName] || 0) : 0;
              if (slots >= GAME_MECHANICS.BUFF_SLOT_LIMIT) {
                canCast = hasBuff && turns <= GAME_MECHANICS.DEBUFF_EFFECTIVE_TURNS;
              } else {
                canCast = !hasBuff || turns <= GAME_MECHANICS.DEBUFF_EFFECTIVE_TURNS;
              }
            } else if (slots < GAME_MECHANICS.BUFF_SLOT_LIMIT && !hasBuff) {
              canCast = true;
            }
            const isAlive = !monsterStatus[i].isDead;

            if (canCast && !hasConflict && isAlive) {
              AAD.Utils.DOM.gE(skillId).click();

              // 提取目标选择逻辑
              this.selectDebuffTarget(i, length, monsterStatus, isReverseOrder);

              AAD.Core.State.set('end', true);
              // 确保恢复排序
              monsterStatus.sort(AAD.Utils.Array.objArrSort('finWeight'));
              AAD.Core.State.set('monsterStatus', monsterStatus);
              return true;
            }
          }

          // 确保恢复排序
          monsterStatus.sort(AAD.Utils.Array.objArrSort('finWeight'));
          AAD.Core.State.set('monsterStatus', monsterStatus);
          return false;
        },

        // 选择Debuff目标
        selectDebuffTarget(i, length, monsterStatus, reverseOrder) {
          // 特殊处理：sleep从后往前，优先选择前一个目标
          if (reverseOrder) {
            if (i === 0) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i].id).click();
            } else if (i - 1 > -1 && !monsterStatus[i - 1].isDead) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i - 1].id).click();
            } else if (i + 1 < length && !monsterStatus[i + 1].isDead) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i + 1].id).click();
            } else {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i].id).click();
            }
          } else {
            // 正常顺序：优先选择下一个目标
            if (i + 1 === length) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i].id).click();
            } else if (i + 1 < length && !monsterStatus[i + 1].isDead) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i + 1].id).click();
            } else if (i - 1 > -1 && !monsterStatus[i - 1].isDead) {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i - 1].id).click();
            } else {
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[i].id).click();
            }
          }
        },

        // 执行Debuff策略
        executeDebuffStrategy(buffSnapshot) {
          const option = AAD.Core.Storage.getValue('option') || {};
          const monsterAlive = AAD.Core.State.get('monsterAlive');
          let targetCount = 0;

          if (option.debuffSkillAllSleep && AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkillallsleepCondition'])) {
            const sleepCount = this.countBuffInSnapshot(buffSnapshot, 'sleep', GAME_MECHANICS.DEBUFF_EFFECTIVE_TURNS); 
            const minAwake = 3;
            const awakeMonstersCount = monsterAlive - sleepCount;
            if (awakeMonstersCount > minAwake) {
              targetCount = (monsterAlive - 1) * option.sleepRatio;
              if (sleepCount < targetCount) {
                AAD.Logic.Battle.GroupSkills.allsleep(buffSnapshot);
                if (AAD.Core.State.get('end')) return;
              }
            }
          }

          if (option.debuffSkillAllMN && AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkillallmagnetCondition'])) {
            const magnetCount = this.countBuffInSnapshot(buffSnapshot, 'magnet'); 
            targetCount = (monsterAlive - 1) * option.magnetRatio;
            if (magnetCount < targetCount) {
              AAD.Logic.Battle.GroupSkills.allmagnet(buffSnapshot);
              if (AAD.Core.State.get('end')) return;
            }
          }

          if (option.debuffSkillAllWeak && AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkillallweakCondition'])) {
            const weakenCount = this.countBuffInSnapshot(buffSnapshot, 'weaken'); 
            targetCount = monsterAlive * option.weakRatio;
            if (weakenCount < targetCount) {
              AAD.Logic.Battle.GroupSkills.allweaken(buffSnapshot);
              if (AAD.Core.State.get('end')) return;
            }
          }

          if (option.debuffSkillAllSi && AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkillallsilenceCondition'])) {
            const silenceCount = this.countBuffInSnapshot(buffSnapshot, 'silence');
            targetCount = monsterAlive  * option.silenceRatio;
            if (silenceCount < targetCount) {
              AAD.Logic.Battle.GroupSkills.allsilence(buffSnapshot);
              if (AAD.Core.State.get('end')) return;
            }
          }

          if (option.debuffSkillAllIm && AAD.Utils.Condition.evaluateConditionGroups(option['debuffSkillallimpCondition'])) {
            const imperilCount = this.countBuffInSnapshot(buffSnapshot, 'imperil'); 
            targetCount = monsterAlive * option.impRatio;
            if (imperilCount < targetCount) {
              AAD.Logic.Battle.GroupSkills.allImperiled(buffSnapshot);
              if (AAD.Core.State.get('end')) return;
            }
          }

          // 单体施法
          if (option.debuffSkillSwitch && option.debuffSkill && AAD.Utils.Condition.evaluateConditionGroups(option.debuffSkillCondition)) {
            this.useDeSkill(buffSnapshot);
          }
        }
      },

      // 群体技能模块
      GroupSkills: {
        allsleep(buffSnapshot) {
          AAD.Logic.Battle.Skills.castDebuffToAll('Sle', true, buffSnapshot);
          return AAD.Core.State.get('end');
        },

        allweaken(buffSnapshot) {
          AAD.Logic.Battle.Skills.castDebuffToAll('We', false, buffSnapshot);
          return AAD.Core.State.get('end');
        },

        allsilence(buffSnapshot) {
          AAD.Logic.Battle.Skills.castDebuffToAll('Si', false, buffSnapshot);
          return AAD.Core.State.get('end');
        },

        allmagnet(buffSnapshot) {
          AAD.Logic.Battle.Skills.castDebuffToAll('MN', false, buffSnapshot);
          return AAD.Core.State.get('end');
        },

        allImperiled(buffSnapshot) {
          AAD.Logic.Battle.Skills.castDebuffToAll('Im', false, buffSnapshot);
          return AAD.Core.State.get('end');
        }
      },

      Special: {

        // 自动使用宝石 
        useGem() {
          const gemElement = AAD.Utils.DOM.gE('#ikey_p');
          if (!gemElement) return;

          const gem = gemElement.textContent;
          const option = AAD.Core.Storage.getValue('option') || {};

          if (gem === 'Health Gem' && option.item && option.item.HealthGem && AAD.Utils.Condition.evaluateConditionGroups(option.itemHealthGemCondition)) {
            gemElement.click();
            AAD.Core.State.set('end', true);
          } else if (gem === 'Mana Gem' && option.item && option.item.ManaGem && AAD.Utils.Condition.evaluateConditionGroups(option.itemManaGemCondition)) {
            gemElement.click();
            AAD.Core.State.set('end', true);
          } else if (gem === 'Spirit Gem' && option.item && option.item.SpiritGem && AAD.Utils.Condition.evaluateConditionGroups(option.itemSpiritGemCondition)) {
            gemElement.click();
            AAD.Core.State.set('end', true);
          } else if (gem === 'Mystic Gem' && option.item && option.item.MysticGem && AAD.Utils.Condition.evaluateConditionGroups(option.itemMysticGemCondition)) {
            gemElement.click();
            AAD.Core.State.set('end', true);
          }
        },

        // 自动回血回魔 
        deadSoon() {
          const option = AAD.Core.Storage.getValue('option') || {};
          const itemOrder = Array.isArray(option.itemOrder) ? option.itemOrder : [];
          if (itemOrder.length === 0) return;

          if (!AAD.Core.State.get('_cachedItemOrder') ||
              AAD.Core.State.get('_cachedItemOrderKey') !== itemOrder.join(',')) {
            const mappedOrder = [];
            for (let i = 0; i < itemOrder.length; i++) {
              const key = itemOrder[i];
              const item = CAST_ITEMS[key];
              if (item) {
                mappedOrder.push({ key, id: item.id });
              }
            }
            AAD.Core.State.set('_cachedItemOrder', mappedOrder);
            AAD.Core.State.set('_cachedItemOrderKey', itemOrder.join(','));
          }

          const cache = AAD.Core.State.get('_cachedItemOrder');
          for (let i = 0; i < cache.length; i++) {
            const item = cache[i];
            const itemNode = AAD.Utils.DOM.isOn(item.id);
            if (option.item[item.key] &&
                AAD.Utils.Condition.evaluateConditionGroups(option['item' + item.key + 'Condition']) &&
                itemNode) {
              itemNode.click();
              AAD.Core.State.set('end', true);
              return;
            }
          }
        },

        // 自动使用卷轴 
        useScroll(buffSnapshot) {
          const option = AAD.Core.Storage.getValue('option') || {};
          if (!option?.scrollSwitch || !option?.scroll) return;

          const scrollFirst = (option.scrollFirst) ? '_scroll' : '';

          for (const i in CAST_SCROLLS) {
            const scroll = CAST_SCROLLS[i];
            const buffImgs = scroll.buffImgs || [];
            if (option.scroll[i] &&
                AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + scroll.id + '"]') &&
                AAD.Utils.Condition.evaluateConditionGroups(option['scroll' + i + 'Condition'])) {

              const hasBuff = buffImgs.some(img => buffSnapshot.playerBuffs[img + scrollFirst]);
              if (!hasBuff) {
                AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + scroll.id + '"]').click();
                AAD.Core.State.set('end', true);
                return;
              }
            }
          }
        },

        // 自动使用魔药 
        useInfusions() {
          const attackStatus = AAD.Core.State.get('attackStatus');

          if (CAST_INFUSIONS[attackStatus] &&
              AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + CAST_INFUSIONS[attackStatus].id + '"]') &&
              !AAD.Utils.DOM.gE('#pane_effects>img[src*="' + CAST_INFUSIONS[attackStatus].img + '"]')) {
            AAD.Utils.DOM.gE('.bti3>div[onmouseover*="' + CAST_INFUSIONS[attackStatus].id + '"]').click();
            AAD.Core.State.set('end', true);
          }
        }
      },

      // 战斗核心模块
      Core: {
        // 检查是否应该跳过攻击 - 战斗基础检查，所有子模块共享
        shouldSkipAttack() {
          const option = AAD.Core.Storage.getValue('option') || {};

          // 检查Focus技能
          if (option.focus && AAD.Utils.Condition.evaluateConditionGroups(option.focusCondition)) {
            AAD.Utils.DOM.gE('#ckey_focus').click();
            return true;
          }

          // 检查Spirit Shield切换
          const shouldToggleSS = (option.turnOnSS && AAD.Utils.Condition.evaluateConditionGroups(option.turnOnSSCondition) && !AAD.Utils.DOM.gE('#ckey_spirit[src*="spirit_a"]')) ||
                                 (option.turnOffSS && AAD.Utils.Condition.evaluateConditionGroups(option.turnOffSSCondition) && AAD.Utils.DOM.gE('#ckey_spirit[src*="spirit_a"]'));
          if (shouldToggleSS) {
            AAD.Utils.DOM.gE('#ckey_spirit').click();
            AAD.Core.State.set('end', true);
            return true;
          }

          return false;
        },

        // 选择攻击技能 - 战斗核心逻辑，所有子模块共享
        selectAttackSkill() {
          let tmode = 0; // 0 物理攻击 非0是魔法攻击
          const option = AAD.Core.Storage.getValue('option') || {};
          const attackStatus = AAD.Core.State.get('attackStatus') || 0;
          const monsterStatus = AAD.Core.State.get('monsterStatus');

          // 检查Ether Tap 
          if (option.etherTap &&
              monsterStatus && monsterStatus.length > 0 &&
              AAD.Utils.DOM.gE('#mkey_' + monsterStatus[0].id + '>div.btm6>img[src*="coalescemana"]') &&
              (!AAD.Utils.DOM.gE('#pane_effects>img[onmouseover*="Ether Tap (x2)"]') ||
               AAD.Utils.DOM.gE('#pane_effects>img[src*="wpn_et"][id*="effect_expire"]')) &&
              AAD.Utils.Condition.evaluateConditionGroups(option.etherTapCondition)) {
            // Ether Tap处理 - 不设置tmode，保持为0（物理攻击）
          } else if (attackStatus !== 0) {
            // 选择职业技能
            if (AAD.Utils.Condition.evaluateConditionGroups(option.highSkillCondition) && AAD.Utils.DOM.isOn('1' + attackStatus + '3')) {
              AAD.Utils.DOM.gE('1' + attackStatus + '3').click();
              tmode = 3;
            } else if (AAD.Utils.Condition.evaluateConditionGroups(option.middleSkillCondition) && AAD.Utils.DOM.isOn('1' + attackStatus + '2')) {
              AAD.Utils.DOM.gE('1' + attackStatus + '2').click();
              tmode = 2;
            } else if (AAD.Utils.DOM.isOn('1' + attackStatus + '1')) {
              AAD.Utils.DOM.gE('1' + attackStatus + '1').click();
              tmode = 1;
            }
          }

          return tmode;
        },

        // 使用其他技能
        useSpecialSkills() {
          const option = AAD.Core.Storage.getValue('option') || {};
          if (!option.skillSwitch) return null;

          const skillOrder = Array.isArray(option.skillOrder) ? option.skillOrder : [];
          if (skillOrder.length === 0) return null;
          const oc = AAD.Core.State.get('oc') || 0;
          const skillOTOS = AAD.Core.State.get('skillOTOS') || {};
          const fightingStyle = option.fightingStyle || '1';

          const getSkillId = (skillType) => {
            const skill = SPECIAL_SKILLS[skillType];
            if (!skill) return null;
            if (skill.id) return skill.id;
            return '2' + fightingStyle + skill.idSuffix;
          };

          for (const skillType of skillOrder) {
            const skill = SPECIAL_SKILLS[skillType];
            const skillId = getSkillId(skillType);
            if (!skill || !skillId) continue;

            // 检查条件：条件满足 && 技能可用 && OC足够
            if (!AAD.Utils.Condition.evaluateConditionGroups(option['skill' + skillType + 'Condition']) ||
                !AAD.Utils.DOM.isOn(skillId) ||
                oc < skill.oc) {
              continue;
            }

            // 检查OTOS限制
            if (option.skillOTOS && option.skillOTOS[skillType] && skillOTOS[skillType] >= 1) {
              continue;
            }

            // 使用技能
            skillOTOS[skillType] = (skillOTOS[skillType] || 0) + 1;
            AAD.Core.State.set('skillOTOS', skillOTOS);
            AAD.Utils.DOM.gE(skillId).click();
            return skillType;
          }

          return null;
        },

        // AOE目标选择 - 战斗核心逻辑，所有子模块共享
        selectAOETarget(tmode, buffSnapshot) {
          const hasSnapshot = !!buffSnapshot;
          const mon = AAD.Utils.DOM.gE('div.btm1', 'all');
          const monsterTotal = mon.length;
          if (monsterTotal === 0) return;

          // 计算AOE选点所需的“向后搜索距离”
          const getNextNum = (mode) => {
            if (mode === 1) return 2;
            if (mode === 2) return 3;
            return 4;
          };

          // 计算施法范围
          const getCastRange = (mode) => {
            if (mode === 3) return (AAD.Runtime.pageType === 'isekai') ? GAME_MECHANICS.AOE_T3_RANGE_ISEKAI : 10;
            if (mode === 2) return 7;
            return 5;
          };

          const nextnum = getNextNum(tmode);
          const castRange = getCastRange(tmode);
          const halfRange = Math.ceil(castRange / 2);

          // 判定指定位置是否可点（存活）
          const isAlive = (index) => {
            const node = mon[index];
            return !!(node && node.hasAttribute('onclick'));
          };

          // 判定指定位置是否存在回流（coalescemana）
          const hasCoalesce = (index) => {
            if (!hasSnapshot) return false;
            if (!isAlive(index)) return false;
            const buffs = buffSnapshot.monsters[index]?.buffs;
            return !!(buffs && Object.prototype.hasOwnProperty.call(buffs, 'coalescemana'));
          };

          // 在区间内寻找最早出现的回流目标
          const findFirstCoalesce = (startIndex, endIndex) => {
            for (let i = startIndex; i <= endIndex; i++) {
              if (hasCoalesce(i)) return i;
            }
            return -1;
          };

          // 按当前“最优AOE”规则计算施法中心索引
          const resolveAOECenterIndex = () => {
            for (let i = 0; i < monsterTotal; i++) {
              if (!isAlive(i)) continue;
              let centerIndex = i;
              if (i <= monsterTotal - nextnum) {
                for (let ii = i + nextnum; ii > i; ii--) {
                  if (ii < monsterTotal && isAlive(ii)) {
                    centerIndex = ii;
                    break;
                  }
                }
              }
              return centerIndex;
            }
            return -1;
          };

          const yggdrasilOrder = AAD.Core.State.get('yggdrasilOrder', null);
          if (yggdrasilOrder !== null && yggdrasilOrder >= 0 && yggdrasilOrder < monsterTotal) {
            const yggdrasilTarget = mon[yggdrasilOrder];
            if (yggdrasilTarget && yggdrasilTarget.hasAttribute('onclick')) {
              yggdrasilTarget.click();
              return;
            }
          }

          if (monsterTotal <= castRange) {
            const coalesceIndex = findFirstCoalesce(0, monsterTotal - 1);
            if (coalesceIndex !== -1) {
              mon[coalesceIndex].click();
              return;
            }
          }

          const centerIndex = resolveAOECenterIndex();
          if (centerIndex === -1) return;

          if (centerIndex + 1 <= halfRange) {
            const coalesceIndex = findFirstCoalesce(0, centerIndex);
            if (coalesceIndex !== -1) {
              mon[coalesceIndex].click();
              return;
            }
          }

          mon[centerIndex].click();
        },

    

        // 核心攻击函数
        attack(buffSnapshot) {

          if (this.shouldSkipAttack()) {
            return;
          }

          const tmode = this.selectAttackSkill();

          const usedSkill = this.useSpecialSkills();

          const monsterStatus = AAD.Core.State.get('monsterStatus');

          if (tmode === 0) {
            if (usedSkill === 'T3') {
              this.selectAOETarget(2);
            } else {
              if (monsterStatus && monsterStatus.length > 0) {
                AAD.Utils.DOM.gE('#mkey_' + monsterStatus[0].id).click();
              }
            }
          } else {
            this.selectAOETarget(tmode, buffSnapshot, true);
          }

          AAD.Core.State.set('end', true);
        }
      }
    },


    // 竞技场模块
    Arena: {
      ensureDailyReset() {
        const option = AAD.Core.Storage.getValue('option') || {};
        return AAD.Core.DailyReset.ensure(
          'arena',
          'world',
          () => !!option.idleArena,
          (info) => this.resetDailyState(info)
        );
      },

      // 闲置竞技场主函数 
      async runArena() {
        const option = AAD.Core.Storage.getValue('option') || {};
        const resetState = this.ensureDailyReset();
        if (!resetState) {
          return;
        }
        let arena = this.getArenaData();

        // ========== 竞技场完成检查 ==========
        if (arena.isOk) {
          this.handleArenaCompleteIfNeeded(arena);
          return;
        }

        // ========== 体力恢复检查 ==========
        if (option.restoreStamina && AAD.Utils.DOM.gE('#stamina_readout .fc4.far>div')) {
          const staminaElement = AAD.Utils.DOM.gE('#stamina_readout .fc4.far>div');
          const stamina = parseInt(staminaElement.textContent.match(/\d+/)[0], 10);
          if (stamina <= option.staminaLow && stamina < 85) {
            const data = await AAD.Core.Network.postPromise("?s=Bazaar&ss=is");
            const inventory = await AAD.Logic.Utility.getStock(data);
            if (inventory && inventory['Energy Drink'] > 0) {
              AAD.Core.Network.postCallback(window.location.href, AAD.Runtime.refreshPage, 'recover=stamina');
              return;
            }
          }
        }

        // ========== 自动Shard检查 ==========
        if (option.autoshard && AAD.Core.Storage.getValue('noautosh')) {
          const shardlist = option.autoshardlist;
          if (shardlist && shardlist.length > 0) {
            await this.autoshard(shardlist.split(",").map(s => s.trim()), 1);
            AAD.Core.Storage.setValue('noautosh', false);
            setTimeout(AAD.Runtime.refreshPage, 3000);
            return;
          }
        }
        AAD.Core.Storage.setValue('noautosh', true);

        // ========== 初始化竞技场数组 ==========
        if (!arena.array) {
          const idleArenaOrder = option.idleArenaOrder;
          if (Array.isArray(idleArenaOrder)) {
            arena.array = idleArenaOrder.slice();
          } else {
            arena.array = [];
          }
        }

        // 如果arena.array为空，直接标记完成
        if (arena.array.length === 0) {
          this.setArenaComplete(arena, '当前世界无竞技场配置');
          return;
        }

        // ========== 处理竞技场队列 ==========
        const entry = this.getNextArenaEntry(arena);
        if (!entry) {
          this.setArenaComplete(arena, '当前世界竞技场全部完成');
          return;
        }

        AAD.Core.Storage.setValue('arena', arena);

        await this.applyArenaLoadout(entry);

        // 设置页面标题并执行战斗
        document.title = AAD.Utils.Common.alert(-1, '闲置竞技场');

        // 执行战斗
        if (entry.type === 'gr') {
          await this.executeGrindFestBattle(arena);
        } else if (entry.type === 'tw') {
          await this.executeTowerBattle(arena);
        } else {
          await this.executeArenaBattleById(arena, entry.href, entry.id);
        }
      },

      getArenaData() {
        let arena = AAD.Core.Storage.getValue('arena');
        if (!arena) {
          arena = this.createArenaState();
          AAD.Core.Storage.setValue('arena', arena);
        }
        return arena;
      },

      createArenaState() {
        return this.buildArenaState({
          dayKey: AAD.Utils.Time.getUtcDayKey()
        });
      },

      buildArenaState({ dayKey }) {
        const option = AAD.Core.Storage.getValue('option') || {};
        return {
          dayKey: dayKey,
          gr: option.idleArenaGrTime || 0,
          isOk: false,
          completeHandled: false,
          completeReason: ''
        };
      },

      resetDailyState(info) {
        AAD.Logic.World.resetFlowForNewDay();
        const arena = this.buildArenaState({
          dayKey: info.dayKey
        });
        AAD.Core.Storage.setValue('arena', arena);

        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option.idleArena) {
          return;
        }

        const marker = AAD.Core.Storage.getValue('arenaAutoStart');
        if (marker && marker.dayKey === info.dayKey) {
          return;
        }

        AAD.Core.Storage.setValue('arenaAutoStart', {
          dayKey: info.dayKey
        });
        setTimeout(() => AAD.Runtime.refreshPage(), 2000);
      },

      findArenaButtonInfo(data, id) {
        const buttons = AAD.Utils.DOM.gE('img[src*="startchallenge.png"]:not([style])', 'all', data) || [];
        for (const button of buttons) {
          const onclickAttr = button.getAttribute('onclick') || '';
          const match = onclickAttr.match(/init_battle\((\d+),\d+(?:,'(.*?)')?\)/);
          if (match && Number(match[1]) === id) {
            return { button, token: match[2] || '' };
          }
        }
        return null;
      },

      getNextArenaEntry(arena) {
        while (arena.array && arena.array.length > 0) {
          let id = arena.array[0];
          if (id === 'tw') {
            if (!AAD.Runtime.isIsekai()) {
              arena.array.splice(0, 1);
              continue;
            }
            return { type: 'tw', href: 'tw', id: 1 };
          }
          if (isNaN(id * 1)) {
            if (arena.gr <= 0) {
              arena.array.splice(0, 1);
              continue;
            }
            arena.gr -= 1;
            return { type: 'gr', href: 'gr', id: 1 };
          }
          id = id * 1;
          const href = id >= 105 ? 'rb' : 'ar';
          return { type: href, href, id };
        }
        return null;
      },

      isBlankValue(value) {
        return value === '' || value === null || value === undefined;
      },

      async applyArenaLoadout(entry) {
        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option.personaConfigSwitch || !entry) return;

        const typeKey = entry.type === 'gr' ? 'gf' : entry.type === 'tw' ? 'tw' : 'ar';
        const persona = option[`${typeKey}Persona`];
        const equip = option[`${typeKey}Equip`];
        const configCode = option[`${typeKey}Config`];

        if (this.isBlankValue(persona) || this.isBlankValue(equip) || this.isBlankValue(configCode)) {
          return;
        }

        const backups = AAD.Core.Storage.getValue('backup') || {};
        const backupConfig = backups[configCode];
        if (!backupConfig) return;

        const next = {
          persona: String(persona),
          equip: String(equip),
          config: String(configCode)
        };

        try {
          await AAD.Core.Network.postPromise('?s=Character&ss=ch', `persona_set=${encodeURIComponent(next.persona)}`);
          await AAD.Core.Network.postPromise('?s=Character&&ss=eq', `equip_set=${encodeURIComponent(next.equip)}`);
        } catch (error) {
          console.error('[人格配置] 切换失败:', error);
          return;
        }

        const merged = AAD.Core.Config.mergeConfigWithExclusions(backupConfig);
        AAD.Core.Storage.setValue('option', merged);
      },

      setArenaComplete(arena, reason) {
        arena.isOk = true;
        arena.completeReason = reason;
        arena.completeHandled = false;
        AAD.Core.Storage.setValue('arena', arena);
        this.handleArenaCompleteIfNeeded(arena);
      },

      handleArenaCompleteIfNeeded(arena) {
        if (!arena.isOk || arena.completeHandled) {
          return;
        }
        arena.completeHandled = true;
        AAD.Core.Storage.setValue('arena', arena);
        AAD.Logic.World.handleArenaCompleteCrossWorld(arena.completeReason || '竞技场已完成');
      },

      consumeCurrentArena(arena) {
        if (arena.array && arena.array.length > 0) {
          arena.array.splice(0, 1);
        }
        if (!arena.array || arena.array.length === 0) {
          arena.isOk = true;
          arena.completeReason = '当前世界竞技场全部完成';
          arena.completeHandled = false;
        } else {
          arena.isOk = false;
        }
        AAD.Core.Storage.setValue('arena', arena);
      },

      skipCurrentArena(arena, reason, delay = 1000) {
        if (reason) {
          console.log(reason);
        }
        this.consumeCurrentArena(arena);
        if (arena.isOk) {
          this.handleArenaCompleteIfNeeded(arena);
          return;
        }
        setTimeout(() => this.runArena(), delay);
      },



      // 执行GrindFest战斗
      async executeGrindFestBattle(arena) {
        const goto_battle = () => {
          AAD.Core.Network.postCallback('?s=Battle&ss=gr', (data) => {
            let token, tokenParam;

            if (AAD.Runtime.isIsekai()) {
              // 异世界：从表单input获取postoken
              const postokenInput = AAD.Utils.DOM.gE('input[name="postoken"]', data);
              if (!postokenInput || !postokenInput.value) {
                this.skipCurrentArena(arena, '[竞技场] 异世界GrindFest不可进入（无postoken）');
                return;
              }
              token = postokenInput.value;
              tokenParam = 'postoken';
            } else {
              // 主世界：从按钮onclick获取inittoken
              const grButton = AAD.Utils.DOM.gE('img[src*="startgrindfest.png"]:not([style])', data);
              if (!grButton) {
                this.skipCurrentArena(arena, '[竞技场] 主世界GrindFest不可进入（按钮不可用）');
                return;
              }
              const match = grButton.getAttribute('onclick').match(/init_battle\(1, '(.*?)'\)/);
              if (!match || !match[1]) {
                this.skipCurrentArena(arena, '[竞技场] 主世界GrindFest不可进入（无法获取inittoken）');
                return;
              }
              token = match[1];
              tokenParam = 'inittoken';
            }

            this.consumeCurrentArena(arena);
            setTimeout(() => {
              AAD.Core.Network.postCallback('?s=Battle&ss=gr', AAD.Runtime.refreshPage, `initid=1&${tokenParam}=${token}`);
            }, 500);
          });
        };

        goto_battle();
      },

      // 执行Tower战斗
      async executeTowerBattle(arena) {
        const goto_battle_tw = () => {
          AAD.Core.Network.postCallback('?s=Battle&ss=tw', (data) => {
            // 检查postoken和开始按钮
            const postokenInput = AAD.Utils.DOM.gE('input[name="postoken"]', data);
            const startBtn = AAD.Utils.DOM.gE('img[src*="startchallenge.png"]:not([style])', data);

            if (!postokenInput || !startBtn) {
              this.skipCurrentArena(arena, '[竞技场] Tower不可进入（无按钮或无token）');
              return;
            }

            const token = postokenInput.value;
            if (!token) {
              this.skipCurrentArena(arena, '[竞技场] Tower已完成（postoken为空）');
              return;
            }

            console.log('[竞技场] 开始Tower战斗');
            this.consumeCurrentArena(arena);
            setTimeout(() => {
              AAD.Core.Network.postCallback('?s=Battle&ss=tw', AAD.Runtime.refreshPage, `initid=1&postoken=${token}`);
            }, 500 + Math.random() * 1500);
          });
        };

        goto_battle_tw();
      },

      // 执行Arena/RB战斗
      async executeArenaBattleById(arena, href, id) {
        const goto_battle2 = () => {
          AAD.Core.Network.postCallback(`?s=Battle&ss=${href}`, (data) => {
            let token, tokenParam;

            if (AAD.Runtime.isIsekai()) {
              // 异世界：从表单input获取postoken
              const buttonInfo = this.findArenaButtonInfo(data, id);
              const postokenInput = AAD.Utils.DOM.gE('input[name="postoken"]', data);
              if (!buttonInfo || !postokenInput || !postokenInput.value) {
                this.skipCurrentArena(arena, `[竞技场] 异世界${href}不可进入`);
                return;
              }
              token = postokenInput.value;
              tokenParam = 'postoken';
            } else {
              // 主世界：从按钮onclick获取inittoken
              const buttonInfo = this.findArenaButtonInfo(data, id);
              if (!buttonInfo || !buttonInfo.token) {
                this.skipCurrentArena(arena, `[竞技场] 主世界${href}不可进入（未找到ID ${id}）`);
                return;
              }
              token = buttonInfo.token;
              tokenParam = 'inittoken';
            }

            this.consumeCurrentArena(arena);
            setTimeout(() => {
              AAD.Core.Network.postCallback(`?s=Battle&ss=${href}`, AAD.Runtime.refreshPage, `initid=${id}&${tokenParam}=${token}`);
            }, 500);
          });
        };

        goto_battle2();
      },

      // 自动Shard附魔函数
      async autoshard(shards, number) {
        if (AAD.Runtime.isIsekai()) {
          return 0;
        }
        // Shard 名称到附魔参数的映射
        const SHARD_MAP = {
          "Featherweight Charm": "feath",
          "Suffused Aether": "ether",
          "Voidseeker's Blessing": "vseek",
          "Infused Frost": "scold",
          "Infused Flames": "sfire",
          "Infused Lightning": "selec",
          "Infused Storms": "swind",
          "Infused Divinity": "sholy",
          "Infused Darkness": "sdark"
        };
        const SHARD_ALIAS_MAP = {
          FC: "Featherweight Charm",
          S: "Suffused Aether",
          V: "Voidseeker's Blessing",
          Fr: "Infused Frost",
          Fl: "Infused Flames",
          Li: "Infused Lightning",
          St: "Infused Storms",
          Di: "Infused Divinity",
          Da: "Infused Darkness"
        };

        const normalizedShards = (shards || [])
          .map(shard => SHARD_ALIAS_MAP[shard] || shard)
          .filter(Boolean);
        const ENCHANT_THRESHOLD = 30; // 分钟阈值：低于此时间则重新附魔

        try {
          const forgeUrl = "?s=Forge&ss=en&filter=equipped";
          let data = await AAD.Core.Network.postPromise(forgeUrl);
          const equipDiv = AAD.Utils.DOM.gE('.eqp.tp', data);
          if (!equipDiv) {
            console.warn("[竞技场.自动Shard] 未找到装备区域");
            return 0;
          }
          const equipIdElement = AAD.Utils.DOM.gE('div:nth-child(2)', equipDiv);
          if (!equipIdElement || !equipIdElement.id) {
            console.warn("[竞技场.自动Shard] 未找到装备 ID");
            return 0;
          }

          const equipId = equipIdElement.id.substring(1); 

          data = await AAD.Core.Network.postPromise(forgeUrl, `select_item=${equipId}`);

          const shardElements = AAD.Utils.DOM.gE('span#ee span', 'all', data);
          const currentShards = {}; 

          if (shardElements && shardElements.length > 0) {
            for (let element of shardElements) {
              const shardText = element.textContent.trim(); 
              const match = shardText.match(/^(.+?)\s*\[(\d+)m\]$/);

              if (match) {
                const shardName = match[1];
                const minutesLeft = parseInt(match[2], 10);
                currentShards[shardName] = minutesLeft;
              }
            }
          }

          // 确定需要附魔的 Shard
          const shardsToEnchant = [];
          for (const shard of normalizedShards) {
            const currentTime = currentShards[shard];
            if (currentTime === undefined || currentTime < ENCHANT_THRESHOLD) {
              shardsToEnchant.push(shard);
            }
          }

          if (shardsToEnchant.length === 0) {
            console.log("[竞技场.自动Shard] 所有指定 Shard 都在阈值时间内，无需附魔");
            return 0;
          }
          console.log(`[竞技场.自动Shard] 需要附魔的 Shard: ${shardsToEnchant.join(", ")}`);

          // 执行附魔
          let enchantedCount = 0;
          for (const shard of shardsToEnchant) {
            const shardParam = SHARD_MAP[shard];
            if (!shardParam) {
              console.warn(`[竞技场.自动Shard] 未知的 Shard: ${shard}`);
              continue;
            }

            try {
              // 发送附魔请求
              await AAD.Core.Network.postPromise(forgeUrl, `select_item=${equipId}&enchantment=${shardParam}`);
              enchantedCount++;
              console.log(`[竞技场.自动Shard] 已附魔: ${shard}`);

              // 添加短暂延迟避免请求过快
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error(`[竞技场.自动Shard] 附魔失败 ${shard}:`, error);
            }
          }

          console.log(`[竞技场.自动Shard] 成功附魔 ${enchantedCount} 个 Shard`);
          return enchantedCount;

        } catch (error) {
          console.error("[竞技场.自动Shard] 执行过程中出错:", error);
          return 0;
        }
      }
    },

    // 自动IW模块
    AutoIW: {
      getState() {
        const state = AAD.Core.Storage.getValue('iwState') || {};
        return {
          index: Number.isInteger(state.index) && state.index >= 0 ? state.index : 0
        };
      },

      setState(state) {
        AAD.Core.Storage.setValue('iwState', state);
      },

      resetState() {
        this.setState({ index: 0 });
      },

      normalizeStatus(status) {
        switch (status) {
          case IW_TASK_STATUS.WAITING:
          case IW_TASK_STATUS.RUNNING:
          case IW_TASK_STATUS.DONE:
          case IW_TASK_STATUS.ERROR:
            return status;
          default:
            return IW_TASK_STATUS.WAITING;
        }
      },

      normalizeTasks(tasks) {
        if (!Array.isArray(tasks)) return [];
        const normalized = [];
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i] || {};
          const id = String(task.id || '').trim();
          const target = parseInt(task.target, 10);
          if (!id || !Number.isFinite(target) || target <= 0) continue;
          normalized.push({
            id: id,
            target: target,
            filter: String(task.filter || '').trim(),
            title: String(task.title || '').trim(),
            status: this.normalizeStatus(task.status)
          });
        }
        return normalized;
      },

      persistTasks(tasks) {
        const option = AAD.Core.Storage.getValue('option') || {};
        const nextOption = { ...option, autoIWTasks: this.normalizeTasks(tasks) };
        AAD.Core.Storage.setValue('option', nextOption);
      },

      finishAllTasks(option) {
        const currentOption = option || AAD.Core.Storage.getValue('option') || {};
        const nextOption = { ...currentOption, autoIW: false };
        AAD.Core.Storage.setValue('option', nextOption);
        this.resetState();
      },

      completeTask(state, tasks, status = IW_TASK_STATUS.DONE) {
        if (Array.isArray(tasks) && state.index >= 0 && state.index < tasks.length) {
          tasks[state.index].status = this.normalizeStatus(status);
          this.persistTasks(tasks);
        }
        state.index += 1;
        this.setState(state);
        if (state.index >= tasks.length) {
          this.finishAllTasks();
        }
      },

      skipTaskOnError(state, tasks) {
        this.completeTask(state, tasks, IW_TASK_STATUS.ERROR);
      },

      ensureIwPage(task) {
        const params = new URLSearchParams(window.location.search);
        const isIwPage = params.get('s') === 'Battle' &&
                         params.get('ss') === 'iw' &&
                         params.get('screen') === 'itemworld';
        const currentFilter = params.get('filter') || '';
        const targetFilter = task.filter || '';

        if (isIwPage && (!targetFilter || targetFilter === currentFilter)) {
          return true;
        }

        const nextUrl = targetFilter
          ? `?s=Battle&ss=iw&screen=itemworld&filter=${encodeURIComponent(targetFilter)}`
          : '?s=Battle&ss=iw&screen=itemworld';
        window.location.href = nextUrl;
        return false;
      },

      findEquipCheckbox(taskId) {
        return document.getElementById(`e${taskId}`);
      },

      parseIwLevel(checkbox) {
        const row = checkbox && checkbox.closest ? checkbox.closest('tr') : null;
        const levelCell = row ? row.querySelector('td:nth-child(2)') : null;
        if (!levelCell) {
          throw new Error('iw_level_cell_missing');
        }

        const nums = (levelCell.textContent || '').match(/\d+/g);
        if (!nums || nums.length < 3) {
          throw new Error('iw_level_parse_failed');
        }

        const current = parseInt(nums[1], 10);
        const cap = parseInt(nums[2], 10);
        if (!Number.isFinite(current) || !Number.isFinite(cap) || cap <= 0) {
          throw new Error('iw_level_invalid');
        }

        return { current, cap };
      },

      findConfirmButton() {
        const confirmOuter = document.getElementById('confirm_outer');
        if (!confirmOuter) {
          return null;
        }

        const outerStyle = window.getComputedStyle(confirmOuter);
        const outerVisible = outerStyle.visibility !== 'hidden' &&
                             outerStyle.display !== 'none' &&
                             outerStyle.opacity !== '0';
        if (!outerVisible) {
          return null;
        }

        const directButton = confirmOuter.querySelector('#confirm_button');
        if (directButton &&
            !directButton.disabled) {
          return directButton;
        }
        return null;
      },

      async selectEquipAndEnter(task, checkbox, state) {
        if (!checkbox.checked) {
          const row = checkbox.closest('tr');
          if (row && typeof row.click === 'function') {
            row.click();
          } else {
            checkbox.click();
          }
        }

        const delayMs = 4000 + Math.random() * 5000;
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const enterButton = document.getElementById('equipsubmit');
        if (!enterButton || enterButton.disabled) {
          throw new Error('iw_enter_unavailable');
        }

        enterButton.click();

        const confirmButton = this.findConfirmButton();
        if (!confirmButton) {
          throw new Error('iw_confirm_missing');
        }

        confirmButton.click();
        return true;
      },

      async runAutoIW() {
        if (!AAD.Runtime.isIsekai()) {
          return;
        }

        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option.autoIW) {
          return;
        }

        const tasks = this.normalizeTasks(option.autoIWTasks);
        if (!tasks.length) {
          this.finishAllTasks(option);
          return;
        }

        const state = this.getState();
        if (state.index >= tasks.length) {
          this.finishAllTasks(option);
          return;
        }

        while (state.index < tasks.length) {
          const task = tasks[state.index];

          const isReady = this.ensureIwPage(task);
          if (!isReady) {
            return;
          }

          try {
            const checkbox = this.findEquipCheckbox(task.id);
            if (!checkbox) {
              this.completeTask(state, tasks);
              continue;
            }

            const level = this.parseIwLevel(checkbox);
            const effectiveTarget = Math.min(task.target, level.cap);
            if (level.current >= effectiveTarget) {
              this.completeTask(state, tasks);
              continue;
            }

            await this.selectEquipAndEnter(task, checkbox, state);
            return;
          } catch (error) {
            this.skipTaskOnError(state, tasks);
          }
        }
      }
    },

    // 遭遇战逻辑模块
    Encounter: {
      timerId: null,

      // 遭遇战检查主函数
      runEncounter() {
        console.log('[遭遇战] 检查遭遇战');

        const now = Date.now();
        const option = AAD.Core.Storage.getValue('option') || {};
        const resetState = AAD.Core.DailyReset.ensure(
          'encounter',
          'global',
          () => !!option.encounter,
          (info) => this.resetDailyState(info)
        );
        if (!resetState) {
          return;
        }

        const encounter = this.getEncounterData(resetState?.resetTime);

        if (resetState && !resetState.hasReset && resetState.resetTime) {
          if (encounter.dateKey !== resetState.dayKey && encounter.nextTime !== resetState.resetTime) {
            encounter.nextTime = resetState.resetTime;
            AAD.Core.Storage.setValue('encounter', encounter);
          }
        }

        if (encounter.time >= encounter.dailyLimit && (!resetState || resetState.hasReset)) {
          this.updateEncounterUI(encounter, 'done');
          return;
        }

        if (encounter.nextTime && now >= encounter.nextTime) {
          this.triggerEncounter(encounter, now);
          this.updateEncounterUI(encounter, 'triggered');
        } else {
          this.updateEncounterUI(encounter, 'scheduled');
        }

        const nextDelay = encounter.nextTime ? Math.max(1000, encounter.nextTime - now) : 60 * 60 * 1000;
        this.scheduleNextCheck(nextDelay);
      },

      // 获取遭遇战数据
      getEncounterData(resetTime = null) {
        let encounter = AAD.Core.Storage.getValue('encounter');
        if (!encounter) {
          encounter = this.createDailyEncounter(resetTime);
          AAD.Core.Storage.setValue('encounter', encounter);
        }
        return encounter;
      },

      createDailyEncounter(resetTime) {
        return this.buildEncounterState({
          dayKey: AAD.Utils.Time.getUtcDayKey(),
          resetTime: resetTime
        });
      },

      buildEncounterState({ dayKey, resetTime }) {
        return {
          dateKey: dayKey,
          time: 0,
          dailyLimit: this.getDailyEncounterLimit(),
          lastTime: null,
          nextTime: resetTime
        };
      },

      resetDailyState(info) {
        const encounter = this.buildEncounterState({
          dayKey: info.dayKey,
          resetTime: info.resetTime
        });
        AAD.Core.Storage.setValue('encounter', encounter);
        this.scheduleNextCheck(1000);
      },

      // 获取每日遭遇战限制
      getDailyEncounterLimit() {
        const option = AAD.Core.Storage.getValue('option') || {};
        const minOption = parseInt(option.encounterDailyMin, 10);
        const maxOption = parseInt(option.encounterDailyMax, 10);
        let min = minOption;
        let max = maxOption;
        min = Math.max(1, Math.min(min, 24));
        max = Math.max(1, Math.min(max, 24));

        if (min > max) {
          const temp = min;
          min = max;
          max = temp;
        }
        if (min === max) {
          return min;
        }
        return this.getRandomInt(min, max);
      },

      // 重新制定遭遇战计划（上限 + 下次时间）
      resetEncounterPlan() {
        const encounter = this.getEncounterData();
        const now = Date.now();
        const newLimit = this.getDailyEncounterLimit();
        const time = encounter.time || 0;

        encounter.dailyLimit = Math.max(newLimit, time + 1);
        encounter.nextTime = this.getNextEncounterTime(now);

        AAD.Core.Storage.setValue('encounter', encounter);
        this.updateEncounterUI(encounter, 'scheduled');
        this.scheduleNextCheck(Math.max(1000, encounter.nextTime - now));
      },

      // 记录实际遭遇战开始
      recordEncounterStart(timeNow = Date.now()) {
        const encounter = this.getEncounterData();

        encounter.lastTime = timeNow;
        encounter.time = (encounter.time || 0) + 1;

        if (encounter.time >= encounter.dailyLimit) {
          encounter.nextTime = null;
        } else {
          encounter.nextTime = this.getNextEncounterTime(timeNow);
        }

        AAD.Core.Storage.setValue('encounter', encounter);
      },

      // 触发遭遇战
      triggerEncounter(encounter, timeNow = Date.now()) {
        console.log('[遭遇战] 触发遭遇战');
        if (encounter) {
          encounter.lastTime = timeNow;
          encounter.nextTime = this.getNextEncounterTime(timeNow);
          AAD.Core.Storage.setValue('encounter', encounter);
        }
        AAD.UI.UITools.openUrl('https://e-hentai.org/news.php?encounter');
      },

      // 更新遭遇战UI
      updateEncounterUI(encounter, status) {
        const data = encounter || this.getEncounterData();
        const now = Date.now();
        const lastEncounter = AAD.Utils.DOM.gE('#lastEncounter') ||
                             AAD.Utils.DOM.cE('a');

        if (!lastEncounter.id) {
          lastEncounter.id = 'lastEncounter';
          lastEncounter.className = 'lastEncounter';
          lastEncounter.href = 'https://e-hentai.org/news.php?encounter';
          document.body.appendChild(lastEncounter);
        }

        if (status === 'done') {
          lastEncounter.innerHTML = `今日遭遇战已完成 (${data.time}/${data.dailyLimit})`;
          return;
        }

        const minutesToNext = data.nextTime ? Math.max(0, Math.ceil((data.nextTime - now) / 60000)) : 0;
        const nextText = data.nextTime ? `距离下次遭遇 ${minutesToNext} 分钟` : '下次遭遇战时间待定';

        lastEncounter.innerHTML = `${nextText} (${data.time}/${data.dailyLimit})`;
      },

      // 调度下次检查
      scheduleNextCheck(delay) {
        if (this.timerId) {
          clearTimeout(this.timerId);
        }
        this.timerId = setTimeout(() => {
          this.timerId = null;
          this.runEncounter();
        }, Math.max(delay, 1000));
      },

      getNextEncounterTime(fromTimeMs) {
        const minIntervalMs = GAME_MECHANICS.ENCOUNTER_INTERVAL_MIN_MINUTES * 60 * 1000;
        const maxIntervalMs = GAME_MECHANICS.ENCOUNTER_INTERVAL_MAX_MINUTES * 60 * 1000;
        return this.getRandomMs(fromTimeMs + minIntervalMs, fromTimeMs + maxIntervalMs);
      },

      getRandomInt(min, max) {
        const safeMin = Math.ceil(min);
        const safeMax = Math.floor(max);
        return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
      },

      getRandomMs(minMs, maxMs) {
        if (maxMs <= minMs) return minMs;
        return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      }
    },

    // 页面处理器模块
    PageHandler: {
      // 处理e-hentai页面
      handleEhentaiPage() {
        console.log('[页面处理器] 处理e-hentai页面');

        const storedUrl = AAD.Core.Storage.getValue('url');
        const referrer = document.referrer || '';
        let href;

        if (referrer && /hentaiverse\.org/.test(referrer)) {
          href = new URL(referrer).origin;
        } else if (storedUrl && /hentaiverse\.org/.test(storedUrl)) {
          href = storedUrl;
        } else {
          href = 'https://hentaiverse.org';
        }

        // 检查是否有事件页面链接
        const eventLink = AAD.Utils.DOM.gE('#eventpane>div>a');
        if (eventLink) {
          href = href + '/' + eventLink.href.split('/')[3];
        } else {
          href = AAD.Core.Storage.getValue('lastEncounter') || href;
        }

        // 处理遭遇战页面
        if (window.location.href === 'https://e-hentai.org/news.php?encounter') {
          AAD.UI.UITools.openUrl(href);
        } else if (eventLink) {
          AAD.Core.Storage.setValue('lastEncounter', href);
        }
      },

      // 处理答题页面
      handleRiddlePage() {
        console.log('[页面处理器] 处理答题页面');
        this.misspony();
        AAD.Data.Recorder.recordHorseFromRiddle();
      },

      // 处理战斗页面
      handleBattlePage() {
        console.log('[页面处理器] 处理战斗页面');

        // 获取配置
        const option = AAD.Core.Storage.getValue('option') || {};
        const shouldRecord = !!option.dataRecordSwitch;

        sessionStorage.removeItem('db_riddle_counted');
        if (shouldRecord) {
          AAD.Data.Recorder.init();
          AAD.Core.Storage.init(true);
        }

        // 注入战斗页面脚本
        const script = document.createElement('script');
        script.textContent = `
          if (window.location.protocol === "https:") {
            MAIN_URL = MAIN_URL.replace("http:", "https:");
          }
        `;
        document.body.appendChild(script);

        // 创建战斗UI容器
        const box2 = document.body.appendChild(AAD.Utils.DOM.cE('div'));
        box2.id = 'dbBox2';

        // 添加暂停按钮
        if (option.pauseButton) {
          const button = box2.appendChild(AAD.Utils.DOM.cE('button'));
          button.innerHTML = '暂停';
          button.id = 'pauseChange';
          button.className = 'pauseChange';
          button.onclick = () => AAD.UI.Panel.pauseChange();
        }

        // 添加暂停热键监听
        if (option.pauseHotkey) {
          document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (String(e.key).toLowerCase() === String(option.pauseHotkeyStr).toLowerCase()) {
              AAD.UI.Panel.pauseChange();
            }
          }, false);
        }

        // 初始化战斗事件处理器
        if (typeof AAD.Logic.Battle.initBattleEvents === 'function') {
          AAD.Logic.Battle.initBattleEvents();
        } else {
          console.error('[页面处理器] AAD.Logic.Battle.initBattleEvents 不是函数', typeof AAD.Logic.Battle.initBattleEvents, AAD.Logic.Battle.initBattleEvents);
          throw new Error('Battle.initBattleEvents is not properly initialized');
        }

        AAD.Core.State.set('attackStatus', option.attackStatus);
        AAD.Core.State.set('timeNow', Date.now());
        AAD.Core.State.set('runSpeed', 1);

        // 开始新回合
        AAD.Logic.Battle.newRound();
        AAD.Logic.PageHandler.misspony();
        AAD.Logic.Battle.main();
      },

      // 处理世界页面
      async handleWorldPage() {
    

        // 清除战斗相关临时数据
        AAD.Core.Storage.delValue(2);
        AAD.Core.Storage.clearBattleCache();

        // 启动遭遇战检查
        const option = AAD.Core.Storage.getValue('option') || {};
        AAD.Logic.World.syncCrossWorldEnabledFromOption(option);
        const todayKey = AAD.Utils.Time.getUtcDayKey();
        const arenaAutoStart = AAD.Core.Storage.getValue('arenaAutoStart');
        if (arenaAutoStart) {
          if (arenaAutoStart.dayKey !== todayKey) {
            AAD.Core.Storage.delValue('arenaAutoStart');
          }
        }

        if (AAD.Logic.World.enforceWorldConsistency()) {
          return;
        }

        if (option.encounter) {
          AAD.Logic.Encounter.runEncounter();
        }

        // 处理礼物接收
        if (option.regifts) {
          await AAD.Logic.Utility.receiveGifts();
        }

        // 检查耐力是否足够
        if (!option.restoreStamina) {
          const staminaElement = AAD.Utils.DOM.gE('#stamina_readout .fc4.far>div');
          if (staminaElement) {
            const staminaValue = parseInt(staminaElement.textContent.match(/\d+/)[0], 10);
            if (staminaValue <= option.staminaLow) {
              return; 
            }
          }
        }

        // 处理自动购买物品
        if (option.autobuy && AAD.Logic.Utility.checkStockAndBuy) {
          let itemliststr = option.autobuylist;
          if (itemliststr && itemliststr.length > 0) {
            let itemlist = itemliststr.split(',');
            let itemdict = {
              "HD": 11191, "HP": 11195, "HE": 11199, "MD": 11291, "MP": 11295, "ME": 11299,
              "SD": 11391, "SP": 11395, "SE": 11399, "SM": 60053, "SC": 60051, "SW": 60054,
              "EC": 60071, "SL": 60052
            };
            let itemnameab = {
              "HD": "Health Draught", "HP": "Health Potion", "HE": "Health Elixir",
              "MD": "Mana Draught", "MP": "Mana Potion", "ME": "Mana Elixir",
              "SD": "Spirit Draught", "SP": "Spirit Potion", "SE": "Spirit Elixir",
              "SM": "Scrap Metal", "SC": "Scrap Cloth", "SW": "Scrap Wood",
              "EC": "Energy Cell", "SL": "Scrap Leather"
            };

            let wantbuylist = {};
            for (let item of itemlist) {
              wantbuylist[itemnameab[item]] = itemdict[item];
            }

            
            const isIsekai = AAD.Runtime.isIsekai();
            if (isIsekai) {
              await AAD.Logic.Utility.checkStockAndBuy(wantbuylist, 200);
            } else {
              await AAD.Logic.Utility.checkStockAndBuy(wantbuylist, 1000);
            }
          }
        }

        // 处理装备修理
        if (option.repair) {
          await this.handleEquipmentRepair(option);
        }

        if (option.idleArena) {
          AAD.Logic.Arena.ensureDailyReset();
        }

        // 竞技场优先：竞技场未完成时优先执行竞技场
        const arenaState = AAD.Core.Storage.getValue('arena');
        const arenaCompleted = !!(arenaState &&
                                  arenaState.dayKey === todayKey &&
                                  arenaState.isOk &&
                                  arenaState.completeHandled);

        if (option.idleArena && !arenaCompleted) {
          const delay = AAD.Utils.Time.getIdleArenaDelay();
          console.log(`[闲置竞技场] 将在${(delay / 1000).toFixed(1)}秒后检查竞技场`);
          setTimeout(() => {
            AAD.Logic.Arena.runArena();
          }, delay);
          return;
        }

        // 自动IW：仅在竞技场关闭或竞技场完成后执行
        if (option.autoIW && Array.isArray(option.autoIWTasks) && option.autoIWTasks.length > 0) {
          await AAD.Logic.AutoIW.runAutoIW();
        }
      },

      // 装备修理处理函数
      async handleEquipmentRepair(option) {
        const isIsekai = AAD.Runtime.isIsekai();

        if (isIsekai) {
          if (AAD.Logic.Utility.handleIsekaiRepair) {
            await AAD.Logic.Utility.handleIsekaiRepair(option);
          }
        } else {
          if (AAD.Logic.Utility.handleMainWorldRepair) {
            await AAD.Logic.Utility.handleMainWorldRepair(option);
          }
        }
      },

      // 小马辅助功能
      misspony() {
        const option = AAD.Core.Storage.getValue('option') || {};
        if (option.ponymiss) {
          if (AAD.Utils.DOM.gE('#pane_effects>img[src*="riddlemaster"]')) {
            AAD.Core.Storage.setValue('missanswer', false);
          }
          if (AAD.Utils.DOM.gE('#riddlecounter')) {
            AAD.Core.Storage.setValue('missanswer', true);
          }
        } else {
          AAD.Core.Storage.setValue('missanswer', false);
        }
      }
    },

    World: {
      FLOW_KEY: 'crossWorldFlow',
      ENABLED_KEY: 'crossWorldEnabled',

      STAGE: Object.freeze({
        MAIN_RUNNING: 'main_running',
        ISEKAI_RUNNING: 'isekai_running',
        DONE: 'done'
      }),

      normalizeStage(stage) {
        if (stage === this.STAGE.MAIN_RUNNING ||
            stage === this.STAGE.ISEKAI_RUNNING ||
            stage === this.STAGE.DONE) {
          return stage;
        }
        return this.STAGE.MAIN_RUNNING;
      },

      isCrossWorldEnabled() {
        return !!AAD.Core.Storage.getValue(this.ENABLED_KEY);
      },

      setCrossWorldEnabled(enabled) {
        AAD.Core.Storage.setValue(this.ENABLED_KEY, !!enabled);
      },

      syncCrossWorldEnabledFromOption(option) {
        if (AAD.Runtime.isIsekai()) {
          return;
        }
        this.setCrossWorldEnabled(!!(option && option.crossWorldArena));
      },

      createDefaultFlow(dayKey) {
        return {
          dayKey: dayKey || AAD.Utils.Time.getUtcDayKey(),
          stage: this.STAGE.MAIN_RUNNING,
          jumpLock: false
        };
      },

      getFlowState() {
        const stored = AAD.Core.Storage.getValue(this.FLOW_KEY) || {};
        const dayKey = stored.dayKey || AAD.Utils.Time.getUtcDayKey();
        return {
          dayKey,
          stage: this.normalizeStage(stored.stage),
          jumpLock: !!stored.jumpLock
        };
      },

      setFlowState(state) {
        const current = this.getFlowState();
        const next = {
          dayKey: state && state.dayKey ? state.dayKey : current.dayKey,
          stage: this.normalizeStage(state && state.stage),
          jumpLock: !!(state && state.jumpLock)
        };
        AAD.Core.Storage.setValue(this.FLOW_KEY, next);
      },

      resetFlowForNewDay(dayKey) {
        const targetDayKey = dayKey || AAD.Utils.Time.getUtcDayKey();
        this.setFlowState(this.createDefaultFlow(targetDayKey));
      },

      resetFlowFromUI() {
        AAD.Core.Storage.delValue('crossWorldState');
        AAD.Core.Storage.delValue('crossWorldFlow');
        this.resetFlowForNewDay();
      },

      ensureDailyFlowSync(dayKey) {
        const targetDayKey = dayKey || AAD.Utils.Time.getUtcDayKey();
        const flow = this.getFlowState();
        if (flow.dayKey !== targetDayKey) {
          this.resetFlowForNewDay(targetDayKey);
          return this.getFlowState();
        }
        return flow;
      },

      resolveExpectedWorld(flow) {
        const stage = this.normalizeStage(flow && flow.stage);
        if (stage === this.STAGE.ISEKAI_RUNNING) return 'isekai';
        return 'main';
      },

      buildJumpUrl(targetWorld) {
        const currentUrl = window.location.origin + window.location.pathname;
        if (targetWorld === 'isekai') {
          return AAD.Runtime.isIsekai()
            ? currentUrl
            : currentUrl.replace(/hentaiverse\.org\//, 'hentaiverse.org/isekai/');
        }
        return currentUrl.replace(/\/isekai\//, '/');
      },

      startJump(flow, targetWorld, reason = '') {
        if (!flow || flow.jumpLock) {
          return true;
        }
        const nextFlow = { ...flow, jumpLock: true };
        this.setFlowState(nextFlow);
        const targetUrl = this.buildJumpUrl(targetWorld);
        const reasonText = reason ? `，原因：${reason}` : '';
        console.log(`[跨世界] 执行防卫跳转 -> ${targetWorld}${reasonText}`);
        document.title = `[AAD] 跳转到${targetWorld === 'isekai' ? '异世界' : '主世界'}`;
        AAD.UI.UITools.openUrl(targetUrl);
        return true;
      },

      enforceWorldConsistency() {
        if (!this.isCrossWorldEnabled()) {
          return false;
        }

        const todayKey = AAD.Utils.Time.getUtcDayKey();
        const flow = this.ensureDailyFlowSync(todayKey);
        const isIsekai = AAD.Runtime.isIsekai();
        const expectedWorld = this.resolveExpectedWorld(flow);
        const currentWorld = isIsekai ? 'isekai' : 'main';

        if (flow.stage === this.STAGE.DONE) {
          if (flow.jumpLock) {
            this.setFlowState({ ...flow, jumpLock: false });
          }
          return false;
        }

        if (currentWorld === expectedWorld) {
          if (flow.jumpLock) {
            this.setFlowState({ ...flow, jumpLock: false });
          }
          return false;
        }

        return this.startJump(flow, expectedWorld, '当前世界与流程阶段不一致');
      },

      // 处理竞技场完成后的跨世界逻辑
      handleArenaCompleteCrossWorld(reason) {
        if (!this.isCrossWorldEnabled()) {
          return;
        }

        const flow = this.ensureDailyFlowSync();
        const isMainWorld = !AAD.Runtime.isIsekai();
        const worldLabel = isMainWorld ? '主世界' : '异世界';
        console.log(`[跨世界] ${worldLabel}竞技场完成：${reason}`);

        if (flow.stage === this.STAGE.DONE) {
          console.log('[跨世界] 本日循环已完成，不触发跳转');
          return;
        }

        if (isMainWorld) {
          if (flow.stage !== this.STAGE.MAIN_RUNNING) {
            console.log('[跨世界] 当前阶段不是主世界流程，忽略主世界完成信号');
            return;
          }
          const nextFlow = { ...flow, stage: this.STAGE.ISEKAI_RUNNING, jumpLock: false };
          this.setFlowState(nextFlow);
          document.title = AAD.Utils.Common.alert(-1, '主世界完成');
          this.startJump(nextFlow, 'isekai', '主世界竞技场完成');
          return;
        }

        if (flow.stage !== this.STAGE.ISEKAI_RUNNING) {
          console.log('[跨世界] 当前阶段不是异世界流程，忽略异世界完成信号');
          return;
        }
        const nextFlow = { ...flow, stage: this.STAGE.DONE, jumpLock: false };
        this.setFlowState(nextFlow);
        document.title = AAD.Utils.Common.alert(-1, '异世界完成');
        this.startJump(nextFlow, 'main', '异世界竞技场完成');
      }
    },

    // 游戏辅助功能模块
    Utility: {
      // 礼物领取功能
      async receiveGifts(days = 3) {
        if (AAD.Runtime.isIsekai()) {
          return;
        }
        AAD.Utils.Common.showStatus('正在检查礼物领取状态...');

        const gifturl = "?s=Bazaar&ss=ml";
        const nowtime = Date.now();
        const timedelta = days * 24 * 3600 * 1000;
        const lastGiftTime = AAD.Core.Storage.getValue('lastGiftTime');

        if (lastGiftTime && nowtime - lastGiftTime < timedelta) {
          AAD.Utils.Common.showStatus('礼物领取: 时间未到，无需领取');
          return;
        }

        const statusText = lastGiftTime ? '正在领取礼物...' : '首次运行，正在领取礼物...';
        AAD.Utils.Common.showStatus(statusText);
        await AAD.Core.Network.postPromise(gifturl);
        await AAD.Core.Network.postPromise(gifturl, "feed_all=food");
        AAD.Core.Storage.setValue('lastGiftTime', nowtime);
        AAD.Utils.Common.showStatus('礼物领取完成');
      },

      // 检查库存并购买物品
      async checkStockAndBuy(items, count) {
        AAD.Utils.Common.showStatus('正在检查库存并购买物品...');

        const url = "?s=Bazaar&ss=is"
        const data = await AAD.Core.Network.postPromise(url)
        const inventory = await this.getStock(data)
        AAD.Core.State.set('inventory', inventory)
        const storetoken = AAD.Core.Network.getstoken(data)

        let purchasedCount = 0;
        const isIsekai = AAD.Runtime.isIsekai();
        const minStock = isIsekai ? 50 : 200;
        const buyCount = count;

        for (const item in items) {
          const currentCount = inventory[item] ?? 0;
          if (currentCount < minStock) {
            const success = await this.buyItem(items[item], buyCount, storetoken);
            if (success) {
              purchasedCount++;
            }
          }
        }

        if (purchasedCount > 0) {
          AAD.Utils.Common.showStatus(`已购买 ${purchasedCount} 件物品`);
        } else {
          AAD.Utils.Common.showStatus('库存充足，无需购买');
        }
      },

      // 购买单个物品
      async buyItem(id, count, storetoken) {
        const params = `storetoken=${storetoken}&select_mode=shop_pane&select_item=${id}&select_count=${count}`;
        const data = await AAD.Core.Network.postPromise("?s=Bazaar&ss=is", params);
        const messageBox = data && data.querySelector ? data.querySelector('#messagebox_outer') : null;
        const success = !messageBox;
        return success;
      },
     

      // 获取库存数据
      async getStock(data) {
        let inventory = {};
        const doc = data;
        const rows = doc.querySelectorAll('table.itemlist tr');
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 2) {
            const itemName = cells[0].textContent.trim();
            const quantity = parseInt(cells[1].textContent.trim(), 10) || 0;
            inventory[itemName] = quantity;
          }
        }

        return inventory;
      },

      // 主世界修理装备（阈值修理）
      async handleMainWorldRepair(option) {
        const repairValue = Number(option && option.repairValue);
        const forgeUrl = '?s=Forge&ss=re';
        const data = await AAD.Core.Network.postPromise(forgeUrl);
        const dynjsUrl = AAD.Utils.DOM.gE('#mainpane>script[src]', data).getAttribute('src');
        const dynjsText = await AAD.Core.Network.postPromise(dynjsUrl, null, 'text');
        const repairJson = JSON.parse(dynjsText.match(/\{[\s\S]*\}/)[0]);
        const nodes = AAD.Utils.DOM.gE('.eqp>[id]', 'all', data);

        for (const node of nodes) {
          const equipId = node.id.match(/\d+/)[0];
          const percent = repairJson[equipId].d.match(/Condition:\s*[\d,]+\s*\/\s*[\d,]+\s*\((\d+)%\)/)[1];
          if (percent <= repairValue) {
            await AAD.Core.Network.postPromise(forgeUrl, `select_item=${equipId}`);
          }
        }
      },

       // 异世界修理装备（阈值修理）
      async handleIsekaiRepair(option) {
        const repairValue = Number(option && option.repairValue);
        const url = '?s=Bazaar&ss=am&screen=repair&filter=equipped';
        const data = await AAD.Core.Network.postPromise(url);
        const postoken = AAD.Utils.DOM.gE('[name="postoken"]', data).value;
        const rows = AAD.Utils.DOM.gE('#equiplist tr[onmouseover]', 'all', data);
        const params = new URLSearchParams();
        let hasTargets = false;

        params.append('postoken', postoken);
        for (const row of rows) {
          const equipId = AAD.Utils.DOM.gE('input', row).value;
          const condition = parseInt(AAD.Utils.DOM.gE('td:nth-child(2)', row).textContent, 10);
          if (condition <= repairValue) {
            params.append('eqids[]', equipId);
            hasTargets = true;
          }
        }

        if (hasTargets) {
          await AAD.Core.Network.postPromise(url, params.toString());
        }
      }
    }
  },

  // 数据处理层 
  Data: {
    // ===== 战斗数据记录器=====
    // 数据流转：内存记录 → 页面卸载时保存 → 页面恢复时恢复 → 战斗结束时归档
    Recorder: {
      combat: {},
      drops: {},
      timelog: {},

      // 记录状态
      isRecording: false,
      battleStarted: false,
      battleEnded: false,

      init() {
        // 从页面生命周期管理器恢复临时数据
        const restored = AAD.Core.Storage.PageLifecycle.restoreTempData();
        if (restored) {
          console.log('[数据记录器] 从页面生命周期管理器恢复战斗数据成功');
        } else {
          console.log('[数据记录器] 未找到临时数据，将从新战斗开始记录');
        }

      },


      // 开始战斗记录
      startBattle() {
        if (this.battleStarted) return;

        this.battleStarted = true;
        this.isRecording = true;
        this.battleEnded = false;

        // 初始化时间记录（延迟到第一次动作时设置）
        this.timelog = {
          startTime: null,
          endTime: null
        };

        this._initBattleData();

 
      },
 
      // 小马图计数（答题页触发）
      recordHorseFromRiddle() {
        const option = AAD.Core.Storage.getValue('option') || {};
        if (!option.dataRecordSwitch) return false;

        if (sessionStorage.getItem('db_riddle_counted') === '1') {
          return false;
        }

        const key = AAD.Core.Storage.PageLifecycle.getTempDataKey();
        const tempData = AAD.Core.Storage.getValue(key);
        if (!tempData || !tempData.battleStarted || !tempData.combat || !tempData.combat.stats) {
          return false;
        }

        sessionStorage.setItem('db_riddle_counted', '1');
        tempData.combat.stats.horseCount = (tempData.combat.stats.horseCount || 0) + 1;
        AAD.Core.Storage.setValue(key, tempData);
        return true;
      },

      // 结束战斗记录并保存数据到IndexedDB
      endBattle() {
        if (!this.battleStarted || !this.isRecording) {
          return;
        }

        // 防止重复触发
        if (this.battleEnded) {
          return;
        }

        this.battleEnded = true;
        this.timelog.endTime = Date.now();

        const battleData = {
          combat: this.combat,
          drops: this.drops,
          timelog: this.timelog
        };

        AAD.Core.Database.saveBattle(battleData)
          .then(() => {
            console.log('[数据记录器] 战斗数据保存成功 - IndexedDB');
          })
          .catch(error => {
            console.error('[数据记录器] 保存战斗数据失败:', error);
          });

        this.reset();
      },



      // 掉落监控 - 处理战斗日志中的掉落信息
      dropMonitor(battleLog) {
        if (!this.battleStarted) {
          this.startBattle();
        }

        for (let i = 0; i < battleLog.length; i++) {
          const logEntry = battleLog[i];
          const textContent = logEntry.textContent;

          // 基础 EXP/Credit 掉落
          const gainMatch = textContent.match(/^You gain (\d+) (EXP|Credit)/);
          if (gainMatch) {
            this.drops[gainMatch[2]] = (this.drops[gainMatch[2]] || 0) + parseInt(gainMatch[1], 10);
            continue;
          }

          // 带有 span 标签的物品掉落
          const itemSpan = AAD.Utils.DOM.gE('span', logEntry);
          if (itemSpan) {
            this._processItemDrop(itemSpan, textContent);
            continue;
          }

          // 材料分解掉落 (salvage)
          if (textContent.includes('salvages it into')) {
            this._processSalvageDrop(textContent);
            continue;
          }

          // 其他物品掉落 (You find)
          const findMatch = textContent.match(/You find a (.+?)!/);
          if (findMatch) {
            const itemName = findMatch[1].trim();
            if (itemName) {
              this.drops[itemName] = (this.drops[itemName] || 0) + 1;
            }
          }
        }
      },

      // 处理物品掉落（私有方法）
      _processItemDrop(itemSpan, textContent) {
        const nameMatch = itemSpan.textContent.match(/^\[(.*?)\]$/);
        if (!nameMatch) return;

        const itemName = nameMatch[1];
        const color = itemSpan.style.color;
        const isSalvage = textContent && textContent.includes('salvages it into');
        if (isSalvage) {
          this._processSalvageDrop(textContent);
        }

        // 水晶掉落（紫色）
        if (color === 'rgb(186, 5, 180)') {
          const crystalMatch = itemName.match(/^(\d+)x (Crystal of \w+)$/) ||
                              itemName.match(/^(Crystal of \w+)$/);
          if (crystalMatch) {
            const crystalName = crystalMatch[2] || crystalMatch[1];
            const amount = crystalMatch[1] && crystalMatch[1].match(/^\d+$/) ?
                          parseInt(crystalMatch[1], 10) : 1;
            this.drops[crystalName] = (this.drops[crystalName] || 0) + amount;
          }
        }
        // 金币掉落（黄色）
        else if (color === 'rgb(168, 144, 0)') {
          const creditMatch = itemName.match(/(\d+)/);
          if (creditMatch) {
            const amount = parseInt(creditMatch[1], 10);
            const key = textContent.includes('gives you') ? 'CreditFromTrash' : 'Credit';
            this.drops[key] = (this.drops[key] || 0) + amount;
          }
        }
        // 装备掉落（红色）
        else if (color === 'rgb(255, 0, 0)') {
          const qualityKey = itemName.includes('Legendary')
            ? 'Legendary'
            : itemName.includes('Peerless')
              ? 'Peerless'
              : null;
          if (qualityKey) {
            this._recordEquipDrop(itemName, qualityKey);
          }
        }
        // 其他掉落
        else {
          if (itemName.includes('Blood')) {
            this.drops.Blood = (this.drops.Blood || 0) + 1;
          } else if (itemName.includes('Chaos')) {
            this.drops.Chaos = (this.drops.Chaos || 0) + 1;
          } else {
            this.drops[itemName] = (this.drops[itemName] || 0) + 1;
          }
        }
      },

      // 记录Legendary/Peerless装备掉落（私有方法）
      _recordEquipDrop(itemName, qualityKey) {
        if (!qualityKey) return;

        if (!this.drops.Equips) {
          this.drops.Equips = { Legendary: {}, Peerless: {} };
        }
        if (!this.drops.Equips[qualityKey]) {
          this.drops.Equips[qualityKey] = {};
        }

        this.drops.Equips[qualityKey][itemName] = (this.drops.Equips[qualityKey][itemName] || 0) + 1;
        this.drops[qualityKey] = (this.drops[qualityKey] || 0) + 1;
      },

      // 处理材料分解掉落（私有方法）
      _processSalvageDrop(textContent) {
        const salvageMatch = textContent.match(/salvages it into (.*)/);
        if (!salvageMatch) return;

        const materialMatches = [...salvageMatch[1].matchAll(/(\d+)x \[(.*?)\]/g)];
        for (const match of materialMatches) {
          const materialName = match[2];
          const amount = parseInt(match[1], 10);
          this.drops[materialName] = (this.drops[materialName] || 0) + amount;
        }
      },

      // 获取当前记录器状态
      getCurrentState() {
        return {
          combat: this.combat,
          drops: this.drops,
          timelog: this.timelog,
          isRecording: this.isRecording,
          battleStarted: this.battleStarted,
          battleEnded: this.battleEnded
        };
      },

      // 初始化战斗数据结构（私有方法）
      _initBattleData() {
        this.combat = {
          stats: {
            totalTurns: 0,
            totalRounds: 0,
            sparkCount: 0,
            horseCount: 0
          },
          resist: {
            debuffResist0: 0,
            debuffResist12: 0,
            debuffResist3: 0,
            magicHit: 0,
            magicCrit: 0,
            magicResistPartially: 0,
            magicResist: 0
          },
          items: {},
          magic: {},
          proficiency: {}
        };

        this.drops = {
          EXP: 0,
          Credit: 0,
          CreditFromTrash: 0,
          Legendary: 0,
          Peerless: 0,
          Equips: {
            Legendary: {},
            Peerless: {}
          }
        };
      },

      // 完全重置状态
      reset() {
        this.battleStarted = false;
        this.isRecording = false;
        this.battleEnded = false;

        // 重新创建对象，防止引用污染
        this._initBattleData();
        this.timelog = {};
      },

      // 确保抵抗统计结构完整（私有方法）
      _ensureResist(combat) {
        if (!combat.resist) {
          combat.resist = {
            debuffResist0: 0,
            debuffResist12: 0,
            debuffResist3: 0,
            magicHit: 0,
            magicCrit: 0,
            magicResistPartially: 0,
            magicResist: 0
          };
          return combat.resist;
        }

        const resist = combat.resist;
        if (resist.debuffResist0 == null) resist.debuffResist0 = 0;
        if (resist.debuffResist12 == null) resist.debuffResist12 = 0;
        if (resist.debuffResist3 == null) resist.debuffResist3 = 0;
        if (resist.magicHit == null) resist.magicHit = 0;
        if (resist.magicCrit == null) resist.magicCrit = 0;
        if (resist.magicResistPartially == null) resist.magicResistPartially = 0;
        if (resist.magicResist == null) resist.magicResist = 0;
        return resist;
      },

      // 统计Debuff抵抗次数（按施法块）
      _processDebuffResistLog(logEntries, endIndex, combat) {
        if (!logEntries || endIndex <= 0) return;

        const resist = this._ensureResist(combat);

        let pendingGain = 0;
        let pendingPartial = 0;
        let pendingShrug = 0;

        for (let i = 0; i < endIndex; i++) {
          const text = logEntries[i].textContent || '';

          if (text.includes(' gains the effect ')) {
            pendingGain += 1;
            continue;
          }

          if (text.includes(' partially resists the effects of your spell.')) {
            pendingPartial += 1;
            continue;
          }

          if (text.includes(' shrugs off the effects of your spell.')) {
            pendingShrug += 1;
            continue;
          }

          if (text.trimStart().startsWith('You cast ')) {
            if (pendingGain || pendingPartial || pendingShrug) {
              const resist0 = pendingGain - pendingPartial;
              resist.debuffResist0 += resist0;
              if (pendingPartial > 0) resist.debuffResist12 += pendingPartial;
              if (pendingShrug > 0) resist.debuffResist3 += pendingShrug;
            }
            pendingGain = 0;
            pendingPartial = 0;
            pendingShrug = 0;
            continue;
          }

          if (pendingGain || pendingPartial || pendingShrug) {
            pendingGain = 0;
            pendingPartial = 0;
            pendingShrug = 0;
          }
        }
      },

      // 统计攻击法术的命中/抵抗（单行）
      _processMagicAttackResistLine(text, resist) {
        if (!text) return;

        if (text.includes('resists your spell.')) {
          resist.magicResist += 1;
          return;
        }

        if (text.includes('resists, and was')) {
          resist.magicResistPartially += 1;
        }

        const hitMatch = text.match(/\b(glanced|hit|crit|eviscerated)\b for \d+ \w+ damage/);
        if (!hitMatch) return;

        if (hitMatch[1] === 'crit') {
          resist.magicCrit += 1;
          return;
        }

        resist.magicHit += 1;
      },

      // 处理动作相关的日志
      processActionLog(text, combat, actionParm) {
        let reg, magic, point;

        // 火花检测
        if (text.match(/You gain the effect Cloak of the Fallen/)) {
          combat.stats.sparkCount = (combat.stats.sparkCount || 0) + 1;
        } else if (text.match(/You gain .* proficiency/)) {
          reg = text.match(/You gain ([\d.]+) points of (.*?) proficiency/);
          magic = reg[2];
          point = reg[1] * 1;
          combat.proficiency[magic] = (magic in combat.proficiency) ? combat.proficiency[magic] + point : point;
          combat.proficiency[magic] = combat.proficiency[magic].toFixed(3) * 1;
        }
      },

      // 处理战斗日志 
      processBattleLog(actionParm = null) {
        if (!AAD.Core.Storage.getValue('option')?.dataRecordSwitch) return;

        try {
          // 确保数据记录器正在记录
          if (!this.battleStarted) {
            this.startBattle();
          }

          // 在第一个实际动作时记录开始时间
          if (this.timelog.startTime === null) {
            this.timelog.startTime = Date.now();
          }

          // 统一数据源：BattleRecorder.combat
          const combat = this.combat;

          // ===== 1. 动作记录部分（如果传入了动作参数） =====
          if (actionParm) {
            // 更新战斗统计
            const monsterAlive = AAD.Core.State.get('monsterAlive', 0);
            const isAttackMagic = actionParm.mode === 'magic' && SPELL_LISTS.ATTACK.includes(actionParm.magic);
            const resist = isAttackMagic ? this._ensureResist(combat) : null;

            if (monsterAlive === 0) {
              combat.stats.totalRounds += 1;
            }

            // 记录动作使用数据
            if (actionParm.mode === 'magic') {
              const magic = actionParm.magic;
              combat.magic[magic] = (magic in combat.magic) ? combat.magic[magic] + 1 : 1;
            } else if (actionParm.mode === 'items') {
              combat.items[actionParm.item] = (actionParm.item in combat.items) ? combat.items[actionParm.item] + 1 : 1;
            } else {
              combat.stats[actionParm.mode + 'Count'] = (combat.stats[actionParm.mode + 'Count'] || 0) + 1;
            }

            // 处理动作相关的日志
            if (actionParm.log && actionParm.log.length > 0) {
              let endIndex = actionParm.log.length;
              for (let i = 0; i < actionParm.log.length; i++) {
                if (actionParm.log[i].className === 'tls') {
                  endIndex = i;
                  break;
                }
                const text = actionParm.log[i].textContent;
                this.processActionLog(text, combat, actionParm);
                if (isAttackMagic) {
                  this._processMagicAttackResistLine(text, resist);
                }
              }
              this._processDebuffResistLog(actionParm.log, endIndex, combat);
            }
          }

        } catch (error) {
          console.error('[Data.Recorder] 处理战斗日志失败:', error);
        }
      },

      // 处理战斗结束 - 整合所有战斗结束逻辑
      handleBattleEnd() {
        if (!this.battleStarted || this.battleEnded) {
          return;
        }

        const combat = this.combat;


        // 记录结束时间
        this.timelog.endTime = Date.now();

        // 记录战败日志（仅战败时保存完整文本）
        try {
          const isDefeat = AAD.Core.State.get('endbattle', false);
          if (isDefeat) {
            const textlog = document.getElementById('textlog');
            const logRows = textlog && textlog.rows ? Array.from(textlog.rows) : [];
            const logText = logRows.length > 0 ? logRows.map(row => row.innerText).join('\n') : '';
            combat.stats.defeatLog = {
              log: logText,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.error('[数据记录器] 记录战败日志失败:', error);
        }

        // 触发战斗结束处理
        this.endBattle();
      }
    },

    // 统计计算模块
    Statistics: {
      extractCombatData(source, target, targetKey, excludeFields) {
        if (!source) return;

        // 确保目标键存在
        if (!target[targetKey]) {
          target[targetKey] = {};
        }

        for (const type in source) {
          if (typeof source[type] === 'number' && source[type] > 0 && !excludeFields.includes(type)) {
            target[targetKey][type] = (target[targetKey][type] || 0) + source[type];
          }
        }
      },

      extractAllCombatData(combatData, totalUsageData) {
        // 提取熟练度统计
        this.extractCombatData(combatData.proficiency, totalUsageData, 'proficiency', []);

        // 提取抵抗统计
        this.extractCombatData(combatData.resist, totalUsageData, 'resist', []);

        // 提取技能和物品使用数据
        if (combatData.items) {
          if (!totalUsageData.items) totalUsageData.items = {};
          for (const item in combatData.items) {
            if (combatData.items[item] > 0) {
              totalUsageData.items[item] = (totalUsageData.items[item] || 0) + combatData.items[item];
            }
          }
        }

        if (combatData.magic) {
          if (!totalUsageData.magic) totalUsageData.magic = {};
          for (const spell in combatData.magic) {
            if (combatData.magic[spell] > 0) {
              totalUsageData.magic[spell] = (totalUsageData.magic[spell] || 0) + combatData.magic[spell];
            }
          }
        }
      },

      // 数据转换函数
      convertToUnifiedBattleRecord(flatData) {
        // 格式化显示时间
        let formattedTime = '';
        const endTime = flatData.endTime;
        if (endTime && !isNaN(endTime)) {
          try {
            const date = new Date(endTime);
            if (!isNaN(date.getTime())) {
              formattedTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' ' +
                             String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
            }
          } catch (e) {
            formattedTime = String(endTime).substring(0, 16);
          }
        }

        // 计算TPS
        const tps = flatData.duration > 0 ? Math.round((flatData.turns / flatData.duration) * 100) / 100 : 0;

          return {
            // 基础信息
            id: flatData.id,
            timestamp: formattedTime,
            rawTime: endTime,
            utcDate: flatData.date,
            battle_type: flatData.battleType || 'BA',

          // 直接使用扁平化字段（零开销）
          rounds: flatData.rounds,
          turns: flatData.turns,
          duration: AAD.Utils.Format.formatDuration(flatData.duration),
          tps: tps,
          seconds: flatData.duration,

          // 财务数据（已预计算）
          exp: flatData.exp,
          credit: flatData.credit,
          revenue: flatData.revenue,
          cost: flatData.cost,
          profit: flatData.profit,
          profit_without_ed: flatData.profitWithoutED,
          potion_net_income: flatData.potionNetIncome,
          scroll_net_income: flatData.scrollNetIncome,

          // 掉落统计（已预计算）
          artifacts: flatData.artifacts,
          blood: flatData.blood,
          chaos: flatData.chaos,
          legendary: flatData.legendary,
          peerless: flatData.peerless,

          // 消耗品统计（已预计算）
          potions: flatData.potions,
          scrolls: flatData.scrolls,
          gems: flatData.gems,

          // 技能统计（已预计算）
          attack_spells: flatData.attackSpells,
          support_spells: flatData.supportSpells,
          heal_spells: flatData.healSpells,
          debuff_spells: flatData.debuffSpells,

          // 事件统计（已预计算）
          horse: flatData.horse,
          spark: flatData.spark,

          // 详细数据（按需解压）
          _dropData: flatData.detailsCompressed.drops,
          _usageData: {
            items: flatData.detailsCompressed.items,
            magic: flatData.detailsCompressed.magic,
            proficiency: flatData.detailsCompressed.proficiency || {},
            resist: flatData.detailsCompressed.resist
          },
          _defeatLog: flatData.detailsCompressed.defeatLog
        };
      },

      // 数据统计和处理函数
      batchCountItemsAndSpells(combat) {
        const result = {
          potions: 0,
          scrolls: 0,
          gems: 0,
          attack_spells: 0,
          support_spells: 0,
          heal_spells: 0,
          debuff_spells: 0
        };

        if (!combat || !combat.items) return result;

        result.potions = ItemStatsUtil.countItems(combat, ITEM_LISTS.POTIONS);
        result.scrolls = ItemStatsUtil.countItems(combat, ITEM_LISTS.SCROLLS);
        result.gems = ItemStatsUtil.countItems(combat, ITEM_LISTS.GEMS);

        // 技能统计（如果有魔法数据）
        if (combat.magic) {
          for (const spellName in combat.magic) {
            const count = combat.magic[spellName] || 0;
            if (SPELL_LISTS.ATTACK.includes(spellName)) {
              result.attack_spells += count;
            } else if (SPELL_LISTS.SUPPORT.includes(spellName)) {
              result.support_spells += count;
            } else if (SPELL_LISTS.HEAL.includes(spellName)) {
              result.heal_spells += count;
            } else if (SPELL_LISTS.DEBUFF.includes(spellName)) {
              result.debuff_spells += count;
            }
          }
        }

        return result;
      },

      // 统计马事件数量
      countHorseEvents(combat) {
        if (!combat || !combat.stats) return 0;
        return combat.stats.horseCount || 0;
      },

      // 统计火花事件数量
      countSparkEvents(combat) {
        if (!combat || !combat.stats) return 0;
        return combat.stats.sparkCount || 0;
      },

      buildStatsQueryOptions(optionsOrLimit = 100, battleType = null, isIsekai = null, defaultLimit = 100) {
        const options = (typeof optionsOrLimit === 'object' && optionsOrLimit !== null)
          ? optionsOrLimit
          : { limit: optionsOrLimit, battleType: battleType, isekai: isIsekai };

        const limitValue = Number(options.limit);
        const limit = Number.isFinite(limitValue) ? Math.max(0, limitValue) : defaultLimit;
        const normalizedBattleType = (typeof options.battleType === 'string' && options.battleType !== '')
          ? options.battleType
          : null;
        const order = options.order === 'asc' ? 'asc' : 'desc';
        const normalizeIsekai = (value) => {
          if (typeof value === 'boolean') return value ? 1 : 0;
          if (value === 0 || value === 1) return value;
          return null;
        };
        const normalizedIsekai = normalizeIsekai(options.isekai);
        const includeAllWorlds = !!options.includeAllWorlds || normalizedIsekai === null;

        const parseDateStart = (dateStr) => {
          if (!dateStr) return null;
          const date = new Date(`${dateStr}T00:00:00`);
          const time = date.getTime();
          return Number.isNaN(time) ? null : time;
        };

        const parseDateEnd = (dateStr) => {
          if (!dateStr) return null;
          const date = new Date(`${dateStr}T23:59:59.999`);
          const time = date.getTime();
          return Number.isNaN(time) ? null : time;
        };

        const normalizeDateKey = (dateStr) => {
          if (!dateStr || typeof dateStr !== 'string') return null;
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          const time = new Date(dateStr).getTime();
          if (Number.isNaN(time)) return null;
          return new Date(time).toISOString().split('T')[0];
        };

        let startTime = parseDateStart(options.dateFrom);
        let endTime = parseDateEnd(options.dateTo);
        let startDate = normalizeDateKey(options.dateFrom);
        let endDate = normalizeDateKey(options.dateTo);

        if (startTime !== null && endTime !== null && startTime > endTime) {
          const tempTime = startTime;
          startTime = endTime;
          endTime = tempTime;
          const tempDate = startDate;
          startDate = endDate;
          endDate = tempDate;
        } else if (startDate && endDate && startDate > endDate) {
          const tempDate = startDate;
          startDate = endDate;
          endDate = tempDate;
        }

        return {
          limit,
          battleType: normalizedBattleType,
          order,
          isekai: normalizedIsekai,
          includeAllWorlds,
          startTime,
          endTime,
          startDate,
          endDate
        };
      },

      async getBattleDataByRecord(optionsOrLimit = 100, battleType = null, isIsekai = null) {
        const queryOptions = this.buildStatsQueryOptions(optionsOrLimit, battleType, isIsekai, 100);
        if (queryOptions.limit <= 0) {
          return [];
        }

        const criteriaBase = {
          order: queryOptions.order,
          limit: queryOptions.limit
        };
        if (queryOptions.battleType) criteriaBase.battleType = queryOptions.battleType;
        if (queryOptions.startTime !== null) criteriaBase.startTime = queryOptions.startTime;
        if (queryOptions.endTime !== null) criteriaBase.endTime = queryOptions.endTime;

        let rawRecords = [];
        if (queryOptions.includeAllWorlds) {
          const [mainData, isekaiData] = await Promise.all([
            AAD.Core.Database.queryBattlesLimited(Object.assign({ isekai: 0 }, criteriaBase)),
            AAD.Core.Database.queryBattlesLimited(Object.assign({ isekai: 1 }, criteriaBase))
          ]);

          const direction = queryOptions.order === 'asc' ? 1 : -1;
          rawRecords = mainData.concat(isekaiData)
            .sort((a, b) => direction * ((a.endTime || 0) - (b.endTime || 0)))
            .slice(0, queryOptions.limit);
        } else {
          rawRecords = await AAD.Core.Database.queryBattlesLimited(
            Object.assign({ isekai: queryOptions.isekai }, criteriaBase)
          );
        }

        const unifiedRecords = [];
        rawRecords.forEach(record => {
          try {
            const unifiedRecord = this.convertToUnifiedBattleRecord(record);
            if (unifiedRecord && (unifiedRecord.exp >= 0 || unifiedRecord.credit >= 0 || unifiedRecord.rounds > 0)) {
              unifiedRecords.push(unifiedRecord);
            }
          } catch (error) {
            console.error('[BattleStats] 记录转换失败 ID:', record?.id, error);
          }
        });

        return unifiedRecords;
      },

      async getBattleDataByDay(optionsOrLimit = 50, battleType = null, isIsekai = null) {
        const queryOptions = this.buildStatsQueryOptions(optionsOrLimit, battleType, isIsekai, 50);
        if (queryOptions.limit <= 0) {
          return [];
        }

        const criteriaBase = {
          order: queryOptions.order,
          limitDays: queryOptions.limit
        };
        if (queryOptions.battleType) criteriaBase.battleType = queryOptions.battleType;
        if (queryOptions.startDate) criteriaBase.startDate = queryOptions.startDate;
        if (queryOptions.endDate) criteriaBase.endDate = queryOptions.endDate;
        if (queryOptions.startTime !== null) criteriaBase.startTime = queryOptions.startTime;
        if (queryOptions.endTime !== null) criteriaBase.endTime = queryOptions.endTime;

        if (queryOptions.includeAllWorlds) {
          const [mainRows, isekaiRows] = await Promise.all([
            AAD.Core.Database.queryDailyAggregates(Object.assign({ isekai: 0 }, criteriaBase)),
            AAD.Core.Database.queryDailyAggregates(Object.assign({ isekai: 1 }, criteriaBase))
          ]);
          return this._mergeDailyWorldRows(mainRows.concat(isekaiRows), queryOptions.order, queryOptions.limit);
        }

        return AAD.Core.Database.queryDailyAggregates(
          Object.assign({ isekai: queryOptions.isekai }, criteriaBase)
        );
      },

      _createDailyRow(dateKey) {
        return {
          timestamp: dateKey,
          rawTime: AAD.Utils.Time.getUtcDayStartMs(dateKey),
          utcDate: dateKey,
          battle_type: '汇总',
          rounds: 0, turns: 0, duration: '', tps: 0,
          exp: 0, credit: 0, revenue: 0, cost: 0, profit: 0,
          profit_without_ed: 0,
          artifacts: 0, blood: 0, chaos: 0, legendary: 0, peerless: 0,
          potions: 0, scrolls: 0, gems: 0,
          potion_net_income: 0, scroll_net_income: 0,
          attack_spells: 0, support_spells: 0, heal_spells: 0, debuff_spells: 0,
          horse: 0, spark: 0, battleCount: 0, seconds: 0,
          _dropData: {},
          _usageData: { items: {}, magic: {}, proficiency: {}, resist: {} }
        };
      },

      _accumulateDailyRow(target, source) {
        STATISTICS_NUMERIC_FIELDS.forEach(field => {
          target[field] += source[field] || 0;
        });
        target.battleCount += source.battleCount || 0;
        target.seconds += source.seconds || 0;
        if (source._dropData) {
          AAD.Utils.Aggregation.mergeDataObjects(target._dropData, source._dropData, ['Credit', 'CreditFromTrash', 'EXP']);
        }
        if (source._usageData) {
          AAD.Utils.Aggregation.mergeDataObjects(target._usageData, source._usageData);
        }
      },

      _finalizeDailyRow(row) {
        ['revenue', 'cost', 'profit', 'profit_without_ed'].forEach(field => {
          row[field] = AAD.Utils.Format.fixPrecision(row[field], 2);
        });
        row.duration = row.seconds > 0 ? AAD.Utils.Format.formatDuration(row.seconds) : '0s';
        row.tps = row.seconds > 0 && row.turns > 0 ? Math.round((row.turns / row.seconds) * 100) / 100 : 0;
      },

      _mergeDailyWorldRows(rows, order, limit) {
        const dailyMap = new Map();

        rows.forEach(row => {
          const dateKey = row.timestamp || row.utcDate;
          if (!dateKey) return;
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, this._createDailyRow(dateKey));
          }
          this._accumulateDailyRow(dailyMap.get(dateKey), row);
        });

        const mergedRows = Array.from(dailyMap.values());
        mergedRows.forEach(row => this._finalizeDailyRow(row));
        mergedRows.sort((a, b) => {
          if (order === 'asc') {
            return a.timestamp.localeCompare(b.timestamp);
          }
          return b.timestamp.localeCompare(a.timestamp);
        });

        return mergedRows.slice(0, limit);
      },

      // 清空所有数据
      async clearAllData(isIsekai = null) {
        try {
          const db = await AAD.Core.Database.init();
          const transaction = db.transaction([AAD.Core.Database.storeName], 'readwrite');
          const store = transaction.objectStore(AAD.Core.Database.storeName);

          if (isIsekai !== null) {
            // 只清空指定世界的战斗数据
            const worldValue = isIsekai ? 1 : 0;
            const index = store.index('isekai_time');
            const range = IDBKeyRange.bound([worldValue, 0], [worldValue, Date.now()]);

            return new Promise((resolve, reject) => {
              const request = index.openCursor(range);
              let deletedCount = 0;

              request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                  cursor.delete();
                  deletedCount++;
                  cursor.continue();
                } else {
                  console.log(`[Data.Statistics] 已清理${isIsekai ? '异世界' : '主世界'}的${deletedCount}条记录`);
                  resolve(deletedCount);
                }
              };

              request.onerror = () => reject(request.error);
            });
          } else {
            // 清空所有数据
            return new Promise((resolve, reject) => {
              const request = store.clear();
              request.onsuccess = () => {
                console.log('[Data.Statistics] 已清空全部战斗数据');
                resolve();
              };
              request.onerror = () => reject(request.error);
            });
          }
        } catch (error) {
          console.error('[Data.Statistics] 清空数据失败:', error);
          throw error;
        }
      }
    },

    // 财务数据处理模块
    Finance: {
      // 计算收入（掉落物品价值 + 掉落的金币）
      calculateRevenue(dropData) {
        try {
          let revenue = 0;
          const itemPrices = AAD.Core.Storage.getValue('prices') || {};

          // 添加掉落的金币
          const creditRevenue = (dropData.Credit || 0) + (dropData.CreditFromTrash || 0);
          revenue += creditRevenue;

          // 计算掉落物品的价值
          const excludeKeys = ['Credit', 'CreditFromTrash', 'EXP', 'proficiency', 'Equips', 'Legendary', 'Peerless'];
          const itemRevenue = this.calculateItemValue(dropData, itemPrices, excludeKeys);
          revenue += itemRevenue;

          return AAD.Utils.Format.fixPrecision(revenue, 2);
        } catch (error) {
          console.error('[Data.Finance] 收入计算失败:', error);
          return 0;
        }
      },

      // 计算消耗（使用物品的价值）
      calculateCost(combat) {
        const itemPrices = AAD.Core.Storage.getValue('prices') || {};
        const usedItems = combat.items || {};
        const priceForCost = Object.assign({}, itemPrices, { 'Energy Drink': 0 });
        const cost = this.calculateItemValue(usedItems, priceForCost);
        return AAD.Utils.Format.fixPrecision(cost, 2);
      },

      // 计算药水净收入
      calculatePotionNetIncome(dropData, usageData) {
        return this.calculateItemNetIncome(dropData, usageData, (itemName) => {
          return itemName.includes('Potion') || itemName.includes('Elixir') || itemName.includes('Draught');
        });
      },

      // 计算卷轴净收入
      calculateScrollNetIncome(dropData, usageData) {
        return this.calculateItemNetIncome(dropData, usageData, (itemName) => {
          return itemName.includes('Scroll');
        });
      },

      // 计算物品价值（通用辅助函数）
      calculateItemValue(itemData, itemPrices, excludeKeys = []) {
        return this._calculateValueRecursive(itemData, itemPrices, excludeKeys);
      },

      // 计算物品净收入（通用辅助函数）
      calculateItemNetIncome(dropData, usageData, itemFilter) {
        const dropCount = this._countItemsRecursive(dropData, itemFilter);
        const usedItems = usageData.items || {};
        let usageCount = 0;

        for (const itemName in usedItems) {
          if (itemFilter(itemName)) {
            usageCount += usedItems[itemName] || 0;
          }
        }

        return dropCount - usageCount;
      },

      // 递归计算物品价值（私有方法）
      _calculateValueRecursive(itemData, itemPrices, excludeKeys = []) {
        let value = 0;

        for (const itemName in itemData) {
          if (excludeKeys.includes(itemName)) continue;

          const itemValue = itemData[itemName];
          if (typeof itemValue === 'number' && itemPrices[itemName]) {
            value += itemValue * itemPrices[itemName];
          } else if (typeof itemValue === 'object' && itemValue !== null) {
            value += this._calculateValueRecursive(itemValue, itemPrices, excludeKeys);
          }
        }

        return value;
      },

      // 递归统计物品数量（私有方法）
      _countItemsRecursive(data, itemFilter) {
        let count = 0;

        for (const itemName in data) {
          const itemValue = data[itemName];
          if (typeof itemValue === 'number' && itemFilter(itemName)) {
            count += itemValue;
          } else if (typeof itemValue === 'object' && itemValue !== null) {
            count += this._countItemsRecursive(itemValue, itemFilter);
          }
        }

        return count;
      },


      // 格式化字段值
      formatFieldValue(field, value) {
        if (field === 'exp' || field === 'credit' || field === 'revenue' || field === 'cost' ||
            field === 'profit' || field === 'profit_without_ed') {
          return AAD.Utils.Format.formatLargeNumber(AAD.Utils.Format.fixPrecision(value, 2));
        }
        // 所有其他数字都显示
        return value.toLocaleString();
      },


      // 汇总数据计算助手
      Helpers: {
        calculateSummaryRows(data) {
          if (data.length === 0) return { averageRow: {}, totalRow: {} };

          // 初始化汇总数据
          const summaryData = {
            averageRow: { timestamp: 'Average', battle_type: 'Average' },
            totalRow: { timestamp: 'Total', battle_type: 'Total' },
            totalDropData: {},
            totalUsageData: { items: {}, magic: {}, proficiency: {}, resist: {} },
            totalDurationSeconds: 0,
            totalTurns: 0,
            validBattles: 0
          };

          // 计算汇总数据
          data.forEach((row) => {
            // 累加数值字段
            STATISTICS_NUMERIC_FIELDS.forEach((field) => {
              const value = row[field] || 0;
              summaryData.totalRow[field] = (summaryData.totalRow[field] || 0) + value;
            });

            // 累加持续时间（使用统一的seconds字段）
            const durationSeconds = row.seconds || row.duration_seconds || 0;
            if (durationSeconds > 0) {
              summaryData.totalDurationSeconds += durationSeconds;
              summaryData.validBattles++;
            }

            // 累加回合数
            if (row.turns) {
              summaryData.totalTurns += row.turns;
            }

            // 合并掉落数据
            if (row.drops || row._dropData) {
              const dropData = row.drops || row._dropData;
              AAD.Utils.Aggregation.mergeDataObjects(summaryData.totalDropData, dropData);

            }

            // 合并使用数据（UI层统一结构）
            if (row._usageData) {
              AAD.Data.Statistics.extractAllCombatData(row._usageData, summaryData.totalUsageData);
            }

          });

          // 计算平均值
          const validRecords = summaryData.validBattles || data.length; // 回退到data.length如果没有有效记录
          if (validRecords > 0) {
            STATISTICS_NUMERIC_FIELDS.forEach((field) => {
              if (summaryData.totalRow[field] !== undefined) {
                const average = Math.round((summaryData.totalRow[field] / validRecords) * 100) / 100;
                summaryData.averageRow[field] = AAD.Data.Finance.formatFieldValue(field, average);
                summaryData.averageRow[field + '_raw'] = average; // 保存原始值用于后续计算
              }
            });

            // 计算平均持续时间和TPS
            const avgDuration = Math.round((summaryData.totalDurationSeconds / validRecords) * 100) / 100;
            const avgTps = summaryData.totalDurationSeconds > 0 ?
              Math.round((summaryData.totalTurns / summaryData.totalDurationSeconds) * 100) / 100 : 0;

            summaryData.averageRow.duration_seconds = AAD.Utils.Format.formatDuration(avgDuration);
            summaryData.averageRow.duration = AAD.Utils.Format.formatDuration(avgDuration);
            summaryData.averageRow.tps = avgTps;

            // 计算Total行的时长和TPS
            const totalTps = summaryData.totalDurationSeconds > 0 ?
              Math.round((summaryData.totalTurns / summaryData.totalDurationSeconds) * 100) / 100 : 0;

            summaryData.totalRow.duration_seconds = AAD.Utils.Format.formatDuration(summaryData.totalDurationSeconds);
            summaryData.totalRow.duration = AAD.Utils.Format.formatDuration(summaryData.totalDurationSeconds);
            summaryData.totalRow.tps = totalTps;
          }

          // 格式化Total行数值字段
          STATISTICS_NUMERIC_FIELDS.forEach((field) => {
            summaryData.totalRow[field] = AAD.Data.Finance.formatFieldValue(field, summaryData.totalRow[field] || 0);
          });

          // 设置聚合数据引用（用于tooltip）
          summaryData.averageRow._sourceDropData = summaryData.totalDropData;
          summaryData.averageRow._sourceCombatData = summaryData.totalUsageData;
          summaryData.averageRow._dataLength = data.length;
          summaryData.averageRow._lazyAveraging = true;

          // Total行也使用与Average行相同的数据源，确保数据一致性
          summaryData.totalRow._sourceDropData = summaryData.totalDropData;
          summaryData.totalRow._sourceCombatData = summaryData.totalUsageData;
          summaryData.totalRow._dataLength = data.length;
          summaryData.totalRow._lazyTotal = true; // Total行标记，用于tooltip逻辑

          return summaryData;
        }
      }
    },

    // 市场数据处理模块
    Market: {
      // 提取市场数据
      extractMarketData(doc) {
        // 获取表格中的所有行
        const table = doc.querySelector('#market_itemlist table');
        if (!table) {
          console.warn('[Data.Market] 未找到市场表格');
          return {};
        }

        const rows = table.querySelectorAll('tr');
        const result = {};

        // 跳过表头行，从第二行开始处理
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cells = row.querySelectorAll('td');

          if (cells.length >= 5) {
            // 提取每列的数据
            const name = cells[0].textContent.trim();
            const stock = parseInt(cells[1].textContent.trim().replace(/,/g, ''), 10);
            const bid = parseFloat(cells[2].textContent.trim().split(' ')[0]);
            const ask = parseFloat(cells[3].textContent.trim().split(' ')[0]);
            const mstock = parseInt(cells[4].textContent.trim().replace(/,/g, ''), 10);

            // 添加到结果对象
            result[name] = {
              stock: stock,
              bid: bid,
              ask: ask,
              mstock: mstock
            };
          }
        }
        return result;
      },

      // 获取市场价格数据
      async getPrices(ptype) { 
        let prices = AAD.Core.Storage.getValue("prices") || {};
        const pages = Array("co", "ma", "tr", "ar", "fi", "mo");

        for (const page of pages) {
          try {
            // URL会自动适配当前世界（异世界时post会自动添加/isekai/前缀）
            let doc = await AAD.Core.Network.postPromise("?s=Bazaar&ss=mk&screen=browseitems&filter=" + page);
            let priceOb = this.extractMarketData(doc);

            for (const key in priceOb) {
              // 处理可能的null/undefined值
              if (ptype === "bid") {
                prices[key] = priceOb[key].bid !== undefined && priceOb[key].bid !== null ? priceOb[key].bid : null;
              } else {
                prices[key] = priceOb[key].ask !== undefined && priceOb[key].ask !== null ? priceOb[key].ask : null;
              }
            }
          } catch (error) {
            console.error(`[价格更新] 获取页面 ${page} 数据失败:`, error);
          }
        }

        AAD.Core.Storage.setValue("prices", prices);
        console.log(`[价格更新]价格更新完成，共${Object.keys(prices).length}个物品`);
      },

      // 更新价格数据主函数
      async updatePriceData(type) {
        try {
          // 更新价格数据
          await this.getPrices(type);
        } catch (error) {
          console.error('[价格更新] 处理失败', error);
          throw error;
        }
      }
    },

    // 经济计算模块
    Economy: {

      // 计算不包含ED的利润（无ED环情况下ED恢复10体力）
      calculateProfitWithoutED(baseProfit, battleType, rounds) {
        const edPrice = this.getItemPrice('Energy Drink');

        if (edPrice === 0) {
          return baseProfit; // 如果没有ED价格数据，返回基础利润
        }

        // 计算体力消耗
        const staminaCost = this.calculateStaminaCost(battleType, rounds);
        const edCost = (staminaCost / 10) * edPrice;
        return AAD.Utils.Format.fixPrecision(baseProfit - edCost, 2);
      },

      // 计算体力消耗成本
      calculateStaminaCost(battleType, rounds) {
        let staminaCost = rounds * 0.02;     // 战斗一层消耗0.02体力值      
        if (battleType === 'gr') {
          staminaCost += 1;
        }
        return staminaCost;
      },

      // 获取物品价格
      getItemPrices() {
        return AAD.Core.Storage.getValue('prices') || {};
      },

      // 获取单个物品价格
      getItemPrice(itemName) {
        const prices = this.getItemPrices();
        return prices[itemName] || 0;
      }
    }
  },

  // 用户界面层 - 负责所有用户交互界面
  UI: {
    // 列设置状态管理模块
    ColumnSettings: {
      // 获取启用的列定义
      getEnabledColumns() {
        const config = AAD.Core.Config.getAll() || {};
        const savedColumns = config.dataColumns || {};
        const enabledColumns = {};

        Object.keys(dbTableColumnsAll).forEach(groupName => {
          const enabledInGroup = [];
          dbTableColumnsAll[groupName].forEach(column => {
            const isEnabled = savedColumns[column.id] === true;

            if (isEnabled) {
              enabledInGroup.push(column);
            }
          });

          if (enabledInGroup.length > 0) {
            enabledColumns[groupName] = enabledInGroup;
          }
        });

        return enabledColumns;
      }
    },

    // 配置面板模块
    Panel: {
      // 面板状态管理
      isVisible: false,
      currentTab: 'CombatCore',
      orderKeys: ['itemOrder', 'channelSkillOrder', 'buffSkillOrder', 'debuffSkillOrder', 'skillOrder', 'idleArenaOrder'],
      orderState: null,

      // 初始化配置面板
      init() {
        this.createButton();
      },

      // 创建浮动配置按钮
      createButton() {
        if (document.getElementById('dbButton')) {
          return;
        }

        const button = AAD.Utils.DOM.cE('div');
        button.id = 'dbButton';
        button.className = 'dbButton';
        button.title = 'hvAutoAttack 设置';
        button.onclick = () => this.toggle();
        button.innerHTML = '⚙';
        document.body.appendChild(button);
      },

      // 切换面板显示状态
      toggle() {
        const panel = AAD.Utils.DOM.gE('#dbBox');
        if (panel) {
          this.isVisible = !this.isVisible;
          panel.style.display = this.isVisible ? 'block' : 'none';
          if (!this.isVisible) {
            AAD.Core.State.set('customizePinned', false);
            AAD.Core.State.set('customizeTarget', null);
            const customizeBox = AAD.Utils.DOM.gE('#customizeBox');
            if (customizeBox) {
              const inspectButton = customizeBox.querySelector('.dbInspect');
              if (inspectButton) inspectButton.title = 'off';
              customizeBox.style.display = 'none';
              customizeBox.style.zIndex = '-1';
            }
          }
        } else {
          this.createPanel();
          this.isVisible = true;
        }
      },

      // 创建配置面板
      createPanel() {
        const panel = AAD.Utils.DOM.cE('div');
        panel.id = 'dbBox';
        panel.className = 'dbPanel';

        // 构建面板HTML结构
        panel.innerHTML = this.buildPanelHTML();

        document.body.appendChild(panel);

        // 绑定面板事件
        this.bindPanelEvents(panel);

        // 加载配置到面板
        this.loadConfigToPanel(panel);

        // 初始化预设选择器
        AAD.UI.Preset.initPresetSelector(panel);

        // 显示面板
        panel.style.display = 'block';
        this.isVisible = true;
      },

      initOrderState(config) {
        const state = {};
        for (let i = 0; i < this.orderKeys.length; i++) {
          const key = this.orderKeys[i];
          const value = Array.isArray(config[key]) ? config[key].slice() : [];
          state[key] = key === 'idleArenaOrder' ? value.map(item => String(item)) : value;
        }
        this.orderState = state;
      },

      forEachPanelField(panel, handler, includeTextarea = false) {
        const selector = includeTextarea ? 'input, select, textarea' : 'input, select';
        const fields = panel.querySelectorAll(selector);
        for (let i = 0; i < fields.length; i++) {
          handler(fields[i]);
        }
      },

      getFieldName(input) {
        return input.name || input.id || '';
      },

      isOrderCheckbox(input, orderKeys) {
        if (input.type !== 'checkbox' || !input.id) return false;
        for (let i = 0; i < orderKeys.length; i++) {
          if (input.id.startsWith(orderKeys[i] + '_')) return true;
        }
        return false;
      },

        getConfigValue(config, itemName) {
          if (itemName.includes('.')) {
            const parts = itemName.split('.');
            return config[parts[0]] ? config[parts[0]][parts[1]] : undefined;
          }

          const itemArray = itemName.split('_');
          if (itemArray.length === 2 && typeof config[itemArray[0]] === 'object' && config[itemArray[0]][itemArray[1]] !== undefined) {
            return config[itemArray[0]][itemArray[1]];
          }

          return config[itemName];
        },

      setConfigValue(config, itemName, itemValue, isArrayValue) {
        if (itemName.includes('.')) {
          const parts = itemName.split('.');
          if (!config[parts[0]]) config[parts[0]] = {};
          config[parts[0]][parts[1]] = itemValue;
          return;
        }

        const itemArray = itemName.split('_');
        if (itemArray.length === 1) {
          config[itemName] = itemValue;
          return;
        }

        if (!config[itemArray[0]]) config[itemArray[0]] = {};
        if (isArrayValue) {
          if (!Array.isArray(config[itemArray[0]][itemArray[1]])) {
            config[itemArray[0]][itemArray[1]] = [];
          }
          config[itemArray[0]][itemArray[1]].push(itemValue);
        } else {
          config[itemArray[0]][itemArray[1]] = itemValue;
        }
      },

      // 构建面板HTML
      buildPanelHTML() {
        const tabDefs = [
          { name: 'CombatCore', label: '战斗核心', build: () => this.buildCombatCoreTab() },
          { name: 'Automation', label: '自动化', build: () => this.buildAutomationTab() },
          { name: 'Item', label: '物品', build: () => this.buildItemTab() },
          { name: 'Channel', menuHtml: '<input id="channelSkillSwitch" type="checkbox"><label for="channelSkillSwitch">Channel</label>', build: () => this.buildChannelTab() },
          { name: 'Buff', menuHtml: '<input id="buffSkillSwitch" type="checkbox"><label for="buffSkillSwitch">BUFF</label>', build: () => this.buildBuffTab() },
          { name: 'Debuff', menuHtml: '<input id="debuffSkillSwitch" type="checkbox"><label for="debuffSkillSwitch">DEBUFF</label>', build: () => this.buildDebuffTab() },
          { name: 'Skill', menuHtml: '<input id="skillSwitch" type="checkbox"><label for="skillSwitch">其他技能</label>', build: () => this.buildSkillTab() },
          { name: 'Scroll', menuHtml: '<input id="scrollSwitch" type="checkbox"><label for="scrollSwitch">卷轴</label>', build: () => this.buildScrollTab() },
          { name: 'PersonaConfig', menuHtml: '<input id="personaConfigSwitch" type="checkbox"><label for="personaConfigSwitch">人格配置</label>', build: () => this.buildPersonaConfigTab() },
          { name: 'DataRecord', menuHtml: '<input id="dataRecordSwitch" type="checkbox"><label for="dataRecordSwitch">数据记录</label>', build: () => this.buildDataRecordTab() },
          { name: 'ConfigSettings', label: '配置设置', build: () => this.buildConfigSettingsTab() },
          { name: 'System', label: '系统设置', build: () => this.buildSystemTab() }
        ];

        const menuHtml = tabDefs.map((tab, index) => {
          const activeClass = index === 0 ? ' class="active"' : '';
          const content = tab.menuHtml || tab.label;
          return `<span name="${tab.name}"${activeClass}>${content}</span>`;
        }).join('');

        const contentHtml = tabDefs.map((tab, index) => {
          const activeClass = index === 0 ? ' active' : '';
          return `
            <div class="dbTab${activeClass}" id="dbTab-${tab.name}">
              ${tab.build()}
            </div>
          `;
        }).join('');

        return `
          <div class="dbCenter">
            <h1 style="display:inline;">AADB</h1>
            <div class="dbTopButtons">
              <button class="dbReset" title="重置所有设置为默认值">重置设置</button>
              <button class="dbApply" title="应用当前设置">应用</button>
              <button class="dbCancel" title="取消修改">取消</button>
            </div>
          </div>
          <div class="dbTablist">
            <div class="dbTabmenu">
              ${menuHtml}
            </div>
            ${contentHtml}
          </div>
        `;
      },

      // 构建战斗核心标签页
      buildCombatCoreTab() {
        return `
          <div id="attackStatus" style="color:red;"><b>攻击模式</b>
            <select class="dbNumber" name="attackStatus">
              <option value="-1"></option>
              <option value="0">物理</option>
              <option value="1">火</option>
              <option value="2">冰</option>
              <option value="3">雷</option>
              <option value="4">风</option>
              <option value="5">圣</option>
              <option value="6">暗</option>
            </select>
          </div>
          <div><b>魔法技能</b> <br>
            <span class="dbTipText">中阶技能使用条件</span> <div class="customize" name="middleSkillCondition"></div>
            <span class="dbTipText">高阶技能使用条件</span> <div class="customize" name="highSkillCondition"></div>
          </div>
          <div><input id="turnOnSS" type="checkbox"><label for="turnOnSS"><b>开启Spirit Stance</b></label> <div class="customize" name="turnOnSSCondition"></div></div>
          <div><input id="turnOffSS" type="checkbox"><label for="turnOffSS"><b>关闭Spirit Stance</b></label> <div class="customize" name="turnOffSSCondition"></div></div>
          <div><input id="defend" type="checkbox"><label for="defend"><b>Defend</b></label> <div class="customize" name="defendCondition"></div></div>
          <div><input id="focus" type="checkbox"><label for="focus"><b>Focus</b></label> <div class="customize" name="focusCondition"></div></div>
          <div><input id="etherTap" type="checkbox"><label for="etherTap"><b>Ether Tap</b></label> <div class="customize" name="etherTapCondition"></div></div>
          <div><b>攻击规则</b><br>
            <span class="dbTipText">每回合按当前血量计算基础权重：最低血量的敌人为 10，其它敌人按 当前血量 / 最低血量 × 10 计算。基础权重会与下方各状态权重相加。</span><br>
            <span class="dbTipText">Weaken <input class="dbNumber" name="weight_We" placeholder="0" type="text"> Imperil <input class="dbNumber" name="weight_Im" placeholder="0" type="text"> Sleep <input class="dbNumber" name="weight_Sle" placeholder="0" type="text"> Silence <input class="dbNumber" name="weight_Si" placeholder="0" type="text"> MagNet <input class="dbNumber" name="weight_MN" placeholder="0" type="text"></span><br>
            <span class="dbTipText">Stunned <input class="dbNumber" name="weight_Stun" placeholder="0" type="text"> Confuse <input class="dbNumber" name="weight_Co" placeholder="0" type="text"> Drain <input class="dbNumber" name="weight_Dr" placeholder="0" type="text"> Slow <input class="dbNumber" name="weight_Slo" placeholder="0" type="text"> Blind <input class="dbNumber" name="weight_Bl" placeholder="0" type="text"></span><br>
            <span class="dbTipText">Coalesced Mana <input class="dbNumber" name="weight_CM" placeholder="0" type="text"> Penetrated Armor <input class="dbNumber" name="weight_PA" placeholder="0" type="text"> Bleeding Wound <input class="dbNumber" name="weight_BW" placeholder="0" type="text"></span></div>
          <div><input id="ruleReverse" type="checkbox"><label for="ruleReverse">勾选攻击权重最最大，不勾选攻击权重最小</label></div>
          <div><input id="ruleOrder" type="checkbox"><label for="ruleOrder">塔内顺序攻击</label></div>
          <div><input id="ruleOrderGlobal" type="checkbox"><label for="ruleOrderGlobal">全局顺序攻击</label></div>
        `;
      },

      // 构建自动化标签页
      buildAutomationTab() {
        return `
          <div><input id="idleArena" type="checkbox"><label for="idleArena"><b>自动AR</b></label>
            <span class="dbTipText">场间延迟</span><input class="dbNumber" name="idleArenaTime" placeholder="60" type="text"> <button class="idleArenaReset">重置战斗</button>
            <button class="dbShowLevels">切换显示</button><button class="dbLevelsClear">清空</button><span class="dbTipText" id="idleArenaResetTime" style="margin-left:40px;"></span>
            <br>
            <input id="idleArenaOrderDisplay" style="width:98%;" type="text" disabled>
            <div id="dbArenaLevels" class="dbArenaLevels">
              <input id="arLevel_1" value="1" type="checkbox"><label for="arLevel_1">1</label> <input id="arLevel_10" value="3" type="checkbox"><label for="arLevel_10">10</label> <input id="arLevel_20" value="5" type="checkbox"><label for="arLevel_20">20</label> <input id="arLevel_30" value="8" type="checkbox"><label for="arLevel_30">30</label> <input id="arLevel_40" value="9" type="checkbox"><label for="arLevel_40">40</label> <input id="arLevel_50" value="11" type="checkbox"><label for="arLevel_50">50</label> <input id="arLevel_60" value="12" type="checkbox"><label for="arLevel_60">60</label> <input id="arLevel_70" value="13" type="checkbox"><label for="arLevel_70">70</label> <input id="arLevel_80" value="15" type="checkbox"><label for="arLevel_80">80</label> <input id="arLevel_90" value="16" type="checkbox"><label for="arLevel_90">90</label> <input id="arLevel_100" value="17" type="checkbox"><label for="arLevel_100">100</label> <input id="arLevel_110" value="19" type="checkbox"><label for="arLevel_110">110</label> <input id="arLevel_120" value="20" type="checkbox"><label for="arLevel_120">120</label><br>
              <input id="arLevel_130" value="21" type="checkbox"><label for="arLevel_130">130</label> <input id="arLevel_140" value="23" type="checkbox"><label for="arLevel_140">140</label> <input id="arLevel_150" value="24" type="checkbox"><label for="arLevel_150">150</label> <input id="arLevel_165" value="26" type="checkbox"><label for="arLevel_165">165</label> <input id="arLevel_180" value="27" type="checkbox"><label for="arLevel_180">180</label> <input id="arLevel_200" value="28" type="checkbox"><label for="arLevel_200">200</label> <input id="arLevel_225" value="29" type="checkbox"><label for="arLevel_225">225</label> <input id="arLevel_250" value="32" type="checkbox"><label for="arLevel_250">250</label> <input id="arLevel_300" value="33" type="checkbox"><label for="arLevel_300">300</label><input id="arLevel_400" value="34" type="checkbox"><label for="arLevel_400">400</label><input id="arLevel_500" value="35" type="checkbox"><label for="arLevel_500">500</label><br>
              <input id="arLevel_RB50" value="105" type="checkbox"><label for="arLevel_RB50">RB50</label> <input id="arLevel_RB75A" value="106" type="checkbox"><label for="arLevel_RB75A">RB75A</label> <input id="arLevel_RB75B" value="107" type="checkbox"><label for="arLevel_RB75B">RB75B</label> <input id="arLevel_RB75C" value="108" type="checkbox"><label for="arLevel_RB75C">RB75C</label> <input id="arLevel_RB200" value="111" type="checkbox"><label for="arLevel_RB200">RB200</label> <input id="arLevel_RB250" value="112" type="checkbox"><label for="arLevel_RB250">RB250</label><br>
              <input id="arLevel_TW" value="tw" type="checkbox"><label for="arLevel_TW">TW(isk)</label> <input id="arLevel_GF" value="gr" type="checkbox"><label for="arLevel_GF">GF <input class="dbNumber" name="idleArenaGrTime" placeholder="0" type="text"></label>
            </div>
          </div>
          <div style="border-top:1px solid #ccc;padding-top:8px;margin-top:8px;">
              <input id="autoIW" type="checkbox"><label for="autoIW"><b>自动IW</b></label>
              <span class="dbTipText">目标等级</span><input class="dbNumber" name="autoIWTargetLevel" placeholder="" type="text">
            <button class="autoIWAddTask">增加任务</button><button class="autoIWClearTasks">清空任务</button>
            <input type="hidden" name="autoIWTasksJson">
            <div id="autoIWTaskList" class="dbTipText" style="margin-top:6px;"></div>
          </div>
          <div><input id="crossWorldArena" type="checkbox"><label for="crossWorldArena" style="color:#4CAF50;"><b>跨界连打</b></label>
            <button class="crossWorldJumpReset">重置跳转</button>
            <span id="crossWorldArenaIsekaiHint" style="display:none;color:#FF9800;margin-left:1em;">📍 当前在异世界，此选项在主世界控制</span>
          </div>
          <div><input id="encounter" type="checkbox"><label for="encounter"><b>自动遭遇</b></label> <button class="encounterResetPlan">重置计划</button> <input class="dbNumber" name="encounterDailyMin" placeholder="12" type="text">~<input class="dbNumber" name="encounterDailyMax" placeholder="24" type="text"></div>
          <div><input id="autoquit" type="checkbox"><label for="autoquit"><b>自动出场</b></label></div>
          <div><input id="autoFlee" type="checkbox"><label for="autoFlee"><b>自动逃跑</b></label> <div class="customize" name="fleeCondition"></div></div>
          <div><input id="autoPause" type="checkbox"><label for="autoPause"><b>自动暂停</b></label> <div class="customize" name="pauseCondition"></div></div>
          <div><input id="autoshard" type="checkbox"><label for="autoshard"><b>自动附魔</b></label><input class="dbInputWide" name="autoshardlist" type="text"></div>
          <div><input id="ponymiss" type="checkbox"><label for="ponymiss"><b>错马暂停</b></label></div>
          <div><input id="repair" type="checkbox"><label for="repair"><b>修复装备</b></label>:
            耐久度 ≤ <input class="dbNumber" name="repairValue" placeholder="60" type="text">%</div>
          <div><input id="autobuy" type="checkbox"><label for="autobuy"><b>自动补充</b></label><input class="dbInputWide" name="autobuylist" type="text"></div>
          <div><input id="regifts" type="checkbox"><label for="regifts"><b>自动收礼</b></label></div>
          <div><input id="restoreStamina" type="checkbox"><label for="restoreStamina"><b>战前回复</b>: </label>
            <span class="dbTipText">战斗前，体力<<input class="dbNumber" name="staminaLow" placeholder="15" type="text"></label></span><br>
            <span class="dbTipText">不勾选时，小于设定值则不进行自动AR</span></div>
        `;
      },

      // 构建物品标签页
      buildItemTab() {
        return `
          <div class="itemOrder"><span class="dbTipText">施放顺序</span> <input class="dbInputWide" name="itemOrder" type="text" disabled><br>
            <input id="itemOrder_Cure" type="checkbox"><label for="itemOrder_Cure">Cure</label><input id="itemOrder_FC" type="checkbox"><label for="itemOrder_FC">Full-Cure</label><input id="itemOrder_HP" type="checkbox"><label for="itemOrder_HP">Health Potion</label><input id="itemOrder_HE" type="checkbox"><label for="itemOrder_HE">Health Elixir</label><input id="itemOrder_MP" type="checkbox"><label for="itemOrder_MP">Mana Potion</label><input id="itemOrder_ME" type="checkbox"><label for="itemOrder_ME">Mana Elixir</label><br>
            <input id="itemOrder_SP" type="checkbox"><label for="itemOrder_SP">Spirit Potion</label><input id="itemOrder_SE" type="checkbox"><label for="itemOrder_SE">Spirit Elixir</label><input id="itemOrder_LE" type="checkbox"><label for="itemOrder_LE">Last Elixir</label><input id="itemOrder_ED" type="checkbox"><label for="itemOrder_ED">Energy Drink</label></div>
          <div><input id="item_Cure" type="checkbox"><label for="item_Cure"><b>Cure</b></label> <div class="customize" name="itemCureCondition"></div></div>
          <div><input id="item_FC" type="checkbox"><label for="item_FC"><b>Full-Cure</b></label> <div class="customize" name="itemFCCondition"></div></div>
          <div><input id="item_HP" type="checkbox"><label for="item_HP"><b>Health Potion</b></label> <div class="customize" name="itemHPCondition"></div></div>
          <div><input id="item_HE" type="checkbox"><label for="item_HE"><b>Health Elixir</b></label> <div class="customize" name="itemHECondition"></div></div>
          <div><input id="item_MP" type="checkbox"><label for="item_MP"><b>Mana Potion</b></label> <div class="customize" name="itemMPCondition"></div></div>
          <div><input id="item_ME" type="checkbox"><label for="item_ME"><b>Mana Elixir</b></label> <div class="customize" name="itemMECondition"></div></div>
          <div><input id="item_SP" type="checkbox"><label for="item_SP"><b>Spirit Potion</b></label> <div class="customize" name="itemSPCondition"></div></div>
          <div><input id="item_SE" type="checkbox"><label for="item_SE"><b>Spirit Elixir</b></label> <div class="customize" name="itemSECondition"></div></div>
          <div><input id="item_LE" type="checkbox"><label for="item_LE"><b>Last Elixir</b></label> <div class="customize" name="itemLECondition"></div></div>
          <div><input id="item_ED" type="checkbox"><label for="item_ED"><b>Energy Drink</b></label> <div class="customize" name="itemEDCondition"></div></div>
          <div><input id="item_Infusion" type="checkbox"><label for="item_Infusion"><b>魔药</b></label> <div class="customize" name="itemInfusionCondition"></div><br><span class="dbTipText">魔药属性与<span>战斗核心</span>里的攻击模式相同</span></div>
          <div><input id="item_HealthGem" type="checkbox"><label for="item_HealthGem"><b>Health Gem</b></label> <div class="customize" name="itemHealthGemCondition"></div></div>
          <div><input id="item_ManaGem" type="checkbox"><label for="item_ManaGem"><b>Mana Gem</b></label> <div class="customize" name="itemManaGemCondition"></div></div>
          <div><input id="item_SpiritGem" type="checkbox"><label for="item_SpiritGem"><b>Spirit Gem</b></label> <div class="customize" name="itemSpiritGemCondition"></div></div>
          <div><input id="item_MysticGem" type="checkbox"><label for="item_MysticGem"><b>Mystic Gem</b></label> <div class="customize" name="itemMysticGemCondition"></div></div>
        `;
      },

      // 构建Channel标签页
      buildChannelTab() {
        return `
          <div class="channelSkillOrder"><span class="dbTipText">施放顺序</span>
            <input class="dbInputWide" name="channelSkillOrder" type="text" disabled><br>
            <input id="channelSkillOrder_Pr" type="checkbox"><label for="channelSkillOrder_Pr">Protection</label><input id="channelSkillOrder_SL" type="checkbox"><label for="channelSkillOrder_SL">Spark of Life</label><input id="channelSkillOrder_SS" type="checkbox"><label for="channelSkillOrder_SS">Spirit Shield</label><input id="channelSkillOrder_Ha" type="checkbox"><label for="channelSkillOrder_Ha">Haste</label><input id="channelSkillOrder_AF" type="checkbox"><label for="channelSkillOrder_AF">Arcane Focus</label><input id="channelSkillOrder_He" type="checkbox"><label for="channelSkillOrder_He">Heartseeker</label><br>
            <input id="channelSkillOrder_Re" type="checkbox"><label for="channelSkillOrder_Re">Regen</label><input id="channelSkillOrder_SV" type="checkbox"><label for="channelSkillOrder_SV">Shadow Veil</label><input id="channelSkillOrder_Ab" type="checkbox"><label for="channelSkillOrder_Ab">Absorb</label></div>
          <div><input id="channelSkill_Pr" type="checkbox"><label for="channelSkill_Pr"><b>Protection</b></label> <div class="customize" name="channelSkillPrCondition"></div></div>
          <div><input id="channelSkill_SL" type="checkbox"><label for="channelSkill_SL"><b>Spark of Life</b></label> <div class="customize" name="channelSkillSLCondition"></div></div>
          <div><input id="channelSkill_SS" type="checkbox"><label for="channelSkill_SS"><b>Spirit Shield</b></label> <div class="customize" name="channelSkillSSCondition"></div></div>
          <div><input id="channelSkill_Ha" type="checkbox"><label for="channelSkill_Ha"><b>Haste</b></label> <div class="customize" name="channelSkillHaCondition"></div></div>
          <div><input id="channelSkill_AF" type="checkbox"><label for="channelSkill_AF"><b>Arcane Focus</b></label> <div class="customize" name="channelSkillAFCondition"></div></div>
          <div><input id="channelSkill_He" type="checkbox"><label for="channelSkill_He"><b>Heartseeker</b></label> <div class="customize" name="channelSkillHeCondition"></div></div>
          <div><input id="channelSkill_Re" type="checkbox"><label for="channelSkill_Re"><b>Regen</b></label> <div class="customize" name="channelSkillReCondition"></div></div>
          <div><input id="channelSkill_SV" type="checkbox"><label for="channelSkill_SV"><b>Shadow Veil</b></label> <div class="customize" name="channelSkillSVCondition"></div></div>
          <div><input id="channelSkill_Ab" type="checkbox"><label for="channelSkill_Ab"><b>Absorb</b></label> <div class="customize" name="channelSkillAbCondition"></div></div>
        `;
      },

      // 构建Buff标签页
      buildBuffTab() {
        return `<div class="buffSkillOrder"><span class="dbTipText">施放顺序</span>
            <input class="dbInputWide" name="buffSkillOrder" type="text" disabled><br>
            <input id="buffSkillOrder_Pr" type="checkbox"><label for="buffSkillOrder_Pr">Protection</label><input id="buffSkillOrder_SL" type="checkbox"><label for="buffSkillOrder_SL">Spark of Life</label><input id="buffSkillOrder_SS" type="checkbox"><label for="buffSkillOrder_SS">Spirit Shield</label><input id="buffSkillOrder_Ha" type="checkbox"><label for="buffSkillOrder_Ha">Haste</label><input id="buffSkillOrder_AF" type="checkbox"><label for="buffSkillOrder_AF">Arcane Focus</label><input id="buffSkillOrder_He" type="checkbox"><label for="buffSkillOrder_He">Heartseeker</label><br>
            <input id="buffSkillOrder_Re" type="checkbox"><label for="buffSkillOrder_Re">Regen</label><input id="buffSkillOrder_SV" type="checkbox"><label for="buffSkillOrder_SV">Shadow Veil</label><input id="buffSkillOrder_Ab" type="checkbox"><label for="buffSkillOrder_Ab">Absorb</label></div>
          <div class="buffSkillCondition"><div class="customize" name="buffSkillCondition"></div></div>
          <div><input id="buffSkill_HD" type="checkbox"><label for="buffSkill_HD"><b>Health Draught</b></label> <div class="customize" name="buffSkillHDCondition"></div></div>
          <div><input id="buffSkill_MD" type="checkbox"><label for="buffSkill_MD"><b>Mana Draught</b></label> <div class="customize" name="buffSkillMDCondition"></div></div>
          <div><input id="buffSkill_SD" type="checkbox"><label for="buffSkill_SD"><b>Spirit Draught</b></label> <div class="customize" name="buffSkillSDCondition"></div></div>
          <div><input id="buffSkill_FV" type="checkbox"><label for="buffSkill_FV"><b>Flower Vase</b></label> <div class="customize" name="buffSkillFVCondition"></div></div>
          <div><input id="buffSkill_BG" type="checkbox"><label for="buffSkill_BG"><b>Bubble-Gum</b></label> <div class="customize" name="buffSkillBGCondition"></div></div>
          <div><input id="buffSkill_Pr" type="checkbox"><label for="buffSkill_Pr"><b>Protection</b></label> <div class="customize" name="buffSkillPrCondition"></div></div>
          <div><input id="buffSkill_SL" type="checkbox"><label for="buffSkill_SL"><b>Spark of Life</b></label> <div class="customize" name="buffSkillSLCondition"></div></div>
          <div><input id="buffSkill_SS" type="checkbox"><label for="buffSkill_SS"><b>Spirit Shield</b></label> <div class="customize" name="buffSkillSSCondition"></div></div>
          <div><input id="buffSkill_Ha" type="checkbox"><label for="buffSkill_Ha"><b>Haste</b></label> <div class="customize" name="buffSkillHaCondition"></div></div>
          <div><input id="buffSkill_AF" type="checkbox"><label for="buffSkill_AF"><b>Arcane Focus</b></label> <div class="customize" name="buffSkillAFCondition"></div></div>
          <div><input id="buffSkill_He" type="checkbox"><label for="buffSkill_He"><b>Heartseeker</b></label> <div class="customize" name="buffSkillHeCondition"></div></div>
          <div><input id="buffSkill_Re" type="checkbox"><label for="buffSkill_Re"><b>Regen</b></label> <div class="customize" name="buffSkillReCondition"></div></div>
          <div><input id="buffSkill_SV" type="checkbox"><label for="buffSkill_SV"><b>Shadow Veil</b></label> <div class="customize" name="buffSkillSVCondition"></div></div>
          <div><input id="buffSkill_Ab" type="checkbox"><label for="buffSkill_Ab"><b>Absorb</b></label> <div class="customize" name="buffSkillAbCondition"></div></div>
        `;
      },

      // 构建Debuff标签页
      buildDebuffTab() {
        return `
          <div class="debuffSkillOrder"><span class="dbTipText">施放顺序</span>
            <input class="dbInputWide" name="debuffSkillOrder" type="text" disabled><br>
            <input id="debuffSkillOrder_Sle" type="checkbox"><label for="debuffSkillOrder_Sle">Sleep</label><input id="debuffSkillOrder_Im" type="checkbox"><label for="debuffSkillOrder_Im">Imperil</label><input id="debuffSkillOrder_Si" type="checkbox"><label for="debuffSkillOrder_Si">Silence</label><input id="debuffSkillOrder_We" type="checkbox"><label for="debuffSkillOrder_We">Weaken</label><input id="debuffSkillOrder_Bl" type="checkbox"><label for="debuffSkillOrder_Bl">Blind</label><input id="debuffSkillOrder_Slo" type="checkbox"><label for="debuffSkillOrder_Slo">Slow</label>
            <input id="debuffSkillOrder_MN" type="checkbox"><label for="debuffSkillOrder_MN">MagNet</label><input id="debuffSkillOrder_Dr" type="checkbox"><label for="debuffSkillOrder_Dr">Drain</label><input id="debuffSkillOrder_Co" type="checkbox"><label for="debuffSkillOrder_Co">Confuse</label></div>
          <div class="debuffSkillCondition"><div class="customize" name="debuffSkillCondition"></div></div>
          <div><input id="debuffSkillAllSleep" type="checkbox"><label for="debuffSkillAllSleep"><b>Sleep all</b></label>
            <input class="dbNumber" name="sleepRatio" type="text" placeholder="0">
            <div class="customize" name="debuffSkillallsleepCondition"></div></div>
          <div><input id="debuffSkillAllMN" type="checkbox"><label for="debuffSkillAllMN"><b>MagNet all</b></label><input class="dbNumber" name="magnetRatio" type="text" placeholder="0"> <div class="customize" name="debuffSkillallmagnetCondition"></div></div>
          <div><input id="debuffSkillAllWeak" type="checkbox"><label for="debuffSkillAllWeak"><b>Weaken all</b></label>
            <input class="dbNumber" name="weakRatio" type="text" placeholder="0">
            <div class="customize" name="debuffSkillallweakCondition"></div></div>
          <div><input id="debuffSkillAllSi" type="checkbox"><label for="debuffSkillAllSi"><b>Silence all</b></label><input class="dbNumber" name="silenceRatio" type="text" placeholder="0"> <div class="customize" name="debuffSkillallsilenceCondition"></div></div>
          <div><input id="debuffSkillAllIm" type="checkbox"><label for="debuffSkillAllIm"><b>Imperil all</b></label><input class="dbNumber" name="impRatio" type="text" placeholder="0"> <div class="customize" name="debuffSkillallimpCondition"></div></div>
          <div><input id="debuffSkill_Sle" type="checkbox"><label for="debuffSkill_Sle"><b>Sleep</b></label> <div class="customize" name="debuffSkillSleCondition"></div></div>
          <div><input id="debuffSkill_Bl" type="checkbox"><label for="debuffSkill_Bl"><b>Blind</b></label> <div class="customize" name="debuffSkillBlCondition"></div></div>
          <div><input id="debuffSkill_Slo" type="checkbox"><label for="debuffSkill_Slo"><b>Slow</b></label> <div class="customize" name="debuffSkillSloCondition"></div></div>
          <div><input id="debuffSkill_Im" type="checkbox"><label for="debuffSkill_Im"><b>Imperil</b></label> <div class="customize" name="debuffSkillImCondition"></div></div>
          <div><input id="debuffSkill_MN" type="checkbox"><label for="debuffSkill_MN"><b>MagNet</b></label> <div class="customize" name="debuffSkillMNCondition"></div></div>
          <div><input id="debuffSkill_Si" type="checkbox"><label for="debuffSkill_Si"><b>Silence</b></label> <div class="customize" name="debuffSkillSiCondition"></div></div>
          <div><input id="debuffSkill_Dr" type="checkbox"><label for="debuffSkill_Dr"><b>Drain</b></label> <div class="customize" name="debuffSkillDrCondition"></div></div>
          <div><input id="debuffSkill_We" type="checkbox"><label for="debuffSkill_We"><b>Weaken</b></label> <div class="customize" name="debuffSkillWeCondition"></div></div>
          <div><input id="debuffSkill_Co" type="checkbox"><label for="debuffSkill_Co"><b>Confuse</b></label> <div class="customize" name="debuffSkillCoCondition"></div></div>
        `;
      },

      // 构建Skill标签页
      buildSkillTab() {
        return `
          <div class="skillOrder"><span class="dbTipText">施放顺序</span>
            <input class="dbInputWide" name="skillOrder" type="text" disabled><br>
            <input id="skillOrder_OFC" type="checkbox"><label for="skillOrder_OFC">马炮</label><input id="skillOrder_FRD" type="checkbox"><label for="skillOrder_FRD">龙吼</label><input id="skillOrder_Cor" type="checkbox"><label for="skillOrder_Cor">腐败</label><input id="skillOrder_Smi" type="checkbox"><label for="skillOrder_Smi">惩戒</label><input id="skillOrder_T3" type="checkbox"><label for="skillOrder_T3">T3</label><input id="skillOrder_T2" type="checkbox"><label for="skillOrder_T2">T2</label><input id="skillOrder_T1" type="checkbox"><label for="skillOrder_T1">T1</label></div>
          <div><b>友情小马炮</b> <input id="skillOTOS_OFC" type="checkbox"><label for="skillOTOS_OFC" class="dbTipText">一层一次</label> <div class="customize" name="skillOFCCondition"></div></div>
          <div><b>龙吼</b> <input id="skillOTOS_FRD" type="checkbox"><label for="skillOTOS_FRD" class="dbTipText">一层一次</label> <div class="customize" name="skillFRDCondition"></div></div>
          <div><b>腐败</b> <input id="skillOTOS_Cor" type="checkbox"><label for="skillOTOS_Cor" class="dbTipText">一层一次</label> <div class="customize" name="skillCorCondition"></div></div>
          <div><b>惩戒</b> <input id="skillOTOS_Smi" type="checkbox"><label for="skillOTOS_Smi" class="dbTipText">一层一次</label> <div class="customize" name="skillSmiCondition"></div></div>
          <div><label><b>战斗风格</b></label> <select class="dbNumber" name="fightingStyle"><option value="1">二天一流</option><option value="2">单手</option><option value="3">双手</option><option value="4">双持</option></select></div>
          <div><b>T3</b> <input id="skillOTOS_T3" type="checkbox"><label for="skillOTOS_T3" class="dbTipText">一层一次</label> <div class="customize" name="skillT3Condition"></div></div>
          <div><b>T2</b> <input id="skillOTOS_T2" type="checkbox"><label for="skillOTOS_T2" class="dbTipText">一层一次</label> <div class="customize" name="skillT2Condition"></div></div>
          <div><b>T1</b> <input id="skillOTOS_T1" type="checkbox"><label for="skillOTOS_T1" class="dbTipText">一层一次</label> <div class="customize" name="skillT1Condition"></div></div>
        `;
      },

      // 构建Scroll标签页
      buildScrollTab() {
        return `
          <div><div class="customize" name="scrollCondition"></div></div>
          <input id="scrollFirst" type="checkbox"><label for="scrollFirst">存在技能生成的Buff时，仍然使用卷轴.</label>
          <div><input id="scroll_Go" type="checkbox"><label for="scroll_Go"><b>Scroll of the Gods</b></label><div class="customize" name="scrollGoCondition"></div></div>
          <div><input id="scroll_Av" type="checkbox"><label for="scroll_Av"><b>Scroll of the Avatar</b></label><div class="customize" name="scrollAvCondition"></div></div>
          <div><input id="scroll_Pr" type="checkbox"><label for="scroll_Pr"><b>Scroll of Protection</b></label><div class="customize" name="scrollPrCondition"></div></div>
          <div><input id="scroll_Sw" type="checkbox"><label for="scroll_Sw"><b>Scroll of Swiftness</b></label><div class="customize" name="scrollSwCondition"></div></div>
          <div><input id="scroll_Li" type="checkbox"><label for="scroll_Li"><b>Scroll of Life</b></label><div class="customize" name="scrollLiCondition"></div></div>
          <div><input id="scroll_Sh" type="checkbox"><label for="scroll_Sh"><b>Scroll of Shadows</b></label><div class="customize" name="scrollShCondition"></div></div>
          <div><input id="scroll_Ab" type="checkbox"><label for="scroll_Ab"><b>Scroll of Absorption</b></label><div class="customize" name="scrollAbCondition"></div></div>
        `;
      },

      // 构建人格配置标签页
      buildPersonaConfigTab() {
        return `
          <div class="dbTipText">字段为空则不切换</div>
          <div><b>AR&nbsp;</b> 人格 <input class="dbNumber" name="arPersona" type="text"> 装备 <input class="dbNumber" name="arEquip" type="text"> 配置 <select class="dbNumber dbBackupList" name="arConfig"></select></div>
          <div><b>GF&nbsp;</b> 人格 <input class="dbNumber" name="gfPersona" type="text"> 装备 <input class="dbNumber" name="gfEquip" type="text"> 配置 <select class="dbNumber dbBackupList" name="gfConfig"></select></div>
          <div><b>TW</b> 人格 <input class="dbNumber" name="twPersona" type="text"> 装备 <input class="dbNumber" name="twEquip" type="text"> 配置 <select class="dbNumber dbBackupList" name="twConfig"></select></div>
        `;
      },

      // 构建数据记录标签页
      buildDataRecordTab() {
        return `
          <div>
            <b>数据记录</b>
            <button class="reDataRecord">重置</button>
            <div style="margin:16px 0;border-top:1px solid #dee2e6;padding-top:16px;">
              <div style="display:flex;gap:16px;">
                <!-- 左侧：数据列显示控制框 -->
                <div style="flex:1;border:1px solid #dee2e6;background-color:var(--aad-bg-white);padding:16px;border-radius:6px;">
                    <div style="margin-bottom:12px;"><b>列显示控制</b></div>
                    <div class="dbColumnControls" style="max-height:300px;overflow-y:auto;">
                    <div class="dbTipText" style="margin-bottom:12px;font-size:13px;">勾选要显示的列项目</div>
                    ${this.buildColumnControlsHTML()}
                  </div>
                </div>
                <!-- 右侧：功能选项和操作按钮 -->
                <div style="flex:1;display:flex;flex-direction:column;gap:16px;">
                  <div style="border:1px solid #dee2e6;background-color:var(--aad-bg-white);padding:16px;border-radius:6px;">
                    <div style="margin-bottom:12px;"><b>功能选项</b></div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      <div><input id="defeatLogSwitch" type="checkbox"><label for="defeatLogSwitch">战败日志</label></div>
                      <div><input id="resistTooltipSwitch" type="checkbox"><label for="resistTooltipSwitch">抵抗统计</label></div>
                      <div><input id="proficiencyTooltipSwitch" type="checkbox"><label for="proficiencyTooltipSwitch">熟练度显示</label></div>
                    </div>
                  </div>
                  <div style="border:1px solid #dee2e6;background-color:var(--aad-bg-white);padding:16px;border-radius:6px;">
                    <div style="margin-bottom:12px;"><b>数据操作</b></div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      <button class="dbShowBattleStatsModal">战斗数据统计</button>
                      <div style="display:flex;gap:8px;flex-wrap:nowrap;">
                        <button class="updateData_bid" style="flex:1 1 0;white-space:nowrap;">BID更新</button>
                        <button class="updateData_ask" style="flex:1 1 0;white-space:nowrap;">ASK更新</button>
                        <button class="showPrices" style="flex:1 1 0;white-space:nowrap;">查看价格</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      },

      // 构建列控制器HTML
      buildColumnControlsHTML() {
        let html = '';

        Object.keys(dbTableColumnsAll).forEach(groupName => {
          html += '<div style="margin-bottom:15px;">';
          html += '<div style="margin-bottom:8px;"><b>' + groupName + '</b></div>';

          dbTableColumnsAll[groupName].forEach(column => {
            html += '<div style="margin-left:15px;margin-bottom:5px;">';
            html += '<input type="checkbox" id="' + column.id + '" name="dataColumns.' + column.id + '">';
            html += '<label for="' + column.id + '" style="margin-left:5px;cursor:pointer;">' + column.column_name + '</label>';
            html += '</div>';
          });

          html += '</div>';
        });

        return html;
      },

      // 构建系统设置标签页
      buildSystemTab() {
        return `
          <div><b>页面配色</b>
            <select id="themeSelector" class="dbNumber" name="themeSelector">
              <option value="white">天水碧</option>
              <option value="popBrutal">奶油波普</option>
              <option value="night">夜间</option>
            </select>
            <button id="applyTheme">应用配色</button>
          </div>
          <div class="dbTipText"><b>战斗卡住</b>
            <input id="delayReload" type="checkbox"><label for="delayReload"><input class="dbNumber" name="delayReloadTime" type="text" placeholder="60">秒，刷新页面</label>
          </div>
          <div class="dbTipText"><b>暂停相关</b>
            <input id="pauseButton" type="checkbox"><label for="pauseButton">使用按钮</label>
            <input id="pauseHotkey" type="checkbox"><label for="pauseHotkey">使用热键 <input class="dbNumber" name="pauseHotkeyStr" type="text"></label>
          </div>
          <div class="dbTipText"><b>外置按钮</b>
            <input id="idleArenaExternalButton" type="checkbox"><label for="idleArenaExternalButton">自动AR开关</label>
            <input id="battleStatsExternalButton" type="checkbox"><label for="battleStatsExternalButton">战斗数据按钮</label>
          </div>
          <div class="dbTipText"><b>动作延迟</b>  魔法/技能 <input class="dbNumber" name="delay" placeholder="0" type="text">ms  攻击/物品 <input class="dbNumber" name="delay2" placeholder="0" type="text">ms<br>
          </div>
        `;
      },

      // 构建配置设置标签页
      buildConfigSettingsTab() {
        const option = AAD.Core.Storage.getValue('option') || {};

        return `
          <div><b>预设配置</b>
            <button class="dbLoadPreset">加载预设</button>
            <select id="presetSelector" class="dbNumber"></select>
            <div id="presetDescription" class="dbTipText" style="margin-top:8px;font-size:12px;max-width:400px;"></div>
          </div>
          <div><b>备份配置</b><button class="dbBackup">保存备份</button><button class="dbRestore">加载备份</button><button class="dbDelete">删除备份</button><select class="dbNumber" id="dbBackupListLast"></select></div>
          <div><b>迁移配置</b><button class="dbExport">导出配置</button><button class="dbImport">导入配置</button><br><textarea id="dbConfig" class="dbInputWide"></textarea></div>
        `;
      },

      // 绑定面板事件
      bindPanelEvents(panel) {
        const arenaOrderHandler = this.createArenaOrderHandler(panel);
        const skillOrderHandlers = {
          itemOrder: this.createSkillOrderHandler('itemOrder'),
          buffSkillOrder: this.createSkillOrderHandler('buffSkillOrder'),
          debuffSkillOrder: this.createSkillOrderHandler('debuffSkillOrder'),
          channelSkillOrder: this.createSkillOrderHandler('channelSkillOrder'),
          skillOrder: this.createSkillOrderHandler('skillOrder')
        };

        const handlePriceUpdate = async (type, label) => {
          if (AAD.Utils.Common.alert(1, `是否更新(${type})`)) {
            try {
              await AAD.Data.Market.updatePriceData(type);
            } catch (error) {
              console.error(`[UI] ${label}价格更新失败:`, error);
              AAD.Utils.Common.alert(0, `${label}价格更新失败，请查看控制台日志`);
            }
          }
        };

        panel.addEventListener('click', (e) => {
          const target = e.target;
          const tabSpan = target.closest('.dbTabmenu span[name]');
          if (tabSpan) {
            const targetTag = target.tagName;
            if (targetTag === 'LABEL') {
              e.preventDefault();
              this.switchTab(tabSpan.getAttribute('name'));
            } else if (targetTag !== 'INPUT') {
              this.switchTab(tabSpan.getAttribute('name'));
            }
            return;
          }

          if (target.tagName === 'INPUT' && target.type === 'checkbox') {
            if (target.closest('#dbArenaLevels')) {
              arenaOrderHandler(e);
              return;
            }
            if (target.closest('.itemOrder')) {
              skillOrderHandlers.itemOrder(e);
              return;
            }
            if (target.closest('.buffSkillOrder')) {
              skillOrderHandlers.buffSkillOrder(e);
              return;
            }
            if (target.closest('.debuffSkillOrder')) {
              skillOrderHandlers.debuffSkillOrder(e);
              return;
            }
            if (target.closest('.channelSkillOrder')) {
              skillOrderHandlers.channelSkillOrder(e);
              return;
            }
            if (target.closest('.skillOrder')) {
              skillOrderHandlers.skillOrder(e);
              return;
            }
          }

          if (target.closest('.dbApply')) {
            this.applyConfig(panel);
            return;
          }
          if (target.closest('.dbCancel')) {
            this.cancelConfig(panel);
            return;
          }
          if (target.closest('.dbReset')) {
            this.resetConfig(panel);
            return;
          }
          if (target.closest('.dbShowBattleStatsModal')) {
            AAD.UI.Stats.showBattleStats();
            return;
          }
          if (target.closest('#applyTheme')) {
            const selector = panel.querySelector('#themeSelector');
            if (selector) {
              const selectedTheme = selector.value;
              AAD.UI.Theme.applyTheme(selectedTheme);
            }
            return;
          }
          if (target.closest('.idleArenaReset')) {
            if (confirm('是否重置竞技场战斗记录')) {
              AAD.Core.Storage.delValue('arena');
              alert('重置成功');
            }
            return;
          }
          if (target.closest('.crossWorldJumpReset')) {
            if (confirm('是否重置跨世界跳转状态')) {
              AAD.Logic.World.resetFlowFromUI();
              alert('重置成功，跨世界流程状态已清空');
            }
            return;
          }
          if (target.closest('.encounterResetPlan')) {
            AAD.Logic.Encounter.resetEncounterPlan();
            return;
          }
          if (target.closest('.dbShowLevels')) {
            const levelsDiv = panel.querySelector('#dbArenaLevels');
            if (levelsDiv) {
              levelsDiv.style.display = levelsDiv.style.display === 'block' ? 'none' : 'block';
            }
            return;
          }
          if (target.closest('.dbLevelsClear')) {
            if (!this.orderState) {
              this.initOrderState({});
            }
            this.orderState.idleArenaOrder = [];
            this.syncArenaOrderUI([], panel);
            return;
          }
          if (target.closest('.autoIWAddTask')) {
            this.addAutoIWTask(panel);
            return;
          }
          if (target.closest('.autoIWClearTasks')) {
            this.clearAutoIWTasks(panel);
            return;
          }
          const removeTaskButton = target.closest('.autoIWRemoveTask');
          if (removeTaskButton) {
            const equipId = removeTaskButton.getAttribute('data-eqid') || '';
            this.removeAutoIWTask(panel, equipId);
            return;
          }
          if (target.closest('.updateData_bid')) {
            handlePriceUpdate('bid', 'BID');
            return;
          }
          if (target.closest('.updateData_ask')) {
            handlePriceUpdate('ask', 'ASK');
            return;
          }
          if (target.closest('.showPrices')) {
            const prices = AAD.Data.Economy.getItemPrices();
            const entries = Object.entries(prices);
            if (entries.length === 0) {
              console.log('[价格数据] 暂无已存储价格');
            } else {
              console.log(`[价格数据] 已存储${entries.length}个物品价格`);
              console.table(prices);
            }
            return;
          }
          if (target.closest('.dbDelete')) {
            const select = panel.querySelector('#dbBackupListLast');
            const code = select ? select.value : '';

            if (!code) {
              alert('请先选择要删除的备份');
              return;
            }

            if (confirm('确定删除这个备份？')) {
              if (AAD.Core.Config.deleteConfig(code)) {
                const options = select.querySelectorAll('option');
                for (const option of options) {
                  if (option.value === code) {
                    option.remove();
                    break;
                  }
                }
              }
            }
            return;
          }
          if (target.closest('.dbLoadPreset')) {
            const selector = panel.querySelector('#presetSelector');
            const selectedPreset = selector ? selector.value : '';
          if (!selectedPreset) {
            AAD.Utils.Common.alert(0, '请选择要加载的预设配置');
            return;
          }
          const preset = AAD.Core.PRESET_CONFIGS[selectedPreset];
          const mergedConfig = AAD.Core.Config.mergeConfigWithExclusions(preset.config);
          this.loadConfigToPanel(panel, mergedConfig);
          return;
        }
          if (target.closest('.reDataRecord')) {
            const worldName = AAD.Runtime.isIsekai() ? '异世界' : '主世界';
            const confirmMsg = `是否重置【${worldName}】的数据记录？`;

            if (confirm(confirmMsg)) {
              const isIsekai = AAD.Runtime.isIsekai() ? 1 : 0;
              AAD.Data.Statistics.clearAllData(isIsekai).then(() => {
                alert(`【${worldName}】的数据记录已重置完成`);
              }).catch(error => {
                console.error('[Data.Recorder] 重置数据失败:', error);
                alert('重置数据失败，请重试');
              });
            }
            return;
          }
          if (target.closest('.dbBackup')) {
            this.backupConfig(panel);
            return;
          }
          if (target.closest('.dbRestore')) {
            this.restoreConfig(panel);
            return;
          }
          if (target.closest('.dbExport')) {
            this.exportConfig(panel);
            return;
          }
          if (target.closest('.dbImport')) {
            this.importConfig(panel);
            return;
          }
        });

        this.bindConditionBoxEvents(panel);
      },

      // 绑定条件框鼠标悬停事件
      bindConditionBoxEvents(panel) {
        let customizeBoxCreated = false;
        let customizeBoxElement = null;
        let lastTarget = null;
        let lastPositionTop = null;
        let lastPositionLeft = null;

        // 使用节流，30Hz (33ms)
        const throttledHandler = AAD.Utils.Common.throttle((e) => {
          let target = e.target;
          const pinned = AAD.Core.State.get('customizePinned', false);

          if (pinned) {
            target = AAD.Core.State.get('customizeTarget');
            if (!target || !document.body.contains(target)) {
              AAD.Core.State.set('customizePinned', false);
              if (customizeBoxElement) {
                const inspectButton = customizeBoxElement.querySelector('.dbInspect');
                if (inspectButton) inspectButton.title = 'off';
                customizeBoxElement.style.display = 'none';
                customizeBoxElement.style.zIndex = '-1';
              }
              return;
            }
          } else {
            target = target.closest ? target.closest('.customize') : null;
          }

          if (!customizeBoxCreated) {
            const customizeBox = AAD.UI.Stats.customizeBox();
            customizeBoxCreated = true;
            customizeBoxElement = AAD.Utils.DOM.gE('#customizeBox');
          }

          // 检查是否在customize元素上
          if (!pinned && !target) {
            if (customizeBoxElement) {
              customizeBoxElement.style.display = 'none';
              customizeBoxElement.style.zIndex = '-1';
            }
            return;
          }

          // 只在target变化时更新group
          if (!pinned && lastTarget !== target) {
            AAD.Core.State.set('customizeTarget', target);
            this.updateConditionBoxGroups(target);
            lastTarget = target;
          }

          // 安全检查：确保target是有效的DOM元素且能正确定位
          if (!target || !target.getBoundingClientRect) {
            if (customizeBoxElement) {
              customizeBoxElement.style.display = 'none';
            }
            return;
          }

          const position = target.getBoundingClientRect();
          // 边界检查
          if (position.bottom < 0 || position.left < 0 || position.width === 0 || position.height === 0) {
            if (customizeBoxElement) {
              customizeBoxElement.style.display = 'none';
            }
            return;
          }

          // 显示并定位横条
          if (customizeBoxElement) {
            const nextTop = position.bottom + window.scrollY + 'px';
            const nextLeft = position.left + window.scrollX + 'px';
            customizeBoxElement.style.display = 'block';
            customizeBoxElement.style.zIndex = '5';
            if (lastPositionTop !== nextTop) {
              customizeBoxElement.style.top = nextTop;
              lastPositionTop = nextTop;
            }
            if (lastPositionLeft !== nextLeft) {
              customizeBoxElement.style.left = nextLeft;
              lastPositionLeft = nextLeft;
            }
          }
        }, 33); // 33ms = 30Hz

        // 绑定鼠标移动事件
        panel.addEventListener('mousemove', throttledHandler);
      },

      // 更新条件框组选择器
      updateConditionBoxGroups(target) {
        const groups = target.querySelectorAll('.customizeGroup');
        const customizeBox = AAD.Utils.DOM.gE('#customizeBox');

        if (!customizeBox) return;

        // 缓存select元素引用
        const selectElement = AAD.Utils.DOM.gE('select[name="groupChoose"]', customizeBox);
        if (!selectElement) return;

        const currentGroupLength = groups.length;
        if (this._lastConditionTarget === target &&
            this._lastConditionGroupLength === currentGroupLength) {
          return;
        }
        this._lastConditionTarget = target;
        this._lastConditionGroupLength = currentGroupLength;

        selectElement.innerHTML = '';

        // 使用DocumentFragment批量插入
        const fragment = document.createDocumentFragment();
        for (let i = 0; i <= currentGroupLength; i++) {
          const optionElement = AAD.Utils.DOM.cE('option');
          if (i === currentGroupLength) {
            optionElement.value = 'new';
            optionElement.textContent = 'new';
          } else {
            optionElement.value = i + 1;
            optionElement.textContent = i + 1;
          }
          fragment.appendChild(optionElement);
        }
        selectElement.appendChild(fragment);
      },

      // 创建技能顺序处理器工厂函数
      createSkillOrderHandler(inputName, extractName = (id) => id.match(/_(.*)/)[1]) {
        return (e) => {
          if (e.target.tagName !== 'INPUT' || e.target.type !== 'checkbox') return;

          const name = extractName(e.target.id);
          // 根据checkbox的id确定对应的容器类名
          const containerClass = e.target.id.replace(/_[^_]+$/, ''); // 移除最后一个下划线及之后的部分
          const container = e.target.closest(`.${containerClass}`);
          const input = container?.querySelector(`input[name="${inputName}"]`);
          if (!input) return;

          if (!this.orderState) {
            this.initOrderState({});
          }
          const order = this.orderState[inputName] || (this.orderState[inputName] = []);
          const index = order.indexOf(name);

          if (e.target.checked) {
            if (index === -1) {
              order.push(name);
            }
          } else if (index !== -1) {
            order.splice(index, 1);
          }

          input.value = order.join(',');
        };
      },

      // 创建竞技场顺序处理器工厂函数
      createArenaOrderHandler(panel, inputName = 'idleArenaOrder') {
        return (e) => {
          if (e.target.tagName !== 'INPUT' || e.target.type !== 'checkbox') return;

          const value = e.target.value;
          if (!value) return;

          if (!this.orderState) {
            this.initOrderState({});
          }

          const order = this.orderState[inputName] || (this.orderState[inputName] = []);
          const index = order.indexOf(value);

          if (e.target.checked) {
            if (index === -1) {
              order.push(value);
            }
          } else if (index !== -1) {
            order.splice(index, 1);
          }

          this.syncArenaOrderUI(order, panel);
        };
      },

      syncArenaOrderUI(order, panel) {
        const container = panel.querySelector('#dbArenaLevels');
        const display = panel.querySelector('#idleArenaOrderDisplay');
        if (!container || !display) return;

        const orderList = Array.isArray(order) ? order : [];
        const selected = new Set(orderList.map(value => String(value)));
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const labelMap = {};

        for (let i = 0; i < checkboxes.length; i++) {
          const checkbox = checkboxes[i];
          checkbox.checked = selected.has(checkbox.value);
          const label = panel.querySelector(`label[for="${checkbox.id}"]`);
          const text = label ? label.textContent.trim() : '';
          if (text) {
            labelMap[checkbox.value] = text;
          }
        }

        const labels = [];
        for (let i = 0; i < orderList.length; i++) {
          const id = orderList[i];
          labels.push(labelMap[id] || String(id));
        }

        display.value = labels.join(',');
      },

      // 处理跨界连打UI
      handleSpecialConfigItems(panel) {
        const crossWorldEnabled = AAD.Logic.World.isCrossWorldEnabled();

        const crossWorldCheckbox = panel.querySelector('#crossWorldArena');
        if (crossWorldCheckbox) {
          crossWorldCheckbox.checked = crossWorldEnabled;
        }

        // 异世界UI禁用
        if (AAD.Runtime.isIsekai()) {
          if (crossWorldCheckbox) {
            const disabledOpacity = '0.5';
            crossWorldCheckbox.disabled = true;
            crossWorldCheckbox.style.opacity = disabledOpacity;
            const crossWorldLabel = crossWorldCheckbox.nextElementSibling;
            if (crossWorldLabel) crossWorldLabel.style.opacity = disabledOpacity;
          }

          const isekaiHint = panel.querySelector('#crossWorldArenaIsekaiHint');
          if (isekaiHint) {
            isekaiHint.style.display = 'inline';
          }
          console.log('[跨世界] 异世界UI：禁用跨世界连打选项');
        }
      },

      getAutoIWTasksFromPanel(panel) {
        const hiddenInput = panel.querySelector('input[name="autoIWTasksJson"]');
        if (!hiddenInput || !hiddenInput.value) return [];
        try {
          return AAD.Logic.AutoIW.normalizeTasks(JSON.parse(hiddenInput.value));
        } catch (error) {
          return [];
        }
      },

      setAutoIWTasksInPanel(panel, tasks) {
        const normalized = AAD.Logic.AutoIW.normalizeTasks(tasks);
        const hiddenInput = panel.querySelector('input[name="autoIWTasksJson"]');
        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(normalized);
        }
        this.renderAutoIWTaskList(panel, normalized);
      },

      renderAutoIWTaskList(panel, tasks) {
        const listContainer = panel.querySelector('#autoIWTaskList');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const option = AAD.Core.Storage.getValue('option') || {};
        const iwState = AAD.Core.Storage.getValue('iwState') || {};
        const runningIndex = option.autoIW && Number.isInteger(iwState.index) ? iwState.index : -1;

        if (!tasks.length) {
          listContainer.textContent = '暂无任务';
          return;
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:2px 0;';

          const info = document.createElement('span');
          const title = task.title || `[${task.id}]`;
          let status = AAD.Logic.AutoIW.normalizeStatus(task.status);
          if (i === runningIndex && option.autoIW && status !== IW_TASK_STATUS.DONE && status !== IW_TASK_STATUS.ERROR) {
            status = IW_TASK_STATUS.RUNNING;
          }
          const statusLabel = IW_TASK_STATUS_LABELS[status] || IW_TASK_STATUS_LABELS[IW_TASK_STATUS.WAITING];
          info.textContent = `${i + 1}. ${title} 目标${task.target} ${statusLabel}`;

          const removeBtn = document.createElement('button');
          removeBtn.className = 'autoIWRemoveTask';
          removeBtn.setAttribute('data-eqid', task.id);
          removeBtn.textContent = '删除';

          row.appendChild(info);
          row.appendChild(removeBtn);
          fragment.appendChild(row);
        }

        listContainer.appendChild(fragment);
      },

      persistAutoIWTasks(tasks, targetLevel) {
        const option = AAD.Core.Storage.getValue('option') || {};
        const nextOption = { ...option, autoIWTasks: AAD.Logic.AutoIW.normalizeTasks(tasks) };
        if (Number.isFinite(targetLevel) && targetLevel > 0) {
          nextOption.autoIWTargetLevel = targetLevel;
        }
        AAD.Core.Storage.setValue('option', nextOption);

        const iwState = AAD.Core.Storage.getValue('iwState');
        if (iwState && (iwState.index >= nextOption.autoIWTasks.length)) {
          AAD.Core.Storage.setValue('iwState', { index: 0 });
        }
      },

      addAutoIWTask(panel) {
        const urlParams = new URLSearchParams(window.location.search);
        const isIwPage = AAD.Runtime.isIsekai() &&
                         urlParams.get('s') === 'Battle' &&
                         urlParams.get('ss') === 'iw' &&
                         urlParams.get('screen') === 'itemworld';
        if (!isIwPage) {
          alert('请在异世界 Item World 页面添加任务');
          return;
        }

        const targetInput = panel.querySelector('input[name="autoIWTargetLevel"]');
        const target = parseInt(targetInput ? targetInput.value : '', 10);
        if (!Number.isFinite(target) || target <= 0) {
          alert('请输入有效的目标等级');
          return;
        }

        const checked = document.querySelectorAll('#equiplist input[name="eqids[]"]:checked');
        if (!checked || checked.length === 0) {
          alert('请先在IW页面勾选装备');
          return;
        }

        const tasks = this.getAutoIWTasksFromPanel(panel);
        const filter = urlParams.get('filter') || '';

        for (let i = 0; i < checked.length; i++) {
          const checkbox = checked[i];
          const equipId = String(checkbox.value || '').trim();
          if (!equipId) continue;
          const label = checkbox.closest('label');
          const title = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
          const task = {
            id: equipId,
            target: target,
            filter: filter,
            title: title,
            status: IW_TASK_STATUS.WAITING
          };
          const existingIndex = tasks.findIndex(item => item.id === equipId);
          if (existingIndex >= 0) {
            tasks[existingIndex] = task;
          } else {
            tasks.push(task);
          }
        }

        this.setAutoIWTasksInPanel(panel, tasks);
        this.persistAutoIWTasks(tasks, target);
      },

      removeAutoIWTask(panel, equipId) {
        const tasks = this.getAutoIWTasksFromPanel(panel).filter(task => task.id !== equipId);
        this.setAutoIWTasksInPanel(panel, tasks);
        this.persistAutoIWTasks(tasks);
      },

      clearAutoIWTasks(panel) {
        this.setAutoIWTasksInPanel(panel, []);
        this.persistAutoIWTasks([]);
      },

      // 更新技能顺序复选框状态
      updateSkillOrderCheckboxes(inputName, value, panel = document) {
        const skills = Array.isArray(value) ? value : [];
        const prefix = inputName;

        // 找到所有相关的复选框并更新状态
        const checkboxes = panel.querySelectorAll(`input[id^="${prefix}_"]`);
        checkboxes.forEach(checkbox => {
          const skillName = checkbox.id.match(/_(.*)/)[1];
          checkbox.checked = skills.includes(skillName);
        });
      },

      // 切换标签页
      switchTab(tabName) {
        // 更新活动标签页
        const tabs = document.querySelectorAll('.dbTabmenu > span');
        tabs.forEach(tab => tab.classList.remove('active'));

        const activeTab = document.querySelector(`.dbTabmenu > span[name="${tabName}"]`);
        if (activeTab) {
          activeTab.classList.add('active');
        }

        // 更新活动内容区域
        const contents = document.querySelectorAll('.dbTab');
        contents.forEach(content => content.classList.remove('active'));

        const activeContent = document.querySelector(`#dbTab-${tabName}`);
        if (activeContent) {
          activeContent.classList.add('active');
        }

        this.currentTab = tabName;
      },

      // 应用配置
      applyConfig(panel) {
        try {
          // 验证攻击模式是否已选择
          const attackStatusSelect = panel.querySelector('select[name="attackStatus"]');
          if (attackStatusSelect && (!attackStatusSelect.value || attackStatusSelect.value === '-1')) {
            alert('请选择攻击模式');
            // 切换到战斗核心标签页
            const combatTab = panel.querySelector('.dbTabmenu > span[name="CombatCore"]');
            if (combatTab) combatTab.click();
            return;
          }

          const newConfig = this.collectConfigFromPanel(panel);
          AAD.Core.Config.applyConfig(newConfig);

          // 重新加载主题
          const savedTheme = AAD.Core.Storage.getValue('currentTheme');
          const currentTheme = AAD.UI.Theme.themes[savedTheme] ? savedTheme : 'white';
          AAD.UI.Theme.applyTheme(currentTheme);

          // 隐藏面板
          this.toggle();

          console.log('[UI.Panel] 配置已应用');
        } catch (error) {
          console.error('[UI.Panel] 应用配置失败:', error);
          alert('应用配置失败：' + error.message);
        }
      },

      // 从面板收集配置
      collectConfigFromPanel(panel) {
        const config = {};

        const orderKeys = this.orderKeys || [];

        this.forEachPanelField(panel, (input) => {
          let itemName = '';
          let itemValue;

          if (input.tagName === 'SELECT' || input.type === 'select-one') {
            itemName = this.getFieldName(input);
            itemValue = input.value;
          } else if (input.classList.contains('dbNumber')) {
            itemName = input.name;
            itemValue = parseFloat(input.value || input.placeholder);

            if (isNaN(itemValue)) return;
          } else if (input.type === 'text' || input.type === 'hidden') {
            itemName = input.name;
            itemValue = input.value || input.placeholder || '';
            if (itemValue === '') return;
          } else if (input.type === 'checkbox') {
            if (input.id && input.id.startsWith('arLevel_')) {
              return;
            }
            itemName = this.getFieldName(input);
            itemValue = input.checked;
            if (!itemValue && !itemName.includes('dataColumns.') && !itemName.includes('_')) {
              return;
            }
          } else {
            return;
          }

          if (!itemName) return;

          if (itemName === 'autoIWTasksJson') {
            const tasks = AAD.Logic.AutoIW.normalizeTasks((() => {
              try {
                return JSON.parse(itemValue || '[]');
              } catch (error) {
                return [];
              }
            })());
            if (tasks.length > 0) {
              config.autoIWTasks = tasks;
            }
            return;
          }

          if (input.type === 'checkbox' && this.isOrderCheckbox(input, orderKeys)) {
            return;
          }

          if (orderKeys.includes(itemName)) {
            return;
          }

          this.setConfigValue(config, itemName, itemValue, input.classList.contains('customizeInput'));
        });


        if (this.orderState) {
          for (let i = 0; i < orderKeys.length; i++) {
            const key = orderKeys[i];
            const order = this.orderState[key];
            if (Array.isArray(order) && order.length > 0) {
              config[key] = order.slice();
            }
          }
        }

        return config;
      },

      // 取消配置
      cancelConfig(panel) {
        this.loadConfigToPanel(panel);
        this.toggle();
      },

      // 重置配置
      resetConfig(panel) {
        if (confirm('确定要重置所有设置为默认值吗？注意这将清空目前配置信息')) {
          AAD.Core.Config.resetConfig();
          this.loadConfigToPanel(panel);
        }
      },

      updateBackupSelects(panel, backups) {
        const selects = panel.querySelectorAll('select.dbBackupList');
        if (!selects.length) return;
        const codes = Object.keys(backups || {});
        selects.forEach(select => {
          const current = select.value;
          select.innerHTML = '<option value="">选择配置</option>';
          for (let i = 0; i < codes.length; i++) {
            const option = document.createElement('option');
            option.textContent = codes[i];
            option.value = codes[i];
            select.appendChild(option);
          }
          if (current) select.value = current;
        });
      },

      // 加载配置到面板
      loadConfigToPanel(panel, configOverride) {
        const config = configOverride || AAD.Core.Storage.getValue('option') || {};
        const orderPrefixes = this.orderKeys || [];
        this.initOrderState(config);

        // 加载备份列表
        const select = panel.querySelector('#dbBackupListLast');
        const backups = AAD.Core.Storage.getValue('backup') || {};
        if (select) {
          // 清空现有选项
          select.innerHTML = '<option value="">选择备份</option>';

          // 加载所有备份
          Object.keys(backups).forEach(code => {
            const option = document.createElement('option');
            option.textContent = code;
            option.value = code;
            select.appendChild(option);
          });
        }
        this.updateBackupSelects(panel, backups);

        this.forEachPanelField(panel, (input) => {
          if (input.tagName === 'SELECT' || input.type === 'select-one') {
            if (input.name) {
              input.value = config[input.name] || '';
            }
            return;
          }

          const itemName = this.getFieldName(input);
          if (!itemName) return;

          if (input.type === 'checkbox') {
            if (this.isOrderCheckbox(input, orderPrefixes)) {
              return;
            }
            input.checked = this.getConfigValue(config, itemName);
            return;
          }

          if (input.type === 'number') {
            const value = this.getConfigValue(config, itemName);
            input.value = value ?? '';
            return;
          }

          if (input.type === 'text' || input.type === 'hidden' || input.tagName === 'TEXTAREA') {
            if (orderPrefixes.includes(itemName)) return;
            const value = this.getConfigValue(config, itemName);
            input.value = value ?? '';
          }
        }, true);

        const resetInfo = AAD.Core.DailyReset.loadState('arena');
        const resetTimeLabel = panel.querySelector('#idleArenaResetTime');
        if (resetTimeLabel) {
          resetTimeLabel.textContent = resetInfo?.resetTime ? `计划时刻 ${new Date(resetInfo.resetTime).toLocaleTimeString()}` : '';
        }

        // 设置主题选择器
        const themeSelector = panel.querySelector('#themeSelector');
        if (themeSelector) {
          const savedTheme = AAD.Core.Storage.getValue('currentTheme');
          const currentTheme = AAD.UI.Theme.themes[savedTheme] ? savedTheme : 'white';
          themeSelector.value = currentTheme;
        }

        this.setAutoIWTasksInPanel(panel, config.autoIWTasks || []);

        this.handleSpecialConfigItems(panel);

        // 更新技能顺序复选框状态
        for (let i = 0; i < this.orderKeys.length; i++) {
          const field = this.orderKeys[i];
          if (field === 'idleArenaOrder') continue;
          const order = this.orderState[field] || [];
          const input = panel.querySelector(`input[name="${field}"]`);
          if (input) {
            input.value = order.join(',');
          }
          this.updateSkillOrderCheckboxes(field, order, panel);
        }

        const arenaOrder = this.orderState.idleArenaOrder || [];
        this.syncArenaOrderUI(arenaOrder, panel);
        this.initConditionBoxes(panel, config);

      },

      // 初始化条件框数据
      initConditionBoxes(panel, config) {
        const customizeElements = panel.querySelectorAll('.customize');
        customizeElements.forEach(customizeElement => {
          const itemName = customizeElement.getAttribute('name');
          if (itemName && config[itemName]) {
            // 清空现有内容
            customizeElement.innerHTML = '';

            for (const groupKey in config[itemName]) {
              const group = AAD.Utils.DOM.cE('div');
              group.className = 'customizeGroup';
              group.innerHTML = (parseInt(groupKey) + 1) + '. ';

              for (let k = 0; k < config[itemName][groupKey].length; k++) {
                const input = AAD.Utils.DOM.cE('input');
                input.type = 'text';
                input.className = 'customizeInput';
                input.name = itemName + '_' + groupKey;
                input.value = config[itemName][groupKey][k];
                group.appendChild(input);
              }

              customizeElement.appendChild(group);
            }
          }
        });
      },

      // 备份配置
      backupConfig(panel) {
        const backupCode = AAD.Core.Config.backupConfig();

        const select = panel.querySelector('#dbBackupListLast');
        if (select) {
          const option = document.createElement('option');
          option.textContent = backupCode;
          option.value = backupCode;
          select.appendChild(option);
          select.value = backupCode; 
        }
        this.updateBackupSelects(panel, AAD.Core.Storage.getValue('backup') || {});
      },

      restoreConfig(panel) {
        const select = panel.querySelector('#dbBackupListLast');
        const selectedCode = select ? select.value : '';

        if (!selectedCode) return;

        const restored = AAD.Core.Config.restoreConfig(selectedCode);
        if (!restored) {
          alert('加载备份失败：未找到对应配置');
        }
      },

      exportConfig(panel) {
        const configData = AAD.Core.Config.stripExcludedConfig(AAD.Core.Config.getAll());
        const textArea = panel.querySelector('#dbConfig');
        if (textArea) {
          textArea.value = JSON.stringify(configData, null, 2);
        }
      },

      importConfig(panel) {
        const textArea = panel.querySelector('#dbConfig');
        if (!textArea || !textArea.value) return;
        const configData = JSON.parse(textArea.value);
        const mergedConfig = AAD.Core.Config.mergeConfigWithExclusions(configData);
        AAD.Core.Config.applyConfig(mergedConfig);
      },

      // 暂停/继续切换 
      pauseChange() {
        const disabled = AAD.Core.Storage.getValue('disabled');

        if (disabled) {
          // 继续
          AAD.Core.Storage.setValue('disabled', false);
          AAD.Core.Storage.setValue('missanswer', false);
          const pauseButton = AAD.Utils.DOM.gE('#dbBox2>button');
          if (pauseButton) {
            pauseButton.innerHTML = '暂停';
          }
          // 继续时调用misspony和main
          AAD.Logic.PageHandler.misspony();
          if (typeof AAD.Logic.Battle.main === 'function') AAD.Logic.Battle.main();
        } else {
          // 暂停
          AAD.Core.Storage.setValue('disabled', true);
          AAD.Core.Storage.setValue('missanswer', false);
          AAD.Core.State.set('end', true);
          const pauseButton = AAD.Utils.DOM.gE('#dbBox2>button');
          if (pauseButton) {
            pauseButton.innerHTML = '继续';
          }
          document.title = AAD.Utils.Common.alert(-1, 'hvAutoAttack暂停中');
        }
      }
    },

    // 外置控件模块
    ExternalControls: {
      init(option) {
        this.createIdleArenaToggleButton(option);
        this.createBattleStatsButton(option);
      },

      createIdleArenaToggleButton(option) {
        if (!option || !option.idleArenaExternalButton) return;
        if (document.getElementById('idleArenaToggleButton')) return;

        const button = AAD.Utils.DOM.cE('button');
        button.id = 'idleArenaToggleButton';
        button.className = 'idleArenaToggleButton';
        button.textContent = option.idleArena ? '自动AR:开' : '自动AR:关';
        button.onclick = () => {
          const current = AAD.Core.Storage.getValue('option') || {};
          const next = { ...current, idleArena: !current.idleArena };
          AAD.Core.Config.applyConfig(next);
        };
        document.body.appendChild(button);
      },

      createBattleStatsButton(option) {
        if (!option || !option.battleStatsExternalButton) return;
        if (document.getElementById('battleStatsToggleButton')) return;

        const button = AAD.Utils.DOM.cE('div');
        button.id = 'battleStatsToggleButton';
        button.className = 'dbButton battleStatsToggleButton';
        button.textContent = '≡';
        button.title = '战斗数据';
        button.onclick = () => {
          const modal = AAD.Utils.DOM.gE('#AADBBattleStatsModal');
          if (modal && modal.style.display === 'block') {
            modal.style.display = 'none';
            return;
          }
          AAD.UI.Stats.showBattleStats();
        };

        document.body.appendChild(button);
      }
    },

    // 统计显示模块
    Stats: {
      // 显示战斗统计弹窗
      async showBattleStats() {
        console.log('[UI.Stats] 打开战斗统计弹窗');

        let modal = AAD.Utils.DOM.gE('#AADBBattleStatsModal');
        if (!modal) {
          modal = AAD.Utils.DOM.gE('body').appendChild(AAD.Utils.DOM.cE('div'));
          modal.id = 'AADBBattleStatsModal';
          modal.className = 'AADBBattleStatsModal';
          modal.innerHTML = '<div class="AADBContainer"><div class="AADBHeader"><div class="AADBTitle">战斗数据统计</div><div class="AADBActions"><button class="AADBExportBtn">导出</button><button class="AADBClose">×</button></div></div><div class="AADBFilters"></div><div class="AADBTableWrapper"><table class="AADBTable"></table></div></div>';

          AAD.Utils.DOM.gE('.AADBExportBtn', modal).onclick = () => this.exportBattleStats();
          const closeBtn = modal.querySelector('.AADBClose');
          if (closeBtn) {
            closeBtn.onclick = () => { modal.style.display = 'none'; };
          }
        }

        // 显示弹窗
        modal.style.display = 'block';
        await this.fillBattleStatsData(modal);
      },


      // 获取组合战斗数据
      async getCombinedBattleData() {
        const modal = AAD.Utils.DOM.gE('#AADBBattleStatsModal')
        const worldSelection = modal.querySelector('input[name="bsWorld"]:checked')?.value || 'current'
        const battleType = modal.querySelector('select[name="bsBattleType"]')?.value || ''
        const dateFrom = modal.querySelector('input[name="bsDateFrom"]')?.value || ''
        const dateTo = modal.querySelector('input[name="bsDateTo"]')?.value || ''
        const limitRowsInput = parseInt(modal.querySelector('input[name="bsLimitRows"]')?.value, 10)
        const limitRows = Number.isFinite(limitRowsInput) ? Math.max(0, limitRowsInput) : 50
        const dailySummary = modal.querySelector('input[name="bsDailySummary"]')?.checked || false

        try {
          let isekai = null;
          if (worldSelection === 'current') {
            isekai = AAD.Runtime.isIsekai() ? 1 : 0;
          } else if (worldSelection === 'main') {
            isekai = 0;
          } else if (worldSelection === 'isekai') {
            isekai = 1;
          }

          const queryOptions = {
            limit: limitRows,
            battleType: battleType && battleType !== '' ? battleType : null,
            isekai: isekai,
            includeAllWorlds: worldSelection === 'all',
            dateFrom: dateFrom,
            dateTo: dateTo,
            order: 'desc'
          };

          if (dailySummary) {
            return await AAD.Data.Statistics.getBattleDataByDay(queryOptions);
          }

          return await AAD.Data.Statistics.getBattleDataByRecord(queryOptions);
        } catch (error) {
          console.error('[BattleStats] 获取组合数据失败:', error);
          throw error;
        }
      },

      // 导出战斗统计数据
      async exportBattleStats() {
        try {
          const data = await this.getCombinedBattleData();
          const filename = 'bs_' + new Date().toISOString().slice(0, 10) + '.json';

          const jsonData = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();

          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('[UI.Stats] 导出失败:', error);
          alert('导出数据失败，请重试');
        }
      },

      // 创建Battle Stats过滤器
      createBattleStatsFilters(container) {
        if (container.children.length > 0) return; // 避免重复创建

        // 从 localStorage 读取上次的选择状态（默认不打勾）
          const savedDailySummary = localStorage.getItem('db_battleStats_dailySummary');
          const dailySummaryChecked = savedDailySummary === 'true' ? 'checked' : '';

        const filterHTML = [
          '<div class="AADBFilterRow">',
          '  <div style="display:inline-block; margin-right:15px; padding:5px; background:var(--aad-secondary-bg); border-radius:3px;">',
          '    <label style="margin-right:10px;">',
          '      <input type="radio" name="bsWorld" value="current" checked>',
          '      当前世界 (' + (AAD.Runtime.isIsekai() ? '异世界' : '主世界') + ')',
          '    </label>',
          '    <label style="margin-right:10px;">',
          '      <input type="radio" name="bsWorld" value="main">',
          '      主世界',
          '    </label>',
          '    <label style="margin-right:10px;">',
          '      <input type="radio" name="bsWorld" value="isekai">',
          '      异世界',
          '    </label>',
          '    <label>',
          '      <input type="radio" name="bsWorld" value="all">',
          '      全部',
          '    </label>',
          '  </div>',
          '  <br>',
          '  类型 <select name="bsBattleType">',
          '    <option value="">全部</option>',
          '    <option value="ar">竞技场</option>',
          '    <option value="ba">遭遇战</option>',
          '    <option value="rb">擂台</option>',
          '    <option value="gr">压榨界</option>',
          '    <option value="iw">道具界</option>',
          '    <option value="tw">塔楼</option>',
          '  </select>',
          '  数量 <input class="dbNumber" type="number" name="bsLimitRows" value="50" min="0" max="1000">',
          '  从 <input type="date" name="bsDateFrom">',
          '  至 <input type="date" name="bsDateTo">',
          '  <input type="checkbox" id="bsDailySummary" name="bsDailySummary" ' + dailySummaryChecked + '>',
          '  <label for="bsDailySummary">按天总结</label>',
          '  <button class="AADBApplyFilter">应用</button>',
          '  <button class="AADBClearFilter">清除</button>',
          '</div>'
        ].join('');

        container.innerHTML = filterHTML;

        // 绑定过滤器事件
        const applyBtn = container.querySelector('.AADBApplyFilter');
        const clearBtn = container.querySelector('.AADBClearFilter');

          applyBtn.onclick = () => {
            const dailySummaryInput = container.querySelector('input[name="bsDailySummary"]');
            if (dailySummaryInput) {
              localStorage.setItem('db_battleStats_dailySummary', dailySummaryInput.checked ? 'true' : 'false');
            }
            this.applyBattleStatsFilter(container.closest('.AADBContainer'));
          };

        clearBtn.onclick = () => {
          // 重置所有过滤器
          container.querySelector('input[name="bsWorld"][value="current"]').checked = true;
          container.querySelector('select[name="bsBattleType"]').value = '';
          container.querySelector('input[name="bsLimitRows"]').value = '50';
          container.querySelector('input[name="bsDateFrom"]').value = '';
          container.querySelector('input[name="bsDateTo"]').value = '';
          container.querySelector('input[name="bsDailySummary"]').checked = false;
          localStorage.setItem('db_battleStats_dailySummary', 'false');

          // 重新加载数据
          this.applyBattleStatsFilter(container.closest('.AADBContainer'));
        };
      },

      // 应用战斗统计过滤器
      async applyBattleStatsFilter(modal) {
        const table = modal.querySelector('.AADBTable');
        table.innerHTML = '<tr><td colspan="20">正在加载数据...</td></tr>';

        try {
          const data = await this.getCombinedBattleData();
          const tableHTML = this.generateBattleStatsTable(data);
          table.innerHTML = tableHTML;
        } catch (error) {
          console.error('[UI.Stats] 应用筛选失败:', error);
          table.innerHTML = '<tr><td colspan="20">加载数据失败: ' + error.message + '</td></tr>';
        }
      },

      // 填充战斗统计数据
      async fillBattleStatsData(modal) {
        const filterControls = modal.querySelector('.AADBFilters');
        const table = modal.querySelector('.AADBTable');

        // 创建过滤器
        this.createBattleStatsFilters(filterControls);
        table.innerHTML = '<tr><td colspan="20">正在加载数据...</td></tr>';

        try {
          const battleData = await this.getCombinedBattleData();

          // 生成表格
          const tableHTML = this.generateBattleStatsTable(battleData);
          table.innerHTML = tableHTML;
        } catch (error) {
          console.error('[UI.Stats] 填充数据失败:', error);
          table.innerHTML = '<tr><td colspan="20">加载数据失败: ' + error.message + '</td></tr>';
        }
      },

      // 生成战斗统计表格
      generateBattleStatsTable(data) {
        // 获取当前启用的列定义 
        const columns = AAD.UI.ColumnSettings.getEnabledColumns();
        const option = AAD.Core.Storage.getValue('option') || {};
        this.defeatLogTooltipEnabled = !!option.defeatLogSwitch;
        this.resistTooltipEnabled = !!option.resistTooltipSwitch;
        this.proficiencyTooltipEnabled = !!option.proficiencyTooltipSwitch;

        // 检查是否有启用的列
        const enabledGroups = Object.keys(columns);
        if (enabledGroups.length === 0) {
          return '<tr><td colspan="1" class="AADBNoData">请先在配置面板中勾选要显示的列</td></tr>';
        }

        // 计算总列数
        let totalColumns = 0;
        enabledGroups.forEach(groupName => {
          totalColumns += columns[groupName].length;
        });

        if (data.length === 0) {
          return '<tr><td colspan="' + totalColumns + '" class="AADBNoData">暂无数据</td></tr>';
        }

        // 初始化数据映射，用于tooltip懒加载
        if (!this.tooltipDataMap) {
          this.tooltipDataMap = new Map();
        }
        this.tooltipDataMap.clear();

        // 生成表头
        let headerHTML = '<thead>';

        // 分组表头
        headerHTML += '<tr class="AADBGroupHeader">';
        Object.keys(columns).forEach(groupName => {
          const columnCount = columns[groupName].length;
          headerHTML += '<th colspan="' + columnCount + '" class="AADBGroupHeaderCell">' + groupName + '</th>';
        });
        headerHTML += '</tr>';

        // 列名表头
        headerHTML += '<tr class="AADBColumnHeader">';
        Object.keys(columns).forEach(groupName => {
          columns[groupName].forEach(column => {
            headerHTML += '<th class="AADBColumnHeaderCell">' + column.column_name + '</th>';
          });
        });
        headerHTML += '</tr>';

        headerHTML += '</thead>';

        // 生成表体
        let bodyHTML = '<tbody>';

        // 使用合并后的计算函数，一次遍历同时计算Average和Total
        const summaryRows = this.calculateSummaryRows(data);
        const averageRow = summaryRows.averageRow;
        const totalRow = summaryRows.totalRow;

        // 存储Average和Total行数据到映射 (键名需要与context参数一致)
        this.tooltipDataMap.set('average', averageRow);
        this.tooltipDataMap.set('total', totalRow);

        // Average行
        bodyHTML += '<tr class="AADBDataRow">';
        Object.keys(columns).forEach(groupName => {
          columns[groupName].forEach(column => {
            const value = averageRow[column.field] || '';
            const cellClass = 'AADBDataCell';
            bodyHTML += this.generateTableCellWithTooltip(value, cellClass, column, averageRow, 'average');
          });
        });
        bodyHTML += '</tr>';

        // Total行
        bodyHTML += '<tr class="AADBDataRow">';
        Object.keys(columns).forEach(groupName => {
          columns[groupName].forEach(column => {
            const value = totalRow[column.field] || '';
            const cellClass = 'AADBDataCell';
            bodyHTML += this.generateTableCellWithTooltip(value, cellClass, column, totalRow, 'total');
          });
        });
        bodyHTML += '</tr>';

        // 分隔线
        bodyHTML += '<tr class="AADBSeparatorRow"><td colspan="' + totalColumns + '" style="border-top:2px solid #000;padding:0;"></td></tr>';

        data.forEach(row => {
          // 存储行数据到映射
          // rowId优先级：id（普通行） > timestamp（按天聚合行） > 随机ID（fallback）
          const rowId = row.id || row.timestamp || ('row_' + Math.random());
          this.tooltipDataMap.set(rowId, row);

          bodyHTML += '<tr class="AADBDataRow">';

          Object.keys(columns).forEach(groupName => {
            columns[groupName].forEach(column => {
              let value = row[column.field];
              let cellClass = 'AADBDataCell';

              // 处理空值或undefined，显示为0
              if (value === undefined || value === null || value === '') {
                value = 0;
              }

              if (typeof value === 'number' && STATISTICS_NUMERIC_FIELDS.includes(column.field)) {
                value = AAD.Data.Finance.formatFieldValue(column.field, value);
              }
              bodyHTML += this.generateTableCellWithTooltip(value, cellClass, column, row, 'data');
            });
          });

          bodyHTML += '</tr>';
        });
        bodyHTML += '</tbody>';

        // 初始化tooltip懒加载 (只初始化一次)
        if (!this.tooltipInitialized) {
          this.initTooltipLazyLoading();
          this.tooltipInitialized = true;
        }

        return headerHTML + bodyHTML;
      },

      // 计算汇总行
      calculateSummaryRows(data) {
        return AAD.Data.Finance.Helpers.calculateSummaryRows(data);
      },

      // 生成带tooltip的表格单元格
      generateTableCellWithTooltip(value, cellClass, column, row, context) {
        let tooltipAttr = '';
        let finalClass = cellClass;
        const hasDefeatLog = column.tooltip === 'defeat_log' && this.defeatLogTooltipEnabled && row?._defeatLog?.log;
        const displayValue = hasDefeatLog ? `<span class="dbDefeatLogHint">${value}</span>` : value;
        if (column.tooltip) {
          if (column.tooltip === 'defeat_log' && !hasDefeatLog) {
            return `<td class="${finalClass}">${displayValue}</td>`;
          }
          if (column.tooltip === 'exp_details' && !this.proficiencyTooltipEnabled) {
            return `<td class="${finalClass}">${displayValue}</td>`;
          }
          const rowId = context === 'data' ? (row.id || row.timestamp || ('row_' + Math.random())) : context;
          tooltipAttr = ` data-tooltip-type="${column.tooltip}" data-row-id="${rowId}" data-column-field="${column.field}"`;
        }

        return `<td class="${finalClass}"${tooltipAttr}>${displayValue}</td>`;
      },

      // 初始化tooltip懒加载
      initTooltipLazyLoading() {
        // 简化的tooltip初始化 - 可以后续完善
        if (this.tooltipInitialized) return;

        const modal = AAD.Utils.DOM.gE('#AADBBattleStatsModal');
        const table = modal ? modal.querySelector('.AADBTable') : null;
        if (!table) return;

        // 绑定鼠标悬停事件到统计表格
        table.addEventListener('mouseover', (e) => {
          const cell = e.target.closest('td[data-tooltip-type]');
          if (!cell) return;

          const tooltipType = cell.getAttribute('data-tooltip-type');
          const rowId = cell.getAttribute('data-row-id');
          const columnField = cell.getAttribute('data-column-field');

          if (!tooltipType || !rowId) return;
          if (tooltipType === 'defeat_log') {
            this.hideTooltip();
            return;
          }

          const rowData = this.tooltipDataMap.get(rowId);
          if (!rowData) return;

          const column = { tooltip: tooltipType, field: columnField };
          const content = this.generateTooltipContent(rowData, column);
          if (!content) {
            this.hideTooltip();
            return;
          }

          // 显示tooltip (简化实现)
          this.showTooltip(content, e.pageX, e.pageY);
        });

        table.addEventListener('mouseout', (e) => {
          const cell = e.target.closest('td[data-tooltip-type]');
          if (cell) {
            this.hideTooltip();
          }
        });

        table.addEventListener('click', (e) => {
          const cell = e.target.closest('td[data-tooltip-type="defeat_log"]');
          if (!cell) return;
          const rowId = cell.getAttribute('data-row-id');
          if (!rowId) return;
          const rowData = this.tooltipDataMap.get(rowId);
          const logText = rowData?._defeatLog?.log;
          if (!logText) return;
          this.showDefeatLogModal(logText);
        });

        this.tooltipInitialized = true;
      },

      // 显示tooltip
      showTooltip(content, x, y) {
        let tooltip = document.getElementById('dbTooltip');
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.id = 'dbTooltip';
          tooltip.className = 'dbTooltip';
          document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = content;
        tooltip.style.left = (x + 10) + 'px';
        tooltip.style.top = (y + 10) + 'px';
        tooltip.style.display = 'block';
      },

      // 隐藏tooltip
      hideTooltip() {
        const tooltip = document.getElementById('dbTooltip');
        if (tooltip) {
          tooltip.style.display = 'none';
        }
      },

      showDefeatLogModal(logText) {
        let modal = document.getElementById('dbDefeatLogModal');
        if (!modal) {
          modal = document.body.appendChild(document.createElement('div'));
          modal.id = 'dbDefeatLogModal';
          modal.className = 'dbDefeatLogModal';
          modal.innerHTML = '<div class="dbDefeatLogContent"></div>';
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              modal.style.display = 'none';
            }
          });
        }

        const content = modal.querySelector('.dbDefeatLogContent');
        if (content) {
          content.textContent = logText;
        }
        modal.style.display = 'flex';
      },

      // 生成tooltip内容
      generateTooltipContent(rowData, column) {
        const content = [];

        let dropData, combatData;

        // 对于Total和Average行，使用聚合数据
        if (rowData.timestamp === 'Total' || rowData.timestamp === 'Average') {
          if (rowData._lazyAveraging && rowData.timestamp === 'Average') {
            // Average行 + 惰性标记：按需平均化
            dropData = this.lazyAverageData(rowData._sourceDropData, rowData._dataLength);
            combatData = this.lazyAverageData(rowData._sourceCombatData, rowData._dataLength);
          } else if (rowData._lazyTotal && rowData.timestamp === 'Total') {
            // Total行：使用累积的总计数据
            dropData = rowData._sourceDropData;
            combatData = rowData._sourceCombatData;
          }
        } else {
          // 普通数据行和按天聚合行，使用标准化数据
          dropData = rowData._dropData || {};
          combatData = rowData._usageData || {};
        }

        switch (column.tooltip) {
          case 'exp_details':
            if (combatData.proficiency) {
              Object.keys(combatData.proficiency).forEach((name) => {
                const value = combatData.proficiency[name];
                if (value) {
                  const rounded = Math.round(value * 1000) / 1000;
                  content.push(name + ': ' + rounded);
                }
              });
            }
            break;

          case 'legendary_details': {
            const equipData = dropData.Equips && dropData.Equips.Legendary;
            if (equipData) {
              Object.keys(equipData).forEach((name) => {
                const count = equipData[name] || 0;
                if (count > 0) {
                  content.push(name + ': ' + count);
                }
              });
            }
            break;
          }

          case 'peerless_details': {
            const equipData = dropData.Equips && dropData.Equips.Peerless;
            if (equipData) {
              Object.keys(equipData).forEach((name) => {
                const count = equipData[name] || 0;
                if (count > 0) {
                  content.push(name + ': ' + count);
                }
              });
            }
            break;
          }

          case 'potion_details':
            if (combatData.items) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, ITEM_LISTS.POTIONS, 'items'));
            }
            break;

          case 'scroll_details':
            if (combatData.items) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, ITEM_LISTS.SCROLLS));
            }
            break;

          case 'gem_details':
            if (combatData.items) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, ITEM_LISTS.GEMS));
            }
            break;

          case 'attack_spell_details':
            if (combatData.magic) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, SPELL_LISTS.ATTACK, 'magic'));
            }
            if (this.resistTooltipEnabled) {
              const resistData = combatData.resist || {};
              const magicHit = resistData.magicHit || 0;
              const magicCrit = resistData.magicCrit || 0;
              const magicResistPartially = resistData.magicResistPartially || 0;
              const magicResist = resistData.magicResist || 0;
              if (magicHit) content.push('magicHit: ' + magicHit);
              if (magicCrit) content.push('magicCrit: ' + magicCrit);
              if (magicResistPartially) content.push('magicResistPartially: ' + magicResistPartially);
              if (magicResist) content.push('magicResist: ' + magicResist);
            }
            break;

          case 'support_spell_details':
            if (combatData.magic) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, SPELL_LISTS.SUPPORT, 'magic'));
            }
            break;

          case 'heal_spell_details':
            if (combatData.magic) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, SPELL_LISTS.HEAL, 'magic'));
            }
            break;

          case 'debuff_spell_details':
            if (combatData.magic) {
              content.push(...ItemStatsUtil.getItemDetails(combatData, SPELL_LISTS.DEBUFF, 'magic'));
            }
            if (this.resistTooltipEnabled) {
              const resistData = combatData.resist || {};
              const resist0 = resistData.debuffResist0 || 0;
              const resist12 = resistData.debuffResist12 || 0;
              const resist3 = resistData.debuffResist3 || 0;
              if (resist0) content.push('debuffResist0: ' + resist0);
              if (resist12) content.push('debuffResist12: ' + resist12);
              if (resist3) content.push('debuffResist3: ' + resist3);
            }
            break;

          case 'defeat_log': {
            const defeatLog = rowData._defeatLog;
            if (defeatLog && defeatLog.log) {
              const logLines = defeatLog.log.split('\n');
              for (let i = 0; i < logLines.length; i++) {
                const line = logLines[i];
                if (line) {
                  content.push(line);
                }
              }
            }
            break;
          }

          case 'potion_net_details': {
            // 按药水类型合并计算净收入
            const potionNet = {};

            // 统计药水掉落
            for (const potionKey in dropData) {
              if (potionKey.includes('Potion') || potionKey.includes('Elixir') || potionKey.includes('Draught')) {
                potionNet[potionKey] = (potionNet[potionKey] || 0) + (dropData[potionKey] || 0);
              }
            }

            // 统计药水使用
            if (combatData.items) {
              ITEM_LISTS.POTIONS.forEach(potion => {
                const used = combatData.items[potion] || 0;
                if (used > 0) {
                  potionNet[potion] = (potionNet[potion] || 0) - used;
                }
              });
            }

            // 显示净收入（只显示非零的）
            for (const potionShort in potionNet) {
              if (potionNet[potionShort] !== 0) {
                const potionNetValue = AAD.Utils.Format.fixPrecision(potionNet[potionShort], 2);
                const potionSign = potionNetValue > 0 ? '+' : '';
                const potionDisplay = potionNetValue % 1 === 0 ? Math.round(potionNetValue) : potionNetValue;
                content.push(potionShort + ': ' + potionSign + potionDisplay);
              }
            }
            break;
          }

          case 'scroll_net_details': {
            // 按卷轴类型合并计算净收入
            const scrollNet = {};

            // 统计卷轴掉落（使用原名）
            for (const scrollKey in dropData) {
              if (scrollKey.includes('Scroll')) {
                scrollNet[scrollKey] = (scrollNet[scrollKey] || 0) + (dropData[scrollKey] || 0);
              }
            }

            // 统计卷轴使用（使用原名）
            if (combatData.items) {
              ITEM_LISTS.SCROLLS.forEach(scroll => {
                const used = combatData.items[scroll] || 0;
                if (used > 0) {
                  scrollNet[scroll] = (scrollNet[scroll] || 0) - used;
                }
              });
            }

            // 显示净收入（只显示非零的）
            for (const scrollName in scrollNet) {
              if (scrollNet[scrollName] !== 0) {
                const scrollNetValue = AAD.Utils.Format.fixPrecision(scrollNet[scrollName], 2);
                const scrollSign = scrollNetValue > 0 ? '+' : '';
                const scrollDisplay = scrollNetValue % 1 === 0 ? Math.round(scrollNetValue) : scrollNetValue;
                content.push(scrollName + ': ' + scrollSign + scrollDisplay);
              }
            }
            break;
          }

          default:
            break;
        }

        return content.length > 0 ? content.join('<br>') : '';
      },

      // 懒加载数据平均化
      lazyAverageData(sourceData, dataLength, excludeKeys = []) {
        if (!sourceData || dataLength <= 0) return {};

        const result = {};
        for (const key in sourceData) {
          if (excludeKeys.includes(key)) continue;
          if (typeof sourceData[key] === 'number') {
            result[key] = Math.round((sourceData[key] / dataLength) * 100) / 100;
          } else if (typeof sourceData[key] === 'object' && sourceData[key] !== null) {
            result[key] = this.lazyAverageData(sourceData[key], dataLength, excludeKeys);
          }
        }
        return result;
      },

      // 自定义条件界面
      customizeBox() {
        const existing = document.getElementById('customizeBox');
        if (existing) {
          return existing;
        }

        const customizeBox = document.body.appendChild(AAD.Utils.DOM.cE('div'));
        customizeBox.id = 'customizeBox';
        customizeBox.className = 'customizeBox';

        const statusOption = [
          '<option value="hp">hp</option>',
          '<option value="mp">mp</option>',
          '<option value="sp">sp</option>',
          '<option value="oc">oc</option>',
          '<option value="">- - - -</option>',
          '<option value="monsterAll">monsterAll</option>',
          '<option value="monsterAlive">monsterAlive</option>',
          '<option value="bossAll">bossAll</option>',
          '<option value="bossAlive">bossAlive</option>',
          '<option value="">- - - -</option>',
          '<option value="roundNow">roundNow</option>',
          '<option value="roundAll">roundAll</option>',
          '<option value="roundLeft">roundLeft</option>',
          '<option value="roundType">roundType</option>',
          '<option value="attackStatus">attackStatus</option>',
          '<option value="turn">turn</option>',
          '<option value="">- - - -</option>',
          '<option value="_isCd_">isCd</option>',
          '<option value="_buffTurn_">buffTurn</option>',
          '<option value="_hasDebuff_">hasDebuff</option>',
          '<option value="_hasEffect_">hasEffect</option>',
          '<option value="_isBoss_">isBoss</option>',
          '<option value="_monHp_">monHp</option>',
          '<option value="_monFullHp_">monFullHp</option>',
          '<option value="_monNowHp_">monNowHp</option>',
          '<option value="_isSsOn_">isSsOn</option>',
          '<option value=""></option>'
        ].join('');

        customizeBox.innerHTML = [
          '<span class="dbInspect" title="off">△</span>',
          '<select name="groupChoose"></select>',
          '<select name="statusA">' + statusOption + '</select>',
          '<select name="compareAB"><option value="1">＞</option><option value="2">＜</option><option value="3">≥</option><option value="4">≤</option><option value="5">＝</option><option value="6">≠</option></select>',
          '<select name="statusB">' + statusOption + '</select>',
          '<button class="groupAdd">＋</button>'
        ].join(' ');

        AAD.Utils.DOM.gE('.dbInspect', customizeBox).onclick = function() {
          const pinned = AAD.Core.State.get('customizePinned', false);
          const target = AAD.Core.State.get('customizeTarget');
          if (!pinned && !target) return;
          const nextPinned = !pinned;
          AAD.Core.State.set('customizePinned', nextPinned);
          this.title = nextPinned ? 'on' : 'off';
        };

        AAD.Utils.DOM.gE('.groupAdd', customizeBox).onclick = function() {
          const target = AAD.Core.State.get('customizeTarget');
          if (!target) return;
          const selects = AAD.Utils.DOM.gE('select', 'all', customizeBox);
          let groupChoose = selects[0].value;
          let group;
          if (groupChoose === 'new') {
            groupChoose = AAD.Utils.DOM.gE('option', 'all', selects[0]).length;
            group = target.appendChild(AAD.Utils.DOM.cE('div'));
            group.className = 'customizeGroup';
            group.innerHTML = groupChoose + '. ';
            selects[0].click();
          } else {
            group = AAD.Utils.DOM.gE('.customizeGroup', 'all', target)[groupChoose - 1];
          }
          const input = group.appendChild(AAD.Utils.DOM.cE('input'));
          input.type = 'text';
          input.className = 'customizeInput';
          input.name = target.getAttribute('name') + '_' + (groupChoose - 1);
          input.value = selects[1].value + ',' + selects[2].value + ',' + selects[3].value;
          AAD.UI.Panel.updateConditionBoxGroups(target);
        };

        return customizeBox;
      },


    },


    // 统一主题系统模块
    Theme: {
      cssVariables: {
        'main-bg': '--aad-main-bg',
        'accent-color': '--aad-accent-color',
        'border-color': '--aad-border-color',
        'secondary-bg': '--aad-secondary-bg',
        'card-bg': '--aad-card-bg',
          'hover-color': '--aad-hover-color',
          'modal-bg': '--aad-modal-bg',
        'modal-header-bg': '--aad-modal-header-bg',
        'modal-overlay': '--aad-modal-overlay',
        'shadow-color': '--aad-shadow-color',
        'text-primary': '--aad-text-primary',
        'text-white': '--aad-text-white',
        'bg-white': '--aad-bg-white',
        'link-color': '--aad-link-color',
        'link-hover': '--aad-link-hover',
        'text-heading': '--aad-text-heading',
        'input-border': '--aad-input-border',
        'input-focus': '--aad-input-focus'
      },

      // 主题配置
      themes: {
        white: {
          name: '天水碧',
          'main-bg': '#F7F3EB',
          'accent-color': '#5BA5B2',
          'border-color': '#5BA5B2',
          'secondary-bg': '#F0EDE3',
            'card-bg': '#F7F3EB',
            'hover-color': '#E8E3D8',
            'modal-bg': '#F7F3EB',
          'modal-header-bg': '#5BA5B2',
          'modal-overlay': 'rgba(91, 165, 178, 0.4)',
          'shadow-color': 'rgba(91, 165, 178, 0.15)',
          'text-primary': '#495057',
          'text-white': '#f8f9fa',
          'bg-white': '#f8f9fa',
          'link-color': '#6B8AB8',
          'link-hover': '#5A7A9F',
          'text-heading': '#212529',
          'input-border': '#6B8AB8',
          'input-focus': '#5A7A9F'
        },
        popBrutal: {
          name: '奶油波普',
          'main-bg': '#FFF8EC',
          'accent-color': '#7FCBFF',
          'border-color': '#111111',
          'secondary-bg': '#FFD3A1',
            'card-bg': '#FFFEF9',
            'hover-color': '#CFEAFF',
            'modal-bg': '#FFFEF9',
          'modal-header-bg': '#BFE7C8',
          'modal-overlay': 'rgba(0, 0, 0, 0.2)',
          'shadow-color': 'rgba(0, 0, 0, 0.25)',
          'text-primary': '#111111',
          'text-white': '#f8f9fa',
          'bg-white': '#f8f9fa',
          'link-color': '#5FA8E5',
          'link-hover': '#F1A255',
          'text-heading': '#111111',
          'input-border': '#111111',
          'input-focus': '#7FCBFF'
        },
        night: {
          name: "夜间",
          "main-bg": "#0D0F12",
          "accent-color": "#4A6C8F",
          "border-color": "#2A313A",
          "secondary-bg": "#13171D",
          "card-bg": "#181D24",
          "hover-color": "#202632",
          "modal-bg": "#181D24",
          "modal-header-bg": "#1E262F",
          "modal-overlay": "rgba(0, 0, 0, 0.7)",
          "shadow-color": "rgba(0, 0, 0, 0.7)",
          "text-primary": "#C4CDD6",
          "text-white": "#F7F9FB",
          "bg-white": "#12161C",
          "link-color": "#6F97BF",
          "link-hover": "#83A9CF",
          "text-heading": "#E9EDF1",
          "input-border": "#2D3641",
          "input-focus": "#5A7FA6"
        }
      },

      // 初始化统一主题系统
      init() {
        const existingStyle = document.getElementById('aad-unified-styles');
        if (existingStyle) {
          return;
        }

        // 加载保存的主题
        const savedTheme = AAD.Core.Storage.getValue('currentTheme');
        const themeName = this.themes[savedTheme] ? savedTheme : 'white';

        // 生成完整CSS
        const fullCSS = this.generateFullCSS(themeName);
        const style = document.createElement('style');
        style.id = 'aad-unified-styles';
        style.textContent = fullCSS;
        document.head.appendChild(style);

      },

      // 应用主题
      applyTheme(themeName) {
        if (this.themes[themeName]) {
          const theme = this.themes[themeName];
          AAD.Core.Storage.setValue('currentTheme', themeName);
          this.updateCSSVariables(theme);
        }
      },

      updateCSSVariables(theme) {
        const root = document.documentElement;
        Object.entries(this.cssVariables).forEach(([themeKey, cssVar]) => {
          if (theme[themeKey]) {
            root.style.setProperty(cssVar, theme[themeKey]);
          }
        });
      },

      // 生成完整CSS（包含CSS变量和所有样式）
      generateFullCSS(themeName) {
        const theme = this.themes[themeName];
        const cssVariables = `:root {\n${Object.entries(this.cssVariables)
          .map(([themeKey, cssVar]) => `  ${cssVar}: ${theme[themeKey]};`)
          .join('\n')}\n}`;
        const styles = this.generateAllStyles();

        return `${cssVariables}\n\n${styles}`;
      },

      // 生成所有样式
      generateAllStyles() {
        return `
          /* AADB 统一样式系统 */

          /* 基础样式 */
          #dbBox2 { top: 30px; left: 1238px; position: absolute; }
          .lastEncounter { font-weight: 600; font-size: 14px; position: absolute; top: 32px; left: 1240px; text-decoration: none; color: var(--aad-text-primary); background-color: transparent; padding: 6px 10px; }
          .dbButton {
            top: 4px;
            left: 1238px;
            position: absolute;
            z-index: 9999;
            cursor: pointer;
            width: 28px;
            height: 28px;
            background: transparent;
            border: none;
            border-radius: 50%;
            box-shadow: none;
            transition: background-color 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            color: var(--aad-text-primary);
            font-size: 22px;
          }
            .dbButton:hover { background: var(--aad-accent-color); }

          .idleArenaToggleButton {
            top: 5px;
            left: 1300px;
            position: absolute;
            z-index: 1;
            cursor: pointer;
            background-color: var(--aad-secondary-bg);
            color: var(--aad-text-primary);
            border: 1px solid var(--aad-border-color);
            padding: 4px 8px;
          }

          .battleStatsToggleButton {
            left: 1268px;
          }


            /* 主面板 */
            #dbBox {
            left: calc(50% - 525px);
            top: 50px;
            font-size: 14px !important;
            z-index: 4;
            width: 850px;
            min-height: 580px;
            position: absolute;
            text-align: left;
            background-color: var(--aad-main-bg);
            border: 1px solid var(--aad-accent-color);
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
              box-shadow: 0 4px 6px var(--aad-shadow-color);
            }

            /* 战斗暂停按钮 */
            .pauseChange {
              border: 1px solid var(--aad-input-border);
              border-radius: 4px;
              cursor: pointer;
              margin: 0 2px;
              padding: 6px 12px;
              background-color: var(--aad-secondary-bg);
              color: var(--aad-text-primary);
              font-size: 13px;
              font-weight: 500;
            }

            .pauseChange:hover {
              background-color: var(--aad-hover-color);
              border-color: var(--aad-border-color);
            }

            .pauseChange:active {
              background-color: var(--aad-accent-color);
            }

          /* 标题区域 */
          #dbBox .dbCenter:first-child {
            background-color: var(--aad-accent-color);
            padding: 16px;
            border-radius: 8px 8px 0 0;
            border-bottom: 1px solid var(--aad-border-color);
            display: flex;
            align-items: center;
          }
          #dbBox .dbCenter:first-child h1 {
            margin: 0;
            color: var(--aad-text-white);
            font-size: 20px;
            font-weight: 600;
          }

          /* 顶部按钮组 */
          .dbTopButtons {
            display: flex;
            gap: 8px;
            margin-left: auto;
            margin-right: 12px;
          }
          .dbTopButtons button {
            padding: 6px 12px;
            font-size: 12px;
            border: 1px solid var(--aad-input-border);
            border-radius: 4px;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            cursor: pointer;
            font-weight: 500;
          }
          .dbTopButtons button:hover {
            background-color: var(--aad-secondary-bg);
            border-color: var(--aad-border-color);
          }

          /* 侧边栏标签页布局 */
          .dbTablist {
            display: flex;
            min-height: 520px;
            border-radius: 0 0 6px 6px;
            overflow: hidden;
          }
          .dbTabmenu {
            flex: 0 0 100px;
            background-color: var(--aad-accent-color);
            border-right: 1px solid var(--aad-border-color);
            padding: 16px 0;
          }
          .dbTabmenu > span {
            display: block;
            padding: 8px 16px;
            margin: 2px 8px;
            border-radius: 4px;
            background-color: var(--aad-main-bg);
            border: 1px solid var(--aad-input-border);
            color: var(--aad-text-primary);
            text-decoration: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: background-color 0.15s ease;
          }

          .dbTabmenu > span:hover {
            background-color: var(--aad-secondary-bg);
            border-color: var(--aad-border-color);
          }

          .dbTabmenu > span.active {
            background-color: var(--aad-border-color);
            color: var(--aad-text-white);
            border-color: var(--aad-border-color);
          }

          /* 内容区域 */
          .dbTab {
            flex: 1;
            padding: 20px;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            overflow: auto;
            max-height: 480px;
            display: none;
          }

          .dbTab.active {
            display: block;
          }

          /* 卡片样式 */
          .dbTab > div {
            margin-bottom: 12px;
            padding: 16px;
            background-color: var(--aad-card-bg);
            border: 1px solid var(--aad-input-border);
            border-radius: 6px;
          }

          .dbTab > div:hover {
            border-color: var(--aad-accent-color);
          }

          /* 表单控件样式 */
          .dbTab input[type="checkbox"] { margin-right: 8px; vertical-align: text-bottom; }

          .dbTab input[type="number"],
          .dbTab input[type="text"],
          .dbTab select,
          .dbTab textarea {
            padding: 6px 8px;
            border: 1px solid var(--aad-input-border);
            border-radius: 4px;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            font-size: 13px;
          }

          .dbTab input[type="number"]:hover,
          .dbTab input[type="text"]:hover,
          .dbTab select:hover,
          .dbTab textarea:hover,
          .dbTab input[type="number"]:focus,
          .dbTab input[type="text"]:focus,
          .dbTab select:focus,
          .dbTab textarea:focus {
            background-color: var(--aad-secondary-bg) !important;
          }

          .dbTab input[type="number"]:focus,
          .dbTab input[type="text"]:focus,
          .dbTab select:focus,
          .dbTab textarea:focus {
            outline: none;
            border-color: var(--aad-input-focus);
            box-shadow: 0 0 0 2px var(--aad-shadow-color);
          }

          /* dbNumber 小*/
          .dbTab input.dbNumber {
            padding: 2px 4px;
            width: 32px;
            font-size: 13px;
          }

          /* dbNumber 中 */
          .dbTab select.dbNumber {
            padding: 2px 4px;
            min-width: 160px;
            font-size: 13px;
          }

          /* 长文本输入框 */
          .dbTab .dbInputWide {
            width: 65%;
          }


          /* 下拉框选项样式 */
          .dbTab select option {
            background-color: var(--aad-main-bg) ;
            color: var(--aad-text-primary);
          }

    
          .dbTab button {
            border: 1px solid var(--aad-input-border);
            border-radius: 4px;
            cursor: pointer;
            margin: 0 2px;
            padding: 6px 12px;
            background-color: var(--aad-secondary-bg);
            color: var(--aad-text-primary);
            font-size: 13px;
            font-weight: 500;
          }

          .dbTab button:hover {
            background-color: var(--aad-hover-color);
            border-color: var(--aad-border-color);
          }

          .dbTab button:active {
            background-color: var(--aad-accent-color);
          }

          /* 特殊样式 */
          .dbTipText {
            color: var(--aad-text-primary);
          }

          .dbTab b {
            font-family: inherit;
            font-size: 15px;
            color: var(--aad-text-heading);
            font-weight: 600;
          }

          .dbTab label {
            color: var(--aad-text-primary);
          }

          .dbTab a {
            margin: 0 4px;
            color: var(--aad-link-color);
            text-decoration: none;
          }

          .dbTab a:hover {
            text-decoration: underline;
            color: var(--aad-link-hover);
          }

          /* 条件框样式 */
          .customize {
            border: 1px dashed var(--aad-input-border);
            min-height: 24px;
            border-radius: 4px;
          }

          .customize > .customizeGroup {
            display: block;
            background-color: var(--aad-card-bg);
            border: 1px solid var(--aad-border-color);
            margin: 4px;
            padding-left: 1.05em;
            text-indent: -1.05em;
          }

          .customize > .customizeGroup:nth-child(2n) {
            background-color: var(--aad-secondary-bg);
          }

          .customizeBox {
            position: absolute;
            z-index: 100;
            display: none;
            border: 1px solid var(--aad-border-color);
            background-color: var(--aad-main-bg) !important;
            border-radius: 4px;
            box-shadow: 0 2px 8px var(--aad-shadow-color);
          }

          .customizeBox > span {
            display: inline-block;
            font-size: 14px;
            margin: 2px;
            padding: 4px 8px;
            font-weight: 500;
            border: 1px solid var(--aad-border-color);
            border-radius: 4px;
            color: var(--aad-text-primary);
            background-color: var(--aad-secondary-bg);
          }

          .customizeBox > span.dbInspect {
            cursor: pointer;          
          }

          .customizeBox > span.dbInspect:hover {
            background-color: var(--aad-hover-color);
          }

          .customizeBox > span.dbInspect[title="on"] {
            background-color: #dc3545;
            color: var(--aad-text-white);
          }

          .customizeBox > button.groupAdd {
            display: inline-block;
            font-size: 14px;
            margin: 2px;
            padding: 4px 8px;
            font-weight: 500;
            border: 1px solid var(--aad-border-color);
            border-radius: 4px;
            color: var(--aad-text-primary);
            background-color: var(--aad-secondary-bg);
            cursor: pointer;
          }

          .customizeBox > button.groupAdd:hover {
            background-color: var(--aad-hover-color);
          }

          .customizeBox > span a {
            text-decoration: none;
            color: var(--aad-link-color);
          }

          .customizeBox > select {
            max-width: 70px;
            padding: 2px 4px;
            background-color: var(--aad-main-bg) !important;
            color: var(--aad-text-primary) !important;
          }

          .customizeBox select option {
            background-color: var(--aad-main-bg) !important;
            color: var(--aad-text-primary) !important;
          }

          /* Battle Stats弹窗样式 - 兼容原版 */
          .AADBContainer {
            position: absolute;
            top: 6%;
            left: 10%;
            width: 60%;
            height: 65%;
            max-width: 80%;
            max-height: 75%;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            text-align: center;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 8pt;
            box-shadow: 0 4px 12px var(--aad-shadow-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 1000;
          }

          .AADBHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-shrink: 0;
          }

          .AADBTitle {
            font-size: 20pt;
            font-weight: bold;
          }

          .AADBActions button {
            margin-left: 5px;
            padding: 5px 10px;
            border: 1px solid var(--aad-input-border);
            background-color: var(--aad-main-bg);
            cursor: pointer;
            color: var(--aad-text-primary);
          }

          .AADBClose {
            font-size: 16pt;
            font-weight: bold;
          }

          .AADBFilters {
            margin-bottom: 10px;
            text-align: left;
            flex-shrink: 0;
          }

          .AADBFilterRow {
            line-height: 24px;
          }

          .AADBFilterRow select,
          .AADBFilterRow input {
            margin: 0 5px;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            border: 1px solid var(--aad-input-border);
            border-radius: 3px;
            padding: 2px 4px;
          }
          .AADBFilterRow select option {
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
          }
          .AADBFilterRow button {
            margin-left: 10px;
            padding: 2px 8px;
            border: 1px solid var(--aad-input-border);
            background-color: var(--aad-main-bg);
            cursor: pointer;
            color: var(--aad-text-primary);
          }

          .AADBTableWrapper {
            height: calc(100% - 120px);
            overflow: auto;
            flex: none;
            position: relative;
          }

          .AADBTable {
            width: max-content;
            table-layout: auto;
            white-space: nowrap;
            text-align: center;
            font-size: 8pt;
            border-collapse: collapse;
            background-color: var(--aad-main-bg);
          }

          .AADBTable td,
          .AADBTable th {
            padding: 4px 5px;
            border: 1px solid var(--aad-border-color);
          }

          .AADBTable tr.AADBGroupHeader th {
            border-left: 1px solid var(--aad-border-color);
            border-right: 1px solid var(--aad-border-color);
            background-color: var(--aad-main-bg);
            position: sticky;
            top: 0;
            z-index: 3;
            color: var(--aad-text-heading);
          }

          .AADBTable tr.AADBColumnHeader th {
            background-color: var(--aad-main-bg);
            border: 1px solid var(--aad-border-color);
            position: sticky;
            top: 22px;
            z-index: 2;
            color: var(--aad-text-heading);
          }

          .AADBTable tr.AADBDataRow {
            background-color: var(--aad-main-bg);
          }

          .AADBTable tr.AADBDataRow:hover {
            background-color: var(--aad-hover-color);
          }

          .dbDefeatLogHint {
            display: inline-block;
            border-bottom: 1px dashed var(--aad-border-color);
            padding: 0 10px;
          }

          .AADBTable tr.AADBSeparatorRow {
            height: 2px;
          }

          .AADBNoData {
            text-align: center;
            padding: 20px;
            color: var(--aad-text-secondary);
          }

          .dbTooltip {
            position: fixed;
            background-color: var(--aad-card-bg);
            color: var(--aad-text-primary);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.4;
            z-index: 10000;
            max-width: 320px;
            word-wrap: break-word;
            border: 1px solid var(--aad-border-color);
            box-shadow: 0 2px 8px var(--aad-shadow-color);
            pointer-events: none;
            display: none;
          }

          .dbDefeatLogModal {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
          }

          .dbDefeatLogContent {
            overflow: auto;
            white-space: pre-wrap;
            font-size: 12px;
            line-height: 1.4;
            background-color: var(--aad-main-bg);
            color: var(--aad-text-primary);
            border: 1px solid var(--aad-border-color);
            border-radius: 8px;
            box-shadow: 0 4px 12px var(--aad-shadow-color);
            width: 40%;
            max-width: 560px;
            max-height: 75%;
            padding: 16px;
          }

        `;
      },

    },

    // UI工具函数
    UITools: {
      // 打开URL函数
      openUrl(url, newTab = false) {
        if (newTab) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }
    },

    // 预设配置管理模块
    Preset: {

      initPresetSelector(panel) {
        const selector = panel.querySelector('#presetSelector');
        if (!selector) return;

        selector.innerHTML = '<option value="">选择预设</option>';

        const presets = AAD.Core.Config.getPresetConfigList();
        presets.forEach(preset => {
          const option = AAD.Utils.DOM.cE('option');
          option.value = preset.key;
          option.textContent = preset.name;
          selector.appendChild(option);
        });

        selector.onchange = () => {
          const selectedKey = selector.value;
          const descriptionDiv = panel.querySelector('#presetDescription');
          if (selectedKey && AAD.Core.PRESET_CONFIGS[selectedKey]) {
            descriptionDiv.textContent = AAD.Core.PRESET_CONFIGS[selectedKey].description;
          } else {
            descriptionDiv.textContent = '';
          }
        };
      },
    },

  }
};

// ==================== 初始化函数 ====================
async function init() {
  // 仅在主站保存URL，避免e-hentai覆盖返回目标
  if ((/^(\w+\.)?hentaiverse\.org$/).test(window.location.host)) {
    AAD.Core.Storage.setValue('url', window.location.origin);
  }

  
  AAD.Runtime.init();

  if (AAD.Runtime.pageType === 'ehentai') {
    AAD.Logic.PageHandler.handleEhentaiPage();
    return;
  }

  const domCheck = AAD.Utils.DOM.gE('#navbar,#riddlecounter,#textlog');
  if (!domCheck) {
    return;
  }

  try {
    AAD.UI.Theme.init();
  } catch (error) {
    console.error('[AAD初始化] 主题初始化失败:', error);
    throw error;
  }

  AAD.UI.Panel.init();

  const storedOption = AAD.Core.Storage.getValue('option');
  if (!storedOption) {
    AAD.UI.Panel.toggle();
    return;
  }

  AAD.UI.ExternalControls.init(storedOption);

  AAD.Core.State.init();

  const config = storedOption;
  AAD.Core.State.set('option', config);
  
  switch (AAD.Runtime.pageType) {
    case 'riddle':
      AAD.Logic.PageHandler.handleRiddlePage();
      break;
    case 'battle':
      AAD.Logic.PageHandler.handleBattlePage();
      break;
    case 'main':
    case 'isekai':
      await AAD.Logic.PageHandler.handleWorldPage();
      break;
    default:
      console.warn('[AAD] 未知页面类型:', AAD.Runtime.pageType);
  }
}
// ==================== Runtime驱动的主入口 ====================
init();
