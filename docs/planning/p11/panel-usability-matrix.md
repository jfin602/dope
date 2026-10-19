# Phase 11 — Preliminary panel usability matrix

**Status (2026-10-16):** PRELIMINARY INVENTORY with first separate [manual Hunter H01](../../tasks/p11/h01-history-usability-hunt.md) recorded on clean `8990407` / `0.11.8` in the AI-operated browser. H01 covered a bounded History/Work entry flow and proposed UX-008–UX-010; it did not retest UX-001–UX-007 or complete a Work run. UX-007 is committed product at `8990407`, retaining its earlier browser-scoped check and native gaps. The initial [P8 closeout](../../tasks/p11/known-issue-closeout.md) remains historically **NOT GREEN**; [M1 supplemental recovery](../../tasks/c11-guidance/manual/m1-recovery-qualification.md) remains **SCOPED GREEN for UX-003 in browser/local Q4** at `e69d7e5` / `0.11.8`, with original M1/P3/P8 Not Green records preserved. Native Electron GUI, hosted parity and broad usability remain gaps. Phase 11 is **OPEN / NOT QUALIFIED**.
**Current H1/H2 (2026-10-16):** [H1](../../tasks/p11/h1-history-continuation-diagnostics.md) UX-008/009 is scoped Green for browser/local History continuation/diagnostics, committed `1732626` after its uncommitted source-bound run. [H2](../../tasks/p11/h2-history-evidence-preview-readability.md) UX-010 is scoped Green for deterministic browser/local evidence preview, committed `a73ff47` after its uncommitted source-bound run; affected builds and 21 focused tests passed. A successful live explanation (Dope reported no eligible connected local conversational model), native GUI, H2-source full aggregate and broader Work/map coverage remain gaps. H2's three browser backend exits (code 139) during reload/build transitions remain an unclassified investigation. H02 [manual Hunter](../../tasks/p11/h02-software-map-hunt.md) is **not run**; Phase 11 OPEN / NOT QUALIFIED.
**Date:** 2026-10-12; Phase 10 predecessor updated 2026-10-16
**Authority:** ADR 0037 and [Phase 11 `0.11.0` baseline](baseline.md). Phase 10 is owner-closed at `0.10.16` / `af2b0f0`; this matrix describes candidate **Phase 11 usability audit targets**. H01 directly covered only the rows marked H01; other rows still require live registration and GUI checks.

| Preliminary surface | Representative human task | Current audit |
| --- | --- | --- |
| Shell / navigation / tabs / activity bars | Find, open, relocate and refocus the correct tool | H01 keyboard command entry only; broad shell navigation not audited |
| Explorer / Search integration | Find a file with in-panel fuzzy filtering; retain content search and keyboard paths | UX-007 committed at `8990407`; earlier [browser scoped check](ux-007-implementation-check.md), native and broader states Evidence Gaps; H01 did not retest |
| Settings / theme / Dope-Theia preferences | Understand scope and persist a preference | Not audited |
| AI Center / model connections / roles | Configure a provider and understand model eligibility | Not audited |
| Select Chat / folders | Find, organize and resume a conversation | Not audited |
| Chat / composer / transcript / settings | Talk, choose context, understand output and recover | Not audited |
| Select Work / Running / History / stacks | Identify current work and its true status | H01 browser: “No Work currently running” and “No saved Work yet”; completed status/review remains Evidence Gap |
| Work / task composer / review / validation | Safely start, track, stop or review an eligible action | H01 browser: New Work grant review visible; Start Work disabled with Coding Agent unavailable. No Work run, completed review or validation exercised |
| AgentRun center transcript | Understand agent activity, consequential commands and errors | Not audited |
| History / Continue | Return to exact meaningful project-bound work | H01 discovery preserved; [H1](../../tasks/p11/h1-history-continuation-diagnostics.md) browser/local repair qualifies UX-008 and UX-009 on its recorded candidate: exact editor target, stale reason, normal empty state, genuine error/recovery, reload, project switch, keyboard and narrow right pane. [H2](../../tasks/p11/h2-history-evidence-preview-readability.md) qualifies deterministic browser/local UX-010 at committed `a73ff47` (after test-time uncommitted evidence); native GUI and successful local explanation remain gaps. |
| Software Map / left inspector | Understand hierarchy and navigate to evidence/code | Not audited |
| Physical Map / Flow | Trace implementation and behavior without clutter | Not audited |
| Edit Architecture | Change structure safely and understand acceptance | Not audited |
| Planning Map / WorkItems | Create/revise a plan and hand off work | Not audited |
| Phase 10 Roadmap / inspector / Ideas & Issues | Understand progress, priority and next checkpoint | Phase 10 implementation retained/qualified for R6 scope; **Phase 11 human usability not audited** |
| Dialogs, overlays, empty/loading/error states | Know what occurred and how to recover | H01 History empty/stale and Work disabled entry observed; broader states not audited |
| Editor / SCM / terminal / Problems seams | Move naturally between Dope-owned and ordinary IDE views | Integration seam; not audited |
| Project Mind surviving Phase 10 entry points | Locate Notes, Ideas and Decisions without a redundant launcher | **Verify actual surviving routes and retired surfaces** in first Phase 11 registration/GUI audit; not audited |


## Owner screenshot triage and qualification targets — 2026-10-16

| Human task or issue | Screenshot-level observation | Severity / disposition | Proposed response |
| --- | --- | --- | --- |
| Replace incorrectly linked project Roadmap | User cannot discover a way to change selected mvp-roadmap.md | P0 reported / not live-retested | Markdown menu relink with safe confirmation and rollback |
| Read local planning Chat response | no-action JSON carries the useful message while internal payload dominates | P0 observed / not live-retested | Surface result message as assistant prose; collapse tool details |
| Ask Dope how to unlink a Roadmap | Response discusses checkpoint edit restrictions and suggests irrelevant objective clarification | P0 observed / not live-retested | Explain real supported navigation and next action |
| Roadmap loading indicator | Loading Roadmap appears in still image | P1 investigation / Evidence Gap | Verify whether it resolves, errors or remains stuck |
| Correction overlay and controls | Repeated/truncated correction title; many dense icon controls | P1 investigation | Verify overlay hierarchy, labels, tooltips and keyboard/narrow behavior |
| Follow Interactive and metadata | Composer context unclear and transcript IDs/JSON crowd response | P2 investigation | Explain context controls; use progressive disclosure |

**U1–U9 direct qualification gates:** U1 relink success; U2 cancel/failure/unsynced/stale protection; U3 restart, new linked source synchronization and project isolation; U4 correct no-action user prose; U5 collapsed yet inspectable activity; U6 grounded recovery without invented UI actions; U7 real local Q4 and Codex selection/consent and response parity; U8 real loading/empty/error/overlay/accessibility states; U9 existing Phase 10 ownership/permission/Markdown/Chat regressions. For each, record exact source, tested action, expected vs observed result, and Qualified/Not Green/Evidence Gap. See [recovery contract](usability-recovery-contract.md).

## Explorer/Search and Roadmap navigation amendment — UX-007 (browser scoped candidate)

**Human goal:** Locate a project file directly in Explorer and open the project Roadmap from the left Activity Bar without losing full project-wide content search.

| Task/state | Required observation | Current evidence |
| --- | --- | --- |
| Explorer compact file search | Under the Explorer header, fuzzy filename/path match, matching folder ancestry, clear/reset, empty/no-results and file open in current project | Browser query, nested ancestor, no-result, clear and file open observed; duplicate names and workspace switch **Evidence Gap** |
| Roadmap Activity Bar shortcut | Roadmap occupies Search's former slot and opens the already registered center-editor Roadmap (without duplicate widget, forced Chat, or sidebar Roadmap) | Browser open/reopen/reload observed; native GUI and project switch **Evidence Gap** |
| Full-text search preserved | `Ctrl+Shift+F`, command palette, content result navigation, exclusions/options/replace and restoring full-text view without duplicate Activity Bar entries | Browser content results, replace control, shortcut and reload observed; actual replace and command palette **Evidence Gap** |
| Multi-state compatibility | Narrow/keyboard/focus/accessibility, no workspace and multiple projects, browser/Electron, alternative theme, persisted layout/restart | Browser narrow, focus, Dope Dark/Light and reload observed; native and remaining states **Evidence Gap** |

The [source-bound N1–N5 check](ux-007-implementation-check.md) records the earlier uncommitted candidate's local-browser evidence and limits. UX-007 product was subsequently committed at `8990407`; this did not add native evidence or count as H01. Existing P8/P3 Not Green remains historical.

## Owner Work Experience target — 2026-10-18 (UX-013 / UX-014; docs only)

The owner-provided Work detail and transcript screenshots are **design observations**, not a new manual Hunter or independently confirmed product root cause. Correction proposal and exact acceptance contract: [Work Experience](work-experience-contract.md). H01 only inspected Work empty/disabled entry and **did not** qualify real completed Work, runner validation or AgentRun formatting. Keep `c11-bridge-repair` P5 NOT GREEN and preserve native Electron unobserved evidence separately.

| Gate | Representative user task and states | Current evidence |
| --- | --- | --- |
| W1–W2 — Work overview/truth | Discover Running/History/stacks; identify actual step, active task, completed agent vs required validation and qualification | Owner screenshot; **NOT TESTED** as redesigned product |
| W3–W4 — Intervention/authority | Understand dirty-tree drift and required check unavailable separately; review files/grants/approval without accidental continue | Owner screenshot; **NOT TESTED**; no bypass of source/validation/authority |
| W5 — Markdown transcript | Read headings, lists, tables, code fences, file references, agent summaries and collapsible command output in existing AgentRun center editor | Owner screenshot; **NOT TESTED** as redesigned product |
| W6 — Safe rendering | Unsafe HTML/images/links, large logs, cross-project and secret redaction without new network or provider authority | **NOT TESTED**; preserve prior image-egress denial |
| W7 — Durable transcript/history | Reopen after reload/restart; scroll away/Latest, current distinct Work IDs, exact History continuation | **NOT TESTED** |
| W8 — Responsive/accessibility | Wide/narrow/docked Work, keyboard focus, screen reader labels, alternative theme, cancelled/error/empty state | **NOT TESTED** |
| W9–W10 — Integrated real GUI | Current direct task and real Prompt Stack plus failed/blocked and successful Work; Phase Focus/Bridge D6–D8; explicit manual browser/native/source-bound report | **NOT TESTED**; native direct evidence must not be inferred from a build |

## Living workflow/task-state coverage

**P8 browser-only coverage delta (uncommitted `0.11.8` candidate, product source `8cad838`):** Roadmap manual wrong-file replacement, preview/cancel/invalid/stale/missing/confirm, external new-source edit, restart and second-project isolation were directly exercised. One saved Chat had explicit local Q4 selection, a validated no-action message, raw JSON disclosure/copy, keyboard and narrow rendering. Exact reported Roadmap help wording **failed** despite a matched “linked Roadmap file” wording passing; native Electron GUI and Codex-backed parity were not exercised. AI Center was inspected only to confirm the existing local connection/model, not to qualify provider configuration. This is scoped regression evidence, not a broad Hunter pass.

**H01 coverage delta (clean `8990407` / `0.11.8`):** The [source-bound report](../../tasks/p11/h01-history-usability-hunt.md) records an AI-operated browser run at `127.0.0.1:3010` in two disposable projects under `/tmp/dope-p11-hunter-h01-bhklTr`. History's empty, verified editor, stale-file, reload, project isolation, keyboard entry and read-only preview paths were exercised, along with recent activity to a saved empty Chat. Work was only inspected in empty/blocked states. H01 did not run a model, hosted call or Work action, and did not retain screenshots. UX-008 and UX-009 are P2; UX-010 is P2 provisional. Completed Work status/review, AgentRun, native Electron, narrow viewport and local explanation after preview remain Evidence Gaps.

**Next different Hunter target (NOT RUN):** [H02 — Software Map → Physical Map/Static Flow → evidence-to-code](../../tasks/p11/h02-software-map-hunt.md), covering empty/uninitialized, evidenced structure, missing/stale evidence, project isolation, error/restart, keyboard/narrow recovery and safe source opening. Use the [reusable Hunter](../../tasks/p11/usability-hunt-manual.md). Local History explanation, native Electron and completed Work review remain separate gaps; other rows remain unaudited until direct evidence exists.

The table above is **only a preliminary UI inventory**, not a single-pass completion checklist. Each manually executed [Hunter](../../tasks/p11/usability-hunt-manual.md) selects under-tested workflow/state pairs and updates this matrix and the [issue ledger](usability-issue-ledger.md) after evidence review.

| Coverage data | Required record |
| --- | --- |
| Stable entry/coverage ID | Actual registered widget/route, meaningful human task and first click |
| State and placement | Normal, empty, loading, denied, error, stale, recovery, restart; panel placement, narrow/focus/keyboard/theme when relevant |
| Real observation | Outcome, reproduction steps, screenshot/log, actor (human/AI GUI), exact source/version |
| Classification | Not Audited / Evidence Gap / Not Green / Qualified, with corresponding issue ID |
| Next hunt target | Uncovered **different** task/state, not another pass over already-tested screens |

Preserve all earlier observations and source-bound failures, distinguish owner's screenshots from live reproduction, and require two different broad clean hunts only **in addition to** comprehensive coverage and owner acceptance.

For **every confirmed active surface**, capture:

- Surface, location and owning widget/entry point
- Human goal; first meaningful action; expected success path
- States exercised (empty, populated, loading, blocked, error, restart)
- Narrow-pane, keyboard and focus observations
- Direct human use evidence versus AI heuristic impressions
- Issue severity P0/P1/P2, reproduction and smallest remedy
- Exact candidate and retest: Qualified / Not Green / Evidence Gap

**End-to-end scenario:** open project -> use History -> find Roadmap objective -> inspect Map/Planning -> supervise Work -> inspect validation -> resume context. Do not manufacture project facts, authorize runs or claim human testing that did not occur.

## Owner-requested c11-brainstorm visual local planning task (not tested)

| Human task | Required direct observation | Evidence |
| --- | --- | --- |
| Brainstorm a phase (L1–L3) | Real selected Q4 asks relevant questions and creates validated provisional nodes/edges without Refresh; no-model manual path | NOT RUN |
| Conversational + manual revision (L4) | Split/reorder/depend/correction, reject/undo/cancel, honest draft vs canonical | NOT RUN |
| Restart/project safety (L5) | Durable accepted draft/confirmed decisions, pending re-review, two-project and Chat lease/placement | NOT RUN |
| Publish safely (L6–L7) | Explicit Markdown approval/reconciliation, consented Codex handoff and negative owner/provider/source tests | NOT RUN |
| Real UI (L8) | Browser, independently inspected Electron, narrow/keyboard/theme and movable Chat | NOT RUN |

Design-only `c11-brainstorm` differs from separately unrun H02 Software Map Hunter and does not qualify earlier scoped results.

## c11-phase-focus — read-only selected-phase prompt sequence (owner requested, NOT RUN)

| Task | Required direct observation | Evidence |
| --- | --- | --- |
| Open phase overlay (F1/F8) | Same center Roadmap; correct phase, keyboard/narrow/theme/Chat layout | NOT RUN |
| Inspect authored sequence (F2/F7) | P1→PN fixed, no reorder or prompt Run, checked source | NOT RUN |
| Completed immutability (F3) | Original source/checkpoint/history unchanged, external source-drift denial | NOT RUN |
| Pre-authoring draft (F4) | Only pre-P*.txt outline order may rearrange; no post-authoring reorder | NOT RUN |
| Corrections/status (F5/F6) | Verified phase/failed-prompt relation and separate implementation/qualification evidence | NOT RUN |

[Manual gate prompt](../../tasks/c11-phase-focus/P4-manual-phase-focus-closeout.txt); doesn't replace c11-brainstorm P8, H02 or wider usability evidence.

## Current Phase Focus P4 coverage and approved recovery — 2026-10-17/18

| Gate | Real P4 evidence | Next evidence needed |
| --- | --- | --- |
| F1/F2 | Browser PASS; overlay opens correctly and authored P-order/visual Arrange remain independent | Regress only if evidence repair affects UI |
| F3 | FAIL overall; changed prompt source correctly blocked, but original project's verified completed Work/checkpoint records aren't displayed | R1/R3 real project-backed read-only completion + immutable snapshot, clone-negative |
| F4 | BLOCKED / EVIDENCE GAP; genuine pre-authoring Bridge producer isn't implemented | Owner-approved **deferral to PB5/D5**, NOT PASS; maintain authored order lock now |
| F5 | BLOCKED / EVIDENCE GAP; phase correction association passes, exact failed-prompt proof absent | R2/R3 citation-backed proof plus ambiguous/unknown negative |
| F6 | FAIL; live overlay invokes selector without evidence inputs | R1–R3 status input + R4 browser distinct implementation vs qualification |
| F7/F8 | Browser PASS; checked Open Prompt/no Work start, focus/keyboard/narrow/Chat | Adjacent regression only; native Electron GUI unobserved, not parity proof |

[Tested P4 closeout](../../tasks/c11-phase-focus/closeout.md) is preserved. [Repair contract](../../tasks/c11-phase-focus/qualification/p4-evidence-repair/contract.md) docs only, not yet executed. The Phase Focus narrowed correction scope may defer only F4's live Bridge producer, never F3/F5/F6, source integrity, fixed authored order, or full Phase 11 D1–D8/owner qualification.
