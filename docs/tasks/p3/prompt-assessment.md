# Product Phase 3 Prompt Assessment

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `95815b04977a229abfdfdba628eb9dddc9e55203`, `0.3.0`
Authority: `docs/planning/p3/phase-3-plan.md`

## Conclusion

Use six ordered prompts.

The source is ready for a bounded Planning phase without a framework upgrade or AI runtime. The main dependency chain is strict:

contracts/domain -> storage/typed backend -> production UI -> restart/package -> direct GUI dogfood -> evidence closeout.

Do not collapse persistence into P1 or start UI before revision/identity transport exists. Do not pull Phase 4 Codex/OpenAI or local-model integration into any p3 prompt.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | DTOs + one real `@dope/planning` package | Framework-independent lifecycle/order/revision/history/query tests | GPT-6 Sol High |
| P2 | Node store + project-bound backend | identity prerequisite/mismatch, locks, stale revisions, failure preservation, recovery/isolation | GPT-6 Sol High |
| P3 | Focused Theia Planning presentation | draft/race/conflict safety, Project Mind bridge, file navigation, mode independence | GPT-6 Sol High |
| P4 | Integrated process/application/package | restart/reopen/history/isolation plus exact AppImage/native launch | GPT-6 Sol High |
| P5 | Actual developer workflow | direct GUI on Dope and a second project with real plan/task/coding loop | GPT-6 Sol High |
| P6 | Evidence audit only | exact-candidate Qualified/Not Qualified with retained inherited gaps | GPT-6 Sol Medium |

P1-P4 are runner-owned. P5 is the only browser/manual handoff. P6 is final closeout. Versions are exactly `0.3.1` through `0.3.6`.

## Current source findings

- `PlanningView` currently creates a Foundation Spike `DopeSpikeWidget`; there is no production Planning domain, store, controller or service.
- `@dope/contracts` already owns framework-independent Project Mind DTOs/transport.
- `@dope/project-intelligence` demonstrates the desired pure-domain + separate Node adapter pattern.
- `.dope/project-mind.json` already carries stable `projectId` and optimistic document revision. Planning must reuse that identity, not allocate another.
- `ProjectMindStore` provides proven local-root normalization, exclusive lock, atomic replacement and failure-preservation patterns that Planning can mirror without a generic persistence abstraction.
- `ProjectMindController` already demonstrates generation/request guards, dirty draft protection, stale-event handling and explicit conflict recovery. Planning should reuse the design lessons, not copy presentation state into canonical storage.
- `dope-workbench.ts` is already large; production Planning should use focused controller/widget files.
- `WorkspaceMode` is presentation state stored in localStorage. PLAN mode may foreground Planning but must never mutate Plan/Step/Task state.
- current aggregate test/build commands include Project Mind but no Planning package/suites. P1-P3 must wire real new suites into those aggregates.
- restart integration already launches Theia/Electron and tests Project Mind/runtime behavior; P4 should extend that integrated surface rather than inventing a parallel harness.

## Dependency and identity decision

Phase 3 deliberately does not add a shared project-identity migration or second allocator.

Canonical Planning writes require an existing Project Mind `projectId`. The Planning backend resolves the current Project Mind snapshot on attach/create. If none exists, the Planning UI shows a visible prerequisite and routes the developer to establish Project Mind identity through ordinary Project Mind behavior. Do not silently create an empty Project Mind store because that could alter legacy Note migration semantics.

If both Project Mind and Planning files exist but IDs differ, fail closed and preserve both files for inspection/recovery.

## Applicable risks

- **Domain integrity:** invalid status transitions, duplicate IDs, orphan Tasks, cross-Plan step IDs, unstable step order, history that lies about accepted state.
- **Persistence:** stale overwrite, partial/uncertain writes, lock contention, corrupt/future schema, identity mismatch, unsafe file paths and abandoned locks.
- **Cross-domain references:** nonexistent artifact IDs, archived valid targets, later unavailable files, accidental Project Mind mutation when creating Planning links.
- **Presentation:** dirty draft loss, late response/event after project switch, false "saved" state, mode changes altering canonical status, Project Mind bridge triggering duplicate Plans.
- **Integrated reality:** unit tests cannot prove restart usability, actual editor navigation, package composition or direct Planning dogfood.
- **Git:** P5 intentionally writes `.dope/planning.json`; distinguish durable intended knowledge from temporary code probes/unrelated developer edits.
- **Provider coupling:** ADR 0006 can be misread as authorization to add Codex runtime now. Every prompt explicitly forbids it.

## Stability answers

1. Behavior at risk: Project Mind, ordinary IDE startup/mode behavior, package composition, new Planning state, file navigation and restart.
2. Invariants: Planning is Dope-owned/provider-free; Project Mind remains knowledge authority; UI/provider state is not canonical; BUILD/PLAN is presentation only.
3. Integrated-only evidence: usable Planning after process restart, working Project Mind bridge/file navigation, direct draft/conflict behavior, native package readiness and actual Dope-on-Dope workflow.
4. Baseline: exact activation source `95815b04977a229abfdfdba628eb9dddc9e55203`, coherent `0.3.0`.
5. Durable knowledge: Planning contract/ADR, storage recovery guide, P4 package/restart record, P5 dogfood record and P6 closeout.
6. UI-state risk: selected Plan/Step/Task, unsaved drafts, filters, workspace mode and layout remain presentation state.
7. Provider coupling: zero product provider dependency in Phase 3; Codex first becomes relevant only in Phase 4.

## Deferred

AI/model/provider adapters, Agent Mind, AI ownership/delegation, ProposedAction, tool/authority execution, DevelopmentSession, semantic search, architecture model, collaboration/sync, remote/multi-root Planning, database/event store and generic workflow engine.
