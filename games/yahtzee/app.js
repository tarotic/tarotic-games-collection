(function () {
  const Y = window.YahtzeeCore;
  const SETTINGS_KEY = "yahtzee-settings";
  const ROLLS_PER_TURN = 3;
  const ROLL_FRAMES = 8;
  const ROLL_FRAME_MS = 60;

  // Which of the 9 grid cells show a pip for each face.
  const PIP_LAYOUT = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const els = {
    dice: document.getElementById("dice"),
    roll: document.getElementById("roll"),
    status: document.getElementById("status"),
    rows: document.getElementById("rows"),
    newGame: document.getElementById("new-game"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  let state;

  function freshState() {
    return {
      card: Y.newScorecard(),
      dice: null, // null until the first roll of the turn
      held: [false, false, false, false, false],
      rollsLeft: ROLLS_PER_TURN,
      rolling: false,
      lastBonus: false,
    };
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // Storage may be unavailable; theme still applies for this visit.
    }
  }

  function applyTheme(theme) {
    const light = theme === "light";
    document.body.classList.toggle("light", light);
    els.themeToggle.textContent = light ? "Dark mode" : "Light mode";
    els.themeToggle.setAttribute("aria-pressed", String(light));
  }

  function toggleTheme() {
    const light = !document.body.classList.contains("light");
    const theme = light ? "light" : "dark";
    applyTheme(theme);
    saveSettings({ ...loadSettings(), theme });
  }

  function isGameOver() {
    return Y.isComplete(state.card);
  }

  function options() {
    return state.dice ? Y.scoreOptions(state.card, state.dice) : {};
  }

  function renderDice() {
    els.dice.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const value = state.dice ? state.dice[i] : null;
      const die = document.createElement("button");
      die.type = "button";
      die.className = "die";
      if (state.held[i]) die.classList.add("held");
      if (state.rolling && !state.held[i]) die.classList.add("rolling");
      const canHold = state.dice && state.rollsLeft < ROLLS_PER_TURN && state.rollsLeft > 0 && !state.rolling && !isGameOver();
      die.disabled = !canHold;
      die.setAttribute(
        "aria-label",
        value === null
          ? "Die not rolled"
          : `Die showing ${value}${state.held[i] ? ", held" : ""}`,
      );
      die.setAttribute("aria-pressed", String(state.held[i]));
      die.dataset.index = String(i);

      const lit = value === null ? [] : PIP_LAYOUT[value];
      for (let p = 0; p < 9; p++) {
        const pip = document.createElement("span");
        pip.className = "pip" + (lit.includes(p) ? " on" : "");
        die.appendChild(pip);
      }
      els.dice.appendChild(die);
    }
  }

  function renderRows() {
    const opts = options();
    const t = Y.totals(state.card);
    const canScore = state.dice && !state.rolling && !isGameOver();
    els.rows.innerHTML = "";

    function addRow(label, cellHtml, extraClass) {
      const tr = document.createElement("tr");
      if (extraClass) tr.className = extraClass;
      const th = document.createElement("td");
      th.textContent = label;
      const td = document.createElement("td");
      td.className = "score";
      if (cellHtml instanceof HTMLElement) td.appendChild(cellHtml);
      else td.textContent = cellHtml;
      tr.append(th, td);
      els.rows.appendChild(tr);
    }

    function categoryRow(category) {
      const filled = state.card[category];
      if (filled !== null) {
        addRow(Y.LABELS[category], String(filled), "done");
        return;
      }
      if (canScore && category in opts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option";
        btn.dataset.category = category;
        btn.textContent = String(opts[category]);
        btn.setAttribute("aria-label", `Score ${opts[category]} in ${Y.LABELS[category]}`);
        addRow(Y.LABELS[category], btn);
        return;
      }
      addRow(Y.LABELS[category], "");
    }

    Y.UPPER.forEach(categoryRow);
    addRow("Upper subtotal", String(t.upper), "section-total");
    addRow(`Upper bonus (${Y.UPPER_BONUS_THRESHOLD}+)`, String(t.upperBonus), "section-total");
    Y.LOWER.forEach(categoryRow);
    addRow(`Yahtzee bonus (${state.card.yahtzeeBonus}×)`, String(t.yahtzeeBonus), "section-total");
    addRow("Total", String(t.total), "grand-total");
  }

  function renderStatus() {
    const roll = els.roll;
    let text;
    if (isGameOver()) {
      text = `Game over! Final score: ${Y.totals(state.card).total}.`;
      roll.disabled = true;
    } else if (state.rolling) {
      text = "Rolling…";
      roll.disabled = true;
    } else if (!state.dice) {
      text = "Click Roll to start your turn.";
      roll.disabled = false;
      roll.textContent = "Roll";
    } else if (state.rollsLeft > 0) {
      const left = state.rollsLeft === 1 ? "1 roll left" : `${state.rollsLeft} rolls left`;
      text = `Click dice to hold them, then roll again (${left}), or score a category.`;
      roll.disabled = false;
      roll.textContent = "Roll";
    } else {
      text = "No rolls left. Choose a category to score.";
      roll.disabled = true;
      roll.textContent = "Roll";
    }
    if (state.lastBonus && !isGameOver()) {
      text = "Yahtzee bonus! +100. " + text;
    }
    els.status.textContent = text;
  }

  function render() {
    renderDice();
    renderRows();
    renderStatus();
  }

  function rollOnce() {
    state.dice = Y.rollDice(state.dice || [1, 1, 1, 1, 1], state.dice ? state.held : null);
    state.rollsLeft -= 1;
  }

  async function startRoll() {
    if (state.rolling || isGameOver()) return;
    if (state.dice && state.rollsLeft === 0) return;

    state.lastBonus = false;
    state.rolling = true;
    render();

    if (reducedMotion) {
      rollOnce();
    } else {
      // Show random faces for a few frames, then land on the real roll.
      for (let f = 0; f < ROLL_FRAMES; f++) {
        const frame = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));
        state.dice = state.dice
          ? state.dice.map((v, i) => (state.held[i] ? v : frame[i]))
          : frame;
        renderDice();
        await new Promise((r) => setTimeout(r, ROLL_FRAME_MS));
      }
      rollOnce();
    }

    state.rolling = false;
    render();
  }

  function toggleHold(index) {
    if (!state.dice || state.rolling || state.rollsLeft === 0 || isGameOver()) return;
    state.held[index] = !state.held[index];
    render();
  }

  function scoreCategory(category) {
    if (!state.dice || state.rolling || isGameOver()) return;
    const opts = options();
    if (!(category in opts)) return;

    const bonusRoll = Y.isYahtzee(state.dice) && state.card.yahtzee === 50;
    state.card = Y.applyScore(state.card, category, state.dice);
    state.lastBonus = bonusRoll;
    state.dice = null;
    state.held = [false, false, false, false, false];
    state.rollsLeft = ROLLS_PER_TURN;
    render();
  }

  function hasProgress() {
    return state.dice !== null || Y.CATEGORIES.some((c) => state.card[c] !== null);
  }

  function newGame() {
    if (hasProgress() && !isGameOver() && !window.confirm("Start a new game? Your current game will be lost.")) {
      return;
    }
    state = freshState();
    render();
  }

  els.roll.addEventListener("click", startRoll);
  els.newGame.addEventListener("click", newGame);
  els.themeToggle.addEventListener("click", toggleTheme);

  els.dice.addEventListener("click", (event) => {
    const die = event.target.closest(".die");
    if (!die) return;
    toggleHold(Number(die.dataset.index));
  });

  els.rows.addEventListener("click", (event) => {
    const btn = event.target.closest("button.option");
    if (!btn) return;
    scoreCategory(btn.dataset.category);
  });

  const settings = loadSettings();
  applyTheme(settings.theme === "light" ? "light" : "dark");
  state = freshState();
  render();
})();
