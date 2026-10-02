# Dope Roadmap

Status: ACTIVE ROADMAP
Current stage: Product Phase 6 — Flow is **ACTIVE / PLAN APPLIED** from coherent baseline `0.6.0` established by Phase 5 owner-close transition `710edb362f9881ab41215705db4f08d8daca6293`. Product Phase 5 is owner-closed for sequencing; its P11 remains Not Green and P12 was not executed. The approved Phase 6 decomposition is P1-P8 (`0.6.1`-`0.6.8`); executable prompts are the next workflow.

Phase 2 P6 `0.2.6` remains **Not Qualified** as an evidence audit. The owner explicitly accepted the retained gaps for sequencing and closed Phase 2 without relabeling them Green. Phase 3 is therefore authorized from `0.3.0`; see `docs/planning/p3/activation.md`.

This roadmap deliberately starts small.

Dope's long-term vision is an integrated development environment spanning coding, project knowledge, planning, research, architecture, AI collaboration, validation, and durable development context. The initial roadmap does not attempt to build that whole vision at once.

The sequencing rule is:

Theia
-> IDE
-> Project Mind
-> Planning Foundation
-> remove Phase 3 Planning instruments
-> Physical Map
-> sMap initialization + architecture synthesis + developer-authority correction
-> hierarchy-first sMap synthesis + visible progress + quality/performance qualification
-> compact shared synthesis contracts + explicit Local/Gemini providers
-> responsibility-oriented sMap synthesis + hierarchical review
-> coverage diagnostics + iterative branch review
-> enforce project-local sMap persistence
-> align app color system to the Dope logo
-> Visual Software Planning
-> sMap readability correction
-> Flow
-> AI Presence
-> Scoped Delegation
-> Development Sessions

Each stage should make Dope more useful to the developer before the next layer of AI is added.

## Progressive self-development qualification

Dope should increasingly be developed inside Dope as the roadmap advances.

This is a cross-phase qualification ladder, not an additional phase and not permission to pull later capabilities forward.

| Roadmap stage | Self-development qualification |
| --- | --- |
| Foundation Spike 0 | External bootstrap. Qualify the substrate with existing external tools. Self-hosting is not required. |
| Product Phase 1 — IDE Alive | Dope as editor. Open and work on the Dope repository comfortably inside Dope using ordinary IDE capabilities. |
| Product Phase 2 — Project Mind | Dope understands Dope. Its own decisions, notes, questions, ideas, and durable project context are useful through Project Mind. |
| Product Phase 3 — Planning Foundation | Dope plans Dope. A real Dope feature can move from thought/decision into a live Plan and Tasks without leaving Dope. |
| Product Phase 4 — Physical Map | Dope maps Dope. Its lower-level semantic relationships, declared boundaries and evidence-backed current-state graph can be explored. |
| Correction c4 — Architecture Discovery | Dope initializes Dope's sMap deliberately. Deterministic evidence feeds bounded LLM architecture synthesis, the developer corrects/accepts Systems/Subsystems/Components, and implementation realization/drift is visible. |
| Correction c4-hierarchical — sMap Synthesis | Dope discovers Dope's Systems through a repository-global discovery/challenge pass, descends per System into Subsystems/Components, shows live analysis-stage progress, and qualifies architecture quality plus the <=8-minute initial-analysis objective without an eight-minute hard timeout. |
| Correction c4-gemini — Shared sMap Provider Pipeline | Owner-closed Not Qualified after Gemini-only debugging: compact contracts/provider integration landed, but responsibility decomposition remained weak and the planned full provider comparison did not run. |
| Correction c4-synth-improvements — Responsibility-oriented Synthesis | OWNER-CLOSED / NOT QUALIFIED after P4. Responsibility naming and center review improved, but major implemented responsibilities remained omitted/merged; P5 is not run. |
| Correction c4-synth-coverage-review — Coverage + Iterative Review | OWNER-CLOSED / NOT QUALIFIED after stopped P6. The useful coverage/review implementation remains the accepted baseline; P7 is unexecuted and residual depth/qualification gaps remain explicit. |
| Deferred provider comparison | Removed from the pre-Phase-5 critical path without being relabeled Green; reconsider only when later provider optimization or AI Presence needs controlled comparison evidence. |
| Correction c4-storage — sMap Persistence | GREEN / QUALIFIED at `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`; durable Software Map state is project-local and portable. |
| Correction c4-color-theme — Dope Dark | GREEN / QUALIFIED at unchanged `0.4.6`. The bounded correction established the first-class Dope Dark theme while preserving explicit user override. |
| Product Phase 5 — Visual Software Planning | **OWNER-CLOSED FOR SEQUENCING.** Retained implementation includes visual Physical/Planning Maps, transformations, WorkItems, adoption, rebase and reconciliation. P11 remained Not Green and P12 was not executed; owner waiver does not relabel missing evidence Green. |
| Correction c5 — sMap Acceptance Debug Loop | P11 interruption at `0.5.11`: persist mutable unaccepted review work, enumerate deterministic acceptance blockers, and provide an offline checker so one generated sMap can be debugged across restarts without provider calls. This correction does not perform the actual Adaptive SEO debug loop. |
| Correction c5 — Physical Map Load | One-off `0.5.11` repair after accepted Adaptive SEO architecture loads in the inspector but the center Physical Map remains stuck at Loading. Remove duplicate Software Map channel/attach ownership if confirmed, preserve one shared published map state, and correct stale Phase 3/theme qualification assertions. P11 remains the qualification gate. |
| Correction c5 — Planning Basis Isolation | `0.5.11` correction after P11 reached durable Planning Maps but ordinary `.dope/planning-maps.json` persistence changed Physical Map identity and unchanged reanalysis falsely staled plans. Isolate `.dope/` from generic analysis inputs and make generation observation provenance rather than semantic staleness. |
| Correction c5 — sMap Readability | OWNER-CLOSED WITH PHASE 5. Readability implementation is retained; no standalone Green claim is inferred from the final commit subject without its own closeout record. |
| Product Phase 6 — Flow | **ACTIVE / PLAN APPLIED at `0.6.0`.** Dope explains how information moves through software through evidence-backed Physical Map flow facts and a directional projection. Approved stack: P1-P8 (`0.6.1`-`0.6.8`), with Adaptive SEO direct qualification at P7 and evidence-only closeout at P8. |
| Product Phase 7 — AI Presence | AI understands Dope through Dope-owned project state, architecture, Flow, Planning Map context and provider-independent read-only assistance. |
| Product Phase 8 — Scoped Delegation | Dope changes Dope. A bounded Dope task can be delegated through the ordinary authority, review, ChangeSet, and validation path. |
| Product Phase 9 — Development Sessions | Dope Builds Dope. A real Dope feature can travel end-to-end through durable project understanding, architectural planning, implementation, reconciliation, validation, review, and session closeout inside Dope. |

Self-development never receives privileged authority.

Dope must remain repairable with conventional external editor, terminal, Git, build, test, and recovery tooling even after the self-development milestone is reached.

Dogfooding Dope on its own repository is a necessary product qualification, not proof that the product generalizes to every stack.

## Foundation Spike 0 — Theia substrate qualification

Status: **QUALIFIED / OWNER-CLOSED** at package `0.0.6`, closeout commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`.

Purpose:
- prove or reject Theia as Dope's IDE/workbench substrate
- prove domain/presentation boundaries
- prove serious commodity IDE capability
- prove custom Dope UI and layout control
- prove typed frontend/backend communication
- prove minimal Dope-owned persistence and restart restoration
- stress customization and service rebinding
- prove Linux packaging

The spike does not need to prove model integration, Agent Mind execution, tool calling, autonomous mutation, or the future shared coding loop.

Minimal Project Mind and Planning surfaces may use spike data to prove that Dope-owned product views fit naturally inside Theia.

Authority:
- docs/THEIA-SPIKE.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md

Package family: 0.0.x

The gate is closed: Theia 1.75.0 is the qualified initial substrate. Upgradeability remains a design requirement and will be qualified on the first natural Theia upgrade rather than through synthetic Phase 0 work.

## Product Phase 1 — IDE Alive

Status: **NOT QUALIFIED — OWNER AUTHORIZED PHASE 2 SEQUENCING**

P6 closeout is **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). The subsequent explicit owner sequencing waiver permits Phase 2 entry without changing this qualification result; see `docs/planning/p2/activation.md`.

Purpose:
Make Dope a serious native development environment before differentiating it with production project intelligence or AI.

Package family: `0.1.x`  
Activation baseline: `0.1.0`

Initial scope:
- production Electron application as the primary user-facing shell
- repository/workspace opening
- editor and language tooling
- Explorer and search
- terminal
- Git/SCM and diff workflows
- debugger
- Problems
- test discovery/execution integration
- preferences and keybindings
- extension installation/use and restart persistence
- Dope branding and sensible default workbench layout
- dark-first default theme with persistent user-controlled theme override
- reliable startup, restart, editor/workbench and workspace restoration
- reproducible Linux AppImage packaging/launch
- direct interactive Theia GUI dogfooding using the Dope repository itself (browser-hosted workbench or Electron)

Presentation rule:

Dope prefers dark mode. First-run/default presentation should be dark and Dope-owned surfaces should be designed/qualified dark-first. Developers remain free to select light mode or compatible custom themes; an explicit user choice persists and overrides the default.

The browser application remains useful for development, debugging, automated qualification, and direct interactive P5 workbench qualification. P4 separately qualifies the packaged Electron artifact and native launch. Headless/CDP-only browser evidence is not sufficient.

The existing Foundation Spike Project Mind Note and Planning views remain provisional spike artifacts. Phase 1 may make them non-intrusive, but must not turn them into production Phase 2/3 features.

Exit condition:

P4 proves the packaged Dope desktop application can be built and launched normally, and P5 proves through direct interaction with the real Theia GUI—browser-hosted or Electron—that a developer can perform the normal development loop on the Dope repository: navigate, edit, search, run commands and tests, inspect diagnostics, use Git/diffs, debug, install/use extensions, restart, and resume without another IDE.

This is the first self-development milestone: **Dope as editor**.

## Product Phase 2 — Project Mind

Status: **OWNER-CLOSED FOR SEQUENCING — P6 AUDIT REMAINS NOT QUALIFIED**

Execution folder: `p2`. Activation source `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, package `0.2.0`; prompt versions `0.2.1`–`0.2.6`. The `0.2.6` closeout remains Not Qualified. On September 28, 2026 the owner explicitly accepted the unresolved evidence gaps for sequencing, closed Phase 2, and authorized Phase 3 from `0.3.0`. This is an owner waiver/phase disposition, not retroactive Green evidence. Historical authority remains `docs/planning/p2/phase-2-plan.md` and `docs/tasks/p2/closeout.md`.

Purpose:
Give the project durable memory that is useful to the developer before AI is required.

Initial artifact scope:
- Note
- Idea
- Question
- Decision

Foundation scope:
- ProjectArtifact identity
- relationships/links
- provenance
- persistence and migration discipline
- Project Mind navigation
- basic artifact search
- project reopen continuity

Bounded product behavior:
- create/read/edit/archive multiple artifacts in one local project;
- explicit Question answering and Decision acceptance/supersession;
- Ideas remain captured knowledge without automatic scope expansion;
- visible artifact relationships and project-relative file references, including unavailable targets;
- unsaved-draft preservation and visible save/conflict/error states;
- readable project-local storage, explicit legacy Note migration and external recovery;
- cross-process mutation exclusion, revision conflicts and project isolation;
- dark-first, keyboard-accessible presentation with supported light override.

Remote/multi-root Project Mind, Planning/Tasks, AI, semantic search, Sessions and synchronization remain deferred.

Product naming:
- Project Mind is the developer-facing concept.
- Project Intelligence is the internal domain/service boundary that implements it.

Exit condition:

Using Dope should leave the project easier to understand when it is reopened, even with no model configured. Direct GUI qualification must create/use all four artifact types, link/search them, restart/reopen and recover the same saved knowledge. Use actual Dope knowledge and a second local project to qualify isolation. Migration, corruption/conflicts, external recovery, framework independence, and the resulting Electron package also require evidence. Supplemental headless checks do not replace the interactive pass.

## Product Phase 3 — Planning

Status: **QUALIFIED FOR APPLICABLE SCOPE — `0.3.6`** (`docs/tasks/p3/closeout.md`). This is historical qualification, not a forward compatibility contract. Its live Planning instruments must be removed by the mandatory correction gate before Phase 4.

Execution folder: `p3`. Activation baseline: package `0.3.0`; prompt versions `0.3.1`–`0.3.6`. Authority: `docs/planning/p3/phase-3-plan.md` and `docs/planning/p3/activation.md`.

Purpose:
Make planning and implementation part of one durable project state rather than separate markdown files or chat workflows.

Initial scope:
- Plan with objective, context, status and human-visible revision;
- ordered PlanStep records with live status and explicit blockers/reasons;
- bounded Task records attached to a PlanStep;
- append-only planning history for explicit accepted mutations, not keystroke/event sourcing;
- links from Plans/Tasks to Project Mind artifacts and project-relative files;
- a real Planning workspace plus Task detail;
- bounded Project Mind -> Planning bridge actions, including creating a Plan from a Decision;
- ordinary editor navigation from Task/Plan working-set links;
- restart/reopen continuity, conflict protection and local-project isolation.

Plans are live control structures, not static memos. BUILD/PLAN mode remains presentation state and must never silently mutate Plan, PlanStep or Task status.

Phase 3 deliberately remains human-first. It has no model runtime, Codex/OpenAI product integration, local-model runtime, Agent Mind, ProposedAction, tool calling, AI ownership or mutation authority. ADR 0006 makes Codex/OpenAI the first reference provider when AI Presence begins in Phase 7; it does not pull AI into Phase 3.

Planning uses the existing Project Mind `projectId` as the project identity. Phase 3 does not create a competing project identity allocator. If a local project has no canonical Project Mind identity yet, Planning must surface that prerequisite rather than silently creating unrelated identity state. Planning persists separately in readable `.dope/planning.json` and validates identity against Project Mind.

Exit condition:

Using the real Dope repository with no model configured, a developer can move from genuine thought/Decision -> Plan -> ordered PlanSteps -> Tasks -> ordinary coding, revise and progress the plan explicitly, follow linked knowledge/files, restart/reopen and recover the same planning state/history, and demonstrate isolation in a second local project.

This is the first major product milestone:

Real IDE
+
Project Mind
+
Live Planning

## Mandatory pre-Phase-4 correction — `c3-remove-planning-instruments`

Status: **COMPLETE — GREEN / QUALIFIED FOR SEQUENCING at unchanged `0.3.6`** (`docs/tasks/c3-remove-planning-instruments/closeout.md`)

Version semantics: correction stack at unchanged package version `0.3.6`. This is not Product Phase 4 and must not advance roadmap versioning.

Purpose:
Remove the complete Phase 3 Planning product/runtime vertical slice so the Physical Map starts from a clean repository rather than beside obsolete planning architecture.

Required removal:
- `@dope/planning` package and root/package build/typecheck dependency wiring;
- Planning DTO/service contracts (`Plan`, `PlanStep`, `Task`, operations/history/document, service/client/path);
- Planning store/backend/RPC registration;
- Planning controller/widget/file navigation/view/menu/command;
- Project Mind related-Plan/create-from-Decision/show-Plan bridges;
- BUILD/PLAN mode, `WorkspaceMode.PLAN`, PLAN-specific local storage/title/status/CSS behavior;
- Planning-specific unit/storage/UI/restart tests;
- repository `.dope/planning.json` and live Planning storage documentation that only documents the removed runtime.

Required preservation:
- Phase 3 plans, prompts, closeout and evidence documents as history;
- Project Mind domain/persistence/UI and its repository `.dope/project-mind.json`;
- ordinary editor, terminal, SCM, debugger, search, Problems, tests, extensions, preferences/themes and packaging behavior;
- repository workflow and correction/phase runner semantics.

Exit condition:

At unchanged `0.3.6`, aggregate surviving checks/builds pass; Project Mind and ordinary IDE behavior remain usable; package/build graphs no longer depend on `@dope/planning`; and negative guards prove no production Planning service/view/mode/storage wiring or repository `.dope/planning.json` remains. The correction closeout must explicitly clear this gate before Phase 4 activation.

## Product Phase 4 — Physical Map

Status: **QUALIFIED/GREEN — committed `0.4.6` at `fac88712bb55176d3d6d54fbe6034de8b0f801ff`** (`docs/tasks/p4/closeout.md`)

Execution folder: `p4`. Activation baseline: package `0.4.0`; implementation prompts advance through `0.4.1`–`0.4.6`. Authority: `docs/planning/p4/phase-4-plan.md` and `docs/planning/p4/activation.md`.

Purpose:
Make current software architecture a deterministic, explorable part of the development environment before AI is asked to reason over it.

Prerequisite — satisfied:
- `c3-remove-planning-instruments` closed Green/qualified enough for sequencing at unchanged `0.3.6`;
- no live Phase 3 Planning subsystem remains;
- coherent Phase 4 package baseline is `0.4.0`.

Initial scope:
- clean implementation independent from any historical Phase 3 Planning contracts;
- no compatibility adapter, migration or dual-state requirement for Phase 3 Planning;
- language-independent Physical Map
- Project -> System -> Subsystem -> Component -> Code hierarchy
- explicit subsystem identity, purpose, ownership and dependency constraints
- TypeScript/JavaScript-first deterministic semantic analysis
- repository/workspace discovery and incremental indexing
- nodes/relationships for modules, files, symbols and relevant framework concepts
- evidence/provenance for every physical relationship
- declared-versus-observed architecture validation
- query APIs independent from diagram rendering
- no AI requirement

Physical source facts come from deterministic analyzers. Runtime relationships, when introduced, are recorded observations. Inference and proposals remain separately labeled.

September 29 amendment / pre-closeout correction gate:
- ADR 0008 makes **Software Map (sMap)**, **Physical Map**, and **Planning Map** the canonical product vocabulary.
- The current P5 qualification may finish against the pre-decision implementation.
- After P5 and before P6 closeout, a bounded Phase 4 correction must rename the live feature/package/symbol/UI vocabulary and move the inspector to a dedicated left Activity Bar/primary-sidebar surface.
- The right secondary sidebar remains reserved by default for future Agent Mind/chat.
- The Phase 5 center-workspace visual map canvas remains deferred; the correction must not pull it into Phase 4.

Exit condition:

Using the real Dope repository, the developer can inspect an evidence-backed current-state model organized by systems/subsystems/components, trace representative relationships back to source evidence, and detect representative subsystem-boundary violations without any model provider configured.

Closeout disposition: P5 directly qualified the pre-ADR behavior; `c4-tweaks` Green/qualified at unchanged `0.4.5` supplied the mandatory naming/left-sidebar correction before P6. P6 then qualified the approved Phase 4 scope and the runner committed it as `fac88712bb55176d3d6d54fbe6034de8b0f801ff`. Historical Phase 4 prompts/evidence remain truthful for that scope.

## Mandatory post-Phase-4 correction — `c4-architecture-discovery`

Status: **OWNER-CLOSED / NOT QUALIFIED — terminal source `0f94b0e3ba46e395394acdb5badc00dd092b37d0`; superseded by ADR 0012 hierarchical correction**

Version semantics: unchanged package version `0.4.6`. This correction does not reopen or relabel Phase 4 qualification and must not advance Phase 5 versioning.

Authority: ADR 0009 as amended by ADR 0010, plus ADR 0011 for the local-first reference synthesis bootstrap.

Purpose:
Correct the architectural interpretation and first-use workflow of the Physical Map before the visual map is built. Phase 4 successfully established the lower-level language-independent graph, TypeScript semantic analyzer, provenance, query/index and inspector substrate. The correction now turns that substrate into an explicit sMap initialization workflow where deterministic evidence supports flexible AI synthesis without surrendering developer architectural authority.

Required behavior:
- preserve the existing TypeScript/JavaScript semantic analyzer as the lower-level evidence engine;
- detect when the current project has no initialized sMap without treating a missing declaration file as the entire lifecycle model;
- on first use, offer an explicit **Analyze Project?** choice rather than silently building the map;
- if the developer declines, build no sMap and create no canonical/derived project state merely to record the refusal;
- keep the sMap surface available in an uninitialized empty state with an **Analyze Project** action that invokes the same flow later;
- distinguish at least `uninitialized`, `analyzing`, `review_required` and `initialized`;
- collect deterministic repository/workspace/build topology, entrypoints, dependency structure, semantic relationships, framework registration and other explicit evidence with provenance into an independently verifiable ArchitectureEvidencePacket;
- implement the first reference ArchitectureSynthesisProvider through a local LM Studio-compatible endpoint using Qwen3-Coder-30B-A3B-Instruct, while keeping Software Map contracts provider-independent;
- keep local AI setup inside the Analyze Project flow: detect or configure the LM Studio endpoint, discover/select an available compatible model where supported, and allow manual endpoint configuration when auto-detection fails;
- store endpoint/model/authentication/runtime choices as user/application state rather than canonical project state;
- perform a tiny synthetic structured-output capability probe before marking a configured model synthesis-capable;
- immediately before the first real synthesis request, warm the selected model with a tiny synthetic request containing no project/repository evidence;
- treat warm-up failure as a hard gate: do not submit the ArchitectureEvidencePacket and expose retry/model/settings/cancel recovery;
- invalidate warm readiness after runtime restart/reconnection, selected-model change or known unload; do not require redundant warm-up for bounded follow-up calls while the model is known to remain active;
- send the packet through the provider-independent synthesis capability only after provider/runtime readiness to produce a strict Dope-owned ArchitectureProposal JSON response;
- require each proposal node to carry temporary proposal identity, System/Subsystem/Component kind, name/purpose/parent, numeric 0..1 confidence, rationale, machine-verifiable `evidenceRefs` and human-readable `evidence`;
- never treat a directory, package, dependency cluster, confidence value, human-readable evidence explanation or LLM response as architecture authority solely because it exists;
- reject schema-invalid output, invalid/cyclic hierarchy, out-of-range confidence, unresolved parent keys, fabricated evidence references and any proposal that attempts to substitute prose for source-backed evidence;
- keep temporary proposal keys distinct from canonical architecture IDs;
- permit bounded `needsMoreEvidence` / `evidenceRequests` refinement where Dope—not the model—validates requests and gathers additional deterministic evidence;
- retain evidence/derivation for every generated architecture proposal;
- make developer-authored architecture canonical authority: synthesis proposes, the developer reviews/corrects and explicitly accepts;
- support brownfield correction operations such as confirm, rename, reparent, merge, split, add, remove, replace or ignore without silently rewriting architecture;
- support greenfield/manual canonical System / Subsystem / Component definition before implementation exists and without requiring a model;
- distinguish declared-only, detected/proposed-only, realized, drifted and unassigned implementation state as applicable;
- preserve contrary physical evidence when it disagrees with canonical architecture and surface the difference as drift rather than silently redefining either side;
- keep derived analysis/proposals rebuildable or disposable and keep provider-specific formats outside Software Map domain contracts;
- introduce only the narrow architecture-synthesis model capability required by ADR 0010; local LM Studio/Qwen is the first c4 reference implementation and paid/cloud APIs are not required for the core reference path;
- do not bundle a Dope-owned inference engine or require multiple production providers in c4 merely to demonstrate provider independence;
- keep general AI Presence, Agent Mind, chat, tool execution, mutation, delegation, Phase 5 visual canvas and Planning Map transformations out of this correction.

Minimum qualification:
- first opening an uninitialized project offers analysis rather than silently constructing an sMap;
- declining leaves the sMap uninitialized and produces no canonical architecture or derived map state; visiting sMap later exposes Analyze Project and can start the flow;
- accepting analysis produces an ArchitectureEvidencePacket that can be inspected and verified without invoking a model;
- the reference path can detect/configure LM Studio and select Qwen3-Coder-30B-A3B-Instruct through application/provider state without writing those choices into canonical project state;
- a synthetic structured-output capability probe succeeds without project evidence;
- immediately before the first real synthesis request, model warm-up succeeds using only synthetic non-project input;
- a controlled warm-up failure proves no ArchitectureEvidencePacket request is issued and no proposal/canonical architecture is established;
- synthesis through the real LM Studio + Qwen3-Coder-30B-A3B-Instruct reference path returns schema-valid structured JSON and every proposed architecture boundary is traceable through valid `evidenceRefs` to that exact packet;
- focused negative tests reject fabricated evidence refs, malformed hierarchy, invalid numeric confidence and human-readable explanations without source-backed refs;
- the review UI can show human-readable `evidence` while preserving drill-down to the underlying `evidenceRefs`;
- a proposal remains non-canonical until explicit developer acceptance and temporary proposal keys never become canonical IDs implicitly;
- developer correction of at least one proposed boundary establishes canonical architecture and subsequent analysis honors that identity while still reporting contradictory implementation evidence;
- a greenfield/manual fixture can initialize canonical architecture with little/no implementation and no model configured, remaining visibly declared-only;
- the real Dope repository can complete the evidence -> LM Studio/Qwen synthesis -> validation -> review/correction -> acceptance workflow;
- failure/cancellation before acceptance leaves or returns the project to uninitialized unless a separately approved resumable-draft contract exists;
- repeated deterministic evidence extraction for the same inputs is stable and proposal inputs are explainable.

Exit condition:

At unchanged `0.4.6`, Dope can deliberately initialize sMap for an existing project through opt-in deterministic analysis plus bounded LLM synthesis, the local LM Studio/Qwen reference path is qualified including capability probing and pre-synthesis warm-up, a developer can correct and explicitly establish canonical architecture, a greenfield project can initialize manually, and the Physical Map can explain how current implementation realizes or diverges from that authority. Completion clears the architecture-discovery correction, but Product Phase 5 remains blocked behind the hierarchical-synthesis and storage corrections below.

## Mandatory pre-Phase-5 correction — `c4-smap-hierarchical-synthesis`

Status: **IMPLEMENTATION THROUGH P7 COMPLETE — P8/P9 SUPERSEDED / NOT EXECUTED under ADR 0013; reachable P7 implementation commit `66f023f717afd63433d442015b575edf049ae1b6`**

Version semantics: unchanged package version `0.4.6`. The predecessor `c4-smap-synth` is closed historical evidence and must not be reopened or relabeled Green.

Authority: ADR 0012, with ADR 0009/0010 retaining developer-authority/evidence semantics and ADR 0011 retaining the local LM Studio/Qwen reference path.

Purpose:
Replace one-shot architecture synthesis as the intended design with a bounded hierarchy-first workflow that improves the core sMap outcome: credible System boundaries. The correction also makes analysis progress visible and turns architecture quality plus end-to-end analysis time into explicit qualification evidence.

Required behavior:
- preserve the complete deterministic ArchitectureEvidencePacket as independently inspectable evidence authority;
- derive deterministic bounded model-facing evidence views/slices that preserve parent evidence IDs/provenance and never truncate arbitrary evidence items mid-record;
- obtain context/input capacity from provider/model capability instead of hardcoding a model window;
- treat the current 65,536-token Qwen load as qualification headroom, not a required product value or preferred prompt size;
- build a compact repository-global architecture skeleton before lower-level descent;
- run repository-global **System Discovery** as its own synthesis stage;
- run **System Challenge** to explicitly merge, split or reject proposed System boundaries and prevent infrastructure/packages/directories from being promoted without architectural justification;
- after candidate Systems are established, run bounded per-System **Subsystem Discovery** and Component refinement as appropriate;
- reconcile cross-System structure and issue small targeted verification calls for materially uncertain boundaries;
- assemble/validate a final ArchitectureProposal whose source basis still resolves through the complete deterministic parent evidence packet;
- keep the first implementation multi-call rather than multi-model; do not add model voting, debate, unlimited recursion or an autonomous retrieval loop;
- cache/reuse unchanged bounded synthesis work using deterministic packet/stage/version/provider identity where safe;
- expose provider-independent progress events and a user-facing progress report showing current stage, model-call purpose, applicable subject, known completed/remaining units, elapsed time and failures/retries;
- do not expose raw hidden chain-of-thought and do not fabricate percentage complete when remaining work is not deterministically knowable;
- record elapsed time for every deterministic stage and model call;
- optimize the qualified initial Dope-on-Dope analysis to complete in **8 minutes or less** on the defined development setup;
- treat eight minutes as a qualification objective, **not** a production timeout: a slower run continues so architecture quality and timing evidence can be inspected, but its performance gate is Not Green;
- do not reduce architecture quality merely to meet the time target.

Minimum qualification:
- controlled fixtures demonstrate credible System detection and reject ordinary package/directory/infrastructure promotion without supporting architecture evidence;
- System Challenge demonstrably merges, splits or rejects at least representative bad initial candidates;
- per-System descent operates against established candidate Systems rather than repeatedly asking one model call to infer the entire hierarchy from all repository detail;
- every final evidence reference resolves to the complete deterministic parent packet;
- no individual request exceeds the configured provider/model budget;
- real Dope-on-Dope analysis visibly reports each major stage/call purpose and timing;
- the resulting Dope Systems/Subsystems pass explicit human architectural review; valid JSON with materially bad System boundaries is Not Green;
- the qualified end-to-end initial Dope-on-Dope run is <=8 minutes;
- a controlled >8-minute or simulated-over-budget case proves the run is not force-cancelled solely at eight minutes and retains usable timing/output evidence;
- developer review/correction/acceptance remains the only transition to canonical architecture.

Exit condition:

The implementation through P7 remains the historical hierarchy-first baseline. ADR 0013/0014 supersede the unexecuted hierarchical P8/P9 qualification/closeout prompts; they will not run, their evidence must not be invented, and this correction is not relabeled Green. `c4-smap-gemini-provider` later produced Not Green Gemini architecture evidence and is now owner-closed. Current routing is through mandatory `c4-synth-coverage-review`, then a fresh provider comparison, then `c4-smap-storage`.

## Mandatory pre-Phase-5 correction — `c4-smap-gemini-provider`

Status: **OWNER-CLOSED / NOT QUALIFIED — terminal evidence source `8ea34ae1300a387ac63aad9462ae649ac78a9605`; planned full Local/Gemini comparison and formal P5 audit not executed**

Version semantics: unchanged package version `0.4.6`. This is a bounded Phase 4 correction. It does not reopen or relabel Product Phase 4 qualification and must not advance Phase 5 versioning.

Authority: ADR 0013, with ADR 0004 provider independence, ADR 0009/0010 developer/evidence authority, ADR 0011 local reference path and ADR 0012 hierarchy-first synthesis retained where not amended.

Purpose:
Correct the shared hierarchy-first provider protocol before optimizing any one model, add Gemini 3.8 Flash through AI Studio API keys as the first cloud synthesis adapter, and generate comparable evidence showing whether remaining sMap latency/quality problems are caused primarily by the synthesis design or by the local model/runtime.

Required behavior:
- keep the canonical Software Map and ArchitectureProposal contracts provider-neutral;
- keep the complete deterministic ArchitectureEvidencePacket as evidence authority and all model-facing views as bounded derived projections with original provenance refs;
- revise every model-facing intermediate synthesis stage to use strict, compact Dope-owned JSON whose contents are limited to what downstream stages require;
- intermediate state may carry stage/version/packet/view identity, temporary candidate IDs, node kind/name/parent, short bounded responsibility, evidence and ownership refs, confidence, typed ambiguity/unresolved codes, typed candidate relationships and unresolved items;
- remove prose-heavy intermediate rationale/explanation fields such as boundary rationale, sibling distinction, free-form uncertainty and reconciliation messages from the cross-stage provider protocol;
- derive user-facing review explanations deterministically from typed findings/evidence where possible rather than transporting model essays between stages; do not add a separate narrative LLM pass merely to rewrite compact state;
- Local and Gemini must implement the same provider-independent stage request/result schemas and validation rules;
- add Gemini 3.8 Flash through the Gemini Developer API / AI Studio API-key path behind a replaceable adapter; Google/provider-native request/response types must not enter `@dope/software-map`;
- expose explicit, independently collapsible **Local model** and **Gemini 3.8 Flash** setup sections in the sMap Analyze Project flow;
- selecting Gemini must clearly disclose that the bounded repository evidence used for synthesis leaves the machine; selecting Local continues through the configured local endpoint;
- provider selection is explicit. Never silently fall back Local -> Gemini or Gemini -> Local;
- Gemini API keys may come from backend `GEMINI_API_KEY` or an explicit session entry, but secrets are never project state and must not be written to `.dope/`, StorageService/preferences, logs, progress events, cache keys, evidence/proposal data or user-visible raw errors;
- preserve Local LM Studio support and its existing capability/probe/warm-up safety behavior;
- instrument every provider stage call with comparable provider-independent telemetry: stage/subject, provider/model, wall-clock duration, request/output bytes, input/output/total token usage when reported, measurement source/quality (provider-reported/tokenizer/estimated/unavailable), cache reuse and retry/error state;
- provider-independent orchestration measures timing; adapters may supply usage metadata but cannot redefine stage semantics;
- do not pretend conservative Local token estimates are exact Gemini token counts;
- do not add aggressive Local-specific chunking, compression, prompt shortcuts or alternate stage semantics in this correction before the controlled comparison;
- qualify Local and Gemini against the same repository commit, deterministic evidence/planner version, stage order, compact contracts, evidence-selection rules, validation/reconciliation bounds and acceptance rules;
- record enough evidence to distinguish at least synthesis-design cost, provider/model capability and local runtime/inference cost;
- keep developer review/correction/explicit acceptance as the only transition to canonical architecture.

Testing discipline:
- P1-P3 use focused permanent unit/integration tests and only the minimum build/typecheck needed to catch changes on their surfaces;
- defer repeated full `npm run check`, restart matrices, Electron packaging/native launch, browser dogfooding and live end-to-end provider runs until the final qualification prompt unless a focused failure demonstrates a cross-cutting defect;
- P4 performs the real Local/Gemini comparison and the consolidated expensive regression/packaging/browser qualification once;
- P5 is evidence-only closeout and must not rerun live synthesis merely to replace missing evidence.

Minimum qualification:
- compact intermediate schemas reject surplus prose and invalid/fabricated refs while preserving every fact required by downstream stages;
- Local and Gemini execute the same stage contracts with no provider-specific architecture semantics;
- real Gemini configuration works through an AI Studio key without persisting/leaking the key;
- real Local and Gemini runs use the same corrected pipeline and benchmark source;
- each run records stage/call timing, request/output size and token usage/measurement source;
- final proposals remain source-backed and materially reviewable;
- the comparison records System/Subsystem/Component quality, unresolved items, total call count, provider-call time, deterministic/planning time and end-to-end elapsed time;
- Local remains functional after Gemini is added;
- no silent provider fallback occurs;
- full final repository checks, restart/project isolation and required browser/Electron qualification pass on the exact candidate;
- project version remains `0.4.6`.

Interpretation rule:
- similar architecture with much slower Local calls points primarily to local model/runtime cost;
- good Gemini architecture and materially poorer Local architecture from equivalent inputs points primarily to model capability;
- both providers remaining slow/oversized points back toward shared synthesis design/evidence planning;
- both improving materially after compact-contract correction is evidence that the previous prose-heavy intermediate protocol was itself a bottleneck.
These are diagnostic evidence categories, not excuses to weaken architecture-quality gates.

Exit condition:

Owner closeout disposition: provider integration, compact contracts and Gemini debugging evidence are retained, but architecture quality is Not Green. The generated Adaptive SEO proposal decomposed primarily into Backend/Frontend technical tiers rather than stronger cross-layer responsibilities. The planned full Local/Gemini comparison is intentionally deferred until the shared synthesis algorithm is corrected. Do not reopen this closed correction.

## Mandatory pre-Phase-5 correction — `c4-synth-improvements`

Status: **OWNER-CLOSED / NOT QUALIFIED AFTER P4 — P5 UNEXECUTED**

Activation source: `8ea34ae1300a387ac63aad9462ae649ac78a9605`.
Pushed P4 record: `4a887ecebc546f9944adf54890143827623e008c`.

Authority: ADR 0014.

Purpose:
This historical correction improved responsibility-oriented decomposition and center review, but P4 still found material architecture coverage gaps.

Required scope:
- deterministic responsibility-oriented planning signals with provenance;
- stronger direct production-behavior support for System responsibility;
- explicit one-System umbrella-collapse challenge without forcing multiple Systems;
- separate Subsystem Discovery, Subsystem Challenge and Component Discovery;
- responsibility-aware reconciliation/verification;
- center-editor indented hierarchy review with focused node details/evidence;
- real Gemini requalification on the pinned Adaptive SEO benchmark;
- <=8-minute objective retained;
- no benchmark-specific answer vocabulary and no Local-specific optimization.

Owner closeout: P4 is Not Green on architecture quality and P5 will not run. The mandatory successor is `c4-synth-coverage-review`; the old `c4-smap-gemini-provider` remains closed.

## Mandatory pre-Phase-5 correction — `c4-synth-coverage-review`

Status: **OWNER-CLOSED / NOT QUALIFIED AFTER STOPPED P6 — IMPLEMENTED BASELINE RETAINED**

Version semantics: unchanged package version `0.4.6`. Activation source is pushed P4 record commit `4a887ecebc546f9944adf54890143827623e008c`.

Predecessor disposition: `c4-synth-improvements` is OWNER-CLOSED / NOT QUALIFIED after P4. Its real <=8-minute timing, review/editor, restart/package/native and failure evidence are retained. P5 is cancelled and unexecuted.

This correction must:
- retain every provider-call attempt and bound retryable Gemini transport/upstream recovery;
- prioritize generic source-backed responsibility evidence over noisy cross-area vocabulary;
- detect optional root `MODULES.md` as the preferred initial architecture seed, with root `README.md` retained as secondary orientation;
- when `MODULES.md` is absent, recommend creating it while preserving **Continue with README** or repository-only analysis paths so documentation is never mandatory;
- provide a portable **Prepare this repository for Dope** prompt contract that creates `MODULES.md` without modifying application code;
- treat `MODULES.md` as strong Documented intent only: verify it against deterministic evidence, keep disagreements visible, and hand canonical authority to `.dope/architecture.json` only after explicit acceptance;
- do not continuously synchronize `MODULES.md` with canonical architecture or silently re-import later edits;
- send root `README.md` directly with the initial repository-global deterministic synthesis view when present, under a deterministic size budget;
- add eligible broader repository docs as provenance-bearing supporting evidence while distinguishing Observed / Documented / Inferred support and excluding historical/qualification/expected-answer material by default;
- make Subsystem Challenge recover substantial responsibilities omitted by discovery;
- carry an inspectable coverage ledger into qualification;
- require typed zero-Component descent dispositions;
- add branch-local Search Deeper with preview/Accept/Reject for every System and Subsystem;
- directly prove review correction/acceptance/project switching in the browser;
- qualify architecture coverage on Adaptive SEO, Dope and a smaller structurally clear repository/fixture, including MODULES+README, README-only, no-bootstrap-doc and stale/conflicting-documentation controls;
- preserve provider independence, developer authority, bounded synthesis and the Phase 4/5 boundary.

Owner disposition on 2026-09-30: P6 was stopped and pushed at `c059f67a5fd85c81183ba09044e550462c9000a1`. The final Adaptive SEO replay was substantially closer and under eight minutes, but zero useful Components, unresolved coverage and incomplete multi-target/final validation evidence keep the correction Not Qualified. P7 will not run. The owner accepts this implementation as the synthesis/review baseline for sequencing.

Routing now goes directly to `c4-smap-storage`. This does not relabel coverage Green and does not activate Phase 5.

## Mandatory pre-Phase-5 correction — `c4-smap-provider-comparison`

Status: **DEFERRED / REMOVED FROM PRE-PHASE-5 CRITICAL PATH**

Purpose:
Retain the option for a future controlled Local/Gemini comparison when provider optimization or Phase 7 AI Presence actually needs comparative evidence.

This correction is not executed as a prerequisite for storage or Phase 5, is not relabeled Green, and must not rewrite or reopen the closed `c4-smap-gemini-provider` history.

## Mandatory pre-Phase-5 correction — `c4-smap-storage`

Status: **GREEN / QUALIFIED — closeout `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`**

Version semantics: bounded correction at unchanged package version `0.4.6`. The closed Not Green `c4-smap-gemini-provider` is historical evidence and is not reopened.

Purpose:
Make the Software Map portable with the project by enforcing project-local persistence as an architectural invariant.

Required contract:
- repository + project-local `.dope/` is sufficient to recover durable sMap state;
- `.dope/architecture.json` remains canonical developer-owned architecture;
- `.dope/smap.json` owns durable initialization/version/state metadata required to reopen coherently;
- any additional persisted sMap evidence packet, graph snapshot, fingerprint, proposal draft, index or similar artifact remains beneath `.dope/` in a Dope-owned, explicitly versioned format;
- provider endpoint/model preferences, Theia presentation/workspace state and provider/runtime state remain non-project state;
- machine-local/global caches may exist only as disposable accelerators and deleting them cannot destroy project truth or change initialized state;
- persisted derived evidence remains derived and must carry enough version/source association to reject stale or incompatible data;
- recovery and project isolation remain safe under the existing path/symlink rules.

Qualification must include a permanent regression guard for the persistence-boundary defect class and controlled copy/reopen/restart evidence showing that durable sMap state follows repository + `.dope/` without reliance on hidden machine-local state.

The owner closed `c4-smap-synth`, `c4-smap-gemini-provider`, `c4-synth-improvements`, and `c4-synth-coverage-review` Not Qualified while retaining their useful implementation and truthful evidence. The provider-comparison idea is deferred. `c4-smap-storage` is the sole remaining pre-Phase-5 gate. The storage correction should prove the existing small persistence model rather than persist rebuildable synthesis/Physical Map artifacts.

Exit condition:

At unchanged `0.4.6`, durable sMap state is demonstrably project-local, versioned, recoverable and portable; no machine-local application/provider/cache state is required to reconstruct project truth; regression coverage prevents required sMap persistence from escaping `.dope/`; and Dope itself carries a valid accepted `.dope/smap.json` marker for its tracked canonical architecture. Storage Green routes next to the bounded visual-identity alignment below.

## Mandatory pre-Phase-5 correction — `c4-color-theme`

Status: **ACTIVE / APPROVED FOR PROMPT PLANNING**

Version semantics: unchanged package version `0.4.6`.

Purpose:

Bring Dope's application color system into visual alignment with the existing logo before the visual Software Map/Planning Map experience is built.

Locked palette:
- workbench/editor anchor `#1F1F1F`;
- primary orange `#FF7A1A`;
- highlight orange `#FFB15C`;
- deep orange `#C75100`.

Required contract:
- register a first-class **Dope Dark** theme and make it the browser/Electron default;
- centralize brand color definitions in the theme layer rather than duplicating hex values across widgets;
- keep Dope-owned surfaces on semantic Theia tokens;
- apply brand colors to interaction identity: focus, primary actions, hover/active states, links, active navigation/tabs, badges/progress and selection accents;
- use a dark foreground on solid primary-orange controls where needed for contrast;
- keep syntax highlighting and semantic diagnostic colors meaningful; do not recolor errors/warnings/success or every syntax token orange;
- explicit user selection of another compatible theme persists and overrides Dope Dark; Dope-specific overrides must deactivate cleanly;
- preserve layout, widget placement, interactions and Phase 4 product behavior;
- do not implement Phase 5 visual-map/planning functionality.

Qualification is intentionally small: focused tests/builds in P1, then a quick manual browser visual/override check in P2 closeout.

Exit condition:

The default app and logo read as one coherent product identity, alternate user themes remain usable, and the correction adds no broader redesign. Green routes to a fresh Product Phase 5 `/docs-review`.

## Product Phase 5 — Visual Software Planning

Status: **ACTIVE** from package `0.5.0` at transition commit `016bd8780e89081dfdb5746eae981183dc945baa`.

Execution folder: `p5`. Activation baseline: package `0.5.0`; normal phase prompts advance through `0.5.x`. Authority: `docs/planning/p5/phase-5-plan.md`, `docs/planning/p5/activation.md`, and ADR 0017.

Purpose:
Design the new planning/work system from the Software Map outward and turn architecture understanding, target design, implementation work and reconciliation into one visual workflow.

Initial scope:
- multi-tab central workspace for code, Physical Map and Planning Map surfaces;
- Physical Map diagrams as projections of existing Software Map state, never a second architecture database;
- architectural semantic zoom from System -> Subsystem -> Component -> Code while retaining stable identity/selection;
- durable Planning Maps that reference canonical/physical identities instead of copying current architecture;
- explicit planned `add`, `modify`, `remove`, `move`, `split`, `merge`, `redirect relationship` and `change contract` transformations;
- planned new architecture nodes with intended future canonical IDs that remain planned until explicit adoption;
- graph-derived WorkItems with dependencies, requirements/constraints, acceptance criteria, validation targets and working-set references;
- explicit **Adopt Target** rather than silent Planning Map -> canonical architecture mutation;
- project-local versioned persistence at `.dope/planning-maps.json`, independent from historical Phase 3 `.dope/planning.json`;
- a recorded canonical-architecture fingerprint/revision and Physical Map input fingerprint for every Planning Map branch;
- visible stale-plan detection when either underlying input changes, with explicit conflict-aware rebase rather than silent reinterpretation;
- implementation targeting/navigation through ordinary editor, terminal, SCM, debugger and test surfaces;
- post-implementation deterministic re-analysis and target-versus-physical reconciliation;
- visible distinction among physical, canonical, planned, inferred, unresolved and stale state;
- no compatibility adapter or migration requirement for Phase 3 internal Planning state;
- no AI requirement.

Phase 5 introduces the forward planning ontology **PlanningMap -> PlannedTransformation -> WorkItem**. WorkItems are executable planning units but do not silently rewrite architectural intent; changing a WorkItem and changing the target map are distinct operations. Phase 5 does not resurrect `Plan -> PlanStep -> Task`.

Canvas layout is presentation state. Node coordinates, viewport, selection, open tabs, collapsed groups and panel sizes may persist for UX, but they do not define architectural identity or target semantics.

Reconciliation compares the Planning Map target with a freshly analyzed Physical Map and retains at least: `implemented as planned`, `implemented differently`, `not implemented`, and `unexpected implementation`. Completing a WorkItem never manufactures physical truth.

Exit condition:

With no model configured, a developer can start from the current physical Dope architecture, create a durable target Planning Map, define explicit transformations, derive and execute WorkItems through ordinary IDE surfaces, deliberately adopt target architecture where appropriate, survive restart/copy/reopen, detect/rebase stale plans, re-analyze the repository and reconcile the resulting physical software against the planned target.

This completes the core pre-AI product foundation:

Real IDE
+
Project Mind
+
Planning
+
Physical Map
+
Visual Planning

## Phase 5 interruption correction — `c5-smap-acceptance-debug-loop`

Status: **APPROVED / READY FOR EXECUTION at unchanged `0.5.11`**

Activation source: `502416e2d8589132e8b96454ad3b72407406a20b`.

Purpose:
Install the machinery needed to debug a generated but unaccepted sMap iteratively without repeatedly paying for synthesis.

Required scope:
- persist the mutable working Architecture Review draft under versioned project-local `.dope/` work state;
- restore that exact working draft after backend/app restart with no provider call;
- permit temporarily invalid review drafts to persist without treating them as canonical architecture;
- protect review writes with revision/stale-write checks;
- preserve accepted Search Deeper replacements and ordinary review edits across restart;
- provide one shared deterministic acceptance-diagnostics pass that reports all known blockers, including conflicting owners for duplicate roots;
- provide a zero-provider, non-mutating project checker for a persisted `review_required` run;
- make the Architecture Review UI consume the same structured diagnostics;
- preserve compatibility with the existing schema-1 `.dope/smap-analysis.json` review state used by the current Adaptive SEO specimen.

Explicitly out of scope:
- fixing the current `src/server/jobs/job-repository.ts` ambiguous ownership;
- changing synthesis prompts, hierarchy, evidence selection, ownership inference or evidence-to-root materialization;
- root deduplication/automatic owner selection;
- regenerating Adaptive SEO or invoking Local/Gemini for correction qualification;
- running the actual iterative acceptance-debug loop;
- completing P11 or advancing P12/`0.5.12`.

Exit condition:
An intentionally invalid unaccepted review can be edited, persisted, restarted and reopened with the exact same working draft and the same complete deterministic blocker set, with no model/provider call. Successful acceptance and explicit cancellation clear the in-progress analysis work state.

After Green closeout, use the preserved Adaptive SEO review in a **separate iterative debug loop** until the real Accept Architecture path succeeds. Then resume Phase 5 P11. P12 remains blocked until P11 is Green.

## Queued Phase 5 correction — `c5-synth-observe`

Status: **PLANNED / QUEUED FOR EXECUTION**. Assessment, plan and P1–P3 execution briefs are in `docs/tasks/c5-synth-observe/`. Current package baseline is `0.5.11`; this correction does not advance the package version while that baseline applies.

Make synthesis progress distinguish failed call attempts and active automatic retries from a terminal failed run. Show semantic, text-labeled stage states and safe error/retry progress. Couple manual failed-stage retry to the selected and successfully tested model while preserving validated checkpoints and provider/model provenance. Add a read-only, zero-provider generation dry run that validates deterministic evidence and inspects saved failed-run state without creating a proposal or altering project files. ADR 0012/0014 and `docs/tasks/c5-synth-observe/README.md` define the bounds and three-prompt stack.

This is separate from the active `c5-smap-acceptance-debug-loop` acceptance checker and does not change its closeout, the preserved Adaptive SEO review, or the P11/P12 routing above.

## Phase 5 interruption correction — `c5-physical-map-load`

Status: **APPROVED / ONE-OFF IMPLEMENTATION at unchanged `0.5.11`**

Activation source: `9dbde23fa37f59aa3f01c342bfae9f4d0e6cea59`.

Evidence:
- accepted `/home/jfin/dev/adaptive-seo-dope` canonical architecture and marker are healthy;
- `/tmp/adaptive-seo-dope-p11` shows accepted Systems/Subsystems in the left inspector;
- center Physical Map remains at **Loading Physical Map...**;
- browser console reports `Another channel with the id '/services/dope/software-map' is already open.`;
- current frontend wiring creates a singleton Software Map proxy for the inspector but also creates a new proxy in each Physical Map widget and the Physical Map controller calls `attach(workspace)` again;
- focused Phase 5 tests pass, while the Phase 3 removal guard and restart theme assertion are stale against current Phase 5/Dope Dark contracts.

Scope:
- prove the duplicate-channel/second-attach hypothesis before changing code;
- make the center Physical Map consume the already-attached/published Software Map controller state and a bounded relationship-query seam rather than owning another Software Map attach lifecycle;
- preserve project/generation stale guards, focused tabs, source navigation and relationship semantics;
- add a permanent regression for accepted ready map -> center canvas exits loading and renders;
- narrow the Phase 3 negative filename guard without weakening its substantive removed-contract checks;
- update the restart default-theme assertion from historical `dark` to qualified `dope-dark`, preserving explicit light override/restart behavior.

Out of scope:
- Adaptive SEO architecture/sMap mutation or regeneration;
- synthesis/provider changes;
- reopening `c5-synth-observe`;
- PlanningMap/domain redesign;
- P11 qualification itself;
- any version change.

Exit:
The one-off implementation passes focused map regressions, the corrected Phase 3 guard, restart regression, affected builds and diff/version checks. Then rerun P11 on `/tmp/adaptive-seo-dope-p11`; P11 determines qualification and P12 eligibility.
## Phase 5 interruption correction — `c5-planning-basis-isolation`

Status: **APPROVED / MANUAL ONE-OFF at unchanged `0.5.11`**

Activation source: `2c21fcf244e42fb806ba01d27c68addc5ffb198e`.

Purpose:
Repair the Planning Map basis boundary proven by P11. Dope-owned `.dope/` work state must not alter Physical Map input identity, and generation-only observation refresh must not be treated as semantic plan staleness.

Execution:
- one manual GPT-6 Sol High implementation prompt;
- focused regression/build validation only;
- no internal correction closeout prompt;
- P11 is the qualification/closeout gate for the repaired behavior.

Out of scope:
- migration of disposable failed-run Planning Maps;
- accepted Adaptive SEO architecture/sMap regeneration;
- synthesis/provider changes;
- auto-rebase or planning persistence redesign;
- P12 or version advance.

After the one-off passes, recreate `/tmp/adaptive-seo-dope-p11` from the accepted reference and rerun P11.

## Pre-P11-rerun correction — `c5-smap-readability`

Status: **ACTIVE / READY**

Required unchanged version: `0.5.11`.

Activation source: `158b61d601947b342472e457fe61d78b24bf5152`.

Purpose:
Make the existing sMap readable at progressively deeper levels without creating another architecture model. The Physical Map remains evidence-backed reality, the Planning Map remains target intent, and readability state remains presentation-only.

Locked scope:
- semantic LOD that keeps the default project view at Systems + immediate Subsystems, allows a farther Systems-only view, and reveals deeper Component/Code detail only within bounded focus context rather than exploding the entire repository;
- hierarchy/containment first, with dependency relationships disclosed on selection/focus instead of rendering every valid edge continuously;
- focused navigation with stable identity, breadcrumbs, **Focus / Up / Fit Architecture**, source round-trip and simplified cross-boundary context;
- every label shown at an active LOD is complete: wrapping, path-aware breaks, node growth and layout reflow are allowed; ellipsis/clipping of map-visible architectural/code identity is not;
- the left sMap inspector remains the provider-free explanation surface for responsibility, hierarchy, incoming/outgoing relationships, evidence, source and diagnostics;
- selectable node colors from a small theme-aware palette, persisted as project-scoped workbench presentation metadata and never interpreted as architecture/evidence/planning semantics;
- the same readability rules continue to apply when the Planning Map projects Current / Target / Diff state.

Explicit boundaries:
- no Flow implementation;
- no new durable map/database;
- no provider/model requirement and no Phase 7 Explain This/chat behavior;
- no mutation of canonical architecture, Physical Map evidence, Planning Map transformations, staleness or reconciliation based on layout, zoom, focus, filters or color;
- no expansion of the current P11/P12 qualification contract.

Execution folder: `docs/tasks/c5-smap-readability/`.

The correction is authorized now at unchanged `0.5.11` from the recorded activation source. It must close before returning to the P11 qualification rerun. P12 remains blocked on P11 Green; Phase 6 may establish the `0.6.0` baseline only after P12 closeout.

## Product Phase 6 — Flow

Status: **ACTIVE / PLAN APPLIED**
Baseline: `0.6.0`
Authority: ADR 0020 and `docs/planning/p6/phase-6-plan.md`

Purpose:
Make the Software Map explain **what happens through implemented software**: entry points, internal invocation, processing, state access, async/external boundaries and outputs. Proven data semantics enrich that path when available.

Locked implementation order:
1. `0.6.1` — physical flow domain/evidence contracts;
2. `0.6.2` — generic TypeScript deterministic invocation Flow extraction;
3. `0.6.3` — Adaptive SEO boundary vertical slice: supported Express/PostgreSQL/external extraction;
4. `0.6.4` — generation-scoped Flow query/path aggregation;
5. `0.6.5` — pure directional projection and deterministic layered layout;
6. `0.6.6` — Architecture/Flow UI, edge provenance and source navigation;
7. `0.6.7` — direct Adaptive SEO GUI/T3 qualification;
8. `0.6.8` — evidence-only closeout.

Core truth rule:
`import/reference/dependency` relationships are not, by themselves, Flow. Deterministically resolved invocation/boundary/state interactions are valid Flow evidence; data/payload labels are optional enrichment and require their own evidence.

Initial scope remains provider-free, System-first with Subsystem focus, and reuses the same stable Software Map identities. No separate Flow database, AI explanation, mandatory runtime tracer or Planning Map flow editing is introduced.

Exit condition:
With no model configured, a developer can focus a real System, switch Architecture -> Flow, follow a non-trivial evidence-backed application execution path from an input/boundary through internal calls and state/external interactions to an output, inspect representative edge provenance/source, observe branch/fan-out or join, focus a Subsystem and return to Architecture without losing identity/context.

## Product Phase 7 — AI Presence

Purpose:
Introduce AI as an observable collaborator inside an already-useful development environment.

Initial scope:
- provider-independent Model Runtime
- first-class OpenAI/ChatGPT/Codex compatibility
- first-class local-model compatibility
- capability-based provider adapters
- Ask / Explain / Trace / Find Related
- read-only project and editor context
- Project Mind, canonical architecture, Physical Map Architecture/Flow and active Planning Map/WorkItem context
- suggestions for notes, questions, ideas, and plan refinements
- structured Agent Mind for visible working state

Default posture:
observation and assistance before mutation.

Exit condition:

AI can understand and assist with the project using Dope-owned project, architecture, flow and planning context without owning canonical product state or requiring Dope to become chat-first.

## Product Phase 8 — Scoped Delegation

Purpose:
Give AI bounded hands without giving away the developer's authorship or control.

Initial scope:
- HUMAN / AI / SHARED ownership
- explicit observation versus mutation authority
- ProposedAction
- implement/test/refactor actions
- diff/apply/reject flow
- conceptual ChangeSet review
- validation integration
- continuous steering while work is active

Exit condition:

A developer can delegate a bounded portion of work, see what the agent believes and intends, intervene during execution, and retain control over mutation.

## Product Phase 9 — Development Sessions

Purpose:
Make the development session durable for the developer, not only for the model.

Initial scope:
- persistent DeveloperSession
- current objective and active plan
- developer versus AI contribution history
- unresolved work
- decisions made
- validation state
- captured ideas
- reopen/resume context
- session closeout

Exit condition:

Returning to a project restores the developer's mental context well enough to continue without reconstructing the prior session from chat history.

## Deferred beyond the initial roadmap

These remain valid parts of the vision but must not block the initial product:
- dedicated Research workspace
- semantic project-wide search
- advanced ambient intelligence
- automatic Ideas capture
- sophisticated model routing
- multi-agent orchestration
- cloud/remote execution
- collaborative/team workflows
- remote project-state synchronization
- advanced conceptual ChangeSets
- autonomous long-duration development

## Sequencing discipline

Do not promote a later phase simply because its concepts already exist in PRODUCT-MODEL.md.

After Foundation Spike 0:
1. incorporate actual substrate findings
2. run /docs-review
3. revise architecture/product contracts if evidence requires it
4. obtain owner approval
5. decompose Product Phase 1

The roadmap should continue to prefer a smaller usable product over prematurely implementing the full vision.
