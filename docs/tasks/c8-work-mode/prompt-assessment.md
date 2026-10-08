# c8-work-mode - Prompt assessment

Status: Approved documentation applied; implementation prompt stack authored, not run.
Required Dope version: 0.8.20 (unchanged correction).

## Problem and goal

Real Phase Stack runs completed Green on Adaptive SEO, but the Agent Run panel still renders generic process/status events instead of the provider-visible agent transcript. The Codex adapter currently emits an occurrence-only `agent-message`; AgentExecutionRuntime replaces message text with "Agent message received", and AgentRunController retains only an in-memory 300-event tail. The Agent Run widget is a singleton main-area UI, while Phase Stack is another singleton main-area UI. Chat already supports reusable panels, multi-area placement, durable independent Chats, ownership, safe rich transcript, scroll follow and restart restoration.

The approved new product vocabulary is **Work** and **Prompt Stack**. The main objective is one Chat-like movable panel shell with Chat | Work navigation, whose Work view is a presentation of existing durable agent records with user-visible transcript and minimal command history. No new mutation model.

## Preserved invariants

- ADR 0025 Chat ownership/leases, settings, Interactive role and read-only capabilities remain intact.
- ADR 0027 AgentTask, AgentRun, AgentTaskSequence, PhaseStackAdapter and grant identity remain canonical internally.
- ADR 0028 isolated provider work, CandidateDelta, Authority and Dope-owned promotion remain unchanged.
- ADR 0029 required validation is Dope-owned; observed provider commands cannot satisfy CompletionPolicy.
- Existing Prompt Stack grammar, fingerprints, checkpoint subjects, phase/correction version policy, accepted dirty basis and manual/browser gate reconciliation remain unchanged.
- No hidden reasoning, raw RPC payloads, credentials, arbitrary environment/private absolute paths or unbounded output is durably stored.
- Existing run/event JSONL remains readable without invented lost transcript history; corrupted/future state fails closed.
- Workspace change, panel close, toggle and restore cannot cancel active work or fork a task/run.

## Dependencies and order

1. P1 gives transcript persistence and paginated read contracts separate from operational events.
2. P2 adapts Codex visible messages/command data without widening provider capabilities.
3. P3 projects adapter observations into ordered Dope-owned transcript, with restart/retention invariants.
4. P4 installs shared Chat/Work panel mode and single-work ownership before allowing placement/navigation.
5. P5 adds Work selection of saved runs and discovered Prompt Stacks, with deterministic titles.
6. P6 renders an execution-first transcript view with minimized commands, safe Markdown and scroll follow.
7. P7 integrates toolbar/command entry and the direct Work composer, retaining legacy actions.
8. P8 proves cross-panel, restoration, streaming/selection and old API compatibility.
9. P9 performs real GUI and historical-sequence qualification and owns final disposition.

## Validation tiers and effort

Each P1-P8 is bounded to a <=8 minute target / 15 minute hard budget. Do not append a full `npm run check` to every prompt. T1 = focused altered tests and affected build/typecheck. T2 = the smallest cross-boundary integration test set, with browser build when integration affects workbench compilation. P9 T3 owns the full aggregate `npm run check`, real GUI (Electron/browser as available), restart and final closeout. The command runner's exact prompt grammar is validated once after writing.

## Risk review

1. Complete visible text vs sanitization: redact only unsafe spans, preserve ordinary messages and mark truncation explicitly. No hidden reasoning or raw provider messages. Avoid unbounded output.
2. Start/completed command races: stable IDs, ordering, interrupted commands and provider reconnect; preserve one command logical item.
3. Transcript persistence migration: old runs reopen with existing operational events and an honest "transcript not recorded for this run" state, not reconstructed synthetic prose.
4. Panel architecture: avoid copying ChatPanelWidget into Work; reuse presentation helpers/owner behavior and separate underlying services. Same Work opens once; different Work remains independent.
5. Work/run/sequence identity: stable per-project selection keys; do not title historical run using sequence's mutable current entry.
6. Browser/desktop UX: narrow areas must show compact command rows without forced scroll; fixed title and input must remain usable.
7. New Work input: permitted to initiate new direct task under existing explicit grant; no automatic mid-run prompt steering.
8. Migration: retain old Agent Run/Phase Stack command IDs as aliases. Do not mutate stored task records or legacy Git commits.
9. External regression: preserve the four Adaptive SEO checkpoints and no new commits to its qualification repo.

## Deferred

WorkItem-derived delegation, ProposedAction escalation/review, arbitrary live steering, DevelopmentSession, provider sandbox and required-validation redesign, global cross-project work search, full Chat/Work unified persistence, production Adaptive SEO integration checks, and large UI styling redesign are excluded.

## Closeout threshold

Green requires P1-P8 focused evidence plus P9 real GUI transcript/command rendering, toolbar/multi-location placement, duplicate-owner focus, restarts, existing completed Prompt Stack title/selection, and unchanged authority/validation. Historical Phase 8C Green cannot substitute for the new UI proof.
