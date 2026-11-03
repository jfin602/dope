# c12-rmr-man/fast — implementation-first fast Roadmap + one Codex Browser closeout

**Forward owner efficiency change — 2026-11-03 (America/Chicago).** This replaces the earlier prompt execution cadence, not the historical source or evidence. Reference product version 0.12.7; verify the actual LOCAL version and working tree before each prompt. These prompts are MANUAL; no codex:phase runner, /activate, auto-next, self-commit or model/provider/version changes.

**Immediate owner state:** F1 was run and pushed as [PARTIAL / EVIDENCE GAP](qualification/2026-11-03-f1-partial.md), not a measured speed winner. **F2 has already been run** (owner-reported; verify its exact LOCAL source/results, do not rerun or rewrite its prompt). **F3 is in progress**; pause it at a safe boundary, preserve all tracked/untracked/partial changes, and rerun the updated F3 against the reconciled local state. No reset/stash/clean. The older `r4-r` recovery is on hold and original NOT GREEN reports remain unchanged.

## New execution order

| Prompt | Scope | Required checks |
| --- | --- | --- |
| [F1 — Historical partial benchmark](F1-generation-benchmark.txt) | Already attempted; do not redo during implementation | Preserve measured limitations |
| [F2 — Typed output](F2-typed-greenfield-generation.txt) | Already executed per owner; unchanged | Verify local result, do not duplicate |
| [F3 — Existing authority](F3-typed-proposal-authority.txt) | IMPLEMENT only: full typed draft → existing noncanonical backend proposal | Focused deterministic source/security tests, minimal package build |
| [F4 — Canvas review](F4-canvas-contextual-review.txt) | IMPLEMENT only: contextual selection/edit/Apply/Reject, no floating operation list | Focused source/UI-state tests, minimal package build |
| [F5 — Chat consolidation](F5-chat-summary-navigation.txt) | IMPLEMENT only: one compact summary + View, no duplicate normal Chat decisions | Focused Chat/source tests, minimal package build |
| [F6 — SINGLE Codex Browser closeout](F6-connected-chrome-qualification.txt) | ONE integrated user-task qualification; full tower-defense Roadmap → canvas Apply → accepted Gate → Prepare Work entry | One real browser build and **Codex Browser only** for GUI; final source/approval evidence |

**Performance policy:** No Chrome, Codex Browser, local Qwen inference, browser server, screenshots, or full UI replay during **F3–F5**. Do not run `npm run build:browser`, `npm run check`, `npm test`, or a full application build by habit; compile only necessary packages and run a narrow directly affected deterministic suite. F3 security tests for source/revision/lease/approval/no-write **cannot** be deferred. F4/F5 source-tests prove implementation status, not Chrome qualification. There is **one qualification prompt, F6**; it may perform only bounded targeted repair/retest of actual defects.

**F6 browser policy:** Use only the **Codex Browser** for all graphical actions. Do not launch a separate Google Chrome session, Electron GUI or multiple web browsers; a single running app server and required bundle preparation are allowed. Avoid repeated costly inference solely for benchmarking. The primary exit is a correct, reviewable five-Phase tower-defense Roadmap, functional canvas-native review, safe Apply/reload, and a usable accepted Gate → Prepare Work entry so the owner can begin dogfooding. Missing deeper independent P9/Work/native gates remain accurately reported.

**Authority and references:** [ADR 0047](../../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md), [native contract](../../../planning/p12/native-roadmap-authoring-contract.md), [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md). Preserve schema-2 RoadmapStore, protected /roadmap/Ask-Allow, Chat/project/owner/revision/source/lease, exact human Apply, linked Markdown no-clobber, applied-only History, independent GREEN evidence. Keep previous [R4](../qualification/2026-11-03-r4-gate-a-not-green.md) and [R4-R3-R2](../qualification/2026-11-03-r4-r3-r2-trusted-basis-and-tool-transcript.md) records intact.

**Truthful outcomes:** F3–F5 may report **IMPLEMENTED / SOURCE-VERIFIED, GUI deferred to F6**, not blanket product GREEN. Hard security/source failure = HOLD. F6 alone provides real UI and local-model qualification; dogfood readiness must not be inferred from builds or synthetic tests. Do not start Work automatically.
