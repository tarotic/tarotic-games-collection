# Coach review: spider-increment-1 (2026-11-21)
Tester result: PASS (docs/test-report.md line 1)
Evidence used: docs/test-report.md, docs/decisions.md, docs/plan.md (head), git status and `git diff package.json`, `git log` (one commit, 42e0df6, no spider history), file listing of docs/, games/spider/, .claude/. No run log exists anywhere in the project (searched for `*run_log*`). coach/proposals/ did not exist, so there are no earlier proposals. `.claude/agents/` does not exist, so I could not read any agent prompt. The collisions between the product owner and tech lead runs are known only from the launching message. I could not verify them from files.

## Proposals

### P-2026-11-21-1: Make the "do not touch" check verifiable by committing a baseline before the engineer starts
- Type: agent-prompt (orchestration step, one line)
- Evidence: test-report.md lines 36-37: "I could not diff `seeds.js`, `spider-core.js`, ... because `games/spider/` is untracked in git ... 'Do not touch' ... is UNVERIFIABLE by diff." `git status` shows `games/spider/`, `docs/` and `tests/` all untracked, with only one commit in history. The launching message also says the engineer found the edits already in place, so the report could not show who made them. Both problems have one cause, which is no baseline in git.
- Expected saving: removes two unverifiable items from the tester's report and gives the engineer's report an auditable diff. Saves no tokens directly, but cuts the human's manual confirmation work. Unknown beyond that.
- Proposed change: before the engineer stage, the human (or orchestrator, if the human allows) commits the current `games/spider/`, `docs/`, `tests/` state, for example `git add games/spider docs tests && git commit -m "Baseline before spider increment 1"`. Then the tester runs `git diff --stat <baseline>` to check "do not touch" files. I did not find the engineer or tester prompts, so I cannot quote a line to edit. If they live outside this repo, add: "Before editing, confirm `git status` shows the files you will change as tracked. If they are untracked, stop and say so."
- Risk: committing an unreviewed work-in-progress state. It is a local commit and can be amended. This is a single-run observation, so treat it as low-cost and optional, not as a proven pattern.
- Status: proposed

## Earlier proposals
none (coach/proposals/ did not exist before this run).

## Watch list
These are all first-run observations. None meets the 3-run rule.
- Doc collisions: product owner, tech lead and a second tech-lead run overwrote docs/requirements.md and docs/plan.md, and a second run wrote docs/decisions.md. The human had to pick a set. Likely cause is parallel or duplicate launches writing the same paths. If it recurs, propose a script or prompt rule such as "refuse to write a doc that already exists unless told to replace it". Evidence is the launching message only. I could not see the overwritten versions.
- Defaulted open questions: the product owner's open questions were answered by default before the human was asked, and the human later chose the other set. decisions.md says "approved by the user with 'use your picks'", which fits the record but I cannot see the first set. Watch whether the orchestrator answers questions before the human sees them.
- Engineer with no changes: the planned edits were already in place, so the engineer's report showed nothing. Related to P-1. If it recurs, require the engineer to state "no changes needed, found at <file:line>".
- Tester's own wrong assertion: 24 new tests, one wrong assertion (moving to an empty column is legal), fixed by the tester (test-report.md line 13). Minor rework, no code impact.
- Seed count mismatch: decisions.md says 4 stored 4-suit deals (seeds 8, 10, 13, 15). The bank has 5 (extra seed 46, test-report.md line 36). It is harmless since all 5 replay as wins, but the human should confirm it is wanted or update decisions.md.
- package.json: the `test` script now includes `games/spider/` (verified in `git diff`). plan.md says "do not touch package.json". The change is needed for the spider tests to run, so plan.md is probably what is wrong. Human to confirm.
- Default suit count changed to 2 by the human outside the plan. The plan, test-report and MANUAL checklist (row S1, L1 "fresh 4-suit game") do not reflect it. Watch whether post-plan human changes keep going unrecorded. I did not verify the current default in index.html.
- All 13 MANUAL checklist rows are "not run" x4 browsers/modes (52 cells). A browser pass is the largest remaining cost, and decisions.md item 6 rules out automated browser tests for increment 1. Revisit that decision if increment 2 repeats a manual pass.
