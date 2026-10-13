# Product Phase 3 — Planning Task Stack

Status: COMPLETE / GREEN — Qualified at `0.3.6` (see `closeout.md`)
Activation source/package baseline: `95815b04977a229abfdfdba628eb9dddc9e55203`, `0.3.0`
Theia baseline: `1.75.0`; Electron: `42.8.1`; Node: 24
Authority: `docs/planning/p3/phase-3-plan.md`, `docs/planning/p3/activation.md`

Phase 2's `0.2.6` audit remains Not Qualified. The owner explicitly accepted its retained gaps for sequencing and activated Phase 3; do not reinterpret that waiver as Green evidence. Phase 1's historical gaps also remain preserved.

## Stack

| Prompt | Version | Work | Model | GUI |
| --- | --- | --- | --- | --- |
| P1 | `0.3.1` | Planning contracts/domain/history + real package | GPT-6 Sol High | no |
| P2 | `0.3.2` | Planning storage, project identity, conflicts/recovery + transport | GPT-6 Sol High | no |
| P3 | `0.3.3` | Production Planning workspace, Project Mind bridge, safe editing | GPT-6 Sol High | no |
| P4 | `0.3.4` | Restart/reopen integration + Electron package/native launch | GPT-6 Sol High | no |
| P5 | `0.3.5` | Direct interactive Dope-on-Dope Planning dogfood | GPT-6 Sol High | yes |
| P6 | `0.3.6` | Evidence-only closeout | GPT-6 Sol Medium | no |

## Prerequisite

Require reachable activation source `95815b04977a229abfdfdba628eb9dddc9e55203`, coherent `0.3.0` baseline for P1 (or the applicable predecessor version for later prompts), clean intended Git state, Node 24, no root `package-lock.json`, Theia 1.75.0 and the explicit owner Phase 3 activation.

Do not require Phase 2 Green in addition to the recorded owner sequencing disposition. Preserve the Phase 2 closeout exactly.

No model/provider configuration is required for Phase 3 product behavior. ADR 0006's Codex-first decision applies to Phase 4 AI Presence, not to the p3 runtime.

## Execution

Validate prompt grammar:

`npm run codex:phase:validate -- p3`

Execute implementation plus closeout routing:

`npm run codex:phase -- p3 --closeout`

P1-P4 are runner-owned; implementation agents do not commit. The runner stops at P5 because direct GUI interaction is required. P5 may use direct interactive browser-hosted Theia or Electron; headless/CDP/DOM-query/screenshot-only assertions do not replace direct clicking, typing and observation.

A successful P5 is committed exactly as `0.3.5` with a clean intended tree before P6 resumes. Failed/incomplete P5 remains a checkpoint unless a separate explicit audit waiver is supplied. P6 is evidence-only and must not repair product behavior or generate Phase 4 prompts.

## Output records

- `prompt-assessment.md`
- `implementation-plan.md`
- P2 creates `docs/planning-storage.md`.
- P4 creates `P4-planning-restart-package-evidence.md`.
- P5 creates `P5-planning-dogfooding-evidence.md`.
- P6 creates `closeout.md`.

The intended Phase 3 exit is developer-controlled Decision -> Plan -> Step -> Task -> ordinary coding -> explicit progress, surviving restart with useful history and no LLM.

Phase 3 is closed for its applicable scope. Next route: post-Phase-3 `/docs-review`, followed by explicit owner approval before Phase 4 AI Presence execution. Historical Phase 1/2 Not Qualified audits remain unchanged.
