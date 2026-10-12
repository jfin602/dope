# Phase 11 — Preliminary panel usability matrix

**Status:** PLANNING CHECKLIST / NOT AUDITED / NO HUMAN TEST EVIDENCE
**Date:** 2026-10-12
**Authority:** ADR 0037. Verify actual runtime registration and Phase 10 implementation before treating any row as active.

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
| Phase 10 Roadmap / inspector / Ideas & Issues | Understand progress, priority and next checkpoint | Pending Phase 10; not audited |
| Dialogs, overlays, empty/loading/error states | Know what occurred and how to recover | Enumerate later; not audited |
| Editor / SCM / terminal / Problems seams | Move naturally between Dope-owned and ordinary IDE views | Integration seam; not audited |
| Project Mind surviving Phase 10 entry points | Locate knowledge without redundant management UI | Recheck after Phase 10; not audited |

For **every confirmed active surface**, capture:

- Surface, location and owning widget/entry point
- Human goal; first meaningful action; expected success path
- States exercised (empty, populated, loading, blocked, error, restart)
- Narrow-pane, keyboard and focus observations
- Direct human use evidence versus AI heuristic impressions
- Issue severity P0/P1/P2, reproduction and smallest remedy
- Exact candidate and retest: Qualified / Not Green / Evidence Gap

**End-to-end scenario:** open project -> use History -> find Roadmap objective -> inspect Map/Planning -> supervise Work -> inspect validation -> resume context. Do not manufacture project facts, authorize runs or claim human testing that did not occur.
