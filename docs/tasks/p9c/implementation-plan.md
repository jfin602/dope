# /prompt-plan — Phase 9C Session UI

**Status:** SOURCE-INSPECTED / TEN-PROMPT IMPLEMENTATION PLAN / NOT ACTIVATED
**Entry:** `0.9.13` / `5aa0bacecb4c26bf1806821747f36fae57077b1a`, 9B bounded Green; 9A and Phase 5/8 history retained.
**Versions:** P1–P10 `0.9.14`–`0.9.23`; P10 manual exact-candidate 9C-only closeout. Runner checks versions; each prompt owns all 13 manifest/internal pins without unrelated dependencies/lockfiles.

## Source seams and bounded execution

### P1 — Implement project-scoped Session frontend controller (T1)
**Likely ownership:** developer-session-controller.ts and new UI controller test.
**Implement:** Build a small typed Session frontend controller around DeveloperSessionService. Attach one WorkspaceService root, retain opaque handle, snapshot/selected Session/loading/error/pending/revision and an invalidation token. Invalidate late attach/read/resolve/mutate after root change, selection change or dispose. Use exact backend expected collection/session revisions; backend remains canonical, no new store.
**Validate:** New test/unit/developer-session-ui-controller.test.ts, register once. Test two roots, late reads, invalid handle, expected revision, disposal and no implicit owner writes; minimum extension lib build, focused test and git diff --check.

### P2 — Create center Session widget selector and launcher (T1)
**Likely ownership:** developer-session-widget.ts and frontend-module.ts/widget test.
**Implement:** Add center editor-area DeveloperSessionWidget (stable ID), left Sessions launcher and Command Palette entry in frontend-module.ts using supported Theia view/widget APIs. Repeat activation focuses the existing widget. Show current project sessions with title/status/last update, compact filter, selection, empty/loading/error and read-only metadata overview. Use current Dope dark/light visual rules; do not extend ChatPanelWidget or create duplicate owner widgets.
**Validate:** New test/unit/developer-session-widget.test.ts registered once; test wiring, idempotent focus, state/empty and safe text, minimal extension lib build and git diff --check.

### P3 — Add explicit Session create and metadata editing (T1)
**Likely ownership:** Session widget/controller + UI form tests.
**Implement:** Implement New Session, rename, objective, notes and nextActions forms using existing SessionOperation and 9A backend revision semantics. Save on explicit developer action, validate bounds, show pending/errors, retain unsaved drafts after conflict with no silent overwrite. Scope drafts to project+Session. Closed Session is inspectable and read-only; never automatically reopen/pause/close or persist on render.
**Validate:** Extend UI controller/widget tests for create/rename/notes/next-actions, oversized input, conflict draft preservation, closed state and restart-safe saved state; minimal touched-lib build, focused tests and git diff --check.

### P4 — Add typed Session membership attach and detach actions (T1)
**Likely ownership:** Session widget/controller + membership test.
**Implement:** Implement a small typed link action surface for exact existing artifact identifiers using all seven v2 SessionArtifactRef variants, including composite map+WorkItem, task+Run and Project Mind type. Permit a developer to supply an existing ID or a known owner selection; validate input shape and call backend attachLink/detachLink with current handle and expected revisions. Show real success/conflict/errors; duplicate attach no revision bump, shared references allowed, detach membership only. Backend owns target existence, canonical project and closed-session denial. Do not create a new linked artifact, owner store or candidate enumeration yet.
**Validate:** New test/unit/developer-session-ui-membership.test.ts registered once. Test typed/composite identity, shared/duplicate/detach, stale revisions, closed records and no owner mutation; minimum lib build, focused tests, git diff --check.

### P5 — Browse existing artifacts without unsafe owner reads (T2)
**Likely ownership:** new bounded owner candidate adapter + safe metadata tests.
**Implement:** Add a bounded owner-backed link candidate picker to P4. Use existing safely scoped owner metadata APIs or already selected owner panels for Chat, Planning/WorkItem, AgentTask/Run/Sequence and Project Mind decision/idea. ChatRepository.read or any ChatService read/list that can trigger recovery is forbidden for mere Session browsing. Never fetch transcript, candidate diff or initialize missing Project Mind; no unbounded cross-store index. If a kind cannot be safely listed, show a clear unavailable state while retaining P4 exact-ID attach; record as qualification gap rather than fake results. Include only seven v2 kinds, not direct Software Map references.
**Validate:** Extend Session membership test or add test/unit/developer-session-candidates.test.ts registered once. T2 verify real owner-backed choices, exact project IDs, no recovery reads/writes, empty/missing owner, bounded lists, stable composite refs and safe unavailable fallback. Minimal changed extension build + focused tests and git diff --check.

### P6 — Render truthful linked artifact resolution in Session overview (T1)
**Likely ownership:** Session widget resolution helper and UI tests.
**Implement:** Render grouped exact Session links from DeveloperSessionService.resolve; show resolved/missing/stale/unavailable, grounded diagnostic, small owner-derived title/status, actual validation/review/applied facts. Keep WorkItem ready separate from completed/applied AgentRun. Retain missing/stale links; no invented progress, transcript, diff or HTML. Drop stale results when root/selected Session changes.
**Validate:** Focused widget/resolution helper tests cover all availability states, WorkItem ready after applied Run, late resolution and escaped untrusted text, without owner mutations. Register any new test once, minimal lib build and git diff --check.

### P7 — Navigate Chat and Work links through existing owners (T2)
**Likely ownership:** developer-session-navigation.ts + Chat/Work existing panels and tests.
**Implement:** Use a narrow navigation adapter for Chat, AgentTask, AgentRun and AgentTaskSequence links. Reuse ChatOpenOwners, normal ChatPanelController selection/focus and WorkOpenOwners with ChatPanelWidget.selectWorkLauncher; selecting a linked object must reveal its existing owner rather than spawn a duplicate writer or replace the conversation. Enforce exact ID and current project before focus; unavailable/unsupported exact-navigation has explicit truthful fallback. Do not trigger agent execution, model context or review.
**Validate:** Add test/unit/developer-session-navigation.test.ts registered once. Test Chat/Work single-owner focus, same-project exact identity, wrong-project/missing target denial, no auto-run. Focused affected tests, minimum extension lib build and git diff --check.

### P8 — Navigate Planning Maps WorkItems and Project Mind links (T2)
**Likely ownership:** existing navigation adapter + PlanningMapController/PhysicalMapWidget/ProjectMindWidget.
**Implement:** Extend P7 navigation adapter to Planning Map/WorkItem via existing PhysicalMapWidget and PlanningMapController.setMode/select/selectWorkItem, and Project Mind decision/idea via ProjectMindWidget.openArtifact. Preserve Planning independent workspace state apart from developer-requested navigation; validate root/map/item identity, do not silently rebase or adopt, and do not initialize absent Mind. For unavailable precise deep linking, show honest bounded fallback instead of claiming selection.
**Validate:** Extend focused navigation test for exact Planning Map+WorkItem composite, Mind ID, wrong project, deleted/stale target and no owner-store mutation. Build touched extension lib only, run navigation tests plus direct affected widget tests, git diff --check.

### P9 — Qualify Session UI state isolation and restoration seams (T2)
**Likely ownership:** Session UI integration tests and affected 9A/9B tests.
**Implement:** Integrate P1-P8: restore only selected Session ID scoped to verified project from Theia layout (not canonical session data); ignore late read/resolve/navigate/attach after switching roots, dispose or select change; preserve local drafts/conflict visibility, closed inspect-only and owner single-writer rules. Test ordinary Chat/Work/Planning without Session, no implicit AgentRun and unchanged owner stores. Repair bounded defects only and run affected focused regression.
**Validate:** One bounded focused node --test invocation of new UI controller/widget/membership/candidates/navigation plus prior 9A/9B Session contract/store/backend/resolver/membership/integration tests. Minimum lib build + touched extension typecheck if required; verify A/B roots, restore, stale races, no owner-store writes/agent work, git diff --check. No real GUI Green claim.

### P10 — Real Session workspace GUI qualification and scoped closeout (T3)
**Likely ownership:** real GUI evidence / docs/tasks/p9c/closeout.md / version manifests.
**Implement:** MANUAL sole 9C closeout. After Git-proven P9 0.9.22, advance all 13 manifests/internal pins to 0.9.23 in a separately committed legitimate source/version checkpoint, then perform direct real Theia GUI qualification on exact candidate. Use a no-AI disposable project: create/select/edit Session, link existing Chat/Planning/Work/Project Mind artifacts, inspect shared/detached/missing/stale/closed links, navigate owner panels without duplicate Chat/Work writers or implicit run, switch projects, restart/reopen, check keyboard/theme and ordinary no-Session operations. Review owner store bytes, relevant focused tests, candidate source SHA. Record actual steps/evidence, failed/unsupported navigation or picker gaps and GREEN/NOT GREEN in docs/tasks/p9c/closeout.md as a separate evidence-only commit. If direct GUI cannot run, mark NOT GREEN; do not substitute headless tests.
**Validate:** T3 manual real Theia browser GUI REQUIRED; exact 0.9.23 checkpoint; screenshots/interaction proof, restart, no extra execution, owner-store byte preservation, relevant focused tests, git diff --check. Full 9E aggregate and native packaging remain deferred.

## Failure and qualification boundaries

Use root-attached opaque handles and backend revisions, not a frontend authority. Workbench layout stores selected Session reference only; never duplicates Session collection. Typed candidates come from safe owner metadata or developer-supplied exact refs; no legacy Chat recovery reads or provider calls. Refusal or limitation must be visible. Session UI may render statuses but must not infer completed WorkItem from applied Run. P9 tests cannot substitute for P10 real GUI evidence. No Phase 9 overall Green until 9E; no auto-activation of 9D/9E/Phase 10. Implementation requires separately approved `docs/planning/p9/phase-9c-activation.md`.
