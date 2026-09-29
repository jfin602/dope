# Correction 4 — sMap Architecture Synthesis

Status: IN PROGRESS — P1/P2 COMPLETE; P3 FRAMEWORK EXTRACTION NEXT
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Required unchanged version: `0.4.6`
Prompt-authoring source: `067828fdd6db0149765e67c547158f63d7e55743`
Post-P2 amendment source: `99f16e871b403be96c35078ec94a3ebb5ccf3990`
Phase 4 qualified source: `fac88712bb55176d3d6d54fbe6034de8b0f801ff`
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24
Authority: ADR 0009 as amended by ADR 0010; ADR 0011; current Software Map authority

This stack implements the mandatory pre-Phase-5 architecture-discovery correction using deterministic evidence plus a bounded local architecture synthesizer.

## Stack

P1 and P2 are already committed and remain unchanged. The P2 real-Dope run exposed the missing framework layer, so a new P3 is inserted before any provider work.

| Prompt | Version | Work | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | `0.4.6` unchanged | synthesis/proposal/lifecycle contracts + strict validation — **complete** | GPT-6 Sol High | no |
| P2 | `0.4.6` unchanged | deterministic evidence packet + bounded refinement — **complete** | GPT-6 Sol High | no |
| P3 | `0.4.6` unchanged | framework extractor seam + Theia/Inversify deterministic evidence | GPT-6 Sol High | no |
| P4 | `0.4.6` unchanged | local LM Studio/Qwen provider, probe, warm-up hard gate | GPT-6 Sol High | no |
| P5 | `0.4.6` unchanged | initialization orchestration, `.dope/smap.json`, safe acceptance/reconciliation | GPT-6 Sol High | no |
| P6 | `0.4.6` unchanged | Analyze Project onboarding, local setup, review/correction/manual UI | GPT-6 Sol High | no |
| P7 | `0.4.6` unchanged | direct browser real-Dope LM Studio/Qwen dogfood + restart/package evidence | GPT-6 Sol High | yes |
| P8 | `0.4.6` unchanged | evidence-only correction closeout | GPT-6 Sol High | no |

P2 baseline retained as evidence: 379 ordered facts, about 140 KB JSON, about 13 seconds, zero framework facts.

## Core invariant

> AI interprets evidence; it does not create evidence.

The initial brownfield flow is:

`consent -> deterministic ArchitectureEvidencePacket -> provider readiness/warm-up -> ArchitectureProposal -> strict validation -> developer correction -> explicit acceptance -> canonical architecture -> Physical Map reconciliation`

No canonical project state is created by decline, probe, warm-up or unaccepted proposal generation.

## Reference synthesizer

The first c4 reference path is local:

`LM Studio -> Qwen3-Coder-30B-A3B-Instruct`

Dope remains provider-independent. LM Studio/Qwen configuration is user/application state and must not enter canonical project files.

The actual model ID exposed by LM Studio may contain runtime/quantization naming; P7 records it rather than hardcoding a file name into product state.

## Execution

Validate:

`npm run codex:phase:validate -- c4-smap-synth`

Run:

`npm run codex:phase -- c4-smap-synth`

The runner resumes at P3. P3-P6 are runner-capable. P7 is browser-required and requires the real local LM Studio/Qwen reference path. P8 is evidence-only closeout.

## Entry gate

Require:
- package `0.4.6`;
- Phase 4 closeout commit `fac88712bb55176d3d6d54fbe6034de8b0f801ff` reachable;
- ADR 0010/0011 current authority;
- clean intended Git state;
- no root package-lock;
- Node 24 / Theia 1.75.0 / Electron 42.8.1.

## Exit gate

The correction clears only when:
- first-use analysis is explicit and decline is a no-write path;
- evidence packets are deterministic/verifiable without AI;
- deterministic framework extraction is non-zero on real Dope and preserves hard provenance without inventing architecture;
- the real local Qwen reference path is qualified;
- probe/warm-up never sends project evidence and warm failure blocks the real call;
- structured proposals cannot fabricate hard evidence;
- the developer can correct/accept or initialize manually;
- acceptance safely establishes canonical architecture and Physical Map reconciliation;
- restart/project isolation/package behavior remain coherent;
- version stays `0.4.6`;
- Phase 5/general AI scope is not pulled forward.
