# Phase 8D — General Scoped Delegation

Status: **OWNER-ACTIVATED / IMPLEMENTATION STACK WRITTEN — NOT YET QUALIFIED**
Starting package version: `0.8.20`
Execution folder: `p8d` (Phase 8 continuation; no competing `p8` stack)
Target versions: `0.8.21` through `0.8.30`
Authority: `docs/decisions/0031-phase-8d-general-scoped-delegation-and-developer-review.md`; `docs/planning/p8/phase-8d-plan.md`.

## Goal

Let developers delegate Planning WorkItems through the existing qualified AgentTask/AgentRun/Authority substrate, with HUMAN/AI/SHARED scopes, durable steering and truthful consequential actions, explicit frozen-candidate diff/validation acceptance, and bounded Software Map impact. Keep direct Work/Prompt Stacks and separate Chat/Work panels untouched.

## Prompt Stack

| Prompt | Target version | Scope | Validation | Model | Browser required |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.21 | WorkItem ownership and portable delegation contracts | T1 | GPT-6 Sol High | no |
| P2 | 0.8.22 | Revision-safe WorkItem to AgentTask delegation | T2 | GPT-6 Sol High | no |
| P3 | 0.8.23 | Frozen candidate review hold after validation | T2 | GPT-6 Sol High | no |
| P4 | 0.8.24 | Accept or reject reviewed candidate safely | T2 | GPT-6 Sol High | no |
| P5 | 0.8.25 | Consequential ProposedAction without privilege escalation | T1/T2 | GPT-6 Sol High | no |
| P6 | 0.8.26 | Durable steering with safe runtime acknowledgement | T2 | GPT-6 Sol High | no |
| P7 | 0.8.27 | Bounded post-promotion Software Map impact | T2 | GPT-6 Sol High | no |
| P8 | 0.8.28 | Planning and Work delegation, review and steering UI | T1/T2 | GPT-6 Sol High | no |
| P9 | 0.8.29 | Delegation and legacy execution integration regressions | T2 | GPT-6 Sol High | no |
| P10 | 0.8.30 | Phase 8D live delegation GUI qualification and closeout | T3 | GPT-6 Sol High | yes |

## Preconditions

8A–8C, real Adaptive SEO Prompt Stack, `c8-chat-work-ui` and `c8-work-mode` P9 are Green. Historical Not Green attempts remain in their closeouts. Starting current HEAD must be inspected: approved docs may exist on main before the prompt runner executes. The existing root package is `0.8.20`; prompt P1 must target `0.8.21`.

Read BOOT.md, AGENTS.md, ADR 0031, Phase 8D plan and narrow source/tests. No product code is yet implemented by writing this stack.

## Critical preservation

No WorkItem required for direct Work/Prompt Stacks; no provider-direct authoritative write, hidden grant expansion, auto WorkItem completion, Chat/Work toggle, DevelopmentSession, 8E local adapter requirement or Phase 10 background alignment. Provider-sandbox/CandidateValidation/Authority and Dope checkpoint boundaries remain.

## Execution and closeout

Validate before running: `npm run codex:phase:validate -- p8d`

Run implementation prompts with existing repository runner: `npm run codex:phase -- p8d`. The final P10 is a browser/manual T3 handoff, not an automatic Green claim. P1–P9 use bounded T1/T2; P10 executes the final one-time full check and real GUI/reference Codex qualification, records `closeout.md` and preserves any Not Green evidence.

The stack closes **8D only**, not 8E or full Product Phase 8.
