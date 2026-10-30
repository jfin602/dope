**CURRENT OWNER RUN AUTHORIZATION (2026-10-29):** The owner [approved the `p12` runner](../../planning/p12/owner-entry-authorization-2026-10-29.md) for P1–P7 on the committed `0.12.0` baseline and narrowed Phase 11 owner closeout. Standalone Pi autonomous coding remains NOT GREEN, but is not a P1 entry blocker. No further owner approval or `/activate` is required. P8 is manual; all security and B1–B9 closeout checks remain. Earlier conditional authoring notes are historical.

**CURRENT ENTRY UPDATE (2026-10-29):** [Final Phase 11 stabilization](../../planning/p11/final-stabilization-scope-amendment-2026-10-29.md) may replace the old P17 prerequisite only after a passing exact-source Roadmap closeout and clean committed `0.12.0` baseline. Independently reviewed standalone Pi/Qwen evidence and a separate owner Run are still required. M2/M3 follow-up is not automatically part of these immutable P1–P8 prompts.

# p12 — Pi Agent Integration (first Phase 12 stack)

**2026-10-29 OWNER PHASE 11 HANDOFF UPDATE (DOCS ONLY):** Require [narrowed Roadmap-only Phase 11 qualified and explicitly owner-closed](../../planning/p11/roadmap-only-exit-amendment-2026-10-29.md) before P12, plus original separate Pi standalone report, 0.12.0 baseline and P12 execution approval. Old incomplete broad P11 Work/Bridge/Hunts are deferred known issues, not automatic P12 entry blockers or retroactive Green. Immutable `p12` P1–P8 files unchanged. Gate→WorkItem→prompt-stack→Pi integration to be assessed **after** Pi is running; do not assume bundled Pi already exists. No activation/version change by this note.

**Descriptive name:** `p12-pi-agent`. **Executable folder:** `docs/tasks/p12` because the current phase-runner grammar rejects `p12-pi-agent`. **Status:** Eight prompts authored as forward planning only on 2026-10-29; NOT RUN / NOT IMPLEMENTED / NOT QUALIFIED. Phase 11 OPEN; Phase 12 inactive; `0.12.0` only a proposed future baseline, not established. See [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [phase contract](../../planning/p12/phase-12-plan.md), [B1–B9](../../planning/p12/pi-qualification-contract.md), [ADR 0039](../../decisions/0039-bundled-pi-local-agent-runtime.md).

| File | Role | Browser |
| --- | --- | --- |
| [P1](P1-bundle-runtime.txt) | Pi dependency/runtime and initial packaging | no |
| [P2](P2-model-bridge.txt) | AI Center exact local model selection | no |
| [P3](P3-local-chat-planning.txt) | Default no-tool Chat/Planning | no |
| [P4](P4-work-tools.txt) | Work-only grant-brokered tool execution | no |
| [P5](P5-work-history.txt) | Transcript, review and History integration | no |
| [P6](P6-context-recovery.txt) | Compaction, sessions and crash recovery | no |
| [P7](P7-package-onboarding.txt) | AppImage zero-setup qualification | no |
| [P8](P8-phase-closeout.txt) | Manual real Chrome and owner-native closeout | yes |

**Execution:** Sync `main`; inspect local branch/HEAD/dirty state and baseline; run `npm run codex:phase:validate -- p12`, then `npm run codex:phase -- p12`. The owner authorization is recorded; P1 does not require standalone Pi GREEN or a second Run decision. P1 still verifies dependency/license and real security blockers. P8 is a separately operated Chrome/owner-native manual prompt, not a headless runner pass. No full Pi GREEN until B1–B9 and owner acceptance.

**Safety:** No global Pi install, no user `~/.pi` modifications, no silent hosted egress, no Pi direct shell/FS outside Dope grants, no second Chat/Work owner, no automatic candidate promotion, no bundled model weights. Preserve existing Codex/manual provider choices. Tower-defense testing is a later independent manual workstream.
**UPDATED ENTRY DISPOSITION (2026-10-29):** The explicit [owner run authorization](../../planning/p12/owner-entry-authorization-2026-10-29.md) supersedes the prior entry-only standalone qualification requirement. P1–P7 are authorized and remain unstarted until invoked. P8 stays manual; Pi integration is not yet qualified.
