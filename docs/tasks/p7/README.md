# Product Phase 7 — AI Presence Task Stack

Status: **P13 EVIDENCE CLOSEOUT NOT QUALIFIED / PHASE 7B-7C OUTSTANDING**
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
| P13 | `0.7.13` | evidence-only 7A closeout; full Phase 7 Not Qualified | T1 | GPT-6 Sol Medium | no |

## Execution

P1-P12 and the P12 blocker correction are recorded at the coherent `0.7.12` checkpoint. P13 records their evidence at `0.7.13` without product changes. See [closeout.md](closeout.md) for the Not Qualified decision. A bounded Phase 7 continuation must address ADR 0026 AI Center and role routing before the final Phase 7 qualification decision.

## Records
- `prompt-assessment.md`
- `implementation-plan.md`
- `P12-ai-presence-dogfooding-evidence.md` (created by P12)
- `closeout.md` (P13 evidence-only record; Not Qualified)
