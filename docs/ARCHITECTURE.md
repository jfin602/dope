# Dope Architecture

Status: INITIAL ARCHITECTURE CONTRACT

## Objective

Build a native-feeling GUI development environment while keeping Dope's differentiated product state independent from both the GUI framework and the model/provider ecosystem.

Two foundational constraints:

> GUI-first must not become GUI-coupled.

> AI-native must not become provider-coupled.

## Top-level layering

Dope Desktop App
  |
Theia Workbench / IDE substrate
  |
Dope presentation adapters and widgets
  |
Application / orchestration
  |
Project Intelligence / Software Map / Visual Software Planning / Data Flow / later Agent Runtime
  |
Persistence / Model / Tool / Authority / Execution adapters

Dependencies point inward.

Product/domain packages must not import Theia or provider-native SDK/domain types.

## Theia boundary

Theia supplies commodity IDE capabilities:
- Monaco
- filesystem/workspaces
- explorer
- terminal
- SCM/Git
- debugger
- search
- commands
- preferences/keybindings
- LSP
- TextMate grammars
- VS Code extension compatibility
- Open VSX
- workbench/layout
- Electron desktop shell

Dope owns:
- Project Mind / Project Intelligence
- the Physical Map
- the future Visual Software Planning/work model
- Agent Mind
- DeveloperSession
- ownership/delegation
- steering
- Ideas/Questions/Decisions/Research
- conceptual ChangeSets
- Validation
- living software map
- project search semantics
- authority policy

Theia may render or host these concepts. It does not define them.

## Qualified substrate findings and Phase 1 product shell

Foundation Spike 0 qualified Theia 1.75.0 as the initial substrate without a framework fork or broad private/internal coupling.

Accepted presentation techniques, in preference order:
1. standard Theia contribution points;
2. custom Dope widgets/services;
3. service rebinding/replacement;
4. bounded shell-level customization where justified;
5. source fork only as a last resort.

The highest-risk qualified seams are shell-area behavior, navigator widget IDs, status-bar CSS, and the window-title service lifecycle. Keep these localized to Theia presentation adapters and do not spread them into product/domain packages.

For Product Phase 1:
- the Electron application is the primary user-facing Dope product shell;
- the browser application remains a development, debugging, and qualification surface;
- the default workbench prioritizes ordinary IDE work rather than unfinished Project Mind or Planning spike surfaces;
- direct interactive Theia dogfooding on the Dope repository is required, using browser-hosted workbench or Electron; P4 separately establishes packaged Electron/native-launch evidence. Headless/CDP-only work does not satisfy the interactive gate.

Presentation preferences such as theme, keybindings, panel layout, editor preferences, sMap viewport/semantic LOD/focus, relationship visibility and developer-selected node colors may persist for the user or project, but they are not canonical project-domain state. Map presentation persistence must remain outside deterministic analysis/evidence identity and Planning Map semantic basis. A deleted/reset presentation preference may change only how the same architecture is displayed.

For sMap readability, hierarchy and containment are the default visual grammar. Geometric zoom/focus may progressively disclose deeper implementation detail and relevant relationship neighborhoods, but they do not create graph facts. If a map identity label is rendered at the active LOD, the complete source value must remain available in the rendered node; ellipsis or clipping must not substitute for architectural identity. Color is reinforcement only and must not override meaning-bearing realization/drift/planning states.

Dope is dark-first: first-run/default presentation uses the Dope-owned **Dope Dark** theme. Its locked brand palette is `#1F1F1F` workbench anchor, `#FF7A1A` primary orange, `#FFB15C` highlight orange, and `#C75100` deep orange. Brand colors belong in the theme layer; Dope widgets should continue consuming semantic Theia tokens rather than duplicating brand hex values. Explicit user theme selection must remain supported, persist across restart, and override the default; selecting another compatible theme must deactivate Dope Dark-specific overrides. Syntax and semantic diagnostic colors remain meaning-bearing and are not globally recolored to the brand palette.

## Workbench placement contract

Dope's default workbench placement is part of the product architecture, while individual user layout customization remains presentation state.

Default placement:
- **Left primary sidebar / Activity Bar:** project-navigation surfaces, including a dedicated **sMap** button and Software Map inspector. The inspector owns hierarchy, dependency, violation, evidence and source-navigation views for the Physical Map.
- **Center workspace:** editors and ordinary working surfaces. Product Phase 5 adds the large visual **Physical Map** and **Planning Map** canvases here as editor-like tabs/workspaces. Product Phase 6 adds **Data Flow** as a directional Physical Map projection in the same center-workspace model.
- **Right secondary sidebar:** reserved by default for future **Agent Mind / chat / AI interaction**. The Software Map inspector must not claim this area as its default home.
- **Bottom panel:** terminal, Problems, tests, runtime and similar execution/diagnostic surfaces.

This is a default product-layout contract, not canonical project state and not a ban on user rearrangement.

The September 29, 2026 ADR 0008 decision lands while Phase 4 P5 is already exercising the pre-decision implementation. P5 may finish without mid-run churn. A bounded post-P5 Phase 4 correction must rename the live software-architecture package/symbol/UI vocabulary and move the inspector to the left-side sMap surface before P6 closeout. The correction must not implement the Phase 5 visual canvas.

## sMap initialization contract

Opening a project does not implicitly authorize Software Map construction.

For a project whose sMap has never been initialized, Dope offers an explicit Analyze Project choice. Declining leaves the sMap uninitialized and does not create canonical architecture or derived map state. The sMap view remains available with an Analyze Project action so initialization can be started later.

The Software Map application/domain layer distinguishes at least `uninitialized -> analyzing -> review_required -> initialized`. Initialization state is not equivalent to the existence of `.dope/architecture.json`.

For an existing project, accepted initialization follows: bootstrap-document detection/choice -> deterministic evidence collection (including eligible repository-document claims) -> provider/runtime readiness -> deterministic evidence planning/global skeleton + responsibility signals + selected bootstrap/orientation context -> System Discovery -> System Challenge -> per-System Subsystem Discovery -> Subsystem Challenge -> per-Subsystem Component Discovery -> reconciliation/targeted verification -> validated ArchitectureProposal -> developer review/correction -> explicit acceptance -> canonical architecture. Before acceptance, generated structure is proposal state only.

Provider/runtime readiness includes a synthetic structured-output capability probe when configuring a model and an explicit warm-up immediately before the first real synthesis request that may submit project evidence. Probe and warm-up requests contain no project evidence. If warm-up fails, the ArchitectureEvidencePacket is not submitted.

For an uninitialized project, root `MODULES.md` is the preferred optional architecture seed. When present, it is supplied as strong **Documented** architecture intent beside deterministic repository evidence; root `README.md`, when present, remains secondary project-orientation context. If `MODULES.md` is absent but `README.md` exists, Dope recommends creating `MODULES.md` but offers **Continue with README**. If neither exists, Dope recommends creating `MODULES.md` but still offers **Analyze repository anyway**. No documentation file is required.

Broader eligible documentation is represented through deterministic provenance-bearing document evidence. Documentation claims guide discovery but do not independently prove implemented architecture; review preserves **Observed**, **Documented** and **Inferred** distinctions. Historical task/qualification/expected-answer material is excluded from synthesis by default.

`MODULES.md` is bootstrap input, not a second canonical store. After explicit acceptance, `.dope/architecture.json` remains canonical. Routine refresh must not silently re-import later `MODULES.md` edits into canonical architecture; any future import/export reconciliation is explicit developer-reviewed work.

A greenfield project may instead initialize through developer-authored architecture before code exists. Cancellation or failure before acceptance returns to uninitialized unless a future resumable-draft contract is deliberately introduced.

## sMap persistence boundary

Durable Software Map state is project-local.

The repository's `.dope/` directory is the required persistence boundary:
- `.dope/architecture.json` contains canonical developer-owned architecture;
- `.dope/smap.json` contains durable sMap initialization/version/state metadata;
- any future persisted sMap evidence, graph snapshot, fingerprint, proposal draft or index must remain beneath `.dope/` in an explicitly versioned Dope-owned format.

Repository + `.dope/` must be sufficient to recover durable sMap state. Theia workspace storage, application preferences, provider sessions, LM Studio state, global Dope databases and machine-local caches may improve UX or performance but cannot be required to reconstruct project truth or determine initialization.

Provider endpoint/model selection remains user/application state, not project state. Provider credentials are secret application/runtime state and must never be written into `.dope/`, derived sMap evidence/proposals, progress events, cache identities or ordinary preference storage. External caches are allowed only when fully disposable and reconstructible from repository evidence plus project-local `.dope/`.

The active `c4-smap-synth` P6-P8 prompts remain frozen while they execute. This persistence rule does not retroactively alter those prompts. A bounded post-c4 storage correction at unchanged `0.4.6` must reconcile the implementation to this boundary before Product Phase 5 activation.

## Visual Software Planning boundary

Product Phase 5 adds a Dope-owned planning domain above the Software Map and below Theia presentation.

```text
Physical Map / Canonical Architecture
-> PlanningMap
-> PlannedTransformation
-> WorkItem
-> ordinary implementation surfaces
-> fresh Physical Map analysis
-> Reconciliation
```

The domain remains presentation-independent. A diagram/canvas is a projection of PlanningMap and Physical Map state; visualization-library types, node coordinates, viewport, selection, open tabs, collapsed groups and panel layout cannot define architecture or target semantics.

PlanningMap references canonical/physical IDs rather than cloning current architecture. Planned new architecture nodes may carry intended future canonical IDs but remain target intent until explicit developer adoption.

Editing a PlanningMap does not mutate canonical architecture. **Adopt Target** is an explicit application/domain operation through the existing architecture authority boundary. Adoption may intentionally create declared-only architecture before code exists. WorkItem status never implies adoption or physical realization.

Every PlanningMap records the canonical architecture revision/fingerprint and Physical Map input fingerprint/generation it branched from. If either basis changes, the PlanningMap is stale. Rebase is explicit, conflict-aware and never silently reinterprets target intent.

Durable Phase 5 planning state is project-local in versioned `.dope/planning-maps.json`. Do not reuse or migrate historical Phase 3 `.dope/planning.json`. Repository + `.dope/` must be sufficient to recover Planning Maps and WorkItems. Machine-local planning caches are disposable.

Phase 5 is provider-free. No model is required to create/edit/adopt/rebase/reconcile a PlanningMap. General AI Presence, Agent Mind, ProposedAction, authority/delegation and mutation-capable tool execution remain Phase 7+ concerns.

### Visual projection and tab identity

The center-workspace visual layer is a projection boundary.

Project-level maps and focused System / Subsystem / Component / branch tabs all consume the same underlying Software Map / PlanningMap identity. Opening a focused map must not fork, clone or snapshot canonical/planning state. Multiple tabs may observe/edit the same PlanningMap through typed application operations and must converge through the same revision/conflict rules.

React/graph-library node and edge objects are presentation adapters only. They never become persisted PlanningMap or canonical architecture types.

The primary PlanningMap canvas is an overlay/diff projection over physical/canonical state. Current-only, target-only and diff modes change presentation, not state.

Direct visual gestures must compile into typed PlannedTransformation operations before durable mutation. Raw node coordinates, drag positions or library edge objects never mutate architecture semantics directly.

Focus / Up / Fit Architecture and geometric pan/zoom are presentation navigation. Stable architecture/planning IDs survive tab changes, zoom/focus changes and source round-trips.

## Data Flow projection boundary

Product Phase 6 extends the Physical Map with a provider-free directional **Data Flow** projection.

Data Flow consumes the same Software Map graph, stable architecture/code identities, query/index services and provenance boundary as the Architecture projection. It must not create a second architecture database, fork canonical identity, or make visualization-library nodes/edges authoritative.

The initial query/presentation contract is System-first with Subsystem focus. Switching Architecture <-> Data Flow preserves focused scope, selection and source-navigation identity.

Flow roles such as Input, Boundary, Transformation, Store, External and Output are projection semantics. They may be computed from typed physical relationships and evidence but are not new canonical System / Subsystem / Component kinds.

Analyzer/query layers may add evidence-backed flow facts for supported language/framework surfaces, including route/request/response relationships, calls/references, symbol/type/schema movement, persistence reads/writes, job/event/queue producer-consumer relationships and external clients. Every flow edge remains explainable through deterministic source/semantic/framework evidence or explicit recorded-runtime observation. When the path or payload cannot be established, the product preserves that uncertainty rather than inventing a hop or data type.

Directional layout is presentation state. It may optimize for input -> processing -> output comprehension while still representing branches, joins, fan-out, cycles, retries, asynchronous boundaries and external round trips.

Phase 6 does not require a model provider, AI Presence, mutation authority, live tracing, or a new durable Data Flow store. Future runtime observation may enrich the same evidence model without turning static flow inference into observed execution.

## Model and provider boundary

Dope must not depend architecturally on one model, model family, provider, API, hosted service, local runtime, or provider-native chat/session ontology.

First-class compatibility requirements include:
- OpenAI / ChatGPT / Codex capabilities and workflows
- local models and local inference runtimes
- future providers through replaceable adapters

The durable boundary is Dope's Model Runtime and capability contract.

Provider adapters translate provider-specific requests, streaming, tool formats, response identifiers, reasoning controls, context handles, token-usage metadata and errors into Dope-owned contracts.

For sMap synthesis specifically, Local and Gemini are explicit user-selected adapters over the same Dope-owned hierarchy-stage contracts. Provider selection must never alter canonical Software Map semantics, and failure must never silently route repository evidence to another provider.

Do not spread provider-name conditionals through product/domain code.

## Capability-based model runtime

Provider independence must not become lowest-common-denominator abstraction.

The Model Runtime should expose durable common operations plus explicit capability discovery.

Capabilities may include:
- streaming
- tool calling
- parallel tool calls
- structured output
- vision
- long-context support
- reasoning controls
- native code execution
- provider-managed state
- cancellation

Dope chooses behavior based on capabilities.

A provider may expose richer features without forcing every provider to emulate them.

Canonical product state must remain valid when the active provider changes.

## Theia AI boundary

Theia AI may be reused selectively through an adapter for qualified infrastructure such as model registry/provider plumbing, OpenAI-compatible provider support, local-provider integrations, model tools, context variables, MCP, prompt services, confirmation infrastructure, structured output, or session plumbing.

Do not make Theia AI's agent/chat/session ontology Dope's product ontology.

Theia AI is optional infrastructure.

General Theia AI reuse is qualified when AI Presence is implemented, not during Foundation Spike 0. ADR 0010 permits the narrower pre-Phase-7 architecture-synthesis capability required for initial sMap generation; that capability must still use Dope-owned contracts and replaceable provider adapters.

## Local-first sMap synthesis bootstrap

ADR 0011 chooses a local LM Studio server with Qwen3-Coder-30B-A3B-Instruct as the first reference implementation for the narrow architecture-synthesis capability.

That is an adapter/bootstrap choice, not a Software Map dependency. The domain continues to depend only on provider-independent synthesis contracts.

The reference setup path should remain inside the Analyze Project workflow: detect or configure a local LM Studio-compatible endpoint, discover/select an available model where supported, run a synthetic structured-output capability probe, then continue into analysis.

Immediately before the first real synthesis request, the provider/runtime layer must ensure the selected model is warm using a tiny synthetic request that contains no repository evidence. Warm-up absorbs model loading/cold inference before the ArchitectureEvidencePacket is submitted. A successful earlier probe may incidentally warm the model but does not guarantee indefinite residency.

Warm state belongs to the provider/runtime/application layer and may be tracked per connection/model. Runtime restart/reconnection, model change or known unload invalidates that state. Warm-up failure blocks real synthesis.

AI connection details such as endpoint, model selection, optional authentication, quantization and local runtime settings are user/application state by default, not canonical project state.

## Target repository structure

Create boundaries when real code exists; do not create empty package ceremony.

Likely shape:

/
  apps/
    desktop/

  packages/
    project-intelligence/
    software-map/
    code-analysis/
    code-analysis-typescript/
    architecture-rules/
    persistence/

    agent-state/
    agent-core/
    agent-runtime/
    model-runtime/
    tool-runtime/
    authority/

    theia-shell/
    theia-project-mind/
    theia-software-map/
    theia-agent-mind/
    theia-runtime/

  docs/
  scripts/
  test/

Early phases should create only the packages they need.

## Pre-stability architecture rule

Dope is still pre-stability. Internal implementations from earlier product phases do not receive automatic compatibility guarantees.

Prefer clean replacement when preserving an older internal schema, API, persistence format or UI would require adapters, dual state, synchronization or migration machinery that does not serve a concrete user/external commitment.

Historical qualification remains evidence of what worked at that version; it does not require the implementation to survive. Correction `c3-remove-planning-instruments` is the completed pre-Phase-4 application of this rule: it removed the Phase 3 Planning subsystem before the software-map implementation begins.

### Software Map

Owns the language-independent architecture representation: canonical architecture, detected architecture, Physical Map realization, System, Subsystem, Component, CodeEntity, typed relationships, provenance/evidence and graph queries.

The primary architecture hierarchy is System -> Subsystem -> Component -> Code. Subsystems are explicit modular architecture objects rather than aliases for directories.

Canonical architecture is developer-owned project state. It may be created before implementation and owns stable architectural identity, purpose, intended boundaries, contracts and constraints. The developer is the final source of truth for architecture and must be able to correct detected structure.

Architecture evidence and proposals are rebuildable derived state. Deterministic analysis produces source-backed architecture evidence and signals; it does not itself establish the initial System / Subsystem / Component proposal for an uninitialized brownfield project. Bounded architecture synthesis interprets that evidence into proposed boundaries. Neither deterministic evidence nor synthesized proposals silently mutate canonical architecture. When canonical structure and implementation disagree, the Software Map preserves the canonical decision and surfaces the disagreement as drift/detected-only/unassigned implementation rather than hiding either side.

The Physical Map is the evidence-backed current implementation mapped against that canonical architecture. Visualization/layout is presentation state.

Physical source relationships must come from deterministic analyzers or be labeled with a different evidence class. Runtime relationships come from recorded observations. Architecture discovery and inferred semantics remain explicitly derived. AI may explain, classify and propose architecture but cannot silently establish physical or canonical truth.

Every proposed architecture node and every physical relationship that affects architectural interpretation must be traceable to deterministic or recorded evidence.

### Architecture Discovery

Owns architecture-scale interpretation above language/framework source facts.

Deterministic analyzers produce the ArchitectureEvidencePacket from repository, build/configuration, semantic, framework and later runtime inputs. Evidence may include:
- application/deployable/runtime entrypoints, process boundaries, workspace topology and framework bootstraps;
- dependency cohesion/direction, package/workspace boundaries, public contracts/exports, framework registration and runtime boundaries;
- finer cohesive implementation groups and explicit framework/service structure.

No single signal, especially folder layout, client/server separation, framework layer, runtime process or package topology, automatically defines architecture. Architecture boundaries should express enduring software responsibilities. Evidence remains inspectable without AI.

The synthesis layer consumes deterministic bounded views of that packet and ultimately produces a strict Dope-owned ArchitectureProposal. AI interprets evidence; it does not create evidence.

ADR 0010 amends the initial discovery path for uninitialized brownfield projects. ADR 0012 further requires hierarchy-first orchestration because architecture-scale quality—especially System discovery—cannot be treated as a side effect of one large synthesis call.

The forward flow first builds a compact repository-global skeleton plus deterministic responsibility signals, performs repository-global System Discovery, explicitly challenges candidate Systems for merge/split/rejection, then establishes Subsystems inside each System, challenges those Subsystem boundaries, and only then descends into Components before cross-hierarchy reconciliation and targeted uncertainty verification. The complete ArchitectureEvidencePacket remains the deterministic evidence authority; responsibility signals and model-facing slices are rebuildable planning metadata that preserve parent evidence IDs/provenance and remain bounded by provider/model capability.

The LLM output is a proposal/candidate class, never physical fact or canonical architecture. Intermediate provider stages use strict compact Dope-owned JSON rather than free-form prose: temporary candidate identity, kind/name/parent, short bounded responsibility, evidence/ownership refs, confidence, typed ambiguity or unresolved codes, typed candidate relationships and unresolved items. Provider-generated rationale essays, sibling-distinction prose, free-form uncertainty and reconciliation messages do not belong in the cross-stage protocol. Local and Gemini consume and produce the same schemas.

Final review remains human-readable without making prose part of the provider data bus. Assembly/presentation may derive concise explanations from typed findings and deterministic evidence; a separate narrative model call is not required. Every final proposal node still uses a temporary `proposalKey`, numeric 0..1 `confidence` and machine-verifiable `evidenceRefs` into the complete parent packet. Human-readable explanation cannot substitute for evidenceRefs, and proposal keys cannot silently become canonical IDs. The developer may correct the proposal and explicitly accepts the canonical architecture.

Initial architecture proposals are reviewed in an editor-like center workspace hierarchy rather than a single stacked form. The left sMap sidebar owns setup/progress/status/navigation; the center review presents an indented System -> Subsystem -> Component tree with focused node details/evidence and developer correction controls. This is a Phase 4 proposal-review surface, not the Phase 5 visual Physical Map/Planning Map canvas.

Manual/greenfield architecture remains available with no model configured. A developer may define canonical architecture before code exists, after which deterministic analysis realizes or reports drift against it.

Architecture synthesis orchestration emits provider-independent progress events for user-visible stages such as evidence collection, architecture skeleton preparation, System Discovery, System Challenge, per-System Subsystem Discovery, reconciliation and targeted verification. The UI shows current stage/call purpose, applicable subject, selected provider/model, known unit counts, elapsed time and failures/retries; it does not expose hidden chain-of-thought or fabricate precise completion percentages when remaining work is unknown.

An initialization analysis is a durable, project-local run pinned to its complete repository evidence packet. Validated stage outputs are checkpointed before dependent work starts, with run/stage/branch identity, effective input and upstream fingerprints, contract version, provider/model and attempt provenance. A failed model or validation stage leaves the run resumable, retaining successful ancestors and independent siblings; downstream work stays pending. **Retry failed stage** resumes that run at its smallest failed unit and continues its dependents. **Restart analysis** explicitly starts a fresh run and collects new evidence. Checkpoint reuse is determined by stage inputs and dependencies, not by the current selected model; a different explicitly selected compatible model may produce the replacement stage. Search Deeper uses the same branch-local dependency principle while remaining an explicit review refinement. Malformed outputs are never successful checkpoints. Reopening the project must preserve a failed run and its pinned evidence, and qualification must prove earlier provider calls were skipped, including after process restart.

The same orchestration records comparable per-stage telemetry independent of provider: wall-clock duration, request/output bytes, cache reuse and input/output/total token usage when available, with an explicit measurement source such as provider-reported, tokenizer, estimated or unavailable. Provider adapters may report usage but do not own timing semantics. Estimated Local usage must not be presented as exact merely to match Gemini telemetry.

The current local Qwen qualification setup uses a 65,536-token loaded context as headroom. Context capacity is a provider capability, not a Software Map constant or request-size target. Gemini 3.8 Flash is introduced as an explicit cloud comparison/provider path through the Gemini Developer API using AI Studio API keys, without replacing Local or changing Software Map contracts. Before Local-specific chunking/compression heuristics are added, both providers are compared against the same compact shared hierarchy pipeline so remaining bottlenecks can be attributed rather than guessed. The initial Dope-on-Dope analysis has an eight-minute end-to-end qualification objective. Eight minutes is not a runtime timeout: slower runs continue to completion for quality/timing evidence but are Not Green on performance.

### Code Analysis

Owns repository/workspace discovery, analyzer orchestration, incremental indexing and language/framework adapters.

The normalized software graph is language-independent. Semantic analyzers are language-specific.

The existing TypeScript/JavaScript adapter remains the lower-level semantic evidence engine and should prefer TypeScript compiler/project/type-checker semantics where they provide authoritative symbol resolution. Architecture discovery sits above those facts; it does not replace them.

Parser/framework extractors may be added behind adapters as required. Framework extractors may produce deterministic concepts such as routes, jobs, schemas, DI/service registration or frontend/backend boundaries when explicit recognition rules support them.

Phase 4 and its architecture-discovery correction remain independent from `@dope/planning`, `.dope/planning.json`, the Phase 3 Planning RPC/UI and Plan/PlanStep/Task semantics. Do not add compatibility layers between them merely because Phase 3 shipped first.

### Project Intelligence

Owns ProjectArtifact identity/relationships, persistence contracts, provenance, schema versioning, and Project Mind query/navigation semantics.

No Theia or provider dependency.

### Phase 3 Planning — historical implementation removed

At `0.3.6`, the implemented Planning subsystem owns Plan, PlanStep, Task, status transitions, ordering, relationships to Project Mind/files, document and per-Plan revisions, and planning history.

Those contracts describe the qualified Phase 3 implementation only. Correction `c3-remove-planning-instruments` has removed the live domain, contracts, persistence, RPC, presentation, PLAN mode, dedicated tests and repository Planning state. Product Phase 4 starts without that subsystem present.

### Persistence

Backend adapters implement durable state.

Do not let the Foundation Spike backend dictate the domain model.

### Phase 2 implementation boundary

Phase 2 is activated by the explicit owner sequencing waiver in `docs/planning/p2/activation.md`; Phase 1 remains Not Qualified. Reuse `@dope/contracts` for framework-independent artifact and transport DTOs. Introduce one real `@dope/project-intelligence` package for artifact operations, transitions and queries, with a separate Node storage module inside that package. Do not create standalone persistence or per-view packages. The domain modules import neither Theia/provider code nor the Node adapter; the adapter depends inward on domain/contracts. Existing `@dope/theia-extension` hosts typed RPC, root attachment and Project Mind presentation.

Start with one local folder per Project Mind and a readable `.dope/project-mind.json` collection. Stable project identity lives in the document, not in an absolute path or Theia workspace/widget identifier. Explicitly reject unsupported multi-root/remote contexts. Only canonical project knowledge goes into this store; drafts, selection, layout, theme and search results are presentation state.

Validate project attachment and subsequent handles on the backend; reject requests for a different attached project. Normalize local roots and enforce storage containment, including symlinks. This is local project isolation, not an OS sandbox or future tool-authority system.

Use one exclusive filesystem mutation lock per project across backend processes and expected document revisions for stale edits. Hold the lock while reading, validating, changing and replacing the snapshot; reject contention/conflicts visibly. Preserve unsaved drafts. Do not automatically steal a lock after a timeout. Document recovery of an abandoned lock after all writers are stopped. External file edits require stopped writers.

Migrate the spike Note explicitly, preserve its ID/content/provenance and original file, and do not invent historical timestamps. Failed migration/corrupt/unsupported data must remain untouched. Exact storage/migration/UI rules live in the Phase 2 plan; no database, service, collaboration or synchronization layer is needed for this scope.

### Phase 3 implementation boundary

Phase 3 is activated by the owner disposition in `docs/planning/p3/activation.md` from coherent package baseline `0.3.0`. Phase 2's P6 audit remains Not Qualified; its accepted gaps remain historical evidence and are not silently repaired or relabeled by Phase 3.

Add one real `@dope/planning` package. `@dope/contracts` owns framework-independent Planning DTOs and typed service/event contracts. `@dope/planning` owns pure Plan/PlanStep/Task validation, transitions, ordering, queries, revision/history semantics and a separate Node `planning.json` storage adapter. Pure Planning modules import neither Theia/provider code nor Node filesystem code. Existing `@dope/theia-extension` owns RPC attachment and Planning presentation.

Persist Planning separately at readable `.dope/planning.json` with its own schema version, document revision and exclusive `planning.lock`. Reuse the Phase 2 atomic-replace, stale-revision, path-containment and stopped-writer recovery discipline without creating a generic persistence framework. Do not merge Planning into `.dope/project-mind.json` and do not introduce a database.

Planning uses the existing Project Mind `projectId` as the canonical project identity. The backend resolves/validates that identity through Project Mind before creating Planning state; a missing Project Mind identity is a visible prerequisite, not permission to allocate an unrelated Planning identity. If both stores exist and identities differ, fail closed and require inspection/recovery. This phase intentionally avoids a cross-store transaction: Planning owns references to Project Mind artifact IDs, and creating a Plan from a Decision writes Planning state only after validating the referenced artifact.

Planning mutations use expected document revision plus a project-bound handle. Every successful mutation advances the document revision. Mutations scoped to a Plan also advance that Plan's visible revision and append a concise developer-authored history record. History is not raw UI input, chat history or generalized event sourcing.

The real Planning UI should live in focused presentation/controller files rather than substantially growing `dope-workbench.ts`. Preserve the existing Project Mind draft/race lessons: dirty Planning drafts must survive navigation/workspace/event races, late responses must be generation/project guarded, and save status must reflect backend acknowledgement. BUILD/PLAN mode may foreground Planning or coding surfaces but remains presentation state.

No model/provider SDK, Theia AI ontology, Codex/OpenAI runtime, local-model runtime, Agent Mind, ProposedAction, authority or tool execution belongs in Phase 3. ADR 0006 selects Codex/OpenAI only as the first Phase 7 reference integration.

### Agent State

Introduced with AI Presence.

Owns AgentWorkingState, objective/current-step state, assumptions/questions/risks, ownership projection, pending actions, validation projection, and steering transitions.

No provider or UI dependency.

### Agent Runtime

Introduced with AI Presence/Scoped Delegation.

Consumes canonical task/session/project state, assembles bounded context, requests model output, interprets structured proposals, coordinates tools through authority, updates working state, emits observable events, and preserves cancellation/recovery semantics.

No direct Theia dependency.

### Model Runtime

Provider-independent model interface and capability discovery.

Provider-specific behavior remains behind adapters.

### Authority

Introduced before mutation delegation.

Owns effect classification and permission decisions.

A model cannot grant itself authority.

Observation and mutation permissions are separate.

### Tool Runtime

Typed tools execute only after authority permits them.

Tool results are structured and observable.

## Foundation Spike 0 boundary

Foundation Spike 0 is qualified. Its executed evidence proved:
- Theia IDE fundamentals
- custom Dope views/layouts
- typed frontend/backend communication
- minimal Dope-owned persistence
- restart restoration
- customization/rebinding
- Linux packaging

It does not need to prove:
- model integration
- AgentWorkingState streaming
- tool calling
- authority execution
- editor-agent mutation
- scoped delegation

That result keeps substrate qualification separate from product/AI implementation. Product Phase 1 consumes the qualified IDE substrate without promoting the spike Note, Planning view, or WorkspaceMode projection into later product-domain authority.

## Frontend/backend communication

Theia frontend and backend communicate through typed service contracts.

Foundation Spike 0 must prove a Node backend service, typed request/response, at least one backend-originated state/event update, lifecycle cleanup where required, and restart restoration of minimal Dope-owned state.

The transport is infrastructure.

Canonical state remains product-owned.

## Editor-agent integration

This is a later AI phase concern.

Dope eventually needs explicit observation seams for active editor, selection, document edits, and working set.

Observation must not imply mutation permission.

Future mutation path:

Agent proposal
-> ProposedAction
-> authority decision
-> diff/change preview
-> apply or reject
-> ChangeSet/evidence update

## State authority matrix

Canonical product state includes, as phases introduce it:
- ProjectArtifact
- developer-authored System/Subsystem declarations and architecture constraints
- future graph-centered planning/target intent as defined by Phase 5
- accepted AgentWorkingState fields
- ownership
- ProposedAction lifecycle
- DeveloperSession
- Validation evidence

Derived/non-canonical state includes:
- UI layout
- user presentation preferences such as theme/keybindings
- rendered panels
- search indexes
- extracted/recomputable physical software graph snapshots and architecture projections
- provider-native response IDs
- provider-native chat/session state
- Theia AI session state

Do not confuse derived convenience with canonical truth.

## Workspace surfaces

The Phase 3 BUILD/PLAN WorkspaceMode abstraction was removed by `c3-remove-planning-instruments`; it is not carried into Phase 4.

After the correction, ordinary IDE behavior is the baseline presentation. Product Phase 4 may add bounded software-map inspection surfaces as required for qualification. Product Phase 5 defines the future multi-tab Visual Software Planning workspace and any resulting workspace-mode/perspective concepts from first principles.

Theia Perspectives may be used as an adapter if qualified. Critical product state must not depend directly on an unstable framework API.

## Customization hierarchy

1. Standard Theia contribution points.
2. Custom widgets/services.
3. Service rebinding/replacement.
4. ApplicationShell/custom shell changes where justified.
5. Source fork only as last resort.

Deep shell coupling should be isolated behind Dope adapters.

## Upgradeability

Upgradeability remains an architectural design requirement, not a Foundation Spike 0 execution gate.

Dope should continue to isolate framework coupling, prefer supported extension/rebinding seams, and avoid private shell internals. When a real Theia upgrade is undertaken, treat that upgrade as a qualification event: record required dependency/config/source/CSS repairs, rerun the affected IDE/package evidence, and reject broad product-domain rewrites or framework forks unless explicitly accepted.

## Extension compatibility

Initial tooling matrix:
- TypeScript/JavaScript
- Node debugging
- JSON
- Markdown
- Git
- terminal
- ESLint
- Prettier
- at least one additional Open VSX extension installed and used

Compatibility claims require real evidence.

## Security / authority boundary

When mutation-capable AI is introduced, no model receives direct filesystem/process mutation authority.

AI
-> ProposedAction
-> Authority / Permission Layer
-> ToolExecutor
-> filesystem / process / Git / browser / network

Repository content, extensions, remote tools, MCP servers, and model output are untrusted relative to Dope's configured authority ceiling.

## Self-development and bootstrap independence

Dope should eventually be able to develop Dope, but self-development is an ordinary-project use case of the architecture rather than a separate execution mode.

When the target repository is Dope:
- Project Intelligence uses the same canonical product contracts;
- future Visual Software Planning uses the same graph-centered product contracts as any other project;
- model providers use the same capability adapters;
- Agent Runtime uses the same execution path;
- observation and mutation authority remain unchanged;
- validation and ChangeSet evidence follow the same rules;
- no hidden "self" capability may raise authority or bypass review.

Bootstrap independence is a hard architectural constraint.

A broken or partially upgraded Dope installation must not make the Dope repository unrepairable. Source and Git remain ordinary external artifacts. Build, test, migration, and recovery procedures must retain a path through conventional tooling. Durable Project Mind state must have a documented recovery/export strategy that does not require the healthy application path it is intended to describe.

The self-development progression is deliberately phase-aware:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
-> Dope as agent supervisor
-> Dope develops Dope

This progression is a qualification overlay. It does not authorize implementing later-phase AI, authority, or delegation systems during Foundation Spike 0.

Dogfooding must not create stack-specific domain coupling. A design that works only because Dope is a TypeScript/Theia repository has not proven the general product contract.

## Relationship to George

George code may be studied or selectively borrowed only where it fits this architecture.

No George API, state schema, TUI assumption, provider choice, or compatibility requirement is authoritative for Dope.


## Unaccepted sMap review work-state boundary — ADR 0018

An Architecture Review is durable **work state**, not canonical architecture.

During initial sMap synthesis Dope may persist a versioned `.dope/smap-analysis.json` containing enough source-associated analysis state to reopen the exact unaccepted review. Once review begins, the developer's current working draft is the resumable object and must survive backend/app restart.

Boundary rules:
- `@dope/software-map` owns provider-independent review/draft contracts, acceptance diagnostics and strict architecture validation;
- `@dope/code-analysis` owns safe project-local analysis-work persistence under `.dope/`;
- `@dope/theia-extension` adapts frontend edits to typed save/revision calls and renders shared diagnostics; it does not define acceptance semantics;
- invalid/incomplete working drafts may be persisted, but cannot be accepted until deterministic validation is clear;
- stale writes cannot overwrite a newer persisted draft;
- reopening a persisted review performs no provider call;
- cancellation and successful acceptance clear the analysis-work file;
- accepted architecture remains only `.dope/architecture.json` plus matching `.dope/smap.json`.

Acceptance diagnostics are deterministic and provider-free. They enumerate all known blockers rather than making the developer repair one throw-first error at a time. Diagnostics identify implicated review nodes/paths where possible, but never choose an architectural owner or silently repair the draft.

## Physical analysis input isolation and Planning Map basis semantics — ADR 0019

Physical analysis input identity and Dope project/work state are separate domains.

Language analyzers may fingerprint repository source and real build/configuration inputs, but must not recursively consume Dope-owned state beneath `.dope/` as generic source/config input. This includes Planning Maps, Project Mind files, synthesis work, initialization markers and other Dope metadata. `.dope/architecture.json` is the deliberate exception in meaning, but it enters the Software Map through the dedicated canonical declaration reader/fingerprint rather than generic JSON/config discovery.

Planning Map basis has two layers:
- **semantic basis identity:** canonical architecture revision/fingerprint plus Physical Map input fingerprint;
- **observation identity:** the published Physical Map generation associated with a concrete snapshot.

A generation increase with unchanged semantic basis means the same inputs were observed again; it is not itself a software change and must not mark a Planning Map stale. Generation remains required for exact snapshot/query/preview race guards so data from different published observations cannot be mixed.

Code should use explicit semantic-basis comparison where deciding whether planning intent is stale and exact-observation comparison where validating a concrete in-flight snapshot. Do not use raw whole-object equality when the intended question is semantic staleness.

## Phase 6 physical-flow contracts

Phase 6 deepens the Software Map evidence/query layer before adding directional presentation.

### Domain separation

The existing `GraphRelationship` dependency/structure graph remains useful for architecture. Data Flow must not reinterpret every `imports`, `references` or aggregated `depends-on` edge as information movement.

Add a separate language-independent physical-flow contract in `@dope/software-map` (exact type/file names may follow implementation style). The contract owns:
- deterministic/stable flow fact identity for unchanged inputs;
- source and target references to existing Software Map identities or stable derived physical endpoints;
- typed directional flow semantics;
- zero or more contextual projection roles;
- evidence IDs and optional originating lower-level flow-fact IDs for aggregation;
- optional payload/type/schema/event label only when evidenced;
- explicit unknown/unsupported detail rather than fabricated values.

Derived physical endpoints such as an HTTP ingress, PostgreSQL store, queue or external service may participate in Data Flow without becoming canonical Systems/Subsystems/Components.

### Evidence discipline

A physical flow fact is accepted only when supported by deterministic syntax/semantic/framework evidence or explicit recorded-runtime observation.

Negative invariant:

```text
import != call
reference != value flow
dependency != data flow
```

Dependency relationships may guide candidate discovery or aggregation but cannot independently establish a flow hop.

### Analyzer strategy

The first implementation remains TypeScript/JavaScript-first and qualifies against Adaptive SEO.

Phase 6 should add:
1. generic TypeScript call/invocation evidence using compiler/type-checker-resolved `CallExpression` targets when the callee resolves to project code;
2. bounded framework/boundary extractors sufficient for a real Adaptive SEO path, initially targeting supported Express-style inbound request/response handling, PostgreSQL persistence reads/writes and deterministic external-client boundaries where present.

Do not promise arbitrary Node framework support or whole-program value/taint analysis.

Architecture-synthesis `FrameworkFact` remains synthesis evidence. Physical Data Flow should use dedicated physical-flow facts/evidence rather than promoting synthesis-oriented document/framework hints into physical truth.

### Query boundary

Expose a provider-independent, generation-scoped bounded Data Flow query in the Software Map service. It should:
- accept focused architecture identity/scope and bounded options;
- aggregate lower-level flow facts to the active System/Subsystem detail level without losing origin/evidence traceability;
- preserve branches, joins, cycles and repeated/external round trips;
- report unsupported/truncated/unknown detail honestly;
- produce deterministic ordering and stable IDs for unchanged inputs;
- reject mixed-generation or stale-project results.

The backend, not React Flow, owns flow selection/aggregation semantics.

### Presentation boundary

The existing center Physical Map tab family owns both Architecture and Data Flow modes. Do not create a second widget/controller state owner solely for Data Flow.

Architecture/Data Flow switching preserves workspace, focus, selected architecture identity and source-navigation context. Data Flow edges are inspectable; selecting a flow hop must make its evidence/provenance and source location available through Dope-owned UI/service paths.

Initial layout is deterministic layered directional layout implemented in Dope presentation/projection code. An external automatic layout engine is deferred unless real qualification demonstrates the bounded layout is inadequate.

### Persistence

Physical flow facts/projections are rebuildable derived state. Phase 6 introduces no required `.dope/data-flow.json`. Repository source plus canonical `.dope` state must be sufficient to regenerate equivalent flow from identical supported inputs.
