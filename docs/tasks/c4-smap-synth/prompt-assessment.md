# Correction 4 Prompt Assessment — sMap Architecture Synthesis

Status: APPROVED / READY TO EXECUTE
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Prompt-authoring source: `067828fdd6db0149765e67c547158f63d7e55743`
Required unchanged package version: `0.4.6`
Authority: ADR 0009 as amended by ADR 0010; ADR 0011; BOOT; AGENTS subject to the later ADR amendments; ARCHITECTURE; PRODUCT-MODEL; software-map-storage; roadmap/workflow/stability authority

## Conclusion

Use seven ordered prompts at unchanged `0.4.6`:

1. provider-independent synthesis/lifecycle contracts and strict proposal validation;
2. deterministic, AI-independent ArchitectureEvidencePacket generation and bounded refinement;
3. local LM Studio/Qwen provider adapter, structured-output probe and warm-up gate;
4. initialization orchestration, project-local initialization marker and safe canonical acceptance;
5. Analyze Project onboarding, local-model setup and proposal review/correction UI;
6. direct real-Dope LM Studio/Qwen dogfooding and package/restart qualification;
7. evidence-only correction closeout.

This is the executable stack for the roadmap/ADR correction named `c4-architecture-discovery`. The user-selected folder name `c4-smap-synth` does not rename the governing correction.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | Software Map synthesis contracts, lifecycle types, JSON schema/parser/validator | invalid proposal rejection, evidence-ref integrity, temporary proposal identity, lifecycle contract | GPT-6 Sol High |
| P2 | deterministic ArchitectureEvidencePacket + bounded deterministic evidence expansion | stable packet/fingerprint, package/workspace/entrypoint/dependency facts, no AI/declaration dependence | GPT-6 Sol High |
| P3 | backend LM Studio-compatible synthesis adapter | model discovery, JSON-schema probe, warm state, no project evidence before warm success, mocked HTTP failures | GPT-6 Sol High |
| P4 | initialization orchestration + durable acceptance/reconciliation | uninitialized/review/initialized transitions, no-write decline/cancel, safe canonical acceptance, stale/conflict/isolation guards | GPT-6 Sol High |
| P5 | sMap onboarding/setup/review UI | Analyze Project yes/no, local connection/model selection, review/correction, evidence explanation + hard-source drill-down | GPT-6 Sol High |
| P6 | real LM Studio/Qwen dogfood + direct browser/package/restart qualification | actual Dope evidence -> Qwen proposal -> validation -> correction/acceptance, controlled restoration, warm-up ordering | GPT-6 Sol High, browser required |
| P7 | evidence-only closeout | exact candidate, A-H gate audit, no product repair | GPT-6 Sol High |

## Current implementation findings

The qualified `0.4.6` source has a useful lower-level substrate but none of the new initialization/synthesis behavior yet.

### Software Map domain

`packages/software-map/src/contracts.ts` owns:
- `.dope/architecture.json` schema-1 declarations;
- System / Subsystem / Component / CodeEntity graph types;
- physical Evidence and relationships;
- PhysicalMapSnapshot and query contracts.

`architecture.ts` strictly parses canonical declarations and applies explicit root ownership. It currently requires at least one declared System when a declaration file exists.

`assembly.ts` currently manufactures architecture-level graph nodes only from canonical declarations, then assigns deterministic code nodes to those explicit roots.

`service.ts` currently has only Physical Map analysis/query status:
- `idle | analyzing | ready | failed`;
- `analyze()`;
- hierarchy/relationship/evidence/violation/source queries.

There is no sMap initialization lifecycle, ArchitectureEvidencePacket, ArchitectureProposal, proposal validator, review state or synthesis provider contract.

### Deterministic analysis/index

`packages/code-analysis/src/node/architecture-file.ts` returns an empty schema-1 declaration when `.dope/architecture.json` is absent.

`SoftwareMapIndex.analyze()` currently:
1. reads the declaration;
2. fingerprints source/config/declaration;
3. invokes the TypeScript analyzer;
4. immediately assembles/publishes a PhysicalMapSnapshot.

That is incompatible with the new first-use rule if called during initialization: deterministic evidence collection for a proposal must not itself publish an sMap before developer acceptance.

The TypeScript analyzer already emits stable code nodes, relationships, semantic evidence and configured project/source metadata. The evidence packet should reuse this qualified substrate rather than replacing it.

The packet also needs architecture-scale deterministic facts absent from the current proposal layer: workspace/package topology, package manifests, entrypoint/config signals and normalized dependency neighborhoods. Those belong behind code-analysis, not in the LLM adapter.

### Backend/UI

`SoftwareMapBackend` already enforces per-connection project handles, bounded queries and safe source resolution.

`SoftwareMapController` already guards stale workspace/generation responses.

`SoftwareMapWidget` currently:
- always shows `Analyze / Refresh`;
- reports an idle graph as “Ready to analyze”;
- has no uninitialized yes/no onboarding;
- has no AI setup;
- has no proposal review/correction state.

The widget is already correctly placed in the left primary sidebar and must remain there.

### Local synthesis reference

There is no model/runtime package or provider dependency in the current product. ADR 0011 intentionally authorizes only the narrow c4 synthesis path:
- local LM Studio-compatible endpoint;
- Qwen3-Coder-30B-A3B-Instruct as the first reference model family;
- strict structured JSON;
- synthetic capability probe;
- synthetic pre-synthesis warm-up;
- no ArchitectureEvidencePacket submission when warm-up fails.

Do not create the Phase 6 general Model Runtime merely to satisfy this correction.

### Existing Dope canonical architecture

The repository already contains `.dope/architecture.json` from qualified Phase 4. Its existence must not be treated as proof that the new sMap initialization lifecycle has been completed.

The initial workflow must support an existing valid declaration as a manual/developer-authored path without feeding that declaration into the deterministic ArchitectureEvidencePacket as if it were physical evidence. The real Qwen dogfood should be able to temporarily exercise synthesis independently from the existing declaration and restore the repository exactly afterward.

## Authority reconciliation note

`AGENTS.md` still contains older c4 wording that says deterministic analysis itself discovers architecture candidates and that AI/provider runtime is out of the correction. ADR 0010 and ADR 0011 are later, explicit amendments authorizing the narrow synthesis provider.

P1 should reconcile only those stale c4-specific AGENTS lines with current authority. It must not broaden the correction into general AI Presence.

## State/persistence decision for planning

Use a separate, readable project-local initialization marker, expected as `.dope/smap.json`, rather than equating initialization with architecture-file existence.

The minimal durable marker should state only the accepted initialization state/schema needed to distinguish an initialized project from an uninitialized project. Provider/model configuration, proposal drafts and decline state do not belong there.

Requirements:
- no marker/file write on decline;
- no persisted model proposal before acceptance;
- existing architecture without the marker remains an explicit uninitialized/manual-declaration case;
- acceptance establishes canonical architecture plus the marker safely;
- external recovery remains possible with ordinary file/Git tools;
- no derived packet/proposal cache becomes canonical.

The implementation plan must treat two-file canonical acceptance as a failure-sensitive operation and test rollback/recovery rather than claiming impossible cross-file atomicity.

## Proposal-to-canonical review model

The LLM proposal contract intentionally does not let the model invent canonical IDs or canonical ownership roots.

P4/P5 should introduce a transient Dope-owned review draft derived from:
- the validated ArchitectureProposal;
- deterministic evidence referenced by the proposal;
- deterministic root/path suggestions where evidence supports them;
- developer edits.

The review draft may add editable canonical IDs and implementation roots needed to produce a valid ArchitectureDeclaration. Those fields are developer/application review state, not model output.

Accept must fail visibly until the resulting declaration is valid under the existing canonical parser.

## Preserved behavior

All prompts must preserve:
- Phase 4 deterministic TypeScript semantic analysis;
- existing graph/evidence/query identity and validation rules unless the new layer requires an additive contract;
- source navigation and hard evidence;
- architecture dependency validation after canonical acceptance;
- unassigned implementation truth;
- root/project isolation and stale-response protection;
- sMap left-sidebar placement and terminology guards;
- Project Mind and ordinary IDE behavior;
- Theia 1.75.0, Electron 42.8.1, Node 24;
- package version exactly `0.4.6`;
- Phase 4 historical prompts/evidence/closeout as historical truth.

## Main risks

- **Premature AI subsystem:** creating Agent Runtime/Model Runtime or Theia AI product ontology in c4 would violate the bounded ADR 0011 bootstrap.
- **Evidence laundering:** model prose must never become evidence. Every proposal source basis must resolve to the exact deterministic packet.
- **Cold request leakage:** the real packet must never be the request that discovers a dead/unloaded model.
- **Proposal persistence becoming truth:** review state is transient until explicit acceptance.
- **Architecture overwrite:** acceptance must detect stale/external declaration changes and preserve recoverability.
- **Implicit initialization:** opening a workspace or sMap view must not analyze or create project state without consent.
- **Folder inference:** package/path topology is evidence, not automatic System/Subsystem/Component truth.
- **Overlarge packet:** deterministic evidence must be compacted/normalized without deleting the hard source trail.
- **UI scope explosion:** c4 needs a practical review editor, not the Phase 5 visual canvas.
- **Live-model qualification ambiguity:** unit tests use controlled mock servers; P6 separately proves the actual local Qwen path.

## Exit shape

The correction is Green only when an uninitialized brownfield project can:

`consent -> deterministic packet -> local provider readiness -> Qwen structured proposal -> validation -> developer correction -> explicit acceptance -> canonical architecture -> Physical Map reconciliation`

while:
- decline/cancel/failure creates no canonical map;
- manual/greenfield initialization works without a model;
- provider/model choice remains user/application state;
- the real Dope repository completes the reference flow with recoverable, direct evidence.
