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

## Klondike

- **Tableau**: the seven columns of cards in play. Each column is built down in alternating colours.
- **Foundation**: one of four piles, one per suit, built up from Ace to King.
- **Stock**: the face-down cards that have not yet been drawn.
- **Waste**: the face-up cards drawn from the stock. Only its top card can be played.
- **Draw count**: how many cards each stock click turns over to the waste, either 1 or 3.
- **Redeal**: turning the waste back over into the stock once the stock is empty. Unlimited.
- **Run**: a sequence of face-up tableau cards, each one rank lower and the opposite colour of the one above, that moves as one unit.
- **Deal number**: the number that fixes which shuffle a game uses, so the same game can be replayed.
- **Auto-complete**: moving every remaining card to the foundations, offered once the stock is empty and every tableau card is face up.

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
