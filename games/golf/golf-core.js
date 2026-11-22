/*
 * Golf (solo, 2x3 grid, 9 rounds) engine: deal, turn flow and scoring.
 * No DOM access, so it runs in the browser and under `node --test`.
 *
 * Card:    { suit: "S"|"H"|"D"|"C", rank: 1..13 (A=1, K=13), faceUp: boolean }
 * State:   {
 *   seed: number,                 // game seed; each round is dealt from it
 *   rounds: number,               // rounds in the game (9)
 *   round: number,                // 1-based current round
 *   phase: "reveal" | "draw" | "place" | "flip" | "roundEnd" | "over",
 *   columns: Card[][3],           // each column is [top, bottom]
 *   stock: Card[],                // face down; LAST element is the next to draw
 *   discard: Card[],              // face up; LAST element is the top card
 *   drawn: Card | null,           // the card in hand during a turn
 *   drewFromDiscard: boolean,     // the drawn card came from the discard pile
 *   reshuffles: number,           // how many times the discard pile has been recycled this round
 *   scores: number[],             // one entry per finished round
 * }
 *
 * Turn flow:
 *   reveal  -> flip one face-down grid card           -> draw
 *   draw    -> take stock or discard top              -> place
 *   place   -> swap drawn card into a grid slot        -> draw   (the replaced card goes on the discard)
 *            | discard drawn card (not if it came from the discard) -> flip
 *   flip    -> flip one face-down grid card           -> draw
 *   A round ends as soon as all six grid cards are face up (phase roundEnd).
 *
 * Scoring: A=1, 2..10 face value, J/Q/K=10. A column whose two cards share a rank scores 0.
 *
 * States are never mutated: every operation returns a fresh copy, or null if illegal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.GolfCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const SUITS = ["S", "H", "D", "C"];
  const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const RED_SUITS = { H: true, D: true };
  const COLUMNS = 3;
  const ROWS = 2;
  const DEFAULT_ROUNDS = 9;

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

  function newDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ suit, rank, faceUp: false });
      }
    }
    return deck;
  }

  function isRed(suit) {
    return RED_SUITS[suit] === true;
  }

  // A=1, 2..10 at face value, J/Q/K at 10.
  function cardValue(rank) {
    return Math.min(rank, 10);
  }

  function cloneCard(c) {
    return { suit: c.suit, rank: c.rank, faceUp: c.faceUp };
  }

  function cloneState(state) {
    return {
      seed: state.seed,
      rounds: state.rounds,
      round: state.round,
      phase: state.phase,
      columns: state.columns.map((col) => col.map(cloneCard)),
      stock: state.stock.map(cloneCard),
      discard: state.discard.map(cloneCard),
      drawn: state.drawn ? cloneCard(state.drawn) : null,
      drewFromDiscard: state.drewFromDiscard,
      reshuffles: state.reshuffles,
      scores: state.scores.slice(),
    };
  }

  // Deals one round: six grid cards face down, one stock card turned up to start the discard pile.
  // Each round uses its own shuffle derived from the game seed and round number.
  function dealRound(seed, roundNo) {
    const rng = makeRng(seed ^ Math.imul(roundNo, 0x9e3779b9));
    const deck = shuffle(newDeck(), rng);
    const columns = [];
    let next = 0;
    for (let c = 0; c < COLUMNS; c++) {
      const col = [];
      for (let r = 0; r < ROWS; r++) {
        col.push(deck[next++]);
      }
      columns.push(col);
    }
    const stock = deck.slice(next);
    const starter = stock.pop();
    starter.faceUp = true;
    return { columns, stock, discard: [starter] };
  }

  function newGame(seed, rounds) {
    const s = seed >>> 0;
    const total = rounds === undefined ? DEFAULT_ROUNDS : rounds;
    if (!Number.isInteger(total) || total < 1) throw new Error("rounds must be a positive integer");
    const deal = dealRound(s, 1);
    return {
      seed: s,
      rounds: total,
      round: 1,
      phase: "reveal",
      columns: deal.columns,
      stock: deal.stock,
      discard: deal.discard,
      drawn: null,
      drewFromDiscard: false,
      reshuffles: 0,
      scores: [],
    };
  }

  function cardAt(state, col, row) {
    const column = state.columns[col];
    if (!column || row < 0 || row >= ROWS) return null;
    return column[row] || null;
  }

  function isRoundOver(columns) {
    return columns.every((col) => col.every((c) => c.faceUp));
  }

  // A column whose two cards share a rank scores 0; otherwise both card values count.
  function roundScore(columns) {
    return columns.reduce((sum, col) => {
      if (col[0].rank === col[1].rank) return sum;
      return sum + cardValue(col[0].rank) + cardValue(col[1].rank);
    }, 0);
  }

  function totalScore(scores) {
    return scores.reduce((sum, n) => sum + n, 0);
  }

  // Ends the round once every grid card is face up; otherwise moves to the next phase.
  function advance(s, nextPhase) {
    if (isRoundOver(s.columns)) {
      s.scores.push(roundScore(s.columns));
      s.phase = "roundEnd";
    } else {
      s.phase = nextPhase;
    }
    return s;
  }

  // Turns a face-down grid card face up. Used to start a round and after a discard.
  function flipCard(state, col, row) {
    if (state.phase !== "reveal" && state.phase !== "flip") return null;
    const card = cardAt(state, col, row);
    if (!card || card.faceUp) return null;
    const s = cloneState(state);
    s.columns[col][row].faceUp = true;
    return advance(s, "draw");
  }

  // Moves the discard pile (except its top card) into a new face-down stock.
  function recycleDiscard(s) {
    if (s.discard.length <= 1) return false;
    const top = s.discard.pop();
    const rng = makeRng(
      s.seed ^ Math.imul(s.round, 0x85ebca6b) ^ Math.imul(s.reshuffles + 1, 0xc2b2ae35)
    );
    s.stock = shuffle(
      s.discard.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: false })),
      rng
    );
    s.discard = [top];
    s.reshuffles += 1;
    return true;
  }

  // Take the top card of the stock or of the discard pile into hand.
  function draw(state, source) {
    if (state.phase !== "draw") return null;
    const s = cloneState(state);
    if (source === "stock") {
      if (s.stock.length === 0 && !recycleDiscard(s)) return null;
      s.drawn = s.stock.pop();
      s.drawn.faceUp = true;
      s.drewFromDiscard = false;
    } else if (source === "discard") {
      if (s.discard.length === 0) return null;
      s.drawn = s.discard.pop();
      s.drewFromDiscard = true;
    } else {
      return null;
    }
    s.phase = "place";
    return s;
  }

  // Swap the drawn card into a grid slot. The replaced card goes face up onto the discard pile.
  function placeDrawn(state, col, row) {
    if (state.phase !== "place") return null;
    const slot = cardAt(state, col, row);
    if (!slot) return null;
    const s = cloneState(state);
    const replaced = s.columns[col][row];
    replaced.faceUp = true;
    s.discard.push(replaced);
    s.columns[col][row] = s.drawn;
    s.drawn = null;
    s.drewFromDiscard = false;
    return advance(s, "draw");
  }

  // Discard the drawn card face up. A card taken from the discard pile cannot go straight back.
  function discardDrawn(state) {
    if (state.phase !== "place" || state.drewFromDiscard) return null;
    const s = cloneState(state);
    s.discard.push(s.drawn);
    s.drawn = null;
    s.phase = "flip";
    return s;
  }

  // Start the next round, or end the game after the last one. Called from the roundEnd phase.
  function nextRound(state) {
    if (state.phase !== "roundEnd") return null;
    const s = cloneState(state);
    if (s.round >= s.rounds) {
      s.phase = "over";
      return s;
    }
    s.round += 1;
    const deal = dealRound(s.seed, s.round);
    s.columns = deal.columns;
    s.stock = deal.stock;
    s.discard = deal.discard;
    s.drawn = null;
    s.drewFromDiscard = false;
    s.reshuffles = 0;
    s.phase = "reveal";
    return s;
  }

  return {
    COLUMNS,
    ROWS,
    DEFAULT_ROUNDS,
    SUITS,
    SUIT_SYMBOLS,
    makeRng,
    shuffle,
    newDeck,
    isRed,
    cardValue,
    cloneState,
    dealRound,
    newGame,
    cardAt,
    isRoundOver,
    roundScore,
    totalScore,
    flipCard,
    draw,
    placeDrawn,
    discardDrawn,
    nextRound,
  };
});
