# P1 Roadmap source safety — PARTIAL / NOT GREEN

**Source:** `main` HEAD `be6befe5d5c82ebe0e12dbc0697d867842db8444` at start and end; product version `0.12.7`. The working tree was clean at start. This result leaves test and evidence changes uncommitted for the phase runner. No product code, provider setting, version, or owner project was changed.

## Failed case and correction

The previous `source change before a second worker tool rejects the stale callback` test called `saveGateIndex` on a revision-zero owner with `projectId: 'uninitialized'`. `RoadmapStore.saveGateIndex` explicitly rejects that candidate with `Invalid Roadmap owner or revision` before any source change or second tool callback. The old result was a fixture setup error, not evidence that the product accepted or rejected drift.

The revised fixture creates a schema-2 owner, publishes its current Roadmap into a disposable `ROADMAP.md`, and uses the reviewed existing-link API to bind the exact file hash. The worker test pauses the second provider response after the first checked stage, changes actual linked Markdown bytes, then checks that the second tool cannot complete and no proposal, canonical mutation, or Markdown sync occurs. A separate test advances a valid canonical revision at the same barrier. The positive worker case checks the revision-zero `null` basis, pre-Apply no-write state, a rejected forged approval token, and selected Apply only after review. Another test changes linked bytes after a complete proposal and requires selected review to fail. Existing StageOwner and controller tests cover wrong identity, duplicate/skipped stage, cancellation, and model/source freshness guards.

The fixture now tracks its worker turn and awaits its settlement, closes server connections, explicitly releases the Chat lease before disposing the backend, and removes only its own `mkdtemp` root. The former teardown called `dispose()` immediately before `rm(root)`; `dispose()` starts an unawaited repository release, so that ordering could race filesystem removal. This is a plausible ENOTEMPTY cause, not a verified attribution. No sleeps or directory sweeps were added.

## Verification on this exact working tree

- `npm run typecheck`: PASS for all workspaces and Theia extension.
- Direct `roadmap-native-stage.test.ts`: 10/10 PASS, including a new changed-hash-between-stages negative and review rejection with exact canonical bytes unchanged.
- Direct `roadmap-generation-controller.test.ts`: 7/7 PASS.
- Direct `roadmap-publication.test.ts`: 31/31 PASS.
- Direct `roadmap-generation-native-stage.test.ts`: 3/3 PASS.
- Direct `roadmap-document-sync.test.ts`: 3/3 PASS.
- Direct `roadmap-sync-recovery.test.ts`: 3/3 PASS.
- Direct `roadmap-linked-store.test.ts`: 2/2 PASS.
- Direct `pi-conversation-runtime.test.ts`: 9/9 PASS; `pi-model-bridge.test.ts`: 12/12 PASS; `roadmap-generation-command.test.ts`: 8/8 PASS.
- Isolated linked-worker-basis test: 1/1 PASS, including reviewed fingerprint and valid canonical revision advance.
- Full `roadmap-generation-worker-integration.test.ts`: **1 PASS / 5 blocked before fixture setup**. Every socket-backed case fails at `listen EPERM: operation not permitted 127.0.0.1` in this execution sandbox. The mandatory real Chat → Pi worker source-drift negative, positive selected Apply, and revised cleanup therefore remain unverified here. No ENOTEMPTY occurred because the server never started.
- `git diff --check`: PASS. Root `tsc -p . --noEmit` is not a project gate and emits broad pre-existing test/fixture typing failures, including missing declarations for compiled `lib` imports; workspace `npm run typecheck` is the supported passing gate.

**Disposition:** PARTIAL / NOT GREEN. The direct owner gate passed with a real linked-source hash change, and the original setup error is attributed. The mandatory socket-backed worker gate and teardown result still need a permitted isolated run on these exact bytes. P2 must not treat this as a GREEN source receipt or proceed over an unsafe source gate.
