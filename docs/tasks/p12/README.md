# p12 — Pi Agent Integration (first Phase 12 stack)

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
