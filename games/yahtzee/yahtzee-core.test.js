const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("./yahtzee-core.js");

function card(overrides) {
  return { ...Y.newScorecard(), ...overrides };
}

test("upper categories score the sum of matching faces", () => {
  assert.equal(Y.scoreCategory("ones", [1, 1, 3, 4, 6], false), 2);
  assert.equal(Y.scoreCategory("fives", [5, 5, 5, 2, 1], false), 15);
  assert.equal(Y.scoreCategory("sixes", [1, 2, 3, 4, 5], false), 0);
});

test("three and four of a kind score the total of all dice", () => {
  assert.equal(Y.scoreCategory("threeKind", [3, 3, 3, 4, 5], false), 18);
  assert.equal(Y.scoreCategory("threeKind", [3, 3, 4, 4, 5], false), 0);
  assert.equal(Y.scoreCategory("fourKind", [2, 2, 2, 2, 6], false), 14);
  assert.equal(Y.scoreCategory("fourKind", [2, 2, 2, 3, 6], false), 0);
});

test("full house needs exactly three and two; five of a kind is not a full house", () => {
  assert.equal(Y.scoreCategory("fullHouse", [2, 2, 3, 3, 3], false), 25);
  assert.equal(Y.scoreCategory("fullHouse", [4, 4, 4, 4, 4], false), 0);
  assert.equal(Y.scoreCategory("fullHouse", [1, 2, 3, 4, 5], false), 0);
});

test("small straight accepts any run of four; large straight needs five", () => {
  assert.equal(Y.scoreCategory("smallStraight", [1, 2, 3, 4, 6], false), 30);
  assert.equal(Y.scoreCategory("smallStraight", [3, 4, 5, 6, 6], false), 30);
  assert.equal(Y.scoreCategory("smallStraight", [1, 2, 4, 5, 6], false), 0);
  assert.equal(Y.scoreCategory("largeStraight", [2, 3, 4, 5, 6], false), 40);
  assert.equal(Y.scoreCategory("largeStraight", [1, 2, 3, 4, 6], false), 0);
});

test("Yahtzee scores 50 for five matching dice and chance sums everything", () => {
  assert.equal(Y.scoreCategory("yahtzee", [6, 6, 6, 6, 6], false), 50);
  assert.equal(Y.scoreCategory("yahtzee", [6, 6, 6, 6, 5], false), 0);
  assert.equal(Y.scoreCategory("chance", [1, 2, 3, 4, 5], false), 15);
});

test("every one of the 13 categories can be scored and recorded", () => {
  const dice = [1, 2, 3, 4, 5];
  let c = Y.newScorecard();
  for (const category of Y.CATEGORIES) {
    c = Y.applyScore(c, category, dice);
  }
  assert.equal(Y.isComplete(c), true);
  assert.equal(Y.CATEGORIES.length, 13);
});

test("a category cannot be scored twice", () => {
  const c = Y.applyScore(Y.newScorecard(), "chance", [1, 2, 3, 4, 5]);
  assert.throws(() => Y.applyScore(c, "chance", [6, 6, 6, 6, 6]));
});

test("upper bonus of 35 is awarded at 63 or more and not below", () => {
  const base = Y.newScorecard();
  const at63 = { ...base, ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
  assert.equal(Y.totals(at63).upper, 63);
  assert.equal(Y.totals(at63).upperBonus, 35);
  const at62 = { ...at63, sixes: 17 };
  assert.equal(Y.totals(at62).upperBonus, 0);
});

test("totals combine upper, bonus, lower and Yahtzee bonus", () => {
  const c = {
    ...Y.newScorecard(),
    sixes: 30,
    fives: 25,
    fours: 12,
    threes: 0,
    twos: 0,
    ones: 0,
    chance: 20,
    yahtzee: 50,
    yahtzeeBonus: 2,
  };
  const t = Y.totals(c);
  assert.equal(t.upper, 67);
  assert.equal(t.upperBonus, 35);
  assert.equal(t.lower, 70);
  assert.equal(t.yahtzeeBonus, 200);
  assert.equal(t.total, 67 + 35 + 70 + 200);
});

test("a second Yahtzee after scoring 50 earns the 100-point bonus", () => {
  const c = card({ yahtzee: 50, fours: 12 });
  const next = Y.applyScore(c, "chance", [4, 4, 4, 4, 4]);
  assert.equal(next.yahtzeeBonus, 1);
  assert.equal(next.chance, 20);
});

test("a Yahtzee after scoring 0 in the Yahtzee category earns no bonus or joker", () => {
  const c = card({ yahtzee: 0 });
  const options = Y.scoreOptions(c, [4, 4, 4, 4, 4]);
  assert.equal(options.fours, 20);
  assert.equal(options.fullHouse, 0);
  assert.equal(Y.applyScore(c, "fours", [4, 4, 4, 4, 4]).yahtzeeBonus, 0);
});

test("joker forces scoring in the matching upper box when it is open", () => {
  const c = card({ yahtzee: 50, chance: 10 });
  const options = Y.scoreOptions(c, [3, 3, 3, 3, 3]);
  assert.deepEqual(Object.keys(options), ["threes"]);
  assert.equal(options.threes, 15);
});

test("joker allows lower categories with fixed values once the matching upper box is filled", () => {
  const c = card({ yahtzee: 50, threes: 9 });
  const options = Y.scoreOptions(c, [3, 3, 3, 3, 3]);
  assert.equal(options.fullHouse, 25);
  assert.equal(options.smallStraight, 30);
  assert.equal(options.largeStraight, 40);
  assert.equal(options.threeKind, 15);
  assert.equal(options.fourKind, 15);
  assert.equal(options.chance, 15);
  assert.equal("threes" in options, false);
  assert.equal("yahtzee" in options, false);
});

test("when the lower section is full, a joker must score zero in an open upper box", () => {
  const c = card({
    yahtzee: 50,
    threes: 9,
    threeKind: 0,
    fourKind: 0,
    fullHouse: 0,
    smallStraight: 0,
    largeStraight: 0,
    chance: 0,
  });
  const options = Y.scoreOptions(c, [3, 3, 3, 3, 3]);
  assert.deepEqual(Object.keys(options).sort(), ["ones", "fives", "fours", "sixes", "twos"].sort());
  assert.equal(Object.values(options).every((v) => v === 0), true);
});

test("rollDice keeps held dice and rerolls the rest with the given rng", () => {
  const rng = () => 0; // always rolls 1
  const rolled = Y.rollDice([2, 3, 4, 5, 6], [true, false, true, false, false], rng);
  assert.deepEqual(rolled, [2, 1, 4, 1, 1]);
});

test("rollDice returns faces from 1 to 6", () => {
  let seed = 7;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 200; i++) {
    for (const d of Y.rollDice([1, 1, 1, 1, 1], null, rng)) {
      assert.ok(d >= 1 && d <= 6);
    }
  }
});
