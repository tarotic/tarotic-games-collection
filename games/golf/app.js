(function () {
  const Core = window.GolfCore;
  const LABELS = { 1: "A", 11: "J", 12: "Q", 13: "K" };

  const el = {
    newGame: document.getElementById("new"),
    seed: document.getElementById("seed"),
    go: document.getElementById("go"),
    dealNum: document.getElementById("deal-num"),
    round: document.getElementById("round"),
    total: document.getElementById("total"),
    message: document.getElementById("message"),
    stock: document.getElementById("stock"),
    discard: document.getElementById("discard"),
    hand: document.getElementById("hand"),
    discardDrawn: document.getElementById("discard-drawn"),
    grid: document.getElementById("grid"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    next: document.getElementById("next"),
    scores: document.getElementById("scores"),
  };

  let state = null;

  function randomDeal() {
    return Math.floor(Math.random() * 1000000);
  }

  function startGame(seed) {
    state = Core.newGame(seed);
    el.seed.value = seed;
    el.dealNum.textContent = "Deal " + seed;
    render();
  }

  function rankLabel(rank) {
    return LABELS[rank] || String(rank);
  }

  // Replaces the card face with its label, or the card back when face-down.
  function paintCard(button, card) {
    button.className = "card";
    button.textContent = "";
    if (!card) {
      button.disabled = true;
      return;
    }
    if (card.faceUp) {
      button.classList.add(Core.isRed(card.suit) ? "red" : "black");
      button.textContent = rankLabel(card.rank) + Core.SUIT_SYMBOLS[card.suit];
      button.setAttribute("aria-label", rankLabel(card.rank) + " of " + card.suit);
    } else {
      button.classList.add("back");
      button.setAttribute("aria-label", "Face-down card");
    }
  }

  function act(next) {
    if (next) {
      state = next;
    }
    render();
  }

  function canFlip(row) {
    return (state.phase === "reveal" || state.phase === "flip") && !row.faceUp;
  }

  function onGridClick(col, row) {
    if (state.phase === "reveal" || state.phase === "flip") {
      act(Core.flipCard(state, col, row));
    } else if (state.phase === "place") {
      act(Core.placeDrawn(state, col, row));
    }
  }

  function renderGrid() {
    el.grid.innerHTML = "";
    state.columns.forEach((column, c) => {
      const colEl = document.createElement("div");
      colEl.className = "grid-col";
      const matched = column[0].faceUp && column[1].faceUp && column[0].rank === column[1].rank;
      if (matched) colEl.classList.add("matched");
      column.forEach((card, r) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.col = String(c);
        btn.dataset.row = String(r);
        paintCard(btn, card);
        const clickable =
          (state.phase === "reveal" || state.phase === "flip") && canFlip(card) ||
          state.phase === "place";
        if (clickable) btn.classList.add("clickable");
        btn.disabled = !clickable;
        btn.addEventListener("click", () => onGridClick(c, r));
        colEl.appendChild(btn);
      });
      if (matched) {
        const note = document.createElement("span");
        note.className = "pair-note";
        note.textContent = "Pair: 0";
        colEl.appendChild(note);
      }
      el.grid.appendChild(colEl);
    });
  }

  function renderPiles() {
    const canDrawStock = state.phase === "draw" && (state.stock.length > 0 || state.discard.length > 1);
    const canDrawDiscard = state.phase === "draw" && state.discard.length > 0;

    el.stock.textContent = state.stock.length ? String(state.stock.length) : "";
    el.stock.className = "card back" + (canDrawStock ? " clickable" : "");
    el.stock.disabled = !canDrawStock;
    el.stock.onclick = () => act(Core.draw(state, "stock"));

    const top = state.discard[state.discard.length - 1];
    el.discard.innerHTML = "";
    const discardBtn = document.createElement("button");
    discardBtn.type = "button";
    paintCard(discardBtn, top);
    if (canDrawDiscard) discardBtn.classList.add("clickable");
    discardBtn.disabled = !canDrawDiscard;
    discardBtn.onclick = () => act(Core.draw(state, "discard"));
    el.discard.appendChild(discardBtn);

    el.hand.innerHTML = "";
    if (state.drawn) {
      const handBtn = document.createElement("button");
      handBtn.type = "button";
      paintCard(handBtn, state.drawn);
      handBtn.disabled = true;
      el.hand.appendChild(handBtn);
    }
    el.discardDrawn.disabled = !(state.phase === "place" && !state.drewFromDiscard);
    el.discardDrawn.onclick = () => act(Core.discardDrawn(state));
  }

  function messageFor() {
    switch (state.phase) {
      case "reveal":
        return "Flip one card to start the round.";
      case "draw":
        return "Draw from the stock, or take the top of the discard pile.";
      case "place":
        return state.drewFromDiscard
          ? "You took this card from the discard pile, so it must go into your grid. Pick a grid card to swap with."
          : "Swap the card in hand into a grid card, or discard it and flip a face-down card.";
      case "flip":
        return "Flip one face-down card.";
      case "roundEnd":
        return "Round " + state.round + " is over.";
      case "over":
        return "Game over.";
      default:
        return "";
    }
  }

  function renderSummary() {
    const showSummary = state.phase === "roundEnd" || state.phase === "over";
    el.summary.hidden = !showSummary;
    if (!showSummary) return;
    const last = state.scores[state.scores.length - 1];
    if (state.phase === "roundEnd") {
      el.summaryText.textContent = "Round " + state.round + " score: " + last + ". Total so far: " + Core.totalScore(state.scores) + ".";
      el.next.hidden = false;
      el.next.textContent = state.round >= state.rounds ? "Finish game" : "Next round";
      el.next.onclick = () => act(Core.nextRound(state));
    } else {
      el.summaryText.textContent = "Game over. Final total: " + Core.totalScore(state.scores) + ".";
      el.next.hidden = true;
    }
  }

  function renderScores() {
    el.scores.innerHTML = "";
    state.scores.forEach((score, i) => {
      const li = document.createElement("li");
      li.textContent = "Round " + (i + 1) + ": " + score;
      el.scores.appendChild(li);
    });
  }

  function render() {
    el.round.textContent = "Round " + state.round + " of " + state.rounds;
    el.total.textContent = "Total: " + Core.totalScore(state.scores);
    el.message.textContent = messageFor();
    renderGrid();
    renderPiles();
    renderSummary();
    renderScores();
  }

  el.newGame.addEventListener("click", () => startGame(randomDeal()));
  el.go.addEventListener("click", () => {
    const n = Number(el.seed.value);
    if (!Number.isInteger(n) || n < 0) {
      el.message.textContent = "Enter a whole number deal.";
      return;
    }
    startGame(n);
  });

  startGame(randomDeal());
})();
