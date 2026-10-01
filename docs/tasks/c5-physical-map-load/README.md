# Correction 5 — Physical Map Load

Status: **APPROVED / ONE-OFF IMPLEMENTATION**
Required unchanged version: `0.5.11`
Activation source: `9dbde23fa37f59aa3f01c342bfae9f4d0e6cea59`
Phase context: Product Phase 5 P11 paused / Not Green
Qualification owner: P11, not this correction

## Purpose

Repair the center Physical Map load path after accepted Adaptive SEO architecture successfully loads in the sMap inspector but the center canvas remains at **Loading Physical Map...**.

This is a one-off implementation correction. It is not a runner stack and has no separate closeout prompt. P11 is rerun immediately afterward as qualification.

## Observed evidence

On the latest accepted Adaptive SEO P11 rerun:
- the sMap inspector refreshed to a ready/partial generation and displayed accepted Systems/Subsystems;
- **Open Physical Map** opened the center tab but it never rendered architecture;
- a clean browser origin reproduced the loader;
- the console reported `Another channel with the id '/services/dope/software-map' is already open.`;
- current `frontend-module.ts` binds one singleton Software Map proxy for the inspector, but the Physical Map widget factory also creates a new proxy for the same service path;
- `PhysicalMapController.refresh()` then calls `service.attach(workspace)` again before fetching relationships.

This is the leading hypothesis and must be proved before repair.

## Required repair

Prefer one Software Map connection/attach owner.

The center Physical Map should project the existing `SoftwareMapController` published state and use a narrow query seam on that controller for relationship data. It should not independently create/attach another Software Map service channel merely to render the same project's graph.

Preserve:
- generation and project-switch stale guards;
- read-only Physical Map truth;
- focused System/Subsystem/Component tabs sharing the same underlying state;
- relationship scope/kind semantics;
- source navigation;
- Fit/Focus/Up behavior;
- Planning Map consumption of Physical Map state.

Add a permanent regression proving a ready accepted map opens the center canvas, exits loading, and produces a non-empty projection without a second service attach/channel.

## Qualification assertion repairs

The same one-off also corrects two already-proved stale tests:

1. `test/unit/pre-phase4-clean-baseline.test.ts`
   - keep the negative guard against removed Phase 3 Planning contracts/packages/storage;
   - stop treating valid Phase 5 `planning-map-*` filenames as resurrection of the removed Phase 3 subsystem.

2. `test/integration/restart.test.mjs`
   - initial default theme assertion must reflect qualified `dope-dark`;
   - preserve explicit light override, restart persistence and invalid-theme/fallback coverage.

These are test-contract updates, not permission to weaken behavior.

## Scope guard

Do not:
- modify or regenerate Adaptive SEO architecture/sMap state;
- touch `/home/jfin/dev/adaptive-seo-dope`;
- change synthesis/provider behavior;
- reopen or repair `c5-synth-observe`;
- redesign Physical/Planning Map semantics;
- add a second graph truth or second Software Map lifecycle;
- run the full P11 qualification inside this correction;
- change package version.

## Implementation validation

Focused implementation evidence only:
- Physical Map canvas/navigation focused tests including the new no-second-attach regression;
- Phase 3 clean-baseline guard;
- affected extension/browser build;
- Electron build as prerequisite for restart coverage;
- restart integration suite;
- `git diff --check`;
- exact `0.5.11` / no-root-lock checks.

Do not use `npm run check`, AppImage/native packaging or the full browser A-I matrix as implementation validation. P11 owns those T3 gates.

## Exit routing

If focused implementation validation is Green:

`c5-physical-map-load implementation -> rerun P11 on /tmp/adaptive-seo-dope-p11 -> P12 only if P11 Green`.

If the leading duplicate-channel hypothesis is disproved, repair only the actual traced center-load defect within this same boundary and record the evidence in the implementation response.
