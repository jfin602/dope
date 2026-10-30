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

**Before starting:** Obtain the completed standalone Pi qualification report, confirm accepted Pi release/license, independently close/disposition Phase 11 (G3's Chrome P1–P4 AND owner native plus broader Phase 11 gates), establish coherent `0.12.0` baseline and explicitly authorize stack execution. Validate grammar via `npm run codex:phase:validate -- p12` after checkout. No separate `/activate` gate. Authoring is not Run. P8 manual GUI must be run individually, not accepted from headless runner or simulated tool calls. No phase-wide Green until owner acceptance.

**Safety:** No global Pi install, no user `~/.pi` modifications, no silent hosted egress, no Pi direct shell/FS outside Dope grants, no second Chat/Work owner, no automatic candidate promotion, no bundled model weights. Preserve existing Codex/manual provider choices. Tower-defense testing is a later independent manual workstream.
**CURRENT ENTRY STATUS (2026-10-29):** [Phase 11 narrowed-scope owner close](../../planning/p11/phase-11-final-closeout-2026-10-29.md) is recorded with its evidence limits. The separate `0.12.0` version baseline follows. Pi P1–P8 remain unstarted and immutable; standalone Pi/Qwen evidence, independent preflight and a deliberate owner Run are still required.
