# /prompt-ass — Phase 9A

Disposition: **ASSESSED / NOT ACTIVATED**. Source reviewed at `0.8.47`. Goal: small optional provider-free session domain and durable lifecycle only.

## Source and identity findings

- Domain/service contracts fit `packages/contracts/src`; Theia backend RPC fits `packages/theia-extension/src/node/backend-module.ts`. No new workspace package needed for 9A.
- `ProjectMindStore` creates its projectId only after the first artifact; `PlanningStore` can be uninitialized or have an independently allocated projectId. **Do not assume they match, create a competing project identity, or require an AI call/Project Mind artifact to create a manual session.** Bind to canonical local root/opaque projectHandle and existing authoritative project identity when available; specify safe empty-Project-Mind and copied/reopened project behavior.
- Reuse safe `.dope` root, atomic replace, lock and revision patterns from ProjectMind/Planning/Chat stores. Existing tests import compiled `lib`; compile only changed `@dope/contracts` / `@dope/theia-extension` outputs before focused tests.

## Decomposition

P1 T1 High: strict typed session parser, collection, service operations, project identity contract; no persistence.
P2 T2 High: secure canonical root, no-follow/symlink checks, atomic project-local `.dope/development-sessions.json`, lock and revision safety; no lifecycle UI.
P3 T1 Medium: create/rename/objective/pause/resume/close/reopen and bounded developer notes/closeout; reject stale/invalid transitions.
P4 T2 High: project-attached Session RPC with stale-handle, attach/dispose and project-switch isolation; no AI or existing Chat/Work mutation.
P5 T2 High: two sessions, independent projects, copy/reopen, concurrent stale writes, malformed/symlink/foreign handle and no-session nonregression; register new tests once.
P6 T2 manual Medium: version/evidence review and scoped 9A closeout. **No full Phase 9 Green claim.**

## Preserve / defer

Sessions organize work, never copy canonical Chat/Planning/Agent state, start/cancel runs, widen grants, mutate Git, complete WorkItems or auto-select model context. Typed links and Planning-to-Work replay belong to 9B; UI 9C; rich context 9D; real GUI/aggregate 9E. Preserve Phase 5 P11 Not Green/P12 unexecuted and Phase 8 Green exact-source evidence.

**Prompt efficiency gate:** one owner/seam and one focused test per P1–P4; P2 security must pass immediately; one consolidated P5 integration gate; P6 no repeated full builds/tests. Target <=8 minutes for ordinary prompts; estimates are not observed timings. Explicit version transitions and exactly one final closeout required.
