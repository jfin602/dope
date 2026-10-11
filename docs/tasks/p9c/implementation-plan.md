# /prompt-plan — Phase 9C Session Workspace

**Status:** SOURCE-INSPECTED / EIGHT-PROMPT IMPLEMENTATION PLAN / NOT ACTIVATED
**Entry:** 9A Green 0.9.6/6b51ee96; 9B bounded Green 0.9.13/5aa0bac (25/25 focused tests and real local Qwen Planning-to-Work replay). Phase 9 overall NOT QUALIFIED.
**Versions:** P1–P8 = `0.9.14`–`0.9.21`; 13 root/app/package manifests and pinned `@dope/*` references are advanced by their assigned prompts, not by runner. P8 manual closeout needs a separate legitimate source/version candidate and evidence-only closeout.

## Concrete implementation seams
### P1 — Implement project-scoped Session frontend controller (T1)
**Files/owner:** New browser Session controller and new controller test.
**Implementation:** Create small packages/theia-extension/src/browser/developer-session-controller.ts using typed DeveloperSessionService attach/read/list/get/mutate/attachLink/detachLink/resolve proxy. Controller owns current single project root, opaque handle, snapshot, selected Session ID, loading/error/pending and request generation. Invalidate old async results and handles on project switch/dispose, preserving draft/conflict state without leaking it. Pass exact collection/session revisions; backend remains canonical; no new store, widget or UI mutation in P1.
**Validation:** Build extension lib only if compiled imports require it. Create test/unit/developer-session-ui-controller.test.ts registered exactly once in test:product; test attach, revision/stale conflict, superseded attach, two roots, dispose and no owner mutation. Run that focused test and git diff --check.
**Defer:** Widget/launcher P2; forms P3; membership P4; owner resolution P5; navigation P6; integration P7; GUI P8.

### P2 — Build center Session selector widget and launcher (T1)
**Files/owner:** New browser Session widget, frontend-module widget/command launcher wiring and UI widget test.
**Implementation:** Add independent center editor-area developer-session-widget.ts using P1 controller. Wire stable WidgetFactory ID, Sessions Command Palette action and left activity-bar launcher via supported Theia frontend-module.ts APIs. Repeated activation focuses one widget. Show current project Session list (title, actual status, update), compact filter, selection, empty/loading/error states, read-only objective/notes/next-actions and linked count. Respect Dope dark/light and neutral #336699 identity. Do not extend ChatPanelWidget or create owner panels.
**Validation:** Create test/unit/developer-session-widget.test.ts registered once. Check widget/command/launcher wiring, repeated-open idempotence, project-empty/error states and safe text presentation using focused tests. Build only changed extension lib, run widget test and git diff --check.
**Defer:** Editing P3, candidate/link UI P4, resolution P5, owner navigation P6, GUI P8.

### P3 — Add explicit Session metadata create and edit forms (T1)
**Files/owner:** Session widget/controller form state and focused UI tests.
**Implementation:** Provide New Session title/optional objective, rename, objective, notes and next actions editing in existing Session widget/controller. Save only on explicit developer action using backend SessionOperation and expected collection/session revisions. Enforce contract limits, visible pending/errors and conflict handling; preserve unsaved drafts until explicit reconcile/discard. Closed Session remains inspectable but read-only, with no automatic reopen/pause/close. Keep drafts scoped to project and Session ID; avoid autosave and new Session authority.
**Validation:** Extend controller/widget focused tests for create/edit and version checked persistence, malformed/oversize input, conflict-draft preservation, failed save and closed read-only behavior. Build touched extension lib only, run focused tests and git diff --check.
**Defer:** 9D guided pause/resume/closeout and derived progress; P4 links onward.

### P4 — Implement bounded artifact chooser and link operations (T2)
**Files/owner:** Small Session metadata candidate adapter/widget plus UI membership test; existing owner services only.
**Implementation:** Add existing-owner-backed candidate/known-selected-artifact UI for the seven supported SessionArtifactRef kinds: chat, planning-map, work-item composite, agent-task, agent-run composite, agent-sequence, project-mind decision/idea. Use safe owner metadata/selection, bounded lists and typed identities; NEVER invoke recovery-writing ChatRepository.read/unsafe Chat reads or copy Chat transcripts. If safe enumeration for a kind cannot be obtained, visibly say unavailable and report qualification gap instead of inventing items or broadening backend authority. Call existing Session attachLink/detachLink with exact ref/handle and revisions; duplicate no-op, shared links allowed, closed/stale/foreign denied, detach membership only. No direct Software Map references.
**Validation:** Add test/unit/developer-session-ui-membership.test.ts registered once. T2 cover owner-backed selection, ID composites, stale/missing/closed/foreign, shared/duplicate/detach and byte-unchanged owner sentinel files; test no recovery reads/model work. Run membership/controller focused tests, minimum extension build and git diff --check.
**Defer:** P5 resolution labels, P6 navigation, P8 GUI proof; no new cross-store index.

### P5 — Render owner-sourced linked artifact status accurately (T1)
**Files/owner:** Session widget's status projection/helper + focused view test.
**Implementation:** Group linked artifacts in Session overview using DeveloperSessionService.resolve results only; show exact target, small owner title/status, resolved/missing/stale/unavailable availability and grounded diagnostics. Keep WorkItem ready distinct from completed AgentRun, validation passed, developer Accept and applied candidate. Preserve missing links and safe detach. Cancel/ignore stale resolve results on project/selection change. Render untrusted titles/diagnostics as text; never fetch transcript/diff or imply owner writes/automatic execution.
**Validation:** Extend focused widget/resolution tests (new test/unit/developer-session-resolution-view.test.ts only if helper genuinely distinct; register exactly once). Cover 4 availability states, WorkItem ready after applied run, late resolution, no HTML/script injection, nonmutating projection; build extension lib if required and git diff --check.
**Defer:** P6 owner navigation, P7 integrated races; 9D activity/progress projection.

### P6 — Open existing Chat Planning Work and Project Mind views (T2)
**Files/owner:** Thin Session navigation adapter, existing Chat/Work/Planning/Mind widgets, focused navigation test.
**Implementation:** Build a thin developer-session-navigation.ts adapter using supported existing UI ownership. Chat uses ChatOpenOwners and ChatPanelController selection/focus; Work links use WorkOpenOwners and ChatPanelWidget.selectWorkLauncher for task/run/sequence; Planning Map/WorkItem use existing PhysicalMapWidget center and PlanningMapController.setMode/select/selectWorkItem; Project Mind uses ProjectMindWidget.openArtifact. Check project identity and exact target before claiming success. If precise deep link unsupported, only open normal owner view with honest message. Never create duplicate Chat/Work writers, execute AgentRun, rebase Planning or clone owner transcript.
**Validation:** Create test/unit/developer-session-navigation.test.ts registered once. T2 assert existing-owner reuse, same-project exact target, wrong-project/removed denied, Planning/Work selection and no task/run start. Run focused nav and changed UI tests after minimal extension build, git diff --check.
**Defer:** P7 restore/project switch guard; P8 direct GUI and keyboard navigation.

### P7 — Harden Session UI restoration project switching and regression (T2)
**Files/owner:** Existing Session UI integration and regression tests; no second domain.
**Implementation:** Integrate P1-P6 seams. Restore only verified project-scoped selected Session ID from workbench layout; never mirror authoritative Session data in layout. Ignore late reads/resolve/navigation/mutations after root change, dispose, selection change or handle invalidation; reject cross-root restored IDs and preserve/reconcile drafts safely. Verify closed Sessions, stale/conflicted revisions, no Session use, shared artifacts and independent owner-panel behavior. Fix only affected integration problems.
**Validation:** Run one bounded focused node --test of new Session controller/widget/membership/navigation and affected existing developer-session-contracts/store/backend/resolver/membership/integration tests after minimum changed-lib build/typecheck. Check root A/B, restart-simulated restoration, stale responses, closed/conflict and no owner writes or new AgentRun. Register test files only once; git diff --check. No GUI Green claim.
**Defer:** P8 real Theia GUI and 0.9.21 closeout; 9D/9E not activated.

### P8 — Real Session workspace GUI qualification and scoped closeout (T3)
**Files/owner:** Manual GUI evidence, version manifests, docs/tasks/p9c/closeout.md.
**Implementation:** MANUAL sole 9C closeout. Verify P7 committed 0.9.20 and create a separate legitimate exact 0.9.21 source/version checkpoint before evidence-only closeout. Directly operate a real Theia GUI with a disposable project and no AI: create/select/edit Session, attach representative actual Chat/Planning/Work/Mind links, duplicate/shared/detach, missing/stale/closed cases; navigate to original owner panels without second writers or implicit run; switch projects and restart/reopen; verify keyboard, dark/light and ordinary no-Session workflows. Check Session and owner-store bytes, backed statuses, stable IDs, versions and focused results. Write docs/tasks/p9c/closeout.md with exact source SHA, observed GUI steps/results, failed gates and 9C GREEN/NOT GREEN. No replacement of real GUI by headless tests; no Phase 9 overall Green claim.
**Validation:** T3 MANUAL real Theia browser GUI required; exact candidate, focused regression, screenshot/interaction notes, authority/isolation/restart checks and git diff --check. Full 9E Dope Builds Dope aggregate/native release not required for this bounded 9C closeout.
**Defer:** 9D rich progress and guided resume/closeout; 9E exact-candidate full GUI/aggregate; Phase 10.

## Efficiency and authority audit
Single seam per ordinary prompt; focused tests consume `packages/theia-extension/lib/browser`, so compile the changed extension lib once as required before tests, never blindly rebuild all packages or run nested aggregate. Existing 9A/9B Session tests retained, add new test paths exactly once in `test:product`. P7 is bounded T2 end-to-end controller/panel seam verification; P8 is sole manual T3 exact-candidate real GUI qualification. The original Phase 5 P11 Not Green/P12 unexecuted and Phase 8 Green are unchanged; 9D/9E and Phase 10 inactive. Authoring does not activate implementation: require `docs/planning/p9/phase-9c-activation.md`.
