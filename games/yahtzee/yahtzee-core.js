/**
 * Yahtzee core: dice rolling, scoring rules and scorecard totals.
 *
 * Works in the browser (attaches to window.YahtzeeCore) and in Node (module.exports).
 * Dice are arrays of five numbers from 1 to 6.
 * A scorecard is an object: each category maps to its points, or null when still open.
 * `yahtzeeBonus` counts the extra Yahtzee bonuses (100 points each).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.YahtzeeCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"];
  const LOWER = [
    "threeKind",
    "fourKind",
    "fullHouse",
    "smallStraight",
    "largeStraight",
    "yahtzee",
    "chance",
  ];
  const CATEGORIES = [...UPPER, ...LOWER];

  const LABELS = {
    ones: "Ones",
    twos: "Twos",
    threes: "Threes",
    fours: "Fours",
    fives: "Fives",
    sixes: "Sixes",
    threeKind: "Three of a kind",
    fourKind: "Four of a kind",
    fullHouse: "Full house",
    smallStraight: "Small straight",
    largeStraight: "Large straight",
    yahtzee: "Yahtzee",
    chance: "Chance",
  };

  const UPPER_BONUS_THRESHOLD = 63;
  const UPPER_BONUS = 35;
  const YAHTZEE_BONUS = 100;
  const JOKER_FULL_HOUSE = 25;
  const JOKER_SMALL_STRAIGHT = 30;
  const JOKER_LARGE_STRAIGHT = 40;

  function newScorecard() {
    const card = { yahtzeeBonus: 0 };
    for (const c of CATEGORIES) card[c] = null;
    return card;
  }

  // Rolls the dice that are not held. `held` is an array of booleans, one per die.
  // `rng` returns numbers in [0, 1); defaults to Math.random.
  function rollDice(dice, held, rng) {
    const random = rng || Math.random;
    return dice.map((value, i) => (held && held[i] ? value : 1 + Math.floor(random() * 6)));
  }

  function countFaces(dice) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) counts[d]++;
    return counts;
  }

  function sum(dice) {
    return dice.reduce((a, b) => a + b, 0);
  }

  function isYahtzee(dice) {
    return dice.length === 5 && dice.every((d) => d === dice[0]);
  }

  function hasStraight(dice, length) {
    const faces = new Set(dice);
    const runs = [
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
    ];
    if (length === 4) {
      // Any run of four consecutive faces.
      for (let start = 1; start <= 3; start++) {
        if ([0, 1, 2, 3].every((k) => faces.has(start + k))) return true;
      }
      return false;
    }
    return runs.some((run) => run.every((f) => faces.has(f)));
  }

  /**
   * Points for one category. `joker` applies the Yahtzee joker values:
   * full house 25, small straight 30, large straight 40, regardless of the dice.
   */
  function scoreCategory(category, dice, joker) {
    const counts = countFaces(dice);
    const total = sum(dice);
    const upperIndex = UPPER.indexOf(category);
    if (upperIndex !== -1) {
      const face = upperIndex + 1;
      return counts[face] * face;
    }
    switch (category) {
      case "threeKind":
        return counts.some((c) => c >= 3) ? total : 0;
      case "fourKind":
        return counts.some((c) => c >= 4) ? total : 0;
      case "fullHouse":
        if (joker) return JOKER_FULL_HOUSE;
        return counts.some((c) => c === 3) && counts.some((c) => c === 2) ? 25 : 0;
      case "smallStraight":
        if (joker) return JOKER_SMALL_STRAIGHT;
        return hasStraight(dice, 4) ? 30 : 0;
      case "largeStraight":
        if (joker) return JOKER_LARGE_STRAIGHT;
        return hasStraight(dice, 5) ? 40 : 0;
      case "yahtzee":
        return isYahtzee(dice) ? 50 : 0;
      case "chance":
        return total;
      default:
        throw new Error("Unknown category: " + category);
    }
  }

  // A further Yahtzee counts for the bonus and triggers joker rules
  // only when the Yahtzee category already holds 50.
  function isJokerRoll(card, dice) {
    return isYahtzee(dice) && card.yahtzee === 50;
  }

  /**
   * The categories the player may score now, with the points each would give.
   * Applies the forced joker rules when a joker roll is made.
   */
  function scoreOptions(card, dice) {
    const options = {};
    if (isJokerRoll(card, dice)) {
      const upperCategory = UPPER[dice[0] - 1];
      if (card[upperCategory] === null) {
        options[upperCategory] = scoreCategory(upperCategory, dice, false);
        return options;
      }
      const openLower = LOWER.filter((c) => card[c] === null);
      if (openLower.length > 0) {
        for (const c of openLower) options[c] = scoreCategory(c, dice, true);
        return options;
      }
      for (const c of UPPER) {
        if (card[c] === null) options[c] = 0;
      }
      return options;
    }
    for (const c of CATEGORIES) {
      if (card[c] === null) options[c] = scoreCategory(c, dice, false);
    }
    return options;
  }

  /**
   * Scores a category for the dice. Returns the new scorecard, or throws if the
   * category is not allowed. The 100-point Yahtzee bonus is added when applicable.
   */
  function applyScore(card, category, dice) {
    const options = scoreOptions(card, dice);
    if (!(category in options)) {
      throw new Error("Category not available: " + category);
    }
    const next = { ...card, [category]: options[category] };
    if (isJokerRoll(card, dice)) {
      next.yahtzeeBonus = card.yahtzeeBonus + 1;
    }
    return next;
  }

  function totals(card) {
    const upperSum = UPPER.reduce((a, c) => a + (card[c] || 0), 0);
    const upperBonus = upperSum >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
    const lowerSum = LOWER.reduce((a, c) => a + (card[c] || 0), 0);
    const yahtzeeBonus = card.yahtzeeBonus * YAHTZEE_BONUS;
    return {
      upper: upperSum,
      upperBonus,
      lower: lowerSum,
      yahtzeeBonus,
      total: upperSum + upperBonus + lowerSum + yahtzeeBonus,
    };
  }

  function isComplete(card) {
    return CATEGORIES.every((c) => card[c] !== null);
  }

  return {
    CATEGORIES,
    UPPER,
    LOWER,
    LABELS,
    UPPER_BONUS_THRESHOLD,
    UPPER_BONUS,
    YAHTZEE_BONUS,
    newScorecard,
    rollDice,
    scoreCategory,
    scoreOptions,
    applyScore,
    totals,
    isComplete,
    isYahtzee,
  };
});
