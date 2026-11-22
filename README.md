# Tarotic Games Collection

A personal collection of games I like to play, built with help from Claude agents.

## Games

| Game | Status | Location |
|------|--------|----------|
| Sudoku | Playable locally (browser) | [`games/sudoku`](games/sudoku) |
| Spider Solitaire | Playable locally (browser) | [`games/spider`](games/spider) |
| Yahtzee | Playable locally (browser) | [`games/yahtzee`](games/yahtzee) |

## Running Spider Solitaire locally

No build step or server is needed. Open the file in a browser:

```
games/spider/index.html
```

Pick 1, 2 or 4 suits and click **New game**. Drag a face-up run of same-suit cards (descending, e.g. 9-8-7) onto a card one rank higher, or onto an empty column. Double-click a run to send it automatically. **Undo** (or Ctrl+Z) takes back the last move. Click the stock pile to deal a row.

**Settings** lets you change the card back, card style, interface theme and background color. Your choices are saved in the browser.

Every deal is winnable: each one is stored in `games/spider/seeds.js` with a verified winning line. To rebuild that bank (slow for 4 suits), run `node games/spider/build-seeds.js`.

## Running Sudoku locally

No build step or server is needed. Open the file in a browser:

```
games/sudoku/index.html
```

Pick a difficulty and click **New game**. Difficulty is set by the number of clues the puzzle starts with:

- **Easy**: 40 clues
- **Medium**: 32 clues
- **Hard**: 26 clues

Every generated puzzle has exactly one solution.

Controls: click a cell and type 1-9 (or use the number pad), Backspace/0 to clear, arrow keys to move. **Check** highlights wrong numbers in red.

## Running Yahtzee locally

No build step or server is needed. Open the file in a browser:

```
games/yahtzee/index.html
```

Click **Roll** to start a turn. You get up to three rolls per turn. Click a die to hold it between rolls. When you are happy with the dice, click a score in the scorecard. The standard rules apply: the upper bonus, the extra Yahtzee bonus and the joker. The table is green and the dice are red. **Light mode** changes the table tone and is saved in the browser.

## Running tests

Requires Node.js 18+.

```
npm test
```
