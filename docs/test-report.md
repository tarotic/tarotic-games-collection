PASS

# Test report: Spider Solitaire increment 2 (animated stock deal), re-verification after the bug 1 fix

## Test run

`npm test` from the project root, real output (tail):

```
✔ deal2 app: Settings change mid-deal restyles the deal layer, flights untouched
✔ deal2 app: New game mid-deal with an empty seed bank must not leave hidden cards or a disabled stock (1.4772ms)
...
ℹ tests 77
ℹ suites 0
ℹ pass 77
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The test "deal2 app: New game mid-deal with an empty seed bank must not leave hidden cards or a disabled stock" is listed and passes. All adversarial tests ("adv: ...", "deal2 ...") in tests/adversarial pass in the same run, so the earlier probes that a fix could touch (New game mid-deal cancels flights, Suits change mid-deal, stale callbacks, undo/stock guards) still pass.

## Fix check by reading code

games/spider/app.js `newGame()` (lines 73-93): it calls `cancelDealAnimation()` first. In the empty-bank branch it now runs `setStatus(...)`, then `render()`, then `return`. So the board is re-rendered, with no hidden cards and no disabled stock left from the cancelled deal.

## Bugs

1. FIXED. Breaks: increment 2 rule that New game mid-deal restores a consistent board (no hidden cards, stock enabled). Previously `newGame()` with an empty seed bank cancelled the deal and returned without `render()`. Evidence of the fix: the app.js code above, and the regression test now passing (77 of 77).

No other bugs reproduced.

## Not re-run

I did not write new bug hunts beyond the probes above, as instructed. The earlier "increment 1 browser" results in the previous report were about the committed baseline, not this increment, and are not repeated here.

## Browser-only checks (MANUAL, NOT RUN)

| # | Check | Status |
|---|---|---|
| D1 | Click the stock: 10 cards fly from the stock to columns left to right with a stagger, about 0.84 s total. | NOT RUN |
| D2 | During the flight, a second stock click, Undo, Ctrl+Z, drag and double-click are ignored. | NOT RUN |
| D3 | New game or Suits change mid-deal: flights vanish, board is clean, stock enabled. | NOT RUN |
| D4 | With OS "reduce motion" on, the deal is instant and Undo is enabled at once. | NOT RUN |
| D5 | Changing Settings (back, face, bg) mid-deal restyles flying cards without breaking the flight. | NOT RUN |
| D6 | Real Chrome and Edge, file:// and server: no console errors, no flicker at the end of a flight. | NOT RUN |
| D7 | Empty-seed-bank path in a real browser (needs a test hook to empty a bank). | NOT RUN |
