(function () {
  const F = window.FarkleCore;
  const SETTINGS_KEY = "farkle-settings";
  const SCHEMES = ["felt", "night-owl", "gruvbox", "noir"];
  const ROLL_FRAMES = 8;
  const ROLL_FRAME_MS = 60;
  const SLIDE_MS = 380;
  const FAREWELL_MS = 900;

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
    scheme: document.getElementById("scheme"),
    newGame: document.getElementById("new-game"),
    setup: document.getElementById("setup"),
    countButtons: Array.from(document.querySelectorAll(".count-option")),
    start: document.getElementById("start"),
    play: document.getElementById("play"),
    board: document.getElementById("board"),
    turnLabel: document.getElementById("turn-label"),
    dice: document.getElementById("dice"),
    kept: document.getElementById("kept"),
    roll: document.getElementById("roll"),
    bank: document.getElementById("bank"),
    status: document.getElementById("status"),
    winner: document.getElementById("winner"),
    winnerText: document.getElementById("winner-text"),
    playAgain: document.getElementById("play-again"),
  };

  let game = null;
  let playerCount = 2;
  let rolling = false;
  let message = ""; // one-off message such as a Farkle or a bank
  let dieEls = []; // displayed dice, highest value first
  let selected = []; // selection flags, parallel to dieEls

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomFace() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function shuffle(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
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
      // Storage may be unavailable; the scheme still applies for this visit.
    }
  }

  function applyScheme(name) {
    const scheme = SCHEMES.includes(name) ? name : "felt";
    SCHEMES.forEach((s) => document.body.classList.remove("scheme-" + s));
    document.body.classList.add("scheme-" + scheme);
    els.scheme.value = scheme;
  }

  function makeDie(small) {
    const die = document.createElement("button");
    die.type = "button";
    die.className = small ? "die small" : "die";
    for (let p = 0; p < 9; p++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      die.appendChild(pip);
    }
    return die;
  }

  function setFace(die, value) {
    die.dataset.value = String(value);
    const lit = PIP_LAYOUT[value];
    die.querySelectorAll(".pip").forEach((pip, p) => pip.classList.toggle("on", lit.includes(p)));
    die.setAttribute("aria-label", `Die showing ${value}`);
  }

  function selectedIndices() {
    return dieEls.map((_, i) => i).filter((i) => selected[i]);
  }

  function toggleDie(die) {
    if (rolling) return;
    const i = dieEls.indexOf(die);
    if (i < 0) return;
    selected[i] = !selected[i];
    die.classList.toggle("held", selected[i]);
    die.setAttribute("aria-pressed", String(selected[i]));
    renderControls();
  }

  // Dice tumble to random faces, settle on their rolled values, then slide into order.
  async function animateRoll(values) {
    rolling = true;
    const fresh = values.map(() => makeDie(false));
    fresh.forEach((die) => die.addEventListener("click", () => toggleDie(die)));
    dieEls = fresh;
    selected = values.map(() => false);
    els.dice.replaceChildren(...fresh);

    const shuffled = shuffle(values); // random slots first, so the sort has work to do
    if (!reducedMotion) {
      for (let f = 0; f < ROLL_FRAMES; f++) {
        fresh.forEach((die) => {
          setFace(die, randomFace());
          die.classList.add("rolling");
        });
        await delay(ROLL_FRAME_MS);
      }
    }
    fresh.forEach((die, i) => {
      setFace(die, shuffled[i]);
      die.classList.remove("rolling");
    });

    const sorted = [...fresh].sort((a, b) => Number(b.dataset.value) - Number(a.dataset.value));
    slideInto(sorted);
    dieEls = sorted;
  }

  // Moves dice to their new order, sliding each from its old spot (FLIP).
  function slideInto(order) {
    if (reducedMotion) {
      els.dice.replaceChildren(...order);
      return;
    }
    const before = new Map(order.map((die) => [die, die.getBoundingClientRect().left]));
    els.dice.replaceChildren(...order);
    order.forEach((die) => {
      const dx = before.get(die) - die.getBoundingClientRect().left;
      if (dx !== 0) {
        die.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], {
          duration: SLIDE_MS,
          easing: "ease-out",
        });
      }
    });
  }

  function renderBoard() {
    els.board.replaceChildren();
    game.players.forEach((player, i) => {
      const li = document.createElement("li");
      const playing = !game.over && i === game.current;
      if (playing) li.className = "playing";

      const left = document.createElement("span");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = player.name;
      left.appendChild(name);
      if (playing) {
        const note = document.createElement("span");
        note.className = "note";
        note.textContent = "playing";
        left.appendChild(note);
      } else if (!player.opened) {
        const note = document.createElement("span");
        note.className = "note";
        note.textContent = `needs ${game.openingMinimum} to open`;
        left.appendChild(note);
      }

      const total = document.createElement("span");
      total.className = "total";
      total.textContent = String(player.total);
      li.append(left, total);
      els.board.appendChild(li);
    });
  }

  function renderDice() {
    if (rolling) return;
    if (!game.turn || game.turn.dice === null) {
      dieEls = [];
      selected = [];
      els.dice.replaceChildren();
      return;
    }
    dieEls.forEach((die, i) => {
      die.classList.toggle("held", !!selected[i]);
      die.setAttribute("aria-pressed", String(!!selected[i]));
    });
    els.dice.replaceChildren(...dieEls);
  }

  function renderKept() {
    els.kept.replaceChildren();
    if (!game.turn) return;
    game.turn.kept.forEach((value) => {
      const die = makeDie(true);
      setFace(die, value);
      die.disabled = true;
      els.kept.appendChild(die);
    });
  }

  function renderControls() {
    const turn = game.turn;
    if (!turn || game.over) {
      els.roll.disabled = true;
      els.bank.disabled = true;
      els.bank.textContent = "Bank";
      els.turnLabel.textContent = "";
      return;
    }
    const player = game.players[game.current];
    const hasDice = turn.dice !== null;
    const indices = hasDice ? selectedIndices() : [];
    const pts = indices.length ? F.keepPoints(game, indices) : null;

    els.turnLabel.textContent = `${player.name}'s turn · turn score ${turn.turnScore}`;

    // Roll: after a roll, the selection must score. Otherwise it is always available.
    const canRoll = !rolling && (!hasDice || pts !== null);
    els.roll.disabled = !canRoll;
    els.roll.textContent = !hasDice && turn.turnScore === 0 ? "Roll" : "Roll again";

    // Bank: counts any pending selection, and respects the opening minimum.
    let canBankNow = false;
    let bankScore = turn.turnScore;
    if (!rolling) {
      if (hasDice) {
        if (pts !== null) {
          canBankNow = F.canBank(game, pts);
          bankScore += pts;
        }
      } else {
        canBankNow = F.canBank(game, 0);
      }
    }
    els.bank.disabled = !canBankNow;
    els.bank.textContent = bankScore > 0 ? `Bank ${bankScore}` : "Bank";

    renderStatus(turn, player, hasDice, indices, pts);
  }

  function renderStatus(turn, player, hasDice, indices, pts) {
    if (rolling) {
      els.status.textContent = message || "Rolling…";
      return;
    }
    let text;
    if (hasDice) {
      if (pts !== null) {
        text = `Selection scores ${pts}. Roll again or bank.`;
        if (!player.opened && turn.turnScore + pts < game.openingMinimum) {
          text += ` The first bank needs ${game.openingMinimum}.`;
        }
      } else if (indices.length) {
        text = "Not a scoring selection yet. Keep tapping dice, or tap one again to remove it.";
      } else {
        text = "Tap the scoring dice you want to keep.";
      }
    } else if (turn.turnScore === 0) {
      text = `${player.name}, roll the dice.`;
    } else {
      text = `Roll again or bank ${turn.turnScore}.`;
      if (!player.opened && turn.turnScore < game.openingMinimum) {
        text += ` The first bank needs ${game.openingMinimum}.`;
      }
    }
    if (turn.hotDice && !hasDice) text = "Hot dice! All six dice are back in play. " + text;
    if (message) text = message + " " + text;
    els.status.textContent = text;
  }

  function renderWinner() {
    if (!game.over) {
      els.winner.hidden = true;
      return;
    }
    const best = game.players[game.winners[0]].total;
    const names = game.winners.map((i) => game.players[i].name);
    els.winnerText.textContent =
      names.length === 1
        ? `${names[0]} wins with ${best} points!`
        : `Tie: ${names.join(" and ")} with ${best} points.`;
    els.winner.hidden = false;
  }

  function render() {
    renderBoard();
    renderDice();
    renderKept();
    renderControls();
    renderWinner();
  }

  async function onRoll() {
    if (rolling || !game || game.over) return;
    message = "";
    const turn = game.turn;
    if (turn.dice !== null) {
      const indices = selectedIndices();
      if (F.keepPoints(game, indices) === null) return;
      const kept = F.keep(game, indices);
      if (kept.hotDice) message = "Hot dice!";
      dieEls = [];
      selected = [];
    }
    const name = game.players[game.current].name;
    const scoreAtRoll = game.turn.turnScore;

    const result = F.roll(game);
    await animateRoll(result.dice);

    if (result.farkle) {
      message = scoreAtRoll > 0 ? `Farkle! ${name} loses ${scoreAtRoll} points.` : `Farkle! ${name} scores nothing.`;
      rolling = true;
      render();
      await delay(FAREWELL_MS);
      rolling = false;
      dieEls = [];
      selected = [];
      render();
      return;
    }
    rolling = false;
    render();
  }

  function onBank() {
    if (rolling || !game || game.over) return;
    message = "";
    const turn = game.turn;
    if (turn.dice !== null) {
      const indices = selectedIndices();
      if (F.keepPoints(game, indices) === null) return;
      F.keep(game, indices);
      dieEls = [];
      selected = [];
    }
    const name = game.players[game.current].name;
    const points = game.turn ? game.turn.turnScore : 0;
    F.bank(game);
    message = game.over ? "" : `${name} banks ${points} points.`;
    render();
  }

  function startGame() {
    const names = Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`);
    game = F.newGame(names);
    message = "";
    rolling = false;
    dieEls = [];
    selected = [];
    els.setup.hidden = true;
    els.play.hidden = false;
    els.newGame.hidden = false;
    render();
  }

  function showSetup() {
    game = null;
    rolling = false;
    message = "";
    dieEls = [];
    selected = [];
    els.play.hidden = true;
    els.winner.hidden = true;
    els.newGame.hidden = true;
    els.setup.hidden = false;
  }

  els.countButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      playerCount = Number(btn.dataset.count);
      els.countButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    });
  });
  els.start.addEventListener("click", startGame);
  els.newGame.addEventListener("click", showSetup);
  els.playAgain.addEventListener("click", startGame);
  els.roll.addEventListener("click", onRoll);
  els.bank.addEventListener("click", onBank);
  els.scheme.addEventListener("change", () => {
    applyScheme(els.scheme.value);
    saveSettings({ ...loadSettings(), scheme: els.scheme.value });
  });

  applyScheme(loadSettings().scheme);
  els.countButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.count) === playerCount)));
})();
