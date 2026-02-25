// ==UserScript==
// @name           HV汉化
// @namespace      hentaiverse.org
// @author         ggxxsol & NeedXuyao & mbbdzz & indefined & etc. &THE
// @icon           https://hentaiverse.org/y/favicon.png
// @description    完全汉化整个Hentaiverse，包括文本、装备物品、图片按钮、战斗日志的汉化，带原文切换功能。
// @notice         本脚本已整合HV战斗汉化、HV图片按钮汉化和HV战斗日志汉化功能，默认在Chrome使用图片翻译法，其他浏览器使用文字翻译法
// @notice         图片翻译可通过localStorage设置：translateWithTitle(注释法)、translateWithImg(图片法)、translateWithText(文字法)
// @notice         完整功能需要在Hentaiverse主菜单 CHARACTER→SETTINGS 勾选自定义字体(Use Custom Font)并在下一行文本框中填上任意字体名称，拉到最下面点击Apply Changes
// @notice         和HVToolBox1.0.7以前版本在物品仓库中冲突，使用请更新到新版HVToolBox并将汉化运行顺序放在HVToolBox之后
// @notice         如与Live Percentile Ranges同时使用，需要将脚本运行顺序置于Live Percentile Ranges之后，查询不同品质范围需要切换到英文状态
// @notice         如有其它脚本共同运行冲突也可尝试调整脚本运行顺序，但无法保证完全兼容
// @include        *://hentaiverse.org/*
// @include        *://alt.hentaiverse.org/*


// @version        2025.11.09.equip-inventory-fix，两个世界兼容版本
// @grant none
// ==/UserScript==
(function () {
    'use strict';

    // ==================== 配置区域 ====================
    // 战斗翻译开关：true = 开启，false = 关闭
    var BATTLE_TRANSLATE_ENABLED = true;
    // 战斗日志汉化开关：true = 开启，false = 关闭（隐藏日志时自动关闭）
    var BATTLE_LOG_TRANSLATE_ENABLED = true;
    // 隐藏战斗日志开关：true = 隐藏，false = 显示
    var HIDE_BATTLE_LOG = false;
    // ================================================

    //if (document.getElementById('pane_log')) return;

    //字典分区，决定网页中的哪一部分使用哪部分翻译字典
    //格式： 'css选择器': ['使用到的字典名称',..]
    //注意使用到的字典顺序，互相包含的分区或者一个分区使用多个字典前面的翻译可能会影响后面的结果
    var dictsMap = {
        // 除了本字典分区里指定的部分之外，正文字典里另有alerts(浏览器弹窗)特殊部分使用独立方法翻译且所有页面生效
        '#messagebox' : ['messagebox', 'items', 'equipsName', 'equipsInfo'], //HV内的系统消息浮窗，所有页面的系统信息提示翻译均在这部分
        '#messagebox_outer' : ['messagebox', 'items', 'equipsName', 'equipsInfo'], //HV内的系统消息浮窗，所有页面的系统信息提示翻译均在这部分
        'body>script[src$="hvc.js"]+div[style]:not([id])' : ['login'], //登陆页面，因为没有ID特征比较难搞
        '#navbar' : ['menu', 'difficulty'], //主菜单导航栏，使用菜单字典和难度名字典
        '#eqch_left' : ['character', 'equipsName', 'equipsPart'], //主界面和切换装备页左侧栏，使用主界面字典和装备字典
        '#compare_pane' : ['equipsInfo'], //切换装备页面的装备对比悬浮窗，使用装备信息字典。
        '#equipcompare' : ['equipsInfo'], //装备切换页面的装备对比区域（异世界），使用装备信息字典
        '#eqch_stats' : ['characterStatus'], //主界面右侧状态栏
        '#ability_outer' : ['ability'], //技能页面，使用技能名称字典
        '#ability_info' : ['skills', 'abilityInfo', 'ability', 'items'], //技能悬浮窗，需监听动态翻译
        '#train_outer' : ['trains'], //训练
        '#popup_box' : ['itemInfos', 'items', 'artifact', 'equipsName', 'equipsInfo'], //物品和装备悬浮窗，需要监听动态翻译
        '#filterbar' : ['filters'], //装备、物品列表的类型筛选栏
        '#item_outer' : ['items', 'artifact'], //物品仓库
        '#eqinv_outer' : ['equipsName'], //装备仓库
        '#itshop_outer' : ['items', 'artifact'], //物品商店
        '#eqshop_outer' : ['equipsName'], //装备商店
        '#equipcount' : ['equipCounter'], //装备商店/整理/修理等页面的计数器文本
        '#armory_outer' : ['upgrades', 'items', 'equipsName', 'equipsInfo', 'character'], //装备库（异世界）外层容器，包含材料翻译（items在equipsName之前，避免材料名称被装备名称部分匹配）
        '#equipselect_outer' : ['equipsName', 'equipsInfo', 'character'], //装备切换页面（异世界），静态内容（装备列表、装备信息）
        '#itemlist' : ['items'], //材料列表（异世界分解页面），动态监听翻译
        '#confirm_outer' : ['upgrades', 'items', 'battle', 'equipsName', 'equipsInfo'], //确认操作对话框（出售、购买、分解、道具界进入等），可能显示材料清单、装备名和装备属性
        '#hvut-top' : ['difficulty'], // HV Utils 顶部难度选项翻译
        '#hvut-bottom' : ['equipsName', 'trains' ],// HV Utils 底部武器彩票和训练按钮翻译
        '#market_right' : ['items', 'artifact'], //市场列表
        '#market_outer' : ['market'], //交易市场其它内容
        '#settings_outer' : ['settings', 'skills', 'difficulty', 'equipsName'], //设置页面
        '#monstercreate_right' : ['monsterCreate'], //创建怪物信息，由于此面板被怪物实验室包含，实际也使用到了下一行的字典
        '#monster_outer' : ['monsterLabs'], //怪物实验室
        '#upgrade_text' : ['monsterLabs', 'items'], //怪物实验室的升级强化需求提示，需要监听动态翻译
        '#shrine_left' : ['artifact', 'items'], //祭坛左侧物品列表（文物/奖杯/收藏品）
        '#shrine_right' : ['shrine'], //祭坛右侧说明
        '#accept_equip' : ['equipsPart'], //装备献祭选项
        '#shrine_offertext' : ['artifact', 'items', 'shrine'], //祭坛献祭物品动态说明，需要动态监听
        '#mmail_outer' : ['mm'], //邮件
        '#mmail_attachlist' : ['items', 'artifact', 'equipsName'], //邮件附件列表
        '#mmail_attachitem' : ['items', 'artifact'], //写邮件附带物品列表
        '#mmail_attachequip' : ['equipsName'], //写邮件附带装备列表
        '.equiplist' : ['equipsName'], //装备列表容器（如邮件附件、装备库等页面中的装备列表）
        '#lottery_eqname' : ['equipsName'], //彩票装备名
        '#lottery_eqstat' : ['equipsInfo'], //彩票装备属性
        'div:not([id])>#leftpane' : ['prizes'], //很混乱的左侧栏，此处为彩票左侧栏
        'div:not([id])>#rightpane' : ['prizes'], //也很乱的右侧栏，此处为彩票右侧栏
        '#forge_outer>#leftpane' : ['equipsName'], //此处为强化左侧栏装备列表
        '#forge_outer>#rightpane' : ['upgrades', 'items', 'equipsInfo'], //装备强化的右侧栏，包含强化、物品、装备信息
        '#forge_cost_div' : ['upgrades', 'items'], //装备修复、分解、魂绑、重铸右侧的动态提示文本，需要监听动态翻译
        '#equip_extended' : ['equipsInfo'], //强化、装备独立信息页的装备信息
        '.showequip' : ['equipsName', 'equipsInfo'], //独立装备信息页，需要翻译装备名和装备信息
        '#showequip' : ['equipsName', 'equipsInfo'], //独立装备信息页（ID选择器），需要翻译装备名和装备信息
        '#equipinfo' : ['upgrades', 'equipsName', 'equipsInfo', 'character'], //装备详细信息容器（包含 #equipblurb 说明文字和装备属性）
        '#arena_list' : ['battle', 'difficulty'], //AR/ROB战斗列表
        '#arena_tokens' : ['battle'], //ROB的底部令牌提示
        '#towerstart' : ['battle', 'difficulty'], //TW战斗模式入场提示
        '#grindfest' : ['battle'], //GF战斗提示
        '#itemworld_left' : ['equipsName'], //IW左侧装备列表（旧版本）
        '#itemworld_right' : ['battle'], //IW右侧战斗提示（旧版本）
        '#equipselect_outer' : ['battle', 'equipsName'], //IW道具界页面（新版本，包含装备列表和说明文本）
        '.hvut-bt-div .hvut-bt-equip' : [ 'equipsName'], // 仅翻译 HV Utils 装备列表，不影响库存与修复材料
        '#riddlemaster' : ['riddlemaster'], //小马引导图

        //战斗页面的翻译元素
        '#infopane' : ['battling', 'skills'], //战斗提示信息面板
        //以下几个面板翻译会和Monsterbation冲突，且切换翻译需要刷新页面才会生效
        //'#table_skills' : ['skills'], //战斗技能面板
        //'#table_magic' : ['skills'], //战斗法术面板
        //'#pane_item' : ['battling'], //战斗物品面板
    };

    //需要监听动态翻译的元素列表，除非有新的动态元素否则不需要更改
    //只要上面字典分区里没有的就算在下面动态元素列表里有的也不会被翻译
    var dynamicElem = [
        '#popup_box', //装备、物品信息悬浮窗
        '#bocreate', //物品机器人订单按钮
        '#ability_info', //技能说明悬浮窗
        '#upgrade_text', //怪物实验室强化动态文字
        '#forge_cost_div', //装备修复、分解、魂绑、重铸右侧的动态提示文本
        '#shrine_offertext', //祭坛献祭动态说明文字
        '#confirm_outer', //确认操作对话框（动态显示）
        '#itemlist', //材料列表（异世界分解页面），只监听材料列表而不是整个 #equipselect_outer
        '#messagebox', // 系统消息浮窗
        '#messagebox_inner', // 系统消息浮窗内部容器（异世界）
        '#eqinv_outer', //装备仓库（动态加载装备列表）
        '#eqshop_outer', //装备商店（动态加载装备列表）
        '#equipcount', //装备商店/整理/修理等页面的计数器文本（动态更新）
        '#armory_outer', //装备库（异世界，动态加载装备列表）
        '#equipselect_outer', //道具界装备选择页面（动态显示装备详情）
        '#equipinfo', //装备详细信息容器（动态显示装备详情）
        '.showequip', //独立装备信息页（动态加载装备详情，类选择器）
        '#infopane', //战斗提示信息面板
        '#table_skills', //战斗技能列表
        '#table_magic', //战斗法术列表
        '#pane_item', //战斗物品面板
        '.hvut-bt-div', // HV Utils 战斗前工具面板（动态更新）
    ];




//翻译字典，内部分割为多个部分，每部分名称对应上述所指字典名称，翻译内容必须写入正确的部分才会生效
//除非上面字典分区中被指派到同一个翻译部分，否则各个部分之间互相独立，必要时有些翻译词条也会重复出现在多个部分中（这样比同时使用多个部分字典更有效率）
var words = {
    /*
    NOTE:
        You can use \\* to match actual asterisks instead of using it as a wildcard!
        The examples below show a wildcard in use and a regular asterisk replacement.
            'your a' : 'you\'re a',
            'imo' : 'in my opinion',
            'im\\*o' : 'matching an asterisk, not a wildcard',
            '/\\bD\\b/g' : '[D]',

        每部分字典内部语法格式：
            '原文' : '翻译之后的句子',
        原文部分如果带有*将被视为任意通配符，如果需要匹配真正的*号使用\\*代替*
            '\\*#06#' : '这句话将匹配到*#06#这个词而不会匹配到其它06#',
        原文部分可以使用正则表达式字符串，但是\必须二次转义为\\，比如
            '/(\\d)/' : '可以匹配到任意数字'，
        可以使用 '/^原文$/' 正则表达式来限制匹配整个原文句子而不是句子的一部分，比如:
            '/^Hell$/': '地狱', //可以匹配将'Hell'翻译为'地狱'而不会将'What the Hell'翻译为'What the 地狱'，也不会将'Hello'翻译为'地狱o'
    */

    //已知现缺：
        // trains：缺：新陈代谢、激励、解离症

    ////////////////////////////////////////////////////////////////////////////////
    // 浏览器弹窗，此部分使用独立翻译方法不受上面dictsMap影响
    // 此部分仅包含带有确认（取消）按钮的浏览器弹窗，所有页面的浏览器弹窗均使用此字典
    ////////////////////////////////////////////////////////////////////////////////
    alerts: {
        // 此部分内原文基本都是使用符合正则格式写的（正则元字符添加\\转义，去除前后的/之后可以直接用于创建RegExp）
        //hvc.js里的
        'Server communication failed: ' : '服务器通讯错误：',
        '/Are you sure you wish to purchase ([\\d,]+) equipment pieces? for ([\\d,]+) credits\\?/' : '是否确认以 $2 Credits的价格购买 $1 件装备',
        '/Are you sure you wish to sell ([\\d,]+) equipment pieces? for ([\\d,]+) credits\\?/' : '是否确认以 $2 Credits的价格出售 $1 件装备',
        '/Are you sure you wish to purchase ([\\d,]+) (.+) for ([\\d,]+) credits \\?/' : '是否确认以 $3 Credits的价格购买 $1 件 $2',
        '/Are you sure you wish to sell ([\\d,]+) (.+) for ([\\d,]+) credits \\?/' : '是否确认以 $3 Credits的价格出售 $1 件 $2',
        'No item selected' : '没有选中物品',
        '/Are you sure you wish to offer Snowflake a?/' : '是否确认向雪花女神献祭 ',
        '/You have attached ([\\d,]+) items?, and the CoD is set to ([\\d,]+) credits, kupo!/' : '你在邮件中附加了 $1 个附件，并且设置了 $2 Credits的货到付款(CoD)，注意！',
        '/You have attached ([\\d,]+) items?, but you have not set a CoD, kupo! The attachments will be a gift, kupo!/' : '你在邮件中附加了 $1 个附件，但是没有设置货到付款(CoD)，注意！你的附件将会被认为是礼物免费送出！',
        '/Sending it will cost you ([\\d,]+) credits, kupo!/' : '发送本邮件将会收取你 $1 Credits 的费用！注意！',
        '/Are you sure you wish to send this message, kupo\\?/' : '是否确认发送本邮件？',
        '/Are you sure you wish to discard this message, kupo\\?/' : '是否确认丢弃本邮件信息？注意！',
        '/Removing the attachments will deduct ([\\d,]+) Credits from your account, kupo! Are you sure\\?/' : '领取本邮件附件将会收取你 $1 Credits 货到付款(CoD)费用，是否确认？注意！',
        '/This will return the message to the sender, kupo! Are you sure\\?/' : '此操作将会把邮件退还给发件人，是否确认？注意！',

        //网页内嵌script里的
        '/Enter a new name for this persona\\./' : '请输入一个新的用户名（1~20字符，仅支持英文和数字）',
        '/Are you sure you wish to create a new persona with the same attribute, slot, equipment and ability assignments as "(.+)"\\? This action is irreversible, and created personas cannot be deleted\\./' : '是否确认创建一个和 $1 相同属性、套装、技能分配的人格角色？注意此操作不可撤销且创建的角色无法删除！',
        '/Are you sure you wish to create a blank persona\\? This action is irreversible, and created personas cannot be deleted\\./' : '是否确认创建一个未设置的全新人格角色？（你的等级经验和基础熟练、装备物品仓库等仍然和当前人格角色共享）请注意此操作无法撤销且创建的角色无法删除！',
        '/Reseting this ability will cost ([\\d,]+) soul fragments?\\. Proceed\\?/' : '重置该技能将消耗 $1 个灵魂碎片，是否执行？',
        '/Reseting this ability is free this time\\. Proceed\\?/' : '本次重置技能免费(总计达到10次之后将消耗灵魂碎片)，是否执行？',
        '/This will reset ALL mastery and ability point assignments at a cost of ([\\d,]+) soul fragments?\\. Proceed\\?/' : '此操作将重置所有技能点和已配置的支配点，本次重置将消耗 $1 个灵魂碎片。是否执行？',
        '/This will reset ALL mastery and ability point assignments\\. This time it is free\\. Proceed\\?/' : '此操作将重置所有技能点和已配置的支配点，本次重置免费(下一次全部重置将消耗灵魂碎片)。是否执行？',
        '/Enter a new name for this monster\\./' : '请输入怪物的新名称（3~30字符，仅支持英文和数字）',
        '/Are you sure you wish to delete the monster (.+)?\\? This action cannot be reversed\\./' : '是否确认删除怪物 $1 ？ 此操作无法撤销！',
        '/Are you sure you wish to opt out of the grand prize drawing on this lottery\\? This is not reversible\\./' : '是否确认放弃本次彩票的头奖？此操作无法撤销',
        '/Are you sure you wish to start this Arena Challenge\\?/' : '是否确认进入竞技场挑战？',
        '/Are you sure you wish to spend ([\\d,]+) tokens? to start this Arena Challenge\\?/' : '是否确认消耗 $1 个令牌进入战场？',
        '/Are you sure you wish to enter the Ring of Blood\\?/' : '是否确认进入浴血擂台挑战？',
        '/Are you sure you wish to spend ([\\d,]+) tokens? to enter the Ring of Blood\\?/' : '是否确认消耗 $1 个鲜血令牌进入浴血擂台挑战？',
        '/Enter a name for this equipment\\./' : '请输入装备名称（最大50个字符，仅支持字母和数字和非特殊字符)',

        //直接写在onclick里的
        '/Are you sure you want to reforge this item\\? This will remove all potencies and reset its level to zero\\./' : '是否确认重铸所选装备？此操作将会移除该装备所有的已解锁潜能并将潜能等级重置为0。',
        '/Are you sure you want to soulfuse this item\\? This will bind it to your level, but makes it untradeable\\./' : '是否确认灵魂绑定所选装备？该装备将会跟随你的等级成长并且变成不可交易。',
    },


    ///////////////////////////////////////////////////////
    // System Message弹窗, 所有页面的系统信息弹窗提示提示信息均需要放置在这一部分
    ///////////////////////////////////////////////////////
    messagebox: {
        'System Message' : '系统信息',
        'Account Suspended' : '账号被封禁',
        'Snowflake and the moogles are relaxing on the beach. Check back later.' : '雪花女神和莫古利正在海滩休息，请稍后再来',
        'Snowflake and the moogles are rebooting the universe. Check back later.' : '雪花女神和莫古利正在重启宇宙，请稍后再来',
        'Snowflake and the moogles are playing in the snow. Check back later.' : '雪花女神和莫古利正在玩雪，请稍后再来',
        'Snowflake and the moogles are pining for spring. Check back later.' : '雪花女神和莫古利渴望春天，请稍后再来',
        'Snowflake and the moogles are remaking the world. Check back later.' : '雪花女神和莫古利正在重做世界，请稍后再来',

        'No energy items available.' : '没有可用的能量恢复道具',
        'Name contains invalid characters.' : '名字中包含不支持字符(仅支持英文和数字)',
        '/Name must be between (\\d+) and (\\d+) characters\./' : '名字长度需要在$1至$2个字符之间',
        'Requested persona does not exist' : '所选人格角色不存在',
        'You cannot currently create more personas' : '你当前已经没有空余的角色槽可以创建新人格。',
        'Insufficient do-overs.' : '下调数值超过每日限制',
        'Insufficient EXP.' : '可分配属性点不足',

        'No such equipment' : '装备不存在',
        'Bonded with' : '已绑定',
        'Equipment is too high level to equip.' : '你无法穿戴比自己等级高的装备',
        'That item cannot be used as an offhand with that main weapon.' : '除了装备太刀时可以在副手装备脇差，否则在装备双手武器时不能在副手装备物品',
        'Cannot equip the same item in two slots.' : '不能把相同的装备同时穿戴在两个部位上',
        '/Equipment (\\d+) is currently equipped/' : '装备 $1 当前正在穿戴',
        'Cannot slot item - no free spaces.' : '无法携带物品 - 没有空余的物品槽。',
        'Can only slot consumables' : '你只能携带战斗消耗品',
        'Item is already slotted.' : '只能携带一种同名物品',
        'Slot only takes infusions.' : '所选物品槽只能装配魔药',
        'Slot only takes scrolls.' : '所选物品槽只能装配卷轴',
        'Insufficient items.' : '道具不足',

        'You cannot afford to train that.' : '你没有足够 Credits 训练指定项目',
        'You cannot start a new training at this time' : '你现在无法开始训练新项目',
        'You have already maxed that training.' : '该训练已经满级',
        'There is no such skill' : '所指定技能不存在',

        'Ability is already slotted' : '技能已装备',
        'No slot available that fits the given ability' : '没有合适的空槽位适合该技能',
        'The slot does not fit the given ability' : '所选技能不能装备在该槽位上',
        'That slot is already unlocked' : '所指定槽位已解锁',
        'No such slot' : '所指定槽位不存在',
        'Insufficient ability points' : '技能点不足',
        'Insufficient mastery points' : '支配点不足',
        'Ability cannot be increased further' : '技能已满级',
        'No such ability' : '你没有获得该技能',
        'Level requirements not met' : '你还没有到达解锁该技能要求的等级',

        'There are no items of that type available.' : '购买的物品库存不足',
        'Item has already been sold.' : '所选物品已售出',
        'Invalid item, or item cannot be auto-bought' : '所指定物品无效在或者不能自动购买',
        'Bid price must be at least' : '最低出价为',
        'Insufficient credits.' : 'Credits 不足',
        'No longer available' : '已不存在',
        'Items cannot be sold while locked.' : '无法出售已锁定装备',
        'Items cannot be sold while in use.' : '无法出售正在穿戴装备',
        'Your equipment inventory is full' : '你的装备库存已经满了！',
        'You do not have enough credits for that.' : '你没有足够的 Credits 来执行操作！',


        'Insufficent credits in market account' : '市场账户余额不足',
        'Insufficent credits in credit balance' : '个人账户余额不足',
        'Insufficient items available' : '你没有足够数量该物品可供出售',
        'You do not have a sufficient market balance to place that order' : '你没有足够的市场余额可供投放当前买单',
        'Bidding price must be at least' : '当前物品最低出价为',
        'Asking price must be at least' : '当前物品最低要价为',
        '/Your bid price must be at least (.+?) to overbid the current buy orders/' : '如果要加价超出目前最高买价你必须最少出价 $1',
        '/Your ask price must be at most (.+?) to undercut the current sell orders/' : '如果要减价低于目前最低卖价你必须开价不超过 $1',
        'You have to wait a short while between placing each order' : '你创建订单过于频繁，稍后再试',

        'There are no free slots left.' : '没有空余的怪物槽可以创建怪物。',
        'Name is too long (max 50 chars)' : '名字太长（最大50个字符，仅支持字母和数字和非特殊字符)',
        'Too many spaces' : '名字包含太多空格(包含下划线最多5个，不能连用)',
        'A monster with that name already exists.' : '已存在此名字怪物',
        'The name is bad and you should feel bad' : '这个名字不太好，你应该也是这么觉得的',
        'Monster cannot yet be named.' : '你现在无法为怪物取名',
        'Monster is not sufficiency high powerlevel' : '此怪物还没有达到能强化此能力的等级',
        'Monster can no longer be deleted.' : '此怪物已经无法删除',
        'Insufficient happy pills' : '快乐药丸不足',
        'Insufficient Happy Pills' : '快乐药丸不足',
        'Insufficient food' : '食物不足',
        'Insufficient Monster Chow' : '怪物饲料不足',
        'Insufficient Monster Edibles' : '怪物食品不足',
        'Insufficient Monster Cuisine' : '怪物料理不足',
        'Insufficient tokens' : '令牌不足',
        'Insufficient crystals' : '水晶不足',
        'At full morale' : '情绪已满',
        'At full hunger' : '饥饿度已满',
        'brought you a gift' : '送来了礼物',
        'brought you some gifts' : '送来了一些礼物',
        'Received some' : '获得了一些',
        'Received a' : '获得了',
        //收到的怪物礼物使用items字典

        'Insufficient items, kupo!' : '物品不足，咕波！',
        'Equipment not found, kupo!' : '装备不存在，咕波！',
        'Equipment cannot be attached, kupo!' : '无法附带该装备，咕波！',
        'Insufficient credits, kupo!' : 'Credits 不足，咕波！',
        'The mail moogle cannot carry more than 10 items at a time, kupo!' : '每封邮件最多只能添加10个附件，咕波！',
        'CoD must be at least 10 credits, kupo!' : '货到付款(CoD)至少需要设置 10 Credits，咕波！',
        'Insufficient hath, kupo!' : 'Hath 不足，咕波！',
        'No amount specified, kupo!' : '没有指定数量，咕波！',
        'That item cannot be attached, kupo!' : '所选物品无法邮寄，咕波！',
        'Mail does not exist, kupo!' : '邮件不存在，咕波！',
        'You need to be a donator to attach items, kupo!' : '你需要捐助e绅士才可以在异世界邮局添加附件，咕波！',
        'Cannot set CoD without attachments, kupo!' : '你必须至少附带一件附件才能设置货到付款(CoD)，咕波！',
        'You cannot afford the postage, kupo!' : '你负担不起邮资，咕波！(没有购买hath能力“邮资已付”时每发一封邮件10C手续费，且设置CoD时会有额外的费用)',
        'You must at minimum specify a recipient and subject, kupo!' : '你必须至少设定一个收件人和主题，咕波！',
        'You must at minimum specify a subject, kupo!' : '你必须至少填写主题，咕波！',
        'Invalid or missing recipient, kupo!' : '收件人不存在，咕波！',
        'You cannot read that, kupo!' : '你无法阅读该邮件，咕波！',
        'Messaging yourself must be the ultimate form of social withdrawal, kupo! Seek help, kupo!' : '给自己发邮件是社交退缩的终极形式，咕波！去找些别的乐子吧，咕波！',
        'Mail cannot be returned, kupo!' : '此邮件已无法退回，咕波！',
        'Message has no attachment, kupo!' : '此邮件没有附件，咕波！',
        'Received Paid CoD' : '收到CoD收货支付款',
        'was added to your balance.' : '已添加到你的余额。',

        'Invalid reward class' : '所选奖励类型不可用',
        'Invalid reward type' : '所选奖励类型不可用',
        'No such item' : '物品不存在',
        'You do not have enough of that trophy' : '你没有足够的奖杯执行此次献祭',
        'Snowflake has blessed you with some of her power!' : '雪花女神用她的力量祝福了你！',
        'Your strength' : '你的力量',
        'Your dexterity' : '你的灵巧',
        'Your agility' : '你的敏捷',
        'Your endurance' : '你的体质',
        'Your intelligence' : '你的智力',
        'Your wisdom' : '你的智慧',
        'was increased by' : '提升了',
        'Follower peerless granted!' : '获得雪花信徒的无双奖励！',
        'Snowflake has blessed you with an item!' : '雪花女神祝福了你！',
        'Received' : '获得了',
        'Acquired' : '获得了',
        'Sold it for' : '已自动出售获得',
        'Salvaged it for' : '已自动分解获得',
        'salvage remains' : '分解残骸',
        'Hit Space Bar to offer another item like this.' : '按空格键可以重复执行上一个相同的献祭',
        //献祭收到的装备使用equipsName字典

        'Cannot opt out without buying a ticket first' : '你必须至少购买一张彩票才能决定是否参与头奖争夺',
        'Too many tickets - may not have more than 20,000 tickets per drawing' : '购买数量超过上限 - 每期彩票你最多只能拥有2万张',
        'Must buy at least one ticket' : '最低起购数量1张',
        'No golden tickets to spend' : '你没有黄金彩票券可以使用',
        'Already opted out' : '已经决定过放弃头奖',
        'This lottery is closed' : '本期彩票售卖已结束',
        'Insufficient GP' : 'GP不足',

        'Invalid or expired token' : '令牌无效或者已过期',
        'You cannot enter the same arena twice in one day.' : '同一竞技场一天只能进入一次',
        'You cannot enter the Item World while exhausted.' : '你无法在精力耗竭时进入道具界',
        'You cannot start a Grindfest while exhausted.' : '你无法在精力耗竭时进入压榨界',
        'You cannot attempt The Tower again until tomorrow.' : '你今天的塔楼挑战/清通次数已达上限，明天再来吧。',
        'You do not have enough stamina to start a new Arena.' : '你没有足够的精力开始竞技场挑战',
        'You do not have enough stamina to enter this Item World.' : '你没有足够的精力进入道具界挑战',
        'You do not have enough stamina to start a new Grindfest.' : '你没有足够的精力开始压榨界挑战',
        'You do not have enough stamina to enter The Tower.' : '你没有足够的精力进入塔楼挑战',
        'Item is already max level' : '装备等级已满',
        'Cannot fight in equipped items' : '无法进入已装备道具的道具界中',

        'Cannot reforge level zero items' : '不能重铸潜能等级为0的装备',
        'Cannot reforge locked or equipped items' : '不能重铸上锁或者正在穿戴的装备',
        'Cannot salvage locked or equipped items' : '不能分解上锁或者正在穿戴的装备',
        'No base salvage could be extracted.' : '重复分解已经分解过的装备不再获得基础材料',
        'Insufficient materials.' : '材料不足',
        'Insufficient soul fragments.' : '灵魂碎片不足',
        'Insufficient amnesia shards.' : '重铸碎片不足',
        'Equipment Potency Unlocked!' : '解锁了装备潜能！',
        //强化装备解锁的潜能使用equipsInfo字典
        'Cannot upgrade item' : '无法升级',
        'Cannot enchant item' : '无法附魔',
        'Salvaged' : '分解获得',
        'Returned' : '返还强化材料',
        'Item not found' : '物品不存在',


    },

    ///////////////////////////////////////////////////////登陆界面
    login: {
        'You have to log on to access this game.' : '你必须登陆之后才能使用游戏功能',
        'No account? ' : '还没有帐号？',
        'Click here to create one' : '点击此处创建一个',
        '. (It\'s free!)' : ' (免费的)',
        'User:' : '用户:',
        'Pass:' : '密码:',
        'Login!' : '登陆!',
        '/^ or $/' : ' 或者 ',
        'Register' : '注册',
        'The HentaiVerse a free online game presented by ' : 'HentaiVerse是由E绅士呈现的一个免费在线游戏 ',
        'E-Hentai.org - The Free Hentai Gallery System' : 'E-Hentai.org - 免费的绅士画廊',
        'You must be logged on to visit the HentaiVerse.' : '你必须登陆之后才能访问HentaiVerse',
    },

    ///////////////////////////////////////////////////////主菜单导航栏
    //除了菜单项还包括难度等级和精力下方的一些红字提示。
    menu: {
        'Character' : '角色',
        '/^Equipment$/' : '装备',
        'Abilities' : '技能',
        'Training' : '训练',
        'Item Inventory' : '物品仓库',
        'Equip Inventory' : '装备仓库',
        'Settings' : '设置',
        'Equipment Shop' : '装备店',
        '/^Item Shop$/' : '道具店',
        'Item Shop Bot' : '采购机器人',
        'Item Backorder' : '采购机器人',
        'The Market' : '交易市场',
        'Monster Lab' : '怪物实验室',
        'The Shrine' : '雪花祭坛',
        'The Armory' : '武器库',
        'MoogleMail' : '莫古利邮局',
        'Weapon Lottery' : '武器彩票',
        'Armor Lottery' : '防具彩票',
        'The Arena' : '竞技场(The Arena)',
        'The Tower' : '塔楼(The Tower)',
        'Ring of Blood' : '浴血擂台(Ring of Blood)',
        'GrindFest' : '压榨界(GrindFest)',
        'Item World' : '道具界(Item World)',
        '/^Repair$/' : '装备修理',
        '/^Salvage$/' : '装备分解',
        '/^Reforge$/' : '装备重铸',
        '/^Soulfuse$/' : '装备魂绑',
        '/^Upgrade$/' : '装备强化',
        '/^Enchant$/' : '装备附魔',
        'Stamina:' : '精力:',
        'Check Attributes' : '检查属性点分配！',
        'Check Abilities' : '检查技能！',
        'Check attributes' : '检查属性点分配！',
        'Check abilities' : '检查技能！',
        'Check equipment' : '检查装备！',
        'Repair armor' : '护甲需要修理！',
        'Repair weapon' : '武器需要修理！',
        'Armor Damage' : '护甲已损坏！',
        'Weapon Damage' : '武器已损坏！',
        //'Next:' : '距离升级还差', //与HVUtils获取等级经验冲突

        '/^Isekai$/' : '异世界',
        'Currently playing on Isekai' : '你当前在异世界中',
        'Season' : '赛季',
        'Click to switch to Persistent' : '点击切换到永久区',
        '/^Persistent$/' : '永久区',
        'Currently playing on Persistent' : '你当前在永久区中',
        'Click to switch to Isekai' : '点击切换到异世界',

        'You have increased stamina drain due to low riddle accuracy' : '由于你的小马图回答正确率太低，你的精力消耗速率被提高了',
        'Great. You receive a 100% EXP Bonus but stamina drains 50% faster.' : '你现在精力充沛，额外获得100%经验加成，但精力消耗速度增加50%（每场战斗消耗0.03精力）',
        'Normal. You are not receiving any bonuses or penalties.' : '正常，你既不会受到额外的奖励也不会受到惩罚（每场战斗消耗0.02精力）',
        'Exhausted. You do not receive EXP or drops from monsters, and you cannot gain proficiencies.' : '你已经筋疲力尽，你将无法从怪物处获取任何经验、潜经验、掉落、以及熟练度，直到你的精力恢复到2以上',
        'You Got Mail' : '你有新邮件',
    },

    ///////////////////////////////////////////////////////难度名
    // 包括上方主菜单导航栏等多个地方用到，姑且独立出来做一块方便统一管理……吧
    difficulty: {
        'Normal' : '普通 ',
        'Hard' : '困难 ',
        'Nightmare' : '噩梦 ',
        'Hell' : '地狱 ',
        'Nintendo' : '任天堂 ',
        'IWBTH' : 'I Wanna ',
        'PFUDOR' : '彩虹小马 ',
    },

    ///////////////////////////////////////////////////////主界面和切换装备左侧栏
    character: {
        'Active persona' : '当前角色',
        'Used persona slots' : '已使用的角色槽',
        'Primary attributes' : '主属性',
        'Strength' : '力量',
        'Dexterity' : '灵巧',
        'Agility' : '敏捷',
        'Endurance' : '体质',
        'Intelligence' : '智力',
        'Wisdom' : '智慧',
        'Isekai bonus' : '异世界全属性加成',
        'Equipment proficiency' : '武器/装备熟练度',
        '/^One-handed$/' : '单手',
        '/^Two-handed$/' : '双手',
        '/^Dual-wielding$/' : '双持',
        'Dual wielding' : '双持',
        'Light armor' : '轻甲',
        'Cloth armor' : '布甲',
        'Heavy armor' : '重甲',
        'Magic proficiency' : '法杖/魔法熟练度',
        '/^Staff$/' : '法杖',
        '/^Elemental$/' : '元素魔法',
        '/^Divine$/' : '神圣魔法',
        '/^Forbidden$/' : '黑暗魔法',
        '/^Supportive$/' : '增益魔法',
        '/^Deprecating$/' : '减益魔法',
    ///////////////////////////////////////////////////////切换装备页面
        'Equipment Slots' : '套装栏',
        'Main Hand' : '主手',
        'Off Hand' : '副手',
        'Empty Slot' : '空槽位',
        'Empty' : '空',
        'Soulbound' : '灵魂绑定',
        'Unequip Current' : '卸下当前装备',
        'Equip Selected' : '选中装备',
    },

    ///////////////////////////////////////////////////////装备商店计数器文本（如：Selected 0 of 3 matching equipment available to sell）
    equipCounter: {
        '/Selected (\\d+) of (\\d+) matching equipment available to repair/' : '已选择 $1 / $2 件可修理装备',
        '/Selected (\\d+) of (\\d+) matching equipment available to organize/' : '已选择 $1 / $2 件可整理装备',
        '/Selected (\\d+) of (\\d+) matching equipment available to soulbind/' : '已选择 $1 / $2 件可魂绑装备',
        '/Selected (\\d+) of (\\d+) matching equipment available to purchase/' : '已选择 $1 / $2 件可购买装备',
        '/Selected (\\d+) of (\\d+) matching equipment available to sell/' : '已选择 $1 / $2 件可出售装备',
        '/Selected (\\d+) of (\\d+) matching equipment available to salvage/' : '已选择 $1 / $2 件可分解装备',
    },

    ///////////////////////////////////////////////////////主界面右侧的状态栏
    characterStatus: {
        'Statistics' : '状态栏',

        'Fighting Style' : '战斗风格',
        'Unarmed' : '空手',
        'crushing' : '打击',
        'piercing' : '刺击',
        'slashing' : '斩击',
        // 注意：'void'移到后面，避免影响'Avoidance'等词的翻译

        'One-Handed' : '单手',
        'Counter-Attack on block/parry' : '在格挡/招架时触发 反击',
        'Overwhelming Strikes on hit' : '在击中时触发 压制打击',
        'Two-Handed' : '双手',
        'Domino Strike on hit' : '在击中时触发 连锁攻击',
        'Dualwield' : '双持',
        'Offhand Strike on hit' : '在副手击中时触发 副手打击',
        'Staff' : '法杖',
        'Coalesced Mana on spell hit' : '在法术击中时触发 魔力合流',
        'Niten Ichiryu' : '二天一流',

        // 新版攻击属性
        'Mainhand Attack' : '主手攻击',
        'Offhand Attack' : '副手攻击',
        'Magic Attack' : '魔法攻击',

        // 攻击属性详细
        'Crushing Damage' : '打击伤害',
        'Piercing Damage' : '刺击伤害',
        'Slashing Damage' : '斩击伤害',
        'Void Damage' : '虚空伤害',
        'Accuracy' : '命中',
        'Crit Multiplier' : '暴击伤害',
        'Attack Speed Bonus' : '攻击速度加成',
        // 注意：'Damage Bonus'移到后面，避免影响'Spell Damage Bonus'等词的翻译
        'Mana Cost Modifier' : '魔力消耗修正',
        'Cast Speed Bonus' : '施法速度加成',

        // 旧版攻击属性（保留兼容性）
        'Physical Attack' : '物理攻击',
        'attack base damage' : '基础攻击力',
        'hit chance' : '命中率',
        'crit chance' : '暴击率',
        '% damage' : '% 暴击伤害量',
        'chance' : '几率',
        'attack speed bonus' : '攻击速度加成',

        'Magical Attack' : '魔法攻击',
        'magic base damage' : '基础魔法伤害',
        'mana cost modifier' : '魔力消耗修正',
        'cast speed bonus' : '施法速度加成',

        // 状态值
        'Vitals' : '状态值',
        'Base Health' : '基础生命值',
        'Base Mana' : '基础魔力值',
        'Base Spirit' : '基础灵力值',
        'Mana Regen' : '魔力恢复',
        'Spirit Regen' : '灵力恢复',
        // 旧版状态值（保留兼容性）
        'health points' : '生命值',
        'magic points' : '魔力值',
        'magic regen per tick' : '魔力恢复量',
        'spirit points' : '灵力值',
        'spirit regen per tick' : '灵力恢复量',

        // 新版回避属性
        'Avoidance' : '规避',
        'Evade' : '闪避',
        'Block' : '格挡',
        'Parry' : '招架',
        'Resist' : '抵抗',

        // 旧版防御属性（保留兼容性）
        'Defense' : '防御',
        'physical mitigation' : '物理减伤',
        'magical mitigation' : '魔法减伤',
        'evade chance' : '回避率',
        'block chance' : '格挡率',
        'parry chance' : '招架率',
        'resist chance' : '抵抗率',

        // 装备影响
        'Compromise' : '装备影响',
        'Interference' : '干涉',
        'Burden' : '负重',
        'interference' : '干涉',
        'burden' : '负重',

        // 新版伤害减免
        'Damage Mitigation' : '伤害减免',
        'Physical' : '物理',
        'Magical' : '魔法',
        'Fire' : '火焰',
        'Cold' : '冰冷',
        'Elec' : '闪电',
        'Wind' : '疾风',
        'Holy' : '神圣',
        'Dark' : '黑暗',
        'Crushing' : '打击',
        'Slashing' : '斩击',
        'Piercing' : '刺击',

        // 旧版属性减伤（保留兼容性）
        'Specific Mitigation' : '属性减伤',

        // 魔法伤害加成
        'Spell Damage Bonus' : '魔法伤害加成',
        '% fire' : '% 火焰',
        '% cold' : '% 冰冷',
        '% wind' : '% 疾风',
        '% elec' : '% 闪电',
        '% holy' : '% 神圣',
        '% dark' : '% 黑暗',
        '% void' : '% 虚空',

        // 通用词汇（放在具体词条之后以避免误匹配）
        'Damage Bonus' : '伤害加成',
        'void' : '虚空',

        // 有效主属性
        'Effective Primary Stats' : '有效主属性',
        'Strength' : '力量',
        'Dexterity' : '灵巧',
        'Agility' : '敏捷',
        'Endurance' : '体质',
        'Intelligence' : '智力',
        'Wisdom' : '智慧',
        'strength' : '力量',
        'dexterity' : '灵巧',
        'agility' : '敏捷',
        'endurance' : '体质',
        'intelligence' : '智力',
        'wisdom' : '智慧',

        // 有效熟练度
        'Effective Proficiency' : '有效熟练度',
        'One-handed' : '单手',
        'Two-handed' : '双手',
        'Dual-wielding' : '双持',
        'Staff' : '法杖',
        'Cloth Armor' : '布甲',
        'Light Armor' : '轻甲',
        'Heavy Armor' : '重甲',
        'Elemental' : '元素魔法',
        'Divine' : '神圣魔法',
        'Forbidden' : '黑暗魔法',
        'Deprecating' : '减益魔法',
        'Supportive' : '增益魔法',
        'one-handed' : '单手',
        'two-handed' : '双手',
        'dual wielding' : '双持',
        'staff' : '法杖',
        'cloth armor' : '布甲',
        'light armor' : '轻甲',
        'heavy armor' : '重甲',
        'elemental' : '元素魔法',
        'divine' : '神圣魔法',
        'forbidden' : '黑暗魔法',
        'deprecating' : '减益魔法',
        'supportive' : '增益魔法',
    },


    ///////////////////////////////////////////////////////训练
    trains: {
        'Training' : '训练名',
        'Effect' : '效果',
        'Credit Cost' : '训练花费',
        'Time' : '训练耗时',
        'Level' : '训练等级',

        'Adept Learner' : '善学者',
        'Assimilator' : '同化者',
        'Ability Boost' : '能力提升',
        'Manifest Destiny' : '天命昭显',
        'Scavenger' : '拾荒者',
        'Luck of the Draw' : '抽签运',
        'Quartermaster' : '军需官',
        'Archaeologist' : '考古学家',
        'Metabolism' : '新陈代谢',
        'Inspiration' : '鼓舞',
        'Scholar of War' : '战争学者',
        'Tincture' : '酊剂',
        'Pack Rat' : '囤积者',
        'Dissociation' : '解离症',
        'Set Collector' : '套装收集者',

        'EXP Bonus' : '经验值加成（与其他经验加成相互乘算）',
        'Proficiency Experience' : '熟练值获取比例（熟练度获取量取决于经验获取量的一定比例，每级使获取比例提高10%）',
        'Ability Point' : '技能点',
        'Mastery Point' : '支配点',
        'Improved Monster Hunger Drain' : '降低怪物饥饿速度（每一级推测为5%的效果）',
        'Improved Monster Morale Drain' : '降低怪物士气下降速度（每一级推测为5%的效果）',
        'Base Loot Drop Chance' : '物品掉落率（每级提升0.1%物品掉落率，基础为10%）',
        'Base Rare Equipment Chance' : '稀有装备掉落率（提升掉落装备中 相位/暗影/动力/立场 装备的获得几率，满级时几率变为原来的1.25倍）',
        'Base Equipment Drop Chance' : '装备掉落率（掉落物品中装备的概率为2.5%，每级提升0.05%的概率）',
        'Base Artifact Drop Chance' : '文物掉落率（掉落物品中文物的概率为0.2%，每级提升0.02%的概率）',
        'Battle Scroll Slots' : '卷轴栏',
        'Battle Infusion Slots' : '魔药栏',
        'Battle Inventory Slots' : '战斗携带品栏',
        'Persona Slot' : '人物角色栏',
        'Equipment Set' : '套装栏',
        '/1 H$/' : '1小时',
        '/2 H$/' : '2小时',
        '/4 H$/' : '4小时',
        '/8 H$/' : '8小时',
        '/12 H$/' : '12小时',
        '/24 H$/' : '24小时',
        '/0 H$/' : '10秒',


        'Here you can exchange your credits for Henjutsu 训练名 in various subjects.' : '在这里你可以消耗credit永久的提升你的各项能力',
        '训练名 happens in realtime, and you can only train one skill at a time.' : '训练耗时为现实时间（小时），一次只能训练一个项目，训练可以随时取消并获得退款',

        'Progress:' : '进度:',
        'You have gained another level in' : '你的训练提升了一级',
        'You have increased your EXP bonus by 1%!' : '你的经验值加成增加了1%！',
        'You now get proficiency gains 10% more often!' : '你的熟练度获取比例提升10%！',
        'You have received an additional' : '你获得了一点额外',
        'You now have a higher chance of finding items!' : '你现在有更高的几率获得物品掉落！',
        'You feel a little luckier!' : '你感觉自己更加幸运了一点！',
        'Equipment will now drop a little more often!' : '你的装备掉落率现在小幅提升！',
        'You now have a slightly larger chance of uncovering lost artifacts!' : '你发现遗失文物的几率现在有轻微的提升！',
        //缺：新陈代谢、鼓舞
        'Your battle scroll slots have been increased!' : '你的卷轴栏现在增加了一格！',
        'Your battle infusion slots have been increased!' : '你的魔药栏现在增加了一格！',
        'Your battle inventory space has been increased!' : '你的战斗携带品栏现在增加了一格！',
        //缺：解离症
        'You can now use an additional equipment set!' : '你现在可以多配置一套装备套装！',
    },

    ///////////////////////////////////////////////////////技能
    ability: {
        'Major Ability Slot' : '主要技能槽',
        'Supportive Ability Slot' : '辅助技能槽',
        'Protection Augment Ability Slot' : '“守护”扩充技能槽',
        'Drain Augment Ability Slot' : '“枯竭”扩充技能槽',
        'Click or drag an unlocked ability to fill slot.' : '点击或者拖曳一个已解锁技能到此处安装',
        'Unlock Cost:' : '解锁消耗',

        'Maxed' : '已满级',
        'Ability Points' : '技能点',
        'Mastery Points' : '支配点',
        'Mastery Point' : '支配点',
        'AP' : '技能点',
        'Cost:' : '消耗:',
        'HP Tank' : '生命值增幅',
        'MP Tank' : '魔力值增幅',
        'SP Tank' : '灵力值增幅',
        'Better Health Pots' : '生命药水效果加成',
        'Better Mana Pots' : '魔力药水效果加成',
        'Better Spirit Pots' : '灵力药水效果加成',
        '2H Damage' : '双手流伤害加成',
        '1H Damage' : '单手流伤害加成',
        'DW Damage' : '双持流伤害加成',
        'Light Acc' : '轻甲套命中率加成',
        'Light Crit' : '轻甲套暴击率加成',
        'Light Speed' : '轻甲套攻速加成',
        'Light HP/MP' : '轻甲套生命/魔力值加成',
        '1H Accuracy' : '单手流命中率加成',
        '1H Block' : '单手流格挡率加成',
        '2H Accuracy' : '双手流命中率加成',
        '2H Parry' : '双手流招架率加成',
        'DW Accuracy' : '双持流命中率加成',
        'DW Crit' : '双持流暴击加成',
        'Staff Spell Damage' : '法杖流魔法伤害加成',
        'Staff Accuracy' : '法杖流全域命中率加成',
        'Staff Damage' : '法杖流法杖攻击伤害加成',
        'Cloth Spellacc' : '布甲套法术命中率加成',
        'Cloth Spellcrit' : '布甲套法术暴击加成',
        'Cloth Castspeed' : '布甲套咏唱速度加成',
        'Cloth MP' : '布甲套魔力值加成',
        'Heavy Crush' : '重甲套打击减伤加成',
        'Heavy Prcg' : '重甲套刺击减伤加成',
        'Heavy Slsh' : '重甲套斩击减伤加成',
        'Heavy HP' : '重甲套生命值加成',
        'Better Weaken' : '强力虚弱',
        'Faster Weaken' : '快速虚弱',
        'Better Imperil' : '强力陷危',
        'Faster Imperil' : '快速陷危',
        'Better Blind' : '强力致盲',
        'Faster Blind' : '快速致盲',
        'Mind Control' : '精神控制',
        'Better Silence' : '强力沉默',
        'Better MagNet' : '强力魔磁网',
        'Better Immobilize' : '强力定身术',
        'Better Slow' : '强力缓慢',
        'Better Drain' : '强力枯竭',
        'Faster Drain' : '快速枯竭',
        '/^Ether Theft$/' : '魔力窃取',
        '/^Spirit Theft$/' : '灵力窃取',
        'Better Haste' : '强力急速',
        'Better Shadow Veil' : '强力影纱',
        'Better Absorb' : '强力吸收',
        'Stronger Spirit' : '强力灵能力',
        'Better Heartseeker' : '强力觅心者',
        'Better Arcane Focus' : '强力奥数集成',
        'Better Regen' : '强力细胞活化',
        'Better Cure' : '强力治疗',
        'Better Spark' : '强力生命火花',
        'Better Protection' : '强力守护',
        'Flame Spike Shield' : '烈焰刺盾',
        'Frost Spike Shield' : '冰霜刺盾',
        'Shock Spike Shield' : '闪电刺盾',
        'Storm Spike Shield' : '风暴刺盾',
        'Conflagration' : '火灾',
        'Cryomancy' : '寒灾',
        'Havoc' : '雷暴',
        '/^Tempest$/' : '风灾',
        'Sorcery' : '巫术',
        'Elementalism' : '自然崇拜者',
        'Archmage' : '大法师',
        'Better Corruption' : '强力腐败',
        'Better Disintegrate' : '强力瓦解',
        'Better Ragnarok' : '强力诸神黄昏',
        '/^Ripened Soul$/' : '成熟的灵魂',
        'Dark Imperil' : '黑暗陷危',
        'Better Smite' : '强力惩戒',
        'Better Banish' : '强力放逐',
        'Better Paradise' : '强力失乐园',
        '/^Soul Fire$/' : '焚烧的灵魂',
        'Holy Imperil' : '神圣陷危',
    },

    ///////////////////////////////////////////////////////技能说明
    abilityInfo: {
        'Current Tier' : '当前等级',
        'Next Tier' : '下一等级',
        'Not Acquired' : '未获得',
        'At Maximum' : '已满',

        //基础技能
        'Increases your maximum ' : '增加你的最大',
        'This adds' : '每一级增加',
        'to your total' : '你的总',
        ' per tier' : '',
        '/^Requires /' : '需要 ',
        'Level' : '等级',
        'Direct Player Stat Modification' : '直接改变玩家的属性加成',
        'Items Modified' : '道具性能变化',
        //影响的恢复剂使用items字典
        'Effect Over Time' : '持续效果',
        'Restores ' : '每隔一段时间恢复',
        ' per tick' : '',
        'Maximum Health' : '最大生命',
        'Maximum Magic' : '最大魔力',
        'Maximum Spirit' : '最大灵力',
        '/Base Health$/' : '基础生命',
        'Base Magic' : '基础魔力',
        'Base Spirit' : '基础灵力',
        'Improves the overall potency of common' : '增加',
        'health restoratives.' : '各类生命药水的药效',
        'mana restoratives.' : '各类魔力药水的药效',
        'spirit restoratives.' : '各类灵力药水的药效',
        'When Used' : '使用时',
        'Instantly restores ' : '立即恢复',

        //武器和装备技能
        'Increases your damage' : '增加你的攻击伤害，',
        'Increases your spell damage' : '增加你的魔法伤害，',
        'Increases your critical chance' : '增加你的攻击暴击率，',
        'Increases your critical damage' : '增加你的暴击伤害，',
        'Increases your accuracy' : '增加你的攻击命中率，',
        'Increases your spell accuracy' : '增加你的法术命中率，',
        'Increases your attack and magic accuracy' : '增加你的攻击和法术命中率，',
        'Increases your block' : '增加你的格挡率，',
        'Increases your parry and block' : '增加你的招架与格挡，',
        'Increases your attack accuracy' : '增加你的攻击命中率，',
        'Increases your spell critical chance' : '增加你的法术暴击率，',
        'Increases your attack speed' : '增加你的攻击速度，',
        'Increases your attack crit chance' : '增加你的攻击暴击率，',
        'Increases your spell casting speed' : '增加你的施法速度，',
        'Increases your crushing mitigation' : '增加你的打击减伤，',
        'Increases your piercing mitigation' : '增加你的刺击减伤，',
        'Increases your slashing mitigation' : '增加你的斩击减伤，',
        ' when using only ' : '当你穿戴全套 ',
        ' when using the ' : '当你使用 ',
        'cloth armor, ':'布甲 时，',
        'light armor, ':'轻甲 时，',
        'heavy armor, ':'重甲 时，',
        'fighting style' : '战斗风格时',
        'scaling with your proficiency.' : '加成量与你的熟练度成正比。',
        'Proficiency-based Stat Modification' : '根据熟练度改变加成值',
        'For every ten points of' : '每10点',
        'One-Handed' : '单手',
        'Two-Handed' : '双手',
        'Niten' : '二天一流',
        'Dual-Wielding' : '双持',
        'Dual-wielding' : '双持',
        ' Staff ' : ' 法杖 ',
        ' Weapon' : '',
        'Cloth Armor':'布甲',
        'Light Armor':'轻甲',
        'Heavy Armor':'重甲',

        'Proficiency, adds' : '熟练度 获得',
        'Attack Base Damage' : '基础攻击伤害',
        'Magic Base Damage' : '基础魔法伤害',
        'Attack Crit Chance' : '攻击暴击率',
        'Attack Accuracy' : '攻击命中率',
        'Attack Speed' : '攻击速度',
        'Magic Cast Speed' : '施法速度',
        'Magic Accuracy' : '魔法命中率',
        'Magic Crit Chance' : '魔法暴击率',
        'Magic Crit Damage' : '魔法暴击伤害',
        'Counter-Resist' : '反抵抗率',
        'Counter-resist' : '反抵抗率',
        'Block Chance' : '格挡率',
        'Parry Chance' : '招架率',

        'Crushing Damage Mitigation':'打击减伤',
        'Piercing Damage Mitigation':'刺击减伤',
        'Slashing Damage Mitigation':'斩击减伤',
        'Physical Mitigation' : '物理减伤',
        'Magical Mitigation' : '魔法减伤',

        'Spells Modified' : '咒语效果变化',
        'Effects Modified' : '效果变化',

        //技能影响的咒语名称使用skills字典内容，但是因为技能名做了全词匹配，同时影响多个技能名的在这里单独写字典
        'Sleep, Confuse' : '沉睡,混乱',
        'Fiery Blast, Freeze, Shockblast, Gale' : '炎爆术(Ⅰ),冰冻(Ⅰ),电能爆破(Ⅰ),烈风(Ⅰ)',
        'Inferno, Blizzard, Chained Lightning, Downburst' : '地狱火(Ⅱ),暴风雪(Ⅱ),连锁闪电(Ⅱ),下击暴流(Ⅱ)',
        'Flames of Loki, Fimbulvetr, Wrath of Thor, Storms of Njord' : '邪神之火(Ⅲ),芬布尔之冬(Ⅲ),雷神之怒(Ⅲ),尼奥尔德风暴(Ⅲ)',

        //影响的技能效果，大部分和skills名称相同，部分有差异在这里单独写
        '/^Hastened$/' : '急速',
        '/^Absorbing Ward$/' : '吸收结界',
        '/^Slowed$/' : '缓慢',
        '/^Weakened$/' : '虚弱',
        '/^Imperiled$/' : '陷危',
        '/^Blinded$/' : '盲目',
        '/^Asleep$/' : '沉眠',
        '/^Confused$/' : '混乱',
        '/^Silenced$/' : '沉默',
        '/^Magically Snared$/' : '魔磁网',
        '/^Immobilized$/' : '定身术',

        '/^Vital Theft$/' : '生命窃取',

        //DEBUFF技能
        'Increases the duration and damage decrease granted by Weaken' : '增加 虚弱 法术的持续时间和伤害弱化效果.',
        'Increases Damage Decrease to ' : '伤害弱化效果提高到 ',
        'Decreases the casttime and cooldown of weaken. Higher levels also increase the number of targets affected per cast' : '缩短“虚弱”的施放时间和冷却时间。高等级也增加每次施放影响的目标数。',
        'Changes cooldown to' : '改变冷却时间至',
        'Shadow Veil Trigger Chance' : '暗影面纱触发几率',
        'Natural Evade Modifier' : '自然闪避修正',
        'Attack Crit Multiplier' : '攻击暴击倍率',

        ' turns' : ' 回合',
        'Changes max affected targets to' : '改变受影响的最大目标数至',
        'Changes cast time to' : '改变施法时间至',
        'Changes base mana cost to' : '改变基础魔力消耗至',
        'Changes effect duration to' : '改变效果持续时间至',
        'Increases the duration and defensive penalties caused by Imperil.' : '增加“陷危”的持续时间和降防效果。',
        'Decreases the casttime and cooldown of Imperil. Higher levels also increase the number of targets affected per cast.' : '缩短“陷危”的施放时间和冷却时间。高等级也增加每次施放影响的目标数。',
        'Increase the duration and hit penalty caused by the Blind spell.' : '增加“致盲”的持续时间和命中率低下效果。',
        'Decreases the cooldown and casttime on the Blind spell. Higher levels also increase the number of targets affected per cast.' : '缩短“致盲”咒语的冷却时间和施放时间。高等级也增加每次施放影响的目标数。',
        'Increase the duration and decrease the chance that Sleep and Confuse will break upon taking damage. Higher levels also increase the number of targets affected per cast.' : '增加“沉眠”和“混乱”的持续时间并且降低受到伤害后解除状态的机率。高等级也增加每次施放影响的目标数。',
        'Increase the duration and decrease the cooldown of the Silence spell. Higher levels also increase the number of targets affected per cast.' : '增加“沉默”咒语的持续时间并缩短冷却时间。高等级也增加每次施放影响的目标数。	',
        'Increase the duration of the MagNet spell, and add a slowing effect. Higher levels increase the number of targets affected per cast, and reduces the cooldown of the spell.' : '增加“魔磁网”咒语的持续时间并且附加缓慢效果。高等级增加每次施放影响的目标数，也缩短咒语的冷却时间。',
        'Increase the duration of the Immobilize spell, and add a slowing effect. Higher levels increase the number of targets affected per cast, and reduces the cooldown of the spell.' : '增加定身术的持续时间，并附加减速效果。更高等级可提升每次施法影响的目标数量，并减少该法术的冷却时间。' ,
        'Increase the duration and power of the Slow spell. Higher levels also increase the number of targets affected per cast.' : '增加“缓慢”咒语的持续时间与效果。高等级也增加每次施放影响的目标数。	',
        'Increases the amount of health drained by the Drain spell.' : '增加“枯竭”咒语的生命汲取量。	',
        'Decreases the cooldown and cast time on the Drain spell.' : '缩短“枯竭”的冷却时间并增加施放速度。	',
        'Augment the Drain spell with the ability to inflict Ether Theft on any target afflicted with Soul Fire.' : '此技能扩充“枯竭”咒语的能力，可对任何受焚烧的灵魂(圣特殊效果)折磨的目标施加魔力吸窃效果。',
        'Augment the Drain spell with the ability to inflict Spirit Theft on any target afflicted with Ripened Soul.' : '此技能扩充“枯竭”咒语的能力，可对任何受鲜美的灵魂(暗特殊效果)折磨的目标施加灵力吸窃效果。',
        'Action Speed Modification' : '行动速度修正',
        'Natural Resist Modifier' : '自然抗性修正 ' ,

        'Added special effect: Ether Theft' : '附加特殊效果：魔力窃取',
        'Added special effect: Spirit Theft' : '附加特殊效果：灵力窃取',
        'Followup' : '追加',
        'Multiplies HP Drain by ' : '生命汲取倍率',
        'Increases Confuse Break Resistance to' : '增加混乱脱离抗性至',
        'Increases Sleep Break Resistance to' : '增加沉眠脱离抗性至',

        //BUFF技能
        'Increases the action speed-up granted by the Haste spell.' : '增加“急速”咒语给予的行动速度加成。',
        'Increases the evade bonus granted by the Shadow Veil spell.' : '增加“影纱”咒语给予的回避率奖励。',
        'Increases the chance that Absorb will successfully nullify a hostile spell.' : '增加“吸收”咒语的发动率。',
        'Decreases the amount of damage required to make Spirit Shield kick in, as well as how much spirit is consumed when it does.' : '降低触发“灵力盾”所需的伤害量，同时也减少灵力值的损失。',
        'Heartseeker will additionally increase the damage of any critical melee hits.' : '“觅心者”咒语现在也增加你的近战暴击伤害。',
        'Heartseeker will further increase the damage of any critical melee hits.' : '“觅心者”咒语会进一步的增加你的近战暴击伤害。',
        'Arcane Focus will additionally increase the damage of any critical spell hits.' : '“奥术集中”咒语现在也增加你的法术暴击伤害。	',
        'Increase the power and duration of the Regen spell.' : '增加“细胞活化”咒语的效果和持续回合数。	',
        'Increase the healing power and decrease the cooldown of the Cure spell.' : '增加“治疗术”咒语的治疗效果和缩短冷却时间。	',
        'Increase the duration and decrease the mana cost of the Spark of Life spell.' : '增加“生命火花”咒语的持续回合数并且减少施放所需的魔力值。	',
        'Increases the mitigation bonuses granted by the Protect spell.' : '增加“守护”咒语给予的减伤加成。	',
        'Augments your Protection spell by adding fire elemental spikes. Additional levels increase your fire elemental resistance while the spell is active.' : '扩充你的“守护”咒语能力，使它附加火元素刺盾。后续等级会在此咒语作用时增加你的火焰抗性。',
        'Augments your Protection spell by adding cold elemental spikes. Additional levels increase your cold elemental resistance while the spell is active.' : '扩充你的“守护”咒语能力，使它附加冰元素刺盾。后续等级会在此咒语作用时增加你的冰冷抗性。',
        'Augments your Protection spell by adding elec elemental spikes. Additional levels increase your elec elemental resistance while the spell is active.' : '扩充你的“守护”咒语能力，使它附加雷元素刺盾。后续等级会在此咒语作用时增加你的闪电抗性。',
        'Augments your Protection spell by adding wind elemental spikes. Additional levels increase your wind elemental resistance while the spell is active.' : '扩充你的“守护”咒语能力，使它附加风元素刺盾。后续等级会在此咒语作用时增加你的疾风抗性。',

        'Additional Effect' : '额外效果',
        'Increases Absorption Chance to' : '增加触发率至 ',
        'Reduces Damage Threshold to ' : '降低伤害门槛至 ',
        'Spell Critical Damage' : '魔法暴击伤害',
        'Attack Critical Damage' : '攻击暴击伤害',
        'Changes base damage to' : '改变基础伤害至 ',
        'Base Health Regen' : '的基础生命回复/每回合',
        'Evade' : '闪避率',

        'Flame Spikes' : '烈焰刺盾(使怪物-10%伤害/-25%冰冷抗性)',
        'Frost Spikes' : '冰霜刺盾(使怪物-10%行动速度/-25%疾风抗性)',
        'Shock Spikes' : '闪电刺盾(使怪物-10%回避/抵抗率/-25%火焰抗性)',
        'Storm Spikes' : '风暴刺盾(使怪物-10%命中率/-25%闪电抗性)',
        'Fire Mitigation' : '火焰抗性',
        'Cold Mitigation' : '冰霜抗性',
        'Elec Mitigation' : '闪电抗性',
        'Wind Mitigation' : '疾风抗性',
        'Fire/Cold/Elec' : '火焰/冰霜/闪电',

        //攻击技能
        'Increases the maximum number of targets hit by' : '增加',
        'fire elemental spells.' : '火系元素咒语的最大目标数',
        'cold elemental spells.' : '冰系元素咒语的最大目标数',
        'lightning elemental spells.' : '雷系元素咒语的最大目标数',
        'wind elemental spells.' : '风系元素咒语的最大目标数',
        'Increases damage and decreases cast time of all first-tier elemental spells.' : '对所有第一级元素咒语增加伤害、缩短施放时间。',
        'Increases damage, and decreases cast time and cooldown of all second-tier elemental spells.' : '对所有第二级元素咒语增加伤害、缩短施放时间和冷却时间。	',
        'Increases damage, and decreases cast time and cooldown of all third-tier elemental spells.' : '对所有第三级元素咒语增加伤害、缩短施放时间和冷却时间。	',

        'Decreases cooldown and increases the maximum number of targets hit by the Corruption spell.' : '缩短冷却时间并且增加“腐败”咒语的最大目标命中数。	',
        'Decreases cooldown and increases the maximum number of targets hit by the Disintegrate spell.' : '缩短冷却时间并且增加“瓦解”咒语的最大目标命中数。	',
        'Decreases cooldown and increases the maximum number of targets hit by the Ragnarok spell.' : '缩短冷却时间并且增加“诸神黄昏”咒语的最大目标命中数。	',
        'Augments your forbidden spells with the Ripened Soul proc, which damages the target over time and enables certain follow-up attacks. Higher levels increase the chance of the proc occurring.' : '扩充你的黑暗咒语能力，附加鲜美的灵魂状态，给予持续伤害且能对目标使用某些后续攻击。高等级增加状态触发率。',
        'Added effect: Ripened Soul' : '附加效果：鲜美的灵魂',
        'Chance)' : '几率)',
        'Imperil additionally reduces specific mitigation against Dark.' : '让“陷危”咒语附加降低黑暗抗性的能力。	',
        'Dark Mitigation':'黑暗减伤',

        'Decreases cooldown and increases the maximum number of targets hit by the Smite holy spell.' : '缩短冷却时间并且增加“惩戒”咒语的最大目标命中数。	',
        'Decreases cooldown and increases the maximum number of targets hit by the Banishment holy spell.' : '缩短冷却时间并且增加“放逐”咒语的最大目标命中数。	',
        'Decreases cooldown and increases the maximum number of targets hit by the Paradise Lost holy spell.' : '缩短冷却时间并且增加“失乐园”咒语的最大目标命中数。	',
        'Augments your divine spells with the Soul Fire proc, which damages the target over time and enables certain follow-up attacks. Higher levels increase the chance of the proc occurring.' : '扩充你的神圣咒语能力，附加焚烧的灵魂状态，给予持续伤害且能对目标使用某些后续攻击。高等级增加状态触发率。',
        'Added effect: Soul Fire' : '附加效果：焚烧的灵魂',
        'Imperil additionally reduces specific mitigation against Holy.' : '让“陷危”咒语附加降低神圣抗性的能力。	',
        'Holy Mitigation':'神圣减伤',

        //词缀处理
        ' and ' : ' 和 ',
        ' or ' : ' 或者 ',
        ' of ' : ' ',

    },

    ///////////////////////////////////////////////////////技能技巧
    //为防止错误匹配全部使用正则全词匹配
    skills: {
        '/^Flee$/' : '逃跑',
        '/^Scan$/' : '扫描',

        '/^FUS RO DAH$/' : '龙吼',
        '/^Orbital Friendship Cannon$/' : '友谊小马炮',
        '/^Concussive Strike$/' : '震荡打击',
        '/^Skyward Sword$/' : '天空之剑',
        '/^Frenzied Blows$/' : '狂乱百裂斩',
        '/^Iris Strike$/' : '虹膜打击',
        '/^Backstab$/' : '背刺',
        '/^Shatter Strike$/' : '粉碎打击',
        '/^Rending Blow$/' : '撕裂打击',
        '/^Great Cleave$/' : '大劈砍',
        '/^Merciful Blow$/' : '最后的慈悲',
        '/^Shield Bash$/' : '盾击',
        '/^Vital Strike$/' : '致命打击',

        '/^Fiery Blast$/' : '炎爆术(Ⅰ)',
        '/^Inferno$/' : '地狱火(Ⅱ)',
        '/^Flames of Loki$/' : '邪神之火(Ⅲ)',
        '/^Freeze$/' : '冰冻(Ⅰ)',
        '/^Blizzard$/' : '暴风雪(Ⅱ)',
        '/^Fimbulvetr$/' : '芬布尔之冬(Ⅲ)',
        '/^Shockblast$/' : '电能爆破(Ⅰ)',
        '/^Chained Lightning$/' : '连锁闪电(Ⅱ)',
        '/^Wrath of Thor$/' : '雷神之怒(Ⅲ)',
        '/^Gale$/' : '烈风(Ⅰ)',
        '/^Downburst$/' : '下击暴流(Ⅱ)',
        '/^Storms of Njord$/' : '尼奥尔德风暴(Ⅲ)',
        '/^Smite$/' : '惩戒(Ⅰ)',
        '/^Banishment$/' : '放逐(Ⅱ)',
        '/^Paradise Lost$/' : '失乐园(Ⅲ)',
        '/^Corruption$/' : '腐化(Ⅰ)',
        '/^Disintegrate$/' : '瓦解(Ⅱ)',
        '/^Ragnarok$/' : '诸神黄昏(Ⅲ)',

        '/^Drain$/' : '枯竭[D]',
        '/^Slow$/' : '缓慢[D]',
        '/^Weaken$/' : '虚弱[D]',
        '/^Silence$/' : '沉默[D]',
        '/^Sleep$/' : '沉眠[D]',
        '/^Confuse$/' : '混乱[D]',
        '/^Imperil$/' : '陷危[D]',
        '/^Blind$/' : '致盲[D]',
        '/^MagNet$/' : '魔磁网[D]',
        '/^Immobilize$/' : '定身术[D]',

        '/^Cure$/' : '治疗术[S]',
        '/^Regen$/' : '细胞活化[S]',
        '/^Full-Cure$/' : '完全治疗术[S]',
        '/^Haste$/' : '急速[S]',
        '/^Protection$/' : '守护[S]',
        '/^Shadow Veil$/' : '影纱[S]',
        '/^Absorb$/' : '吸收[S]',
        '/^Spark of Life$/' : '生命火花[S]',
        '/^Arcane Focus$/' : '奥术集中[S]',
        '/^Heartseeker$/' : '觅心者[S]',
        '/^Spirit Shield$/' : '灵力盾[S]',
    },


    ///////////////////////////////////////////////////////物品筛选栏/装备筛选栏
    filters: {
        //物品类型
        '/^All$/' : '全部',
        '/^Restoratives$/' : '回复品',
        '/^Infusions$/' : '魔药',
        '/^Scrolls$/' : '卷轴',
        '/^Crystals$/' : '水晶',
        '/^Materials$/' : '材料',
        '/^Special$/' : '特殊',

        //装备类型
        '/^Equipped$/' : '装备中',
        '/^New$/' : '新装备',
        '/^One-Handed$/' : '单手武器',
        '/^Two-Handed$/' : '双手武器',
        '/^Staffs$/' : '法杖',
        '/^Shield$/' : '盾牌',
        '/^Cloth$/' : '布甲',
        '/^Light$/' : '轻甲',
        '/^Heavy$/' : '重甲',
        '/^Salvaged$/' : '已分解',

    },


    ///////////////////////////////////////////////////////物品
    //出于整洁和效率考虑，普通物品列表不包含文物奖杯
    items: {
        'Item Inventory' : '物品仓库',
        'Battle Slots' : '战斗携带品',
        'Your Inventory' : '你的物品',
        'Store Inventory' : '商店物品',
        'Total Salvage:' : '分解总计：',

        'Health Potion' : '生命药水',
        'Health Draught' : '生命长效药',
        'Health Elixir' : '生命秘药',
        'Mana Potion' : '法力药水',
        'Mana Draught' : '法力长效药',
        'Mana Elixir' : '法力秘药',
        'Spirit Potion' : '灵力药水',
        'Spirit Draught' : '灵力长效药',
        'Spirit Elixir' : '灵力秘药',
        'Last Elixir' : '终极秘药',
        'Energy Drink' : '能量饮料',
        'Caffeinated Candy' : '咖啡因糖果',
        'Soul Stone' : '灵魂石',
        'Flower Vase' : '花瓶',
        'Bubble-Gum' : '泡泡糖',

        'Infusion of Darkness' : '黑暗魔药',
        'Infusion of Divinity' : '神圣魔药',
        'Infusion of Storms' : '风暴魔药',
        'Infusion of Lightning' : '闪电魔药',
        'Infusion of Frost' : '冰冷魔药',
        'Infusion of Flames' : '火焰魔药',
        'Infusion of Gaia' : '盖亚魔药',
        'Scroll of Swiftness' : '加速卷轴',
        'Scroll of the Avatar' : '化身卷轴',
        'Scroll of Shadows' : '幻影卷轴',
        'Scroll of Absorption' : '吸收卷轴',
        'Scroll of Life' : '生命卷轴',
        'Scroll of Protection' : '保护卷轴',
        'Scroll of the Gods' : '神之卷轴',

        'Crystal of Vigor' : '力量水晶',
        'Crystal of Finesse' : '灵巧水晶',
        'Crystal of Swiftness' : '敏捷水晶',
        'Crystal of Fortitude' : '体质水晶',
        'Crystal of Cunning' : '智力水晶',
        'Crystal of Knowledge' : '智慧水晶',
        'Crystal of Flames' : '火焰水晶',
        'Crystal of Frost' : '冰冻水晶',
        'Crystal of Lightning' : '闪电水晶',
        'Crystal of Tempest' : '疾风水晶',
        'Crystal of Devotion' : '神圣水晶',
        'Crystal of Corruption' : '暗黑水晶',
        'Crystal of Quintessence' : '灵魂水晶',

        'Monster Chow' : '怪物饲料',
        'Monster Edibles' : '怪物食品',
        'Monster Cuisine' : '怪物料理',
        'Happy Pills' : '快乐药丸',

        'Golden Lottery Ticket' : '黄金彩票券',
        'Token of Blood' : '鲜血令牌',
        'Chaos Token' : '混沌令牌',
        'Soul Fragment' : '灵魂碎片',

        'Binding of Slaughter':  '粘合剂 基础攻击伤害',
        'Binding of Balance':  '粘合剂 物理命中率',
        'Binding of Isaac':  '粘合剂 物理暴击率',
        'Binding of Destruction':  '粘合剂 基础魔法伤害',
        'Binding of Focus':  '粘合剂 魔法命中率',
        'Binding of Friendship':  '粘合剂 魔法暴击率',
        'Binding of Protection':  '粘合剂 物理减伤',
        'Binding of Warding':  '粘合剂 魔法减伤',
        'Binding of the Fleet':  '粘合剂 回避率',
        'Binding of the Barrier':  '粘合剂 格挡率',
        'Binding of the Nimble':  '粘合剂 招架率',
        'Binding of Negation':  '粘合剂 抵抗率',
        'Binding of the Ox':  '粘合剂 力量',
        'Binding of the Raccoon':  '粘合剂 灵巧',
        'Binding of the Cheetah':  '粘合剂 敏捷',
        'Binding of the Turtle':  '粘合剂 体质',
        'Binding of the Fox':  '粘合剂 智力',
        'Binding of the Owl':  '粘合剂 智慧',
        'Binding of the Elementalist':  '粘合剂 元素魔法熟练度',
        'Binding of the Heaven-sent':  '粘合剂 神圣魔法熟练度',
        'Binding of the Demon-fiend':  '粘合剂 黑暗魔法熟练度',
        'Binding of the Curse-weaver':  '粘合剂 减益魔法熟练度',
        'Binding of the Earth-walker':  '粘合剂 增益魔法熟练度',
        'Binding of Surtr':  '粘合剂 火焰魔法伤害',
        'Binding of Niflheim':  '粘合剂 冰冷魔法伤害',
        'Binding of Mjolnir':  '粘合剂 闪电魔法伤害',
        'Binding of Freyr':  '粘合剂 疾风魔法伤害',
        'Binding of Heimdall':  '粘合剂 神圣魔法伤害',
        'Binding of Fenrir':  '粘合剂 黑暗魔法伤害',
        'Binding of Dampening':  '粘合剂 打击减伤',
        'Binding of Stoneskin':  '粘合剂 斩击减伤',
        'Binding of Deflection':  '粘合剂 刺击减伤',
        'Binding of the Fire-eater':  '粘合剂 火焰减伤',
        'Binding of the Frost-born':  '粘合剂 冰冷减伤',
        'Binding of the Thunder-child':  '粘合剂 闪电减伤',
        'Binding of the Wind-waker':  '粘合剂 疾风减伤',
        'Binding of the Thrice-blessed':  '粘合剂 神圣减伤',
        'Binding of the Spirit-ward':  '粘合剂 黑暗减伤',

        'Wispy Catalyst' : '纤细 催化剂',
        'Diluted Catalyst' : '稀释 催化剂',
        'Regular Catalyst' : '平凡 催化剂',
        'Robust Catalyst' : '稳健 催化剂',
        'Vibrant Catalyst' : '活力 催化剂',
        'Coruscating Catalyst' : '闪耀 催化剂',

        'Low-Grade Cloth': '低级布料',
        'Mid-Grade Cloth': '中级布料',
        'High-Grade Cloth': '高级布料',
        'Low-Grade Leather': '低级皮革',
        'Mid-Grade Leather': '中级皮革',
        'High-Grade Leather': '高级皮革',
        'Low-Grade Metals': '低级金属',
        'Mid-Grade Metals': '中级金属',
        'High-Grade Metals': '高级金属',
        'Low-Grade Wood': '低级木材',
        'Mid-Grade Wood': '中级木材',
        'High-Grade Wood': '高级木材',
        'Scrap Metal' : '金属废料',
        'Scrap Leather' : '皮革废料',
        'Scrap Wood' : '木材废料',
        'Scrap Cloth' : '废布料',
        'Energy Cell' : '能量元',
        'Defense Matrix Modulator' : '力场碎片(盾)',
        'Repurposed Actuator' : '动力碎片(重)',
        'Shade Fragment' : '暗影碎片(轻)',
        'Crystallized Phazon' : '相位碎片(布)',

        'Legendary Weapon Core' : '传奇武器核心',
        'Peerless Weapon Core' : '无双武器核心',
        'Legendary Staff Core' : '传奇法杖核心',
        'Peerless Staff Core' : '无双法杖核心',
        'Legendary Armor Core' : '传奇护甲核心',
        'Peerless Armor Core' : '无双护甲核心',

        'Voidseeker Shard' : '虚空碎片',
        'Featherweight Shard' : '羽毛碎片',
        'Aether Shard' : '以太碎片',
        'Amnesia Shard' : '重铸碎片',

        // 护符袋
        'Silk Charm Pouch' : '丝绸护符袋',
        'Kevlar Charm Pouch' : '凯夫拉护符袋',
        'Mithril Charm Pouch' : '秘银护符袋',

        // 护符 - 物理攻击类
        'Lesser Featherweight Charm' : '次级 轻如鸿毛护符',
        'Greater Featherweight Charm' : '高级 轻如鸿毛护符',
        'Lesser Butcher Charm' : '次级 屠夫护符',
        'Greater Butcher Charm' : '高级 屠夫护符',
        'Lesser Swiftness Charm' : '次级 迅捷护符',
        'Greater Swiftness Charm' : '高级 迅捷护符',
        'Lesser Fatality Charm' : '次级 致命护符',
        'Greater Fatality Charm' : '高级 致命护符',
        'Lesser Overpower Charm' : '次级 压制护符',
        'Greater Overpower Charm' : '高级 压制护符',
        'Lesser Voidseeker Charm' : '次级 虚空护符',
        'Greater Voidseeker Charm' : '高级 虚空护符',

        // 护符 - 元素打击类
        'Lesser Fire Strike Charm' : '次级 火焰打击护符',
        'Greater Fire Strike Charm' : '高级 火焰打击护符',
        'Lesser Cold Strike Charm' : '次级 冰霜打击护符',
        'Greater Cold Strike Charm' : '高级 冰霜打击护符',
        'Lesser Lightning Strike Charm' : '次级 闪电打击护符',
        'Greater Lightning Strike Charm' : '高级 闪电打击护符',
        'Lesser Wind Strike Charm' : '次级 疾风打击护符',
        'Greater Wind Strike Charm' : '高级 疾风打击护符',
        'Lesser Holy Strike Charm' : '次级 神圣打击护符',
        'Greater Holy Strike Charm' : '高级 神圣打击护符',
        'Lesser Dark Strike Charm' : '次级 黑暗打击护符',
        'Greater Dark Strike Charm' : '高级 黑暗打击护符',

        // 护符 - 法术类
        'Lesser Archmage Charm' : '次级 大法师护符',
        'Greater Archmage Charm' : '高级 大法师护符',
        'Lesser Economizer Charm' : '次级 节约者护符',
        'Greater Economizer Charm' : '高级 节约者护符',
        'Lesser Spellweaver Charm' : '次级 织法者护符',
        'Greater Spellweaver Charm' : '高级 织法者护符',
        'Lesser Annihilator Charm' : '次级 毁灭者护符',
        'Greater Annihilator Charm' : '高级 毁灭者护符',
        'Lesser Penetrator Charm' : '次级 穿透者护符',
        'Greater Penetrator Charm' : '高级 穿透者护符',
        'Lesser Aether Charm' : '次级 以太护符',
        'Greater Aether Charm' : '高级 以太护符',

        // 护符 - 防御类
        'Lesser Fire-proof Charm' : '次级 耐热护符',
        'Greater Fire-proof Charm' : '高级 耐热护符',
        'Lesser Cold-proof Charm' : '次级 抗寒护符',
        'Greater Cold-proof Charm' : '高级 抗寒护符',
        'Lesser Lightning-proof Charm' : '次级 绝缘护符',
        'Greater Lightning-proof Charm' : '高级 绝缘护符',
        'Lesser Wind-proof Charm' : '次级 防风护符',
        'Greater Wind-proof Charm' : '高级 防风护符',
        'Lesser Holy-proof Charm' : '次级 驱圣护符',
        'Greater Holy-proof Charm' : '高级 驱圣护符',
        'Lesser Dark-proof Charm' : '次级 驱暗护符',
        'Greater Dark-proof Charm' : '高级 驱暗护符',
        'Lesser Juggernaut Charm' : '次级 勇士护符',
        'Greater Juggernaut Charm' : '高级 勇士护符',
        'Lesser Capacitor Charm' : '次级 电容器护符',
        'Greater Capacitor Charm' : '高级 电容器护符',

        // 其他材料
        'World Seed' : '世界种子',


        'Twilight Sparkle Figurine' : '暮光闪闪公仔',
        'Rainbow Dash Figurine' : '云宝黛西公仔',
        'Applejack Figurine' : '苹果杰克公仔',
        'Fluttershy Figurine' : '小蝶公仔',
        'Pinkie Pie Figurine' : '萍琪派公仔',
        'Rarity Figurine' : '瑞瑞公仔',
        'Trixie Figurine' : '崔克茜公仔',
        'Princess Celestia Figurine' : '塞拉斯蒂亚公主公仔',
        'Princess Luna Figurine' : '露娜公主公仔',
        'Apple Bloom Figurine' : '小苹花公仔',
        'Scootaloo Figurine' : '飞板璐公仔',
        'Sweetie Belle Figurine' : '甜贝儿公仔',
        'Big Macintosh Figurine' : '大麦克公仔',
        'Spitfire Figurine' : '飞火公仔',
        'Derpy Hooves Figurine' : '小呆公仔',
        'Lyra Heartstrings Figurine' : '天琴心弦公仔',
        'Octavia Figurine' : '奥塔维亚公仔',
        'Zecora Figurine' : '泽科拉公仔',
        'Cheerilee Figurine' : '车厘子公仔',
        'Vinyl Scratch Figurine' : '维尼尔公仔',
        'Daring Do Figurine' : '无畏天马公仔',
        'Doctor Whooves Figurine' : '神秘博士公仔',
        'Berry Punch Figurine' : '酸梅酒公仔',
        'Bon-Bon Figurine' : '糖糖公仔',
        'Fluffle Puff Figurine' : '毛毛马公仔',
        'Angel Bunny Figurine' : '天使兔公仔',
        'Gummy Figurine' : '嘎米公仔',

    },

    ///////////////////////////////////////////////////////文物与奖杯
    //出于整洁和效率考虑，文物奖杯单独写一个字典
    artifact: {
        'Artifacts and Trophies' : '文物和奖杯',

        //当前可以获取的文物和奖杯
        'Precursor Artifact' : '古遗物',
        'ManBearPig Tail' : '人熊猪的尾巴(等级2)',
        'Holy Hand Grenade of Antioch' : '安提阿的神圣手榴弹(等级2)',
        'Holy Hand Grenade Antioch' : '安提阿的神圣手榴弹(等级2)',
        'Mithra\'s Flower' : '猫人族的花(等级2)',
        'Dalek Voicebox' : '戴立克音箱(等级2)',
        'Lock of Blue Hair' : '一绺蓝发(等级2)',
        'Bunny-Girl Costume' : '兔女郎装(等级3)',
        'Hinamatsuri Doll' : '雏人形(等级3)',
        'Broken Glasses' : '破碎的眼镜(等级3)',
        'Sapling' : '树苗(等级4)',
        'Black T-Shirt' : '黑色Ｔ恤(等级4)',
        'Unicorn Horn' : '独角兽的角(等级5)',
        'Noodly Appendage' : '面条般的附肢(等级6)',

        //礼券
        'Bronze Coupon' : '铜礼券(等级3)',
        'Silver Coupon' : '银礼券(等级5)',
        'Gold Coupon' : '黄金礼券(等级7)',
        'Platinum Coupon' : '白金礼券(等级8)',
        'Peerless Voucher' : '无双凭证(等级10)',

        //旧旧文物
        'Priceless Ming Vase' : '无价的明朝瓷器',
        'Grue' : '格鲁',
        'Seven-Leafed Clover' : '七叶幸运草',
        'Rabbit\'s Foot' : '幸运兔脚',
        'Wirts Leg' : '维特之脚',
        'Shark-Mounted Laser' : '装在鲨鱼头上的激光枪',
        'BFG9000' : 'BFG9000',
        'Railgun' : '磁道炮',
        'Flame Thrower' : '火焰喷射器',
        'Small Nuke' : '小型核武',
        'Chainsaw Oil' : '电锯油',
        'Chainsaw Fuel' : '电锯燃油',
        'Chainsaw Chain' : '电锯链',
        'Chainsaw Safety Manual' : '电锯安全手册',
        'Chainsaw Repair Guide' : '电锯维修指南',
        'Chainsaw Guide Bar' : '电锯导板',
        'ASHPD Portal Gun' : '光圈科技传送门手持发射器',
        'Smart Bomb' : '炸弹机器人',
        'Tesla Coil' : '电光塔',
        'Vorpal Blade Hilt' : '斩龙剑的剑柄',
        'Crystal Jiggy' : '水晶拼图',

        //圣诞文物
        'Fiber-Optic Xmas Tree' : '光纤圣诞树',
        'Decorative Pony Sled' : '小马雪橇装饰品',
        'Hearth Warming Lantern' : '暖心节灯笼',
        'Mayan Desk Calendar' : '马雅桌历',
        'Fiber-Optic Tree of Harmony' : '光纤谐律之树',
        'Crystal Snowman' : '水晶雪人',
        'Annoying Dog' : '烦人的狗',
        'Iridium Sprinkler' : '铱制洒水器',
        'Robo Rabbit Head' : '机器兔子头',

        //复活节文物
        //2011
        'Easter Egg' : '复活节彩蛋',
        //S、N、O、W、F、L、A、K、E。
        //2012
        'Red Ponyfeather' : '红色天马羽毛',
        'Orange Ponyfeather' : '橙色天马羽毛',
        'Yellow Ponyfeather' : '黄色天马羽毛',
        'Green Ponyfeather' : '绿色天马羽毛',
        'Blue Ponyfeather' : '蓝色天马羽毛',
        'Indigo Ponyfeather' : '靛色天马羽毛',
        'Violet Ponyfeather' : '紫色天马羽毛',
        //2013
        'Twinkling Snowflake' : '闪闪发光(Twinkling)的雪花',
        'Glittering Snowflake' : '闪闪发光(Glittering)的雪花',
        'Shimmering Snowflake' : '闪闪发光(Shimmering)的雪花',
        'Gleaming Snowflake' : '闪闪发光(Gleaming)的雪花',
        'Sparkling Snowflake' : '闪闪发光(Sparkling)的雪花',
        'Glinting Snowflake' : '闪闪发光(Glinting)的雪花',
        'Scintillating Snowflake' : '闪闪发光(Scintillating)的雪花',
        //2014
        'Altcoin' : '山寨币',
        'LiteCoin' : '莱特币',
        'DogeCoin' : '多吉币',
        'PeerCoin' : '点点币',
        'FlappyCoin' : '象素鸟币',
        'VertCoin' : '绿币',
        'AuroraCoin' : '极光币',
        'DarkCoin' : '暗黑币',
        //2015
        'Ancient Server Part' : '古老的服务器零组件',
        'Server Motherboard' : '服务器主板',
        'Server CPU Module' : '服务器中央处理器模组',
        'Server RAM Module' : '服务器主内存模组',
        'Server Chassis' : '服务器机壳',
        'Server Network Card' : '服务器网络卡',
        'Server Hard Drive' : '服务器硬盘',
        'Server Power Supply' : '服务器电源供应器',
        //2016
        'Chicken Figurines' : '小鸡公仔',
        'Red Chicken Figurine' : '红色小鸡公仔',
        'Orange Chicken Figurine' : '橙色小鸡公仔',
        'Yellow Chicken Figurine' : '黄色小鸡公仔',
        'Green Chicken Figurine' : '绿色小鸡公仔',
        'Blue Chicken Figurine' : '蓝色小鸡公仔',
        'Indigo Chicken Figurine' : '靛色小鸡公仔',
        'Violet Chicken Figurine' : '紫色小鸡公仔',
        //2017
        'Ancient Fruit Smoothies' : '古老的水果冰沙',
        'Ancient Lemon' : '古代柠檬',
        'Ancient Plum' : '古代李子',
        'Ancient Kiwi' : '古代奇异果',
        'Ancient Mulberry' : '古代桑葚',
        'Ancient Blueberry' : '古代蓝莓',
        'Ancient Strawberry' : '古代草莓',
        'Ancient Orange' : '古代橙子',
        //2018
        'Aggravating Spelling Error' : '严重的拼写错误',
        'Exasperating Spelling Error' : '恼人的拼写错误',
        'Galling Spelling Error' : '恼怒的拼写错误',
        'Infuriating Spelling Error' : '激怒的拼写错误',
        'Irking Spelling Error' : '忿怒的拼写错误',
        'Vexing Spelling Error' : '烦恼的拼写错误',
        'Riling Spelling Error' : '愤怒的拼写错误',
        //2019
        'Manga Category Button' : '漫画类别按钮',
        'Doujinshi Category Button' : '同人志类别按钮',
        'Artist CG Category Button' : '画师CG类别按钮',
        'Western Category Button' : '西方类别按钮',
        'Image Set Category Button' : '图集类别按钮',
        'Game CG Category Button' : '游戏CG类别按钮',
        'Non-H Category Button' : '非H类别按钮',
        'Cosplay Category Button' : 'Cosplay类别按钮',
        'Asian Porn Category Button' : '亚洲色情类别按钮',
        'Misc Category Button' : '杂项类别按钮',
        //2020
        'Hoarded Hand Sanitizer' : '库存的洗手液',
        'Hoarded Disinfecting Wipes' : '库存的消毒湿巾',
        'Hoarded Face Masks' : '库存的口罩',
        'Hoarded Toilet Paper' : '库存的厕纸',
        'Hoarded Dried Pasta' : '库存的干面',
        'Hoarded Canned Goods' : '库存的罐头',
        'Hoarded Powdered Milk' : '库存的奶粉',
        //2021
        'Red Vaccine Vial' : '红色疫苗瓶',
        'Orange Vaccine Vial' : '橙色疫苗瓶',
        'Yellow Vaccine Vial' : '黄色疫苗瓶',
        'Green Vaccine Vial' : '绿色疫苗瓶',
        'Blue Vaccine Vial' : '蓝色疫苗瓶',
        'Indigo Vaccine Vial' : '靛色疫苗瓶',
        'Violet Vaccine Vial' : '紫色疫苗瓶',
        //2022
        'Core Carrying Bag' : '核心携带包',
        'Core Display Stand' : '核心展示架',
        'Core Ornament Set' : '核心饰品套装',
        'Core Maintenance Set' : '核心维护套装',
        'Core Wall-Mount Display' : '核心壁挂显示器',
        'Core LED Illumination' : '核心LED照明',
        //2023
        'Search Engine Crankshaft': '搜索引擎曲轴',
        'Search Engine Carburetor': '搜索引擎化油器',
        'Search Engine Piston': '搜索引擎活塞',
        'Search Engine Manifold': '搜索引擎歧管',
        'Search Engine Distributor': '搜索引擎分电器',
        'Search Engine Water Pump': '搜索引擎水泵',
        'Search Engine Oil Filter': '搜索引擎机油滤清器',
        'Search Engine Spark Plug': '搜索引擎火花塞',
        'Search Engine Valve': '搜索引擎阀门',

        //2024
        'Abstract Art of Fire Hydrants': '抽象艺术消防栓',
        'Abstract Art of Staircases': '抽象艺术楼梯',
        'Abstract Art of Bridges': '抽象艺术桥梁',
        'Abstract Art of Traffic Lights': '抽象艺术红绿灯',
        'Abstract Art of Bicycles': '抽象艺术自行车',
        'Abstract Art of Tractors': '抽象艺术拖拉机',
        'Abstract Art of Busses': '抽象艺术公交车',
        'Abstract Art of Motorcycles': '抽象艺术摩托车',
        'Abstract Art of Crosswalks': '抽象艺术人行道',
        'Abstract Art of Crosswalks': '抽象艺术人行道',
        'AI-Based Captcha Solver': '基于AI的验证码解答器(等级8)',
         //2025
        'Bunny Girl': '兔女郎装扮',
        'Fluffy Ear Headband': '毛绒发带',
        'White Fluffy Tail': '毛绒白尾巴',
        'Black Latex Top': '黑色乳胶上衣',
        'Black Latex Gloves': '黑色乳胶手套',
        'Black High Heels': '黑色高跟鞋',
        'Black Fishnet Stockings': '黑色渔网袜',
        'Black Underwear': '黑色内衣',
        'Choker and Bowtie': '项圈与领带',
        'Snowflake Bunny Girl Figure': '雪花兔女郎手办',


        //节日及特殊奖杯
        'Mysterious Box' : '神秘宝盒(等级9)', // 在‘训练：技能推广’调整价格后赠予某些玩家。
        'Solstice Gift' : '冬至赠礼(等级7)', //  2009 冬至
        'Stocking Stuffers' : '圣诞袜小礼物(等级7)', // 2009年以来每年圣诞节礼物。
        'Tenbora\'s Box' : '天菠拉的盒子(等级9)', // 年度榜单或者年度活动奖品
        'Shimmering Present' : '微光闪动的礼品(等级8)', //  2010 圣诞节
        'Potato Battery' : '马铃薯电池(等级7)', // 《传送门 2》发售日
        'RealPervert Badge' : '真-变态胸章(等级7)', // 2011 愚人节
        'Rainbow Egg' : '彩虹蛋(等级8)', //  2011 复活节
        'Colored Egg' : '彩绘蛋(等级7)', //  2011 复活节
        'Raptor Jesus' : '猛禽耶稣(等级7)', //  哈罗德·康平的被提预言
        'Gift Pony' : '礼品小马(等级8)', // 2011 圣诞节
        'Faux Rainbow Mane Cap' : '人造彩虹鬃毛帽(等级8)', //  2012 复活节
        'Pegasopolis Emblem' : '天马族徽(等级7)', // 2012 复活节
        'Fire Keeper Soul' : '防火女的灵魂(等级8)', // 2012 圣诞节
        'Crystalline Galanthus' : '结晶雪花莲(等级8)', // 2013 复活节
        'Sense of Self-Satisfaction' : '自我满足感(等级7)', // 2013 复活节
        'Six-Lock Box' : '六道锁盒子(等级8)', // 2013 圣诞节
        'Golden One-Bit Coin' : '金色一比特硬币(等级8)', // 2014 复活节
        'USB ASIC Miner' : '随身型特定应用积体电路挖矿机(等级7)', // 2014 复活节
        'Reindeer Antlers' : '驯鹿鹿角(等级8)', // 2014 圣诞节
        'Ancient Porn Stash' : '古老的色情隐藏档案(等级8)', // 2015 复活节
        'VPS Hosting Coupon' : '虚拟专用服务器代管优惠券(等级7)', // 2015 复活节
        'Heart Locket' : '心型盒坠(等级8)', // 2015 圣诞节
        'Holographic Rainbow Projector' : '全像式彩虹投影机(等级8)', // 2016 复活节
        'Pot of Gold' : '黄金罐(等级7)', // 2016 复活节
        'Dinosaur Egg' : '恐龙蛋(等级8)', // 2016 圣诞节
        'Precursor Smoothie Blender' : '旧世界冰沙机(等级8)', // 2017 复活节
        'Rainbow Smoothie' : '彩虹冰沙(等级7)', // 2017 复活节
        'Mysterious Tooth' : '神秘的牙齿(等级8)', // 2017 圣诞节
        'Grammar Nazi Armband' : '语法纳粹臂章(等级7)', // 2018 复活节
        'Abstract Wire Sculpture' : '抽象线雕(等级8)', // 2018 复活节
        'Delicate Flower' : '娇嫩的花朵(等级8)', // 2018 圣诞节
        'Assorted Coins' : '什锦硬币(等级7)', // 2019 复活节
        'Coin Collector\'s Guide' : '硬币收藏家指南(等级8)', // 2019 复活节
        'Iron Heart' : '钢铁之心(等级8)', // 2019 圣诞节
        'Shrine Fortune' : '神社灵签(等级7)', // 2020起复活节
        'Plague Mask' : '瘟疫面具(等级8)', // 2020 复活节
        'Festival Coupon' : '节日礼券(等级7)', //2020起收获节（中秋）
        'Annoying Gun' : '烦人的枪(等级8)', //2020 圣诞节
        'Vaccine Certificate' : '疫苗证明(等级8)', //2021 复活节
        'Barrel' : '酒桶(等级8)', //2021 圣诞节
        'CoreCare Starter Kit' : '核心服务工具套件(等级8)', //2022 复活节
        'Star Compass' : '星罗盘(等级8)', //2022 圣诞节
        'Museum Ticket' : '博物馆门票(等级8)', // 2023 复活节
        'Idol Fan Starter Pack' : '偶像粉丝入门包(等级8)', //2023 圣诞节

    },

    ///////////////////////////////////////////////////////物品说明
    itemInfos: {
        //物品类型
        '/^Trophy$/': '奖杯',
        '/^Consumable$/': '消耗品',
        '/^Artifact$/': '文物',
        '/^Token$/': '令牌',
        '/^Crystal$/': '水晶',
        '/^Material$/': '材料',
        '/^Collectable$/': '收藏品',
        '/^Monster Food$/': '怪物食物',

        ///////////////////////////////////////////////////////物品说明
        //消耗品说明
        'Provides a long-lasting health restoration effect.' : '持续回复一定量的生命，持续50回合.',
        'Instantly restores a large amount of health.' : '立刻回复大量的生命.',
        'Fully restores health, and grants a long-lasting health restoration effect.' : '生命值全满,并持续回复一定量的生命，持续100回合.',
        'Provides a long-lasting mana restoration effect.' : '持续回复一定量的魔力值，持续50回合.',
        'Instantly restores a moderate amount of mana.' : '立刻回复一定量的魔力值.',
        'Fully restores mana, and grants a long-lasting mana restoration effect.' : '魔力值全满,并持续回复一定量的魔力值，持续100回合.',
        'Provides a long-lasting spirit restoration effect.' : '持续回复一定量的灵力值，持续50回合.',
        'Instantly restores a moderate amount of spirit.' : '立刻回复一定量的灵力值.',
        'Fully restores spirit, and grants a long-lasting spirit restoration effect.' : '灵力值全满,并持续回复一定量的灵力值，持续100回合.',
        'Fully restores all vitals, and grants long-lasting restoration effects.' : '生命,魔力,灵力全满,并同时产生三种长效药的效果，持续100回合.',
        'Restores 10 points of Stamina, up to the maximum of 99. When used in battle, also boosts Overcharge and Spirit by 10% for ten turns.' : '恢复10点精力，但不超过99。如果在战斗中使用，除恢复精力外附带持续10回合每回合增加10%灵力和斗气.',
        'Restores 5 points of Stamina, up to the maximum of 99. When used in battle, also boosts Overcharge and Spirit by 10% for five turns.' : '恢复5点精力，但不超过99。如果在战斗中使用，除恢复精力外附带持续5回合每回合增加10%灵力和斗气.',
        'There are three flowers in a vase. The third flower is green.' : '花瓶中有三朵花，第三朵是绿色的(玩偶特工)。使用时持续50回合攻击/魔法伤害，攻击/法术命中率与暴击率，回避与抵抗率大幅提升。',
        'It is time to kick ass and chew bubble-gum... and here is some gum.' : '该是嚼著泡泡糖收拾他们的时候了…这里有一些泡泡糖(极度空间)。使用时持续50回合攻击和魔法伤害提升100%，必定命中且必定暴击',
        'You gain +25% resistance to Fire elemental attacks and do 25% more damage with Fire magicks.' : '你获得 +25% 的火焰抗性且获得 25% 的额外火焰魔法伤害，持续50回合。',
        'You gain +25% resistance to Cold elemental attacks and do 25% more damage with Cold magicks.' : '你获得 +25% 的冰冷抗性且获得 25% 的额外冰冷魔法伤害，持续50回合。',
        'You gain +25% resistance to Elec elemental attacks and do 25% more damage with Elec magicks.' : '你获得 +25% 的闪电抗性且获得 25% 的额外闪电魔法伤害，持续50回合。',
        'You gain +25% resistance to Wind elemental attacks and do 25% more damage with Wind magicks.' : '你获得 +25% 的疾风抗性且获得 25% 的额外疾风魔法伤害，持续50回合。',
        'You gain +25% resistance to Holy elemental attacks and do 25% more damage with Holy magicks.' : '你获得 +25% 的神圣抗性且获得 25% 的额外神圣魔法伤害，持续50回合。',
        'You gain +25% resistance to Dark elemental attacks and do 25% more damage with Dark magicks.' : '你获得 +25% 的黑暗抗性且获得 25% 的额外黑暗魔法伤害，持续50回合。',
        'Grants the Haste effect.' : '使用后产生加速（60%加速）效果，持续100回合',
        'Grants the Protection effect.' : '使用后产生保护（50%减伤）效果，持续100回合',
        'Grants the Haste and Protection effects with twice the normal duration.' : '使用后产生加速和保护的效果，持续200回合',
        'Grants the Absorb effect.' : '使用后获得吸收（100%触发）效果，持续100回合',
        'Grants the Shadow Veil effect.' : '使用产生暗影面纱（30%闪避）效果，持续100回合',
        'Grants the Spark of Life effect.' : '使用产生生命火花（受到致命伤害后消耗25%基础SP，并以50%最大生命复活）效果，持续100回合',
        'Grants the Absorb, Shadow Veil and Spark of Life effects with twice the normal duration.' : '同时产生吸收，闪避，以及生命火花效果，持续200回合',

        //强化材料
        'A cylindrical object filled to the brim with arcano-technological energy. Required to restore advanced armor and shields to full condition.' : '一个充斥着奥术能量的圆柱形物体，用于修复高级护甲和盾牌',
        'A cylindrical object filled to the brim with magitech energy. Used to power charms and advanced equipment.' : '一个充满魔法科技能量的圆柱形物体。用于驱动护符和高级装备。',
        'A small vial filled with a catalytic substance necessary for upgrading and repairing equipment in the forge. This is permanently consumed on use.' : '一个装着升级与修复装备必须的催化剂的小瓶子，每使用一次就会消耗一个',
        'Various bits and pieces of scrap cloth. These can be used to mend the condition of an equipment piece.' : '各种零碎的布料，用于修复装备',
        'Various bits and pieces of scrap leather. These can be used to mend the condition of an equipment piece.' : '各种零碎的皮革，用于修复装备',
        'Various bits and pieces of scrap metal. These can be used to mend the condition of an equipment piece.' : '各种零碎的金属，用于修复装备',
        'Various bits and pieces of scrap wood. These can be used to mend the condition of an equipment piece.' : '各种零碎的木材，用于修复装备',
        'Some materials scavenged from fallen adventurers by a monster. Required to ' : '一些从怪物身上收集到的材料，用于',
        'reforge and upgrade cloth armor.' : '升级布甲',
        'reforge and upgrade staffs and shields.' : '升级法杖和盾牌',
        'reforge and upgrade heavy armor and weapons' : '升级重甲和武器',
        'reforge and upgrade light armor' : '升级轻甲',
        'reforge Phase Armor' : '强化相位甲',
        'reforge Shade Armor' : '强化暗影甲',
        'reforge Power Armor' : '强化动力甲',
        'reforge Force Shields' : '强化力场盾',
        'upgrade equipment bonuses to ' : '升级装备的 ',
        'Elemental Magic Proficiency': '元素魔法熟练度',
        'Divine Magic Proficiency': '神圣魔法熟练度',
        'Forbidden Magic Proficiency': '黑暗魔法熟练度',
        'Deprecating Magic Proficiency': '减益魔法熟练度',
        'Supportive Magic Proficiency': '增益魔法熟练度',
        'Magical Base Damage': '基础魔法伤害',
        'Physical Base Damage': '基础物理伤害',
        'The core of a legendary weapon. Contains the power to improve a weapon beyond its original potential.' : '一件传奇武器的核心。含有提升一件武器原始潜能的力量。',
        'The core of a peerless weapon. Contains the power to improve a weapon beyond its original potential.' : '一件无双武器的核心。含有提升一件武器原始潜能的力量。',
        'The core of a legendary staff. Contains the power to improve a staff beyond its original potential.' : '一件传奇法杖的核心。含有提升一件法杖原始潜能的力量。',
        'The core of a peerless staff. Contains the power to improve a staff beyond its original potential.' : '一件无双法杖的核心。含有提升一件法杖原始潜能的力量。',
        'The core of a legendary armor. Contains the power to improve an armor piece or shield beyond its original potential.' : '一件传奇护甲的核心。含有提升一件护甲或者盾牌原始潜能的力量。',
        'The core of a peerless armor. Contains the power to improve an armor piece or shield beyond its original potential.' : '一件无双护甲的核心。含有提升一件护甲或者盾牌原始潜能的力量。',
        //其它可强化属性与equipsInfo装备属性字典共用

        //碎片
        'Used to imbue a weapon or staff with a charm.' : '用于为武器或法杖注入护符。',
        'Used to imbue equipment with a charm.' : '用于为装备注入护符。',
        'Used to imbue an armor or shield with a charm.' : '用于为护甲或盾牌注入护符。',
        'Used to power Featherweight Charms.' : '用于驱动轻如鸿毛护符。',
        'Used to power Voidseeker Charms.' : '用于驱动虚空护符。',
        'Used to power Aether Charms.' : '用于驱动以太护符。',
        'When used with an equipment piece, this shard will temporarily imbue it with the' : '当用在一件装备上时，会临时给予装备',
        'When used with a weapon, this shard will temporarily imbue it with the' : '当用在一件武器上时，会临时给予装备',
        'Suffused Aether enchantment' : '弥漫的以太 的附魔效果',
        'Featherweight Charm enchantment' : '轻如鸿毛 的附魔效果',
        'Voidseeker\'s Blessing enchantment' : '虚空探索者的祝福 的附魔效果',
        'Can be used to reset the unlocked potencies and experience of an equipment piece.' : '可以用于重置装备的潜能等级',

        'These fragments can be used in the forge to permanently soulfuse an equipment piece to you, which will make it level as you do.' : '这个碎片可以将一件装备与你灵魂绑定，灵魂绑定的装备属性将随着你的等级变化。',
        'These fragments can be used in the forge to permanently soulbind an equipment piece to you, which will make it level as you do.' : '这个碎片可以将一件装备与你灵魂绑定，灵魂绑定的装备属性将随着你的等级变化。',
        'Can be used to create a new world inside an equipment piece. Clearing this world will allow you to upgrade it further.' : '可以用于在装备中创建一个新的世界。通关该道具界将允许你进一步升级装备。',
        'You can exchange this token for the chance to face a legendary monster by itself in the Ring of Blood.' : '你可以用这些令牌在浴血擂台里面换取与传奇怪物对阵的机会',
        'You can use this token to unlock monster slots in the Monster Lab, as well as to upgrade your monsters.' : '你可以用这些令牌开启额外的怪物实验室槽位，也可以升级你的怪物',
        'Use this ticket on a lottery to add 100 tickets and double your effective ticket count. Will not increase effective count past 10% of the total tickets sold.' : '你可以使用这张彩券兑换100张当期彩票，并且让自己持有的彩票数量翻倍（效果在开奖时计算，最多不超过总奖池10%）',

        //怪物相关
        'You can fuse this crystal with a monster in the monster tab to increase its' : '你可以用这种水晶在怪物实验室里面为一个怪物提升它的',
        'Strength.' : '力量',
        'Dexterity.' : '灵巧',
        'Agility.' : '敏捷',
        'Endurance.' : '体质',
        'Intelligence.' : '智力',
        'Wisdom.' : '智慧',
        'Fire Resistance' : '火焰抗性',
        'Cold Resistance' : '冰冷抗性',
        'Electrical Resistance' : '闪电抗性',
        'Wind Resistance' : '疾风抗性',
        'Holy Resistance' : '神圣抗性',
        'Dark Resistance' : '黑暗抗性',
        'Non-discerning monsters like to munch on this chow.' : '不挑食的初级怪物喜欢吃这种食物',
        'Mid-level monsters like to feed on something slightly more palatable, like these scrumptious edibles.' : '中级怪物喜欢吃更好吃的食物，比如这种',
        'High-level monsters would very much prefer this highly refined level of dining if you wish to parlay their favor.' : '如果你想受高等级怪物的青睐的话，请喂它们吃这种精致的食物吧',
        'Tiny pills filled with delicious artificial happiness. Use on monsters to restore morale if you cannot keep them happy. It beats leaving them sad and miserable.' : '美味的人造药丸，满溢着的幸福，没法让怪物开心的话，就用它来恢复怪物的士气，赶走怪物的悲伤和沮丧吧',

        //现有文物和奖杯
        'An advanced technological artifact from an ancient and long-lost civilization. Handing these in at the Shrine of Snowflake will grant you a reward.' : '一个发达古代文明的技术结晶，把它交给雪花神殿的雪花女神来获得你的奖励',
        'Retrieved as a Toplist Reward for active participation in the E-Hentai Galleries system.' : '作为在E-Hentai画廊系统的活跃排行榜奖励派发，献祭作用与奖杯相同。',
        'A sapling from Yggdrasil, the World Tree' : '一棵来自世界树的树苗',
        'A plain black 100% cotton T-Shirt. On the front, an inscription in white letters reads' : '一件平凡无奇的100%纯棉T恤衫，在前面用白色的字母写着',
        'I defeated Real Life, and all I got was this lousy T-Shirt.' : '战胜了现实后，我就得到了这么一件恶心的T恤衫',
        'No longer will MBP spread havoc, destruction, and melted polar ice caps.' : '不会再有人熊猪扩散浩劫、破坏、和融化的极地冰帽了。',
        'You found this item in the lair of a White Bunneh. It appears to be a dud.' : '这似乎是你在一只杀人兔的巢穴里发现的一颗未爆弹。',
        'A Lilac flower given to you by a Mithra when you defeated her. Apparently, this type was her favorite.' : '击败小猫娘后她送你的紫丁香。很显然这品种是她的最爱。',
        'Taken from the destroyed remains of a Dalek shell.' : '从戴立克的残骸里取出来的音箱。',
        'Given to you by Konata when you defeated her. It smells of Timotei.' : '击败泉此方后获得的蓝发。闻起来有 Timotei 洗发精的味道',
        'Given to you by Mikuru when you defeated her. If you wear it, keep it to yourself.' : '击败朝比奈实玖瑠后获得的兔女郎装。不要告诉别人你有穿过。',
        'Given to you by Ryouko when you defeated her. You decided to name it Achakura, for no particular reason.' : '击败朝仓凉子后获得的人形。你决定取名叫朝仓，这没什么特别的理由。',
        'Given to you by Yuki when you defeated her. She looked better without them anyway.' : '击败长门有希后获得的眼镜。她不戴眼镜时看起来好多了。',
        'An Invisible Pink Unicorn Horn taken from the Invisible Pink Unicorn. It doesn\'t weigh anything and has the consistency of air, but you\'re quite sure it\'s real.' : '从隐形粉红独角兽头上取下来的隐形粉红色的角，它很像空气一样轻，几乎没有重量，但是你很确定它是真实存在的',
        'A nutritious pasta-based appendage from the Flying Spaghetti Monster.' : '一条用飞行意大利面怪物身上的面团做成的营养附肢。',
        'A voucher for a free soulbound Peerless equipment piece of your choice. Given to you personally by Snowflake for your devout worship and continued offerings.' : '一张可以根据你的选择兑换一件免费灵魂绑定无双装备的凭证。由雪花女神亲自交给你的虔诚崇拜和持续献祭奖励。',

        //小马
        'A 1/10th scale figurine of Twilight Sparkle, the cutest, smartest, all-around best pony. According to Pinkie Pie, anyway.' : 'NO.1 暮光闪闪的 1/10 比例缩放公仔。最可爱、最聪明，最全能的小马。(根据萍琪的说法，嗯…) ',
        'A 1/10th scale figurine of Rainbow Dash, flier extraordinaire. Owning this will make you about 20% cooler, but it probably took more than 10 seconds to get one.' : 'NO.2 云宝黛西的 1/10 比例缩放公仔。杰出的飞行员。拥有这个公仔可以让你多酷大约 20%，但为了得到她你得多花 10 秒！ ',
        'A 1/10th scale figurine of Applejack, the loyalest of friends and most dependable of ponies. Equestria\'s best applebucker, and founder of Appleholics Anonymous.' : 'NO.3 苹果杰克的 1/10 比例缩放公仔。最忠诚的朋友，最可靠的小马。阿奎斯陲亚最好的苹果采收员，同时也是苹果农庄的创始马。 ',
        'A 1/10th scale figurine of Fluttershy, resident animal caretaker. You\'re going to love her. Likes baby dragons; Hates grown up could-eat-a-pony-in-one-bite dragons.' : 'NO.4 小蝶的 1/10 比例缩放公仔。小马镇动物的褓姆，大家都喜爱她。喜欢幼龙；讨厌能一口吞掉小马的大龙。 ',
        'A 1/10th scale figurine of Pinkie Pie, a celebrated connoisseur of cupcakes and confectioneries. She just wants to keep smiling forever.' : 'NO.5 萍琪派的 1/10 比例缩放公仔。一位著名的杯子蛋糕与各式饼干糖果的行家。她只想让大家永远保持笑容。 ',
        'A 1/10th scale figurine of Rarity, the mistress of fashion and elegance. Even though she\'s prim and proper, she could make it in a pillow fight.' : 'NO.6 瑞瑞的 1/10 比例缩放公仔。时尚与品味的的女主宰。她总是能在枕头大战中保持拘谨矜持。 ',
        'A 1/10th scale figurine of The Great and Powerful Trixie. After losing her wagon, she now secretly lives in the Ponyville library with her girlfriend, Twilight Sparkle.' : 'NO.7 崔克茜的 1/10 比例缩放公仔。伟大的、法力无边的崔克茜。失去她的篷车后，她现在偷偷的与她的女友暮光闪闪住在小马镇的图书馆中。 ',
        'A 1/10th scale figurine of Princess Celestia, co-supreme ruler of Equestria. Bored of the daily squabble of the Royal Court, she has recently taken up sock swapping.' : 'NO.8 塞拉斯蒂亚公主的 1/10 比例缩放公仔。阿奎斯陲亚大陆的最高统治者。对每日的皇家争吵感到无聊，她近日开始穿上不成对的袜子。 ',
        'A 1/10th scale figurine of Princess Luna, aka Nightmare Moon. After escaping her 1000 year banishment to the moon, she was grounded for stealing Celestia\'s socks.' : 'NO.9 露娜公主的 1/10 比例缩放公仔。又名梦靥之月。在结束了一千年的放逐后，她从月球回到阿奎斯陲亚偷走了塞拉斯提娅的袜子。 ',
        'A 1/10th scale figurine of Apple Bloom, Applejack\'s little sister. Comes complete with a \"Draw Your Own Cutie Mark\" colored pencil and permanent tattoo applicator set.' : 'NO.10 小苹花的 1/10 比例缩放公仔。苹果杰克的小妹。使用了“画出妳自己的可爱标志”彩色铅笔与永久纹身组后，生命更加的完整了。 ',
        'A 1/10th scale figurine of Scootaloo. Die-hard Dashie fanfilly, best pony of the Cutie Mark Crusaders, and inventor of the Wingboner Propulsion Drive. 1/64th chicken.' : 'NO.11 飞板璐的 1/10 比例缩放公仔。云宝黛西的铁杆年轻迷妹，可爱标志十字军中最棒的小马，以及蠢翅动力推进系统的发明者。有 1/64 的组成成分是鲁莽。 ',
        'A 1/10th scale figurine of Sweetie Belle, Rarity\'s little sister. Comes complete with evening gown and cocktail dress accessories made of 100% Dumb Fabric.' : 'NO.12 甜贝儿的 1/10 比例缩放公仔。瑞瑞的小妹。在穿上 100% 蠢布料制成的晚礼服与宴会短裙后更加完美了。 ',
        'A 1/10th scale figurine of Big Macintosh, Applejack\'s older brother. Famed applebucker and draft pony, and an expert in applied mathematics.' : 'NO.13 大麦克的 1/10 比例缩放公仔。苹果杰克的大哥。有名的苹果采收员和大力马，同时也是实用数学的专家。 ',
        'A 1/10th scale figurine of Spitfire, team leader of the Wonderbolts. Dashie\'s idol and occasional shipping partner. Doesn\'t actually spit fire.' : 'NO.14 飞火的 1/10 比例缩放公仔。惊奇闪电的领导者。云宝黛西的偶像和临时飞行搭档。实际上不会吐火。 ',
        'A 1/10th scale figurine of Derpy Hooves, Ponyville\'s leading mailmare. Outspoken proponent of economic stimulus through excessive muffin consumption.' : 'NO.15 小呆的 1/10 比例缩放公仔。小马镇上重要的邮差马。直言不讳的主张以大量食用马芬的方式来刺激经济。 ',
        'A 1/10th scale figurine of Lyra Heartstrings. Features twenty-six points of articulation, replaceable pegasus hoofs, and a detachable unicorn horn.' : 'NO.16 天琴心弦的 1/10 比例缩放公仔。拥有 26 个可动关节，可更换的飞马蹄与一个可拆卸的独角兽角是其特色。 ',
        'A 1/10th scale figurine of Octavia. Famous cello musician; believed to have created the Octatonic scale, the Octahedron, and the Octopus.' : 'NO.17 奥塔维亚的 1/10 比例缩放公仔。著名的大提琴家；据信创造了八度空间、八面体以及章鱼。 ',
        'A 1/10th scale figurine of Zecora, a mysterious zebra from a distant land. She\'ll never hesitate to mix her brews or lend you a hand. Err, hoof.' : 'NO.18 泽科拉的 1/10 比例缩放公仔。一位来自远方的神秘斑马。她会毫不迟疑的搅拌她的魔药或助你一臂之力。呃，我是说一蹄之力… ',
        'A 1/10th scale figurine of Cheerilee, Ponyville\'s most beloved educational institution. Your teachers will never be as cool as Cheerilee.' : 'NO.19 车厘子的 1/10 比例缩放公仔。小马镇最有爱心的教育家。你的老师绝对不会像车厘子这么酷的！ ',
        'A 1/10th scale bobblehead figurine of Vinyl Scratch, the original DJ P0n-3. Octavia\'s musical rival and wub wub wub interest.' : 'NO.20 维尼尔的 1/10 比例缩放摇头公仔。是 DJ P0n-3 的本名。为奥塔维亚在音乐上的对手，喜欢重低音喇叭。 ',
        'A 1/10th scale figurine of Daring Do, the thrill-seeking, action-taking mare starring numerous best-selling books. Dashie\'s recolor and favorite literary character.' : 'NO.21 无畏天马的 1/10 比例缩放公仔。追寻刺激，有如动作片主角一般的小马，为一系列畅销小说的主角。是云宝黛西最喜欢的角色，也是带领她进入阅读世界的原因。 ',
        'A 1/10th scale figurine of Doctor Whooves. Not a medical doctor. Once got into a hoof fight with Applejack over a derogatory remark about apples.' : 'NO.22 神秘博士的 1/10 比例缩放公仔。不是医生。曾经与苹果杰克陷入一场因贬低苹果的不当发言而产生的蹄斗。 ',
        'A 1/10th scale figurine of Berry Punch. Overly protective parent pony and Ponyville\'s resident lush. It smells faintly of fruit wine.' : 'NO.23 酸梅酒的 1/10 比例缩放公仔。有过度保护倾向的小马，也是小马镇的万年酒鬼。闻起来有淡淡水果酒的气味。 ',
        'A 1/10th scale figurine of Bon-Bon. Usually seen in the company of Lyra. Suffers from various throat ailments that make her sound different every time you see her.' : 'NO.24 糖糖的 1/10 比例缩放公仔。常常被目击与天琴心弦在一起。患有许多呼吸道相关的疾病，使你每次遇到她的时候她的声音都不同。 ',
        'A 1/10th scale fluffy figurine of Fluffle Puff. Best Bed Forever.' : 'NO.25 毛毛马的 1/10 比例缩放的毛茸茸玩偶。让你想要永远躺在上面。 ',
        'A lifesize figurine of Angel Bunny, Fluttershy\'s faithful yet easily vexed pet and life partner. All-purpose assistant, time keeper, and personal attack alarm.' : 'NO.26 天使兔的等身大玩偶。为小蝶忠实且易怒的宠物及伴侣。万能助理、报时器、受到人身攻击时的警报器。 ',
        'A lifesize figurine of Gummy, Pinkie Pie\'s faithful pet. Usually found lurking in your bathtub. While technically an alligator, he is still arguably the best pony.' : 'NO.27 嘎米的等身大玩偶。是萍琪的忠实宠物。经常被发现潜伏在你的浴缸里。虽然技术上是只短吻鳄，但它仍然可以称得上是最棒的小马。 ',

        //旧文物
        'It is dead, and smaller than you expected.' : '它已经死了，而且体型比你想像中还要小。',
        'So that is where that thing ended up.' : '所以这就是事件的最终下场。',
        'It would be totally awesome, but you do not have any sharks.' : '这肯定棒呆了！但你没有养鲨鱼。',
        'The energy cells are completely drained.' : '能量电池已完全用尽。 (BFG=Big Fucking Gun)',
        'The electromagnetic acceleration rails are bent and twisted. Using it would be bad.' : '电磁加速轨道已折弯和扭曲，使用它会很糟糕。',
        'Now all you need is some fuel.' : '现在你所需要的是一些燃料。',
        'Great for blowing up small kingdoms, but you do not know the code to activate it.' : '很适合用来摧毁小王国，但你不知道发射密码。',
        'Oil for chainsaws.' : '电锯的链条油。',
        'Fuel for chainsaws. Will not work in flame throwers.' : '电锯专用燃料，不能用在火焰喷射器。',
        'Spare cutting chain for a chainsaw.' : '电锯的切割链零件。',
        'Spare guide bar for a chainsaw.' : '电锯的导板零件。',
        'A booklet with safety information for proper use of a chainsaw.' : '写着正确使用电锯的安全须知的小册子。',
        'Contains information on the proper care and maintenance of a chainsaw.' : '包含适当的照料与维修方法。',
        'Unfortunately it is incomplete, and there are no orange portals around.' : '很可惜它是未完成品，周围没有橘色的传送门。',
        'Being aware that fulfilling its function will also end its existance, this bomb refuses to go off.' : '意识到履行自身的功能也将消灭自己的存在，这个炸弹拒绝爆炸。',
        'Must be hooked up to an Advanced Power Plant to fire.' : '必须连接大型发电厂才能发射。',
        'The blade that should be attached to this hilt is gone.' : '本该连接这个剑柄的剑刃不见了。',
        'A piece to the puzzle.' : '一块拼图。',

        'A rare winter decoration from an ancient civilization, serving as a perfect example of its gaudiness and bad taste.' : '一种来自古代文明的罕见冬季装饰品，它的俗丽的美和低劣品味可谓经典范例。(2010 年圣诞节发放)',
        'A rare 1/10th scale Santa sled featuring ponies instead of reindeer. It\'s decked out in gaudy flashing lights that fortunately ran out of power centuries ago.' : '罕见的圣诞雪橇 1/10 比例缩放模型，是由小马拉着雪橇而不是驯鹿。上面装了一堆超俗的闪光灯，幸好几百年前就没电了。(2011 年圣诞节发放)',
        'An eternally burning purple heart, fueled by magic and friendship, suspended inside a glass vessel. Saves on lantern oil.' : '一颗永久燃烧的紫色之心，以魔法和友谊为燃料，悬挂在玻璃容器里。省下了灯油。(2012 年圣诞节发放)',
        'Covers the entire 12th b\'ak\'tun of the Mayan Long Count Calendar, equivalent to 144000 days. Now only good as a very heavy ornate paperweight.' : '完整涵盖长纪历的第 12 个伯克盾，相当于 144000 天。现在只能当作装饰华丽的重型纸镇。(2012 年圣诞节发放)',
        'An intricately carved sculpture of the Tree of Harmony. The adorning multi-colored elements are slowly pulsating with a gentle glow.' : '一件精雕细琢的谐律之树雕塑品。树上装饰的彩色元素缓缓脉动着温和的光辉。(2013 年圣诞节发放)',
        'A snowman made of a deep blue and faintly glowing crystal, adorned with round onyx eyes and a carrot-shaped garnet nose. Does not melt during summer.' : '用闪著淡淡光辉的深蓝水晶制作的雪人，镶嵌著圆形缟玛瑙做的眼睛和胡萝卜形状的石榴石鼻子。夏天也不会融化。(2014 年圣诞节发放)',
        'A little white dog. It\'s fast asleep...' : '一只小白狗。它正熟睡着...(2015 年圣诞节发放)',
        'A precursor irrigation device, capable of providing sufficient water to around two dozen farm plots. The internal power source was depleted centuries ago.' : '一个旧世界的灌溉设备，能够为周围二十四块耕地喷洒充足的水。内置的电池在几个世纪前就没电了。(2016 年圣诞节发放)',
        'The giant head of an animatronic mecha-bunn. Rather cute, and rather horrifying.' : '一个巨大的动力机甲头部，相当可爱，也相当恐怖。(2017 年圣诞节发放)',

        'A colored easter egg, inscribed with the ' : '一个彩色的复活节彩蛋，上面刻着',
        'letter W.' : '字母S.',
        'letter N.' : '字母N.',
        'letter O.' : '字母O.',
        'letter W.' : '字母W.',
        'letter F.' : '字母F.',
        'letter L.' : '字母L.',
        'letter A.' : '字母A.',
        'letter K.' : '字母K.',
        'letter E.' : '字母E.',
        'If you collect and hand in the entire set, something good might happen.' : '如果你收集并献祭一整套，或许会有什么好事情发生。(2011 复活节)',
        'The pegasus ponies have lost their feathers! Better give them to Snowflake so she can help them get back on their wings.' : '天马们失去了她们的羽毛！最好交给雪花女神帮她们取回翅膀。(2012 复活节)',
        'A beautifully crafted, limited edition snowflake.' : '精美的限量版雪花。(2013 复活节)',
        'The altcoins are running wild! Better give them to Snowflake so she can get rid of them safely.' : '山寨币非常猖獗！最好把它们交给雪花让她安全地销毁。(2014 复活节)',
        'such altcoin so scare plz give snowflake for much wow' : '这种山寨币特别骇人，请给雪花多一点。汪 (2014 复活节活动)',
        'An ancient server-grade motherboard. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的服务器级主板。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient server-grade processor module. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的服务器级处理器模组。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient set of server-grade ECC RAM. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的服务器级错误修正码内存。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient 1U rack-mounted server chassis. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的 1U 机架式服务器机壳。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient gigabit ethernet network card. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的超高速以太网路卡。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient server-grade storage device. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的服务器级储存装置。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'An ancient dual redundant power supply unit. Give to Snowflake to help reassemble the Legendary Precursor Servers.' : '古老的双冗馀电源供应单元。交给雪花帮忙重组出传说中的旧世代服务器。(2015 复活节活动)',
        'Someone stole these commemorative easter chickens from the Rainbow Factory. Return a full set to Snowflake to earn their gratitude.' : '有人偷走了彩虹工厂的复活节纪念小鸡。找回整套归还给雪花以赢得她们的感激之情。(2016 复活节)',
        'A cryogenically preserved ancient lemon.' : '一颗低温保存的古代柠檬。(2017 复活节活动)',
        'A cryogenically preserved ancient kiwi. The fruit. Not the bird' : '一颗低温保存的古代奇异果。是水果，不是鸟。(2017 复活节活动)',
        'A cryogenically preserved ancient blueberry.' : '一颗低温保存的古代蓝莓。(2017 复活节活动)',
        'A cryogenically preserved ancient plum.' : '一颗低温保存的古代李子。(2017 复活节活动)',
        'A cryogenically preserved ancient mulberry.' : '一颗低温保存的古代桑椹。(2017 复活节活动)',
        'A cryogenically preserved ancient strawberry.' : '一颗低温保存的古代草莓。(2017 复活节活动)',
        'A cryogenically preserved ancient orange.' : '一颗低温保存的古代柳橙。(2017 复活节活动)',
        'A truely aggravating spelling error. Give it to Snowflake.' : '一个确实很严重的拼写错误。把它交给雪花。(2018 复活节活动)',
        'Alot of people make this mistake. Give it to Snowflake.' : '很多人都会犯这个错误。把它交给雪花。(2018 复活节活动)',
        'A rather embarassing mistake. Give it to Snowflake.' : '一个相当尴尬的错误。把它交给雪花。(2018 复活节活动)',
        'Definately one of the more common mistakes you can find. Give it to Snowflake.' : '绝对是你可以找到的最常见的错误之一。把它交给雪花。(2018 复活节活动)',
        'Mispelling this word is just extra dumb. Give it to Snowflake.' : '拼错这个词实在是相当愚蠢。把它交给雪花。(2018 复活节活动)',
        'Apparantly a very common error to make. Give it to Snowflake.' : '显然是一个非常常见的错误。把它交给雪花。(2018 复活节活动)',
        'A suprisingly common mistake. Give it to Snowflake.' : '一个令人惊讶的普遍错误。把它交给雪花。(2018 复活节活动)',
        'A deprecated category button scattered by the 2019 Easter Event. Give it to Snowflake.' : '2019复活节活动时散落的已被弃用类别按钮。把它交给雪花。',
        'Some hoarded supplies from the 2020 Easter Event. Give it to Snowflake for redistribution.' : '2020复活节活动时囤积的一些物资。把它交给雪花重新分配。',
        'The label is faded, but you can barely make out the letters' : '标签已经褪色了，但是你勉强认出了一些字母', //-s-ra--eca、-f-zer、-ode--a、J--s-n、-ov-vax、-put--V、Co--de--a
        'Give it to Snowflake for analysis.' : '把它交给雪花分析。(2021 复活节活动)',
        'Lost goods from the new CoreCare™ series of Snowflake-approved products. Give it back to Snowflake.' : '雪花核准的新[核心服务]™系列丢失的产品，把它交换给雪花。(2022 复活节活动)',
        'Replacement parts for a precursor search engine.' : '先驱搜索引擎的备件,',
        'Snowflake has been looking for this for a restoration project' : '雪花正为了一个修复工程寻找这个(2023 复活节活动)',
        'A curious piece' : '一件有趣的',
        'abstract' : '抽象',
        'precursor art, featuring a number' : '艺术先驱作品，展现了一系列',
        'square low-resolution images in a grid pattern' : '呈网格布局的低分辨率图像',
        'Who would want this? Possibly Snowflake.' : '谁会想要这个?大概是雪花吧(2024 复活节活动)',
        'A replica' : '一个设备的',
        'a device' : '复制品',
        'historians believe to have caused' : '历史学家相信它引发了',
        'Great Flood' : '大洪水',
        'arguably triggering' : '可以说它',
        'demise' : '引发了',
        'precursor global information network' : '全球信息网络的消亡前兆',
        'Easter 2024' : '2024复活节活动',

        //旧奖杯
        'One of only 57 limited edition boxes filled with spent ability points. You\'re not quite sure when you picked this up, but something tells you to hang on to it.' : '57 个限量版盒子的其中一个，里面放满了用过的技能点。你很犹豫是否要捡起它，但有个声音告诉你要紧抓住它不放。',
        'These gifts were handed out for the 2009 Winter Solstice. It appears to be sealed shut, so you will need to make Snowflake open it.' : '这些礼物在 2009 年冬至发放。看来这似乎是密封包装，所以你需要请雪花来打开它。',
        'You found these in your Xmas stocking when you woke up. Maybe Snowflake will give you something for them.' : '你醒来时在你的圣诞袜里发现这些东西。说不定雪花会跟你交换礼物。(2009年以来每年圣诞节礼物)',
        'You found this junk in your Xmas stocking when you woke up. Maybe Snowflake will give you something useful in exchange.' : '你醒来时在你的圣诞袜里发现这个垃圾。把它交给雪花或许她会给你一些好东西作为交换。(2009年以来每年圣诞节礼物)', //0.87更新
        'This box is said to contain an item of immense power. You should get Snowflake to open it.' : '传说此盒子封印了一件拥有巨大力量的装备。你应该找雪花来打开它。(年度榜单或者年度活动奖品)',
        'You happened upon this item when you somehow found time to play HV on the gamiest day of the year. It is attached to some strange mechanism.' : '在今年鸟最多的日子，当你不知怎的抓到时间刷 HV 时意外发现这个东西。它和一些奇怪的机械装置接在一起。(《传送门 2》发售纪念)',
        'A coupon which was handled to you by a festival moogle during the Loot and Harvest Festival. Offer it to Snowflake for some bonus loot.' : '一个在战利与丰收节日期间由节日莫古利送给你的礼券。把它交给雪花可以交换额外的战利品。[2020起中秋节活动]',

        'A gift for the 2010 Winter Celebrations. Its surface has a mysterious sheen which seems to bend light in strange ways. You will need to make Snowflake open it.' : '2010 年冬天的庆祝活动的礼物。它的表面呈现不可思议的光泽，看样子是用奇妙的方式反射光线。你需要请雪花来打开它。',
        'If you look it in the mouth, some evil fate may befall you. Hand it to Snowflake instead, and she might give you a little something.' : '如果你检查马嘴，某些恶运可能会降临到你身上。相反地，把它牵给雪花，她会给你一些别的。(2011 圣诞节)',
        'Whoever got you this apparently doesn\'t know you very well. You have no need for souls. Try giving it to Snowflake, she may reward you with something else.' : '无论是谁给你这个，很显然地他对你不甚了解。你根本不需要灵魂。试着把它交给雪花，也许她会给你一些别的报酬。(2012 圣诞节)',
        'A mysterious box with six distinct locks. If you ask Snowflake, chances are she happens to have all six keys required to open it.' : '一个有六种钥匙孔的神秘盒子。如果你请教雪花的话，可能她碰巧持有开盒所需的全部六种钥匙。(2013 圣诞节)',
        'Some geniune and highly decorative reindeer antlers to hang on your wall. Or, you know, trade to Snowflake for something you likely neither want nor need.' : '一些货真价实且极具装饰性的驯鹿鹿角挂在你的墙上。要不，你知道的，和雪花交易把你可能不想要也不需要的东西处理掉。(2014 圣诞节)',
        'It says "Best Friends Forever." Looking at it fills you with determination.' : '它写着“永远的好朋友。”看着它让你充满决心。(2015 圣诞节)',
        'A giant dino egg. The entire shell is still intact. The contents seem to have fossilized, and it seems unlikely that it will ever hatch.' : '一个巨大的恐龙蛋。它的壳还保存得很完整呢。内部看起来好像成为化石了，似乎不太可能会孵化。(2016 圣诞节)',
        'This tooth is very mysterious.' : '这个牙齿非常的神秘(2017 圣诞节)',
        'A very fragile flower. While you would leave it at home rather than take it into battle, handing it to Snowflake for safekeeping seems like the better choice.' : '一朵非常脆弱的花。虽然你宁愿把它留在家里也不愿带入战斗，但把它交给雪花保管似乎是更好的选择。(2018 圣诞节)',
        'A heart, made of iron. While it was capable of protecting you from damage once, it seems to have been spent already. You should give it to Snowflake.' : '一颗钢铁制作的心。在它曾经可用时它可以保护你免受一次伤害，但它现在似乎已经被用过了。你应该把它给雪花。(2019 圣诞节)',
        'A precursor smartgun with autonomous aiming and talking functionality. The name "Skippy" is crudely painted on its side. It seems broken in more ways than one.' : '一把拥有自动瞄准和说话功能的旧世界智能枪。其名称"Skippy"粗犷地喷涂在侧面。它似乎不止一个地方坏了(2020 圣诞节)',
        'Taru da! It\'s a barrel, which may or may not be filled with yummy nomnoms, but you will never know unless you ask Snowflake to open it.' : '塔鲁达！ 这是一个桶，里面可能装满了美味的nomnoms，也可能没有，但除非你让雪花打开它，否则你永远不会知道。(2021 圣诞节)',

        'A badge inscribed with your RealPervert identity. Regardless of whether you fell for it or not, you got this for participating in the 2011 April Fools thread.' : '一个刻着你的实名变态身份的胸章。无论你是否信以为真，你参与了 2011 年愚人节主题就会得到这个。',
        'A 1/10th scale collectible figure of Raptor Jesus. Consolitory prize for those who did not ascend during the May 2011 Rapture.' : '猛禽耶稣的 1/10 比例缩放公仔。给 2011 年 5 月被提发生期间没被送到天上的人开个安慰价格。',
        'Granted to you by Snowflake for finding and handing in all the eggs during the 2011 Easter Event.' : '由雪花授予你，在 2011 年复活节活动寻得并且献上所有彩蛋的证明。',
        'Granted to you by Snowflake for finding and handing in some of the eggs during the 2011 Easter Event. Better luck finding all of them next year.' : '由雪花授予你，在 2011 年复活节活动寻得并且献上部分彩蛋的证明。明年一定会幸运找齐全部的。',
        'Granted to you by Snowflake for finding and handing in all the ponyfeathers during the 2012 Easter Event. Now you, too, can be like Rainbow Dash.' : '由雪花授予你，在 2012 年复活节活动寻得并且献上所有天马的羽毛的证明。现在，你也可以像云宝黛西一样。',
        'Granted to you by Snowflake for finding and handing in some of the ponyfeathers during the 2012 Easter Event.' : '由雪花授予你，在 2012 年复活节活动寻得并且献上部分天马的羽毛的证明。',
        'A crystallized Galanthus flower. Granted to you by Snowflake for finding and handing in all the snowflakes during the 2013 Easter Event.' : '结晶化的雪花莲花朵。由雪花授予你，在 2013 年复活节活动寻得并且献上所有雪花的证明。',
        'A bottle of distilled, 100% pure self-satisfaction. Granted to you by Snowflake for finding and handing in some of the snowflakes during the 2013 Easter Event.' : '一瓶蒸馏过的，100% 纯正的自我满足。由雪花授予你，在 2013 年复活节活动寻得并且献上部分雪花的证明。',
        'A highly polished and shiny commemorative gold coin. This was created especially by the Royal Equestrian Mint for the 2014 Easter Event.' : '高度抛光且闪亮亮的纪念金币。这是皇家阿奎斯陲亚铸币局专为 2014 复活节活动铸造的。',
        'An ancient precursor device, once used to inefficiently mine for magic internet money. Awarded for participating in the 2014 Easter Event.' : '古老的旧世代装置，以前被用来为神奇的网络货币执行毫无效率的挖矿。参与 2014 复活节活动的奖赏。',
        'A USB storage device filled with precursor tentacle porn, extracted from the ancient servers that were recovered during the 2015 Easter Event.' : '塞满了旧世代触手色情档案的随身碟，提取自 2015 复活节活动中复原的古老服务器。',
        'A coupon for a lifetime 10% discount on a VPS plan. Expired many lifetimes ago. A moogle gave you this for participating in the 2015 Easter Event.' : '一次有效期限内享 10% 折扣的虚拟主机方案优惠券。已逾期多次有效期限之久。这是莫古利送给你当作参与 2015 复活节活动的奖赏。',
        'An advanced precursor device capable of projecting a miniature rainbow into the sky. Awarded for participating in the 2016 Easter Event.' : '一部旧世界的先进设备，能在天空投射出一道微型彩虹。参与 2016 复活节活动的奖赏。',
        'An ordinary pot of leprechaun gold designed for use with holographic rainbow projectors. Awarded for participating in the 2016 Easter Event.' : '为搭配全像式彩虹投影机而设计，常见的拉布列康收集的一罐黄金。参与 2016 复活节活动的奖赏。',
        'A technological curiosity of the past, capable of turning perfectly good fruit into an unpalatable blend of mush. [2017 Easter Event]' : '过去的科技珍品，能够完全的将美味的水果做成难吃的糊状混合物。[2017 复活节活动]',
        'That was the theory anyway. It is a sickly brown, and does not look particularly appetizing, but Snowflake seems to love them. [2017 Easter Event]' : '这只是理论上。实际它呈现黯淡的褐色，尤其看起来不能引起食欲，但是雪花女神好像很喜欢。[2017 复活节活动]',
        'A remnant from the last great invasion of undead grammar nazis. It predominately features a swastika stylized with red squiggly lines. [2018 Easter Event]' : '上一次不死人语法纳粹入侵的残余物。它的主要特征是一个带有红色波浪线的纳粹标志。[2018 复活节活动]',
        'An abstract rendition of "Clippy", believed to be the precursor patron saint of spelling errors. [2018 Easter Event]' : '一个“Office助手”表达，被认为是拼写错误的先驱守护神。[2018 复活节活动]',
        'A small selection of assorted collectable precursor coins. [2019 Easter Event]' : '一小部分精选的各种收藏品旧币。[2019 复活节活动]',
        'A first-edition signed copy of "Coping With Change", considered by most numismatists to be *the* authoritative guide to collecting coins. [2019 Easter Event]' : '《应对变化》的初版签名版，被大多数钱币学家视为收集硬币的权威指南。[2019 复活节活动]',
        'A special kind of omikuji that does not actually tell your fortune, but will instead directly grant you some if you offer it to Snowflake.' : '一种特殊的神签，它并不会实际告诉你命运，但是如果你把它献祭给雪花可以直接交换一些东西。[2020起复活节活动]',
        'A precursor beak-shaped mask filled with fragrant herbs, said to protect the wearer from disease and miasma but probably doesn\'t. [2020 Easter Event]' : '一种充满香草药的喙状前体面具，据说可以保护佩戴者免受疾病和瘴气的侵害，但实际可能并不能。[2020 复活节活动]',
        'A paper certifying that the holder was recently vaccinated from some ancient disease. It expired centuries ago and only has historic value. [2021 Easter Event]' : '一张证明持有者最近接种过某种远古疾病疫苗的文件。它已经在好几个世纪前过期，仅具有历史价值。[2021 复活节活动]',
        'A polishing cloth, pine-scented spray bottle and various other maintenance tools to give your Equipment Cores the love they deserve. [2022 Easter Event]' : '抛光布、松香喷雾瓶和其他各种维护工具，为您的设备核心提供应有的爱。[2022 复活节活动]'


    },

    ///////////////////////////////////////////////////////装备
    equipsName: {
        'Your Inventory' : '你的物品',
        'Store Inventory' : '商店物品',
        'Equipment Inventory' : '装备物品',
        'Equipment Storage' : '装备仓库',
        'Available Equipment' : '可选装备',
        'Equip Slots' : '装备库存量',
        'Storage Slots' : '仓库库存量',
        'Current Owner' : '持有者',

        //装备品质
        'Flimsy' : '脆弱',
        'Crude' : '粗糙',
        'Fair' : '普通',
        'Average' : '中等 ',
        'Superior' : '上等',
        '/^Fine /' : '优质 ',
        'Exquisite' : '✧精良✧',
        'Magnificent' : '☆史诗☆',
        'Legendary' : '✪传奇✪',
        'Peerless' : '☯无双☯',

        //法杖类型
        ' Staff' : ' 法杖',
        'Oak' : '橡木',
        'Redwood' : '红木',
        'Willow' : '柳木',
        'Katalox' : '铁木',
        'Ebony':'乌木',

        //装备品质
        'Flimsy' : '脆弱',
        'Crude' : '粗糙',
        'Fair' : '普通',
        'Average ' : '中等 ',
        'Superior' : '上等',
        '/^Fine /' : '优质 ',
        'Exquisite' : '✧精良✧',
        'Magnificent' : '☆史诗☆',
        'Legendary' : '✪传奇✪',
        'Peerless' : '☯无双☯',

        //单手武器
        'Axe' : '斧(单)',
        'Club' : '棍(单)',
        'Rapier' : '西洋剑(单)',
        'Shortsword' : '短剑(单)',
        'Wakizashi' : '脇差(单)',
        'Swordchucks' : '锁链双剑(双)',
        'Dagger' : '匕首(单)',
        //双手武器
        'Great Mace' : '巨锤(双)',
        'Mace' : '锤矛(双)',
        'Estoc' : '刺剑(双)',
        'Longsword' : '长剑(双)',
        'Katana' : '日本刀(双)',
        'Scythe' : '镰刀(双)',
        //盾类型
        'Buckler' : '小圆盾',
        'Kite Shield' : '鸢盾',
        'Force Shield' : '力场盾',
        'Tower Shield' : '塔盾',
        //护甲类型（完整名称优先，避免部分匹配）
        //注意：需要区分"类型标签"和"装备名称中的材质+部位组合"
        //装备名称中的组合（前面有空格），需要分别翻译材质和部位
        '/ Power Armor/' : ' 动力 盔甲',
        //类型标签（独立出现，不在装备名称中）
        'Cotton Armor' : '布甲',
        'Phase Armor' : '相位甲',
        'Shade Armor' : '暗影甲',
        'Leather Armor' : '皮甲',
        'Drakehide Armor' : '龙鳞甲',
        'Gossamer Armor' : '薄纱',
        'Chain Armor' : '锁甲',
        'Plate Armor' : '板甲',
        'Power Armor' : '动力甲',
        'Ironsilk Armor' : '铁丝绸',
        'Kevlar Armor' : '凯夫拉',
        'Reactive Armor' : '反应装甲',
        //护甲材质（单独出现时的翻译）
        'Cotton' : '棉质',
        'Phase' : '相位',
        'Shade' : '暗影',
        'Leather' : '皮革',
        'Drakehide' : '龙鳞',
        'Chain' : '锁甲',
        'Plate' : '板甲',
        'Power' : '动力',
        'Ironsilk' : '铁丝绸',
        'Reactive' : '反应',



        //旧版护甲类型
        'Silk' : '丝绸',
        'Gossamer' : '薄纱',
        'Dragon Hide' : '龙鳞',
        'Kevlar' : '凯夫拉',
        'Chainmail' : '锁子甲',
        //锁子甲特有部位
        'Coif' : '头巾',
        'Mitons' : '护手',
        'Hauberk' : '装甲',
        'Chausses' : '马裤',
        //护甲部位
        'Cap ' : '帽 ',
        '/Cap$/' : '帽 ',
        'Robe' : '长袍',
        'Breastplate' : '护胸',
        'Cuirass' : '胸甲',
        'Gloves' : '手套',
        'Gauntlets' : '护手',
        'Pants' : '裤子',
        'Leggings' : '绑腿',
        'Greaves' : '护胫',
        'Shoes' : '鞋子',
        'Boots' : '靴子',
        'Sabatons' : '铁靴',
        'Helmet' : '头盔',

        //前缀
        'Ethereal' : '虚空(无负重/干涉)',
        'Fiery' : '灼热(火法伤+)',
        'Arctic' : '极寒(冰法伤+)',
        'Shocking' : '闪电(电法伤+)',
        'Tempestuous' : '风暴(风法伤+)',
        'Hallowed' : '神圣(圣法伤+)',
        'Demonic' : '恶魔(暗法伤+)',
        'Reinforced' : '加固的(斩打刺减伤+)',
        'Radiant' : '✪魔光的✪(法伤+)',
        'Mystic' : '神秘的(法爆伤+)',
        'Charged' : '充能的(施速+)',
        'Amber' : '琥珀的(电抗+)',
        'Mithril' : '秘银的(负重-20%)',
        'Agile' : '俊敏的(攻速+)',
        'Zircon' : '锆石的(圣抗+)',
        'Frugal' : '节能的(魔耗-)',
        'Jade' : '翡翠的(风抗+)',
        'Cobalt' : '钴石的(冰抗+)',
        'Ruby' : '红宝石(火抗+)',
        'Onyx' : '缟玛瑙(暗抗+)',
        'Savage' : '残暴的(攻暴伤+)',
        'Shielding' : '盾化的(格挡+)',
        //旧版前缀
        ' Shield ' : ' 盾化的(格挡+) ', //旧版的盾化前缀和盾一模一样……前面已经充分排除其它带盾的应该没问题吧……
        'Bronze' : '铜',
        'Iron' : '铁',
        'Silver' : '银',
        'Steel' : '钢',
        'Gold' : '金',
        'Platinum' : '白金',
        'Titanium' : '钛',
        'Emerald' : '祖母绿',
        'Sapphire' : '蓝宝石',
        'Diamond' : '金刚石',
        'Prism' : '光棱',
        '-trimmed' : '-镶边',
        '-adorned' : '-装饰',
        '-tipped' : '-前端',
        'Astral' : '五芒星',
        'Quintessential' : '第五元素',

        //后缀（使用完整“ of …”匹配，避免全局清理 of/the 的副作用）
        ' of Slaughter' : ' 杀戮(攻击+)',
        ' of Balance' : ' 平衡(攻命攻暴+)',
        ' of Swiftness' : ' 迅捷(攻速+)',
        ' of the Vampire' : ' 吸血鬼(吸血+)',
        ' of the Illithid' : ' 汲灵(吸魔+)',
        ' of the Banshee' : ' 女妖(吸灵+)',
        ' of the Nimble' : ' 灵活(招架+)',
        ' of the Battlecaster' : ' 战法师(魔耗-魔命+)',
        ' of Destruction' : ' 毁灭(法伤+)',
        ' of Focus' : ' 专注(法暴法命+魔耗-)',
        ' of Surtr' : ' 苏尔特(火法伤+)',
        ' of Niflheim' : ' 尼芙菲姆(冰法伤+)',
        ' of Mjolnir' : ' 姆乔尔尼尔(雷法伤+)',
        ' of Freyr' : ' 弗瑞尔(风法伤+)',
        ' of Heimdall' : ' 海姆达(圣法伤+)',
        ' of Fenrir' : ' 芬里尔(暗法伤+)',
        ' of the Elementalist' : ' 元素使(元素熟练+)',
        ' of the Heaven-sent' : ' 天堂(神圣熟练+)',
        ' of the Demon-fiend' : ' 恶魔(黑暗熟练+)',
        ' of the Earth-walker' : ' 地行者(增益熟练+)',
        ' of the Curse-weaver' : ' 织咒者(减益熟练+)',
        ' of the Barrier' : ' 屏障(格挡+)',
        ' of Warding' : ' 护佑(魔减伤+)',
        ' of Protection' : ' 保护(物减伤+)',
        ' of Dampening' : ' 抑制(打减伤+)',
        ' of Stoneskin' : ' 石肤(斩减伤+)',
        ' of Deflection' : ' 偏转(刺减伤+)',
        ' of the Shadowdancer' : ' 影武者(闪避/攻暴+)',
        ' of the Arcanist' : ' 秘法(智力/智慧/魔命+)',
        ' of the Fleet' : ' 迅捷(闪避+)',
        ' of Negation' : ' 否定(抵抗+)',
        // 旧后缀
        ' of Priestess' : ' 牧师',
        ' of the Hulk' : ' 巨物',
        ' of the Ox' : ' 公牛(力量+)',
        ' of the Raccoon' : ' 浣熊(灵巧+)',
        ' of the Cheetah' : ' 猎豹(敏捷+)',
        ' of the Turtle' : ' 乌龟(体质+)',
        ' of the Fox' : ' 狐狸(智力+)',
        ' of the Owl' : ' 猫头鹰(智慧+)',
        ' of the Stone-skinned' : ' 石肤(物减伤+)',
        ' of the Fire-eater' : ' 吞火者(火抗+)',
        ' of the Frost-born' : ' 霜裔(冰抗+)',
        ' of the Thunder-child' : ' 雷之子(雷抗+)',
        ' of the Wind-waker' : ' 驭风者(风抗+)',
        ' of the Thrice-blessed' : ' 三重祝福(圣抗+)',
        ' of the Spirit-ward' : ' 幽冥结界(暗抗+)',
    },

    ///////////////////////////////////////////////////////装备部件
    ////……由于拆分起来比较麻烦装备部件字典和其它部分有内容重叠
    ///////////////////////////////////////////////////////
    equipsPart: {
        'One-Handed Weapon':'单手武器',
        'Two-Handed Weapon':'双手武器',
        'Staff':'法杖',
        'Shield':'盾牌',
        'Cloth Armor':'布甲',
        'Light Armor':'轻甲',
        'Heavy Armor':'重甲',

        'Helmet' : '头部',
        'Body' : '身体',
        'Hands' : '手部',
        'Legs' : '腿部',
        'Feet' : '足部',
    },

    ///////////////////////////////////////////////////////装备说明
    equipsInfo: {
        //装备属性
        'One-handed Weapon':'单手武器',
        'Two-handed Weapon':'双手武器',
        '/^Staff /':'法杖',
        '/^Shield /':'盾牌',
        'Cloth Armor':'布甲',
        'Light Armor':'轻甲',
        'Heavy Armor':'重甲',

        'Condition:':'耐久度:',
        'Energy:':'能量:',
        'Tier':'层级',

        'Untradeable':'不可交易',
        'Tradeable':'可交易',
        'Level ':'装备等级 ',
        'Soulbound':'灵魂绑定',
        'Unassigned':'未确定',
        'Potency Tier':'潜能等级',
        'MAX' : '已满',

        'Ether Tap':'魔力回流',
        'Bleeding Wound':'流血',
        'Penetrated Armor':'破甲',
        'Stunned':'眩晕',
        'Siphon Spirit':'灵力吸取',
        'Siphon Magic':'魔力吸取',
        'Siphon Health':'生命吸取',
        'Ether Theft':'魔力回流',
        'Lasts for':'持续',
        'chance - ':'几率 - ',
        'chance':'几率',
        ' turns':' 回合',
        ' turn':' 回合',
        'points drained':'点吸取量',
        'base drain':'基础吸取量',
        'DOT':'持续伤害比例',

        'Elemental Strike':'属性打击',
        'Fire Strike':'火焰打击',
        'Cold Strike':'冰霜打击',
        'Elec Strike':'闪电打击',
        'Lightning Strike':'闪电打击',
        'Wind Strike':'疾风打击',
        'Holy Strike':'神圣打击',
        'Dark Strike':'黑暗打击',
        'Void Strike':'虚空打击',

        'Damage Mitigations':'属性减伤(%)',
        'Spell Damage':'魔法伤害加成(%)',
        'Fire ':'火焰 ',
        'Cold ':'冰霜 ',
        'Elec ':'闪电 ',
        'Wind ':'疾风 ',
        'Holy ':'神圣 ',
        'Dark ':'黑暗 ',
        'Void ':'虚空 ',
        'Fire':'火焰',
        'Cold':'冰霜',
        'Elec':'闪电',
        'Wind':'疾风',
        'Holy':'神圣',
        'Dark':'黑暗',
        'Void':'虚空',
        'Crushing':'打击',
        'Piercing':'刺击',
        'Slashing':'斩击',

        'Magic Crit Chance':'魔法暴击率',
        'Magic Crit Damage':'魔法暴击伤害',
        'Attack Crit Chance':'攻击暴击率',
        'Attack Accuracy':'攻击命中率',
        'Attack Critical':'攻击暴击率',
        'Attack Damage':'攻击伤害',
        'Parry Chance':'招架率',
        'Magic Damage':'魔法伤害',
        'Magic Critical':'魔法暴击率',
        'Mana Conservation':'魔力消耗降低',
        'Counter-Resist':'反抵抗率',
        'Counter-resist':'反抵抗率',
        'Physical Mitigation':'物理减伤',
        'Magical Mitigation':'魔法减伤',
        'Block Chance':'格挡率',
        'Evade Chance':'回避率',
        'Parry':'招架',
        'Evade':'闪避',
        'Block':'格挡',
        'Resist':'抵抗',
        'Casting Speed':'施法速度',
        'Resist Chance':'抵抗率',
        'Spell Crit':'法术暴击率',
        'Attack Crit Damage':'攻击暴击伤害',
        'Magic Accuracy':'魔法命中率',
        'Counter-Parry':'反招架率',
        'Counter-parry':'反招架率',
        'Attack Speed':'攻击速度',
        'MP Bonus':'魔力加成',
        'HP Bonus':'生命加成',
        'Burden':'负重',
        'Interference':'干涉',

        'Proficiency':'熟练度加成',
        'Elemental':'元素 ',
        'Divine':'神圣',
        'Forbidden':'黑暗',
        'Deprecating':'减益',
        'Supportive':'增益',

        'Primary Attributes':'主属性加成',
        'Strength':'力量',
        'Dexterity':'灵巧',
        'Agility':'敏捷',
        'Endurance':'体质',
        'Intelligence':'智力',
        'Wisdom':'智慧',

        'Upgrades and Enchantments':'强化与附魔',
        'None':'无',
        'Physical':'物理',
        'Magical':'魔法',
        'Damage':'伤害',
        'Defense':'防御',
        'Mitigation':'减伤',
        'Hit Chance':'命中率',
        'Crit Chance':'暴击率',
        'Bonus':'加成',

        // 护符效果名称（简短版本，用于对话框、道具名等）
        'Capacitor':'电容器',
        'Juggernaut':'勇士',
        'Voidseeker':'虚空探索者',
        'Aether':'以太',
        'Butcher':'屠夫',
        'Fatality':'致命',
        'Overpower':'压制',
        'Swift Strike':'迅捷打击',
        'Swiftness':'迅捷',
        'Annihilator':'毁灭者',
        'Archmage':'大法师',
        'Economizer':'节约者',
        'Penetrator':'穿透者',
        'Spellweaver':'织法者',
        'Featherweight ':'轻如鸿毛',
        'Hollowforged':'虚空升华',

        'Coldproof':'抗寒',
        'Darkproof':'驱暗',
        'Elecproof':'绝缘',
        'Fireproof':'耐热',
        'Holyproof':'驱圣',
        'Windproof':'防风',

        'Suffused Aether' : '弥漫的以太',
        'Featherweight Charm' : '轻如鸿毛',
        'Voidseeker\'s Blessing':'虚空探索者的祝福',
        'No Enchantments' : '无附魔',

        'Infused Flames':'火焰附魔',
        'Infused Frost':'冰霜附魔',
        'Infused Lightning':'雷电附魔',
        '/Infused Storms?/':'风暴附魔',
        'Infused Divinity':'神圣附魔',
        'Infused Darkness':'黑暗附魔',
        'Infused 黑暗ness':'黑暗附魔',
    },

    ///////////////////////////////////////////////////////装备强化
    upgrades: {
        // 装备库标签页
        '/^Modify$/' : '改造',
        '/^Repair$/' : '修理',
        '/^Organize$/' : '整理',
        '/^Soulbind$/' : '魂绑',
        'Purchase Equipment' : '购买装备',
        'Purchase' : '购买',
        'Sell Equipment' : '出售装备',
        '/^Sell$/' : '出售',
        'Salvage Equipment' : '分解装备',
        '/^Salvage$/' : '分解',
        'Modify Equipment' : '改造装备',

        // 改造页面 - 符文槽
        'Charm Slot' : '符文槽',
        '(empty)' : '(空)',
        'Charm Points:' : '符文点数:',
        'Attach Charm' : '附加护符',
        'Soulbinding Required' : '需要魂绑',
        'Missing' : '缺少',

        // 符文等级修饰词（用于 "Overpower (Lesser)" 格式，带括号的完整格式）
        'No Charm' : '无护符',
        '(Lesser)' : '(次级)',
        '(Greater)' : '(高级)',
        'Silk Pouch' : '丝绸护符袋',
        'Kevlar Pouch' : '凯夫拉护符袋',
        'Mithril Pouch' : '秘银护符袋',

        // 改造页面 - 升级信息
        '/^Upgrade Tier: (.+)$/' : '升级层级: $1',
        'Next Tier Materials:' : '下一层级材料:',
        'Upgrade Equipment' : '升级装备',
        'Insufficient materials' : '材料不足',
        'Item World Clear Required' : '需要通关道具界',
        '/^\\(Currently Equipped\\)$/' : '(当前已装备)',
        'Challenge Item World' : '挑战道具界',
        'You cannot enter the item world of a currently equipped item.' : '无法进入当前已装备物品的道具界。',
        'Unavailable on Isekai' : '异世界不可用',
        'Confirm Upgrade' : '确认升级',
        'Are you sure you want to spend the requisite materials and credits to upgrade this equipment? Credits and Cores cannot be refunded.' : '你确定要消耗所需材料和信用点来升级这件装备吗？信用点和核心无法退还。',
        'Credits and Cores cannot be refunded.' : '信用点和核心无法退还。',



        // 改造页面 - 基础属性
        'Base Stat Rolls' : '基础属性掷骰',
        'Attack Damage:' : '攻击伤害:',
        'Attack Accuracy:' : '攻击命中:',
        'Attack Crit Damage:' : '攻击暴击伤害:',
        'Physical Mitigation:' : '物理减伤:',
        'Magical Mitigation:' : '魔法减伤:',
        'Crushing Mitigation:' : '打击减伤:',
        'Slashing Mitigation:' : '斩击减伤:',
        'Piercing Mitigation:' : '刺击减伤:',
        'Dexterity:' : '灵巧:',
        'Endurance:' : '体质:',

        // 改造页面 - 操作按钮
        'Stat Fuse Equipment' : '统计融合设备',
        'Rename Equipment' : '重命名装备',
        'Pin Equipment' : '固定装备',
        'Unpin Equipment' : '取消固定',
        'Lock Equipment' : '锁定装备',
        'Unlock Equipment' : '解锁装备',
        'Force Unequip' : '强制卸下',
        'Move To Storage' : '移至存储',
        'Move From Storage' : '移出存储',

        // 重命名弹窗文本
        'Enter a new customized name for your' : '为您的装备输入一个新的自定义名称',
        'Enter a blank name to revert to the default name. Customized names are always removed if the equipment is sold or attached to a MoogleMail.' : '输入空白名称可恢复为默认名称。如果装备被出售或附加到邮件，自定义名称将被移除。',


        // 装备库说明文字（equipblurb）
        'Here you can manage your equipment, as well as modify them using Upgrades, Charms and Stat Fusion. Modifications all require that the equipment is soulbound first.' : '在此处您可以管理装备，并通过升级、附魔与属性融合进行改造。所有改造操作均需先将装备进行灵魂绑定。',
        'Upgrading equipment will increase the number of Charm Points available, and adds bonues relative to its base stats. The maximum number of upgrades for an equipment is capped by the number of cleared Item Worlds.' : '装备升级将提升可用附魔点数，并根据基础属性追加增益效果。单件装备的最大升级次数受已通关道具界层数限制。',
        'Attaching Charms to your equipment can improve or add new stats, or add special effects and various other boons. Charms and Charm Pouches can be obtained by offering trophies in The Shrine, or purchased from other players in The Market.' : '为装备附加附魔可提升或新增属性，亦可获得特殊效果与各类增益。附魔及附魔袋可通过神社供奉战利品获取，或于市场中向其他玩家购买。',
        'Stat Fusion lets you improve Legendary+ equipment by sacrificing another Legendary+ equipment together with various materials to increase its base stats. (Persistent Only)' : '属性融合功能允许您通过献祭另一件 传说+ 装备及多种材料来提升 传说+ 装备的基础属性。（仅限永世界）',
        'Materials for upgrades and stat fusion can be obtained from salvaging unwanted equipment or raising monsters in the Monster Lab, or purchased from other players in The Market.':'升级和属性融合所需的材料可通过分解不需要的装备或在怪物实验室培育怪物获得，也可在市场向其他玩家购买',
        'Select an equipment first to show the available options.' : '请先选择一件装备以显示可用选项。',

        'Forge Upgrade Level' : '锻造等级',
        'Rank' : '等级',
        'Beginner' : '新手',
        'Novice' : '初学者',
        'Apprentice' : '学徒',
        'Journeyman' : '熟练工',
        'Artisan' : '匠人',
        'Expert' : '专家',
        'Master' : '大师',

        'Select an equipment piece from the list to the left\nthen hit Repair Item below to repair it.' : '从左侧列表选择一件装备，然后点击下方 Repair Item 按钮修复它，或者点击下方 Repair All 修理左侧所有装备。',
        'All equipment have a condition and a durability.\nCondition degrades with use. Durability dictates\nwhat the "maximum" condition of an item is and \ntherefore how often it needs to be repaired. When\nan equipment piece degrades below 50% condition\nit will temporarily make the equipment worse by\nreducing its effective stats.' : '所有装备都有耐久度，每击杀一个怪物会消耗0.01的耐久度（等级低于100级不消耗，100-200级消耗减半），在战斗中死亡会扣除全身装备10%的耐久度（低于100级仅扣除2%，100-199级扣除5%）。装备最高耐久度决定了你需要多久修理一次它，当一件装备耐久低于50% 时，它提供的属性加成会降低，当耐久为0%时，将不提供任何属性加成，直到你修复它。',
        'Here you can spend scrap materials to fully\nrestore an equipment piece to its maximum\ncondition. Scrap can be salvaged from unwanted\nequipment or bought from the Item Store.' : '在这里你可以使用素材修复一件装备的耐久度。素材可以通过分解装备或在商店购买获得。',
        'The amount of scrap required to repair an item\ndepends on its percentage-wise degradation.\nEquipment with a high durability will therefore\nneed comparatively less materials over time to\nmaintain.' : '修复装备所需的素材数取决于装备的品质和耐久度损耗百分比，高耐久上限的装备更加耐用，同时维修起来更加划算。',
        'Select an item to see required repair materials.' : '选择一件装备以查看这件装备修复所需材料',
        'Requires:' : '需要:',
        'Everything is fully repaired.' : '该标签页下的所有装备已全部修复',

        // 修理页面文本
        'Total Repair Cost' : '总修理花费',
        'Replace Charms & Pouches' : '替换符文和符文袋',
        'Replace Charms &amp; Pouches' : '替换符文和符文袋',
        'Repair Equipment' : '修理装备',
        'All equipment has a Condition value which degrades when you are defeated in battle, as well as at a fixed rate depending on the equipment Durability and the number of cleared rounds. Repairs require different Scrap Material corresponding to the equipment type; these can be salvaged from low-grade equipment, or bought from the Item Store or The Market.' : '所有装备都有耐久度，当你在战斗中被击败时耐久度会下降，同时也会根据装备的耐久上限和通关回合数以固定速率下降。修理需要与装备类型对应的废料素材；这些素材可以通过分解低品质装备获得，或从道具店或交易市场购买。',
        'Magitech equipment and equipment with attached charms will also have an Energy value. Energy is consumed at a fixed rate depending on the number of cleared rounds. Recharging energy requires Energy Cells; these can be salvaged from magitech equipment, or bought from the Item Store or The Market. Attached charms affect the required number of energy cells and can also require other upkeep materials.' : '魔导科技装备和附加了符文的装备还有能量值。能量会根据通关回合数以固定速率消耗。充能需要能量元；这些可以通过分解魔导科技装备获得，或从道具店或交易市场购买。附加的符文会影响所需能量元的数量，也可能需要其他维护材料。',
        'When you are defeated in battle, any charms attached to your equipment have a chance to take damage. If a charm is protected by a pouch, this can destroy the pouch, exposing the charm. If the charm is exposed, any damage will cause it to tear. Torn charms and destroyed pouches can be replaced with spare charms and pouches from your inventory; these can be obtained in the Item World or by offering trophies in The Shrine, or bought from other players in The Market.' : '当你在战斗中被击败时，装备上附加的符文有几率受到损坏。如果符文被符文袋保护，损坏会摧毁符文袋并暴露符文。如果符文已暴露，任何损坏都会导致其撕裂。撕裂的符文和被摧毁的符文袋可以用背包中的备用符文和符文袋替换；这些可以在道具界获得，或在雪花祭坛献祭战利品获得，或从交易市场向其他玩家购买。',

        // 整理页面文本
        'Organize Equipment' : '整理装备',
        'This page allows you to organize your equipment.' : '本页面可帮助您整理装备。',
        '📌 Pinned equipment are always sorted before unpinned equipment for each respective equipment type.' : '📌 置顶装备始终会在各类装备类型中优先于未置顶装备显示。',
        '🔒 Locked equipment are protected from various dangerous actions. Specifically, they will not show up on the Sell or Salvage pages or for MoogleMail attachments, and cannot be sacrificed for Stat Fusion. You can still repair, upgrade and modify charms for locked equipment.' : '🔒 已锁定装备会受到保护，避免各种危险操作。具体来说，它们不会出现在出售或分解页面，也不能用于莫古力邮差附件或作为属性融合的祭品。您仍可对已锁定装备进行修理、升级和护符修改。',
        '📦 Stored equipment are hidden on all equipment lists except for the one on this page, and are not available for any actions. These will not count towards your regular equipment limit unless your equipment storage overflows.' : '📦 已储存的装备在此页面以外的所有装备列表中均被隐藏，且无法进行任何操作。除非您的装备存储空间溢出，否则这些装备不计入常规装备限制。',
        '🗡️ Equipped equipment is (obviously) used as an indicator for equipment that is currently equipped, even if it is in a different equipment set or profile. These cannot be stored; attempting this will be silently ignored. They can however still be pinned or locked.' : '🗡️ 已装备的装备（显然）用作当前已装备物品的指示器，即使它位于不同的装备套装或配置文件中。这些装备无法被储存；尝试此操作将被静默忽略。但它们仍然可以被固定或锁定。',
        'Inventory Capacity:' : '仓库容量:',
        'Storage Capacity:' : '存储容量:',
        'Pinned' : '固定',
        'Locked' : '锁定',
        'Stored' : '存储',
        'Unchanged' : '不变',
        'Enable' : '启用',
        'Clear' : '清除',
        'There are no available equipment this type.' : '此类型没有可用的装备。',

        // 灵魂绑定页面文本
        'Soulbind Equipment' : '灵魂绑定装备',
        'Required Items' : '所需物品',
        'Equipment normally has a fixed level that determines the scaling of its stats. Some low-quality equipment drops with an unassigned level; in that case, it will be assigned to your current level when you first equip it.' : '装备通常具有固定等级，该等级决定其属性的缩放。某些低品质装备掉落时未分配等级；在这种情况下，当你首次装备它时，它将被分配为你的当前等级。',
        'Soulbinding equipment will permanently bind it to you, and makes it always scale to your level. This will also let you access its Item World, as well as enabling the use of Upgrades, Charms and Stat Fusions to improve it.' : '灵魂绑定装备会将其永久绑定到你身上，并使其始终与你的等级同步。这还将允许你进入该装备的道具界，以及使用升级、符文和属性融合来改进它。',
        'Soulbound equipment becomes permanently untradeable, and can no longer be salvaged. It can still be sold in the Equipment Shop, but cannot be purchased by anyone else. Soulbinding cannot be reversed under any circumstances.' : '灵魂绑定的装备会永久变为不可交易，并且不能再被分解。它仍然可以在装备商店出售，但其他人无法购买。灵魂绑定在任何情况下都无法逆转。',
        '/You cannot soulbind equipment more than (\\d+) levels above your current level\\. As of right now, you can soulbind equipment up to Level (\\d+)\\. Equipment that you cannot soulbind are not listed here\\./' : '你不能灵魂绑定超过当前等级 $1 级以上的装备。目前，你可以灵魂绑定最高等级 $2 的装备。无法灵魂绑定的装备不会在此列出。',
        'Soulbinding costs a number of Soul Fragments depending on its quality and how much higher level it is compared to you.' : '灵魂绑定需要消耗一定数量的灵魂碎片，具体取决于装备的品质以及它比你高出多少等级。',
        'Available Soul Fragments:' : '可用灵魂碎片:',

        // 购买页面文本
        'Current Balance:' : '当前余额:',
        'Here you can purchase tradeable equipment that was sold by other players. Most of the listed equipment can also be purchased by other players at any time, and is regularly cleared out to make room for new stock, so you will want to be quick if you see something you want.' : '在这里你可以购买其他玩家出售的可交易装备。列出的大多数装备随时都可能被其他玩家购买，并且会定期清理以腾出空间给新库存，所以如果你看到想要的东西，就要快速下手。',
        'You can also buy back soulbound, salvaged or untradeable equipment that you previously sold yourself, as well as salvage remains that was sold when you manually salvaged equipment. These cannot be bought by other players, but will only be available for a limited time.' : '你还可以回购自己之前出售的灵魂绑定、已分解或不可交易的装备，以及手动分解装备时出售的分解残骸。这些物品其他玩家无法购买，但仅在有限时间内可用。',
        'Equipment that was automatically sold or salvaged by a traveling salesmoogle during battle cannot be bought back, since it never really existed in the first place.' : '战斗中由旅行商人莫古自动出售或分解的装备无法回购，因为它们从一开始就不是真正存在的。',
        'Confirm Purchase' : '确认购买',
        'Are you sure you want to buy the' : '你确定要购买',
        'selected equipment?' : '件选中的装备吗？',

        // 出售页面文本
        'Here you can sell equipment you no longer need in exchange for Credits. Any tradeable equipment you sell can be bought by other players.' : '在这里你可以出售不再需要的装备以换取金币。你出售的任何可交易装备都可以被其他玩家购买。',
        'If you sell soulbound, salvaged or untradeable equipment, they cannot be bought by anyone else; you can however still buy them back yourself for a limited time, at an exorbitant markup.' : '如果你出售灵魂绑定、已分解或不可交易的装备，其他人无法购买；但你自己仍然可以在有限时间内以高昂的价格回购它们。',

        // 确认对话框（需要匹配分割后的文本节点）
        'Confirm Action' : '确认操作',
        'Confirm Sell' : '确认出售',
        'Confirm Purchase' : '确认购买',
        'Confirm Salvage' : '确认分解',
        'Confirm Attach' : '确认附加',  // 护符附加确认
        '/Are you sure you want to 💰\\s*$/' : '你确定要 💰 ',  // 匹配第一个文本节点
        '/Are you sure you want to ❌\\s*$/' : '你确定要 ❌ ',  // 匹配分解对话框第一个文本节点
        '/Are you sure you want to attach a new charm in/' : '确定要在',  // 护符附加对话框开头
        'Slot' : '槽位',  // "Slot 1" 翻译
        ' with a ' : ' 使用 ',
        '/by spending the following materials:/' : '消耗以下材料：',  // 材料清单提示
        'SELL' : '出售',  // 匹配 <strong> 内的文本
        'BUY' : '购买',
        'SALVAGE' : '分解',
        '/^\\s*💰 the\\s*$/' : ' 💰 ',  // 匹配出售对话框中间部分
        '/^\\s*❌ the\\s*$/' : ' ❌ ',  // 匹配分解对话框中间部分
        '/^\\s*selected equipment\\?\\s*$/' : ' 选中的装备吗？',  // 匹配结尾部分
        'Soulbound and non-tradeable equipment can be bought back for a limited time. Other equipment can also be bought by other players.' : '灵魂绑定和不可交易的装备可以在有限时间内回购。其他装备也可以被其他玩家购买。',
        'Check both safety boxes to continue.' : '勾选两个安全框以继续。',



        // 分解页面文本
        'Salvaging equipment you no longer need will allow you to extract useful materials that can be used for upgrading or repairing other equipment.' : '分解你不再需要的装备可以提取有用的材料，这些材料可用于升级或修理其他装备。',
        'After salvaging, in addition to the extracted materials, the equipment itself will turn into Salvage Remains. You can either keep these, or sell them for a small amount of credits. Salvage Remains are only listed under the Salvaged tabs; they cannot be equipped or modified unless they are repaired, which will restore them to their original condition.' : '分解后，除了提取的材料外，装备本身会变成分解残骸。你可以保留这些残骸，或者以少量金币出售它们。分解残骸仅在"已分解"标签下列出；除非修复，否则无法装备或改造，修复后会恢复到原始状态。',
        'Repairing salvage remains will require all the materials you obtained from salvaging them, in addition to the normal repair materials for repairing from zero Condition and Energy.' : '修复分解残骸需要你从分解中获得的所有材料，以及从零耐久度和能量修复所需的正常修理材料。',
        'Salvaging an upgraded equipment will return 90% of the base materials spent upgrading it. It will not return cores or credits, nor any materials used for Stat Fusion.' : '分解升级过的装备将返还升级所用基础材料的 90%。核心、信用点以及用于属性融合的材料均不返还。',
        'Note that it is no longer possible to extract materials that was spent upgrading equipment.' : '请注意，已经无法提取用于升级装备的材料了。',
        ' Sell Salvaged Equipment' : '出售分解装备',
        'Confirm Salvage' : '确认分解',
        'You have selected a SOULBOUND equipment.' : '你选择了灵魂绑定的装备。',
        '/Are you sure you want to ❌ <strong>SALVAGE<\\/strong> ❌ the %(\\d+)% selected equipment/' : '你确定要 ❌ <strong>分解<\\/strong> ❌ 选中的 $1 件装备吗',
        'If you sell the salvage remains, they can be bought back for a limited time. Salvage remains must be repaired to restore them to usable condition, requiring more materials than you get from salvaging.' : '如果你出售分解残骸，可以在有限时间内回购。分解残骸必须修复才能恢复到可用状态，所需材料比分解获得的更多。',

        'Select an equipment piece from the list to the left\nthen hit Show Upgrades below to show a list over\nstats that can be upgraded.' : '从左侧列表选择一件装备，然后点击下方 Show Upgrades 查看可用强化。',
        'Upgrades allow you to spend materials to boost\nthe stats of your equipment. Upgrades require\na binding that correspond to the stats you\nwish to upgrade and some materials that\ncorrespond to the gear you are upgrading.\nA catalyst item of a tier corresponding to\nthe equipment quality and upgrade level will\nalso be needed.' : '装备强化允许你使用各种素材来加强你的装备属性。每一级强化都需要根据装备品质、材质和强化等级消耗对应级别的材料和催化剂，当你强化一个属性超过5级之后每一级强化还需要消耗一个对应属性的粘合剂(异世界模式不需要粘合剂)',
        'Rare equipment types will also require a special\ncomponent to upgrade. This component is only\nneeded to increase the highest stat - if you\npreviously spent five of them to increase a stat\nto Level 5 then every other stat can be increased\nto Level 5 without spending any additional rare\ncomponents.' : '强化稀有装备还需要额外花费特殊素材，特殊素材只需要在一项上花费即可。打个比方 - 如果你已经将一项强化升级到5级并使用了5个特殊素材，那么将其他项目强化提升到5级就不需要花费额外的特殊素材了，只有继续将一项强化升级为6级时才需要再消耗1个特殊素材。',
        'Leveling equipment to its highest potential by \nupgrading it or leveling it in the Item World\nwill also unlock the ability to give it a custom\nname from this screen.' : '装备的强化等级上限却决于你的锻造等级，每次强化装备时，根据你所使用的基础素材等级和数量，你可以获得一定的锻造经验，装备也将得到你获得锻造经验的10%作为潜经验，当你通过道具界或者强化使一件装备达到它的最高潜能等级后，你可以随意在强化界面修改装备的显示名称。',

        'Select an equipment piece from the list to the left\nthen hit Show Enchantments below to show a list\nof upgrades that can be applied.' : '从左侧列表选择一件装备，然后点击下方 Show Enchantments 按钮查看可用附魔。',
        'Every enchantment requires a consumable item\nto activate. The effect wears off after a\ncertain number of minutes real-time but can\nbe extended indefinitely by applying the same\nenchantment multiple times.' : '附魔需要消耗附魔道具并有持续时间，以现实时间的分钟计算，超过有效时间之后附魔就会失效。重复附魔可以延长持续时间。',
        'Enchantments will also wear off immediately\nif the item is sold or sent through MoogleMail.' : '附魔效果在装备售出或寄出后会立即失效。',

        'Select an equipment piece from the list to the left\nthen hit Salvage Item below to salvage it. This will\npermanently destroy the item in question.' : '从左侧列表选择一件装备，然后点击下方 Salvage Item 分解装备。此操作将会摧毁装备（分解后24小时内可以在商店里买回，价格至少为售价的5倍或者10000C，且装备潜能等级会被重置并会变成不可交易）',
        'You have a chance to get some forge upgrading\nmaterials when you salvage an item. The type\ndepends on the kind of item salvaged while the\ntier depends on the quality of the item as well\nas a random chance. At the very least you will\nreceive some scrap that can be used to repair\nother items.' : '你有机会通过分解装备获得一些用于装备升级的材料。分解出的素材种类取决于被分解装备的类型与品质，分解获得的材料数量也有一定的随机波动。但至少，你可以获得用各种废料素材来修理其他装备。',
        'You have a chance to get some forge upgrading\nmaterials when you salvage an item. The type\ndepends on the kind of item salvaged while the\ntier depends on the quality of the item as well\nas a random chance. At the very least you will\nreceive some scrap that can be used to repair\nother items.' : '分解装备可以获得一些素材用于强化或者修复装备。分解出的素材种类取决于被分解装备的类型与品质，现在上等及以上装备分解你会获得对应品质的强化素材，中等或更差的装备分解可以获得一些对应的废料用来修理其他装备，稀有装备类型分解还可以获得一些能量元。每件装备现在只能获得一次基础分解素材，也就是说如果你分解一件装备之后再次从商店购买回来分解将无法再次得到上述素材。', //0.87变更，作为对照上原文保留
        'If an equipment piece has been upgraded in the\nforge then salvaging it will return 90% of the\nmaterials spent upgrading it. Catalyst items\ncannot be recovered this way.' : '分解一件被强化过的装备会返还 90% 使用的强化材料。催化剂无法通过分解装备回收。',

        'Select an equipment piece from the list to the left\nthen hit Reforge Item below to reforge it.' : '从左侧列表选择一件装备，然后点击下方 Reforge Item 按钮重铸它,不能重铸加锁装备。',
        'Reforging an item will reset its potential to zero\nwhich removes all of its unlocked potencies. This\nallows you to start over and take another shot\nat getting your desired potencies from upgrading\nor leveling the item in the Item World.' : '重铸一件装备会将该装备的潜能等级重置为0，同时清空该装备所有已解锁的潜能，这使你可以去道具界重新尝试解锁你想要的潜能。',
        'This costs one Amnesia Shard for every level of\nunlocked potential.' : '重铸一件装备将消耗等同于该装备已解锁潜能等级的重铸碎片。(如果购买了对应的hath能力，则消耗减半)',

        'Select an equipment piece from the list to the left then hit Soulfuse Item below to permanently bind it to you. This will make it level as you do. There is no way to break this bond, but the item can still be salvaged or sold.' : '从左侧列表选择一件装备，然后点击下方 Soulfuse Item 将该装备与你进行永久绑定。灵魂绑定之后该装备属性将与你的等级同步。此绑定无法解除，但是装备仍然可以被分解或者出售给系统店。',
        'The cost for soulfusing with an item depends both on your level and how many levels below you the item is.' : '灵魂绑定消耗的碎片数量取决于装备的品质以及该装备比你高出的等级数。灵魂碎片无法交易,可以在商店购买或通过定期在画廊中出现遭遇战获得',
        'You cannot soulfuse items that have a gear level higher than 100 above your current level. Right now, you can soulfuse equipment up to level' : '你不能灵魂绑定超过自己超过100级以上的装备。目前，你可以灵魂绑定的最高装备等级是',

        'You currently have ' : '你当前拥有 ',
        'Amnesia Shards' : '个重铸碎片',
        'Soul Fragments' : '个灵魂碎片',
        '/Fusing with the selected item will cost (\\d+) fragments\./' : '灵魂绑定所选装备需要 $1 个灵魂碎片',
        '/Reforging the selected item will cost (\\d+) shards?./' : '重铸所选装备需要消耗 $1 个重铸碎片。',
        'The selected item does not have any potencies' : '选中的装备没有潜能等级',
        'This will permanently destroy the item': '注意,这将摧毁装备',

        'Available Upgrades' : '可用强化',
        //可强化和附魔项目使用equipsInfo字典
        'At max upgrade level' : '已到达锻造等级上限',
        'Hover over an upgrade to get a list of necessary' : '鼠标停留在升级项目上以查看升级需要的材料',
        'Required items for next upgrade tier' : '提升到下级所需材料',
        //强化和附魔所需材料使用items字典
        'Materials to perform it.' : ' ',
        'Effect:' : '效果:',
        'Base' : '基础',
        'Grants' : '获得',
        'Forge EXP and' : '冶炼经验以及',
        'Gear Potency' : '装备潜经验值',
        'None' : '无',

        'Available Enchantments' : '可用附魔',
        'Hover an enchantment to get a description' : '鼠标停留在附魔项目上',
        'And list of required items.' : '以查看附魔介绍和所需材料',
        'Required items to apply enchantment' : '所需附魔材料',

        'This enchantment temporarily changes the weapon' : '将武器的伤害类型转换为虚空',
        'Damage type to Void. This makes it effectively' : '虚空伤害无视',
        'Ignore the physical defenses of most monsters' : '大部分怪物的物理防御力',
        'It also greatly increases your chance to hit.' : '且增加你 50% 物理命中（双持效果不可叠加）',

        'This enchantment will temporarily suffuse your' : '将武器用以太附魔',
        'Weapon with a powerful aether flux. This reduces' : '这将降低你10%魔力消耗',
        'The drain on your magic reserves when casting' : '以及增加50%的魔法命中',
        'Spells. It will also let you land spells on your' : '双持效果不可叠加',
        'Opponents with a higher rate of success.' : '',

        'This enchantment will temporarily reduce all' : '这个附魔将暂时降低',
        'Movement and spell casting penalties from a' : '装备上的负重与干扰',
        'Piece of equipment. This lets you use heavier' : '7点或50%',
        'Weapons, shields and armor pieces with a lower' : '以较高值为准',
        'Impact to mobility and spell power.' : '',

        'This enchantment will temporarily' : '这个附魔会暂时',
        'Imbue your armor with additional' : '给护甲附加上5%的',
        'Imbue your weapon with the elemental' : '给你的武器附加',
        //打击效果使用equipsInfo字典
        'effect. (max 2 strikes)' : '效果（武器除虚空打击外最多可有两个打击效果）',

        'Resistance to Fire' : '对火属性减伤',
        'Resistance to Cold' : '对冰属性减伤',
        'Resistance to Elec' : '对电属性减伤',
        'Resistance to Wind' : '对风属性减伤',
        'Resistance to Holy' : '对圣属性减伤',
        'Resistance to Dark' : '对暗属性减伤',

        'Duration:' : '持续时间:',
        'minutes' : '分钟',

    },

    ///////////////////////////////////////////////////////设置
    settings: {
        'When you get too powerful to be challenged by the mobs on the normal difficulty, you can increase the Challenge Level here.' : '当你变的足够强大，感到对付当前难度的怪物已经没有挑战性的时候，你可以在这里改变游戏的难度等级。',
        'Playing on a higher Challenge Level will increase the EXP you get from each mob, but the mobs have increased HP and hit harder' : '在更高的难度等级下，你会获得更好的掉落，更多的经验与Credit，怪物也将变的更强',
        'Challenge Level' : '难度等级',
        'Challenge' : '名称',
        //难度名称使用独立的difficulty字典
        'EXP Mod' : '经验倍率',
        'Balanced Fun' : '平衡而有趣',
        'Somewhat Tricky' : '有些棘手(怪物生命✖1.1，怪物伤害✖1.2，获得的Credits✖1.25，水晶✖1.2，掉落装备品质加成✖1.5)',
        'Pretty Tough' : '确实挺难的(怪物生命✖1.2，怪物伤害✖1.4，获得的Credits✖1.5，水晶✖1.4，掉落装备品质加成✖2)',
        'Even Tougher' : '还能更难(怪物生命✖1.4，怪物伤害✖1.6，获得的Credits✖1.75，水晶✖1.6，掉落装备品质加成✖2.5，开始掉落"传奇"/"无双"装备)',
        'Old School' : '像小时候的红白机游戏一样无情(怪物生命✖1.7，怪物伤害✖2，获得的Credits✖2.2，水晶✖2，掉落装备品质加成✖3，掉落装备最低品质为"中等")',
        'I Wanna Be The Hentai' : '我要成为大Hentai(怪物生命✖2，怪物伤害✖2.5，获得的Credits✖3，水晶✖2.5，掉落装备品质加成✖5)',
        'Smiles' : '微笑 :-)(怪物行动速度+25%，抵抗/招架率+10%，魔法/灵力再生率+50%，怪物生命✖2，怪物伤害✖3，获得的Credits✖3，水晶✖3，掉落装备品质加成✖6，掉落装备最低品质为"上等")',

        'Display Title' : '称号一览',
        'Here you can choose which of your available titles that will be displayed below your level and on the forums.' : '在这里可以选择你的称号，称号会显示在你的等级下方以及论坛中',
        'Effect' : '效果',
        'Title' : '称号',
        'Newbie' : '新人',
        'Novice' : '入门者',
        'Beginner' : '初学者',
        'Apprentice' : '学徒',
        'Journeyman' : '熟练工',
        'Artisan' : '工匠',
        'Expert' : '专家',
        'Master' : '大师',
        'Champion' : '冠军',
        'Hero' : '英雄',
        'Lord' : '领主',
        'Ascended' : '升华者',
        'Destined' : '天选者',
        'Godslayer' : '弑神者',
        'Dovahkiin' : '龙裔',
        'Ponyslayer' : '小马杀手（也可使用龙吼）',
        '% Damage' : '% 攻击伤害',
        '% Evade' : '% 闪避率',
        'The power of the Dragonborn.' : '10.0% 攻击伤害, +3% 闪避率 并可使用龙吼',
        'Level Default' : '自动选择（根据当前等级）',
        'See Below' : '见下表（到“领主”为止）',
        'No Bonus' : '无加成',

        'Font Engine' : '文字引擎',
        'Here you can choose a custom font instead of the standard HentaiVerse font engine.' : '在这里你可以选择使用自定义字体取代HV的默认字体，',
        'This mostly affects how fast pages will render and how pretty they will look.' : '这将大幅改善页面的加载速度以及页面显示的字体效果。（为了完全汉化其它内容及更好的使用其它脚本，你必须设置自定义字体）',
        'Use Custom Font (specify below - this font MUST be installed on your local system to work)' : '使用自定义字体（下方字体名称必填，所指定的字体如果本地系统内没有安装会自动使用其它字体替代）',
        'font-family' : '字体名称',
        'font-size' : '字体大小',
        'font-weight' : '字体深浅',
        'font-style' : '字体版式',
        'vertical adjust' : '垂直调整',
        'Allowed' : '可选',
        '5 to 20 (points)' : '5 ~ 20 号（请输入数字）',
        'normal, bold, bolder, lighter' : '普通(normal),粗体(bold),粗体+(bolder),细(lighter)（请输入对应英文）',
        'normal, italic, oblique' : '普通(normal),斜体(italic),斜体+(oblique)（请输入对应英文）',
        '-8 to 8 pixels (tweak until text appears centered)' : '-8 ~ 8 像素（请输入数字，可适当调整使文字垂直居中）',

        'Equipment Sets' : '套装设定',
        'If you want to have separate slotted abilities, battle items and skillbars/autocast assignments per equipment set for your current persona, you can toggle the options below. ' : '默认情况下，同一个人格角色下的所有装备套装共享一样的技能、战斗物品、快捷栏、自动施法配置。如果你想让不同的装备套装使用不同的各项配置，你可以在这里更改选项。',
        'If this is changed, the current persona\'s shared set will be assigned to Set 1 and vice versa. This can be set differently for each persona.' : ' 如果以下选项被勾选，则当前人物角色该项的原有设置将仅应用于套装1，其它套装可以重新设置，当取消勾选时则当前人格角色下所有套装的该项配置将重新使用原有套装1的设置。',
        'Use Separate Ability Set Assigments' : '使用不同的技能配置',
        'Use Separate Battle Item Assigments' : '使用不同的战斗物品配置',
        'Use Separate Skillbar/Autocast Assignments' : '使用不同的快捷栏及自动施法配置',

        'Vital Bar Style' : '状态值显示设置',
        'You can either use the standard bar which uses pips for charges, or a more utilitarian (and skinnable) bar that has numerical bars for everything.' : '你可以使用预设的两端缩进式（类似上古卷轴）血条来表示生命值，圆点来表示斗气槽，也可以使用更直观的通常血条来表示生命值和斗气槽。',
        'Standard' : '预设',
        'Utilitarian' : '通常',

        'Shrine Trophy Upgrades' : '升级献祭奖杯',
        'By default, as you gain levels, Snowflake will start accepting more lower-tier trophies for a higher-trophy roll in the Shrine. You can override this behavior here.' : '随着你等级的提升，你可以将多个低级奖杯一同献祭给雪花女神以获得更高级别奖杯的奖励，你可以在下面更改升级设置。',
        'Use Default' : '默认设置（自动选择，200级自动选择升级至等级3，300级时选择升级至等级4，400级时选择升级至等级5）',
        'Upgrade to Tier 3' : '升级至等级3（消耗4个T2奖杯以获得T3奖杯的奖励，同时使奖杯的总献祭价值增加至1.1倍）',
        'Upgrade to Tier 4' : '升级至等级4（消耗8个T2奖杯或4个T3奖杯以获得T4奖杯的奖励，同时使奖杯的总献祭价值提升为1.2倍）',
        'Upgrade to Tier 5' : '升级至等级5（消耗32个T2奖杯或8个T3奖杯或4个T4奖杯以获得T5奖杯的奖励，同时总献祭价值提升为1.3倍）',
        'Do Not Upgrade' : '不升级',

        'Quickbar Slots' : '快捷栏',
        'Here you can set up which spells will appear on the battle screen quickbar.' : '这里你可以设定战斗中显示的技能快捷栏',
        '/Set (\\d+) is selected/' : '当前使用的设置为套装$1',
        //技能法术名称使用独立的skills字典
        'Not Assigned' : '未设置',

        'Auto-Cast Slots' : '自动施法',
        'Here you can set which spells will be automatically cast at the start of each battle' : '这里你可以选择在战斗中持续释放的法术，这些法术效果会常驻在状态栏，但是会每回合消耗你的魔力',
        'Note that you have to unlock one or more' : '你可以在hath能力中解锁',
        'to use these' : '使自动施法的消耗更低',
        'If your MP decreases below 10%, the innate spells will dissipate. They will be recast when it goes back above 25%.' : '如果你的MP低于10%，这些法术效果将会消失，直到你的MP回复到25%以上',
        'Upkeep' : '维持法术需消耗',
        'MP/round' : '魔力/回合',
        'Autocast' : '自动施法槽',

        'Auto-Sell / Auto-Salvage' : '自动出售/自动分解',
        'If you want to automatically dump junk equipment on the closest travelling salesmoogle or break it down into parts, you can do so here. ' : '如果你打算自动把垃圾装备就近出售给路过的商人或者将其分解成零件，你可以在这里设置装备过滤器。',
        'All equipment of the specified qualify and below will be automatically sold or turned in to salvage. ' : '所有你所指定品质及以下的装备将会在获得时被自动出售或者分解。',
        'If a dropped equipment qualifies for both sell and salvage, the action with the lowest required quality will be taken.' : '如果一类装备同时设置了自动出售和自动分解，则优先执行对装备品质要求低的，如果品质要求相同，则优先出售，',
        'No Auto-Sell' : '不自动出售',
        '/^Sell (\\w+)$/' : '自动出售 $1 或更低品质',
        'No Auto-Salvage' : '不自动分解',
        '/^Salvage (\\w+)$/' : '自动分解 $1 或更低品质',
        '/ Armor$/' : ' 护甲',

        'Apply Changes' : '确认更改',
    },


    ///////////////////////////////////////////////////////采购机器人
    itemBot: {
        'New/Edit Bot Task' : '编辑/创建一个新的采购任务',
        'Select Item' : '选择一项道具',
        'Select an item' : '选择一件道具',
        'Max Item Count' : '采购数量',
        'Max Bid Per Item' : '你的出价',
        'Minimum Price' : '最低允许出价',
        'Current High Bid' : '目前最高出价',
        'Active Bot Tasks' : '已激活的采购任务',
        'Create Backorder' : '创建订单',
        'Update Backorder' : '更新订单',
        'Delete Backorder' : '删除订单',
        'Placing a backorder will allow you to automatically buy items that are sold to the item shop. The max bid should be set to the maximum value you are willing to pay for an item. If you are the highest bidder for a sold item, you will pay whatever the second highest bidder offered, or the minimum price (normal buying price) if there are no other backorders.' : '创建一个采购订单将允许你自动购买别人出售在商店的物品。最高出价应当永远设置为你愿意支付的最高价格。如果你是最高出价者，你将支付第二出价者的出价获得商品，如果你是唯一的出价者，那你将以最低价获得该订单。',
        'You only pay for items if and when the backorder is filled. If your account does not have sufficient credits whenever an item is sold, your backorder will be deleted.' : '你仅在该订单成立时支付货款。如果订单成立时你的账户余额不足以支付该订单，你的订单将会被删除。',
    },

    ///////////////////////////////////////////////////////交易市场
    market: {
        '/Consumables?/' : '消耗品',
        '/Materials?/' : '材料',
        '/Trophies|Trophy/' : '奖杯',
        '/Artifacts?/' : '文物',
        '/Figures?/' : '小马雕像',
        '/Monster Items?/' : '怪物物品',

        'Account Balance' : '账户余额',
        ' Withdraw ' : ' 提款 ',
        ' Deposit ' : ' 存款 ',
        'Market Balance' : '市场余额',
        'Browse Items' : '查看市场',
        'My Buy Orders' : '我的买单',
        'My Sell Orders' : '我的卖单',
        'Market Log' : '市场记录',
        'Account Log' : '帐号记录',
        '/^Trade Log$/' : '交易记录',

        'There are no items matching this filter' : '当前没有符合筛选条件的物品',
        'There are no orders for this type of item' : '当前类别没有订单',
        'There are no recent market events.' : '最近没有市场活动',
        'Only With Sellable Stock' : '只看可出售库存',
        'Only With Buyable Stock' : '只看可购买库存',
        'Show Obsolete Items' : '显示绝版物品',
        'Your Stock' : '你的库存',
        'Market Bid' : '市场出价',
        'Market Ask' : '市场要价',
        'Market Stock' : '市场库存',
        'Placing sell orders is locked for the first' : '在异世界每季度最开始前24小时',
        '24 hours of each Isekai season.' : '投放卖单将被临时禁用',

        'You have ': '你有 ',
        ' available to sell. This item is traded in batches of ' : ' 件库存可供出售。本物品出售单位为每组 ',
        '; all prices are per batch. Min price is ' : ' 件, 以下价格都是以组为单位。市场最低出价为 ',
        ' available to sell. This item is traded in single units. Min price is ' : ' 件库存可出售。本物品出售单位为一件，市场最低出价为',
        ' for market orders.' : '.',
        ' for market orders and ' : ', 商店最低供货价为 ',
        ' for backorders.' : '.',
        'Can always be bought for ' : '商店直接供货价为 ',
        'Item cannot be backordered.' : '本物品不支持系统店进货',

        'Your Sell Order' : '你的卖单',
        'Sell Count:' : '出售数量',
        'Min Ask Price:' : '最低卖价',
        'Ask Price:' : '卖价',
        'Stock:' : '库存',
        'Place Sell Order' : '投放卖单',
        'Min Undercut' : '最低减价',
        'Available Sell Orders' : '当前卖单',
        'No sell orders found' : '当前没有卖单',
        'Your Buy Order' : '你的买单',
        'Buy Count:' : '购买数量',
        'Min Bid Price:' : '最低买价',
        'Bid Price:' : '买价',
        'Order Total:' : '总价',
        'Min Overbid' : '最低加价',
        'Place Buy Order' : '投放买单',
        'Update' : '更新',
        'Delete' : '删除',
        'Available Buy Orders' : '当前买单',
        'No buy orders found' : '当前没有买单',

        'Price History' : '历史价格',
        'Count' : '数量',
        'Price' : '单价',
        'Total' : '总计',
        'Sold' : '售出',
        'Low' : '最低',
        'Avg' : '平均',
        'High' : '最高',
        'Vol' : '总计',
        'Day' : '日',
        'Week' : '周',
        'Month' : '月',
        'Year' : '年',
        'Recent Trades' : '最近交易',
        'Seller' : '卖家',
        'Buyer' : '买家',
        '/^Item$/' : '物品',
        'No recent trades found' : '无最近交易记录',
        'No trades found' : '无交易记录',
        'Show Full Trade Log' : '查看全部交易记录',
        'Item Trade Log' : '物品交易记录',
        'Player Trade Log' : '用户交易记录',
        'Previous' : '上一个',
        'Back to' : '返回',
        'Go to' : '查看',
        'Next' : '下一个',

        'Order ' : '订单',
        'Amount' : '数额',
        'Balance' : '余额',
        'Info' : '详情',
        'Deposit from credit balance' : '从个人账户中存款至市场账户',
        'Withdrawal to credit balance' : '提款至个人账户',
        'Purchased' : '购买',
        'Sold' : '售出',
        '/per (\\d+)/' : '(每 $1 件)',
        'There are no recent trades.' : '最近无交易记录',
    },

    ///////////////////////////////////////////////////////雪花神殿
    shrine: {
        'Welcome to Snowflake\'s Shrine' : '欢迎来到雪花神殿',
        'Here you can make an offering to Snowflake, the Goddess of Loot and Harvest.' : '在这里你可以向雪花女神，司掌战利品与收获的女神献上祭品。',
        'Snowflake will grant you various boons depending on your offering.' : '雪花女神会根据你献上的祭品给予相应的馈赠。',
        'Select a trophy, artifact or collectible to continue.' : '从左侧列表中选择一件文物、奖杯或者收藏品查看具体献祭说明',
        'Artifacts can be exchanged for a random reward.' : '文物可以兑换随机奖励',
        'Depending on your luck and earlier rewards, you can get one of the following:' : '基于你的人品 你可以获得以下随机一项奖励',
        'Some Hath' : '2 Hath(活动文物为1 hath)（20%）',
        'A bunch of crystals' : '随机种类水晶5000颗(活动文物为3000颗)（40%）',
        'Some rare consumables' : '3瓶终极秘药，1个花瓶，1个泡泡糖，1枚混沌令牌（40%）',
        'A permanent +1 bonus to a primary stat' : '永久提升1点主要属性（0-10%，越接近属性上限几率越低）',
        'You cannot currently receive more than ' : '根据你目前的等级，你不能获得多于',
        'to any primary stat. This increases by one for every tenth level. ' : '点属性奖励，此上限每10级提升1点。',
        'Gaining primary stats in this way will not increase how much EXP your next point costs.' : '利用这种方式获得的主属性提升不会增加你的加点消耗。',
        'Trophies can be exchanged for a piece of equipment.' : '奖杯可以用于兑换装备',
        'The quality and tier of the item depends on the trophy you offer. ' : '装备品质取决于献祭的奖杯等级。',
        'You can select the major class of the item being granted from the list below.' : '你可以选择要获取的装备类型或部位。',
        'Offering ' : '献祭 ',
        '/need (\\d+) more/' : '还需要额外 $1 个以升级献祭',
        '/Offer (.+) for :/' : '献祭 $1 换取',
        '/You have (\\d+ / \\d+) items required for this offering/' : '当前持有 $1 献祭所需奖杯数',
        'You have handed in' : '你有总价值',
        'worth of trophies' : '的奖杯献祭记录（在购买了hath能力"雪花的信徒"后，每献祭价值合计1000万的奖杯，可获得一张“无双凭证”，用于兑换灵魂绑定的无双装备）',
        'Collectibles can be exchanged for a random selection of bindings and materials.' : '献祭一个收藏品可以获得随机种类的 1 个粘合剂和 1-3 个高阶基本素材',
        'Random Reward' : '随机奖励',
    },

    ///////////////////////////////////////////////////////怪物实验室
    monsterLabs: {
        'Unnamed' : '未命名的',
        'Arthropod' : '节肢动物',
        'Avion' : '飞禽',
        'Beast' : '野兽',
        'Celestial' : '天人',
        'Daimon' : '魔灵',
        'Dragonkin' : '龙类',
        '/^Elemental$/' : '元素',
        'Giant' : '巨人',
        'Humanoid' : '类人',
        'Mechanoid' : '机器人',
        'Reptilian' : '爬行动物',
        'Sprite' : '妖精',
        'Undead' : '不死族',

        'Required Feed:' : '需求食物:',
        'Feed Tier' : '需喂食食品',
        'Monster Chow' : '怪物饲料',
        'Monster Edibles' : '怪物食品',
        '/Monster Cuisines?/' : '怪物料理',
        '/Chaos Tokens?/' : '混沌令牌',
        '/Happy Pills?/' : '快乐药丸',
        '/Chows?/' : '饲料',
        '/Edibles?/' : '食品',
        '/Cuisines?/' : '料理',
        'Requires' : '需求',
        'Upgrade Cost' : '强化需要',
        'Upgrade With' : '升级需要',
        'Cost' : '消耗',
        'Needs:' : '需求：',
        'Stock' : '库存',
        'None' : '无',

        'Primary attributes' : '主属性',
        'Elemental mitigation' : '元素抗性',
        '/^Primary$/' : '主属性',
        '/^Element$/' : '元素抗性',
        'Other stats' : '其它属性',

        'Battles Won' : '战斗胜利次数',
        'Killing Blows' : '怪物击杀数',
        'Gift Factor' : '送礼概率倍率',
        'Double Gift' : '双倍礼物几率',
        'Attack Speed' : '攻击速度',
        'Health' : '生命',
        'Phys. Attack' : '物理攻击',
        'Mag. Attack' : '魔法攻击',
        'Phys. Defense' : '物理防御',
        'Mag. Defense' : '魔法防御',
        'Slashing Mit' : '斩击减伤',
        'Piercing Mit' : '刺击减伤',
        'Crushing Mit' : '打击减伤',
        'Evade' : '闪避率',
        'Parry' : '招架率',
        'Block' : '格挡率',
        'Resist' : '抵抗率',
        'Anti-' : '反',

        'Powerlevel' : '战斗力',
        '/^Scavenging$/' : '寻宝',
        '/^Fortitude$/' : '刚毅',
        '/^Brutality$/' : '蛮横',
        '/^Accuracy$/' : '命中',
        '/^Precision$/' : '精密',
        '/^Overpower$/' : '压制',
        '/^Interception$/' : '拦截',
        '/^Dissipation$/' : '弥散',
        '/^Evasion$/' : '闪避',
        '/^Defense$/' : '防御',
        '/^Warding$/' : '魔防',
        '/^Swiftness$/' : '迅捷',
        'MAX' : '已满',

        'Increases the gift factor by ' : '增加送礼概率倍率',
        'Increases monster damage by' : '增加怪物的伤害力',
        'Increases monster accuracy by' : '增加怪物的命中率',
        'Decreases effective target evade/block by' : '降低攻击目标的有效回避/格挡率',
        'Decreases effective target parry/resist by' : '降低攻击目标的有效招架/抵抗率',
        'Increases monster health by' : '增加怪物的生命值',
        'Increases monster parry by' : '增加怪物的招架率',
        'Increases monster resist by' : '增加怪物的抵抗率',
        'Increases monster evade by' : '增加怪物的回避率',
        'Increases monster physical mitigation by' : '增加怪物的物理减伤',
        'Increases monster magical mitigation by' : '增加怪物的魔法减伤',
        'Increases monster attack speed by' : '增加怪物的攻击速度',

        'Skill name' : '技能名',
        'Skill type' : '技能攻击类型',
        '/^Damage$/' : '伤害类型',
        '/^Magical$/' : '魔法',
        '/^Physical$/' : '物理',
        '/^Slashing$/' : '斩击',
        '/^Piercing$/' : '刺击',
        '/^Crushing$/' : '打击',
        '/^Power$/' : '伤害',
        '/^Special$/' : '特殊',

        '/^Fire$/':'火焰',
        '/^Cold$/':'冰霜',
        '/^Elec$/':'闪电',
        '/^Wind$/':'疾风',
        '/^Holy$/':'神圣',
        '/^Dark$/':'黑暗',
        '/^Void$/':'虚空',

        'Empty Slot - Click To Create' : '空槽位 - 点击创建一个怪物',
        'You still have to feed this monsters enough crystals to reach powerlevel 25 and give it a name to activate it.' : '要激活这个怪物你必须喂食其水晶令其达到战斗力等级25，然后为其取名',
        'You still have to give this monster a name to activate it' : '你依然需要为这个怪物命名以激活它',
        'Next upgrade available at powerlevel ' : '强化到下一级需要此怪物达到战斗力等级 ',
    },

    ///////////////////////////////////////////////////////创建怪物说明
    //创建怪物说明内容实际是分行截断的，此处全部使用\n拼接了起来，为了避免怪物名称被打断使用此字典时应该放在怪物实验室词典前面
    monsterCreate: {
        'About Monster Creation:' : '关于怪物的创建:',
        'You can use the Monster Lab to create monsters that will roam free in the HentaiVerse. The monsters you create will be mixed in with the normal battles in all forms of play.' : '你可以用怪物实验室创造属于你的自创怪，这些怪物会在HV的世界里面自由遨游.这些你的自创怪会在任何普通模式的战斗中出现.',
        'The monsters you create will start out weak, but can be upgraded by infusing them with Power Crystals, and by unlocking special perks with Chaos Tokens.' : '这些你的自创怪起初相当脆弱，但是它们可以被能量水晶升级，以及通过混沌令牌进行特殊强化',
        'To get started, select a monster class from the list to the left' : '要开始创建怪物的话，请从左侧列表选择一个怪物类型',
        'The class determines a number of factors:' : '不同的怪物类型决定了',
        'The starting primary stats' : '怪物的初始属性',
        'The starting damage resistances' : '初始抗性',
        'Which melee attack types the monster can do' : '伤害类型',
        '(Future) Upgrade paths and specializations' : '升级路线和特殊技能（未实装）',
        'Choose Melee Damage Type' : '选择近战伤害类型',
        'After selecting a class, select the desired primary attack type of the monster to create it. ' : '在选择怪物的类型之后，点击属性下方按钮选择你一个你想要的怪物基础攻击类型，',
        'You will then be able to feed it some crystals and name it to make it active in the game.' : '然后你就可以通过喂食以及取名的方法激活这只怪物。怪物会定期赠送各种素材以及粘合剂作为礼物回馈玩家。',

        'Arthropods are a diverse phylum of invertebrate animals distinguished by having a segmented body with jointed appendages, encased in a hard exoskeleton. ' : '节肢动物是一种多元无脊椎动物且身体具有分节特性的动物门之一，节肢动物通常包裹在一个坚硬的外骨骼中。',
        'Variants include insects, spiders and scorpions, and they exist in many different forms and sizes. Remains of humanoid arthropods have been discovered in old ruins, but it is unknown whether such animals still exist, and whether or not they are intelligent.' : '其变种还包括昆虫、蜘蛛和蝎子等，它们有许多不同的形状和大小。在古老的废墟中已经发现了人形节肢动物的遗骸，但是这些动物是否仍然存在，它们是否存在智能，目前尚不清楚。',
        'Arthropods are typically equipped with crushing melee attacks using claws and similar appendages, or piercing attacks with stingers. There are rumors of massive mutated members of the species, large enough to crush other creatures with the sheer bulk of their bodies.' : '节肢动物通常使用爪子或者其他类似爪子的武器进行打击攻击，或者使用刺进行突刺打击，还有传言曾说，有一些巨大变异种，大到可以直接用身体撞击摧毁大部分其他生物。',
        'Their natural armor provides a high degree of resistance against slashing attacks, but they are vulnerable to blunt weapons. The exoskeleton provides a heightened defense against most elemental attacks.' : '它们天然的装甲提供了非常高的斩击耐性，而且外骨骼的存在令其对绝大部分元素魔法具有抗性，但是它们对打击攻击的抵抗力非常薄弱。',
        'Avions, also known as Aves or simply Birds, are a class of vertebrate endothermic animals distinguished by having wings. Variations exists, but typical Avions are bipedal with strong talons on their feet, covered in feathers, and equipped with a powerful beak. All Avions in the HentaiVerse have the ability to fly; non-flying birdlike creatures are classified as Beasts.' : '飞禽，也被称作鸟类或者干脆是鸟，是一种有翅膀的温血脊椎动物，虽然也有一些变异种存在，但是典型的鸟类双足均有爪子，全身覆盖着羽毛，并有强大的喙，在HV里面，所有的鸟类默认均会飞行，不会飞行的鸟类被分类至“野兽”一类。',
        'Avions can specialize into using their beak for piercing attacks or talons for slashing attacks. The superior mobility and keen eyesight of higher level avions let them accurately target weak or unprotected parts of their opponent, giving them a high chance of scoring critical hits or temporarily cripple the target. The naturally high mobility also makes it particularly hard to land good hits with piercing weapons.' : '鸟类精通用它们的喙进行刺击或者使用爪子进行斩击攻击，卓越的视力与高机动性使鸟类很擅长攻击敌人的弱点，令它们的攻击有高暴击率与高致残性，鸟类的高机动性也使其很难被刺击武器命中。',
        'While fast and agile, they do not have strong physical defenses. Due to their feather-covered body and flying nature, they are weak to fire and wind-based magicks. The fact that they are not grounded does however mean that they are resistant to electrical attacks.' : '虽然鸟类速度快而且敏捷，但他们没有强大的物理防御能力。由于它们的羽毛覆盖的身体和飞行的性质，它们普遍弱火与风。不过事实上，鸟类由于没有接地，所以它们可以抵抗闪电攻击。',
        'Beasts cover the wide range of vertebrate air-breathing animals known as Mammals. There are many variations in this class, but the majority are quadrupeds of sizes varying from smaller than mice to larger than elephants.' : '野兽这种种类囊括了广大呼吸氧气的脊椎动物，它们通常被认作是哺乳动物。它们的种类多种多样，但是主要由四足动物组成，从老鼠到大象，各种体型的野兽都存在。',
        'Beasts are typically either covered in fur or feathers, or more rarely, clad in a thick hairless hide. The fur makes them somewhat weak to fire-based magicks, but resistant to wind- and cold-based attacks. Most have average defense against physical weapons, but some have evolved a hard armor of keratin around vital points which heightenes these defenses significantly.' : '野兽通常覆盖有羽毛或者毛皮，极少数野兽没有毛皮，用厚厚的表皮保护自己，它们对大部分物理攻击都有防御力，由于有些野兽进化出了专门应对打击的坚硬表皮，所以它们对打击攻击的抵抗力较强。',
        'Their natural range of weapons allow them to bite down with sharp teeth, shred their foes with large claws, and impale them on pointy tusks. The most powerful beasts can simply use the sheer bulk of their body to crush a target.' : '它们广泛的分布范围允许野兽使用锋利的牙齿刺穿它们的敌人或者使用利爪撕碎它们，最强大的野兽甚至只用身体撞击就可以击溃绝大部分敌人。',
        'Rumors persist about terrible Beasts corrupted beyond all recognition with dark magicks, but those who have encountered them are not in a state to give a coherent description of their abilities.' : '有确切传闻说，存在一些被黑魔法腐化的野兽，但是遇到它们的人都没有办法对它们做出连贯准确的描述。',
        'Celestials are supernatural divine beings that reside on a different plane of existence. From time to time, some of these beings enter our world for reasons they usually choose not to divulge to outsiders. While worshipped by some individuals and groups as inherently good, it is suspected that those who leave have their own agendas that do not necessarily mesh well with that ideal.' : '天人是一种超自然而且神圣的存在，他们居住在不同的星球上，有些时候一些天人也会因为一些不想被外人知道的原因进入我们世界。天人的固有特性使其被一些个人和团体所崇拜，但也有些人怀疑那些脱离大部队擅离的天人可能不是想象中的那么完美。',
        'Appearing as lithe humanoid creatures who refuse to wear any form of armor, they have below average resistance to most physical attacks but make up for it with high agility. They have high resistance to elemental magicks, and are nearly impervious to divine attacks. They are however very weak against forbidden magicks.' : '天人作为一种轻盈的人形生物拒绝任何形势的盔甲，因此他们的物理抗性很低，但是动作敏捷，天人有很高的元素魔法抗性，而且有很高的神圣魔法抗性，但是它们对黑暗魔法的抗性很弱。',
        'Celestials can use a wide variety of humanoid armaments, but for unknown reasons they do not employ piercing weapons in their arsenal. Higher level celestials can imbue their weapons with pure divine power that lets their melee attacks deal holy damage.' : '天人可以使用各种各样的装备，不过因为一些不明的原因，它们没有刺击用的武器，一些更高层次的天人可以使用神圣魔法的力量，它们可以给近战攻击附带上神圣属性伤害。',
        'Daimons are supposedly corporeal manifestations of impure and often malevolent supernatural spirits that, some say, originate from the same plane of existance as Celestials. Their exact nature and relation to Celestials is however unknown.' : '魔灵，它们在自然中的存在通常被推测为一种不纯净和恶毒的精神集合体，有人说，它们和天人起源于同一位面，不过它们和天人确切的关系尚未为人们所知。',
        'These spirits can take on any number of different appearances, but tend to choose one specifically tailored to the fears of their opponent. To allow for this shape changing capability, they do not wear any armor or use any other form of humanoid weaponry. This leaves them weak to physical attacks.' : '这些精神体外观各异，不过它们通常会选择敌人最恐惧的模样出现，为了保持这种能力的持续使用，魔灵不装备任何铠甲和装备，这使得它们无法进行物理攻击。',
        'Like Celestials, they have high resistances to elemental magicks. They are almost imprevious to forbidden magicks, but highly vulnerable to divine attacks.' : '与天人类似，魔灵对元素魔法具有高抗性，对黑暗魔法具有很高抗性，但是惧怕物理攻击和神圣魔法。',
        'Instead of forged weapons, these creatures take advantage of their physical malleability to reshape parts of their own body into blade-like weapons or sharp implements that they use for slashing and stabbing attacks. Higher level daimons are said to be able to conjure weapons of pure darkness that can bypass all defenses not especially enchanted to withstand it.' : '比起使用锻造的武器，魔灵更擅长使用自己身体塑性而成的肢体武器，这些肢体武器像刀片和尖刺一样锐利，使得魔灵可以使用刺击和斩击攻击，高阶的魔灵据说可以召唤纯净黑暗武器，能无视除了黑暗抗性之外的所有抗性对敌人造成伤害。',
        'Dragonkin consist of Dragons, Drakes, and all other creatures that could be mistaken for giant flying fire-breathing lizards. That is however somewhat of an over-simplification as not all Dragonkin can fly, while breath attacks are not always fire, and are only fully developed in mature members of the species.' : '龙类包括龙，双足飞龙，以及一切会被认为是巨大的飞天喷火蜥蜴的生物，这种分类可能有点过于简化，因为并不是所有的龙类都有飞行能力，它们的吐息也不一定是火焰，只有它们之中发展最为成熟的那些种类才具有这些特性。',
        'Elementals are metaphysical beings that manifest as crystalline beings of pure elemental energy. It is thought that they can change between different elemental forms at will, but this has never been observed in battle.' : '元素生物是一种抽象的存在，表现为纯粹元素的结晶，通常它们被认为可以自由的切换自身的元素魔法的形态，但是从来没有在战斗中观测到这种情况。',
        'Giants are huge, slow and stupid. The only reason they still thrive as a species is their extreme natural aggression and immense strength, combined with the fact that they are highly amused by smashing anything they can get a hold of.' : '巨人是一种缓慢巨大而且愚蠢的生物，它们之所以能茁壮成长的原因是因为它们自身极端的侵略性以及极强的力量，加上它们对粉碎一切它们能抓住的物体都非常感兴趣。',
        'Humanoids comprise the various intelligent bipedal primates found in the world. While they have no notable supernatural powers nor beastlike strength, and are largely covered in a soft and delicate skin which grants only minor protection from the elements, a variety of armor and weapons fill the gaps in their natural defenses and give them a surprisingly large amount of flexibility in their offensive capabilities.' : '类人类生物通常包括世界上发现的各种有智能的灵长类动物。虽然它们没有明显的超自然能力和野兽般的力量，而且大部分被柔软细腻的肌肤所保护，这使得它们对元素魔法几乎没有抵抗力，但是它们可以使用各式各样的铠甲和武器保护自己，使得这些生物具有惊人的延展性和潜力。',
        'Mechanoids are essentially living machines, remnants of ancient and highly advanced civilizations. The art of making such machinations has been long lost, but many still roam the world, oblivious of the fate that has befallen their deceased masters.' : '机器人本质上是一种有生命的机械，是古文明的遗物，制造这种阴谋般的产物的技术已经失传已久，很多机器人在世界游荡，在命运的指引下，不经意间邂逅了它们已故的主人。',
        'Many variants of Mechanoids exist, from large bipedal machines forged for destruction to smaller humanoid builds created for peaceful purposes. Some were originally fitted with a wide variety of weaponry, but due to wear and lack of maintenance, most of the Mechanoids that are still functional equip themselves with simple melee weapons.These are typically blade- and spike-shaped attachments in place of a limb or other tool.' : '机器人存在许多变种，由巨大的战斗双足机械到小型的民用人形机器人均有存在，一些机器人原本配备了多种武器装备，但是因为缺乏维护，大部分机器人还是只能使用简单的近战武器进行攻击，比如安装在肢体上的锯片以及穗形尖刺进行攻击。',
        'There are however rumors of terrible machines that are capable of searing a creature to the bones with a stream of fire, or shatter their bodies with a torrent of deadly metal.' : '不过有传言说，一些可怕的机器人能用火焰把其他生物烧焦，或者用一堆致命的金属构造物刺穿敌人的身体。',
        'Mechanoids are highly resistant to wind and cold-based magicks, and due to their artificial nature, they are almost imprevious to divine attacks. Their internal systems are however highly vulnerable to electrical shocks. Most have armor worn brittle with age, but stories of preserved heavily armored variants are told by the few who are fortunate enough to survive such an encounter.' : '机器人具有很高的疾风和冰冷以及火焰抗性，得益于它们的人工构造，它们对神圣魔法也有很强的抗性，但是它们的内部系统极度惧怕电击，大部分机器人的铠甲已经随时间风化，但是也存在一些保留了大部分铠甲的幸运儿。',
        'Reptilians are cold-blooded creatures that thrive in and near water. They comprise animals like crocodiles, snakes, turtles and lizards, but also intelligent biped humanoid variants that have evolved independently of their fellow primates. Their skin is covered in scales or scutes, and some have hardened shells covering parts of their bodies.' : '爬行动物就是所谓的冷血动物，通常生活在水边，包括鳄鱼、蛇、海龟和蜥蜴等动物，也有独立于灵长类动物进化的智能两足人型变体存在，它们的皮肤覆盖着鳞片或鳞甲，有硬化甲壳覆盖身体的大部分部位',
        'Sprites are diminuitive beings that seldom get involved in the Big World, prefering to remain with their own kin in the hidden places of the land where nature is still thick and undisturbed. Only a small minority choose to seek out the human world, where their high intelligence and small size make them excel for many tasks, ranging from accounting to assassination.' : '妖精是一种纤小的存在，它们通常极少进入人类的“大世界”，宁愿留在自己的熟悉的在土地或者不受干扰的隐蔽场所中。只有少数妖精会选择进入人类的世界，在那里他们的高智力和小尺寸使它们擅长执行许多任务，从会计到暗杀。',
        'Sprites are not a single species, but most of the big folk will be hard pressed to tell a pixie apart from a faery. They are commonly armed with using tiny swords and rapiers, and while they do not have much strength to put behind a thrust, their ability to seek out the most vulnerable parts of a target still make them a force to be reckoned with.' : '妖精并不是一种单一的物种，但是大部分人都难以分辨小精灵与精灵的区别，它们通常手持微小的剑或者细剑，而且通常没有多少力量用剑进行刺击攻击，但是它们能寻找敌人最脆弱的地点进行攻击依然是妖精一个不可小视的能力。',
        'Higher level Sprites can master powerful magicks, and many an unwary adventurer have engaged them recklessly only to be sent to an early grave.' : '高阶的妖精掌握了强大的法术，可以早早的把那些轻敌的冒险家送入坟墓。',
        'Physically weak, the best way of dealing with them is swatting them with a crushing attack, but they are fast and hard to hit. Their tiny size also makes them difficult to hit them with stabbing weapons. All Sprites have some resistance to elemental magicks, and depending on their natural affinity they can even be fully imprevious to some elements. They are however naturally weak to the forbidden magicks.' : '妖精的物理抗性较弱，惧怕打击攻击，但是动作极其敏捷，难以击中，所以使用刺击武器更加难以击中它们，所有的妖精对元素魔法都有一定的抗性，而且因为它们的自然亲和力，它们对神圣魔法也有一定的抵抗，但是它们非常惧怕黑暗魔法。',
        'Undeads are animated necrotic remnants of living beings, cursed to an eternal lifeless existance with no warmth or joy. They range from mindless brutes such as zombies and animated skeletons, to higher undeads that have preserved parts of their mind but lost their soul, like liches, vampires and banshees.' : '不死族就是一些会动的残肢断尸，被诅咒而成为永生的存在的它们没有温暖和快乐的概念，它们的范围从无主的野兽尸骸比如亡灵或者僵尸，到高等的亡灵与巫妖，它们在保留意识的同时也失去了它们的灵魂。',
        'Having no need to maintain a body temperature and no vital processes that can be disturbed by electricity, undeads are highly resistant to cold and electrical magicks. Being born from darkness itself also makes them imprevious to forbidden magicks, but they are vulnerable to divine attacks and fire magicks.' : '尸体没有保持体温的必要，也不惧怕电的伤害，使其有较高的冰冷与闪电抗性，诞生与黑暗魔法本身的它们也对黑暗魔法有极高的抗性，但是它们惧怕神圣魔法和火焰魔法的攻击。',
        'Piercing and crushing attacks are ineffective due to a lack of weak points, but cutting off limbs works reasonably well.' : '刺击与打击对亡灵并没有多大的意义，但是切断它们的四肢倒是非常有效的战术。',
        'Mindless undeads tend to use simple melee implements like swords, or just crush their targets using their own limbs. Higher level undeads can use more sophisticated weaponry, and some even master deadly forms of forbidden magicks.' : '无主的亡灵们通常倾向于使用简单的近战武器比如剑，一些干脆使用自己的肢体进行打击攻击，更高级别的亡灵会使用更复杂的武器，甚至有精通黑暗魔法的大法师存在',

        'Create new monster with base damage type of' : '选择要创建的怪物的基础攻击类型',
        'Strength':'力量',
        'Dexterity':'灵巧',
        'Agility':'敏捷',
        'Endurance':'体质',
        'Intelligence':'智力',
        'Wisdom':'智慧',
    },

    ///////////////////////////////////////////////////////邮件
    mm: {
        'Inbox' : '收件箱',
        'Write New' : '写邮件',
        'Read Mail' : '已读邮件',
        'Sent Mail' : '已发送邮件',
        'Subject' : '主题',
        'Sent' : '发送时间',
        '/^Read$/' : '被阅读时间',
        'Never' : '还未',
        '/^To[:\s]/' : '收件人',
        '/^From/' : '寄件人',
        '< Prev' : '< 上一页',
        'Next >' : '下一页 >',
        'No New Mail' : '没有新邮件',
        'Attaching items on Isekai is restricted to donators.' : '异世界模式下给邮件添加附件功能仅限捐赠玩家。',
        'Attachments also cannot be added on the last day of each season.' : '同时在每个赛季最后一天将无法发送附件。',
        'Attachments also cannot be sent for the last month of each season.' : '同时在每个赛季最后一个月将无法发送附件。',
        'Welcome to MoogleMail. A Moogle approach to email.' : '欢迎来到莫古利邮务，莫古利将为你传送邮件。',
        'From here you can send messages and items to other people in the HentaiVerse, kupo!' : '在这里你可以向其他HV玩家传送信息和物品，咕波！',
        'You can click the buttons above to attach items, equipment, credits or hath to this message. ' : '你可以点击上面的按钮为此邮件添加道具、装备、Credit、Hath附件。',
        'You can click the buttons above to attach items or equipment to this message. ' : '你可以点击上面的按钮为此邮件添加道具、装备附件。',
        'Up to 10 different things can be attached to each message.' : '一封邮件最多可添加10件附件。',
        'You can optionally request payment for messages with attachments with the Credits on Delivery (CoD) setting after attaching at least one item. ' : '当你为一封邮件添加至少一个附件之后，你可以为邮件设置货到付款(CoD)功能。',
        'The receipient will have to pay the specified number of credits in order to remove the attachments from your message. ': 'CoD 功能会令收件人在提取附件时向你支付指定数额的Credits。',
        'To prevent misuse, a small fee is required to use this function unless you have the Postage Paid perk.' : '为了防止滥用，这个功能每次会收取少量费用，除非你购买了Hath能力“邮资已付”。',
        'To prevent misuse, a fee is required to use this function' : '为了防止滥用，这个功能每次会收取一些费用',
        ' unless you have the Postage Paid perk.' : '，除非你购买了Hath能力“邮资已付”。',
        'Until the CoD has been paid, the sender and the recipient can both choose to return the message. ' : '除非货到付款(CoD)已经被收件人支付，否则发件人与收件人可以在任意时刻撤回或者拒收CoD邮件。',
        'This allows the recepient to reject an unwanted message, and allows you to recover your items if the recipient does not accept it within a reasonable time.' : '这可以防止发出的邮件长时间得不到回应或者收到了不合理的CoD邮件的问题。',
        'Note that unsent drafts will be deleted after one month, and sent messages will be deleted after one year. Any remaining attachments for a deleted message will be permanently lost.' : '请注意，邮件草稿将于1个月后自动删除，已发送的邮件在保留1年后也会自动删除，如果被删除的邮件里仍有未提取的附件，它将永久丢失。',
        'Attach Item' : '选择附件',
        'Attach Equipment' : '选择装备',
        'Attached: ' : '已选择附件：',
        'Not Set' : '未设置',
        'Current Funds:' : '你目前拥有:',
        'items attached' : '个附件',
        'Requested Payment on Delivery' : '要求货到付款数额',
        'Your message has been discarded.' : '你的邮件信息已被丢弃。',
        'Any attachments have been returned.' : '邮件中附带的附件已归还仓库。',
        'Your message has been sent.' : '邮件已发送',

        '/According to your prices in HVtoolBox, COD should be (\\d+) credits/' : '根据你在HVToolBox里设置的价格，这个邮件的货到付款(CoD)价格应当是 $1 Credits',
    },

    ///////////////////////////////////////////////////////彩票
    prizes: {
        'January' : '1 月',
        'February' : '2 月',
        'March' : '3 月',
        'April' : '4 月',
        'May' : '5 月',
        'June' : '6 月',
        'July' : '7 月',
        'August' : '8 月',
        'September' : '9 月',
        'October' : '10 月',
        'November' : '11 月',
        'December' : '12 月',
        '1st:' : '1 日',
        '3rd:' : '3 日',
        '2nd:' : '2 日',
        'th:' : ' 日',
        'Grand Prize for' : '一等奖',
        '2nd Prize' : '二等奖',
        '3rd Prize' : '三等奖',
        '4th Prize' : '四等奖',
        '5th Prize' : '五等奖',
        'Equip Winner:' : '装备中奖者:',
        'Core Winner:' : '核心中奖者:',
        'TBD' : '暂未开奖',
        'You currently have' : '你目前拥有',
        'Each ticket costs' : '购买一张彩票将花费',
        'You already spent a Golden Lottery Ticket.' : '你已经使用了一张黄金彩票券',
        'Choose number to buy' : '输入购买数量',
        '/You hold ([\\d,]+) of/' : '你拥有 $1 /',
        'sold tickets' : '张已售出的彩票',
        'Stock:' : '库存：',
        'The Weapon Lottery lets you spend GP on a chance to win the specific equipment piece shown on the left.' : '使用GP购买武器彩票有机会赢取“无双”武器',
        'Each lottery period lasts 24 hours. At midnight UTC, a drawing is held, and a new lottery period starts.' : '每期彩票发行期为24小时，武器彩票于协调世界时 0点 开奖，同时发行新一期彩票',
        'In addition to normal tickets, you can also spend a Golden Lottery Ticket to add 100 tickets and double your effective ticket count at the time of drawing. This will not increase the effective ticket count past 10% of the total purchased tickets. Golden Lottery Tickets can only be acquired as a consolation prize from the lottery.' : '你也可以使用黄金彩票券兑换100张彩票，并且让自己持有的彩票数量翻倍（效果在开奖时计算，最高不超过10%总售出彩票）。黄金彩票券只能通过购买彩票中奖获得。每人每期最多可购买20000张彩票',
        'The number of items granted by the 2nd-5th prize will increase with the size of the pot. You can only ever win one of the prizes no matter how many tickets you purchase.' : '2-5等奖的奖品数量取决于彩池的大小，无论你购买了多少注彩票，你只能中一个奖项，如果你不想要一等奖装备，那么你可以点击一等奖下面的DO NOT WANT按钮，这会令你放弃头奖装备，取而代之如果你抽中头奖你将获得对应的装备核心',
        'The Armor Lottery lets you spend GP on a chance to win the specific equipment piece shown on the left.' : '使用GP(画廊点数)购买防具彩票有机会获得“无双”防具',
        'Each lottery period lasts 24 hours. At noon UTC, a drawing is held, and a new lottery period starts.' : '每期彩票发行期为24小时，防具彩票于协调世界时 12点 开奖，同时发行新一期彩票',
        'Today\'s ticket sale is closed.' : '本期彩票售卖已结束',
        'Today\'s drawing is in' : '距离今日开奖还剩',
        'hours and' : '小时',
        'hours' : '小时',
        'minutes' : '分钟',
        'Ticket sales will close up to ten' : '彩票售卖将于开奖前 10',
        'before this time.' : '结束',
        '/Chaos Tokens?/' : '混沌令牌',
        '/Caffeinated Cand(y|ies)/' : '咖啡因糖果',
        '/Golden Lottery Tickets?/' : '黄金彩票券',
        'You cannot opt out unless you have at least one ticket.' : '你必须至少购买一张彩票才能选择放弃头奖争夺',
        'You will not participate in the drawing for the grand prize of this lottery.' : '你已经放弃参与本次彩票的头奖争夺',
        'No longer available' : '装备已不存在',
        'Winner:' : '获奖者:',
    },

    ///////////////////////////////////////////////////////战斗
    battle: {
        'First Blood' : '第一滴血',
        'Learning Curves' : '学习曲线',
        'Graduation' : '毕业典礼',
        'Road Less Traveled' : '孤途之旅',
        'A Rolling Stone' : '浪迹天涯',
        'Fresh Meat' : '鲜肉一族',
        'Dark Skies' : '黑云密布',
        'Growing Storm' : '风雨欲来',
        'Power Flux' : '力量涌动',
        'Killzone' : '杀戮地带',
        'Endgame' : '终局游戏',
        'Longest Journey' : '无尽旅程',
        'Dreamfall' : '梦殒之时',
        'Exile' : '流亡之途',
        'Sealed Power' : '封印之力',
        'New Wings' : '崭新之翼',
        'To Kill a God' : '弑神之路',
        'Eve of Death' : '死亡前夜',
        'The Trio and the Tree' : '大树三重奏',
        'End of Days' : '世界末日',
        'Eternal Darkness' : '永恒黑暗',
        'A Dance with Dragons' : '与龙共舞',
        'Post-Game Content' : '额外内容',
        'Secret Pony Level' : '秘密小马关',
        'Konata' : '泉此方',
        'Mikuru Asahina' : '朝比奈实玖瑠',
        'Ryouko Asakura' : '朝仓凉子',
        'Yuki Nagato' : '长门有希',
        'Real Life' : '现实生活',
        'Invisible Pink Unicorn' : '隐形粉红独角兽',
        'Flying Spaghetti Monster' : '飞行意大利面怪物',
        'Triple Trio and the Tree' : '大树十重奏',

        'There are no challenges available at your level. Check back later!' : '没有适用于你当前等级的挑战。努力升级以后再来查看吧！',
        'Challenge' : '名称',
        'Highest Clear' : '最高通过难度',
        'EXP Mod' : '经验倍率',
        'Min Level' : '需求等级',
        'Rounds' : '战斗场次',
        'Clear Bonus' : '通关奖励',
        'Entry Cost' : '入场消耗',
        'Never' : '还未',
        '1 Token' : '1 鲜血令牌',
        '2 Tokens' : '2 鲜血令牌',
        '3 Tokens' : '3 鲜血令牌',
        '5 Tokens' : '5 鲜血令牌',
        '10 Tokens' : '10 鲜血令牌',
        'Cooldown' : '冷却中',
        'You have' : '你有',
        'tokens of blood.' : '块鲜血令牌',
        'token of blood.' : '块鲜血令牌',

         '/H /' : '小时',
         '/M$/' : '分',

        'The Tower is an Isekai-Only battle mode where the goal is to get as high as possible before the end of the season. ' : '塔楼(The Tower)是异世界独有的战斗模式，目标是在每个赛季结束前尽可能获得更高的排位。',
        'Ranking high in this mode at the end of the season will provide you with some permanent bonuses on HV Persistent.' : '塔楼天梯以半年为一个赛季周期，2024赛季的时间为5月1日至11月1日。在塔楼下取得高排位将在每个赛季结束后获得一些传统世界模式的永久奖励。达到塔楼100层或前20名的玩家,将在赛季结束后在永久区获得一张"无双凭证",达到塔楼30层的玩家可在永久区获得全属性+1的加成,40层为+2,50层为+3.同时,每成功攀爬一层塔楼,你可在异世界中获得20%的经验加成与0.1%的伤害加成,并获得10个灵魂碎片,并会根据塔楼当前的难度等级获得一件装备',
        'The difficulty and monster level in this battle mode is locked to each floor, with an increase in monster level, difficulty or number of rounds for each floor.' : '此模式下的战斗难度和怪物等级与对应层级绑定，和你的难度设置与自身等级无关。每一层都会伴随着怪物等级、战斗难度或者战斗场次的提升。怪物生命与伤害每层提升5%,并且怪物伤害每回合会提升2%,塔楼在20层前每天可以尝试并通关5次,20层后每天仅能通关1次,尝试3次,逃跑与被击败均视为消耗尝试次数',
        'Your Ranking: ' : '你的排名: ',
        'Unranked' : '没有排名',
        '1st' : '1',
        '2nd' : '2',
        '3rd' : '3',
        '/(\\d)th/' : '$1',
        'Current Floor:' : '当前层级:',
        'Monster Level' : '怪物等级',
        'Daily Attempts: ' : '今日尝试次数: ',
        'Daily Clears:' : '今日通关次数:',

        'Welcome to the Grindfest.' : '欢迎来到压榨界',
        'A Grindfest consists of up to 1000 rounds of battle.' : '压榨界包含1000场连续且难度与收益递增的战斗',
        'Starting a Grindfest will consume 1 point of Stamina.' : '进入压榨界战斗会消耗1点精力',
        'There is a small credit reward at the end,' : '完成全部的压榨界战斗',
        'if you make it all the way through.' : '可以获得5000C的奖励',

        'Welcome to the Portal to the Item World.' : '欢迎来到道具界的传送门，在进行道具界战斗时，你需要提前预支所消耗的精力',
        'Select a piece of equipment to enter the world contained within. ' : '选择一件装备进入其道具界，在这里你可以进入各种装备的道具界中，',
        'Clearing item worlds is the only way to unlock the full potential of your equipment.' : '完成装备的道具界挑战可以快速解锁装备中蕴含的潜能。',
        'If you manage to fight your way through to the last level, you will gain some points towards unlocking new latent potencies. ' : '如果你成功的完成了道具界所有的战斗，你将获得一定的潜经验值来提升该装备潜能等级。',
        'These can improve existing qualities of your equipment, or add new abilities.' : '潜能等级的提升可以为装备增加新的能力，或加强已有的潜能力。',
        'The number of rounds you will be fighting depends on the quality of your item.' : '道具界的战斗场次取决于你的装备品质，最低10场，最高100场',
        'More powerful items will have more powerful monsters inside them, and the monsters get more powerful the deeper you go.' : '越强大的装备所需战斗场次越多，里面的怪物也会越强，道具界的怪物随场次逐渐加强。',

        // 道具界入口页面 - 完整版本（带冠词）
        'Clearing item worlds is the only way to unlock the full potential of your equipment. Select an equipment to enter the world contained within. You can only enter the worlds of equipment that are soulbound to you.' : '通关道具界是解锁装备全部潜能的唯一途径。选择一件装备进入其内部的世界。你只能进入已灵魂绑定装备的道具界。',
        'If you manage to fight your way through, you will boost the latent potency of your equipment. This increases the total strength of the charms the equipment can handle, and allows you to upgrade it further.' : '如果你成功通关，将提升装备的潜在潜能。这会增加装备可承受的附魔总强度，并允许你进一步升级装备。',
        'The number of rounds you will be fighting depends on the quality of your item. More powerful items will have more powerful monsters inside them, and the monsters get more powerful the deeper you go. The difficulty setting does not affect the difficulty in Item Worlds.' : '战斗回合数取决于装备品质。更强大的装备内部会有更强大的怪物，且怪物会随着深入而变得更强。难度设置不会影响道具界的难度。',
        'Spawning an item world requires a number of World Seeds, depending on its quality and number of item worlds cleared inside that particular equipment.' : '生成道具界需要消耗一定数量的世界种子，具体数量取决于装备品质和该装备已通关的道具界次数。',

        'Available World Seeds:' : '可用世界种子：',
        'Equipment must be soulbound before you can enter its Item World.' : '装备必须先进行灵魂绑定才能进入其道具界。',

        // 道具界按钮
        'Enter Item World' : '进入道具界',
        'Start Battle' : '开始战斗',

        // 道具界确认对话框
        'Are you sure you want to enter this Item World?' : '你确定要进入这个道具界吗？',
        'World Level:' : '道具界等级:',
        'World Level' : '道具界等级',
        'Battle Rounds:' : '战斗回合数:',
        'Monster LVL:' : '怪物等级:',
        'Difficulty:' : '难度:',



        // 道具界装备列表提示
        'There are no available equipment of this type.' : '此类型没有可用的装备。',

    },

    ///////////////////////////////////////////////////////小马引导图
    riddlemaster: {
        'Choose the right answer based on the image below' : '请回答以下图片中小马的正确名称(输入A或B或C)，点击右侧PONY CHART按钮可查看小马名称参考',
        'Select ALL ponies you see in the image above then hit "Submit Answer" before the time limit runs out.': '请在时间限制结束之前选择你在上图认出的所有小马名称并点击“提交答案”',
        'Submit Answer' : '提交答案',
        'Timer' : '剩余时间',
    },

    ///////////////////////////////////////////////////////正在战斗页面
    battling: {
    ///////////////////////////////////////////////////////战斗行动
        '/^Attack$/' : '攻击',
        '/^Defend$/' : '防御',
        '/^Focus$/' : '专注',
        '/^Items$/' : '道具',
        '/^Skillbook$/' : '技能书',
        '/^Spirit$/' : '灵动架式',
        '/^Battle Time$/' : '战斗时间',
        'Damages a single enemy. Depending on your equipped weapon, this can place certain status effects on the affected monster. To attack, click here, then click your target. Simply clicking an enemy will also perform a normal attack.' : '普通攻击，取决于你的武器能对怪物造成特定的伤害，单击此处并点击目标怪物进行攻击，没有选中技能法术时仅点击怪物也有相同效果。普通攻击命中怪物可以获得5%~10%斗气。',
        'Use special skills and magic. To use offensive spells and skills, first click it, then click your target. To use it on yourself, click it twice.' : '使用一个技能活法术。对于攻击和减益技能法术，点击技能然后点击目标怪物，对于治疗和辅助法术，仅需点击技能法术名称。重复点击技能书按钮可以切换技能和法术列表。你可以在HV设置中将常用技能法术放在快捷栏上。',
        'Use various consumable items that can replenish your vitals or augment your power in various ways.' : '使用战斗补给品中的道具，它们能恢复你的状态或者给你带来各方面提升。',
        'Toggle Spirit Channeling.' : '切换灵动架式。当你有 50% 以上的斗气可以开启，开启后每次行动消耗 1 点灵力值和 10% 斗气，攻击伤害增加100%，魔力值消耗减少 25%。',
        'Increases your defensive capabilities for the next turn.' : '本回合和下一回合你的物理和魔法减伤增加25%。消耗 10% 斗气恢复 10% 基础生命值 (需要 10%+ 斗气)。',
        'Reduces the chance that your next spell will be resisted. Your defenses and evade chances are lowered for the next turn.' : '本回合无法进行回避、格挡、招架和抵抗，增加下一回合魔法命中和反抵抗率。消耗 25% 斗气恢复 5% 基础魔力值 (需要 25%+ 斗气)。',
        'Choose from the Battle Actions highlighted above, and use them to defeat your enemies listed to the right. When all enemies are reduced to zero Health, you win. If your Health reaches zero, you are defeated.' : '选择上面的任意一个行动来打倒右侧的敌人。当所有敌人生命为0时，你获得胜利，当你的生命为0时，你被打败。',



    /////////////////////////////////////////////////////效果、需求说明
        'Expires if magic is depleted to below 10%' : '如果你的MP低于10%将会消散',
        'Permanent until triggered' : '直到触发前将会一直有效',
        '/Expires in (\\d+) turns?/' : '剩余持续时间 $1 回合',
        '/Requires (\\d+) Magic Points to use/' : '需要 $1 点 MP',
        '/Requires (\\d+) Charges? to use/' : '需要 $1 格斗气',
        '/Requires (\\d+) Magic Points and (\\d+) Charges? to use/' : '需要 $1 点 MP 和 $2 格斗气',
        '/Cooldown: (\\d+) turns?/' : '冷却时间: $1 回合',

    /////////////////////////////////////////////////////技能、技巧名称
        // 使用skills字典
    /////////////////////////////////////////////////////技能、技巧说明
        //先天技能
        'Run away from the current battle.' : '从战斗中逃跑，逃跑可能需要完整的一回合才会生效，在此期间怪物仍然可以攻击。',
        'Retrieve data on the target.' : '探查目标的情报。',

        'Massive AoE damage to all enemies on the battlefield.' : '对战场上所有的敌人造成2000%的虚空伤害。',
        'Damages and temporarily staggers all enemies on the battlefield.' : '对战场上所有的敌人造成500%的虚空伤害并导致其晕眩 5 回合。',

        //武器技能
        'A precision strike towards the sensory organs of your enemy inflicts massive damage and temporarily blinds it.' : '造成500%伤害，并使目标致盲 100 回合。',
        'Does additional damage to blinded targets.' : '造成1000%伤害，对致盲的目标伤害加倍。 50% 机率使致盲的目标中毒（每回合造成持续伤害且无法闪避） 15 回合。',
        'Hits up to five targets multiple times.' : '对5名敌人共造成 10~20 次250%的伤害。',

        'Bash an enemy with your shield to stun it, which opens up for devastating strikes with your weapon.' : '造成500%伤害，使目标晕眩 5 回合。造成打击伤害。',
        'Follow up with an attack that, if used on a stunned target, causes a large amount of damage and a chance of inflicting bleed.' : '造成500%伤害，对已晕眩的敌人造成 5 层流血效果（50%伤害比例），持续 10 回合。对眩晕敌人造成4倍伤害。',
        'Finish off a mortally wounded enemy. Instantly kills a target with bleed and less than 25% health.' : '造成1000%伤害，扑杀生命值低于 25% 且正在流血的敌人。',

        'Focus a powerful strike on a single enemy.' : '对单体敌人造成1000%伤害。',
        'Tears through enemy defenses, leaving them vulnerable for followup attacks.' : '对5名敌人造成500%伤害，并给予 3 层破甲效果 5 回合。',
        'A mighty swing with your weapon causes all enemies with penetrated armor to stagger.' : '对5名敌人造成500%伤害，并令破甲单位晕眩 5 回合。',

        'Channels the power of the heavens for a powerful strike that causes massive carnage.' : '对5名敌人造成500%伤害，并造成 3 层破甲和 5 层流血效果（20%伤害比例）5回合。',

        'Focus your magical power into your staff for a precision strike towards the head of your enemy, causing major damage and stunning it.' : '造成100%伤害，使目标晕眩 5 回合，但不会使已晕眩的目标再晕眩。视为法术攻击，可触发魔力合流。',


        //辅助咒语（BUFF）
        'Restores a moderate amount of Health on the target.' : '使目标恢复中量生命值。',
        'Fully restores the Health of the target.' : '使目标恢复全部生命值。',
        'The next magical attack against the target has a chance to be absorbed and partially converted to MP.' : '当本回合受到非暴击的法术攻击时将有机率将其无效化并偷取攻击者一部分魔力补充自身。',
        'Speeds up all actions of the target, allowing it to attack more frequently.' : '加速目标的所有行动，使他行动更频繁。',
        'Places a shield effect on the target, absorbing' : '对目标施加护盾效果，增加自身',
        'of the damage from all attacks.' : '的物理魔法减伤。',
        'Places a heal over time effect on the target.' : '在目标身上施加持续性治疗效果。',
        'Surrounds the target with a veil of shadows, making it harder to hit with attacks and spells.' : '一层幻影面纱包围目标，使他不容易被攻击和咒语击中。',
        'Any attack that would one-shot a target with more than 1 HP leaves it alive but on the brink of defeat. The buff is removed when triggered.' : '当目标受到任何致命攻击时会以1HP保住性命。辅助效果在触发之后就会消失 (并且消耗玩家的基础灵力值 50%)。',
        'Powerful attacks against you will be partially absorbed and damage your spirit gauge instead of health.' : '根据你灵力盾当前的触发阈值，当你受到超过该阈值的伤害时，降低受到的生命值损伤至触发阈值，剩余伤害转而以SP承担。',
        'The target attains a higher level of attunement with the arcane forces, increasing magic power and crit chance.' : '使目标经由奥术力量点化而到达更高的境界，强化魔法伤害与暴击率。',
        'The target attains intimate knowledge of the flow of life in all living beings, increasing attack power and crit chance.' : '使目标到达精通万物生命源流的境界，强化攻击伤害与暴击率。',

        //减益咒语（DEBUFF）
        'A net of pure energy ensnares the target, slowing it by' : '使用一张能量网诱捕目标，使其行动速度降低',
        'and making it unable to evade attacks or spells.' : '无法回避与抵抗法术',
        'Blinds the target, reducing the chance of it landing attacks and hitting with magic spells.' : '使目标致盲，降低攻击与法术的命中率。',
        'Inflicts Drain on one target, causing damage over time.' : '对目标施加枯竭，给予持续伤害。',
        'Confuses the target, making it lunge out wildly and strike friends and foes alike.' : '使目标产生错乱，如同面对敌人似地疯狂的对伙伴进行攻击。',
        'The target is imperiled, reducing physical and magical mitigation as well as elemental mitigations.' : '威胁目标，降低它的物理和魔法减伤，同时也降低其元素减伤。',
        'The target is silenced, preventing it from using special attacks and magic.' : '使目标沉默，防止它使用技能攻击。',
        'The target is lulled to sleep, preventing it from taking any actions.' : '催眠目标，防止它采取任何行动。',
        'The target is slowed by' : '使目标减速',
        'making it attack less frequently.': '降低目标的攻击速度',
        'The target is weakened, making it deal less damage, and preventing it from scoring critical hits.' : '使目标弱化，让它的攻击打出较低伤害且能防止它打出暴击。',

        //攻击咒语
        'A ball of fire is hurled at the target.' : '对着目标投掷一颗火球。',
        'A blast of wind hits the target, causing Wind damage.' : '刮起一阵风攻击目标，造成风属性伤害。',
        'A bolt of lightning strikes the target, causing Elec damage.' : '落下一道闪电击中目标，造成雷属性伤害。',
        'Unleashes an inferno of flames on all hostile targets, causing Fire damage.' : '释放一道地狱之火对付所有敌人，造成火属性伤害。',

        'Dark damage.' : '暗属性伤害',
        'Holy damage.' : '圣属性伤害',
        'Cold damage.' : '冰属性伤害',
        'Fire damage.' : '火属性伤害',
        'Wind damage.' : '风属性伤害',
        'Elec damage.' : '雷属性伤害',

    /////////////////////////////////////////////////////道具
        //由于和items物品字典并不是完全重合，为了效率考虑这里仍然单独重复写了物品字典
        'This powerup will restore a large amount of health.' : '立刻回复100%的基础HP(战场道具，无法带出战斗)',
        'This powerup will restore a moderate amount of mana.' : '立刻回复50%的基础MP(战场道具，无法带出战斗)',
        'This powerup will restore a small amount of spirit.' : '立刻回复50%的基础SP(战场道具，无法带出战斗)',
        'This powerup will grant you the Channeling effect.' : '给予 15 回合的引导效果，施放法术会消耗该效果。(战场道具，无法带出战斗。获得引导时，施放的咒语效果增强 50% 且只会消耗 1 点魔力值。)',

        'Provides a long-lasting health restoration effect.' : '持续回复一定量的生命，持续50回合.',
        'Instantly restores a large amount of health.' : '立刻回复大量的生命.',
        'Fully restores health, and grants a long-lasting health restoration effect.' : '生命值全满,并持续回复一定量的生命，持续100回合.',
        'Provides a long-lasting mana restoration effect.' : '持续回复一定量的魔力值，持续50回合.',
        'Instantly restores a moderate amount of mana.' : '立刻回复一定量的魔力值.',
        'Fully restores mana, and grants a long-lasting mana restoration effect.' : '魔力值全满,并持续回复一定量的魔力值，持续100回合.',
        'Provides a long-lasting spirit restoration effect.' : '持续回复一定量的灵力值，持续50回合.',
        'Instantly restores a moderate amount of spirit.' : '立刻回复一定量的灵力值.',
        'Fully restores spirit, and grants a long-lasting spirit restoration effect.' : '灵力值全满,并持续回复一定量的灵力值，持续100回合.',
        'Fully restores all vitals, and grants long-lasting restoration effects.' : '生命,魔力,灵力全满,并同时产生三种长效药的效果，持续100回合.',
        'Restores 10 points of Stamina, up to the maximum of 99. When used in battle, also boosts Overcharge and Spirit by 10% for ten turns.' : '恢复10点精力，但不超过99，每回合增加10%的灵力和斗气.',
        'Restores 5 points of Stamina, up to the maximum of 99. When used in battle, also boosts Overcharge and Spirit by 10% for five turns.' : '恢复5点精力，但不超过99，每回合增加10%的灵力和斗气.',
        'There are three flowers in a vase. The third flower is green.' : '你的攻击伤害、魔法伤害提升25%，命中率、暴击率、回避率、抵抗率大幅提升，持续50回合。',
        'It is time to kick ass and chew bubble-gum... and here is some gum.' : '你的攻击和魔法伤害提升100%。必定命中且必定暴击，持续50回合。',
        'You gain +25% resistance to Fire elemental attacks and do 25% more damage with Fire magicks.' : '你获得 +25% 的火焰抗性且获得 25% 的额外火焰魔法伤害。',
        'You gain +25% resistance to Cold elemental attacks and do 25% more damage with Cold magicks.' : '你获得 +25% 的冰冷抗性且获得 25% 的额外冰冷魔法伤害。',
        'You gain +25% resistance to Elec elemental attacks and do 25% more damage with Elec magicks.' : '你获得 +25% 的闪电抗性且获得 25% 的额外闪电魔法伤害。',
        'You gain +25% resistance to Wind elemental attacks and do 25% more damage with Wind magicks.' : '你获得 +25% 的疾风抗性且获得 25% 的额外疾风魔法伤害。',
        'You gain +25% resistance to Holy elemental attacks and do 25% more damage with Holy magicks.' : '你获得 +25% 的神圣抗性且获得 25% 的额外神圣魔法伤害。',
        'You gain +25% resistance to Dark elemental attacks and do 25% more damage with Dark magicks.' : '你获得 +25% 的黑暗抗性且获得 25% 的额外黑暗魔法伤害。',
        'Grants the Haste effect.' : '使用后产生加速（60%加速）效果，持续100回合',
        'Grants the Protection effect.' : '使用后产生保护（50%减伤）效果，持续100回合',
        'Grants the Haste and Protection effects with twice the normal duration.' : '使用后产生加速和保护的效果，持续200回合',
        'Grants the Absorb effect.' : '使用后获得吸收（100%触发）效果，持续100回合',
        'Grants the Shadow Veil effect.' : '使用产生暗影面纱（30%闪避）效果，持续100回合',
        'Grants the Spark of Life effect.' : '使用产生生命火花（受到致命伤害后消耗25%基础SP，并以50%最大生命复活）效果，持续100回合',
        'Grants the Absorb, Shadow Veil and Spark of Life effects with twice the normal duration.' : '同时产生吸收，闪避，以及生命火花效果，持续200回合',

        'Health Gem' : '生命宝石',
        'Mana Gem' : '魔力宝石',
        'Spirit Gem' : '灵力宝石',
        'Mystic Gem' : '神秘宝石',
        'Health Potion' : '生命药水',
        'Health Draught' : '生命长效药',
        'Health Elixir' : '生命秘药',
        'Mana Potion' : '法力药水',
        'Mana Draught' : '法力长效药',
        'Mana Elixir' : '法力秘药',
        'Spirit Potion' : '灵力药水',
        'Spirit Draught' : '灵力长效药',
        'Spirit Elixir' : '灵力秘药',
        'Last Elixir' : '终极秘药',
        'Energy Drink' : '能量饮料',
        'Caffeinated Candy' : '咖啡因糖果',
        'Soul Stone' : '灵魂石',
        'Flower Vase' : '花瓶',
        'Bubble-Gum' : '泡泡糖',
        'Infusion of Darkness' : '黑暗魔药',
        'Infusion of Divinity' : '神圣魔药',
        'Infusion of Storms' : '风暴魔药',
        'Infusion of Lightning' : '闪电魔药',
        'Infusion of Frost' : '冰冷魔药',
        'Infusion of Flames' : '火焰魔药',
        'Infusion of Gaia' : '盖亚魔药',
        'Scroll of Swiftness' : '加速卷轴',
        'Scroll of the Avatar' : '化身卷轴',
        'Scroll of Shadows' : '幻影卷轴',
        'Scroll of Absorption' : '吸收卷轴',
        'Scroll of Life' : '生命卷轴',
        'Scroll of Protection' : '保护卷轴',
        'Scroll of the Gods' : '神之卷轴',

    /////////////////////////////////////////////////////状态
        //先天能力
        '/^Focusing$/' : '专注',
        '/^Defending$/' : '防御',
        '/^Fleeing$/' : '逃跑',
        'You are mentally prepared for casting a magical attack. The chance for your spell being evaded or resisted is reduced, but so are your avoidance stats.' : '你正集中精力准备释放法术，你的法术被闪避和被抵抗概率降低，但你自身的躲避能力同样下降。',
        'You are mentally prepared for casting a magical attack. The chance for your spell being evaded or resisted is reduced, but so is your chance to avoid attacks.' : '你正集中精力准备释放法术，你的法术被闪避和被抵抗概率降低，但你自身的躲避能力同样下降。',
        'You are defending from enemy blows. The amount of damage you take is reduced by' : '你正在防御敌人的进攻，你遭受的攻击伤害将减少',
        'You are running away' : '你正尝试从战场中逃离',

        //战斗风格
        'Overwhelming Strikes' : '压制打击',
        '/^Coalesced Mana$/' : '魔力合流',
        'Ether Tap' : '魔力回流',
        'Increases attack damage by 15% and attack accuracy by 50%. Also grants a 20% chance per stack to overwhelm enemy parry.' : '增加15%攻击伤害和50%命中率，以及20%的反招架率，最大可堆叠5层',
        'Mystical energies have converged on this target. Striking it with any magic spell will consume only half the normal mana.' : '神秘的能量汇集于这个目标，对其施放法术只需消耗一半的魔力值 (可以和灵动架式共同作用)。',
        'You are absorbing magicks from shattering the Coalesced Mana surrounding a target.' : '你打散了合流于目标周围的魔力然后吸取中。',

        //武器效果
        'Penetrated Armor' : '破甲',
        'Stunned' : '眩晕',
        'Bleeding Wound' : '流血',
        'A powerful blow has temporarily stunned this target.' : '巨大的冲击使目标陷入眩晕，它将无法继续行动。',
        'The armor of this target has been breached, reducing its physical defenses.' : '目标的护甲被破坏了，它的物理减伤下降了25% ',
        'A gashing wound is making this target take damage over time.' : '血流如注的伤口给予此目标持续伤害。',

        //特殊
        '/^Channeling$/' : '引导',
        'Blessing of the RiddleMaster' : '御谜士的祝福',
        'You are channeling the mystic forces of the ever-after. Your next spell is powered up by 50%, and costs no MP.' : '你正不断地引导出神祕的力量，你下一次施放的咒语效果会增强 50% 且只会消耗 1 点魔力值。',
        'You have been blessed by the RiddleMaster. Your attack and magic damage are temporarily increased by' : '你已被御谜士祝福，你的攻击和魔法伤害会短暂提升',

        //恢复剂
        'Refreshment' : '提神',
        'Regeneration' : '再生',
        'Replenishment' : '补给',
        'Energized' : '充满活力',
        'Kicking Ass': '海扁',
        'Sleeper Imprint' : '沉睡烙印',
        'You are generating additional Overcharge and Spirit.' : '你正在产生额外的斗气和灵力。',
        'The holy effects of the spell are restoring your body.' : '神奇的细胞再生效果正在修复你的身体',
        'The Spirit Restorative is refreshing your spirit.' : '灵力恢复剂正在恢复你的灵力',
        'The Health Restorative is regenerating your body.' : '生命恢复剂正在恢复你的生命',
        'The Mana Restorative is replenishing your magic reserves.' : '魔力恢复剂正在恢复你的魔力',
        'Your attacks and spells deal twice as much damage for a short time, will always hit, and will always land critical hits.' : '你的攻击和魔法伤害提升100%。必定命中且必定暴击，持续50回合。',
        'Your attack/magic rating, attack/magic hit/crit chance and evade/resist chance increases significantly for a short time.' : '你的攻击伤害、魔法伤害提升25%，命中率、暴击率、回避率、抵抗率大幅提升，持续50回合。', //20210120验证，以下两条为WIKI内容暂保留
        'Your attacks and spells deal significantly more damage for a short time, will always hit, and will always land critical hits. Also replenishes 20% of base mana and health per turn.' : '你的攻击和咒语伤害短暂大幅提升。必定命中且必定暴击。同时每回合补充 20% 基础魔力与基础生命值。',
        'Your attack/magic damage, attack/magic hit/crit chance, and evade/resist chance increases significantly for a short time.' : '你的物理/魔法 伤害、命中、暴击率、回避、抵抗率短暂大幅提升。',

        //卷轴
        '(Scroll' : '(卷轴',
        'Increases Action Speed by' : '增加行动速度',
        'Absorbs all damage taken by' : '吸收所有伤害的',
        'Increases evasion by' : '增加闪避率',
        'Any attack that would normally kill the target leaves it alive with 50% HP. The buff is removed when triggered.' : '任何本该杀死玩家的攻击现在玩家可以保留50%的HP存活。辅助效果在触发之后就会消失 (并且消耗玩家25%基础灵力值)',
        'The next magical attack against the target will be absorbed and partially converted to MP.' : '命中此目标的下一次魔法伤害将100%被吸收并转为MP',

        //魔药
        'Infused Flames' : '火焰注入',
        'Infused Frost' : '冰霜缠绕',
        'Infused Lightning' : '雷电缠身',
        'Infused Storm' : '暴风环绕',
        'Infused Divinity' : '神圣附体',
        'Infused Darkness' : '黑暗笼罩',
        'You are wreathed in the power of flames.' : '你被火焰的力量环绕着。',
        'You are suffused with the power of frost.' : '你周身充满了冰霜的力量。',
        'You are surrounded by the power of lightning.' : '你被雷电的力量围绕着。',
        'You are draped in the power of storms.' : '你驾驭着暴风的力量。',
        'You are veiled in the power of divinity.' : '你蒙上了神圣的力量。',
        'You are cloaked in the power of darkness.' : '你被黑暗的力量所笼罩。',

        //BUFF的效果
        '/^Regen$/' : '细胞活化[S]',
        '/^Protection$/' : '守护[S]',
        '/^Spirit Shield$/' : '灵力盾[S]',
        '/^Shadow Veil$/' : '影纱[S]',
        '/^Hastened$/' : '急速[S]',
        '/^Absorbing Ward$/' : '吸收结界',
        '/^Spark of Life$/' : '生命火花[S]',
        '/^Cloak of the Fallen$/' : '陨落斗篷[S]',
        '/^Heartseeker$/' : '觅心者[S]',
        '/^Arcane Focus$/' : '奥术集中[S]',
        'The holy effects of the spell are restoring your body.' : '神奇的细胞再生效果正在恢复你的身体',
        'Places a shield effect on the target, absorbing' : '对目标施加护盾效果，吸收所有攻击',
        'of the damage from all attacks.' : '的伤害值。',
        'The target has been hastened, increasing its action speed by' : '目标已被加速，行动速度增加',
        'A veil of shadows surround the target, increasing its chance to evade attacks and spells by' : '目标被影纱包围，回避率增加',
        'A veil of shadows surround the target, causing monsters to occasionally whiff, and boosting Evade by 10%' : '一层影纱笼罩目标，使怪物偶尔攻击落空，并提升 10%的闪避',
        'This protective veil activates for powerful blows that damage more than' : '根据你灵力盾当前的触发阈值',
        'of your max HP, absorbing the remainder as spirit damage.' : '当你受到超过该阈值的伤害时，降低受到的生命值损伤至触发阈值，剩余伤害转而以SP承担。',
        'Any attack that would normally kill the target leaves it alive with a small amount of HP. The buff is removed when triggered.' : '受到任何致命攻击时会以1HP保住性命。辅助效果在触发之后就会消失 (并且消耗玩家50%基础灵力)。',
        'Being brought back by Spark of Life has draped you with this powerful protective shield, increasing your damage resistance for a brief time.' : '被“生命火花”带回战场的你披着此强力的防护盾，你的物理魔法减伤增加75%。',
        'You are able to see the flow of life in all living beings, increasing your attack damage by' : '你已到达精通万物生命源流的境界，强化攻击伤害',
        'and crit chance by': '和暴击率',
        'You are able to see the flow of life in all living beings, increasing your attack damage and crit multiplier by 25%' : '你已到达精通万物生命源流的境界，你的攻击伤害和暴击倍率提升 25%',
        'You have reached a high level of attunement with the arcane forces, increasing your magic damage by' : '你经由奥术的力量点化而到达更高的境界，强化魔法伤害',


        //DEBUFF效果
        '/^Weakened$/' : '虚弱',
        '/^Slowed$/' : '缓慢',
        '/^Magically Snared$/' : '魔磁网',
        '/^Immobilized$/' : '定身术',
        '/^Imperiled$/' : '陷危',
        '/^Silenced$/' : '沉默',
        '/^Asleep$/' : '沉眠',
        '/^Blinded$/' : '盲目',
        '/^Confused$/' : '混乱',
        'The target has been weakened, making it deal less damage, and preventing it from scoring critical hits.' : '目标已被弱化，它的攻击力与魔法伤害降低了，无法造成暴击。',
        'The target has been slowed by' : '目标已被缓慢，行动速度降低。',
        'The target has been hit with a magic net, eliminating its chance to evade or resist attacks.' : '目标已被能量网诱捕，削减它的回避和咒语抵抗。',
        'The target has been imperiled, reducing physical and magical mitigation as well as elemental mitigations.' : '目标已被威胁，降低它的物理和魔法减伤，同样也降低其元素减伤。',
        'The target has been silenced, preventing it from using special attacks and magic.' : '目标已被沉默，防止它释放魔法与灵力攻击。',
        'The target has been lulled to sleep, preventing it from taking any actions.' : '目标已进入沉睡，受到的伤害增加50%，并防止它采取任何行动。',
        'The target has been blinded, reducing the chance of landing attacks and hitting with magic spells.' : '目标已致盲，降低其攻击与法术的命中率。',
        'The target has been confused, making it lunge out wildly and strike friends and foes alike.' : '目标产生错乱，有25%几率对友军发起攻击。',

        'Vital Theft' : '生命吸窃',
        'Ether Theft' : '魔力吸窃',
        'Spirit Theft' : '灵力吸窃',
        'Siphons off the target\'s life essence over time. This causes a damage-over-time effect, and returns a small amount of health to the player.' : '持续抽取目标的生命精髓。造成持续伤害效果而且少量的生命值会回到玩家身上。',
        'Siphons off the target\'s mana over time. This returns a small amount of mana to the player.' : '持续抽取目标的魔力值。少量的魔力值会回到玩家身上。',
        'Siphons off the target\'s spirit over time. This returns a small amount of spirit to the player.' : '持续抽取目标的灵力值。少量的灵力值会回到玩家身上。',


        //攻击咒语效果
        'Searing Skin' : '焦灼皮肤',
        'Freezing Limbs' : '冰封肢体',
        'Turbulent Air' : '空气湍流',
        'Deep Burns' : '深层灼伤',
        'Breached Defense' : '防御崩溃',
        'Blunted Attack' : '攻击钝化',
        'The skin of the target has been scorched, inhibiting its attack damage. Cold resistance is lowered.' : '此目标的皮肤已烧焦，抑制它的攻击力，冰冷抗性降低。',
        'The limbs of the target have been frozen, causing slower movement. Wind resistance is lowered.' : '此目标的肢体已被冻结，使它行动迟缓，疾风抗性降低。',
        'The air around the target has been upset, blowing up dust and increasing its miss chance. Elec resistance is lowered.' : '此目标周围的气流已被扰乱，扬起的尘土降低它的命中率，闪电抗性降低。',
        'Internal damage causes slower reactions and lowers evade and resist chance. Fire resistance is lowered.' : '体内的伤害导致反应迟钝，降低回避率与抵抗率，火焰抗性降低。',
        'The holy attack has penetrated the target defenses, making it take more damage. Dark resistance is lowered.' : '神圣的攻击刺穿了此目标的防御，它将会受到更多伤害，黑暗抗性降低。',
        'The decaying effects of the spell has blunted the target offenses, making it deal less damage. Holy resistance is lowered.' : '咒语的衰败效果磨钝目标的攻击性，使它打出较低伤害，神圣抗性降低。',

        'Burning Soul' : '焚烧的灵魂',
        'Ripened Soul' : '鲜美的灵魂',
        'The life essence of the target has been set ablaze, damaging its physical form over time.' : '此目标的生命之核已被点燃，对它造成持续伤害。',
        'The life essence of the target has been corrupted beyond repair, damaging its physical form over time.' : '此目标的生命之核持续著无法修补的腐败，对它造成持续伤害。',


        //特殊怪物效果
        'Fury of the Sisters' : '姊妹们的盛怒',
        'Lamentations of the Future' : '未来的悲叹',
        'Screams of the Past' : '昔日的凄叫',
        'Wails of the Present' : '此刻的恸哭',
        'The destruction of the world tree has infuriated its defenders, increasing their hit and crit chances.' : '世界之树的毁灭激怒了它的守护者，增加了它们的命中和暴击率。',
        'The destruction of the future has increased the attack power of her allies.' : '诗蔻蒂被击倒，消灭了“未来”，其他友军的攻击力被强化了。',
        'The destruction of the past has increased the defensive power of her allies.' : '兀儿德被击倒，消灭了“过去”，其他友军的防御力被强化了。',
        'The destruction the present has increased the attack speed of her allies.' : '蓓儿丹娣被击倒，消灭了“现在”，其他友军的攻击速度被强化了。',
    },

    ////////////////////////////////////////////////////////
    '' : {},
};








    //////////////////////////////////////////////////////////////////////////////
    // This is where the real code is
    // Don't edit below this
    // 翻译字典到上面为止全部结束，以下部分为真正的翻译代码
    // 除非你知道自己在干什么否则不要动下面的代码部分
    //////////////////////////////////////////////////////////////////////////////

    //原文切换功能所需变量
    var translatedList = new Map(), translated = true, changer;
    var translateStyle, imgTranslateWords = []; // 图片翻译相关变量
    // translatedList格式：key:已翻译元素, value: 该元素已被翻译属性和原文键值对（目前没考虑无法直接用key赋值的属性）
    //原文切换功能（整合了文本和图片翻译的切换）
    function restoreTranslate() {
        // 先处理静态元素的切换（从translatedList恢复）
        translatedList.forEach((data, elem) => {
            for (var item in data) {
                [elem[item], data[item]] = [data[item], elem[item]];
            }
        });

        // 切换图片翻译样式
        if (translateStyle && translateStyle.parentNode) {
            document.head.removeChild(translateStyle);
        } else if (translateStyle && translateStyle.innerHTML) {
            document.head.appendChild(translateStyle);
        }

        // 切换文字替换法的图片元素
        if (imgTranslateWords.length > 0) {
            imgTranslateWords.forEach(item => {
                if (translated) {
                    item.div.replaceWith(item.img);
                } else {
                    item.img.replaceWith(item.div);
                }
            });
        }

        translated = !translated;
        changer.innerHTML = translated?'英':'中';

        // 处理动态元素的切换
        // 注意：动态元素的初始翻译已经使用dynamic=false保存了原文
        // 所以它们会通过上面的translatedList.forEach自动切换
        // 但需要处理类选择器（如.showequip可能有多个）和动态加载的元素
        for (const [selector, value] of Object.entries(dictsMap)) {
            const isDynamic = dynamicElem.includes(selector);
            if (!isDynamic) continue; // 只处理动态元素

            // 使用querySelectorAll处理类选择器（如.showequip可能有多个）
            const elems = selector.startsWith('.')
                ? document.querySelectorAll(selector)
                : [document.querySelector(selector)].filter(Boolean);

            for (const elem of elems) {
                if (!elem) continue;

                // 如果切换到中文，需要重新翻译动态加载的内容
                // 因为可能有新的内容在切换后才加载
                if (translated) {
                    const dict = getCompiledDict(value);
                    translateText(elem, dict, false);
                    translateButtons(elem, dict, false);
                    translateElemTitle(elem, dict, false);
                }
                // 如果切换到英文，translatedList中已有的内容已经通过上面的forEach恢复了
                // 这里不需要额外处理
            }
        }

        // 处理一些特殊的动态容器（不在dictsMap中但需要翻译的）
        if (translated) {
            // 重新翻译装备详情
            const equipInfoContainer = document.querySelector('#equipinfo, #item_details');
            if (equipInfoContainer && equipInfoContainer.textContent.trim()) {
                const dict = getCompiledDict(['upgrades', 'equipsName', 'equipsInfo', 'character']);
                translateText(equipInfoContainer, dict, false);
                translateButtons(equipInfoContainer, dict, false);
                translateElemTitle(equipInfoContainer, dict, false);
            }

            // 重新翻译装备库说明文字（#equipblurb）和其他可能动态加载的容器
            const equipBlurb = document.querySelector('#equipblurb');
            if (equipBlurb && equipBlurb.textContent.trim()) {
                const dict = getCompiledDict(['upgrades', 'character']);
                translateText(equipBlurb, dict, false);
            }
        }
    }
    //初始化原文切换按钮
    function initRestoreButton() {
        if (changer) {
            return document.body.appendChild(changer);
        }
        document.addEventListener('keydown',(ev)=>{
            if(ev.altKey&&(ev.key=='a'||ev.key=='A')) {
                restoreTranslate();
            }
        });
        if(changer=document.getElementById('change-translate')) {
            return changer.addEventListener('click',restoreTranslate);
        }
        changer = document.createElement('span');
        changer.innerHTML = "英";
        changer.title = '点击切换翻译';
        changer.id = 'change-translate';
        changer.addEventListener('click',restoreTranslate);
        changer.style.cssText = "cursor:pointer;z-index:1000;font-size: 16px;position:fixed; top:5px; left:50px; color: white;background : black";
        document.body.appendChild(changer);
    }


    //战斗翻译开关（使用配置变量控制）
    window.translateBattle = !!BATTLE_TRANSLATE_ENABLED;


    ////////////////////////////////////////////////////////////////////////////////
    // 以下部分是正文的翻译
    ////////////////////////////////////////////////////////////////////////////////




(function () {
    var tagsWhitelist = ['BUTTON', 'TEXTAREA', 'SCRIPT', 'STYLE'],
        rIsRegexp = /^\/(.+)\/([gim]+)?$/;

    // 准备正则表达式
    function prepareRegex(string) {
        return string.replace(/([\[\]\^\&\$\.\(\)\?\/\\\+\{\}\|])/g, '\\$1');
    }

    // 决定父标签是否应该替换其文本
    function isTagOk(tag) {
        return !tagsWhitelist.includes(tag);
    }


    var regexps = new Map(); // 存储转换过的字典，key值和word字典对应分组名相同，value格式见下方buildDict;

    // 转换字典，使用方法将字符串字典转换为带正则表达式的匹配数组
    function buildDict(group) {
        if (regexps.has(group)) return regexps.get(group);

        delete words[group]['']; // 删除空行
        var reg;

        //按词条长度降序排序，确保长词优先匹配（如 "Mid-Grade Leather" 优先于 "Leather"）
        const entries = Object.entries(words[group]).sort((a, b) => b[0].length - a[0].length);

        const regexp = entries.map(([word, value]) => {
            if (reg = word.match(rIsRegexp)) {
                reg = new RegExp(reg[1], 'g')
            } else {
                reg = new RegExp(prepareRegex(word).replace(/\\?\*/g, function (fullMatch) {
                    return fullMatch === '\\*' ? '*' : '[^ ]*';
                }), 'g');
            }
            return { reg, value };
        });

        regexps.set(group, regexp);

        return regexp;
    }

    // 使用TreeWalker替代XPath
    function getTextNodes(elem) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            elem,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 过滤空白节点
                    if (!node.data || node.data.trim() === '') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        return textNodes;
    }

    // 翻译文本，使用指定字典对指定元素下的所有文字进行翻译
    // elem: 待翻译的页面元素, dict: 使用的翻译字典, dynamic: 是否动态元素
    // 动态元素将不会检查内容直接翻译，且不会保存切换原文，因为内容一旦变化就没有意义了
    function translateText(elem, dict, dynamic) {
        if (!elem || !dict) return;

        const texts = getTextNodes(elem);

        let translatedCount = 0;

        for (const text of texts) {
            // 检查父节点标签是否允许翻译
            if (!dynamic && !isTagOk(text.parentNode.tagName)) {
                continue;
            }

            let temp = text.data;

            // 提前过滤：只翻译包含英文的文本
            if (!/[a-zA-Z]/.test(temp)) {
                continue;
            }

            // AM 异世界系统消息弹窗专用句式预处理（#messagebox/#messagebox_inner）
            const inMsgBox = text.parentElement && text.parentElement.closest && text.parentElement.closest('#messagebox, #messagebox_inner');
            if (inMsgBox) {
                const equipDict = getCompiledDict(['equipsName','items','artifact']);
                const itemDict = getCompiledDict(['items','artifact']);
                const translateName = (name, useEquip = true) => {
                    let t = name;
                    const useDict = useEquip ? equipDict : itemDict;
                    for (const {reg, value} of useDict) t = t.replace(reg, value);
                    t = t.replace(/\bof\b/gi, ' ').replace(/\bthe\b/gi, ' ');
                    t = t.replace(/\s{2,}/g, ' ').trim();
                    return t;
                };
                // Bought N equipment for M Credits:
                temp = temp.replace(/^\s*Bought\s+(\d+)\s+equipment\s+for\s+([\d,]+)\s+Credits:?\s*$/i, (m, count, credits) => {
                    return `购买了 ${count} 件装备，花费 ${credits} Credits：`;
                });
                // Sold N equipment for M Credits:
                temp = temp.replace(/^\s*Sold\s+(\d+)\s+equipment\s+for\s+([\d,]+)\s+Credits:?\s*$/i, (m, count, credits) => {
                    return `出售了 ${count} 件装备，获得 ${credits} Credits：`;
                });
                // Bought X for N Credits
                temp = temp.replace(/^\s*Bought\s+(.+?)\s+for\s+([\d,]+)\s+Credits\s*$/i, (m, name, credits) => {
                    return `购买了 ${translateName(name, true)}，花费 ${credits} Credits`;
                });
                // Sold X for N Credits
                temp = temp.replace(/^\s*Sold\s+(.+?)\s+for\s+([\d,]+)\s+Credits\s*$/i, (m, name, credits) => {
                    return `出售了 ${translateName(name, true)}，获得 ${credits} Credits`;
                });
                // Salvaged X
                temp = temp.replace(/^\s*Salvaged\s+(.+?)\s*$/i, (m, name) => {
                    return `已分解 ${translateName(name, true)}`;
                });
                // Acquired Nx ItemName
                temp = temp.replace(/^\s*Acquired\s+(\d+)x\s+(.+?)\s*$/i, (m, count, name) => {
                    return `获得 ${count}x ${translateName(name, false)}`;
                });
                // Sold the salvage remains for N Credits
                temp = temp.replace(/^\s*Sold\s+the\s+salvage\s+remains\s+for\s+([\d,]+)\s+Credits\s*$/i, (m, credits) => {
                    return `残骸出售后获得 ${credits} Credits`;
                });
            }

            for (const item of dict) {
                temp = temp.replace(item.reg, item.value);
            }

            if (temp !== text.data) {
                if (!dynamic && !translatedList.has(text)) {
                    translatedList.set(text, { data: text.data });
                }
                text.data = temp;
                translatedCount++;
            }
        }
    }

    // 字典预编译缓存，避免重复构建字典
    var compiledDictsCache = new Map();

    function getCompiledDict(dictNames) {
        const cacheKey = dictNames.join(',');
        if (compiledDictsCache.has(cacheKey)) {
            return compiledDictsCache.get(cacheKey);
        }
        const dict = dictNames.map(buildDict).flat();
        compiledDictsCache.set(cacheKey, dict);
        return dict;
    }

    // 翻译整个正文文本
    function translateAllText() {
        var dynamicDict = new Map();

        // 批处理队列和防抖，减少重复翻译
        let pendingMutations = [];
        let debounceTimer = null;

        function processMutations() {
            if (!translated || pendingMutations.length === 0) return;

            // 去重：同一个元素只处理一次
            const uniqueElements = new Map();
            for (const mutation of pendingMutations) {
                // 查找最近的被观察的祖先元素
                let elem = mutation.target;
                while (elem && !dynamicDict.has(elem)) {
                    elem = elem.parentElement;
                }

                if (elem && !uniqueElements.has(elem)) {
                    uniqueElements.set(elem, dynamicDict.get(elem));
                }
            }

            // 批量翻译
            for (const [elem, dict] of uniqueElements) {

                // 使用 getComputedStyle 检查实际可见性，而不是只检查内联样式
                const visibility = window.getComputedStyle(elem).visibility;
                if (visibility !== 'hidden') {
                    translateText(elem, dict, true);
                    translateButtons(elem, dict, true);
                    translateElemTitle(elem, dict, true);
                }
            }

            pendingMutations = [];
        }

        var observer = new MutationObserver((mutations) => {
            if (!translated) return;

            // 滤无关变更
            const relevantMutations = mutations.filter(mutation => {
                // 忽略属性变更（除了特定属性）
                if (mutation.type === 'attributes') {
                    return ['title', 'value'].includes(mutation.attributeName);
                }
                // 只处理文本和子节点变更
                return mutation.type === 'characterData' || mutation.type === 'childList';
            });

            if (relevantMutations.length === 0) return;


            const isSingleChange = relevantMutations.length === 1;

            pendingMutations.push(...relevantMutations);

            if (isSingleChange) {
                // 快速通道：立即翻译（无闪烁）
                processMutations();
            } else {
                // 慢速通道：防抖处理
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(processMutations, 150);
            }
        });
        for (const [selector, value] of Object.entries(dictsMap)) {
            // 使用querySelectorAll处理类选择器（如.equiplist可能有多个）
            const elems = selector.startsWith('.')
                ? document.querySelectorAll(selector)
                : [document.querySelector(selector)].filter(Boolean);

            if (elems.length === 0) continue;

            const isDynamic = dynamicElem.includes(selector);
            const dict = getCompiledDict(value); // 使用预编译缓存
            // 对于动态元素，初始翻译时使用dynamic=false以保存原文，便于切换
            // 后续的MutationObserver回调中使用dynamic=true，不保存原文（因为内容可能会变化）

            for (const elem of elems) {
                translateText(elem, dict, false); // 初始翻译都使用false以保存原文
                translateButtons(elem, dict, false);
                translateElemTitle(elem, dict, false);
                if (isDynamic) {
                    dynamicDict.set(elem, dict);
                    // 针对 messagebox/confirm 等动态文本使用 characterData 监听
                    const needCharData = ['#messagebox','#messagebox_inner','#confirm_outer'].some(sel => {
                        try { return elem.matches && elem.matches(sel); } catch(e) { return false; }
                    });
                    const options = { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'title'] };
                    if (needCharData) options.characterData = true;
                    observer.observe(elem, options);
                }
            }
        }
    }

    // 翻译指定元素下的所有按钮，包含自身
    function translateButtons(target, dict, isDynamic) {
        if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement) {
            translateButton(target, dict, isDynamic);
        } else {
            // 翻译 input[type="submit"] 按钮
            Array.from(target.querySelectorAll('input[type="submit"]')).forEach(elem => {
                translateButton(elem, dict, isDynamic);
            });
            // 翻译 <button> 元素
            Array.from(target.querySelectorAll('button')).forEach(elem => {
                translateButton(elem, dict, isDynamic);
            });
        }
    }

    // 翻译表单按钮
    function translateButton(elem, dict, isDynamic) {
        // 判断是 input 还是 button 元素
        var isInput = elem instanceof HTMLInputElement;
        var text = isInput ? elem.value : elem.textContent;

        // 提前过滤：只翻译包含英文的按钮文本
        if (!/[a-zA-Z]/.test(text)) return;

        var originalText = text;
        for (var item of dict) {
            text = text.replace(item.reg, item.value);
        }

        if (text != originalText) {
            if (!isDynamic) {
                translatedList.set(elem, isInput ? { value: originalText } : { textContent: originalText });
            }
            if (isInput) {
                elem.value = text;
            } else {
                elem.textContent = text;
            }
        }
    }

    // 翻译页面元素悬停的文字提示
    function translateElemTitle(target, dict, isDynamic) {
        Array.from(target.querySelectorAll('[title]')).forEach(elem => {
            var txt = elem.title;

            // 提前过滤：只翻译包含英文的title
            if (!txt || !/[a-zA-Z]/.test(txt)) return;

            for (var item of dict) {
                txt = txt.replace(item.reg, item.value);
            }
            if (txt != elem.title) {
                if (!isDynamic) translatedList.set(elem, { title: elem.title });
                elem.title = txt;
            }
        });
    }

    // 挟持浏览器弹窗方法并在弹窗之前先翻译文本
    function hookAlertTranslate() {
        var alertBk = window.alert, promptBk = window.prompt, confirmBk = window.confirm;
        var dict = buildDict('alerts');
        function translateAlert(txt) {
            if (txt == undefined) return '';
            else if (translated && typeof (txt) == 'string') {
                for (var item of dict) {
                    txt = txt.replace(item.reg, item.value);
                }
            }
            return txt;
        }
        window.alert = function (txt) { alertBk(translateAlert(txt)) }
        window.prompt = function (txt, value) { return promptBk(translateAlert(txt), value) }
        window.confirm = function (txt) { return confirmBk(translateAlert(txt)) }
    }
    hookAlertTranslate();

    ////////////////////////////////////////////////////////////////////////////////
    // 图片按钮汉化功能（整合自 HV 图片按钮汉化.user.js）
    ////////////////////////////////////////////////////////////////////////////////

    // 图片翻译字典
    var imgWords = [
        {
            'text' : '创建一个克隆角色',
            'active' : '/y/character/persona_create_clone.png',
            'disactive' : '/y/character/persona_create_clone_d.png'
        },{
            'text' : '创建一个全新角色',
            'active' : '/y/character/persona_create_blank.png',
            'disactive' : '/y/character/persona_create_blank_d.png'
        },{
            'text' : '训练',
            'active' : '/y/training/train.png',
            'disactive' : '/y/training/train_d.png'
        },{
            'text' : '套装一',
            'active' : '/y/equip/set1_on.png',
            'disactive' : '/y/equip/set1_off.png'
        },{
            'text' : '套装二',
            'active' : '/y/equip/set2_on.png',
            'disactive' : '/y/equip/set2_off.png'
        },{
            'text' : '套装三',
            'active' : '/y/equip/set3_on.png',
            'disactive' : '/y/equip/set3_off.png'
        },{
            'text' : '套装四',
            'active' : '/y/equip/set4_on.png',
            'disactive' : '/y/equip/set4_off.png'
        },{
            'text' : '套装五',
            'active' : '/y/equip/set5_on.png',
            'disactive' : '/y/equip/set5_off.png'
        },{
            'text' : '套装六',
            'active' : '/y/equip/set6_on.png',
            'disactive' : '/y/equip/set6_off.png'
        },{
            'text' : '套装七',
            'active' : '/y/equip/set7_on.png',
            'disactive' : '/y/equip/set7_off.png'
        },{
            'text' : '常规',
            'active' : '/y/ab/tageneral.png',
            'disactive' : '/y/ab/tdgeneral.png'
        },{
            'text' : '重甲',
            'active' : '/y/ab/taheavy.png',
            'disactive' : '/y/ab/tdheavy.png'
        },{
            'text' : '布甲',
            'active' : '/y/ab/tacloth.png',
            'disactive' : '/y/ab/tdcloth.png'
        },{
            'text' : '轻甲',
            'active' : '/y/ab/talight.png',
            'disactive' : '/y/ab/tdlight.png'
        },{
            'text' : '双持',
            'active' : '/y/ab/tadualwield.png',
            'disactive' : '/y/ab/tddualwield.png'
        },{
            'text' : '二天',
            'active' : '/y/ab/taniten.png',
            'disactive' : '/y/ab/tdniten.png'
        },{
            'text' : '单手',
            'active' : '/y/ab/taonehanded.png',
            'disactive' : '/y/ab/tdonehanded.png'
        },{
            'text' : '双手',
            'active' : '/y/ab/tatwohanded.png',
            'disactive' : '/y/ab/tdtwohanded.png'
        },{
            'text' : '法杖',
            'active' : '/y/ab/tastaff.png',
            'disactive' : '/y/ab/tdstaff.png'
        },{
            'text' : '增益魔法1',
            'active' : '/y/ab/tasupportive1.png',
            'disactive' : '/y/ab/tdsupportive1.png'
        },{
            'text' : '增益魔法2',
            'active' : '/y/ab/tasupportive2.png',
            'disactive' : '/y/ab/tdsupportive2.png'
        },{
            'text' : '减益魔法1',
            'active' : '/y/ab/tadeprecating1.png',
            'disactive' : '/y/ab/tddeprecating1.png'
        },{
            'text' : '减益魔法2',
            'active' : '/y/ab/tadeprecating2.png',
            'disactive' : '/y/ab/tddeprecating2.png'
        },{
            'text' : '神圣魔法',
            'active' : '/y/ab/tadivine.png',
            'disactive' : '/y/ab/tddivine.png'
        },{
            'text' : '元素魔法',
            'active' : '/y/ab/taelemental.png',
            'disactive' : '/y/ab/tdelemental.png'
        },{
            'text' : '黑暗魔法',
            'active' : '/y/ab/taforbidden.png',
            'disactive' : '/y/ab/tdforbidden.png'
        },{
            'text' : '重置',
            'active' : '/y/ab/reset_a.png',
            'disactive' : '/y/ab/reset_d.png'
        },{
            'text' : '确定',
            'active' : '/y/shops/accept.png',
            'disactive' : '/y/shops/accept_d.png'
        },{
            'text' : '附魔',
            'active' : '/y/shops/enchant.png',
            'disactive' : '/y/shops/enchant_d.png'
        },{
            'text' : '强化',
            'active' : '/y/shops/upgrade.png',
            'disactive' : '/y/shops/upgrade_d.png'
        },{
            'text' : '重命名',
            'active' : '/y/shops/rename.png',
            'disactive' : '/y/shops/rename_d.png'
        },{
            'text' : '重铸选中装备',
            'active' : '/y/shops/reforge.png',
            'disactive' : '/y/shops/reforge_d.png'
        },{
            'text' : '修复选中装备',
            'active' : '/y/shops/repair.png',
            'disactive' : '/y/shops/repair_d.png'
        },{
            'text' : '全部修复',
            'active' : '/y/shops/repairall.png',
            'disactive' : '/y/shops/repairall_d.png',
        },{
            'text' : '分解选中装备',
            'active' : '/y/shops/salvage.png',
            'disactive' : '/y/shops/salvage_d.png'
        },{
            'text' : '查看可用附魔',
            'active' : '/y/shops/showenchants.png',
            'disactive' : '/y/shops/showenchants_d.png'
        },{
            'text' : '查看可用强化',
            'active' : '/y/shops/showupgrades.png',
            'disactive' : '/y/shops/showupgrades_d.png'
        },{
            'text' : '灵魂绑定装备',
            'active' : '/y/shops/soulfuse.png',
            'disactive' : '/y/shops/soulfuse_d.png'
        },{
            'text' : '武器：单手',
            'active' : '/y/shops/1handed_on.png',
            'disactive' : '/y/shops/1handed_off.png'
        },{
            'text' : '武器：双手',
            'active' : '/y/shops/2handed_on.png',
            'disactive' : '/y/shops/2handed_off.png'
        },{
            'text' : '武器：法杖',
            'active' : '/y/shops/staff_on.png',
            'disactive' : '/y/shops/staff_off.png'
        },{
            'text' : '护甲：盾牌',
            'active' : '/y/shops/shield_on.png',
            'disactive' : '/y/shops/shield_off.png'
        },{
            'text' : '护甲：布甲',
            'active' : '/y/shops/acloth_on.png',
            'disactive' : '/y/shops/acloth_off.png'
        },{
            'text' : '护甲：重甲',
            'active' : '/y/shops/aheavy_on.png',
            'disactive' : '/y/shops/aheavy_off.png'
        },{
            'text' : '护甲：轻甲',
            'active' : '/y/shops/alight_on.png',
            'disactive' : '/y/shops/alight_off.png'
        },{
            'text' : '献祭',
            'active' : '/y/shops/offering.png',
            'disactive' : '/y/shops/offering_d.png'
        },{
            'text' : '放弃头奖',
            'active' : '/y/shops/lottery_donotwant_a.png',
            'disactive' : '/y/shops/lottery_donotwant_d.png'
        },{
            'text' : '使用黄金彩票券',
            'active' : '/y/shops/lottery_golden_a.png',
            'disactive' : '/y/shops/lottery_golden_d.png'
        },{
            'text' : '下一期彩票>',
            'active' : '/y/shops/lottery_next_a.png',
            'disactive' : '/y/shops/lottery_next_d.png'
        },{
            'text' : '<上一期彩票',
            'active' : '/y/shops/lottery_prev_a.png',
            'disactive' : '/y/shops/lottery_prev_d.png'
        },{
            'text' : '今天的彩票',
            'active' : '/y/shops/lottery_today_a.png',
            'disactive' : '/y/shops/lottery_today_d.png'
        },{
            'text' : '购买彩票',
            'active' : '/y/shops/buytickets.png',
            'disactive' : '/y/shops/buytickets_d.png'
        },{
            'text' : '创建怪物',
            'active' : '/y/monster/createmonster.png',
            'disactive' : '/y/monster/createmonster_d.png'
        },{
            'text' : '安抚所有怪物',
            'active' : '/y/monster/drugallmonsters.png',
            'disactive' : '/y/monster/drugallmonsters_d.png'
        },{
            'text' : '安抚怪物',
            'active' : '/y/monster/drugmonster.png',
            'disactive' : '/y/monster/drugmonster_d.png'
        },{
            'text' : '喂养所有怪物',
            'active' : '/y/monster/feedallmonsters.png',
            'disactive' : '/y/monster/feedallmonsters_d.png'
        },{
            'text' : '喂养怪物',
            'active' : '/y/monster/feedmonster.png',
            'disactive' : '/y/monster/feedmonster_d.png'
        },{
            'text' : '解锁新培养槽',
            'active' : '/y/monster/unlock_slot.png',
            'disactive' : '/y/monster/unlock_slot_d.png'
        },{
            'text' : '力量',
            'active' : '/y/monster/str_a.png',
            'disactive' : '/y/monster/str.png'
        },{
            'text' : '灵巧',
            'active' : '/y/monster/dex_a.png',
            'disactive' : '/y/monster/dex.png'
        },{
            'text' : '敏捷',
            'active' : '/y/monster/agi_a.png',
            'disactive' : '/y/monster/agi.png'
        },{
            'text' : '体质',
            'active' : '/y/monster/end_a.png',
            'disactive' : '/y/monster/end.png'
        },{
            'text' : '智力',
            'active' : '/y/monster/int_a.png',
            'disactive' : '/y/monster/int.png'
        },{
            'text' : '智慧',
            'active' : '/y/monster/wis_a.png',
            'disactive' : '/y/monster/wis.png'
        },{
            'text' : '火焰',
            'active' : '/y/monster/fire_a.png',
            'disactive' : '/y/monster/fire.png'
        },{
            'text' : '寒冰',
            'active' : '/y/monster/cold_a.png',
            'disactive' : '/y/monster/cold.png'
        },{
            'text' : '雷电',
            'active' : '/y/monster/elec_a.png',
            'disactive' : '/y/monster/elec.png'
        },{
            'text' : '狂风',
            'active' : '/y/monster/wind_a.png',
            'disactive' : '/y/monster/wind.png'
        },{
            'text' : '神圣',
            'active' : '/y/monster/holy_a.png',
            'disactive' : '/y/monster/holy.png'
        },{
            'text' : '黑暗',
            'active' : '/y/monster/dark_a.png',
            'disactive' : '/y/monster/dark.png'
        },{
            'text' : '怪物状态',
            'active' : '/y/monster/ml_monstats.png',
            'disactive' : '/y/monster/ml_monstats_a.png'
        },{
            'text' : '编辑怪物技能',
            'active' : '/y/monster/ml_skilledit.png',
            'disactive' : '/y/monster/ml_skilledit_a.png'
        },{
            'text' : '节肢动物',
            'active' : '/y/monster/arthropod_a.png',
            'disactive' : '/y/monster/arthropod.png'
        },{
            'text' : '飞禽',
            'active' : '/y/monster/avion_a.png',
            'disactive' : '/y/monster/avion.png'
        },{
            'text' : '野兽',
            'active' : '/y/monster/beast_a.png',
            'disactive' : '/y/monster/beast.png'
        },{
            'text' : '天人',
            'active' : '/y/monster/celestial_a.png',
            'disactive' : '/y/monster/celestial.png'
        },{
            'text' : '魔灵',
            'active' : '/y/monster/daimon_a.png',
            'disactive' : '/y/monster/daimon.png'
        },{
            'text' : '龙类',
            'active' : '/y/monster/dragonkin_a.png',
            'disactive' : '/y/monster/dragonkin.png'
        },{
            'text' : '元素',
            'active' : '/y/monster/elemental_a.png',
            'disactive' : '/y/monster/elemental.png'
        },{
            'text' : '巨人',
            'active' : '/y/monster/giant_a.png',
            'disactive' : '/y/monster/giant.png'
        },{
            'text' : '类人',
            'active' : '/y/monster/humanoid_a.png',
            'disactive' : '/y/monster/humanoid.png'
        },{
            'text' : '机器人',
            'active' : '/y/monster/mechanoid_a.png',
            'disactive' : '/y/monster/mechanoid.png'
        },{
            'text' : '爬行动物',
            'active' : '/y/monster/reptilian_a.png',
            'disactive' : '/y/monster/reptilian.png'
        },{
            'text' : '妖精',
            'active' : '/y/monster/sprite_a.png',
            'disactive' : '/y/monster/sprite.png'
        },{
            'text' : '不死族',
            'active' : '/y/monster/undead_a.png',
            'disactive' : '/y/monster/undead.png'
        },{
            'text' : '敲击',
            'active' : '/y/monster/crsh_a.png',
            'disactive' : '/y/monster/crsh.png'
        },{
            'text' : '刺击',
            'active' : '/y/monster/prcg_a.png',
            'disactive' : '/y/monster/prcg.png'
        },{
            'text' : '斩击',
            'active' : '/y/monster/slsh_a.png',
            'disactive' : '/y/monster/slsh.png'
        },{
            'text' : '等级 1~100',
            'active' : '/y/arena/pg1_a.png',
            'disactive' : '/y/arena/pg1.png'
        },{
            'text' : '等级 101~300',
            'active' : '/y/arena/pg2_a.png',
            'disactive' : '/y/arena/pg2.png'
        },{
            'text' : '开始挑战',
            'active' : '/y/arena/startchallenge.png',
            'disactive' : '/y/arena/startchallenge_d.png'
        },{
            'text' : '进入道具界',
            'active' : '/y/shops/enteritemworld.png',
            'disactive' : '/y/shops/enteritemworld_d.png'
        },{
            'text' : '进入压榨界',
            'active' : '/y/grindfest/startgrindfest.png',
        },{
            'text' : '取消训练',
            'active' : '/y/training/canceltrain.png',
        },{
            'text' : '提交',
            'active' : '/y/character/apply.png',
        },{
            'text' : '全部重置',
            'active' : '/y/ab/resetall.png',
        },{
            'text' : '转移装备',
            'active' : '/y/equip/eqinv_transfer.png',
        },{
            'text' : '取消穿戴',
            'active' : '/y/equip/unequip.png',
        },{
            'text' : '返回',
            'active' : '/y/equip/back.png',
        },{
            'text' : '写一封新邮件',
            'active' : '/y/mmail/writenew.png',
        },{
            'text' : '丢弃',
            'active' : '/y/mmail/discard.png',
        },{
            'text' : '回复',
            'active' : '/y/mmail/reply.png',
        },{
            'text' : '保存',
            'active' : '/y/mmail/save.png',
        },{
            'text' : '发送',
            'active' : '/y/mmail/send.png',
        },{
            'text' : '拒收邮件',
            'active' : '/y/mmail/returnmail.png',
        },{
            'text' : '召回邮件',
            'active' : '/y/mmail/recallmail.png',
        },{
            'text' : '附带',
            'active' : '/y/mmail/attach_attach.png',
        },{
            'text' : '附带绅士币',
            'active' : '/y/mmail/attach_credits.png',
        },{
            'text' : '附带装备',
            'active' : '/y/mmail/attach_equip.png',
        },{
            'text' : '附带Hath',
            'active' : '/y/mmail/attach_hath.png',
        },{
            'text' : '附带物品',
            'active' : '/y/mmail/attach_item.png',
        },{
            'text' : '移除所有附件',
            'active' : '/y/mmail/attach_removeall.png',
        },{
            'text' : '移除',
            'active' : '/y/mmail/attach_remove.png',
        },{
            'text' : '设置货到付款(CoD)',
            'active' : '/y/mmail/setcod.png',
        },{
            'text' : '确认领取附件',
            'active' : '/y/mmail/attach_takeall.png',
        },{
            'text' : '删除',
            'active' : '/y/monster/delete.png',
        },{
            'text' : '下一个>>',
            'active' : '/y/monster/next.png',
        },{
            'text' : '<<上一个',
            'active' : '/y/monster/prev.png',
        },{
            'text' : '重命名',
            'active' : '/y/monster/rename.png',
        },{
            'text' : '保存技能',
            'active' : '/y/monster/saveskills.png',
        },{
            'text' : '使用精神恢复剂',
            'active' : '/y/userestorative.png',
        },{
            'text' : '返回选择装备',
            'active' : '/y/shops/equipselect.png',
        },{
            'text' : '提交自动采购任务',
            'active' : '/y/shops/addbottask.png',
        },{
            'text' : '全部出售',
            'active' : '/y/shops/sellall.png',
        }
    ];

    // Canvas和样式准备
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    translateStyle = document.createElement('style'); // 使用前面声明的全局变量
    imgTranslateWords = []; // 重置已翻译的图片元素数组

    // Canvas结果缓存，减少重复绘制
    const canvasCache = new Map();
    const CANVAS_CACHE_LIMIT = 100; // 缓存上限

    // 注释翻译法：为图片添加title属性
    function translateImagesByTitle() {
        if (document.getElementById('pane_log')) return; // 不翻译战斗界面

        // 怪物状态图片（背景图）
        Object.entries({
            '.msl>div:nth-child(5)>div' : '饥饿',
            '.msl>div:nth-child(6)>div' : '情绪',
        }).forEach(([selector, text]) => {
            Array.from(document.querySelectorAll(selector)).forEach(item => {
                if (!translatedList.has(item)) {
                    translatedList.set(item, { title: item.title || '' });
                }
                item.title = text;
            });
        });

        // 将额外的图片添加到字典
        const extraImages = [
            { 'text': '回答', 'active': '/y/battle/answer.png' },
            { 'text': '名称参考', 'active': '/y/battle/ponychartbutton.png' },
            { 'text': '角色', 'disactive': '/y/m/Character.png' },
            { 'text': '商店', 'disactive': '/y/m/Bazaar.png' },
            { 'text': '战斗', 'disactive': '/y/m/Battle.png' },
            { 'text': '强化', 'disactive': '/y/m/Forge.png' },
            { 'text': '百科', 'disactive': '/y/m/Wiki.png' },
            { 'text': '精力充沛，你将获得+100%经验奖励', 'disactive': '/y/s/sticon4.gif' },
            { 'text': '精力正常，你既不会收到额外的奖励也不会受到惩罚', 'disactive': '/y/s/sticon3.gif' },
            { 'text': '精力耗竭，你将无法从怪物那里收到任何经验或者掉落，也无法获得熟练度奖励', 'disactive': '/y/s/sticon1.gif' },
            { 'text': '你必须至少购买一张彩票才能选择放弃头奖争夺', 'disactive': '/y/shops/lottery_donotwant_d.png' },
            { 'text': '你已经放弃参与本次彩票的头奖争夺', 'disactive': '/y/shops/lottery_donotwant_s.png' }
        ];

        const fullImgWords = [...imgWords, ...extraImages];

        Array.from(document.querySelectorAll('img')).forEach(img => {
            var src = img.getAttribute('src');
            const item = fullImgWords.find(i => src.includes(i.active) || src.includes(i.disactive));
            if (item) {
                if (!translatedList.has(img)) {
                    translatedList.set(img, { title: img.title || '' });
                }
                img.title = item.text;
            }
        });
    }

    // 图片翻译法：使用Canvas将文字转换为图片
    function translateImagesByImg() {
        // 文字转图片（带缓存）
        function word2img(word, stroke) {
            // 生成缓存键
            const cacheKey = stroke
                ? `${word}_${stroke.strokeStyle}_${stroke.fillStyle}`
                : `${word}_default`;

            // 检查缓存
            if (canvasCache.has(cacheKey)) {
                return canvasCache.get(cacheKey);
            }

            // 绘制新图片
            var height = 14;
            canvas.height = height + 2;
            canvas.width = word.length * height + 5;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = 'bold ' + height + 'px 微软雅黑';

            if (stroke) {
                ctx.strokeStyle = stroke.strokeStyle;
                ctx.strokeText(word, 0, height);
                ctx.fillStyle = stroke.fillStyle;
                ctx.fillText(word, 2, height);
            } else {
                ctx.fillStyle = '#202020';
                ctx.fillText(word, 2, height);
            }

            const dataURL = canvas.toDataURL();

            // 存入缓存（限制大小）
            if (canvasCache.size >= CANVAS_CACHE_LIMIT) {
                const firstKey = canvasCache.keys().next().value;
                canvasCache.delete(firstKey);
            }
            canvasCache.set(cacheKey, dataURL);

            return dataURL;
        }

        function activeWord2img(value) {
            return word2img(value, { strokeStyle: '#EFD34F', fillStyle: '#5C0D11' });
        }

        if (document.getElementById('pane_log')) {
            // 战斗页面翻译
            if (!window.translateBattle) return;
            translateStyle.innerHTML = sessionStorage.battleImgTranslate || (
                sessionStorage.battleImgTranslate = [
                    { 'text': '技巧', 'active': 'sbsel_skills_s.png', 'disactive': 'sbsel_skills_n.png' },
                    { 'text': '法术', 'active': 'sbsel_spells_s.png', 'disactive': 'sbsel_spells_n.png' },
                    { 'text': '先天技巧', 'disactive': 'skills_innate.png' },
                    { 'text': '武器技巧', 'disactive': 'skills_weapon.png' },
                    { 'text': '治疗法术', 'disactive': 'magic_curative.png' },
                    { 'text': '攻击法术', 'disactive': 'magic_damage.png' },
                    { 'text': '乏抑法术', 'disactive': 'magic_debuff.png' },
                    { 'text': '辅助法术', 'disactive': 'magic_support.png' },
                    { 'text': '继续下一轮竞技场挑战', 'active': 'arenacontinue.png' },
                    { 'text': '继续下一层压榨界挑战', 'active': 'grindfestcontinue.png' },
                    { 'text': '深入下一层道具界挑战', 'active': 'itemworldcontinue.png' },
                    { 'text': '结束战斗', 'active': 'finishbattle.png' },
                    { 'text': '回答', 'active': '/y/battle/answer.png' },
                    { 'text': '名称参考', 'active': '/y/battle/ponychartbutton.png' }
                ].map(item => {
                    var txt = '';
                    if (item.disactive) txt += `img[src*="${item.disactive}"]{content:url(${word2img(item.text)})}`;
                    if (item.active) txt += `img[src*="${item.active}"]{content:url(${activeWord2img(item.text)})}`;
                    return txt;
                }).join('\n') + Object.entries({
                    'attack': '攻击', 'skill': '技能书', 'items': '道具',
                    'spirit': '灵动架式', 'defend': '防御', 'focus': '专注'
                }).map(([key, value]) => {
                    var ret = '';
                    ret += `img[src*="${key}_n.png"]{content:url(${activeWord2img(value)})}`;
                    ret += `img[src*="${key}_s.png"]{content:url(${word2img(value, { strokeStyle: '#F8DA34', fillStyle: '#0030CB' })})}`;
                    ret += `img[src*="${key}_a.png"]{content:url(${word2img(value, { strokeStyle: '#EE3632', fillStyle: '#000000' })})}`;
                    return ret;
                }).join('\n')
            );
        } else if (document.getElementById('riddlemaster')) {
            // 小马图引导
            translateStyle.innerHTML = sessionStorage.riddleImgTranslate || (
                sessionStorage.riddleImgTranslate = Object.entries({
                    'answer.png': '回答',
                    'ponychartbutton.png': '名称参考'
                }).map(([key, value]) => {
                    return `img[src*="${key}"]{content:url(${activeWord2img(value)})}`;
                }).join('\n')
            );
        } else {
            // 普通页面翻译
            translateStyle.innerHTML = sessionStorage.translateStyle || (
                sessionStorage.translateStyle = [
                    '#eqsl>div {height: 20px; width: 71px;}',
                    ...imgWords.map(item => {
                        var txt = '';
                        if (item.disactive) txt += `img[src*="${item.disactive}"]{content:url(${word2img(item.text)})}\n`;
                        if (item.active) txt += `img[src*="${item.active}"]{content:url(${activeWord2img(item.text)})}\n`;
                        return txt;
                    }),
                    ...Object.entries({
                        '/y/m/Character.png': '角色',
                        '/y/m/Bazaar.png': '商店',
                        '/y/m/Battle.png': '战斗',
                        '/y/m/Forge.png': '强化',
                        '/y/m/Wiki.png': '百科'
                    }).map(([img, txt]) => {
                        canvas.height = 21;
                        canvas.width = 120;
                        ctx.font = 'bold 19px 微软雅黑';
                        ctx.fillStyle = '#000';
                        ctx.fillText(txt, 40, 16);
                        return `img[src*="${img}"]{content:url(${canvas.toDataURL()})}\n`;
                    }),
                    ...Object.entries({
                        '.msl>div:nth-child(5)>div': '饥饿',
                        '.msl>div:nth-child(6)>div': '情绪'
                    }).map(([selector, txt]) => {
                        canvas.height = 22;
                        canvas.width = 200;
                        ctx.font = '12px bold';
                        ctx.strokeStyle = '#000';
                        ctx.strokeRect(63, 6, 122, 10);
                        ctx.fillStyle = '#000';
                        ctx.fillText(txt, 30, 15);
                        return `${selector}{background:url(${canvas.toDataURL()})}\n`;
                    }),
                    ...Object.entries({
                        '/y/shops/lottery_donotwant_s.png': '放弃头奖'
                    }).map(([key, value]) => {
                        return `img[src*="${key}"]{content:url(${word2img(value, { fillStyle: '#ff0000', strokeStyle: '#00000000' })})}`;
                    })
                ].join('\n')
            );
        }
    }

    // 文字翻译法：使用文字替换图片
    function translateImagesByText() {
        if (document.getElementById('pane_log')) return; // 不翻译战斗界面

        // 文字样式
        translateStyle.innerHTML = sessionStorage.translateTextStyle || (
            sessionStorage.translateTextStyle = [
                '#eqsl>div {height: 20px; width: 71px;}',
                '.image2block {display: inline;font: bold 15px 微软雅黑; padding: 1px 5px; color:#202020}',
                '.image2block.active {text-shadow: 2px 2px 2px #EFD34F; color:#5C0D11}',
                '.image2block.title {font-size: 18px; padding: 0px 30px;}',
                '.image2block.no-padding {padding: 0px}',
                '.image2block.red {color:#ff0000}',
                ...Object.entries({
                    '.msl>div:nth-child(5)>div': '饥饿',
                    '.msl>div:nth-child(6)>div': '情绪'
                }).map(([selector, txt]) => {
                    canvas.height = 22;
                    canvas.width = 200;
                    ctx.font = '12px bold';
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(63, 6, 122, 10);
                    ctx.fillStyle = '#000';
                    ctx.fillText(txt, 30, 15);
                    return `${selector}{background:url(${canvas.toDataURL()})}`;
                })
            ].join('\n')
        );

        function getClassName(src, item) {
            return 'image2block ' + (src.includes(item.active) ? 'active ' : '') + (item.style || '');
        }

        function replaceImg2Word(img) {
            var src = img.getAttribute('src');
            var item = imgWords.find(i => src.includes(i.active) || src.includes(i.disactive));
            if (!item) return;

            var div = document.createElement('div');
            div.textContent = item.text;
            if (img.onclick) div.setAttribute('onclick', img.getAttribute('onclick'));
            if (img.onmouseover) div.setAttribute('onmouseover', img.getAttribute('onmouseover'));
            div.className = getClassName(src, item);
            if (img.id) {
                div.id = img.id;
                Object.defineProperty(div, 'src', {
                    set: function(value) {
                        img.setAttribute('src', value);
                        this.className = getClassName(value, item);
                    }
                });
                if (item.text == '确定' && location.href.includes('s=Bazaar&ss=es')) {
                    Object.defineProperty(img, 'src', {
                        set: function(value) {
                            img.setAttribute('src', value);
                            div.src = value;
                            div.className = getClassName(value, item);
                            if (value == item.active) {
                                div.setAttribute('onclick', 'equipshop.commit_transaction()');
                            } else {
                                div.removeAttribute("onclick");
                            }
                        }
                    });
                }
            }
            img.replaceWith(div);
            imgTranslateWords.push({ div, img });
            return div;
        }

        // 添加特殊样式的图片
        imgWords.unshift(
            { 'text': '开始挑战', 'active': '/y/arena/startchallenge.png', 'disactive': '/y/arena/startchallenge_d.png', 'style': 'no-padding' },
            { 'text': '回答', 'active': '/y/battle/answer.png' },
            { 'text': '名称参考', 'active': '/y/battle/ponychartbutton.png' },
            { 'text': '角色', 'disactive': '/y/m/Character.png', 'style': 'title' },
            { 'text': '商店', 'disactive': '/y/m/Bazaar.png', 'style': 'title' },
            { 'text': '战斗', 'disactive': '/y/m/Battle.png', 'style': 'title' },
            { 'text': '强化', 'disactive': '/y/m/Forge.png', 'style': 'title' },
            { 'text': '百科', 'disactive': '/y/m/Wiki.png', 'style': 'title' },
            { 'text': '放弃头奖', 'disactive': '/y/shops/lottery_donotwant_s.png', 'style': 'red' }
        );

        Array.from(document.querySelectorAll('img')).forEach(replaceImg2Word);
    }

    // 初始化图片翻译
    function initImageTranslate() {
        // 优先级：title翻译法 > 图片翻译法（Chrome默认） > 文字翻译法（其他浏览器默认）
        if (localStorage.translateWithTitle) {
            translateImagesByTitle();
        } else if (localStorage.translateWithImg || (window.navigator.userAgent.includes("Chrome") && !localStorage.translateWithText)) {
            translateImagesByImg();
            if (translateStyle.innerHTML) {
                document.head.appendChild(translateStyle);
            }
        } else {
            translateImagesByText();
            if (translateStyle.innerHTML) {
                document.head.appendChild(translateStyle);
            }
        }
    }

    function start() {
        if (!document.getElementById('textlog')) {
            translateAllText();
            initImageTranslate(); // 初始化图片翻译
            initRestoreButton();
        }
        else {
            // 战斗页面，根据配置变量决定是否翻译
            if (HIDE_BATTLE_LOG) {
                // 隐藏战斗日志：直接隐藏日志元素
                const hideLogStyle = document.createElement('style');
                hideLogStyle.id = 'hide-battle-log-style';
                hideLogStyle.textContent = '#textlog { display: none !important; } #pane_log { display: none !important; }';
                document.head.appendChild(hideLogStyle);
            }

            if (window.translateBattle) {
                translateAllText();
                initImageTranslate(); // 初始化图片翻译
                initRestoreButton();
                changer.style.top = '3px';
                changer.style.left = '70px';
            }
            else {
                translated = false;
            }
        }
    }

    if (document.getElementById('expholder') && !!document.getElementById('expholder').title) return;
    start();
    if (document.getElementById('textlog')) {
        document.addEventListener('HVReload', start);
        document.addEventListener('DOMContentLoaded', start);
    }

    // ============================================================
    // 装备仓库/商店/武器库页面：重新翻译按钮和自动翻译
    // 支持持久世界 (Persistent) 和异世界 (Isekai) 的装备系统
    // ============================================================

    var currentUrl = window.location.href;

    // 检查是否是装备相关页面
    var isEquipInventoryPage = currentUrl.includes('?s=Character&ss=in');  // 持久世界装备仓库
    var isEquipShopPage = currentUrl.includes('?s=Bazaar&ss=es');          // 持久世界装备商店
    var isArmoryPage = currentUrl.includes('?s=Bazaar&ss=am');             // 异世界武器库 (The Armory)
    var isEquipSelectPage = currentUrl.includes('?s=Character&ss=eq') && document.querySelector('#equipselect_outer'); // 异世界装备切换页面（需要检测容器）
    var isEquipPage = isEquipInventoryPage || isEquipShopPage || isArmoryPage || isEquipSelectPage;

    if (isEquipPage) {

        // 创建重新翻译按钮（使用旧版本样式：左下角，button元素）
        var retranslateButton = document.createElement('button');
        retranslateButton.innerHTML = '重新翻译';
        retranslateButton.title = '点击重新翻译装备';
        retranslateButton.id = 'retranslate-equip';
        retranslateButton.style.cssText = 'position: fixed; top: 725px; left: 0px;';

        // 按钮点击事件
        retranslateButton.onclick = function () {
            const startTime = performance.now();

            // 确定装备容器（支持持久世界和异世界）
            const equipContainer = document.querySelector('#eqinv_outer, #eqshop_outer, #armory_outer, #equipselect_outer');
            if (!equipContainer) {
                return;
            }

            // 获取预编译的装备名称、装备信息、角色和装备库说明字典（包含按钮翻译）
            // 注意：upgrades 必须在 equipsName 之前，避免装备名称先被翻译导致完整句子无法匹配
            const dict = getCompiledDict(['upgrades', 'equipsName', 'equipsInfo', 'character']);

            // 增量翻译：只翻译装备容器区域
            translateText(equipContainer, dict, false);
            translateButtons(equipContainer, dict, false);
            translateElemTitle(equipContainer, dict, false);

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`[HV汉化] 装备翻译完成，耗时: ${duration}ms`);

            // 显示翻译完成提示（简短闪烁）
            const originalText = retranslateButton.innerHTML;
            retranslateButton.innerHTML = '✓';
            setTimeout(function() {
                retranslateButton.innerHTML = originalText;
            }, 800);
        };

        // 等待 DOM 完全加载后再添加按钮
        if (document.body) {
            document.body.appendChild(retranslateButton);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(retranslateButton);
            });
        }

        // 立即翻译固定按钮（不需要等待）
        const equipContainer = document.querySelector('#eqinv_outer, #eqshop_outer, #armory_outer, #equipselect_outer');
        if (equipContainer) {
            const dict = getCompiledDict(['character']);
            translateButtons(equipContainer, dict, false);
        }

        // 延迟翻译装备列表和详情（等待动态内容加载）
        setTimeout(function() {
            retranslateButton.click();

            // 为装备详情区域添加实时翻译监听器
            setupEquipInfoObserver();
        }, 500); // 缩短延迟到 500ms

        // 设置装备详情实时翻译监听器
        function setupEquipInfoObserver() {
            // 查找装备详情容器（支持不同页面结构）
            const equipInfoContainer = document.querySelector('#equipinfo, #item_details');

            if (!equipInfoContainer) {
                // 静默失败：主世界装备切换页面没有这个容器，这是正常的
                return;
            }

            // 获取预编译字典

            const dict = getCompiledDict(['upgrades', 'equipsName', 'equipsInfo', 'character']);

            // 创建 MutationObserver 监听装备详情变化
            const observer = new MutationObserver(function(mutations) {
                // 检查是否有实质性内容变化
                let hasContentChange = false;
                for (let mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        hasContentChange = true;
                        break;
                    }
                    if (mutation.type === 'characterData') {
                        hasContentChange = true;
                        break;
                    }
                }

                if (hasContentChange && translated) {

                    const startTime = performance.now();

                    // 翻译装备详情容器（包括动态加载的 #equipblurb 和装备属性）
                    translateText(equipInfoContainer, dict, false);
                    translateButtons(equipInfoContainer, dict, false);
                    translateElemTitle(equipInfoContainer, dict, false);

                    const duration = (performance.now() - startTime).toFixed(2);

                }
            });

            // 开始观察
            observer.observe(equipInfoContainer, {
                childList: true,       // 监听子节点变化
                subtree: true,         // 监听所有后代节点
                characterData: true,   // 监听文本内容变化
                characterDataOldValue: false
            });
        }

        // 【新增】为 #popup_box 添加全局监听（按 C 键弹出的装备详情窗口）
        // 由于 #popup_box 是动态创建的，我们需要监听整个 document
        function setupPopupBoxObserver() {
            const dict = getCompiledDict(['equipsName', 'equipsInfo']);
            let popupBoxObserver = null;

            // 监听整个 document 的变化，检测 #popup_box 的出现
            const documentObserver = new MutationObserver(function(mutations) {
                for (let mutation of mutations) {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // 元素节点
                            // 检查是否是 #popup_box 或包含 #popup_box
                            const popupBox = node.id === 'popup_box' ? node : node.querySelector('#popup_box');

                            if (popupBox && !popupBoxObserver) {
                                // 立即翻译一次
                                translateText(popupBox, dict, false);
                                translateButtons(popupBox, dict, false);
                                translateElemTitle(popupBox, dict, false);

                                // 为 popup_box 创建专门的监听器
                                popupBoxObserver = new MutationObserver(function(popupMutations) {
                                    let hasContentChange = false;
                                    for (let mut of popupMutations) {
                                        if (mut.type === 'childList' && mut.addedNodes.length > 0) {
                                            hasContentChange = true;
                                            break;
                                        }
                                        if (mut.type === 'characterData') {
                                            hasContentChange = true;
                                            break;
                                        }
                                    }

                                    if (hasContentChange) {
                                        translateText(popupBox, dict, false);
                                        translateButtons(popupBox, dict, false);
                                        translateElemTitle(popupBox, dict, false);
                                    }
                                });

                                popupBoxObserver.observe(popupBox, {
                                    childList: true,
                                    subtree: true,
                                    characterData: true,
                                    characterDataOldValue: false
                                });
                            }
                        }
                    }

                    // 检查是否移除了 #popup_box
                    for (let node of mutation.removedNodes) {
                        if (node.nodeType === 1 && (node.id === 'popup_box' || node.querySelector('#popup_box'))) {
                            if (popupBoxObserver) {
                                popupBoxObserver.disconnect();
                                popupBoxObserver = null;
                            }
                        }
                    }
                }
            });

            // 开始监听整个 document
            documentObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // 启动 popup_box 监听
        setupPopupBoxObserver();
    }

})();


    ////////////////////////////////////////////////////////////////////////////////
    // 战斗日志汉化模块
    ////////////////////////////////////////////////////////////////////////////////

    (function initBattleLogTranslate() {
        // 检查开关和页面条件
        // 隐藏日志时自动跳过翻译逻辑
        if (HIDE_BATTLE_LOG) return;
        if (!BATTLE_LOG_TRANSLATE_ENABLED) return;
        if (!document.querySelector('#battle_main')) return;
        if (!document.getElementById('pane_log')) return;

        // 添加CSS隐藏原战斗日志
        const style = document.createElement('style');
        style.textContent = '#textlog { display: none }';
        document.head.appendChild(style);

        // 战斗日志专用词典
        const battleLogWords = {
            //可在此自行增加翻译，注意格式

            // 恢复
            'Refreshment' : '灵力长效药',
            'Regeneration' : '生命长效药',
            'Replenishment' : '魔力长效药',
            'Kicking Ass': '海扁',
            'Sleeper Imprint' : '沉睡烙印',

            // BUFF 效果
            'Regen' : '细胞活化',
            'Protection' : '守护',
            'Spirit Shield' : '灵力盾',
            'Hastened' : '急速',
            'Shadow Veil' : '影纱',
            'Absorbing Ward' : '吸收结界',
            'Spark of Life' : '生命火花',
            'Cloak of the Fallen' : '陨落斗篷',
            'Heartseeker' : '觅心者',
            'Arcane Focus' : '奥术集中',
            'Channeling' : '引导',
            'Fleeing' : '逃跑',
            'Blessing of the RiddleMaster' : '御谜士的祝福',
            'Defending' : '防御',
            'Focusing' : '专注',
            'Energized' : '充满活力',
            'Infused Flames' : '火焰注入',
            'Infused Frost' : '冰霜缠绕',
            'Infused Lightning' : '雷电缠身',
            'Infused Storm' : '暴风环绕',
            'Infused Divinity' : '神圣附体',
            'Infused Darkness' : '黑暗笼罩',

            // 怪物 DEBUFF 效果
            'Vital Theft' : '生命汲取',
            'Ether Theft' : '魔力汲取',
            'Spirit Theft' : '灵力汲取',
            'Confused' : '混乱',
            'Absorbing Ward' : '吸收结界',
            'Slowed' : '缓慢',
            'Weakened' : '虚弱',
            'Imperiled' : '陷危',
            'Blinded' : '盲目',
            'Asleep' : '沉眠',
            'Silenced' : '沉默',
            'Magically Snared' : '魔磁网',

            //战斗风格
            'Overwhelming Strikes': '压制打击',
            'Coalesced Mana': '魔力合流',
            'Ether Tap' : '魔力回流',

            // 物品
            'drops a Health Gem powerup!' : '掉落了一颗生命宝石',
            'drops a Mana Gem powerup!' : '掉落了一颗魔力宝石',
            'drops a Spirit Gem powerup!' : '掉落了一颗灵力宝石',
            'drops a Mystic Gem powerup!' : '掉落了一颗神秘宝石',
            'Health Gem' : '生命宝石',
            'Mana Gem' : '魔力宝石',
            'Spirit Gem' : '灵力宝石',
            'Mystic Gem' : '神秘宝石',
            'Soul Fragments':'灵魂碎片',

            //攻击咒语效果
            'Searing Skin' : '焦灼皮肤',
            'Freezing Limbs' : '冰封肢体',
            'explodes' : '爆裂',
            'Turbulent Air' : '空气湍流',
            'Deep Burns' : '深层烧伤',
            'Breached Defense' : '防御崩溃',
            'Blunted Attack' : '攻击钝化',

            // 技能
            'Flee' : '逃跑',
            'Scan' : '扫描',
            'FUS RO DAH' : '龙吼',
            'Orbital Friendship Cannon' : '<font color="#FF0000">友</font><font color="#CC0033">谊</font><font color="#990066">小</font><font color="#660099">马</font><font color="#3300CC">炮</font>',
            'Concussive Strike' : '震荡打击',
            'Skyward Sword' : '天空之剑',
            'Frenzied Blows' : '狂乱百裂斩',
            'Iris Strike' : '虹膜打击',
            'Backstab' : '背刺',
            'Shatter Strike' : '粉碎打击',
            'Rending Blow' : '撕裂打击',
            'Great Cleave' : '大劈砍',
            'Merciful Blow' : '最后的慈悲',
            'Shield Bash' : '盾击',
            'Vital Strike' : '致命打击',
            'Arcane Blow' : '奥术冲击',

            'Fiery Blast' : '炎爆术(Ⅰ)',
            'Inferno' : '地狱火(Ⅱ)',
            'Flames of Loki' : '邪神之火(Ⅲ)',
            'Freeze' : '冰冻(Ⅰ)',
            'Blizzard' : '暴风雪(Ⅱ)',
            'Fimbulvetr' : '芬布尔之冬(Ⅲ)',
            'Shockblast' : '电能爆破(Ⅰ)',
            'Chained Lightning' : '连锁闪电(Ⅱ)',
            'Wrath of Thor' : '雷神之怒(Ⅲ)',
            'Gale' : '烈风(Ⅰ)',
            'Downburst' : '下击暴流(Ⅱ)',
            'Storms of Njord' : '尼奥尔德风暴(Ⅲ)',
            'Smite' : '惩戒(Ⅰ)',
            'Banishment' : '放逐(Ⅱ)',
            'Paradise Lost' : '失乐园(Ⅲ)',
            'Corruption' : '腐化(Ⅰ)',
            'Disintegrate' : '瓦解(Ⅱ)',
            'Ragnarok' : '诸神黄昏(Ⅲ)',

            'Drain' : '枯竭',
            'Slow' : '缓慢',
            'Weaken' : '虚弱',
            'Silence' : '沉默',
            'Sleep' : '沉眠',
            'Confuse' : '混乱',
            'Imperil' : '陷危',
            'Blind' : '致盲',
            'MagNet' : '魔磁网',

            'Regen' : '细胞活化',
            'Full-Cure' : '完全治疗术',
            'Cure' : '治疗术',
            'Haste' : '急速',
            'Protection' : '守护',
            'Shadow Veil' : '影纱',
            'Absorb' : '吸收',
            'Spark of Life' : '生命火花',
            'Arcane Focus' : '奥术集中',
            'Heartseeker' : '觅心者',
            '[sS]pirit [sS]hield' : '灵力盾',

            //武器效果
            'Penetrated Armor' : '破甲',
            'Stunned' : '眩晕',
            'Bleeding Wound' : '流血',
            'Void Strike':'虚空打击',
            'Fire Strike':'火焰打击',
            'Cold Strike':'冰霜打击',
            'Elec Strike':'闪电打击',
            'Wind Strike':'狂风打击',
            'Holy Strike':'神圣打击',
            'Dark Strike':'黑暗打击',
            'spike shield': '刺盾',

            // 动作
            'Magic Points' : '点<span style=\"color:#639AD4\" > 魔力 </span>',
            'evades your attack': '<span style=\"color:#1E90FF\" >闪避了你的攻击</span>',
            'evades your spell': '<span style=\"color:#1E90FF\" >闪避了你的法术</span>',
            'Your offhand': '<span style=\"color:#1E90FF\" >你的副手攻击</span>',
            'casts?': '<span style=\"background:#7CFC00\" >咏唱了</span>',
            'uses': '<span style=\"background:#ADFF2F\" >使用了</span>',
            'and hits': '<span style=\"color:#FF00FF\" >并击中了</span>',
            'hits': '<span style=\"color:#FF00FF\" >击中了</span>',
            'and crits': '<span style=\"background:#FF0000;color:#FFFFFF\" >并暴击</span>了',
            '([0-9]+)x-crit': '<span style="background:#FF0000;color:#FFFFFF">$1重暴击</span>了',
            'crits': '<span style=\"background:#FF0000;color:#FFFFFF\" >暴击</span>了',
            'and blasts': '<span style=\"background:#FF0000;color:#FFFFFF\" >并暴击</span>了',
            'blasts': '<span style=\"background:#FF0000;color:#FFFFFF\" >暴击</span>了',
            'restores' : '<span style=\"color:#006400\" >恢复了你</span>',
            'Recovered' : '<span style=\"color:#006400\" >恢复了你</span>',
            'You use': '<span style=\"background:#ADFF2F\" >你使用了</span>',
            'You gain the effect (.*)': '<span style=\"background:#ADFF2F\" >你获得了状态</span> $1',
            'You cast (.*)': '<span style=\"background:#7CFC00\" >你施放了</span> $1',
            'The effect (.+) was dispelled\.' : '效果 $1 已被替换',
            'gains? the effect': '<span style=\"background:#ADFF2F" >获得了状态</span>',
            'You crit': '<span style=\"color:#1E90FF\" >你</span><span style=\"background:#FF0000;color:#FFFFFF\" >暴击</span>了',

            'You hit': '<span style=\"color:#1E90FF\" >你</span><span style=\"color:#FF00FF\" >击中了</span>',
            'You are healed for (.*) Health Points': '你获得<span style=\"color:#006400\" > $1 点生命</span>的治疗',
            'You evade the attack from (.*)\.': '<span style=\"color:#696969\" >你闪避了 $1 的攻击.</span>',
            'You block the attack from (.*)\.': '<span style=\"color:#696969\" >你格挡了 $1 的攻击</span>',
            'You parry the attack from (.*)\.': '<span style=\"color:#696969\" >你招架了 $1 的攻击</span>',
            'You evade the attack': '<span style=\"color:#696969\" >你闪避了这次攻击</span>',
            'You block the attack': '<span style=\"color:#696969\" >你格挡了这次攻击</span>',
            'You parry the attack': '<span style=\"color:#696969\" >你招架了这次攻击</span>',
            'Your (.*) absorbs (.*) from the attack into': '你的 $1 吸收了 $2 并转化为 ',
            'The effect (.*) on (.*) has expired': '<span style=\"color:	#b06161\" >$2 身上的状态 $1 已失效</span>',
            'The effect (.*) has expired': '<span style=\"background:#FB6901\" >状态 $1 已失效</span>',
            'Cooldown expired for (.*)': '<span style=\"color:#000000\" >$1</span> <span style=\"background:#97ffb2\" >已结束冷却</span>',
            'counter (.*) for (.*)': '<span style=\"background:#FFFF00\" >反击</span> $1 <span style=\"color:#e21a1a\" >造成 $2</span>',
            'healing (.*) for (.*) points of health': '治疗 $1 <span style=\"color:#006400\" > $2 点生命</span>',
            'You drain (.*) points of health from (.*)' : '你从 $2 身上吸取<span style=\"color:#006400\" > $1 点生命</span>',
            'but is absorbed': '但被吸收了',
            'resisted\\)': '被抵抗)',
            'from the brink of defeat': '<span style=\"background:#2E6F15\;color:#FFFFFF" >从死亡的边缘复活了</span>',
            'You drain (.*) HP from (.*)': '你从 $2 身上吸取<span style=\"color:#006400\" > $1 点生命</span>',
            'You drain (.*) MP from (.*)': '你从 $2 身上吸取<span style=\"color:#639AD4\" > $1 点魔力</span>',
            'You drain (.*) SP from (.*)': '你从 $2 身上吸取<span style=\"color:#D4637A\" > $1 点灵力</span>',

            // 新版本日志翻译

            'You block and parry the attack from (.*)\.': '<span style=\"color:#696969\" >你格挡并招架了 $1 的攻击</span>',
            'You block and partially parry the attack from (.*)\.': '<span style=\"color:#696969\" >你格挡并部分招架了 $1 的攻击</span>',
            'You partially block and parry the attack from (.*)\.': '<span style=\"color:#696969\" >你部分格挡并招架了 $1 的攻击</span>',
            'You block and resist the attack': '<span style="color:#696969" >你格挡并且抵抗了这次攻击</span>',


            'partially block and partially parry the attack, and take': '<span style="color:#696969" >部分格挡并部分招架了这次攻击,受到</span>',
            'partially block and parry the attack, and take': '<span style="color:#696969" >部分格挡并招架了这次攻击,受到</span>',
            'partially block and resist the attack, and take': '<span style="color:#696969" >部分格挡并抵抗了这次攻击,受到</span>',
            'resist the attack, and take': '<span style="color:#696969" >抵抗了这次攻击,受到</span>',
            'partially block the attack, and take': '<span style="color:#696969" >部分格挡了这次攻击,受到</span>',
            'partially parry the attack, and take': '<span style="color:#696969" >部分招架了这次攻击,受到</span>',
            'which partially parries':'但被部分招架了',
            'dodges your attack':'闪避了你的攻击',

            'restores (.*) points of health': '<span style=\"color:#006400\" >恢复了</span> $1 点<span style=\"color:#006400\" >生命</span>',
            'restores (.*) points of spirit': '<span style=\"color:#006400\" >恢复了</span> $1 点<span style=\"color:#D4637A\" >灵力</span>',
            'restores (.*) points of magic': '<span style=\"color:#006400\" >恢复了</span> $1 点<span style=\"color:#639AD4\" >魔力</span>',


            'The effect (.*) on (.*) has worn off': '<span style=\"background:#FB6901\" >$2 身上的状态 $1 已失效</span>',
            'The effect (.*) has worn off': '<span style=\"background:#FB6901\" >状态 $1 已失效</span>',
            '(.*) was crit for (.*) (.*) damage': '$1 被<span style=\"background:#FF0000;color:#FFFFFF\" >暴击</span>，受到 $2 点 $3',
            '(.*) was hit for (.*) (.*) damage': '$1 被<span style=\"color:#FF00FF\" >击中</span>，受到 $2 点 $3',
            '(.*) in the general direction of a shadow, missing you completely': '$1 <span style=\"color:#808080\" >朝着阴影的方向攻击，完全没打中你</span>',
            '(.*) vigorously whiffs at a shadow, missing you completely': '$1 <span style=\"color:#808080\" >猛烈地挥向影子，完全没打中你</span>',

            'causing': '造成',
            'additional points of': '点 额外',
            'additional': '额外',
            'which glances!': '造成了擦伤!',
            'which hits!': '击中了！',
            'you;': '你;',
            'glances': '<span style="color:#FFA500" >擦伤</span>了',
            'glance': '<span style="color:#FFA500" >擦伤</span>了',




            'Your spell fails to connect': '<span style=\"color:#808080\" >你的法术未能命中</span>',
            'Your (.*) is damaged, and should be repaired soon\\.?': '你的 $1 受损，需要尽快修理',
            'Your spike shield hits (.*) for (.*) points of (.*) damage': '你的<span style=\"color:#FF00FF\" >刺盾</span>击中了 $1，造成 $2 点 $3',

            // 怪物动作
            'misses the attack against' : '攻击没有命中',
            'but misses the attack.' : '但这次攻击没有命中',
            'parries your attack': '<span style=\"background:	#00FFFF\" >招架了你的攻击</span>',
            'resists your spell' : '<span style=\"background:#81f7f3\" >抵抗了你的魔法</span>',
            'got knocked out of confuse' : '从混乱中脱离',

            //战斗系统文本
            'Spawned Monster': '生成怪物',
            'Initializing random encounter' : '正在初始化随机遭遇战',
            'Initializing arena challenge' : '正在初始化竞技场战斗',
            'Round (\\d+) / (\\d+)': '第 $1 / $2 轮',
            'Initializing Item World' : '正在初始化道具界战斗',
            'Initializing Grindfest' : '正在初始化压榨界战斗',
            'Initializing The Tower' : '正在初始化塔楼战斗',
            '(.*) has been defeated': '<span style=\"background:#b3b3b3\" >打败了 $1</span>',
            'With the light of a new dawn, [yY]our experience in all things increases' : '随着新的黎明的到来，你在所有事情上的经验都增加了',
            'have escaped from the battle': '从战斗中脱离了',
            'Time Bonus:' : '快速回答奖励:',
            'The Riddlemaster listens to your answer, tries to keep a pensive face, then breaks into a wide grin' : '谜语大师听了你的回答，努力保持沉思的表情，然后咧嘴大笑',
            'The Riddlemaster listens to your answer and winks at you' : '谜语大师听了你的回答，向你眨眼',
            'The Riddlemaster listens to your answer and cackles hysterically.' : '谜语大师听了你的回答，歇斯底里地笑了起来',
            'The Riddlemaster listens to your answer and grins mischievously.' : '谜语大师听了你的回答，顽皮地笑了起来',
            'The Riddlemaster listens to your answer and shows no reaction whatsoever.' : '谜语大师听了你的回答，没有任何反应',
            'The Riddlemaster listens to your answer and snorts ambiguously.' : '谜语大师听了你的回答，含糊地哼了一声',
            'Insufficient overcharge or spirit for Spirit Stance.' : '灵力或斗气值不足，无法开启灵动架势',
            'Insufficient overcharge to use' : '斗气值不足，无法使用',
            'have been defeated' : '被击败了',
            'Spirit Stance Engaged': '<span style=\"background:#e21a4e\" >灵动架势开启</span>',
            'Spirit Stance Exhausted': '<span style=\"background:#f5b3c4\" >灵动架势关闭</span>',
            'Spirit Stance Disabled': '<span style=\"background:#f5b3c4\" >灵动架势无法维持</span>',
            'You are Victorious!': '你胜利了',
            'You gain': '你获得了',
            'You obtained': '你获得了',
            'fails due to insufficient Spirit' : '由于灵力不足，没有生效',
            'Stop kicking the dead horse' : '别鞭尸啦',
            'You gain no EXP due to exhaustion' : '由于你已精疲力竭，因此无法获得经验',
            'Warning: Reached equipment inventory limit' : '警告，装备库存已满',
            'Invalid target' : '非法目标',
            'Item does not exist' : '道具不存在',
            'Inventory slot is empty' : '物品栏是空的',
            'You do not have a powerup gem' : '宝石不存在',
            'Cooldown is still pending for' : '所选技能仍在冷却中',

            //结算时各项经验的翻译文本
            'one-handed weapon proficiency' : '单手武器的熟练度',
            'two-handed weapon proficiency' : '双手武器的熟练度',
            'one-handed proficiency' : '单手熟练度',
            'two-handed proficiency' : '双手熟练度',
            'dual wielding proficiency' : '双持熟练度',
            'staff proficiency' : '法杖熟练度',
            'cloth armor proficiency' : '布甲熟练度',
            'light armor proficiency' : '轻甲熟练度',
            'heavy armor proficiency' : '重甲熟练度',
            'elemental magic proficiency' : '元素魔法熟练度',
            'divine magic proficiency' : '神圣魔法熟练度',
            'forbidden magic proficiency' : '黑暗魔法熟练度',
            'deprecating magic proficiency' : '减益魔法熟练度',
            'supportive magic proficiency' : '增益魔法熟练度',

            'A traveling salesmoogle gives':'自动出售后给予了',
            'for it':'',
            'A traveling salesmoogle salvages it into':'自动分解后给予了',
            'plus (.+) for the remains':'残骸出售后额外获得了 $1',
            'Arena Token Bonus!':'获得竞技场令牌奖励!',
            'Battle Clear Bonus!':'获得战斗胜利奖励!',
            'Arena Extra Bonus!':'获得竞技场额外奖励!',

            'Capacitor Level':'电容器(魔力+2%/级) 等级',
            'Juggernaut Level':'勇士(生命+2%/级) 等级',
            'Butcher Level':'屠夫(武器攻击伤害+2%/级) 等级',
            'Fatality Level':'致命(攻击暴击伤害+2%/级) 等级',
            'Overpower Level':'压制(反招架率+4%/级) 等级',
            'Swift Strike Level':'迅捷打击(攻速+1.92%/级) 等级',
            'Annihilator Level':'毁灭者(魔法暴击伤害+2%/级) 等级',
            'Archmage Level':'大法师(武器魔法伤害+2%/级) 等级',
            'Economizer Level':'节约者(魔力消耗减免+5%/级) 等级',
            'Penetrator Level':'穿透者(反抵抗率+4%/级) 等级',
            'Spellweaver Level':'织法者(施法速度+1.5%/级) 等级',
            'Hollowforged':'虚空升华',
            'Coldproof Level':'抗寒(冰冷抗性+4%/级) 等级',
            'Darkproof Level':'驱暗(黑暗抗性+4%/级) 等级',
            'Elecproof Level':'绝缘(闪电抗性+4%/级) 等级',
            'Fireproof Level':'耐热(火焰抗性+4%/级) 等级',
            'Holyproof Level':'驱圣(神圣抗性+4%/级) 等级',
            'Windproof Level':'防风(疾风抗性+4%/级) 等级',

            'Unlocked':'解锁',
            'innate':'内在',
            'potential:':'潜能:',
            'potential has increased by':'潜经验提升了',
            'points!':'点',

            'have reached Level' : '<span style=\"background:#00FF00\" >升级至</span>',
            'dropped':'掉落了',
            'The potential of [yY]our equipment has grown!':'你装备的潜能等级提升了!',
            'You received a':'你获得了一个',


            'for (\\d+)': '<span style=\"color:#e21a1a\" >造成 $1</span>',
            '[yY]our': '<span style=\"color:#1E90FF\" >你的</span>',
            '[yY]ou': '<span style=\"color:#1E90FF\" >你</span>',



            // 伤害
            'fire damage': '<span style=\"background:#f97c7c\" >火焰伤害</span>',
            'cold damage': '<span style=\"background:#94c2f5\" >冰冷伤害</span>',
            'void damage': '<span style=\"background:#ffffff\;color:#5c5a5a\" >虚空伤害</span>',
            'elec damage': '<span style=\"background:#f4f375\" >闪电伤害</span>',
            'wind damage': '<span style=\"background:#7ff97c\" >疾风伤害</span>',
            'dark damage': '<span style=\"background:#000000\;color:#ffffff\" >黑暗伤害</span>',
            'holy damage': '<span style=\"background:#ffffff\;color:#000000\" >神圣伤害</span>',
            'spirit damage': '<span style=\"color:#a2042c\" >灵力值伤害</span>',
            'Fire damage': '<span style=\"background:#f97c7c\" >火焰伤害</span>',
            'Cold damage': '<span style=\"background:#94c2f5\" >冰冷伤害</span>',
            'Void damage': '<span style=\"background:#ffffff\;color:#5c5a5a\" >虚空伤害</span>',
            'Void': '<span style=\"background:#ffffff\;color:#5c5a5a\" >虚空伤害</span>',
            'Elec damage': '<span style=\"background:#f4f375\" >闪电伤害</span>',
            'Wind damage': '<span style=\"background:#7ff97c\" >疾风伤害</span>',
            'Dark damage': '<span style=\"background:#000000\;color:#ffffff\" >黑暗伤害</span>',
            'Holy damage': '<span style=\"background:#ffffff\;color:#000000\" >神圣伤害</span>',
            'crushing damage': '<span style=\"background:#000000\;color:#F6F504\" >打击伤害</span>',
            'slashing damage': '<span style=\"background:#000000\;color:#F6F504\" >斩击伤害</span>',
            'piercing damage': '<span style=\"background:#000000\;color:#F6F504\" >刺击伤害</span>',
            'Crushing': '打击',
            'Slashing': '斩击',
            'Piercing': '刺击',
            'damage': '伤害',

            'points of': '点',
            'health': '<span style=\"color:#006400\" >生命</span>',
            'magic': '<span style=\"color:#639AD4\" >魔力</span>',
            'spirit': '<span style=\"color:#D4637A\" >灵力</span>',
        };


        const battleLogDictCache = new Map(); // 战斗日志字典缓存

        function buildDictForBattleLog(dictNames) {
            const cacheKey = dictNames.join(',');
            if (battleLogDictCache.has(cacheKey)) {
                return battleLogDictCache.get(cacheKey);
            }

            const rIsRegexp = /^\/(.+)\/([gim]+)?$/;
            function prepareRegex(string) {
                return string.replace(/([\[\]\^\&\$\.\(\)\?\/\\\+\{\}\|])/g, '\\$1');
            }

            const result = [];
            for (const dictName of dictNames) {
                if (!words[dictName]) continue;

                // 按词条长度降序排序，确保长词优先匹配
                const entries = Object.entries(words[dictName])
                    .filter(([key]) => key !== '') // 删除空行
                    .sort((a, b) => b[0].length - a[0].length);

                for (const [word, value] of entries) {
                    let reg;
                    // 检查是否是正则表达式格式
                    if (rIsRegexp.test(word)) {
                        const match = word.match(rIsRegexp);
                        reg = new RegExp(match[1], 'g');
                    } else {
                        // 为战斗日志添加边界检查，避免误匹配
                        const escaped = prepareRegex(word).replace(/\\?\*/g, function (fullMatch) {
                            return fullMatch === '\\*' ? '*' : '[^ ]*';
                        });
                        // 对于两端自带空格的清理词（例如 ' of '、' the '），允许在短语中部直接匹配
                        if (word.startsWith(' ') || word.endsWith(' ')) {
                            reg = new RegExp(`${escaped}`, 'g');
                        } else {
                            // 其它词条使用边界检查，匹配单词边界或方括号内的内容
                            reg = new RegExp(`(?<=[ ,.\\[]|^)${escaped}(?=[ ,.\\]]|$)`, 'g');
                        }
                    }
                    result.push({ reg, value });
                }
            }

            battleLogDictCache.set(cacheKey, result);
            return result;
        }

        // 编译战斗日志特有词汇的正则表达式（保留原有逻辑）
        const regexs = [];
        const chinese = [];
        for (const [key, value] of Object.entries(battleLogWords)) {
            // 如果正则表达式包含捕获组（如 (.*)），则不添加边界检查
            if (key.includes('(') && key.includes(')')) {
                regexs.push(new RegExp(key, 'g'));
            } else {
                regexs.push(new RegExp(`(?<=[ ,.\\[]|^)${key}(?=[ ,.\\]]|$)`, 'g'));
            }
            chinese.push(value);
        }

        // 翻译函数 - 复用主字典系统
        function translateLog(text) {

            // 翻译方括号内的物品/装备名称（逐个处理每个方括号，避免跨段匹配）
            text = text.replace(/\[([^\]]+)\]/g, (m, inner) => {
                let translated = inner;
                // 使用主字典系统编译的字典（items、equipsName、artifact）
                const itemsDict = buildDictForBattleLog([ 'items','artifact','equipsName']);
                for (const {reg, value} of itemsDict) {
                    translated = translated.replace(reg, value);
                }
                return '[' + translated + ']';
            });

            // 对整行先应用 items 字典
            const itemOnlyDict = buildDictForBattleLog(['items']);
            (function applyItemsGlobally(){
                for (const {reg, value} of itemOnlyDict) {
                    text = text.replace(reg, value);
                }
            })();

            // 翻译“Your ... is damaged, and should be repaired soon”中的装备名称
            text = text.replace(/Your (.+?) is damaged, and should be repaired soon(\.)?/g, (m, name, dot) => {
                let translated = name;
                const itemsDict = buildDictForBattleLog([ 'items','artifact','equipsName']);
                for (const {reg, value} of itemsDict) {
                    translated = translated.replace(reg, value);
                }
                return `Your ${translated} is damaged, and should be repaired soon${dot || ''}`;
            });

            // 再翻译战斗日志特有词汇
            for (let i = 0; i < regexs.length; i++) {
                text = text.replace(regexs[i], chinese[i]);
            }
            return text;
        }

        // 添加日志到翻译区
        function addToLog(text) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');

            if (text === '') {
                td.classList.add('tls');
            } else {
                td.classList.add('tl');
                td.innerHTML = translateLog(text);
            }

            tr.appendChild(td);
            const log = document.querySelector('#translog');

            // 限制日志数量为100条
            if (log.children.length >= 100) {
                log.lastChild.remove();
            }

            log.insertBefore(tr, log.firstChild);
        }

        const observedTbodies = new WeakSet();
        let textlogObserver = null;
        const tbodyObservers = new WeakMap(); // 存储tbody到observer的映射，便于清理

        // 处理日志变化
        function handleLogMutations(mutations) {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;

                for (const node of mutation.addedNodes) {
                    // 如果添加的是tbody，需要监听其内部的变化
                    if (node.nodeName === 'TBODY' && !observedTbodies.has(node)) {
                        // 标记为已监听，避免重复
                        observedTbodies.add(node);

                        // 立即处理tbody中已存在的tr
                        const trs = node.querySelectorAll('tr');
                        trs.forEach(tr => {
                            const text = [];
                            tr.childNodes.forEach(n => text.push(n.innerHTML));
                            addToLog(text.join(' '));
                        });

                        // 继续监听这个新tbody的变化
                        const tbodyObserver = new MutationObserver(handleLogMutations);
                        tbodyObserver.observe(node, { childList: true });
                        tbodyObservers.set(node, tbodyObserver);
                    }
                    // 如果添加的是tr，直接处理
                    else if (node.nodeName === 'TR') {
                        const text = [];
                        node.childNodes.forEach(n => text.push(n.innerHTML));
                        addToLog(text.join(' '));
                    }
                }
            }
        }

        // 启动监听
        function startObserve() {
            if (document.getElementById('translog')) return;

            // 清理旧的监听器（如果存在）
            if (textlogObserver) {
                textlogObserver.disconnect();
                textlogObserver = null;
            }

            // 创建翻译日志容器
            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            table.id = 'translog';
            table.appendChild(tbody);

            const paneLog = document.querySelector('#pane_log');
            paneLog.appendChild(table);

            // 翻译已存在的日志
            const texts = [];
            const existingLogs = document.querySelectorAll('#textlog > tbody > tr > td');
            existingLogs.forEach(log => texts.push(log.innerHTML));

            texts.reverse().forEach(text => addToLog(text));

            // 监听原日志的变化 - 观察textlog本身
            const textlog = document.querySelector('#textlog');
            if (textlog) {
                // 只监听childList变化，且只处理tbody和tr节点
                textlogObserver = new MutationObserver(handleLogMutations);
                textlogObserver.observe(textlog, {
                    childList: true,
                    subtree: false
                });

                const existingTbodies = textlog.querySelectorAll('tbody');
                existingTbodies.forEach(tbody => {
                    if (!observedTbodies.has(tbody)) {
                        observedTbodies.add(tbody);
                        const tbodyObserver = new MutationObserver(handleLogMutations);
                        tbodyObserver.observe(tbody, { childList: true });
                        tbodyObservers.set(tbody, tbodyObserver);
                    }
                });
            }
        }

        const battleMain = document.querySelector('#battle_main');
        if (battleMain) {
            const battleObserver = new MutationObserver(startObserve);
            battleObserver.observe(battleMain, { childList: true });
        }

        const body = document.querySelector('body');
        if (body) {
            const bodyObserver = new MutationObserver(startObserve);
            bodyObserver.observe(body, { childList: true });
        }

        startObserve();

    })();



}());



