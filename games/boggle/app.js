/*
 * Boggle (solo) page: wires the engine in boggle-core.js to the DOM.
 * Globals used: BoggleCore (boggle-core.js) and BoggleWords (words.js).
 *
 * Two ways to enter a word:
 *   typing: type into the box and press Enter.
 *   tapping: tap touching tiles to build the word; Clear empties it; Enter submits.
 */
(function () {
  const core = window.BoggleCore;
  const dict = core.createDictionary(window.BoggleWords);

  const els = {
    board: document.getElementById("board"),
    timer: document.getElementById("timer"),
    timerBox: document.querySelector(".stat:first-child"),
    score: document.getElementById("score"),
    count: document.getElementById("count"),
    modeType: document.getElementById("mode-type"),
    modeTap: document.getElementById("mode-tap"),
    form: document.getElementById("word-form"),
    typePanel: document.getElementById("type-panel"),
    input: document.getElementById("word-input"),
    tapPanel: document.getElementById("tap-panel"),
    tapWord: document.getElementById("tap-word"),
    clear: document.getElementById("clear"),
    submit: document.getElementById("submit"),
    start: document.getElementById("start"),
    newBoard: document.getElementById("new-board"),
    status: document.getElementById("status"),
    foundSection: document.getElementById("found-section"),
    found: document.getElementById("found"),
    missedSection: document.getElementById("missed-section"),
    missed: document.getElementById("missed"),
    missedSummary: document.getElementById("missed-summary"),
  };

  // phase: "ready" (board shown, not started), "playing", "over"
  // mode: "type" or "tap"
  const state = {
    phase: "ready",
    mode: "type",
    board: [],
    tiles: [], // tile elements, same order as board
    path: [], // tapped cell indices, in tap mode
    possible: new Set(),
    found: [], // { word, points }
    score: 0,
    endAt: 0,
    timerId: null,
  };

  const READY_HINT = "Press Start round, then type or tap words you can trace through touching letters.";

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  function setStatus(message, isError) {
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function renderBoard() {
    els.board.replaceChildren();
    state.tiles = [];
    state.board.forEach(function (face, cell) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.cell = String(cell);
      tile.setAttribute("aria-label", face === "qu" ? "Qu" : face.toUpperCase());
      tile.textContent = face === "qu" ? "Qu" : face;
      tile.addEventListener("click", function () {
        tapCell(cell);
      });
      els.board.appendChild(tile);
      state.tiles.push(tile);
    });
    renderTapHighlight();
  }

  // Shows which tiles are in the tapped path, and the order they were tapped in.
  function renderTapHighlight() {
    state.tiles.forEach(function (tile, cell) {
      const at = state.path.indexOf(cell);
      tile.classList.toggle("picked", at !== -1);
      tile.dataset.order = at === -1 ? "" : String(at + 1);
      tile.disabled = !(state.phase === "playing" && state.mode === "tap");
    });
  }

  function renderScore() {
    els.score.textContent = String(state.score);
    els.count.textContent = String(state.found.length);
  }

  function renderFound() {
    els.found.replaceChildren();
    const ordered = state.found.slice().reverse();
    for (const entry of ordered) {
      const li = document.createElement("li");
      li.textContent = entry.word;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = "+" + entry.points;
      li.appendChild(pts);
      els.found.appendChild(li);
    }
    els.foundSection.hidden = state.found.length === 0;
  }

  function renderModes() {
    const typing = state.mode === "type";
    els.modeType.setAttribute("aria-pressed", String(typing));
    els.modeTap.setAttribute("aria-pressed", String(!typing));
    els.modeType.classList.toggle("active", typing);
    els.modeTap.classList.toggle("active", !typing);
    els.typePanel.hidden = !typing;
    els.tapPanel.hidden = typing;
    els.clear.hidden = typing;
  }

  function renderTapWord() {
    els.tapWord.textContent = core.pathText(state.board, state.path);
    els.clear.disabled = !(state.phase === "playing" && state.mode === "tap" && state.path.length > 0);
    els.submit.disabled = !(state.phase === "playing" && (state.mode === "type" || state.path.length > 0));
  }

  function renderControls() {
    const playing = state.phase === "playing";
    els.input.disabled = !(playing && state.mode === "type");
    els.start.disabled = state.phase !== "ready";
    els.start.textContent = state.phase === "over" ? "Round over" : state.phase === "playing" ? "Round in progress" : "Start round";
    els.timerBox.classList.toggle("warn", playing && state.endAt - Date.now() <= 30000);
    renderModes();
    renderTapWord();
    renderTapHighlight();
  }

  function tick() {
    const remaining = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000));
    els.timer.textContent = formatTime(remaining);
    els.timerBox.classList.toggle("warn", remaining <= 30);
    if (remaining === 0) endRound();
  }

  function newBoard() {
    stopTimer();
    state.phase = "ready";
    state.board = core.rollBoard();
    state.possible = core.solveBoard(state.board, dict);
    state.found = [];
    state.score = 0;
    state.path = [];
    els.timer.textContent = formatTime(core.ROUND_SECONDS);
    els.missedSection.hidden = true;
    els.input.value = "";
    renderBoard();
    renderScore();
    renderFound();
    renderControls();
    setStatus(READY_HINT);
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.path = [];
    els.input.value = "";
    renderControls();
    if (state.phase === "playing") {
      setStatus(mode === "tap" ? "Tap a tile to start a word, then tap touching tiles." : "Type a word and press Enter.");
      if (mode === "type") els.input.focus();
    }
  }

  function startRound() {
    if (state.phase !== "ready") return;
    state.phase = "playing";
    state.endAt = Date.now() + core.ROUND_SECONDS * 1000;
    els.timer.textContent = formatTime(core.ROUND_SECONDS);
    state.timerId = setInterval(tick, 250);
    tick();
    renderControls();
    setStatus(state.mode === "tap" ? "Go! Tap a tile to start a word." : "Go! Type a word and press Enter.");
    if (state.mode === "type") els.input.focus();
  }

  function stopTimer() {
    if (state.timerId !== null) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function endRound() {
    stopTimer();
    state.phase = "over";
    state.path = [];
    els.timer.textContent = formatTime(0);
    renderControls();

    const foundWords = new Set(state.found.map((f) => f.word));
    const missed = [...state.possible]
      .filter((w) => !foundWords.has(w))
      .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));

    els.missed.replaceChildren();
    for (const word of missed) {
      const li = document.createElement("li");
      li.className = "miss";
      li.textContent = word;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = "+" + core.scoreWord(word);
      li.appendChild(pts);
      els.missed.appendChild(li);
    }
    els.missedSummary.textContent =
      "You found " + foundWords.size + " of " + state.possible.size + " possible words. Final score: " + state.score + ".";
    els.missedSection.hidden = false;
    setStatus("Time is up. Final score: " + state.score + ".");
  }

  // Tap mode: add a tile to the word being built, if it touches the last one.
  function tapCell(cell) {
    if (state.phase !== "playing" || state.mode !== "tap") return;
    if (!core.canTapNext(state.path, cell)) {
      if (state.path.indexOf(cell) !== -1) {
        setStatus("That tile is already in this word.", true);
      } else {
        setStatus("Tap a tile that touches the last one.", true);
      }
      return;
    }
    state.path.push(cell);
    renderTapWord();
    renderTapHighlight();
    setStatus("Word so far: " + core.pathText(state.board, state.path) + ".");
  }

  function clearTaps() {
    if (state.mode !== "tap") return;
    state.path = [];
    renderTapWord();
    renderTapHighlight();
    setStatus("Cleared. Tap a tile to start a new word.");
  }

  // Shared by both modes: check the word, then score it or explain why not.
  function submitWord(event) {
    event.preventDefault();
    if (state.phase !== "playing") return;

    const raw = state.mode === "tap" ? core.pathText(state.board, state.path) : els.input.value;
    if (raw.trim() === "") return;

    const result = core.checkWord(raw, state.board, dict);
    if (!result.ok) {
      setStatus(result.reason, true);
      if (state.mode === "type") els.input.select();
      return;
    }
    if (state.found.some((f) => f.word === result.word)) {
      setStatus("You already found “" + result.word + "”.", true);
      if (state.mode === "type") els.input.select();
      return;
    }

    state.found.push({ word: result.word, points: result.points });
    state.score += result.points;
    els.input.value = "";
    state.path = [];
    renderScore();
    renderFound();
    renderTapWord();
    renderTapHighlight();
    setStatus("+" + result.points + " for “" + result.word + "”.");
  }

  els.form.addEventListener("submit", submitWord);
  els.clear.addEventListener("click", clearTaps);
  els.start.addEventListener("click", startRound);
  els.newBoard.addEventListener("click", newBoard);
  els.modeType.addEventListener("click", function () { setMode("type"); });
  els.modeTap.addEventListener("click", function () { setMode("tap"); });

  newBoard();
})();
