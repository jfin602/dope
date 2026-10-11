# /prompt-ass — Phase 9B Typed Artifact Linking

**Disposition:** SOURCE REVIEWED / ASSESSMENT APPROVED / NOT OWNER-ACTIVATED
**Entry:** bounded 9A Green at `0.9.6` / `6b51ee96`, evidence `bb266b3`; 9B P1 targets `0.9.7` only after separate owner activation.
**Authority:** `docs/planning/p9/phase-9b-plan.md`, ADR 0033, stability contract.

## Source-grounded risk assessment

1. `packages/contracts/src/developer-session.ts` currently parses strict v1 sessions/collections without links. v2 requires deterministic read-only v1 normalization, no revision/timestamp changes, and explicit locked write migration; preserve 9A lifecycle, closeout and focused assertions.
2. `DeveloperSessionStore.transact` owns atomic revisions; `DeveloperSessionBackend` owns per-connection root/handle. Link mutations belong in this boundary, never in Chat/Planning/Agent/Project Mind stores. Cross-store attach checks are not a distributed transaction; missing-after-attach must be visible.
3. `ChatRepository.read()` may write interrupted/legacy recovery state. Implement a genuinely non-mutating metadata lookup; do not call that read method from session resolution or leak transcripts.
4. `PlanningStore.read` returns independent Planning projectId, map/work IDs, revisions and basis. Session project is canonical root with projectMindId null. Do not equate IDs; stale must be evidence-backed using semantic basis, not generation-only differences. If current basis cannot be safely established, return unavailable/unknown rather than fabricate stale.
5. `AgentStore.readTask/readRun/readSequence` and `ProjectMindStore.read` provide owner truth. AgentRun taskId and projectId must match; show run status, Dope-owned validation and review separately. Project Mind missing is normal and must not be initialized.
6. Phase 8D evidence confirms an accepted AgentRun can coexist with WorkItem `ready`. Never infer WorkItem completion or modify origin/ExecutionGrant. Phase 5 P11 Not Green/P12 unexecuted remains historical; 9B requires one real targeted Planning-to-Work replay.

## Prompt decomposition and model choice

| Prompt | Target | Tier | Model | Ownership |
| --- | --- | --- | --- | --- |
| P1 | 0.9.7 | T1 | GPT-6 Sol High | v2 typed links, v1 normalization contracts |
| P2 | 0.9.8 | T2 | GPT-6 Sol High | atomic store migration, 9A compatibility |
| P3 | 0.9.9 | T2 | GPT-6 Sol High | read-only Chat and Planning resolvers |
| P4 | 0.9.10 | T2 | GPT-6 Sol Medium | Agent and Project Mind resolvers |
| P5 | 0.9.11 | T2 | GPT-6 Sol High | revision-checked membership and backend RPC |
| P6 | 0.9.12 | T2 | GPT-6 Sol High | cross-store integration/replay fixture |
| P7 | 0.9.13 | T2 manual | GPT-6 Sol High | real authorized replay and bounded 9B closeout |

## Efficiency/qualification

P1–P5 each own one seam and focused test, target <=8 minutes implementation plus checks (10-minute soft, 15-minute hard). P6 is a bounded cross-boundary integration gate, P7 a manual real authorized headless replay and evidence audit. Build only changed compiled package outputs required by focused tests. No repetitive `npm run check`, full Electron/browser/native build, model call in ordinary implementation prompts or duplicate aggregate registration. Register new tests once in `test:product`. Safety gates must be proven at their introduction, not waived for speed.

9B must not add a Session UI (9C), rich dashboard/resume (9D), full GUI/aggregate (9E), automatic model context, new session-origin execution or new authorization. Final P7 may be Not Green if real replay is unavailable; deterministic fixtures alone cannot substitute for observed authorized run/review. No 9B activation, implementation or version bump is authorized by this assessment.
