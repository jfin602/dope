# ADR 0037 — Human-Centered UI / Usability Qualification

**2026-10-16 owner-approved Phase 11 UX correction — `c11-brainstorm`, authored only:** Saved ChatPanel plus existing Roadmap should show validated local-model proposed phase changes in real time, emphasize helpful prose/questions and preserve keyboard/narrow/layout and explicit human review; never overclaim Green or bypass Markdown safety. [P1–P8](../tasks/c11-brainstorm/README.md) not run/qualified at unchanged `0.11.8`; H02/broad Phase 11 still open.

**Owner-approved navigation amendment (2026-10-16 America/Chicago; docs-only, UX-007):** In the default Explorer-focused Dope workbench, replace the standalone Search Activity Bar slot with a **Roadmap** entry in that same position; activating Roadmap focuses/opens the **existing center-editor Roadmap canvas** through `dope.roadmap.open` without changing Roadmap ownership, Chat, or panel placement. Add a compact, discoverable search field at the top of the existing **Explorer** panel (below its header, above the file tree). Its default behavior is responsive fuzzy **filename/path filtering** of the current workspace tree, with matching ancestry preserved and clear/empty behavior; provide an adjacent discoverable affordance for existing **workspace content search**, not a second indexing/search backend. Do not delete or disable Theia's `@theia/search-in-workspace` capability: retain project-wide search/replace and result navigation, command palette access, and established keybindings (especially `Ctrl+Shift+F`). Hide/relocate only its Activity Bar launcher without leaving duplicate/restored Search navigation or hijacking keyboard shortcuts.

**Implementation boundary:** Integrate with Theia 1.75 navigator/search contribution and supported shell APIs instead of forking an entire native Explorer or introducing a duplicate Roadmap widget/search subsystem. Reuse `dope.roadmap.open`, existing Roadmap identity/state, and the current restrained Dope Dark semantic theme; non-dark themes, narrow panes, keyboard navigation, screen reader naming, project switching, restored layouts and browser/Electron must work. This is a **separately scoped Phase 11 navigation improvement**, not a substitute for the existing UX-003 manual guidance repair or two broad Usability Hunter runs. Source-specific T1/T2 checks and direct T3 real-GUI verification are required. **No code changed, no implementation authorized, no new qualification, no version bump, and Phase 11 remains OPEN / NOT QUALIFIED.** See [Phase 11 navigation contract](../planning/p11/phase-11-plan.md#bounded-navigation-correction--explorer-search-and-roadmap-shortcut), [coverage](../planning/p11/panel-usability-matrix.md), and [UX-007 ledger](../planning/p11/usability-issue-ledger.md).

**Phase 11 baseline amendment (2026-10-16):** [Phase 11 version-only baseline](../planning/p11/baseline.md) was established by `70c41e617980b3d5a7f512c5a351e0b2a3e92ead`, moving exactly 13 package versions and 20 internal `@dope/*` pins to `0.11.0` without implementation source. [Phase 10 owner closeout](../planning/p10/phase-10-closeout.md) remains GREEN for the approved R6 recovery scope at qualified product `af2b0f0` / `0.10.16`. This **does not qualify `0.11.0`** or start Phase 11. The design is accepted, the live Phase 11 inventory/UX audit and executable prompt stack are not yet complete; a deliberate later Run action authorizes an authored stack under current repository workflow without a preliminary `/activate`. Preserve the R6 network/model exclusions and Phase 12 inactivity. Older dated entry notes below are historical.


**Owner-approved usability addendum (2026-10-16):** The [Phase 11 recovery contract](../planning/p11/usability-recovery-contract.md) adds safe Markdown-button Roadmap source relinking (explicit active-state replacement warning, old file preserved, preflight/cancel/failure/revision safety, durable new link), natural language display of validated planning-result message in the existing ChatPanel (collapsed technical JSON, no false edit claims), and accurate capability-grounded Dope help whenever actions are unsupported/blocked (actionable UI recovery, no invented controls/permissions). The screenshot also motivates investigation, not presumed proof, of Roadmap loading, crowded icon controls, repeated overlay text and overexposed metadata. This addendum is **docs-only**: the 0.11.0 version baseline is established, Phase 11 product implementation/qualification and executable stack are still pending; explicit later owner Run on an authored stack authorizes implementation without a separate /activate. Earlier dated contrary activation/baseline language is historical, not the current route.

**Phase 11 iterative-method approval (2026-10-16):** Fix the owner-reported Roadmap/Chat/guidance problems first, then use reusable **manual GUI Hunt → independent Triage → bounded Repair → direct Verify loops** across different task/state coverage. The [Hunter](../tasks/p11/usability-hunt-manual.md) never implements product code; the [issue ledger](../planning/p11/usability-issue-ledger.md) and [coverage matrix](../planning/p11/panel-usability-matrix.md) maintain findings through iterations. There is no fixed count or forced one-time P11-D/E ending; two materially different clean broad hunts, full observed coverage and owner signoff are required together for product Green. No change to one saved Chat/Work owner, provider/permission safety, historical Phase 10 Green, 0.11.0 version-only baseline, or inactive Phase 12. This amendment is design/documentation only.

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

Work through a bounded known-issue repair tranche followed by repeatable discovery/triage/repair/verification loops; source-verified inventory and representative human task coverage remain continuous rather than once-only preliminary steps. Fix the smallest coherent usability problem; avoid one giant refactor or redesign of unrelated panels. Preserve project data ownership, model/tool/permission boundaries, review/validation, Theia upgradeability, accessible themes and color semantics.

Integrate a **Human Usability Gate** into the existing `/prompt-ass -> /prompt-plan -> /prompt-write` workflow for UI-changing prompts: articulate the human task, entry point, primary action, feedback/error/recovery and relevant focus/narrow behavior; choose the smallest regression and appropriate T3 direct GUI task proof. Not every T1 change requires broad GUI evidence.

Phase 11 needs separate owner activation and executable planning. **This docs-only approval edits no product UI source, does not set a version, and does not qualify a panel.**
