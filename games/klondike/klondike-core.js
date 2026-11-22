/*
 * Klondike Solitaire engine: deck, deal, stock/waste, moves and win check.
 * No DOM access, so it runs in the browser and under `node --test`.
 *
 * Card:    { suit: "S"|"H"|"D"|"C", rank: 1..13 (A=1, K=13), faceUp: boolean }
 * State:   {
 *   drawCount: 1|3,
 *   tableau: Card[][7],          // each column: LAST element is the top card
 *   foundations: { S: Card[], H: Card[], D: Card[], C: Card[] }, // built A..K
 *   stock: Card[],               // face down; LAST element is the next to draw
 *   waste: Card[],               // face up; LAST element is the playable card
 * }
 * Source:  { kind: "waste" }
 *        | { kind: "tableau", col, index }   // moves the run from index to the end
 *        | { kind: "foundation", suit }
 *
 * States are never mutated: every operation returns a fresh copy, or null if illegal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.KlondikeCore = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const SUITS = ["S", "H", "D", "C"];
  const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const RED_SUITS = { H: true, D: true };
  const TABLEAU_COUNT = 7;
  const TOTAL_CARDS = 52;

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

  function cloneCard(c) {
    return { suit: c.suit, rank: c.rank, faceUp: c.faceUp };
  }

  function cloneState(state) {
    const foundations = {};
    for (const suit of SUITS) foundations[suit] = state.foundations[suit].map(cloneCard);
    return {
      drawCount: state.drawCount,
      tableau: state.tableau.map((col) => col.map(cloneCard)),
      foundations,
      stock: state.stock.map(cloneCard),
      waste: state.waste.map(cloneCard),
    };
  }

  // Classic deal: column c gets c+1 cards, only its top card face up.
  // The remaining 24 cards form the stock.
  function newGame(seed, drawCount) {
    if (drawCount !== 1 && drawCount !== 3) throw new Error("drawCount must be 1 or 3");
    const rng = makeRng(seed);
    const deck = shuffle(newDeck(), rng);
    const tableau = [];
    let next = 0;
    for (let c = 0; c < TABLEAU_COUNT; c++) {
      const col = [];
      for (let k = 0; k <= c; k++) {
        const card = deck[next++];
        card.faceUp = k === c;
        col.push(card);
      }
      tableau.push(col);
    }
    const foundations = { S: [], H: [], D: [], C: [] };
    return { drawCount, tableau, foundations, stock: deck.slice(next), waste: [] };
  }

  function isRed(suit) {
    return RED_SUITS[suit] === true;
  }

  function flipTop(col) {
    if (col.length && !col[col.length - 1].faceUp) col[col.length - 1].faceUp = true;
  }

  // Stock click: deal up to drawCount cards to the waste, or recycle the waste
  // back into the stock (order preserved, cards face down) when the stock is empty.
  function drawFromStock(state) {
    const s = cloneState(state);
    if (s.stock.length === 0) {
      if (s.waste.length === 0) return null;
      s.stock = s.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      s.waste = [];
      return s;
    }
    const n = Math.min(s.drawCount, s.stock.length);
    for (let i = 0; i < n; i++) {
      const card = s.stock.pop();
      card.faceUp = true;
      s.waste.push(card);
    }
    return s;
  }

  // The cards a source would lift, or null if the source does not exist or is not a legal stack.
  function sourceCards(state, src) {
    if (!src) return null;
    if (src.kind === "waste") {
      return state.waste.length ? [state.waste[state.waste.length - 1]] : null;
    }
    if (src.kind === "foundation") {
      const pile = state.foundations[src.suit];
      return pile && pile.length ? [pile[pile.length - 1]] : null;
    }
    if (src.kind === "tableau") {
      const col = state.tableau[src.col];
      if (!col || src.index < 0 || src.index >= col.length) return null;
      const run = col.slice(src.index);
      for (let i = 0; i < run.length; i++) {
        if (!run[i].faceUp) return null;
        if (i > 0 && (run[i - 1].rank !== run[i].rank + 1 || isRed(run[i - 1].suit) === isRed(run[i].suit))) {
          return null;
        }
      }
      return run;
    }
    return null;
  }

  // A card can go to a tableau column if it is one rank lower and the opposite colour,
  // or any King if the column is empty. Runs are moved as a unit.
  function canMoveToTableau(state, src, toCol) {
    if (!Number.isInteger(toCol) || toCol < 0 || toCol >= TABLEAU_COUNT) return false;
    if (src && src.kind === "tableau" && src.col === toCol) return false;
    const cards = sourceCards(state, src);
    if (!cards) return false;
    const head = cards[0];
    const dst = state.tableau[toCol];
    if (dst.length === 0) return head.rank === 13;
    const top = dst[dst.length - 1];
    return top.faceUp && top.rank === head.rank + 1 && isRed(top.suit) !== isRed(head.suit);
  }

  function applyToTableau(state, src, toCol) {
    if (!canMoveToTableau(state, src, toCol)) return null;
    const s = cloneState(state);
    let moved;
    if (src.kind === "waste") {
      moved = [s.waste.pop()];
    } else if (src.kind === "foundation") {
      moved = [s.foundations[src.suit].pop()];
    } else {
      moved = s.tableau[src.col].splice(src.index);
    }
    s.tableau[toCol].push(...moved);
    if (src.kind === "tableau") flipTop(s.tableau[src.col]);
    return s;
  }

  // Only a single top card can go to a foundation, and it must be the next rank for its suit.
  function canMoveToFoundation(state, src) {
    const cards = sourceCards(state, src);
    if (!cards || cards.length !== 1 || src.kind === "foundation") return false;
    if (src.kind === "tableau" && src.index !== state.tableau[src.col].length - 1) return false;
    const card = cards[0];
    return state.foundations[card.suit].length === card.rank - 1;
  }

  function applyToFoundation(state, src) {
    if (!canMoveToFoundation(state, src)) return null;
    const s = cloneState(state);
    const card = src.kind === "waste" ? s.waste.pop() : s.tableau[src.col].pop();
    if (src.kind === "tableau") flipTop(s.tableau[src.col]);
    s.foundations[card.suit].push(card);
    return s;
  }

  // Every card is either on the foundations or face up on the tableau or waste, and the stock
  // is empty, so the remaining cards can always be moved there in order. The app offers auto-complete then.
  function canAutoComplete(state) {
    if (state.stock.length > 0) return false;
    return state.tableau.every((col) => col.every((c) => c.faceUp));
  }

  // One automatic foundation move, or null when none is legal. Repeat until null to finish.
  function autoCompleteStep(state) {
    const sources = [{ kind: "waste" }];
    state.tableau.forEach((col, i) => {
      if (col.length) sources.push({ kind: "tableau", col: i, index: col.length - 1 });
    });
    for (const src of sources) {
      const next = applyToFoundation(state, src);
      if (next) return next;
    }
    return null;
  }

  function foundationCount(state) {
    return SUITS.reduce((n, suit) => n + state.foundations[suit].length, 0);
  }

  function isWon(state) {
    return foundationCount(state) === TOTAL_CARDS;
  }

  return {
    SUITS,
    SUIT_SYMBOLS,
    RED_SUITS,
    TABLEAU_COUNT,
    TOTAL_CARDS,
    makeRng,
    shuffle,
    newDeck,
    newGame,
    cloneState,
    isRed,
    drawFromStock,
    sourceCards,
    canMoveToTableau,
    applyToTableau,
    canMoveToFoundation,
    applyToFoundation,
    canAutoComplete,
    autoCompleteStep,
    foundationCount,
    isWon,
  };
});
