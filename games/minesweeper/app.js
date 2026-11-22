(function () {
  const Core = window.MinesweeperCore;
  const BEST_KEY = "minesweeper-best-seconds";
  const FLAG = "⚑";

  const el = {
    difficulty: document.getElementById("difficulty"),
    newGame: document.getElementById("new"),
    seed: document.getElementById("seed"),
    go: document.getElementById("go"),
    mines: document.getElementById("mines"),
    timer: document.getElementById("timer"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    board: document.getElementById("board"),
  };

  let state = null;
  let cellEls = [];
  let startedAt = null;
  let finalSeconds = 0;
  let timerId = null;

  function randomDeal() {
    return Math.floor(Math.random() * 1000000);
  }

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveBest(best) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch (e) {
      // Storage can be unavailable (for example, private browsing). The game still works without it.
    }
  }

  function recordBest(difficulty, seconds) {
    const best = loadBest();
    if (best[difficulty] === undefined || seconds < best[difficulty]) {
      best[difficulty] = seconds;
      saveBest(best);
    }
  }

  function showBest() {
    const best = loadBest()[state.difficulty];
    el.best.textContent = best === undefined ? "Best: none yet" : "Best: " + best + "s";
  }

  function elapsedSeconds() {
    if (startedAt === null) return 0;
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  function startTimer() {
    startedAt = Date.now();
    timerId = setInterval(function () {
      el.timer.textContent = "Time: " + elapsedSeconds();
    }, 250);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    finalSeconds = elapsedSeconds();
    el.timer.textContent = "Time: " + finalSeconds;
  }

  function buildBoard() {
    el.board.innerHTML = "";
    el.board.style.gridTemplateColumns = "repeat(" + state.cols + ", 28px)";
    cellEls = [];
    for (let i = 0; i < state.rows * state.cols; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(i);
      el.board.appendChild(button);
      cellEls.push(button);
    }
  }

  function paintCell(button, i) {
    const revealed = state.revealed[i];
    const over = state.phase === "won" || state.phase === "lost";
    button.className = "cell";
    button.textContent = "";
    button.disabled = false;

    if (revealed) {
      button.classList.add("open");
      if (state.mines && state.mines[i]) {
        button.classList.add("mine");
        if (state.exploded === i) button.classList.add("exploded");
        button.textContent = "✸";
      } else {
        const n = Core.adjacentMines(state, i);
        if (n > 0) {
          button.textContent = String(n);
          button.classList.add("n" + n);
        }
      }
      return;
    }

    if (state.flagged[i]) {
      button.classList.add("flag");
      button.textContent = FLAG;
      if (over && state.mines && !state.mines[i]) button.classList.add("wrong");
      return;
    }

    if (over && state.mines && state.mines[i]) {
      button.classList.add("mine");
      button.textContent = "✸";
    }
  }

  function render() {
    for (let i = 0; i < cellEls.length; i++) {
      paintCell(cellEls[i], i);
    }
    el.mines.textContent = "Mines: " + Core.minesRemaining(state);
    showBest();

    if (state.phase === "ready") {
      el.message.textContent = "Click any cell to start. Right-click to flag.";
    } else if (state.phase === "won") {
      el.message.textContent = "You won in " + finalSeconds + "s!";
    } else if (state.phase === "lost") {
      el.message.textContent = "Boom. The deal is over.";
    } else {
      el.message.textContent = "";
    }
  }

  function startGame(difficulty, seed) {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    startedAt = null;
    finalSeconds = 0;
    state = Core.newGame(difficulty, seed);
    el.difficulty.value = difficulty;
    el.seed.value = String(seed);
    el.timer.textContent = "Time: 0";
    buildBoard();
    render();
  }

  // Applies a core result. Starts the timer on the first reveal, and stops it on win or loss.
  function apply(next) {
    if (!next) return;
    const wasReady = state.phase === "ready";
    state = next;
    if (wasReady && state.phase !== "ready") startTimer();
    if (state.phase === "won") {
      stopTimer();
      recordBest(state.difficulty, finalSeconds);
    } else if (state.phase === "lost") {
      stopTimer();
    }
    render();
  }

  function indexFrom(target) {
    const button = target.closest(".cell");
    if (!button || !el.board.contains(button)) return null;
    return Number(button.dataset.index);
  }

  el.board.addEventListener("click", function (event) {
    const i = indexFrom(event.target);
    if (i === null) return;
    if (state.revealed[i]) {
      apply(Core.chord(state, i));
    } else {
      apply(Core.reveal(state, i));
    }
  });

  el.board.addEventListener("contextmenu", function (event) {
    event.preventDefault();
    const i = indexFrom(event.target);
    if (i === null) return;
    apply(Core.toggleFlag(state, i));
  });

  el.newGame.addEventListener("click", function () {
    startGame(el.difficulty.value, randomDeal());
  });

  el.difficulty.addEventListener("change", function () {
    startGame(el.difficulty.value, randomDeal());
  });

  el.go.addEventListener("click", function () {
    const raw = el.seed.value.trim();
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0) {
      el.message.textContent = "Enter a whole number deal, 0 or more.";
      return;
    }
    startGame(el.difficulty.value, n);
  });

  startGame(el.difficulty.value, randomDeal());
})();
