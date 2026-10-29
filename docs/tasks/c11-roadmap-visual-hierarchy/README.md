# c11-roadmap-visual-hierarchy — screenshot-matched Roadmap UX correction

**Canonical prompt-stack handoff (2026-10-29):** The developer selected executable stack name [`c11-roadmap-redesign`](../c11-roadmap-redesign/README.md) on `main`. This earlier document remains the owner-approved **design charter only**, is not an executable runner stack and must not be separately implemented or qualified. The actual `/prompt-ass`, `/prompt-plan`, `/prompt-write`, P1–P4 and manual Chrome gating are under `c11-roadmap-redesign`. Historical design wording below is retained for context; Phase 11 remains OPEN and code is unchanged by authoring.

**Owner approval:** 2026-10-29 (America/Chicago)
**Status:** DESIGN/DOCUMENTATION ONLY. No implementation, prompt-stack activation, browser qualification or Green claim.
**Product baseline at docs review:** `0.11.8`; Phase 11 **OPEN / NOT QUALIFIED**. Re-read live source/version before any future implementation.
**Authoritative visual target:** owner-supplied `this-style.png` screenshot in the 2026-10-29 Dope IDE conversation (not yet a tracked repository asset).
**Full contract:** [Roadmap Visual Hierarchy & Progression](../../planning/p11/roadmap-visual-hierarchy-contract.md).

## Why this is needed

The real owner screenshots show an overly dim first state and a difficult-to-read later Roadmap: phases and checkpoints look like equally weighted cards; dashed containment/membership lines can cross/attach unrelated children; parent ownership, sequence and progress are hard to read. The owner explicitly chose a three-card charcoal preview with clear left-to-right arrows, green qualified phase, orange active phase, dim empty phase, a progress summary/bar and nested collapsible checkpoint rows as the **exact style** to implement.

The existing c10-horizontal-color correction made phase progression/status distinctions and later qualified a **narrow browser scope**, but this owner-approved presentation direction supersedes its equal-node visual **for future design only**. Do not rewrite, invalidate or exaggerate that correction's historical evidence.

## Bounded scope

- Render each phase as the primary interactive container and its checkpoint children as compact collapsible rows. Keep full checkpoint details and edit/approval in the existing in-canvas inspector.
- Keep the horizontal phase route and replace confusing membership/dashed edge presentation with clear directional phase-to-phase arrows; leave actual semantic dependencies inspectable without cluttering the default view.
- Derive **Unplanned** (no accepted children) versus **Planned** (one or more accepted children) display treatment separately from canonical six-state implementation/qualification truth. Never infer Green or percent complete from draft/authoring.
- Place explicitly owned corrections beneath their parent/phase; preserve prompt/task-stack identities, manual Show/Hide Prompts accounting, unresolved associations and the Ideas/Issues pool.
- Extend existing `dope-capability-help.ts` capability registry and Chat context with grounded instructions and explanation for progression, statuses, foldouts and qualifying Green.
- Preserve the existing `RoadmapStore`, `RoadmapGreenfield`, `ProjectPlanningActions`, linked Markdown approval/relink/conflict handling, owner revisions, saved ChatPanel docking, pan/zoom, keyboard/touch, source evidence and history.

## Planned iterative qualification route — NOT EXECUTED

| Loop | Scope | Direct proof |
| --- | --- | --- |
| R1 | Screenshot-matched phase/checkpoint hierarchy and arrows | Real Codex Chrome screenshot, expand/collapse, responsive/keyboard, inspector, viewport |
| R2 | Honest progression colors, bars, correction grouping, relationship semantics | Zero/one accepted child, all canonical statuses, proposed/accepted/linked states, missing/conflicting parent and real dependency negatives |
| R3 | Dope Help, local-model and cross-owner regression | Current local Q4 state-grounded answers, real GUI interaction, linked Markdown and saved Chat preserved, exact-source disposition |

When explicitly requested, use `/prompt-ass`, `/prompt-plan`, `/prompt-write` to author the smallest safe bounded executable stages, with **at most three repair/qualification cycles per loop**. Manual real-browser checks should use the actual Codex Chrome browser; do not place browser-only qualification behind an unattended headless runner. Native Electron parity and all broader Phase 11 gates remain independent. Authoring is not authorization to run.

## Documentation / qualification boundaries

This new task is a **forward correction**, not an amendment to previously completed c10-horizontal-color prompts or closeout. Do not retroactively turn Phase 11 Green, change package version, treat screenshot sketches as measured runtime evidence, publish a draft without separate approval, or move Chat to a new fixed location.

**Next authorized user choice:** `/prompt-ass + /prompt-plan + /prompt-write c11-roadmap-visual-hierarchy`, or perform further read-only design review before prompts. The actual implementation and qualifications await a separate explicit Run.
