# Product Phase 4 — Physical Map Activation

Status: OWNER APPROVED — ACTIVE
Date: September 28, 2026
Package baseline: `0.4.0`
Entry gate: completed correction `c3-remove-planning-instruments` at unchanged `0.3.6`

## Decision

The owner approved Product Phase 4 after post-correction documentation review.

Correction 3 is complete and Green/qualified for sequencing. Its closeout commit is `3f0a4bd6854e3d4ef5781b1c0150e5c213a2d52b`; the audited corrected product source is `d3dfeb209ab30c23951d894204a89698a6b44353`. The Phase 3 Planning runtime/domain/storage/UI/PLAN mode is gone. Historical Phase 3 evidence remains authoritative for what `0.3.6` qualified, but it is not a compatibility contract.

The coherent `0.4.0` Product Phase 4 activation source is `93a2b3152066029d28dabf73e5672e0663599e22`. The p4 task stack must require this source to be reachable and preserve coherent `0.4.0` before P1 advances versioning.

## September 29 terminology/layout amendment

ADR 0008 supersedes the software-architecture feature terminology from ADR 0007 without changing ADR 0007's architectural substance.

Canonical product terms are now **Software Map (sMap)**, **Physical Map**, and **Planning Map**. The Phase 4 inspector defaults to a dedicated sMap button in the left Activity Bar/primary sidebar. The right secondary sidebar is reserved by default for future Agent Mind/chat/AI interaction, while Phase 5 owns the center-workspace visual Physical Map / Planning Map canvas.

Because P5 was already in flight when this decision was made, P5 may finish against the pre-amendment naming and placement. After P5, a bounded Phase 4 correction at the unchanged then-current package version must rename the live feature/package/symbol/UI surfaces, move the inspector left, and add permanent regression guards. P6 closeout is blocked until that correction is Green. No Phase 5 canvas work is authorized by this amendment.

## Activation baseline

All current Dope manifests and internal `@dope/*` references are coherent at `0.4.0`.

Theia remains `1.75.0`, Electron `42.8.1`, Node 24 major. No framework upgrade is part of Phase 4 activation.

The first runner prompt advances `0.4.0 -> 0.4.1`.

## Scope authorization

Authorized:
- language-independent Physical Map contracts;
- stable System / Subsystem / Component / CodeEntity identities;
- developer-authored architecture declarations and dependency constraints;
- deterministic TypeScript/JavaScript-first semantic analysis behind adapters;
- repository/workspace discovery and rebuildable/incremental indexing;
- typed physical relationships with evidence/provenance;
- architecture-boundary validation and violation queries;
- renderer-independent hierarchy/node/relationship/dependency/evidence/violation query APIs;
- typed Theia backend transport and a bounded inspection/navigation surface;
- direct Dope-on-Dope qualification using the actual repository.

Not authorized:
- Phase 3 Planning compatibility, migration or dual state;
- target/Planning Maps or PlannedTransformation execution;
- editable visual architecture/planning canvas;
- graph-derived task/work ontology;
- model/provider runtime, OpenAI/Codex product integration or local-model product integration;
- Agent Mind, ownership/delegation, ProposedAction, tool authority or mutation;
- Development Sessions;
- a Theia/framework upgrade.

## State authority

Developer-authored System/Subsystem declarations and architecture dependency constraints are canonical project architecture state.

The extracted Physical Map/index is rebuildable derived state. It must never become irreplaceable project truth merely because caching/indexing makes it convenient.

Physical source facts require deterministic analyzer evidence. Runtime facts, if introduced, are recorded observations. Inferred semantics remain explicitly inferred. No AI output is physical truth in this phase.

## Execution

Execution folder: `p4`.

Versions are `0.4.1` through `0.4.6`. P1-P4 are runner-owned. P5 is direct interactive GUI qualification. After P5, the ADR 0008 correction runs at the unchanged then-current package version (expected `0.4.5` after successful P5). P6 is evidence-only closeout and runs only after that correction is Green.

After the p4 task stack is committed, validate:

`npm run codex:phase:validate -- p4`

Then execute with the phase runner.
