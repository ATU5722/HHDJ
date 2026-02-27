// ==UserScript==
// @name         hv-toolbox
// @namespace    hv-toolbox
// @version      3.0.0
// @description  Modular HV toolbox with skill auto-upgrade module.
// @match        https://hentaiverse.org/*
// @exclude      https://hentaiverse.org/?s=Battle*
// @exclude      https://hentaiverse.org/isekai/?s=Battle*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const STORE_KEYS = {
    ui: "hv_toolbox_ui_state"
  };

  const Toolbox = {
    modules: new Map(),
    ui: null,

    register(module) {
      this.modules.set(module.id, module);
    },

    init() {
      if (isBattlePage()) return;
      this.ui = createFloatingUi(this);
      for (const mod of this.modules.values()) {
        if (mod.resume) mod.resume(this.makeCtx(mod.id));
      }
      this.ui.refresh();
    },

    makeCtx(moduleId) {
      return {
        moduleId,
        store: createModuleStore(moduleId),
        router: createRouter(),
        refreshUi: () => this.ui && this.ui.refresh()
      };
    },

    startModule(moduleId) {
      const mod = this.modules.get(moduleId);
      if (!mod) return;
      ensureEnglishUi();
      const ctx = this.makeCtx(moduleId);
      if (mod.start) mod.start(ctx);
      this.ui.refresh();
    },

    stopModule(moduleId) {
      const mod = this.modules.get(moduleId);
      if (!mod) return;
      const ctx = this.makeCtx(moduleId);
      if (mod.stop) mod.stop(ctx);
      this.ui.refresh();
    }
  };

  function createModuleStore(moduleId) {
    const key = `hv_toolbox_module_${moduleId}`;
    return {
      read() {
        try {
          return JSON.parse(localStorage.getItem(key) || "null") || {};
        } catch {
          return {};
        }
      },
      write(state) {
        localStorage.setItem(key, JSON.stringify(state));
      }
    };
  }

  function ensureEnglishUi() {
    const toggle = document.getElementById("change-translate");
    if (!toggle) return;
    const txt = (toggle.textContent || "").trim();
    if (txt === "英") toggle.click();
  }

  function createRouter() {
    return {
      getWorld() {
        return location.pathname.startsWith("/isekai/") ? "isekai" : "main";
      },
      isAbilityPage() {
        const url = new URL(location.href);
        return url.searchParams.get("s") === "Character" && url.searchParams.get("ss") === "ab";
      },
      isCharacterPage() {
        const url = new URL(location.href);
        return url.searchParams.get("s") === "Character" && url.searchParams.get("ss") === "ch";
      },
      isEquipPage() {
        const url = new URL(location.href);
        return url.searchParams.get("s") === "Character" && url.searchParams.get("ss") === "eq";
      },
      getEquipSlot() {
        const v = new URL(location.href).searchParams.get("equip_slot");
        return v ? Number(v) : null;
      },
      getAbilityTree() {
        return new URL(location.href).searchParams.get("tree") || "general";
      },
      goAbilityTree(tree) {
        const url = new URL(location.href);
        url.searchParams.set("s", "Character");
        url.searchParams.set("ss", "ab");
        if (tree === "general") url.searchParams.delete("tree");
        else url.searchParams.set("tree", tree);
        location.href = url.toString();
      },
      goCharacterPage(world) {
        location.href = world === "isekai"
          ? `${location.origin}/isekai/?s=Character&ss=ch`
          : `${location.origin}/?s=Character&ss=ch`;
      },
      goEquipPage(world, slotId) {
        const base = world === "isekai"
          ? `${location.origin}/isekai/?s=Character&ss=eq`
          : `${location.origin}/?s=Character&ss=eq`;
        location.href = slotId ? `${base}&equip_slot=${slotId}` : base;
      }
    };
  }

  function isBattlePage() {
    const s = new URL(location.href).searchParams.get("s") || "";
    return s === "Battle";
  }

  function createFloatingUi(toolbox) {
    const root = document.createElement("div");
    root.id = "hvtb";
    root.innerHTML = [
      "<button id='hvtb-ball' type='button'>TB</button>",
      "<div id='hvtb-panel'>",
      "  <div id='hvtb-modules'></div>",
      "</div>"
    ].join("");
    document.body.appendChild(root);

    const style = document.createElement("style");
    style.textContent = [
      "#hvtb{position:fixed;left:14px;top:14px;z-index:99999;font:12px/1.4 sans-serif;}",
      "#hvtb-ball{width:44px;height:44px;border:1px solid #d6d9df;border-radius:50%;background:#fff;color:#1f2937;cursor:pointer;}",
      "#hvtb-panel{display:none;position:absolute;left:52px;top:0;min-width:260px;padding:8px;background:#fff;border:1px solid #d6d9df;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.14);}",
      "#hvtb.open #hvtb-panel{display:block;}",
      "#hvtb-modules{display:flex;flex-direction:column;gap:6px;}",
      ".hvtb-row{display:flex;align-items:center;gap:6px;}",
      ".hvtb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".hvtb-status{color:#6b7280;}",
      ".hvtb-btn{padding:3px 8px;border:1px solid #d6d9df;background:#f8f9fb;border-radius:6px;cursor:pointer;}"
    ].join("");
    document.head.appendChild(style);

    const ball = root.querySelector("#hvtb-ball");
    const modulesEl = root.querySelector("#hvtb-modules");

    applySavedPosition();

    let dragging = false;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    ball.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      suppressClick = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = root.offsetLeft;
      startTop = root.offsetTop;
      ball.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    ball.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick = true;
      const nextLeft = clamp(startLeft + dx, 0, Math.max(0, window.innerWidth - root.offsetWidth));
      const nextTop = clamp(startTop + dy, 0, Math.max(0, window.innerHeight - root.offsetHeight));
      root.style.left = `${nextLeft}px`;
      root.style.top = `${nextTop}px`;
    });

    ball.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      ball.releasePointerCapture(e.pointerId);
      savePosition();
    });

    ball.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const open = !root.classList.contains("open");
      root.classList.toggle("open", open);
      const st = readUiState();
      writeUiState({ ...st, open });
      if (open) refresh();
    });

    const savedUi = readUiState();
    if (savedUi.open) root.classList.add("open");

    function refresh() {
      modulesEl.innerHTML = "";
      for (const mod of toolbox.modules.values()) {
        const ctx = toolbox.makeCtx(mod.id);
        const row = document.createElement("div");
        row.className = "hvtb-row";
        const running = mod.isRunning && mod.isRunning(ctx);
        const status = mod.getStatus ? mod.getStatus(ctx) : (running ? "运行中" : "空闲");
        row.innerHTML = [
          `<div class='hvtb-name'>${escapeHtml(mod.name)}</div>`,
          `<div class='hvtb-status'>${escapeHtml(status)}</div>`,
          `<button class='hvtb-btn' type='button'>${running ? "停止" : "启动"}</button>`
        ].join("");
        row.querySelector("button").addEventListener("click", () => {
          if (running) toolbox.stopModule(mod.id);
          else toolbox.startModule(mod.id);
        });
        modulesEl.appendChild(row);
      }
    }

    function applySavedPosition() {
      const st = readUiState();
      const defaultTop = Math.max(14, window.innerHeight - 58);
      const left = Number.isFinite(st.left) ? st.left : 14;
      const top = Number.isFinite(st.top) ? st.top : defaultTop;
      root.style.left = `${clamp(left, 0, Math.max(0, window.innerWidth - 44))}px`;
      root.style.top = `${clamp(top, 0, Math.max(0, window.innerHeight - 44))}px`;
    }

    function savePosition() {
      const st = readUiState();
      writeUiState({
        ...st,
        left: root.offsetLeft,
        top: root.offsetTop
      });
    }

    return { refresh };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readUiState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEYS.ui) || "null") || { open: false };
    } catch {
      return { open: false };
    }
  }

  function writeUiState(next) {
    localStorage.setItem(STORE_KEYS.ui, JSON.stringify(next));
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const SkillModule = {
    id: "skill-auto-upgrade",
    name: "自动技能",
    stateVersion: 1,
    timer: null,
    plan: [
      { tree: "general", skills: [{ id: 1101, targetTier: 10, equip: true }, { id: 1102, targetTier: 10, equip: true }, { id: 1103, targetTier: 10, equip: true }, { id: 1104, targetTier: 5, equip: true }, { id: 1105, targetTier: 5, equip: true }, { id: 1106, targetTier: 5, equip: true }] },
      { tree: "onehanded", skills: [{ id: 2101, targetTier: 3, equip: true }, { id: 2102, targetTier: 2, equip: true }, { id: 2103, targetTier: 1, equip: true }] },
      { tree: "heavy", skills: [{ id: 3301, targetTier: 3, equip: true }, { id: 3302, targetTier: 3, equip: true }, { id: 3303, targetTier: 3, equip: true }, { id: 3304, targetTier: 7, equip: true }] },
      { tree: "deprecating1", skills: [{ id: 4201, targetTier: 5, equip: true }, { id: 4202, targetTier: 3, equip: true }, { id: 4203, targetTier: 5, equip: true }, { id: 4204, targetTier: 3, equip: true }, { id: 4207, targetTier: 3, equip: true }] },
      { tree: "deprecating2", skills: [{ id: 4211, targetTier: 3, equip: true }] },
      { tree: "supportive1", skills: [{ id: 4102, targetTier: 5, equip: true }, { id: 4103, targetTier: 5, equip: true }, { id: 4105, targetTier: 5, equip: true }, { id: 4106, targetTier: 7, equip: true }, { id: 4108, targetTier: 10, equip: true }, { id: 4109, targetTier: 3, equip: true }] },
      { tree: "supportive2", skills: [{ id: 4110, targetTier: 3, equip: true }, { id: 4101, targetTier: 5, equip: true }, { id: 4111, targetTier: 5, equip: true, forceSlotId: 301 }] }
    ],

    flattenPlan() {
      const list = [];
      for (const group of this.plan) {
        for (const s of group.skills) {
          list.push({
            key: `${group.tree}::${s.id}`,
            tree: group.tree,
            id: Number(s.id),
            targetTier: Number(s.targetTier),
            equip: !!s.equip,
            forceSlotId: s.forceSlotId ? Number(s.forceSlotId) : null
          });
        }
      }
      return list;
    },

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      const st = ctx.store.read();
      if (!st.running) return "空闲";
      const order = this.flattenPlan();
      const pending = order.filter((x) => (st.status || {})[x.key] === "pending").length;
      return `运行中(${pending})`;
    },

    start(ctx) {
      const order = this.flattenPlan();
      const status = {};
      for (const t of order) status[t.key] = "pending";
      ctx.store.write({ version: this.stateVersion, running: true, status, resumeAfter: 0 });
      this.scheduleRun(ctx, 30);
      ctx.refreshUi();
    },

    stop(ctx) {
      const st = ctx.store.read();
      st.running = false;
      ctx.store.write(st);
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      ctx.refreshUi();
    },

    resume(ctx) {
      const st = ctx.store.read();
      if (!st.running) return;
      st.resumeAfter = Date.now() + 1000 + Math.floor(Math.random() * 3001);
      ctx.store.write(st);
      this.scheduleRun(ctx, st.resumeAfter - Date.now());
    },

    tick() {
      return false;
    },

    scheduleRun(ctx, delayMs) {
      const delay = Math.max(0, Number(delayMs) || 0);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx);
      }, delay);
    },

    runOnce(ctx) {
      const actionTaken = this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, 100);
      }
      ctx.refreshUi();
    },

    runStep(ctx) {
      const st = ctx.store.read();
      if (!st.running) return false;
      if ((st.resumeAfter || 0) > Date.now()) return false;

      const order = this.flattenPlan();
      const pending = order.filter((x) => (st.status || {})[x.key] === "pending");
      if (pending.length === 0) {
        st.running = false;
        ctx.store.write(st);
        return false;
      }

      if (!ctx.router.isAbilityPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goAbilityTree(pending[0].tree);
        return true;
      }

      const tree = ctx.router.getAbilityTree();
      const inTree = pending.filter((x) => x.tree === tree);
      if (inTree.length === 0) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goAbilityTree(pending[0].tree);
        return true;
      }

      const mp = readMasteryPoints();
      for (const task of inTree) {
        const ab = findAbilityById(task.id);
        if (!ab) {
          st.status[task.key] = "skipped";
          ctx.store.write(st);
          continue;
        }

        const tier = readTier(ab.card, task.id);
        if (tier < task.targetTier) {
          if (submitUpgrade(ab.card, task.id)) {
            st.resumeAfter = nextResumeAt();
            ctx.store.write(st);
            return true;
          }
          if (!isAbilityUnlocked(ab.card)) {
            st.status[task.key] = "skipped";
            ctx.store.write(st);
            continue;
          }
        }

        if (!task.equip) {
          st.status[task.key] = "done";
          ctx.store.write(st);
          continue;
        }

        const slots = readSlots(ab.color);
        if (isEquipped(slots.unlocked, ab.spriteKey)) {
          st.status[task.key] = "done";
          ctx.store.write(st);
          continue;
        }

        const empty = task.forceSlotId
          ? slots.unlocked.find((s) => s.id === task.forceSlotId && !s.occupied)
          : slots.unlocked.find((s) => !s.occupied);
        if (empty) {
          if (submitEquip(task.id, empty.id)) {
            st.resumeAfter = nextResumeAt();
            ctx.store.write(st);
            return true;
          }
          st.status[task.key] = "skipped";
          ctx.store.write(st);
          continue;
        }

        const locked = task.forceSlotId ? slots.locked.find((s) => s.id === task.forceSlotId) : slots.locked[0];
        if (!locked) {
          st.status[task.key] = "skipped";
          ctx.store.write(st);
          continue;
        }

        if (mp >= locked.cost && submitUnlock(locked.id)) {
          st.resumeAfter = nextResumeAt();
          ctx.store.write(st);
          return true;
        }
        st.status[task.key] = "skipped";
        ctx.store.write(st);
      }

      return false;
    }
  };

  function readMasteryPoints() {
    const top = document.getElementById("ability_top");
    if (!top) return 0;
    const vals = [];
    const nodes = top.querySelectorAll(".fc4 > div");
    for (const n of nodes) {
      const m = (n.textContent || "").match(/(\d+)/);
      if (m) vals.push(Number(m[1]));
    }
    return vals[1] || 0;
  }

  function findAbilityById(id) {
    const icon = document.getElementById(`slot_${id}`);
    if (!icon) return null;
    const card = icon.closest("#ability_treepane > div > div");
    if (!card) return null;
    return {
      card,
      color: readColor(card),
      spriteKey: `${icon.style.backgroundImage || ""}|${icon.style.backgroundPosition || ""}`
    };
  }

  function readColor(card) {
    const s = card.querySelector(".ability_slotbox > div")?.getAttribute("style") || "";
    if (s.includes("/ab/ru.png") || s.includes("/ab/rl.png")) return "red";
    if (s.includes("/ab/gu.png") || s.includes("/ab/gl.png")) return "green";
    if (s.includes("/ab/bu.png") || s.includes("/ab/bl.png")) return "blue";
    if (s.includes("/ab/pu.png") || s.includes("/ab/pl.png")) return "purple";
    return null;
  }

  function readTier(card, abilityId) {
    const hvutBars = card.querySelectorAll(".hvut-ab-bar");
    if (hvutBars.length > 0) {
      let tier = 0;
      for (const b of hvutBars) {
        const s = (b.getAttribute("style") || "").toLowerCase();
        if (!s.includes("x.png")) tier += 1;
      }
      return tier;
    }

    const legacyRow = findLegacyAwRow(card);
    if (legacyRow) {
      const dots = legacyRow.querySelectorAll("div");
      let tier = 0;
      for (const d of dots) {
        const s = (d.getAttribute("style") || "").toLowerCase();
        if (s.includes("f.png")) tier += 1;
      }
      return tier;
    }

    if (abilityId) {
      const globalRow = document.querySelector(`[onclick*='do_unlock_ability(${abilityId})']`);
      if (globalRow) {
        const dots = globalRow.querySelectorAll("div");
        let tier = 0;
        for (const d of dots) {
          const s = (d.getAttribute("style") || "").toLowerCase();
          if (s.includes("f.png")) tier += 1;
        }
        return tier;
      }
    }

    return 0;
  }

  function highestUnlockButton(card, abilityId) {
    const abilityName = getAbilityNameById(abilityId) || getAbilityName(card);

    const global = Array.from(document.querySelectorAll("[data-action='unlock']"));
    if (abilityName && global.length > 0) {
      const byName = global.filter((x) => (x.getAttribute("data-name") || "") === abilityName);
      if (byName.length > 0) return pickHighest(byName);
    }

    const inCard = Array.from(card.querySelectorAll("[data-action='unlock']"));
    if (inCard.length > 0) return pickHighest(inCard);

    const byId = global.filter((x) => Number(x.getAttribute("data-id") || "0") === Number(abilityId));
    if (byId.length > 0) return pickHighest(byId);

    const byAbilityInCard = card.querySelector(`[onclick*='do_unlock_ability(${abilityId})']`) || findLegacyAwRow(card);
    if (byAbilityInCard) return byAbilityInCard;

    const byAbilityGlobal = document.querySelector(`[onclick*='do_unlock_ability(${abilityId})']`);
    if (byAbilityGlobal) return byAbilityGlobal;

    const legacyButton = card.querySelector("[class^='aw'][onclick*='do_unlock_ability']");
    if (legacyButton) return legacyButton;

    return null;
  }

  function findLegacyAwRow(card) {
    const nodes = card.querySelectorAll("div");
    for (const node of nodes) {
      const cls = node.className || "";
      if (/\baw\d+\b/.test(cls)) return node;
    }
    return null;
  }

  function getAbilityName(card) {
    return (card.querySelector(".fc2 > div")?.textContent || "").trim();
  }

  function getAbilityNameById(abilityId) {
    const icon = document.getElementById(`slot_${abilityId}`);
    if (!icon) return "";
    const text = icon.getAttribute("onmouseover") || "";
    const m = text.match(/overability\([^,]+,\s*'([^']+)'/);
    return m ? m[1] : "";
  }

  function pickHighest(buttons) {
    buttons.sort((a, b) => Number(b.getAttribute("data-to") || "0") - Number(a.getAttribute("data-to") || "0"));
    return buttons[0] || null;
  }

  function submitUpgrade(card, abilityId) {
    const btn = highestUnlockButton(card, abilityId);
    if (!btn) return false;
    btn.click();
    return true;
  }

  function isAbilityUnlocked(card) {
    const icon = card.querySelector("[id^='slot_']");
    if (!icon) return false;
    const onclick = icon.getAttribute("onclick") || "";
    return onclick.includes("do_equip_ability") || icon.getAttribute("draggable") === "true";
  }

  function readSlots(color) {
    const ranges = {
      red: [101, 127],
      green: [201, 227],
      blue: [301, 301],
      purple: [401, 401]
    };
    const range = ranges[color];
    if (!range) return { unlocked: [], locked: [] };

    const all = [];
    for (let id = range[0]; id <= range[1]; id += 1) {
      const slot = document.getElementById(`slot_${id}`);
      if (!slot) continue;
      const holder = slot.parentElement;
      const title = holder?.getAttribute("title") || "";
      const unlocked = !!holder?.getAttribute("ondrop");
      const occupied = !(slot.style.backgroundImage || "").includes("/t/0.png");
      const costMatch = title.match(/Unlock Cost:\s*(\d+)\s*Mastery Point/i);
      const cost = costMatch ? Number(costMatch[1]) : 0;
      all.push({ id, slot, unlocked, occupied, cost });
    }
    return { unlocked: all.filter((x) => x.unlocked), locked: all.filter((x) => !x.unlocked) };
  }

  function isEquipped(slots, abilitySpriteKey) {
    return slots.some((s) => s.occupied && `${s.slot.style.backgroundImage || ""}|${s.slot.style.backgroundPosition || ""}` === abilitySpriteKey);
  }

  function submitUnlock(slotId) {
    const input = document.getElementById("unlock_slot");
    const form = document.getElementById("form_unlockslot");
    if (!input || !form) return false;
    input.value = String(slotId);
    form.submit();
    return true;
  }

  function submitEquip(abilityId, slotId) {
    const ab = document.getElementById("equip_ability");
    const slot = document.getElementById("equip_slot");
    const form = document.getElementById("form_equipslot");
    if (!ab || !slot || !form) return false;
    ab.value = String(abilityId);
    slot.value = String(slotId);
    form.submit();
    return true;
  }

  function nextResumeAt() {
    return Date.now() + 1000 + Math.floor(Math.random() * 3001);
  }

  const AutoStatModule = {
    id: "auto-stat",
    name: "自动加点",
    timer: null,
    delayBetweenClicks: 600,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      return this.isRunning(ctx) ? "执行中" : "空闲";
    },

    start(ctx) {
      ctx.store.write({ running: true, resumeAfter: 0 });
      this.scheduleRun(ctx, 20);
      ctx.refreshUi();
    },

    stop(ctx) {
      const st = ctx.store.read();
      st.running = false;
      ctx.store.write(st);
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      ctx.refreshUi();
    },

    resume(ctx) {
      const st = ctx.store.read();
      if (!st.running) return;
      this.scheduleRun(ctx, Math.max(0, (st.resumeAfter || 0) - Date.now()));
    },

    tick() {
      return false;
    },

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx);
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      ensureEnglishUi();
      const st = ctx.store.read();
      if (!st.running) return;
      if ((st.resumeAfter || 0) > Date.now()) {
        this.scheduleRun(ctx, (st.resumeAfter || 0) - Date.now());
        return;
      }

      const world = ctx.router.getWorld();
      if (!ctx.router.isCharacterPage()) {
        st.resumeAfter = Date.now() + 1200;
        ctx.store.write(st);
        ctx.router.goCharacterPage(world);
        return;
      }

      const done = await this.allocateOnce(ctx);
      if (done) {
        const fin = ctx.store.read();
        fin.running = false;
        fin.resumeAfter = 0;
        ctx.store.write(fin);
        ctx.refreshUi();
      } else {
        this.scheduleRun(ctx, 100);
      }
    },

    async allocateOnce(ctx) {
      const st = ctx.store.read();
      if (!st.running) return true;

      const stats = [
        { id: "str", button: "str_inc" },
        { id: "dex", button: "dex_inc" },
        { id: "agi", button: "agi_inc" },
        { id: "end", button: "end_inc" },
        { id: "int", button: "int_inc" },
        { id: "wis", button: "wis_inc" }
      ];

      let anyClicked = false;
      while (true) {
        const nowState = ctx.store.read();
        if (!nowState.running) return true;
        const clickable = stats
          .map((s) => ({ ...s, value: readStatValue(s.id) }))
          .filter((s) => Number.isFinite(s.value) && canClickStatButton(s.button));
        if (clickable.length === 0) break;

        clickable.sort((a, b) => a.value - b.value);
        const lowest = clickable[0];
        const btn = document.getElementById(lowest.button);
        if (!btn) break;
        btn.click();
        anyClicked = true;
        await sleep(this.delayBetweenClicks);
      }

      if (!anyClicked) return true;

      const applyButton = document.querySelector('img[onclick="do_attr_post()"]');
      if (applyButton) {
        applyButton.click();
      }
      return true;
    }
  };

  const AutoEquipModule = {
    id: "auto-equip",
    name: "自动换装",
    timer: null,
    slotOrder: [1, 2, 13, 11, 14, 12, 15],

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      const st = ctx.store.read();
      if (!st.running) return "空闲";
      const idx = Number(st.index || 0);
      return `执行中(${Math.min(idx + 1, this.slotOrder.length)}/${this.slotOrder.length})`;
    },

    start(ctx) {
      ctx.store.write({ running: true, world: ctx.router.getWorld(), index: 0, resumeAfter: 0 });
      this.scheduleRun(ctx, 20);
      ctx.refreshUi();
    },

    stop(ctx) {
      const st = ctx.store.read();
      st.running = false;
      ctx.store.write(st);
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      ctx.refreshUi();
    },

    resume(ctx) {
      const st = ctx.store.read();
      if (!st.running) return;
      this.scheduleRun(ctx, Math.max(0, (st.resumeAfter || 0) - Date.now()));
    },

    tick() {
      return false;
    },

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx);
      }, Math.max(0, Number(delayMs) || 0));
    },

    runOnce(ctx) {
      ensureEnglishUi();
      const actionTaken = this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, 100);
      }
      ctx.refreshUi();
    },

    runStep(ctx) {
      const st = ctx.store.read();
      if (!st.running) return false;
      if ((st.resumeAfter || 0) > Date.now()) return false;

      const index = Number(st.index || 0);
      if (index >= this.slotOrder.length) {
        st.running = false;
        ctx.store.write(st);
        return false;
      }

      const world = st.world || ctx.router.getWorld();
      const targetSlot = this.slotOrder[index];

      if (!ctx.router.isEquipPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goEquipPage(world, null);
        return true;
      }

      const currentSlot = ctx.router.getEquipSlot();
      if (currentSlot !== targetSlot) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goEquipPage(world, targetSlot);
        return true;
      }

      const best = pickBestEquipRow(targetSlot);
      if (!best) {
        st.index = index + 1;
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        const nextSlot = this.slotOrder[st.index];
        if (typeof nextSlot === "number") {
          ctx.router.goEquipPage(world, nextSlot);
          return true;
        }
        st.running = false;
        ctx.store.write(st);
        return false;
      }

      if (!selectEquipRow(best.row)) {
        st.index = index + 1;
        ctx.store.write(st);
        return false;
      }

      const submitBtn = document.getElementById("equipsubmit");
      if (!submitBtn || submitBtn.disabled) {
        st.index = index + 1;
        ctx.store.write(st);
        return false;
      }

      st.index = index + 1;
      st.resumeAfter = nextResumeAt();
      ctx.store.write(st);
      submitBtn.click();
      return true;
    }
  };

  function readStatValue(statId) {
    const el = document.getElementById(`${statId}_display`);
    if (!el) return NaN;
    const n = Number((el.textContent || "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function canClickStatButton(buttonId) {
    const el = document.getElementById(buttonId);
    if (!el) return false;
    const src = (el.getAttribute("src") || "").toLowerCase();
    if (src.includes("_d.png")) return false;
    return true;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pickBestEquipRow(slotId) {
    const rows = Array.from(document.querySelectorAll("#equiplist tr[onclick*='select_equip']"));
    if (rows.length === 0) return null;

    let bestRow = null;
    let bestName = "";
    let bestScore = -Infinity;

    for (const row of rows) {
      const name = extractEquipName(row);
      if (!name) continue;
      const score = scoreEquipName(name, slotId);
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
        bestName = name;
      }
    }

    if (!bestRow) return null;
    return { row: bestRow, score: bestScore, name: bestName };
  }

  function extractEquipName(row) {
    const label = row.querySelector("label");
    if (!label) return "";
    return (label.textContent || "").replace(/\s+/g, " ").trim();
  }

  function scoreEquipName(name, slotId) {
    void slotId;
    const n = name.toLowerCase();
    const tokens = new Set((n.match(/[a-z]+/g) || []));
    let score = 0;

    const rules = [
      ["peerless", 2000],
      ["legendary", 1500],
      ["magnificent", 1000],
      ["exquisite", 600],
      ["superior", 350],
      ["slaughter", 500],
      ["balance", 400],
      ["focus", 250],
      ["nimble", 250],
      ["battlecaster", 250],
      ["arcanist", 200],
      ["rapier", 500],
      ["shortsword", 300],
      ["dagger", 200],
      ["wakizashi", 200],
      ["axe", 50],
      ["kite", 2000],
      ["tower", 2000],
      ["buckler", 1500],
      ["force", 1600],
      ["phase", -3000],
      ["protection", 250],
      ["warding", -100],
      ["barrier", 500],
      ["power", 500],
      ["reactive", 500],
      ["plate", 200]
    ];

    for (const [keyword, value] of rules) {
      if (tokens.has(keyword)) score += value;
    }

    return score;
  }

  function selectEquipRow(row) {
    const cb = row.querySelector("input[name='eqids[]']");
    if (!cb) return false;
    const all = document.querySelectorAll("#equiplist input[name='eqids[]']");
    for (const item of all) item.checked = false;
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof update_selected_count === "function") update_selected_count();
    return true;
  }

  Toolbox.register(AutoStatModule);
  Toolbox.register(AutoEquipModule);
  Toolbox.register(SkillModule);
  Toolbox.init();
})();
