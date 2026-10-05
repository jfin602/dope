# Product Phase 8A — Codex Reference Connection Task Stack

Status: **SUPERSEDED BY `docs/tasks/p8a/` — DO NOT EXECUTE**
P6 closeout at `0.8.6`: **NOT GREEN — EVIDENCE GAP**; see [closeout.md](closeout.md).
Execution folder: `p8`
Product slice: Phase 8A
Planned activation baseline: coherent `0.8.0`
Version range: `0.8.1` -> `0.8.6`
Current repository version while writing: `0.7.31`

## Superseded routing

The owner explicitly selected `p8a` as the canonical first Phase 8 slice after the `0.8.0` activation. The runner now supports slice A beginning at patch 1. These files are retained only as prompt-authoring history.

Do **not** execute `p8`; use `p8a`.

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

Before execution:
- `c7-chat-project-grounding` closes Green, or owner explicitly waives it;
- Phase 8 activation record is written;
- coherent `0.8.0` source is committed;
- `npm run codex:phase:validate -- p8` passes.

## Scope law

8A creates a reference **connection/runtime** only.

It does not give Codex permission to mutate repositories. AgentTask/ExecutionGrant mutation begins in Phase 8B.

## P6 closeout summary — exact `0.8.6` candidate

Candidate basis: `4e73b6b41eec76658353e6500ee63d5c223f3fa5` plus the uncommitted coherent `0.8.6` version/internal-reference bump and the bounded App Server sandbox compatibility repair. No commit was created.

Passed commands/evidence:

- focused 92-test P6 suite; then the 58-test focused repair suite;
- `npm run check` once before the repair;
- `npm run codex:phase:validate -- p8` and `npm run codex:phase:validate -- p8a`;
- version/internal-reference/no-root-lock and `git diff --check`;
- real `codex-cli 0.155.1` App Server initialize, model list, completed tiny read-only/no-approval/no-network turn, clean shutdown, and empty scratch root.

Repair: App Server's current thread sandbox wire enum is `read-only`, while the turn policy remains `readOnly` and requires `networkAccess: false`; the adapter and its permanent payload guard now use those exact forms.

Direct no-project AI Center evidence reached the safe Codex sign-in-pending state with no rendered secret or authorization URL. The eligible-account OAuth callback, Dope account/model inventory, live registration restart, refresh/sign-out/reconnect, and live refreshed-token App Server replacement/resume did not complete. The resulting Phase 8A decision is **Not Green — Evidence Gap**. See [closeout.md](closeout.md) for the full evidence and retained security/role constraints.

## Official implementation references

Use current official documentation during P2/P3/P6:
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/token-reference
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Next routing

P6 did not close Phase 8A. The direct Dope OAuth/account-inventory lifecycle remains unqualified; do not begin Phase 8B.

After the exact-candidate gaps close Green, route to `/docs-review` for Phase 8B Agent execution core, then its own prompt stack.
