// ==UserScript==
// @name         zdd
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  自动喝药、自动提升修为，并通过限频 state/room_state 缓解长时间挂机时的页面内存增长
// @author       Gemini
// @match        *://cq.xxpc.cc.cd
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ================= config =================
    const MP_THRESHOLD = 90;
    const HP_POTION_THRESHOLD = 90;
    const POTION_INTERVAL = 10000;
    const CHECK_INTERVAL = 2000;
    const CULTIVATION_LEVEL_THRESHOLD = 200;
    const BLUE_POTION_NAME = '大蓝药';
    const RED_POTION_NAME = '大红药';
    const CULTIVATION_BUTTON_ID = 'ui-cultivation-upgrade';
    // ==========================================

    // ================= memory mitigation =================
    const SOCKET_THROTTLE_ENABLED = true;
    const STATE_EVENT_THROTTLE_MS = 1200;
    const ROOM_STATE_EVENT_THROTTLE_MS = 450;
    const CACHE_CLEAN_INTERVAL = 60 * 1000;
    const IO_HOOK_RETRY_INTERVAL = 1000;
    const ENABLE_PERIODIC_PAGE_RELOAD = false;
    const PERIODIC_PAGE_RELOAD_MS = 90 * 60 * 1000;
    // ===============================================

    let lastPotionTime = 0;
    let lastRedPotionTime = 0;
    let lastCultivationCheckTime = 0;
    const CULTIVATION_CHECK_INTERVAL = 30000;

    let ioHookInstalled = false;
    let ioWatchTimer = null;
    let periodicReloadTimer = null;
    const socketThrottleState = new WeakMap();

    function getThrottleInterval(eventName) {
        if (!SOCKET_THROTTLE_ENABLED) return 0;
        if (eventName === 'room_state') return ROOM_STATE_EVENT_THROTTLE_MS;
        if (eventName === 'state') return STATE_EVENT_THROTTLE_MS;
        return 0;
    }

    function getSocketEventState(socket, eventName) {
        let perSocket = socketThrottleState.get(socket);
        if (!perSocket) {
            perSocket = new Map();
            socketThrottleState.set(socket, perSocket);
        }
        let state = perSocket.get(eventName);
        if (!state) {
            state = {
                lastAt: 0,
                pendingPacket: null,
                timer: null
            };
            perSocket.set(eventName, state);
        }
        return state;
    }

    function patchSocketIo(ioObj) {
        const proto = ioObj && ioObj.Socket && ioObj.Socket.prototype;
        if (!proto || proto.__guajMemoryHooked) return false;
        const originalOnevent = proto.onevent;
        if (typeof originalOnevent !== 'function') return false;

        proto.onevent = function(packet) {
            const data = packet && packet.data;
            const eventName = Array.isArray(data) ? data[0] : '';
            const interval = getThrottleInterval(eventName);
            if (!interval) {
                return originalOnevent.call(this, packet);
            }

            const state = getSocketEventState(this, eventName);
            const now = Date.now();
            const dispatch = (nextPacket) => {
                state.lastAt = Date.now();
                originalOnevent.call(this, nextPacket);
            };

            if (!state.timer && (now - state.lastAt) >= interval) {
                return dispatch(packet);
            }

            state.pendingPacket = packet;
            if (!state.timer) {
                const wait = Math.max(0, interval - (now - state.lastAt));
                state.timer = setTimeout(() => {
                    state.timer = null;
                    const nextPacket = state.pendingPacket;
                    state.pendingPacket = null;
                    if (nextPacket) {
                        dispatch(nextPacket);
                    }
                }, wait);
            }
        };

        proto.__guajMemoryHooked = true;
        ioHookInstalled = true;
        console.log(`[memory-opt] socket.io hook installed (state=${STATE_EVENT_THROTTLE_MS}ms, room_state=${ROOM_STATE_EVENT_THROTTLE_MS}ms)`);
        return true;
    }

    function installIoHook() {
        if (patchSocketIo(window.io)) {
            return true;
        }
        if (ioHookInstalled) {
            return true;
        }
        try {
            let currentIo = window.io;
            Object.defineProperty(window, 'io', {
                configurable: true,
                enumerable: true,
                get() {
                    return currentIo;
                },
                set(value) {
                    currentIo = value;
                    patchSocketIo(value);
                    try {
                        Object.defineProperty(window, 'io', {
                            configurable: true,
                            enumerable: true,
                            writable: true,
                            value
                        });
                    } catch (err) {
                        console.warn('[memory-opt] restore window.io failed:', err);
                    }
                }
            });
            return false;
        } catch (err) {
            console.warn('[memory-opt] window.io hook fallback:', err);
            return false;
        }
    }

    function ensureIoHook() {
        if (ioHookInstalled) return;
        installIoHook();
    }

    function startIoHookWatchdog() {
        ensureIoHook();
        if (ioWatchTimer) return;
        ioWatchTimer = setInterval(() => {
            if (!ioHookInstalled) {
                ensureIoHook();
            }
        }, IO_HOOK_RETRY_INTERVAL);
    }

    function startPeriodicPageReload() {
        if (!ENABLE_PERIODIC_PAGE_RELOAD || periodicReloadTimer) return;
        periodicReloadTimer = setTimeout(() => {
            console.log('[memory-opt] periodic reload triggered');
            window.location.reload();
        }, PERIODIC_PAGE_RELOAD_MS);
    }

    function cleanupExpiredCaches() {
        ensureIoHook();
        const strayFloats = document.querySelectorAll('.damage-float');
        if (strayFloats.length > 80) {
            Array.from(strayFloats).slice(0, strayFloats.length - 80).forEach((node) => {
                node.remove();
            });
        }
    }

    startIoHookWatchdog();

    function usePotion(potionName, itemList) {
        if (!itemList) return false;

        const items = itemList.querySelectorAll('.chip');

        for (let i = 0; i < items.length; i++) {
            if (items[i].textContent.includes(potionName)) {
                const itemText = items[i].textContent;
                const match = itemText.match(/x(\d+)/);
                const quantity = match ? parseInt(match[1], 10) : 0;

                if (quantity > 0) {
                    items[i].click();
                    return { success: true, quantity };
                } else {
                    console.log(`[自动喝药] ${potionName} 数量为0，无法使用`);
                    return { success: false, quantity: 0 };
                }
            }
        }
        return { success: false, quantity: 0 };
    }

    function getCurrentLevel() {
        const levelElement = document.querySelector('#ui-class');
        if (!levelElement) return 0;

        const levelText = levelElement.textContent;
        const match = levelText.match(/Lv\s+(\d+)/i);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        return 0;
    }

    function checkAndUpgradeCultivation() {
        const now = Date.now();

        if (now - lastCultivationCheckTime < CULTIVATION_CHECK_INTERVAL) {
            return;
        }
        lastCultivationCheckTime = now;

        const currentLevel = getCurrentLevel();

        if (currentLevel > CULTIVATION_LEVEL_THRESHOLD) {
            const upgradeButton = document.getElementById(CULTIVATION_BUTTON_ID);

            if (upgradeButton) {
                if (upgradeButton.offsetParent !== null && !upgradeButton.disabled) {
                    const title = upgradeButton.getAttribute('title') || '';
                    console.log(`[自动提升修为] 当前等级: ${currentLevel}, ${title}, 点击提升修为按钮`);
                    upgradeButton.click();
                } else {
                    console.log(`[自动提升修为] 当前等级: ${currentLevel}, 提升修为按钮存在但不可用`);
                }
            }
        }
    }

    function checkAndDrinkPotions() {
        const mpBar = document.querySelector('#bar-mp');
        const hpBar = document.querySelector('.bar-fill.hp');

        if (!mpBar || !hpBar) return;

        const mpWidthStr = mpBar.style.width;
        const hpWidthStr = hpBar.style.width;

        if (!mpWidthStr || !hpWidthStr) return;

        const currentMpPercent = parseFloat(mpWidthStr);
        const currentHpPercent = parseFloat(hpWidthStr);

        const now = Date.now();
        const itemsList = document.querySelector('#items-list');
        if (!itemsList) return;

        let needToDrinkBlue = false;
        let needToDrinkRed = false;

        if (currentMpPercent < MP_THRESHOLD && (now - lastPotionTime) >= POTION_INTERVAL) {
            needToDrinkBlue = true;
        }

        if (currentHpPercent < HP_POTION_THRESHOLD && (now - lastRedPotionTime) >= POTION_INTERVAL) {
            needToDrinkRed = true;
        }

        if (needToDrinkBlue && needToDrinkRed) {
            const blueResult = usePotion(BLUE_POTION_NAME, itemsList);
            if (blueResult.success) {
                lastPotionTime = now;
                console.log(`[自动喝药] 当前蓝量: ${currentMpPercent.toFixed(2)}% 低于阈值 ${MP_THRESHOLD}%, 已使用 ${BLUE_POTION_NAME}, 剩余数量: ${blueResult.quantity - 1}`);

                setTimeout(() => {
                    const redResult = usePotion(RED_POTION_NAME, itemsList);
                    if (redResult.success) {
                        lastRedPotionTime = Date.now();
                        console.log(`[自动喝药] 当前血量: ${currentHpPercent.toFixed(2)}% 低于阈值 ${HP_POTION_THRESHOLD}%, 已使用 ${RED_POTION_NAME}, 剩余数量: ${redResult.quantity - 1}`);
                    }
                }, 100);
            }
        } else if (needToDrinkBlue) {
            const blueResult = usePotion(BLUE_POTION_NAME, itemsList);
            if (blueResult.success) {
                lastPotionTime = now;
                console.log(`[自动喝药] 当前蓝量: ${currentMpPercent.toFixed(2)}% 低于阈值 ${MP_THRESHOLD}%, 已使用 ${BLUE_POTION_NAME}, 剩余数量: ${blueResult.quantity - 1}`);
            }
        } else if (needToDrinkRed) {
            const redResult = usePotion(RED_POTION_NAME, itemsList);
            if (redResult.success) {
                lastRedPotionTime = now;
                console.log(`[自动喝药] 当前血量: ${currentHpPercent.toFixed(2)}% 低于阈值 ${HP_POTION_THRESHOLD}%, 已使用 ${RED_POTION_NAME}, 剩余数量: ${redResult.quantity - 1}`);
            }
        }
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            setInterval(() => {
                checkAndDrinkPotions();
            }, CHECK_INTERVAL);

            setInterval(() => {
                checkAndUpgradeCultivation();
            }, CHECK_INTERVAL);

            startPeriodicPageReload();

            console.log('[自动脚本] 已启动!');
            console.log(`  蓝线阈值: ${MP_THRESHOLD}% (${BLUE_POTION_NAME})`);
            console.log(`  血线阈值: ${HP_POTION_THRESHOLD}% (${RED_POTION_NAME})`);
            console.log(`  喝药间隔: ${POTION_INTERVAL / 1000}秒`);
            console.log(`  检查频率: ${CHECK_INTERVAL}ms`);
            console.log(`  提升修为等级阈值: > ${CULTIVATION_LEVEL_THRESHOLD}级`);
            console.log(`  state 限频: ${STATE_EVENT_THROTTLE_MS}ms`);
            console.log(`  room_state 限频: ${ROOM_STATE_EVENT_THROTTLE_MS}ms`);
            console.log(`  清理周期: ${CACHE_CLEAN_INTERVAL / 1000}秒`);
            console.log(`  定时硬刷新: ${ENABLE_PERIODIC_PAGE_RELOAD ? `${Math.floor(PERIODIC_PAGE_RELOAD_MS / 60000)}分钟` : '关闭'}`);
        }, 2000);

        setInterval(() => {
            cleanupExpiredCaches();
        }, CACHE_CLEAN_INTERVAL);
    });

})();
