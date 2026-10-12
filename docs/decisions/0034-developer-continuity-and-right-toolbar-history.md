# ADR 0034 — Developer Continuity and Right-Toolbar History

**Status:** ACCEPTED PRODUCT DESIGN / SUPERSEDES ADR 0033 FOR FORWARD DEVELOPMENT / NOT IMPLEMENTED OR QUALIFIED  
**Decision:** 2026-10-11 (America/Chicago), owner-approved through `/docs-review` and `/docs-apply`  
**Entry:** Committed Dope `0.9.22` / `0752415be76ef3f87e1a34bf17c4009a888be085`. Original 9A bounded Green `0.9.6` / `6b51ee96`; 9B bounded Green `0.9.13` / `5aa0bac`; Phase 9 overall NOT QUALIFIED. Original 9C P1-P9 reached `0.9.22`; P10 was unexecuted.  
**Relevant authority:** ADR 0017 (Planning), 0023 (future continuous knowledge alignment), 0025 (durable Chat and single owner), 0028–0032 (agent execution, validation and developer review).

## Problem and decision

Manual Development Sessions ask the developer to create, name, link, maintain and close another object while Chat, Planning, Work and Project Mind already organize the project. They add management overhead without a corresponding improvement to resuming work.

**Replace the Development Sessions product concept with Developer Continuity.** The product keeps the developer's *ongoing work and understanding* continuous, without requiring a Session entity or workflow. Existing owner domains remain independent, and no new Session-like hidden grouping system replaces the deleted feature.

### 1. History in the right toolbar

- A clearly labeled **History** clock/recents button belongs in the **right activity toolbar**, alongside the existing Chat and Work launchers. Use supported Theia shell/view APIs and one right-side panel; repeated opening focuses the existing panel, not duplicate widgets. Remove the legacy **left Sessions** launcher and center Sessions workspace during retirement.
- At top: a prominent **Continue Where You Left Off** target. Below: a compact chronological **Recent Activity** list. Below or alongside: explicit **Understand Recent Work** action.
- Make the panel work without AI, honor dark/light theme, accessible keyboard/focus, limited right-sidebar width and existing view ownership. Clicking History entries navigates to ordinary Chat, Work, Planning or editor views, without copying their UI or creating a second writer.

### 2. Factual automatic activity context

- Derive a **read-only bounded** recent-activity projection from authoritative project records: Chat IDs/titles/`lastInteractedAt` (not mere viewing), AgentTasks/AgentRuns/sequences and real validation/review/applied status, PlanningMap/WorkItem revisions and state, relevant Project Mind decisions/ideas, Git commits and current working-tree snapshots, and explicit workbench focus/restoration evidence.
- Project root/identity must scope every query, timeline and navigation. A Git diff is a current **snapshot**, not evidence for when or by whom an edit occurred. A completed/accepted Run is not automatically a completed WorkItem; a validation pass is not a candidate promotion. Missing timestamps/cause remain unknown, never invented.
- Do not build a second authoritative activity/event database, replay raw transcripts into History, copy source data, record every keystroke, or run recovery-writing reads such as ChatRepository.read for routine History inspection. Only minimal **last meaningful focus** metadata may be persisted, project-scoped, if existing layout/owner state cannot supply it. Do not silently mutate the owner stores.
- Refresh on panel opening and relevant existing change notifications with bounded work. No continuous LLM polling, expensive full-project reanalysis or hidden background agent.

### 3. One-click continuation

- Restore exact verified project-local **last meaningful focus** into its existing owner view. When no verified focus exists, offer a clearly labeled best recent-activity **suggestion** rather than pretending to restore something.
- Respect Chat/Work single-owner focusing, Planning Map independent navigation and ordinary editor layout; do not start/resume AgentRuns. Missing, stale, moved, foreign-project or unsupported targets remain truthful and actionable, never silently swapped with similar titles.
- Ordinary Chat, Planning, Work, IDE and Project Mind function normally without History.

### 4. Contextual understanding is optional

- **Understand Recent Work** is an explicit developer action. Provide a compact, bounded, inspectable evidence/context preview before inference; use eligible **local-first** model through existing Model Runtime/role policy, subject to developer approvals.
- Explain what was observed, possible significance and unresolved unknowns, with links to evidence; model assertions never become owner truth. No model requirement for History, no on-open automatic inference, no silent local-to-hosted fallback or hosted project-data egress (requires separate explicit developer consent). No Git/source edits, task grants, WorkItem completion, Architecture adoption or Project Mind decisions from an explanation.
- **Phase 10** remains the separate, inactive Living Software Knowledge Model and background source/docs/contracts/Architecture alignment system. History does not pre-activate its scheduler.

## Retire Sessions without destroying user data

- The existing Sessions left launcher, center widget, manually attached artifact lists, metadata/lifecycle editors and Session-only backend/service/store/contracts/tests should be removed through a bounded **dependency-reviewed implementation**, not merely hidden. Reuse independent owner metadata resolvers/navigation primitives only when they provide value without the Session ontology.
- Existing `.dope/development-sessions.json` v1/v2 may contain developer-authored objectives, notes and next actions. **Never delete, overwrite, silently migrate or inject its content into AI context.** Preserve the original bytes and design a bounded opt-in **read-only export/recovery** path before permanently retiring access; any promotion into Project Mind is separate explicit user action.
- Original 9A and 9B Green at `0.9.6` and `0.9.13` is true *historical scoped evidence*, not qualification of History. Historical Phase 5 P11 Not Green/P12 unexecuted and Phase 8 owner-closed Green remain unchanged.
- Original 9C was owner-activated and P1-P9 committed through `0.9.22` / `0752415`, but **P10 manual GUI closeout was never run**. It is now **SUPERSEDED / UNQUALIFIED**, not retroactively Green or a code failure. **Stop the historical p9c stack and do not bump to `0.9.23` for P10.** Original 9D/9E Session designs are superseded/unexecuted; Phase 9 overall is NOT QUALIFIED.

## Qualification and authorization

A **new task assessment/plan and separate explicit owner implementation activation** must precede source changes. The task stack must prove, on an exact version/source checkpoint: old Session runtime/UI is retired and legacy data can still be recovered; right-toolbar History works in a real Theia GUI; activity and timestamps are sourced/non-mutating; exact focus/navigation survives restart and project switch; no duplicate Chat/Work owner, automatic AgentRun or hosted egress; optional local-only explanation with clear factual/interpretive boundaries; no-AI operation, focused regression and final appropriately scoped aggregate. Failure or missing GUI proof is **NOT GREEN / Evidence Gap**.

This ADR and `/docs-apply` authorize **documentation changes only**. At the recorded baseline `0.9.22`, Session UI/backend still exists. No source deletion, new package version, Phase 9 Green, Phase 10 activation or replacement implementation is claimed.

## Forward compatibility — ADR 0036 (2026-10-12)

Roadmap checkpoint links can navigate real History/Work/Planning/Chat evidence but cannot infer Green or event chronology from History snapshots. Keep History read-only and avoid new manual or hidden Session containers. Phase 9 `p9d` and legacy Session export/qualification stay separate. Phase 10 Roadmap remains unimplemented; former Living Software Knowledge Model becomes inactive Phase 11.
