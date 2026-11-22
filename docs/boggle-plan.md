# Plan: Boggle (solo)

Sources:
- docs/boggle-requirements.md
- docs/decisions.md (browser and layout rules from earlier games)
- the layout and script patterns in games/spider and games/sudoku

This plan was written for a direct build with no agent pipeline. It uses the same sections as docs/plan.md so an agents pass can use it later.

No BLOCKERS. The open questions in the requirements use their default answers.

## Decisions recorded

| # | Question | Decision |
|---|---|---|
| 1 | Round length | 3 minutes, one constant (`ROUND_SECONDS` in boggle-core.js). |
| 2 | Word list | ENABLE (public domain), filtered to 3 to 16 lowercase letters. |
| 3 | Qu | One face spelled "qu". Counts as 2 letters for length and points. |
| 4 | Entry | Typed words only. Tile tracing is out of scope. |
| 5 | Missed words | Listed at the end of every round. |
| 6 | Browser tests | Written as ad hoc headless checks; not added to `npm test`. |

## Approach

- `boggle-core.js` holds all logic: dice, board rolling, adjacency, tracing (`findPath`), scoring, dictionary (set + prefix trie), word checking and the solver (`solveBoard`). No DOM.
- `app.js` is the DOM layer. It owns the timer and the phase (`ready`, `playing`, `over`), and calls the core for everything else.
- The solver runs once per board, when the board is rolled, so the missed-word list costs nothing at the end of the round.
- `words.js` is generated, so the word list can be rebuilt. Like `seeds.js` in Spider, it is committed.

## Prerequisites
- Node.js 18 or later.
- `npm test`. The test script lists test files by name, because Node 22 does not accept directory arguments to `node --test`. The previous script (`games/sudoku/ games/spider/`) failed on Node 22 for that reason.
- Playwright with the pre-installed Chromium, for the ad hoc browser checks.

## Do not touch
- Everything under `games/spider/` and `games/sudoku/`, except the `npm test` script in package.json.
- `games/boggle/words.js` by hand. Rebuild it with `build-words.js`.

## Files

1. NEW `games/boggle/boggle-core.js`. Pure engine, UMD wrapper as in spider-core.js.
2. NEW `games/boggle/boggle-core.test.js`. 14 tests: dice, rolling, adjacency, tracing, Qu, scoring, dictionary checks, word checking, solver fixtures, the bundled list's shape, and solver-versus-brute-force on a seeded board.
3. NEW `games/boggle/build-words.js`. Filters a word list to `words.js`.
4. NEW `games/boggle/words.js`. Generated, 170,398 words.
5. NEW `games/boggle/index.html`, `app.js`, `style.css`. Page, round flow, layout.
6. `index.html` (home page). Adds a Boggle card.
7. `package.json`. `npm test` now lists test files by name and includes the Boggle tests.
8. `README.md`. Adds a Boggle section and a row in the games table.

## Test plan
- `npm test`: all tests, including the 14 Boggle tests.
- Ad hoc headless browser checks (Chromium, phone viewport and a fake clock): page load, input enable and disable, invalid word messages, a valid word from the solver, the duplicate rule, the timer and end of round, missed-word summary, no console errors, no horizontal scroll.
- Manual checks in Chrome and Edge on Windows: listed in docs/boggle-test-report.md.

## Risks
- The word list is 1.7 MB. It loads on the first page load; the trie builds in well under a second on a desktop browser.
- ENABLE is an older list. Some valid modern words are missing. That is a content choice, noted in the requirements.
