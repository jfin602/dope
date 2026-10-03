# Product Phase 7 — AI Presence Task Stack

Status: **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Theia: `1.75.0`; Electron: `42.8.1`; React: `19.2.8`; Node: 24
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, Phase 7 plan/activation

## Stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.7.1` | Chat domain core | T1 | GPT-6 Sol High | no |
| P2 | `0.7.2` | Chat persistence/service/backend | T2 | GPT-6 Sol High | no |
| P3 | `0.7.3` | multi-area ChatPanel + selector | T2 | GPT-6 Sol High | no |
| P4 | `0.7.4` | live ownership + restoration | T2 | GPT-6 Sol High | no |
| P5 | `0.7.5` | conversational Model Runtime + connections/providers | T2 | GPT-6 Sol High | no |
| P6 | `0.7.6` | composer + per-turn model + Chat settings | T2 | GPT-6 Sol High | no |
| P7 | `0.7.7` | bounded context + read-only AI Presence | T2 | GPT-6 Sol High | no |
| P8 | `0.7.8` | direct Dope AI Presence qualification | T3 | GPT-6 Sol High | yes |
| P9 | `0.7.9` | evidence-only closeout | T3 | GPT-6 Sol Medium | no |

## Execution

Validate first:

`npm run codex:phase:validate -- p7`

Then run:

`npm run codex:phase -- p7 --closeout`

The runner owns P1-P7 commits and stops at P8 for direct GUI/provider evidence. P8 creates the manual `0.7.8` checkpoint when coherent; then resume P9.

## Product boundary

Phase 7 makes Chat durable and AI present without making Chat or the AI canonical project authority.

```text
.dope/chats/
    -> ChatService
        -> ChatPanel(s)
        -> Context Composer
        -> Model Runtime -> connected providers
```

Mutation-capable tools, ProposedAction/Authority execution, autonomous coding and Phase 8 background alignment remain out of scope.

## Records

- `prompt-assessment.md`
- `implementation-plan.md`
- `P8-ai-presence-dogfooding-evidence.md` (created by P8)
- `closeout.md` (created by P9)
