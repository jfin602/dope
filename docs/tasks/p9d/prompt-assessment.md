# /prompt-ass — p9d: Final Phase 9 Developer Continuity

**Status:** SOURCE REVIEWED / ASSESSED / NOT OWNER-ACTIVATED
**Entry:** coherent 0.9.22 / 0752415be76ef3f87e1a34bf17c4009a888be085. ADR 0034 approved design. Old 9A bounded Green at 0.9.6, 9B bounded Green at 0.9.13; Session 9C P1-P9 implemented through 0.9.22 but P10 unexecuted/superseded. Phase 9 overall NOT QUALIFIED.
**Final subphase:** p9d is the *last* Phase 9 subphase. No p9e; P13 is the sole manual final Phase 9 closeout. Phase 10 inactive.

## Source and risk assessment

- **Session retirement:** frontend-module.ts registers SessionsLauncherView/DeveloperSessionWidget; backend-module.ts registers DeveloperSessionBackend and DeveloperSessionStore RPC. The browser Session controller/navigation/presentation, Node store/resolver/candidates, contracts and tests are wired. P1 must establish standalone opt-in read-only v1/v2 export BEFORE P2 UI and P3 runtime removal. Historical evidence remains truthful; user .dope/development-sessions.json must not be deleted, rewritten or silently migrated.
- **Activity provenance:** Chat model has lastInteractedAt, but ChatRepository.peekMetadata currently exposes updatedAt only. ChatRepository.read/ChatBackend.read/list can perform recovery writes; History must use a safe bounded non-recovering metadata path. Planning, Project Mind, Agent and Git have distinct owner stores/status/time; Git working-tree dirty state is a snapshot, not a dated edit event. Accepted/applied AgentRun never automatically completes WorkItem.
- **Presentation/ownership:** RightChatLauncher and RightWorkLauncher use supported Theia AbstractViewContribution. History must be in the RIGHT activity toolbar/right panel, single widget, using current dark/light theme. Existing ChatOpenOwners, WorkOpenOwners, PlanningMapController, PhysicalMapWidget, ProjectMindWidget and editor owners remain authoritative. Wrong-project/late response, stale/deleted reference and restart require refusal, not substitution or execution.
- **Data footprint:** pure bounded History projection over owner metadata, not a new authoritative activity database or hidden Session. Persist only minimal project-local last meaningful focus if required; History viewing is not meaningful work.
- **Optional AI:** existing AIRoleRoutingService and ModelConnectionsRegistry support conversational generation; Understanding needs user-triggered preview/explicit confirmation, eligible local-only target, no hosted fallback/egress and no Chat/Agent mutation. No model requirement for ordinary History.
- **Qualification:** final one real Theia History GUI/restart/dogfood gate and one exact-candidate full npm run check, no synthetic Green. Retain Phase 5 Not Green/P12 unexecuted and Phase 8 Green history.

## Decomposition and model routing

| Prompt | Target | Tier | Model | Scope |
| --- | --- | --- | --- | --- |
| P1 | 0.9.23 | T2 | GPT-6 Sol High | Offline legacy v1/v2 export |
| P2 | 0.9.24 | T1 | GPT-6 Sol High | Remove Sessions frontend |
| P3 | 0.9.25 | T2 | GPT-6 Sol High | Remove Session backend/domain |
| P4 | 0.9.26 | T1 | GPT-6 Sol Medium | Pure History projections |
| P5 | 0.9.27 | T2 | GPT-6 Sol High | Chat/Planning/Mind read-only metadata |
| P6 | 0.9.28 | T2 | GPT-6 Sol High | Agent/validation/Git metadata |
| P7 | 0.9.29 | T1 | GPT-6 Sol High | Right toolbar History UI |
| P8 | 0.9.30 | T2 | GPT-6 Sol High | Last meaningful focus |
| P9 | 0.9.31 | T2 | GPT-6 Sol High | Exact owner navigation |
| P10 | 0.9.32 | T1 | GPT-6 Sol Medium | Evidence preview |
| P11 | 0.9.33 | T2 | GPT-6 Sol High | Explicit LOCAL understanding |
| P12 | 0.9.34 | T2 | GPT-6 Sol High | Integrated regression and safety |
| P13 | 0.9.35 | T3/manual | GPT-6 Sol High | Real GUI/full aggregate/final Phase 9 closeout |

## Efficiency and dependency assessment

P1 precedes destructive P2/P3. P4 precedes read-only adapters P5/P6. P7 presents owner activity; P8 stores optional focus; P9 opens exact owners. P10 only previews; P11 alone may invoke a local model. P12 is a bounded T2 integration; P13 manual T3 may take longer. Each ordinary T1 prompt targets <=8 minutes including minimal tests/build (10-minute soft/15-minute hard); T2 is explicitly justified where owner/security/restart boundaries cross. Prefer one narrow responsibility and split unexpected sprawl; no unconditional npm run check on ordinary prompts, no duplicated nested compilation. Register new focused tests exactly once and remove obsolete Session tests only with their subsystem. Final P13 owns full aggregate ONCE on exact candidate.

**Activation:** This assessment is not implementation approval. All P1–P13 require a separate explicit owner-approved docs/planning/p9/phase-9d-activation.md. P1 must move versions from actual 0.9.22 to 0.9.23 DURING implementation, not before. P13 must create a distinct real source/version 0.9.35 checkpoint before evidence-only closeout. No automatic Phase 9 owner-close or Phase 10 activation.
