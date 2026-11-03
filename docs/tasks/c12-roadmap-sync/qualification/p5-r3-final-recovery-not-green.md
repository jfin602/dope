# P5-R3 final recovery — NOT GREEN

Date: 2026-11-02 America/Chicago. Basis: pushed local `main` / `origin/main` HEAD `5ffec01a7d8c246e3488b03640fad140f9469026` (`p5-r2`), version `0.12.7` unchanged. This report and the source below are uncommitted. No runner invocation, P5 marker/checkpoint, P6 work, reset, stash, clean, history rewrite, or version change occurred. Earlier P5-R1/R2 reports remain intact.

## Repair and observed behavior

- Protected `/roadmap publish` and `/roadmap link` now take their deterministic review route without requiring native staged-mutation tools. The bounded command parser, protected skill digest, selected local model, project and source checks, lease, one-use approval, and stale/rejected no-write behavior remain exercised. Actual native Roadmap mutation turns still require the brokered tools.
- A pending canonical revision can reconcile an independently edited Markdown file only through a newly issued review. The preview checks the exact external SHA-256, last verified mapped fields and stored Phase/Gate/Criterion/Correction structure, generates the proposed Markdown bytes, and binds approval to the exact project, revision, source and result. Compatible prose survives; changed mapped fields, metadata, structure, missing source, and stale preview stop without a file write. The Roadmap canvas exposes the review and exact before/after text. Existing bases without a stored structural snapshot remain conservative conflicts.
- The writer records the approved external source hash in its durable journal and rechecks it at publication. Verified already-synced retries no longer transiently display syncing. Background and explicit recovery share one in-flight operation across store instances. Evidence-only canonical revisions no longer queue an unchanged Markdown projection.
- A selected native Chat proposal against an actually linked Roadmap applied one Gate and synchronized the file. The remaining Gate was rejected without a write. A later selected review became stale after an independent canonical edit and wrote no unauthorized bytes. Saved Chat reloaded with the applied activity; a new RoadmapStore read showed synced status. A connected browser UI reload was not observed.

## Exact final-source verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build:browser` | PASS |
| `npm run build:electron` | PASS build; native GUI not observed |
| 18-file P1–P5/protected-tool serial regression set | 101/101 PASS on last run. Two earlier serial attempts each had one intermittent `ENOTEMPTY` during disposable Chat fixture teardown (100/101). |
| `npm run test:product` | **715/721 PASS, 6 FAIL** on the final tree. One Work direct-task expectation, three source-text Roadmap UI assertions, and two disposable Chat cleanup `ENOTEMPTY` errors. Earlier full runs were 714/720 and 710/719 with 6 and 9 failures respectively. |
| `npm run codex:phase:validate -- c12-roadmap-sync` | VALID, required version `0.12.7`, P10 manual |
| `git diff --check` | PASS |

Disposable failure cases: backup-path collision left source bytes unchanged and status conflict; permission denial left the canonical edit and original Markdown intact with failed status, then retry synced; an injected partial temporary write failed closed, preserved the original file, and a new store retried exact target bytes; partial external source, missing source and replacement symlink stopped without overwrite; interrupted post-write acknowledgment and journal-less restart replayed idempotently. No unrelated fixture file changed. Compatible external prose review succeeded; stale approval and changed dependencies/structure were rejected. These are filesystem and backend tests, not a real interactive browser or native GUI observation.

## Changed file SHA-256

| File | SHA-256 |
| --- | --- |
| `packages/project-intelligence/src/node/roadmap-auto-sync.ts` | `9b71113733f24fecd0ab6f90eb21c4270648566864fa6effb1cac3c19e3a204c` |
| `packages/project-intelligence/src/node/roadmap-gate-document.ts` | `48dd81fb517f330924983a7499ac430721b09152addf64747cacd4ea3eabf885` |
| `packages/project-intelligence/src/node/roadmap-gate-domain.ts` | `1a9dfca0c4bdf0da1eea2aadb4da0de45580a163456b612f9f591ed4447dbfb4` |
| `packages/project-intelligence/src/node/roadmap-store.ts` | `b2103bf6597537c2076ffb945a72263073ede8aa36ff61d29f8b13191842f615` |
| `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` | `1ba466343f2cd02af1b34f8d6bebabcdf12a803c4656ebbb98687d912e643869` |
| `packages/theia-extension/src/node/backend-module.ts` | `2a6efdef9068067b35d5dfc244185f04ddc68ff92e1ea2a6ac244df0c7efe12e` |
| `packages/theia-extension/src/node/chat-backend.ts` | `7e87f73bc8a13c20fa3c8b55141fdc1c6eb6f372fac3e161bf777a7df201c09a` |
| `packages/theia-extension/src/node/roadmap-native-stage.ts` | `6d8335a51664099bfdf4e1f04877ca545b39dae16f82f1c2863ae0180618aa92` |
| `packages/theia-extension/src/roadmap-service.ts` | `9ef018f26c255f2910cc6c4bb11fa377aefd7e71186726c8df9830158c7c949e` |
| `test/unit/roadmap-gate-chat.test.ts` | `b105631db36ff296219e5860cdd244593809b96bfd7b1d63410155541a72fd79` |
| `test/unit/roadmap-publication.test.ts` | `6a3150be6d7c97d0d50a1e5a0e57c15897bd68a2d7f7df0fecfb811c13f5a3c5` |
| `test/unit/roadmap-chat-publication.test.ts` | `44b1db003ea553751575fd3f8f16cbb94694593d283a07c49d716dcf2e4283d9` |

## Runner continuation and disposition

The recorded run at `.codex-runs/c12-roadmap-sync/2026-11-03T01-34-54-380Z/run.json` has P1–P4 checkpoints and P5 failed at its commit boundary; P6 waits. Commit `5ffec01a` is reachable and preserves P1–P4, but its subject `p5-r2` is **not** the exact P5 checkpoint subject, so the runner still selects P5. The documented interactive dirty-tree continuation would ask whether to include this work in P5. Once P5 succeeds, that runner immediately advances to P6; it has no documented P5-only stop flag. Under the owner's P5-only scope, do not invoke it or fabricate a marker. When continuation through P6 is separately authorized, recheck HEAD/status/version, run `npm run codex:phase:validate -- c12-roadmap-sync`, run `npm run codex:phase -- c12-roadmap-sync` interactively, inspect the dirty-tree prompt, and choose Continue only if this exact P5 tree is intended; let the runner validate and own its checkpoint. Do not use `--closeout`.

**P5 NOT GREEN.** The focused automatic-sync and recovery cases pass, but the broad product regression run still has six failures, real UI reload/status behavior is not observed, and the documented runner cannot checkpoint P5 while respecting the explicit stop-before-P6 scope. The smallest P5-specific execution blocker is a bounded, documented way to stop the runner after P5 without starting P6. Preserve this tree and the failed-test evidence for the next targeted repair/qualification decision.
