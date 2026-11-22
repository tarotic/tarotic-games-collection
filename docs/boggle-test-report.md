# Test report: Boggle (solo)

## Automated tests

`npm test` from the project root (Node 22.23.5 in the build container), tail of the output:

```
# tests 91
# pass 91
# fail 0
```

Boggle tests (`games/boggle/boggle-core.test.js`), 14 of 14 pass:
- dice: 16 dice, Q die is the Qu face
- rollBoard: 16 faces, same seed gives the same board
- neighbors: corner 3, edge 5, centre 8
- findPath: traces along a row and along a diagonal
- findPath: rejects cell reuse and absent words
- findPath: rejects letters that do not touch
- findPath: the Qu face spells qu
- scoreWord: classic points, under 3 letters = 0
- checkWord: accepts a traceable dictionary word, with points
- checkWord: explains each rejection
- solveBoard: exact result on a fixture board
- solveBoard: Qu produces qu words
- words.js: 170,398 words, sorted, a-z only, 3 to 16 letters
- solver equals brute force over the full dictionary on a seeded board

Two earlier failures were caused by my test fixtures, not the engine: the dictionary included "zzz", which is traceable on a board of filler z cells. Both fixtures were corrected and no expected result was changed to match the output.

## Tapping mode (second increment)

Added: a Typing / Tapping switch. Tapping builds the word from touching tiles, with Clear and Enter. Swiping is not included.

Engine tests added (`canTapNext`, `pathText`): 16 of 16 pass in `boggle-core.test.js`.

Headless browser check (phone viewport, Chromium): 

| Check | Result |
|---|---|
| Tiles are disabled in typing mode before a round, enabled in tapping mode during one | PASS |
| Clear is shown only in tapping mode; typing panel hidden in tapping mode | PASS |
| Tapping a tile that does not touch the last one is refused with a message | PASS |
| Tracing a real word on the board builds the word on screen ("fetid") | PASS |
| Clear empties the word and disables Clear | PASS |
| Tapping the word again and pressing Enter scores it (+2) and empties the tap word | PASS |
| Switching back to typing re-enables the input and hides Clear | PASS |
| No horizontal scroll at 390 px, no console errors | PASS |

Manual (NOT RUN): tapping on a real phone and in Chrome/Edge on Windows.

## Pre-existing issue found and fixed

The old `npm test` script passed directory arguments (`games/sudoku/ games/spider/`). Node 22 rejects them with `Cannot find module`, so the script failed before running any test. The individual spider and sudoku test files passed (33 of 33) when run by name. The script now lists the test files by name, which works on any Node version.

## Ad hoc headless browser checks

Run with Playwright and the pre-installed Chromium, not part of `npm test`. Phone viewport 390 x 844, and a fake clock for the timer.

| Check | Result |
|---|---|
| Page loads from a file path, 16 tiles | PASS |
| Input disabled before Start, enabled after | PASS |
| Timer starts at 3:00 | PASS |
| "ab" rejected: needs at least 3 letters | PASS |
| "zzzzz" rejected: not in the dictionary | PASS |
| A word from the solver on this board is accepted: "+1 for crew", score 1, count 1 | PASS |
| Same word again is rejected as already found | PASS |
| Timer shows 2:00 after 60 s | PASS |
| Timer reaches 0:00 and input is disabled | PASS |
| Summary: "You found 1 of 24 possible words", 23 missed words listed | PASS |
| No horizontal scroll at 390 px | PASS |
| No console errors or page errors | PASS |
| Screenshot of the end-of-round state reviewed at phone width | PASS (layout looks right) |

Screenshot: `/tmp/claude-0/boggle-end-mobile.png` in the build container's scratch folder. It is not in the repo.

## Manual checks (real Chrome and Edge on Windows)

| # | Check | Status |
|---|---|---|
| M1 | Start a round and let it run; the timer counts down in real time and shows 0:30 in the warning colour | NOT RUN |
| M2 | Type a traceable word, then a non-traceable one; both messages read correctly | NOT RUN |
| M3 | "Qu" face shows as "Qu" and "quit" is accepted when traced through it | NOT RUN |
| M4 | Board, scorebar and summary at 1280, 1366 and 1920 px wide, no clipping | NOT RUN |
| M5 | Chrome and Edge: no console errors on load, Start or round end | NOT RUN |
| M6 | Open from `file://` and from a local server (`games/boggle/index.html`) | NOT RUN |

## Bugs
None found by the checks above.
