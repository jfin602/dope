# Product Phase 5 — Activation

Status: **OWNER-CLOSED FOR SEQUENCING**

Date: 2026-10-01

Activation baseline:
- package: `0.5.0`
- transition commit: `016bd8780e89081dfdb5746eae981183dc945baa`
- execution folder: `p5`
- version family: `0.5.x`

## Preconditions and inherited truth

Product Phase 4 — Physical Map remains Qualified/Green for its approved core scope at `0.4.6` / `fac88712bb55176d3d6d54fbe6034de8b0f801ff`.

The pre-Phase-5 gates are dispositioned as follows:
- `c4-smap-storage`: GREEN / QUALIFIED at `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`;
- `c4-color-theme`: GREEN / QUALIFIED at unchanged `0.4.6`;
- `c4-smap-synth`, `c4-smap-gemini-provider`, `c4-synth-improvements`, and `c4-synth-coverage-review`: owner-closed Not Qualified with useful implementation retained;
- fresh Local/Gemini provider comparison: deferred, not executed and not relabeled Green.

The post-theme failed-analysis-state repair at `c7e0d66269d3f11fd2e31c3f94ecc7ffc843bae9` is part of the owner-accepted baseline.

The Phase 4 closeout changes only top-level package version `0.4.6 -> 0.5.0`; historical evidence is not rewritten.

## Phase purpose

Phase 5 turns the Software Map into a human-driven visual design and implementation workflow:

```text
understand physical reality
-> design target state
-> express transformations
-> derive bounded work
-> implement through ordinary IDE surfaces
-> re-analyze
-> reconcile intent against reality
```

The phase must remain useful with no model configured.

## Architecture boundary

The forward ontology is:

```text
PlanningMap
-> PlannedTransformation
-> WorkItem
```

Phase 5 does not restore the removed Phase 3 `Plan -> PlanStep -> Task` runtime, reuse `.dope/planning.json`, or add compatibility adapters for historical internal state.

Planning Maps reference canonical/physical identities rather than cloning current architecture. Canvas layout is presentation state. Editing a Planning Map does not mutate canonical architecture; target adoption is explicit.

## Scope boundary

Phase 5 may introduce:
- center-workspace Physical Map and Planning Map visualizations;
- semantic zoom and source navigation;
- project-local Planning Map persistence;
- target transformations and WorkItems;
- target adoption;
- stale-plan detection and explicit rebase;
- deterministic post-implementation reconciliation.

Phase 5 must not introduce:
- general AI Presence or chat;
- Agent Mind;
- ProposedAction;
- model-driven mutation;
- tool authority/delegation;
- Phase 3 Planning compatibility/migration;
- a visualization-owned architecture database.

## Next workflow

```text
/docs-apply
-> /prompt-ass
-> /prompt-plan
-> /prompt-write p5
```

Implementation prompts follow the repository T1/T2/T3 validation discipline. The final qualification gate must prove the complete human-driven visual loop on a mapped Adaptive SEO copy, with Dope as the host/regression/package fixture.

## October 2, 2026 owner closeout

The owner explicitly closed Phase 5 for sequencing after P11 remained Not Green and P12 was not executed.

This disposition preserves all P11 failures/Evidence Gaps and does not reclassify the phase as Qualified/Green. The retained implementation becomes the source for a coherent `0.6.0` successor baseline so Product Phase 6 — Data Flow can begin planning under ADR 0020.

Historical Phase 5 execution prompts remain evidence records; no further P11/P12 run is required for sequencing under this owner waiver.
