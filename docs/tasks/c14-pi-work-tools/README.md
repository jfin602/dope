# c14-pi-work-tools — Runner Pi Work tool replacement and manual qualification

**Status:** ASSESSED / PLANNED / RUNNER PROMPTS P1–P7 AND MANUAL P8 AUTHORED ONLY — NOT RUN OR QUALIFIED. **Revised:** 2026-11-27. **Required unchanged product version:** `0.14.0`; verify HEAD, manifests and dirty owner work before execution. **Authority:** [ADR 0060](../../decisions/0060-pi-native-work-tools-dope-controlled-operations.md), [ADR 0059](../../decisions/0059-direct-and-isolated-work-execution-modes.md), [Work tool selection](../../planning/p13/work-tool-selection-proposal.md), ADR 0027/0028, and [workflow](../../workflow.md).

## Outcome

Replace the five custom model-facing Pi Work wrappers and their brittle broker protocol for **new** Pi Work runs with Pi-maintained tool contracts wherever Dope can enforce the whole effect. A thin Pi-compatible adapter is allowed for an SDK seam that cannot safely perform the complete operation; unrestricted Pi Bash is excluded under the current effect ceiling. Dope retains exact selected-tool authorization, internal `ExecutionGrant`, canonical source checks, OS confinement, bounded commands, Direct write journal/revert, Isolated candidate review/promotion, validation, History and Roadmap authority. Do not replace Pi Chat/Planning or unrelated MCP tools.

The failed `meteor-dodge-dope` run is diagnostic evidence, not a baseline PASS. Opening `index.html` has not been shown to cause a denial. The new system must return a precise conflict when an unsaved buffer or concurrent writer truly blocks a write, and must allow authorized missing-parent creation without an unjournaled effect.

## Runner sequence and manual closeout

Read [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md). **P1–P7 are runner-managed, headless prompts. P8 is the only browser-required prompt and remains an independent manual closeout.** The runner owns P1–P7 checkpoints; implementation agents do not self-commit or manually start the next prompt. A checkpoint commit is evidence of changed files, not a GREEN qualification receipt. If any prompt reports NOT GREEN/BLOCKED, stop the runner before dependent work; do not treat its commit prefix as permission to advance. P1's verified audit report is a deliberate tracked change that satisfies its checkpoint without a fake product edit.

| Prompt | Scope | Exit |
| --- | --- | --- |
| [P1](P1-audit-and-reproduction.txt) | Headless source/SDK audit and disposable broker reproduction | Tracked audit report, factual seam matrix and migration plan |
| [P2](P2-isolated-file-operations.txt) | Safe Isolated read/write/edit operations and parent creation | Focused file/security tests, unchanged candidate authority |
| [P3](P3-direct-file-operations.txt) | Direct atomic journaled write/edit and conflict recovery | Focused Direct crash/race/owner-edit tests and honest receipts |
| [P4](P4-pi-tool-adapter.txt) | Pi-native eligible file definitions through Dope operations | Exact schema/behavior attestation, no raw effect path |
| [P5](P5-selection-and-commands.txt) | Trusted catalog, saved selections, worker/host attestation and bounded commands | Every entry path rejects unselected/stale/forged calls |
| [P6](P6-feedback-transcript-and-lifecycle.txt) | Recoverable results, terminal tool receipts, Direct/Isolated final states | No opaque expected denial or false candidate promotion |
| [P7](P7-integration-and-retirement.txt) | Headless cross-package T2, old-wrapper retirement and regression | Replacement is sole new-run path; security matrix passes |
| [P8](P8-manual-live-closeout.txt) | Independent local-model, browser and disposable-project T3 | Source-bound GREEN or NOT GREEN with Pi baseline comparison |

### Operator commands and stop boundary

After the owner has reviewed the authored stack and ensured a coherent `0.14.0` checkout with owner dirty work safely accounted for, validate the prompt grammar locally:

`npm run codex:phase:validate -- c14-pi-work-tools`

After a distinct owner **Run** decision, start or resume the normal runner:

`npm run codex:phase -- c14-pi-work-tools`

That command runs P1–P7 and stops before P8. **Do not use `--closeout` for P8.** Initiate P8 manually with a connected browser only after P7's exact-source T2 report passes. No `/activate` or extra activation command. This authoring and grammar validation do not authorize a product Run.

## Execution and evidence rules

Each prompt begins with `git status --short`, HEAD, manifest/Pi dependency and previous prompt evidence. Preserve existing uncommitted docs and all user files; no reset, stash, clean, checkout, destructive Git command, or historical prompt/evidence rewrite. Keep product `0.14.0` unchanged throughout this correction; stop and reassess if the actual checkout has advanced. Do not use the owner's persistent game project for tests. Use disposable Git projects; measure standalone Pi only inside a disposable sandbox with no access to owner project data.

P1 is an audit and headless reproduction gate, not a license to migrate blindly. P2–P6 use focused tests and affected-package builds; P7 owns broad headless T2 and one aggregate check on the final candidate; P8 owns all real GUI/model T3. Record exact source identity, changed paths, test commands/results and outstanding risks in `qualification/` after each prompt. A failure or blocked audit is NOT GREEN; stop runner progression even if a checkpoint commit exists. Do not start a model Work run or change the provider just to make a headless implementation prompt pass.

P8 must compare the **same task, model and settings** in standalone Pi and Dope, including successful output/validation, calls, schema/prompt/context bytes and elapsed time. Use the reported `unsloth/gemma-4-26b-a4b-it-qat` if still available; if not, record the substitution and do not claim a same-model reproduction. Test a fresh missing-`src/` fixture and an open `index.html` tab, both Direct and Isolated, with expected denial/conflict cases. Qualification of this correction is separate from provider-wide, Phase, Roadmap Gate or native Electron Green.

## Authored-state boundary

This authoring writes documents and prompts only. It does not implement the replacement, run tests or Work, migrate saved approvals, commit code, qualify the model, or change Roadmap/Gate status. The current old wrappers remain in source until the sequence is deliberately executed and verified.
