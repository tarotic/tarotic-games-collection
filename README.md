# Tarotic Games Collection

A personal collection of games I like to play, built with help from Claude agents.

## Games

| Game | Status | Location |
|------|--------|----------|
| Sudoku | Playable locally (browser) | [`games/sudoku`](games/sudoku) |
| Spider Solitaire | Playable locally (browser) | [`games/spider`](games/spider) |
| Yahtzee | Playable locally (browser) | [`games/yahtzee`](games/yahtzee) |
| Boggle (solo) | Playable locally (browser) | [`games/boggle`](games/boggle) |

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

## Running Boggle (solo) locally

No build step or server is needed. Open the file in a browser:

```
games/boggle/index.html
```

Press **Start round** to start the three-minute timer. Choose how to enter words with the **Tapping** / **Typing** switch (Tapping is the default):

- **Tapping**: tap touching tiles to build the word. Each new tile must touch the last one and not be used already. **Clear** empties the word; Enter submits it. Tapping the last tile again also submits it, so a repeated letter (the second s in "boss") submits only when you tap that tile a second time. Swiping is not yet supported.
- **Typing**: type a word and press Enter. A word counts if it is in the dictionary, at least 3 letters long, and can be traced through touching letters (including diagonals) without reusing a letter cube. **Qu** is one cube and spells "qu". Points follow classic Boggle: 3-4 letters 1 point, 5 letters 2, 6 letters 3, 7 letters 5, 8 or more 11.

When time runs out, the round shows every word you missed. **New board** rolls a fresh board at any time.

The dictionary is `games/boggle/words.js`, built from the public-domain ENABLE word list. To rebuild it: `node games/boggle/build-words.js <wordlist.txt>`.

## Running tests

Requires Node.js 18+.

```
npm test
```

The test script lists each test file by name, which works on any Node version.
