/*
 * Boggle engine: dice, board rolling, word tracing, scoring and a solver.
 * No DOM access, so it runs in the browser and under `node --test`.
 *
 * Board: 16 faces in row-major order (index = row * 4 + col).
 * A face is a lowercase string: one letter, or "qu" for the Q die.
 * A word is traced by moving between touching cells (including diagonals),
 * never using the same cell twice in one word. A "qu" face spells "qu".
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BoggleCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const SIZE = 4;
  const CELLS = 16;
  const MIN_WORD = 3;
  const ROUND_SECONDS = 180;

  // Classic 16-dice set. "Q" on a die is the Qu face.
  const DICE = [
    "AAEEGN", "ABBJOO", "ACHOPS", "AFFKPS",
    "AOOTTW", "CIMOTU", "DEILRX", "DELRVY",
    "DISTTY", "EEGHNW", "EEINSU", "EHRTVW",
    "EIOSST", "ELRTTY", "HIMNQU", "HLNNRZ",
  ];

  function faceFor(letter) {
    return letter === "Q" ? "qu" : letter.toLowerCase();
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

  // Shuffles the dice into cells, then rolls each die. rng must return [0, 1).
  function rollBoard(rng) {
    const random = rng || Math.random;
    return shuffle(DICE.slice(), random).map(function (die) {
      return faceFor(die[Math.floor(random() * die.length)]);
    });
  }

  function neighborsOf(cell) {
    const row = Math.floor(cell / SIZE);
    const col = cell % SIZE;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
      }
    }
    return out;
  }

  const NEIGHBORS = [];
  for (let cell = 0; cell < CELLS; cell++) NEIGHBORS.push(neighborsOf(cell));

  // Returns the cell indices that spell `word`, or null if it cannot be traced.
  function findPath(board, word) {
    const w = String(word || "").toLowerCase();
    if (w.length === 0) return null;
    const used = new Array(CELLS).fill(false);
    const path = [];

    function step(cell, pos) {
      const face = board[cell];
      if (!w.startsWith(face, pos)) return false;
      const next = pos + face.length;
      used[cell] = true;
      path.push(cell);
      if (next === w.length) return true;
      for (const n of NEIGHBORS[cell]) {
        if (!used[n] && step(n, next)) return true;
      }
      used[cell] = false;
      path.pop();
      return false;
    }

    for (let start = 0; start < CELLS; start++) {
      if (step(start, 0)) return path.slice();
    }
    return null;
  }

  // Classic Boggle scoring. Qu counts as two letters. Words under 3 letters score 0.
  function scoreWord(word) {
    const n = String(word || "").length;
    if (n < MIN_WORD) return 0;
    if (n <= 4) return 1;
    if (n === 5) return 2;
    if (n === 6) return 3;
    if (n === 7) return 5;
    return 11;
  }

  // Builds a lookup set and a prefix trie from newline-separated words.
  function createDictionary(text) {
    const set = new Set();
    const trie = { next: {}, end: false };
    for (const line of String(text).split("\n")) {
      const word = line.trim();
      if (word.length < MIN_WORD) continue;
      set.add(word);
      let node = trie;
      for (const ch of word) {
        node = node.next[ch] || (node.next[ch] = { next: {}, end: false });
      }
      node.end = true;
    }
    return { set: set, trie: trie, size: set.size };
  }

  // Checks a typed word against the dictionary and the board.
  function checkWord(input, board, dict) {
    const word = String(input || "").trim().toLowerCase();
    if (word.length < MIN_WORD) {
      return { ok: false, reason: "Words need at least 3 letters." };
    }
    if (!/^[a-z]+$/.test(word)) {
      return { ok: false, reason: "Letters only, please." };
    }
    if (!dict.set.has(word)) {
      return { ok: false, reason: "“" + word + "” is not in the dictionary." };
    }
    if (!findPath(board, word)) {
      return { ok: false, reason: "“" + word + "” cannot be traced on this board." };
    }
    return { ok: true, word: word, points: scoreWord(word) };
  }

  // Tap mode: can `cell` be added to a tapped path? It must not be in the path
  // already, and must touch the last cell in the path (or be the first cell).
  function canTapNext(path, cell) {
    if (cell < 0 || cell >= CELLS) return false;
    if (path.length === 0) return true;
    if (path.indexOf(cell) !== -1) return false;
    return NEIGHBORS[path[path.length - 1]].indexOf(cell) !== -1;
  }

  // The letters spelled by a tapped path, e.g. "qu" + "i" + "t" = "quit".
  function pathText(board, path) {
    return path.map((cell) => board[cell]).join("");
  }

  // Finds every dictionary word on the board. Returns a Set of words.
  function solveBoard(board, dict) {
    const found = new Set();
    const used = new Array(CELLS).fill(false);

    function walk(cell, node, prefix) {
      let n = node;
      let w = prefix;
      for (const ch of board[cell]) {
        n = n.next[ch];
        if (!n) return;
        w += ch;
      }
      used[cell] = true;
      if (n.end && w.length >= MIN_WORD) found.add(w);
      for (const nb of NEIGHBORS[cell]) {
        if (!used[nb]) walk(nb, n, w);
      }
      used[cell] = false;
    }

    for (let cell = 0; cell < CELLS; cell++) walk(cell, dict.trie, "");
    return found;
  }

  return {
    SIZE: SIZE,
    CELLS: CELLS,
    MIN_WORD: MIN_WORD,
    ROUND_SECONDS: ROUND_SECONDS,
    DICE: DICE,
    faceFor: faceFor,
    rollBoard: rollBoard,
    neighborsOf: neighborsOf,
    findPath: findPath,
    canTapNext: canTapNext,
    pathText: pathText,
    scoreWord: scoreWord,
    createDictionary: createDictionary,
    checkWord: checkWord,
    solveBoard: solveBoard,
  };
});
