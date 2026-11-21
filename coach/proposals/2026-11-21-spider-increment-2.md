# Coach review: spider-increment-2 (2026-11-21)
Tester result: FAIL (docs/test-report.md line 1; one low-severity bug, since fixed by the engineer, npm test 77 of 77 per the launching message, not re-run by me)
Evidence used: docs/test-report.md, docs/decisions.md (still headed "increment 1", no increment 2 entries), coach/proposals/2026-11-21-spider-increment-1.md, games/spider/app.js (newGame, cancelDealAnimation), git log (two commits: 42e0df6, fdf5dde) and the git status given at launch. No run log exists anywhere in the project (searched `*run_log*` earlier and again this run). `.claude/agents/` is absent, so no agent prompt could be quoted. Items from the launching message that are not in files are marked "unverified".

## Proposals

### P-2026-11-21-2: Add a "run the cleanup path" line to the engineer's brief (empty/early-return paths)
- Type: agent-prompt (one line; cannot quote the current prompt, it is not in the repo)
- Evidence: test-report.md BUG 1. The plan's item g already said "cancelDealAnimation before the empty-bank early return ... always clears the layer". The engineer put the cancel in newGame (app.js line 74) but the early return at lines 77-78 skips `render()`, leaving 10 `deal-pending` cards and a disabled stock. Only the tester's test caught it. This is one occurrence, so it is a low-cost prompt line, not a skill or script.
- Expected saving: avoids one FAIL verdict and one fix round per increment where state is set up before an early return. Unknown beyond that.
- Proposed change: add to the engineer prompt: "For every early return in a function you edit, state what the UI looks like afterward and add a test for it. If you start a state change (busy flag, hidden class, disabled button) before the return, the return path must undo it."
- Risk: slightly longer engineer output. Low.
- Status: proposed

## Earlier proposals
- P-2026-11-21-1 (commit a baseline before the engineer starts): helped. The repo now has baseline commit fdf5dde, and the tester could verify "git diff of games/spider/spider-core.js is empty" (test-report.md) and spot the unexpected seeds.js change from git status. Both were UNVERIFIABLE in increment 1. Suggest the human repeat it per increment: commit increment 2 now so increment 3 starts from a clean diff, and the new untracked docs (plan-increment-1.md and similar) and deal-anim files get tracked.

## Watch list
All are one occurrence or unverified; none meets the 3-run rule.
- Background seed builder still running (unverified from files except test-report.md "Observations": seeds.js changed during the run, 8 inserted lines from seed 46, plan says "do not touch"). It is a hazard for any stage that reads the bank. If it recurs, propose a pre-stage check script (for example `git diff --quiet games/spider/seeds.js` and a process check) or a rule that the orchestrator confirms no builder is running before launching a stage. It also touches decisions.md item 3 ("the builder must resume rather than overwrite") and the bank size cap of 4 to 10 deals; the shipped bank is 30 / 30 / 7 per test-report.md, so the 4-suit count of 7 is within the cap but decisions.md still says 5.
- Test file layout mismatch: tester wrote adversarial-deal.test.js because "a heredoc append failed" (test-report.md). Engineer/tester sharing assumptions on layout is unverified. Watch for repeats of failed appends; the Write/Edit tools rather than shell heredocs would avoid it.
- Tech lead deviated from approved file scope (new deal-anim.js) and the human accepted it (unverified from files; deal-anim.js and deal-anim.test.js exist untracked). Watch whether scope deviations keep being approved after the fact; if so, let the plan list "new files allowed" up front.
- Open-question defaults approved only after being asked, one round trip (unverified; second run in a row, after the increment 1 watch item "defaulted open questions"). If it recurs a third time, propose that the product owner record proposed defaults in the requirements so one "approve defaults" answer settles them.
- decisions.md is not updated for increment 2 (heading and content are increment 1 only). Doc versioning is now ad hoc (`*-increment-1.md` copies appear). Watch.
- The MANUAL checklist for increment 2 has 7 rows plus A4 to A6, all "NOT RUN" except the human's look check. The increment 1 watch item (manual browser pass is the largest remaining cost) is repeated; decisions.md item 6 still rules out automated browser tests. This is the second run; revisit if a third repeats.
- Tester's `npm test` shows FAIL by design because the bug test was left in the repo. That is correct behaviour, noted only so the human does not read it as noise.
