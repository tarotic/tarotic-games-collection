/**
 * Sudoku core: grid generation, solving, and puzzle creation.
 *
 * Works in the browser (attaches to window.SudokuCore) and in Node (module.exports).
 * Grids are flat arrays of 81 numbers, row-major; 0 means empty.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SudokuCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const SIZE = 9;
  const CELLS = SIZE * SIZE;

  // Difficulty is defined by how many clues (given numbers) the puzzle starts with.
  const DIFFICULTIES = {
    easy: { label: "Easy", clues: 40 },
    medium: { label: "Medium", clues: 32 },
    hard: { label: "Hard", clues: 26 },
  };

  // Small seeded PRNG (mulberry32) so puzzles can be reproduced in tests.
  function makeRng(seed) {
    if (seed === undefined || seed === null) {
      return Math.random;
    }
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(array, rng) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function rowOf(i) {
    return Math.floor(i / SIZE);
  }
  function colOf(i) {
    return i % SIZE;
  }
  function boxOf(i) {
    return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
  }

  // Returns true if placing `value` at index `index` breaks no row/column/box rule.
  function canPlace(grid, index, value) {
    const r = rowOf(index);
    const c = colOf(index);
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let k = 0; k < SIZE; k++) {
      if (grid[r * SIZE + k] === value) return false;
      if (grid[k * SIZE + c] === value) return false;
      const rr = br + Math.floor(k / 3);
      const cc = bc + (k % 3);
      if (grid[rr * SIZE + cc] === value) return false;
    }
    return true;
  }

  // Finds the empty cell with the fewest legal candidates (fast backtracking).
  function findBestCell(grid) {
    let best = -1;
    let bestCandidates = null;
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue;
      const candidates = [];
      for (let v = 1; v <= SIZE; v++) {
        if (canPlace(grid, i, v)) candidates.push(v);
      }
      if (bestCandidates === null || candidates.length < bestCandidates.length) {
        best = i;
        bestCandidates = candidates;
        if (candidates.length <= 1) break;
      }
    }
    return { index: best, candidates: bestCandidates || [] };
  }

  // True if no given number already conflicts with another given number.
  // Backtracking alone would search the whole tree before reporting such a conflict.
  function hasNoConflicts(grid) {
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i];
      if (v === 0) continue;
      grid[i] = 0;
      const ok = canPlace(grid, i, v);
      grid[i] = v;
      if (!ok) return false;
    }
    return true;
  }

  /**
   * Counts solutions up to `limit` (stops early once `limit` is reached).
   * Used to verify a puzzle has exactly one solution (limit = 2).
   */
  function countSolutions(grid, limit = 2) {
    if (!hasNoConflicts(grid)) return 0;
    const work = grid.slice();
    let count = 0;

    function search() {
      if (count >= limit) return;
      const { index, candidates } = findBestCell(work);
      if (index === -1) {
        count++;
        return;
      }
      for (const v of candidates) {
        work[index] = v;
        search();
        work[index] = 0;
        if (count >= limit) return;
      }
    }

    search();
    return count;
  }

  /** Returns a solved grid, or null if the input cannot be solved. */
  function solve(grid) {
    if (!hasNoConflicts(grid)) return null;
    const work = grid.slice();
    function search() {
      const { index, candidates } = findBestCell(work);
      if (index === -1) return true;
      for (const v of candidates) {
        work[index] = v;
        if (search()) return true;
        work[index] = 0;
      }
      return false;
    }
    return search() ? work : null;
  }

  /** Generates a random fully-solved, valid grid. */
  function generateSolvedGrid(rng = Math.random) {
    const grid = new Array(CELLS).fill(0);
    function fill(index) {
      if (index === CELLS) return true;
      if (grid[index] !== 0) return fill(index + 1);
      const values = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
      for (const v of values) {
        if (canPlace(grid, index, v)) {
          grid[index] = v;
          if (fill(index + 1)) return true;
          grid[index] = 0;
        }
      }
      return false;
    }
    fill(0);
    return grid;
  }

  /**
   * Builds a puzzle with exactly one solution and the given number of clues.
   *
   * Starts from a full solved grid and removes numbers in random order, keeping a
   * removal only if the puzzle still has a unique solution. If the target clue count
   * can't be reached (rare), a fresh solution is tried, up to `maxAttempts` times;
   * the closest result is returned with `reachedTarget: false`.
   *
   * @returns {{ puzzle: number[], solution: number[], clues: number, difficulty: string, reachedTarget: boolean }}
   */
  function generatePuzzle(difficulty = "medium", options = {}) {
    const config = DIFFICULTIES[difficulty];
    if (!config) {
      throw new Error(`Unknown difficulty "${difficulty}". Use one of: ${Object.keys(DIFFICULTIES).join(", ")}`);
    }
    const rng = makeRng(options.seed);
    const targetClues = options.clues || config.clues;
    const maxAttempts = options.maxAttempts || 20;

    let best = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const solution = generateSolvedGrid(rng);
      const puzzle = solution.slice();
      const positions = shuffle([...Array(CELLS).keys()], rng);
      let clues = CELLS;

      for (const pos of positions) {
        if (clues <= targetClues) break;
        const backup = puzzle[pos];
        puzzle[pos] = 0;
        if (countSolutions(puzzle, 2) === 1) {
          clues--;
        } else {
          puzzle[pos] = backup;
        }
      }

      const result = {
        puzzle,
        solution,
        clues,
        difficulty,
        reachedTarget: clues <= targetClues,
      };
      if (result.reachedTarget) return result;
      if (!best || clues < best.clues) best = result;
    }

    return best;
  }

  /** True when `grid` is a complete, valid Sudoku solution. */
  function isSolved(grid) {
    if (grid.some((v) => v < 1 || v > SIZE)) return false;
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i];
      if (!canPlace(grid.map((x, j) => (j === i ? 0 : x)), i, v)) return false;
    }
    return true;
  }

  return {
    SIZE,
    CELLS,
    DIFFICULTIES,
    makeRng,
    rowOf,
    colOf,
    boxOf,
    canPlace,
    countSolutions,
    solve,
    generateSolvedGrid,
    generatePuzzle,
    isSolved,
  };
});
