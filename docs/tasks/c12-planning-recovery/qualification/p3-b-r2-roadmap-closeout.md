# P3-B-R2 final Roadmap recovery — 2026-11-01

**P3-B-R2: NOT GREEN. P3-B overall: NOT GREEN.** Manual Codex in-app browser qualification on disposable projects. P3-B-R1, H3 and P2 historical NOT GREEN evidence remains intact; this result does not qualify native Electron, C12 or Phase 12.

## Source and runtime

- HEAD `cf8f5d51cb13c086739b6b4df92b2f862f370ee7`, `main` ahead of origin by one commit. Version `0.12.7`. Entry dirty files were `packages/theia-extension/src/node/chat-context-composer.ts`, `test/unit/roadmap-gate-chat.test.ts`, and untracked `qualification/p3-b-r1-final-source-browser-recovery.md`. This run additionally edited those same two source/test files and created this report. No reset, stash, clean, commit, version, provider, dependency or lockfile change.
- Final product/test diff SHA-256 from `git diff -- packages/theia-extension/src/node/chat-context-composer.ts test/unit/roadmap-gate-chat.test.ts`: `28bd165b0827bac0e1594d70f13bfbd105ab1b70cc13cb2eb4051644e5ca82ee`. The previous R1 diff is preserved in its report.
- Actual LM Studio model: `qwen3.5-9b`, context 16,384, parallel 2, Local (`lms ps`); AI Center showed `LM Studio · qwen3.5-9b` ready after refresh. Commands remained Ask. Structured Output was not changed. No model switch.
- Dope browser server on `http://127.0.0.1:3018/`; two Codex in-app browser tabs used. Unlinked fixture `/tmp/dope-p3b-browser-20GAft` (existing R1), linked fixture `/tmp/dope-p3b-r2-linked-lD8C2X` (created from the existing schema-2 import path because H3's older linked `/tmp` fixture no longer existed). Both are disposable. The server was restarted after the final browser bundle and remains running. No owner project was opened or written.

## Focused repair

An exact `gate-one` request while Chat carried a selected Phase context first yielded an unintended title change; the proposal was rejected without a write. A second attempt searched project files and asked for shell access despite typed Roadmap facts; the shell request was denied and the turn cancelled. Source tracing found that `gateContext()` preferred the selected Phase over an explicitly named Gate ID, omitting the Gate's required current title/purpose. The repair gives one exact Gate ID in a `/roadmap` request precedence over the selected Phase. A focused regression asserts the Gate target and unchanged title are supplied. It does not alter schema, approval, writer or Pi permissions.

The first restart followed only an extension compilation, so its browser backend still used the old bundle. That intervening unlinked replay is **not final-source evidence**. `npm run build:browser` and a subsequent server restart put the repair into the connected browser; the final replay then visibly had current Gate title and purpose in model context and produced the correct typed preview. The model nevertheless requested one unnecessary `run_command` read after identifying all required facts. It was denied; no speculative command executed. This is a remaining context/skill behavior failure, not a successful no-extra-call result.

## Browser gates and exact fixture bytes

| Gate | Result | Final-source observation and limit |
| --- | --- | --- |
| G2 selected `/roadmap` / Reject | **Prior R1 PASS, not replayed** | R1's selected Gate create, shared preview and Reject remained historical evidence. This run did not claim a new final-source selected Reject. |
| G3 exact target / Apply | **PARTIAL** | The final browser replay named exact `gate-one`, returned a 1-action Gate purpose edit with `Readiness` unchanged, and Chat/canvas showed the same before/after. No preapproval write. Apply used the existing Chat review, advanced revision 1→2 and cleared the overlay. The Chat turn still carried `Roadmap Phase: First Phase (phase-one)` context, so the required truly unselected UI case was **not established**. An ambiguous-target negative was **not run**. The unnecessary denied shell request prevents a no-extra-call pass. |
| G4 linked single-field Apply | **PASS for observed field; bundle provenance limit** | The first linked turn produced a checked one-field Gate title proposal, exact Markdown heading diff and matching Chat/canvas provisional title. Markdown/JSON hashes were unchanged before Apply. Apply used the linked writer, changed only that heading, kept unrelated prose, advanced revision 1→3, cleared the overlay and left qualification Unknown. This was after the source edit and extension build, but before the final browser bundle rebuild; the later build changed the backend bundle. No final-bundle replay of this Apply was done. |
| G4 linked stale source | **PASS for observed negative; bundle provenance limit** | A new revision-3 title proposal was visible in Chat/canvas. External Markdown append changed its hash; Apply returned `Stale · no change`, removed approval controls and overlay, retained new Markdown bytes and canonical JSON/revision, and advised refresh. The fixture was restored only after hash checks. This ran before the final browser bundle rebuild. |
| G5 unsupported linked structure | **PASS on final bundle** | `/roadmap` asked to remove Gate G1 and its Criterion. The model returned useful natural-language linked structural limitation and reviewed reconciliation guidance, with no proposal, ghost, invalid-JSON error or write. |

| State | Markdown SHA-256 | Roadmap JSON SHA-256 | Revision |
| --- | --- | --- | --- |
| Unlinked before preview/Apply | no file | `c7648bbc790a0d1e3b59a525d2755b46f9b26a642cf44c667cfd72f4931e7ac5` | 1 |
| Unlinked after approved purpose | no file | `567d60faf15927297759a2ffac2e95781e8adb01487bef8ed99b57bf59ced00d` | 2 |
| Linked before title preview/Apply | `e138d76e9a685f0e2bcdcbe0c85d127ed69624324140e6ec8015463c86a535e5` | `0b0f2687b1b1d6437ff02eabc6ec4686b887d60681d106ccfe8614da47b6e657` | 1 |
| Linked after approved title / before stale test | `b7a6238ffc96f5abf3ea5f84e5820134ecf9726c235661bbf332511bbc2575ab` | `2fa8c8a1d8467ff26123040e4ebc97852666fc89c87c8ed7f5331b867d11f90b` | 3 |
| Linked external stale marker / after denied Apply | `3462d6e9f6c5206f78d1359ff306f6696b4449b0050f0869a53ca232ff949023` | `2fa8c8a1d8467ff26123040e4ebc97852666fc89c87c8ed7f5331b867d11f90b` | 3 |
| Linked restored / after structural no-action | `b7a6238ffc96f5abf3ea5f84e5820134ecf9726c235661bbf332511bbc2575ab` | `2fa8c8a1d8467ff26123040e4ebc97852666fc89c87c8ed7f5331b867d11f90b` | 3 |

Unlinked JSON inspection after Apply confirmed only Gate `gate-one.purpose` changed, with title `Readiness`, Criterion `criterion-one`, Phase fields and all implementation/qualification statuses unchanged. Browser still showed `0 of 1 gates qualified` and `Unknown`.

## H3 and security carryforward

| Area | Disposition |
| --- | --- |
| Action families | **PARTIAL / EVIDENCE GAP.** Live final bundle: existing Gate purpose edit/Apply and linked unsupported structural no-action. Earlier R1 live Gate create/Reject is historical. Focused source tests cover typed 1–3-action schema, Gate/criterion/Phase domain and projection, dependencies, source patches and viewport. Criterion add/edit/remove, delete ghost, reparent/reorder, corrections and multi-action canvas atomicity were not independently replayed live here. |
| Lifecycle and project isolation | **PARTIAL / EVIDENCE GAP.** Live stale linked source denied authority; rejected and applied cards became inert, no ghost remained. A full active proposal saved-Chat switch, cross-project switch/return, replaced proposal, lost lease and historical reload matrix was not run. Prior deterministic owner/lease tests passed. |
| Canvas interaction | **PARTIAL / EVIDENCE GAP.** Existing center Roadmap tab was reused for both reviewed edits; correct Gate field and parent appeared, and no Green was fabricated. Deterministic viewport tests cover saved camera and reduced-motion policy. Manual pan/zoom, foldouts, narrow layout, keyboard Tab/Enter/Escape and duplicate-warning visual checks were not completed. |
| Skill/context security | **PARTIAL.** Exact-ID override supplied current Gate title/purpose after final bundle rebuild. Focused Skills, Chat context, proposal/source and Pi runtime suites passed. Live no-extra-call failed because the model requested a redundant shell read, which Ask denied. No large Roadmap 16K live cost comparison, actual serialized token count, ambiguity negative, current-turn spoof replay or Ask/Allow parity was captured here. No context cost reduction is claimed. |

## Final-source verification and disposition

On the final source, 98/98 focused/adjacent Chat, Skills, Roadmap, preview, viewport and Pi runtime tests passed; a further 13/13 import, greenfield and qualification tests passed (**111/111 total across the two groups**). `npm run typecheck`, `npm run build:browser`, `npm run build:electron`, and `git diff --check` passed. No full repository aggregate was run. The Electron build is **not** native Electron GUI evidence.

**Remaining Roadmap blockers:** truly unselected `/roadmap` target acquisition and ambiguous-target no-write response; redundant model shell request despite sufficient typed Gate context; full final-bundle linked Apply/stale replay; H3 action-family, lifecycle/project-switch, and canvas accessibility/viewport live matrix. These mandatory gaps make P3-B-R2 and P3-B overall **NOT GREEN**. Generic P2 output-limit, cancellation-context, clipboard, reconnect and keyboard attribution remain assigned to **P3-C**, not silently promoted by these Roadmap checks. The Codex browser and Dope server are left open for inspection. No P3-C execution or commit followed.
