// ==UserScript==
// @name         HV自动平均加点
// @match        *://hentaiverse.org/*s=Character&ss=ch*
// @match        *://alt.hentaiverse.org/*s=Character&ss=ch*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

  
    const CONFIG = {
        delayBetweenClicks: 600,
        initialDelay: 3000,        
    };


    let autoMode = GM_getValue('autoMode', false);
    let timeoutId = null; 


    let allocateButton = null;
    let manualAllocateButton = null;

    GM_addStyle(`
        .auto-add-button {
            background-color: rgba(76, 175, 80, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            padding: 4px 8px;
            text-align: center;
            display: inline-block;
            font-size: 12px;
            cursor: pointer;
            z-index: 10000;
            position: fixed;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.2s;
        }
        .auto-add-button:hover {
            background-color: rgba(62, 142, 65, 0.95);
            transform: translateY(-1px);
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        }
        .auto-add-button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
    `);


    function isCorrectPage() {
        try {
            const bodyText = document.body.innerText;
            return bodyText.includes("当前角色:") || bodyText.includes("Active persona");
        } catch (error) {
            console.error('检查页面失败:', error);
            return false;
        }
    }

    function canClick(elementId) {
        try {
            const element = document.getElementById(elementId);
            return element && !element.src.includes('_d.png');
        } catch (error) {
            console.error(`检查按钮 ${elementId} 失败:`, error);
            return false;
        }
    }

    function getStatValue(statId) {
        try {
            const element = document.getElementById(statId + '_display');
            return element ? parseInt(element.innerText, 10) : NaN;
        } catch (error) {
            console.error(`获取属性 ${statId} 失败:`, error);
            return NaN;
        }
    }

    function clickButton(buttonId) {
        return new Promise((resolve, reject) => {
            try {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.click();
                    console.log(`已点击 ${buttonId}`);
                    setTimeout(resolve, CONFIG.delayBetweenClicks);
                } else {
                    reject(new Error(`找不到按钮: ${buttonId}`));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async function doAttributeAllocation() {
        try {
            const stats = [
                { id: 'str', value: getStatValue('str'), button: 'str_inc' },
                { id: 'dex', value: getStatValue('dex'), button: 'dex_inc' },
                { id: 'agi', value: getStatValue('agi'), button: 'agi_inc' },
                { id: 'end', value: getStatValue('end'), button: 'end_inc' },
                { id: 'int', value: getStatValue('int'), button: 'int_inc' },
                { id: 'wis', value: getStatValue('wis'), button: 'wis_inc' }
            ];

            let anyClicked = false;

     
            while (true) {
                const clickableStats = stats.filter(stat => canClick(stat.button));

                if (clickableStats.length === 0) {
                    break;
                }

                clickableStats.sort((a, b) => a.value - b.value);
                const lowestStat = clickableStats[0];

                await clickButton(lowestStat.button);
                anyClicked = true;

                stats.forEach(stat => {
                    stat.value = getStatValue(stat.id);
                });
            }

            if (anyClicked) {
                const applyButton = document.querySelector('img[onclick="do_attr_post()"]');
                if (applyButton) {
                    applyButton.click();
                    console.log('✓ 已点击应用按钮');
                } else {
                    console.warn('⚠ 找不到应用按钮');
                }
            } else {
                console.log('ℹ 没有可增加的属性');
            }
        } catch (error) {
            console.error('❌ 加点过程出错:', error);
        }
    }


    function needsAllocation() {
        try {
            const remainingExpElement = document.getElementById('remaining_exp');
            if (remainingExpElement) {
                const remainingExp = parseInt(remainingExpElement.innerText.replace(/,/g, ''), 10);
                return remainingExp > 0;
            }
            return false;
        } catch (error) {
            console.error('检查是否需要加点失败:', error);
            return false;
        }
    }


    function autoAllocate() {
        try {
            if (needsAllocation()) {
                console.log('🔄 执行自动加点...');
                doAttributeAllocation();
            } else {
                console.log('ℹ 无需自动加点');
            }
        } catch (error) {
            console.error('❌ 自动加点失败:', error);
        }
    }

    function toggleAutoMode() {
        autoMode = !autoMode;
        GM_setValue('autoMode', autoMode);
        updateButtonText();

        // 清除之前的定时器（防止重复执行）
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        if (autoMode) {
            console.log('✓ 自动模式已开启，将在 ' + (CONFIG.initialDelay / 1000) + ' 秒后执行');
            timeoutId = setTimeout(() => {
                autoAllocate();
                timeoutId = null; // 执行后清空
            }, CONFIG.initialDelay);
        } else {
            console.log('✓ 自动模式已关闭');
        }
    }


    function updateButtonText() {
        if (allocateButton) {
            allocateButton.textContent = autoMode ? '自动已开启' : '自动已关闭';
        }
    }


    function createButtons() {
    
        allocateButton = document.createElement('button');
        allocateButton.classList.add('auto-add-button');
        allocateButton.textContent = autoMode ? '自动已开启' : '自动已关闭';
        allocateButton.style.top = '300px';
        allocateButton.style.left = '10px';
        allocateButton.onclick = toggleAutoMode;
        document.body.appendChild(allocateButton);

   
        manualAllocateButton = document.createElement('button');
        manualAllocateButton.classList.add('auto-add-button');
        manualAllocateButton.textContent = '手动加点';
        manualAllocateButton.style.top = '330px';
        manualAllocateButton.style.left = '10px';
        manualAllocateButton.onclick = doAttributeAllocation;
        document.body.appendChild(manualAllocateButton);

        console.log('✓ 按钮已创建');
    }


    function initialize() {
        if (!isCorrectPage()) {
            console.log('ℹ 页面不包含角色信息，脚本未启动');
            return;
        }

      
        createButtons();

     
        if (autoMode) {
            console.log('✓ 检测到自动模式已开启，将在 ' + (CONFIG.initialDelay / 1000) + ' 秒后执行');
            timeoutId = setTimeout(() => {
                autoAllocate();
                timeoutId = null; // 执行后清空
            }, CONFIG.initialDelay);
        }

        console.log('✓ HV自动平均加点脚本已启动');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
