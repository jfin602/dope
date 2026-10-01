# Product Phase 5 Prompt Assessment

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `016bd8780e89081dfdb5746eae981183dc945baa`, `0.5.0`
Current planning authority: `docs/planning/p5/phase-5-plan.md`, resolved visual-workflow worksheet, ADR 0017

## Conclusion

Use twelve ordered prompts.

Phase 5 is intentionally a complete **provider-free visual workflow**, not an AI implementation phase. The dependency chain is:

visual-planning domain
-> project-local persistence/service
-> Physical Map canvas
-> semantic navigation/focused tabs
-> Planning Map overlay/lifecycle
-> typed direct editing/undo
-> WorkItems
-> bounded target adoption
-> stale/rebase
-> reconciliation/completion semantics
-> direct GUI/restart/package qualification
-> evidence-only closeout.

| Prompt | Boundary | Validation tier | Routing |
| --- | --- | --- | --- |
| P1 | `@dope/visual-planning` domain contracts/core | T1 | GPT-6 Sol High |
| P2 | `.dope/planning-maps.json` store + typed service/backend | T2 | GPT-6 Sol High |
| P3 | center Physical Map canvas + visual grammar | T1 | GPT-6 Sol High |
| P4 | semantic zoom/focus + focused map tabs/source round-trip | T1 | GPT-6 Sol High |
| P5 | Planning Map overlay/diff + lifecycle/branching | T2 | GPT-6 Sol High |
| P6 | typed direct manipulation + previews + undo/redo | T1 | GPT-6 Sol High |
| P7 | deterministic WorkItem suggestions + work projection | T1 | GPT-6 Sol High |
| P8 | bounded Adopt Target | T2 | GPT-6 Sol High |
| P9 | localized staleness + explicit three-way rebase | T2 | GPT-6 Sol High |
| P10 | transformation reconciliation + explicit Planning Map completion | T2 | GPT-6 Sol High |
| P11 | Adaptive SEO visual workflow; Dope host/regression/package qualification | T3 | GPT-6 Sol High |
| P12 | evidence-only Phase 5 closeout | T3 | GPT-6 Sol Medium |

Versions are exactly `0.5.1` through `0.5.12`.

P1-P10 are runner-owned implementation/integration prompts. P11 is browser/manual qualification and creates the durable direct evidence record. P12 is final evidence-only closeout.

## Current source findings

- Root package is `0.5.0` from the bounded Phase 4 closeout, while apps/internal package manifests intentionally remain at `0.4.6`. P1 must normalize all live workspace package versions/internal references directly to `0.5.1`; do not invent an intermediate `0.5.0` internal-package commit.
- `@dope/software-map` is framework-independent and already owns canonical architecture types, Physical Map snapshots, graph queries, evidence/provenance, hierarchy, relationships and reconciliation of canonical/detected architecture.
- `SoftwareMapConnection` already provides canonical-root/handle isolation and current Physical Map service/query transport. Phase 5 should reuse those contracts rather than creating a second physical-analysis service.
- `software-map-controller.ts` is already large (~41 KB) and owns sMap initialization/provider/review state. Do not add Phase 5 planning state to it. Introduce a dedicated visual-planning frontend controller.
- `software-map-backend.ts` is similarly substantial and includes synthesis/provider concerns. Planning persistence/mutation should live in a separate backend/service seam rather than expanding this class.
- `SoftwareMapReviewWidget` proves custom center-workspace widgets can coexist with ordinary editors. Physical/Planning Map tabs should use focused widget files and stable widget IDs/URIs rather than becoming sidebar content.
- The left `SoftwareMapWidget` remains the inspector/navigation/evidence surface. The center canvas should communicate selection/focus back to it through Dope-owned IDs/events rather than duplicate evidence panes.
- Existing `ProjectMindStore` and Software Map persistence corrections provide prior art for canonical local-root checks, symlink/traversal rejection, versioned readable JSON, revision conflicts, process locks and external recovery.
- Phase 5 planning persistence is new `.dope/planning-maps.json`; historical `.dope/planning.json` remains absent and must not be migrated.
- Browser/Electron apps are already on React `19.2.8`, matching the current Theia 1.75 baseline.
- Use `@xyflow/react` `12.11.6` as the presentation-only canvas substrate. It supplies pan/zoom, selection, custom nodes/edges and keyboard primitives while remaining outside Dope canonical state. Do not persist React Flow node/edge objects.
- Avoid a second layout dependency in this phase. Implement deterministic architecture-first layout in the presentation adapter, with stable ordering and bounded branch layouts. Advanced layout engines can be evaluated later if actual Phase 5 evidence shows a need.
- Existing unit suites already cover Software Map core/backend/UI, theme/placement and restart process scaffolding. Add focused visual-planning domain/storage/UI tests rather than creating a parallel harness.

## Domain and architecture decisions

### One real visual-planning domain

Create `@dope/visual-planning` as a presentation-independent package because the Phase 5 semantics are substantial and durable.

It may depend on `@dope/software-map` contracts/types. It must not import Theia, React, React Flow, provider/model SDKs or browser globals.

Own here:
- PlanningMap / PlannedTransformation / WorkItem;
- lifecycle/branching/conflict semantics;
- target projection helpers;
- deterministic WorkItem suggestion/grouping;
- target-adoption planning/validation;
- staleness/rebase contracts and pure comparison;
- reconciliation/closeout contracts;
- typed service DTOs as appropriate.

Do not move Physical Map evidence or canonical architecture ownership out of `@dope/software-map`.

### Persistence boundary

Use one project-local versioned `.dope/planning-maps.json` document with stable project identity and document revision.

Preserve:
- root containment/symlink safety;
- optimistic revision conflicts;
- cross-process mutation exclusion/recovery;
- corrupt/future schema fail-closed without destroying bytes;
- copy/reopen portability;
- multiple map isolation inside the same project;
- no machine-local state required for semantic truth.

Presentation state such as viewport/node coordinates/open tabs is not canonical planning state. If some presentation state is persisted for UX, keep it in a clearly separate application/workspace preference namespace and prove deleting it does not alter PlanningMap semantics.

### Target and physical bases

PlanningMap stores canonical architecture basis plus Physical Map input/generation basis.

The visual-planning service may obtain current bases from Software Map service/backend adapters, but package/domain tests operate on explicit supplied bases/snapshots.

Do not give the visual-planning package filesystem access to hidden Software Map internals merely for convenience.

### Adoption authority

Adopt Target is the only Phase 5 path that writes canonical architecture.

Do not expose arbitrary architecture mutation through visual gestures.

The adoption backend should reuse/centralize the existing strict architecture parser/write safety rather than introduce a looser second writer.

### Canvas boundary

React Flow is presentation state.

The adapter maps Dope-owned IDs/state into React Flow nodes/edges, and maps supported gestures back into typed visual-planning commands.

Raw React Flow coordinates/objects never enter `.dope/planning-maps.json`, `.dope/architecture.json`, Software Map snapshots or service contracts.

## Applicable risks

- **Second graph truth:** canvas objects becoming an alternate persisted architecture graph.
- **Controller/backend god-object growth:** Phase 5 state leaking into existing sMap controller/backend.
- **Identity loss:** focused tabs or overlay modes cloning nodes rather than referencing stable IDs.
- **Semantic gesture ambiguity:** drag/delete/connect operations mutating state without a typed transformation preview.
- **Lifecycle drift:** completed/archived/superseded maps losing original target history.
- **Cross-map conflicts:** incompatible active maps silently coexisting as if compatible.
- **WorkItem drift:** WorkItems becoming independent TODOs no longer traceable to transformations.
- **Adoption authority:** partial adoption accidentally includes/excludes dependencies or silently rewrites canonical state.
- **Stale basis:** background physical refresh silently rebasing old target intent.
- **Reconciliation falsification:** closeout rewriting the target to match reality instead of retaining divergence.
- **Persistence:** planning truth trapped in Theia storage or corrupt writes damaging project-local state.
- **Async UI:** late project/tab responses rendering into another workspace/map.
- **Performance:** project overview or branch maps rendering every Code node and blocking the workbench.
- **Accessibility/theme:** state encoded only by Dope orange/red or mouse-only interactions.
- **Scope creep:** AI planning/execution, Agent Mind, ProposedAction, delegation, advanced auto-layout, collaboration or Phase 3 compatibility.

## Canvas dependency decision

Use `@xyflow/react@12.11.6` in the Theia presentation package only.

Reasons:
- current apps already provide React/React DOM 19.2.8;
- React Flow supports React >=17 and therefore the current React 19 baseline;
- built-in pan/zoom, selection, keyboard and custom node/edge primitives match the locked worksheet without defining domain semantics;
- it can be isolated behind adapter/widget files so later replacement does not migrate PlanningMap data.

Do not add ELK/Dagre or another layout engine in the initial stack. Use deterministic hierarchy-first positioning adequate for project/System/Subsystem/Component focused views and qualify actual usability before adding layout complexity.

## Stability answers

1. Behavior at risk: sMap initialization/inspection, Project Mind, ordinary IDE tabs/editor behavior, Dope Dark/theme override, restart/package behavior and project-local `.dope/` state.
2. Invariants: physical/canonical/planned truth remains distinct; all visual tabs share identity; planning is provider-free; Phase 3 planning remains absent.
3. Integrated-only evidence: real center canvas behavior, multi-tab shared state, source round-trip, persistence across process/profile restart/copy, bounded adoption writing real canonical architecture, stale/rebase after real physical change, and final reconciliation.
4. Baseline: reachable `016bd8780e89081dfdb5746eae981183dc945baa`, root `0.5.0`, current docs on top.
5. Durable knowledge: Phase 5 authority, prompt assessment/plan, direct GUI evidence and final closeout.
6. UI-state risk: layout/pan/zoom/tab state is disposable presentation state; PlanningMap semantics must recover without it.
7. Provider coupling: none for Phase 5 behavior; inherited sMap synthesis provider code remains unrelated and must not become a planning dependency.

## Deferred

AI-generated plans/WorkItems, Agent Mind, AI implementation calls, mutation authority, delegation, provider routing for planning, automatic architecture adoption, automatic conflict resolution, collaborative planning, cloud synchronization, advanced layout engines, diagram export, multi-user editing and Development Sessions.
