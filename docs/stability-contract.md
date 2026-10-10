# Dope Stability Contract

Status: INITIAL STABILITY CONTRACT

Dope combines an IDE, persistent project knowledge, and eventually model inference, tool execution, and deeper framework integration.

Reliability includes software correctness, state truth, developer understanding, and containment of unintended effects.

## Phase-aware qualification

Stability requirements apply when the corresponding capability exists in the approved phase.

A future invariant remains an architectural requirement, but it does not authorize premature implementation merely so it can be tested.

For each task or phase:
1. identify which capabilities actually exist
2. apply the stability sections relevant to those capabilities
3. preserve future invariants at interface boundaries
4. do not build deferred subsystems solely for qualification

Foundation Spike 0 is a completed Theia substrate qualification. Its evidence remains authoritative for the bounded substrate claims recorded in `docs/tasks/p0/closeout.md`.

The retained Phase 1 — IDE Alive stability concerns are:
- native Electron startup/package viability plus ordinary interactive Theia workbench behavior;
- repository/workspace opening and restoration;
- editor/language-service behavior;
- Explorer/search;
- terminal;
- Git/SCM and diffs;
- debugger and Problems;
- test integration;
- preferences/keybindings;
- extension installation, function, and restart persistence;
- dark-first default theme plus persistent explicit user theme override;
- workbench layout/editor restoration;
- fresh-environment Linux packaging and launch;
- real dogfooding on the Dope repository without requiring another IDE for ordinary development.

Agent State, Agent Runtime, model/provider execution, tool authority, AI mutation, scoped delegation, production Project Mind, and production Planning are not Phase 1 qualification requirements.

## States

- Implementation complete — intended behavior exists and the validation tier assigned to that implementation prompt is Green.
- Stability qualified — applicable integrated framework/model/tool/persistence/UI evidence required by the qualification gate is Green.

Evidence outcomes:
- Green
- Not Green
- Evidence Gap

Evidence Gap is not a pass.

## Canonical state truth

Canonical product state must be distinguishable from UI layout, framework state, provider-native continuation/session state, generated narration, cached search/index projections, inferred architecture, and provisional model proposals.

Only state types introduced by the current phase need executable coverage.

A crash, restart, provider failure, or UI reconstruction must not silently convert derived state into canonical truth when those mechanisms exist.

## Bootstrap independence and self-development recovery

Self-development must never create a hidden privileged path or make the repository dependent on a healthy Dope runtime for repair.

When the corresponding capabilities exist, qualification should verify:
- the Dope repository remains inspectable and editable with conventional external tools;
- Git history and ordinary build/test entry points remain usable outside Dope;
- durable canonical project knowledge has a documented backup/export/recovery path independent of a healthy GUI path;
- self-targeted agent work receives the same observation/mutation authority as equivalent work on another repository;
- upgrade or migration failure leaves a recoverable fallback path;
- self-development evidence is not generalized into compatibility claims for unrelated stacks without separate evidence.

Foundation Spike 0 does not need to self-host. It only needs to preserve these architectural boundaries so later phases can qualify them without redesigning the foundation.

## Developer-understanding invariant

Qualification is not purely "the feature works."

For product workflows that expose objectives, plans, ownership, assumptions, conceptual changes, validation, or durable knowledge, evidence should show that the developer can inspect the applicable state.

Do not require future Agent Mind fields during phases that do not yet implement Agent Mind.

A faster autonomous path that hides applicable developer-facing state without an explicit autonomy choice can be a product regression.

## Project Intelligence persistence

Durable artifacts require stable identity, schema version, provenance, relationships, restart survival, explicit migration, and defined corruption/failure behavior as those features are introduced.

A persistence backend can be replaced without redefining the domain.

For Foundation Spike 0, qualification is deliberately minimal:
- persist a minimal ProjectArtifact or Note
- preserve stable identity and basic provenance
- restore it after application restart
- render it through a Dope-owned view
- keep the persisted representation independent from Theia-owned workspace/chat state

The spike does not need the full Project Mind schema or final persistence backend.

## Product Phase 2 — Project Mind qualification

Phase 2 is approved/activated by the explicit owner sequencing waiver recorded in BOOT and `docs/planning/p2/activation.md`. Phase 1 remains Not Qualified; the waiver permits sequencing only and does not waive Phase 2 qualification. Qualification applies once the capability is implemented; future AI/Planning/Session concerns remain deferred.

Require executable evidence for:
- all four artifact types, validation, lifecycle actions, reversible archival, identity/provenance/timestamps and links;
- explicit, idempotent spike Note migration preserving original bytes and IDs, with honest unknown timestamps and no duplicate imports;
- empty/read-only projects without implicit writes, corrupt/unsupported state refusing mutation, and recoverable failed writes/migration;
- expected-revision conflicts, cross-process write exclusion, abandoned-lock recovery and preserved drafts;
- backend root/handle validation, separate local projects, traversal/symlink containment, and missing link targets;
- framework-independent domain/query tests; basic search has deterministic results and is recomputable;
- delayed save/load/event responses across workspace switches, close/dispose cleanup, and unsaved-draft protection;
- real backend/application restart, project reopen, and storage continuity independent of UI layout/profile;
- external inspection/backup/recovery with writers stopped;
- browser/Electron builds and produced Electron package/resources/native-launch evidence for the resulting candidate.

Directly exercise the real Theia GUI on the Dope repository: create and edit Notes/Ideas/Questions/Decisions, answer/accept/archive/link/filter/search, preserve unsaved work, restart/reopen, inspect recovered knowledge and verify a second local project cannot see or mutate it. Use actual developer-entered Dope context; no automatic ingestion or privileged self mode. Verify keyboard access, dark-first presentation and readable explicit light override. Headless/CDP instrumentation is supplemental. Preserve pre-existing Git state; record intended `.dope` knowledge changes separately from controlled source probes, which must be restored.

Preserve all failed observations and Evidence Gaps. A stalled workbench is a qualification failure even if domain tests pass. A saved-state claim requires committed durable bytes, not a frontend notification. The Phase 2 exit decision must audit exact source/package/GUI candidates and remaining inherited gaps.

## Product Phase 7 — Durable Chat and AI Presence qualification

Phase 7 qualification applies when the durable Chat/ChatPanel and general Model Runtime capabilities exist. Chat durability is project context durability, not promotion into canonical project truth.

Require executable evidence for:
- readable/versioned `.dope/chats/` persistence with stable Chat/message identity, timestamps, automatic/user titles and nested folder organization;
- moving/renaming Chats/folders without changing Chat identity, and deterministic ordering by actual last interaction rather than view/restoration;
- project isolation, path/symlink containment, malformed/unsupported-state fail-closed behavior, recoverable write failure and stale-revision/cross-process writer protection;
- multiple ChatPanels in different supported workbench areas sharing one Chat repository without data forks;
- the one-Chat/one-live-panel invariant, including focus-existing behavior and deterministic restart restoration when stale layout state references the same Chat twice;
- Select Chat and Chat modes surviving ordinary panel recreation without making workbench layout the source of conversation truth;
- persistent per-Chat settings remaining attached to Chat identity across panel relocation/restart;
- the two-row composer, per-turn context controls and compact connected-model selector;
- per-message model routing through provider-independent Model Runtime capability discovery, with actual provider/model provenance recorded per execution;
- changing models between turns inside one Chat without forking/reconstructing conversation state;
- explicit failure when the selected model is unavailable or fails; no silent provider/model fallback;
- streaming/cancellation/timeout/malformed response/provider restart leaving an honest failed/incomplete turn without corrupting prior messages or canonical project state;
- bounded context composition from editor/project state, Project Mind, Architecture, Physical Map, Flow, Planning Maps/WorkItems and explicitly/retrieval-selected saved Chats;
- context provenance sufficient to inspect relevant supplied project references without persisting hidden provider chain-of-thought;
- `.dope/chats/` writes remaining excluded from generic analysis inputs, Physical Map input fingerprints and Planning Map staleness;
- provider credentials/endpoints/global model configuration remaining outside project Chat persistence;
- direct GUI dogfooding on the Dope repository using more than one ChatPanel and, where the configured environment permits, more than one connected model in the same durable Chat.

A Chat response is not evidence that a referenced source/Architecture/Flow/Planning fact is true. Existing domain provenance remains authoritative. A model-generated title, summary, explanation or suggestion is conversation output until explicitly promoted through the appropriate developer-controlled product workflow.

Phase 7 qualification does not require mutation tools, ProposedAction execution, autonomous coding or Scoped Delegation.

### Phase 7B — AI Center qualification

Require executable evidence for:
- AI Center opening/revealing as one logical singleton management surface from the bottom-left AI launcher while account/profile remains available under Settings;
- immutable connection identity surviving alias/endpoint/non-secret configuration edits;
- multiple same-provider/runtime connections without identity collision;
- Disabled preserving identity/configuration and Remove preventing new use without corrupting historical execution provenance;
- one logical machine-local/application-global registry visible across projects and, where supported by the runtime topology, multiple Dope windows/processes;
- revision conflict rejection, cross-process writer exclusion and live update propagation rather than last-writer-wins preference races;
- registry usability without an open project and repository copy/clone having zero effect on global connection inventory;
- no connection/model/role configuration entering project-local `.dope/`;
- Environment, Session-only and OS secure-storage credential paths with no plaintext persistent downgrade;
- secret redaction/non-persistence across Chat/provenance/preferences/logs/telemetry/errors/debug output;
- provider-specific onboarding behind one shared connection lifecycle, including distinct OpenAI vs OpenAI-compatible runtime types and manual Local configuration even when auto-detection exists;
- stable connection-scoped model identity, discovery/configured-inventory behavior, bounded refresh and known-vs-usable inventory;
- normalized connection health/model usability without conflating Local cold/unloaded state with unavailable;
- Test Connection using synthetic zero-project-data inference and not being accepted as Software Map probe/warm-up/evidence-egress proof;
- migration/convergence from Phase 7A global connection metadata into one authoritative registry without secret copying or indefinite duplicate stores;
- Chat/Software Map consumers observing registry updates while Software Map retains its explicit run-level consent/strategy boundaries;
- role-ready eligibility queries using normalized capability/locality/limit metadata without selecting/ranking a target.

### Phase 7C — AI Roles & Routing qualification

Require executable evidence for:
- exactly five initial fixed role identities and no accidental custom-role/provider-name coupling;
- deterministic preferred + ordered fallback resolution for exact and constraint targets;
- stable target resolution for unchanged policy/inventory/constraints;
- hard constraints vs soft preferences remaining distinct, with Unknown failing hard capability requirements;
- normalized locality constraints that cannot encode contradictory local-only/hosted-only states;
- feature/request constraints only narrowing global policy;
- role policy being unable to grant project-data egress permission absent initiating feature/user authority;
- explicit selected-model failure still surfacing with no silent role fallback;
- bounded role fallback only for authorized pre-output availability/transient failures, with no fallback after cancellation, auth/config failure, new egress boundary, meaningful partial output or feature-semantic failure;
- existing Phase 7A exact Chat defaults preserved through migration, new Chats defaulting to Follow Interactive, and explicit per-turn model selection remaining usable even if Interactive is unconfigured;
- no generic project/window role override layer appearing accidentally;
- unconfigured/broken roles failing explicitly with focused AI Center repair rather than arbitrary model selection;
- role UI showing preferred/fallback/constraints/eligibility/health and keeping feature-imposed constraints read-only;
- feature-to-role bindings preserving Software Map and Phase 10 stronger authority;
- immutable routing provenance and a truthful Why this model? explanation;
- removed/disabled/unavailable/ineligible target references preserving policy intent, with bounded non-secret descriptors for unresolved removed targets;
- temporary fallback returning to the preferred target when it becomes eligible again;
- recreated targets with new immutable IDs requiring explicit reassignment;
- role-policy revision/concurrency/live-window propagation matching the application-global registry contract.




### Post-Phase-7 `c7-chat-project-grounding` qualification

This correction is Green only when the unchanged `0.7.31` candidate directly proves that ordinary Chat can answer basic project questions from current evidence rather than model invention.

Required direct gates:
- list the repository root and a real nested directory such as `test/` from the active project;
- confirm one existing and one nonexistent project-relative path;
- answer one implementation-location question from bounded path/text search;
- answer one canonical Architecture question;
- answer one current Physical Map or Flow question;
- reject traversal, absolute external paths and a symlink escape;
- reject stale/nonexistent map identities rather than substituting model guesses;
- show automatic evidence visibly as Auto context and persist its turn references/hashes/generation metadata;
- switch between two projects and prove no grounding evidence crosses roots;
- preserve manual typed context, Chat history budgets, routing/no-fallback and hosted-egress rules;
- prove grounding does not change canonical Architecture/Project Mind/Planning state or the Physical Map input fingerprint;
- prove no write/process/Git/network capability is introduced.

The model-facing grounding instruction must prohibit claims of file/directory/map inspection without supplied evidence, but qualification must prove backend evidence behavior rather than relying on prompt wording alone.

## Agent Mind

Applicable when AI Presence introduces Agent Mind.

Agent Mind exposes structured working state, not raw chain-of-thought.

Tests should treat its fields as application state with defined producers and transitions.

Do not persist hidden reasoning content merely to make UI look more transparent.

## Steering consistency

Applicable when continuous steering exists.

When the developer changes objective, plan, ownership, constraints, or validation expectations:
- canonical shared state updates first
- Agent Runtime consumes new state
- stale pending actions are invalidated or explicitly reconciled
- UI reflects the same state
- no invisible old plan continues mutating the project

## Ownership

Applicable when scoped ownership/delegation exists.

Human, AI, and shared ownership must be enforceable.

AI observation of human-owned code does not imply mutation authority.

Tests must cover denied mutation in human-owned scopes while allowing permitted observation/review.

## Tool authority

Applicable when mutation-capable model/tool execution exists.

A model proposes effects; Dope authorizes and executes them.

Repository text, model output, extensions, MCP metadata, framework state, and project artifacts cannot raise the configured authority ceiling.

Mutation paths must be typed and observable.

At minimum distinguish observation/read, workspace mutation, process execution, Git mutation, network, browser/external action, secrets/credentials, and destructive action.

## Process truth

A working directory is not an OS sandbox.

If future autonomous process execution claims containment, that claim requires an actual qualified sandbox.

## Product Phase 8 — Coding Agent / Scoped Delegation qualification

**Owner closeout (2026-10-10): Phase 8 is OWNER-CLOSED / GREEN / QUALIFIED for its approved 8A–8E scope** at committed `0.8.47` source `bcc5cb8`, supported by the exact-source P14 evidence. See `docs/planning/p8/phase-8-closeout.md`. This does not qualify unobserved live local-model failure variants, packaged-native deployment, Phase 9 sessions or Phase 10 alignment.

Phase 8 is not Green merely because a model can edit files. Qualification must prove Dope-owned execution, authority, sequence recovery and review semantics.

### Codex AI Center / reference adapter gate

Directly prove:
- Codex appears as a first-class AI Center agent-runtime connection distinct from generic OpenAI API;
- Sign in with ChatGPT / authorized plan usage works without requiring an API key for that connection;
- secrets/tokens are absent from AI registry, project files, logs, browser storage and AgentRun/routing provenance;
- multiple Codex account connections retain distinct immutable Dope IDs;
- refresh/replacement of rotating credentials is serialized so concurrent Dope processes cannot race one token set;
- provider/account model discovery refreshes on account change and does not claim entitlement merely from a cached catalog;
- Codex is classified hosted for egress constraints;
- zero-project-data Test Connection uses a scratch/empty root with mutation disabled;
- exhausted/revoked/unsupported plan access fails explicitly and never silently switches to an OpenAI API-key connection;
- App Server start/init/stop/restart-after-refresh lifecycle leaves no orphan process and preserves recoverable provider-thread metadata only as adapter state.

### Phase 8B — Agent execution core gate

8B qualifies only one direct mutation-capable AgentTask. It must not claim the later phase-stack workflow.

Directly prove on one clean disposable repository:
- provider-neutral AgentTask persists with stable Dope identity, objective/instructions, project scope, model policy and validation policy;
- Coding Agent resolution selects only an eligible `agentExecution` target and records actual immutable connection/model/runtime provenance;
- developer sees and explicitly accepts one bounded ExecutionGrant before mutation;
- initial grant permits project reads, project-workspace writes, project-local process/test/build execution and Git inspection only;
- Git writes/history-changing commands, outside-root filesystem effects, network, secrets/private home state and destructive/system actions are denied and recorded;
- routine in-grant effects execute without repetitive approval;
- the Codex adapter uses a mutation path separate from the read-only Test Connection and maps the grant to enforceable sandbox/approval restrictions;
- if a requested grant cannot be enforced by the adapter, execution refuses rather than widening authority;
- Codex process HOME/CODEX_HOME remains isolated while task cwd is the approved project root;
- one real task modifies source/tests inside the project, runs a local validation command and reaches completed state;
- AgentRun persists normalized activity, changed files, validation, bounded diff summary and actual runtime/model provenance without hidden reasoning or secrets;
- provider-native thread ID is recovery metadata only;
- Stop/cancel prevents future effects, preserves already-created workspace changes and records truthful cancelled/interrupted status;
- restart preserves inspectable task/run/events/change state; unsafe automatic continuation is not required;
- starting Git HEAD is recorded, final diff is inspectable, and no staging/commit occurs;
- Test Connection remains read-only/no-project-data/no-mutation after 8B ships.

Adversarial qualification must directly attempt:
- outside-root write;
- network access;
- Git commit/history mutation;
- private-home/secret read;
- repository/model instruction attempting to expand authority.

Filesystem/process/Git reality and persisted AgentRun truth must agree.

8B may use a simple Dope-owned structural validation such as `git diff --check` plus observed agent-run test/build commands. Full phase-stack validation orchestration belongs to 8C.


### Sequential phase-stack gate

The first major dogfood qualification must run one real existing Dope phase/correction stack from inside Dope.

Prove:
- prompt stack parsing/order/model/reasoning/version/manual-browser metadata matches the external runner contract;
- Git/version/clean-tree preflight identifies the correct completed prefix/current task and rejects unsafe gaps;
- Coding Agent executes the current task under the approved grant;
- Dope, not the coding agent, owns the authoritative checkpoint commit for this workflow;
- required validation runs and a failed validation/task stops progression;
- successful task checkpoint advances exactly one task;
- browser/manual-required task stops visibly rather than being skipped or faked;
- closing/restarting Dope resumes at the same pending/manual gate using durable sequence state plus Git truth;
- external concurrent Git/version changes that invalidate the basis block resume and require reconciliation;
- task activity, diff/changed files, validation and checkpoint identity are inspectable;
- pre-existing dirty work is preserved/distinguished and never silently absorbed.

### General delegation gate

Before calling full Phase 8 qualified, additionally prove:
- a Planning WorkItem can create/launch AgentTask without making WorkItem completion implementation truth;
- HUMAN / AI / SHARED ownership and mutation scope are enforceable;
- developer can steer/cancel/review and accept/reject the resulting change;
- accepted work leaves bounded affected-map provenance/staleness without implementing Phase 10 continuous alignment.

### Phase 8D explicit general-delegation qualification

**Phase 8D remains GREEN / QUALIFIED through `c8-fix` P6 cycle 2 on committed `0.8.33` source `8748cb4` (2026-10-09).** The original P13 Not Green result remains historical: its two WorkItem tasks could not Start and its aggregate failed before product/Electron. The later correction separately qualified two real hosted Codex WorkItem runs, frozen Dope-owned validation, accept/reject, authority/steering/map/restart, legacy preservation and a full passing exact-source `npm run check`. See `docs/tasks/c8-fix/closeout.md`. The current Phase 8E disposition is recorded below.

**Critical end-to-end distinction:** creating a WorkItem-derived AgentTask is not starting it. Direct GUI evidence must show an explicit Start on the *same saved WorkItem task ID* with a developer-accepted ExecutionGrant and required nonempty Dope-owned validation targets. Original P13's empty-validation saved tasks remain unable to Start safely; current launch requires a developer-approved target and preserves that policy on each new task. Never bypass required validation to make review UI Green. Preserve no-silent-fallback/no-authority-escalation and Direct Work/Prompt Stack regressions.

Require one real GUI/developer-facing disposable-project WorkItem to launch multiple linked AgentTasks across its lifetime, with stable project/map/task/run identity and restart recovery. Exercise HUMAN-only (no AI delegation), AI-delegated and SHARED human-reserved versus delegable portions. A narrow delegated working set must be enforced in Dope-owned promotion, even where the standing project grant is broader. Stale/cross-project planning basis, changed referenced transformation and duplicate request must fail closed.

For a real WorkItem-origin run, inspect actual frozen candidate diff and Dope-owned validation; explicitly accept one valid candidate and reject a different one without unauthorized files applied. Acceptance must recheck candidate fingerprint, Git/path basis, grant, human-reserved scope and required validation; repeated/restarted accept cannot double-apply. Exercise failed validation, out-of-grant delete/rename, Git/network/secrets escalation, symlink/path escape, external HEAD change and interrupted review. Consequential ProposedAction must remain reviewable but unexecutable when fixed grant cannot enforce requested effect.

Prove typed steering acknowledgement (applied at supported safe boundary or honestly pending/unsupported), cancellation and restoration without hidden resubmission. Accepted changes yield project-bound affected Software Map IDs/changed paths and bounded staleness, or explicit unknown; no continuous alignment. Regression: existing direct Work auto-promotion, Prompt Stack validation/Dope-owned Git checkpoints, manual gates, transcript, restart, Chat isolation and provider security remain qualified. Final p8d T3 requires real UI/hosted Codex exercise, one final exact-candidate `npm run check`, validated prompt stack and truthful Green/Not Green closeout; P1–P11 use focused T1/T2 implementation checks, P12 owns bounded integrated regressions, and P13 owns the sole real GUI/reference-Codex T3 qualification and one exact-candidate aggregate.

### Phase 8E — Local coding-model qualification gate (Green at `0.8.47`)

Prerequisite: `c8-fix` P6 qualified Phase 8D on clean `0.8.33` source `8748cb4` with a passing exact-candidate aggregate and real saved-WorkItem Codex execution; the original P13 failure remains historical. 8E was separately owner-activated on 2026-10-10 for P1–P14 and qualified Green at committed `0.8.47` source `bcc5cb8`; see `docs/tasks/p8e/closeout.md` for live observations, deterministic guards and unqualified live failure variants. Reuse the same source/validation/authority contracts; no new canonical LocalAgent task/run types.

Before 8E Green, **directly prove**:
- AI Center discovers and selects an actually loaded Local LM Studio connection/model with measured context limit, bounded output/tool-result reserve and a safe no-project-data synthetic **agent tool-loop** capability probe; models lacking `agentExecution` remain ineligible even when conversational text works;
- one real local model completes a bounded source edit involving a genuine brokered file/process tool request inside an **isolated ExecutionWorkspace**, with sanitized message/command observations in the same durable AgentRun transcript;
- untrusted/malformed/unsupported/out-of-bounds tool requests and excess turn/context capacity fail explicitly. No arbitrary host shell, symlink/traversal/outside-root, private files/secrets, Git history/write, unapproved process, network or prohibited host-loopback effects are possible under the fixed grant; OS-enforceable isolation is demonstrated, not assumed from model locality;
- frozen CandidateDelta, Dope-owned required CandidateValidation, fingerprint/basis verification, developer accept/reject (WorkItem) and Authority/ToolExecutor promotion remain owned by Dope; no local-model direct authoritative writes or weaker validation;
- Direct Work, WorkItem and representative Prompt Stack paths use the same AgentTask/AgentRun/sequence semantics, checkpoints/manual gates and real project isolation; no hidden local task duplication on restart;
- cancellation/interruption/model unload/endpoint change/insufficient loaded context/recovery failure is truthful and does not silently rerun, widen grants or switch to hosted inference. Explicit model policy and local-versus-hosted provenance remain inspectable; hosted fallback requires independent consent and is not required for 8E;
- representative matching tasks compare local model and previously qualified Codex by correctness, tool-call reliability, context, latency, validation and recovery; model capability deficiencies are reported, not used to weaken Dope's security or quality gates;
- real Dope GUI/local inference, denial/restart evidence and a **passing final exact-candidate `npm run check`** plus only separate materially required T3 evidence. No claim of native installer production qualification unless actual native evidence is collected.

The earliest local qualifying task may be small and achievable; matching Codex quality on difficult tasks is not necessary. The adapter and security architecture, not benchmark supremacy, are the gating objectives. P14 qualified the observed 8E scope on 2026-10-10; the owner subsequently closed Product Phase 8 for approved scope on the same date (`docs/planning/p8/phase-8-closeout.md`). This does not activate Phase 9. See ADR 0032, `docs/planning/p8/phase-8e-plan.md` and `docs/tasks/p8e/closeout.md`.

## Product Phase 5 — Visual Software Planning qualification

Phase 5 qualification applies from the `0.5.0` baseline and must remain valid with no model/provider configured.

Require executable evidence for:
- Physical Map and Planning Map center-workspace projections reconstructing from domain state rather than owning it;
- semantic zoom/navigation across System -> Subsystem -> Component -> Code with stable identity and source navigation;
- durable PlanningMap / PlannedTransformation / WorkItem creation, mutation, dependency and validation-target behavior;
- explicit add/modify/remove/move/split/merge/redirect-relationship/change-contract target transformations;
- explicit Adopt Target behavior with no silent Planning Map -> canonical architecture mutation;
- project-local `.dope/planning-maps.json` persistence, restart/reopen continuity, project isolation, malformed/unsupported-state fail-closed behavior and copy-to-new-root recovery;
- no dependency on historical Phase 3 `.dope/planning.json`, `Plan`, `PlanStep` or `Task` runtime contracts;
- stale-plan detection when canonical architecture or Physical Map basis changes;
- explicit rebase preserving intent and surfacing identity/hierarchy/contract/already-realized conflicts;
- deterministic post-implementation re-analysis and reconciliation outcomes: implemented as planned, implemented differently, not implemented and unexpected implementation;
- WorkItem completion never becoming architecture adoption or physical truth;
- canvas geometry/layout remaining presentation state;
- direct Dope-on-Dope GUI dogfooding through the full human-driven Physical Map -> Planning Map -> transformations -> WorkItems -> implementation -> re-analysis -> reconciliation loop.
- default overview renders Systems plus immediate Subsystems without dumping Components/Code;
- visual grammar remains understandable without relying on color alone and remains readable under alternate supported themes;
- Focus / Up / Fit Architecture, geometric zoom, selection stability, simplified cross-boundary context and source round-trip preserve map identity;
- project/System/Subsystem/Component focused tabs share one underlying map/planning state and never fork data;
- Current / Target / Diff projections show the same PlanningMap state consistently;
- supported direct gestures create the expected typed transformation, preview before commit and participate in domain undo/redo;
- multiple Planning Maps, explicit alternative branching, lifecycle transitions and overlapping-map conflict visibility behave deterministically;
- WorkItem suggestions require explicit developer acceptance/reshaping and WorkItem <-> transformation selection remains bidirectional;
- bounded Adopt Target handles coherent partial slices, dependency/conflict checks and adopted-versus-still-planned distinction;
- stale state localizes to map/branch/transformation and explicit rebase presents old basis/current reality/target intent;
- reconciliation rolls up from transformations and explicit closeout is the only transition to completed PlanningMap state;

Broad browser/Electron/native/package evidence belongs in the designated T3 qualification/closeout gate rather than ordinary implementation prompts.

## Product Phase 9 — Development Sessions qualification (9A owner-activated; not qualified)

Phase 9 is **ACTIVE FOR 9A ONLY / NOT QUALIFIED**, explicitly owner-activated on 2026-10-10 (`docs/planning/p9/activation.md`). Entry is Phase 8 owner-closed Green at committed `0.8.47`; the owner-approved coherent `0.9.0` baseline exists at `e250a07`, and P1 must advance to `0.9.1` during implementation. ADR 0033 and `docs/planning/p9/phase-9-plan.md` govern the optional session contract; 9B–9E remain inactive.

Before any Phase 9 Green claim, prove:
- provider-free session creation, rename, pause/resume, close/reopen and multiple sessions per project, with no model required and unchanged independent non-session Chat/Planning/Work;
- versioned atomic project-local session storage, optimistic revision conflict handling, canonical project isolation, malformed/foreign ID denial and restart/project-switch recovery without duplicate work;
- typed attach/detach and live resolution of multiple Chats, Planning Maps, WorkItems (map ID + WorkItem ID), AgentTasks/AgentRuns/sequences and relevant decisions, with one artifact linked into multiple sessions without cloning it;
- missing/deleted/stale references remain visibly unresolved, not silently retargeted, removed from history or treated as completed;
- existing Chat/Work panel owner/focus semantics, independent center workspace, truthful activity/validation provenance, and clear distinction among WorkItem completion, AgentRun completion and passed Dope-owned validation;
- session selection, pause, close and reopening do not invoke models, cancel/start tasks, expand ExecutionGrant, mutate source/Git, complete WorkItems, adopt architecture or rewrite accepted Project Mind decisions;
- a **bounded real PlanningMap -> WorkItem -> AgentTask -> frozen Dope-owned validation/review** replay on the affected Phase 5 seam. Its original P11 Not Green/P12 unexecuted disposition remains historical even if this narrower Phase 9 replay passes;
- a real Dope Builds Dope feature in a disposable Git worktree, through Session -> Chat -> Planning -> authorized Work -> validation/review -> restart/resume -> explicit closeout, with unresolved/deferred work preserved;
- one passing final exact-candidate `npm run check`, plus genuinely separate required GUI/restart/security proof. Focused implementation tests and aggregate builds should not be redundantly repeated.

Sessions never become a new source of authority or automatically feed linked project data to models. Session-aware AI context, if added later, requires explicit bounded project-scoped selection and existing hosted-egress consent. Phase 10 background knowledge alignment is out of scope.

## Planning Maps and WorkItems

PlanningMap/WorkItem completion is application truth, not model assertion.

Changes to WorkItems must remain synchronized with referenced transformations, but WorkItem mutation must not silently rewrite architectural target intent. Changes to target intent are explicit PlanningMap/PlannedTransformation mutations.

A stale PlanningMap cannot be silently treated as current. Rebase or deliberate continuation against the recorded old basis must be explicit and visible.

## Ideas

Applicable when Project Mind introduces Ideas.

Capturing an Idea must not mutate active work unless the developer or an explicit workflow promotes it.

Ambient discovery should never silently expand scope.

## Software Map architecture truth

Applicable to the active Software Map and Planning Map domains.

Architecture evidence retains provenance/classification:
- deterministic static observation
- runtime observation
- inferred semantic relation
- developer target
- agent proposal

Do not present inferred relationships as observed facts.

## Conceptual ChangeSets

Applicable when conceptual ChangeSets are introduced.

A ChangeSet preserves conceptual intent and affected behavior while remaining traceable to files/diffs.

It must not replace Git evidence.

If conceptual description and actual diff diverge, the discrepancy is a failure signal.

## Provider failures

Applicable when model/provider execution is introduced.

Streaming errors, malformed structured output, timeout, cancellation, and provider restart must not corrupt canonical project/task state or prior durable Chat history.

When a developer explicitly selects a model/provider for a Chat turn, failure must be surfaced rather than silently routing project context to another provider. Retry on a different model requires an explicit developer choice.

Provider-native identifiers are optimization/adapter state, not sole project history.

## Theia boundary

Theia-specific code may not become the only implementation of core product semantics.

For Foundation Spike 0, tests should exercise the minimal Dope-owned contracts actually introduced by the spike without requiring Agent State, Authority, or Agent Runtime.

At minimum this includes the minimal persisted ProjectArtifact/Note contract and any Dope-owned WorkspaceMode/backend contract created by the spike.

Later phases add framework-independent tests for Planning, Agent State, Authority, Agent Runtime, and other domain services when those services exist.

## Framework customization

Supported extension points are preferred.

Deep/private API use is explicitly tracked.

A framework upgrade that breaks broad product behavior is Not Green until coupling is removed, a supported replacement is used, or the owner explicitly accepts a bounded exception.

## Restart restoration

Verify the restart state applicable to the current phase.

For Foundation Spike 0:
- minimal canonical Project Mind spike state persists
- custom UI projections reconstruct
- no Theia-only state is silently promoted into canonical product state
- the packaged application can restore the qualified state

Later phases add session restoration, pending-action handling, provider/framework staleness, and incomplete-effect recovery when those concepts exist.

## Git dirty-state preservation

Dope preserves pre-existing user changes whenever a task can mutate repository content.

Agent-generated and pre-existing changes must remain distinguishable where attribution claims are made.

Phase 0 does not need AI mutation to prove this future invariant.

## Extension compatibility

VS Code/Open VSX compatibility claims require real extension evidence.

Do not infer compatibility from API claims alone.

## Packaging

Desktop packaging evidence uses the produced package, not only the development server.

Foundation Spike 0 required a real Linux artifact plus native launch/process evidence outside the dev server, correct packaged resources/branding, and the strongest practical programmatic renderer smoke.

Product Phase 1 separates package proof from IDE-interaction proof: P4 requires a reproducible/fresh-environment package path, branded product metadata/icon, packaged resources, and normal native Electron launch. P5 requires direct interaction with the real Theia GUI and may use either the browser-hosted workbench or Electron. Programmatic renderer/CDP evidence may supplement but cannot replace the P5 interactive GUI gate.

## Framework upgrade qualification

A framework upgrade is qualified when a real upgrade is undertaken; Foundation Spike 0 does not perform a synthetic upgrade solely for evidence.

For each real Theia upgrade, record baseline and target versions, dependency/config changes, source fixes, CSS/layout fixes, extension regressions, package/runtime evidence, and private API coupling.

A successful build alone is not sufficient if the upgrade changes material IDE behavior.

## Visual/manual evidence

Record exactly what was observed.

A screenshot or visual pass is evidence for visible behavior only; it does not prove hidden state invariants unless separately instrumented.

Do not require authority/provider evidence before those systems exist.

## Product Phase 1 — IDE Alive success

Phase 1 qualifies only when the candidate has both P4 Electron package/native-launch evidence and P5 direct interactive Theia GUI evidence on the Dope repository.

At minimum the direct dogfooding evidence must demonstrate:
- open the Dope repository/workspace;
- navigate and edit/save source;
- language diagnostics/Problems;
- workspace search;
- integrated terminal command execution;
- Git/SCM dirty and clean transitions plus diff inspection;
- debugger breakpoint/locals;
- test discovery/execution through the integrated test surface;
- preferences and keybindings;
- extension installation/use and restart persistence;
- dark default presentation on first-run state;
- explicit alternate theme selection persists and overrides the default;
- restart restores the intended workspace/editor/workbench state;
- P4 package/native startup is free of unresolved fatal product blockers.

The dogfooding pass must preserve the repository's pre-existing Git state and restore any controlled edits.

A browser-hosted P5 pass is sufficient when it directly exercises the real Theia workbench interactively. Headless, DOM-query-only, screenshot-only, or CDP-only evidence is insufficient. P4 remains required for Electron/AppImage packaging and native launch.

## Corrections

Every correction must reproduce/characterize the defect, repair it, add an appropriate permanent regression guard where executable, prove the repair with focused validation, and preserve historical failure evidence. Broader affected-system evidence is assigned to an explicit T2/T3 gate unless the repair itself crosses boundaries that require immediate integration evidence.

## Foundation Spike 0 success

The spike qualifies only if the complete THEIA-SPIKE.md matrix is Green or residual gaps are explicitly classified and judged non-blocking by the owner without being relabeled Green.

Hard substrate blockers cannot be waived into technical Green.


## Unaccepted sMap review recovery and diagnostics

While ADR 0018 remains authoritative, changes to Architecture Review persistence or acceptance must preserve these invariants:

- a `review_required` working draft survives backend/app restart exactly enough for continued developer editing;
- existing persisted schema-1 review runs remain readable or receive an explicit, tested compatibility path;
- invalid review drafts can be persisted safely without becoming canonical or initialized;
- mutable draft saves reject stale revisions rather than silently losing newer work;
- project/root switching cannot leak or overwrite another project's review;
- reopening/checking a persisted review does not require or invoke Local/Gemini/provider setup;
- deterministic acceptance diagnostics report the complete known blocker set and identify conflicting nodes/paths where available;
- UI diagnostics, offline checker results and backend acceptance preflight share the same domain rules;
- explicit cancellation and successful acceptance remove the in-progress analysis work state;
- acceptance continues to revalidate source/declaration staleness and uses the strict canonical architecture writer;
- diagnostic/debug machinery must not auto-fix ownership, deduplicate roots or otherwise make architectural decisions for the developer.

Permanent regression coverage must include restart restoration of an intentionally invalid draft and equality of its deterministic diagnostics before and after restart.

## Planning basis isolation and observation-generation stability

While ADR 0019 is authoritative, Phase 5 regression coverage must prove:
- creating or mutating `.dope/planning-maps.json` does not change the Physical Map source/config input fingerprint;
- representative non-canonical Dope state such as `.dope/project-mind.json`, `.dope/smap-analysis.json` and `.dope/smap.json` does not become generic language-analysis input;
- canonical `.dope/architecture.json` still changes the dedicated declaration fingerprint and therefore the canonical/physical basis appropriately;
- unchanged reanalysis may advance Physical Map generation without marking a Planning Map stale;
- generation-only advancement leaves `physicalChanged`, affected branches and affected transformations clear;
- a real source/config change changes Physical Map input identity and can stale affected planning work;
- exact generation guards still reject mixed/stale in-flight query, preview or snapshot results;
- Planning Map editing remains available after unchanged reanalysis.

A test that merely ignores all basis changes is invalid. The correction must demonstrate both sides: no false stale from Dope metadata/generation, and real stale from software/canonical input changes.

## Product Phase 6 — Flow qualification

Phase 6 qualification is provider-free and must distinguish structural dependency evidence from application-level execution Flow evidence.

Permanent focused coverage must prove:
- structural `imports`, `references` and aggregated `depends-on` edges alone do not create Flow hops;
- a deterministically resolved project-code invocation may create `invokes` Flow even when payload/type lineage is unknown;
- deterministic Flow facts require valid evidence and valid GraphNode/derived-endpoint references;
- derived endpoint identity is deterministic and does not merge unrelated generic database/external observations;
- Flow publishes with the same project/generation/input identity as the Physical Map and stale generations cannot replace newer publication;
- unchanged analysis inputs produce stable Flow fact/endpoint IDs and deterministic ordering even when process-local generation advances;
- source edits that add/remove supported calls, HTTP boundaries, persistence interactions or external calls update Flow after fresh analysis;
- generic TypeScript extraction resolves supported project-code call targets and does not classify imports/references as invocation;
- supported Adaptive SEO extractors handle Express 5 request/response registration through real helper boundaries, PostgreSQL through the `Database`/`QueryExecutor` abstraction, and deterministic raw/client external calls without hardcoding repository paths/names;
- at least one differently named/layout synthetic TypeScript fixture exercises the same supported concepts as an anti-hardcoding guard;
- payload/type/schema/event annotations have independent evidence; unknown or low-information payload detail is omitted rather than guessed;
- static path stitching uses only proven Flow facts, terminates cycles safely and exposes truncation instead of silently dropping reachable Flow;
- architectural aggregation requires continuous evidenced origin paths, preserves `originFlowFactIds`, never bridges missing hops, and retains meaningful read/write/invocation/external distinctions plus branch/join shape;
- Static Flow is presented as possible evidence-backed execution and remains distinct from future runtime Observed Flow;
- generation/project guards prevent late Flow-query results from rendering into another generation/workspace;
- Architecture <-> Flow switching preserves focused/selected architecture identity and source round-trip intent;
- the initial System view is a quiet overview rather than a code-call hairball, while selection/upstream/downstream tracing progressively exposes detail;
- branches/joins render as topology, real async handoffs use explicit endpoints, cycles remain representable, and retries/error paths appear only when evidenced;
- deterministic directional layout retains stable ordering for unchanged inputs without claiming synchronous or observed execution.

The Phase 6 query contract must surface explicit partial/unsupported/truncated diagnostics. Hidden truncation, a rendered connector across an evidence gap, or a stale-generation result presented as current is Not Green.

Phase 6 T3 qualification must directly use a fresh disposable copy of the accepted mapped Adaptive SEO workspace with no model configured and prove one continuously evidenced real behavior:
- inbound HTTP boundary;
- resolved internal invocation chain;
- persistence and/or deterministic external-service interaction;
- output/response boundary;
- at least one genuine real branch/fan-out or join within the qualified behavior;
- representative Flow-edge provenance and source navigation;
- System -> Subsystem focus without identity fork;
- Architecture -> Flow -> Architecture round-trip preserving selection/focus;
- restart/reopen/fresh analysis reconstructing equivalent derived Flow without a new durable Flow store;
- exact-candidate aggregate/restart/browser/Electron/package/native evidence assigned to P7.

Missing payload/type/schema annotation is acceptable for Green when execution continuity is fully evidenced. An explicitly surfaced unsupported boundary outside the qualified slice is acceptable. A missing or invented execution hop inside the chosen qualification behavior is Not Green.

Controlled fixtures may qualify rarer topology such as cycles/retries; they cannot replace the real Adaptive SEO behavior.

### c6-flow-overview-priority regression contract

While this correction is active, permanent regression coverage must additionally prove:
- System/Subsystem overview limits are applied to visible semantic overview participants/interactions after scope reduction rather than to hidden raw CodeEntity detail;
- dense internal `invokes` cannot starve all evidenced HTTP Inputs from a truncated focused overview;
- fact ordering is deterministic without using Flow fact ID lexical order as accidental behavioral priority;
- one shared store/external endpoint used by several architectural scopes does not pull unrelated callers into the focused scope because of one endpoint `anchorNodeId`;
- equivalent overview interactions may collapse only with compatible kind/enrichment/behavior and retain all origin Flow fact IDs/evidence;
- `reads` and `writes` never collapse together and incompatible schema/data annotations never merge;
- tracing a valid selected endpoint/node remains possible even when the current bounded overview omitted that identity;
- default truncation presentation summarizes continuation count and does not dump an unbounded raw-ID frontier.

Correction qualification must replay the real Adaptive SEO GET opportunities path in the GUI and directly inspect its required `receives`, `invokes`, PostgreSQL `reads`, response branches and source/provenance. P8 remains blocked until that replay is Green.
Whole-program taint analysis, arbitrary cross-language lineage, exhaustive SQL/schema lineage, mandatory runtime tracing and AI-generated missing hops are not Phase 6 qualification requirements.
