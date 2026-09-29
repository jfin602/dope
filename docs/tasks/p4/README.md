# Product Phase 4 — Physical Software Model Task Stack

Status: APPROVED / READY FOR EXECUTION
Activation source/package baseline: `93a2b3152066029d28dabf73e5672e0663599e22`, `0.4.0`
Theia baseline: `1.75.0`; Electron: `42.8.1`; Node: 24
Authority: `docs/planning/p4/phase-4-plan.md`, `docs/planning/p4/activation.md`, ADR 0007

Correction `c3-remove-planning-instruments` is complete. Phase 3 Planning is historical evidence only and has no compatibility claim on this stack.

## Stack

| Prompt | Version | Work | Model | GUI |
| --- | --- | --- | --- | --- |
| P1 | `0.4.1` | Physical Software Model contracts/core + architecture declaration semantics | GPT-6 Sol High | no |
| P2 | `0.4.2` | Code-analysis abstraction + deterministic TypeScript/JavaScript analyzer | GPT-6 Sol High | no |
| P3 | `0.4.3` | Architecture loader, graph/index coordinator, rules/queries + typed backend transport | GPT-6 Sol High | no |
| P4 | `0.4.4` | Software Model inspector, integrated reanalysis/restart + package/native evidence | GPT-6 Sol High | no |
| P5 | `0.4.5` | Direct interactive Dope-maps-Dope qualification | GPT-6 Sol High | yes |
| P6 | `0.4.6` | Evidence-only closeout | GPT-6 Sol Medium | no |

## Prerequisite

Require reachable activation source `93a2b3152066029d28dabf73e5672e0663599e22`, coherent `0.4.0` for P1 (or the exact applicable predecessor for later prompts), clean intended Git state, Node 24, no root `package-lock.json`, Theia 1.75.0 and Electron 42.8.1.

Do not require Phase 3 Planning to exist. The completed correction is the required entry gate.

No model/provider configuration is required for Phase 4 product behavior.

## Execution

Validate prompt grammar:

`npm run codex:phase:validate -- p4`

Execute implementation plus closeout routing:

`npm run codex:phase -- p4 --closeout`

P1-P4 are runner-owned and implementation agents do not commit.

The runner stops at P5 because direct GUI interaction is required. P5 must use the actual Theia GUI on the real Dope repository; CDP/headless instrumentation may supplement but cannot replace direct clicking, navigation and observation.

A successful P5 is committed exactly as `0.4.5` with a clean intended tree before P6 resumes. Failed/incomplete P5 remains a checkpoint unless a separate explicit audit waiver is supplied. P6 is evidence-only and must not repair product behavior or generate Phase 5 prompts.

## Output records

- `prompt-assessment.md`
- `implementation-plan.md`
- P3 creates `docs/software-model-storage.md` if canonical/derived storage behavior needs a user recovery record.
- P4 creates `P4-software-model-restart-package-evidence.md`.
- P5 creates `P5-physical-model-dogfooding-evidence.md`.
- P6 creates `closeout.md`.

The intended Phase 4 exit is:

deterministic repository analysis
-> evidence-backed System / Subsystem / Component / CodeEntity model
-> renderer-independent queries
-> declared-boundary violations
-> direct source navigation

with no LLM configured and no target/planning graph.
