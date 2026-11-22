const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("./golf-core.js");

const card = (rank, faceUp = true, suit = "S") => ({ suit, rank, faceUp });

// Build a state by hand so each test controls the exact cards.
function makeState(overrides = {}) {
  return {
    seed: 1,
    rounds: 9,
    round: 1,
    phase: "draw",
    columns: [
      [card(2), card(9)],
      [card(5), card(12)],
      [card(13), card(7, false)],
    ],
    stock: [card(4, false), card(8, false)],
    discard: [card(6)],
    drawn: null,
    drewFromDiscard: false,
    reshuffles: 0,
    scores: [],
    ...overrides,
  };
}

function allCards(state) {
  return [...state.columns.flat(), ...state.stock, ...state.discard, ...(state.drawn ? [state.drawn] : [])];
}

test("cardValue: A is 1, 2-10 face value, J/Q/K are 10", () => {
  assert.equal(G.cardValue(1), 1);
  assert.equal(G.cardValue(7), 7);
  assert.equal(G.cardValue(10), 10);
  assert.equal(G.cardValue(11), 10);
  assert.equal(G.cardValue(12), 10);
  assert.equal(G.cardValue(13), 10);
});

test("newGame deals 6 face-down grid cards, one face-up discard, and the rest in stock", () => {
  const s = G.newGame(42);
  assert.equal(s.phase, "reveal");
  assert.equal(s.round, 1);
  assert.equal(s.rounds, 9);
  assert.equal(s.columns.length, 3);
  assert.ok(s.columns.every((col) => col.length === 2));
  assert.ok(s.columns.flat().every((c) => !c.faceUp));
  assert.equal(s.discard.length, 1);
  assert.equal(s.discard[0].faceUp, true);
  assert.equal(s.stock.length, 52 - 6 - 1);
  assert.equal(allCards(s).length, 52);
  assert.equal(new Set(allCards(s).map((c) => c.suit + c.rank)).size, 52);
});

test("the same seed deals the same game, and different seeds differ", () => {
  assert.deepEqual(G.newGame(7), G.newGame(7));
  assert.notDeepEqual(G.newGame(7).columns, G.newGame(8).columns);
});

test("reveal: flipping one face-down card starts the turn in draw phase", () => {
  const s = G.newGame(3);
  const next = G.flipCard(s, 1, 0);
  assert.equal(next.phase, "draw");
  assert.equal(next.columns[1][0].faceUp, true);
  // The input state is not mutated.
  assert.equal(s.columns[1][0].faceUp, false);
});

test("flipCard refuses a face-up card, and refuses outside reveal and flip", () => {
  const s = G.newGame(3);
  const once = G.flipCard(s, 0, 0);
  assert.equal(G.flipCard(once, 0, 0), null);
  assert.equal(G.flipCard(makeState({ phase: "draw", columns: [[card(1, false), card(2, false)], [card(3, false), card(4, false)], [card(5, false), card(6, false)]] }), 0, 0), null);
});

test("draw from stock puts the card in hand and moves to place phase", () => {
  const s = makeState();
  const next = G.draw(s, "stock");
  assert.equal(next.phase, "place");
  assert.equal(next.drawn.rank, 8);
  assert.equal(next.drawn.faceUp, true);
  assert.equal(next.drewFromDiscard, false);
  assert.equal(next.stock.length, 1);
});

test("draw from discard takes the top card and marks it as discard-drawn", () => {
  const next = G.draw(makeState({ discard: [card(3), card(11)] }), "discard");
  assert.equal(next.drawn.rank, 11);
  assert.equal(next.discard.length, 1);
  assert.equal(next.drewFromDiscard, true);
  assert.equal(next.phase, "place");
});

test("draw is refused outside the draw phase or from an empty pile", () => {
  assert.equal(G.draw(makeState({ phase: "place" }), "stock"), null);
  assert.equal(G.draw(makeState({ discard: [] }), "discard"), null);
  assert.equal(G.draw(makeState({ stock: [], discard: [card(6)] }), "stock"), null);
});

test("discardDrawn: a discard-drawn card cannot be discarded straight back", () => {
  const s = G.draw(makeState({ discard: [card(3), card(11)] }), "discard");
  assert.equal(G.discardDrawn(s), null);
});

test("discardDrawn: a stock card is discarded face up and the turn moves to flip", () => {
  const s = G.draw(makeState(), "stock");
  const next = G.discardDrawn(s);
  assert.equal(next.phase, "flip");
  assert.equal(next.drawn, null);
  assert.equal(next.discard[next.discard.length - 1].rank, 8);
  assert.equal(next.discard[next.discard.length - 1].faceUp, true);
});

test("flip phase: flipping a face-down card returns to draw phase", () => {
  const s = makeState({
    phase: "flip",
    columns: [
      [card(2), card(9, false)],
      [card(5), card(12)],
      [card(13), card(7, false)],
    ],
  });
  const next = G.flipCard(s, 0, 1);
  assert.equal(next.phase, "draw");
  assert.equal(next.columns[0][1].faceUp, true);
});

test("placeDrawn swaps the drawn card into the slot and puts the replaced card face up on the discard", () => {
  const s = G.draw(makeState(), "stock");
  const next = G.placeDrawn(s, 0, 1);
  assert.equal(next.columns[0][1].rank, 8);
  assert.equal(next.columns[0][1].faceUp, true);
  assert.equal(next.discard[next.discard.length - 1].rank, 9);
  assert.equal(next.discard[next.discard.length - 1].faceUp, true);
  assert.equal(next.drawn, null);
  assert.equal(next.phase, "draw");
});

test("placeDrawn works on a discard-drawn card", () => {
  const s = G.draw(makeState({ discard: [card(3), card(11)] }), "discard");
  const next = G.placeDrawn(s, 2, 0);
  assert.equal(next.columns[2][0].rank, 11);
  assert.equal(next.discard[next.discard.length - 1].rank, 13);
});

test("placeDrawn is refused outside the place phase", () => {
  assert.equal(G.placeDrawn(makeState({ phase: "draw" }), 0, 0), null);
});

test("round ends as soon as every grid card is face up", () => {
  const s = makeState({
    phase: "place",
    columns: [
      [card(2), card(9)],
      [card(5), card(12)],
      [card(13), card(7, false)],
    ],
    drawn: card(4),
  });
  const next = G.placeDrawn(s, 2, 1);
  assert.equal(next.phase, "roundEnd");
  // Column scores: (2+9) + (5+10) + (10+4) = 40
  assert.deepEqual(next.scores, [40]);
});

test("roundScore: a pair of matching ranks in a column scores 0", () => {
  const columns = [
    [card(7), card(7, true, "H")],
    [card(5), card(12)],
    [card(1), card(13)],
  ];
  // 0 + (5+10) + (1+10) = 26
  assert.equal(G.roundScore(columns), 26);
});

test("roundScore: pairs count only when the ranks match, not the suits", () => {
  const columns = [
    [card(10, true, "S"), card(10, true, "C")],
    [card(10, true, "S"), card(11, true, "C")],
    [card(1), card(2)],
  ];
  // First column is a pair (0). Second is 10 + 10 = 20. Third is 1 + 2 = 3.
  assert.equal(G.roundScore(columns), 23);
});

test("discard-drawn card can complete the round with a pair", () => {
  const s = makeState({
    phase: "place",
    columns: [
      [card(4), card(9)],
      [card(5), card(12)],
      [card(13), card(7)],
    ],
    drawn: card(9, true, "H"),
    drewFromDiscard: true,
    discard: [card(6)],
  });
  const next = G.placeDrawn(s, 0, 0);
  assert.equal(next.phase, "roundEnd");
  // Column 0: 9 and 9 is a pair -> 0. Column 1: 5+10=15. Column 2: 10+7=17.
  assert.deepEqual(next.scores, [32]);
});

test("draw from an empty stock recycles the discard pile, keeping its top card", () => {
  const s = makeState({
    stock: [],
    discard: [card(2), card(3), card(4)],
  });
  const next = G.draw(s, "stock");
  assert.equal(next.reshuffles, 1);
  assert.equal(next.discard.length, 1);
  assert.equal(next.discard[0].rank, 4);
  // The drawn card is one of the recycled cards and is now face up.
  assert.equal(next.drawn.faceUp, true);
  assert.equal(next.stock.length, 1);
  assert.ok(next.stock.every((c) => c.faceUp === false));
});

test("recycling is deterministic for the same state", () => {
  const s = makeState({ stock: [], discard: [card(2), card(3), card(4), card(5)] });
  assert.deepEqual(G.draw(s, "stock"), G.draw(s, "stock"));
});

test("draw from an empty stock with only one discard card is refused", () => {
  assert.equal(G.draw(makeState({ stock: [], discard: [card(6)] }), "stock"), null);
});

test("nextRound deals round 2 and resets the turn", () => {
  const s = makeState({ phase: "roundEnd", round: 1, scores: [30], drawn: null });
  const next = G.nextRound(s);
  assert.equal(next.round, 2);
  assert.equal(next.phase, "reveal");
  assert.deepEqual(next.scores, [30]);
  assert.equal(next.discard.length, 1);
  assert.equal(next.stock.length, 45);
});

test("nextRound after the last round ends the game", () => {
  const s = makeState({ phase: "roundEnd", round: 9, rounds: 9, scores: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
  const next = G.nextRound(s);
  assert.equal(next.phase, "over");
  assert.equal(G.totalScore(next.scores), 45);
});

test("a full nine-round game can be played through to the end", () => {
  // Turn each card face up by taking the stock and swapping into every slot in turn.
  let s = G.newGame(99);
  let guard = 0;
  while (s.phase !== "over") {
    guard += 1;
    assert.ok(guard < 5000, "game did not finish");
    if (s.phase === "reveal" || s.phase === "flip") {
      const row = s.columns.map((col, c) => [c, col.findIndex((x) => !x.faceUp)]).find(([, r]) => r >= 0);
      s = G.flipCard(s, row[0], row[1]);
    } else if (s.phase === "draw") {
      s = G.draw(s, "stock") || G.draw(s, "discard");
    } else if (s.phase === "place") {
      if (s.drewFromDiscard) {
        s = G.placeDrawn(s, 0, 0);
      } else {
        const slot = s.columns.flatMap((col, c) => col.map((x, r) => [c, r, x])).find(([, , x]) => !x.faceUp);
        s = slot ? G.placeDrawn(s, slot[0], slot[1]) : G.discardDrawn(s);
      }
    } else if (s.phase === "roundEnd") {
      s = G.nextRound(s);
    }
    assert.ok(s, "a legal move was refused");
  }
  assert.equal(s.scores.length, 9);
  assert.equal(allCards(s).length, 52);
});

test("states are never mutated", () => {
  const s = makeState();
  const snapshot = JSON.stringify(s);
  G.draw(s, "stock");
  G.draw(s, "discard");
  assert.equal(JSON.stringify(s), snapshot);
});
