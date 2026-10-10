# Phase 9 Plan — Development Sessions

Status: **DESIGN APPROVED / READY FOR PROMPT ASSESSMENT — NOT OWNER-ACTIVATED OR IMPLEMENTED**
Date: 2026-10-10
Entry: Phase 8 owner-closed Green at committed `0.8.47` source `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06` (`docs/planning/p8/phase-8-closeout.md`).
Provisional implementation baseline: `0.9.0` **only after separate owner activation/version approval**. No manifest is changed by planning.
Authority: ADR 0033, ADR 0017, 0025, 0028–0032, Product Model, Architecture, Stability Contract and Workflow.

## Goal and product contract

A Development Session is an **optional top-level organizational workspace** for one project development effort. It contains links to multiple existing Chats, Planning Maps/WorkItems, AgentTasks/AgentRuns/Prompt Stacks, validation, decisions and architecture. It offers objective, progress, recent activity, unresolved work, next actions, pause/resume and explicit closeout.

Sessions **reference existing truth**, never clone Chat, Planning, Agent or Project Mind records. A project may have multiple sessions; an artifact may be linked to multiple sessions. Non-session Chat, Planning, Work and IDE behavior remains fully available. Opening a session cannot execute work, widen permissions, alter WorkItem status or adopt architecture.

## Inspected entry substrate

- Chat uses project-local `.dope/chats`, stable IDs/revisions and single-panel ownership.
- Planning uses `.dope/planning-maps.json`, map/WorkItem identities, revisions, basis and explicit rebase/adoption. Phase 5 P11 final A–I replay was Not Green and P12 was unexecuted; this history is preserved.
- Agent Runtime persists AgentTasks/AgentRuns/AgentTaskSequences under `.dope/agent/` with grant, transcript, frozen candidate, validation/review and checkpoints. Reserved AgentTask `future-session` origin must **not** be repurposed for mutable membership.
- Project Mind owns decisions/ideas; Software Map owns architecture. Session UI derives their current evidence.
- No dedicated session store/service/workspace exists in qualified `0.8.47` source.

## Domain and persistence

Create a small versioned, project-scoped DeveloperSession with stable ID, canonical project identity, optimistic revision, title/objective, `active | paused | closed`, timestamps, bounded notes/next actions and explicit closeout. Typed links: Chat ID; Planning Map ID; WorkItem (map ID + WorkItem ID); AgentTask, AgentRun and sequence IDs; optionally Project Mind decision/idea and Software Map identities. Proposed single atomic project-local store: `.dope/development-sessions.json`. No duplicate cross-store membership indexes or Phase 3 Plan/Task compatibility.

Resolve links through existing owning stores; foreign-project/stale revisions fail closed, missing/stale links remain visible. WorkItem completion, AgentRun completion and passed Dope validation are separate progress facts. Session lifecycle never mutates linked records.

## Implementation workstreams (not prompt count)

### 9A — Identity and persistence
Provider-free parser/service/store; create, rename, pause, resume, close/reopen, revision-checked writes, project isolation and restart recovery. Demonstrate two sessions and ordinary no-session use.

**Prompt authoring update (2026-10-10):** The bounded `docs/tasks/p9a/` P1–P6 stack has been assessed, planned and written for this workstream, targeting `0.9.1`–`0.9.6` only **after** a separate owner-approved coherent `0.9.0` Phase 9 activation baseline. Its P6 is a headless 9A-scoped closeout, not full Phase 9 GUI/aggregate qualification. This update does not activate Phase 9, create any session, or bump `0.8.47`.

### 9B — Typed membership and resolution
Attach/detach Chats, Planning Maps/WorkItems, AgentTasks/AgentRuns/Prompt Stacks and decisions by typed ID. Resolve live status and missing/stale links without copying truth or executing work. Include **one targeted Planning-to-Work replay**: real Planning Map/WorkItem -> authorized existing AgentTask -> frozen Dope validation/review -> session projection. Repair only a directly evidenced seam; do not reopen all Phase 5 or rewrite its historical Not Green closeout.

### 9C — Session workspace
Compact session selector, overview, links to existing Chat/Planning/Work, activity, decisions and next actions. Use normal open/focus APIs, preserving Chat/Work single-panel ownership and independent center workspace. No new agent composer or canvas redesign.

### 9D — Resume and closeout
Restore sessions after restart/project switch without restarting AgentRuns. Truthful progress, unresolved/deferred items, decision links, explicit developer close/reopen and durable closeout. Closing a session never cancels or completes linked work.

### 9E — Dope Builds Dope qualification
Use a disposable Git worktree for one small real Dope feature: Session -> Chat -> Planning/WorkItem -> authorized Work -> frozen candidate -> Dope-owned validation/review -> restart/resume -> session closeout. Verify multiple links, shared artifacts, no-AI manual session, missing/stale refs, project isolation, existing non-session flows and no new authority.

## Qualification economy

- T1: <=8-minute focused implementation-plus-tests target (10-minute soft/15-minute hard), build only changed compiled dependencies if tests require `lib`. Do not run aggregate/browser/Electron on every prompt.
- T2: bounded cross-store/project/revision/restart/authority integration and targeted Phase 5 Planning-to-Work replay. Never defer a required safety check beyond an unsafe intermediate state.
- T3: one real Dope Builds Dope GUI feature, exact-candidate passing `npm run check` plus separate necessary restart/security proof; preserve all failed observations. Green requires direct evidence, not just stored references.

No new agent runtime, mandatory sessions, provider-native session state, automatic AI context, silent hosted fallback, WorkItem auto-completion, architecture auto-adoption, Phase 10 background alignment or Phase 9-to-10 auto-advance.

## Activation

**Phase 9 is NEXT / NOT ACTIVATED.** A separate explicit owner instruction must authorize implementation from coherent `0.8.47` source (or accepted successor), version policy and optimized `/prompt-ass -> /prompt-plan -> /prompt-write p9` stack. Planning approval alone does not authorize `0.9.0` or execution. Final Green/Not Green is a separate evidence closeout and terminal docs reconciliation; Phase 10 needs its own activation.
