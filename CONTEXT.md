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

## Cryptogram

- **Cryptogram**: a puzzle in which a quote is written with each letter replaced by a different letter, using one fixed key for the whole puzzle.
- **Quote**: the plain text a cryptogram is built from, taken from the game's bundled list.
- **Key**: the letter-for-letter mapping that encodes a quote. Chosen at random for each puzzle. Every letter is changed; no letter encodes to itself.
- **Cipher letter**: a letter as it appears in the encoded text. Only letters are encoded; spaces and punctuation are shown unchanged.
- **Guess**: the plain letter a player has entered against a cipher letter.
- **Check**: the player's request to mark every guess as right or wrong. Wrong guesses are only flagged when Check is pressed. A Check that finds at least one wrong guess costs 25 points.
- **Hint**: revealing the correct letter for one cipher letter. Costs 25 points. Reveals the selected cipher letter if one is selected, otherwise a random unrevealed one.
- **Solve**: every cipher letter has a correct guess, confirmed by Check. Shows the quote's author.
- **Score**: starts at 1,000 points and drops by one point per second from the first keystroke or click, floored at zero, less 25 points for each hint and each penalised Check.
- **Best score**: the highest score a player has achieved for a quote, kept per browser.

## Golf

- **Grid**: the six cards in front of the player, laid out as two rows of three. Each **column** is a top and a bottom card.
- **Column**: one vertical pair of grid cards.
- **Pair**: the two cards in one column that share a rank. Suits do not matter. A pair scores 0.
- **Stock**: the face-down cards not yet drawn. Empties into a new stock from the discard pile.
- **Discard pile**: the face-up cards discarded so far. Only its top card can be drawn.
- **Hand**: the one card drawn during a turn, before it is placed or discarded.
- **Turn**: one draw, followed by either a swap into the grid or a discard and a flip.
- **Swap**: placing the card in hand into a grid position. The card it replaces goes face up onto the discard pile.
- **Round**: one deal of the grid, ending once all six grid cards are face up.
- **Deal number**: the number that fixes a game's shuffles, so the same game can be replayed.
