/*
 * Minesweeper (solo, three classic difficulties) engine: board, reveal, flag, chord, win and loss.
 * No DOM access, so it runs in the browser and under `node --test`.
 *
 * State:   {
 *   difficulty: "beginner" | "intermediate" | "expert",
 *   rows: number,
 *   cols: number,
 *   mineCount: number,
 *   seed: number,                 // deal number; fixes the mine layout for a given first click
 *   mines: boolean[] | null,      // null until the first reveal places them
 *   revealed: boolean[],          // one entry per cell, index = row * cols + col
 *   flagged: boolean[],
 *   phase: "ready" | "playing" | "won" | "lost",
 *   exploded: number | null,      // index of the mine that ended the game
 * }
 *
 * Rules:
 *   - The first reveal is always a safe cell. Mines are placed only after it, from the deal number.
 *   - A clear cell (no adjacent mines) reveals its neighbours, and so on across connected clear cells.
 *   - Flags can be placed on hidden cells (also before the first reveal). They do not change the cell.
 *   - Chord: on a revealed number cell whose adjacent flags equal its number, reveal its other hidden,
 *     unflagged neighbours. If a flag is wrong and a mine is among them, the game is lost.
 *   - Win: every safe cell is revealed. Flags do not need to match mines.
 *   - Loss: a mine is revealed. All mines are then shown.
 *
 * States are never mutated: every operation returns a fresh copy, or null if illegal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MinesweeperCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const DIFFICULTIES = {
    beginner: { label: "Beginner", rows: 9, cols: 9, mines: 10 },
    intermediate: { label: "Intermediate", rows: 16, cols: 16, mines: 40 },
    expert: { label: "Expert", rows: 16, cols: 30, mines: 99 },
  };

  // Mulberry32: small seeded PRNG so a deal can be replayed from its number.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rng) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  function cloneState(state) {
    return {
      difficulty: state.difficulty,
      rows: state.rows,
      cols: state.cols,
      mineCount: state.mineCount,
      seed: state.seed,
      mines: state.mines ? state.mines.slice() : null,
      revealed: state.revealed.slice(),
      flagged: state.flagged.slice(),
      phase: state.phase,
      exploded: state.exploded,
    };
  }

  function newGame(difficulty, seed) {
    const d = DIFFICULTIES[difficulty];
    if (!d) throw new Error("unknown difficulty: " + difficulty);
    const size = d.rows * d.cols;
    return {
      difficulty,
      rows: d.rows,
      cols: d.cols,
      mineCount: d.mines,
      seed: seed >>> 0,
      mines: null,
      revealed: new Array(size).fill(false),
      flagged: new Array(size).fill(false),
      phase: "ready",
      exploded: null,
    };
  }

  function inRange(state, i) {
    return Number.isInteger(i) && i >= 0 && i < state.rows * state.cols;
  }

  // Indices of the up-to-eight cells around cell i.
  function neighbours(state, i) {
    const r = Math.floor(i / state.cols);
    const c = i % state.cols;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
        out.push(nr * state.cols + nc);
      }
    }
    return out;
  }

  function adjacentMines(state, i) {
    if (!state.mines) return 0;
    return neighbours(state, i).filter((n) => state.mines[n]).length;
  }

  function adjacentFlags(state, i) {
    return neighbours(state, i).filter((n) => state.flagged[n]).length;
  }

  function minesRemaining(state) {
    return state.mineCount - state.flagged.filter(Boolean).length;
  }

  // Places all mines from the deal number, never on the first-clicked cell.
  function placeMines(s, safeIndex) {
    const candidates = [];
    for (let i = 0; i < s.rows * s.cols; i++) {
      if (i !== safeIndex) candidates.push(i);
    }
    const rng = makeRng(s.seed);
    shuffle(candidates, rng);
    const mines = new Array(s.rows * s.cols).fill(false);
    for (let k = 0; k < s.mineCount; k++) {
      mines[candidates[k]] = true;
    }
    s.mines = mines;
  }

  // Reveals a safe cell and flood-fills through clear cells. Flagged cells are never revealed by a flood.
  function revealFrom(s, start) {
    const stack = [start];
    s.revealed[start] = true;
    while (stack.length > 0) {
      const cur = stack.pop();
      if (adjacentMines(s, cur) !== 0) continue;
      for (const nb of neighbours(s, cur)) {
        if (s.revealed[nb] || s.flagged[nb]) continue;
        s.revealed[nb] = true;
        stack.push(nb);
      }
    }
  }

  function revealAllMines(s) {
    for (let i = 0; i < s.mines.length; i++) {
      if (s.mines[i]) s.revealed[i] = true;
    }
  }

  function checkWin(s) {
    for (let i = 0; i < s.mines.length; i++) {
      if (!s.mines[i] && !s.revealed[i]) return;
    }
    s.phase = "won";
  }

  function lose(s, mineIndex) {
    s.revealed[mineIndex] = true;
    s.exploded = mineIndex;
    s.phase = "lost";
    revealAllMines(s);
  }

  // Reveal a hidden, unflagged cell. The first reveal places the mines.
  function reveal(state, i) {
    if (state.phase === "won" || state.phase === "lost") return null;
    if (!inRange(state, i)) return null;
    if (state.revealed[i] || state.flagged[i]) return null;
    const s = cloneState(state);
    if (s.phase === "ready") {
      placeMines(s, i);
      s.phase = "playing";
    }
    if (s.mines[i]) {
      lose(s, i);
      return s;
    }
    revealFrom(s, i);
    checkWin(s);
    return s;
  }

  // Place or remove a flag on a hidden cell.
  function toggleFlag(state, i) {
    if (state.phase === "won" || state.phase === "lost") return null;
    if (!inRange(state, i)) return null;
    if (state.revealed[i]) return null;
    const s = cloneState(state);
    s.flagged[i] = !s.flagged[i];
    return s;
  }

  // Chord on a revealed number cell whose adjacent flags match its number.
  function chord(state, i) {
    if (state.phase !== "playing") return null;
    if (!inRange(state, i)) return null;
    if (!state.revealed[i]) return null;
    const number = adjacentMines(state, i);
    if (number === 0) return null;
    if (adjacentFlags(state, i) !== number) return null;
    const targets = neighbours(state, i).filter((n) => !state.revealed[n] && !state.flagged[n]);
    if (targets.length === 0) return null;
    const s = cloneState(state);
    let hitMine = null;
    for (const t of targets) {
      if (s.revealed[t]) continue;
      if (s.mines[t]) {
        if (hitMine === null) hitMine = t;
        continue;
      }
      revealFrom(s, t);
    }
    if (hitMine !== null) {
      lose(s, hitMine);
      return s;
    }
    checkWin(s);
    return s;
  }

  return {
    DIFFICULTIES,
    makeRng,
    shuffle,
    newGame,
    neighbours,
    adjacentMines,
    adjacentFlags,
    minesRemaining,
    cloneState,
    reveal,
    toggleFlag,
    chord,
  };
});
