# Spider Solitaire roadmap

Source of requirements: the brief only (1-, 2- and 4-suit play, undo, drag cards across columns, settings for card back / card style / background color, every deal winnable). No CLAUDE.md, docs/idea.md or templates exist in the repo.

## Done (verified from files)
- spider-core.js: rules and solver.
- spider-core.test.js: rule tests and a replay test of every stored winning line. `npm test` runs it.
- seeds.js: winnable-deal bank. 1-suit and 2-suit present; 4-suit has 4 deals (seeds 8, 10, 13, 15) against a target of 15 in build-seeds.js.
- app.js / index.html / style.css: UI with drag, double-click, undo, stock deal, settings dialog (card back, card style, interface theme, background color). Written but not yet tested in a browser.

## Increments (in order)
1. Make the UI work in a real browser: fix the horizontal scrollbar, walk every brief feature in a browser, fix what breaks. (NEXT, see requirements.md)
2. Complete the 4-suit deal bank to the target count (needs a resumable build-seeds.js; long solver run).
3. Settings polish: only what the human decides after increment 1 (for example, whether settings persistence and the extra "Interface" theme stay). Scope depends on open questions.
4. Win/lose experience: only if the human asks for more than the current status line.
