# Product Phase 4 — Physical Map Task Stack

Status: ACTIVE — P5 THEN MANDATORY `c4-tweaks` GATE BEFORE P6
Activation source/package baseline: `93a2b3152066029d28dabf73e5672e0663599e22`, `0.4.0`
Theia baseline: `1.75.0`; Electron: `42.8.1`; Node: 24
Authority: `docs/planning/p4/phase-4-plan.md`, `docs/planning/p4/activation.md`, ADR 0007 as amended by ADR 0008

Correction `c3-remove-planning-instruments` is complete. Phase 3 Planning is historical evidence only and has no compatibility claim on this stack.

ADR 0008 was accepted while P5 was already in flight. P1-P5 prompt/evidence filenames and wording may therefore preserve the pre-ADR Software Model terminology as historical/in-flight evidence. Current forward product terminology is **Software Map (sMap)** / **Physical Map** / **Planning Map**.

## Stack

| Prompt / gate | Version | Work | Model | GUI |
| --- | --- | --- | --- | --- |
| P1 | `0.4.1` | Historical pre-ADR architecture contracts/core + declaration semantics | GPT-6 Sol High | no |
| P2 | `0.4.2` | Code-analysis abstraction + deterministic TypeScript/JavaScript analyzer | GPT-6 Sol High | no |
| P3 | `0.4.3` | Architecture loader, graph/index coordinator, rules/queries + typed backend transport | GPT-6 Sol High | no |
| P4 | `0.4.4` | Historical pre-ADR inspector, reanalysis/restart + package/native evidence | GPT-6 Sol High | no |
| P5 | `0.4.5` | Direct interactive Dope-maps-Dope qualification | GPT-6 Sol High | yes |
| **Correction gate** | `0.4.5` unchanged | **`c4-tweaks`: canonical sMap rename + left Activity Bar/sidebar placement + requalification** | GPT-6 Sol High | yes in correction P2 |
| P6 | `0.4.6` | Evidence-only Physical Map closeout from successful P5 + successful correction | GPT-6 Sol Medium | no |

## Prerequisite

Require reachable activation source `93a2b3152066029d28dabf73e5672e0663599e22`, coherent `0.4.0` for P1 (or the exact applicable predecessor for later prompts), clean intended Git state, Node 24, no root `package-lock.json`, Theia 1.75.0 and Electron 42.8.1.

Do not require Phase 3 Planning to exist. The completed c3 correction is the entry gate.

No model/provider configuration is required for Phase 4 product behavior.

## Execution

Validate Phase 4 prompt grammar:

`npm run codex:phase:validate -- p4`

Execute normal Phase 4 implementation routing until P5:

`npm run codex:phase -- p4 --closeout`

P1-P4 are runner-owned and implementation agents do not commit.

The runner stops at P5 because direct GUI interaction is required. P5 must use the actual Theia GUI on the real Dope repository; CDP/headless instrumentation may supplement but cannot replace direct clicking, navigation and observation.

A successful P5 is committed exactly as `0.4.5` with a clean intended tree.

**Do not resume P6 immediately after P5.** Run and close `c4-tweaks` first at unchanged `0.4.5`:

`npm run codex:phase:validate -- c4-tweaks`

`npm run codex:phase -- c4-tweaks`

Correction P2 is browser-required and correction P3 is manual evidence-only closeout. Only a Green/qualified correction closeout clears the gate to P6.

After the correction is Green, resume Product Phase 4 P6 manually from the exact corrected `0.4.5` candidate. P6 advances coherently to `0.4.6` and performs evidence-only Phase 4 closeout.

## Output records

Historical/pre-ADR Phase 4 records:
- `prompt-assessment.md`
- `implementation-plan.md`
- P3 may create `docs/software-model-storage.md` under the terminology in force when executed.
- P4 creates `P4-software-model-restart-package-evidence.md`.
- P5 creates `P5-physical-model-dogfooding-evidence.md`.

Correction records:
- `docs/tasks/c4-tweaks/prompt-assessment.md`
- `docs/tasks/c4-tweaks/implementation-plan.md`
- correction P2 creates `docs/tasks/c4-tweaks/P2-smap-layout-evidence.md`;
- correction P3 creates `docs/tasks/c4-tweaks/closeout.md`.

P6 creates `closeout.md`.

The intended Phase 4 exit is:

deterministic repository analysis
-> evidence-backed System / Subsystem / Component / CodeEntity Physical Map
-> renderer-independent graph queries
-> declared-boundary violations
-> direct source navigation
-> dedicated left-side sMap inspector

with no LLM configured, no Planning Map editing and no Phase 5 central visual map canvas.
