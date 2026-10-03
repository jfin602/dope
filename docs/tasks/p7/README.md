# Product Phase 7 — AI Presence Task Stack

Status: **STREAMLINED / READY FOR EXECUTION**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Theia: `1.75.0`; Electron: `42.8.1`; React: `19.2.8`; Node: 24

## Stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.7.1` | Chat domain + service DTOs | T1 | GPT-6 Sol High | no |
| P2 | `0.7.2` | ChatRepository persistence | T1 | GPT-6 Sol High | no |
| P3 | `0.7.3` | Chat service/backend RPC | T2 | GPT-6 Sol High | no |
| P4 | `0.7.4` | multi-area ChatPanel + selector | T2 | GPT-6 Sol High | no |
| P5 | `0.7.5` | live ownership + restoration | T2 | GPT-6 Sol High | no |
| P6 | `0.7.6` | conversational runtime + Model Connections | T2 | GPT-6 Sol High | no |
| P7 | `0.7.7` | Local/Gemini chat adapters | T2 | GPT-6 Sol High | no |
| P8 | `0.7.8` | OpenAI chat adapter | T2 | GPT-6 Sol High | no |
| P9 | `0.7.9` | composer + per-turn model + settings | T2 | GPT-6 Sol High | no |
| P10 | `0.7.10` | bounded context composer | T2 | GPT-6 Sol High | no |
| P11 | `0.7.11` | AI behaviors + auto-title + integrated browser build | T2 | GPT-6 Sol High | no |
| P12 | `0.7.12` | direct AI Presence qualification | T3 | GPT-6 Sol High | yes |
| P13 | `0.7.13` | evidence-only closeout | T3 | GPT-6 Sol Medium | no |

## Execution

Validate once before running:
`npm run codex:phase:validate -- p7`

Then:
`npm run codex:phase -- p7 --closeout`

The runner owns P1-P11 commits and stops for P12 direct GUI/provider qualification. P12 creates the manual `0.7.12` checkpoint; then resume P13.

Broad browser/Electron/restart/live-provider/package work is intentionally concentrated in P12. P13 reuses it.

## Records
- `prompt-assessment.md`
- `implementation-plan.md`
- `P12-ai-presence-dogfooding-evidence.md` (created by P12)
- `closeout.md` (created by P13)
