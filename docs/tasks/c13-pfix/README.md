# c13-pfix — Owner-named Prompt Stack Draft

**STATUS: OWNER-APPROVED DOCUMENTATION / AUTHORED ONLY.** Date: 2026-11-08. Source basis: `main` at `7e5e3745`. Version `0.13.11` unchanged. Not executed, built, tested or qualified by this proposal. Implementation requires a separate explicit owner Run.

**Purpose:** Replace independent, Markdown-heavy `/prompt-ass`, `/prompt-plan`, `/prompt-write <folder>` output with a single short, immutable, owner-named draft `/prompt-ass <name> <task details>`, context-bound composer chips and one evolving Chat proposal card. Stages are durable, structured, noncanonical; final exact prompt files publish only on owner Accept through the existing R3B guarded publisher.

**Authority:** [ADR 0056](../../decisions/0056-named-prompt-authoring-chain.md), [chain contract](../../planning/p13/named-prompt-authoring-chain-contract.md), [current native authoring](../../planning/p13/native-prompt-stack-authoring-contract.md), [incremental controller](../../planning/p13/incremental-proposal-generation-contract.md), and [docs/workflow.md](../../workflow.md). ADR/contract guide future implementation; they do not claim new shipped behavior.

**Ordered correction steps:**
| Prompt | Tier | Browser | Responsibility |
| --- | --- | --- | --- |
| P1 | T1 | No | Mandatory named command, draft ID and state contract |
| P2 | T1 | No | Durable protected draft records and safe task-directory isolation |
| P3 | T1 | No | Structured source-backed assessment staging |
| P4 | T1 | No | Structured plan staging and efficiency/coverage validation |
| P5 | T1 | No | Single card, typed chips and composer handoff UI |
| P6 | T1 | No | Incremental prompt-write and existing guarded publisher integration |
| P7 | T2 | No | Cross-skill authority, revision, crash/restart and safety qualification |
| P8 | T3 | YES, manual only | Real selected GPT-OSS 20B connected Codex browser qualification |

**Future execution route, only after owner review and explicit authorization:** `npm run codex:phase:validate -- c13-pfix`, then `npm run codex:phase -- c13-pfix` for **P1–P7 only**. Runner stops before manual P8. Never invoke `--closeout` as a shortcut. Runner owns Git checkpoint commits; individual implementation prompts do not self-commit.

**Preservation:** P6 and R2 incremental generation remain NOT GREEN; R1 and owner-reported IG-R3 scoped headless pass are not live browser proof; R3B historical PARTIAL remains truthful. Hold IG-R4 and Phase 13 R3/R2/R4 for owner reconciliation and new independent qualification. No product code, prompt publication, Work Run, grant, Gate/Phase advancement, version change, or automatic migration from this documentation proposal.
