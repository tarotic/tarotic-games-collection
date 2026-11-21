# Plan: Spider Solitaire, increment 1 (working in a real browser)

Sources: docs/requirements.md, docs/decisions.md (overrides the open questions), docs/roadmap.md, and the current code in games/spider. There is no CLAUDE.md, web-rules.md or templates/plan-template.md, so this plan uses the default sections and keeps the existing structure: plain script tags, a global `window.SpiderCore`, tests next to the code.

No BLOCKERS. decisions.md answers every open question that affects this increment.

## Scope

Already built, so not re-planned: `games/spider/spider-core.js`, `seeds.js`, `build-seeds.js`, `spider-core.test.js`, `app.js`, `index.html`, `style.css`.

Remaining work:
1. Fix the horizontal scrollbar (style.css).
2. Fix the one defect already visible in the code: the drag ghost ignores the card style (app.js).
3. Do the manual browser walkthrough below. Fix anything else that fails, in app.js, index.html or style.css only.
4. Keep `npm test` green.

Do not touch:
- `build-seeds.js` (that is increment 2)
- `seeds.js`
- `spider-core.js`
- `spider-core.test.js`
- anything under `games/sudoku/`
- the root README or package.json

Also keep these as they are:
- the "Interface" Light/Dark option and the localStorage settings (decision 4)
- the existing `@media (max-width: 600px)` block (decision 5)

Do not add features, settings, tests, a headless browser, animations or a hint button.

## Prerequisites

- **Runtime:** Node.js with the built-in `node:test` runner and `node:assert/strict`. Node 18 or later is assumed. The engineer must confirm this with `node --version`.
- **Test command (from package.json):** `npm test`, which runs `node --test games/sudoku/ games/spider/`. Run it from the repo root: `C:\Users\alexa\Claude Projects\tarotic-games-collection`.
  - How directory arguments to `node --test` are handled varies between Node versions. Confirm the output actually lists the spider tests named below, not just a pass count. If they are not listed, report it; do not change package.json.
- **Browsers:** current Google Chrome and current Microsoft Edge on Windows (decision 2).
- **Two ways to open the page** (decision 7), both must work:
  - From a file path: double-click `games/spider/index.html`, or open it as a `file:///` URL.
  - From a local server: any static server rooted at the repo, for example `npx http-server` or `python -m http.server`, then open `/games/spider/index.html`. No server is added to the repo.
- **Fixing the window width:** DevTools device toolbar (Ctrl+Shift+M) set to "Responsive" with width 1280, 1366 and 1920, zoom 100%. Also check with browser zoom at 125% and 150% to reproduce the original fault (see below).

## Scrollbar: cause (from the files)

The board has a hard minimum width:
- `style.css` sets `--card-w: 84px`, and `.board` uses `grid-template-columns: repeat(10, var(--card-w))` with `gap: 8px`. That gives 10 x 84 + 9 x 8 = **912px**.
- `.board { min-width: max-content; }` stops the board from ever shrinking below 912px.
- `.app` adds `padding: 20px 12px`, which is 24px across. So the page needs at least **936 CSS px** of viewport, plus about 17px more when the page has a classic Windows vertical scrollbar.
- `.table { overflow-x: auto; }` turns any shortfall into a horizontal scrollbar on the board area. If an element is wider than the viewport, the page scrollbar appears as well.

At 100% zoom, 1280, 1366 and 1920 are all wider than 936, so by the arithmetic they should not overflow. The likely trigger is **Windows display scaling or browser zoom**. For example, a 1366 px laptop screen at 150% scaling is about 911 CSS px, and a 1280 px window at 150% zoom is about 853 CSS px. In both cases the 912px board cannot fit.

Engineer step 1 is to reproduce the fault before changing anything. Record which width and zoom shows the scrollbar, using the console checks in the checklist. If the overflow is caused by an element other than the board, find it with this console snippet and fix that element in style.css:

```js
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth)
```

## Files to create or change

### 1. `games/spider/style.css` (scrollbar fix)

a. In the `:root` block, replace these two lines:
```css
  --card-w: 84px;
  --card-h: 118px;
```
with:
```css
  /* Card width shrinks only when the viewport cannot fit 10 columns at 84px.
     1000px = .app max-width; 96px = 24px .app padding + 9 x 8px gaps;
     20px = allowance for a classic vertical scrollbar (vw includes it). */
  --card-w: min(84px, calc((min(100vw - 20px, 1000px) - 96px) / 10));
  --card-h: calc(var(--card-w) * 118 / 84);
```
Why it goes on `:root` and not on `.board`:
- The stock button (`.stock`, in `.bottom`) and the drag ghost (`.ghost`, in `#drag-layer`) are outside `#board`.
- Both use `--card-w` and `--card-h`. They only stay the same size as the board cards if the variable is defined on `:root`.
- Do not define `--card-w` in terms of itself on one element. That is a custom-property cycle, and the browser treats the value as invalid.

b. In `.board`, delete this line:
```css
  min-width: max-content;
```
Leave everything else in `.board` unchanged.

c. Leave these unchanged:
- `.table { overflow-x: auto; padding-bottom: 8px; }`. It is only a fallback below 600px, where the media query fixes the cards at 62px.
- the `@media (max-width: 600px)` block
- `--off-down` and `--off-up`. `app.js` reads `--off-up` for the ghost spacing.

Expected result:
- At 1280, 1366 and 1920 at 100% zoom, `min(100vw - 20px, 1000px)` is 1000, so `--card-w` = min(84, 90.4) = **84px**. Nothing changes visually.
- On narrower viewports, for example 1366 at 150% (about 911 CSS px), cards shrink to about 79px. The board is then about 862px, which fits within 911 - 20 - 24.
- Fixed pixel font sizes inside cards stay as they are. Changing them is out of scope.

### 2. `games/spider/app.js` (drag ghost card style)

Defect, found by reading the code:
- The ghost is appended to `#drag-layer`, which is outside `#board`.
- The `.face-large ...` and `.face-minimal ...` rules in style.css need an ancestor with the `face-*` class.
- So with "Large numbers" or "Minimal" selected, a dragged run is drawn in classic style.

In the `boardEl.addEventListener("pointerdown", ...)` handler, change:
```js
    ghost.className = "ghost";
```
to:
```js
    ghost.className = `ghost face-${settings.face}`;
```
No other change to app.js is planned. Any further change must answer a checklist row that failed.

### 3. `games/spider/index.html`

No planned change. Edit only if a checklist row fails because of the markup.

## Function signatures

No new functions, and no signature changes. These existing functions must keep their current signatures and behavior, and the checklist exercises them:

- `loadSettings(): {back: string, face: string, ui: string, bg: string}`
- `saveSettings(): void`
- `applySettings(): void`
- `updateSetting(key: "back"|"face"|"ui"|"bg", value: string): void`
- `newGame(): void`. Picks from `window.SpiderSeedBank[suitCount]` only.
- `doMove(move: {type:"move", from:number, count:number, to:number} | {type:"deal"}): boolean`
- `undo(): void`
- `dealRow(): void`
- `render(): void`
- `columnAt(x: number, y: number): number | null`
- `endDrag(): object | null`
- `finishPointer(e: PointerEvent, cancelled: boolean): void`

If the engineer has to add a helper while fixing a walkthrough defect, it goes inside the same IIFE in app.js and must be listed in the hand-off.

## Test list

Tests live next to the code: `games/spider/spider-core.test.js`. Sudoku tests are in `games/sudoku/`. Plan no new tests and no test edits.

| Criterion | Test(s) | File |
|---|---|---|
| [AUTO] `npm test` passes, including the replay of every stored winning line in seeds.js | 1. `deck has 104 cards split evenly across suit counts`<br>2. `new game deals 54 cards to the tableau and 50 to stock`<br>3. `same seed gives the same deal`<br>4. `runLength counts only same-suit descending face-up cards`<br>5. `moving a run requires the destination top to be one higher`<br>6. `applyMove flips the revealed card and does not mutate input`<br>7. `completing K..A of one suit removes it and counts a set`<br>8. `deal is blocked while any column is empty`<br>9. `deal adds one face-up card to each column`<br>10. `every 1-suit seed-bank deal is winnable by its stored line`<br>11. `every 2-suit seed-bank deal is winnable by its stored line`<br>12. `every 4-suit seed-bank deal is winnable by its stored line` | `games/spider/spider-core.test.js` |
| [AUTO] (same run) the Sudoku tests stay green | all existing tests | `games/sudoku/` |

- Run `npm test` before and after the changes. The 4-suit replay test can be slow; that is expected.
- All 12 spider tests must appear by name in the output and pass.

## Manual checklist (MANUAL criteria)

Run every row in Chrome and in Edge, both from `file://` and from a local server: 4 runs in total. Record pass or fail per run in the hand-off.

**Layout**

| # | Criterion | How to check |
|---|---|---|
| L1 | No horizontal scrollbar at 1280, 1366 and 1920 with a fresh 4-suit game | For each width at 100% zoom, run both checks in the console. Both must be `true`: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and `document.querySelector('.table').scrollWidth <= document.querySelector('.table').clientWidth`. Repeat at 125% and 150% zoom to confirm the original fault is gone. |
| L2 | All 10 columns and the stock button fully visible without scrolling sideways | At the same widths, look at the page: the left edge of column 1, the right edge of column 10 and the stock are all on screen. |

**Suits**

| # | Criterion | How to check |
|---|---|---|
| S1 | "1 suit", "2 suits" and "4 suits" each start a new game with only 1, 2 or 4 distinct suits | Pick each option, then deal through the stock or inspect the face-up cards. Count the distinct suit symbols. |

**Moves and undo**

| # | Criterion | How to check |
|---|---|---|
| M1 | Dragging a legal run moves it; dropping on an illegal target returns it | Drag a run onto a legal column, then onto an illegal one. |
| M2 | A multi-card run moves all its cards together | Drag a run of 2 or more cards. |
| M3 | Undo restores the previous board and lowers Moves by 1; Undo is disabled when there is nothing to undo | Make a move, Undo. Deal from the stock, Undo. Undo is disabled on a new game and after undoing everything. |
| M4 | Clicking the stock deals one card to each column and "deals left" drops by 1 | Click the stock. Starts at "5 deals left". |
| M5 | A completed K-to-A same-suit run is removed and Sets goes up | Easiest in a 1-suit game. Optional shortcut: replay the stored line in the console using `SpiderSeedBank` together with the in-page moves. |

**Settings**

| # | Criterion | How to check |
|---|---|---|
| T1 | Each of the 4 card backs changes face-down cards and the stock immediately | Change "Card back" in the open dialog. |
| T2 | Each of the 3 card styles changes face-up cards immediately | Change "Card style". Also drag a run while in Large and in Minimal: the ghost must match (the app.js fix). |
| T3 | The color input and each of the 5 swatches change the page background immediately | Use the color input, then each swatch. |
| T4 | Settings persist after reload | Change all settings, reload, and check they are kept. In the `file://` runs, note whether localStorage persists. If it does not, report it as a defect; do not add a workaround beyond what the requirements ask for. |

**Winnable deals**

| # | Criterion | How to check |
|---|---|---|
| W1 | Every "New game" comes from seeds.js | The code path in `newGame()` only reads `Bank[suitCount]`. Check that no console errors appear, that `window.SpiderSeedBank` is defined in each of the 4 runs, and that the status line never shows "No winnable ... deals are available." |

## Edge cases the tester will probe

1. **Zoom or scaling:** at 125% and 150% browser zoom with widths 1280 and 1366, neither the page nor `.table` scrolls horizontally, and cards shrink evenly (board, stock and drag ghost all the same width).
2. **Classic scrollbar:** with a tall column (deal several rows) the page gets a vertical scrollbar. This must not cause a horizontal one. The 20px allowance in `--card-w` covers this.
3. **Resizing:** resize the window between 1920 and about 940px while a game is in progress. The layout reflows with no horizontal scroll. Drag still drops on the right column, because `columnAt` uses `elementFromPoint`.
4. **Drag ghost size:** when cards are shrunk (zoomed), the dragged ghost has the same width as the board cards.
5. **Drag ghost style:** with "Large numbers" or "Minimal", the dragged ghost uses that style.
6. **Drop targets:** dropping in the 8px gap between columns, outside the board, or back on the source column returns the run with no move counted. A pointercancel (for example Alt+Tab mid-drag) also returns it.
7. **Partial run:** pressing on a face-up card above a broken run, such as a mixed-suit sequence, does not start a drag.
8. **Undo after special moves:** after a stock deal, Undo restores all 10 cards to the stock and "deals left" goes back up. After a set completes, Undo restores the 13 cards and Sets goes down.
9. **Stock with an empty column:** clicking the stock while a column is empty shows the "Every column needs at least one card" message and does not change the move count.
10. **Final stock deal:** after the last deal the stock shows "0 deals left" and is disabled.
11. **Suit change mid-game:** changing Suits mid-game starts a fresh game: Moves 0, Undo disabled, history cleared.
12. **4-suit repeats:** with only 4 stored deals (seeds 8, 10, 13, 15), repeated "New game" never deals the same seed twice in a row. Repeats after that are accepted for this increment (decision 3).
13. **Ctrl+Z:** undoes while the dialog is closed, and does nothing while the Settings dialog is open.
14. **Corrupt settings:** set `localStorage['spider-solitaire-settings']` to `"not json"` and reload. The page loads with the default settings.
15. **Light swatch:** after picking the Sand swatch, the board and stock are still visible. Report readability but do not change colors; no new requirement.

## Engineer model

**sonnet.** The code change itself is small (two CSS edits and one line in app.js). But the increment centers on a manual walkthrough in 2 browsers x 2 ways of opening the page. That needs judgment to reproduce the zoom-dependent scrollbar, to diagnose any overflowing element other than the board, and to fix defects that only show up in a real browser across app.js, index.html and style.css. That is more than haiku should be trusted with.
