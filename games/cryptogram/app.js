(function () {
  const C = window.CryptogramCore;

  const els = {
    puzzle: document.getElementById("puzzle"),
    bankKeys: document.getElementById("bank-keys"),
    score: document.getElementById("score"),
    time: document.getElementById("time"),
    hints: document.getElementById("hints"),
    checks: document.getElementById("checks"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    result: document.getElementById("result"),
    resultScore: document.getElementById("result-score"),
    resultAuthor: document.getElementById("result-author"),
    check: document.getElementById("check"),
    hint: document.getElementById("hint"),
    newPuzzle: document.getElementById("new-puzzle"),
    nextPuzzle: document.getElementById("next-puzzle"),
  };

  let game = null;
  let quoteIndex = null;
  let selectedPos = null;
  let tickTimer = null;

  function bestKey(index) {
    return "cryptogram-best-" + index;
  }

  function loadBest(index) {
    const raw = localStorage.getItem(bestKey(index));
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return minutes + ":" + seconds;
  }

  function elapsedMs(now) {
    if (game.startedAt === null) return 0;
    const end = game.solved && game.finishedAt !== null ? game.finishedAt : now;
    return end - game.startedAt;
  }

  function letterCellPositions() {
    return C.encodedCells(game.puzzle)
      .filter((cell) => cell.cipher !== null)
      .map((cell) => cell.pos);
  }

  function renderPuzzle() {
    els.puzzle.replaceChildren();
    const cells = C.encodedCells(game.puzzle);

    let word = null;
    cells.forEach((cell) => {
      if (cell.char === " ") {
        word = null;
        els.puzzle.append(" ");
        return;
      }
      if (word === null) {
        word = document.createElement("div");
        word.className = "word";
        els.puzzle.append(word);
      }

      if (cell.cipher === null) {
        const mark = document.createElement("span");
        mark.className = "punct";
        mark.textContent = cell.char;
        word.append(mark);
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.pos = String(cell.pos);
      if (cell.pos === selectedPos) button.classList.add("selected");
      if (game.flagged[cell.cipher]) button.classList.add("wrong");
      if (game.locked[cell.cipher]) button.classList.add("revealed");

      const cipher = document.createElement("span");
      cipher.className = "cipher";
      cipher.textContent = cell.cipher;

      const guess = document.createElement("span");
      guess.className = "guess";
      guess.textContent = game.guesses[cell.cipher] || "";

      button.append(cipher, guess);
      word.append(button);
    });
  }

  function renderBank() {
    if (els.bankKeys.childElementCount > 0) return;
    C.ALPHABET.split("").forEach((letter) => {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "bank-key";
      key.dataset.letter = letter;
      key.textContent = letter;
      els.bankKeys.append(key);
    });
  }

  function renderStats() {
    const now = Date.now();
    els.score.textContent = String(C.scoreFor(game, now));
    els.time.textContent = formatTime(elapsedMs(now));
    els.hints.textContent = String(game.hintsUsed);
    els.checks.textContent = String(game.penalizedChecks);
  }

  function renderAll() {
    renderPuzzle();
    renderStats();
    const best = loadBest(quoteIndex);
    els.best.textContent = best === undefined ? "–" : String(best);
    els.result.hidden = !game.solved;
    els.check.disabled = game.solved;
    els.hint.disabled = game.solved;
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function selectPosition(pos) {
    selectedPos = pos;
    C.startTimer(game, Date.now());
    renderPuzzle();
  }

  function enterLetter(letter) {
    if (game.solved || selectedPos === null) return;
    const cell = C.encodedCells(game.puzzle)[selectedPos];
    if (!cell || cell.cipher === null) return;

    C.startTimer(game, Date.now());
    if (!C.setGuess(game, cell.cipher, letter)) {
      setStatus("That letter is already fixed by a hint.");
      return;
    }
    setStatus("");
    const next = C.nextPositionWithoutGuess(game, selectedPos);
    if (next !== null) selectedPos = next;
    renderAll();
  }

  function clearSelected() {
    if (game.solved || selectedPos === null) return;
    const cell = C.encodedCells(game.puzzle)[selectedPos];
    if (!cell || cell.cipher === null) return;
    if (!C.setGuess(game, cell.cipher, "")) {
      setStatus("That letter is already fixed by a hint.");
      return;
    }
    renderAll();
  }

  function moveSelection(step) {
    const positions = letterCellPositions();
    if (positions.length === 0) return;
    const index = positions.indexOf(selectedPos);
    const nextIndex = index === -1 ? 0 : (index + step + positions.length) % positions.length;
    selectPosition(positions[nextIndex]);
  }

  function onCheck() {
    if (game.solved) return;
    const result = C.check(game, Date.now());
    if (result.solved) {
      finishPuzzle();
      return;
    }
    if (result.wrong.length > 0) {
      setStatus("Some guesses are wrong. Each wrong check costs 25 points.");
    } else {
      setStatus("Every guess so far is right. Keep going.");
    }
    renderAll();
  }

  function onHint() {
    if (game.solved) return;
    C.startTimer(game, Date.now());
    const revealed = C.hint(game, selectedPos, Math.random);
    if (revealed === null) {
      setStatus("There is nothing left to reveal.");
    } else {
      setStatus("Hint: a letter has been revealed. It costs 25 points.");
    }
    renderAll();
  }

  function finishPuzzle() {
    const score = C.scoreFor(game, Date.now());
    const best = C.bestScore(loadBest(quoteIndex), score);
    localStorage.setItem(bestKey(quoteIndex), String(best));

    els.resultScore.textContent = "Score " + score + ". Best " + best + ".";
    els.resultAuthor.textContent = "— " + game.puzzle.author;
    setStatus("");
    renderAll();
    stopTicking();
  }

  function startTicking() {
    stopTicking();
    tickTimer = setInterval(() => {
      if (game && !game.solved) renderStats();
    }, 250);
  }

  function stopTicking() {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function newPuzzle() {
    quoteIndex = C.pickQuoteIndex(Math.random, quoteIndex);
    const quote = C.QUOTES[quoteIndex];
    game = C.createGame(C.createPuzzle(quote, Math.random));
    selectedPos = letterCellPositions()[0] ?? null;
    setStatus("");
    renderAll();
    startTicking();
  }

  // Keyboard input: letters guess, Backspace clears, arrows move the selection.
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!game) return;
    const key = event.key;
    if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      enterLetter(key.toUpperCase());
    } else if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      clearSelected();
    } else if (key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1);
    }
  });

  els.puzzle.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || game.solved) return;
    selectPosition(Number(cell.dataset.pos));
  });

  els.bankKeys.addEventListener("click", (event) => {
    const key = event.target.closest(".bank-key");
    if (!key) return;
    enterLetter(key.dataset.letter);
  });

  els.check.addEventListener("click", onCheck);
  els.hint.addEventListener("click", onHint);
  els.newPuzzle.addEventListener("click", newPuzzle);
  els.nextPuzzle.addEventListener("click", newPuzzle);

  renderBank();
  newPuzzle();
})();
