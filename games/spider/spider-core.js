/*
 * Spider Solitaire engine: deck, rules, legal moves and a solver.
 * No DOM access, so it runs in the browser and under `node --test`.
 *
 * Card:    { suit: "S"|"H"|"D"|"C", rank: 1..13 (A=1, K=13), faceUp: boolean }
 * Column:  array of cards; the LAST element is the visible top card.
 * State:   { suitCount: 1|2|4, columns: Card[][10], stock: Card[], completed: number }
 *
 * States are never mutated: applyMove/dealRow return a fresh copy (or null).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SpiderCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const RED_SUITS = { H: true, D: true };
  const COLUMN_COUNT = 10;
  const RUN_LENGTH = 13;
  const SETS_TO_COMPLETE = 8;
  const TOTAL_CARDS = 104;
  const DEFAULT_BUDGET = 150000;
  const MAX_SEARCH_DEPTH = 1200; // keeps the recursive solver within JS stack limits

  function suitsFor(suitCount) {
    if (suitCount === 1) return ["S"];
    if (suitCount === 2) return ["S", "H"];
    if (suitCount === 4) return ["S", "H", "D", "C"];
    throw new Error("suitCount must be 1, 2 or 4");
  }

  // Mulberry32: small seeded PRNG so deals can be reproduced from a seed.
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

  // 8 full sets of 13 ranks, spread evenly across the chosen suits.
  function newDeck(suitCount, rng) {
    const suits = suitsFor(suitCount);
    const copies = 8 / suitCount;
    const deck = [];
    for (let c = 0; c < copies; c++) {
      for (const suit of suits) {
        for (let rank = 1; rank <= 13; rank++) {
          deck.push({ suit, rank, faceUp: false });
        }
      }
    }
    return shuffle(deck, rng);
  }

  // Standard deal: 4 columns of 6 and 6 columns of 5, top card of each face up.
  // The remaining 50 cards form the stock (5 deals of 10).
  function newGame(suitCount, seed) {
    const rng = makeRng(seed);
    const deck = newDeck(suitCount, rng);
    const columns = [];
    let next = 0;
    for (let c = 0; c < COLUMN_COUNT; c++) {
      const n = c < 4 ? 6 : 5;
      const col = [];
      for (let k = 0; k < n; k++) {
        const card = deck[next++];
        card.faceUp = k === n - 1;
        col.push(card);
      }
      columns.push(col);
    }
    return { suitCount, columns, stock: deck.slice(next), completed: 0 };
  }

  function cloneState(state) {
    return {
      suitCount: state.suitCount,
      columns: state.columns.map((col) => col.map((c) => ({ ...c }))),
      stock: state.stock.map((c) => ({ ...c })),
      completed: state.completed,
    };
  }

  // Length of the face-up, same-suit, descending run at the top of a column.
  function runLength(col) {
    if (col.length === 0 || !col[col.length - 1].faceUp) return 0;
    let k = 1;
    while (k < col.length) {
      const lower = col[col.length - k];
      const upper = col[col.length - k - 1];
      if (!upper.faceUp || upper.suit !== lower.suit || upper.rank !== lower.rank + 1) break;
      k++;
    }
    return k;
  }

  // Can the top `count` cards of column `from` go onto column `to`?
  function canMoveRun(state, from, count, to) {
    if (from === to || from < 0 || to < 0 || from >= COLUMN_COUNT || to >= COLUMN_COUNT) return false;
    const src = state.columns[from];
    const dst = state.columns[to];
    if (count < 1 || count > runLength(src)) return false;
    const runHead = src[src.length - count]; // highest card of the run
    if (dst.length === 0) return true;
    const destTop = dst[dst.length - 1];
    return destTop.rank === runHead.rank + 1;
  }

  function canDeal(state) {
    return state.stock.length > 0 && state.columns.every((col) => col.length > 0);
  }

  function flipTop(col) {
    if (col.length && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
    }
  }

  // If a full K..A same-suit run sits on top of a column, remove it.
  function removeCompleted(state, index) {
    const col = state.columns[index];
    if (runLength(col) >= RUN_LENGTH) {
      col.splice(col.length - RUN_LENGTH, RUN_LENGTH);
      state.completed++;
      flipTop(col);
    }
  }

  function dealRow(state) {
    if (!canDeal(state)) return null;
    const s = cloneState(state);
    for (let c = 0; c < COLUMN_COUNT; c++) {
      const card = s.stock.pop();
      card.faceUp = true;
      s.columns[c].push(card);
    }
    for (let c = 0; c < COLUMN_COUNT; c++) removeCompleted(s, c);
    return s;
  }

  // move: { type: "move", from, count, to } or { type: "deal" }
  function applyMove(state, move) {
    if (move.type === "deal") return dealRow(state);
    if (move.type !== "move" || !canMoveRun(state, move.from, move.count, move.to)) return null;
    const s = cloneState(state);
    const src = s.columns[move.from];
    const run = src.splice(src.length - move.count, move.count);
    s.columns[move.to].push(...run);
    flipTop(src);
    removeCompleted(s, move.to);
    return s;
  }

  function legalMoves(state) {
    const moves = [];
    for (let from = 0; from < COLUMN_COUNT; from++) {
      const maxRun = runLength(state.columns[from]);
      for (let count = 1; count <= maxRun; count++) {
        for (let to = 0; to < COLUMN_COUNT; to++) {
          if (canMoveRun(state, from, count, to)) {
            moves.push({ type: "move", from, count, to });
          }
        }
      }
    }
    if (canDeal(state)) moves.push({ type: "deal" });
    return moves;
  }

  function isWon(state) {
    return state.completed === SETS_TO_COMPLETE;
  }

  // ---- Solver -------------------------------------------------------------

  // Canonical key: column order does not matter for solvability, so columns are sorted.
  function encode(state) {
    const cols = state.columns.map((col) => {
      let k = "";
      for (const c of col) k += c.suit + c.rank + (c.faceUp ? "+" : "-");
      return k;
    });
    cols.sort();
    return cols.join("|") + "#" + state.stock.length + ":" + state.completed;
  }

  function scoreMove(state, m) {
    if (m.type === "deal") return -100;
    const src = state.columns[m.from];
    const dst = state.columns[m.to];
    let score = m.count;
    const below = src.length - m.count - 1;
    if (below >= 0 && !src[below].faceUp) score += 50; // reveals a hidden card
    if (src.length === m.count) score -= 20; // empties a column
    if (dst.length && dst[dst.length - 1].suit === src[src.length - m.count].suit) score += 10;
    if (dst.length === 0) score -= 5;
    return score;
  }

  // Depth-first search with memoisation and a node budget.
  // Returns the list of moves that wins, or null if none was found in budget.
  function solve(state, options) {
    const budget = (options && options.budget) || DEFAULT_BUDGET;
    const seen = new Set();
    const path = [];
    let nodes = 0;

    function dfs(s) {
      if (isWon(s)) return true;
      if (nodes >= budget || path.length >= MAX_SEARCH_DEPTH) return false;
      const key = encode(s);
      if (seen.has(key)) return false;
      seen.add(key);
      nodes++;

      // Pruning (search only; the player may still make any legal move):
      //  - only move whole runs, since spider has no supermove limit;
      //  - only one empty column is a useful target (they are interchangeable);
      //  - a column that is already a single full run is never moved.
      let firstEmpty = -1;
      for (let i = 0; i < COLUMN_COUNT; i++) {
        if (s.columns[i].length === 0) { firstEmpty = i; break; }
      }
      const candidates = legalMoves(s).filter((m) => {
        if (m.type !== "move") return true;
        const src = s.columns[m.from];
        if (m.count !== runLength(src)) return false;
        if (src.length === m.count && src[0].rank === 13) return false;
        if (s.columns[m.to].length === 0) return m.to === firstEmpty;
        return true;
      });
      candidates.sort((a, b) => scoreMove(s, b) - scoreMove(s, a));

      for (const m of candidates) {
        const next = applyMove(s, m);
        if (!next) continue;
        path.push(m);
        if (dfs(next)) return true;
        path.pop();
        if (nodes >= budget) return false;
      }
      return false;
    }

    return dfs(cloneState(state)) ? path.slice() : null;
  }

  return {
    SUIT_SYMBOLS,
    RED_SUITS,
    COLUMN_COUNT,
    RUN_LENGTH,
    SETS_TO_COMPLETE,
    TOTAL_CARDS,
    suitsFor,
    makeRng,
    newDeck,
    newGame,
    cloneState,
    runLength,
    canMoveRun,
    canDeal,
    dealRow,
    applyMove,
    legalMoves,
    isWon,
    encode,
    solve,
  };
});
