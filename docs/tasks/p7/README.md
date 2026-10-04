# Product Phase 7 — AI Presence Task Stack

Status: **P13 EVIDENCE CLOSEOUT NOT QUALIFIED / c7-chat-conversation-ux APPROVED / PHASE 7B-7C OUTSTANDING**
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

## Current correction gate

P1-P12 and the P12 blocker correction are retained at the coherent `0.7.12` implementation checkpoint. P13 records their evidence at `0.7.13` without product changes and remains **Not Qualified**. See [closeout.md](closeout.md).

Before the 7B/7C continuation, use the ordinary correction workflow for **`c7-chat-conversation-ux`** at unchanged `0.7.13`:

`/prompt-ass -> /prompt-plan -> /prompt-write c7-chat-conversation-ux`

The correction owns the fixed header/transcript/composer shell, unified composer, safe formatted assistant output, compact metadata, respectful scroll-follow behavior, durable ten-color Chat identity, migration/defaulting, selector swatches and developer-bubble continuity. It must not change provider/model authority, no-silent-fallback semantics, context provenance or Phase 7 read-only boundaries.

After the correction is qualified, proceed with a bounded Phase 7 continuation for ADR 0026 AI Center, role routing, integrated qualification and a later final closeout. Do not rewrite P13 to call the current phase Green.

## Records
- `prompt-assessment.md`
- `implementation-plan.md`
- `P12-ai-presence-dogfooding-evidence.md` (created by P12)
- `closeout.md` (P13 evidence-only record; Not Qualified)
