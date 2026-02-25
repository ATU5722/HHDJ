// ==UserScript==
// @name         HV 论坛装备着色汉化双翻译版
// @namespace    HV_Equipment_Translation
// @version      4.6.2
// @description  HV装备名称翻译与着色，支持论坛和拍卖网站(论坛详细/拍卖精简)
// @author       THE
// @icon         https://e-hentai.org/favicon.ico
// @match        *://forums.e-hentai.org/*
// @match        https://reasoningtheory.net/*
// @exclude   *://forums.e-hentai.org/index.php?act*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 添加全局样式：统一字体粗细
    const style = document.createElement('style');
    style.textContent = `
        a[data-hv-translated="1"] {
            font-weight: normal !important;
        }
    `;
    document.head.appendChild(style);

    // 品质翻译
    const qualityMap = {
        'Peerless': '<span style="background:#ffd760">☯无双☯</span>',
        'Legendary': '<span style="background:#ffbbff">✪传奇✪</span>',
        'Magnificent': '<span style="background:#a6daf6">☆史诗☆</span>',
        'Mag': '<span style="background:#a6daf6">☆史诗☆</span>',
        'Exquisite': '<span style="background:#d7e698">✧精良✧</span>',
        'Exq': '<span style="background:#d7e698">✧精良✧</span>',
        'Superior': '<span style="background:#fbf9f9">上等</span>',
        'Fine': '<span style="background:#b9ffb9">优质</span>',
        'Average': '<span style="background:#dfdfdf">中等</span>',
        'Fair': '<span style="background:#c1c1c1">普通</span>',
        'Crude': '<span style="background:#acacac">粗糙</span>',
        'Flimsy': '<span style="background:#848482">脆弱</span>'
    };

    // 前缀翻译 - 论坛详细版
    const prefixMapForum = {
        'Radiant': '<span style="background:#ffffff;color:#000000">✪魔光的✪(法伤+)</span>',
        'Mystic': '神秘的(法暴伤+)',
        'Charged': '<span style="color:red">充能的(施速+)</span>',
        'Amber': '<span style="background:#ffff00;color:#9f9f16">琥珀的(电抗+)</span>',
        'Mithril': '<span style="color:red">秘银的(负重-20%)</span>',
        'Agile': '俊敏的(攻速+)',
        'Zircon': '<span style="background:#ffffff;color:#5c5a5a">锆石的(圣抗+)</span>',
        'Frugal': '<span style="color:red">节能的(魔耗-)</span>',
        'Jade': '<span style="background:#b1f9b1">翡翠的(风抗+)</span>',
        'Cobalt': '<span style="background:#a0f4f4">冰蓝的(冰抗+)</span>',
        'Ruby': '<span style="background:#ffa6a6;color:#000000">红宝石(火抗+)</span>',
        'Onyx': '<span style="background:#cccccc">缟玛瑙(暗抗+)</span>',
        'Savage': '<span style="color:red">野蛮的(攻暴伤+)</span>',
        'Reinforced': '加固的(斩打刺减伤+)',
        'Shielding': '盾化的(格挡+)',
        'Arctic': '<span style="background:#94c2f5">极寒之(冰法伤+)</span>',
        'Fiery': '<span style="background:#f97c7c;color:#000000">灼热之(火法伤+)</span>',
        'Shocking': '<span style="background:#f4f375">闪电之(电法伤+)</span>',
        'Tempestuous': '<span style="background:#7ff97c">风暴之(风法伤+)</span>',
        'Hallowed': '<span style="background:#ffffff;color:#000000">神圣之(圣法伤+)</span>',
        'Demonic': '<span style="background:#000000;color:#ffffff">恶魔之(暗法伤+)</span>',
        'Ethereal': '<span style="background:#ffffff;color:#5c5a5a">虚空之(无负重/干涉)</span>',
        'Bronze': '铜',
        'Iron': '铁',
        'Silver': '银',
        'Steel': '钢',
        'Gold': '金',
        'Platinum': '白金',
        'Titanium': '钛',
        'Emerald': '祖母绿',
        'Sapphire': '蓝宝石',
        'Diamond': '金刚石',
        'Prism': '光棱',
        'Astral': '五芒星',
        'Quintessential': '第五元素'
    };

    // 前缀翻译 - 拍卖精简版
    const prefixMapAuction = {
        'Radiant': '<span style="background:#ffffff;color:#000000">✪魔光✪</span>',
        'Mystic': '神秘的',
        'Charged': '<span style="color:red">充能的</span>',
        'Amber': '<span style="background:#ffff00;color:#9f9f16">琥珀的(雷抗)</span>',
        'Mithril': '<span style="color:red">秘银的</span>',
        'Agile': '俊敏的',
        'Zircon': '<span style="background:#ffffff;color:#5c5a5a">锆石的(圣抗)</span>',
        'Frugal': '<span style="color:red">节能</span>',
        'Jade': '<span style="background:#b1f9b1">翡翠的(风抗)</span>',
        'Cobalt': '<span style="background:#a0f4f4">钴石的(冰抗)</span>',
        'Ruby': '<span style="background:#ffa6a6;color:#000000">红宝石(火抗)</span>',
        'Onyx': '<span style="background:#cccccc">缟玛瑙(暗抗)</span>',
        'Savage': '<span style="color:red">野蛮的</span>',
        'Reinforced': '加固的',
        'Shielding': '盾化的',
        'Arctic': '<span style="background:#94c2f5">极寒之</span>',
        'Fiery': '<span style="background:#f97c7c;color:#000000">灼热之</span>',
        'Shocking': '<span style="background:#f4f375">闪电之</span>',
        'Tempestuous': '<span style="background:#7ff97c">风暴之</span>',
        'Hallowed': '<span style="background:#ffffff;color:#000000">神圣之</span>',
        'Demonic': '<span style="background:#000000;color:#ffffff">恶魔之</span>',
        'Ethereal': '<span style="background:#ffffff;color:#5c5a5a">虚空之</span>',
        'Bronze': '铜',
        'Iron': '铁',
        'Silver': '银',
        'Steel': '钢',
        'Gold': '金',
        'Platinum': '白金',
        'Titanium': '钛',
        'Emerald': '祖母绿',
        'Sapphire': '蓝宝石',
        'Diamond': '金刚石',
        'Prism': '光棱',
        'Astral': '五芒星',
        'Quintessential': '第五元素'
    };

    // 后缀翻译 - 论坛详细版
    const suffixMapForum = {
        // 防具后缀
        'of the Cheetah': '<span style="background:#ffd700;color:#000000">猎豹(敏捷+)</span>',
        'of Negation': '<span style="background:#e6e6fa">否定(抵抗+)</span>',
        'of the Negation': '<span style="background:#e6e6fa">否定(抵抗+)</span>',
        'of the Shadowdancer': '<span style="background:#708090;color:#f0f8ff">影武者(闪避/攻暴+)</span>',
        'of the Arcanist': '<span style="background:#9370db;color:#ffffff">秘法(智力/智慧/法命+)</span>',
        'of the Fleet': '<span style="background:#87ceeb">迅捷(闪避+)</span>',
        'of the Spirit-ward': '<span style="background:#cccccc">幽冥结界(暗抗+)</span>',
        'Spirit-ward': '<span style="background:#cccccc">幽冥结界(暗抗+)</span>',
        'of the Fire-eater': '<span style="background:#ffa6a6;color:#000000">噬火者(火抗+)</span>',
        'Fire-eater': '<span style="background:#ffa6a6;color:#000000">噬火者(火抗+)</span>',
        'of the Thunder-child': '<span style="background:#ffff00;color:#9f9f16">雷之子(雷抗+)</span>',
        'of the Wind-waker': '<span style="background:#b1f9b1">驭风者(风抗+)</span>',
        'of Dampening': '抑制(打减伤+)',
        'of the Dampening': '抑制(打减伤+)',
        'of Stoneskin': '石肤(斩减伤+)',
        'of the Stoneskin': '石肤(斩减伤+)',
        'of Deflection': '偏转(刺减伤+)',
        'of the Deflection': '偏转(刺减伤+)',
        'of the Nimble': '<span style="background:#ffa07a">灵活(招架+)</span>',
        'of the Barrier': '<span style="background:#4682b4;color:#ffffff">屏障(格挡+)</span>',
        'of Protection': '保护(物减伤+)',
        'of the Protection': '保护(物减伤+)',
        'of Warding': '护佑(魔减伤+)',
        'of the Warding': '护佑(魔减伤+)',
        'of the Raccoon': '<span style="background:#d2b48c">小浣熊(灵巧+)</span>',
        'of the Turtle': '<span style="background:#90ee90">乌龟(体质+)</span>',
        'of the Ox': '<span style="background:#cd5c5c;color:#ffffff">公牛(力量+)</span>',
        'of the Fox': '<span style="background:#ff8c00;color:#ffffff">狐狸(智力+)</span>',
        'of the Owl': '<span style="background:#8b7355;color:#ffffff">猫头鹰(智慧+)</span>',
        'of the Hulk': '<span style="background:#8b4513;color:#ffffff">巨物</span>',
        'of the Stone-skinned': '石肤(物减伤+)',
        'of the Frost-born': '<span style="background:#a0f4f4">霜裔(冰抗+)</span>',

        // 武器后缀
        'of Slaughter': '<span style="background:#FF0000;color:#FFFFFF">杀戮(攻击+)</span>',
        'of the Slaughter': '<span style="background:#FF0000;color:#FFFFFF">杀戮(攻击+)</span>',
        'of Swiftness': '<span style="background:#ffdb58">加速(攻速+)</span>',
        'of the Swiftness': '<span style="background:#ffdb58">加速(攻速+)</span>',
        'of Balance': '<span style="background:#daa520;color:#ffffff">平衡(攻命攻暴+)</span>',
        'of the Balance': '<span style="background:#daa520;color:#ffffff">平衡(攻命攻暴+)</span>',
        'of the Battlecaster': '<span style="background:#6a5acd;color:#ffffff">战法师(魔耗-魔命+)</span>',
        'of the Banshee': '<span style="background:#dda0dd">女妖(吸灵+)</span>',
        'of the Illithid': '<span style="background:#ba55d3;color:#ffffff">汲灵(吸魔+)</span>',
        'of the Vampire': '<span style="background:#8b0000;color:#ffffff">吸血鬼(吸血+)</span>',
        'of Destruction': '<span style="background:#9400d3;color:#FFFFFF">毁灭(法伤+)</span>',
        'of the Destruction': '<span style="background:#9400d3;color:#FFFFFF">毁灭(法伤+)</span>',
        'of Surtr': '<span style="background:#f97c7c;color:#000000">苏尔特(火法伤+)</span>',
        'of Niflheim': '<span style="background:#94c2f5">尼芙菲姆(冰法伤+)</span>',
        'of Mjolnir': '<span style="background:#f4f375">姆乔尔尼尔(电法伤+)</span>',
        'of Freyr': '<span style="background:#7ff97c">弗瑞尔(风法伤+)</span>',
        'of Heimdall': '<span style="background:#ffffff;color:#000000">海姆达(圣法伤+)</span>',
        'of Fenrir': '<span style="background:#000000;color:#ffffff">芬里尔(暗法伤+)</span>',
        'of Focus': '<span style="background:#9932cc;color:#ffffff">专注(法暴法命+魔耗-)</span>',
        'of the Focus': '<span style="background:#9932cc;color:#ffffff">专注(法暴法命+魔耗-)</span>',
        'of the Elementalist': '元素使(元素熟练+)',
        'of the Heaven-sent': '天堂(神圣熟练+)',
        'of the Demon-fiend': '恶魔(黑暗熟练+)',
        'of the Earth-walker': '地行者(增益熟练+)',
        'of the Priestess': '<span style="background:#f0e68c">牧师</span>',
        'of the Curse-weaver': '<span style="background:#b19cd9">织咒者(减益熟练+)</span>',
        'of the Thrice-blessed': '<span style="background:#ffffff;color:#5c5a5a">三重祝福(圣抗+)</span>'
    };

    // 后缀翻译 - 拍卖精简版(4.7版本)
    const suffixMapAuction = {
        'of the Shadowdancer': '<span style="background:#708090;color:#f0f8ff">影舞者</span>',
        'of the Arcanist': '<span style="background:#9370db;color:#ffffff">奥术师</span>',
        'of the Fire-eater': '<span style="background:#ffa6a6;color:#000000">噬火者</span>',
        'of the Thunder-child': '<span style="background:#ffff00;color:#9f9f16">雷之子</span>',
        'of the Wind-waker': '<span style="background:#b1f9b1">风之杖</span>',
        'of the Spirit-ward': '<span style="background:#cccccc">幽冥结界</span>',
        'of the Battlecaster': '<span style="background:#6a5acd;color:#ffffff">战法师</span>',
        'of the Elementalist': '元素使',
        'of the Heaven-sent': '天堂',
        'of the Demon-fiend': '恶魔',
        'of the Earth-walker': '地行者',
        'of the Curse-weaver': '<span style="background:#b19cd9">咒术师</span>',
        'of the Thrice-blessed': '<span style="background:#ffffff;color:#5c5a5a">三重祝福</span>',
        'of the Frost-born': '<span style="background:#a0f4f4">霜裔</span>',
        'of the Cheetah': '<span style="background:#ffd700;color:#000000">猎豹</span>',
        'of the Fleet': '<span style="background:#87ceeb">迅捷</span>',
        'of the Nimble': '<span style="background:#ffa07a">招架</span>',
        'of the Barrier': '<span style="background:#4682b4;color:#ffffff">格挡</span>',
        'of the Raccoon': '<span style="background:#d2b48c">浣熊</span>',
        'of the Turtle': '<span style="background:#90ee90">乌龟</span>',
        'of the Ox': '<span style="background:#cd5c5c;color:#ffffff">公牛</span>',
        'of the Fox': '<span style="background:#ff8c00;color:#ffffff">狐狸</span>',
        'of the Owl': '<span style="background:#8b7355;color:#ffffff">猫头鹰</span>',
        'of the Hulk': '<span style="background:#8b4513;color:#ffffff">巨物</span>',
        'of the Stone-skinned': '石肤',
        'of the Priestess': '<span style="background:#f0e68c">牧师</span>',
        'of the Banshee': '<span style="background:#dda0dd">报丧女妖</span>',
        'of the Illithid': '<span style="background:#ba55d3;color:#ffffff">灵吸怪</span>',
        'of the Vampire': '<span style="background:#8b0000;color:#ffffff">吸血鬼</span>',
        'of Slaughter': '<span style="background:#FF0000;color:#FFFFFF">杀戮</span>',
        'of the Slaughter': '<span style="background:#FF0000;color:#FFFFFF">杀戮</span>',
        'of Destruction': '<span style="background:#9400d3;color:#FFFFFF">毁灭</span>',
        'of the Destruction': '<span style="background:#9400d3;color:#FFFFFF">毁灭</span>',
        'of Surtr': '<span style="background:#f97c7c;color:#000000">苏尔特(火伤)</span>',
        'of Niflheim': '<span style="background:#94c2f5">尼芙菲姆(冰伤)</span>',
        'of Mjolnir': '<span style="background:#f4f375">姆乔尔尼尔(雷伤)</span>',
        'of Freyr': '<span style="background:#7ff97c">弗瑞尔(风伤)</span>',
        'of Heimdall': '<span style="background:#ffffff;color:#000000">海姆达(圣伤)</span>',
        'of Fenrir': '<span style="background:#000000;color:#ffffff">芬里尔(暗伤)</span>',
        'of Negation': '<span style="background:#e6e6fa">否定</span>',
        'of the Negation': '<span style="background:#e6e6fa">否定</span>',
        'of Dampening': '抑制',
        'of the Dampening': '抑制',
        'of Stoneskin': '石肤',
        'of the Stoneskin': '石肤',
        'of Deflection': '偏转',
        'of the Deflection': '偏转',
        'of Protection': '物防',
        'of the Protection': '物防',
        'of Warding': '魔防',
        'of the Warding': '魔防',
        'of Swiftness': '<span style="background:#ffdb58">加速</span>',
        'of the Swiftness': '<span style="background:#ffdb58">加速</span>',
        'of Balance': '<span style="background:#daa520;color:#ffffff">平衡</span>',
        'of the Balance': '<span style="background:#daa520;color:#ffffff">平衡</span>',
        'of Focus': '<span style="background:#9932cc;color:#ffffff">专注</span>',
        'of the Focus': '<span style="background:#9932cc;color:#ffffff">专注</span>',
        'Fire-eater': '<span style="background:#ffa6a6;color:#000000">噬火者</span>',
        'Spirit-ward': '<span style="background:#cccccc">幽冥结界</span>'
    };

    // 装备类型翻译
    const typeMap = {
        'Sword Chucks': '锁链双剑(单)',
        'Swordchucks': '锁链双剑(单)',
        'Dagger': '匕首(单)',
        'Shortsword': '短剑(单)',
        'Wakizashi': '脇差(单)',
        'Axe': '斧(单)',
        'Club': '棍(单)',
        'Rapier': '<span style="background:#ffa500">西洋剑</span>(单)',
        'Scythe': '镰刀(双)',
        'Longsword': '长剑(双)',
        'Katana': '太刀(双)',
        'Katana': '太刀(双)',
        'Great Mace': '巨锤(双)',
        'Mace': '锤矛(双)',
        'Estoc': '刺剑(双)',
        'Staff': '法杖',
        'Cap': '兜帽',
        'Robe': '长袍',
        'Gloves': '手套',
        'Pants': '短裤',
        'Shoes': '鞋',
        'Helmet': '头盔',
        'Breastplate': '护胸',
        'Gauntlets': '手甲',
        'Leggings': '护腿',
        'Cuirass': '胸甲',
        'Armor': '盔甲',
        'Sabatons': '铁靴',
        'Boots': '靴子',
        'Greaves': '护胫',
        'Coif': '头巾',
        'Mitons': '护手',
        'Hauberk': '装甲',
        'Chausses': '裤',
        'Buckler': '圆盾',
        'Kite Shield': '鸢盾',
        'Tower Shield': '塔盾',
        'Force Shield': '<span style="background:#ffa500">力场盾</span>'
    };

    // 材质翻译
    const materialMap = {
        'Cotton': '棉质<span style="background:#FFFFFF;color:#000000">(布)</span>',
        'Gossamer': '薄纱<span style="background:#FFFFFF;color:#000000">(布)</span>',
        'Ironsilk': '铁丝绸<span style="background:#FFFFFF;color:#000000">(布)</span>',
        'Silk': '丝绸<span style="background:#FFFFFF;color:#000000">(布)</span>',
        'Phase': '<span style="background:#ffa500">相位</span><span style="background:#FFFFFF;color:#000000">(布)</span>',
        'Leather': '皮革<span style="background:#666666;color:#FFFFFF">(轻)</span>',
        'Drakehide': '龙鳞<span style="background:#666666;color:#FFFFFF">(轻)</span>',
        'Kevlar': '凯夫拉<span style="background:#666666;color:#FFFFFF">(轻)</span>',
        'Dragon Hide': '龙鳞<span style="background:#666666;color:#FFFFFF">(轻)</span>',
        'Shade': '<span style="background:#ffa500">暗影</span><span style="background:#666666;color:#FFFFFF">(轻)</span>',
        'Chainmail': '锁子甲<span style="background:#000000;color:#FFFFFF">(重)</span>',
        'Chain': '锁甲<span style="background:#000000;color:#FFFFFF">(重)</span>',
        'Plate': '板甲<span style="background:#000000;color:#FFFFFF">(重)</span>',
        'Power': '<span style="background:#ffa500">动力</span><span style="background:#000000;color:#FFFFFF">(重)</span>',
        'Reactive' : '<span style="background:#ffa500">反应</span><span style="background:#000000;color:#FFFFFF">(重)</span>',
        'Ebony': '乌木',
        'Redwood': '红木',
        'Willow': '柳木',
        'Oak': '橡木',
        'Katalox': '铁木'
    };

    // 预编译正则(转义特殊字符)
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function compileMaps(maps) {
        const entries = [];
        maps.forEach(map => {
            Object.entries(map).forEach(([eng, chn]) => {
                entries.push({
                    needle: eng,
                    regex: new RegExp(escapeRegex(eng), 'g'),
                    replacement: chn
                });
            });
        });
        return entries;
    }

    const compiledForumEntries = compileMaps([qualityMap, materialMap, prefixMapForum, typeMap, suffixMapForum]);
    const compiledAuctionEntries = compileMaps([qualityMap, materialMap, prefixMapAuction, typeMap, suffixMapAuction]);

    // 清理装备文本(一次性移除所有标签)
    function cleanEquipmentText(text) {
        // 移除所有 HTML 注释
        text = text.replace(/<!--[^>]*?-->/g, '');

        // 一次性移除所有 <span> 标签(包括嵌套)
        let prevText;
        do {
            prevText = text;
            text = text.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1');
        } while (text !== prevText);

        // 移除所有 <b> 标签
        text = text.replace(/<\/?b>/g, '');

        return text.trim();
    }

    // 智能翻译装备名称(只替换存在的词)
    function translateEquipment(text, useForum = true) {
        const entries = useForum ? compiledForumEntries : compiledAuctionEntries;

        entries.forEach(({ needle, regex, replacement }) => {
            if (!text.includes(needle)) return;
            regex.lastIndex = 0;
            text = text.replace(regex, replacement);
        });

        return text;
    }

    function translateNodeList(nodes, useForum) {
        nodes.forEach(node => {
            if (node.dataset && node.dataset.hvTranslated) return;
            const originalText = node.innerHTML;
            const cleanedText = cleanEquipmentText(originalText);
            const translatedText = translateEquipment(cleanedText, useForum);

            if (translatedText !== cleanedText) {
                node.innerHTML = translatedText;
                node.setAttribute('data-hv-translated', '1');
                node.removeAttribute('style');
            }
        });
    }

    // 处理论坛页面
    function processForumPage() {
        const selectors = [
            '.postcolor a[href*="hentaiverse.org"][href*="equip"]',
            '#NAE_menu .NAE_name',
            '#NAE_menu .NAE_lot_name',
            '#NAE_menu .NAE_equip_name'
        ];

        selectors.forEach(selector => {
            const nodes = document.querySelectorAll(`${selector}:not([data-hv-translated])`);
            translateNodeList(nodes, true);
        });
    }

    // 处理拍卖网站
    function processAuctionPage() {
        const selectors = [
            'a[href*="hentaiverse.org"][href*="equip"]',
            '#NAE_menu .NAE_name',
            '#NAE_menu .NAE_lot_name',
            '#NAE_menu .NAE_equip_name'
        ];

        selectors.forEach(selector => {
            const nodes = document.querySelectorAll(`${selector}:not([data-hv-translated])`);
            translateNodeList(nodes, false);
        });
    }

    // 主函数
    function main() {
        const hostname = window.location.hostname;

        if (hostname.includes('forums.e-hentai.org')) {
            processForumPage();
        } else if (hostname.includes('reasoningtheory.net')) {
            processAuctionPage();
        }
    }

    // DOM 监听(防抖 + 节流优化)
    let debounceTimer = null;
    let isProcessing = false;

    const observer = new MutationObserver((mutations) => {
        // 快速检查：如果没有新增节点，直接返回
        const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (!hasAddedNodes || isProcessing) return;

        // 防抖处理
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            isProcessing = true;
            main();
            isProcessing = false;
            debounceTimer = null;
        }, 300);
    });

    // 初始化
    function init() {
        main();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
