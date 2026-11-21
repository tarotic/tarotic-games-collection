/* Spider Solitaire UI: rendering, drag-and-drop, undo, settings. Rules live in spider-core.js. */
(function () {
  const Spider = window.SpiderCore;
  const Bank = window.SpiderSeedBank || { 1: [], 2: [], 4: [] };
  const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SETTINGS_KEY = "spider-solitaire-settings";
  const DEFAULT_SETTINGS = { back: "blue", face: "classic", ui: "light", bg: "#1d5c3a" };

  const boardEl = document.getElementById("board");
  const stockEl = document.getElementById("stock");
  const undoEl = document.getElementById("undo");
  const movesEl = document.getElementById("moves");
  const completedEl = document.getElementById("completed");
  const statusEl = document.getElementById("status");
  const suitsEl = document.getElementById("suits");
  const dragLayer = document.getElementById("drag-layer");
  const settingsDialog = document.getElementById("settings");
  const backEl = document.getElementById("back-style");
  const faceEl = document.getElementById("face-style");
  const uiEl = document.getElementById("ui-theme");
  const bgEl = document.getElementById("bg-color");
  const DealAnim = window.SpiderDealAnim;
  const dealLayer = document.getElementById("deal-layer");
  const dealGuard = DealAnim.createDealGuard();
  let dealFlights = []; // Animation objects of the running deal

  let current = null; // current game state (immutable snapshots)
  let history = []; // previous states for undo
  let moveCount = 0;
  let lastSeed = null;
  let settings = loadSettings();
  let drag = null;

  // ---------- Settings ----------

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      /* storage unavailable: settings still apply for this visit */
    }
  }

  function applySettings() {
    boardEl.className = `board face-${settings.face} back-${settings.back}`;
    stockEl.className = `stock back-${settings.back}`;
    dealLayer.className = `deal-layer face-${settings.face} back-${settings.back}`;
    document.body.className = `ui-${settings.ui}`;
    document.documentElement.style.setProperty("--bg", settings.bg);
    document.body.style.background = settings.bg;
    backEl.value = settings.back;
    faceEl.value = settings.face;
    uiEl.value = settings.ui;
    bgEl.value = settings.bg;
  }

  function updateSetting(key, value) {
    settings[key] = value;
    saveSettings();
    applySettings();
  }

  // ---------- Game flow ----------

  function newGame() {
    cancelDealAnimation();
    const suitCount = Number(suitsEl.value);
    const deals = Bank[suitCount] || [];
    if (deals.length === 0) {
      setStatus(`No winnable ${suitCount}-suit deals are available.`);
      render();
      return;
    }
    // Pick a random winnable deal, avoiding an immediate repeat when possible.
    let entry = deals[Math.floor(Math.random() * deals.length)];
    if (deals.length > 1 && entry.seed === lastSeed) {
      entry = deals[(deals.indexOf(entry) + 1) % deals.length];
    }
    lastSeed = entry.seed;
    current = Spider.newGame(suitCount, entry.seed);
    history = [];
    moveCount = 0;
    setStatus(`New ${suitCount}-suit game. Every deal in this game is winnable.`);
    render();
  }

  function doMove(move) {
    const next = Spider.applyMove(current, move);
    if (!next) return false;
    history.push(current);
    current = next;
    moveCount++;
    render();
    if (Spider.isWon(current)) {
      setStatus(`You won in ${moveCount} moves! Start a new game to play again.`, true);
    } else if (Spider.legalMoves(current).length === 0) {
      setStatus("No moves left. Undo to try another line, or start a new game.");
    }
    return true;
  }

  function undo() {
    if (dealGuard.isBusy()) return;
    if (history.length === 0) return;
    current = history.pop();
    moveCount--;
    render();
    setStatus("Undid the last move.");
  }

  function dealRow() {
    if (dealGuard.isBusy()) return;
    if (!Spider.canDeal(current)) {
      setStatus(current.stock.length === 0
        ? "No cards left to deal."
        : "Every column needs at least one card before you can deal.");
      return;
    }
    const before = current;
    if (!doMove({ type: "deal" })) return;
    const steps = DealAnim.dealPlan(before, current, { reduceMotion: !canAnimateDeal() });
    if (steps) animateDeal(steps);
  }

  function setStatus(text, won) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", Boolean(won));
  }

  // ---------- Rendering ----------

  function cardEl(card, col, idx) {
    const el = document.createElement("div");
    if (!card.faceUp) {
      el.className = "card down";
      return el;
    }
    const label = RANKS[card.rank];
    const sym = Spider.SUIT_SYMBOLS[card.suit];
    el.className = `card up ${Spider.RED_SUITS[card.suit] ? "red" : "black"}`;
    el.dataset.col = col;
    el.dataset.idx = idx;
    el.setAttribute("aria-label", `${label} of ${card.suit}`);
    el.innerHTML =
      `<span class="corner tl">${label}<span class="suit">${sym}</span></span>` +
      `<span class="corner br">${label}<span class="suit">${sym}</span></span>` +
      `<span class="center"><span class="pip">${sym}</span><span class="big">${label}</span></span>`;
    return el;
  }

  function render() {
    boardEl.textContent = "";
    current.columns.forEach((column, col) => {
      const colEl = document.createElement("div");
      colEl.className = "column" + (column.length === 0 ? " empty" : "");
      colEl.dataset.col = col;
      column.forEach((card, idx) => {
        const el = cardEl(card, col, idx);
        if (idx > 0) el.classList.add(column[idx - 1].faceUp ? "after-up" : "after-down");
        colEl.appendChild(el);
      });
      boardEl.appendChild(colEl);
    });

    const dealsLeft = Math.floor(current.stock.length / 10);
    stockEl.textContent = "";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${dealsLeft} deal${dealsLeft === 1 ? "" : "s"} left`;
    stockEl.appendChild(count);
    stockEl.disabled = current.stock.length === 0 || dealGuard.isBusy();

    undoEl.disabled = history.length === 0 || dealGuard.isBusy();
    movesEl.textContent = String(moveCount);
    completedEl.textContent = String(current.completed);
  }

  // ---------- Deal animation ----------

  function canAnimateDeal() {
    return typeof Element.prototype.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function flyingCardEl(card) {
    const fly = document.createElement("div");
    fly.className = "deal-fly";
    const back = document.createElement("div");
    back.className = "card down deal-back";
    const front = cardEl(card, -1, -1);
    front.classList.add("deal-front");
    fly.appendChild(back);
    fly.appendChild(front);
    return fly;
  }

  function dealTargetRect(step) {
    const colEl = boardEl.querySelector(`.column[data-col="${step.col}"]`);
    if (step.landIndex >= 0) {
      const r = colEl.children[step.landIndex].getBoundingClientRect();
      return { left: r.left, top: r.top };
    }
    if (colEl.children.length > 0) {
      const off = parseFloat(getComputedStyle(boardEl).getPropertyValue("--off-up")) || 28;
      const r = colEl.lastElementChild.getBoundingClientRect();
      return { left: r.left, top: r.top + off };
    }
    const r = colEl.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }

  function animateDeal(steps) {
    const token = dealGuard.begin();
    stockEl.disabled = true;
    undoEl.disabled = true;
    const stockRect = stockEl.getBoundingClientRect();
    steps.forEach((step, i) => {
      const target = dealTargetRect(step);
      const colEl = boardEl.querySelector(`.column[data-col="${step.col}"]`);
      const real = step.landIndex >= 0 ? colEl.children[step.landIndex] : null;
      if (real) real.classList.add("deal-pending");
      const fly = flyingCardEl(step.card);
      fly.style.left = `${target.left}px`;
      fly.style.top = `${target.top}px`;
      dealLayer.appendChild(fly);
      const dx = stockRect.left - target.left;
      const dy = stockRect.top - target.top;
      const anim = fly.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) perspective(900px) rotateY(0deg)` },
          { transform: "translate(0px, 0px) perspective(900px) rotateY(180deg)" },
        ],
        { duration: step.duration, delay: step.delay, easing: "ease-in-out", fill: "both" }
      );
      dealFlights.push(anim);
      anim.onfinish = () => {
        if (!dealGuard.isCurrent(token)) return;
        fly.remove();
        if (real) real.classList.remove("deal-pending");
        if (i === steps.length - 1) finishDeal(token);
      };
    });
  }

  function finishDeal(token) {
    if (!dealGuard.end(token)) return;
    dealFlights = [];
    dealLayer.textContent = "";
    render();
  }

  function cancelDealAnimation() {
    dealGuard.cancel();
    dealFlights.forEach((a) => a.cancel());
    dealFlights = [];
    dealLayer.textContent = "";
  }

  // ---------- Drag and drop ----------

  function columnAt(x, y) {
    const target = document.elementFromPoint(x, y);
    const colEl = target && target.closest(".column");
    return colEl ? Number(colEl.dataset.col) : null;
  }

  function markDrop(x, y) {
    const target = columnAt(x, y);
    boardEl.querySelectorAll(".column").forEach((c) => c.classList.remove("drop-ok", "drop-bad"));
    if (target === null || target === drag.col) return;
    const colEl = boardEl.querySelector(`.column[data-col="${target}"]`);
    const ok = Spider.canMoveRun(current, drag.col, drag.count, target);
    colEl.classList.add(ok ? "drop-ok" : "drop-bad");
  }

  function clearDropMarks() {
    boardEl.querySelectorAll(".column").forEach((c) => c.classList.remove("drop-ok", "drop-bad"));
  }

  function endDrag() {
    if (!drag) return null;
    const finished = drag;
    drag = null;
    finished.ghost.remove();
    clearDropMarks();
    return finished;
  }

  boardEl.addEventListener("pointerdown", (e) => {
    if (dealGuard.isBusy()) return;
    if (e.button !== 0) return;
    const el = e.target.closest(".card.up");
    if (!el) return;
    const col = Number(el.dataset.col);
    const idx = Number(el.dataset.idx);
    const column = current.columns[col];
    const count = column.length - idx;
    // Only a face-up, same-suit, descending run can be picked up.
    if (count > Spider.runLength(column)) return;

    const colEl = el.parentElement;
    const sources = Array.from(colEl.children).slice(idx);
    const rect = el.getBoundingClientRect();
    const off = parseFloat(getComputedStyle(boardEl).getPropertyValue("--off-up")) || 28;

    const ghost = document.createElement("div");
    ghost.className = `ghost face-${settings.face}`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    sources.forEach((src, i) => {
      const clone = src.cloneNode(true);
      clone.classList.remove("after-up", "after-down", "hidden-drag");
      clone.style.position = "absolute";
      clone.style.margin = "0";
      clone.style.left = "0";
      clone.style.top = `${i * off}px`;
      ghost.appendChild(clone);
    });
    dragLayer.appendChild(ghost);

    drag = {
      col, count, sources, ghost,
      startX: e.clientX, startY: e.clientY,
      offX: e.clientX - rect.left, offY: e.clientY - rect.top,
      moved: false,
    };
    e.preventDefault();
  });

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
      drag.moved = true;
      drag.sources.forEach((s) => s.classList.add("hidden-drag"));
    }
    drag.ghost.style.left = `${e.clientX - drag.offX}px`;
    drag.ghost.style.top = `${e.clientY - drag.offY}px`;
    markDrop(e.clientX, e.clientY);
  });

  function finishPointer(e, cancelled) {
    const d = endDrag();
    if (!d) return;
    if (!d.moved) return;
    d.sources.forEach((s) => s.classList.remove("hidden-drag"));
    const target = cancelled ? null : columnAt(e.clientX, e.clientY);
    if (target !== null && target !== d.col) {
      const move = { type: "move", from: d.col, count: d.count, to: target };
      if (doMove(move)) return;
      setStatus("That move isn't allowed: a card can only go onto the next higher rank, or into an empty column.");
    }
    render(); // snap the run back to its original place
  }

  document.addEventListener("pointerup", (e) => finishPointer(e, false));
  document.addEventListener("pointercancel", (e) => finishPointer(e, true));

  // Double-click a run to send it to the best column automatically.
  boardEl.addEventListener("dblclick", (e) => {
    if (dealGuard.isBusy()) return;
    const el = e.target.closest(".card.up");
    if (!el) return;
    const col = Number(el.dataset.col);
    const idx = Number(el.dataset.idx);
    const column = current.columns[col];
    const count = column.length - idx;
    if (count > Spider.runLength(column)) return;
    let best = null;
    for (let to = 0; to < current.columns.length; to++) {
      if (!Spider.canMoveRun(current, col, count, to)) continue;
      const nonEmpty = current.columns[to].length > 0;
      if (best === null || (nonEmpty && current.columns[best].length === 0)) best = to;
      if (nonEmpty) break;
    }
    if (best === null) {
      setStatus("No column can take that run.");
      return;
    }
    doMove({ type: "move", from: col, count, to: best });
  });

  // ---------- Wiring ----------

  document.getElementById("new-game").addEventListener("click", newGame);
  undoEl.addEventListener("click", undo);
  stockEl.addEventListener("click", dealRow);
  suitsEl.addEventListener("change", newGame);

  document.addEventListener("keydown", (e) => {
    if (settingsDialog.open) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    applySettings();
    settingsDialog.showModal();
  });

  backEl.addEventListener("change", () => updateSetting("back", backEl.value));
  faceEl.addEventListener("change", () => updateSetting("face", faceEl.value));
  uiEl.addEventListener("change", () => updateSetting("ui", uiEl.value));
  bgEl.addEventListener("input", () => updateSetting("bg", bgEl.value));
  document.querySelectorAll("#swatches button").forEach((btn) => {
    btn.addEventListener("click", () => updateSetting("bg", btn.dataset.bg));
  });

  applySettings();
  newGame();
})();
