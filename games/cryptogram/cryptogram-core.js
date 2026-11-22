/**
 * Cryptogram core: quotes, keys, guesses, hints, checks and scoring.
 *
 * Works in the browser (attaches to window.CryptogramCore) and in Node (module.exports).
 *
 * Only letters are encoded. Spaces and punctuation stay as they are.
 * Every letter is changed: no letter encodes to itself.
 *
 * Game state is a plain object mutated by the functions below:
 *   - createGame(puzzle) starts a puzzle.
 *   - startTimer(game, now) starts the clock on the first keystroke or click.
 *   - setGuess(game, cipher, letter) records a guess for a cipher letter.
 *   - hint(game, selectedPos, rng) reveals the correct letter for one cipher letter.
 *   - check(game, now) marks wrong guesses and solves the puzzle when all are right.
 *   - scoreFor(game, now) gives the current score.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CryptogramCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const MAX_SCORE = 1000;
  const POINTS_PER_SECOND = 1;
  const PENALTY = 25;

  // Public-domain quotes only.
  const QUOTES = [
    { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen" },
    { text: "It was the best of times, it was the worst of times.", author: "Charles Dickens" },
    { text: "To be, or not to be, that is the question.", author: "William Shakespeare" },
    { text: "Knowledge is power.", author: "Francis Bacon" },
    { text: "Give me liberty, or give me death!", author: "Patrick Henry" },
    { text: "Hope is the thing with feathers that perches in the soul.", author: "Emily Dickinson" },
    { text: "Call me Ishmael.", author: "Herman Melville" },
    { text: "I think, therefore I am.", author: "René Descartes" },
    { text: "The unexamined life is not worth living.", author: "Plato" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  ];

  function defaultRandom() {
    return Math.random();
  }

  function shuffle(values, rng) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** A random key with no letter mapped to itself. Returns { encode, decode }. */
  function makeKey(rng = defaultRandom) {
    let perm;
    do {
      perm = shuffle(ALPHABET.split(""), rng);
    } while (perm.some((letter, i) => letter === ALPHABET[i]));

    const encode = {};
    const decode = {};
    for (let i = 0; i < ALPHABET.length; i += 1) {
      encode[ALPHABET[i]] = perm[i];
      decode[perm[i]] = ALPHABET[i];
    }
    return { encode, decode };
  }

  /** Picks a quote index at random. */
  function pickQuoteIndex(rng = defaultRandom, avoid = null) {
    if (QUOTES.length === 1) return 0;
    let index;
    do {
      index = Math.floor(rng() * QUOTES.length);
    } while (index === avoid);
    return index;
  }

  /** Builds a puzzle from a quote entry with a fresh random key. */
  function createPuzzle(quote, rng = defaultRandom) {
    const { encode, decode } = makeKey(rng);
    const plainLetters = new Set(quote.text.toUpperCase().split("").filter((ch) => ALPHABET.includes(ch)));
    const cipherLetters = [...plainLetters].map((ch) => encode[ch]).sort();
    return {
      text: quote.text.toUpperCase(),
      author: quote.author,
      encode,
      decode,
      cipherLetters,
    };
  }

  /**
   * One entry per character of the puzzle text, in order.
   * Letters have cipher set to the encoded letter; other characters have cipher null.
   */
  function encodedCells(puzzle) {
    return puzzle.text.split("").map((ch, pos) => {
      const isLetter = ALPHABET.includes(ch);
      return { pos, char: ch, cipher: isLetter ? puzzle.encode[ch] : null };
    });
  }

  function createGame(puzzle) {
    return {
      puzzle,
      guesses: {},
      locked: {},
      flagged: {},
      hintsUsed: 0,
      penalizedChecks: 0,
      startedAt: null,
      finishedAt: null,
      solved: false,
    };
  }

  function startTimer(game, now) {
    if (game.startedAt === null) game.startedAt = now;
  }

  function isCorrect(game, cipher) {
    return game.guesses[cipher] === game.puzzle.decode[cipher];
  }

  /** Records a guess for a cipher letter. Returns false if it was ignored. */
  function setGuess(game, cipher, letter) {
    if (game.solved || game.locked[cipher]) return false;
    if (!ALPHABET.includes(cipher)) return false;
    if (letter === "" || letter === null) {
      delete game.guesses[cipher];
      delete game.flagged[cipher];
      return true;
    }
    const upper = String(letter).toUpperCase();
    if (!ALPHABET.includes(upper)) return false;
    game.guesses[cipher] = upper;
    delete game.flagged[cipher];
    return true;
  }

  /**
   * Position of the next letter cell after fromPos (wrapping) whose cipher letter has no guess.
   * Returns null when every letter has a guess.
   */
  function nextPositionWithoutGuess(game, fromPos) {
    const cells = encodedCells(game.puzzle);
    const count = cells.length;
    for (let step = 1; step <= count; step += 1) {
      const cell = cells[(fromPos + step + count) % count];
      if (cell.cipher !== null && game.guesses[cell.cipher] === undefined) {
        return cell.pos;
      }
    }
    return null;
  }

  /**
   * Reveals the correct letter for one cipher letter.
   * Uses the selected cell's cipher letter if it still needs a correct guess,
   * otherwise a random cipher letter that is not yet correct.
   * Returns the revealed cipher letter, or null if nothing was left to reveal.
   */
  function hint(game, selectedPos, rng = defaultRandom) {
    if (game.solved) return null;
    const candidates = game.puzzle.cipherLetters.filter((c) => !isCorrect(game, c));
    if (candidates.length === 0) return null;

    let target = null;
    if (selectedPos !== null && selectedPos !== undefined) {
      const selected = encodedCells(game.puzzle)[selectedPos];
      if (selected && selected.cipher !== null && candidates.includes(selected.cipher)) {
        target = selected.cipher;
      }
    }
    if (target === null) {
      target = candidates[Math.floor(rng() * candidates.length)];
    }

    game.guesses[target] = game.puzzle.decode[target];
    game.locked[target] = true;
    delete game.flagged[target];
    game.hintsUsed += 1;
    return target;
  }

  /**
   * Marks every wrong guess. A check that finds any wrong guess costs a penalty.
   * When every cipher letter is correct the puzzle is solved.
   * Returns { solved, wrong } where wrong lists the flagged cipher letters.
   */
  function check(game, now) {
    if (game.solved) return { solved: true, wrong: [] };

    const wrong = game.puzzle.cipherLetters.filter(
      (c) => game.guesses[c] !== undefined && !isCorrect(game, c)
    );
    game.flagged = {};
    wrong.forEach((c) => {
      game.flagged[c] = true;
    });

    if (wrong.length > 0) {
      game.penalizedChecks += 1;
    }

    const allCorrect = game.puzzle.cipherLetters.every((c) => isCorrect(game, c));
    if (allCorrect) {
      game.solved = true;
      game.finishedAt = now;
      game.flagged = {};
    }
    return { solved: game.solved, wrong };
  }

  /**
   * Score: 1,000 minus one point per second since the timer started, floored at zero.
   * Each hint and each penalised check then takes 25 points off, and the result is floored at zero.
   */
  function scoreFor(game, now) {
    let elapsedSeconds = 0;
    if (game.startedAt !== null) {
      const end = game.solved && game.finishedAt !== null ? game.finishedAt : now;
      elapsedSeconds = Math.max(0, Math.floor((end - game.startedAt) / 1000));
    }
    const timeScore = Math.max(0, MAX_SCORE - elapsedSeconds * POINTS_PER_SECOND);
    const penalties = PENALTY * (game.hintsUsed + game.penalizedChecks);
    return Math.max(0, timeScore - penalties);
  }

  /** The best score for a quote is the higher of the stored and the new score. */
  function bestScore(stored, score) {
    const previous = Number.isFinite(stored) ? stored : 0;
    return Math.max(previous, score);
  }

  return {
    QUOTES,
    ALPHABET,
    MAX_SCORE,
    PENALTY,
    makeKey,
    pickQuoteIndex,
    createPuzzle,
    encodedCells,
    createGame,
    startTimer,
    isCorrect,
    setGuess,
    nextPositionWithoutGuess,
    hint,
    check,
    scoreFor,
    bestScore,
  };
});
