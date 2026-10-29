# c11-g3-recovery — Chrome-qualified loops, owner-native final gate

**Status:** Four prompts authored and revised by explicit owner instruction before execution. **No implementation, Chrome test, or native test has been run by this documentation update.** Version `0.11.8` unchanged. GitHub `main` only; no new branch. The source assessment used `c8c8bfe` (existing ChatRoadmapAction); the recovery docs and prompts were initially committed at `97321da`. These edits adjust how the prompts are executed, not their implementation scope.

[Assessment](prompt-assessment.md) · [Plan](implementation-plan.md) · [G3 contract](../../planning/p11/greenfield-experience-contract.md) · [R1–R7](../../planning/p11/panel-usability-matrix.md) · [UX-020](../../planning/p11/usability-issue-ledger.md).

## One prompt at a time — each must operate Google Chrome

| Prompt | Work | Mandatory Codex-controlled Chrome gate |
| --- | --- | --- |
| [P1](P1-intent-response-extraction.txt) | Natural Roadmap intent, zero-second-call extraction, fidelity, safe offer | Reproduce actual user request/response in saved Chat; inspect resulting trusted proposal/decision, parser-only zero model calls and Follow Interactive behavior |
| [P2](P2-message-action-history.txt) | Reuse persisted `ChatRoadmapAction`; message card, history and clean composer | Check real message-attached card, composer, new turn, reload and terminal status with browser UI |
| [P3](P3-canvas-review-recovery.txt) | Numbered proposal, editor-only Accept/Reject, errors and no canonical write | See actual Phase N proposed graph in main Roadmap, reject/accept on safe separate fixtures, and verify terminal failures |
| [P4](P4-native-chrome-closeout.txt) | Independent end-to-end R1–R6 + R7 Chrome-source provenance closeout | Run full exact conversation and both safe review outcomes in Chrome; record **CHROME PASS/FAIL** and prepare owner's native checklist |

**Browser required: yes for P1, P2, P3 and P4.** Each loop's real Chrome gate must PASS before you manually launch the next prompt. Tests, mocks, successful browser builds or log-only checks do not replace operating the actual app through the Codex browser. If Chrome is unavailable or the loop fails, STOP and report NOT GREEN/BLOCKED; do not automatically proceed. The standard `npm run codex:phase -- c11-g3-recovery` is **not appropriate for this user-supervised sequence**; it will stop at browser-required prompts rather than run the GUI gates. Instead open each prompt individually in Codex with its browser enabled. Validate grammar locally first with `npm run codex:phase:validate -- c11-g3-recovery`. The authoring connection cannot run this local validator.

## Owner-operated native qualification AFTER all Chrome loops pass

Codex **cannot control the native Electron UI on the owner's machine**. No P1–P4 prompt may require, simulate, or claim Codex-native GUI operation. P4 must deliver a reproducible owner-native checklist and the exact tested Chrome source/build details. The **owner** will then rebuild/launch and manually test Electron, return the observations/screenshots/logs, and independently decide native PASS/FAIL. Do not call G3-wide GREEN or R7 parity PASS until owner native evidence exists and is reviewed. A Chrome-accepted P4 state must say **"G3 CHROME RECOVERY QUALIFIED — NATIVE OWNER VERIFICATION PENDING"**. Phase 11 remains OPEN/NOT QUALIFIED regardless of scoped G3 progress.

Preserve older `c11-greenfield-g3` and `c11-greenfield-patch` prompts and evidence, existing source/owner changes and the persistent tower-defense project; use disposable roots for destructive/rejection/security tests. No model-dependent generation on parser-only path, no speculative Roadmap week estimates, no unauthorized canonical Markdown or Work. No `/activate` required, no self-commit, no version bump.
