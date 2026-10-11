# /prompt-ass — Phase 9C Session Workspace

**Status:** SOURCE-REVIEWED / TASK DECOMPOSITION RECORDED / NOT OWNER-ACTIVATED
**Entry:** 9A Green 0.9.6/6b51ee96; 9B bounded Green 0.9.13/5aa0bac (25/25 focused tests and real local Qwen Planning-to-Work replay). Phase 9 overall NOT QUALIFIED.
**Authority:** `docs/planning/p9/phase-9c-plan.md`, ADR 0033 and 0025, stability contract.

## Source-grounded assessment
- `developer-session-service.ts` and backend already provide atomic v2 Session CRUD, typed attach/detach, read-only owner resolve, per-project handle and revision checks. No new Session store/backend execution authority.
- `frontend-module.ts` has Theia WidgetFactory/CommandContribution and side Chat/Work launchers but no Session presentation. Keep Session controller + widget small rather than adding to large `chat-panel-widget.ts`.
- `ChatOpenOwners` and `WorkOpenOwners` ensure one live writer; normal ChatPanel/Work open commands, `PlanningMapController.select/selectWorkItem` and `ProjectMindWidget.openArtifact` are navigation seams. Must not duplicate panels.
- ChatRepository.read may perform recovery writes. Session candidate discovery must use already selected, safe metadata paths; no recovery-writing Chat list, copied transcript, unbounded candidate index or unsafe synthetic chooser. If a kind is unavailable, report gap.
- Async project-root attach/switch is a race. Guard stale responses, revision conflicts, layout restoration, closed Session, draft scope, and project isolation.
- UI truth uses only v2's seven reference kinds. Show missing/stale/unavailable and distinct WorkItem/run/validation/review/applied states; applied run may leave WorkItem ready. Software Map direct refs excluded.
- Accessibility, keyboard, theme neutrality and untrusted text rendering are current UI requirements. 9D rich progress/resume and 9E full Dope Builds Dope remain deferred.

## Prompt ownership and model routing
| Task | Target | Tier | Model | Owner |
| --- | --- | --- | --- | --- |
| P1 | 0.9.14 | T1 | GPT-6 Sol High | Implement project-scoped Session frontend controller |
| P2 | 0.9.15 | T1 | GPT-6 Sol High | Build center Session selector widget and launcher |
| P3 | 0.9.16 | T1 | GPT-6 Sol Medium | Add explicit Session metadata create and edit forms |
| P4 | 0.9.17 | T2 | GPT-6 Sol High | Implement bounded artifact chooser and link operations |
| P5 | 0.9.18 | T1 | GPT-6 Sol Medium | Render owner-sourced linked artifact status accurately |
| P6 | 0.9.19 | T2 | GPT-6 Sol High | Open existing Chat Planning Work and Project Mind views |
| P7 | 0.9.20 | T2 | GPT-6 Sol High | Harden Session UI restoration project switching and regression |
| P8 | 0.9.21 | T3/manual | GPT-6 Sol High | Real Session workspace GUI qualification and scoped closeout |

P1–P6 focus one bounded owner seam at a time with <=8-minute implementation-plus-focused-validation target (10-minute soft, 15-minute hard). P4/P6/P7 need focused T2 integration; P8 alone owns manual real Theia GUI T3. Build touched extension libs only for compiled-output tests, register new test files once in root `test:product`, avoid nested `npm run check`/full browser/Electron/native work per ordinary prompt. Do not trade safety for prompt duration. No 9C activation until separate owner record.
