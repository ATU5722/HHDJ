// ==UserScript==
// @name         HV MK  S
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  MK出售
// @match        *alt.hentaiverse.org/isekai/?s=Bazaar&ss=mk*
// @match        *alt.hentaiverse.org/?s=Bazaar&ss=mk*
// @match        *hentaiverse.org/isekai/?s=Bazaar&ss=mk*
// @match        *hentaiverse.org/?s=Bazaar&ss=mk*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const baseUrl = location.origin;
  const isIsekai = window.location.href.includes("/isekai/");
  const tabs = isIsekai ? ["co", "ma", "tr"] : ["co", "ma", "tr", "ar", "mo"];
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
  const allowedPaths = new Set([basePath, ...tabs.map((tab) => `${basePath}&screen=browseitems&filter=${tab}`)]);

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

  let itemdata = JSON.parse(localStorage.getItem(localStoragename) || "[]");

  if (allowedPaths.has(window.location.href)) {
    const translatebtn = document.getElementById("change-translate");
    if (translatebtn) {
      translatebtn.click();
    }

    const parsePrice = (str) => parseFloat(str?.replace(" C", "") || "0", 10);
    const itemMap = new Map(itemdata.map((item) => [item.name, item]));
    const rows = document.querySelectorAll("tbody tr[onclick]");

    rows.forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length < 5) return;

      const name = cols[0].innerText.trim();
      const stock = parseFloat(cols[1].innerText.trim() || "0", 10);
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

  if (autoState?.running && autoState.world === (isIsekai ? "isekai" : "main")) {
    const currentFilter = getCurrentFilter();
    const currentIndex = tabs.indexOf(currentFilter);

    if (!isBrowseItemsPage() || currentIndex < 0) {
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
      #mk-auto-sell { position: fixed; bottom: 10px; left: 10px; background: #fff; border: 1px solid #ccc; border-radius: 8px; z-index: 9999; padding: 8px; box-shadow: 0 0 8px #aaa; }
      #mk-auto-sell button { padding: 6px 12px; margin: 0 4px; background: transparent; }
    `;

    const styleTag = document.createElement("style");
    styleTag.innerText = style;
    document.head.appendChild(styleTag);

    const container = document.createElement("div");
    container.id = "mk-auto-sell";

    const bidButton = document.createElement("button");
    bidButton.innerText = "买价出售";
    bidButton.style.color = "#5cb85c";

    const askButton = document.createElement("button");
    askButton.innerText = "卖价出售";
    askButton.style.color = "#f0ad4e";

    bidButton.onclick = () => startAutoSell("bid");
    askButton.onclick = () => startAutoSell("ask");

    container.appendChild(bidButton);
    container.appendChild(askButton);
    document.body.appendChild(container);
  }

  function startAutoSell(mode) {
    const state = {
      running: true,
      mode,
      world: isIsekai ? "isekai" : "main",
      index: 0,
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
    if (sellinglists.length > 0) {
      const mktoken = document.querySelector('input[name="marketoken"]');
      if (mktoken) {
        for (let i = 0; i < sellinglists.length; i++) {
          const item = sellinglists[i];
          const [name, stockStr, priceStr, itemlink, sellorder_update] = item.split(",");
          const stock = parseFloat(stockStr, 10);
          const price = parseFloat(priceStr, 10);
          const hrefurl = itemurl + itemlink;
          const params =
            "marketoken=" +
            mktoken.value +
            "&sellorder_batchcount=" +
            stock +
            "&sellorder_batchprice=" +
            price +
            "&sellorder_update=" +
            sellorder_update;
          newpost(hrefurl, params);
          console.log(`${state.mode} 出售:`, name, stock, price);

          await sleep(5000, 12000);
        }
      } else {
        alert("未找到 marketoken");
        clearAutoState();
        return;
      }
    }

    const nextIndex = index + 1;
    if (nextIndex >= tabs.length) {
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
      const stock = parseFloat(cols[1].innerText.trim() || "0", 10);
      const count = parseFloat(cols[2].innerText.trim() || "0", 10);
      const price = parseFloat(cols[3].innerText.replace(" C", "") || "0", 10);
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

      if (mode === "bid") {
        price = bid;
        shouldChangePrice = false;
      } else if (mode === "ask") {
        price = ask;
      }

      if (link.includes("_X")) {
        linkparts = link.split("_X");
        link = linkparts[0];
        new_stock = linkparts[1];
        sellorder_update = "Update";

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

  function gE(ele, mode, parent) {
    if (typeof ele === "object") {
      return ele;
    } else if (mode === undefined && parent === undefined) {
      return isNaN(ele * 1) ? document.querySelector(ele) : document.getElementById(ele);
    } else if (mode === "all") {
      return parent === undefined ? document.querySelectorAll(ele) : parent.querySelectorAll(ele);
    } else if (typeof mode === "object" && parent === undefined) {
      return mode.querySelector(ele);
    }
  }

  function newpost(href, parm, type) {
    return new Promise(function (resolve, reject) {
      if (window.MAIN_URL) href = window.MAIN_URL + href;

      var xhr = new window.XMLHttpRequest();

      xhr.open(parm ? "POST" : "GET", href);

      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

      xhr.responseType = type || "document";

      xhr.onload = function (e) {
        if (e.target.status >= 200 && e.target.status < 400) {
          var data = e.target.response;

          if (xhr.responseType === "document" && gE("#messagebox_outer", data)) {
            if (gE("#messagebox_outer")) {
              gE("#mainpane").replaceChild(gE("#messagebox_outer", data), gE("#messagebox_outer"));
            } else {
              gE("#mainpane").appendChild(gE("#messagebox_outer", data));
            }
          }

          resolve(data);
        } else {
          reject(e.target.status);
        }
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

  function runSelfTest() {
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    noSellList.forEach((name) => {
      assert(!isSellableItem(name), `${name} 应该被排除出售`);
    });
    assert(isSellableItem("Any Item"), "禁售名单之外应允许出售");
  }

  if (false) {
    runSelfTest();
  }

  function buildBrowseUrl(filter) {
    return `${basePath}&screen=browseitems&filter=${filter}`;
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
    localStorage.removeItem(autoStateKey);
  }
})();
