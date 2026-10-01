# Product Phase 5 Implementation Plan

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `016bd8780e89081dfdb5746eae981183dc945baa`, root `0.5.0`
Authority: Phase 5 activation/plan, resolved visual-workflow worksheet, ADR 0017, PRODUCT-MODEL, ARCHITECTURE, stability contract

## Preflight for every prompt

Read BOOT, AGENTS, current Phase 5 authority, ADR 0017, PRODUCT-MODEL, ARCHITECTURE, roadmap, workflow/stability authority, this assessment/plan and all prior `p5` source/evidence.

Require:
- reachable Phase 5 activation transition `016bd8780e89081dfdb5746eae981183dc945baa`;
- coherent expected predecessor root version;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly `1.75.0`, Electron `42.8.1`, browser/Electron React `19.2.8`.

The root-only `0.5.0` closeout intentionally left workspace packages at `0.4.6`. P1 normalizes all live package/app versions and internal references directly to `0.5.1`.

P1-P10 are runner-owned and do not commit. P11 is direct GUI/T3 qualification and browser-required. P12 is evidence-only closeout.

No prompt may add Phase 3 Planning compatibility or general AI Presence/Agent Mind/delegation.

## P1 — visual-planning domain core (`0.5.1`) — T1

Create `packages/visual-planning` / `@dope/visual-planning`.

Framework-independent contracts:
- PlanningMap with stable ID/project identity/title/objective/status/revision/history and canonical/physical basis;
- lifecycle `draft | active | completed | superseded | archived`;
- PlannedTransformation kinds `add | modify | remove | move | split | merge | redirect-relationship | change-contract`;
- target references/new intended architecture identities;
- WorkItem contracts with transformation refs/dependencies/requirements/constraints/acceptance criteria/validation targets/working-set/status/completion notes;
- cross-map conflict descriptors;
- staleness/rebase/reconciliation result contracts.

Pure deterministic helpers:
- strict parsing/validation;
- transformation dependency validation;
- target projection from canonical structure + transformations;
- lifecycle rules/explicit branching;
- overlapping-active-map conflict detection;
- deterministic WorkItem grouping suggestions from transformations;
- closeout eligibility requiring every transformation resolved/deferred/abandoned/accepted outcome.

No filesystem/UI/provider code.

Normalize all workspace/app package versions/internal references to `0.5.1` and add the real package to build/typecheck/test composition.

Focused tests: `visual-planning.test.ts`.

## P2 — planning persistence and service/backend (`0.5.2`) — T2

Add Node store in the visual-planning boundary for `.dope/planning-maps.json`.

Strict project-local storage:
- versioned schema;
- stable project identity;
- document revision;
- atomic writes;
- cross-process mutation lock/recovery;
- symlink/traversal containment;
- corrupt/future fail-closed;
- project isolation;
- copy/reopen portability;
- no migration from historical `.dope/planning.json`.

Add provider-independent `VisualPlanningService` contracts and a separate Theia backend connection:
- attach project;
- read/list/create/duplicate/transition maps;
- mutate transformations and WorkItems with expected revision;
- query conflicts/basis status;
- no React/Theia types in domain contracts.

Bind via `backend-module.ts`; do not enlarge `SoftwareMapConnection` with planning state.

Tests: storage/service/backend isolation, revision/lock/recovery/copy/corrupt/future cases.

## P3 — center Physical Map canvas foundation (`0.5.3`) — T1

Add `@xyflow/react@12.11.6` only to the presentation boundary and configure the extension for compatible React rendering without changing Theia/React baselines.

Create focused canvas projection/widget/controller files rather than growing sMap sidebar/controller.

Physical Map center tab:
- default Systems + immediate Subsystems;
- one-System project uses System as frame;
- deterministic architecture-first positions/order;
- containment/dependency visually distinct;
- hierarchy/state through shape/icon/border/line semantics first, color only reinforcement;
- semantic theme tokens; alternate theme safe;
- no Components/Code by default;
- Fit Architecture;
- read-only physical truth.

Canvas model adapter is pure enough to unit test and never persists React Flow node/edge objects.

Register real center widget/command from existing sMap navigation without moving the left inspector.

## P4 — semantic navigation and focused map tabs (`0.5.4`) — T1

Implement:
- geometric pan/zoom plus explicit Focus / Up / Fit Architecture;
- semantic detail System -> Subsystem -> Component -> Code;
- stable selection/identity across levels;
- simplified cross-boundary dependency context;
- source navigation and return preserving map context;
- separate focused center tabs for System/Subsystem/Component/supported branches;
- multiple focused tabs sharing one underlying state/controller rather than cloned graph data;
- stale workspace/tab request guards.

Presentation restore may keep last valid focus/viewport as disposable app/workspace state, but deleting it must not change semantics.

Tests for tab identity, focus breadcrumbs, source round-trip intent and project switch safety.

## P5 — Planning Map overlay, lifecycle and branching (`0.5.5`) — T2

Add Planning Map center tab connected to VisualPlanningService.

Primary visual mode:
- overlay/diff on referenced physical/canonical state;
- Current only / Target only / Diff;
- side-by-side may be secondary but is not required for Green;
- visually distinct planned/add/remove/move/modify/relationship state using non-color cues.

UX:
- create/select Planning Maps;
- Draft -> Active -> Completed/Superseded/Archived controls subject to domain rules;
- duplicate/branch alternative map;
- multiple active maps;
- explicit overlapping-map conflicts;
- completed/superseded hidden from normal active list by default;
- focused map tabs are projections, never implicit branches.

No direct canvas mutation yet beyond map lifecycle/selection.

## P6 — typed transformation editing and undo/redo (`0.5.6`) — T1

Implement Planning Map semantic editing:
- add target architecture node -> preview `add`;
- drag/reparent supported boundary -> preview `move`;
- remove from target -> preview `remove` without deleting physical truth;
- draw/redirect supported dependency -> preview relationship transformation;
- explicit focused editors/commands for modify/split/merge/change-contract.

Every gesture produces a typed preview before durable commit.

Add domain-level undo/redo for unadopted PlanningMap transformation edits. Undo/redo changes semantic planning state/revision, not just React Flow coordinates.

Reject ambiguous/invalid gestures and stale expected revisions.

## P7 — WorkItems and work projection (`0.5.7`) — T1

Implement deterministic graph-derived WorkItem suggestions using P1 helper:
- suggestions require explicit developer acceptance;
- accept/edit/split/merge;
- one transformation -> many WorkItems;
- one coherent WorkItem -> many transformations;
- dependency/parallelism representation.

Add dedicated work projection/panel in center Planning Map experience, not architecture-node clutter.

Bidirectional selection:
- WorkItem highlights affected architecture/transformations;
- transformation shows associated WorkItems.

Support objective, requirements, constraints, acceptance criteria, validation targets, working-set references and status/completion notes.

No AI generation/execution.

## P8 — bounded Adopt Target (`0.5.8`) — T2

Implement explicit target adoption.

Support coherent:
- System branch;
- Subsystem branch;
- Component branch;
- selected compatible transformation set.

Before adoption:
- compute canonical architecture diff;
- include deterministic required dependent changes when safe;
- otherwise block with explicit dependency/conflict reasons;
- validate resulting declaration through the canonical strict architecture parser.

Centralize/reuse safe canonical architecture write logic; do not create a weaker writer.

After partial adoption:
- update planning basis/revision correctly;
- mark adopted target distinctly from still-planned target;
- do not complete WorkItems or create Physical Map evidence.

Tests include before/during/after implementation-compatible adoption semantics and failure atomicity.

## P9 — localized staleness and explicit rebase (`0.5.9`) — T2

Compare stored PlanningMap bases against current canonical architecture and Physical Map input/generation.

Track stale state:
- map-wide summary;
- affected architecture branch;
- individual transformation.

Unrelated physical change may refresh context without making unrelated transformations stale.

Implement explicit three-way rebase model/UI:
old basis -> current reality -> target intent.

Within explicit rebase:
- auto-advance only unaffected references;
- require developer decision for conflicts;
- identify removed/replaced targets, hierarchy/identity/contract/relationship changes;
- recognize already-realized transformations;
- show differently realized implementation as divergence;
- allow deliberate continuation against old basis with visible stale state.

No background/silent rebase.

## P10 — reconciliation and Planning Map completion (`0.5.10`) — T2

After explicit fresh Software Map reanalysis, reconcile each transformation against current Physical Map/canonical state.

Outcomes:
- implemented as planned;
- implemented differently;
- not implemented;
- unexpected implementation.

Roll up to WorkItems, branches and map without rewriting original target.

Allow `implemented differently` to be explicitly accepted.

PlanningMap -> completed only through explicit developer closeout where every transformation is:
- resolved as planned;
- accepted intentionally different;
- deferred into another Planning Map;
- explicitly abandoned.

Preserve original target and final realized outcome as durable history.

Add integrated tests proving WorkItem completion alone cannot close/reconcile a map.

## P11 interruption gate — `c5-smap-acceptance-debug-loop`

P11 is paused at `0.5.11` because the Adaptive SEO prerequisite sMap reached review but cannot pass the real acceptance path.

Before rerunning P11:
1. close `c5-smap-acceptance-debug-loop`, which installs only durable review/debug machinery;
2. run the actual acceptance-debug loop separately against the preserved Adaptive SEO review until deterministic blockers are cleared and real acceptance succeeds;
3. then resume this P11 qualification.

The correction must not be counted as P11 qualification and must not advance to `0.5.12`.

## P11 — direct visual workflow qualification (`0.5.11`) — T3 / browser required

Use `/tmp/adaptive-seo-dope-p11` as the primary mapped workspace in the actual Theia GUI. It must be a disposable copy of the accepted `/home/jfin/dev/adaptive-seo-dope`, including `.dope/`. Require a usable canonical/Physical Map in this exact `/tmp` workspace before the direct loop. Keep `/home/jfin/dev/adaptive-seo-dope` unchanged as the accepted reference. Use the Dope repository for host/IDE/Project Mind/sMap regression and exact-candidate builds, package and native launch; Dope's own canonical map need not qualify the visual loop.

Qualify:
- Physical Map overview Systems + immediate Subsystems;
- visual grammar under Dope Dark and one alternate supported theme;
- Focus / Up / Fit, semantic zoom, focused System/Subsystem/Component tabs and source round-trip;
- create/branch multiple Planning Maps;
- Current/Target/Diff overlay;
- direct typed add/move/remove/relationship editing and preview/undo;
- WorkItem suggestion/accept/split/merge/dependency/highlighting;
- bounded partial Adopt Target with canonical diff;
- restart/reopen recovery and separate-profile recovery;
- copy project to another root and recover planning semantics;
- second-project isolation;
- induce physical/canonical change, observe localized stale state, run explicit three-way rebase;
- implement a small controlled real change through ordinary IDE/editor/terminal/test surfaces;
- reanalyze and reconcile;
- explicit PlanningMap closeout;
- corrupt/future planning store fail-closed without byte loss;
- applicable aggregate `npm run check`, restart test, browser/Electron builds, AppImage/package/native launch for exact candidate.

Create `docs/tasks/p5/P11-visual-planning-dogfooding-evidence.md`.

Direct GUI interaction is required; headless/CDP may supplement but not replace it.

## P12 — Phase 5 closeout (`0.5.12`) — T3 evidence-only

Read exact P1-P11 commits/results and P11 evidence.

Advance coherent workspace/app versions/internal refs from `0.5.11` to `0.5.12`.

Audit Green / Not Green / Evidence Gap for:
A. domain/state truth;
B. persistence/service safety;
C. Physical Map visual grammar/navigation;
D. Planning Map overlay/editing/multiple maps;
E. WorkItems;
F. adoption;
G. stale/rebase;
H. reconciliation/closeout;
I. restart/copy/project isolation;
J. direct Adaptive SEO visual-loop GUI qualification plus Dope host/regression/package/native qualification;
K. preserved Phase 4/Project Mind/IDE behavior and no Phase 6 scope leakage.

Do not repair failures.

Create `docs/tasks/p5/closeout.md`, update README status, and route Green to Phase 6 `/docs-review` without creating Phase 6 prompts.

## Validation discipline

P1-P10 use the smallest validation surface that can prove the change:
- new/changed focused test files;
- directly affected existing regression tests only when their contracts/code changed;
- the smallest workspace build needed to compile changed production code;
- cheap package/version/no-root-lock coherence;
- `git diff --check`.

Do not run root `npm run typecheck` merely for reassurance; it rebuilds multiple packages. Do not run `npm run test:product`, `npm test`, `npm run check`, browser/Electron application builds, restart tests, packaging or native launch in P1-P10 unless a prompt explicitly identifies a newly discovered failure that cannot be proven otherwise.

T2 means **bounded cross-boundary tests**, not an aggregate suite by default.

Concentrate full product/restart/browser/Electron/package/native/direct-GUI evidence in P11, then reuse that exact evidence in P12.

Run `npm run codex:phase:validate -- p5` once before stack execution and only rerun it if the prompt files themselves are modified. Implementation prompts do not rerun prompt grammar validation.

## Expected production shape after P10

```text
@dope/software-map
  canonical architecture + Physical Map/evidence/query/reanalysis

@dope/visual-planning
  PlanningMap/Transformation/WorkItem domain
  target projection/conflicts/staleness/rebase/reconciliation
  project-local planning store + service contracts

@dope/theia-extension
  left sMap inspector (existing)
  center Physical Map canvas
  center Planning Map canvas/work projection
  visual-planning frontend controller
  visual-planning backend connection
  React Flow adapter only in presentation
```

No Agent Runtime, no model-required planning, no AI mutation.
