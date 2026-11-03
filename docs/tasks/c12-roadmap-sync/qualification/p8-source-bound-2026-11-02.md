# P8 reviewed restore — source-bound implementation result

Date: 2026-11-02 America/Chicago. Pre-task local HEAD: `b95ec8fd4dc31eb2160a37f9c14c344741a15fec`. The tree was clean at entry. Product version remains `0.12.7`. All P8 changes are uncommitted for the phase runner; no Git HEAD operation, model/provider setting, Work grant, owner project, or earlier qualification report was changed.

## Implemented

- The existing RoadmapStore and revision archive now issue a five-minute, one-use reviewed restore preview bound to canonical head hash, archived target hash, project/root, exact resulting editable structure, and checked linked Markdown before/after bytes and hashes. The compare lists exact changed Phase, Gate, Criterion and Correction fields. The P7 strip requires a fresh comparison and an explicit reviewed checkbox before Confirm Restore.
- Confirmation rechecks the same boundaries under the Roadmap owner lock. It creates one monotonic revision and an archive receipt with `restoredFromRevision` and `previousHeadRevision`; retry after response loss or restart reads that receipt and cannot create a second head. Cancel, same-structure, stale, expired and invalid reviews do not write.
- Restore carries only definitions from the historical revision. Current evidence and source proofs stay current; changed evidence is stale, Gate and Phase qualification is stale or unknown, and affected Gate-set coverage is unreviewed. Protected evidence removal and affected waivers block. Historical snapshots remain read-only and intact.
- Linked restore uses the P5 checked structural sync owner. The preview shows exact source bytes and resulting bytes, preserving unrelated prose and verifying parser identity. The durable sync journal reports verified `synced` or a truthful conflict/failure after canonical publication. Project History projects one read-only receipt from the verified archive record.

## Verification

- `roadmap-restore.test.ts`: **8/8 PASS** on disposable roots. R9→R5→R10 retains R5–R9, Undo next targets R9 and one History receipt; linked single-field and multi-field structural restore reparse after restart with unrelated prose; external edit, symlink, tampered/expired approval and backup collision fail closed or report truthful conflict; historical Green evidence remains stale after restore.
- Adjacent `roadmap-publication.test.ts`: **31/31 PASS**, including checked sync restart, collisions, interrupted source writes and conflicts. `roadmap-revision-archive.test.ts`: **3/3 PASS**. `history-owner-metadata.test.ts`: **5/5 PASS**.
- `npm run typecheck`, `npm run build:browser`, `npm run build:electron`, and `git diff --check`: **PASS**. These are build and disposable filesystem checks, not connected browser or native GUI observations.

**P8 scoped source-bound GREEN for the reviewed restore implementation.** P6 and P7 recovery reports remain **NOT GREEN** and are not relabeled here. P9 integration and P10 connected Chrome qualification remain separate; no claim is made for their browser, accessibility, or owner-native GUI matrices.
