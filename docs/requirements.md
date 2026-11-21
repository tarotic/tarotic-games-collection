# Increment 2: Animated stock deal

## Goal
When the player clicks the stock, each of the 10 dealt cards visibly flies from the stock pile to the top of its column and turns face-up during the flight, instead of appearing instantly.

## Increment scope
Done already (increment 1, see docs/requirements-increment-1.md): rules, UI, drag, undo, stock deal (`dealRow` in games/spider/app.js, which calls `doMove({type:"deal"})` and `render()`), settings, tests. The deal currently re-renders the whole board at once.

Remaining in this increment, in app.js / style.css (and index.html only if needed):
1. Animate the stock deal only. Cards go one per column, columns 0 to 9 (left to right), each starting a short stagger after the previous one.
2. Each card starts at the stock button position, ends at its place in the column, and flips from face-down to face-up while it flies.
3. Use the Web Animations API or CSS only. No libraries, no new files that need a build step.
4. Game state is updated at the moment of the click (as today). The animation is visual only, so the state after the click is identical with or without animation.

Provisional choices, pending the open questions below (the developer should implement these defaults and make them single constants so they are easy to change):
- Duration of one card's flight: 300 ms. Stagger between cards: 60 ms. Whole deal about 840 ms.
- If the user has "reduce motion" set (`prefers-reduced-motion: reduce`), skip the animation and deal instantly as today.
- While the deal animation runs, drag, stock click, double-click and Undo are ignored (no state change), and the stock and Undo buttons look disabled.

## Acceptance criteria
State after the deal (no animation needed to check these)
- [AUTO] After a deal, in the core state each of the 10 columns has exactly 1 more card than before, the new card is face-up, the stock has 10 fewer cards, and the card added to column i is the one that was at the corresponding position in the stock before the deal. (Existing core behavior; confirm it is covered in spider-core.test.js and `npm test` passes.)
- [AUTO] `npm test` passes unchanged.
- [MANUAL] Once the animation has finished, the board looks the same as the instant deal did in increment 1: 10 new face-up cards, "deals left" down by 1, Moves up by 1, Undo enabled.
- [MANUAL] No card is left half-flipped, offset, hidden, or duplicated after the animation, in 1, 2 and 4 suit games, including a deal that completes a K-to-A set.

Animation behavior
- [MANUAL] Clicking the stock shows cards leaving the stock pile position and arriving in columns 0, 1, 2 ... 9 in that order, one after another, not all at once.
- [MANUAL] Each card shows its face-down back at the start of its flight and its face-up front at the end; the turn happens during the flight, not after landing.
- [MANUAL] The card back shown in flight matches the "Card back" setting, and the face shown matches the "Card style" setting.
- [MANUAL] At 1280 px, 1366 px and 1920 px wide windows the flying cards do not cause a horizontal scrollbar at any moment, and they are not clipped by the board or hidden behind other cards.
- [MANUAL] With the provisional timing, one card's flight takes about 300 ms and the whole deal finishes in under 1.2 seconds (measure with a stopwatch or browser dev tools Animations panel).
- [MANUAL] With "reduce motion" turned on in Windows, the deal happens instantly with no flying cards.

Input during the animation (provisional rule)
- [MANUAL] While the animation runs, clicking the stock again does not deal a second row; the deals-left count drops by exactly 1.
- [MANUAL] While the animation runs, pressing Undo (button or Ctrl+Z) does nothing; once it ends, Undo undoes the whole deal and the board returns to the pre-deal state with no animation.
- [MANUAL] While the animation runs, starting a drag does nothing; after it ends, dragging works as before.
- [MANUAL] Starting "New game" or changing Suits during the animation leaves a clean new board with no leftover flying cards.

Regression
- [MANUAL] Drag, double-click, move, undo of a normal move, settings changes and win/status messages behave as in increment 1, and the page shows no console errors during or after a deal.

## Out of scope
- Animating undo of a deal, normal moves, drag drops, completed-set removal, new-game dealing, or win effects.
- Sound, new settings (no animation speed or on/off setting), changes to rules, solver, seeds.js or tests other than adding a deal test if one is missing.
- Touch or phone behavior, other browsers than current Chrome and Edge on Windows (per docs/decisions.md).
- An automated browser test (see question 4).

## Options considered for how the flight is built (first increment uses option A)
- A. Per-card overlay: create temporary card elements in a fixed layer, animate them from the stock rect to the target rect with the Web Animations API, remove them at the end, and hide the real new cards until each lands. Chosen: it works with the existing full re-render.
- B. Animate the real card elements after `render()` with a transform from the stock offset. Simpler but cards in columns are re-created on every render and the flip needs two faces, so it is a later option if A is awkward.
- C. Whole-row single animation (all 10 together, no stagger). Rejected by the brief (one per column with stagger).

## Open questions for the human
1. Reduce motion: should the animation be skipped when your system has "reduce motion" on? (Default used: yes, skip.)
2. Input during the animation: should drag, stock, and Undo be blocked until it ends, or be allowed and make the animation finish instantly? (Default used: blocked.)
3. How long should one card's flight take, and how long between cards? (Default used: 300 ms and 60 ms. A whole deal takes about 0.84 s.)
4. The animation state checks are mostly visual, and no browser test harness exists (decisions.md, increment 1). Do you want an automated browser test added for the deal state, or keep these as manual checks? Without one, only the core deal and `npm test` are [AUTO].
5. Should the animation also run on the first auto-deal at "New game"? (Default used: no, only the stock click.)

## Notes for the roadmap
Roadmap updated: increment 1 marked done, this animation is increment 2, the earlier increments 2 to 4 are renumbered 3 to 5.
