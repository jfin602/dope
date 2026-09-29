# Correction 4 Prompt Assessment — sMap Architecture Synthesis

Status: IN PROGRESS — P1/P2 COMPLETE; FRAMEWORK GAP AMENDMENT APPROVED; P3 NEXT
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Prompt-authoring source: `067828fdd6db0149765e67c547158f63d7e55743`
Post-P2 amendment source: `99f16e871b403be96c35078ec94a3ebb5ccf3990`
Required unchanged package version: `0.4.6`
Authority: ADR 0009 as amended by ADR 0010; ADR 0011; BOOT; AGENTS subject to the later ADR amendments; ARCHITECTURE; PRODUCT-MODEL; software-map-storage; roadmap/workflow/stability authority

## Conclusion

The committed P1/P2 work remains accepted and unchanged. Insert one new prompt immediately after P2, then shift only the unexecuted prompts.

Use eight ordered prompts at unchanged `0.4.6`:

1. provider-independent synthesis/lifecycle contracts and strict proposal validation — **committed**;
2. deterministic, AI-independent ArchitectureEvidencePacket generation and bounded refinement — **committed**;
3. deterministic framework-extraction seam + first Theia/Inversify extractor — **next**;
4. local LM Studio/Qwen provider adapter, structured-output probe and warm-up gate;
5. initialization orchestration, project-local initialization marker and safe canonical acceptance;
6. Analyze Project onboarding, local-model setup and proposal review/correction UI;
7. direct real-Dope LM Studio/Qwen dogfooding and package/restart qualification;
8. evidence-only correction closeout.

This remains the executable stack for the roadmap/ADR correction named `c4-architecture-discovery`. The folder `c4-smap-synth` does not rename the governing correction.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | Software Map synthesis contracts/lifecycle/schema validation | committed `cc5fc120a804c42362f6afb78cfa2d10e5c20cb1` | GPT-6 Sol High |
| P2 | deterministic ArchitectureEvidencePacket + bounded refinement | committed `99f16e871b403be96c35078ec94a3ebb5ccf3990`; 379 facts/~140 KB/~13 s; zero framework facts | GPT-6 Sol High |
| P3 | framework extractor seam + Theia/Inversify extraction | non-zero real-Dope framework facts, hard provenance, false-positive guards, bounded framework refinement | GPT-6 Sol High |
| P4 | backend LM Studio-compatible synthesis adapter | model discovery, JSON-schema probe, warm state, no project evidence before warm success | GPT-6 Sol High |
| P5 | initialization orchestration + durable acceptance/reconciliation | no-write decline/cancel, safe canonical acceptance, stale/conflict/isolation guards | GPT-6 Sol High |
| P6 | sMap onboarding/setup/review UI | Analyze Project, local model setup, review/correction, explanation + hard-source drill-down | GPT-6 Sol High |
| P7 | real LM Studio/Qwen dogfood + direct browser/package/restart qualification | actual Dope evidence incl. framework facts -> Qwen proposal -> validation -> correction/acceptance | GPT-6 Sol High, browser required |
| P8 | evidence-only closeout | exact candidate, A-H gate audit, no product repair | GPT-6 Sol High |

## Current implementation findings

### P1/P2 committed state

P1 committed the provider-independent synthesis contract, strict `ArchitectureProposal` schema/parser, packet-reference validation, numeric confidence and the `framework` evidence kind.

P2 committed deterministic packet production in `packages/code-analysis/src/node/architecture-evidence.ts` plus non-publishing `SoftwareMapIndex.collectEvidence()` / bounded refinement.

The real Dope P2 run produced:
- 379 ordered deterministic facts;
- about 140 KB serialized JSON;
- about 13 seconds collection time;
- zero `framework` facts.

This is useful evidence, not a P2 rollback condition. P2 proved the packet mechanism, declaration independence, deterministic ordering/fingerprinting and no premature map publication.

### Framework gap discovered by P2

The packet contract already supports `kind: framework`, but the producer has no framework extractor and therefore cannot expose high-value deterministic Theia/Inversify semantics.

Before any LLM/provider prompt runs, P3 must add a generic deterministic framework-extractor seam and qualify Theia/Inversify extraction against the real Dope repository.

The framework layer must remain evidence only. It may expose registrations, DI/service wiring, RPC boundaries and view/workbench registrations with hard provenance; it may not create Systems/Subsystems/Components.

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

P5/P6 should introduce a transient Dope-owned review draft derived from:
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
- **Live-model qualification ambiguity:** unit tests use controlled mock servers; P7 separately proves the actual local Qwen path.

## Exit shape

The correction is Green only when an uninitialized brownfield project can:

`consent -> deterministic packet -> local provider readiness -> Qwen structured proposal -> validation -> developer correction -> explicit acceptance -> canonical architecture -> Physical Map reconciliation`

while:
- decline/cancel/failure creates no canonical map;
- manual/greenfield initialization works without a model;
- provider/model choice remains user/application state;
- the real Dope repository completes the reference flow with recoverable, direct evidence.
