/*
 * Boggle (solo) page: wires the engine in boggle-core.js to the DOM.
 * Globals used: BoggleCore (boggle-core.js) and BoggleWords (words.js).
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
    form: document.getElementById("word-form"),
    input: document.getElementById("word-input"),
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
  const state = {
    phase: "ready",
    board: [],
    possible: new Set(),
    found: [], // { word, points }
    score: 0,
    endAt: 0,
    timerId: null,
  };

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
    for (const face of state.board) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "gridcell");
      tile.textContent = face === "qu" ? "Qu" : face;
      els.board.appendChild(tile);
    }
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

  function renderControls() {
    const playing = state.phase === "playing";
    els.input.disabled = !playing;
    els.submit.disabled = !playing;
    els.start.disabled = state.phase !== "ready";
    els.start.textContent = state.phase === "over" ? "Round over" : "Start round";
    els.timerBox.classList.toggle("warn", playing && state.endAt - Date.now() <= 30000);
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
    els.timer.textContent = formatTime(core.ROUND_SECONDS);
    els.missedSection.hidden = true;
    els.input.value = "";
    renderBoard();
    renderScore();
    renderFound();
    renderControls();
    setStatus("Press Start round, then type words you can trace through touching letters.");
  }

  function startRound() {
    if (state.phase !== "ready") return;
    state.phase = "playing";
    state.endAt = Date.now() + core.ROUND_SECONDS * 1000;
    els.timer.textContent = formatTime(core.ROUND_SECONDS);
    state.timerId = setInterval(tick, 250);
    tick();
    renderControls();
    setStatus("Go! Type a word and press Enter.");
    els.input.focus();
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

  function submitWord(event) {
    event.preventDefault();
    if (state.phase !== "playing") return;
    const raw = els.input.value;
    if (raw.trim() === "") return;

    const result = core.checkWord(raw, state.board, dict);
    if (!result.ok) {
      setStatus(result.reason, true);
      els.input.select();
      return;
    }
    if (state.found.some((f) => f.word === result.word)) {
      setStatus("You already found “" + result.word + "”.", true);
      els.input.select();
      return;
    }

    state.found.push({ word: result.word, points: result.points });
    state.score += result.points;
    els.input.value = "";
    renderScore();
    renderFound();
    setStatus("+" + result.points + " for “" + result.word + "”.");
  }

  els.form.addEventListener("submit", submitWord);
  els.start.addEventListener("click", startRound);
  els.newBoard.addEventListener("click", newBoard);

  newBoard();
})();
