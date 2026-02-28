// ==UserScript==
// @name         HV MK  S
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  MK出售
// @match        *alt.hentaiverse.org/*
// @match        *hentaiverse.org/*
// @exclude      *alt.hentaiverse.org/equip/*
// @exclude      *hentaiverse.org/equip/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const pageParams = new URLSearchParams(window.location.search);
  const isBattlePage = pageParams.get("s") === "Battle";
  if (window.location.pathname.startsWith("/equip/")) {
    return;
  }

  const baseUrl = location.origin;
  const isIsekai = window.location.href.includes("/isekai/");
  const tabs = isIsekai ? ["co", "ma", "tr"] : ["co", "ma", "tr", "ar"];
  const basePath = isIsekai
    ? `${baseUrl}/isekai/?s=Bazaar&ss=mk`
    : `${baseUrl}/?s=Bazaar&ss=mk`;
  const localStoragename = isIsekai ? "hvimk_items" : "hvmk_items";
  const autoStateKey = isIsekai ? "hvimk_auto_sell_state" : "hvmk_auto_sell_state";
  const itemurl = isIsekai
    ? "isekai/?s=Bazaar&ss=mk&screen=browseitems"
    : "?s=Bazaar&ss=mk&screen=browseitems";
  const sellurl = isIsekai
    ? `${baseUrl}/isekai/?s=Bazaar&ss=mk&screen=sellorders&filter=`
    : `${baseUrl}/?s=Bazaar&ss=mk&screen=sellorders&filter=`;

  const noSellList = new Set([
    "Health Draught",
    "Health Potion",
    "Health Elixir",
    "Mana Draught",
    "Mana Potion",
    "Mana Elixir",
    "Spirit Draught",
    "Spirit Potion",
    "Spirit Elixir",
    "Last Elixir",
    'Featherweight Shard',
    "Scrap Cloth",
    "Scrap Leather",
    "Scrap Metal",
    "Scrap Wood",
    "Energy Cell",
    "Legendary Weapon Core",
    "Legendary Staff Core",
    "Legendary Armor Core",
  ]);

  const batch100NameList = new Set([
    "Health Draught",
    "Health Potion",
    "Health Elixir",
    "Mana Draught",
    "Mana Potion",
    "Mana Elixir",
    "Spirit Draught",
    "Spirit Potion",
    "Spirit Elixir",
    "Last Elixir",
    "Crystal of Vigor",
    "Crystal of Finesse",
    "Crystal of Swiftness",
    "Crystal of Fortitude",
    "Crystal of Cunning",
    "Crystal of Knowledge",
    "Crystal of Flames",
    "Crystal of Frost",
    "Crystal of Lightning",
    "Crystal of Tempest",
    "Crystal of Devotion",
    "Crystal of Corruption",
  ]);

  let itemdata = JSON.parse(localStorage.getItem(localStoragename) || "[]");
  let bidButtonRef = null;
  let askButtonRef = null;
  let cancelButtonRef = null;
  let autoAskCheckboxRef = null;
  let nextRunLabelRef = null;
  let runStatusLabelRef = null;
  let resumeTimeLabelRef = null;
  let interruptReasonLabelRef = null;
  const floatPositionKey = isIsekai ? "hvimk_float_position" : "hvmk_float_position";
  const floatOpenKey = isIsekai ? "hvimk_float_open" : "hvmk_float_open";
  const autoAskScheduleKey = "hvmk_auto_ask_schedule_global";
  const autoAskJobKey = "hvmk_auto_ask_job_state";
  const autoAskLockKey = "hvmk_auto_ask_job_lock";
  const autoAskLastInterruptKey = "hvmk_auto_ask_last_interrupt";
  const mainAutoStateKey = "hvmk_auto_sell_state";
  const isekaiAutoStateKey = "hvimk_auto_sell_state";
  const isekaiMkRootUrl = `${baseUrl}/isekai/?s=Bazaar&ss=mk`;
  const defaultBidLabel = "买价出售";
  const defaultAskLabel = "卖价出售";
  const defaultCancelLabel = "取消出售";
  const minAutoAskIntervalMs = 3 * 24 * 60 * 60 * 1000;
  const autoAskLockMs = 12 * 60 * 60 * 1000;

  if (isBattlePage) {
    handleInterruptionOnBattlePage();
    return;
  }

  if (isMkPageForDataSync()) {
    const translatebtn = document.getElementById("change-translate");
    if (translatebtn) {
      translatebtn.click();
    }

    const parsePrice = (str) => parseFloat(str?.replace(" C", "") || "0");
    const itemMap = new Map(itemdata.map((item) => [item.name, item]));
    const rows = document.querySelectorAll("tbody tr[onclick]");

    rows.forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length < 5) return;

      const name = cols[0].innerText.trim();
      const stock = parseFloat(cols[1].innerText.trim() || "0");
      const bid = parsePrice(cols[2].innerText.trim());
      const ask = parsePrice(cols[3].innerText.trim());
      const onclickAttr = row.getAttribute("onclick") || "";
      const linkMatch = onclickAttr.match(/filter=[a-z]+&itemid=\d+/);
      const link = linkMatch ? `&${linkMatch[0]}` : "";

      const newItem = { name, stock, bid, ask, link };

      if (itemMap.has(name)) {
        const existing = itemMap.get(name);
        existing.stock = stock;
        existing.bid = bid;
        existing.ask = ask;
        existing.link = link;
      } else {
        itemMap.set(name, newItem);
      }
    });

    const updatedItems = Array.from(itemMap.values());
    localStorage.setItem(localStoragename, JSON.stringify(updatedItems, null, 2));
  }

  itemdata = JSON.parse(localStorage.getItem(localStoragename) || "[]");

  const autoState = readAutoState();
  renderButtons();
  updateProgressLabel(autoState);
  updateScheduleUi(readAutoAskSchedule());
  finalizeScheduledReturnIfNeeded();
  resumeScheduledAutoAskJob(autoState);
  maybeRunScheduledAutoAsk(autoState);

  if (autoState?.running && autoState.world === (isIsekai ? "isekai" : "main")) {
    const currentFilter = getCurrentFilter();
    const currentIndex = tabs.indexOf(currentFilter);

    if (!isBrowseItemsPage() || currentIndex < 0) {
      if (tryDeferScheduledForOtherPage(autoState)) {
        return;
      }
      location.href = buildBrowseUrl(tabs[autoState.index || 0]);
    } else {
      if (currentIndex !== autoState.index) {
        autoState.index = currentIndex;
        writeAutoState(autoState);
      }
      runAutoSellOnPage(autoState, currentFilter, currentIndex).catch((err) => {
        console.error("自动出售出错:", err);
        clearAutoState();
      });
    }
  }

  function renderButtons() {
    const style = `
      #mk-auto-sell {
        position: fixed;
        bottom: 16px;
        left: 16px;
        z-index: 9999;
      }
      #mk-auto-sell .mk-float-ball {
        width: 52px;
        height: 52px;
        border: 1px solid #c9ced6;
        border-radius: 50%;
        background: #ffffff;
        color: #2f3640;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(16, 24, 40, 0.14);
        user-select: none;
      }
      #mk-auto-sell .mk-panel {
        position: absolute;
        left: 62px;
        top: 2px;
        display: none;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        background: #ffffff;
        border: 1px solid #c9ced6;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(16, 24, 40, 0.14);
        white-space: nowrap;
      }
      #mk-auto-sell.open .mk-panel {
        display: flex;
      }
      #mk-auto-sell .mk-button-row {
        display: flex;
        gap: 6px;
      }
      #mk-auto-sell .mk-panel button {
        padding: 6px 12px;
        background: #f7f8fa;
        border: 1px solid #d7dce3;
        border-radius: 6px;
        color: #2f3640;
        cursor: pointer;
      }
      #mk-auto-sell .mk-option-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #2f3640;
      }
      #mk-auto-sell .mk-mode-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: #5b6470;
      }
      #mk-auto-sell .mk-reset-cycle {
        margin-left: 6px;
        padding: 2px 8px;
        font-size: 12px;
        background: #f7f8fa;
        border: 1px solid #d7dce3;
        border-radius: 6px;
        color: #2f3640;
        cursor: pointer;
      }
      #mk-auto-sell .mk-next-run {
        font-size: 12px;
        color: #5b6470;
      }
      #mk-auto-sell .mk-run-status,
      #mk-auto-sell .mk-resume-time,
      #mk-auto-sell .mk-interrupt-reason {
        font-size: 12px;
        color: #5b6470;
      }
    `;

    const styleTag = document.createElement("style");
    styleTag.innerText = style;
    document.head.appendChild(styleTag);

    const container = document.createElement("div");
    container.id = "mk-auto-sell";

    const floatBall = document.createElement("button");
    floatBall.type = "button";
    floatBall.className = "mk-float-ball";
    floatBall.innerText = "出售";

    const panel = document.createElement("div");
    panel.className = "mk-panel";

    const buttonRow = document.createElement("div");
    buttonRow.className = "mk-button-row";

    const bidButton = document.createElement("button");
    bidButton.innerText = defaultBidLabel;

    const askButton = document.createElement("button");
    askButton.innerText = defaultAskLabel;

    const cancelButton = document.createElement("button");
    cancelButton.innerText = defaultCancelLabel;

    const optionRow = document.createElement("label");
    optionRow.className = "mk-option-row";
    const autoAskCheckbox = document.createElement("input");
    autoAskCheckbox.type = "checkbox";
    const optionText = document.createElement("span");
    optionText.innerText = "定期isk自动出售";
    const resetCycleButton = document.createElement("button");
    resetCycleButton.type = "button";
    resetCycleButton.className = "mk-reset-cycle";
    resetCycleButton.innerText = "重置周期";
    optionRow.appendChild(autoAskCheckbox);
    optionRow.appendChild(optionText);
    optionRow.appendChild(resetCycleButton);

    const modeRow = document.createElement("div");
    modeRow.className = "mk-mode-row";
    const modeLabel = document.createElement("span");
    modeLabel.innerText = "定期模式:";

    const bidModeLabel = document.createElement("label");
    const bidModeCheckbox = document.createElement("input");
    bidModeCheckbox.type = "checkbox";
    bidModeCheckbox.checked = false;
    bidModeLabel.appendChild(bidModeCheckbox);
    bidModeLabel.appendChild(document.createTextNode("买价出售"));

    const askModeLabel = document.createElement("label");
    const askModeCheckbox = document.createElement("input");
    askModeCheckbox.type = "checkbox";
    askModeCheckbox.checked = true;
    askModeLabel.appendChild(askModeCheckbox);
    askModeLabel.appendChild(document.createTextNode("卖价出售"));

    modeRow.appendChild(modeLabel);
    modeRow.appendChild(bidModeLabel);
    modeRow.appendChild(askModeLabel);

    const initialSchedule = readAutoAskSchedule();
    const initialMode = initialSchedule.mode === "bid" ? "bid" : "ask";
    bidModeCheckbox.checked = initialMode === "bid";
    askModeCheckbox.checked = initialMode === "ask";

    const nextRunLabel = document.createElement("div");
    nextRunLabel.className = "mk-next-run";
    nextRunLabel.innerText = "下轮出售: 未开启";

    const runStatusLabel = document.createElement("div");
    runStatusLabel.className = "mk-run-status";
    runStatusLabel.innerText = "运行状态: 待机";

    const resumeTimeLabel = document.createElement("div");
    resumeTimeLabel.className = "mk-resume-time";
    resumeTimeLabel.innerText = "恢复时间: -";

    const interruptReasonLabel = document.createElement("div");
    interruptReasonLabel.className = "mk-interrupt-reason";
    interruptReasonLabel.innerText = "最近中断原因: -";

    bidButton.onclick = () => startAutoSell("bid");
    askButton.onclick = () => startAutoSell("ask");
    cancelButton.onclick = () => cancelAutoSell();
    bidButtonRef = bidButton;
    askButtonRef = askButton;
    cancelButtonRef = cancelButton;
    autoAskCheckboxRef = autoAskCheckbox;
    nextRunLabelRef = nextRunLabel;
    runStatusLabelRef = runStatusLabel;
    resumeTimeLabelRef = resumeTimeLabel;
    interruptReasonLabelRef = interruptReasonLabel;

    autoAskCheckbox.onchange = () => {
      const schedule = readAutoAskSchedule();
      schedule.enabled = autoAskCheckbox.checked;

      if (schedule.enabled) {
        if (!Number.isFinite(schedule.nextRunAt) || schedule.nextRunAt <= Date.now()) {
          schedule.nextRunAt = buildNextAutoAskTime(schedule.lastRunAt);
        }
      } else {
        schedule.nextRunAt = null;
      }

      writeAutoAskSchedule(schedule);
      updateScheduleUi(schedule);
    };

    bidModeCheckbox.onchange = () => {
      if (!bidModeCheckbox.checked) {
        bidModeCheckbox.checked = true;
      }
      askModeCheckbox.checked = false;
      const schedule = readAutoAskSchedule();
      schedule.mode = "bid";
      writeAutoAskSchedule(schedule);
      updateScheduleUi(schedule);
    };

    askModeCheckbox.onchange = () => {
      if (!askModeCheckbox.checked) {
        askModeCheckbox.checked = true;
      }
      bidModeCheckbox.checked = false;
      const schedule = readAutoAskSchedule();
      schedule.mode = "ask";
      writeAutoAskSchedule(schedule);
      updateScheduleUi(schedule);
    };

    resetCycleButton.onclick = () => {
      const keepEnabled = autoAskCheckbox.checked;

      clearScheduledJob();
      releaseScheduledLock();
      clearAutoStateByKey(mainAutoStateKey);
      clearAutoStateByKey(isekaiAutoStateKey);
      localStorage.removeItem(autoAskLastInterruptKey);

      if (!keepEnabled) {
        localStorage.removeItem(autoAskScheduleKey);
        updateScheduleUi(readAutoAskSchedule());
        updateProgressLabel(null);
        return;
      }

      const resetSchedule = {
        enabled: true,
        nextRunAt: buildNextAutoAskTime(null),
        lastRunAt: null,
        mode: readAutoAskSchedule().mode === "bid" ? "bid" : "ask",
      };
      writeAutoAskSchedule(resetSchedule);
      updateScheduleUi(resetSchedule);
      updateProgressLabel(null);
    };

    const savedPosition = readFloatPosition();
    if (savedPosition) {
      applyFloatPosition(container, savedPosition);
    }
    if (readFloatOpenState()) {
      container.classList.add("open");
    }

    let dragState = null;

    const onPointerMove = (event) => {
      if (!dragState) return;

      const nextX = event.clientX - dragState.offsetX;
      const nextY = event.clientY - dragState.offsetY;
      const clamped = clampFloatPosition(nextX, nextY, container);
      applyFloatPosition(container, clamped);

      if (
        Math.abs(event.clientX - dragState.startX) > 4 ||
        Math.abs(event.clientY - dragState.startY) > 4
      ) {
        dragState.moved = true;
      }
    };

    const onPointerUp = (event) => {
      if (!dragState) return;

      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      const moved = dragState.moved;
      dragState = null;

      if (moved) {
        saveFloatPosition(container);
      } else {
        event.stopPropagation();
        const isOpen = container.classList.toggle("open");
        writeFloatOpenState(isOpen);
      }
    };

    floatBall.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = container.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });

    panel.onclick = (event) => {
      event.stopPropagation();
    };

    window.addEventListener("resize", () => {
      const rect = container.getBoundingClientRect();
      const clamped = clampFloatPosition(rect.left, rect.top, container);
      applyFloatPosition(container, clamped);
      saveFloatPosition(container);
    });

    buttonRow.appendChild(bidButton);
    buttonRow.appendChild(askButton);
    buttonRow.appendChild(cancelButton);
    panel.appendChild(buttonRow);
    panel.appendChild(optionRow);
    panel.appendChild(modeRow);
    panel.appendChild(nextRunLabel);
    panel.appendChild(runStatusLabel);
    panel.appendChild(resumeTimeLabel);
    panel.appendChild(interruptReasonLabel);
    container.appendChild(floatBall);
    container.appendChild(panel);
    document.body.appendChild(container);
  }

  function startAutoSell(mode, options = {}) {
    if (options.scheduledJobId) {
      markScheduledJobSelling(options.scheduledJobId);
    }

    const state = {
      running: true,
      mode,
      world: isIsekai ? "isekai" : "main",
      index: 0,
      currentFilter: tabs[0],
      pageDone: 0,
      pageTotal: 0,
      scheduledJobId: options.scheduledJobId || null,
      startedAt: Date.now(),
    };

    writeAutoState(state);
    location.href = buildBrowseUrl(tabs[0]);
  }

  async function runAutoSellOnPage(state, filter, index) {
    const sellData = await fetchSellData(filter);
    const itemsForFilter = itemdata.filter(
      (item) => item.link && item.link.includes(`filter=${filter}`) && isSellableItem(item.name),
    );

    updateItemsWithSellData(itemsForFilter, sellData, state.mode);

    const sellinglists = buildSellingList(itemsForFilter, state.mode);
    state.currentFilter = filter;
    state.pageDone = 0;
    state.pageTotal = sellinglists.length;
    writeAutoState(state);
    updateProgressLabel(state);

    if (sellinglists.length > 0) {
      for (let i = 0; i < sellinglists.length; i++) {
        if (!isAutoSellStillRunning(state)) {
          clearAutoState();
          return;
        }

        const item = sellinglists[i];
        const [name, stockStr, priceStr, itemlink, sellorder_update] = item.split(",");
        const stock = parseFloat(stockStr);
        const price = parseFloat(priceStr);
        const itemId = extractItemId(itemlink);
        if (!itemId) {
          continue;
        }

        const freshToken = await fetchFreshMarketToken(filter, itemId);
        if (!freshToken) {
          continue;
        }

        const hrefurl = itemurl + itemlink;
        const params = buildSellOrderParams(freshToken, stock, price, sellorder_update);
        await newpost(hrefurl, params);
        state.pageDone = i + 1;
        writeAutoState(state);
        updateProgressLabel(state);
        console.log(`${state.mode} 出售:`, name, stock, price, "token:", freshToken);

        await sleep(3000, 6000);

        if (!isAutoSellStillRunning(state)) {
          clearAutoState();
          return;
        }
      }
    }

    const nextIndex = index + 1;
    if (nextIndex >= tabs.length) {
      clearAutoState();
      return;
    }

    if (!isAutoSellStillRunning(state)) {
      clearAutoState();
      return;
    }

    state.index = nextIndex;
    writeAutoState(state);
    location.href = buildBrowseUrl(tabs[nextIndex]);
  }

  async function fetchSellData(filter) {
    const url = `${sellurl}${filter}`;
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const sellRows = doc.querySelectorAll("tbody tr[onclick]");
    const sellData = new Map();

    sellRows.forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length < 5) return;

      const name = cols[0].innerText.trim();
      const stock = parseFloat(cols[1].innerText.trim() || "0");
      const count = parseFloat(cols[2].innerText.trim() || "0");
      const price = parseFloat(cols[3].innerText.replace(" C", "") || "0");
      sellData.set(name, { stock, count, price });
    });

    return sellData;
  }

  function updateItemsWithSellData(items, sellData, mode) {
    items.forEach((item) => {
      const sellItem = sellData.get(item.name);
      if (!sellItem || !item.link) return;

      const newmode = mode === "ask" ? item.ask === sellItem.price : item.bid === sellItem.price;
      const tag = newmode ? "_X" : "_S";
      const allstock = sellItem.stock + sellItem.count;
      const baseLink = item.link.replace(/(_X|_S)\d+$/, "");
      const modifiedLink = `${baseLink}${tag}${sellItem.count}`;

      item.stock = allstock;
      item.link = modifiedLink;
    });
  }

  function buildSellingList(items, mode) {
    const result = [];

    items.forEach((item) => {
      if (!isSellableItem(item.name)) return;
      let name = item.name;
      let stock = item.stock;
      let bid = item.bid;
      let ask = item.ask;
      let link = item.link || "";

      let new_stock;
      let linkparts;
      let sellorder_update = "Place+Sell+Order";
      let shouldUpdate = true;
      let shouldChangePrice = true;
      let price = 0;
      const batch100 = isBatch100Item(item);

      if (mode === "bid") {
        price = bid;
        shouldChangePrice = false;
      } else if (mode === "ask") {
        price = ask;
      }

      if (batch100) {
        stock = Math.floor(stock / 100);
        price = Math.round(price * 100);
      }

      if (link.includes("_X")) {
        linkparts = link.split("_X");
        link = linkparts[0];
        new_stock = parseFloat(linkparts[1]);
        sellorder_update = "Update";

        if (batch100) {
          new_stock = Math.floor(new_stock / 100);
        }

        if (stock == new_stock) {
          shouldUpdate = false;
        } else {
          shouldChangePrice = false;
        }
      } else if (link.includes("_S")) {
        linkparts = link.split("_S");
        link = linkparts[0];
        sellorder_update = "Update";
      }

      if (price > 10 && shouldChangePrice) {
        price = new_price_step(price, -1);
      }

      if (stock > 0 && price >= 10 && shouldUpdate) {
        result.push(`${name},${stock},${price},${link},${sellorder_update}`);
      }
    });

    return result;
  }

  function sleep(minMs, maxMs) {
    const min = Math.max(0, minMs);
    const max = Math.max(min, maxMs ?? min);
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function newpost(href, parm, type) {
    return new Promise(function (resolve, reject) {
      if (window.MAIN_URL) href = window.MAIN_URL + href;

      var xhr = new window.XMLHttpRequest();

      xhr.open(parm ? "POST" : "GET", href);

      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

      xhr.responseType = type || "text";

      xhr.onload = function (e) {
        if (e.target.status >= 200 && e.target.status < 400) {
          resolve(e.target.response);
        } else {
          reject(e.target.status);
        }
      };

      xhr.onerror = function () {
        reject("network_error");
      };

      xhr.send(parm);
    });
  }

  function new_price_step(price, direction) {
    var stepval = price;
    var stepcur = 1;

    if (direction < 0) {
      while (stepval > 1000) {
        stepcur = stepcur * 10;
        stepval = stepval / 10;
      }
      if (stepval > 500) {
        stepcur = stepcur * 5;
      } else if (stepval > 200) {
        stepcur = stepcur * 2;
      }
    } else {
      while (stepval >= 1000) {
        stepcur = stepcur * 10;
        stepval = stepval / 10;
      }
      if (stepval >= 500) {
        stepcur = stepcur * 5;
      } else if (stepval >= 200) {
        stepcur = stepcur * 2;
      }
    }

    let new_price;

    if (direction > 0) {
      new_price = Math.min(100000000, Math.max(10, price + (stepcur - (price % stepcur))));
    } else if (direction < 0) {
      if (price <= 10) {
        new_price = 0;
      } else {
        var mod = price % stepcur;

        if (mod > 0) {
          new_price = Math.max(0, price - mod);
        } else {
          new_price = Math.max(0, price - stepcur);
        }
      }
    } else {
      new_price = price;
    }
    return new_price;
  }

  function isSellableItem(name) {
    if (!name) return false;
    if (noSellList.has(name)) return false;
    return true;
  }

  function isBatch100Item(item) {
    if (!item || !item.name) return false;
    const link = item.link || "";
    if (link.includes("filter=mo")) return true;
    if (batch100NameList.has(item.name)) return true;
    return false;
  }

  function buildBrowseUrl(filter) {
    return `${basePath}&screen=browseitems&filter=${filter}`;
  }

  function isMkPageForDataSync() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("s") !== "Bazaar" || params.get("ss") !== "mk") return false;

    const screen = params.get("screen");
    if (!screen) return true;
    if (screen !== "browseitems") return false;

    const filter = params.get("filter");
    return tabs.includes(filter);
  }

  function buildSellOrderParams(token, stock, price, action) {
    return new URLSearchParams({
      marketoken: String(token),
      sellorder_batchcount: String(stock),
      sellorder_batchprice: String(price),
      sellorder_update: String(action),
    }).toString();
  }

  function buildItemBrowseUrl(filter, itemId) {
    return `${basePath}&screen=browseitems&filter=${filter}&itemid=${itemId}`;
  }

  function extractItemId(itemlink) {
    const match = (itemlink || "").match(/itemid=(\d+)/);
    return match ? match[1] : null;
  }

  async function fetchFreshMarketToken(filter, itemId) {
    try {
      const res = await fetch(buildItemBrowseUrl(filter, itemId));
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const tokenNode = doc.querySelector('#market_itemsell input[name="marketoken"]');
      return tokenNode?.value || null;
    } catch (err) {
      return null;
    }
  }

  function getCurrentFilter() {
    const params = new URLSearchParams(window.location.search);
    return params.get("filter");
  }

  function isBrowseItemsPage() {
    const params = new URLSearchParams(window.location.search);
    return params.get("screen") === "browseitems";
  }

  function readAutoState() {
    try {
      return JSON.parse(localStorage.getItem(autoStateKey) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeAutoState(state) {
    localStorage.setItem(autoStateKey, JSON.stringify(state));
  }

  function clearAutoState() {
    const state = readAutoState();
    if (state?.scheduledJobId) {
      completeScheduledJobAndReturn(state.scheduledJobId);
    }
    localStorage.removeItem(autoStateKey);
    updateProgressLabel(null);
    finalizeScheduledReturnIfNeeded();
  }

  function cancelAutoSell() {
    const job = readScheduledJob();
    if (job?.id) {
      clearScheduledJob();
      releaseScheduledLock(job.id);
    }

    clearAutoStateByKey(mainAutoStateKey);
    clearAutoStateByKey(isekaiAutoStateKey);
    updateProgressLabel(null);
  }

  function readFloatPosition() {
    try {
      const pos = JSON.parse(localStorage.getItem(floatPositionKey) || "null");
      if (!pos) return null;
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
      return pos;
    } catch (err) {
      return null;
    }
  }

  function saveFloatPosition(container) {
    const rect = container.getBoundingClientRect();
    localStorage.setItem(
      floatPositionKey,
      JSON.stringify({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
      }),
    );
  }

  function readFloatOpenState() {
    try {
      return localStorage.getItem(floatOpenKey) === "1";
    } catch (err) {
      return false;
    }
  }

  function writeFloatOpenState(isOpen) {
    localStorage.setItem(floatOpenKey, isOpen ? "1" : "0");
  }

  function readAutoAskSchedule() {
    try {
      const raw = JSON.parse(localStorage.getItem(autoAskScheduleKey) || "null") || {};
      return {
        enabled: raw.enabled === true,
        nextRunAt: Number.isFinite(raw.nextRunAt) ? raw.nextRunAt : null,
        lastRunAt: Number.isFinite(raw.lastRunAt) ? raw.lastRunAt : null,
        mode: raw.mode === "bid" ? "bid" : "ask",
      };
    } catch (err) {
      return {
        enabled: false,
        nextRunAt: null,
        lastRunAt: null,
        mode: "ask",
      };
    }
  }

  function writeAutoAskSchedule(schedule) {
    localStorage.setItem(autoAskScheduleKey, JSON.stringify(schedule));
  }

  function maybeRunScheduledAutoAsk(autoState) {
    if (autoState?.running) return;
    if (isScheduledJobActive()) return;

    const schedule = readAutoAskSchedule();
    if (!schedule.enabled) return;

    const now = Date.now();
    if (!Number.isFinite(schedule.nextRunAt)) {
      schedule.nextRunAt = buildNextAutoAskTime(schedule.lastRunAt);
      writeAutoAskSchedule(schedule);
      updateScheduleUi(schedule);
      return;
    }

    if (schedule.nextRunAt > now) return;

    const jobId = `job_${now}_${randomInt(1000, 9999)}`;
    if (!acquireScheduledLock(jobId, now)) return;

    const safeOriginUrl = getSafeOriginUrl(window.location.href);
    if (!safeOriginUrl) {
      releaseScheduledLock(jobId);
      return;
    }

    const mode = schedule.mode === "bid" ? "bid" : "ask";

    writeScheduledJob({
      id: jobId,
      running: true,
      phase: "jumping",
      mode,
      originUrl: safeOriginUrl,
      returnPending: false,
      resumeAt: null,
      createdAt: now,
    });

    schedule.lastRunAt = now;
    schedule.nextRunAt = buildNextAutoAskTime(schedule.lastRunAt);
    writeAutoAskSchedule(schedule);
    updateScheduleUi(schedule);
    if (isIsekai) {
      startAutoSell(mode, { scheduledJobId: jobId });
      return;
    }

    location.href = isekaiMkRootUrl;
  }

  function resumeScheduledAutoAskJob(autoState) {
    const job = readScheduledJob();
    if (!job?.running) return;

    if (!isLockOwnedBy(job.id)) {
      clearScheduledJob();
      return;
    }

    if (Number.isFinite(job.resumeAt) && Date.now() < job.resumeAt) {
      return;
    }

    if (job.phase === "selling" && !isIsekaiMkPage()) {
      deferScheduledResume(job, 90 * 60 * 1000, 120 * 60 * 1000, "other_page");
      return;
    }

    if (!isIsekai) {
      if (window.location.href !== isekaiMkRootUrl) {
        location.href = isekaiMkRootUrl;
      }
      return;
    }

    if (autoState?.running) return;
    writeScheduledJob({
      ...job,
      phase: "selling",
      resumeAt: null,
    });
    startAutoSell(job.mode === "bid" ? "bid" : "ask", { scheduledJobId: job.id });
  }

  function isIsekaiMkPage() {
    if (!isIsekai) return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("s") === "Bazaar" && params.get("ss") === "mk";
  }

  function tryDeferScheduledForOtherPage(state) {
    if (!state?.scheduledJobId) return false;
    if (isIsekaiMkPage()) return false;

    const job = readScheduledJob();
    if (!job?.running) return false;
    if (job.id !== state.scheduledJobId) return false;

    deferScheduledResume(job, 90 * 60 * 1000, 120 * 60 * 1000, "other_page");
    return true;
  }

  function markScheduledJobSelling(jobId) {
    const job = readScheduledJob();
    if (!job?.running) return;
    if (job.id !== jobId) return;

    writeScheduledJob({
      ...job,
      phase: "selling",
      resumeAt: null,
      mode: job.mode === "bid" ? "bid" : "ask",
    });
  }

  function handleInterruptionOnBattlePage() {
    const job = readScheduledJob();
    if (!job?.running) return;
    if (job.phase !== "selling") return;
    if (!isLockOwnedBy(job.id)) {
      clearScheduledJob();
      return;
    }

    const isEncounterBattle = pageParams.get("ss") === "ba";
    if (isEncounterBattle) {
      deferScheduledResume(job, 3 * 60 * 1000, 4 * 60 * 1000, "battle_ba");
    } else {
      deferScheduledResume(job, 90 * 60 * 1000, 120 * 60 * 1000, "battle_other");
    }
  }

  function deferScheduledResume(job, minDelayMs, maxDelayMs, reason) {
    const now = Date.now();
    if (Number.isFinite(job.resumeAt) && job.resumeAt > now) {
      return;
    }

    const nextResumeAt = now + randomInt(minDelayMs, maxDelayMs);
    writeScheduledJob({
      ...job,
      phase: "selling",
      resumeAt: nextResumeAt,
      lastInterruptAt: now,
      lastInterruptReason: reason,
    });
    writeLastInterruptInfo(reason, now);

    clearAutoStateByKey(mainAutoStateKey);
    clearAutoStateByKey(isekaiAutoStateKey);
  }

  function clearAutoStateByKey(key) {
    localStorage.removeItem(key);
  }

  function writeLastInterruptInfo(reason, time) {
    localStorage.setItem(
      autoAskLastInterruptKey,
      JSON.stringify({
        reason,
        time,
      }),
    );
  }

  function readLastInterruptInfo() {
    try {
      return JSON.parse(localStorage.getItem(autoAskLastInterruptKey) || "null");
    } catch (err) {
      return null;
    }
  }

  function finalizeScheduledReturnIfNeeded() {
    const job = readScheduledJob();
    if (!job?.returnPending || !job.originUrl) return;

    const target = getSafeOriginUrl(job.originUrl);
    clearScheduledJob();
    releaseScheduledLock(job.id);
    if (!target) return;
    if (window.location.href === target) return;
    location.href = target;
  }

  function readScheduledJob() {
    try {
      return JSON.parse(localStorage.getItem(autoAskJobKey) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeScheduledJob(job) {
    localStorage.setItem(autoAskJobKey, JSON.stringify(job));
    updateScheduleUi(readAutoAskSchedule());
  }

  function clearScheduledJob() {
    localStorage.removeItem(autoAskJobKey);
    updateScheduleUi(readAutoAskSchedule());
  }

  function isScheduledJobActive() {
    const job = readScheduledJob();
    return job?.running === true;
  }

  function readScheduledLock() {
    try {
      return JSON.parse(localStorage.getItem(autoAskLockKey) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeScheduledLock(lock) {
    localStorage.setItem(autoAskLockKey, JSON.stringify(lock));
  }

  function isLockExpired(lock, now) {
    if (!lock || !Number.isFinite(lock.expiresAt)) return true;
    return lock.expiresAt <= now;
  }

  function acquireScheduledLock(jobId, now = Date.now()) {
    const lock = readScheduledLock();
    if (lock && !isLockExpired(lock, now)) {
      return false;
    }

    writeScheduledLock({
      owner: jobId,
      expiresAt: now + autoAskLockMs,
    });
    return true;
  }

  function isLockOwnedBy(jobId) {
    const lock = readScheduledLock();
    if (!lock) return false;
    if (isLockExpired(lock, Date.now())) return false;
    if (!jobId) return false;
    return lock.owner === jobId;
  }

  function releaseScheduledLock(jobId) {
    const lock = readScheduledLock();
    if (!lock) return;
    if (!jobId || lock.owner === jobId || isLockExpired(lock, Date.now())) {
      localStorage.removeItem(autoAskLockKey);
    }
  }

  function completeScheduledJobAndReturn(jobId) {
    const job = readScheduledJob();
    if (!job || job.id !== jobId || !job.running) {
      releaseScheduledLock(jobId);
      return;
    }

    const updated = {
      ...job,
      running: false,
      returnPending: true,
      finishedAt: Date.now(),
    };
    writeScheduledJob(updated);
  }

  function getSafeOriginUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.includes("?s=Battle") || url.includes("&s=Battle")) return null;
    return url;
  }

  function buildNextAutoAskTime(lastRunAt) {
    const now = Date.now();
    const base = Number.isFinite(lastRunAt) ? lastRunAt : now;
    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const minuteMs = 60 * 1000;
    const floor = Math.max(now, base + minAutoAskIntervalMs);

    const extraDays = randomInt(0, 7) * dayMs;
    const extraHours = randomInt(0, 71) * hourMs;
    const extraMinutes = randomInt(0, 180) * minuteMs;
    const extraSeconds = randomInt(0, 59) * 1000;
    const extraJitter = randomInt(0, 999);

    return floor + extraDays + extraHours + extraMinutes + extraSeconds + extraJitter;
  }

  function randomInt(min, max) {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  function updateScheduleUi(schedule) {
    if (
      !autoAskCheckboxRef ||
      !nextRunLabelRef ||
      !runStatusLabelRef ||
      !resumeTimeLabelRef ||
      !interruptReasonLabelRef
    ) {
      return;
    }
    autoAskCheckboxRef.checked = schedule?.enabled === true;

    const now = Date.now();
    const job = readScheduledJob();
    const lastInterrupt = readLastInterruptInfo();
    const hasResumeAt = Number.isFinite(job?.resumeAt) && job.resumeAt > now;

    if (job?.running) {
      if (hasResumeAt) {
        runStatusLabelRef.innerText = "运行状态: 中断";
        resumeTimeLabelRef.innerText = `恢复时间: ${formatDateTime(job.resumeAt)}`;
        interruptReasonLabelRef.innerText = `最近中断原因: ${formatInterruptReason(job.lastInterruptReason)}`;
      } else {
        runStatusLabelRef.innerText = "运行状态: 进行";
        resumeTimeLabelRef.innerText = "恢复时间: -";
        interruptReasonLabelRef.innerText = lastInterrupt?.reason
          ? `最近中断原因: ${formatInterruptReason(lastInterrupt.reason)}`
          : "最近中断原因: -";
      }
    } else {
      runStatusLabelRef.innerText = "运行状态: 待机";
      resumeTimeLabelRef.innerText = "恢复时间: -";
      interruptReasonLabelRef.innerText = lastInterrupt?.reason
        ? `最近中断原因: ${formatInterruptReason(lastInterrupt.reason)}`
        : "最近中断原因: -";
    }

    if (!schedule?.enabled) {
      nextRunLabelRef.innerText = "下轮出售: 未开启";
      return;
    }

    if (!Number.isFinite(schedule.nextRunAt)) {
      nextRunLabelRef.innerText = "下轮出售: 计划中";
      return;
    }

    nextRunLabelRef.innerText = `下轮出售: ${formatDateTime(schedule.nextRunAt)}`;
  }

  function formatInterruptReason(reason) {
    if (reason === "battle_ba") return "遭遇战(ba)";
    if (reason === "battle_other") return "其他战斗";
    if (reason === "other_page") return "离开异世界市场";
    return "未知";
  }

  function clampFloatPosition(x, y, container) {
    const margin = 8;
    const width = container.offsetWidth || 52;
    const height = container.offsetHeight || 52;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);

    return {
      x: Math.min(maxX, Math.max(margin, x)),
      y: Math.min(maxY, Math.max(margin, y)),
    };
  }

  function applyFloatPosition(container, position) {
    const clamped = clampFloatPosition(position.x, position.y, container);
    container.style.left = `${clamped.x}px`;
    container.style.top = `${clamped.y}px`;
    container.style.bottom = "auto";
  }

  function isAutoSellStillRunning(state) {
    const latest = readAutoState();
    if (!latest?.running) return false;
    if (latest.world !== state.world) return false;
    if (latest.startedAt !== state.startedAt) return false;
    if (latest.mode !== state.mode) return false;
    return true;
  }

  function updateProgressLabel(state) {
    if (!bidButtonRef || !askButtonRef || !cancelButtonRef) return;

    bidButtonRef.innerText = defaultBidLabel;
    askButtonRef.innerText = defaultAskLabel;
    cancelButtonRef.innerText = defaultCancelLabel;

    if (!state?.running) return;
    if (typeof state.pageDone !== "number" || typeof state.pageTotal !== "number") return;

    const text = `${state.pageDone}/${state.pageTotal}`;
    if (state.mode === "bid") {
      bidButtonRef.innerText = text;
    } else if (state.mode === "ask") {
      askButtonRef.innerText = text;
    }
  }
})();
