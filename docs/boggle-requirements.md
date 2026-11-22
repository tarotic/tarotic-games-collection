# Requirements: Boggle (solo)

## Goal
Add a solo Boggle game to the collection. The player gets one 4x4 board of classic Boggle dice, has three minutes to type as many words as they can trace through touching letters, then sees their score and every word they missed.

## Scope
- New game folder `games/boggle/`, linked from the home page (`index.html`) and README.
- Classic 16-dice set, with "Qu" as one face.
- Dictionary: the ENABLE word list (public domain), filtered to 3 to 16 lowercase letters. Stored in `games/boggle/words.js`, rebuilt by `games/boggle/build-words.js`.
- Two ways to enter words, chosen with a Typing / Tapping switch:
  - Typing: type a word and press Enter.
  - Tapping: tap touching tiles to build the word (each new tile must touch the last one and not be used already). Clear empties the word, Enter submits it.
- Scoring per classic Boggle. "Qu" counts as two letters.
- Three-minute round, a timer, a running score, a list of the player's words, and an end-of-round summary.
- Pure logic in `games/boggle/boggle-core.js`, tested under `node --test`.

## Acceptance criteria
Rules
- [AUTO] A word counts only if it is in the dictionary, is at least 3 letters, and can be traced through touching cells (diagonals included) without reusing a cell. (`boggle-core.test.js`)
- [AUTO] The "Qu" face spells "qu", so "quit" traces through a Qu cell. (`boggle-core.test.js`)
- [AUTO] Points: 3-4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8+ letters 11. (`boggle-core.test.js`)
- [AUTO] A word already found this round is rejected. (headless browser check, see test report)
- [AUTO] Tapping: a tile can be added only if it touches the last tapped tile and is not already in the word. (`boggle-core.test.js`, and headless browser check)
- [AUTO] Tapping: Clear empties the word; Enter submits the tapped word and clears it when accepted. (headless browser check)
- [AUTO] At the end of a round, the list of missed words is every possible dictionary word on the board that the player did not find. (solver checked against brute force, `boggle-core.test.js`)

Round flow
- [AUTO] Before Start, the input is disabled. After Start, it is enabled and the timer starts at 3:00. (headless browser check)
- [AUTO] When the timer reaches 0:00, input is disabled, the summary shows "You found X of Y possible words", and the missed words are listed. (headless browser check)
- [MANUAL] Real Chrome and Edge on Windows: the same flow, with a real-time timer.
- [MANUAL] Tapping on a phone: tiles respond to a tap without zooming or double-tap delay.

Layout
- [AUTO] At 390 px wide there is no horizontal page scroll. (headless browser check)
- [MANUAL] The board, timer and summary look right at 1280, 1366 and 1920 px wide, in both Chrome and Edge.

Regression
- [AUTO] `npm test` passes, with the Boggle tests listed by name.
- [AUTO] The Spider and Sudoku tests still pass.

## Out of scope
- Swiping or dragging across tiles to trace a word (planned for a later increment; tapping is the first version).
- Saved high scores, sound, multiplayer, and timer or board-size settings.
- Touch-specific behaviour beyond the phone-width layout check.
- Automated browser tests in the test suite (the browser checks in this increment were run ad hoc, see the test report).

## Open questions
1. Round length. Default used: three minutes (classic Boggle).
2. Word list. Default used: ENABLE, which is public domain and about 170k words after filtering. Other lists (for example SOWPODS) are not public domain.
3. Qu scoring. Default used: Qu counts as two letters for length and points.
4. Missed-word list. Default used: shown at the end of every round.
