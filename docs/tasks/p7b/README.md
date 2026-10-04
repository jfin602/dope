# Product Phase 7B — AI Center Task Stack

Status: **READY FOR EXECUTION**
Product source baseline: `a81558dd91ec9042b1066812811a98ba04734047`, package `0.7.13`
Task folder: `p7b` (Phase 7 continuation slice B)
Theia: `1.75.0`; Electron: `42.8.1`; React: `19.2.8`; Node: 24

## Version mapping

`p7b` is a normal Phase 7 continuation. P1 is `0.7.14`, so the runner infers the pre-stack baseline as `0.7.13`; it does not use correction/unchanged-version semantics.

## Stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.7.14` | AI domain + service contracts | T1 | GPT-6 Sol High | no |
| P2 | `0.7.15` | global registry persistence/concurrency/migration | T2 | GPT-6 Sol High | no |
| P3 | `0.7.16` | secure credentials | T2 | GPT-6 Sol High | no |
| P4 | `0.7.17` | provider setup + centralized runtime activation | T2 | GPT-6 Sol High | no |
| P5 | `0.7.18` | inventory/health/Test Connection/eligibility | T2 | GPT-6 Sol High | no |
| P6 | `0.7.19` | AI Center UI + launcher | T2 | GPT-6 Sol High | no |
| P7 | `0.7.20` | Chat convergence | T2 | GPT-6 Sol Medium | no |
| P8 | `0.7.21` | Software Map convergence | T2 | GPT-6 Sol High | no |
| P9 | `0.7.22` | direct AI Center qualification | T3 | GPT-6 Sol High | yes |
| P10 | `0.7.23` | Phase 7B evidence closeout | T3 | GPT-6 Sol Medium | no |

## Execution

Validate the runner/task grammar first:

`npm run codex:phase:validate -- p7b`

Run implementation prompts:

`npm run codex:phase -- p7b`

The runner owns P1-P8 commits and stops for P9 browser/manual qualification. After the coherent manual `0.7.22` checkpoint, resume with `--closeout` for P10.

Phase 7B does not implement role policy/routing. A Green P10 routes to `p7c`; Product Phase 7 itself remains active until 7C and one later final closeout.
