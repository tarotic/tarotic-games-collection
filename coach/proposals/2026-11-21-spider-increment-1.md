# Coach review: spider-increment-1 (2026-11-21)
Tester result: PASS (first line of docs/test-report.md; the increment 1 copy docs/test-report-increment-1.md also starts with PASS)
Evidence used: docs/decisions.md, docs/requirements-increment-1.md, docs/plan-increment-1.md, docs/test-report.md, docs/test-report-increment-1.md, git log --stat (fdf5dde = increment 1, 61130ad = increment 2), and the two files in coach/proposals/. No run log exists (searched for `*run_log*`), so there are no trends beyond this run. `.claude/agents/` does not exist and `games/spider/docs` does not exist, so I could not read any agent prompt or see the misplaced output. The product owner rerun, the agent files written for another project and the output location problem are known only from the launching message. I did not verify them from files.

Note: this file replaces an earlier coach file with the same name that was committed in fdf5dde. That one reviewed the pre-baseline state. It is now stale (its P-1 is covered below).

## Proposals

### P-2026-11-21-2: Say in the tester prompt and decisions.md what to do when Chrome is not installed
- Type: agent-prompt (tester) plus one line in docs/decisions.md
- Evidence: decisions.md item 2 requires "current Chrome and current Microsoft Edge on Windows". test-report.md line 47: "Google Chrome: not installed at the standard path, so Chrome was not run. Edge only." The tester ran headless Edge 158 (line 5) and wrote 533 lines of browser tests in tests/adversarial/spider-browser.test.js (git stat for fdf5dde). The report's own checklist (line 65) then has Chrome columns for a human anyway. decisions.md item 6 says "Automated browser tests: not in increment 1", but the tester added them. The report does not say whether the human approved that.
- Expected saving: avoids the tester improvising a browser setup each run and the contradiction with decision 6. The saving is unknown. It is cheap because it is one sentence.
- Proposed change: add to the tester prompt (I cannot quote the current line, the file is not in the repo): "If a browser named in docs/decisions.md is not installed, say so in the first section of the report, run the available one headless, and list the missing one as a human step. Do not skip the browser pass." Add to decisions.md item 6: "Headless Edge checks by the tester are allowed as extra evidence. They do not replace the human Chrome and real-profile checks."
- Risk: headless runs gave no classic scrollbar width (test-report.md line 46), so they can look more complete than they are. Keep the "human still needed" rows.
- Status: proposed

## Earlier proposals
- P-2026-11-21-1 (commit a baseline before the engineer starts): helped. Git now has fdf5dde as a baseline, and test-report.md line 5 can say it tested "the increment 1 code as committed in fdf5dde" from a scratch checkout. The old "UNVERIFIABLE by diff" item no longer appears in test-report.md. I cannot tell from the files whether the human applied it on purpose.
- Proposals in 2026-11-21-spider-increment-2.md: not assessed here (they belong to the increment 2 review).

## Watch list
Each of these is a single observation. None meets the three-run rule, so no script or skill is proposed.
- Product owner added timer-app rules that were not in the brief, and the output was deleted and rerun. What the files show: requirements-increment-1.md line 40 lists "timers" as out of scope, and decisions.md ends with "Do not add offline, touch-target, phone or other rules from other projects." That last line looks like the fix already in place. I could not see the first output. If it recurs after that line, change the product owner prompt to "Use only the brief and docs/decisions.md as a source of rules."
- Agent files written for another project had to be rewritten to be flexible. No agent files are in the repo, so I cannot propose a prompt edit. If this recurs, keep one generic agent set (no project-specific names, paths or rules) and copy it into each project.
- Product owner wrote to games/spider/docs instead of docs/. The expected path is docs/ (the files there are docs/requirements.md, plan.md, decisions.md, test-report.md). If it recurs, add the output path to the product owner prompt: "Write to docs/requirements.md at the repo root, never inside a game folder."
- Doc naming: increment 1 files had to be renamed to `*-increment-1.md` (requirements, plan, test-report) once increment 2 overwrote the unsuffixed names (61130ad). If every increment does this, a one-line rule "archive docs/requirements.md, plan.md, test-report.md to `-increment-N` before the next run" could become a script after the third time.
- package.json: the earlier coach review noted plan.md said not to touch it while the spider tests need it. The change went in with fdf5dde. No later conflict appears in the files I read.
- Seed bank holds 5 four-suit deals while an earlier decisions.md count said 4. decisions.md item 3 now says 4 to 10 stored and currently 5, so this is resolved.
- All browser checklist rows still need a human in Chrome (test-report.md lines 63 onward). Nothing to fix in the process, just a remaining cost.
