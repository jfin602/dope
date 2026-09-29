# Product Phase 3 — Planning Plan

Status: APPROVED / OWNER ACTIVATED
Date: September 28, 2026
Execution folder: `p3`
Package baseline: `0.3.0`
Theia `1.75.0`, Electron `42.8.1`, Node 24, Linux AppImage

## Approval and prerequisite

Phase 2 P6 remains **Not Qualified**. After reviewing that audit, the owner explicitly accepted the unresolved evidence gaps for sequencing, closed Phase 2, and approved Phase 3 from baseline `0.3.0`. This is not retroactive Green evidence.

Preserve the Phase 2 gaps recorded in `docs/tasks/p2/closeout.md` and the inherited Phase 1 closeout. Phase 3 may proceed without repairing them unless a Phase 3 change directly touches the same behavior.

The exact committed activation source is recorded in `activation.md`.

## Objective and exit

Make planning and implementation one durable developer-controlled project workflow without requiring an LLM.

Phase 3 is the Planning Foundation. It deliberately does not implement the Physical Software Model or visual planning; those now follow as Product Phases 4 and 5 so this active stack stays bounded.

Using the real Dope repository, the developer must be able to move from genuine Project Mind knowledge/Decision -> Plan -> ordered PlanSteps -> Tasks -> ordinary coding, update the live plan deliberately, restart/reopen, and recover the same planning state and history.

Use a second unrelated local project to demonstrate isolation. Automated/unit/process evidence supplements but does not replace the direct GUI dogfood gate.

## Existing source to preserve

Phase 2 provides:
- `@dope/contracts` Project Mind DTOs and typed service contracts;
- framework-independent `@dope/project-intelligence`;
- readable `.dope/project-mind.json`, project UUID and document revision;
- exclusive filesystem mutation lock, atomic replacement and stale-revision checks;
- project-bound backend handles;
- Project Mind controller protections for dirty drafts, late responses/events and explicit conflict recovery;
- a real Project Mind widget;
- BUILD/PLAN WorkspaceMode as presentation state.

The current Planning surface is still a Foundation Spike `DopeSpikeWidget` placeholder registered through `PlanningView` and `PLANNING_ID`. Replace it with production Planning. Do not make the existing `dope-workbench.ts` monolith materially larger when focused Planning controller/widget files are clearer.

Theia 1.75.0 and Electron 42.8.1 remain pinned. Preserve ordinary IDE workflows, Project Mind behavior, dark-first default with persistent explicit light override, packaging and runner semantics.

## Planning domain contract

Use framework-independent contracts for Plan, PlanStep, Task, planning document, operations, results/events and service transport.

### Plan

Required fields:
- schema version owned by Planning;
- stable UUID `id`;
- `title`, `objective`, `context`;
- status `draft | active | completed | superseded`;
- ordered `steps`;
- positive integer `revision`;
- developer provenance;
- created/updated ISO UTC timestamps;
- links to Project Mind artifacts and project-relative files.

Initial transitions:
- draft -> active or superseded;
- active -> completed or superseded;
- completed -> active by explicit reopen;
- superseded is historical/terminal for Phase 3.

### PlanStep

Required fields:
- stable UUID `id`;
- `title`, `body`;
- status `pending | active | blocked | complete | skipped | superseded`;
- optional `blockedReason`;
- created/updated timestamps.

Array position inside the Plan is canonical order. Reordering is an explicit mutation. Blocking requires a non-empty visible reason. Reopen/unblock/status changes are explicit. Do not impose a single-active-step scheduler.

### Task

Required fields:
- stable UUID `id`;
- parent `planId` and `stepId`;
- `title`, `objective`;
- `requirements[]`, `constraints[]`;
- status `pending | active | blocked | complete | cancelled`;
- Project Mind artifact links;
- project-relative working-set file links with optional one-based line;
- optional completion notes and developer-entered validation notes;
- created/updated timestamps.

Tasks are developer-owned in this phase. Do not add AI ownership, delegation or ProposedAction fields merely for future compatibility.

Task completion does not certify tests or create a future Validation artifact.

### Links

Planning owns one-way references to:
- an existing Project Mind artifact UUID in the same project; or
- a normalized project-relative file with optional positive line.

Validate new artifact links against the current Project Mind snapshot at the backend boundary. Archived artifacts remain valid targets. Missing referenced files remain visible unavailable references. Reject absolute, traversal, remote and symlink-escape file targets.

Do not mutate Project Mind merely to create a reverse Planning link. The UI may derive related Plans by querying Planning links.

### History and revision

The Planning document has a monotonic document `revision` for optimistic concurrency.

Each Plan has a positive human-visible `revision`. A successful mutation affecting a Plan, its steps or tasks increments that Plan revision and appends one concise immutable history entry containing:
- stable history entry UUID;
- timestamp;
- actor `developer`;
- plan revision;
- operation kind;
- affected Plan/Step/Task IDs where applicable;
- concise summary generated from the typed operation, not arbitrary model narration.

Explicit Save records one accepted edit; do not record keystrokes. History is not a general event store and is not used to reconstruct current state.

## Persistence and project identity

Persist one readable `.dope/planning.json` per local project.

The document contains at least:
- `schemaVersion: 1`;
- existing Project Mind `projectId`;
- monotonic document `revision`;
- `plans`;
- `tasks`;
- `history`.

Planning does **not** allocate a second project identity. On attachment, the backend resolves the canonical local root and reads Project Mind. If Project Mind has no canonical snapshot/projectId yet, Planning is unavailable for canonical writes and the UI must explain that Project Mind must first establish identity. Do not silently create an empty Project Mind store because doing so could change legacy migration behavior.

If Planning state exists, its `projectId` must equal Project Mind. A mismatch is a visible recovery error and no write occurs.

Use a separate `.dope/planning.lock`. Every Planning mutation takes the lock, rereads/validates the latest snapshot, checks expected revision and project identity, applies one typed operation, replaces atomically and acknowledges only committed state. Preserve data on failures. Do not steal abandoned locks automatically.

Reuse the Phase 2 storage discipline but do not create a generic persistence/database framework. Planning and Project Mind remain separate stores and there is no cross-file transaction in Phase 3.

Create/Plan-from-Decision validates the Decision immediately before the Planning mutation; the operation writes Planning only.

Create `docs/planning-storage.md` during implementation with readable format, identity prerequisite/mismatch, locks, backup/recovery, Git implications, corrupt/future schema and full-snapshot scaling limits.

## Planning workspace

Replace the spike Planning widget with a production workspace.

Required product behavior:
- list/select/create Plans;
- edit explicit Plan fields and save;
- ordered step list with create/edit/reorder/status/block reason;
- Task list by selected step and Task detail;
- explicit Task lifecycle and notes;
- Plan revision/history display;
- Project Mind artifact linking and navigation;
- create a Plan from a selected Decision without converting that Decision;
- project-relative working-set file links that open ordinary editors;
- missing target visibility;
- useful empty/loading/error/unsupported-identity states;
- keyboard-operable controls;
- semantic Theia theme tokens for dark-first and readable user-selected light mode.

Prefer explicit Save over autosave.

Protect dirty Planning drafts across selection, step/task navigation, workspace changes, backend notifications and close. Surface Save/Discard/Cancel where the host permits. Use project/generation/request guards so late loads, saves or events from another project cannot render into the active Planning view. Conflicts retain draft text and require explicit reload/reconcile.

PLAN mode may foreground/open Planning. BUILD mode may foreground normal coding surfaces where practical. Mode changes must not change canonical Plan/Step/Task status, save drafts automatically or hide unresolved conflicts.

## Project Mind bridge

Add bounded presentation actions without changing ProjectArtifact types:
- from a Decision detail, create a new draft Plan seeded with developer-visible Decision fields and linked to that Decision;
- show/navigate related Plans by querying Planning references;
- allow Planning to choose existing Project Mind artifacts as links.

Do not auto-promote Ideas/Questions/Decisions into work.

## Coding integration

Task/Plan working-set file references open the ordinary Theia editor, optionally at a line.

Do not add code-generation or command execution to Planning. The developer uses the existing editor, terminal, tests, SCM, debugger and Problems surfaces. Returning to Planning and changing Task/Step status is explicit.

Symbols are deferred unless an existing stable Theia API makes a bounded file+line reference trivial; no symbol index is required.

## Provider boundary

No model is required or configured for Phase 3.

Do not add:
- Model Runtime;
- OpenAI/Codex product adapter;
- local-model adapter;
- Theia AI product ontology;
- Agent Mind;
- tool calling;
- ProposedAction;
- AI ownership/delegation;
- mutation authority.

ADR 0006 records Codex/OpenAI as the first Phase 6 reference implementation only.

## Validation stack

P1 `0.3.1`: Planning contracts/domain package, transitions/order/history/query semantics and aggregate build/test wiring.

P2 `0.3.2`: Planning storage, identity binding, locks/revisions/recovery and typed backend transport.

P3 `0.3.3`: production Planning UI/controller, Project Mind bridges, draft/race/conflict protection, file navigation and mode integration.

P4 `0.3.4`: process restart/reopen/history/isolation integration plus resulting Electron package/native-launch evidence.

P5 `0.3.5`: direct interactive Dope-on-Dope Planning qualification using a real upcoming Dope change and a second project.

P6 `0.3.6`: evidence-only closeout.

P1-P4 are runner-owned. P5 is browser/manual interactive handoff. P6 audits only.

Permanent tests should cover schema validation and all status transitions, stable step ordering/reorder, task parent integrity, Plan/document revision and typed history, artifact/file link validation, identity mismatch/missing prerequisite, lock/stale revision and failed-write preservation, corrupt/future schema, dirty draft and late-response/event protection, restart/reopen and second-root isolation.

Run focused checks plus the real aggregate `npm run check`, current `npm run test:restart`, phase validation, no-root-lock and `git diff --check` as assigned. P4 packages Linux AppImage and records exact hashes/resources/native launch. P5 performs direct GUI evidence; automated CDP/headless tests do not replace it.

## P5 dogfood target

Use a genuine upcoming Dope feature/change rather than synthetic filler.

Through the actual GUI:
1. use an existing genuine Decision or create one in Project Mind;
2. create/link a draft Plan from it;
3. add/reorder live steps;
4. create Tasks with requirements, constraints and real Dope working-set files;
5. activate/progress/block/unblock/complete/reopen representative steps/tasks;
6. revise the Plan and inspect revision/history;
7. open linked files and perform a small controlled real coding/edit/test cycle using ordinary IDE surfaces, restoring any probe unless it is intentionally retained work;
8. restart/reopen and recover the same Plan/Task/history/link state;
9. exercise dirty-draft conflict/navigation protection;
10. demonstrate distinct state in a second local project;
11. preserve unrelated Git state and distinguish intentional `.dope/planning.json` knowledge changes.

A required failed/missing matrix item prevents Green P5 absent a separate explicit audit waiver.

## Exclusions

No AI/runtime/provider integration, local-model work, Agent Mind, ProposedAction, authority/tool execution, autonomous mutation, DevelopmentSession, semantic search, Product Phase 4 Physical Software Model/code analysis, Product Phase 5 visual planning, collaboration/sync, remote/multi-root Planning, database, generic workflow engine or framework upgrade.
