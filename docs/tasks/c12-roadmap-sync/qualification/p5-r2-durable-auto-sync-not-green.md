# P5-R2 durable automatic synchronization — NOT GREEN

Date: 2026-11-02 America/Chicago. Local HEAD `a7694f5afc414435dd9306ca8f9c7caeb9a50bbd`, product `0.12.7`. P5-R1's uncommitted serializer repair and report were preserved. No runner invocation, PASS marker, checkpoint commit, P6 work, version change, reset, stash or clean occurred.

## Implemented in the current uncommitted tree

- A linked schema-2 canonical edit records a revision-bound synchronization intent in the same Roadmap index commit. The intent binds project, path, expected source fingerprint and a digest of the committed index excluding its self-reference. `RoadmapStore` starts nonblocking processing after commit and can recover an intent after restart even if the side journal was never written.
- A project-local side journal records pending/syncing/synced/conflict/failed outcomes and the exact planned bytes before the source write. Reads project the matching journal outcome without creating a second canonical Roadmap store or an extra history revision. The writer coalesces queued canonical revisions to the current head.
- The checked writer reuses the linked source adapter and source-aware backup/atomic publication path, requires the expected source hash, retains unrelated prose, reparses identities, fields and structure, and marks synced only after verification. It recovers a source left at either the accepted or target hash after interruption. Linked source-owned structural edits now enter the canonical owner and request sync; rejected and no-op mutations still do not commit.
- The service exposes explicit retry and the canvas shows saved-revision versus Markdown status. P5-R1 first publication and compatible existing-file linking remain intact.

## Verification on this exact tree

- `npm run typecheck`: PASS.
- `npm run build:browser`: PASS.
- `npm run build:electron`: PASS (build only, no native GUI claim).
- Eight focused publication/store/document/revision/native-stage/Chat-panel/projection/action files: **60/60 PASS**. Disposable fixtures exercised initial creation, compatible link, Correction round trip, automatic field and Correction write, reorder, mapped deletion, unrelated prose retention, external edit conflict, queued revision coalescing, restart with no side journal, source written before acknowledgment, duplicate retry, missing file and symlink replacement.
- Adding `roadmap-chat-publication.test.ts` to that set: **59/60 PASS, 1 FAIL**. The failing protected Chat publish/link test stopped at `ChatBackend.runTurn` with `Protected native Roadmap tools are unavailable; no proposal was staged`. Its baseline status has not been independently established; it remains a regression gate failure for this source.
- `git diff --check`: PASS.

Changed files and SHA-256 (P5-R1 files are included in this uncommitted state):

| File | SHA-256 |
| --- | --- |
| `packages/project-intelligence/src/node/roadmap-auto-sync.ts` | `53f69e79186d8fc17fc7a0365d5e388100f2419c5d531f350fc6f2f009323b76` |
| `packages/project-intelligence/src/node/roadmap-gate-domain.ts` | `dbfa9da9279357e4b41c468eede968e87046cf10de59d78716f5f7b58a9478dd` |
| `packages/project-intelligence/src/node/roadmap-gate-document.ts` | `a6019b5632d449a8a5466095b677be1da5105e055b57a9a110a01d47f156f7bd` |
| `packages/project-intelligence/src/node/roadmap-import.ts` | `de0e9fc5843a77698702786281d7f11ccff9bcbc8f70a4e9848a25fc4292e4e5` |
| `packages/project-intelligence/src/node/roadmap-publication.ts` | `0e45bf56c65f888d81da133ef8372845475fa07868bd269359b8d2919e5d8e10` |
| `packages/project-intelligence/src/node/roadmap-store.ts` | `614de92d2c344e39ab29c88cb93d3fada64213359427e8dbdd219b11b521e944` |
| `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` | `6f72eafdc1f5929b4697e1e45e357391ee3e3f711ddbdb12cc5ef69dc5485108` |
| `packages/theia-extension/src/node/backend-module.ts` | `c0a59b14d09cb1a081ede98476830f828e3fc45ee2021205e685895fa4dcf8e1` |
| `packages/theia-extension/src/roadmap-service.ts` | `766ba34c59a51a40a56412e9096675624a769c7fad8d06e2152f205b2a171b04` |
| `test/unit/roadmap-publication.test.ts` | `918c8fe9adff437b386fb0e2ff209cd423a854a3a408a75c71a9e63cf916bae7` |
| `test/unit/roadmap-gate-store.test.ts` | `cde98f19aa7aa8fd1b19a440d0ca6608e906f9a05ff89b5956088cf20cce015b` |

## Remaining mandatory blockers

P5 is **NOT GREEN**. A conflicting external edit currently stops safely, but there is no reviewed, supported reconciliation that accepts a compatible external prose change while retaining the pending canonical edit; retry succeeds only after restoring the exact accepted source or verified target bytes. The partial backup/collision and permission-failure paths have not been fault-injected and qualified. Selected AI proposal approval against a linked Roadmap, status display after a real UI reload, and the complete P1–P4 regression set have not been qualified; the protected Chat publication regression above fails. The source-aware prose merge has fixture coverage for retention but not every supported external Markdown layout. No broad full check or browser/native interactive qualification was run.

The runner's documented interactive dirty-tree continuation can adopt work at a pending implementation prompt after the owner chooses Continue, with normal validation and runner-owned checkpoint. No incompatibility was found in that procedure, but it must not be invoked for a fabricated P5 PASS while the above blockers remain. Preserve this tree and continue P5 recovery; do not advance to P6.
