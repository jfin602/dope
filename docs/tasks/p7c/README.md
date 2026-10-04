# Product Phase 7C — AI Roles & Routing Task Stack

Status: **READY FOR EXECUTION**
Product source baseline: `42353d5d817b1c57c72ccb28e52a6bdf5eb1d66b`, package `0.7.23`
Task folder: `p7c` (Phase 7 continuation slice C)

`p7c` is a normal Phase 7 continuation. P1 targets `0.7.24`, so the runner infers the baseline as `0.7.23`.

| Prompt | Version | Boundary | Model | GUI |
| --- | --- | --- | --- | --- |
| P1 | `0.7.24` | role/routing domain contracts | GPT-6 Sol High | no |
| P2 | `0.7.25` | global role-policy persistence/service | GPT-6 Sol High | no |
| P3 | `0.7.26` | deterministic resolver | GPT-6 Sol High | no |
| P4 | `0.7.27` | routed execution/fallback/provenance | GPT-6 Sol High | no |
| P5 | `0.7.28` | AI Center Roles UI | GPT-6 Sol High | no |
| P6 | `0.7.29` | Chat Interactive-role integration | GPT-6 Sol High | no |
| P7 | `0.7.30` | Software Map + future role seams | GPT-6 Sol High | no |
| P8 | `0.7.31` | direct integrated 7C qualification | GPT-6 Sol High | yes |
| P9 | `0.7.32` | final Product Phase 7 closeout | GPT-6 Sol Medium | no |

Validate:
`npm run codex:phase:validate -- p7c`

Execute:
`npm run codex:phase -- p7c`

The runner owns P1-P7 commits and stops for P8 direct qualification. After the coherent manual `0.7.31` checkpoint, resume with `--closeout` for P9.

P3 resolves over the qualified 7B inventory without executing models. Its inventory has no known reasoning-capable signal, so `prefer-reasoning-capable` is neutral; it never infers reasoning support from a provider name. Other preferences use known locality and observed/known context within an entry only.

P9 is the one later final Phase 7 closeout required by the Phase 7 plan. A Green P9 may close Product Phase 7; it does not create Phase 8 implementation prompts.
