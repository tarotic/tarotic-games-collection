# Spider Solitaire roadmap

Source of requirements: the brief, docs/decisions.md, and the user's chat idea "animate each dealt card from the stock to its place and flip". No CLAUDE.md, docs/idea.md or templates exist in the repo.

## Done (verified from files)
- spider-core.js: rules and solver.
- spider-core.test.js: rule tests and a replay test of every stored winning line. `npm test` runs it.
- seeds.js: winnable-deal bank. 1-suit and 2-suit present; 4-suit has 5 deals (seeds 8, 10, 13, 15, 46), inside the 4 to 10 range from decisions.md.
- app.js / index.html / style.css: UI with drag, double-click, undo, stock deal, settings dialog (card back, card style, interface theme, background color).
- Increment 1 (working in a real browser): built and verified. History in docs/requirements-increment-1.md.

## Increments (in order)
1. DONE: Make the UI work in a real browser.
2. Animated stock deal: cards fly from the stock to each column, left to right with a stagger, and flip face-up in flight. Deal only; undo not animated. (NEXT, see requirements.md)
3. Grow the 4-suit deal bank toward 10 (needs a resumable build-seeds.js; long solver run). Only if the human still wants more than 5.
4. Settings polish: only what the human decides after earlier increments.
5. Win/lose experience: only if the human asks for more than the current status line.

Possible later animation increments, only if the human asks: animate undo of a deal, animate drop/snap-back of moves, animate completed-set removal, new-game deal-out.
