# Product Phase 2 Implementation Plan

Status: APPROVED/PREPARED — EXECUTION BLOCKED
Source baseline: `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`
Package baseline: `0.2.0`; baseline repair commit is recorded in `docs/planning/p2/activation.md`, with sequencing eligibility pending
Authority: `docs/planning/p2/phase-2-plan.md`

## Prerequisite and execution boundary

Check BOOT and the Phase 1 closeout before every prompt. Require documented Phase 1 qualification with reconciled findings, or a separate explicit owner sequencing waiver; the prior Phase 1 P6 audit waiver is insufficient. Then require the coherent, committed `0.2.0` activation, clean tree, Node 24, no root package-lock and Theia 1.75.0. Preparation was at `0.1.6`; the later version repair aligns the owner-created `0.2.0` baseline without authorizing execution. The runner owns P1-P4 commits; P5 is manual and P6 audits evidence only.

If source changes during Phase 1 correction, retrace the narrow affected flows before executing. Do not fold restoration repair into p2 while claiming it was independently qualified. A bounded defect found during actual p2 work can be repaired with permanent coverage and repeated affected evidence; architecture/scope changes return to planning.

## End-to-end flow and state owners

```text
ProjectMindWidget (draft/project/request-generation state)
  -> typed Project Mind RPC (project handle, expected snapshot revision, operation)
  -> connection-bound backend (attachment, request validation, event lifecycle)
  -> Project Intelligence (artifact validation, transition, link, list/search)
  -> Node adapter (canonical root, mutation lock, read/validate, revision, atomic snapshot)
  -> .dope/project-mind.json
  -> committed result/event (project identity + revision)
  -> saved projection, preserving dirty drafts
```

Canonical: artifact/project identity, content, lifecycle/archive state, provenance, timestamps, relationships and document revision. Derived: workspace/widget IDs, root path handle, draft, selection, filters/search, layout, theme and transport connection. A response for an earlier project/request generation cannot change the current editor. Notifications are invalidation/committed-state evidence, not permission to discard drafts.

## P1 — core contracts/domain (`0.2.1`)

Likely files: new artifact and Project Mind transport modules under `packages/contracts/src`; real `packages/project-intelligence` manifest/tsconfig/core modules; root workspace/build/test scripts; extension dependency/build order as needed; baseline tests and focused domain tests.

Keep `note.ts`/`note-service.ts` and legacy UI/store functioning until P2/P3 replace the consumer. New schema is a discriminated union plus versioned project snapshot. Implement validator, explicit lifecycle/archive operations, same-project artifact/file link validation, and deterministic case-insensitive title/content search with type/status/archive filters. Query results never write canonical state. UUID/time generation remains injectable only where a deterministic check needs it; do not add generic clock/ID factories.

Core checks cover all four types, invalid payloads/status/type transitions, answering, decision acceptance/supersession, archival preserving links, missing/invalid targets and stable search/filter ordering. No Theia/Node-storage/provider import is needed to run domain behavior. Extend aggregate commands so the new package is actually built/tested and every workspace version/internal reference is checked. Preserve current IDE composition/provider pin.

## P2 — storage/migration/backend (`0.2.2`)

Likely files: `packages/project-intelligence/src/node/project-mind-store.ts`; existing extension `node/backend-module.ts`, new small backend adapter and contract binding; retire/bridge spike backend paths without two writers for one canonical store; storage tests and `docs/project-mind-storage.md`.

Attachment accepts one explicit local project folder, returns a connection-scoped handle and validates all subsequent operations against that root/project. Inspect installed supported Theia backend services; `WorkspaceServer` exposes recent-workspace state, which cannot be treated as active-root authorization. Use a narrow explicit attachment adapter rather than hidden `_bindingDictionary`/protected fields. Canonicalize roots and reject non-local/multi-root contexts and storage symlink escape. Do not expand this into a tool permission/sandbox subsystem.

Implement readable collection snapshot, absent read without writes, exclusive per-project filesystem mutation lock across independent processes, expected document revision, latest-snapshot validation and atomic durable replacement. Locks cover create/migrate/update/archive/link/lifecycle operations. Define visible contention/conflict/corruption/unsupported outcomes. After replacement uncertainty, read the committed revision before retrying. Never delete another process's lock or auto-recover by age.

Migration is explicit and idempotent, validates the strict original Note parser, preserves original bytes/identity/provenance, leaves historical timestamps unknown and records migration metadata. New store wins once present; no implicit merge/reimport or legacy concurrent writing. The guide documents stopped-writer backup/inspection/external-edit/recovery and intended Git changes.

Focused checks use temporary folders and two independent stores/processes: round trips/reconstruction, repeated migration, corrupt source/target/future schema, injected write/rename failure, stale revision, lock contention/crashed-writer condition, wrong handle/root, path/symlink escape, events/disposal. Exercise the real adapter and transport-facing request boundary, not just UI restrictions. Preserve relevant legacy tests by adapting them to the migration/read-only compatibility path. Aggregate validation covers the new production suites.

## P3 — production UI (`0.2.3`)

Likely files: `browser/dope-workbench.ts` or a focused Project Mind widget extracted only if useful, frontend/backend RPC binding, `dope.css`, and a small runnable draft/async-state check. Leave Planning placeholder and unrelated mode/title logic unchanged.

Replace spike labeling/form with list/detail, four type forms, explicit Save/status/archive/link actions and search/filter controls. Links open ordinary editor/artifact views. Build request-generation/project guards for load/save/events, expected-revision tracking, dirty draft protection, visible pending/saved/conflict/error states and cleanup. Avoid initial load render clearing unsaved text or save completion rendering into a new project. Returning to another artifact must preserve or explicitly resolve its draft.

Test delayed A-load/A-save after switching to B, a committed peer event while editing, failed/conflicting save, selection/workspace/close dirty handling and callback disposal. Prefer testing the actual minimal controller/state used by the widget, plus a narrow integrated smoke; do not duplicate implementation in assertions. Keyboard labels/focus, dark/light tokens and unavailable-context/empty/error messages need P5 direct confirmation. No GUI pass is claimed in P3.

## P4 — restart/package (`0.2.4`)

Likely files: existing `test/integration/restart.test.mjs` or one focused sibling where necessary, root integration command wiring, and `docs/tasks/p2/P4-restart-package-evidence.md`. Reuse Xvfb/CDP only as supplemental instrumented tests; do not spread its private-container lookups into production.

Exercise actual frontend/backend save/reopen across application processes for all four types, relationships/lifecycle/search and two projects. Include migrated Note stable identity and a stale client attempt after restart. Test abandoned lock recovery through the documented external path and corrupt/future state preservation. Preserve existing theme/keybinding/extension/provider integration, not merely the new knowledge check.

Build/inspect the actual AppImage with the new package in asar/backend/frontend resources, metadata/icon/plugins and native normal launch outside the dev server. Record exact source SHA/dirty state/version, artifact hash/size/mode, commands/environment/plugin cache use, startup/readiness/close and persistence boundary. Development/CDP flags must not be passed as the claimed normal-launch path. Do not invent native visual evidence. Cache reuse and fresh-download evidence remain distinguishable.

## P5 — direct GUI (`0.2.5`)

Create `P5-project-mind-dogfooding-evidence.md`. Record actual candidate and Git/profile state. In real browser-hosted Theia or Electron, use genuine Dope context to create/edit all types, answer/accept/supersede/archive/unarchive, link artifacts/files, navigate/filter/search and preserve a dirty draft through navigation/peer change/conflict. Migrate a copied legacy fixture interactively without overwriting real knowledge. Qualify keyboard/light presentation.

Perform actual backend/application restart with same project/profile and retrieve saved knowledge through a usable UI. Open a second unrelated local project and check no leakage, then return to Dope. Demonstrate external readable backup/recovery with writers stopped. Distinguish intended `.dope` knowledge from controlled source edits; restore the latter and preserve unrelated Git state. Evidence must identify which source/package covers any bounded repair and repeat affected package checks. Do not create a success marker if a required row fails/is unobserved.

After Green evidence, coherent versions at `0.2.5`, validation and clean intended handoff, manual operator creates exactly `0.2.5`. Runner agents do not commit. A checkpoint records partial results honestly; P6 remains blocked unless separately waived for audit.

## P6 — evidence-only audit (`0.2.6`)

Audit exact reachable prompt commits and activation, source/tests, storage guide, P4 artifact and P5 interactive matrix. Rerun current deterministic checks and package/integration evidence as appropriate without repairs. Create `closeout.md` with core, migration/recovery, conflict/isolation, UI/drafts, restart, package and self-development dispositions. Preserve Phase 1 history and scope accepted residual gaps. Qualified requires Green applicable evidence and no unresolved blocker. If Qualified, mark README Green and BOOT to post-Phase-2 review; otherwise keep Not Qualified and correction routing. Do not activate Phase 3.

## Validation strategy

Per prompt: focused behavior checks, actual aggregate `npm run check`, `npm run codex:phase:validate -- p2`, no root package-lock, coherent versions and `git diff --check`. Add new production tests to aggregate commands at introduction. Restart integration remains separate and is required where affected (P2/P3 practical smoke, P4 full process check, P5/P6 final rerun). P4/P5 include real package evidence when source repairs affect it. No tests are added by documentation preparation itself; grammar/baseline/link/coherence checks validate the prepared artifacts.
