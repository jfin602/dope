# Phase 11 — Preliminary panel usability matrix

**Status:** PRELIMINARY INVENTORY / NOT AUDITED / NO PHASE 11 HUMAN TEST EVIDENCE
**Date:** 2026-10-12; Phase 10 predecessor updated 2026-10-16
**Authority:** ADR 0037 and [Phase 11 `0.11.0` baseline](baseline.md). Phase 10 is owner-closed at `0.10.16` / `af2b0f0`; this matrix describes candidate **Phase 11 usability audit targets**, not directly verified current widget registrations or pass/fail outcomes. First Phase 11 step must inspect live source/GUI and retire or add rows accordingly.

| Preliminary surface | Representative human task | Current audit |
| --- | --- | --- |
| Shell / navigation / tabs / activity bars | Find, open, relocate and refocus the correct tool | Not audited |
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

For **every confirmed active surface**, capture:

- Surface, location and owning widget/entry point
- Human goal; first meaningful action; expected success path
- States exercised (empty, populated, loading, blocked, error, restart)
- Narrow-pane, keyboard and focus observations
- Direct human use evidence versus AI heuristic impressions
- Issue severity P0/P1/P2, reproduction and smallest remedy
- Exact candidate and retest: Qualified / Not Green / Evidence Gap

**End-to-end scenario:** open project -> use History -> find Roadmap objective -> inspect Map/Planning -> supervise Work -> inspect validation -> resume context. Do not manufacture project facts, authorize runs or claim human testing that did not occur.
