# ADR 0037 — Human-Centered UI / Usability Qualification

**Entry applicability (2026-10-16):** [Product Phase 10](../planning/p10/phase-10-closeout.md) is now **OWNER-CLOSED / GREEN for its approved R6 recovery scope** at `0.10.16` / `af2b0f0`. This satisfies Phase 11's predecessor condition; **Phase 11 itself remains DESIGN APPROVED / NOT ACTIVATED / NOT QUALIFIED** until a separate activation or explicit execution decision, and `0.11.0` has not been established. Earlier dated references below to Phase 9 pending owner closure or Phase 10 not activated are historical design-stage statements. Phase 12 remains inactive.


**Status:** ACCEPTED PRODUCT DESIGN / DOCUMENTATION ONLY / NOT IMPLEMENTED, ACTIVATED OR QUALIFIED
**Date:** 2026-10-12 (America/Chicago)
**Related:** ADR 0008, 0016 (restrained-orange current), 0024–0025, 0030, 0034, 0036; docs/ARCHITECTURE.md and docs/PRINCIPLES.md.

## Motivation and decision

Dope's current UI and feature-specific qualifications do not establish that a human developer can discover a panel's purpose, choose the next action, comprehend its state, recover from mistakes or complete representative tasks without unnecessary friction. Visual consistency and passing tests are necessary but insufficient.

**Create Product Phase 11 — Human-Centered UI / Usability Qualification**, after the currently design-approved, not activated **Phase 10 Unified Roadmap & Local-First AI Planning**. Defer the inactive **Living Software Knowledge Model** (originally Phase 10, subsequently Phase 11) to **Phase 12**, preserving ADR 0023's existing deterministic-first, local-only/no-hosted-fallback, resource-aware, evidence-driven, no-silent-canonical-mutation rules. Phase 9 is GREEN / QUALIFIED at `0.9.35` / `af3447c`, with owner closeout still pending. This ADR does not activate Phase 10, 11 or 12.

The independent **c9-theme-fix** remains a *palette-only* correction to current ADR 0016 authority. It must not expand into Phase 11's complete usability review or panel redesign. Existing October 8 and earlier theme evidence remains historical.

## The human usability filter

For **every Dope-owned live panel, selector, significant overlay/dialog and practical cross-panel navigation path**, ask: **"Is this easy to use by a human developer?"** Assess by actual developer tasks, not a screenshot or feature checklist.

1. **Purpose:** Can a developer tell why the surface exists and find its entry point?
2. **Next action:** Is the primary action easy to discover and does it advance the intended task?
3. **Information hierarchy:** Are critical decisions and state clear without needless density, repetition or jargon?
4. **Predictable feedback:** Does selection, loading, success, blocked/authority or error state mean what it claims?
5. **Recovery:** Can the developer recognize a mistake, understand the issue and take a safe corrective action?
6. **Comfort/accessibility:** Is text readable? Do keyboard/focus/non-color cues, responsive/narrow placement, scrolling and reduced-motion behavior work where relevant?
7. **Efficiency/continuity:** Are unnecessary clicks, duplicate management and loss of state/context eliminated where feasible?
8. **Cohesion:** Do the interface terms and interactions agree with the Dope/Theia presentation conventions and semantic theme tokens?

Distinct panel responsibilities may justify distinct layouts: do not make every panel identical. Prefer simple existing patterns and meaningful progressive disclosure over more configuration or abstract frameworks.

## Scope and evidence

Phase 11 begins with a source-and-GUI-verified inventory of **all currently registered Dope-owned surfaces** and their key human tasks, adding the Phase 10 Roadmap if implemented and excluding verified retired views. Include Chat/Select Chat, Work/Select Work/review and AgentRun, AI Center, History, Software Map/Physical Map/Flow, Edit Architecture, Planning Map/WorkItems, Roadmap, controlled shell navigation/settings and relevant overlays/empty/loading/error/restart states. Native Theia/third-party surfaces are covered only at Dope-controlled integration seams, not through a wholesale fork.

For each surface, record entry point, realistic task and outcome; normal, empty, loading, blocked/error and restored states as applicable; narrow-pane and keyboard path; observed usability friction; severity (P0 task-blocking/misleading authority, P1 serious recurrent, P2 minor); the smallest proposed fix; and actual retest outcome with exact version/source. Distinguish **heuristic AI inspection** from **real human-driven GUI use**. Do not fabricate tester participation, completion times or numeric usability scores.

Disposition is **Qualified** only for actually witnessed tasks with no material usability blocker, **Not Green** for observed blockers, and **Evidence Gap** where needed actions/states have not been observed. Product-wide Green requires an audited inventory, actual task coverage of all in-scope surfaces and representative workflows, and preserved source/authority correctness. Keep historical failures and truth intact.

## Implementation and workflow contract

Work in slices: (1) full inventory/baseline, (2) shared interaction patterns, (3) Chat/Work/AI Center/History, (4) Architecture/Maps/Planning/Roadmap, (5) integrated human task qualification. Fix the smallest coherent usability problem; avoid one giant refactor or redesign of unrelated panels. Preserve project data ownership, model/tool/permission boundaries, review/validation, Theia upgradeability, accessible themes and color semantics.

Integrate a **Human Usability Gate** into the existing `/prompt-ass -> /prompt-plan -> /prompt-write` workflow for UI-changing prompts: articulate the human task, entry point, primary action, feedback/error/recovery and relevant focus/narrow behavior; choose the smallest regression and appropriate T3 direct GUI task proof. Not every T1 change requires broad GUI evidence.

Phase 11 needs separate owner activation and executable planning. **This docs-only approval edits no product UI source, does not set a version, and does not qualify a panel.**
