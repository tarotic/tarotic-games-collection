const { test } = require("node:test");
const assert = require("node:assert/strict");
const Core = require("./sudoku-core.js");

function countClues(grid) {
  return grid.filter((v) => v !== 0).length;
}

function assertValidGrid(grid) {
  assert.equal(grid.length, 81);
  assert.ok(Core.isSolved(grid), "grid should be a complete valid Sudoku");
}

test("generateSolvedGrid produces a complete valid grid", () => {
  const grid = Core.generateSolvedGrid(Core.makeRng(1));
  assertValidGrid(grid);
});

test("solve completes a puzzle and matches the stored solution", () => {
  const { puzzle, solution } = Core.generatePuzzle("medium", { seed: 42 });
  const solved = Core.solve(puzzle);
  assert.deepEqual(solved, solution);
});

test("solve returns null for an unsolvable grid", () => {
  const grid = new Array(81).fill(0);
  grid[0] = 1;
  grid[1] = 1; // two 1s in the same row
  assert.equal(Core.solve(grid), null);
});

test("countSolutions detects a unique puzzle and an ambiguous one", () => {
  const { puzzle } = Core.generatePuzzle("easy", { seed: 7 });
  assert.equal(Core.countSolutions(puzzle, 2), 1);

  const empty = new Array(81).fill(0);
  assert.equal(Core.countSolutions(empty, 2), 2); // limit stops the search early
});

for (const difficulty of ["easy", "medium", "hard"]) {
  const target = Core.DIFFICULTIES[difficulty].clues;

  test(`${difficulty} puzzle has ~${target} clues, a unique solution, and matches its solution`, () => {
    for (const seed of [1, 2, 3]) {
      const result = Core.generatePuzzle(difficulty, { seed });
      assert.equal(result.difficulty, difficulty);
      assert.equal(countClues(result.puzzle), result.clues);
      assert.ok(result.reachedTarget, `seed ${seed} should reach ${target} clues`);
      assert.equal(result.clues, target);

      // Every given clue agrees with the solution.
      result.puzzle.forEach((v, i) => {
        if (v !== 0) assert.equal(v, result.solution[i]);
      });
      assertValidGrid(result.solution);
      assert.equal(Core.countSolutions(result.puzzle, 2), 1, `seed ${seed} must have exactly one solution`);
    }
  });
}

test("same seed gives the same puzzle", () => {
  const a = Core.generatePuzzle("hard", { seed: 99 });
  const b = Core.generatePuzzle("hard", { seed: 99 });
  assert.deepEqual(a.puzzle, b.puzzle);
});

test("unknown difficulty throws", () => {
  assert.throws(() => Core.generatePuzzle("impossible"), /Unknown difficulty/);
});

test("isSolved rejects incomplete and invalid grids", () => {
  const solved = Core.generateSolvedGrid(Core.makeRng(5));
  assert.equal(Core.isSolved(solved), true);

  const withZero = solved.slice();
  withZero[0] = 0;
  assert.equal(Core.isSolved(withZero), false);

  const duplicate = solved.slice();
  duplicate[0] = duplicate[1];
  assert.equal(Core.isSolved(duplicate), false);
});
