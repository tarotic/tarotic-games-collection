/*
 * Klondike UI: rendering, pointer drag-and-drop, double-click to foundation,
 * stock/waste, undo, auto-complete, move counter and timer.
 * All rules live in klondike-core.js.
 */
(function () {
  const Core = window.KlondikeCore;
  const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag
  const CARD_H = 118;
  const DOWN_STEP = 10;
  const UP_STEP = 26;

  const $ = (id) => document.getElementById(id);
  const els = {
    newDeal: $("new"),
    seed: $("seed"),
    playDeal: $("go"),
    draw: $("draw"),
    undo: $("undo"),
    auto: $("auto"),
    dealNum: $("deal-num"),
    moves: $("moves"),
    time: $("time"),
    message: $("message"),
    stock: $("stock"),
    waste: $("waste"),
    tableau: $("tableau"),
    foundations: Array.from(document.querySelectorAll(".foundation")),
    dragLayer: $("drag-layer"),
  };

  let state = null;
  let seed = 0;
  let history = []; // { state, moves } snapshots for undo
  let moves = 0;
  let elapsedMs = 0;
  let won = false;
  let drag = null;
  let dealAnimPending = false; // set for the next render after a new deal

  // ---- Helpers ------------------------------------------------------------

  function randomSeed() {
    return Math.floor(Math.random() * 1000000000) + 1;
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function showMessage(text) {
    els.message.textContent = text;
  }

  function makeCardEl(card) {
    const el = document.createElement("div");
    if (!card.faceUp) {
      el.className = "card down";
      return el;
    }
    el.className = "card" + (Core.isRed(card.suit) ? " red" : "");
    const sym = Core.SUIT_SYMBOLS[card.suit];
    const label = RANK_LABELS[card.rank];
    el.innerHTML =
      '<div class="corner"><span>' + label + "</span><span>" + sym + "</span></div>" +
      '<div class="pip">' + sym + "</div>" +
      '<div class="corner bottom"><span>' + label + "</span><span>" + sym + "</span></div>";
    el.setAttribute("aria-label", label + " of " + suitName(card.suit));
    return el;
  }

  function suitName(suit) {
    return { S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[suit];
  }

  // Source descriptor from a card element's dataset, or null if the card is not draggable.
  function sourceFromEl(el) {
    const d = el.dataset;
    if (d.kind === "waste") return { kind: "waste" };
    if (d.kind === "foundation") return { kind: "foundation", suit: d.suit };
    if (d.kind === "tableau") return { kind: "tableau", col: Number(d.col), index: Number(d.index) };
    return null;
  }

  // ---- Rendering ----------------------------------------------------------

  function render() {
    const dealingNow = dealAnimPending;
    dealAnimPending = false;

    // Stock
    els.stock.innerHTML = "";
    els.stock.classList.toggle("has-cards", state.stock.length > 0);
    if (state.stock.length) {
      const back = makeCardEl({ suit: "S", rank: 1, faceUp: false });
      back.style.position = "absolute";
      back.style.left = "0";
      back.style.top = "0";
      els.stock.appendChild(back);
    } else if (state.waste.length) {
      els.stock.textContent = "↻"; // recycle symbol: click to turn the waste back over
    }

    // Waste (only the top card is playable)
    els.waste.innerHTML = "";
    if (state.waste.length) {
      const top = state.waste[state.waste.length - 1];
      const el = makeCardEl(top);
      el.dataset.kind = "waste";
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      els.waste.appendChild(el);
    }

    // Foundations
    els.foundations.forEach((slot) => {
      const suit = slot.dataset.suit;
      const pile = state.foundations[suit];
      slot.innerHTML = "";
      if (pile.length) {
        const top = pile[pile.length - 1];
        const el = makeCardEl(top);
        el.dataset.kind = "foundation";
        el.dataset.suit = suit;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        slot.appendChild(el);
      } else {
        slot.textContent = Core.SUIT_SYMBOLS[suit];
      }
    });

    // Tableau
    els.tableau.innerHTML = "";
    state.tableau.forEach((col, colIndex) => {
      const colEl = document.createElement("div");
      colEl.className = "col" + (col.length === 0 ? " empty" : "");
      colEl.dataset.drop = "tableau";
      colEl.dataset.col = String(colIndex);
      let y = 0;
      col.forEach((card, index) => {
        const el = makeCardEl(card);
        if (card.faceUp) {
          el.dataset.kind = "tableau";
          el.dataset.col = String(colIndex);
          el.dataset.index = String(index);
        }
        el.style.top = y + "px";
        if (dealingNow) {
          // Short staggered deal: each card drops in shortly after the one before it.
          el.classList.add("deal-in");
          el.style.animationDelay = (colIndex * 7 + index) * 25 + "ms";
        }
        colEl.appendChild(el);
        if (index < col.length - 1) y += card.faceUp ? UP_STEP : DOWN_STEP;
      });
      // Box is tall enough for the last card's top edge plus a full card.
      colEl.style.height = y + CARD_H + "px";
      els.tableau.appendChild(colEl);
    });

    // Status
    els.dealNum.textContent = "Deal #" + seed;
    els.moves.textContent = "Moves: " + moves;
    els.time.textContent = "Time: " + formatTime(elapsedMs);
    els.undo.disabled = history.length === 0 || drag !== null;
    els.auto.hidden = won || !Core.canAutoComplete(state);
  }

  // ---- Game flow ----------------------------------------------------------

  function startDeal(newSeed, drawCount) {
    seed = newSeed;
    els.seed.value = String(seed);
    state = Core.newGame(seed, drawCount);
    history = [];
    moves = 0;
    elapsedMs = 0;
    won = false;
    showMessage("");
    dealAnimPending = true;
    render();
  }

  // Push a snapshot, then move to the new state. Undo returns to the snapshot.
  function commit(next, count) {
    history.push({ state, moves });
    state = next;
    moves += count || 1;
    afterChange();
  }

  function afterChange() {
    if (!won && Core.isWon(state)) {
      won = true;
      showMessage("You won in " + moves + " moves in " + formatTime(elapsedMs) + "!");
    } else if (!won) {
      showMessage("");
    }
    render();
  }

  function drawOrRecycle() {
    if (won) return;
    const next = Core.drawFromStock(state);
    if (next) commit(next, 1);
  }

  function undo() {
    if (!history.length || drag) return;
    const prev = history.pop();
    state = prev.state;
    moves = prev.moves;
    won = Core.isWon(state);
    showMessage("");
    render();
  }

  function autoComplete() {
    if (won || !Core.canAutoComplete(state)) return;
    let cur = state;
    let n = 0;
    for (let nx = Core.autoCompleteStep(cur); nx; nx = Core.autoCompleteStep(cur)) {
      cur = nx;
      n++;
    }
    if (n) commit(cur, n);
  }

  // Double-click: send a card to its foundation if that is legal.
  function tryFoundation(el) {
    const src = sourceFromEl(el);
    if (!src) return;
    const next = Core.applyToFoundation(state, src);
    if (next) commit(next, 1);
  }

  // ---- Drag and drop (pointer events, so mouse and touch both work) -------

  function cardsForDrag(src) {
    return Core.sourceCards(state, src);
  }

  function startDrag(d) {
    const cards = cardsForDrag(d.src);
    if (!cards) return false;
    d.started = true;

    // Ghost copy that follows the pointer
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    let y = 0;
    cards.forEach((c) => {
      const el = makeCardEl(c);
      el.style.top = y + "px";
      el.style.left = "0";
      ghost.appendChild(el);
      y += UP_STEP;
    });
    els.dragLayer.appendChild(ghost);
    d.ghost = ghost;

    // Dim the originals while they are being carried
    d.dimmed = [];
    if (d.src.kind === "tableau") {
      const cardEls = els.tableau.querySelectorAll(
        '.card[data-kind="tableau"][data-col="' + d.src.col + '"]'
      );
      cardEls.forEach((el) => {
        if (Number(el.dataset.index) >= d.src.index) {
          el.classList.add("ghosted");
          d.dimmed.push(el);
        }
      });
    } else {
      d.dimmed.push(d.el);
      d.el.classList.add("ghosted");
    }
    moveGhost(d.lastX, d.lastY);
    return true;
  }

  function moveGhost(x, y) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.left = x - drag.offsetX + "px";
    drag.ghost.style.top = y - drag.offsetY + "px";
  }

  function endDrag(e) {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    d.dimmed.forEach((el) => el.classList.remove("ghosted"));
    if (!d.started) return; // a plain click: nothing to do

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const dropEl = target ? target.closest("[data-drop]") : null;
    let next = null;
    if (dropEl && dropEl.dataset.drop === "tableau") {
      next = Core.applyToTableau(state, d.src, Number(dropEl.dataset.col));
    } else if (dropEl && dropEl.dataset.drop === "foundation") {
      const cards = cardsForDrag(d.src);
      if (cards && cards[0].suit === dropEl.dataset.suit) {
        next = Core.applyToFoundation(state, d.src);
      }
    }
    if (next) {
      commit(next, 1);
    } else {
      render();
    }
  }

  els.tableau.addEventListener("pointerdown", onPress);
  els.waste.addEventListener("pointerdown", onPress);
  els.foundations.forEach((slot) => slot.addEventListener("pointerdown", onPress));

  function onPress(e) {
    if (won || e.button !== 0) return;
    const el = e.target.closest(".card");
    if (!el) return;
    const src = sourceFromEl(el);
    if (!src) return;
    drag = {
      src,
      el,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      offsetX: 0,
      offsetY: 0,
      started: false,
      ghost: null,
      dimmed: [],
    };
    const rect = el.getBoundingClientRect();
    drag.offsetX = e.clientX - rect.left;
    drag.offsetY = e.clientY - rect.top;
  }

  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (!drag.started) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!startDrag(drag)) {
        drag = null;
        return;
      }
    }
    moveGhost(e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag(e);
  });

  window.addEventListener("pointercancel", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.ghost) d.ghost.remove();
    d.dimmed.forEach((el) => el.classList.remove("ghosted"));
    render();
  });

  // Double-click a card to send it to a foundation
  document.addEventListener("dblclick", (e) => {
    if (won) return;
    const el = e.target.closest(".card");
    if (el) tryFoundation(el);
  });

  els.stock.addEventListener("click", drawOrRecycle);

  // ---- Controls -----------------------------------------------------------

  els.newDeal.addEventListener("click", () => {
    startDeal(randomSeed(), Number(els.draw.value));
  });

  els.playDeal.addEventListener("click", () => {
    const raw = els.seed.value.trim();
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0) {
      showMessage("Enter a whole number deal (0 or more).");
      return;
    }
    startDeal(n, Number(els.draw.value));
  });

  // Changing the draw count replays the same deal with the new count.
  els.draw.addEventListener("change", () => {
    startDeal(seed, Number(els.draw.value));
  });

  els.undo.addEventListener("click", undo);
  els.auto.addEventListener("click", autoComplete);

  // Timer: counts seconds while the game is in progress.
  setInterval(() => {
    if (!won && state) {
      elapsedMs += 1000;
      els.time.textContent = "Time: " + formatTime(elapsedMs);
    }
  }, 1000);

  // Keyboard: U undoes, N starts a new deal.
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "u" || e.key === "U") undo();
    if (e.key === "n" || e.key === "N") startDeal(randomSeed(), Number(els.draw.value));
  });

  startDeal(randomSeed(), Number(els.draw.value));
})();
