# Product Phase 3 Implementation Plan

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `95815b04977a229abfdfdba628eb9dddc9e55203`, `0.3.0`
Authority: `docs/planning/p3/phase-3-plan.md`

## Preflight for every prompt

Read BOOT, AGENTS, Phase 3 activation/plan, PRODUCT-MODEL, ARCHITECTURE, workflow/stability authority, this plan and all prior p3 source/evidence.

Require:
- reachable activation source `95815b04977a229abfdfdba628eb9dddc9e55203`;
- the explicit owner Phase 3 activation;
- coherent expected predecessor version;
- clean intended Git state;
- Node 24;
- no root `package-lock.json`;
- Theia exactly 1.75.0 and Electron 42.8.1.

Do not demand Phase 2 Green; the owner sequencing disposition is the entry authority. Preserve Phase 1/2 audit history.

P1-P4 are runner-owned and must not commit. P5 is manual direct GUI qualification. P6 is evidence-only.

## P1 — Planning contracts and independent core (`0.3.1`)

### Source boundary

Add framework-independent Planning DTOs/service contracts under `packages/contracts/src`, expected as focused modules such as:
- `planning.ts`
- `planning-service.ts`

Add one real package:
- `packages/planning/package.json`
- `packages/planning/tsconfig.json`
- `packages/planning/src/index.ts`

Do not add Node filesystem imports to the pure Planning module.

Update root workspaces/build/typecheck/product-test ordering and baseline coherence for the real package. Both applications and internal packages advance coherently to `0.3.1`.

### Domain behavior

Implement strict parsers/validators and typed immutable operations for:
- Plan create/replace and allowed status transitions;
- PlanStep create/edit/reorder/status/block reason;
- Task create/replace/status and parent integrity;
- Planning artifact/file links;
- deterministic list/query helpers;
- document revision input/result types;
- per-Plan visible revision;
- append-only typed history entries.

History entries are generated from successful typed operations. One explicit save -> one history entry. No raw keystroke/event log.

Tasks must reference an existing Plan and a Step within that Plan. Reorder must preserve stable Step IDs. No duplicated task membership list inside steps.

### Tests

Add focused permanent tests, expected in `test/unit/planning.test.ts`, for:
- malformed/unknown schema;
- duplicate/invalid IDs;
- every legal/illegal Plan, Step and Task transition;
- blocked reason requirement;
- task parent/step integrity;
- reorder determinism;
- document/Plan revision helpers;
- history actor/revision/affected-ID semantics;
- artifact/file link shape validation;
- deterministic queries.

No Theia or provider setup should be needed.

## P2 — durable Planning storage and transport (`0.3.2`)

### Node store

Add `packages/planning/src/node/planning-store.ts` or equivalent focused Node adapter.

Persist `.dope/planning.json`, schema 1:
- Project Mind `projectId`;
- document revision;
- plans;
- tasks;
- history.

Use separate `.dope/planning.lock`.

Mirror the proven Phase 2 discipline:
1. canonical local root;
2. reject unsafe/symlinked `.dope`, store and lock paths;
3. acquire exclusive lock;
4. read/strictly parse latest snapshot;
5. verify expected revision and expected project identity;
6. apply one typed operation;
7. write temp + sync + atomic rename + parent sync;
8. acknowledge committed state;
9. release only the acquired lock.

Missing read creates nothing. Planning first write requires a supplied existing Project Mind identity. Never generate a Planning project UUID.

Post-rename sync uncertainty must require reread before retry. Do not auto-steal locks.

### Backend identity/transport

Add Planning service backend in `@dope/theia-extension`.

On attach:
- resolve one supported local folder;
- attach/read Project Mind through the backend/store boundary;
- obtain canonical `projectId`;
- if missing, return visible unsupported/prerequisite state without writing;
- read Planning state;
- reject projectId mismatch.

Bind connection/project handle and validate it on every request. Arbitrary later URIs/client metadata cannot redirect storage.

For new Project Mind artifact links, validate target existence immediately before the Planning mutation. Do not mutate Project Mind for reverse links.

### Recovery docs/tests

Create `docs/planning-storage.md` with format example, identity prerequisite, lock/revision behavior, Git implications, backup/restore, abandoned lock, corrupt/future schema, mismatch recovery, external edit rules and snapshot scaling limit.

Add `test/unit/planning-storage.test.ts` for two roots, two backend processes/locks, stale revisions, mismatch/missing identity, corrupt/future schema, failed write/rename/sync, symlink/traversal file targets, artifact validation and disposal/events.

Wire storage suite into the real aggregate.

## P3 — production Planning workspace and safe editing (`0.3.3`)

### Presentation structure

Replace the `DopeSpikeWidget` Planning factory with a production widget/controller.

Prefer focused files:
- `planning-controller.ts`
- `planning-widget.ts`

Keep `dope-workbench.ts` responsible for common workbench/mode/view wiring rather than absorbing the full Planning implementation.

### Required UI

Provide:
- Plan list/create/select;
- Plan title/objective/context editor with explicit Save;
- Plan status actions;
- ordered Step editor and move up/down or equivalent deterministic reorder;
- Step status/block/unblock/reopen/skip/supersede actions;
- Tasks for selected Step;
- Task title/objective/requirements/constraints/status/detail;
- completion and developer validation notes;
- Plan revision + concise history;
- Project Mind artifact links/navigation;
- working-set file links/navigation and unavailable state;
- empty/loading/error/missing-project-identity/conflict states;
- keyboard focus/labels and semantic dark/light theme styling.

### Project Mind bridge

Add a bounded action on Decision detail:
- Create draft Plan from Decision.

Seed only from visible developer-authored Decision fields, validate current artifact identity, create exactly one linked Planning object and navigate to it. Repeated user clicks are separate explicit actions unless a pending request is already in flight; prevent accidental duplicate submission from one pending action.

Show/navigate related Plans by derived Planning references. Do not add Plan targets to ProjectArtifact schema merely to make reverse links.

### Draft/race rules

Planning controller must guard:
- dirty Plan/Step/Task drafts across selection;
- workspace changes;
- close;
- notifications;
- delayed attach/read/save/mutate responses;
- stale peer revision.

Use Save/Discard/Cancel as appropriate. A conflict preserves copyable draft content and offers explicit reload/reconcile; never silently overwrite.

PLAN mode may open/focus Planning; BUILD mode must not mutate state or silently discard/save drafts.

Add permanent UI/controller tests with delayed fake services and project switches. Wire them into aggregate product tests.

## P4 — restart/process/package qualification (`0.3.4`)

Extend integrated restart/process tests to exercise real Planning transport/state across process replacement:
- Project Mind identity prerequisite;
- create a Plan with multiple Steps/Tasks and links;
- reorder/status/history;
- stale writer rejection;
- second-root isolation;
- corrupt/future/mismatch/abandoned-lock recovery as practical;
- reopen same profile/project and recover usable Planning state.

Do not rely only on DOM injection or unit state. The integrated test may use existing CDP instrumentation as supplemental automated evidence.

Build/package the exact `0.3.4` AppImage. Record:
- source/pre-task identity;
- build environment/caches/plugins;
- executable/mode/size/hash;
- embedded app/package versions/resources;
- Planning frontend/backend code presence;
- normal native launch/readiness and controlled close where environment allows;
- what was not directly visually exercised.

Create `docs/tasks/p3/P4-planning-restart-package-evidence.md`.

No direct P5 GUI claims.

## P5 — direct Planning dogfood (`0.3.5`)

This is manual/browser-required qualification.

Use direct clicking/typing/observing in the actual Theia GUI on the real Dope repository with no model configured.

Use a genuine upcoming Dope feature/change as Planning content. Do not implement Phase 4 AI runtime merely because ADR 0006 exists.

Matrix:
- establish/use a genuine Project Mind Decision;
- create a linked draft Plan from that Decision;
- edit/save/activate Plan;
- add at least three Steps; reorder; exercise pending/active/blocked/unblocked/complete or equivalent representative states;
- create multiple Tasks under real Steps with real requirements/constraints;
- link Project Mind artifacts;
- add/follow real working-set file links and observe an unavailable reference;
- inspect Plan revision/history after explicit mutations;
- perform a small controlled real edit/test cycle through ordinary editor/terminal/test surfaces and reflect progress explicitly in Tasks/Steps;
- prove PLAN/BUILD mode changes do not change canonical statuses or lose drafts;
- exercise dirty navigation and workspace-switch protection;
- demonstrate peer/stale conflict and explicit recovery without overwrite;
- restart/reopen same workbench/backend/profile and recover the Plan, Tasks, links and history;
- open a second local project with distinct Project Mind identity and Planning state, then return to Dope;
- exercise documented external backup/recovery with writers stopped if safe and relevant;
- keyboard operation plus dark default/readable explicit light theme;
- preserve unrelated Git state.

Create `P5-planning-dogfooding-evidence.md` with exact surface, source/version, matrix disposition, state IDs/revisions, restart/isolation, repairs and Git pre/post.

Any required failure/gap blocks success absent a separate explicit audit waiver. A bounded product repair requires a permanent regression guard plus replay of the failed GUI step and fresh affected package evidence.

After Green applicable evidence, set coherent `0.3.5`, run focused/aggregate/restart/phase/no-root-lock/whitespace checks, and create exactly one manual commit with subject `0.3.5`. Runner agents do not commit.

## P6 — evidence-only closeout (`0.3.6`)

Read exact P1-P5 commits/evidence plus inherited Phase 1/2 closeouts.

Audit:
A. provider-free Planning contracts/transitions/order/revision/history;
B. readable persistence, identity binding, locks/conflicts/failure preservation/recovery;
C. Project Mind link integrity and project isolation;
D. production Planning UI, bridge, draft/race/conflict safety and mode independence;
E. actual restart/reopen continuity;
F. resulting Electron package/resources/native launch;
G. Dope-on-Dope usefulness with no model and preserved Git state.

Set coherent `0.3.6`; rerun focused + aggregate checks, restart integration, phase validation, package inspection as appropriate, no-root-lock and `git diff --check`.

Create `docs/tasks/p3/closeout.md` with exact candidate identities and Green/Not Green/Evidence Gap per gate.

Do not repair behavior in closeout. Do not create Phase 4 prompts. A version marker or owner sequencing decision is not evidence.

## Scope guard for all prompts

No OpenAI/Codex/local-model product runtime, Theia AI product ontology, Agent Mind, AI ownership/delegation, ProposedAction, authority/tool execution, autonomous mutation, DeveloperSession, semantic search, architecture model, collaboration/sync, remote/multi-root Planning, database, generic event store/workflow engine or Theia upgrade.
