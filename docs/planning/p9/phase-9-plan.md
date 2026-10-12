# Phase 9 Plan — Developer Continuity and History

**Status:** OWNER-APPROVED DESIGN REPLACEMENT / IMPLEMENTATION NOT ACTIVATED / PHASE 9 NOT QUALIFIED  
**Date:** 2026-10-11 (America/Chicago)  
**Authority:** ADR 0034 supersedes ADR 0033 for forward product development. Current source `0.9.22` / `0752415be76ef3f87e1a34bf17c4009a888be085`. Original 9A Green `0.9.6`, 9B Green `0.9.13`; historical Phase 5 P11 Not Green/P12 unexecuted and Phase 8 Green unchanged.

## Outcome

**History** is a small **right-toolbar/right-side panel** that automatically presents what happened and lets a developer continue their exact existing Chat, Work, Planning or editor state without creating or maintaining a Development Session. Preserve normal owner stores, existing views and no-AI use; do not substitute a hidden Session object.

### User experience

1. **Continue Where You Left Off:** top-of-panel action from a verified project-bound last meaningful focus record; fall back to a clearly labeled recent-activity suggestion if unknown. One click reveals the ordinary owning view, never executes a task.
2. **Recent Activity:** compact time-ordered owner-backed Chat interactions, tasks/runs/stacks, Dope-owned validation/review/promotions, Planning/WorkItem truth, Project Mind, Git commit and dirty snapshot and meaningful editor/view focus. Use real timestamps, distinguish snapshots from events, report unknown/unavailable and avoid false causality/progress.
3. **Understand Recent Work:** explicit opt-in local-first evidence summary with preview, provenance and separated fact/interpretation; no automatic provider calls, silent hosted fallback or AI context egress, and no mutation authority.

### UI and data architecture

- History launcher in **right activity bar** beside Chat/Work, one right-side panel; repeated activation reveals it. **Remove old left Sessions launcher and center Session workspace.**
- Derive bounded read-only data from current owner stores. Minimize new durable state: only project-scoped last meaningful focus if required. Don't copy transcripts/owner records or keep another canonical activity log. Chat owner metadata must be read without Chat recovery writes.
- Reuse normal Chat/Work single live owner, Planning Map independent view navigation, Project Mind and editor opening. Handle stale/missing/foreign targets, root switching, late responses and restart without retargeting or automatic execution.
- Keep useful with zero models and without manual artifact attachments or Session status/lifecycle.
- Phase 10 still exclusively owns continuous software knowledge alignment and any associated background local-model scheduler.

## Replacement implementation workstreams (NOT yet activated)

| Workstream | Goal | Required proof |
| --- | --- | --- |
| R — Retire Sessions | Remove Session UI/contracts/backends/store wiring after tracing consumers; preserve legacy files and opt-in read-only export/recovery | No residual Session runtime, no data deletion, normal Chat/Work/Planning regression |
| H — History panel | Right toolbar launcher, bounded truthful owner-readonly activity | Real right-panel appearance, correct provenance/time, no-write/no-model, project scope |
| C — Continue | Restore verified last meaningful focus; open real existing owner views | One-click exact owner, duplicate prevention, stale/foreign, restart/switch |
| U — Understanding | User-triggered local-first bounded contextual explanation | Context preview, no hosted fallback, source-backed fact vs inference, no side effects |
| Q — Final qualification | Real Theia GUI, restart, security, focused and final exact-candidate aggregate | Green/Not Green based on observed evidence |

Before implementation: `/prompt-ass` -> `/prompt-plan` -> `/prompt-write` for a **new bounded stack** based on actual `0.9.22` state, then a **separate owner activation**. Optimize ordinary implementation to <=8 minutes including focused tests, reserve real GUI/full aggregate for assigned gates. **Do not pre-bump to `0.9.23` simply because the retired P10 specified it.**

## Historical disposition (preserve source/evidence)

- 9A Session identity/persistence: **GREEN for bounded headless 9A** at `0.9.6` / `6b51ee96` (`docs/tasks/p9a/closeout.md`).
- 9B Session typed links/read-only owner resolution: **GREEN for bounded headless 9B** at `0.9.13` / `5aa0bac`, 25/25 focused tests, real accepted local Planning-to-Work replay (`docs/tasks/p9b/closeout.md`). This does not retroactively qualify Phase 5.
- 9C Session UI: **P1–P9 implemented** at consecutive committed versions `0.9.14`–`0.9.22`, last `0752415`; **P10 GUI closeout unexecuted**. Session 9C is SUPERSEDED, NOT QUALIFIED. The original activation and P1–P10 prompts remain historical records but must not be executed further.
- Original Session 9D/9E: **SUPERSEDED / UNEXECUTED**. A new final History/Continuity qualification replaces old Session-based dogfooding; no Phase 9 owner closeout is implied.
- Existing Session files in `.dope/development-sessions.json` are preserved without deletion/implicit migration. Developer-authored notes must remain recoverable by an explicit read-only export path.

**Phase 9 overall is NOT QUALIFIED.** No successor phase or source implementation is activated by these documentation edits.
