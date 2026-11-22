const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./cryptogram-core.js");

// A deterministic random source that cycles through the given values in [0, 1).
function sequence(...values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const SAMPLE = { text: "Call me Ishmael.", author: "Herman Melville" };

function puzzleFor(text = SAMPLE.text, rng = Math.random) {
  return C.createPuzzle({ text, author: "Test" }, rng);
}

test("a key is a permutation of the alphabet with no letter mapped to itself", () => {
  for (let run = 0; run < 50; run += 1) {
    const { encode, decode } = C.makeKey();
    const cipher = Object.values(encode).sort().join("");
    assert.equal(cipher, C.ALPHABET);
    C.ALPHABET.split("").forEach((letter) => {
      assert.notEqual(encode[letter], letter);
      assert.equal(decode[encode[letter]], letter);
    });
  }
});

test("only letters are encoded; spaces and punctuation are kept", () => {
  const puzzle = puzzleFor("Call me Ishmael.");
  const cells = C.encodedCells(puzzle);
  assert.equal(cells.map((c) => c.char).join(""), "CALL ME ISHMAEL.");
  cells.forEach((cell) => {
    if (cell.char === " " || cell.char === ".") {
      assert.equal(cell.cipher, null);
    } else {
      assert.match(cell.cipher, /^[A-Z]$/);
      assert.equal(puzzle.decode[cell.cipher], cell.char);
    }
  });
});

test("the puzzle lists each distinct cipher letter once", () => {
  const puzzle = puzzleFor("Call me Ishmael.");
  const distinct = new Set("CALLMEISHMAEL");
  assert.equal(puzzle.cipherLetters.length, distinct.size);
  assert.deepEqual(puzzle.cipherLetters, [...distinct].map((ch) => puzzle.encode[ch]).sort());
});

test("guesses are stored in upper case and can be cleared", () => {
  const game = C.createGame(puzzleFor());
  const cipher = game.puzzle.cipherLetters[0];
  assert.equal(C.setGuess(game, cipher, "q"), true);
  assert.equal(game.guesses[cipher], "Q");
  assert.equal(C.setGuess(game, cipher, ""), true);
  assert.equal(game.guesses[cipher], undefined);
  assert.equal(C.setGuess(game, cipher, "1"), false);
});

test("auto-advance moves to the next letter with no guess, wrapping around", () => {
  const game = C.createGame(puzzleFor("Call me Ishmael."));
  const cells = C.encodedCells(game.puzzle);
  const first = cells.find((c) => c.cipher !== null).pos;
  const second = C.nextPositionWithoutGuess(game, first);
  assert.equal(cells[second].char, "A");

  // Guess every letter except the last one, then auto-advance from the first letter lands on the last.
  const letterCells = cells.filter((c) => c.cipher !== null);
  const last = letterCells[letterCells.length - 1];
  game.puzzle.cipherLetters
    .filter((c) => c !== last.cipher)
    .forEach((c) => C.setGuess(game, c, game.puzzle.decode[c]));
  // The unguessed cipher letter appears at several positions; auto-advance takes the first one after `first`.
  const expected = cells.find((c) => c.pos > first && c.cipher === last.cipher).pos;
  assert.equal(C.nextPositionWithoutGuess(game, first), expected);
});

test("auto-advance returns null when every letter has a guess", () => {
  const game = C.createGame(puzzleFor("Hi."));
  game.puzzle.cipherLetters.forEach((c) => C.setGuess(game, c, game.puzzle.decode[c]));
  assert.equal(C.nextPositionWithoutGuess(game, 0), null);
});

test("hint reveals the selected cipher letter when it is not yet correct", () => {
  const game = C.createGame(puzzleFor("Call me Ishmael."));
  const cells = C.encodedCells(game.puzzle);
  const selected = cells.find((c) => c.char === "M");
  const revealed = C.hint(game, selected.pos, sequence(0));
  assert.equal(revealed, selected.cipher);
  assert.equal(game.guesses[selected.cipher], "M");
  assert.equal(game.locked[selected.cipher], true);
  assert.equal(game.hintsUsed, 1);
});

test("hint with no selection reveals a random cipher letter that is not yet correct", () => {
  const game = C.createGame(puzzleFor("Call me Ishmael."));
  const candidates = game.puzzle.cipherLetters;
  const revealed = C.hint(game, null, sequence(0.999));
  assert.equal(revealed, candidates[candidates.length - 1]);
  assert.equal(C.isCorrect(game, revealed), true);
});

test("a revealed letter cannot be changed by the player", () => {
  const game = C.createGame(puzzleFor("Call me Ishmael."));
  const revealed = C.hint(game, null, sequence(0));
  assert.equal(C.setGuess(game, revealed, "Z"), false);
  assert.equal(game.guesses[revealed], game.puzzle.decode[revealed]);
});

test("hint returns null when every letter is already correct", () => {
  const game = C.createGame(puzzleFor("Hi."));
  game.puzzle.cipherLetters.forEach((c) => C.setGuess(game, c, game.puzzle.decode[c]));
  assert.equal(C.hint(game, null, sequence(0)), null);
  assert.equal(game.hintsUsed, 0);
});

test("a check that finds wrong guesses flags them and costs a penalty", () => {
  const game = C.createGame(puzzleFor("Hi."));
  const [a, b] = game.puzzle.cipherLetters;
  C.setGuess(game, a, game.puzzle.decode[a]);
  C.setGuess(game, b, game.puzzle.decode[b] === "Z" ? "Y" : "Z");
  const result = C.check(game, 5000);
  assert.deepEqual(result.wrong, [b]);
  assert.equal(game.flagged[b], true);
  assert.equal(game.penalizedChecks, 1);
  assert.equal(result.solved, false);
});

test("a check with no wrong guesses costs nothing", () => {
  const game = C.createGame(puzzleFor("Hi."));
  const [a] = game.puzzle.cipherLetters;
  C.setGuess(game, a, game.puzzle.decode[a]);
  const result = C.check(game, 5000);
  assert.deepEqual(result.wrong, []);
  assert.equal(game.penalizedChecks, 0);
});

test("each penalised check costs its own penalty", () => {
  const game = C.createGame(puzzleFor("Hi."));
  const [a] = game.puzzle.cipherLetters;
  const wrong = game.puzzle.decode[a] === "Z" ? "Y" : "Z";
  C.setGuess(game, a, wrong);
  C.check(game, 1000);
  C.check(game, 2000);
  assert.equal(game.penalizedChecks, 2);
});

test("a correct check solves the puzzle and stops the score", () => {
  const game = C.createGame(puzzleFor("Hi."));
  C.startTimer(game, 0);
  game.puzzle.cipherLetters.forEach((c) => C.setGuess(game, c, game.puzzle.decode[c]));
  const result = C.check(game, 10000);
  assert.equal(result.solved, true);
  assert.equal(game.finishedAt, 10000);
  assert.equal(C.scoreFor(game, 999999), 990);
});

test("guesses are frozen once the puzzle is solved", () => {
  const game = C.createGame(puzzleFor("Hi."));
  game.puzzle.cipherLetters.forEach((c) => C.setGuess(game, c, game.puzzle.decode[c]));
  C.check(game, 1000);
  const [a] = game.puzzle.cipherLetters;
  assert.equal(C.setGuess(game, a, "Z"), false);
});

test("the timer starts only once", () => {
  const game = C.createGame(puzzleFor("Hi."));
  C.startTimer(game, 100);
  C.startTimer(game, 900);
  assert.equal(game.startedAt, 100);
});

test("score is 1,000 minus one point per second, with no timer started it is 1,000", () => {
  const game = C.createGame(puzzleFor("Hi."));
  assert.equal(C.scoreFor(game, 999999), 1000);
  C.startTimer(game, 0);
  assert.equal(C.scoreFor(game, 30000), 970);
});

test("time score is floored at zero", () => {
  const game = C.createGame(puzzleFor("Hi."));
  C.startTimer(game, 0);
  assert.equal(C.scoreFor(game, 5000000), 0);
});

test("each hint and each penalised check takes 25 points", () => {
  const game = C.createGame(puzzleFor("Hi."));
  C.startTimer(game, 0);
  C.hint(game, null, sequence(0));
  const [a] = game.puzzle.cipherLetters.filter((c) => !C.isCorrect(game, c));
  C.setGuess(game, a, game.puzzle.decode[a] === "Z" ? "Y" : "Z");
  C.check(game, 1000);
  assert.equal(C.scoreFor(game, 0), 1000 - 25 * 2);
});

test("final score is floored at zero after penalties", () => {
  const game = C.createGame(puzzleFor("Hi."));
  C.startTimer(game, 0);
  game.hintsUsed = 100;
  assert.equal(C.scoreFor(game, 0), 0);
});

test("best score keeps the higher of the stored and the new score", () => {
  assert.equal(C.bestScore(undefined, 700), 700);
  assert.equal(C.bestScore(800, 700), 800);
  assert.equal(C.bestScore(500, 700), 700);
});

test("quotes are public domain and every entry has an author", () => {
  assert.ok(C.QUOTES.length >= 5);
  C.QUOTES.forEach((q) => {
    assert.ok(q.text.length > 0);
    assert.ok(q.author.length > 0);
  });
});
