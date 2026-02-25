// ==UserScript==
// @name         PONY D
// @version      2.6
// @description  ML based riddle master answering bot (Lightweight version without keep-alive mechanism)
// @homepage     https://6950695.xyz
// @include      http://hentaiverse.org/*
// @include      http://alt.hentaiverse.org/*
// @include      https://hentaiverse.org/*
// @include      https://alt.hentaiverse.org/*
// @compatible   Chrome/Chromium + Tampermonkey
// @connect      6950695.xyz
// @connect      localhost
// @grant        GM.xmlHttpRequest
// @grant        GM_notification
// @grant        GM.notification
// @run-at       document-end
// @namespace    https://greasyfork.org/users/756324
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置区 ====================
    const CONFIG = {
        API_URL: 'https://6950695.xyz',  // 主域名（HTTPS）
        API_KEY: '6Pq3Zx9Kj',
        DEFAULT_SUBMIT_DELAY: 5,         // 默认提交延迟（秒） - 现在仅作为最小延迟参考
        MIN_DELAY: 3000,                  // 最小延迟（毫秒）
        MAX_DELAY: 9000,                  // 最大延迟（毫秒）
        TIMEOUT: 10000,                  // 请求超时时间（毫秒）
        ENABLE_NOTIFICATION: 0,       // 是否启用通知
        CACHE_PRIORITY: true,            // 是否优先使用浏览器缓存
    };

    // 小马标签映射
    const PONY_MAP = {
        'aj': 5, 'fs': 2, 'pp': 4,
        'ra': 1, 'rd': 3, 'ts': 0
    };

    // ==================== API 兼容层 ====================

    /**
     * Tampermonkey API 兼容层
     * - Tampermonkey 4.x (2017+): GM.* (Promise-based API)
     * - Tampermonkey 3.x (旧版): GM_* (同步 API)
     *
     * 优先使用新 API，自动回退到旧 API
     */
    const gmCompat = {
        notification: typeof GM !== 'undefined' && GM.notification ? GM.notification : GM_notification,
        xmlHttpRequest: typeof GM !== 'undefined' && GM.xmlHttpRequest ? GM.xmlHttpRequest : GM_xmlHttpRequest
    };

    // ==================== 工具函数 ====================

    /**
     * 生成随机延迟（毫秒）
     * @returns {number} 随机延迟时间
     */
    function getRandomDelay() {
        return Math.random() * (CONFIG.MAX_DELAY - CONFIG.MIN_DELAY) + CONFIG.MIN_DELAY;
    }

    /**
     * 显示通知
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (INFO/ERROR/SUCCESS/WARNING)
     */
    function notify(message, type = 'INFO') {
        // 检查通知开关，只有配置为 true 时才通知
        if (!CONFIG.ENABLE_NOTIFICATION) {
            return;
        }

        const prefix = type === 'ERROR' ? '❌ '
                     : type === 'SUCCESS' ? '✅ '
                     : type === 'WARNING' ? '⚠️ '
                     : 'ℹ️ ';
        gmCompat.notification({
            text: prefix + message,
            title: 'DG PONY',
            timeout: 15000
        });
    }

    // ==================== 主要功能：识别小马 ====================

    /**
     * 处理识别响应
     */
    function handleDetectionResponse(response) {
        if (response.status === 401) {
            notify('Invalid API Key', 'ERROR');
            return;
        }

        if (response.status !== 200) {
            notify(`Server error: ${response.status}`, 'ERROR');
            return;
        }

        // 解析响应
        let result;
        try {
            result = JSON.parse(response.responseText);
        } catch (e) {
            notify('Failed to parse server response', 'ERROR');
            return;
        }

        // 处理业务逻辑
        if (result.return === 'good' && result.answer) {
            // /help2 API 格式：{"return": "good", "answer": "ts,aj,pp"}
            const answers = result.answer.split(',');
            if (selectPonyOptions(answers)) {
                const delay = getRandomDelay();
                submitAnswer(delay);
                notify(`Detected: ${answers.join(', ')}`, 'SUCCESS');
            }
        } else if (result.return === 'error') {
            notify(result.error || 'Unknown error', 'ERROR');
        } else {
            notify('Invalid response format', 'ERROR');
        }
    }

    /**
     * 发送图片到服务器进行识别
     * @param {Blob} imageBlob - 图片数据
     */
    function detectPony(imageBlob) {
        gmCompat.xmlHttpRequest({
            method: 'POST',
            timeout: CONFIG.TIMEOUT,
            url: `${CONFIG.API_URL}/help2`,
            onload: handleDetectionResponse,
            onerror: (response) => {
                // 网络错误：无法连接到服务器
                notify('Network error: Cannot reach server', 'ERROR');
            },
            ontimeout: () => {
                // 超时错误：服务器响应太慢
                notify('Timeout: Server response too slow', 'ERROR');
            },
            headers: {
                'Content-Type': 'image/jpeg',
                'apikey': CONFIG.API_KEY
            },
            data: imageBlob,
            binary: true
        });
    }

    // ==================== 缓存优先的图片获取 ====================

    /**
     * 从浏览器缓存获取图片（优先）
     * @param {string} imageUrl - 图片 URL
     * @returns {Promise<Blob|null>} 返回图片Blob或null
     */
    function fetchFromCache(imageUrl) {
        return new Promise((resolve, reject) => {
            if (!CONFIG.CACHE_PRIORITY) {
                resolve(null);
                return;
            }

            try {
                // 优先尝试从缓存获取（不发起网络请求）
                const cacheRequest = new Request(imageUrl, {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'only-if-cached',  // 只使用缓存
                    mode: 'same-origin'
                });

                fetch(cacheRequest).then(response => {
                    if (response.status === 200) {
                        // 缓存命中
                        console.log('[DG PONY] Cache hit');
                        response.blob().then(resolve).catch(reject);
                    } else {
                        // 缓存未命中
                        console.log('[DG PONY] Cache miss');
                        resolve(null);
                    }
                }).catch(() => {
                    // 缓存获取失败
                    console.log('[DG PONY] Cache fetch failed');
                    resolve(null);
                });
            } catch (error) {
                console.warn('[DG PONY] Cache API not available:', error);
                resolve(null);
            }
        });
    }

    /**
     * 从网络获取图片（降级方案）
     * @param {string} imageUrl - 图片 URL
     * @returns {Promise<Blob>} 返回图片Blob
     */
    function fetchFromNetwork(imageUrl) {
        return new Promise((resolve, reject) => {
            console.log('[DG PONY] Fetching from network');

            // 尝试强制使用缓存（允许网络回退）
            const networkRequest = new Request(imageUrl, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'force-cache',  // 强制使用缓存，但允许网络
                mode: 'same-origin'
            });

            fetch(networkRequest).then(response => {
                if (response.status === 200) {
                    response.blob().then(resolve).catch(reject);
                } else {
                    reject(new Error(`Failed to fetch image: HTTP ${response.status}`));
                }
            }).catch(error => {
                // 网络请求失败，降级到GM.xmlHttpRequest
                console.warn('[DG PONY] Fetch failed, using GM.xmlHttpRequest fallback');
                gmCompat.xmlHttpRequest({
                    method: 'GET',
                    url: imageUrl,
                    responseType: 'blob',
                    onload: function(response) {
                        if (response.status === 200) {
                            resolve(response.response);
                        } else {
                            reject(new Error(`Failed to fetch image: HTTP ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('Network error: Cannot load riddle image')),
                    ontimeout: () => reject(new Error('Timeout: Image fetch timeout'))
                });
            });
        });
    }

    /**
     * 获取谜题图片（缓存优先，降级网络）
     * @param {string} imageUrl - 图片 URL
     */
    function fetchRiddleImage(imageUrl) {
        // 1. 先尝试从缓存获取
        fetchFromCache(imageUrl).then(cachedBlob => {
            if (cachedBlob) {
                // 缓存命中，直接使用
                detectPony(cachedBlob);
            } else {
                // 缓存未命中，从网络获取
                fetchFromNetwork(imageUrl)
                    .then(networkBlob => {
                        detectPony(networkBlob);
                    })
                    .catch(error => {
                        notify(error.message || 'Failed to fetch image', 'ERROR');
                        console.error('[DG PONY]', error);
                    });
            }
        }).catch(error => {
            console.warn('[DG PONY] Cache fetch error:', error);
            // 缓存获取出错，降级到网络
            fetchFromNetwork(imageUrl)
                .then(networkBlob => {
                    detectPony(networkBlob);
                })
                .catch(error => {
                    notify(error.message || 'Failed to fetch image', 'ERROR');
                    console.error('[DG PONY]', error);
                });
        });
    }

    // ==================== 主要功能：选择答案 ====================

    /**
     * 选择小马选项
     * @param {Array} answers - 答案数组，如 ['ts', 'aj', 'pp']
     * @returns {boolean} 是否成功选择
     */
    function selectPonyOptions(answers) {
        const riddlerElement = document.getElementById('riddler1');
        if (!riddlerElement) {
            notify('Cannot find riddler element', 'ERROR');
            return false;
        }

        const optionBoxes = riddlerElement.children;
        // 检查选项数量：真实选项框恰好 6 个，多了说明是陷阱选项框
        if (optionBoxes.length !== 6) {
            notify(`Trap detected! Option count: ${optionBoxes.length} (expected 6)`, 'WARNING');
            return false;
        }

        // 选择对应的小马
        for (const answer of answers) {
            const trimmedAnswer = answer.trim().toLowerCase();
            const index = PONY_MAP[trimmedAnswer];

            if (index !== undefined && optionBoxes[index]) {
                const checkbox = optionBoxes[index].querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    // 触发 onchange 事件
                    if (checkbox.onchange) {
                        checkbox.onchange();
                    }
                }
            }
        }
        return true;
    }

    /**
     * 提交答案（使用随机延迟）
     * @param {number} delay - 延迟毫秒数
     */
    function submitAnswer(delay) {
        setTimeout(() => {
            const submitButton = document.getElementById('riddlesubmit');
            if (submitButton) {
                submitButton.click();
            } else {
                notify('Cannot find submit button', 'ERROR');
            }
        }, delay);
    }

    // ==================== 初始化 ====================

    /**
     * 检测谜题并开始识别
     */
    function detectRiddle() {
        const riddleImage = document.getElementById('riddleimage');
        if (!riddleImage || !riddleImage.childNodes[0]) {
            notify('Cannot find riddle image element', 'ERROR');
            return;
        }

        const imageUrl = riddleImage.childNodes[0].src;
        if (!imageUrl) {
            notify('Invalid riddle image URL', 'ERROR');
            return;
        }

        // 等待页面完全加载后再获取图片
        if (document.readyState === 'complete') {
            fetchRiddleImage(imageUrl);
        } else {
            window.addEventListener('load', () => {
                fetchRiddleImage(imageUrl);
            });
        }
    }

    /**
     * 脚本入口
     */
    function init() {
        // 检测是否存在谜题（简化检测逻辑，与 Reborn 保持一致）
        const riddleCounter = document.getElementById('riddlecounter');
        if (riddleCounter) {
            detectRiddle();
        }
    }

    // 启动脚本（确保在 DOM 加载完成后执行）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();