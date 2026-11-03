# P5-R1 Markdown serializer recovery — NOT GREEN

Date: 2026-11-02. Local base HEAD: `a7694f5afc414435dd9306ca8f9c7caeb9a50bbd` (`main`), product version `0.12.7`. This is an uncommitted targeted repair. The original `.codex-runs/c12-roadmap-sync/2026-11-03T01-34-54-380Z/P5.events.jsonl` and `P5.final.txt` remain unchanged; no P5 runner PASS marker or checkpoint was created. P1–P4 checkpoint commits remain untouched.

## Exact blocker and bounded repair

The full P5 event stream shows the runner stopped before implementation. Its diagnosis was accurate: `serializeRoadmapPublication` rejected every Roadmap with Corrections, and linked definitions in `RoadmapStore.mutateGateIndex` are source owned. The latter is an actual unsupported mutation path, not a failing fixture. The existing Gate document patcher handles individual Phase/Gate/Criterion text edits after separate approval; it cannot safely serialize Correction edits, structural additions, removals, reorder, reparenting or an automatic queue.

This repair extends only the first publication and compatible existing-file link component. The schema-2 serializer now emits accepted Corrections with stable IDs, parent and optional Criterion references, separate objective and order. The importer reads those fields; the serializer checks a Phase/Gate/Criterion/Correction round trip before a write. Linked-source structure checks compare Correction parent, Criterion and order, so a same-text document with a different owner cannot link. Both first publication and existing-file link mark Corrections published and notify their IDs. Existing-file linking preserves unrelated prose and does not rewrite the file.

The initial destination confirmation, exclusive create, symlink/path checks, pending first-publication recovery and source-hash checks remain owned by the pre-existing publication path. This repair does not relax linked mutation restrictions or create another writer.

## Verification

- `corepack yarn workspace @dope/project-intelligence build`: PASS.
- Five focused source-owner/publication/revision test files: 39/39 PASS. Disposable project fixtures cover Correction publication, round-trip mapped fields, existing-file prose preservation and wrong Correction owner rejection, alongside existing collision, symlink, interruption and no-overwrite cases.
- Four P1–P4 native stage, Chat, projection and proposal test files: 14/14 PASS.
- `git diff --check`: PASS. No version, lockfile, prompt, runner log or earlier checkpoint changes.

SHA-256 of changed source/test files:

| File | SHA-256 |
| --- | --- |
| `packages/project-intelligence/src/node/roadmap-import.ts` | `de0e9fc5843a77698702786281d7f11ccff9bcbc8f70a4e9848a25fc4292e4e5` |
| `packages/project-intelligence/src/node/roadmap-publication.ts` | `578a1c4cedac431074bb1d9c335900be93154b67de14143ddf1c7c083ef36ea4` |
| `packages/project-intelligence/src/node/roadmap-gate-document.ts` | `1b8f5780878643a7c0e4236dff8850c07daf3f612dce04b1797734fdc13405e6` |
| `packages/project-intelligence/src/node/roadmap-store.ts` | `fa3dd48d2c42e74b785331aeed578a371ebb826ca48b29683cade516d8f65d4b` |
| `test/unit/roadmap-publication.test.ts` | `09a5adc7b6846661943401186d77111e14a7d30fb348510f2007c1607eba7151` |

## Remaining P5 blocker

P5 is **NOT GREEN**. The linked Markdown path still rejects source-owned structural manual/AI mutations, has no revision-bound durable sync intent at the canonical commit boundary, and has no checked source-aware structural patch writer or asynchronous retry/restart status path. Therefore manual edits and approved AI structural changes do not automatically update linked Markdown. The mandatory external-edit, revision-race, interrupted-write and reload qualification for that new flow has not been run; a project-intelligence build is not the full affected typecheck/browser/Electron build.

Next dependency: add one durable intent and checked structural patch/reparse path in the existing schema-2 RoadmapStore/source owner, preserving current linked document bytes and unrelated prose. Then wire nonblocking processing and truthful status through RoadmapService/UI and qualify all P5 cases on disposable projects. Only after the complete contract passes should the existing runner resume at P5 and own a successful checkpoint; do not advance to P6 from this report.
