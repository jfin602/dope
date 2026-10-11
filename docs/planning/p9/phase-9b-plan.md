# Phase 9B Plan — Typed Artifact Membership and Read-Only Resolution

**Status:** DESIGN APPROVED / P1–P7 PROMPT STACK AUTHORED / NOT OWNER-ACTIVATED OR IMPLEMENTED
**Date:** 2026-10-10 (local)
**Entry:** Phase 9A GREEN for bounded headless scope at exact `0.9.6` source/version checkpoint `6b51ee96bcdc4ca185292f594c1886de81b149e8`, evidence-only closeout `bb266b34796bdb5a390e0e8e263cd8caf45701d8` (`docs/tasks/p9a/closeout.md`). Actual manifests remain `0.9.6`.
**Authority:** ADR 0033, Phase 9 plan, Phase 5 retained P11 Not Green/P12 unexecuted, Phase 8 qualified execution/validation, stability contract. 9B is NOT activated by authoring. 9C–9E and Phase 10 remain inactive.

## Outcome and boundaries

A DeveloperSession can attach, detach and resolve typed references to existing project-local Chats, Planning Maps, WorkItems, AgentTasks, AgentRuns, AgentTaskSequences (Prompt Stacks) and Project Mind decisions/ideas. Multiple links per session and shared links across sessions are permitted. The Session owns only membership and developer-authored 9A metadata. Each artifact retains its authoritative store, lifecycle, project identity, validation and permissions.

9B exposes a compact backend resolution contract for future 9C UI. It does not build a Session panel, start inference, introduce session-origin AgentTasks, auto-complete WorkItems, adopt architecture or create another task system.

## Inspected 9A source and 9B seams

- `packages/contracts/src/developer-session.ts` has strict v1 DeveloperSession/SessionCollection parsers with no links. `packages/theia-extension/src/node/developer-session-store.ts` uses project-root-bound atomic revision writes; `developer-session-backend.ts` uses per-connection opaque handles. 9B must preserve 9A Green records and tests while introducing v2.
- `ChatRepository.read()` may write recovery state for interrupted or legacy Chats. Session resolution must use a genuinely read-only, bounded metadata path, not recovery-mutating reads.
- Planning Maps have mapId, workItemId, independent projectId, revision and semantic PlanningBasis. The 9A session binds to a canonical root with projectMindId null; these identifiers must not be conflated or silently reallocated.
- AgentStore has readTask/readRun/readSequence; AgentRun belongs to a task and carries separate validation, review and promotion evidence. AgentTask.origin is provenance, not mutable membership. WorkItem-derived tasks require revision-checked Planning launch, developer-approved validation, fixed grant and frozen candidate review.
- Project Mind decisions/ideas have independent IDs, types and status. Missing Project Mind is legitimate and must not be initialized by viewing a Session.
- Phase 5 P11 end-to-end A–I replay was Not Green; P12 unexecuted. 9B targeted replay must not retroactively claim Phase 5 Green.

## Typed reference and migration contract

Propose discriminated `SessionArtifactRef` values, with bounded validated IDs and no paths/provider-native IDs:
- `{kind:'chat',chatId}`
- `{kind:'planning-map',mapId}`
- `{kind:'work-item',mapId,workItemId}`
- `{kind:'agent-task',taskId}`
- `{kind:'agent-run',taskId,runId}`
- `{kind:'agent-sequence',sequenceId}`
- `{kind:'project-mind',artifactId,artifactType:'decision'|'idea'}`

Use stable deterministic reference keys. Duplicate attach is idempotent; it must not bump revisions unnecessarily. The same artifact can be referenced by multiple Sessions. Bound per-session and collection link counts. Do not add mutable backpointers to owning stores.

Implement strict v2 session and collection records with a typed links array and deterministic v1-to-v2 in-memory normalization of existing `0.9.6` records (empty links; unchanged IDs, project binding, lifecycle, revisions, timestamps, notes, next actions and closeout). Reads must not rewrite files. Persist v2 only on an explicit authorized revision-checked write under the existing 9A lock; preserve v1 backups and fail closed on corrupt/unsupported data. Adapt focused 9A parser tests to migration without deleting assertions.

## Resolution semantics

A `ResolvedSessionArtifact` returns ref, availability (`resolved | missing | stale | unavailable`), small owner-sourced display fields, observed revision/basis when present and a grounded diagnostic. Never return transcripts, source files, candidate diffs, private provider data or copied authoritative records.

- `missing`: owning store inspected successfully and target absent.
- `unavailable`: store inaccessible/corrupt/unsupported, or required basis cannot be determined.
- `stale`: concrete changed-basis evidence; generation-only observation change is not semantic staleness.
- `resolved`: owning store confirms the artifact; show current status without implying WorkItem completion from an accepted AgentRun.

A run reference must match its exact task and owning project. Project Mind decisions retain their actual status. Resolution must not trigger Chat recovery, Planning mutation/rebase, Project Mind initialization, AgentRun start, provider calls, Git writes or implicit session migration. Validate canonical root and owner identity at attach and resolve. On target deletion/change, retain the link and show the correct unavailable/missing/stale state.

## Mutation and authority

Attach: validate session handle/root and current target identity in its owner store, then under the SessionStore lock require expected collection/session revisions, active or paused status, bounded unique link and same project. Target may disappear after validation because stores are independent; later resolution must report missing. Detach removes membership only, never source artifacts. Duplicate attach is idempotent. Closed Sessions require explicit reopen. Preserve 9A lifecycle and unrelated `.dope` stores. No distributed transaction or automatic execution.

## Bounded implementation seams

1. Contracts/v2 parser, typed references, v1 normalization and v2 round-trip.
2. Atomic v1-to-v2 store migration, preserving 9A lifecycle and no-write reads.
3. Truly read-only Chat/Planning Map/WorkItem resolvers with missing/stale/unavailable.
4. AgentTask/Run/Sequence and Project Mind decision/idea resolvers with provenance and validation/review truth.
5. Revision-checked membership attach/detach and backend RPC resolution, shared/closed/stale cases.
6. Bounded cross-store integration and real Planning-to-Work replay: PlanningMap -> WorkItem -> authorized AgentTask/AgentRun -> frozen Dope validation/review -> Session projection.
7. Sole manual scoped closeout on an exact coherent source/version checkpoint.

The optimized executable stack is now authored at `docs/tasks/p9b/`: P1–P6 implementation and the sole manual P7 closeout, targeting `0.9.7`–`0.9.13`. The actual source remains `0.9.6`. Implementation prompts target <=8 minutes (10-minute soft, 15-minute hard), with focused tests and only changed package lib builds when needed. Security cannot be deferred for speed. One designated T2 real replay may take longer. No per-prompt npm run check, broad browser/Electron/native packaging or full Phase 9 GUI. Phase 9E owns the full Dope Builds Dope GUI and final aggregate.

## Exit and activation

9B is GREEN only with observed v1 migration, typed link CRUD, read-only resolution, project isolation, shared/missing/stale/unavailable handling, truthful validation/review and a real targeted Planning-to-Work replay on a coherent candidate. Otherwise mark NOT GREEN and retain evidence gaps. The 9B closeout cannot activate 9C, claim full Phase 9 Green or rewrite Phase 5/8 history.

**9B is NOT OWNER-ACTIVATED.** The actual source remains `0.9.6` until separate explicit owner activation and P1 advances to `0.9.7` during implementation.
