> **SUPERSEDED 2026-10-11 (America/Chicago):** ADR 0034 replaces Development Sessions with right-toolbar History / Developer Continuity. Historical 9C P1-P9 reached committed `0.9.22` / `0752415` but P10 real GUI closeout was not executed. **Do not run old p9c, advance to 0.9.23 under this stack, or claim Phase 9 Green.** The former plan/activation/prompt text is retained below solely for historical reference. Current authority: `docs/planning/p9/phase-9-plan.md`.

# Phase 9C — Separate Owner Activation

**Date:** 2026-10-11 (America/Chicago)  
**Decision:** **OWNER-APPROVED — PHASE 9C P1–P10 ACTIVATED FOR EXECUTION; NOT IMPLEMENTED OR QUALIFIED**  
**Owner instruction:** "i approve the start of p9c lets go" (2026-10-11, after the P1 activation preflight stopped with zero file changes).

## Scope of owner approval

The owner explicitly activates **Phase 9C — Development Sessions Workspace UI**, authorizing the existing **P1–P10 stack** in `docs/tasks/p9c/` under `docs/planning/p9/phase-9c-plan.md`, ADR 0033 and ADR 0025. This is the **separate explicit owner activation record** required by every 9C prompt. Design review, prompt authoring and the 9B closeout alone were not activation. 9C may now begin at P1 after safe Git synchronization and validation.

Authorized P1–P9 implementation boundaries:
- Project-root-scoped Session frontend controller and center Session widget/launcher.
- Explicit developer Session metadata create/edit with existing revision checks.
- Typed Session artifact attach/detach and bounded, genuinely safe owner-backed candidate selection.
- Compact, truthful read-only artifact resolution with missing/stale/unavailable states, distinct WorkItem/AgentRun/validation/review/promotion truth.
- Navigation through **existing** Chat, Work, Planning and Project Mind owner views, preserving single-live-owner semantics and project isolation.
- Bounded integration/restart/selection-race and no-Session regression coverage.

**P10 is the sole manual 9C qualification and closeout**. It must prove the resulting Session UI in a **real Theia GUI** (with representative existing artifacts, project switching, restart and independent non-Session workflows), record exact evidence and mark **9C GREEN / NOT GREEN** for its bounded scope. Headless tests alone do not constitute real GUI qualification.

## Accepted entry and outstanding historical evidence

Phase 9A is **GREEN only for bounded headless identity/persistence** at `0.9.6` / `6b51ee96bcdc4ca185292f594c1886de81b149e8`. Phase 9B is **GREEN only for bounded backend/headless linking and resolution** at coherent `0.9.13` / `5aa0bacecb4c26bf1806821747f36fae57077b1a`; its separately committed evidence is in `docs/tasks/p9b/closeout.md` and includes 25/25 focused Session tests and a genuine accepted local Planning-to-Work replay.

**Phase 9 overall remains NOT QUALIFIED.** Phase 5's historical P11 Not Green/P12 unexecuted disposition remains unchanged; Phase 8 owner-closed Green remains unchanged. **9D, 9E and Phase 10 remain inactive and require their own owner activation and qualification.** This decision does not authorize Phase 9 closeout, Phase 10 alignment or retroactive evidence reclassification.

## Execution and version authority

This activation is **documentation-only** and changes no source or package version. The Git-proven starting source/version is `0.9.13` at `5aa0bac`, with the 9B closeout and 9C documentation/prompt commits following it. All 13 root/app/package manifests and pinned internal `@dope/*` dependency references remain `0.9.13` until P1 performs its legitimate transition to **`0.9.14` DURING implementation**. P2–P9 each own their next assigned version through `0.9.22`; P10 must create a separate real `0.9.23` source/version checkpoint before an evidence-only closeout. The runner verifies versions and owns implementation checkpoints; it does not pre-bump. Preserve `yarn.lock`, unrelated dependencies, preexisting developer changes and the absence of a root `package-lock.json`.

The first local P1 attempt halted after approximately 23 seconds at its missing activation gate. It changed **zero files** and ran **no build/tests**. The resulting runner message "expected `0.9.14`; found `0.9.13`" reflects that preflight stop; it is **not** a code failure or a reason to manually advance versions. After recording this decision, P1 should restart from `0.9.13`.

## Preserved developer and artifact authority

Sessions are optional organizational references, **never execution grants, task origins, copied owner state, or implicit model context**. Session selection/resolve/navigation must not execute an AgentTask/AgentRun, approve/apply candidate changes, mark WorkItems complete, rebase Planning, adopt Architecture, initialize missing Project Mind, mutate owning Chat/Planning/Agent stores, invoke recovery-writing Chat reads, or silently route project data to providers. Preserve exact same-project identity, revision safety, legitimate closed/missing/stale handling, and existing Chat/Work single-panel ownership. Unsupported safe candidate browsing or exact deep linking is reported honestly, not simulated or silently bypassed.

9D still owns rich progress/activity and guided resume/closeout; 9E owns the final Dope Builds Dope GUI/full aggregate, phase-level qualification and closeout. No future phase is activated here.

## Local restart after safe synchronization

Inspect and protect intentional local changes before synchronizing. Confirm local root package version `0.9.13`, this activation record and current `p9c` prompt stack, then:

```bash
git status --short
git pull --ff-only
npm run codex:phase:validate -- p9c
npm run codex:phase -- p9c
```

This document authorizes those implementation prompts but **does not claim they have run or passed**. It does not establish a `0.9.14` checkpoint, a `0.9.23` release, 9C Green, or Phase 9 Green.
