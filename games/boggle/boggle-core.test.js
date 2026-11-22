const { test } = require("node:test");
const assert = require("node:assert/strict");
const Boggle = require("./boggle-core.js");
const WORDS = require("./words.js");

// Board helper: fill every cell with "z" unless overridden.
function boardWith(overrides) {
  const board = new Array(16).fill("z");
  for (const [cell, face] of Object.entries(overrides)) board[Number(cell)] = face;
  return board;
}

function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("dice: 16 dice of 6 faces, Q die is the Qu face", () => {
  assert.equal(Boggle.DICE.length, 16);
  for (const die of Boggle.DICE) assert.equal(die.length, 6);
  assert.equal(Boggle.faceFor("Q"), "qu");
  assert.equal(Boggle.faceFor("A"), "a");
});

test("rollBoard: 16 faces, each drawn from a die, same seed gives same board", () => {
  const a = Boggle.rollBoard(seeded(42));
  const b = Boggle.rollBoard(seeded(42));
  assert.equal(a.length, 16);
  assert.deepEqual(a, b);
  const allFaces = new Set();
  for (const die of Boggle.DICE) {
    for (const ch of die) allFaces.add(Boggle.faceFor(ch));
  }
  for (const face of a) assert.ok(allFaces.has(face), `unexpected face ${face}`);
});

test("neighbors: corner has 3, edge has 5, centre has 8", () => {
  assert.equal(Boggle.neighborsOf(0).length, 3);
  assert.equal(Boggle.neighborsOf(1).length, 5);
  assert.equal(Boggle.neighborsOf(5).length, 8);
  assert.deepEqual(Boggle.neighborsOf(0).sort((x, y) => x - y), [1, 4, 5]);
});

test("findPath: traces along a row and along a diagonal", () => {
  const row = boardWith({ 0: "c", 1: "a", 2: "t" });
  assert.deepEqual(Boggle.findPath(row, "cat"), [0, 1, 2]);
  assert.deepEqual(Boggle.findPath(row, "TAC"), [2, 1, 0]);

  const diagonal = boardWith({ 0: "c", 5: "a", 10: "t" });
  assert.deepEqual(Boggle.findPath(diagonal, "cat"), [0, 5, 10]);
});

test("findPath: rejects a word that would reuse a cell, and words not on the board", () => {
  const board = boardWith({ 0: "a" });
  assert.equal(Boggle.findPath(board, "aa"), null);
  assert.equal(Boggle.findPath(board, "aaa"), null);
  assert.equal(Boggle.findPath(board, "cat"), null);
  assert.equal(Boggle.findPath(board, ""), null);
});

test("findPath: rejects two touching letters that are not adjacent", () => {
  // c at 0 and t at 2 are two cells apart on the top row, so "cat" needs a at 1 between them
  // but "act" would need a-c-t, and c and t do not touch.
  const board = boardWith({ 0: "c", 1: "a", 2: "t" });
  assert.equal(Boggle.findPath(board, "act"), null);
});

test("findPath: the Qu face spells qu", () => {
  const board = boardWith({ 0: "qu", 1: "i", 2: "t" });
  assert.deepEqual(Boggle.findPath(board, "quit"), [0, 1, 2]);
  assert.deepEqual(Boggle.findPath(board, "Quit"), [0, 1, 2]);
  assert.equal(Boggle.findPath(board, "qit"), null);
});

test("scoreWord: classic Boggle points, words under 3 letters score 0", () => {
  assert.equal(Boggle.scoreWord("ab"), 0);
  assert.equal(Boggle.scoreWord("cat"), 1);
  assert.equal(Boggle.scoreWord("word"), 1);
  assert.equal(Boggle.scoreWord("plane"), 2);
  assert.equal(Boggle.scoreWord("planet"), 3);
  assert.equal(Boggle.scoreWord("playing"), 5);
  assert.equal(Boggle.scoreWord("playings"), 11);
  assert.equal(Boggle.scoreWord("a".repeat(16)), 11);
});

test("checkWord: accepts a dictionary word that can be traced, with points", () => {
  const dict = Boggle.createDictionary("cat\ntac\nact\nzzz");
  const board = boardWith({ 0: "c", 1: "a", 2: "t" });
  assert.deepEqual(Boggle.checkWord("cat", board, dict), { ok: true, word: "cat", points: 1 });
  assert.deepEqual(Boggle.checkWord(" CAT ", board, dict), { ok: true, word: "cat", points: 1 });
});

test("checkWord: explains each rejection", () => {
  const dict = Boggle.createDictionary("cat\nact\nzzz");
  const board = boardWith({ 0: "c", 1: "a", 2: "t" });
  assert.match(Boggle.checkWord("at", board, dict).reason, /3 letters/);
  assert.match(Boggle.checkWord("c4t", board, dict).reason, /Letters only/);
  assert.match(Boggle.checkWord("dog", board, dict).reason, /not in the dictionary/);
  assert.match(Boggle.checkWord("act", board, dict).reason, /cannot be traced/);
  assert.equal(Boggle.checkWord("act", board, dict).ok, false);
});

test("solveBoard: finds exactly the dictionary words that can be traced", () => {
  const dict = Boggle.createDictionary("cat\ntac\nact\nat");
  const board = boardWith({ 0: "c", 1: "a", 2: "t" });
  assert.deepEqual([...Boggle.solveBoard(board, dict)].sort(), ["cat", "tac"]);
});

test("solveBoard: the Qu face produces qu words", () => {
  const dict = Boggle.createDictionary("quit\nqui");
  const board = boardWith({ 0: "qu", 1: "i", 2: "t" });
  assert.deepEqual([...Boggle.solveBoard(board, dict)].sort(), ["qui", "quit"]);
});

test("words.js: the bundled list is clean, sorted and has the expected size", () => {
  const list = WORDS.split("\n");
  assert.ok(list.length > 150000, `only ${list.length} words`);
  assert.ok(list.every((w) => /^[a-z]{3,16}$/.test(w)), "found a word outside a-z, 3 to 16 letters");
  for (let i = 1; i < list.length; i++) {
    if (list[i] <= list[i - 1]) assert.fail(`not sorted or duplicate at ${list[i]}`);
  }
  const dict = Boggle.createDictionary(WORDS);
  assert.ok(dict.set.has("cat"));
  assert.ok(dict.set.has("quit"));
  assert.ok(!dict.set.has("xzq"));
});

test("solver matches brute force over the full dictionary on a seeded board", () => {
  const dict = Boggle.createDictionary(WORDS);
  const board = Boggle.rollBoard(seeded(7));
  const solved = Boggle.solveBoard(board, dict);

  const brute = new Set();
  for (const word of dict.set) {
    if (Boggle.findPath(board, word)) brute.add(word);
  }

  assert.deepEqual([...solved].sort(), [...brute].sort());
  for (const word of solved) assert.ok(Boggle.findPath(board, word), word);
});
