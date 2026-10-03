# Correction 6 Implementation Plan — Edit Architecture

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c6-edit-architecture`
Required unchanged package version: `0.6.7`
Activation/source baseline: `b447d925ee4c12891ff072f235368e7b29a6854d`
Required predecessor: `c6-smap-outline` Green at `ac7fd5a29fb9d6dca4fc2f137f8fdef7f2a20439`
Assessment: `prompt-assessment.md`
Authority: ADR 0024 and current Software Map authority

## Shared invariants

- **Architecture** is the canonical user-facing term for System -> Subsystem -> Component structure/editing.
- Software Map remains the umbrella product; Physical Map / Flow / Planning Map meanings do not change.
- Edit Architecture is a center-workspace editor, not a second canonical store.
- `.dope/architecture.json` plus matching `.dope/smap.json` remain canonical persistence.
- The existing `replaceArchitecture` persistence primitive is reused.
- Accepted edits are draft-first; Save Architecture is the explicit canonical mutation.
- Edit Architecture does not share transient selection/expansion/focus with the left outline or center map.
- The Green `c6-smap-outline` shared outline <-> map selection contract remains unchanged.
- Search Deeper is explicit, branch-local, preview-first and provider-explicit.
- No accepted-map edit/history persistence is added.
- No general AI Presence, Agent Mind, chat, tool authority or delegation.
- Package stays exactly `0.6.7`.

## Preflight for every prompt

Read:
- BOOT.md;
- AGENTS.md;
- ADR 0024;
- PRODUCT-MODEL.md;
- ARCHITECTURE.md;
- docs/workflow.md;
- this correction README, assessment and plan;
- all prior prompt results in this correction;
- `c6-smap-outline` closeout.

Require:
- activation/source baseline reachable;
- current package exactly `0.6.7`;
- `c6-smap-outline` Green behavior present;
- clean intended working tree;
- Node 24;
- no root `package-lock.json`.

Runner-owned implementation prompts must not commit.

## P1 — Lossless canonical Architecture edit service seam — T2

### Goal

Add the smallest provider-independent application/backend contract required to load an initialized canonical Architecture into an editor draft and explicitly replace it safely.

### Domain/editor draft

Reuse the existing review/editor validation machinery where safe.

Create one lossless projection between `ArchitectureDeclaration` and the editor node shape.

Requirements:
- deterministic editor keys for canonical Systems/Subsystems/Components;
- preserve canonical IDs, names, purpose, parentage and roots;
- preserve optional System roots;
- preserve Subsystem `allowedDependencies` and `forbiddenDependencies`;
- round-trip every current Architecture schema field exactly modulo existing canonical sort/format normalization;
- initial synthesis review behavior remains valid.

Preferred direction: evolve `ArchitectureReviewNode` / `reviewDeclaration` into a shared editor-draft contract with optional dependency fields rather than creating a parallel editor model. If a separate type is materially safer, share conversion/validation helpers so the UI does not fork.

Extend deterministic diagnostics so dependency constraints that become invalid after ID/remove edits surface as blockers rather than disappearing.

### Service contract

Add a narrow initialized-Architecture API under `SoftwareMapService`, conceptually:

- read current canonical architecture + expected fingerprint;
- save a validated replacement against expected fingerprint.

Exact DTO/function names are implementation-owned.

Read:
- requires a valid attached project handle;
- requires initialized Software Map;
- returns a clone of the canonical declaration and current declaration fingerprint.

Save:
- requires initialized Software Map;
- requires expected fingerprint;
- validates the declaration/draft through existing canonical parser;
- uses `replaceArchitecture`; do not write files directly;
- uses no-op companion rollback semantics because direct editor save does not mutate Planning state;
- does not clear/rewrite Planning Maps;
- after canonical commit invokes ordinary `SoftwareMapIndex.analyze(root)`;
- returns enough status/fingerprint information for UI to know the canonical save succeeded even if subsequent analysis status is failed.

Do not add a new architecture revision file/schema.

### Concurrency and isolation

Prove:
- stale expected fingerprint rejects without changing architecture or marker;
- wrong/detached project handle rejects;
- malformed/invalid draft rejects before canonical write;
- successful save updates architecture + marker fingerprint coherently;
- external canonical change cannot be overwritten;
- save never writes `.dope/smap-analysis.json`;
- project B cannot use project A edit basis.

### Planning boundary

Direct Edit Architecture save must not call PlanningStore/adoption APIs.

Existing Planning Maps become semantically stale through their stored architecture fingerprint when canonical Architecture changes. If `replaceArchitecture` implementation itself must change, preserve Visual Planning adoption transaction/rollback behavior and run its focused regression; otherwise leave it untouched.

### Focused tests

Add/extend tests around:
- canonical declaration -> editor draft -> declaration lossless round-trip including dependency constraints;
- save success/fingerprint/marker;
- stale save;
- invalid dependency target after edit;
- handle/project isolation;
- post-save re-analysis publication;
- analysis failure after save reported truthfully without rolling back an already committed canonical save.

### Validation

T2.

Run only the affected focused tests plus:
- affected package builds for `@dope/software-map`, `@dope/code-analysis` if touched, and `@dope/theia-extension`;
- focused Visual Planning adoption/storage test only if shared `replaceArchitecture` code changes;
- `git diff --check`;
- exact `0.6.7` / no-root-lock checks.

No browser/manual/provider/package qualification.

## P2 — Permanent Edit Architecture workspace — T2

### Goal

Evolve the current one-time Architecture Review widget/controller into permanent **Edit Architecture** while preserving initial review acceptance.

### Widget identity and terminology

The center tab title/caption is **Edit Architecture**.

Remove live product labels such as:
- sMap Architecture Review;
- Proposed hierarchy;
- Edit Hierarchy / Save Hierarchy if any.

Technical `hierarchy` wording may remain in code/tests/docs when it describes tree structure.

A clean internal rename from `SoftwareMapReviewWidget` / review-only widget ID is allowed if no concrete persistence/external compatibility dependency exists. Do not add a compatibility shim solely for the old pre-stability widget identity.

### Two editor modes, one surface

Support:

1. **Pending proposal mode**
   - existing `review_required` draft/evidence;
   - existing editable architecture controls;
   - explicit Accept Architecture;
   - Decline review;
   - existing persisted review work under ADR 0018.

2. **Accepted Architecture mode**
   - entered only from initialized Software Map;
   - load canonical declaration/fingerprint through P1 service seam;
   - create independent in-memory editor draft;
   - explicit Save Architecture;
   - explicit discard/reload/cancel behavior;
   - no write as fields change;
   - no `.dope/smap-analysis.json` persistence.

Do not make accepted editing another onboarding `flow` state if that obscures initialization state. Keep a distinct editor basis/mode.

### Left action

Extend the Green c6-smap-outline initialized compact action group:

`Open Physical Map | Refresh Software Map | Edit Architecture`

Activation:
- opens or focuses one center Edit Architecture widget;
- repeated activation must not create duplicates;
- uses the currently attached single project;
- workspace switch clears/supersedes accepted-edit requests/draft state rather than carrying it into another project.

### Editor-local state

The editor owns its own:
- selected boundary;
- disclosure/expansion state if present;
- scroll/focus;
- dirty draft;
- save status/error.

Do not read/write `SoftwareMapController.selectedId` for Edit Architecture selection.

Map or left-outline selection notifications may cause a render, but must not replace the editor's selected boundary or expansion state.

### Editing controls

Preserve current controls:
- name;
- purpose/responsibility;
- parent/reparent;
- canonical ID;
- implementation roots;
- Add System/Subsystem/Component;
- Remove branch;
- deterministic validation blockers.

For Subsystems carrying dependency constraints, expose them in an Advanced section or otherwise provide a usable way to preserve/fix them; do not create a Save blocker the user cannot edit.

Initial proposal evidence/confidence/document sections remain proposal-only. Accepted canonical mode must not invent synthesis confidence/rationale for developer-owned architecture.

### Save semantics

Save Architecture:
- disabled while deterministic blockers exist;
- sends current expected canonical fingerprint + full draft projection;
- on success refreshes the editor baseline/fingerprint from the saved canonical state;
- reports subsequent Software Map analysis status separately;
- does not silently close the editor unless current UX makes that clearly preferable;
- never claims save failed merely because deterministic re-analysis returned failed after commit.

### Tests

Add focused UI/controller regressions for:
- initialized left action includes Edit Architecture;
- one widget instance/focus behavior;
- initial review still opens same editor and Accept Architecture works;
- accepted mode loads canonical draft;
- dependency fields survive;
- draft edits do not call save;
- Save calls expected fingerprint/declaration;
- map/outline `selectedId` changes do not change editor selection;
- workspace switch supersedes accepted load/save and clears local draft;
- live labels use Architecture terminology;
- no accepted edit state is persisted.

### Validation

T2.

Run:
- focused Software Map UI/controller tests;
- c6-smap-outline regression;
- any new Edit Architecture tests;
- `npm run build:browser` (already includes the extension build);
- `git diff --check`;
- exact `0.6.7` / no-root-lock checks.

No real provider and no broad T3 gate.

## P3 — Accepted-map Search Deeper integration — T2

### Goal

Make Search Deeper work from an accepted Architecture draft without reviving review-only state or general AI Presence.

### Refinement contract

Reuse the current targeted refinement planner/parser.

Generalize the basis cleanly so targeted refinement can run from either:
- pending review basis;
- accepted canonical Architecture basis.

Do not duplicate the targeted refinement algorithm.

Accepted basis must carry:
- expected canonical architecture fingerprint;
- target System/Subsystem;
- parent context where applicable;
- current edited branch;
- branch fingerprint;
- fresh deterministic evidence packet identity for that explicit request.

Do not pretend the accepted editor has a `reviewId`.

### Deterministic evidence

For accepted Search Deeper:
- collect a fresh `ArchitectureEvidencePacket` at call start;
- pin it for that one provider request;
- use current edited branch roots/context to select bounded evidence through the existing refinement planner;
- preserve provenance/evidence refs;
- do not persist the packet as accepted-map review work;
- do not rewrite canonical Architecture.

Recheck canonical architecture fingerprint before returning/publishing the result. If the canonical basis changed while the provider ran, reject the result.

The frontend/controller must also reject a result when the edited target branch fingerprint changed while the call ran.

### Provider readiness UX

Search Deeper must not silently fail because initialized mode hides synthesis setup.

From Edit Architecture, provide a bounded provider readiness affordance that reuses existing Local/Gemini configuration/discovery/probe/model state.

Requirements:
- provider selection is explicit;
- no silent fallback to another provider;
- no project evidence is sent before existing readiness/probe/warm-up rules are satisfied;
- ordinary manual editing remains provider-free;
- this is refinement setup, not Phase 7 chat/Agent Mind.

Avoid duplicating the entire onboarding sidebar when a compact reusable provider control/state extraction is sufficient.

### Preview semantics

For accepted mode:
- Search Deeper only on System/Subsystem;
- preview clearly states current draft unchanged;
- preview evidence/source navigation works from the request packet;
- Accept Refinement changes only editor draft;
- Reject changes nothing;
- unrelated branches/manual edits preserved;
- dependency constraints outside replaced branch preserved;
- canonical file/marker unchanged until Save Architecture;
- Save after accepted refinement uses P1 canonical save path.

### Async/project guards

Prove late provider result cannot publish after:
- workspace switch;
- editor reload/discard;
- canonical basis change;
- target branch edit;
- a newer refinement request.

### Tests

Use fake provider and deterministic fixture evidence. Cover:
- accepted System refinement;
- accepted Subsystem split/refinement;
- branch edits preserved outside target;
- stale branch rejection;
- stale canonical basis rejection;
- provider not ready / explicit setup;
- no fallback;
- Accept Refinement draft-only;
- no `.dope/smap-analysis.json` creation;
- initial pending-review Search Deeper still works.

### Validation

T2.

Run:
- targeted refinement unit tests;
- Software Map initialization/backend tests affected by the new canonical refinement method;
- accepted editor/controller/widget tests;
- `npm run build:browser` (already includes the extension build);
- `git diff --check`;
- exact `0.6.7` / no-root-lock checks.

No real provider request in P3.

## P4 — Exact-candidate browser qualification and correction closeout — T3

### Goal

Qualify the exact `0.6.7` Edit Architecture correction in the real Dope GUI and close the bounded correction Green or Not Green.

P4 is evidence/closeout work. Do not redesign domain behavior here.

### Candidate/workspace

Require P1-P3 focused evidence Green and exact package `0.6.7`.

Use a fresh disposable copy of:

`/home/jfin/dev/adaptive-seo-dope`

Preserve the source reference. Record source/candidate Git identities and relevant `.dope/` inventory/hashes.

Do not regenerate the accepted Architecture merely to test editing.

### Automated T3 gate

Run once on exact candidate:
- `npm run check`;
- any correction-focused test not already included in the aggregate command;
- `git diff --check`;
- exact package/internal reference coherence;
- no-root-lock check;
- `npm run codex:phase:validate -- c6-edit-architecture` if current validator supports unchanged-version correction stacks.

Do not run AppImage/package shutdown qualification solely for this correction; retain that separate Phase 6 P7 blocker.

### Direct GUI matrix

1. **Entry and terminology**
   - initialized left action group shows Open / Refresh / Edit Architecture;
   - no live Edit Hierarchy product label;
   - clicking Edit Architecture opens/focuses one center tab;
   - repeated clicks do not duplicate the tab.

2. **Accepted canonical load**
   - editor shows the accepted Systems/Subsystems/Components;
   - representative canonical IDs/roots/purposes match `.dope/architecture.json`;
   - any existing dependency constraints remain represented/preserved.

3. **Independent editor state**
   - select/expand a branch in Edit Architecture;
   - select/focus a different architecture identity in Physical Map or left outline;
   - return to Edit Architecture and confirm its selected/expanded branch did not synchronize away;
   - editor actions likewise do not move map/outline selection.

4. **Draft-only edits**
   - edit a safe field such as purpose in the disposable project;
   - before Save, verify canonical architecture bytes/fingerprint remain unchanged;
   - cancel/reload once and prove unsaved accepted edits are not canonical/durable.

5. **Save Architecture**
   - make the edit again and Save Architecture;
   - verify `.dope/architecture.json` and matching marker fingerprint change only at Save;
   - stable IDs remain stable for a purpose-only edit;
   - Software Map runs ordinary deterministic re-analysis and publishes the new basis/status;
   - restart/reopen Edit Architecture and confirm the saved canonical value is loaded;
   - no accepted edit draft/history file was created.

6. **Validation/blocker UX**
   - create one temporary invalid draft condition in the editor;
   - Save is blocked with deterministic diagnostics;
   - repair it and restore valid draft without canonical write.

7. **Accepted-map Search Deeper**
   - explicitly select/configure/test one available existing synthesis provider;
   - run Search Deeper on a representative accepted System or Subsystem;
   - inspect preview and evidence/source association;
   - verify canonical architecture is unchanged;
   - Accept Refinement and verify only the editor draft changes;
   - canonical architecture remains unchanged until explicit Save;
   - Save or discard the refined draft in the disposable workspace and record the outcome.

A real provider-backed accepted-map Search Deeper call is required for full Green. If no provider can be made ready, record an Evidence Gap / Not Green for that capability rather than claiming it from fake-provider tests.

8. **Review-mode regression**
   - rely on focused automated pending-review tests for the expensive synthesis path;
   - if an already-available controlled review_required fixture/state exists, open it and confirm the tab is titled Edit Architecture and still exposes Accept Architecture;
   - do not run a whole new large-project synthesis solely to decorate this correction evidence.

9. **Project/restart isolation**
   - switch/reopen project after accepted editing and verify no stale draft/refinement result appears in another workspace;
   - no `.dope/smap-analysis.json` is created solely by accepted editing/Search Deeper.

### Tiny-fix allowance

One bounded directly observed presentation-only repair is allowed for:
- label wording;
- spacing;
- disabled/dirty indicator;
- focus restoration;
- compact provider readiness wording.

After it, update a focused regression and rerun only invalidated evidence.

Do not use this allowance for:
- canonical persistence/service redesign;
- targeted refinement contract redesign;
- provider fallback;
- Flow/Planning semantics;
- accepted-edit persistence/history.

### Closeout

Write:
`docs/tasks/c6-edit-architecture/closeout.md`

Update:
`docs/tasks/c6-edit-architecture/README.md`

Record:
- activation/source baseline;
- exact P1-P3 candidate commits/results;
- exact final candidate SHA;
- automated gate;
- GUI matrix;
- live provider/refinement evidence;
- residual gaps;
- Green / Not Green decision.

If Green, route back to fresh Phase 6 P7 requalification. P8 remains blocked until P7 is Green.

If Not Green, keep P7/P8 blocked and identify the narrow failed Edit Architecture contract.

## Expected production shape

```text
Software Map left inspector
  compact Architecture outline
  Open | Refresh | Edit Architecture

Edit Architecture center workspace
  pending proposal mode
    persisted review draft
    evidence + Search Deeper
    Accept Architecture
  accepted canonical mode
    in-memory canonical draft
    explicit provider-backed Search Deeper
    Save Architecture

SoftwareMapService / backend
  read canonical Architecture + fingerprint
  stale-guarded replace Architecture
  deterministic re-analysis
  targeted refinement over review or accepted basis

.do​pe/
  architecture.json    canonical
  smap.json            matching marker
  smap-analysis.json   initial unaccepted review only
```

No second Architecture store, no accepted draft/history persistence, no map/editor selection synchronization and no general AI Presence.
