const test = require("node:test");
const assert = require("node:assert/strict");
const Spider = require("./spider-core.js");

const card = (suit, rank, faceUp = true) => ({ suit, rank, faceUp });

function emptyState(suitCount = 1) {
  return {
    suitCount,
    columns: Array.from({ length: 10 }, () => []),
    stock: [],
    completed: 0,
  };
}

test("deck has 104 cards split evenly across suit counts", () => {
  for (const suitCount of [1, 2, 4]) {
    const deck = Spider.newDeck(suitCount, Spider.makeRng(1));
    assert.equal(deck.length, 104);
    const suits = Spider.suitsFor(suitCount);
    for (const s of suits) {
      assert.equal(deck.filter((c) => c.suit === s).length, 104 / suits.length);
    }
  }
});

test("new game deals 54 cards to the tableau and 50 to stock", () => {
  const g = Spider.newGame(4, 42);
  const counts = g.columns.map((c) => c.length);
  assert.deepEqual(counts, [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
  assert.equal(g.stock.length, 50);
  for (const col of g.columns) {
    col.forEach((c, i) => assert.equal(c.faceUp, i === col.length - 1));
  }
});

test("same seed gives the same deal", () => {
  assert.deepEqual(Spider.newGame(2, 7).columns, Spider.newGame(2, 7).columns);
});

test("runLength counts only same-suit descending face-up cards", () => {
  assert.equal(Spider.runLength([card("S", 9), card("S", 8), card("S", 7)]), 3);
  assert.equal(Spider.runLength([card("S", 9), card("H", 8), card("S", 7)]), 1);
  assert.equal(Spider.runLength([card("S", 9, false), card("S", 8)]), 1);
  assert.equal(Spider.runLength([]), 0);
});

test("moving a run requires the destination top to be one higher", () => {
  const s = emptyState();
  s.columns[0] = [card("H", 7), card("S", 6)];
  s.columns[1] = [card("D", 8)];
  s.columns[2] = [card("C", 5)];
  assert.equal(Spider.canMoveRun(s, 0, 1, 1), false); // 6 cannot go onto 8
  assert.equal(Spider.canMoveRun(s, 0, 1, 2), false); // 6 cannot go onto 5
  s.columns[1] = [card("D", 7)];
  assert.equal(Spider.canMoveRun(s, 0, 1, 1), true); // 6 onto 7 of any suit
  s.columns[3] = [];
  assert.equal(Spider.canMoveRun(s, 0, 1, 3), true); // any run to empty column
});

test("applyMove flips the revealed card and does not mutate input", () => {
  const s = emptyState();
  s.columns[0] = [card("S", 9, false), card("S", 6)];
  s.columns[1] = [card("S", 7)];
  const before = JSON.stringify(s);
  const next = Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 1 });
  assert.equal(JSON.stringify(s), before);
  assert.equal(next.columns[0][0].faceUp, true);
  assert.equal(next.columns[1].length, 2);
  s.columns[2] = [card("C", 5)];
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 2 }), null);
});

test("completing K..A of one suit removes it and counts a set", () => {
  const s = emptyState();
  const run = [];
  for (let r = 13; r >= 2; r--) run.push(card("H", r));
  s.columns[0] = run;
  s.columns[1] = [card("H", 1)];
  const next = Spider.applyMove(s, { type: "move", from: 1, count: 1, to: 0 });
  assert.equal(next.completed, 1);
  assert.equal(next.columns[0].length, 0);
});

test("deal is blocked while any column is empty", () => {
  const g = Spider.newGame(1, 3);
  g.columns[0] = [];
  assert.equal(Spider.dealRow(g), null);
  assert.equal(Spider.legalMoves(g).some((m) => m.type === "deal"), false);
});

test("deal adds one face-up card to each column", () => {
  const g = Spider.newGame(4, 5);
  const next = Spider.dealRow(g);
  assert.equal(next.stock.length, 40);
  next.columns.forEach((col, i) => {
    assert.equal(col.length, g.columns[i].length + 1);
    assert.equal(col[col.length - 1].faceUp, true);
  });
});

test("deal moves the top 10 stock cards to columns 0 to 9 in order, face-up", () => {
  for (const [suitCount, seed] of [[1, 5], [2, 5], [4, 5]]) {
    const g = Spider.newGame(suitCount, seed);
    const before = JSON.stringify(g);
    const next = Spider.dealRow(g);
    for (let i = 0; i < 10; i++) {
      assert.equal(next.columns[i].length, g.columns[i].length + 1);
      const last = next.columns[i][next.columns[i].length - 1];
      const src = g.stock[g.stock.length - 1 - i];
      assert.equal(last.suit, src.suit);
      assert.equal(last.rank, src.rank);
      assert.equal(last.faceUp, true);
      assert.deepEqual(next.columns[i].slice(0, -1), g.columns[i]);
    }
    assert.equal(next.stock.length, g.stock.length - 10);
    assert.deepEqual(next.stock, g.stock.slice(0, -10));
    assert.equal(JSON.stringify(g), before);
  }
});

// Every deal the player can be dealt comes from the seed bank, and each one stores
// a winning line. Replaying those lines proves the deals are winnable and catches
// any change to the deal or the rules that would break them.
const Bank = require("./seeds.js");

function parseMoves(text) {
  return text.split(" ").map((token) => {
    if (token === "D") return { type: "deal" };
    const [from, count, to] = token.split(".").map(Number);
    return { type: "move", from, count, to };
  });
}

for (const suitCount of [1, 2, 4]) {
  test(`every ${suitCount}-suit seed-bank deal is winnable by its stored line`, () => {
    const entries = Bank[suitCount];
    assert.ok(entries.length > 0, "seed bank must not be empty");
    for (const { seed, moves } of entries) {
      let s = Spider.newGame(suitCount, seed);
      for (const m of parseMoves(moves)) {
        s = Spider.applyMove(s, m);
        assert.ok(s, `seed ${seed}: stored move is illegal`);
      }
      assert.equal(Spider.isWon(s), true, `seed ${seed} did not finish`);
    }
  });
}
