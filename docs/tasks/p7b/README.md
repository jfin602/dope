# Product Phase 7B — AI Center Task Stack

Status: **QUALIFIED / CLOSED** at `0.7.23`; Product Phase 7 remains **ACTIVE / NOT FINAL** pending 7C. See `closeout.md` for the A–H audit, exact checkpoint identities, evidence limits and disposition.
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

P1–P9 checkpoints: P1 `c8e8ecc5694e441e87ec7453d987166c3cceb85e`, P2 `3f861c29d852330320adb5f897ee6d9b103c3a68`, P3 `1b8b083b42c80772c5519d44329c0836262f0511`, P4 `12becd2eb797db7f921dce68c4f5fe2975e2f99f`, P5 `2a5086f3843a1385159cd6bd7697cf99e26341b2`, P6 `edcfb55579f7967cea7a3d6bac97052f7f8fb34b`, P7 `eaefb041e573d1d908e0e27ece626ce935bfd66e`, P8 `d0f8ff2abde4d851f4c3486d80765740fa27c60e`, P9 `8cd79061c4887575253cd93d92e3e90aab24da46`. P9's direct A–J and T3 evidence is in `P9-ai-center-qualification-evidence.md`; P10's A–H decisions and residuals are in `closeout.md`.

P10 audit decisions: **A Green, B Green, C Green, D Green, E Green, F Green, G Green, H Green.** Reused P9's real Local, multi-process/restart, browser UI and Linux package evidence; no real hosted credential/paid test and no separately observed native launcher click. These bounded residuals do not block the Phase 7B **Qualified / Closed** decision. Next: `/docs-review` for Phase 7C authority/prompt planning; no 7C implementation is part of this stack.

Historical runner instructions (P1–P10 already executed/closing):

Validate the runner/task grammar first:

`npm run codex:phase:validate -- p7b`

Run implementation prompts:

`npm run codex:phase -- p7b`

The runner owns P1-P8 commits and stops for P9 browser/manual qualification. After the coherent manual `0.7.22` checkpoint, resume with `--closeout` for P10.

Phase 7B does not implement role policy/routing. A Green P10 routes to `p7c`; Product Phase 7 itself remains active until 7C and one later final closeout.
