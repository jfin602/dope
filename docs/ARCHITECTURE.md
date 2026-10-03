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
Project Intelligence / Software Map / Visual Software Planning / Flow / Chat + Context / later Living Software Knowledge Model / Agent Runtime
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

Presentation preferences such as theme, keybindings, panel layout, editor preferences, sMap viewport/semantic LOD/focus, relationship visibility and explicit developer-selected node colors may persist for the user or project, but they are not canonical project-domain state. Map presentation persistence must remain outside deterministic analysis/evidence identity and Planning Map semantic basis. A deleted/reset presentation preference may change only how the same architecture is displayed.

Map color uses a curated palette of no more than ten map-safe colors. Architecture/Physical Map Systems receive deterministic automatic defaults from that palette, and descendants inherit the nearest resolved ancestor color. An explicit developer override becomes the inherited color root for that branch until a deeper explicit override is encountered; clearing an override returns the node to Automatic. Automatic default assignment and inheritance are derived presentation state and must remain stable for the same project and stable map identities across restart, refresh and re-analysis. Only explicit developer choices need persistence; automatic color resolution must not become canonical architecture, Physical Map evidence or Planning Map semantic state. Color selectors expose Automatic plus the available palette choices, with a visible swatch and readable label for every choice.

For sMap readability, hierarchy and containment are the default visual grammar. Geometric zoom/focus may progressively disclose deeper implementation detail and relevant relationship neighborhoods, but they do not create graph facts. If a map identity label is rendered at the active LOD, the complete source value must remain available in the rendered node; ellipsis or clipping must not substitute for architectural identity. Color is reinforcement only and must not override meaning-bearing realization/drift/planning states. Alternate themes and color-vision-deficiency use cases must retain sufficient non-color cues.

Dope is dark-first: first-run/default presentation uses the Dope-owned **Dope Dark** theme. Its locked brand palette is `#1F1F1F` workbench anchor, `#FF7A1A` primary orange, `#FFB15C` highlight orange, and `#C75100` deep orange. Brand colors belong in the theme layer; Dope widgets should continue consuming semantic Theia tokens rather than duplicating brand hex values. Explicit user theme selection must remain supported, persist across restart, and override the default; selecting another compatible theme must deactivate Dope Dark-specific overrides. Syntax and semantic diagnostic colors remain meaning-bearing and are not globally recolored to the brand palette.

## Workbench placement contract

Dope's default workbench placement is part of the product architecture, while individual user layout customization remains presentation state.

Default placement:
- **Left primary sidebar / Activity Bar:** project-navigation surfaces, including a dedicated **sMap** button and Software Map inspector. The inspector owns hierarchy, dependency, violation, evidence and source-navigation views for the Physical Map.
- **Center workspace:** editors and ordinary working surfaces. Product Phase 5 adds the large visual **Physical Map** and **Planning Map** canvases here as editor-like tabs/workspaces. Product Phase 6 adds **Flow** as a directional Physical Map projection in the same center-workspace model. **Edit Architecture** is the permanent center-workspace editor for System -> Subsystem -> Component architecture, reused for initial proposal acceptance and later accepted-map edits. Map tabs are canvas-first: the diagram consumes the maximum practical center area, map-global controls are consolidated into one compact icon-first toolbar with tooltips/accessibility semantics, and immediate selection/details UI is a floating overlay rather than a persistent top pane. The overlay may expand, compact or minimize without becoming canonical state or forcing graph re-layout. The left sMap inspector remains the authoritative deep inspection/navigation surface.
- **Right secondary sidebar:** reserved by default for future **Agent Mind / chat / AI interaction**. The Software Map inspector must not claim this area as its default home.
- **Bottom panel:** terminal, Problems, tests, runtime and similar execution/diagnostic surfaces.

This is a default product-layout contract, not canonical project state and not a ban on user rearrangement.

The September 29, 2026 ADR 0008 decision lands while Phase 4 P5 is already exercising the pre-decision implementation. P5 may finish without mid-run churn. A bounded post-P5 Phase 4 correction must rename the live software-architecture package/symbol/UI vocabulary and move the inspector to the left-side sMap surface before P6 closeout. The correction must not implement the Phase 5 visual canvas.

## sMap initialization contract

Opening a project does not implicitly authorize Software Map construction.

For a project whose sMap has never been initialized, Dope offers an explicit Analyze Project choice. Declining leaves the sMap uninitialized and does not create canonical architecture or derived map state. The sMap view remains available with an Analyze Project action so initialization can be started later.

The Software Map application/domain layer distinguishes at least `uninitialized -> analyzing -> review_required -> initialized`. Initialization state is not equivalent to the existence of `.dope/architecture.json`.

For an existing project, accepted initialization follows: bootstrap-document detection/choice -> deterministic evidence collection (including eligible repository-document claims) -> provider/runtime readiness -> deterministic evidence planning/global skeleton + responsibility signals + selected bootstrap/orientation context -> System Discovery -> System Challenge -> per-System Subsystem Discovery -> Subsystem Challenge -> per-Subsystem Component Discovery -> reconciliation/targeted verification -> validated ArchitectureProposal -> **Edit Architecture** review/correction -> explicit acceptance -> canonical architecture. Before acceptance, generated structure is proposal state only.

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

## Flow projection boundary

Product Phase 6 extends the Physical Map with a provider-free directional **Flow** projection of application-level execution/behavior.

### Snapshot ownership

Flow is first-class rebuildable Physical Map state. `PhysicalMapSnapshot` owns `PhysicalFlowFact[]` plus derived Flow endpoint records alongside graph nodes, structural relationships, evidence and violations.

Static Flow publishes atomically with the same project identity, analysis generation and source/config/canonical input fingerprint as the rest of the Physical Map. Phase 6 does not introduce a second Flow generation counter, independent durable Flow database or separate mandatory Flow index.

Future recorded-runtime observations reuse the same Flow fact/evidence boundary with explicit observation identity. They do not silently redefine the static source/config/canonical fingerprint.

### Flow facts and endpoint identity

A physical Flow fact is one evidence-backed application execution interaction. Initial semantics are `receives`, `invokes`, `reads`, `writes`, `calls-external`, `publishes`, `consumes` and `responds`.

A deterministically resolved project-code call is sufficient evidence for `invokes` even when argument/return lineage is unknown.

Derived non-architectural Flow endpoints are separate from `GraphNode`. Examples include inbound/outbound HTTP boundaries, datastores, queues/topics/jobs, external services/APIs, file/blob storage and clients where evidenced.

Endpoint identity is deterministic and conservative: normalize only evidenced protocol/method/path/service/store/queue properties. Multiple observations collapse to one endpoint only when equivalence is proven. Otherwise retain narrower source- or connection-scoped identities. Every endpoint keeps source/evidence anchors for architectural context without becoming canonical System / Subsystem / Component / CodeEntity state.

### Truth and enrichment

Permanent negative rule:

```text
import != invocation
reference != invocation
dependency != execution flow
```

Structural dependency facts may guide discovery but cannot independently become Flow.

Optional argument/return type, HTTP method/path, request/response schema, event/topic/schema and directly evidenced persistence entity/table information may enrich Flow. Broad/unhelpful types and unsupported payload details stay absent/unknown. Phase 6 does not require field-level lineage, alias/property tracking, taint propagation or inferred DTO transformations.

Serialization/deserialization is normally Processing metadata unless it corresponds to a distinct meaningful execution component.

### Query, stitching and aggregation

Flow queries operate provider-independently over the published snapshot and remain project/generation guarded.

Static execution paths stitch only proven Flow facts. Upstream/downstream traversal supports deterministically resolved ordinary calls, async/await continuations, callbacks/promises with proven callback targets, and producer/consumer continuation only when event/queue identity is established.

Static Flow means **possible evidence-backed execution**, not proof that one concrete runtime request took every reachable branch. Reserve Observed Flow for future runtime-observed paths.

System/Subsystem aggregation is path-preserving. An aggregate Flow edge may exist only when lower-level facts form a continuous evidenced origin path and it retains `originFlowFactIds`/provenance. Gaps remain gaps. Repeated equivalent facts may collapse visually, but materially different interaction kinds or data annotations must not be merged into invented semantics.

Branches/fan-out and joins/fan-in are graph topology, not new base interaction kinds. Ordinary async is interaction metadata; real queue/topic/job/event handoffs use explicit derived endpoints. Cycles remain explicit back-edges. Retries and optional/error paths appear only when deterministic evidence proves them.

### Presentation boundary

The existing center Physical Map state owner hosts complementary `Architecture` and `Flow` modes. Switching preserves workspace/project, focused architecture identity, selection and source-navigation context.

The initial Flow view is System-first and overview-first: major Inputs, Outputs, participating architectural scopes, Stores, External endpoints and high-level connections. Selecting an Input or participant highlights relevant Static Flow while unrelated Flow stays subdued for orientation. Explicit upstream/downstream tracing deepens exploration. Code-level invocation detail appears through progressive focus rather than in the initial System overview.

Flow roles such as Input, Boundary, Processing, Store, External and Output are projection semantics, never canonical architecture node kinds.

Directional layout is disposable presentation state and may optimize input -> processing -> output comprehension while still representing branches, joins, cycles and asynchronous/external boundaries.

Flow may apply a projection-specific automatic color treatment that intentionally departs from Architecture parent-color inheritance to reinforce evidenced source -> downstream direction. The visible directional layers may be mapped deterministically into the same bounded palette, with nearby layers sharing colors when necessary. Branches at the same approximate downstream stage may share a treatment, joins progress into the later-stage treatment, and cycles/back-edges retain explicit arrow direction rather than being forced into a misleading linear color sequence. Node/edge tinting may reinforce that progression, but layout, arrowheads, routing, labels, selection/trace state and other non-color cues remain authoritative for direction. Flow coloring must not imply an execution fact, ordering or runtime observation that the underlying evidence does not establish. Architecture color preferences remain separate; a Flow-specific override, if later supported, must not silently rewrite the node's normal Architecture color preference.

React Flow/browser presentation does not own Flow discovery, aggregation, evidence or truth.

Phase 6 requires no model provider, AI Presence, mutation authority, mandatory live tracing, Planning Map Flow editing or new durable Flow store.


## Model and provider boundary

Dope must not depend architecturally on one model, model family, provider, API, hosted service, local runtime, or provider-native chat/session ontology.

First-class compatibility requirements include:
- OpenAI / ChatGPT / Codex capabilities and workflows
- local models and local inference runtimes
- future providers through replaceable adapters

The durable boundary is Dope's Model Runtime and capability contract.

Provider adapters translate provider-specific requests, streaming, tool formats, response identifiers, reasoning controls, context handles, token-usage metadata and errors into Dope-owned contracts.

For sMap synthesis specifically, providers are explicit user-selected execution adapters beneath a Dope-owned synthesis-strategy boundary. Provider selection must never alter canonical Software Map semantics, and failure must never silently route repository evidence to another provider.

Do not spread provider-name conditionals through product/domain code.

### sMap synthesis strategy / Model Runtime seam

ADR 0022 separates Software Map authority, sMap synthesis strategy and general model execution.

The Software Map domain owns deterministic evidence/provenance, architecture semantics, final ArchitectureProposal validation, review and developer acceptance. The sMap synthesis layer owns architecture-analysis instructions, hierarchy choreography, evidence/view selection and model-class-specific context/decomposition strategy. Model Runtime owns discovery/selection, capabilities, structured generation, readiness/probe, optional warm-up, cancellation and normalized provider usage/failures. Concrete LM Studio/Gemini/OpenAI transports remain adapters beneath that runtime.

Local and hosted synthesis must converge on the same evidence authority, architecture ontology, final proposal contract, validation and developer acceptance semantics, but they do not need identical prompts, stage counts, context packing or call topology. Model-specific synthesis strategy may differ only behind the synthesis boundary and must never weaken provenance or create provider-specific canonical state.

The pre-Phase-7 correction `c6-branch-seam` may establish the minimal reusable Model Runtime/session seam required by existing sMap synthesis at unchanged `0.6.7`. It does not authorize Agent Mind, general chat/Ask/Explain behavior, tool calling, mutation authority or delegation before Phase 7. Supporting Local synthesis must remain lazy/provider-scoped so a hosted path never requires LM Studio setup and a Local path never requires cloud configuration.

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

## Living Software Knowledge Model and background alignment boundary

Product Phase 8 adds a knowledge-alignment layer over existing Software Map identities after general AI Presence exists and before mutation-capable Scoped Delegation.

The durable conceptual layering is:

```text
source / runtime / docs / ADRs / contracts / schemas
                     |
             evidence + provenance
                     |
               Software Map
                     |
       Living Software Knowledge Model
                     |
          alignment / impact engine
                     |
       background analysis scheduler
                     |
                Model Runtime
                     |
          local / hosted adapters
```

The Living Software Knowledge Model is not a second canonical architecture database. Canonical architecture remains developer-owned, Physical Map facts remain deterministically evidenced or recorded observations, and documentation/contracts remain separately attributable representations. The alignment layer links those representations through stable Software Map identity and preserves disagreement rather than forcing synchronization.

Background alignment is event-driven and impact-scoped. Repository/workspace changes first update deterministic fingerprints and evidence dependencies. Only assertions whose supporting basis changed are invalidated. Unaffected assertions must not be sent back through a model merely because unrelated files changed.

Deterministic-first is a hard rule:
- use source analysis, fingerprints, schema/API checks, ownership, identity and contract validation wherever the result can be established mechanically;
- invoke semantic inference only when interpretation is actually required;
- never ask a model to replace a cheaper deterministic check.

Local-first is a hard rule for continuous semantic maintenance:
- normal background semantic checks use a configured local runtime through the provider-independent Model Runtime;
- requests are compact, structured micro-inference over the smallest sufficient evidence package;
- local uncertainty produces a finding/needs-review state rather than silent provider escalation;
- hosted/frontier inference requires explicit developer-controlled escalation and must never be triggered merely because a background local check is uncertain;
- no background path silently incurs hosted-provider cost or sends project evidence off-device.

The background scheduler owns debounce, deduplication, impact batching, queue priority, cancellation and resource arbitration. It is execution/application state, not canonical knowledge. Foreground editor interaction, explicit AI work, builds/tests and other developer-directed work have priority over background inference. Resource pressure, battery-sensitive operation or provider/model contention may pause or reduce background work without changing knowledge truth.

Alignment results are derived findings. They may identify source/map drift, source/documentation drift, source/contract disagreement, contract/map disagreement, orphaned evidence or unrepresented implementation. Model output may classify or explain a finding but cannot silently mutate source, documentation, contracts, canonical architecture or Physical Map truth.

General-purpose ambient intelligence remains deferred. Phase 8 authorizes bounded ambient/background behavior only for maintaining the Living Software Knowledge Model.

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

Architecture proposals are edited in the center-workspace **Edit Architecture** surface rather than a stacked form. During initial synthesis it presents an indented System -> Subsystem -> Component structure with focused node details/evidence and developer correction controls before explicit acceptance. After initialization the same product surface edits a draft derived from accepted canonical architecture and requires explicit Save Architecture. The left sMap sidebar owns setup/progress/status/navigation and the initialized Open / Refresh / Edit Architecture entry actions. Edit Architecture is distinct from the visual Physical Map/Planning Map canvas.

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

## Phase 7 durable Chat architecture

Phase 7 introduces a Dope-owned Chat domain while preserving both architectural constraints: GUI-first must not become GUI-coupled, and AI-native must not become provider-coupled.

The intended dependency shape is:

```text
ChatPanel(s)
    |
ChatService
   / \
ChatRepository   Context Composer
    |              |
.dope/chats/      +-- editor/selection
                   +-- Project Mind
                   +-- Architecture / Physical Map / Flow
                   +-- Planning Maps / WorkItems
                   +-- bounded saved-Chat retrieval
                         |
                    Model Runtime
                  /      |       \
              Local    Gemini    OpenAI / future
```

`ChatPanel` is a Theia presentation adapter. It may be instantiated in left, right, center or bottom shell areas, but it does not own conversation persistence, provider sessions or canonical project state. Every instance draws from one project Chat repository and has two primary states: Select Chat and Chat.

ChatService owns project-scoped Chat identity, message lifecycle, title/settings mutations, folder/query operations and frontend/backend events. ChatRepository owns safe readable persistence beneath `.dope/chats/`, schema/revision/conflict behavior and project/path containment. Chat IDs remain stable across folder moves. Chat files are Dope work state and are excluded from generic repository source/config analysis; writing them cannot change Physical Map input identity or Planning Map semantic basis.

A project-level live-open registry coordinates ChatPanel ownership: one Chat may have at most one live composer/panel owner. Selecting an already-open Chat reveals/focuses the current owner instead of creating a duplicate writer. Panel close, navigation back to Select Chat or switching Chats releases ownership. Workbench layout/restoration state may remember which ChatPanel instance/location referenced a Chat, but the conversation itself remains in ChatRepository. Cross-process/project-window writers require backend revision/locking/lease protection rather than trusting frontend ownership alone.

The composer has a persistent second toolbar row. It provides contextual tool/attachment controls, a compact connected-model selector and send/cancel/retry state. The selected model is snapshotted when Send is pressed and determines which connected Model Runtime capability receives that message. A single Chat may therefore contain turns from different providers/models. Failure of the selected model is surfaced; Dope does not silently redirect the request to another model/provider.

Each Chat has persistent settings reached from a right-justified cog in the ChatPanel top bar. These settings belong to the Chat identity, not the panel location. They may govern context eligibility/budget/history/retrieval and default model/model-specific capability preferences. Global provider connections, credentials and endpoints remain application/runtime configuration and must not be copied into project Chat state.

Context composition is Dope-owned orchestration. Active conversation history is direct context subject to budgeting; other saved Chats are an available corpus reached through explicit attachment/search/bounded retrieval. Context may reference source/editor state and existing Dope domains, and turn provenance may record which references were supplied. It must not persist hidden provider reasoning or reinterpret model narration as deterministic evidence/canonical project truth.

Phase 7 Chat tools are observation/context capabilities only. Mutation-capable filesystem/process/Git/network actions remain behind future Tool Runtime + Authority/ProposedAction boundaries and are not authorized by ChatPanel existence.

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

## Edit Architecture workspace boundary — ADR 0024

**Architecture** is the canonical user-facing term for Dope's System -> Subsystem -> Component structural organization and editor. Terms such as hierarchy, hierarchical and hierarchy-first remain valid for structural/algorithmic descriptions, but user-facing workspace/action names use Architecture.

The left Software Map inspector exposes **Edit Architecture** in the initialized compact action group beside Open Physical Map and Refresh Software Map. Activation opens or focuses one project-scoped center-workspace editor rather than duplicating tabs.

Edit Architecture deliberately owns independent presentation state. Its selection, expansion, scroll/focus and Search Deeper draft state do not synchronize with Physical Map, Flow or left-outline selection/navigation. The existing left-outline <-> center-map shared Software Map selection contract remains unchanged.

On an initialized project, the backend/application boundary must provide a bounded way to read canonical architecture into an editor draft and explicitly save a validated replacement against an expected current architecture fingerprint/revision or equivalent optimistic-concurrency token. Typing and accepted branch refinements are not canonical writes. A successful Save Architecture updates the existing project-local canonical architecture boundary and then performs ordinary deterministic Software Map analysis/reconciliation; it does not imply a fresh full synthesis request.

Search Deeper may operate on accepted architecture drafts for Systems and Subsystems using the current edited branch plus existing evidence authority. The result remains a preview, stale target branches fail closed, unrelated edits remain intact, and accepting the refinement changes only the draft until explicit Save Architecture. Manual architecture editing remains provider-independent.

The first `c6-edit-architecture` correction does not add a new history/revision database, durable accepted-map edit sessions, Flow/Planning semantic changes or general AI Presence.


## Physical analysis input isolation and Planning Map basis semantics — ADR 0019

Physical analysis input identity and Dope project/work state are separate domains.

Language analyzers may fingerprint repository source and real build/configuration inputs, but must not recursively consume Dope-owned state beneath `.dope/` as generic source/config input. This includes Planning Maps, Project Mind files, synthesis work, initialization markers and other Dope metadata. `.dope/architecture.json` is the deliberate exception in meaning, but it enters the Software Map through the dedicated canonical declaration reader/fingerprint rather than generic JSON/config discovery.

Planning Map basis has two layers:
- **semantic basis identity:** canonical architecture revision/fingerprint plus Physical Map input fingerprint;
- **observation identity:** the published Physical Map generation associated with a concrete snapshot.

A generation increase with unchanged semantic basis means the same inputs were observed again; it is not itself a software change and must not mark a Planning Map stale. Generation remains required for exact snapshot/query/preview race guards so data from different published observations cannot be mixed.

Code should use explicit semantic-basis comparison where deciding whether planning intent is stale and exact-observation comparison where validating a concrete in-flight snapshot. Do not use raw whole-object equality when the intended question is semantic staleness.

## Phase 6 physical-flow contracts

Phase 6 deepens the Software Map evidence/query layer before adding directional presentation. Flow is application-level execution flow, not a compiler control-flow graph.

### Domain separation

The existing `GraphRelationship` dependency/structure graph remains useful for architecture. Flow must not reinterpret every `imports`, `references` or aggregated `depends-on` edge as execution. A deterministically resolved invocation is a valid Flow interaction even when no payload lineage is known.

Add a separate language-independent physical-flow contract in `@dope/software-map` (exact type/file names may follow implementation style). The contract owns:
- deterministic/stable flow fact identity for unchanged inputs;
- source and target references to existing Software Map identities or stable derived physical endpoints;
- typed directional flow semantics;
- zero or more contextual projection roles;
- evidence IDs and optional originating lower-level flow-fact IDs for aggregation;
- optional payload/type/schema/event label only when evidenced;
- explicit unknown/unsupported detail rather than fabricated values.

Derived physical endpoints such as an HTTP ingress, PostgreSQL store, queue or external service may participate in Flow without becoming canonical Systems/Subsystems/Components.

### Evidence discipline

A physical flow fact is accepted only when supported by deterministic syntax/semantic/framework evidence or explicit recorded-runtime observation. For internal code, a deterministically resolved call target is sufficient execution evidence for an `invokes` interaction; data/payload annotations require additional evidence.

Negative invariant:

```text
import != invocation
reference != invocation
dependency != execution flow
```

Dependency relationships may guide candidate discovery or aggregation but cannot independently establish a flow hop.

### Analyzer strategy

The first implementation remains TypeScript/JavaScript-first and qualifies against Adaptive SEO. Generic resolved calls establish execution structure first; richer data semantics are layered on afterward.

Phase 6 should add:
1. generic TypeScript call/invocation evidence using compiler/type-checker-resolved `CallExpression` targets when the callee resolves to project code;
2. bounded framework/boundary extractors sufficient for a real Adaptive SEO path, initially targeting supported Express-style inbound request/response handling, PostgreSQL persistence reads/writes and deterministic external-client boundaries where present.

Do not promise arbitrary Node framework support or whole-program value/taint analysis.

Architecture-synthesis `FrameworkFact` remains synthesis evidence. Physical Flow should use dedicated physical-flow facts/evidence rather than promoting synthesis-oriented document/framework hints into physical truth.

### Query boundary

Expose a provider-independent, generation-scoped bounded Flow query in the Software Map service. It should:
- accept focused architecture identity/scope and bounded options;
- aggregate lower-level flow facts to the active System/Subsystem detail level without losing origin/evidence traceability;
- preserve branches, joins, cycles and repeated/external round trips;
- report unsupported/truncated/unknown detail honestly;
- produce deterministic ordering and stable IDs for unchanged inputs;
- reject mixed-generation or stale-project results.

The backend, not React Flow, owns flow selection/aggregation semantics.

### Presentation boundary

The existing center Physical Map tab family owns both Architecture and Flow modes. Do not create a second widget/controller state owner solely for Flow.

Architecture/Flow switching preserves workspace, focus, selected architecture identity and source-navigation context. Flow edges are inspectable; selecting a flow hop must make its evidence/provenance and source location available through Dope-owned UI/service paths.

Initial layout is deterministic layered directional layout implemented in Dope presentation/projection code. An external automatic layout engine is deferred unless real qualification demonstrates the bounded layout is inadequate.

### Persistence

Physical flow facts/projections are rebuildable derived state. Phase 6 introduces no required `.dope/data-flow.json`. Repository source plus canonical `.dope` state must be sufficient to regenerate equivalent flow from identical supported inputs.
