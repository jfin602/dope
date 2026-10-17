# Phase 11 — Preliminary panel usability matrix

**Status (2026-10-16):** PRELIMINARY INVENTORY / **FIRST SEPARATE USABILITY HUNTER NOT RUN**. The initial P8 known-issue tranche was **NOT GREEN**, and its [P8 closeout](../../tasks/p11/known-issue-closeout.md) remains historical. Subsequent [M1 supplemental recovery](../../tasks/c11-guidance/manual/m1-recovery-qualification.md) qualified UX-003 **SCOPED GREEN in the browser/local-Q4 workflow** at committed product `e69d7e5` / unchanged `0.11.8`: two selected-checkpoint repeats, unselected guidance, synced-state and Planning Map isolation, saved Chat and no-write evidence passed. This does not establish a broad Phase 11 human usability audit or product qualification. Native Electron GUI, hosted parity, untested surfaces and separate Hunter evidence remain gaps. Phase 11 is **OPEN / NOT QUALIFIED**.
**Date:** 2026-10-12; Phase 10 predecessor updated 2026-10-16
**Authority:** ADR 0037 and [Phase 11 `0.11.0` baseline](baseline.md). Phase 10 is owner-closed at `0.10.16` / `af2b0f0`; this matrix describes candidate **Phase 11 usability audit targets**, not directly verified current widget registrations or pass/fail outcomes. First Phase 11 step must inspect live source/GUI and retire or add rows accordingly.

| Preliminary surface | Representative human task | Current audit |
| --- | --- | --- |
| Shell / navigation / tabs / activity bars | Find, open, relocate and refocus the correct tool | Not audited |
| Explorer / Search integration | Find a file with in-panel fuzzy filtering; retain content search and keyboard paths | UX-007 implemented candidate; [browser scoped check](ux-007-implementation-check.md), native and broader states Evidence Gaps |
| Settings / theme / Dope-Theia preferences | Understand scope and persist a preference | Not audited |
| AI Center / model connections / roles | Configure a provider and understand model eligibility | Not audited |
| Select Chat / folders | Find, organize and resume a conversation | Not audited |
| Chat / composer / transcript / settings | Talk, choose context, understand output and recover | Not audited |
| Select Work / Running / History / stacks | Identify current work and its true status | Not audited |
| Work / task composer / review / validation | Safely start, track, stop or review an eligible action | Not audited |
| AgentRun center transcript | Understand agent activity, consequential commands and errors | Not audited |
| History / Continue | Return to exact meaningful project-bound work | Not audited |
| Software Map / left inspector | Understand hierarchy and navigate to evidence/code | Not audited |
| Physical Map / Flow | Trace implementation and behavior without clutter | Not audited |
| Edit Architecture | Change structure safely and understand acceptance | Not audited |
| Planning Map / WorkItems | Create/revise a plan and hand off work | Not audited |
| Phase 10 Roadmap / inspector / Ideas & Issues | Understand progress, priority and next checkpoint | Phase 10 implementation retained/qualified for R6 scope; **Phase 11 human usability not audited** |
| Dialogs, overlays, empty/loading/error states | Know what occurred and how to recover | Enumerate later; not audited |
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

The [source-bound N1–N5 check](ux-007-implementation-check.md) records the local-browser evidence and limits. This is not a human usability Hunter and does not change existing P8/P3 Not Green or Hunter progress.

## Living workflow/task-state coverage

**P8 browser-only coverage delta (uncommitted `0.11.8` candidate, product source `8cad838`):** Roadmap manual wrong-file replacement, preview/cancel/invalid/stale/missing/confirm, external new-source edit, restart and second-project isolation were directly exercised. One saved Chat had explicit local Q4 selection, a validated no-action message, raw JSON disclosure/copy, keyboard and narrow rendering. Exact reported Roadmap help wording **failed** despite a matched “linked Roadmap file” wording passing; native Electron GUI and Codex-backed parity were not exercised. AI Center was inspected only to confirm the existing local connection/model, not to qualify provider configuration. This is scoped regression evidence, not a broad Hunter pass.

**Next separate Hunter target:** History → exact continuation → Work status/review on a disposable project, with empty/stale/restart and keyboard/narrow recovery. The first Hunter remains **not yet run** and must use the reusable [manual prompt](../../tasks/p11/usability-hunt-manual.md). Other preliminary rows remain unaudited until a direct task/state record exists.

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
