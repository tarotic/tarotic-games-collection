const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("./minesweeper-core.js");

const idx = (state, row, col) => row * state.cols + col;

// Build a playing state by hand: mines at the given [row, col] pairs, nothing revealed yet.
function boardWithMines(rows, cols, mineCells, overrides = {}) {
  const base = M.newGame("beginner", 1);
  const size = rows * cols;
  const mines = new Array(size).fill(false);
  for (const [r, c] of mineCells) mines[r * cols + c] = true;
  return {
    ...base,
    rows,
    cols,
    mineCount: mineCells.length,
    mines,
    revealed: new Array(size).fill(false),
    flagged: new Array(size).fill(false),
    phase: "playing",
    exploded: null,
    ...overrides,
  };
}

test("difficulties: beginner 9x9 with 10 mines, intermediate 16x16 with 40, expert 30x16 with 99", () => {
  assert.deepEqual(
    { rows: M.DIFFICULTIES.beginner.rows, cols: M.DIFFICULTIES.beginner.cols, mines: M.DIFFICULTIES.beginner.mines },
    { rows: 9, cols: 9, mines: 10 }
  );
  assert.deepEqual(
    { rows: M.DIFFICULTIES.intermediate.rows, cols: M.DIFFICULTIES.intermediate.cols, mines: M.DIFFICULTIES.intermediate.mines },
    { rows: 16, cols: 16, mines: 40 }
  );
  assert.deepEqual(
    { rows: M.DIFFICULTIES.expert.rows, cols: M.DIFFICULTIES.expert.cols, mines: M.DIFFICULTIES.expert.mines },
    { rows: 16, cols: 30, mines: 99 }
  );
});

test("newGame: starts in the ready phase with no mines placed and every cell hidden", () => {
  const s = M.newGame("expert", 42);
  assert.equal(s.phase, "ready");
  assert.equal(s.mines, null);
  assert.equal(s.revealed.length, 16 * 30);
  assert.equal(s.revealed.every((v) => v === false), true);
  assert.equal(s.flagged.every((v) => v === false), true);
});

test("newGame: throws on an unknown difficulty", () => {
  assert.throws(() => M.newGame("impossible", 1));
});

test("first reveal is always safe, and places exactly the difficulty's mine count", () => {
  for (const difficulty of ["beginner", "intermediate", "expert"]) {
    for (let seed = 0; seed < 20; seed++) {
      const s = M.newGame(difficulty, seed);
      const first = Math.floor((s.rows * s.cols) / 2);
      const after = M.reveal(s, first);
      assert.notEqual(after, null);
      assert.notEqual(after.phase, "lost", `${difficulty} seed ${seed}: first click must not lose`);
      assert.equal(after.mines[first], false);
      assert.equal(after.mines.filter(Boolean).length, s.mineCount);
    }
  }
});

test("same deal number and first click give the same mine layout", () => {
  const a = M.reveal(M.newGame("intermediate", 777), 100);
  const b = M.reveal(M.newGame("intermediate", 777), 100);
  assert.deepEqual(a.mines, b.mines);
});

test("different deal numbers give different layouts", () => {
  const a = M.reveal(M.newGame("beginner", 1), 40);
  const b = M.reveal(M.newGame("beginner", 2), 40);
  assert.notDeepEqual(a.mines, b.mines);
});

test("adjacentMines counts the mines around a cell", () => {
  const s = boardWithMines(3, 3, [[0, 0], [2, 2]]);
  assert.equal(M.adjacentMines(s, idx(s, 1, 1)), 2);
  assert.equal(M.adjacentMines(s, idx(s, 0, 2)), 0);
  assert.equal(M.adjacentMines(s, idx(s, 0, 1)), 1);
});

test("neighbours: corner has three, edge has five, interior has eight", () => {
  const s = M.newGame("beginner", 1);
  assert.equal(M.neighbours(s, 0).length, 3);
  assert.equal(M.neighbours(s, 1).length, 5);
  assert.equal(M.neighbours(s, idx(s, 4, 4)).length, 8);
});

test("reveal: a clear cell opens its connected clear region and stops at numbers", () => {
  // Mine in the bottom-right corner. Revealing the top-left should open everything except the mine,
  // and the numbers on the edge of the region are revealed but not expanded.
  // The flood reaches every safe cell here, so the game is also won.
  const s = boardWithMines(4, 4, [[3, 3]]);
  const after = M.reveal(s, 0);
  assert.equal(after.phase, "won");
  assert.equal(after.revealed[idx(after, 3, 3)], false);
  assert.equal(after.revealed[idx(after, 2, 2)], true);
  assert.equal(after.revealed[idx(after, 3, 2)], true);
  assert.equal(after.revealed[idx(after, 2, 3)], true);
});

test("reveal: a numbered cell reveals only itself", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const after = M.reveal(s, idx(s, 1, 1));
  assert.equal(after.revealed.filter(Boolean).length, 1);
});

test("reveal: revealing a mine loses, shows every mine, and marks the exploded cell", () => {
  const s = boardWithMines(3, 3, [[0, 0], [2, 2]]);
  const after = M.reveal(s, 0);
  assert.equal(after.phase, "lost");
  assert.equal(after.exploded, 0);
  assert.equal(after.revealed[idx(after, 2, 2)], true);
});

test("reveal: a flagged cell cannot be revealed", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const flagged = M.toggleFlag(s, 4);
  assert.equal(M.reveal(flagged, 4), null);
});

test("reveal: an already revealed cell is a no-op", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const after = M.reveal(s, idx(s, 1, 1));
  assert.equal(M.reveal(after, idx(s, 1, 1)), null);
});

test("reveal: returns null for out-of-range indices", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  assert.equal(M.reveal(s, -1), null);
  assert.equal(M.reveal(s, 9), null);
});

test("win: revealing the last safe cell wins, without any flags", () => {
  // 2x2 board, one mine at (0,0). Reveal the three safe cells in turn.
  let s = boardWithMines(2, 2, [[0, 0]]);
  s = M.reveal(s, idx(s, 0, 1));
  assert.equal(s.phase, "playing");
  s = M.reveal(s, idx(s, 1, 0));
  assert.equal(s.phase, "playing");
  s = M.reveal(s, idx(s, 1, 1));
  assert.equal(s.phase, "won");
});

test("toggleFlag: places and removes a flag on a hidden cell, and lowers the mine counter", () => {
  const s = boardWithMines(3, 3, [[0, 0], [2, 2]]);
  assert.equal(M.minesRemaining(s), 2);
  const flagged = M.toggleFlag(s, 0);
  assert.equal(flagged.flagged[0], true);
  assert.equal(M.minesRemaining(flagged), 1);
  const unflagged = M.toggleFlag(flagged, 0);
  assert.equal(unflagged.flagged[0], false);
  assert.equal(M.minesRemaining(unflagged), 2);
});

test("toggleFlag: cannot flag a revealed cell", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const after = M.reveal(s, idx(s, 1, 1));
  assert.equal(M.toggleFlag(after, idx(s, 1, 1)), null);
});

test("toggleFlag: is allowed before the first reveal, and does not place mines", () => {
  const s = M.newGame("beginner", 5);
  const flagged = M.toggleFlag(s, 10);
  assert.equal(flagged.flagged[10], true);
  assert.equal(flagged.phase, "ready");
  assert.equal(flagged.mines, null);
});

test("minesRemaining can go negative when there are more flags than mines", () => {
  let s = boardWithMines(2, 2, [[0, 0]]);
  s = M.toggleFlag(s, 1);
  s = M.toggleFlag(s, 2);
  assert.equal(M.minesRemaining(s), -1);
});

test("chord: with matching flags, reveals the other hidden neighbours", () => {
  // 3x3, mine at (0,0) only. Cell (1,0) reads 1. Flag (0,0), then chord on (1,0): its hidden
  // unflagged neighbours (0,1), (1,1), (2,0), (2,1) are all safe, so they open.
  let s = boardWithMines(3, 3, [[0, 0]], { phase: "playing" });
  s.revealed[idx(s, 1, 0)] = true;
  s = M.toggleFlag(s, idx(s, 0, 0));
  const after = M.chord(s, idx(s, 1, 0));
  assert.notEqual(after, null);
  assert.equal(after.revealed[idx(after, 0, 1)], true);
  assert.equal(after.revealed[idx(after, 2, 1)], true);
});

test("chord: returns null when the flag count does not match the number", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  s.revealed[idx(s, 1, 0)] = true;
  assert.equal(M.chord(s, idx(s, 1, 0)), null);
});

test("chord: returns null on a hidden cell or a zero cell", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  assert.equal(M.chord(s, idx(s, 1, 0)), null);
  s.revealed[idx(s, 2, 2)] = true;
  assert.equal(M.chord(s, idx(s, 2, 2)), null);
});

test("chord: a wrong flag next to a mine loses the game", () => {
  // Mine at (0,0). Cell (1,0) reads 1. Flag the wrong cell (1,1) instead of the mine. Chord on (1,0):
  // its hidden unflagged neighbours include (0,0), which is a mine, so the game is lost.
  let s = boardWithMines(3, 3, [[0, 0]]);
  s.revealed[idx(s, 1, 0)] = true;
  s = M.toggleFlag(s, idx(s, 1, 1));
  const after = M.chord(s, idx(s, 1, 0));
  assert.equal(after.phase, "lost");
  assert.equal(after.exploded, idx(s, 0, 0));
});

test("chord: never reveals flagged cells", () => {
  // Mines at (0,0) and (2,0); (1,0) reads 2. Flag (0,0) (correct) and (0,1) (safe, wrong).
  // The flags match the number, so the chord fires. It hits the unflagged mine at (2,0) and loses,
  // and the wrongly flagged safe cell at (0,1) must stay hidden.
  let s = boardWithMines(3, 3, [[0, 0], [2, 0]]);
  s.revealed[idx(s, 1, 0)] = true;
  s = M.toggleFlag(s, idx(s, 0, 0));
  s = M.toggleFlag(s, idx(s, 0, 1));
  const after = M.chord(s, idx(s, 1, 0));
  assert.equal(after.phase, "lost");
  assert.equal(after.flagged[idx(s, 0, 1)], true);
  assert.equal(after.revealed[idx(s, 0, 1)], false);
});

test("chord: is not allowed once the game is lost or won", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const lost = M.reveal(s, 0);
  assert.equal(M.chord(lost, 1), null);
});

test("states are never mutated by operations", () => {
  const s = boardWithMines(3, 3, [[0, 0]]);
  const snapshot = JSON.stringify(s);
  M.reveal(s, idx(s, 2, 2));
  M.toggleFlag(s, 4);
  assert.equal(JSON.stringify(s), snapshot);
});
