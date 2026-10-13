# c9-codex-chat — Codex as an ordinary Chat provider

Status: **APPROVED DOCUMENTS / EXECUTABLE PROMPTS AUTHORED / NOT IMPLEMENTED OR QUALIFIED** (2026-10-12)
Mode: Correction 9
Required unchanged Dope package/workspace version: `0.9.23`
Authority: ADR 0035, ADR 0025/0026/0027/0028/0029/0030, docs/workflow.md and docs/stability-contract.md.
Planning source: GitHub main 6e762856; p9d is separately ACTIVE with P1 requalified Green and P2–P13 outstanding. Preserve its versioned work and historical statuses.

## Goal

Use the **existing Codex ChatGPT account and connection** for ordinary Dope Chat via a separate, OAuth-authorized and tool-free streaming Responses adapter, without involving AgentTask/Run/ExecutionGrant and without paying an unannounced OpenAI API-key bill. The same connection can independently expose conversationalText/streaming and agentExecution; models only qualify for roles whose capability contracts are met. Chat stays under .dope/chats, Work under .dope/agent, with distinct panels and independent authority.

| Prompt | Responsibility | Tier | Recommended model | Browser |
| --- | --- | --- | --- | --- |
| P1 | OAuth catalog and dual-capability inventory | T1 | GPT-6 Sol High | no |
| P2 | Tool-free OAuth Responses streaming adapter | T1 | GPT-6 Sol High | no |
| P3 | Existing connection/runtime lifecycle binding | T1 | GPT-6 Sol High | no |
| P4 | Ordinary Chat/Interactive role and consent UI | T2 | GPT-6 Sol High | no |
| P5 | Provider/authority/Work integration regressions | T2 | GPT-6 Sol High | no |
| P6 | Real eligible-account GUI, aggregate and correction closeout | T3/manual | GPT-6 Sol High | yes |

P1–P5 are runner-owned implementation checkpoints, each targeted at <=8 minutes (10-minute soft / 15-minute hard). P6 is the ONLY final manual/browser-required closeout. Package versions remain unchanged; no root package-lock. New deterministic tests focus on provider transport, catalog, connection lifecycle, Interactive routing and no-tool/no-billing fallback. P6 alone owns one full final-candidate `npm run check` and direct GUI/restart.

## Safety and failure law

- One secure Codex OAuth account, account-specific authorization and provider model discovery; never persist secrets in .dope/ or frontend.
- OAuth public Responses endpoint, store:false, stream:true and no executable tools; only `response.completed` counts as successful completion.
- Mid-stream subscription-limit, cancellation, missing terminal, malformed/tool events, signed-out accounts and unknown capability must fail clearly.
- Both Chat and Work spend shared Work/Codex allowance, not ChatGPT web-chat allowance. No silent API-key fallback, guessed token limits/usage bars or hidden hosted evidence egress.
- Work retains Codex App Server AgentExecutionAdapter, isolated candidate execution, Dope validation, grant and promotion; no Chat|Work toggle. Preserve current restrained Dope theme, p9d/History, all historical qualification and user project files.
- If real account/GUI, authoritative negative tool check or exact-candidate aggregate is missing, close P6 NOT GREEN.

## Separate p9d execution

`p9d` and this correction may not execute concurrently in the same checkout. This stack is **pinned** to coherent `0.9.23`. Inspect actual checkout before P1; if p9d P2 already advanced manifests (0.9.24 or later), do not execute this stale version-pinned stack: intentionally replan/review the baseline first and preserve all p9d work. This document does not pause or requalify p9d.

## Files

Planning: `prompt-assessment.md` and `implementation-plan.md`.
Executable: P1–P6 `.txt` in this folder.
Validation: `npm run codex:phase:validate -- c9-codex-chat`.
Execution after source/version/worktree preflight: `npm run codex:phase -- c9-codex-chat`.
The runner stops at manual P6; only P6 authors `closeout.md` and records **GREEN** or **NOT GREEN**. Do not claim success because prompts were authored.

## Efficiency gate

Audited as a stack: P1 inventory only, P2 transport only, P3 runtime binding only, P4 Chat/routing UI only, P5 security/integration only, P6 exact-candidate live proof. No ordinary prompt duplicates full aggregate/build/GUI; only changed-package compiled output and directly affected tests are run early. New tests join test:product once if absent; final full check runs once on final unchanged candidate. No historical phase requalification, broad provider refactor, Chat/Work redesign, or Phase 10.
