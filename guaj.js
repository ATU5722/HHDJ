// ==UserScript==
// @name         zdd
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  根据蓝量自动喝大蓝药，根据血量自动喝大红药，等级超过200时自动提升修为
// @author       Gemini
// @match        *://cq.xxpc.cc.cd
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================

    // 触发喝药的蓝量百分比 (例如：80代表蓝量低于80%时触发)
    const MP_THRESHOLD = 90;

    // 触发喝药的血量百分比 (例如：50代表血量低于50%时触发)
    const HP_POTION_THRESHOLD = 90;

    // 喝药间隔时间，单位为毫秒 (6000 = 6秒)
    const POTION_INTERVAL = 10000;

    // 检查血量和蓝量的频率，单位为毫秒 (1000 = 1秒)
    const CHECK_INTERVAL = 2000;

    // 自动提升修为的等级阈值 (等级大于此值时会尝试提升)
    const CULTIVATION_LEVEL_THRESHOLD = 200;

    // 要使用的药水名称
    const BLUE_POTION_NAME = '大蓝药';
    const RED_POTION_NAME = '大红药';

    // 提升修为按钮的ID
    const CULTIVATION_BUTTON_ID = 'ui-cultivation-upgrade';

    // ============================================

    // ================= 内存清理配置 ==============
    // 玩家/怪物缓存过期时间
    const CACHE_TTL_PLAYER = 3 * 60 * 1000; // 3分钟
    const CACHE_TTL_MOB = 2 * 60 * 1000; // 2分钟

    // 缓存上限（避免极端增长）
    const CACHE_MAX_PLAYER = 80;
    const CACHE_MAX_MOB = 120;

    // 清理周期
    const CACHE_CLEAN_INTERVAL = 60 * 1000; // 60秒

    // 交易冷却缓存过期时间
    const CACHE_TTL_TRADE = 5 * 60 * 1000; // 5分钟
    // ============================================

    let lastPotionTime = 0; // 上次喝蓝药的时间戳
    let lastRedPotionTime = 0; // 上次喝大红药的时间戳
    let lastCultivationCheckTime = 0; // 上次检查提升修为的时间戳
    const CULTIVATION_CHECK_INTERVAL = 30000; // 提升修为检查间隔3秒

    // ================= 内存清理逻辑 ==============
    const seenCache = {
        players: new Map(),
        mobs: new Map()
    };

    function nowMs() {
        return Date.now();
    }

    function updateSeenFromState() {
        const st = window.lastState;
        if (!st) return;
        const t = nowMs();
        if (st.player && st.player.name) {
            seenCache.players.set(st.player.name, t);
        }
        (st.players || []).forEach((p) => {
            if (p && p.name) seenCache.players.set(p.name, t);
        });
        (st.mobs || []).forEach((m) => {
            if (m && m.name) seenCache.mobs.set(m.name, t);
        });
    }

    function pruneMap(kind, map, ttl, max) {
        if (!map) return;
        const t = nowMs();
        for (const [name] of map) {
            const last = seenCache[kind].get(name);
            if (!last || (t - last) > ttl) {
                map.delete(name);
            }
        }
        if (max && map.size > max) {
            const keys = Array.from(map.keys()).sort((a, b) => {
                return (seenCache[kind].get(a) || 0) - (seenCache[kind].get(b) || 0);
            });
            for (let i = 0; map.size > max && i < keys.length; i += 1) {
                map.delete(keys[i]);
            }
        }
    }

    function pruneTradeCooldown() {
        const map = window.tradeInviteCooldown;
        if (!map) return;
        const t = nowMs();
        for (const [name, lastAt] of map) {
            if (!lastAt || (t - lastAt) > CACHE_TTL_TRADE) {
                map.delete(name);
            }
        }
    }

    function cleanupExpiredCaches() {
        if (!window.localHpCache) return;
        updateSeenFromState();
        pruneMap('players', window.localHpCache.players, CACHE_TTL_PLAYER, CACHE_MAX_PLAYER);
        pruneMap('mobs', window.localHpCache.mobs, CACHE_TTL_MOB, CACHE_MAX_MOB);
        pruneTradeCooldown();
    }
    // ============================================

    // 通用的药水使用函数
    function usePotion(potionName, itemList) {
        if (!itemList) return false;

        const items = itemList.querySelectorAll('.chip');

        for (let i = 0; i < items.length; i++) {
            if (items[i].textContent.includes(potionName)) {
                // 提取药水数量
                const itemText = items[i].textContent;
                const match = itemText.match(/x(\d+)/);
                const quantity = match ? parseInt(match[1]) : 0;

                if (quantity > 0) {
                    items[i].click(); // 触发点击喝药
                    return { success: true, quantity: quantity };
                } else {
                    console.log(`[自动喝药] ${potionName} 数量为0，无法使用`);
                    return { success: false, quantity: 0 };
                }
            }
        }
        return { success: false, quantity: 0 };
    }

    // 获取当前等级
    function getCurrentLevel() {
        const levelElement = document.querySelector('#ui-class');
        if (!levelElement) return 0;

        const levelText = levelElement.textContent;
        // 匹配 "道士 | Lv 201" 或 "战士 | Lv 150" 等格式
        const match = levelText.match(/Lv\s+(\d+)/i);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
        return 0;
    }

    // 检查并提升修为
    function checkAndUpgradeCultivation() {
        const now = Date.now();

        // 限制检查频率，避免频繁检查
        if (now - lastCultivationCheckTime < CULTIVATION_CHECK_INTERVAL) {
            return;
        }
        lastCultivationCheckTime = now;

        // 1. 获取当前等级
        const currentLevel = getCurrentLevel();

        // 2. 检查等级是否大于阈值
        if (currentLevel > CULTIVATION_LEVEL_THRESHOLD) {
            // 3. 查找提升修为按钮
            const upgradeButton = document.getElementById(CULTIVATION_BUTTON_ID);

            if (upgradeButton) {
                // 检查按钮是否可见且可用
                if (upgradeButton.offsetParent !== null && !upgradeButton.disabled) {
                    // 获取按钮的title属性，显示消耗等级信息
                    const title = upgradeButton.getAttribute('title') || '';
                    console.log(`[自动提升修为] 当前等级: ${currentLevel}, ${title}, 点击提升修为按钮`);
                    upgradeButton.click();
                } else {
                    // 按钮存在但不可用，可能是已经提升过了或者条件不满足
                    console.log(`[自动提升修为] 当前等级: ${currentLevel}, 提升修为按钮存在但不可用`);
                }
            }
            // 如果按钮不存在，说明可能已经提升过了，不输出日志避免刷屏
        }
        // 等级不足时不输出日志，避免刷屏
    }

    function checkAndDrinkPotions() {
        // 1. 获取蓝条和血条元素
        const mpBar = document.querySelector('#bar-mp');
        const hpBar = document.querySelector('.bar-fill.hp');

        if (!mpBar || !hpBar) return;

        // 2. 获取当前蓝量和血量百分比
        const mpWidthStr = mpBar.style.width;
        const hpWidthStr = hpBar.style.width;

        if (!mpWidthStr || !hpWidthStr) return;

        const currentMpPercent = parseFloat(mpWidthStr);
        const currentHpPercent = parseFloat(hpWidthStr);

        // 3. 获取当前时间和物品列表
        const now = Date.now();
        const itemsList = document.querySelector('#items-list');
        if (!itemsList) return;

        let needToDrinkBlue = false;
        let needToDrinkRed = false;

        // 4. 判断是否需要喝蓝药
        if (currentMpPercent < MP_THRESHOLD && (now - lastPotionTime) >= POTION_INTERVAL) {
            needToDrinkBlue = true;
        }

        // 5. 判断是否需要喝红药
        if (currentHpPercent < HP_POTION_THRESHOLD && (now - lastRedPotionTime) >= POTION_INTERVAL) {
            needToDrinkRed = true;
        }

        // 6. 如果同时需要喝蓝药和红药，按顺序执行
        if (needToDrinkBlue && needToDrinkRed) {
            // 先喝蓝药
            const blueResult = usePotion(BLUE_POTION_NAME, itemsList);
            if (blueResult.success) {
                lastPotionTime = now;
                console.log(`[自动喝药] 当前蓝量: ${currentMpPercent.toFixed(2)}% 低于阈值 ${MP_THRESHOLD}%, 已使用 ${BLUE_POTION_NAME}, 剩余数量: ${blueResult.quantity - 1}`);

                // 延迟一小段时间后再喝红药，避免可能的冲突
                setTimeout(() => {
                    const redResult = usePotion(RED_POTION_NAME, itemsList);
                    if (redResult.success) {
                        lastRedPotionTime = Date.now();
                        console.log(`[自动喝药] 当前血量: ${currentHpPercent.toFixed(2)}% 低于阈值 ${HP_POTION_THRESHOLD}%, 已使用 ${RED_POTION_NAME}, 剩余数量: ${redResult.quantity - 1}`);
                    }
                }, 100);
            }
        }
        // 7. 只需要喝蓝药
        else if (needToDrinkBlue) {
            const blueResult = usePotion(BLUE_POTION_NAME, itemsList);
            if (blueResult.success) {
                lastPotionTime = now;
                console.log(`[自动喝药] 当前蓝量: ${currentMpPercent.toFixed(2)}% 低于阈值 ${MP_THRESHOLD}%, 已使用 ${BLUE_POTION_NAME}, 剩余数量: ${blueResult.quantity - 1}`);
            }
        }
        // 8. 只需要喝红药
        else if (needToDrinkRed) {
            const redResult = usePotion(RED_POTION_NAME, itemsList);
            if (redResult.success) {
                lastRedPotionTime = now;
                console.log(`[自动喝药] 当前血量: ${currentHpPercent.toFixed(2)}% 低于阈值 ${HP_POTION_THRESHOLD}%, 已使用 ${RED_POTION_NAME}, 剩余数量: ${redResult.quantity - 1}`);
            }
        }
    }

    // 页面加载完成后启动定时器
    window.addEventListener('load', () => {
        // 延迟2秒启动，确保网页的元素都已经渲染完毕
        setTimeout(() => {
            // 自动喝药定时器
            setInterval(() => {
                checkAndDrinkPotions();
            }, CHECK_INTERVAL);

            // 自动提升修为定时器（使用独立的间隔）
            setInterval(() => {
                checkAndUpgradeCultivation();
            }, CHECK_INTERVAL);

            console.log(`[自动脚本] 已启动!`);
            console.log(`  蓝线阈值: ${MP_THRESHOLD}% (大蓝药)`);
            console.log(`  血线阈值: ${HP_POTION_THRESHOLD}% (大红药)`);
            console.log(`  喝药间隔: ${POTION_INTERVAL/1000}秒`);
            console.log(`  检查频率: ${CHECK_INTERVAL}ms`);
            console.log(`  提升修为等级阈值: > ${CULTIVATION_LEVEL_THRESHOLD}级`);
            console.log(`  内存清理间隔: ${CACHE_CLEAN_INTERVAL/1000}秒`);
            console.log(`  缓存上限: 玩家${CACHE_MAX_PLAYER}/怪物${CACHE_MAX_MOB}`);
        }, 2000);

        // 内存清理定时器
        setInterval(() => {
            cleanupExpiredCaches();
        }, CACHE_CLEAN_INTERVAL);
    });

})();
