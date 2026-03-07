// ==UserScript==
// @name         HVTB
// @namespace    HVTB
// @version      3.0.1
// @description  Modular HV toolbox with skill auto-upgrade module.
// @match        https://hentaiverse.org/*
// @exclude      https://hentaiverse.org/equip/*
// @exclude      https://hentaiverse.org/isekai/equip/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const STORE_KEYS = {
    ui: "hv_toolbox_ui_state",
    sequence: "hv_toolbox_sequence_state"
  };

  const SEQUENCE_QUEUE = [
    "auto-stat",
    "skill-auto-upgrade",
    "auto-equip",
    "auto-arena",
    "auto-tower"
  ];

  const Toolbox = {
    modules: new Map(),
    ui: null,
    sequenceTimer: null,

    register(module) {
      this.modules.set(module.id, module);
    },

    init() {
      if (isBattlePage()) return;
      this.ui = createFloatingUi(this);
      for (const mod of this.modules.values()) {
        if (mod.resume) mod.resume(this.makeCtx(mod.id));
      }
      this.resumeSequence();
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
      return this.startModuleInternal(moduleId, { fromSequence: false, silent: false });
    },

    startModuleInternal(moduleId, options) {
      const mod = this.modules.get(moduleId);
      if (!mod) return false;
      const opt = options || {};
      const runningId = this.getRunningModuleId();
      if (runningId && runningId !== moduleId) {
        if (!opt.silent) alert("已有模块在运行，请先等待或停止当前模块。");
        return false;
      }
      if (!opt.fromSequence && this.isSequenceRunning()) {
        if (!opt.silent) alert("一键启动进行中，不能手动启动其他模块。");
        return false;
      }
      ensureEnglishUi();
      const ctx = this.makeCtx(moduleId);
      if (mod.start) mod.start(ctx, opt);
      this.ui.refresh();
      if (this.isSequenceRunning()) this.scheduleSequenceTick(80);
      return true;
    },

    stopModule(moduleId) {
      const mod = this.modules.get(moduleId);
      if (!mod) return false;
      const ctx = this.makeCtx(moduleId);
      if (mod.stop) mod.stop(ctx);
      this.ui.refresh();
      if (this.isSequenceRunning()) this.scheduleSequenceTick(80);
      return true;
    },

    getRunningModuleId() {
      for (const mod of this.modules.values()) {
        const ctx = this.makeCtx(mod.id);
        if (mod.isRunning && mod.isRunning(ctx)) return mod.id;
      }
      return "";
    },

    isSequenceRunning() {
      return !!readSequenceState().running;
    },

    toggleSequence() {
      if (this.isSequenceRunning()) this.stopSequence();
      else this.startSequence();
      this.ui.refresh();
    },

    startSequence() {
      const runningId = this.getRunningModuleId();
      if (runningId) {
        alert("已有模块在运行，无法一键启动。");
        return;
      }
      writeSequenceState({
        running: true,
        index: 0,
        activeModuleId: "",
        loopArena: true,
        towerDone: false,
        queue: SEQUENCE_QUEUE.slice()
      });
      this.scheduleSequenceTick(20);
    },

    stopSequence() {
      if (this.sequenceTimer) {
        clearTimeout(this.sequenceTimer);
        this.sequenceTimer = null;
      }
      const st = readSequenceState();
      const runningId = this.getRunningModuleId();
      writeSequenceState({
        running: false,
        index: Number(st.index || 0),
        activeModuleId: "",
        loopArena: !!st.loopArena,
        towerDone: !!st.towerDone,
        queue: Array.isArray(st.queue) && st.queue.length > 0 ? st.queue : SEQUENCE_QUEUE.slice()
      });
      if (runningId) this.stopModule(runningId);
    },

    resumeSequence() {
      if (!this.isSequenceRunning()) return;
      this.scheduleSequenceTick(120);
    },

    scheduleSequenceTick(delayMs) {
      if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
      this.sequenceTimer = setTimeout(() => {
        this.sequenceTimer = null;
        this.runSequenceStep();
      }, Math.max(0, Number(delayMs) || 0));
    },

    runSequenceStep() {
      const st = readSequenceState();
      if (!st.running) return;

      const queue = Array.isArray(st.queue) && st.queue.length > 0 ? st.queue : SEQUENCE_QUEUE.slice();
      let index = Number(st.index || 0);
      let activeModuleId = st.activeModuleId || "";
      const loopArena = !!st.loopArena;
      let towerDone = !!st.towerDone;
      const runningId = this.getRunningModuleId();

      if (activeModuleId) {
        if (runningId === activeModuleId) {
          this.scheduleSequenceTick(800);
          return;
        }
        if (!runningId) {
          if (activeModuleId === "auto-tower") {
            const towerState = this.makeCtx("auto-tower").store.read();
            if (towerState.lastCycleResult === "finished") towerDone = true;
          }
          index += 1;
          activeModuleId = "";
          writeSequenceState({ running: true, index, activeModuleId, loopArena, towerDone, queue });
        } else {
          this.scheduleSequenceTick(800);
          return;
        }
      }

      if (index >= queue.length) {
        if (loopArena) {
          const arenaModule = this.modules.get("auto-arena");
          const arenaState = this.makeCtx("auto-arena").store.read();
          const minStamina = Number.isFinite(Number(arenaModule?.minStamina))
            ? Number(arenaModule.minStamina)
            : 75;
          const liveStamina = readStaminaValue();
          const cachedStamina = Number(arenaState.lastStamina);
          const stamina = Number.isFinite(liveStamina)
            ? liveStamina
            : (Number.isFinite(cachedStamina) ? cachedStamina : NaN);
          const keepLooping = Number.isFinite(stamina)
            ? stamina > minStamina
            : arenaState.lastCycleResult === "started";
          if (keepLooping) {
            writeSequenceState({ running: true, index: 0, activeModuleId: "", loopArena, towerDone, queue });
            this.scheduleSequenceTick(800);
            if (this.ui) this.ui.refresh();
            return;
          }
        }
        writeSequenceState({ running: false, index, activeModuleId: "", loopArena, towerDone, queue });
        if (this.ui) this.ui.refresh();
        return;
      }

      if (runningId) {
        this.scheduleSequenceTick(800);
        return;
      }

      const nextId = queue[index];
      if (nextId === "auto-tower" && towerDone) {
        writeSequenceState({ running: true, index: index + 1, activeModuleId: "", loopArena, towerDone, queue });
        this.scheduleSequenceTick(80);
        if (this.ui) this.ui.refresh();
        return;
      }
      if (!this.modules.has(nextId)) {
        writeSequenceState({ running: true, index: index + 1, activeModuleId: "", loopArena, towerDone, queue });
        this.scheduleSequenceTick(80);
        if (this.ui) this.ui.refresh();
        return;
      }

      const started = this.startModuleInternal(nextId, { fromSequence: true, silent: true, sequenceMode: true });
      if (!started) {
        writeSequenceState({ running: true, index: index + 1, activeModuleId: "", loopArena, towerDone, queue });
        this.scheduleSequenceTick(80);
      } else {
        writeSequenceState({ running: true, index, activeModuleId: nextId, loopArena, towerDone, queue });
        this.scheduleSequenceTick(800);
      }
      if (this.ui) this.ui.refresh();
    }
  };

  function readSequenceState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEYS.sequence) || "null") || {
        running: false,
        index: 0,
        activeModuleId: "",
        loopArena: false,
        towerDone: false,
        queue: SEQUENCE_QUEUE.slice()
      };
    } catch {
      return {
        running: false,
        index: 0,
        activeModuleId: "",
        loopArena: false,
        towerDone: false,
        queue: SEQUENCE_QUEUE.slice()
      };
    }
  }

  function writeSequenceState(next) {
    localStorage.setItem(STORE_KEYS.sequence, JSON.stringify(next));
  }

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
      isTowerPage() {
        const url = new URL(location.href);
        if (url.pathname !== "/isekai/") return false;
        if (url.searchParams.get("s") !== "Battle") return false;
        if (document.getElementById("towerstart")) return true;
        return !!document.querySelector("#towerstart img[onclick*='init_battle(1)']");
      },
      isArenaPage() {
        const url = new URL(location.href);
        if (url.pathname !== "/isekai/") return false;
        return url.searchParams.get("s") === "Battle" && url.searchParams.get("ss") === "ar";
      },
      isOtherBattleSubPage() {
        const url = new URL(location.href);
        if (url.searchParams.get("s") !== "Battle") return false;
        return (url.searchParams.get("ss") || "") !== "ar";
      },
      isMonsterLabPage() {
        const url = new URL(location.href);
        return url.searchParams.get("s") === "Bazaar" && url.searchParams.get("ss") === "ml";
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
      },
      goTowerPage() {
        const menuUrl = readTowerMenuUrl();
        if (menuUrl) {
          location.href = menuUrl;
          return;
        }
        location.href = `${location.origin}/isekai/?s=Battle&ss=to`;
      },
      goArenaPage() {
        location.href = `${location.origin}/isekai/?s=Battle&ss=ar`;
      },
      goMonsterLabPage() {
        location.href = `${location.origin}/?s=Bazaar&ss=ml`;
      }
    };
  }

  function readTowerMenuUrl() {
    const nodes = document.querySelectorAll("#child_Battle [onclick*='document.location']");
    for (const node of nodes) {
      const label = (node.textContent || "").toLowerCase();
      if (!label.includes("tower")) continue;
      const onclick = node.getAttribute("onclick") || "";
      const m = onclick.match(/document\.location='([^']+)'/);
      if (!m || !m[1]) continue;
      return m[1];
    }
    return "";
  }

  function isBattlePage() {
    return !!document.querySelector("#riddlecounter, #textlog");
  }

  function createFloatingUi(toolbox) {
    const root = document.createElement("div");
    root.id = "hvtb";
    root.innerHTML = [
      "<button id='hvtb-ball' type='button'>TB</button>",
      "<div id='hvtb-panel'>",
      "  <div id='hvtb-tabs'>",
       "    <button class='hvtb-tab' data-tab='startup' type='button'>开荒</button>",
       "    <button class='hvtb-tab' data-tab='monster' type='button'>怪物</button>",
       "    <button class='hvtb-tab' data-tab='sell' type='button'>出售</button>",
       "    <button class='hvtb-tab' data-tab='report' type='button'>汇报</button>",
       "  </div>",
      "  <div class='hvtb-page' data-page='startup'>",
      "    <div id='hvtb-modules'></div>",
      "    <div id='hvtb-actions'></div>",
      "  </div>",
      "  <div class='hvtb-page' data-page='monster'>",
      "    <div id='hvtb-monster-modules'></div>",
      "  </div>",
       "  <div class='hvtb-page' data-page='sell'>",
       "    <div id='hvtb-sell-modules'></div>",
       "    <div id='hvtb-sell-extra'></div>",
       "  </div>",
       "  <div class='hvtb-page' data-page='report'>",
       "    <div id='hvtb-report-modules'></div>",
       "    <div id='hvtb-report-extra'></div>",
       "  </div>",
       "</div>"
     ].join("");
    document.body.appendChild(root);

    const style = document.createElement("style");
    style.textContent = [
      "#hvtb{position:fixed;left:14px;top:14px;z-index:99999;font:12px/1.4 sans-serif;}",
      "#hvtb-ball{width:44px;height:44px;border:1px solid #d6d9df;border-radius:50%;background:#fff;color:#1f2937;cursor:pointer;}",
      "#hvtb-panel{display:none;position:absolute;left:52px;top:0;min-width:320px;padding:8px;background:#fff;border:1px solid #d6d9df;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.14);}",
      "#hvtb.open #hvtb-panel{display:grid;grid-template-columns:62px minmax(0,1fr);column-gap:8px;align-items:start;}",
      "#hvtb-tabs{display:flex;flex-direction:column;gap:6px;}",
      ".hvtb-tab{height:32px;padding:0 4px;border:1px solid #d6d9df;background:#f6f7f9;color:#1f2937;border-radius:8px;cursor:pointer;text-align:center;font-weight:600;line-height:1.1;font-size:12px;}",
      ".hvtb-tab.active{background:#ffffff;border-color:#111827;color:#111827;box-shadow:inset 0 0 0 1px #111827;}",
      ".hvtb-page{display:none;grid-column:2;background:#fbfcfd;border:1px solid #e5e7eb;border-radius:10px;padding:8px;min-width:0;}",
      ".hvtb-page.active{display:block;}",
      "#hvtb-modules{display:flex;flex-direction:column;gap:6px;}",
       "#hvtb-monster-modules{display:flex;flex-direction:column;gap:6px;}",
       "#hvtb-sell-modules{display:flex;flex-direction:column;gap:6px;}",
       "#hvtb-sell-extra{display:flex;flex-direction:column;gap:8px;margin-top:8px;}",
       "#hvtb-report-modules{display:flex;flex-direction:column;gap:6px;}",
       "#hvtb-report-extra{display:flex;flex-direction:column;gap:8px;}",
       "#hvtb-actions{display:flex;justify-content:flex-end;margin-top:8px;}",
      ".hvtb-row{display:flex;align-items:center;gap:6px;}",
      ".hvtb-name{flex:1;min-width:0;display:flex;align-items:center;gap:4px;}",
      ".hvtb-name-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".hvtb-opt{margin:0;flex:0 0 auto;}",
      ".hvtb-status{color:#6b7280;}",
      ".hvtb-btn{padding:3px 8px;border:1px solid #d6d9df;background:#f8f9fb;border-radius:6px;cursor:pointer;}",
      ".hvtb-sell-card{border:1px solid #d7dce3;border-radius:8px;background:#fff;padding:8px;}",
      ".hvtb-sell-buttons{display:flex;gap:6px;}",
       ".hvtb-sell-row{display:flex;align-items:center;gap:8px;font-size:12px;color:#4b5563;}",
       ".hvtb-sell-status{font-size:12px;color:#5b6470;}",
       ".hvtb-sell-title{font-size:12px;font-weight:700;color:#374151;}",
       ".hvtb-input{height:24px;padding:0 6px;border:1px solid #d6d9df;border-radius:6px;background:#fff;color:#1f2937;min-width:0;}",
       ".hvtb-grow{flex:1;min-width:0;}"
     ].join("");
    document.head.appendChild(style);

    const ball = root.querySelector("#hvtb-ball");
    const startupModulesEl = root.querySelector("#hvtb-modules");
    const startupActionsEl = root.querySelector("#hvtb-actions");
    const monsterModulesEl = root.querySelector("#hvtb-monster-modules");
    const sellModulesEl = root.querySelector("#hvtb-sell-modules");
    const sellExtraEl = root.querySelector("#hvtb-sell-extra");
    const reportModulesEl = root.querySelector("#hvtb-report-modules");
    const reportExtraEl = root.querySelector("#hvtb-report-extra");
    const tabEls = Array.from(root.querySelectorAll(".hvtb-tab"));
    const pageEls = Array.from(root.querySelectorAll(".hvtb-page"));

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

    for (const tabEl of tabEls) {
      tabEl.addEventListener("click", () => {
        const tab = tabEl.getAttribute("data-tab") || "startup";
        const st = readUiState();
        writeUiState({ ...st, tab });
        refresh();
      });
    }

    function refresh() {
      const st = readUiState();
      const tab = ["startup", "monster", "sell", "report"].includes(st.tab) ? st.tab : "startup";
      for (const tabEl of tabEls) {
        tabEl.classList.toggle("active", tabEl.getAttribute("data-tab") === tab);
      }
      for (const pageEl of pageEls) {
        pageEl.classList.toggle("active", pageEl.getAttribute("data-page") === tab);
      }

      if (tab !== "startup") {
        startupActionsEl.innerHTML = "";
      }

      renderModuleRows(startupModulesEl, "startup");
      renderModuleRows(monsterModulesEl, "monster");
      renderModuleRows(sellModulesEl, "sell");
      renderModuleRows(reportModulesEl, "report");
      renderTabExtras(sellExtraEl, "sell");
      renderTabExtras(reportExtraEl, "report");

      if (tab !== "startup") return;

      const seqState = readSequenceState();
      const seqBtn = document.createElement("button");
      seqBtn.className = "hvtb-btn";
      seqBtn.type = "button";
      seqBtn.textContent = seqState.running ? "一键停止" : "一键启动";
      seqBtn.addEventListener("click", () => {
        toolbox.toggleSequence();
      });
      startupActionsEl.innerHTML = "";
      startupActionsEl.appendChild(seqBtn);
    }

    function renderModuleRows(container, tab) {
      container.innerHTML = "";
      for (const mod of toolbox.modules.values()) {
        const modTab = mod.tab || "startup";
        if (modTab !== tab) continue;
        if (mod.showInList === false) continue;
        const ctx = toolbox.makeCtx(mod.id);
        const row = document.createElement("div");
        row.className = "hvtb-row";
        const running = mod.isRunning && mod.isRunning(ctx);
        const status = mod.getStatus ? mod.getStatus(ctx) : (running ? "运行中" : "空闲");
        row.innerHTML = [
          `<div class='hvtb-name'><span class='hvtb-name-text'>${escapeHtml(mod.name)}</span></div>`,
          `<div class='hvtb-status'>${escapeHtml(status)}</div>`,
          `<button class='hvtb-btn' type='button'>${running ? "停止" : "启动"}</button>`
        ].join("");
        row.querySelector("button").addEventListener("click", () => {
          if (running) toolbox.stopModule(mod.id);
          else toolbox.startModule(mod.id);
        });
        if (mod.renderOptions) {
          mod.renderOptions({ row, ctx, refresh });
        }
        container.appendChild(row);
      }
    }

    function renderTabExtras(container, tab) {
      container.innerHTML = "";
      for (const mod of toolbox.modules.values()) {
        const modTab = mod.tab || "startup";
        if (modTab !== tab) continue;
        if (!mod.renderTabExtra) continue;
        const ctx = toolbox.makeCtx(mod.id);
        mod.renderTabExtra({ container, ctx, toolbox, refresh });
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
      return JSON.parse(localStorage.getItem(STORE_KEYS.ui) || "null") || { open: false, tab: "startup" };
    } catch {
      return { open: false, tab: "startup" };
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
    tab: "startup",
    timer: null,
    plan: [
      { tree: "onehanded", skills: [{ id: 2101, targetTier: 3, equip: true }, { id: 2102, targetTier: 2, equip: true }, { id: 2103, targetTier: 1, equip: true }] },
      { tree: "supportive1", skills: [{ id: 4102, targetTier: 5, equip: true }, { id: 4103, targetTier: 5, equip: true }, { id: 4105, targetTier: 5, equip: true }, { id: 4106, targetTier: 7, equip: true }, { id: 4108, targetTier: 10, equip: true }, { id: 4109, targetTier: 3, equip: true }] },
      { tree: "general", skills: [{ id: 1101, targetTier: 10, equip: true }, { id: 1102, targetTier: 10, equip: true }, { id: 1103, targetTier: 10, equip: true }, { id: 1104, targetTier: 5, equip: true }, { id: 1105, targetTier: 5, equip: true }, { id: 1106, targetTier: 5, equip: true }] },
      { tree: "heavy", skills: [{ id: 3301, targetTier: 3, equip: true }, { id: 3302, targetTier: 3, equip: true }, { id: 3303, targetTier: 3, equip: true }, { id: 3304, targetTier: 7, equip: true }] },
      { tree: "supportive2", skills: [{ id: 4110, targetTier: 3, equip: true }, { id: 4101, targetTier: 5, equip: true }, { id: 4111, targetTier: 5, equip: true, forceSlotId: 301 }] },
      { tree: "deprecating1", skills: [{ id: 4201, targetTier: 5, equip: true }, { id: 4202, targetTier: 3, equip: true }, { id: 4203, targetTier: 5, equip: true }, { id: 4204, targetTier: 3, equip: true }, { id: 4207, targetTier: 3, equip: true }] },
      { tree: "deprecating2", skills: [{ id: 4211, targetTier: 3, equip: true }] }
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
      ctx.store.write({ running: true, status, resumeAfter: 0 });
      this.scheduleRun(ctx, oneToTwoSecDelay());
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

    scheduleRun(ctx, delayMs) {
      const delay = Math.max(0, Number(delayMs) || 0);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.runOnce(ctx);
      }, delay);
    },

    async runOnce(ctx) {
      const actionTaken = await this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, oneToTwoSecDelay());
      }
      ctx.refreshUi();
    },

    async runStep(ctx) {
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

      const playerLevel = readPlayerLevel();
      const ap = readAbilityPoints();
      const mp = readMasteryPoints();
      for (const task of inTree) {
        const ab = findAbilityById(task.id);
        if (!ab) {
          st.status[task.key] = "skipped";
          ctx.store.write(st);
          continue;
        }

        const windowInfo = readUpgradeWindow(ab.card, task.id);
        const tier = Number(windowInfo.tier || 0);
        const maxTierNow = resolveCurrentMaxTier(task.id, playerLevel, windowInfo, task.targetTier);
        const effectiveTargetTier = Math.min(Number(task.targetTier || 0), maxTierNow);
        if (tier < effectiveTargetTier) {
          const upgradeTargetTier = calcUpgradeTargetTier(task.id, tier, effectiveTargetTier, ap);
          if (upgradeTargetTier > tier && await submitUpgrade(ab.card, task.id, upgradeTargetTier, tier)) {
            st.resumeAfter = nextResumeAt();
            ctx.store.write(st);
            return true;
          }
          const unlockedAfterUpgradeTry = isAbilityEffectivelyUnlocked(tier, ab.card);
          if (tier < effectiveTargetTier && !unlockedAfterUpgradeTry) {
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

        const unlockedForEquip = isAbilityEffectivelyUnlocked(tier, ab.card);
        if (!unlockedForEquip) {
          st.status[task.key] = "skipped";
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

        if (!locked.costParsed) {
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
    const text = top.textContent || "";
    const named = text.match(/(?:Mastery\s*Point(?:s)?|支配点|支配點)\s*[:：]?\s*(\d+)/i);
    if (named) {
      const n = Number(named[1]);
      if (Number.isFinite(n)) return n;
    }
    const vals = [];
    const nodes = top.querySelectorAll(".fc4 > div");
    for (const n of nodes) {
      const m = (n.textContent || "").match(/(\d+)/);
      if (m) vals.push(Number(m[1]));
    }
    return vals[1] || 0;
  }

  function readAbilityPoints() {
    const top = document.getElementById("ability_top");
    if (!top) return 0;
    const text = top.textContent || "";
    const named = text.match(/(?:Ability\s*Points?|技能点|技能點)\s*[:：]?\s*(\d+)/i);
    if (named) {
      const n = Number(named[1]);
      if (Number.isFinite(n)) return n;
    }

    const node = top.children[3];
    const fallback = (node?.textContent || "").match(/(\d+)/);
    if (!fallback) return 0;
    const n = Number(fallback[1]);
    return Number.isFinite(n) ? n : 0;
  }

  const ABILITY_POINT_COSTS = Object.freeze({
    1101: [1, 2, 3, 3, 4, 4, 4, 5, 5, 5],
    1102: [1, 2, 3, 3, 4, 4, 4, 5, 5, 5],
    1103: [1, 2, 3, 3, 4, 4, 4, 5, 5, 5],
    1104: [1, 2, 3, 4, 5],
    1105: [2, 3, 5, 7, 9],
    1106: [2, 3, 5, 7, 9],
    2101: [2, 3, 5],
    2102: [1, 2],
    2103: [3],
    3301: [3, 5, 7],
    3302: [3, 5, 7],
    3303: [3, 5, 7],
    3304: [1, 2, 3, 3, 4, 4, 5],
    4101: [1, 2, 3, 4, 5],
    4102: [1, 2, 3, 4, 5],
    4103: [1, 2, 3, 5, 7],
    4105: [1, 2, 3, 4, 5],
    4106: [1, 2, 3, 4, 5, 6, 7],
    4108: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    4109: [2, 3, 5],
    4110: [2, 3, 5],
    4111: [3, 1, 2, 3, 4],
    4201: [1, 2, 3, 5, 7],
    4202: [3, 5, 7],
    4203: [1, 2, 3, 4, 5],
    4204: [3, 5, 7],
    4207: [1, 3, 5],
    4211: [1, 2, 3, 4, 5]
  });
  const ABILITY_UNLOCK_LEVELS = Object.freeze({
    1101: [0, 25, 50, 75, 100, 120, 150, 200, 250, 300],
    1102: [0, 30, 60, 90, 120, 160, 210, 260, 310, 350],
    1103: [0, 40, 80, 120, 170, 220, 270, 330, 390, 450],
    1104: [0, 100, 200, 300, 400],
    1105: [0, 80, 140, 220, 380],
    1106: [0, 90, 160, 240, 400],
    2101: [0, 100, 200],
    2102: [50, 150],
    2103: [250],
    3301: [0, 75, 150],
    3302: [0, 75, 150],
    3303: [0, 75, 150],
    3304: [0, 60, 110, 170, 230, 290, 350],
    4101: [40, 55, 75, 95, 120],
    4102: [60, 75, 90, 110, 130],
    4103: [90, 105, 120, 135, 155],
    4105: [200, 220, 240, 265, 285],
    4106: [140, 185, 225, 265, 305, 345, 385],
    4108: [50, 70, 95, 145, 195, 245, 295, 375, 445, 500],
    4109: [0, 35, 65],
    4110: [100, 125, 150],
    4111: [10, 65, 140, 220, 300],
    4201: [70, 100, 130, 190, 250],
    4202: [80, 165, 250],
    4203: [130, 175, 230, 285, 330],
    4204: [140, 225, 310],
    4207: [80, 130, 170],
    4211: [120, 170, 215]
  });
  const FAST_UPGRADE_INTERVAL_MS = 300;
  const FAST_UPGRADE_MAX_CONCURRENT = 3;

  function readPlayerLevel() {
    const text = document.getElementById("level_readout")?.textContent || "";
    const m = text.match(/Lv\.(\d+)/i);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  }

  function calcLevelUnlockedTier(abilityId, playerLevel) {
    if (!Number.isFinite(playerLevel)) return NaN;
    const unlock = ABILITY_UNLOCK_LEVELS[Number(abilityId)];
    if (!Array.isArray(unlock) || unlock.length === 0) return NaN;
    let n = 0;
    for (const needLv of unlock) {
      if (Number(needLv) <= playerLevel) n += 1;
      else break;
    }
    return n;
  }

  function resolveCurrentMaxTier(abilityId, playerLevel, windowInfo, fallbackTargetTier) {
    const byLevel = calcLevelUnlockedTier(abilityId, playerLevel);
    const byUi = Number(windowInfo?.tier || 0) + Number(windowInfo?.upgradable || 0);
    let cap = Number.isFinite(byLevel) ? byLevel : NaN;
    if (Number.isFinite(byUi) && byUi >= 0) {
      cap = Number.isFinite(cap) ? Math.min(cap, byUi) : byUi;
    }
    if (!Number.isFinite(cap)) cap = Number(fallbackTargetTier) || 0;
    return Math.max(0, Math.floor(cap));
  }

  function calcUpgradeTargetTier(abilityId, currentTier, targetTier, abilityPoints) {
    const now = Math.max(0, Number(currentTier) || 0);
    const target = Math.max(now, Number(targetTier) || now);
    const points = Math.max(0, Number(abilityPoints) || 0);
    const costs = ABILITY_POINT_COSTS[Number(abilityId)] || [];
    if (costs.length === 0) return target;

    let tier = now;
    let remain = points;
    while (tier < target && tier < costs.length) {
      const need = Number(costs[tier] || 0);
      if (!Number.isFinite(need) || need <= 0) break;
      if (remain < need) break;
      remain -= need;
      tier += 1;
    }
    return tier;
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

  function readUpgradeWindow(card, abilityId) {
    const bars = readAbilityProgressBars(card, abilityId);
    if (bars.length === 0) return { tier: 0, upgradable: 0, total: 0 };

    let tier = 0;
    let upgradable = 0;
    let total = 0;
    for (const bar of bars) {
      const type = readAbilityBarType(bar);
      if (!type) continue;
      total += 1;
      if (type === "f") tier += 1;
      else if (type === "u") upgradable += 1;
    }
    return { tier, upgradable, total };
  }

  function readAbilityProgressBars(card, abilityId) {
    const legacyRow = findLegacyAwRow(card);
    if (legacyRow) return Array.from(legacyRow.querySelectorAll("div"));

    if (abilityId) {
      const globalRow = document.querySelector(`[onclick*='do_unlock_ability(${abilityId})']`);
      if (globalRow) return Array.from(globalRow.querySelectorAll("div"));
    }

    return [];
  }

  function readAbilityBarType(node) {
    const s = (node?.getAttribute("style") || "").toLowerCase();
    if (s.includes("f.png")) return "f";
    if (s.includes("u.png")) return "u";
    if (s.includes("x.png")) return "x";
    return "";
  }

  function findNativeUnlockButton(card, abilityId) {
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

  async function submitUpgrade(card, abilityId, targetTier, currentTier) {
    const need = Math.max(0, Number(targetTier || 0) - Number(currentTier || 0));
    if (need > 0) {
      const window = readUpgradeWindow(card, abilityId);
      const fastCount = Math.min(need, window.upgradable);
      if (fastCount > 0) {
        const ok = await submitFastUpgrade(abilityId, fastCount);
        if (ok) return true;
      }
    }

    const btn = findNativeUnlockButton(card, abilityId);
    if (!btn) return false;
    btn.click();
    return true;
  }

  async function submitFastUpgrade(abilityId, count) {
    const id = Number(abilityId);
    const times = Number(count || 0);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(times) || times <= 0) return false;

    try {
      await runThrottledUnlockRequests(id, times, FAST_UPGRADE_INTERVAL_MS, FAST_UPGRADE_MAX_CONCURRENT);
      location.href = location.href;
      return true;
    } catch {
      return false;
    }
  }

  async function runThrottledUnlockRequests(abilityId, totalCount, intervalMs, maxConcurrent) {
    const total = Math.max(0, Number(totalCount) || 0);
    const interval = Math.max(0, Number(intervalMs) || 0);
    const concurrent = Math.max(1, Number(maxConcurrent) || 1);
    if (total <= 0) return;

    const size = Math.min(total, concurrent);
    let nextIndex = 0;
    let nextStartAt = 0;
    let scheduleChain = Promise.resolve();

    function reserveStartSlot() {
      const waitTurn = scheduleChain.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, nextStartAt - now);
        if (waitMs > 0) await sleep(waitMs);
        nextStartAt = Date.now() + interval;
      });
      scheduleChain = waitTurn.catch(() => {});
      return waitTurn;
    }

    async function sendOne() {
      const params = new URLSearchParams();
      params.set("unlock_ability", String(abilityId));
      await postForm(location.href, params);
    }

    const workers = [];
    for (let i = 0; i < size; i += 1) {
      workers.push((async () => {
        while (true) {
          const idx = nextIndex;
          nextIndex += 1;
          if (idx >= total) return;
          await reserveStartSlot();
          await sendOne();
        }
      })());
    }

    await Promise.all(workers);
  }

  function isAbilityUnlocked(card) {
    const icon = card.querySelector("[id^='slot_']");
    if (!icon) return false;
    const onclick = icon.getAttribute("onclick") || "";
    return onclick.includes("do_equip_ability") || icon.getAttribute("draggable") === "true";
  }

  function isAbilityEffectivelyUnlocked(tier, card) {
    return Number(tier || 0) > 0 || isAbilityUnlocked(card);
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
      const costMatch = title.match(/(?:Unlock\s*Cost\s*:?\s*(\d+)\s*Mastery\s*Point(?:s)?|解锁消耗\s*(\d+)\s*支配点)/i);
      const rawCost = costMatch ? (costMatch[1] || costMatch[2]) : "";
      const cost = rawCost ? Number(rawCost) : 0;
      const costParsed = !!costMatch && Number.isFinite(cost);
      all.push({ id, slot, unlocked, occupied, cost, costParsed, title });
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

  function oneToTwoSecDelay() {
    return 1000 + Math.floor(Math.random() * 1001);
  }

  function readStaminaValue() {
    const text = document.getElementById("stamina_readout")?.textContent || "";
    const m = text.match(/Stamina\s*:\s*(\d+)/i);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  }

  function pickBottomArenaStartButton() {
    const buttons = Array.from(document.querySelectorAll("#arena_list img[onclick*='init_battle(']"));
    if (buttons.length === 0) return null;
    return buttons[buttons.length - 1] || null;
  }

  function clickArenaStartButton(btn) {
    if (!btn) return false;
    const src = (btn.getAttribute("src") || "").toLowerCase();
    if (src.includes("startchallenge_d.png")) return false;
    const onclick = btn.getAttribute("onclick") || "";
    if (!onclick.includes("init_battle(")) return false;
    const prevConfirm = window.confirm;
    window.confirm = () => true;
    try {
      btn.click();
      return true;
    } catch {
      return false;
    } finally {
      window.confirm = prevConfirm;
    }
  }

  async function startIsekaiGrindFestByRequest() {
    const url = `${location.origin}/isekai/?s=Battle&ss=gr`;
    try {
      const enterRes = await fetch(url, { credentials: "same-origin" });
      if (!enterRes.ok) return false;
      const html = await enterRes.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const token = doc.querySelector('input[name="postoken"]')?.getAttribute("value") || "";
      if (!token) return false;

      const params = new URLSearchParams();
      params.set("initid", "1");
      params.set("postoken", token);
      await postForm(url, params);
      return true;
    } catch {
      return false;
    }
  }

  const MONSTER_CLASS_MAP = Object.freeze({
    ARTHROPOD: 1,
    AVION: 2,
    BEAST: 3,
    CELESTIAL: 4,
    DAIMON: 5,
    DRAGONRIN: 6,
    ELEMENTAL: 7,
    GIANT: 8,
    HUMANOID: 10,
    MECHANOID: 12,
    REPTILIAN: 13,
    SPRITE: 14,
    UNDEAD: 15
  });

  const MONSTER_ATTACK_MAP = Object.freeze({
    ARTHROPOD: ["crsh", "prcg"],
    AVION: ["prcg", "slsh"],
    BEAST: ["slsh", "prcg"],
    CELESTIAL: ["slsh", "crsh"],
    DAIMON: ["slsh", "prcg"],
    DRAGONRIN: ["prcg", "crsh"],
    ELEMENTAL: ["fire", "elec", "wind", "cold"],
    GIANT: ["crsh"],
    HUMANOID: ["prcg", "slsh", "crsh"],
    MECHANOID: ["prcg", "slsh"],
    REPTILIAN: ["prcg", "slsh"],
    SPRITE: ["prcg", "slsh"],
    UNDEAD: ["crsh", "slsh"]
  });

  const MONSTER_SAMPLE_CLASSES = Object.freeze(["DRAGONRIN", "GIANT", "ARTHROPOD", "UNDEAD"]);
  const SELL_FILTERS = Object.freeze(["co", "ma", "tr", "ar"]);
  const SELL_NO_SELL_ITEM_IDS = new Set([
    "11191",
    "11195",
    "11199",
    "11291",
    "11295",
    "11299",
    "11391",
    "11395",
    "11399",
    "60051",
    "60052",
    "60053",
    "60054",
    "60071",
    "60402",
    "60412",
    "60422",
    "11501",
    "61501"
  ]);
  const SELL_BATCH100_ITEM_IDS = new Set([
    "11191",
    "11195",
    "11291",
    "11295",
    "11391",
    "11395",
    "50001",
    "50002",
    "50003",
    "50004",
    "50005",
    "50006",
    "50011",
    "50012",
    "50013",
    "50014",
    "50015",
    "50016"
  ]);
  const SELL_SCHEDULE_LOCK_KEY = "hvtb_sell_schedule_lock";
  const SELL_SCHEDULE_LOCK_MS = 12 * 60 * 60 * 1000;
  const SELL_SCHEDULE_POLL_MS = 60 * 60 * 1000;
  const MARKET_TOTAL_BALANCE_KEY = "hvtb_market_total_balance";
  const SELL_ITEMS_STORE_MAIN_KEY = "hvtb_sell_items_main";
  const SELL_ITEMS_STORE_ISEKAI_KEY = "hvtb_sell_items_isekai";
  const REPORT_ENDPOINT = "https://report.6950695.xyz/api/v1/report/daily";
  const REPORT_API_KEY = "hvtb_report_signing_key_v1_2026_03_04";
  const REPORT_MAX_RETRY = 3;
  const DYNJS_EQUIP_CACHE = new Map();

  function randomFrom(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list[Math.floor(Math.random() * list.length)] || "";
  }

  function postForm(url, params) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 400) resolve(true);
        else reject(new Error(`HTTP_${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("NETWORK_ERROR"));
      xhr.send(params.toString());
    });
  }

  function readUnnamedMonsterSlots() {
    const rows = Array.from(document.querySelectorAll("#slot_pane .msl"));
    const result = [];
    for (const row of rows) {
      const onclick = row.getAttribute("onclick") || "";
      const slotMatch = onclick.match(/[?&]slot=(\d+)/);
      const slot = slotMatch ? Number(slotMatch[1]) : NaN;
      if (!Number.isFinite(slot)) continue;

      const nameCell = row.children[1];
      const name = (nameCell?.textContent || "").replace(/\s+/g, " ").trim();
      if (!/unnamed/i.test(name)) continue;

      const orderCell = row.children[0];
      const orderMatch = (orderCell?.textContent || "").match(/(\d+)/);
      const order = orderMatch ? Number(orderMatch[1]) : slot;
      result.push({ slot, order });
    }
    result.sort((a, b) => a.order - b.order);
    return result;
  }

  function buildMonsterNameByOrder(order) {
    return `Scientific Railgun${Number(order)}`;
  }

  function buildRandomMonsterName() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letterLen = 2 + Math.floor(Math.random() * 3);
    const digitLen = 5 + Math.floor(Math.random() * 3);

    let prefix = "";
    for (let i = 0; i < letterLen; i += 1) {
      prefix += letters[Math.floor(Math.random() * letters.length)];
    }

    let suffix = "";
    for (let i = 0; i < digitLen; i += 1) {
      suffix += String(Math.floor(Math.random() * 10));
    }

    return `${prefix}${suffix}`;
  }

  async function renameMonster(slot, name) {
    const params = new URLSearchParams();
    params.set("rename_monster", name);
    try {
      await postForm(`?s=Bazaar&ss=ml&slot=${Number(slot)}`, params);
      return true;
    } catch {
      return false;
    }
  }

  function getSellWorld() {
    return location.pathname.startsWith("/isekai/") ? "isekai" : "main";
  }

  function buildMkRootUrl(world) {
    return world === "isekai"
      ? `${location.origin}/isekai/?s=Bazaar&ss=mk`
      : `${location.origin}/?s=Bazaar&ss=mk`;
  }

  function buildBrowseUrl(world, filter) {
    return `${buildMkRootUrl(world)}&screen=browseitems&filter=${filter}`;
  }

  function buildSellOrdersUrl(world, filter) {
    return `${buildMkRootUrl(world)}&screen=sellorders&filter=${filter}`;
  }

  function readSellItemsStore(world) {
    const key = world === "isekai" ? SELL_ITEMS_STORE_ISEKAI_KEY : SELL_ITEMS_STORE_MAIN_KEY;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      return normalizeSellItemsById(Array.isArray(arr) ? arr : []);
    } catch {
      return [];
    }
  }

  function writeSellItemsStore(world, items) {
    const key = world === "isekai" ? SELL_ITEMS_STORE_ISEKAI_KEY : SELL_ITEMS_STORE_MAIN_KEY;
    localStorage.setItem(key, JSON.stringify(normalizeSellItemsById(items)));
  }

  function isMkBrowseItemsPage() {
    const p = new URLSearchParams(location.search);
    return p.get("s") === "Bazaar" && p.get("ss") === "mk" && p.get("screen") === "browseitems";
  }

  function getCurrentMkFilter() {
    return new URLSearchParams(location.search).get("filter") || "";
  }

  function parsePriceText(str) {
    return parseFloat((str || "").replace(" C", "") || "0");
  }

  function extractFilterAndItemId(onclickAttr) {
    const text = String(onclickAttr || "");
    const filterMatch = text.match(/filter=([a-z]+)/i);
    const itemIdMatch = text.match(/itemid=(\d+)/i);
    return {
      filter: filterMatch ? String(filterMatch[1]).toLowerCase() : "",
      itemId: itemIdMatch ? itemIdMatch[1] : ""
    };
  }

  function normalizeSellItemsById(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const itemId = item.itemId ? String(item.itemId) : "";
      if (!itemId) continue;
      map.set(itemId, {
        itemId,
        filter: item.filter ? String(item.filter) : "",
        name: item.name || "",
        stock: Number(item.stock || 0),
        bid: Number(item.bid || 0),
        ask: Number(item.ask || 0),
        link: item.link || ""
      });
    }
    return Array.from(map.values());
  }

  function syncItemDataFromCurrentPage(world) {
    if (!isMkBrowseItemsPage()) return;
    const rows = document.querySelectorAll("tbody tr[onclick]");
    if (rows.length === 0) return;

    const items = readSellItemsStore(world);
    const map = new Map(items.map((x) => [x.itemId, x]));
    for (const row of rows) {
      const cols = row.querySelectorAll("td");
      if (cols.length < 5) continue;
      const name = (cols[0].innerText || "").trim();
      const stock = parseFloat((cols[1].innerText || "").trim() || "0");
      const bid = parsePriceText((cols[2].innerText || "").trim());
      const ask = parsePriceText((cols[3].innerText || "").trim());
      const parsed = extractFilterAndItemId(row.getAttribute("onclick") || "");
      if (!parsed.itemId) continue;
      const link = parsed.filter
        ? `&filter=${parsed.filter}&itemid=${parsed.itemId}`
        : `&itemid=${parsed.itemId}`;
      const next = { itemId: parsed.itemId, filter: parsed.filter, name, stock, bid, ask, link };
      map.set(parsed.itemId, next);
    }
    writeSellItemsStore(world, Array.from(map.values()));
  }

  function isSellableItem(itemId) {
    if (!itemId) return false;
    if (SELL_NO_SELL_ITEM_IDS.has(String(itemId))) return false;
    return true;
  }

  function isBatch100Item(item) {
    if (!item || !item.itemId) return false;
    return SELL_BATCH100_ITEM_IDS.has(String(item.itemId));
  }

  function extractItemId(itemlink) {
    const match = (itemlink || "").match(/itemid=(\d+)/);
    return match ? match[1] : "";
  }

  function newPriceStep(price, direction) {
    let stepval = price;
    let stepcur = 1;
    if (direction < 0) {
      while (stepval > 1000) {
        stepcur *= 10;
        stepval /= 10;
      }
      if (stepval > 500) stepcur *= 5;
      else if (stepval > 200) stepcur *= 2;
    }
    if (direction > 0) {
      while (stepval >= 1000) {
        stepcur *= 10;
        stepval /= 10;
      }
      if (stepval >= 500) stepcur *= 5;
      else if (stepval >= 200) stepcur *= 2;
    }
    if (direction > 0) return Math.min(100000000, Math.max(10, price + (stepcur - (price % stepcur))));
    if (direction < 0) {
      if (price <= 10) return 0;
      const mod = price % stepcur;
      return mod > 0 ? Math.max(0, price - mod) : Math.max(0, price - stepcur);
    }
    return price;
  }

  async function fetchSellData(world, filter) {
    const url = buildSellOrdersUrl(world, filter);
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sellRows = doc.querySelectorAll("tbody tr[onclick]");
    const sellData = new Map();
    for (const row of sellRows) {
      const cols = row.querySelectorAll("td");
      if (cols.length < 5) continue;
      const name = (cols[0].innerText || "").trim();
      const stock = parseFloat((cols[1].innerText || "").trim() || "0");
      const count = parseFloat((cols[2].innerText || "").trim() || "0");
      const price = parsePriceText(cols[3].innerText || "");
      const parsed = extractFilterAndItemId(row.getAttribute("onclick") || "");
      const key = parsed.itemId || "name:" + name;
      sellData.set(key, { stock, count, price });
    }
    return sellData;
  }

  function updateItemsWithSellData(items, sellData, mode) {
    for (const item of items) {
      const sellItem = item.itemId ? sellData.get(item.itemId) : null;
      if (!sellItem || !item.link) continue;
      const samePrice = mode === "ask" ? item.ask === sellItem.price : item.bid === sellItem.price;
      const tag = samePrice ? "_X" : "_S";
      const allstock = sellItem.stock + sellItem.count;
      const baseLink = item.link.replace(/(_X|_S)\d+$/, "");
      item.stock = allstock;
      item.link = `${baseLink}${tag}${sellItem.count}`;
    }
  }

  function buildSellingList(items, mode) {
    const result = [];
    for (const item of items) {
      if (!item.itemId) continue;
      if (!isSellableItem(item.itemId)) continue;
      let stock = item.stock;
      let price = mode === "ask" ? item.ask : item.bid;
      let link = item.link || "";
      let sellorderUpdate = "Place+Sell+Order";
      let shouldUpdate = true;
      let shouldChangePrice = mode !== "bid";
      const batch100 = isBatch100Item(item);

      if (batch100) {
        stock = Math.floor(stock / 100);
        price = Math.round(price * 100);
      }

      if (link.includes("_X")) {
        const parts = link.split("_X");
        link = parts[0];
        let newStock = parseFloat(parts[1]);
        sellorderUpdate = "Update";
        if (batch100) newStock = Math.floor(newStock / 100);
        if (stock === newStock) shouldUpdate = false;
        else shouldChangePrice = false;
      } else if (link.includes("_S")) {
        link = link.split("_S")[0];
        sellorderUpdate = "Update";
      }

      if (stock > 0 && price >= 10 && shouldUpdate) {
        result.push({ itemId: item.itemId, name: item.name, stock, price, link, sellorderUpdate });
      }
    }
    return result;
  }

  function buildSellOrderParams(token, stock, price, action) {
    return new URLSearchParams({
      marketoken: String(token),
      sellorder_batchcount: String(stock),
      sellorder_batchprice: String(price),
      sellorder_update: String(action)
    }).toString();
  }

  async function fetchFreshMarketToken(world, filter, itemId) {
    try {
      const url = `${buildBrowseUrl(world, filter)}&itemid=${itemId}`;
      const res = await fetch(url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const tokenNode = doc.querySelector('#market_itemsell input[name="marketoken"]');
      return tokenNode?.value || "";
    } catch {
      return "";
    }
  }

  function runDelay(minMs, maxMs) {
    const min = Math.max(0, Number(minMs) || 0);
    const max = Math.max(min, Number(maxMs) || min);
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function randomInt(min, max) {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  function buildNextSellCycleTime(lastRunAt) {
    const now = Date.now();
    const base = Number.isFinite(lastRunAt) ? lastRunAt : now;
    const minInterval = 2 * 24 * 60 * 60 * 1000;
    const floor = Math.max(now, base + minInterval);

    const extraDays = randomInt(0, 2) * 24 * 60 * 60 * 1000;
    const extraHours = randomInt(0, 23) * 60 * 60 * 1000;
    const extraMinutes = randomInt(0, 59) * 60 * 1000;
    const extraSeconds = randomInt(0, 59) * 1000;
    const extraJitter = randomInt(0, 999);

    return floor + extraDays + extraHours + extraMinutes + extraSeconds + extraJitter;
  }

  function readSellScheduleLock() {
    try {
      return JSON.parse(localStorage.getItem(SELL_SCHEDULE_LOCK_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSellScheduleLock(lock) {
    localStorage.setItem(SELL_SCHEDULE_LOCK_KEY, JSON.stringify(lock));
  }

  function isSellScheduleLockExpired(lock, now = Date.now()) {
    if (!lock || !Number.isFinite(lock.expiresAt)) return true;
    return Number(lock.expiresAt) <= now;
  }

  function acquireSellScheduleLock(jobId, now = Date.now()) {
    const lock = readSellScheduleLock();
    if (lock && !isSellScheduleLockExpired(lock, now)) return false;
    writeSellScheduleLock({ owner: jobId, expiresAt: now + SELL_SCHEDULE_LOCK_MS });
    return true;
  }

  function isSellScheduleLockOwnedBy(jobId) {
    const lock = readSellScheduleLock();
    if (!lock) return false;
    if (isSellScheduleLockExpired(lock, Date.now())) return false;
    return lock.owner === jobId;
  }

  function releaseSellScheduleLock(jobId) {
    const lock = readSellScheduleLock();
    if (!lock) return;
    if (!jobId || lock.owner === jobId || isSellScheduleLockExpired(lock, Date.now())) {
      localStorage.removeItem(SELL_SCHEDULE_LOCK_KEY);
    }
  }

  function formatSellInterruptReason(reason) {
    if (reason === "battle_ba") return "遭遇战(ba)";
    if (reason === "battle_other") return "其他战斗";
    if (reason === "other_page") return "离开异世界市场";
    if (reason === "manual_cancel") return "手动取消";
    return "-";
  }

  function parseCreditValue(text) {
    const normalized = String(text || "").replace(/,/g, "");
    const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return NaN;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : NaN;
  }

  function readMarketTotalBalanceFromPage() {
    const balances = document.querySelectorAll("#market_xfer .credit_balance > div:last-child");
    if (balances.length < 2) return NaN;
    const accountBalance = parseCreditValue(balances[0].textContent || "");
    const marketBalance = parseCreditValue(balances[1].textContent || "");
    if (!Number.isFinite(accountBalance) || !Number.isFinite(marketBalance)) return NaN;
    return accountBalance + marketBalance;
  }

  function saveMarketTotalBalance(world, totalBalance) {
    if (!Number.isFinite(totalBalance)) return;
    const safeWorld = world === "isekai" ? "isekai" : "main";
    let snapshot = {};
    try {
      snapshot = JSON.parse(localStorage.getItem(MARKET_TOTAL_BALANCE_KEY) || "null") || {};
    } catch {
      snapshot = {};
    }
    snapshot[safeWorld] = {
      totalBalance,
      savedAt: Date.now()
    };
    localStorage.setItem(MARKET_TOTAL_BALANCE_KEY, JSON.stringify(snapshot));
  }

  function readMarketTotalBalanceSnapshot() {
    try {
      const raw = JSON.parse(localStorage.getItem(MARKET_TOTAL_BALANCE_KEY) || "null") || {};
      const main = raw.main && typeof raw.main === "object" ? raw.main : null;
      const isekai = raw.isekai && typeof raw.isekai === "object" ? raw.isekai : null;
      return {
        main: {
          totalBalance: Number(main?.totalBalance),
          savedAt: Number(main?.savedAt)
        },
        isekai: {
          totalBalance: Number(isekai?.totalBalance),
          savedAt: Number(isekai?.savedAt)
        }
      };
    } catch {
      return {
        main: { totalBalance: NaN, savedAt: NaN },
        isekai: { totalBalance: NaN, savedAt: NaN }
      };
    }
  }

  function formatRecordedCredits(value) {
    if (!Number.isFinite(value)) return "-";
    return `${Math.round(value).toLocaleString()} C`;
  }

  function formatRecordedTime(value) {
    if (!Number.isFinite(value) || value <= 0) return "-";
    return new Date(value).toLocaleString();
  }

  function formatRecordedTimeUtc(value) {
    if (!Number.isFinite(value) || value <= 0) return "-";
    return new Date(value).toISOString().replace(".000Z", "Z");
  }

  function formatRecordedTimeUtc8(value) {
    if (!Number.isFinite(value) || value <= 0) return "-";
    const d = new Date(value + 8 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}:${ss} UTC+8`;
  }

  function formatUtcDate(ms) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function buildYesterdayUtcDate(nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return formatUtcDate(now - 24 * 60 * 60 * 1000);
  }

  function computeReportRetryDelayMs(retryCount) {
    const plan = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
    const idx = Math.max(0, Math.min(plan.length - 1, Number(retryCount) || 0));
    return plan[idx] + randomInt(0, 30000);
  }

  async function hmacSha256Hex(secret, message) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("CRYPTO_UNAVAILABLE");
    const enc = new TextEncoder();
    const keyData = enc.encode(String(secret || ""));
    const msgData = enc.encode(String(message || ""));
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await window.crypto.subtle.sign("HMAC", key, msgData);
    const bytes = new Uint8Array(sig);
    let out = "";
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out;
  }

  function createEmptyAadbDaily() {
    return {
      rounds_total: 0,
      first_ar_start_time_utc: null,
      equips: {
        legendary_total: 0,
        peerless_total: 0,
        legendary_items: {},
        peerless_items: {}
      }
    };
  }

  function mergeEquipItems(targetMap, sourceMap) {
    if (!sourceMap || typeof sourceMap !== "object") return;
    for (const [name, count] of Object.entries(sourceMap)) {
      const key = String(name || "").trim();
      if (!key) continue;
      const n = Number(count || 0);
      if (!Number.isFinite(n) || n <= 0) continue;
      targetMap[key] = Number(targetMap[key] || 0) + n;
    }
  }

  function aggregateAadbRecordToDaily(target, record) {
    if (!record || typeof record !== "object") return;
    const rounds = Number(record.rounds || 0);
    if (Number.isFinite(rounds) && rounds > 0) target.rounds_total += rounds;

    const equips = record.detailsCompressed?.drops?.Equips || {};
    mergeEquipItems(target.equips.legendary_items, equips.Legendary);
    mergeEquipItems(target.equips.peerless_items, equips.Peerless);
  }

  function pickEarliestArStartTimeUtc(records) {
    let minStart = Infinity;
    for (const record of records || []) {
      if (!record || typeof record !== "object") continue;
      const bt = String(record.battleType || "").toLowerCase();
      if (bt !== "ar") continue;
      const startTime = Number(record.startTime || 0);
      if (!Number.isFinite(startTime) || startTime <= 0) continue;
      if (startTime < minStart) minStart = startTime;
    }
    return Number.isFinite(minStart) ? new Date(minStart).toISOString() : null;
  }

  function readAadbRecordsByIndex(store, indexName, keyRange) {
    return new Promise((resolve, reject) => {
      if (!store.indexNames.contains(indexName)) {
        resolve([]);
        return;
      }
      const index = store.index(indexName);
      if (typeof index.getAll === "function") {
        const request = index.getAll(keyRange);
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error("INDEX_GETALL_FAILED"));
        return;
      }

      const out = [];
      const request = index.openCursor(keyRange);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        out.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("INDEX_CURSOR_FAILED"));
    });
  }

  function finalizeAadbDaily(daily) {
    const legendaryTotal = Object.values(daily.equips.legendary_items).reduce((sum, v) => sum + Number(v || 0), 0);
    const peerlessTotal = Object.values(daily.equips.peerless_items).reduce((sum, v) => sum + Number(v || 0), 0);
    daily.equips.legendary_total = Number.isFinite(legendaryTotal) ? legendaryTotal : 0;
    daily.equips.peerless_total = Number.isFinite(peerlessTotal) ? peerlessTotal : 0;
    return daily;
  }

  function readAadbDailySummary(reportDateUtc) {
    const dateKey = String(reportDateUtc || "").trim();
    if (!dateKey) {
      return Promise.resolve({
        main: createEmptyAadbDaily(),
        isekai: createEmptyAadbDaily(),
        status: "invalid_date"
      });
    }

    return new Promise((resolve) => {
      let done = false;
      const safeResolve = (value) => {
        if (done) return;
        done = true;
        resolve(value);
      };

      const req = indexedDB.open("AADB");
      req.onerror = () => {
        safeResolve({
          main: createEmptyAadbDaily(),
          isekai: createEmptyAadbDaily(),
          status: "db_open_failed"
        });
      };

      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("battles")) {
          db.close();
          safeResolve({
            main: createEmptyAadbDaily(),
            isekai: createEmptyAadbDaily(),
            status: "store_missing"
          });
          return;
        }
        const tx = db.transaction(["battles"], "readonly");
        const store = tx.objectStore("battles");
        const hasDailyIndex = store.indexNames.contains("isekai_date");
        const hasTypeDailyIndex = store.indexNames.contains("isekai_type_date");
        if (!hasDailyIndex || !hasTypeDailyIndex) {
          db.close();
          safeResolve({
            main: createEmptyAadbDaily(),
            isekai: createEmptyAadbDaily(),
            status: "index_missing"
          });
          return;
        }

        Promise.all([
          readAadbRecordsByIndex(store, "isekai_date", IDBKeyRange.only([0, dateKey])),
          readAadbRecordsByIndex(store, "isekai_date", IDBKeyRange.only([1, dateKey])),
          readAadbRecordsByIndex(store, "isekai_type_date", IDBKeyRange.only([0, "ar", dateKey])),
          readAadbRecordsByIndex(store, "isekai_type_date", IDBKeyRange.only([1, "ar", dateKey]))
        ]).then(([mainRecords, isekaiRecords, mainArRecords, isekaiArRecords]) => {
          const main = createEmptyAadbDaily();
          const isekai = createEmptyAadbDaily();
          for (const record of mainRecords) aggregateAadbRecordToDaily(main, record);
          for (const record of isekaiRecords) aggregateAadbRecordToDaily(isekai, record);
          main.first_ar_start_time_utc = pickEarliestArStartTimeUtc(mainArRecords);
          isekai.first_ar_start_time_utc = pickEarliestArStartTimeUtc(isekaiArRecords);
          db.close();
          safeResolve({
            main: finalizeAadbDaily(main),
            isekai: finalizeAadbDaily(isekai),
            status: "ok"
          });
        }).catch(() => {
          db.close();
          safeResolve({
            main: createEmptyAadbDaily(),
            isekai: createEmptyAadbDaily(),
            status: "index_query_failed"
          });
        });
      };
    });
  }

  const AutoStatModule = {
    id: "auto-stat",
    name: "自动加点",
    tab: "startup",
    timer: null,
    delayBetweenClicks: 600,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      return this.isRunning(ctx) ? "执行中" : "空闲";
    },

    start(ctx, options) {
      const singleBattle = !!(options && options.sequenceMode);
      ctx.store.write({ running: true, resumeAfter: 0, singleBattle, lastCycleResult: "" });
      this.scheduleRun(ctx, oneToTwoSecDelay());
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
        this.scheduleRun(ctx, oneToTwoSecDelay());
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
    tab: "startup",
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
      ctx.store.write({ running: true, index: 0, resumeAfter: 0 });
      this.scheduleRun(ctx, oneToTwoSecDelay());
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

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx);
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      ensureEnglishUi();
      const actionTaken = await this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, oneToTwoSecDelay());
      }
      ctx.refreshUi();
    },

    async runStep(ctx) {
      const st = ctx.store.read();
      if (!st.running) return false;
      if ((st.resumeAfter || 0) > Date.now()) return false;

      const index = Number(st.index || 0);
      if (index >= this.slotOrder.length) {
        st.running = false;
        ctx.store.write(st);
        return false;
      }

      const world = ctx.router.getWorld();
      const targetSlot = this.slotOrder[index];

      const payload = await readEquipSlotPayload(world, targetSlot);
      if (!payload || !payload.best) {
        st.index = index + 1;
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        return false;
      }

      if (payload.currentEid > 0 && payload.currentEid === payload.best.eid) {
        st.index = index + 1;
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        return false;
      }

      const ok = await submitEquipSelection(payload, payload.best.eid);
      if (!ok) {
        st.index = index + 1;
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        return false;
      }

      st.index = index + 1;
      st.resumeAfter = nextResumeAt();
      ctx.store.write(st);
      return false;
    }
  };

  const AutoTowerModule = {
    id: "auto-tower",
    name: "自动塔楼",
    tab: "startup",
    timer: null,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      return this.isRunning(ctx) ? "执行中" : "空闲";
    },

    start(ctx) {
      ctx.store.write({ running: true, resumeAfter: 0, lastCycleResult: "" });
      this.scheduleRun(ctx, oneToTwoSecDelay());
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

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.runOnce(ctx);
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      const actionTaken = await this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, oneToTwoSecDelay());
      }
      ctx.refreshUi();
    },

    async runStep(ctx) {
      const st = ctx.store.read();
      if (!st.running) return false;
      if ((st.resumeAfter || 0) > Date.now()) return false;

      if (ctx.router.getWorld() !== "isekai") {
        st.running = false;
        st.lastCycleResult = "wrong_world";
        ctx.store.write(st);
        return false;
      }

      if (!ctx.router.isTowerPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goTowerPage();
        return true;
      }

      const startBtn = document.querySelector("#towerstart img[onclick*='init_battle(1)']");
      if (!startBtn) {
        st.running = false;
        st.resumeAfter = 0;
        st.lastCycleResult = "finished";
        ctx.store.write(st);
        return false;
      }

      st.resumeAfter = nextResumeAt();
      startBtn.click();
      st.running = false;
      st.resumeAfter = 0;
      st.lastCycleResult = "started";
      ctx.store.write(st);
      return true;
    }
  };

  const AutoArenaModule = {
    id: "auto-arena",
    name: "自动AR",
    tab: "startup",
    timer: null,
    minStamina: 75,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      return this.isRunning(ctx) ? "执行中" : "空闲";
    },

    start(ctx, options) {
      const singleBattle = !!(options && options.sequenceMode);
      ctx.store.write({ running: true, resumeAfter: 0, singleBattle, lastCycleResult: "", lastStamina: null });
      this.scheduleRun(ctx, oneToTwoSecDelay());
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

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.runOnce(ctx);
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      const actionTaken = await this.runStep(ctx);
      if (!actionTaken) {
        const st = ctx.store.read();
        if (st.running) this.scheduleRun(ctx, oneToTwoSecDelay());
      }
      ctx.refreshUi();
    },

    async runStep(ctx) {
      const st = ctx.store.read();
      if (!st.running) return false;
      if ((st.resumeAfter || 0) > Date.now()) return false;

      if (ctx.router.getWorld() !== "isekai") {
        st.running = false;
        ctx.store.write(st);
        return false;
      }

      if (ctx.router.isOtherBattleSubPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goArenaPage();
        return true;
      }

      if (!ctx.router.isArenaPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goArenaPage();
        return true;
      }

      const stamina = readStaminaValue();
      if (Number.isFinite(stamina)) st.lastStamina = stamina;
      if (!Number.isFinite(stamina) || stamina <= this.minStamina) {
        st.running = false;
        st.resumeAfter = 0;
        st.lastCycleResult = "stamina_low";
        ctx.store.write(st);
        return false;
      }

      const bottomBtn = pickBottomArenaStartButton();
      if (!bottomBtn || !clickArenaStartButton(bottomBtn)) {
        const seq = readSequenceState();
        if (stamina > this.minStamina && !!seq.towerDone) {
          const grStarted = await startIsekaiGrindFestByRequest();
          if (!grStarted) {
            if (st.singleBattle) {
              st.running = false;
              st.resumeAfter = 0;
            } else {
              st.resumeAfter = nextResumeAt();
            }
            st.lastCycleResult = "gr_request_failed";
            ctx.store.write(st);
            return false;
          }
          st.lastCycleResult = "started";
          if (st.singleBattle) {
            st.running = false;
            st.resumeAfter = 0;
          } else {
            st.resumeAfter = nextResumeAt();
          }
          ctx.store.write(st);
          return true;
        }

        st.running = false;
        st.resumeAfter = 0;
        st.lastCycleResult = "no_start_button";
        ctx.store.write(st);
        return false;
      }

      st.lastCycleResult = "started";
      if (st.singleBattle) {
        st.running = false;
        st.resumeAfter = 0;
      } else {
        st.resumeAfter = nextResumeAt();
      }
      ctx.store.write(st);
      return true;
    }
  };

  const AutoCreateMonsterModule = {
    id: "auto-create-monster",
    name: "自动建怪",
    tab: "monster",
    timer: null,
    defaultTarget: 200,
    maxFailures: 2,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      const st = ctx.store.read();
      if (!st.running) return "空闲";
      const created = Number(st.created || 0);
      const target = Number(st.target || this.defaultTarget);
      return `执行中(${created}/${target})`;
    },

    start(ctx) {
      const prev = ctx.store.read();
      const target = Number.isFinite(Number(prev.target)) && Number(prev.target) > 0
        ? Number(prev.target)
        : this.defaultTarget;
      ctx.store.write({
        running: true,
        created: 0,
        target,
        failures: 0,
        resumeAfter: 0
      });
      this.scheduleRun(ctx, oneToTwoSecDelay());
      ctx.refreshUi();
    },

    stop(ctx) {
      const st = ctx.store.read();
      st.running = false;
      st.resumeAfter = 0;
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

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx).catch(() => {
          const st = ctx.store.read();
          st.running = false;
          st.resumeAfter = 0;
          ctx.store.write(st);
          ctx.refreshUi();
        });
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      const st = ctx.store.read();
      if (!st.running) return;
      if ((st.resumeAfter || 0) > Date.now()) {
        this.scheduleRun(ctx, (st.resumeAfter || 0) - Date.now());
        return;
      }

      const created = Number(st.created || 0);
      const target = Number(st.target || this.defaultTarget);
      if (created >= target) {
        st.running = false;
        st.resumeAfter = 0;
        ctx.store.write(st);
        ctx.refreshUi();
        return;
      }

      if (!ctx.router.isMonsterLabPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goMonsterLabPage();
        return;
      }

      const ok = await this.createOneMonster();
      if (ok) {
        st.created = created + 1;
        st.failures = 0;
        st.resumeAfter = Date.now() + 1000 + Math.floor(Math.random() * 1001);
        ctx.store.write(st);
        this.scheduleRun(ctx, st.resumeAfter - Date.now());
      } else {
        const failures = Number(st.failures || 0) + 1;
        st.failures = failures;
        if (failures >= this.maxFailures) {
          st.running = false;
          st.resumeAfter = 0;
          ctx.store.write(st);
          ctx.refreshUi();
          return;
        }
        st.resumeAfter = Date.now() + 1500 + Math.floor(Math.random() * 1101);
        ctx.store.write(st);
        this.scheduleRun(ctx, st.resumeAfter - Date.now());
      }

      ctx.refreshUi();
    },

    async createOneMonster() {
      const classKey = randomFrom(MONSTER_SAMPLE_CLASSES);
      const classId = Number(MONSTER_CLASS_MAP[classKey] || 0);
      const attacks = MONSTER_ATTACK_MAP[classKey] || [];
      const attack = randomFrom(attacks);
      if (!classId || !attack) return false;

      const params = new URLSearchParams();
      params.set("selected_class", String(classId));
      params.set("selected_patk", attack);

      try {
        await postForm("?s=Bazaar&ss=ml&create=new", params);
        return true;
      } catch {
        return false;
      }
    }
  };

  const AutoRenameMonsterModule = {
    id: "auto-rename-monster",
    name: "自动命名",
    tab: "monster",
    timer: null,
    maxFailures: 2,

    isRunning(ctx) {
      return !!ctx.store.read().running;
    },

    getStatus(ctx) {
      const st = ctx.store.read();
      if (!st.running) return "空闲";
      return `执行中(${Number(st.renamed || 0)})`;
    },

    start(ctx) {
      const prev = ctx.store.read();
      ctx.store.write({
        running: true,
        renamed: 0,
        failures: 0,
        processedSlots: [],
        useRailgunRule: !!prev.useRailgunRule,
        resumeAfter: 0
      });
      this.scheduleRun(ctx, 20);
      ctx.refreshUi();
    },

    renderOptions({ row, ctx, refresh }) {
      const st = ctx.store.read();
      const running = !!st.running;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!st.useRailgunRule;
      checkbox.disabled = running;
      checkbox.className = "hvtb-opt";
      checkbox.addEventListener("change", () => {
        const next = ctx.store.read();
        next.useRailgunRule = checkbox.checked;
        ctx.store.write(next);
        refresh();
      });

      const nameEl = row.querySelector(".hvtb-name");
      if (nameEl) nameEl.appendChild(checkbox);
    },

    stop(ctx) {
      const st = ctx.store.read();
      st.running = false;
      st.resumeAfter = 0;
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

    scheduleRun(ctx, delayMs) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.runOnce(ctx).catch(() => {
          const st = ctx.store.read();
          st.running = false;
          st.resumeAfter = 0;
          ctx.store.write(st);
          ctx.refreshUi();
        });
      }, Math.max(0, Number(delayMs) || 0));
    },

    async runOnce(ctx) {
      const st = ctx.store.read();
      if (!st.running) return;
      if ((st.resumeAfter || 0) > Date.now()) {
        this.scheduleRun(ctx, (st.resumeAfter || 0) - Date.now());
        return;
      }

      if (!ctx.router.isMonsterLabPage()) {
        st.resumeAfter = nextResumeAt();
        ctx.store.write(st);
        ctx.router.goMonsterLabPage();
        return;
      }

      const done = new Set((st.processedSlots || []).map((x) => Number(x)));
      const targets = readUnnamedMonsterSlots().filter((x) => !done.has(x.slot));
      if (targets.length === 0) {
        st.running = false;
        st.resumeAfter = 0;
        ctx.store.write(st);
        ctx.refreshUi();
        return;
      }

      const target = targets[0];
      const nextName = st.useRailgunRule
        ? buildMonsterNameByOrder(target.order)
        : buildRandomMonsterName();
      const ok = await renameMonster(target.slot, nextName);
      if (ok) {
        st.renamed = Number(st.renamed || 0) + 1;
        st.failures = 0;
        st.processedSlots = Array.from(done).concat([target.slot]);
        st.resumeAfter = Date.now() + 1000 + Math.floor(Math.random() * 1001);
        ctx.store.write(st);
        this.scheduleRun(ctx, st.resumeAfter - Date.now());
      } else {
        st.failures = Number(st.failures || 0) + 1;
        if (st.failures >= this.maxFailures) {
          st.running = false;
          st.resumeAfter = 0;
          ctx.store.write(st);
          ctx.refreshUi();
          return;
        }
        st.resumeAfter = Date.now() + 1500 + Math.floor(Math.random() * 1101);
        ctx.store.write(st);
        this.scheduleRun(ctx, st.resumeAfter - Date.now());
      }

      ctx.refreshUi();
    }
  };

  const AutoSellModule = {
    id: "auto-sell",
    name: "自动出售",
    tab: "sell",
    scheduleTimer: null,
    schedulePollMs: SELL_SCHEDULE_POLL_MS,
    defaultBidLabel: "买价",
    defaultAskLabel: "卖价",
    defaultCancelLabel: "取消",

    getStatus(ctx) {
      const st = ctx.store.read();
      if (!st.running) return "空闲";
      const done = Number(st.pageDone || 0);
      const total = Number(st.pageTotal || 0);
      const txt = total > 0 ? `${done}/${total}` : "准备中";
      return `${st.mode === "bid" ? "买价" : "卖价"}(${txt})`;
    },

    isRunning(ctx) {
      const st = ctx.store.read();
      return !!st.running;
    },

    start(ctx) {
      const st = ctx.store.read();
      const mode = (st.scheduleMode || "ask") === "bid" ? "bid" : "ask";
      this.startWithMode(ctx, mode, "manual");
    },

    startWithMode(ctx, mode, triggerType) {
      const trigger = triggerType === "scheduled" ? "scheduled" : "manual";
      const world = getSellWorld();
      const now = Date.now();
      let jobId = null;
      if (trigger === "scheduled") {
        jobId = `sell_${now}_${Math.floor(Math.random() * 9000) + 1000}`;
        if (!acquireSellScheduleLock(jobId, now)) return false;
      }
      const state = {
        running: true,
        mode: mode === "bid" ? "bid" : "ask",
        triggerType: trigger,
        world,
        index: 0,
        currentFilter: SELL_FILTERS[0],
        pageDone: 0,
        pageTotal: 0,
        startedAt: now,
        deferUntil: null,
        jobId,
        originUrl: trigger === "scheduled" ? this.getSafeOriginForSchedule() : null,
        scheduleEnabled: !!ctx.store.read().scheduleEnabled,
        scheduleMode: ctx.store.read().scheduleMode === "bid" ? "bid" : "ask",
        scheduleNextRunAt: Number.isFinite(ctx.store.read().scheduleNextRunAt) ? ctx.store.read().scheduleNextRunAt : null,
        lastRunAt: Number.isFinite(ctx.store.read().lastRunAt) ? ctx.store.read().lastRunAt : null,
        lastInterruptReason: ctx.store.read().lastInterruptReason || "",
        lastInterruptAt: Number(ctx.store.read().lastInterruptAt || 0)
      };
      ctx.store.write(state);
      ctx.refreshUi();
      this.runOnce(ctx).catch(() => {
        const fail = ctx.store.read();
        if (fail.triggerType === "scheduled") this.stopScheduledRunState(fail);
        else this.stopManualRunState(fail);
        ctx.store.write(fail);
        ctx.refreshUi();
      });
      return true;
    },

    stop(ctx) {
      const st = ctx.store.read();
      if (st.running) {
        if (st.triggerType === "scheduled") this.stopScheduledRunState(st);
        else this.stopManualRunState(st);
      }
      ctx.store.write(st);
      ctx.refreshUi();
    },

    stopManualRun(ctx) {
      const st = ctx.store.read();
      if (st.triggerType !== "manual") return;
      this.stopManualRunState(st);
      st.lastInterruptReason = "manual_cancel";
      st.lastInterruptAt = Date.now();
      ctx.store.write(st);
      ctx.refreshUi();
    },

    stopManualRunState(st) {
      st.running = false;
      st.pageDone = 0;
      st.pageTotal = 0;
      st.triggerType = null;
      st.jobId = null;
      st.originUrl = null;
      st.deferUntil = null;
    },

    stopScheduledRunState(st) {
      st.running = false;
      st.pageDone = 0;
      st.pageTotal = 0;
      st.triggerType = null;
      st.originUrl = null;
      st.deferUntil = null;
      releaseSellScheduleLock(st.jobId || "");
      st.jobId = null;
    },

    resume(ctx) {
      const st = ctx.store.read();
      if (st.scheduleEnabled) this.ensureSchedulePolling(ctx);
      else this.stopSchedulePolling();
      if (st.running) {
        this.runOnce(ctx).catch(() => {
          const fail = ctx.store.read();
          if (fail.triggerType === "scheduled") this.stopScheduledRunState(fail);
          else this.stopManualRunState(fail);
          ctx.store.write(fail);
          ctx.refreshUi();
        });
        return;
      }
      this.checkScheduledTrigger(ctx);
    },

    ensureSchedulePolling(ctx) {
      if (this.scheduleTimer) return;
      this.scheduleTimer = setInterval(() => {
        console.log("[HVTB][AutoSell] 正在检查是否需要出售");
        this.checkScheduledTrigger(ctx);
      }, this.schedulePollMs);
    },

    stopSchedulePolling() {
      if (!this.scheduleTimer) return;
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    },

    checkScheduledTrigger(ctx) {
      const st = ctx.store.read();
      if (!st.scheduleEnabled) return;
      if (Number.isFinite(st.deferUntil) && st.deferUntil > Date.now()) return;
      if (Number.isFinite(st.deferUntil) && st.deferUntil <= Date.now()) {
        st.deferUntil = null;
        ctx.store.write(st);
      }
      if (!Number.isFinite(st.scheduleNextRunAt)) {
        st.scheduleNextRunAt = buildNextSellCycleTime(st.lastRunAt);
        ctx.store.write(st);
      }
      if (st.scheduleNextRunAt <= Date.now()) {
        this.startWithMode(ctx, st.scheduleMode === "bid" ? "bid" : "ask", "scheduled");
      }
    },

    async ensureEnglishBeforeSellRead() {
      const toggle = document.getElementById("change-translate");
      if (!toggle) return;
      const txt = (toggle.textContent || "").trim();
      if (txt !== "英") return;
      toggle.click();
      await runDelay(120, 260);
    },

    async runOnce(ctx) {
      const st = ctx.store.read();
      if (!st.running) {
        if (st.scheduleEnabled && Number.isFinite(st.scheduleNextRunAt) && st.scheduleNextRunAt <= Date.now()) {
          this.startWithMode(ctx, st.scheduleMode === "bid" ? "bid" : "ask", "scheduled");
        }
        return;
      }

      if (this.handleScheduledInterruption(ctx)) return;

      await this.ensureEnglishBeforeSellRead();

      const world = st.world || getSellWorld();
      if (!isMkBrowseItemsPage()) {
        ctx.store.write(st);
        location.href = buildBrowseUrl(world, SELL_FILTERS[Number(st.index || 0)] || SELL_FILTERS[0]);
        return;
      }

      const currentFilter = getCurrentMkFilter();
      const currentIndex = SELL_FILTERS.indexOf(currentFilter);
      if (currentIndex < 0) {
        ctx.store.write(st);
        location.href = buildBrowseUrl(world, SELL_FILTERS[Number(st.index || 0)] || SELL_FILTERS[0]);
        return;
      }
      if (currentIndex !== Number(st.index || 0)) {
        st.index = currentIndex;
        ctx.store.write(st);
      }

      syncItemDataFromCurrentPage(world);
      const allItems = readSellItemsStore(world);
      const mode = st.mode === "bid" ? "bid" : "ask";
      const sellData = await fetchSellData(world, currentFilter);
      const itemsForFilter = allItems.filter((item) => item.link && item.link.includes(`filter=${currentFilter}`));
      updateItemsWithSellData(itemsForFilter, sellData, mode);
      writeSellItemsStore(world, allItems);

      const sellingList = buildSellingList(itemsForFilter, mode);
      st.currentFilter = currentFilter;
      st.pageDone = 0;
      st.pageTotal = sellingList.length;
      ctx.store.write(st);
      ctx.refreshUi();

      for (let i = 0; i < sellingList.length; i += 1) {
        const latest = ctx.store.read();
        if (!latest.running || latest.startedAt !== st.startedAt || latest.mode !== st.mode || latest.world !== st.world) return;
        const it = sellingList[i];
        const itemId = extractItemId(it.link);
        if (!itemId) continue;
        const token = await fetchFreshMarketToken(world, currentFilter, itemId);
        if (!token) continue;
        const href = `${buildBrowseUrl(world, currentFilter)}${it.link}`;
        const params = buildSellOrderParams(token, it.stock, it.price, it.sellorderUpdate);
        await postForm(href, params);
        latest.pageDone = i + 1;
        ctx.store.write(latest);
        ctx.refreshUi();
        await runDelay(3000, 6000);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= SELL_FILTERS.length) {
        const fin = ctx.store.read();
        const returnUrl = fin.triggerType === "scheduled" ? this.getSafeReturnUrl(fin.originUrl) : null;
        const totalBalance = readMarketTotalBalanceFromPage();
        saveMarketTotalBalance(world, totalBalance);
        fin.running = false;
        fin.pageDone = 0;
        fin.pageTotal = 0;
        fin.lastRunAt = Date.now();
        if (fin.scheduleEnabled) {
          fin.scheduleNextRunAt = buildNextSellCycleTime(fin.lastRunAt);
        }
        if (fin.triggerType === "scheduled") {
          releaseSellScheduleLock(fin.jobId || "");
        }
        fin.jobId = null;
        fin.triggerType = null;
        fin.originUrl = null;
        ctx.store.write(fin);
        ctx.refreshUi();
        if (returnUrl && returnUrl !== location.href) {
          location.href = returnUrl;
        }
        return;
      }

      st.index = nextIndex;
      ctx.store.write(st);
      location.href = buildBrowseUrl(world, SELL_FILTERS[nextIndex]);
    },

    getSafeOriginForSchedule() {
      try {
        const parsed = new URL(location.href);
        return parsed.toString();
      } catch {
        return null;
      }
    },

    getSafeReturnUrl(url) {
      if (!url || typeof url !== "string") return null;
      try {
        const parsed = new URL(url, location.origin);
        return parsed.toString();
      } catch {
        return null;
      }
    },

    handleScheduledInterruption(ctx) {
      const st = ctx.store.read();
      if (!st.running || st.triggerType !== "scheduled") return false;
      if (!isSellScheduleLockOwnedBy(st.jobId || "")) {
        st.running = false;
        st.jobId = null;
        st.deferUntil = null;
        ctx.store.write(st);
        return true;
      }

      const params = new URLSearchParams(location.search);
      const s = params.get("s") || "";
      const ss = params.get("ss") || "";
      const isBattle = s === "Battle";
      const isTargetWorld = getSellWorld() === "isekai";
      const isMkPage = isMkBrowseItemsPage();

      if (!isBattle && isTargetWorld && isMkPage) return false;

      const now = Date.now();
      const deferMsMin = 90 * 60 * 1000;
      const deferMsMax = 120 * 60 * 1000;
      const reason = isBattle ? "battle_other" : "other_page";

      st.running = false;
      st.pageDone = 0;
      st.pageTotal = 0;
      st.deferUntil = now + randomInt(deferMsMin, deferMsMax);
      st.lastInterruptReason = reason;
      st.lastInterruptAt = now;
      releaseSellScheduleLock(st.jobId || "");
      st.jobId = null;
      ctx.store.write(st);
      ctx.refreshUi();
      return true;
    },

    renderTabExtra({ container, ctx, refresh }) {
      const st = ctx.store.read();

      const card = document.createElement("div");
      card.className = "hvtb-sell-card";

      const modeRow = document.createElement("div");
      modeRow.className = "hvtb-sell-row";
      const modeLabel = document.createElement("span");
      modeLabel.textContent = "定期:";
      const bidLabel = document.createElement("label");
      const bidMode = document.createElement("input");
      bidMode.type = "radio";
      bidMode.name = "hvtb-sell-schedule-mode";
      bidMode.checked = (st.scheduleMode || "ask") === "bid";
      bidMode.addEventListener("change", () => {
        const next = ctx.store.read();
        next.scheduleMode = "bid";
        ctx.store.write(next);
        refresh();
      });
      bidLabel.appendChild(bidMode);
      bidLabel.appendChild(document.createTextNode("买价"));
      const askLabel = document.createElement("label");
      const askMode = document.createElement("input");
      askMode.type = "radio";
      askMode.name = "hvtb-sell-schedule-mode";
      askMode.checked = (st.scheduleMode || "ask") === "ask";
      askMode.addEventListener("change", () => {
        const next = ctx.store.read();
        next.scheduleMode = "ask";
        ctx.store.write(next);
        refresh();
      });
      askLabel.appendChild(askMode);
      askLabel.appendChild(document.createTextNode("卖价"));
      modeRow.appendChild(modeLabel);
      modeRow.appendChild(bidLabel);
      modeRow.appendChild(askLabel);

      const scheduleToggleBtn = document.createElement("button");
      scheduleToggleBtn.type = "button";
      scheduleToggleBtn.className = "hvtb-btn";
      scheduleToggleBtn.textContent = st.scheduleEnabled ? "定期停止" : "定期启动";
      scheduleToggleBtn.addEventListener("click", () => {
        const next = ctx.store.read();
        next.scheduleEnabled = !next.scheduleEnabled;
        if (next.scheduleEnabled) {
          if (!Number.isFinite(next.scheduleNextRunAt)) {
            next.scheduleNextRunAt = buildNextSellCycleTime(next.lastRunAt);
          }
          this.ensureSchedulePolling(ctx);
        } else {
          this.stopSchedulePolling();
          next.scheduleNextRunAt = null;
          if (next.running && next.triggerType === "scheduled") {
            next.running = false;
            next.deferUntil = null;
            next.pageDone = 0;
            next.pageTotal = 0;
            releaseSellScheduleLock(next.jobId || "");
            next.jobId = null;
            next.triggerType = null;
            next.originUrl = null;
          }
        }
        ctx.store.write(next);
        refresh();
      });
      modeRow.appendChild(scheduleToggleBtn);

      const resetCycleBtn = document.createElement("button");
      resetCycleBtn.type = "button";
      resetCycleBtn.className = "hvtb-btn";
      resetCycleBtn.textContent = "重置周期";
      resetCycleBtn.addEventListener("click", () => {
        const next = ctx.store.read();
        next.lastRunAt = null;
        next.scheduleNextRunAt = next.scheduleEnabled ? buildNextSellCycleTime(null) : null;
        ctx.store.write(next);
        refresh();
      });
      modeRow.appendChild(resetCycleBtn);

      card.appendChild(modeRow);

      const nextRun = document.createElement("div");
      nextRun.className = "hvtb-sell-status";
      nextRun.textContent = !st.scheduleEnabled
        ? "下轮出售: 未开启"
        : Number.isFinite(st.scheduleNextRunAt)
          ? `下轮出售: ${new Date(st.scheduleNextRunAt).toLocaleString()}`
          : "下轮出售: 计划中";
      card.appendChild(nextRun);

      const runStatus = document.createElement("div");
      runStatus.className = "hvtb-sell-status";
      runStatus.textContent = `运行状态: ${Number.isFinite(st.deferUntil) && st.deferUntil > Date.now() ? "中断" : (st.running ? "进行" : "待机")}`;
      card.appendChild(runStatus);

      const resumeStatus = document.createElement("div");
      resumeStatus.className = "hvtb-sell-status";
      resumeStatus.textContent = `恢复时间: ${Number.isFinite(st.deferUntil) && st.deferUntil > Date.now() ? new Date(st.deferUntil).toLocaleString() : "-"}`;
      card.appendChild(resumeStatus);

      const interruptStatus = document.createElement("div");
      interruptStatus.className = "hvtb-sell-status";
      interruptStatus.textContent = `最近中断原因: ${formatSellInterruptReason(st.lastInterruptReason)}`;
      card.appendChild(interruptStatus);

      container.appendChild(card);

      const manualCard = document.createElement("div");
      manualCard.className = "hvtb-sell-card";
      const manualTitle = document.createElement("div");
      manualTitle.className = "hvtb-sell-title";
      manualTitle.textContent = "手动出售";
      manualCard.appendChild(manualTitle);

      const manualButtons = document.createElement("div");
      manualButtons.className = "hvtb-sell-buttons";
      const manualBid = document.createElement("button");
      manualBid.type = "button";
      manualBid.className = "hvtb-btn";
      manualBid.textContent = st.running && st.mode === "bid"
        ? `${Number(st.pageDone || 0)}/${Number(st.pageTotal || 0)}`
        : this.defaultBidLabel;
      manualBid.addEventListener("click", () => {
        const runningId = Toolbox.getRunningModuleId();
        if (runningId && runningId !== this.id) return;
        this.startWithMode(ctx, "bid", "manual");
      });

      const manualAsk = document.createElement("button");
      manualAsk.type = "button";
      manualAsk.className = "hvtb-btn";
      manualAsk.textContent = st.running && st.mode === "ask"
        ? `${Number(st.pageDone || 0)}/${Number(st.pageTotal || 0)}`
        : this.defaultAskLabel;
      manualAsk.addEventListener("click", () => {
        const runningId = Toolbox.getRunningModuleId();
        if (runningId && runningId !== this.id) return;
        this.startWithMode(ctx, "ask", "manual");
      });

      const manualCancel = document.createElement("button");
      manualCancel.type = "button";
      manualCancel.className = "hvtb-btn";
      manualCancel.textContent = this.defaultCancelLabel;
      manualCancel.addEventListener("click", () => {
        this.stopManualRun(ctx);
        refresh();
      });

      const manualWrite = document.createElement("button");
      manualWrite.type = "button";
      manualWrite.className = "hvtb-btn";
      manualWrite.textContent = "写入";
      manualWrite.addEventListener("click", () => {
        const totalBalance = readMarketTotalBalanceFromPage();
        if (!Number.isFinite(totalBalance)) {
          alert("未识别到市场金额，请先手动切换到市场页面后再写入。");
          return;
        }
        saveMarketTotalBalance(getSellWorld(), totalBalance);
        refresh();
      });

      manualButtons.appendChild(manualBid);
      manualButtons.appendChild(manualAsk);
      manualButtons.appendChild(manualCancel);
      manualButtons.appendChild(manualWrite);
      manualCard.appendChild(manualButtons);
      container.appendChild(manualCard);
    }
  };

  const SellReportModule = {
    id: "sell-report",
    name: "市场记录",
    tab: "report",
    showInList: false,
    pollTimer: null,
    pollMs: 60 * 1000,
    sending: false,

    getStatus() {
      return "查看中";
    },

    isRunning() {
      return false;
    },

    normalizeState(raw) {
      const st = raw && typeof raw === "object" ? { ...raw } : {};
      return {
        reportEnabled: !!st.reportEnabled,
        accountId: typeof st.accountId === "string" ? st.accountId.trim() : "",
        pendingDateUtc: typeof st.pendingDateUtc === "string" ? st.pendingDateUtc : "",
        retryAt: Number.isFinite(st.retryAt) ? Number(st.retryAt) : 0,
        retryCount: Number.isFinite(st.retryCount) ? Number(st.retryCount) : 0,
        lastReportDateUtc: typeof st.lastReportDateUtc === "string" ? st.lastReportDateUtc : "",
        lastGiveUpDateUtc: typeof st.lastGiveUpDateUtc === "string" ? st.lastGiveUpDateUtc : "",
        lastAutoTriggerUtc: typeof st.lastAutoTriggerUtc === "string" ? st.lastAutoTriggerUtc : "",
        lastReportAt: Number.isFinite(st.lastReportAt) ? Number(st.lastReportAt) : 0,
        lastReportError: typeof st.lastReportError === "string" ? st.lastReportError : ""
      };
    },

    resume(ctx) {
      const st = this.normalizeState(ctx.store.read());
      ctx.store.write(st);
      if (st.reportEnabled) {
        this.ensurePolling(ctx);
        this.tick(ctx);
      } else {
        this.stopPolling();
      }
    },

    ensurePolling(ctx) {
      if (this.pollTimer) return;
      this.pollTimer = setInterval(() => {
        this.tick(ctx);
      }, this.pollMs);
    },

    stopPolling() {
      if (!this.pollTimer) return;
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    },

    tick(ctx) {
      const st = this.normalizeState(ctx.store.read());
      if (!st.reportEnabled) return;
      let changed = false;
      const now = Date.now();
      const todayUtc = formatUtcDate(now);
      const yesterdayUtc = buildYesterdayUtcDate(now);

      if (st.lastAutoTriggerUtc !== todayUtc) {
        st.lastAutoTriggerUtc = todayUtc;
        changed = true;
        if (!st.pendingDateUtc && st.lastReportDateUtc !== yesterdayUtc && st.lastGiveUpDateUtc !== yesterdayUtc) {
          st.pendingDateUtc = yesterdayUtc;
          st.retryAt = 0;
          st.retryCount = 0;
        }
      }

      if (changed) ctx.store.write(st);
      if (!st.pendingDateUtc) return;
      if (Number.isFinite(st.retryAt) && st.retryAt > now) return;
      this.sendPendingReport(ctx);
    },

    async sendPendingReport(ctx) {
      if (this.sending) return;
      this.sending = true;
      try {
        const st = this.normalizeState(ctx.store.read());
        if (!st.reportEnabled || !st.pendingDateUtc) return;
        const now = Date.now();

        if (!REPORT_ENDPOINT) {
          st.pendingDateUtc = "";
          st.retryAt = 0;
          st.retryCount = 0;
          ctx.store.write(st);
          ctx.refreshUi();
          return;
        }

        if (!st.accountId || !REPORT_API_KEY) {
          st.lastReportError = "缺少汇报配置";
          st.retryCount = Number(st.retryCount || 0) + 1;
          if (st.retryCount >= REPORT_MAX_RETRY) {
            st.lastGiveUpDateUtc = st.pendingDateUtc;
            st.pendingDateUtc = "";
            st.retryAt = 0;
            st.retryCount = 0;
            st.lastReportError = "缺少汇报配置(已达重试上限)";
            ctx.store.write(st);
            ctx.refreshUi();
            return;
          }
          st.retryAt = now + computeReportRetryDelayMs(st.retryCount - 1);
          ctx.store.write(st);
          ctx.refreshUi();
          return;
        }

        const snapshot = readMarketTotalBalanceSnapshot();
        const aadbDaily = await readAadbDailySummary(st.pendingDateUtc);
        const payload = {
          account_id: st.accountId,
          client_time_utc: new Date(now).toISOString(),
          report_date_utc: st.pendingDateUtc,
          source: "hvtb",
          version: "3.0.0",
          market_balances: {
            main: Number.isFinite(snapshot.main.totalBalance) ? Math.round(snapshot.main.totalBalance) : null,
            isekai: Number.isFinite(snapshot.isekai.totalBalance) ? Math.round(snapshot.isekai.totalBalance) : null
          },
          market_balance_saved_at: {
            main: Number.isFinite(snapshot.main.savedAt) ? Math.round(snapshot.main.savedAt) : null,
            isekai: Number.isFinite(snapshot.isekai.savedAt) ? Math.round(snapshot.isekai.savedAt) : null
          },
          aadb_daily_by_world: {
            main: aadbDaily.main,
            isekai: aadbDaily.isekai
          },
          aadb_status: aadbDaily.status,
          idempotency_key: `${st.accountId}:${st.pendingDateUtc}`
        };

        const body = JSON.stringify(payload);
        const timestamp = String(now);
        const signature = await hmacSha256Hex(REPORT_API_KEY, `${timestamp}.${body}`);
        const res = await fetch(REPORT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Account-Id": st.accountId,
            "X-Timestamp": timestamp,
            "X-Signature": signature
          },
          body
        });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);

        st.lastReportError = "";
        st.lastReportAt = now;
        st.lastReportDateUtc = st.pendingDateUtc;
        st.pendingDateUtc = "";
        st.retryAt = 0;
        st.retryCount = 0;
        st.lastGiveUpDateUtc = "";
        ctx.store.write(st);
        ctx.refreshUi();
      } catch (err) {
        const st = this.normalizeState(ctx.store.read());
        st.lastReportError = err && err.message ? String(err.message) : "UNKNOWN_ERROR";
        st.retryCount = Number(st.retryCount || 0) + 1;
        if (st.retryCount >= REPORT_MAX_RETRY) {
          st.lastGiveUpDateUtc = st.pendingDateUtc;
          st.pendingDateUtc = "";
          st.retryAt = 0;
          st.retryCount = 0;
          st.lastReportError = `${st.lastReportError}(已达重试上限)`;
          ctx.store.write(st);
          ctx.refreshUi();
          return;
        }
        st.retryAt = Date.now() + computeReportRetryDelayMs(st.retryCount - 1);
        ctx.store.write(st);
        ctx.refreshUi();
      } finally {
        this.sending = false;
      }
    },

    renderTabExtra({ container, ctx, refresh }) {
      const st = this.normalizeState(ctx.store.read());
      const snapshot = readMarketTotalBalanceSnapshot();

      const configCard = document.createElement("div");
      configCard.className = "hvtb-sell-card";

      const configTitle = document.createElement("div");
      configTitle.className = "hvtb-sell-title";
      configTitle.textContent = "汇报配置";
      configCard.appendChild(configTitle);

      const accountRow = document.createElement("div");
      accountRow.className = "hvtb-sell-row";
      const accountLabel = document.createElement("span");
      accountLabel.textContent = "账号ID:";
      const accountInput = document.createElement("input");
      accountInput.type = "text";
      accountInput.className = "hvtb-input hvtb-grow";
      accountInput.maxLength = 64;
      accountInput.placeholder = "手动输入账号ID";
      accountInput.value = st.accountId;
      accountRow.appendChild(accountLabel);
      accountRow.appendChild(accountInput);
      configCard.appendChild(accountRow);

      const currentId = document.createElement("div");
      currentId.className = "hvtb-sell-status";
      currentId.textContent = `当前账号ID: ${st.accountId || "-"}`;
      configCard.appendChild(currentId);

      const actionRow = document.createElement("div");
      actionRow.className = "hvtb-sell-buttons";
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "hvtb-btn";
      saveButton.textContent = "保存配置";
      saveButton.addEventListener("click", () => {
        const next = this.normalizeState(ctx.store.read());
        next.accountId = String(accountInput.value || "").trim();
        ctx.store.write(next);
        refresh();
      });

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "hvtb-btn";
      toggleButton.textContent = st.reportEnabled ? "汇报停止" : "汇报启动";
      toggleButton.addEventListener("click", () => {
        const next = this.normalizeState(ctx.store.read());
        next.reportEnabled = !next.reportEnabled;
        if (next.reportEnabled) {
          this.ensurePolling(ctx);
          this.tick(ctx);
        } else {
          next.pendingDateUtc = "";
          next.retryAt = 0;
          next.retryCount = 0;
          this.stopPolling();
        }
        ctx.store.write(next);
        refresh();
      });

      const sendNowButton = document.createElement("button");
      sendNowButton.type = "button";
      sendNowButton.className = "hvtb-btn";
      sendNowButton.textContent = "立即汇报";
      sendNowButton.addEventListener("click", () => {
        const next = this.normalizeState(ctx.store.read());
        next.pendingDateUtc = buildYesterdayUtcDate(Date.now());
        next.retryAt = 0;
        next.retryCount = 0;
        ctx.store.write(next);
        this.sendPendingReport(ctx);
        refresh();
      });

      actionRow.appendChild(saveButton);
      actionRow.appendChild(toggleButton);
      actionRow.appendChild(sendNowButton);
      configCard.appendChild(actionRow);
      container.appendChild(configCard);

      const statusCard = document.createElement("div");
      statusCard.className = "hvtb-sell-card";
      const statusTitle = document.createElement("div");
      statusTitle.className = "hvtb-sell-title";
      statusTitle.textContent = "汇报状态";
      statusCard.appendChild(statusTitle);

      const status1 = document.createElement("div");
      status1.className = "hvtb-sell-status";
      status1.textContent = `开关: ${st.reportEnabled ? "已开启" : "未开启"}`;
      statusCard.appendChild(status1);

      const status6 = document.createElement("div");
      status6.className = "hvtb-sell-status";
      status6.textContent = `最近成功: ${formatRecordedTimeUtc8(st.lastReportAt)}`;
      statusCard.appendChild(status6);

      const status7 = document.createElement("div");
      status7.className = "hvtb-sell-status";
      status7.textContent = `最近错误: ${st.lastReportError || "-"}`;
      statusCard.appendChild(status7);

      container.appendChild(statusCard);

      const card = document.createElement("div");
      card.className = "hvtb-sell-card";

      const title = document.createElement("div");
      title.className = "hvtb-sell-title";
      title.textContent = "市场记录金额";
      card.appendChild(title);

      const mainBalance = document.createElement("div");
      mainBalance.className = "hvtb-sell-status";
      mainBalance.textContent = `主世界: ${formatRecordedCredits(snapshot.main.totalBalance)}`;
      card.appendChild(mainBalance);

      const mainTime = document.createElement("div");
      mainTime.className = "hvtb-sell-status";
      mainTime.textContent = `主世界记录时间: ${formatRecordedTime(snapshot.main.savedAt)}`;
      card.appendChild(mainTime);

      const isekaiBalance = document.createElement("div");
      isekaiBalance.className = "hvtb-sell-status";
      isekaiBalance.textContent = `异世界: ${formatRecordedCredits(snapshot.isekai.totalBalance)}`;
      card.appendChild(isekaiBalance);

      const isekaiTime = document.createElement("div");
      isekaiTime.className = "hvtb-sell-status";
      isekaiTime.textContent = `异世界记录时间: ${formatRecordedTime(snapshot.isekai.savedAt)}`;
      card.appendChild(isekaiTime);

      container.appendChild(card);
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

  function buildEquipSlotUrl(world, slotId) {
    const base = world === "isekai"
      ? `${location.origin}/isekai/?s=Character&ss=eq`
      : `${location.origin}/?s=Character&ss=eq`;
    return `${base}&equip_slot=${Number(slotId)}`;
  }

  async function readEquipSlotPayload(world, slotId) {
    try {
      const slotUrl = buildEquipSlotUrl(world, slotId);
      const res = await fetch(slotUrl, { credentials: "same-origin" });
      if (!res.ok) return null;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const playerLevel = readPlayerLevelFromDoc(doc);
      const dyn = await readDynjsEquipMap(doc);
      const rows = Array.from(doc.querySelectorAll("#equiplist tr[onclick*='select_equip']"));
      let best = null;
      for (const row of rows) {
        const name = extractEquipName(row);
        if (!name) continue;
        const eid = extractEquipId(row);
        let level = playerLevel;
        let condition = NaN;
        if (eid > 0 && dyn.has(eid)) {
          const extra = parseEquipHtmlInfo(String(dyn.get(eid)?.d || ""));
          if (Number.isFinite(extra.level)) level = extra.level;
          if (Number.isFinite(extra.condition)) condition = extra.condition;
        }
        if (Number.isFinite(condition) && condition < 20) continue;
        const score = scoreEquipNameWithLevel(name, level, slotId);
        if (!Number.isFinite(score)) continue;
        const candidate = { eid, name, level, condition, score };
        if (!best || candidate.score > best.score) best = candidate;
      }

      const form = doc.getElementById("equipform");
      if (!form || !best) return null;
      const actionAttr = form.getAttribute("action") || slotUrl;
      const actionUrl = new URL(actionAttr, location.origin).toString();

      const baseParams = new URLSearchParams();
      const hiddenInputs = Array.from(form.querySelectorAll("input[type='hidden'][name]"));
      for (const input of hiddenInputs) {
        const name = input.getAttribute("name") || "";
        if (!name) continue;
        baseParams.append(name, input.getAttribute("value") || "");
      }
      if (!baseParams.get("equip_slot")) baseParams.set("equip_slot", String(Number(slotId)));

      const currentEid = readCurrentEquippedEid(doc);
      return { actionUrl, baseParams, best, currentEid };
    } catch {
      return null;
    }
  }

  function readCurrentEquippedEid(doc) {
    const selected = doc.querySelector("#equiplist input[name='eqids[]'][checked]") || doc.querySelector("#equiplist input[name='eqids[]']:checked");
    if (selected) {
      const n = Number(selected.getAttribute("value") || "0");
      if (Number.isFinite(n) && n > 0) return n;
    }

    const scriptText = Array.from(doc.querySelectorAll("script")).map((s) => s.textContent || "").join("\n");
    const show = scriptText.match(/showequipped_eqid\s*=\s*(\d+)/);
    if (show) {
      const n = Number(show[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const init = scriptText.match(/initselect\s*=\s*\[(\d+)\]/);
    if (init) {
      const n = Number(init[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  }

  async function submitEquipSelection(payload, eid) {
    if (!payload || !payload.actionUrl || !payload.baseParams) return false;
    const id = Number(eid);
    if (!Number.isFinite(id) || id <= 0) return false;

    const params = new URLSearchParams(payload.baseParams.toString());
    params.set("action", "equip");
    params.delete("eqids[]");
    params.append("eqids[]", String(id));

    try {
      await postForm(payload.actionUrl, params);
      return true;
    } catch {
      return false;
    }
  }

  async function readDynjsEquipMap(doc) {
    const map = new Map();
    const script = doc.querySelector('script[src*="/dynjs/"][src*="equip-"]');
    if (!script) return map;
    const src = script.getAttribute("src") || "";
    if (!src) return map;
    const url = new URL(src, location.origin).toString();
    if (DYNJS_EQUIP_CACHE.has(url)) return DYNJS_EQUIP_CACHE.get(url);
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return map;
      const text = await res.text();
      const m = text.match(/dynjs_equip\s*=\s*(\{[\s\S]*?\});/);
      if (!m) return map;
      const raw = JSON.parse(m[1]);
      for (const [eid, value] of Object.entries(raw || {})) {
        const n = Number(eid);
        if (Number.isFinite(n) && n > 0) map.set(n, value || {});
      }
      DYNJS_EQUIP_CACHE.set(url, map);
      return map;
    } catch {
      return map;
    }
  }

  function extractEquipName(row) {
    const label = row.querySelector("label");
    if (!label) return "";
    return (label.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractEquipId(node) {
    const text = [
      node?.getAttribute?.("onmouseover") || "",
      node?.querySelector?.("[onmouseover]")?.getAttribute?.("onmouseover") || ""
    ].join(" ");
    const m = text.match(/(?:hover_equip|equips\.set)\((\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function parseEquipHtmlInfo(html) {
    const levelMatch = html.match(/Level\s+(\d+)/i);
    const conditionMatch = html.match(/Condition\s*:\s*(\d+(?:\.\d+)?)%/i);
    return {
      level: levelMatch ? Number(levelMatch[1]) : NaN,
      condition: conditionMatch ? Number(conditionMatch[1]) : NaN
    };
  }

  function scoreEquipNameWithLevel(name, level, slotId) {
    const normalized = (name || "").replace(/[^\w\s]+/g, " ").toLowerCase();
    const tokens = new Set((normalized.match(/[a-z]+/g) || []));
    let score = 0;

    const slot = Number(slotId);
    if (slot === 1) {
      const mainhandRank = [
        ["rapier", 6000],
        ["shortsword", 5200],
        ["wakizashi", 4300],
        ["dagger", 3600],
        ["club", 2800],
        ["axe", 2200]
      ];
      let matched = false;
      for (const [k, v] of mainhandRank) {
        if (tokens.has(k)) {
          score += v;
          matched = true;
          break;
        }
      }
      if (!matched) return Number.NEGATIVE_INFINITY;
    } else if (slot === 2) {
      const hasShield = tokens.has("buckler") || tokens.has("kite") || tokens.has("tower") || tokens.has("force") || tokens.has("shield");
      if (!hasShield) return Number.NEGATIVE_INFINITY;

      if (tokens.has("battlecaster")) score += 5500;
      if (tokens.has("barrier")) score += 5500;

      if (tokens.has("kite") || tokens.has("tower")) score += 4500;
      else if (tokens.has("force")) score += 3000;
      else if (tokens.has("buckler")) score += 1500;
      else score += 800;
    } else if ([11, 12, 13, 14, 15].includes(slot)) {
      const hasHeavyArmor = tokens.has("chain") || tokens.has("plate") || tokens.has("reactive") || tokens.has("power");
      const hasShadeArcanist = tokens.has("shade") && tokens.has("arcanist");

      if (slot === 13 || slot === 14) {
        if (!hasHeavyArmor && !hasShadeArcanist) return Number.NEGATIVE_INFINITY;
        if (hasShadeArcanist) score += 10000;
      } else {
        if (!hasHeavyArmor) return Number.NEGATIVE_INFINITY;
      }

      if (tokens.has("reactive")) score += 2200;
      if (tokens.has("power")) score += 2200;
      if (tokens.has("barrier")) score += 3500;
      if (tokens.has("protection")) score += 3500;
    }

    const qualityRank = {
      peerless: 8,
      legendary: 7,
      magnificent: 6,
      exquisite: 5,
      superior: 4,
      average: 3,
      fair: 2,
      crude: 1
    };
    for (const [k, v] of Object.entries(qualityRank)) {
      if (tokens.has(k)) {
        score += v * 10000;
        break;
      }
    }
    if (Number.isFinite(level)) score += Math.max(0, Math.floor(level)) * 30;

    return score;
  }

  function readPlayerLevelFromDoc(doc) {
    const text = doc.getElementById("level_readout")?.textContent || "";
    const m = text.match(/Lv\.(\d+)/i);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  }

  Toolbox.register(AutoStatModule);
  Toolbox.register(AutoEquipModule);
  Toolbox.register(SkillModule);
  Toolbox.register(AutoTowerModule);
  Toolbox.register(AutoArenaModule);
  Toolbox.register(AutoCreateMonsterModule);
  Toolbox.register(AutoRenameMonsterModule);
  Toolbox.register(AutoSellModule);
  Toolbox.register(SellReportModule);
  Toolbox.init();
})();
