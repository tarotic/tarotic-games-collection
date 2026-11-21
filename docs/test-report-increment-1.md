PASS

# Test report: Spider Solitaire increment 1

PASS covers only what node can check. All layout, drag and settings criteria need a real browser and are UNVERIFIABLE by the tester (see the MANUAL checklist).

## Test run

`npm test` (node v26.13.1): tests 46, pass 46, fail 0. All 12 spider tests from plan.md appear by name and pass (including the three "every N-suit seed-bank deal is winnable by its stored line" tests), and the Sudoku tests pass.

New tests: `C:\Users\alexa\Claude Projects\tarotic-games-collection\games\spider\adversarial.test.js` (24 tests, names start with `adv:` or `static:`). No source, engineer test or doc other than this report was edited.

My first run had 1 failure, caused by a wrong assertion in my own test (moving to an empty column is legal). I fixed the test, not the code.

## [AUTO] criteria

- `npm test` passes including stored-line replay: PASS (output above).
- Sudoku tests stay green: PASS.

## Bugs

None reproduced.

## Static check against plan.md (read the files, and asserted in the `static:` tests)

- `style.css` `:root`: `--card-w: min(84px, calc((min(100vw - 20px, 1000px) - 96px) / 10));` and `--card-h: calc(var(--card-w) * 118 / 84);` match the plan exactly. `--off-down: 12px` and `--off-up: 28px` unchanged.
- `--card-w` is defined only on `:root` plus the 600px media block (fixed 62px). No self-reference cycle.
- `.board` has no `min-width` and no `max-content` anywhere in the file. The grid columns and the 8px gap are unchanged.
- `.table { overflow-x: auto; padding-bottom: 8px; }` and the `@media (max-width: 600px)` block are unchanged.
- `app.js` line 221: ``ghost.className = `ghost face-${settings.face}`;`` is the only `ghost.className` assignment. `.face-large` and `.face-minimal` rules exist in style.css.
- Interface Light/Dark (`body.ui-dark`) and the localStorage settings are still present.
- Arithmetic check: `--card-w` is 84px at 1280, 1366 and 1920. At 940, 911, 853, 700 and 601 px the board plus padding fits within width minus 20px.

## Observations (not bugs, for the human)

- Seed bank has 5 four-suit deals (8, 10, 13, 15 and 46). decisions.md says 4 stored deals for increment 1. The four decided seeds are present and all five replay as wins. The extra seed 46 is likely from an earlier builder run. Confirm it is wanted.
- I could not diff `seeds.js`, `spider-core.js`, `build-seeds.js`, `spider-core.test.js` or `games/sudoku/` against a baseline, because `games/spider/` is untracked in git. I read the code and confirmed the plan's edit sites. "Do not touch" for those files is UNVERIFIABLE by diff. `package.json` shows a one-line diff, adding `games/spider/` to the test script. That is what makes the spider tests run. It is not an edit made by this increment as far as I can tell, but it does conflict with the plan's "do not touch package.json", so please confirm.
- The 20px scrollbar allowance and the 84px to 79px shrink at about 911 CSS px are only checked by arithmetic, not in a browser.

## MANUAL checklist (all rows: NOT RUN, tester cannot run a browser)

Run each row in Chrome and Edge, from `file://` and from a local server (4 runs).

| # | Check | Chrome file | Chrome server | Edge file | Edge server |
|---|---|---|---|---|---|
| L1 | No horizontal scrollbar at 1280, 1366, 1920 with a fresh 4-suit game. Console: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and `.table` scrollWidth <= clientWidth both true. Repeat at 125% and 150% zoom. | not run | not run | not run | not run |
| L2 | All 10 columns and the stock are fully visible at the same widths. | not run | not run | not run | not run |
| S1 | "1 suit", "2 suits", "4 suits" each start a game with only 1, 2 or 4 distinct suits. | not run | not run | not run | not run |
| M1 | Drag a legal run onto a legal column (moves) and onto an illegal one (returns). | not run | not run | not run | not run |
| M2 | A run of 2 or more cards moves together. | not run | not run | not run | not run |
| M3 | Undo restores the board and lowers Moves by 1 after a move and after a deal. Undo is disabled on a new game and after undoing everything. | not run | not run | not run | not run |
| M4 | Clicking the stock deals one card per column and "deals left" drops by 1, starting at 5. | not run | not run | not run | not run |
| M5 | A completed K-to-A same-suit run is removed and Sets goes up (easiest in 1-suit). | not run | not run | not run | not run |
| T1 | Each of the 4 card backs changes face-down cards and the stock immediately. | not run | not run | not run | not run |
| T2 | Each of the 3 card styles changes face-up cards immediately. Drag a run in Large and in Minimal: the ghost matches (the app.js fix). | not run | not run | not run | not run |
| T3 | The color input and each of the 5 swatches change the page background immediately. | not run | not run | not run | not run |
| T4 | Settings persist after reload. In the file:// runs, note whether localStorage persists. | not run | not run | not run | not run |
| W1 | New game always comes from seeds.js: `window.SpiderSeedBank` defined, no console errors, status never shows "No winnable ... deals are available." | not run | not run | not run | not run |

Plan edge cases 1 to 15 that need a browser (zoom, classic scrollbar, resize, ghost size and style, drop in gaps, pointercancel, partial-run press, undo after deal and set, stock with empty column, final deal, suit change mid-game, Ctrl+Z with the dialog open, corrupt localStorage, Sand swatch readability): UNVERIFIABLE by the tester, not run. Rules-level parts (undo state, stock blocked with an empty column, 5 deals then none, set removal and flip, partial run detection) are covered in the `adv:` tests and pass.
