# ADR 0033 — Optional Development Sessions and Linked Work

Status: **Accepted design / Phase 9A subsequently owner-activated 2026-10-10; implementation and qualification pending**
Date: 2026-10-10
Depends on: ADR 0005, 0017, 0025, 0028–0032
Entry: Phase 8 owner-closed Green at committed `0.8.47` source `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06`.

## Context

Chat, Planning Maps, WorkItems, AgentTasks, AgentRuns, Prompt Stacks, validation and Project Mind decisions already have independent Dope-owned stores, identities and lifecycles. A developer needs a durable, comprehensible *effort* that spans them. Phase 5 Planning was owner-closed for sequencing with an unqualified P11 end-to-end replay and unexecuted P12; Phase 9 must qualify the affected Planning-to-Work seam, not retroactively relabel Phase 5 Green.

## Decision

1. **Optional workspace:** A project may contain many DeveloperSessions. Selecting a session is optional and does not start an agent, grant permissions or change source. Chat, Planning and Work remain usable without a session.
2. **Owned state:** Session ID, canonical project identity, schema/revision, title, objective, timestamps, status (`active | paused | closed`), developer notes, next actions and explicit closeout. Session status never implies WorkItem completion, successful validation, canonical architecture adoption or AgentRun completion.
3. **Typed references, not copies:** Link multiple Chats, Planning Maps, WorkItems (map ID + WorkItem ID), AgentTasks, AgentRuns, AgentTaskSequences, Project Mind decisions/ideas and Software Map identities. Resolve current status and evidence from authoritative owning stores. Do not copy chat transcripts, planning graphs, run histories, validation results or accepted decisions. An artifact may appear in multiple sessions without duplicate execution or conflicting ownership.
4. **Membership is not origin or authority:** Attaching/detaching a task does not rewrite its AgentTask `origin` (including reserved `future-session`), ExecutionGrant, model, WorkItem scope, validation policy, Git basis or checkpoint. Sessions never authorize or auto-start work. Future session-origin execution still requires the ordinary Dope-owned task/grant/validation/review path and is not needed for the Phase 9 baseline.
5. **Project isolation and missing links:** Validate project identity and stable typed IDs at attach/resolve. Reject foreign project, malformed paths and stale revisions. Missing, deleted, moved or stale-basis targets remain visibly unresolved; do not silently substitute another artifact, delete session history or mutate the source object.
6. **Versioned project-local store:** Propose `.dope/development-sessions.json`, atomic writes, optimistic revisions and a documented recovery path without requiring a working Dope UI. Session membership is owned only here; derive inverse links rather than adding mutable backpointers to Chat/Planning/Agent stores.
7. **Truthful progress:** Display WorkItem completion, AgentRun terminal status and Dope-owned validation as distinct sourced facts. A model claim or completed AgentRun cannot mark a WorkItem done. Session notes are developer-authored; accepted Project Mind decisions remain owned by Project Mind.
8. **Existing navigation and UI ownership:** Session workspace opens/focuses normal Chat, Planning and Work panels; preserve single live panel ownership for Chat/Work and independent center editor/visual state. It is not a second transcript, planning editor or agent runtime.
9. **Bounded AI context only:** Session membership never automatically feeds project data to models. Any later session-aware context must be explicitly selected, previewed, bounded, project-scoped and subject to existing provider/egress authority; no ambient model calls or silent hosted fallback.
10. **Independent closeout:** Pause, close, reopen, detach or delete a session without cancelling AgentRuns, deleting Chats, completing WorkItems, changing Git or promoting candidates. Closeout records achieved, unresolved and deferred outcomes and links to actual validation evidence.

## Consequences and qualification

Phase 9 introduces one small Dope-owned session domain/service/store and a navigation/projection UI. It does not create another Plan/Task ontology, authorization system or provider-specific database. A session must work without AI. Qualify a real PlanningMap -> WorkItem -> existing AgentTask/AgentRun -> Dope-owned validation/review replay, multiple linked artifacts, missing/stale references, restart, project isolation, independent non-session workflows and explicit closeout. Use one real Dope Builds Dope feature for final T3; preserve Phase 5's original Not Green evidence.

Rejected: mandatory sessions, copying authoritative state, session membership as task origin, auto-execution on session open, synthetic progress truth, silent architecture adoption and new agent authority.

**This ADR is design authority only.** It does not activate Phase 9, create `0.9.0`, qualify session behavior, close older evidence gaps or activate Phase 10.

**Later activation note (2026-10-10):** The owner separately authorized 9A implementation in `docs/planning/p9/activation.md`. ADR acceptance alone was not activation. 9B–9E and Phase 10 remain inactive; no session behavior is qualified by this note.
