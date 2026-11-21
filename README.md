# Tarotic Games Collection

A personal collection of games I like to play, built with help from Claude agents.

## Games

| Game | Status | Location |
|------|--------|----------|
| Sudoku | Playable locally (browser) | [`games/sudoku`](games/sudoku) |

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

## Running tests

Requires Node.js 18+.

```
npm test
```
