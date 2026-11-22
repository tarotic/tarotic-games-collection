const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("./klondike-core.js");

const card = (suit, rank, faceUp = true) => ({ suit, rank, faceUp });

// Build an empty-ish state by hand so each rule can be checked in isolation.
function blank(drawCount = 1) {
  return {
    drawCount,
    tableau: Array.from({ length: 7 }, () => []),
    foundations: { S: [], H: [], D: [], C: [] },
    stock: [],
    waste: [],
  };
}

test("deal: 7 columns of 1..7 cards, only each top card face up", () => {
  const s = K.newGame(12345, 1);
  s.tableau.forEach((col, i) => {
    assert.equal(col.length, i + 1);
    col.forEach((c, k) => assert.equal(c.faceUp, k === col.length - 1));
  });
  assert.equal(s.stock.length, 24);
  assert.equal(s.waste.length, 0);
  assert.equal(K.foundationCount(s), 0);
});

test("deal: all 52 cards present exactly once", () => {
  const s = K.newGame(7, 3);
  const all = [...s.tableau.flat(), ...s.stock];
  assert.equal(all.length, 52);
  const keys = new Set(all.map((c) => c.suit + c.rank));
  assert.equal(keys.size, 52);
});

test("deal: the same seed gives the same deal, a different seed gives a different one", () => {
  const a = K.newGame(42, 1);
  const b = K.newGame(42, 1);
  const c = K.newGame(43, 1);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.stock, c.stock);
});

test("newGame rejects draw counts other than 1 or 3", () => {
  assert.throws(() => K.newGame(1, 2));
});

test("draw 1: moves one card from stock to waste, face up", () => {
  const s = K.newGame(1, 1);
  const next = K.drawFromStock(s);
  assert.equal(next.waste.length, 1);
  assert.equal(next.waste[0].faceUp, true);
  assert.equal(next.stock.length, 23);
});

test("draw 3: moves up to three cards at a time", () => {
  const s = K.newGame(1, 3);
  const next = K.drawFromStock(s);
  assert.equal(next.waste.length, 3);
  assert.equal(next.stock.length, 21);
});

test("stock: with fewer than drawCount left, draws the remainder", () => {
  const s = blank(3);
  s.stock = [card("S", 2, false), card("H", 5, false)];
  const next = K.drawFromStock(s);
  assert.equal(next.waste.length, 2);
  assert.equal(next.stock.length, 0);
});

test("redeal: an empty stock recycles the waste with order kept and cards face down", () => {
  const s = blank(1);
  s.stock = [card("S", 1, false), card("H", 2, false)]; // draw order: H2 is last, so it comes first
  const d1 = K.drawFromStock(s); // waste: [H2]
  const d2 = K.drawFromStock(d1); // waste: [H2, S1]
  const d3 = K.drawFromStock(d2); // stock empty: recycle waste
  assert.equal(d3.waste.length, 0);
  assert.equal(d3.stock.length, 2);
  assert.ok(d3.stock.every((c) => c.faceUp === false));
  const d4 = K.drawFromStock(d3);
  assert.equal(d4.waste[0].suit + d4.waste[0].rank, "H2", "first drawn card comes out first again");
});

test("stock: nothing to draw and nothing to recycle returns null", () => {
  assert.equal(K.drawFromStock(blank(1)), null);
});

test("redeal has no limit: waste can be recycled repeatedly", () => {
  let s = K.newGame(9, 1);
  for (let pass = 0; pass < 5; pass++) {
    while (s.stock.length) s = K.drawFromStock(s);
    s = K.drawFromStock(s); // recycle the waste
    assert.ok(s, "recycle must succeed on every pass");
    assert.equal(s.waste.length, 0);
  }
});

test("tableau: a card moves onto the opposite colour one rank higher", () => {
  const s = blank();
  s.tableau[0] = [card("S", 9)];
  s.tableau[1] = [card("H", 10)];
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 0, index: 0 }, 1), true);
});

test("tableau: rejects same colour, wrong rank, and face-down targets", () => {
  const s = blank();
  s.tableau[0] = [card("C", 10)]; // target top
  s.tableau[1] = [card("S", 9)]; // same colour as target
  s.tableau[2] = [card("C", 8)]; // wrong rank for target
  s.tableau[3] = [card("D", 10, false)]; // face-down target
  s.tableau[4] = [card("C", 9)];
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 1, index: 0 }, 0), false);
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 2, index: 0 }, 0), false);
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 4, index: 0 }, 3), false);
});

test("tableau: only a King may go into an empty column", () => {
  const s = blank();
  s.tableau[0] = [card("S", 12)];
  s.tableau[1] = [card("H", 13)];
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 0, index: 0 }, 2), false);
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 1, index: 0 }, 2), true);
});

test("tableau: moves a whole alternating run as a unit", () => {
  const s = blank();
  s.tableau[0] = [card("S", 9), card("H", 8), card("C", 7)];
  s.tableau[1] = [card("D", 10)];
  const next = K.applyToTableau(s, { kind: "tableau", col: 0, index: 0 }, 1);
  assert.equal(next.tableau[1].length, 4);
  assert.equal(next.tableau[0].length, 0);
});

test("tableau: a broken run cannot be moved as one", () => {
  const s = blank();
  s.tableau[0] = [card("S", 9), card("H", 7)]; // not one rank apart
  s.tableau[1] = [card("D", 10)];
  assert.equal(K.canMoveToTableau(s, { kind: "tableau", col: 0, index: 0 }, 1), false);
});

test("tableau: moving the top card turns over the card beneath it", () => {
  const s = blank();
  s.tableau[0] = [card("S", 5, false), card("S", 9)];
  s.tableau[1] = [card("H", 10)];
  const next = K.applyToTableau(s, { kind: "tableau", col: 0, index: 1 }, 1);
  assert.equal(next.tableau[0][0].faceUp, true);
});

test("tableau: a waste card can be played onto a column", () => {
  const s = blank();
  s.waste = [card("D", 6)];
  s.tableau[0] = [card("C", 7)];
  const next = K.applyToTableau(s, { kind: "waste" }, 0);
  assert.equal(next.waste.length, 0);
  assert.equal(next.tableau[0].length, 2);
});

test("foundation: builds up by suit from an Ace", () => {
  const s = blank();
  s.tableau[0] = [card("H", 1)];
  const next = K.applyToFoundation(s, { kind: "tableau", col: 0, index: 0 });
  assert.equal(next.foundations.H.length, 1);
  assert.equal(next.tableau[0].length, 0);
});

test("foundation: rejects a card out of sequence or not the top card", () => {
  const s = blank();
  s.tableau[0] = [card("H", 3)];
  assert.equal(K.canMoveToFoundation(s, { kind: "tableau", col: 0, index: 0 }), false);
  s.foundations.H = [card("H", 1), card("H", 2)];
  s.tableau[1] = [card("H", 3), card("C", 4)];
  assert.equal(K.canMoveToFoundation(s, { kind: "tableau", col: 1, index: 0 }), false);
});

test("foundation: a card can go back from the foundation to the tableau", () => {
  const s = blank();
  s.foundations.S = [card("S", 1)];
  s.tableau[0] = [card("H", 2)];
  const next = K.applyToTableau(s, { kind: "foundation", suit: "S" }, 0);
  assert.equal(next.foundations.S.length, 0);
  assert.equal(next.tableau[0].length, 2);
});

test("win: 52 cards on the foundations is a win", () => {
  const s = blank();
  for (const suit of K.SUITS) {
    s.foundations[suit] = Array.from({ length: 13 }, (_, i) => card(suit, i + 1));
  }
  assert.equal(K.isWon(s), true);
  assert.equal(K.isWon(blank()), false);
});

test("auto-complete: offered only once the stock is empty and every tableau card is face up", () => {
  const s = blank();
  s.tableau[0] = [card("S", 1)];
  assert.equal(K.canAutoComplete(s), true);
  s.stock = [card("H", 2, false)];
  assert.equal(K.canAutoComplete(s), false);
  s.stock = [];
  s.tableau[0][0].faceUp = false;
  assert.equal(K.canAutoComplete(s), false);
});

test("auto-complete: finishes a solved position step by step", () => {
  const s = blank();
  // Each suit in its own column, all face up, with the Ace on top.
  s.tableau = K.SUITS.map((suit) => Array.from({ length: 13 }, (_, k) => card(suit, 13 - k)));
  s.tableau.push([], [], []);
  let cur = s;
  let steps = 0;
  for (let next = K.autoCompleteStep(cur); next; next = K.autoCompleteStep(cur)) {
    cur = next;
    steps++;
  }
  assert.equal(K.isWon(cur), true);
  assert.equal(steps, 52);
});

test("states are never mutated by operations", () => {
  const s = K.newGame(5, 1);
  const before = JSON.stringify(s);
  K.drawFromStock(s);
  K.applyToFoundation(s, { kind: "tableau", col: 6, index: 6 });
  assert.equal(JSON.stringify(s), before);
});
