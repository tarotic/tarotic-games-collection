PASS

# Test report: Spider Solitaire increment 1 (browser-verified)

Scope tested: the increment 1 code as committed in fdf5dde (`games/spider`), checked out to a scratch copy and run in headless Microsoft Edge (version 158) over `file://` and over a local http server. Requirements and plan used: docs/requirements-increment-1.md and docs/plan-increment-1.md (docs/requirements.md and docs/plan.md now describe increment 2).

IMPORTANT context: while I was testing, increment 2 (animated stock deal: `deal-anim.js`, changes to app.js, style.css, index.html, spider-core.test.js and seeds.js) appeared in the working tree. That work is out of scope here. It makes my browser checks of "deal, then undo immediately" fail against the live tree, because the animation ignores input while running (increment 2's own rule). So the browser suite was run against the committed increment 1 baseline using `SPIDER_ROOT`. Re-verify increment 1 behaviors after increment 2 lands.

## Test run

1. `npm test` on the current working tree (includes increment 2 files): `tests 77, pass 77, fail 0`. Earlier, before increment 2 landed: `tests 46, pass 46, fail 0`, with all 12 spider tests from the plan listed by name and passing, including "every 1-suit / 2-suit / 4-suit seed-bank deal is winnable by its stored line", plus the Sudoku tests.
2. Adversarial node tests: `tests/adversarial/spider-seeds.test.js`, 11 pass. They independently replay every stored winning line (1-, 2- and 4-suit) and check suit counts, unique seeds, no mutation, illegal-move rejection, and that style.css/app.js contain the planned fixes.
3. Adversarial browser tests: `tests/adversarial/spider-browser.test.js`, driven by raw DevTools protocol with no dependencies. Run: `SPIDER_ROOT=<dir containing games/spider> node --test tests/adversarial/spider-browser.test.js`. Against the increment 1 baseline every browser test passes: the file-mode and general tests in one full run (the http-mode tests in that run failed only because of a path bug in my own harness), then the 14 http-mode tests passed in a re-run after I fixed the harness.
4. Sensitivity check: I reverted the CSS fix in a scratch copy (`--card-w: 84px` plus `.board { min-width: max-content }`). The layout tests then FAIL at 1280px and 1366px at 150% zoom and still pass at 100% and 125%. So the tests do detect the original fault, and the shipped fix removes it.

## [AUTO] criteria

- `npm test` passes, including replay of every stored winning line: PASS (output above).
- Sudoku tests stay green: PASS.

## Bugs

None reproduced against increment 1.

## MANUAL criteria that I checked in headless Edge (file:// and http)

All of these passed against the increment 1 baseline. Headless is not the same as a human at a real window, so the human checklist below stays as the sign-off.

- L1 (no horizontal scroll): `documentElement.scrollWidth <= clientWidth` and `.table` scrollWidth <= clientWidth at 1280, 1366 and 1920 CSS px, each at 100%, 125% and 150% zoom, with a 4-suit game, also after dealing all 5 rows. PASS, file and http.
- L2 (all 10 columns and the stock inside 0..clientWidth, stock width equals card width): PASS at the same 9 combinations.
- Resize 1920 down to 940 mid-game: no horizontal scroll at 1500, 1100, 1000, 960, 940. PASS.
- S1 (suits): choosing 1, 2, 4, 2, 1, 4 suits gives exactly that many distinct suits after dealing all rows. PASS.
- M1 to M5, W1 through real mouse events: for every stored line in seeds.js (all 1-suit and 2-suit entries and all 5 four-suit entries in file mode; first and last entry per suit mode in http mode) I replayed the whole winning line using actual mouse drags and stock clicks. Every drag moved the right run (including multi-card runs), Moves rose by 1 per move, "deals left" dropped by 1 per stock click, the first deal was undone and redone correctly (board, Moves and deals left restored exactly), Sets reached 8/8, the win message appeared, the stock ended disabled with "0 deals left", and undoing every move restored the exact initial board with Moves 0, Sets 0, Undo disabled and "5 deals left". PASS.
- Illegal target, drop in the gap between columns, drop outside the board, drop on the source column, and a synthetic pointercancel mid-drag: board, Moves and Undo state unchanged, ghost removed. PASS.
- Pressing a face-up card above a broken (mixed-suit) run does not start a drag. PASS.
- Stock click with an empty column: shows "Every column needs at least one card...", Moves unchanged. PASS.
- Ctrl+Z undoes with the dialog closed and does nothing with the Settings dialog open; changing Suits mid-game resets to Moves 0, Undo disabled, 5 deals left. PASS.
- "New game" in 4-suit mode never repeats the same deal twice in a row (60 clicks); every New game in 1, 2 and 4 suit modes (25 each) matches a deal rebuilt from a seeds.js seed; no console errors. PASS.
- T1: each of the 4 card backs gives a distinct computed look for face-down cards and for the stock. PASS.
- T2: each of the 3 card styles gives a distinct computed look. The drag ghost uses the selected style (Large shows the rank, Minimal hides corners) and has the same width and height as the board cards at 1366 px with 150% zoom. PASS.
- T3: the color input and each of the 5 swatches set the body background (computed colors checked after the 0.2 s transition). PASS.
- T4: settings persist after reload in both file and http modes in headless Edge. Corrupt `localStorage` values ("not json", "null", "[1,2]", "42", unknown option values) do not break the page; "not json" falls back to defaults. PASS.

## Not verified (UNVERIFIABLE here)

- A real classic Windows vertical scrollbar (the 20px allowance in `--card-w`): headless Edge reported no scrollbar width (innerWidth equal to clientWidth) even with scrollbar-forcing flags, so this was not exercised. The test skips itself and says so. The arithmetic is covered by the 940 to 1000 px resize test, but the real scrollbar case stays manual.
- Google Chrome: not installed at the standard path, so Chrome was not run. Edge only.
- Real Windows display scaling (e.g. 1366 screen at 150%): approximated by browser-zoom emulation (CSS width = physical / zoom).
- Sand swatch readability (plan edge case 15) and general look of backs and card styles: needs a human eye.
- Alt+Tab pointercancel on a real OS: only a synthetic `pointercancel` was dispatched.
- Real localStorage persistence in a normal (non-headless, non-incognito) Chrome/Edge profile opened from file://.
- "Do not touch" files: I could not independently diff against a pre-fix baseline because the only baseline is the commit itself. The working tree now also changes seeds.js and spider-core.test.js (increment 2 work).

## Observations (not bugs)

- The default suit mode in index.html is now 2 suits ("default 2 suits" in the commit message). The requirement says layout is checked with a freshly dealt 4-suit game, so my layout tests select 4 suits first. Confirm that 2 is the intended default.
- Seed bank has 5 four-suit deals (8, 10, 13, 15 and 46); decisions.md named 4 for increment 1. All 5 replay as wins. Confirm 46 is wanted.
- When running my tests, the app's "avoid an immediate repeat" rule means choosing the already-selected suit and getting the same stubbed random value gives the next deal. Harness issue only, handled with a suit detour.
- Test-harness note: the full browser suite takes about 12 minutes in file mode because it replays all ~65 stored lines by real mouse; the http run is about 2.5 minutes.

## MANUAL checklist for the human

Run each row in Chrome and Edge on Windows, from `file://` and from a local server (the two ways in decisions.md). Headless Edge passed all rows marked as checked above.

| # | Check | Headless Edge (file, http) | Human: Chrome file | Chrome server | Edge file | Edge server |
|---|---|---|---|---|---|---|
| L1 | No horizontal scrollbar at 1280, 1366, 1920 with a fresh 4-suit game. Repeat at 125% and 150% browser zoom and with a tall page (deal several rows) so a classic vertical scrollbar appears. | pass (classic scrollbar not exercised) | | | | |
| L2 | All 10 columns and the stock are fully visible without sideways scrolling. | pass | | | | |
| S1 | 1, 2, 4 suits each start a game with that many distinct suits. | pass | | | | |
| M1 | Drag a legal run onto a legal column; drop on an illegal one and it returns. | pass | | | | |
| M2 | A multi-card run moves together. | pass | | | | |
| M3 | Undo restores the board and lowers Moves by 1 after a move and after a deal; disabled when nothing to undo. | pass | | | | |
| M4 | Stock click deals one card per column; "deals left" drops by 1 from 5. | pass | | | | |
| M5 | A completed K-to-A run disappears and Sets goes up (try 1-suit). | pass | | | | |
| T1 | Each of the 4 card backs changes face-down cards and the stock immediately. | pass | | | | |
| T2 | Each of the 3 card styles changes face-up cards immediately; the dragged run uses the same style. | pass | | | | |
| T3 | The color input and each of the 5 swatches change the page background immediately. Check the Sand swatch stays readable. | pass (readability not judged) | | | | |
| T4 | Settings are still applied after reload. | pass | | | | |
| W1 | Every New game comes from seeds.js; no console errors; never "No winnable ... deals are available." | pass | | | | |
| Extra | Real Windows display scaling at 150% on a 1366 px screen: no horizontal scrollbar. | not possible | | | | |

Files written: `C:\Users\alexa\Claude Projects\tarotic-games-collection\tests\adversarial\spider-seeds.test.js`, `C:\Users\alexa\Claude Projects\tarotic-games-collection\tests\adversarial\spider-browser.test.js`, and this report.
