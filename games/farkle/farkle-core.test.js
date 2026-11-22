const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./farkle-core.js");

// A random source that produces the given face values, in order, for rollDice.
function faces(...values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return (v - 1 + 0.5) / 6;
  };
}

test("single 1s and 5s score 100 and 50", () => {
  assert.equal(F.scoreSelection([1]), 100);
  assert.equal(F.scoreSelection([5]), 50);
  assert.equal(F.scoreSelection([1, 5, 5]), 200);
});

test("a lone 2, 3, 4 or 6 is not a scoring selection", () => {
  assert.equal(F.scoreSelection([2]), null);
  assert.equal(F.scoreSelection([3, 3]), null);
  assert.equal(F.scoreSelection([4, 1]), null);
});

test("three of a kind scores face value times 100, and 1s score 1000", () => {
  assert.equal(F.scoreSelection([2, 2, 2]), 200);
  assert.equal(F.scoreSelection([3, 3, 3]), 300);
  assert.equal(F.scoreSelection([6, 6, 6]), 600);
  assert.equal(F.scoreSelection([1, 1, 1]), 1000);
});

test("each die beyond three doubles the group", () => {
  assert.equal(F.scoreSelection([3, 3, 3, 3]), 600);
  assert.equal(F.scoreSelection([3, 3, 3, 3, 3]), 1200);
  assert.equal(F.scoreSelection([1, 1, 1, 1]), 2000);
  assert.equal(F.scoreSelection([2, 2, 2, 2, 2, 2]), 1600);
});

test("a triple plus singles scores both", () => {
  assert.equal(F.scoreSelection([4, 4, 4, 1, 5]), 550);
});

test("a straight of six scores 1500", () => {
  assert.equal(F.scoreSelection([1, 2, 3, 4, 5, 6]), 1500);
});

test("three pairs score 1500", () => {
  assert.equal(F.scoreSelection([2, 2, 4, 4, 6, 6]), 1500);
  assert.equal(F.scoreSelection([1, 1, 5, 5, 3, 3]), 1500);
});

test("a selection with a lone non-scoring die is invalid", () => {
  assert.equal(F.scoreSelection([1, 2]), null);
  assert.equal(F.scoreSelection([3, 3, 3, 2]), null);
  assert.equal(F.scoreSelection([]), null);
});

test("farkle is a roll with no scoring group", () => {
  assert.equal(F.hasScoringDice([2, 2, 3, 3, 4, 6]), false);
  assert.equal(F.hasScoringDice([2, 3, 4, 6, 6, 2]), false);
  assert.equal(F.hasScoringDice([2, 3, 4, 6, 6, 5]), true);
  assert.equal(F.hasScoringDice([1, 2, 3, 4, 6, 6]), true);
});

test("newGame needs 2 to 4 players", () => {
  assert.throws(() => F.newGame(["Ann"]));
  assert.throws(() => F.newGame(["A", "B", "C", "D", "E"]));
  assert.equal(F.newGame(["A", "B"]).players.length, 2);
});

test("roll shows dice sorted from largest to smallest", () => {
  const game = F.newGame(["A", "B"]);
  const result = F.roll(game, faces(2, 5, 1, 6, 3, 1));
  assert.equal(result.farkle, false);
  assert.deepEqual(result.dice, [6, 5, 3, 2, 1, 1]);
});

test("a Farkle ends the turn with nothing banked", () => {
  const game = F.newGame(["A", "B"]);
  const result = F.roll(game, faces(2, 3, 4, 6, 2, 3));
  assert.equal(result.farkle, true);
  assert.equal(game.current, 1);
  assert.equal(game.players[0].total, 0);
  assert.equal(game.lastEvent, "farkle");
});

test("keeping scores the selection and leaves the rest to roll", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(5, 1, 2, 2, 2, 6)); // shows 6,5,2,2,2,1
  assert.deepEqual(game.turn.dice, [6, 5, 2, 2, 2, 1]);
  const result = F.keep(game, [2, 3, 4]); // the three 2s
  assert.equal(result.points, 200);
  assert.equal(game.turn.turnScore, 200);
  assert.equal(game.turn.available, 3);
  assert.equal(game.turn.dice, null);
});

test("invalid selections are rejected and do not change the turn", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(6, 5, 2, 2, 2, 1));
  assert.equal(F.keepPoints(game, [0]), null); // a lone 6
  assert.throws(() => F.keep(game, [0]));
  assert.equal(game.turn.turnScore, 0);
  assert.equal(game.turn.dice.length, 6);
});

test("you cannot roll again before keeping a selection", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(1, 2, 3, 4, 6, 6));
  assert.throws(() => F.roll(game, faces(1)));
});

test("keeping every die is hot dice: all six roll again", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(5, 5, 1, 1, 1, 1)); // shows 5,5,1,1,1,1
  const result = F.keep(game, [0, 1, 2, 3, 4, 5]);
  assert.equal(result.points, 2100); // two 5s (100) + four 1s (2000)
  assert.equal(result.hotDice, true);
  assert.equal(game.turn.available, 6);
  assert.equal(game.turn.turnScore, 2100);
  assert.deepEqual(game.turn.kept, []);
});

test("first bank needs the 500-point opening minimum", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(1, 2, 3, 4, 6, 1)); // shows 6,4,3,2,1,1
  F.keep(game, [4]); // one 1 = 100
  assert.equal(F.canBank(game, 0), false);
  assert.throws(() => F.bank(game));
});

test("banking adds the turn score and passes to the next player", () => {
  const game = F.newGame(["A", "B"]);
  F.roll(game, faces(1, 1, 1, 5, 2, 2)); // shows 5,2,2,1,1,1
  F.keep(game, [3, 4, 5]); // three 1s = 1000, which opens the account
  const total = F.bank(game);
  assert.equal(total, 1000);
  assert.equal(game.players[0].total, 1000);
  assert.equal(game.players[0].opened, true);
  assert.equal(game.current, 1);
});

test("after opening, any positive score can be banked", () => {
  const game = F.newGame(["A", "B"]);
  game.players[0].opened = true;
  F.roll(game, faces(5, 2, 3, 4, 6, 2)); // shows 6,5,4,3,2,2
  F.keep(game, [1]); // one 5 = 50
  assert.equal(F.canBank(game, 0), true);
  assert.equal(F.bank(game), 50);
});

test("reaching the target triggers a final round for the others", () => {
  const game = F.newGame(["A", "B", "C"], { target: 1000 });
  game.players[0].opened = true;
  game.players[0].total = 950;
  game.players[1].opened = true;
  game.players[2].opened = true;
  F.roll(game, faces(1, 2, 3, 4, 6, 2)); // shows 6,4,3,2,2,1
  F.keep(game, [5]); // the 1 = 100, A reaches 1050
  F.bank(game);
  assert.equal(game.finalRound, true);
  assert.equal(game.finalTrigger, 0);
  assert.equal(game.over, false);
  assert.equal(game.current, 1);

  // B and C each take a final turn and Farkle. The game then ends.
  F.roll(game, faces(2, 3, 4, 6, 2, 3));
  assert.equal(game.current, 2);
  F.roll(game, faces(2, 3, 4, 6, 2, 3));
  assert.equal(game.over, true);
  assert.deepEqual(game.winners, [0]);
});

test("a tie for the highest score lists every winner", () => {
  const game = F.newGame(["A", "B"], { target: 100 });
  game.players[0].opened = true;
  game.players[0].total = 90;
  game.players[1].opened = true;
  game.players[1].total = 190;
  F.roll(game, faces(1, 2, 3, 4, 6, 2)); // shows 6,4,3,2,2,1
  F.keep(game, [5]); // the 1 = 100, A reaches 190 and triggers the final round
  F.bank(game);
  F.roll(game, faces(2, 3, 4, 6, 2, 3)); // B's final turn: Farkle
  assert.equal(game.over, true);
  assert.deepEqual(game.winners, [0, 1]);
});
