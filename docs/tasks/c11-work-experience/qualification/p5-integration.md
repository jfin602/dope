# P5 focused Work integration regression — 2026-10-23

**Scope:** Headless, source-bound P1–P4 cross-seam verification only. This is not P6 live GUI qualification, Bridge Green, or Phase 11 Green.

- Pre-task HEAD: `cced2a018cda5042691f0462c2dddc81605e823f` (`main`); clean at preflight; root version `0.11.8`. P1–P4 checkpoints: `f75353f0`, `52638e9c`, `28a83dd6`, `cced2a01`.
- Final tracked implementation/test diff fingerprint: SHA-256 `bb5e918782edd3995aa65820b10d8849b2536c281c719f48059fe3059b2f035e` from `git diff --binary -- packages/theia-extension/src/browser/work-selection-controller.ts test/unit/work-integration.test.ts test/unit/work-transcript-presentation.test.ts | sha256sum`. This report is a new untracked evidence file and is excluded from that fingerprint. No commit was made.
- Fix: the Work summary now requires a Dope-owned, required-check result tied to the current candidate fingerprint before it says validation passed. It no longer treats an unrelated failed check as failure of the required check. A saved-stack integration assertion now expects the stable stack title introduced by P1, while the stored prompt order remains unchanged. Added distinct-run transcript tab coverage.

| Gate | Headless evidence | Result |
| --- | --- | --- |
| Truth and authority | `work-selection`, `agent-run-ui`, `phase-stack-ui`, `agent-sequence`, `agent-manual-gate`, `agent-checkpoint`, `workitem-delegation`, `work-presentation`, `work-launcher-composer`; candidate fingerprint regression added in `work-transcript-presentation` | Focused pass; real UI actions remain P6 |
| Transcript, navigation and resilience | `agent-transcript-store`, `agent-runtime-transcript`, `work-transcript-presentation`, `work-integration`, `history-navigation`, `history-work-git`, `chat-presentation` | Focused pass; no live restart or screen-reader operation claimed |
| Planning integration | `workflow-lineage`, `roadmap-status-truth`, `planning-work` | Focused pass; Bridge D5–D8 remain separate |
| Phase Focus evidence fixture | `phase-focus-evidence.test.ts` starts a disposable `git init` fixture | **Not run to completion:** sandbox rejects `spawnSync git` with `EPERM`; no product assertion ran. No Phase Focus qualification claim. |

Commands and results:

1. `npm run typecheck` — pass. `corepack yarn workspace @dope/theia-extension build` — pass on the changed source.
2. `node --test` on the 21 directly relevant files above — 19 files passed, `work-integration` failed on an outdated P1 stack-title expectation, and `phase-focus-evidence` could not start because fixture `git init` received `EPERM`.
3. `node --test` on the same matrix excluding `phase-focus-evidence` after the assertion repair — **20/20 test files passed**. The subsequently expanded distinct-run transcript assertion passed with `node test/unit/work-transcript-presentation.test.ts` (**8/8 tests**).
4. `git diff --check` — pass. No `npm run check` or browser/native GUI qualification was run; P6 owns the final aggregate and live gates.

**Remaining:** Run the Phase Focus evidence fixture only in a context that permits its disposable Git initialization, then perform P6 source-bound live Work qualification. Preserve the original Bridge P15/P5 Not Green, Phase Focus gaps and separate Roadmap/Bridge D5–D8 disposition.
