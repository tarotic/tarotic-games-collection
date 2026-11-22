# Tarotic Games Collection

A glossary of the terms used across the games in the collection. Implementation details belong in the code, not here.

## Yahtzee

- **Turn**: one player's sequence of up to three rolls, ending when they score a category.
- **Roll**: one throw of the dice that are not held.
- **Hold**: keeping a die between rolls so the next roll leaves it unchanged.
- **Category**: one of the 13 scoring lines on the scorecard.
- **Scorecard**: the full sheet of categories for one game.
- **Upper bonus**: the 35 points awarded when the upper section totals 63 or more.
- **Yahtzee**: five matching dice, scored in the Yahtzee category.
- **Joker**: the rule that lets a further Yahtzee score in another category once the Yahtzee category has been filled with 50.

## Farkle

- **Farkle turn**: one player's run of rolls, ending when they bank or roll a Farkle. Not to be confused with the Yahtzee **Turn**.
- **Roll**: one throw of the dice that are not kept. Shared with Yahtzee.
- **Scoring selection**: the dice a player keeps from a roll. Only valid scoring groups can be kept.
- **Turn score**: points accumulated in the current Farkle turn that are not yet banked.
- **Bank**: end the Farkle turn and add the turn score to the player's total.
- **Farkle**: a roll with no scoring dice. The player loses the turn score and their turn ends.
- **Hot dice**: when every die has been kept in scoring selections, the player may roll all six dice again.
- **Opening minimum**: the 500-point minimum a player must bank on their first bank of the game. Later banks have no minimum.
- **Target score**: 10,000 points. The first player to reach it triggers a final round.
- **Final round**: one last Farkle turn for each other player after someone reaches the target score.
