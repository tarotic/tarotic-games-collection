# Increment 1: Working in a real browser

## Goal
The Spider Solitaire page opens in a desktop browser, fits the 10-column board without a horizontal scrollbar, and every feature in the brief works when used by hand.

## Increment scope
Done already (from the files): rules, solver, stored winning lines, UI code, rule/replay tests.
Remaining in this increment:
1. Fix the horizontal scrollbar caused by the 10-column board.
2. Open `games/spider/index.html` in a browser and check each brief feature (1/2/4 suits, undo, drag, settings for card back, card style, background color). Fix defects found, in app.js / index.html / style.css only.
3. Keep existing tests green.

## Acceptance criteria
Layout
- [MANUAL] At browser window widths 1280, 1366 and 1920 px (see open question 1), with a freshly dealt 4-suit game, no horizontal scrollbar appears on the page or on the board area.
- [MANUAL] At the same widths all 10 columns and the stock button are fully visible without scrolling sideways.

Suits
- [MANUAL] Choosing "1 suit", "2 suits" and "4 suits" in the Suits menu each starts a new game whose cards use only 1, 2 or 4 distinct suits respectively.

Moves and undo
- [MANUAL] Dragging a face-up same-suit descending run from one column onto a legal target column moves it; dropping on an illegal target returns it to its original column.
- [MANUAL] Dragging a run of more than one card moves all cards of the run together.
- [MANUAL] After a move or a stock deal, pressing Undo restores the previous board and the Moves counter decreases by 1; Undo is disabled when there is nothing to undo.
- [MANUAL] Clicking the stock deals one card to each column and the "deals left" count drops by 1.
- [MANUAL] Completing a K-to-A same-suit run removes it from the column and increases the "Sets" counter.

Settings
- [MANUAL] Changing "Card back" to each of its 4 options changes the look of face-down cards and the stock immediately.
- [MANUAL] Changing "Card style" to each of its 3 options changes how face-up cards are drawn immediately.
- [MANUAL] Changing "Background color" with the color input and with each of the 5 swatches changes the page background immediately.
- [MANUAL] Settings chosen are still applied after reloading the page.

Winnable deals
- [AUTO] `npm test` passes, including the replay of every stored winning line in seeds.js (already covered by spider-core.test.js; must still pass after any change).
- [MANUAL] Every "New game" in each suit mode starts from a deal that is in seeds.js (the game never generates an unsolved random deal).

## Out of scope
- Adding more 4-suit deals (increment 2).
- New features, new settings, scoring, timers, hints, animations, sound.
- Changes to spider-core.js rules or solver, seeds.js contents, or the tests (other than fixing a test that is wrong).
- Any rule not in the brief (see open questions).

## Open questions for the human
1. "Typical desktop width": are 1280, 1366 and 1920 px the right widths to check, or do you use another?
2. Which browser(s) must this work in?
3. 4-suit has only 4 stored deals (target 15), so the same deals will repeat often. Is that acceptable until increment 2, or should increment 2 come first?
4. The 4-suit solver run is slow (tens of seconds per deal). Is 15 still the number you want, or would fewer do?
5. The settings dialog has an extra "Interface" (light/dark) option and saves settings in the browser (localStorage). These are not in the brief. Keep, remove, or leave as is?
6. The layout shrinks cards below 600 px width. The brief does not mention phones or small screens. Should small-screen behavior be a requirement, or ignored?
7. Do you want an automated browser test (headless browser) added to the repo? None exists today, so layout and UI criteria above are manual checks.
8. Should the game also work when opened by double-clicking index.html (file://) versus served by a local web server? Neither is required by the brief.
