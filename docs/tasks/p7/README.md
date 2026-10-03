# Product Phase 7 — AI Presence Task Stack

Status: **PHASE 7A P1-P12 READY / P13 CLOSEOUT SUPERSEDED BY ADR 0026**
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
| P13 | `0.7.13` | **SUPERSEDED — do not execute; slot reserved for regenerated 7B/7C continuation** | — | — | — |

## Execution

Validate once before running:
`npm run codex:phase:validate -- p7`

Then execute the current stack **without** `--closeout` so it stops at the Phase 7A qualification boundary. The runner owns P1-P11 commits and stops for P12 direct GUI/provider qualification. P12 creates the manual `0.7.12` checkpoint.

Do not resume the currently written P13. ADR 0026 supersedes that closeout. After P12, rerun `/prompt-ass -> /prompt-plan -> /prompt-write p7` to regenerate contiguous P13+ prompts for AI Center, roles/routing, integrated qualification and one new final closeout. Revalidate the regenerated stack before continuing.

## Records
- `prompt-assessment.md`
- `implementation-plan.md`
- `P12-ai-presence-dogfooding-evidence.md` (created by P12)
- final `closeout.md` (created by the regenerated final Phase 7 closeout, not the current P13)
