# Plan: Spider Solitaire, increment 2 (animated stock deal)

Sources:
- docs/requirements.md (increment 2)
- docs/decisions.md
- docs/roadmap.md
- the current code in games/spider: app.js, style.css, index.html, spider-core.js and both test files

There is no CLAUDE.md, web-rules.md or templates/plan-template.md, so this plan uses the default sections. It keeps the existing structure: plain script tags, globals on `window`, app.js as the DOM wiring, and tests next to the code.

The increment 1 plan has moved to docs/plan-increment-1.md.

No BLOCKERS. The user approved the defaults for every open question.

## Decisions recorded (approved by the user)

| # | Question | Decision |
|---|---|---|
| 1 | Reduce motion | When `prefers-reduced-motion: reduce` is set, skip the animation and deal instantly, as in increment 1. |
| 2 | Input during the animation | Drag, stock click, double-click and Undo (button and Ctrl+Z) are ignored, with no state change. The stock and Undo buttons look disabled. |
| 3 | Timing | 300 ms per card and a 60 ms stagger, so (10 - 1) x 60 + 300 = **840 ms** for a full deal. Each value is a single constant. |
| 4 | Browser test | None. The animation checks stay manual. The animation is visual only: game state changes at the click, exactly as today. |
| 5 | Other animations | No animation on New game, the first deal, or Undo. |

## Approach

**Option A from the requirements: a per-card overlay.** For each card, a temporary "flying card" element goes in a fixed overlay layer and is animated with the Web Animations API (`Element.animate`) from the stock rect to the target rect. It is removed when it lands. The real new card is hidden until its flying card lands.

Why option A:
- `render()` rebuilds the whole board on every change, so option B (animating the real card elements) would fight the re-render.
- The flip needs two faces, which the real card markup does not have.
- Option A leaves `render()` and the game state flow as they are. State changes at the click, then the animation plays over the finished board.

**Deviation from the requirement text, and why.** The requirements say the work goes "in app.js / style.css (and index.html only if needed)". This plan also adds one small script file, `games/spider/deal-anim.js`, and its test file.
- Why: the caller asked for the timing and blocking logic to be testable without the DOM.
- app.js is an IIFE that touches the DOM when it loads, so Node cannot `require` it.
- The new file needs no build step (requirement 3 allows that). It loads with a plain script tag, which makes the index.html edit "needed".
- The requirements also say tests "other than adding a deal test" are out of scope. The extra helper tests come from the caller's testability instruction. They only add tests; no existing test is edited.

## Prerequisites

- **Runtime:** Node.js 18 or later, with the built-in `node:test` and `node:assert/strict`. The engineer confirms this with `node --version`.
- **Test command (from package.json):** `npm test`, which runs `node --test games/sudoku/ games/spider/`.
  - Run it from the repo root: `C:\Users\alexa\Claude Projects\tarotic-games-collection`.
  - It runs every `*.test.js` file in those folders: `games/spider/spider-core.test.js`, `games/spider/adversarial.test.js`, the new `games/spider/deal-anim.test.js`, and the Sudoku tests.
  - Confirm that the output lists the new tests by name, not just a pass count.
  - `deal-anim.js` must **not** match a test-file pattern. Do not name it `*.test.js`, `*-test.js`, `*_test.js` or `test-*.js`.
  - `tests/adversarial/` is not part of `npm test`. Do not change package.json.
- **Browsers:** current Chrome and current Edge on Windows (decision 2).
- **Opening the page:** both from a file path (`file:///.../games/spider/index.html`) and from a local static server rooted at the repo (decision 7). The new script tag uses a relative path, so both work.
- **DevTools tools:**
  - Animations panel: More tools > Animations.
  - Rendering panel: "Emulate CSS media feature prefers-reduced-motion".
  - Device toolbar (Ctrl+Shift+M), for the widths 1280, 1366 and 1920.
- **Windows setting:** Settings > Accessibility > Visual effects > Animation effects. Turning it Off makes `prefers-reduced-motion: reduce` true.

## Do not touch

- `games/spider/spider-core.js`
- `games/spider/seeds.js`
- `games/spider/build-seeds.js`
- `games/spider/adversarial.test.js`
- anything under `games/sudoku/`
- `tests/adversarial/`
- package.json and README.md

The only allowed edit to existing tests is adding one test to `games/spider/spider-core.test.js`. Existing tests are not edited.

## Hard constraints from `games/spider/adversarial.test.js`

These tests run under `npm test` and read app.js and style.css as text. Breaking any of them fails the increment.

1. app.js must contain **exactly one** match of `ghost.className =`, and it stays exactly ``ghost.className = `ghost face-${settings.face}`;``. Do not name any flying-card variable `ghost`; use `fly`, `flyEl` or similar.
2. style.css must not contain the text `max-content` anywhere.
3. style.css must keep **exactly two** `--card-w:` definitions: `:root` and the 600px media block. Do not define `--card-w` or `--card-h` on the deal layer or the flying cards; they inherit from `:root`.
4. Leave these style.css lines byte-identical:
   - the `:root` block
   - `.table { overflow-x: auto; padding-bottom: 8px; }`
   - `.board`
   - the `@media (max-width: 600px)` block
5. Keep `localStorage`, `spider-solitaire-settings` and `body.ui-dark` (the existing code already does).

## Files to create or change

### 1. NEW `games/spider/deal-anim.js` (pure helpers, no DOM)

- Same UMD wrapper as spider-core.js: `module.exports` under Node, otherwise `root.SpiderDealAnim`, where root is `self` or `globalThis`.
- Must not read `window`, `document` or `matchMedia`, at load time or anywhere else.
- Holds the two timing constants. They are the only place the timing lives; app.js must not hard-code 300, 60 or 840.

```js
const DEAL_CARD_MS = 300;   // one card's flight
const DEAL_STAGGER_MS = 60; // delay between one card's start and the next
```

Exports: `{ DEAL_CARD_MS, DEAL_STAGGER_MS, dealPlan, dealDuration, createDealGuard }`. Signatures are in the next section.

### 2. NEW `games/spider/deal-anim.test.js`

Tests are listed under "Test list".

### 3. `games/spider/spider-core.test.js`

Add one test, placed after `deal adds one face-up card to each column`. It is listed under "Test list". Do not change any other test.

### 4. `games/spider/index.html`

a. After `<div id="drag-layer" class="drag-layer"></div>`, add:
```html
  <div id="deal-layer" class="deal-layer" aria-hidden="true"></div>
```
b. Change the script order to:
```html
  <script src="spider-core.js"></script>
  <script src="seeds.js"></script>
  <script src="deal-anim.js"></script>
  <script src="app.js"></script>
```
Nothing else changes.

### 5. `games/spider/style.css`

Add this block after the `/* ---------- Dragging ---------- */` rules and before the Settings dialog section. Do not change existing rules.

```css
/* ---------- Stock deal animation ---------- */
.deal-layer { position: fixed; inset: 0; pointer-events: none; z-index: 60; overflow: hidden; }
.deal-fly {
  position: absolute;
  width: var(--card-w);
  height: var(--card-h);
  transform-style: preserve-3d;
  will-change: transform;
}
.deal-fly .card { position: absolute; inset: 0; margin: 0; backface-visibility: hidden; }
.deal-fly .deal-front { transform: rotateY(180deg); }
.card.deal-pending { visibility: hidden; }
```

How these rules meet the requirements:
- **No horizontal scrollbar:**
  - A fixed layer does not add to the document's scroll width.
  - `.deal-fly` is `position: absolute` inside the fixed layer, so the layer is its containing block. The layer's `overflow: hidden` therefore clips anything past the viewport edge.
  - The layer has `inset: 0`, so viewport coordinates from `getBoundingClientRect()` can be used directly as `left` and `top`.
- **Not hidden behind other cards:** `z-index: 60` puts the layer above the board and the drag layer. The settings dialog is in the top layer, so it stays above the layer.
- **Settings in flight:** the face-style and card-back rules (`.face-large .card ...`, `.back-red .card.down`, and so on) already match descendants. They apply to flying cards because app.js puts `face-*` and `back-*` classes on `#deal-layer`.

### 6. `games/spider/app.js`

All changes stay inside the existing IIFE.

a. **New constants** next to the other `const` lines at the top:
```js
const DealAnim = window.SpiderDealAnim;
const dealLayer = document.getElementById("deal-layer");
const dealGuard = DealAnim.createDealGuard();
let dealFlights = []; // Animation objects of the running deal
```

b. **`applySettings()`:** add one line so in-flight cards follow the Settings dialog:
```js
dealLayer.className = `deal-layer face-${settings.face} back-${settings.back}`;
```

c. **`dealRow()`:** becomes the following. The state update stays `doMove({type:"deal"})`, exactly as today. The plan is built from the before and after states.
```js
function dealRow() {
  if (dealGuard.isBusy()) return;
  if (!Spider.canDeal(current)) { /* unchanged status messages */ return; }
  const before = current;
  if (!doMove({ type: "deal" })) return;
  const steps = DealAnim.dealPlan(before, current, { reduceMotion: !canAnimateDeal() });
  if (steps) animateDeal(steps);
}
```

d. **`undo()`:** first line `if (dealGuard.isBusy()) return;`. This covers both the Undo button and Ctrl+Z. The keydown handler stays as it is.

e. **`pointerdown` handler on `boardEl`:** first line `if (dealGuard.isBusy()) return;`, before the `e.button` check.

f. **`dblclick` handler on `boardEl`:** first line `if (dealGuard.isBusy()) return;`.

g. **`newGame()`:** first line `cancelDealAnimation();`. It must come before the empty-bank early return, so a Suits change or New game during a deal always clears the layer. Suits change already calls `newGame`.

h. **`render()`:** change the two disabled lines to:
```js
stockEl.disabled = current.stock.length === 0 || dealGuard.isBusy();
undoEl.disabled = history.length === 0 || dealGuard.isBusy();
```

i. **New helpers.** Signatures and behaviour are below. They go in a new `// ---------- Deal animation ----------` section between Rendering and Drag and drop.

**Web Animations API traps.** The engineer must follow both:
- **Use `animation.onfinish`, never `animation.finished.then(...)`.**
  - `cancel()` rejects the `finished` promise with an AbortError.
  - An unhandled rejection is a console error on "New game mid-deal", and that fails the regression row.
  - `cancel()` fires `oncancel`, not `onfinish`, so the token check in `onfinish` is enough.
- **Use `fill: "both"`** together with the per-card `delay`.
  - The backwards half covers the stagger wait. Without it, a card waiting for its delay sits visibly at its target position.
  - The forwards half holds the face-up end keyframe until `onfinish` removes the flying card. Without it, the card snaps back to no transform, showing its back for a frame at the landing spot, which looks half-flipped.

**Flip fallback.** If `preserve-3d` or `backface-visibility` misbehave in Chrome or Edge, the engineer may replace the 3D flip with a 2D swap. Use `scaleX` 1 to 0 to 1 on `.deal-fly`, and switch the front face's opacity from 0 to 1 at offset 0.5 using a step keyframe. Keep `fill: "both"`. The turn must still happen during the flight. Record the switch in the hand-off.

## Function signatures

### `games/spider/deal-anim.js` (exported as `window.SpiderDealAnim` and `module.exports`)

```js
/**
 * @typedef {{ suit: "S"|"H"|"D"|"C", rank: number, faceUp: boolean }} Card
 * @typedef {{ suitCount: number, columns: Card[][], stock: Card[], completed: number }} State
 * @typedef {{
 *   col: number,        // 0..9, the column this card is dealt to
 *   card: Card,         // copy of the dealt card with faceUp: true
 *   delay: number,      // ms from the click until this card starts: col * staggerMs
 *   duration: number,   // ms of this card's flight: cardMs
 *   landIndex: number   // index of the card in next.columns[col], or -1 if the deal
 *                       // completed a K..A set in that column and the card was removed
 * }} DealStep
 */

/** @type {number} */ DEAL_CARD_MS      // 300
/** @type {number} */ DEAL_STAGGER_MS   // 60

/**
 * Builds the per-column flight plan for a stock deal from `prev` to `next`.
 * Pure: it does not mutate prev or next, and the returned cards are copies.
 * Returns null, meaning "deal instantly, no animation", when:
 *   - options.reduceMotion is true, or
 *   - prev or next is null or undefined, or
 *   - prev.stock.length - next.stock.length !== prev.columns.length (not a deal).
 * Otherwise returns prev.columns.length steps in column order 0..n-1, where for column c:
 *   card      = { ...prev.stock[prev.stock.length - 1 - c], faceUp: true }
 *   delay     = c * staggerMs
 *   duration  = cardMs
 *   landIndex = next.columns[c].length === prev.columns[c].length + 1
 *                 ? prev.columns[c].length
 *                 : -1
 * @param {State|null} prev
 * @param {State|null} next
 * @param {{ reduceMotion?: boolean, cardMs?: number, staggerMs?: number }} [options]
 *        cardMs defaults to DEAL_CARD_MS, staggerMs to DEAL_STAGGER_MS, reduceMotion to false
 * @returns {DealStep[] | null}
 */
function dealPlan(prev, next, options)

/**
 * Total length of a deal: the largest (delay + duration) over the steps,
 * or 0 for null or an empty array.
 * @param {DealStep[] | null} steps
 * @returns {number}
 */
function dealDuration(steps)

/**
 * Input gate for the deal animation. Uses a generation counter, so a callback
 * from a cancelled or old deal cannot clear the busy flag of a newer one.
 * @returns {{
 *   begin(): number,                 // starts a deal: new token (previous + 1), busy = true
 *   isCurrent(token: number): boolean, // true only if busy and token is the latest from begin()
 *   end(token: number): boolean,     // if isCurrent(token): busy = false, return true; else false, no change
 *   cancel(): void,                  // busy = false and every token issued so far stops being current
 *   isBusy(): boolean
 * }}
 */
function createDealGuard()
```

### `games/spider/app.js` (new, private to the IIFE)

```js
/** True when the stock deal should animate: Element.prototype.animate exists
 *  and window.matchMedia("(prefers-reduced-motion: reduce)").matches is false.
 *  Checked on every click, so changing the OS setting needs no reload. */
function canAnimateDeal(): boolean

/** Runs the flights for one deal over the already rendered board.
 *  1. token = dealGuard.begin(); set stockEl.disabled = undoEl.disabled = true.
 *  2. stockRect = stockEl.getBoundingClientRect(), measured after render(),
 *     so the stock's position after the board has grown.
 *  3. For each step: target = dealTargetRect(step); real = the real card element
 *     (column step.col, child step.landIndex) or null when landIndex is -1;
 *     real?.classList.add("deal-pending"); fly = flyingCardEl(step.card);
 *     set fly.style.left/top to target.left/top in px; append it to dealLayer;
 *     anim = fly.animate(
 *       [{ transform: `translate(${dx}px, ${dy}px) perspective(900px) rotateY(0deg)` },
 *        { transform: "translate(0px, 0px) perspective(900px) rotateY(180deg)" }],
 *       { duration: step.duration, delay: step.delay, easing: "ease-in-out", fill: "both" });
 *     where dx = stockRect.left - target.left and dy = stockRect.top - target.top.
 *     Push anim onto dealFlights.
 *  4. anim.onfinish: if !dealGuard.isCurrent(token), return. Otherwise fly.remove();
 *     real?.classList.remove("deal-pending"); when it is the last of the steps,
 *     call finishDeal(token). */
function animateDeal(steps: DealStep[]): void

/** Viewport rect where a step's flying card lands.
 *  - landIndex >= 0: getBoundingClientRect() of the real card element.
 *  - landIndex === -1 and the column still has cards: the top card's rect,
 *    with top moved down by --off-up. Read --off-up the same way the drag code does:
 *    parseFloat(getComputedStyle(boardEl).getPropertyValue("--off-up")) || 28.
 *  - landIndex === -1 and the column is now empty: the column element's rect.
 *  Returns {left, top} in viewport px. */
function dealTargetRect(step: DealStep): { left: number, top: number }

/** Builds <div class="deal-fly"> with two children:
 *    <div class="card down deal-back"></div>
 *    and the face-up card from cardEl(card, -1, -1) with the class "deal-front" added.
 *  It needs no inline size; the CSS gives it the card size. */
function flyingCardEl(card: Card): HTMLElement

/** Ends a deal if `token` is still current: dealGuard.end(token), dealFlights = [],
 *  dealLayer.textContent = "", then render() once. That final render() restores
 *  the stock and Undo disabled states from game state and drops any leftover
 *  deal-pending class. It also fixes positions if the window was resized or
 *  scrolled during the flight. Does nothing if the token is stale. */
function finishDeal(token: number): void

/** Stops a running deal at once: dealGuard.cancel(); call .cancel() on every
 *  Animation in dealFlights; dealFlights = []; dealLayer.textContent = "".
 *  Safe to call when no deal is running. Does not call render() (newGame does). */
function cancelDealAnimation(): void
```

Existing functions keep their signatures. Their behaviour changes only as described in section 6:
- `newGame(): void`
- `doMove(move): boolean` (unchanged)
- `undo(): void`
- `dealRow(): void`
- `render(): void`
- `applySettings(): void`
- `cardEl(card, col, idx): HTMLElement` (unchanged; it is reused for the flying front)

## Test list

**Where the tests go:**
- Tests live next to the code in `games/spider/`.
- New file: `games/spider/deal-anim.test.js`. It uses `require("./deal-anim.js")`, `require("./spider-core.js")`, `node:test` and `node:assert/strict`.
- New core test: in `games/spider/spider-core.test.js`.

### Mapping of every [AUTO] criterion

| [AUTO] criterion | Test name | File |
|---|---|---|
| After a deal, each of the 10 columns has exactly 1 more card, the new card is face-up, the stock has 10 fewer cards, and the card added to column i is the one at the matching stock position | **NEW** `deal moves the top 10 stock cards to columns 0 to 9 in order, face-up` | `games/spider/spider-core.test.js` |
| (same, already covered in part) | existing `deal adds one face-up card to each column` | `games/spider/spider-core.test.js` |
| (same, already covered in part) | existing `adv: stock deal blocked on empty column, blocked on empty stock, unchanged input` | `games/spider/adversarial.test.js` |
| `npm test` passes unchanged (read as: no existing test edited, and all pass) | every existing test in `games/spider/spider-core.test.js` (12 tests, names as in docs/plan-increment-1.md) | `games/spider/spider-core.test.js` |
| (same) | every existing test in `games/spider/adversarial.test.js`, in particular `static: ghost className includes the face style and is the only ghost.className`, `static: --card-w is defined on :root only, with no self-reference cycle`, `static: .board has no min-width and keeps its other declarations`, and `static: .table overflow fallback and 600px media block unchanged` | `games/spider/adversarial.test.js` |
| (same) | all existing Sudoku tests | `games/sudoku/` |

### What the new core test asserts

`deal moves the top 10 stock cards to columns 0 to 9 in order, face-up`:
- Loop over `[[1, 5], [2, 5], [4, 5]]` as `(suitCount, seed)`, with `g = Spider.newGame(suitCount, seed)` and `next = Spider.dealRow(g)`. A fresh game cannot complete a set.
- For each `i` in 0..9:
  - `next.columns[i].length === g.columns[i].length + 1`
  - the last card of `next.columns[i]` has the same `suit` and `rank` as `g.stock[g.stock.length - 1 - i]`, and `faceUp === true`
  - `next.columns[i].slice(0, -1)` deep-equals `g.columns[i]`
- `next.stock` deep-equals `g.stock.slice(0, -10)` and has length `g.stock.length - 10`.
- `g` is unchanged: compare JSON before and after.

### Tests in `games/spider/deal-anim.test.js`

These support the requirements (animation is visual only, and the timing constants). They are not mapped to an [AUTO] row.

| Test name | Asserts |
|---|---|
| `deal-anim: timing constants are 300 ms per card and 60 ms stagger` | `DEAL_CARD_MS === 300` and `DEAL_STAGGER_MS === 60`. |
| `deal-anim: plan has one step per column, left to right, staggered` | With `g = newGame(2, 5)` and `n = dealRow(g)`, `dealPlan(g, n)` has length 10. `steps[i].col === i`, `steps[i].delay === i * 60` and `steps[i].duration === 300`. |
| `deal-anim: whole deal lasts 840 ms, under 1.2 s` | `dealDuration(plan) === 840` and `< 1200`. `dealDuration(null) === 0` and `dealDuration([]) === 0`. With options `{cardMs: 100, staggerMs: 10}`, the result is `190`. |
| `deal-anim: each step's card is the card that landed in its column, face-up` | For every step, `landIndex === g.columns[col].length`, and `step.card` deep-equals `n.columns[col][step.landIndex]`, with `faceUp === true`. |
| `deal-anim: reduce motion gives no plan` | `dealPlan(g, n, {reduceMotion: true}) === null`. |
| `deal-anim: no plan when the change is not a deal` | Returns `null` for `(g, null)`, for `(null, n)`, and for `(g, applyMove(g, someLegalNonDealMove))`. Pick the first `type: "move"` from `legalMoves(g)` on seed 5, 2 suits. If there is none, build an `emptyState` move. |
| `deal-anim: plan does not change either state` | `JSON.stringify` of `g` and `n` is unchanged after `dealPlan`. Mutating `steps[0].card` does not change `n` or `g`. |
| `deal-anim: a deal that completes a set marks that column with landIndex -1` | Build a 1-suit state by hand: column 0 holds S 13 down to S 2, all face-up; columns 1 to 9 each hold `[S 5 face-up]`. The stock holds 10 cards, with `stock[9]` = S 1 face-down and the others S 9 face-down. Then `n = dealRow(s)` has `n.completed === 1` and `n.columns[0].length === 0`. In the plan, step 0 has `landIndex === -1` and its card is S 1 face-up; steps 1 to 9 have `landIndex === 1`. |
| `deal-anim: guard blocks while busy and ignores stale tokens` | A new guard is not busy. `t1 = begin()` makes it busy and `isCurrent(t1)` is true. `end(t1)` returns true and it is no longer busy. `end(t1)` again returns false. `t2 = begin()`, then `cancel()`: not busy, and `isCurrent(t2)` is false. `t3 = begin()`: `end(t2)` returns false and it is still busy. `end(t3)` returns true. |
| `deal-anim: index.html loads deal-anim.js after seeds.js and before app.js` | Read `index.html` as text. The indexes of `src="seeds.js"`, `src="deal-anim.js"` and `src="app.js"` are in increasing order. `id="deal-layer"` is present. |

All new tests and all existing tests must appear by name in the `npm test` output and pass. The 4-suit replay is slow; that is expected.

## Manual checklist (MANUAL criteria)

**Runs:**
- Do every row in Chrome and in Edge, opened from `file://`.
- Also repeat rows A1, S1 and R1 from a local server in both browsers.
- Record pass or fail per row and per run in the hand-off.

**Timing snippet** (paste it in the console; it clicks the stock and logs how long until the last flying card is gone):
```js
const t0 = performance.now(); document.getElementById('stock').click();
const iv = setInterval(() => { if (!document.querySelector('#deal-layer .deal-fly')) { console.log(Math.round(performance.now() - t0), 'ms'); clearInterval(iv); } }, 10);
```

**State after the deal**

| # | Criterion | How to check |
|---|---|---|
| S1 | When the animation has finished, the board looks like the increment 1 instant deal: 10 new face-up cards, "deals left" down by 1, Moves up by 1, Undo enabled | Note Moves and deals left, click the stock, wait about 1 s, then compare. Do the same check with reduce motion emulated and compare the two results. |
| S2 | No card left half-flipped, offset, hidden or duplicated, in 1, 2 and 4 suit games, including a deal that completes a K-to-A set | After each deal, `document.querySelectorAll('.deal-pending, #deal-layer *').length === 0`. Inspect each column visually. At 10% speed, watch each landing: there must be no flash of the card back at the moment a card lands. For the set case, see edge case 6. |

**Animation behaviour**

| # | Criterion | How to check |
|---|---|---|
| A1 | Cards leave the stock position and arrive in columns 0 to 9 in order, one after another | Watch a deal. Slow it down in the Animations panel (10% speed) to see the order. |
| A2 | Back shown at the start, front at the end, and the turn happens during the flight | Use the Animations panel at 10% and scrub. Mid-flight the card is edge-on or turning, not flat-back at landing. |
| A3 | The in-flight back matches "Card back", and the face matches "Card style" | Deal once with each of the 4 backs and each of the 3 styles. Also change the back while a deal is running, at 10% speed: the in-flight cards change too. |
| A4 | At 1280, 1366 and 1920 px no horizontal scrollbar appears at any moment, and flying cards are not clipped by the board or hidden behind other cards | Use the device toolbar at each width and watch the bottom edge for a scrollbar during the deal. At 10% speed, run `document.documentElement.scrollWidth <= document.documentElement.clientWidth` mid-flight; it must be `true`. Cards pass over the columns, not under them. |
| A5 | One card's flight is about 300 ms and the whole deal is under 1.2 s | In the Animations panel, each flight shows 300 ms with a 60 ms offset. The timing snippet logs about 840 to 900 ms, always under 1200. |
| A6 | With Windows "reduce motion" on, the deal is instant with no flying cards | Turn Animation effects Off in Windows Settings (also try DevTools emulation). Click the stock: the board updates at once, `#deal-layer` stays empty, and Undo is enabled immediately. |

**Input during the animation**

| # | Criterion | How to check |
|---|---|---|
| I1 | Clicking the stock again during the animation does not deal a second row; deals left drops by exactly 1 | Click the stock 3 times fast, then press Space or Enter with the stock focused. Deals left drops by 1 and Moves rises by 1. |
| I2 | Undo (button and Ctrl+Z) does nothing during the animation; afterwards Undo removes the whole deal with no animation | During the deal, click Undo and press Ctrl+Z. Nothing changes and the Undo button looks disabled. After the deal, Undo: all 10 cards go back to the stock instantly and deals left goes back up. |
| I3 | Starting a drag during the animation does nothing; afterwards dragging works | Press and drag a face-up run during the deal: no ghost appears. After the deal, a normal drag works. Also double-click a card during the deal: no move. |
| I4 | "New game" or a Suits change during the animation leaves a clean new board with no leftover flying cards | Do each one mid-deal (use 10% speed to make it easy). Afterwards: `#deal-layer` is empty, no `.deal-pending`, Moves 0, Undo disabled, the stock is enabled with "5 deals left", and the console shows no errors (in particular no "Uncaught (in promise) AbortError"). |

**Regression**

| # | Criterion | How to check |
|---|---|---|
| R1 | Drag, double-click, move, undo of a normal move, settings changes and win or status messages behave as in increment 1, with no console errors during or after a deal | Run rows M1 to M5 and T1 to T4 from docs/plan-increment-1.md. Keep the console open with "Preserve log" on through every deal. |

## Edge cases the tester will probe

1. **Final deal:** the 5th deal still animates from the stock, which now shows "0 deals left" and looks disabled. After the deal the stock stays disabled and Undo becomes enabled.
2. **Blocked deal:** clicking the stock while a column is empty shows "Every column needs at least one card...". There is no animation and the guard does not start; drag and Undo still work at once.
3. **Rapid clicks and keyboard:** many fast clicks, double-clicking the stock, and Enter or Space held on the focused stock all produce exactly one deal.
4. **Undo straight after:** pressing Ctrl+Z repeatedly from the moment of the click does nothing until the cards land. The first Ctrl+Z after landing undoes the deal, not an earlier move.
5. **New game or Suits change mid-flight**, at normal speed and at 10% speed: no leftover cards, no hidden real cards, no console errors. Then deal again at once: the new deal animates normally, so the old deal's callbacks did not clear the new busy flag.
6. **A deal that completes a K-to-A set** (1-suit is easiest):
   - The 13 cards disappear at the click (state changes at the click).
   - That column's flying card lands where the next card would sit: just below the new top card, or in the empty slot if the column is now empty. It is then removed, with no real card revealed and no duplicate.
   - Sets goes up by 1.
   - This is hard to reach by play. The tester may use DevTools Local Overrides or a temporary copy of the page. Do not add debug hooks to app.js. The plan side is covered by the `landIndex -1` test.
7. **Win on the last deal:** if a deal completes the last set, the win status appears at the click, while cards are still flying. This is accepted, because state and status change at the click by decision.
8. **"No moves left" status** also appears at the click, before the cards land. Accepted for the same reason.
9. **Settings during the deal:** the Settings dialog can be opened mid-deal (it is not blocked). Changing the back or style updates the in-flight cards through `applySettings`. The dialog sits above the flying cards.
10. **Resize or scroll during the flight:** in-flight cards may land slightly off. When the deal ends, the final `render()` puts the board right with no offset or hidden card. A tall board with a vertical scrollbar must not gain a horizontal one during the flight.
11. **Narrow or zoomed window** (125% and 150% zoom at 1280 and 1366): flying cards are the same size as board cards (they use `--card-w` and `--card-h` from `:root`) and land exactly on their slots.
12. **Reduce motion toggled without reload:** switching DevTools emulation on and off between deals takes effect on the next click.
13. **Stock moves down:** after the board grows, the stock button moves lower. Flights start from where the stock is drawn after the click, not where it was before.
14. **Pointer held from a drag that started before the click:** not reachable. A click on the stock cannot start while the board holds the pointer. Note it if observed.
15. **Undo button focus:** Undo looks disabled during the deal (opacity 0.45) and is enabled again after the deal when history exists.
16. **Landing frame:** at 10% speed, a card shows its front from the end of its flight until it is replaced by the real card, with no flash of the back. This is what `fill: "both"` guarantees.

## Engineer model

**sonnet.** The code is mostly in app.js and one small new module, but the work needs judgment that haiku should not be trusted with:
- the 3D two-face flip and its fallback
- getting `fill: "both"` and `onfinish` right, instead of the promise-based API
- the hide and reveal steps for the real cards
- the target position for a deal that completes a set
- cancel paths with a generation-token guard
- staying clear of the static assertions in adversarial.test.js
- a manual walkthrough in two browsers
