# Correction 4 — Hierarchical sMap Synthesis

Status: **IMPLEMENTATION THROUGH P7 COMPLETE — P8/P9 SUPERSEDED / NOT EXECUTED under ADR 0013**
Correction folder: `c4-smap-hierarchical-synthesis`
Required unchanged version: `0.4.6`
Predecessor: owner-closed / Not Qualified `c4-smap-synth`, terminal source `0f94b0e3ba46e395394acdb5badc00dd092b37d0`
Authority: ADR 0012; ADR 0009-0011 where not superseded
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24

This stack replaces one-shot architecture synthesis with a bounded hierarchy-first pipeline focused on the core Software Map requirement: credible System discovery.

## Stack

| Prompt | Work | Model | Browser |
| --- | --- | --- | --- |
| P1 | hierarchical contracts, context budgets, stage schemas, progress events | GPT-6 Sol High | no |
| P2 | deterministic evidence planner + global architecture skeleton | GPT-6 Sol High | no |
| P3 | repository-global System Discovery | GPT-6 Sol High | no |
| P4 | System Challenge: keep/merge/split/reject | GPT-6 Sol High | no |
| P5 | per-System Subsystem/Component discovery | GPT-6 Sol High | no |
| P6 | reconciliation, targeted verification, bounded reuse/cache identity | GPT-6 Sol High | no |
| P7 | hierarchical initialization orchestration + visible progress UI | GPT-6 Sol High | no |
| P8 | real LM Studio/Qwen Dope-on-Dope quality/performance qualification | GPT-6 Sol High | yes |
| P9 | evidence-only correction closeout | GPT-6 Sol High | no |

All prompts keep project version exactly `0.4.6`.

## Product invariant

> Full deterministic evidence remains complete. Models receive bounded source-backed views. System detection is repository-global. Synthesis proposes; the developer owns architecture.

## Performance gate

Qualification setup: local Qwen3-Coder-30B-A3B-Instruct family loaded at 65,536 context.

The <=8-minute clock begins when the configured user starts Analyze Project and ends when review is ready/rendered. It includes any required warm-up plus the complete analysis pipeline.

Eight minutes is **not** a runtime timeout. Slower runs continue to completion for evidence but are Not Green on performance.

## Execution

Validate:

`npm run codex:phase:validate -- c4-smap-hierarchical-synthesis`

Run:

`npm run codex:phase -- c4-smap-hierarchical-synthesis`

P1-P7 were implemented; the reachable P7 implementation commit is `66f023f717afd63433d442015b575edf049ae1b6`. P8 and P9 remain historical unexecuted prompt instructions. ADR 0013 supersedes them: do not run them before `c4-smap-gemini-provider`, do not fabricate their evidence, and do not relabel this correction Green. Real Local qualification now occurs alongside Gemini in the successor correction's P4, with closeout in its P5.

## Exit gate

Green requires:
- bounded provider-derived request budgets;
- deterministic, provenance-preserving evidence slices;
- credible repository-global System Discovery;
- measurable System Challenge effect;
- meaningful per-System Subsystem/Component descent;
- bounded reconciliation/verification;
- final refs valid against the complete parent packet;
- visible stage/call-purpose progress with elapsed time;
- real Dope architecture passing explicit human review;
- end-to-end initial analysis <=8 minutes on the qualification setup;
- no eight-minute hard cancellation;
- developer correction/acceptance remains canonical authority;
- restart/package/project isolation remain coherent;
- version remains `0.4.6`.

ADR 0013 supersedes this stack's unexecuted P8/P9 qualification/closeout route. From the completed P7 implementation baseline, route to `c4-smap-gemini-provider`; only that successor's Green closeout may route to `c4-smap-storage`.
