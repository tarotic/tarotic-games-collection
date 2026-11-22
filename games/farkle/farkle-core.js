/**
 * Farkle core: scoring, dice rolls and turn/game flow.
 *
 * Works in the browser (attaches to window.FarkleCore) and in Node (module.exports).
 * Dice are integers from 1 to 6.
 *
 * Game state is a plain object mutated by the functions below:
 *   - newGame(names) creates a game with 2 to 4 players.
 *   - roll(game) throws the dice still available to roll. A roll with no scoring dice is a Farkle.
 *   - keep(game, indices) keeps a valid scoring selection from the current roll.
 *   - bank(game) adds the turn score to the current player's total and ends the turn.
 *   - Rolling a Farkle ends the turn and forfeits its points.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FarkleCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const TARGET_SCORE = 10000;
  const OPENING_MINIMUM = 500;
  const DICE_COUNT = 6;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 4;

  function sortDescending(values) {
    return [...values].sort((a, b) => b - a);
  }

  function rollDice(count, rand) {
    const random = rand || Math.random;
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(Math.floor(random() * 6) + 1);
    }
    return values;
  }

  // Points for a set of kept dice, or null when the set is not a valid scoring selection.
  // Every die must be used: 1s and 5s score alone, any face with three or more scores as a group.
  function scoreSelection(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 6)) return null;

    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of values) counts[v] += 1;
    const faces = counts.slice(1);

    if (values.length === 6 && faces.every((n) => n === 1)) return 1500; // straight 1-6
    if (values.length === 6 && faces.filter((n) => n === 2).length === 3 && faces.every((n) => n === 0 || n === 2)) {
      return 1500; // three pairs
    }

    let points = 0;
    for (let face = 1; face <= 6; face++) {
      const n = counts[face];
      if (n === 0) continue;
      if (n >= 3) {
        const base = face === 1 ? 1000 : face * 100;
        points += base * 2 ** (n - 3); // each die beyond three doubles the group
      } else if (face === 1) {
        points += 100 * n;
      } else if (face === 5) {
        points += 50 * n;
      } else {
        return null; // a lone or paired 2, 3, 4 or 6 cannot be kept
      }
    }
    return points;
  }

  // True when some non-empty group of these dice scores. False means a Farkle.
  function hasScoringDice(values) {
    const total = 1 << values.length;
    for (let mask = 1; mask < total; mask++) {
      const subset = values.filter((_, i) => mask & (1 << i));
      if (scoreSelection(subset) !== null) return true;
    }
    return false;
  }

  function freshTurn() {
    return { available: DICE_COUNT, dice: null, kept: [], turnScore: 0, hotDice: false };
  }

  function newGame(names, options) {
    if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
      throw new Error("Farkle needs 2 to 4 players");
    }
    const opts = options || {};
    return {
      players: names.map((name) => ({ name, total: 0, opened: false })),
      current: 0,
      turn: freshTurn(),
      target: opts.target === undefined ? TARGET_SCORE : opts.target,
      openingMinimum: opts.openingMinimum === undefined ? OPENING_MINIMUM : opts.openingMinimum,
      finalRound: false,
      finalTrigger: null,
      over: false,
      winners: [],
      lastEvent: null,
    };
  }

  function endTurn(game, event) {
    game.lastEvent = event;
    game.turn = null;
    const next = (game.current + 1) % game.players.length;
    if (game.finalRound && next === game.finalTrigger) {
      game.over = true;
      const best = Math.max(...game.players.map((p) => p.total));
      game.winners = game.players.flatMap((p, i) => (p.total === best ? [i] : []));
      return;
    }
    game.current = next;
    game.turn = freshTurn();
  }

  // Rolls the dice still available. Returns { farkle, dice }; a Farkle ends the turn.
  function roll(game, rand) {
    if (game.over) throw new Error("Game is over");
    const turn = game.turn;
    if (turn.dice !== null) throw new Error("Keep a scoring selection before rolling again");
    const values = rollDice(turn.available, rand);
    if (!hasScoringDice(values)) {
      endTurn(game, "farkle");
      return { farkle: true, dice: sortDescending(values) };
    }
    turn.dice = sortDescending(values);
    turn.hotDice = false;
    return { farkle: false, dice: turn.dice };
  }

  // Points the selected dice would score, without changing the game. Null when invalid.
  function keepPoints(game, indices) {
    const turn = game.turn;
    if (!turn || turn.dice === null || !isValidIndexList(indices, turn.dice.length)) return null;
    return scoreSelection(indices.map((i) => turn.dice[i]));
  }

  function isValidIndexList(indices, length) {
    if (!Array.isArray(indices) || indices.length === 0) return false;
    const seen = new Set();
    for (const i of indices) {
      if (!Number.isInteger(i) || i < 0 || i >= length || seen.has(i)) return false;
      seen.add(i);
    }
    return true;
  }

  // Keeps the selected dice of the current roll. Returns { points, hotDice }.
  function keep(game, indices) {
    const turn = game.turn;
    if (turn.dice === null) throw new Error("Nothing to keep yet");
    const points = keepPoints(game, indices);
    if (points === null) throw new Error("Invalid selection");
    const values = indices.map((i) => turn.dice[i]);
    turn.turnScore += points;
    turn.kept = sortDescending(turn.kept.concat(values));
    turn.available -= values.length;
    turn.dice = null;
    turn.hotDice = false;
    if (turn.available === 0) {
      turn.available = DICE_COUNT; // hot dice: all six may be rolled again
      turn.kept = [];
      turn.hotDice = true;
    }
    return { points, hotDice: turn.hotDice };
  }

  // Whether the current player may bank, counting `extra` points from a pending selection.
  function canBank(game, extra) {
    const turn = game.turn;
    if (!turn || game.over) return false;
    const score = turn.turnScore + (extra || 0);
    if (score <= 0) return false;
    const player = game.players[game.current];
    return player.opened || score >= game.openingMinimum;
  }

  // Adds the turn score to the current player's total and ends the turn.
  function bank(game) {
    const turn = game.turn;
    if (turn.dice !== null) throw new Error("Keep a scoring selection before banking");
    if (!canBank(game, 0)) throw new Error("Cannot bank yet");
    const player = game.players[game.current];
    player.total += turn.turnScore;
    player.opened = true;
    if (!game.finalRound && player.total >= game.target) {
      game.finalRound = true;
      game.finalTrigger = game.current;
    }
    endTurn(game, "banked");
    return player.total;
  }

  return {
    TARGET_SCORE,
    OPENING_MINIMUM,
    DICE_COUNT,
    MIN_PLAYERS,
    MAX_PLAYERS,
    sortDescending,
    rollDice,
    scoreSelection,
    hasScoringDice,
    newGame,
    roll,
    keepPoints,
    keep,
    canBank,
    bank,
  };
});
