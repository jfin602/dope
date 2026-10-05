# Product Phase 8A — Codex Reference Connection Task Stack

Status: **WRITTEN / EXECUTION GATED**
Execution folder: `p8a`
Product slice: Phase 8A
Activation baseline: coherent `0.8.0` at `a2346556309174e9a24b3f8c11ac682d50460d0c`
Version range: `0.8.1` -> `0.8.6`
Current repository version: `0.8.0`

## Why the folder is p8

The first slice of a phase uses the base phase folder. This mirrors Phase 7A using `p7`; later Phase 8 continuations may use `p8b`, `p8c`, etc.

Do **not** execute this stack until Phase 8 is activated at `0.8.0`.

## Stack

| Prompt | Version | Boundary | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | 0.8.1 | Codex connection/agentExecution domain + registry | GPT-6 Sol High | no |
| P2 | 0.8.2 | ChatGPT-plan OAuth/account/session security | GPT-6 Sol High | no |
| P3 | 0.8.3 | Codex App Server adapter + zero-data Test Connection | GPT-6 Sol High | no |
| P4 | 0.8.4 | AI Center Codex setup/account/model/usage UX | GPT-6 Sol High | no |
| P5 | 0.8.5 | Coding Agent role convergence + consumer isolation | GPT-6 Sol High | no |
| P6 | 0.8.6 | live OAuth/App Server/browser qualification + 8A closeout | GPT-6 Sol High | yes |

## Entry gate

Satisfied:
- owner sequencing waiver recorded after the retained Not Green grounding closeout;
- Phase 8 activation record written;
- coherent `0.8.0` committed.

Before execution run:
`npm run codex:phase:validate -- p8a`.

## Scope law

8A creates a reference **connection/runtime** only.

It does not give Codex permission to mutate repositories. AgentTask/ExecutionGrant mutation begins in Phase 8B.

## Official implementation references

Use current official documentation during P2/P3/P6:
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/token-reference
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Next routing

Green P6 closes Phase 8A only.

Next: `/docs-review` for Phase 8B Agent execution core, then its own prompt stack.

