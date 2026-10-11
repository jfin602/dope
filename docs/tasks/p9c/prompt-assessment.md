# /prompt-ass — Phase 9C Sessions UI

**Status:** SOURCE REVIEWED / EFFICIENCY-AUDITED / NOT OWNER-ACTIVATED
**Entry:** 9A scoped Green `0.9.6`; 9B scoped Green `0.9.13` / `5aa0bac` (25/25 focused and real authorized Qwen replay). Phase 9 overall NOT QUALIFIED.
**Authority:** ADR 0033/0025, `docs/planning/p9/phase-9c-plan.md`, Phase 9 stability requirements.

## Grounded risks and responsibilities

- Existing `DeveloperSessionService` + backend already own atomic Session v2, project handles, expected revisions, typed membership and non-mutating compact resolve. Frontend only; no second domain/store.
- `frontend-module.ts` and Theia WidgetFactory/CommandContribution own shell entry; large `chat-panel-widget.ts` is not the Session UI. ChatOpenOwners/WorkOpenOwners enforce one writer; existing PlanningMapController and ProjectMindWidget own their views.
- ChatRepository.read can perform recovery writes; **separate** generic attach/detach actions (P4) from safe owner candidate discovery (P5). Unsafe candidate read = unavailable/qualification gap, never implicit recovery.
- **Split** Chat/Work navigation (P7) from Planning/Project Mind navigation (P8); each uses different existing ownership/selection APIs. Never silently execute Work or rebase Planning.
- P1/P9 must guard late responses, stale handles, project root switches, conflicts, unsaved drafts, restart layout and closed records. v2 supports seven reference kinds, not direct Software Map ID.
- 9C renders actual status and diagnostics, never fabricated progress; 9D owns rich progress, resume and guided closeout, 9E full Dope Builds Dope.

## Bounded prompt allocation

| Prompt | Target | Tier | Model | Owner |
| --- | --- | --- | --- | --- |
| P1 | `0.9.14` | T1 | GPT-6 Sol High | Implement project-scoped Session frontend controller |
| P2 | `0.9.15` | T1 | GPT-6 Sol High | Create center Session widget selector and launcher |
| P3 | `0.9.16` | T1 | GPT-6 Sol Medium | Add explicit Session create and metadata editing |
| P4 | `0.9.17` | T1 | GPT-6 Sol High | Add typed Session membership attach and detach actions |
| P5 | `0.9.18` | T2 | GPT-6 Sol High | Browse existing artifacts without unsafe owner reads |
| P6 | `0.9.19` | T1 | GPT-6 Sol Medium | Render truthful linked artifact resolution in Session overview |
| P7 | `0.9.20` | T2 | GPT-6 Sol High | Navigate Chat and Work links through existing owners |
| P8 | `0.9.21` | T2 | GPT-6 Sol High | Navigate Planning Maps WorkItems and Project Mind links |
| P9 | `0.9.22` | T2 | GPT-6 Sol High | Qualify Session UI state isolation and restoration seams |
| P10 | `0.9.23` | T3/manual | GPT-6 Sol High | Real Session workspace GUI qualification and scoped closeout |

## Prompt Efficiency Gate

P1–P8 each own one primary coherent seam targeting <=8 minutes implementation and focused tests (10-minute soft, 15-minute hard). P5/P7/P8 are justified bounded cross-owner T2 checks, not full aggregate. P9 is targeted T2 integration; P10 sole manual T3 direct GUI and closeout. Only compile changed extension lib needed by tests that import `lib/browser`; register new test paths once in `test:product`; do not append unconditional npm test / npm run check, browser/Electron packaging or provider calls to ordinary prompts. Never waive isolation, revision or owner-write checks to meet time. Separate 9C activation required; no 9D/9E/Phase 10 activation.
