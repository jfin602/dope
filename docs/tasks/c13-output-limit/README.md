# c13-output-limit — Phase 13 Chat generation-limit continuation

> **OWNER-APPROVED DESIGN / DOCS + PROMPTS ONLY (2026-11-06):** At unchanged product **0.13.8**, preserve a model's partial output when a provider reports `finishReason=length`; offer a compact Stop/Continue notice above the Chat composer and persist **Ask each time** (default), **Allow each time**, or **Cancel each time**. Continue within the actual retained Pi session with bounded output and no tool replay; incomplete answer remains inspectable, never a canonical completed reply. Target concise ordinary final responses; do not confuse context budget with generation cap or invent an extra model pass. [ADR 0052](../../decisions/0052-chat-generation-limit-continuation.md) and [contract](../../planning/p13/chat-output-limit-continuation-contract.md) are authority.

**Baseline:** FireLaunch comprehension on Dope 0.13.8 / `079f9a8`, local GPT-OSS 20B, output limit 2,048, `finishReason=length`, no saved answer: **NOT GREEN 10/100**. Underlying file-discovery/coverage deficiency is independently open; do not alter 4,096-byte document pages in this correction. FireLaunch is ~2.2 GB: never duplicate, clone, modify project source/docs or execute destructive tasks. Normal Dope-owned `.dope` Chat state should be recorded transparently.

**Documents:** [assessment](prompt-assessment.md), [plan](implementation-plan.md), [manual P10](P10-manual-browser-closeout.txt). Original C12 reasoning P4 and P13 live-gate failures retain their historical status.

## Runner-compatible sequence

| Prompt | Goal | Tier | Browser |
| --- | --- | --- | --- |
| P1 | Typed Chat paused/stopped partial persistence | T1 | No |
| P2 | Pi worker captures length/partial text and tokens | T1 | No |
| P3 | Safe same-session Pi continuation, no replay | T1 | No |
| P4 | Host/adapter pause/resume/stop protocol | T1 | No |
| P5 | Backend owner/lease action, saved state and recovery | T2 | No |
| P6 | Per-Chat Ask/Allow/Cancel policy and automatic ceiling | T1 | No |
| P7 | Accessible composer notice and truthful partial transcript | T1 | No |
| P8 | Concise-answer target and usage diagnostics | T1 | No |
| P9 | Cross-module headless integration regressions | T2 | No |
| P10 | Connected Codex-browser + FireLaunch replay / closeout | T3 | **Yes — MANUAL ONLY** |

Normal runner executes P1–P9 only, then stops. A passing implementation checkpoint is **not** a GREEN qualification.

## How to run later (not part of authoring)

From the owner's applicable local checkout, first verify actual HEAD, clean or explicitly reviewed dirty basis, coherent package 0.13.8, already modified paths and dependencies. Then:
```bash
npm run codex:phase:validate -- c13-output-limit
npm run codex:phase -- c13-output-limit
```
Do **not** pass `--closeout`. Independently operate P10 only when source/model readiness and owner-controlled manual browser testing are available. Do not run the P10 prompt automatically or treat FireLaunch's 10/100 historical result as a new score. No `/activate`, no automatic version advance, no product implementation or browser verification by this docs/prompt authoring.

**Exit:** independent owner-reviewed P10 PASS/FAIL/BLOCKED with exact served SHA, explicit evidence of partial preservation, safe continuation, UI policy and independent FireLaunch score. Any missing mandatory case leaves correction NOT GREEN and Phase 13 unadvanced.
