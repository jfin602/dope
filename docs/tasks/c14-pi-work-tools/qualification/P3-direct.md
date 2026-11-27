# C14 P3 — Direct whole file effects

Date: 2026-11-27. **P3 PASS for the headless Direct operation layer.** Pre-task and implementation HEAD: `0d8747bcf07f3aef40e233266db958685d376635`. Initial `git status --short` was empty; the changes listed below remain uncommitted for the phase runner. Root and Pi runtime package versions remain `0.14.0`; the Pi SDK pin remains `@earendil-works/pi-coding-agent` `1.4.0`. P1 audit and P2 Isolated reports were source-bound PASS before this implementation. No provider, model Work run, browser, version, dependency, Git HEAD or Roadmap Gate change occurred.

## Implemented source

- `packages/agent-core/src/node/direct-work-journal.ts`: one Direct write/create/overwrite and unique exact edit operation checks its bound grant, selected `edit_file`, effect ceiling, source HEAD and dirty basis, delegated paths, ignore/protected paths, unsaved buffer, prior bytes/hash and file identity. Exact edit preserves UTF-8 BOM and CRLF and rejects absent, duplicate, overlapping or stale matches. The persisted prepared receipt now names the target, previous and intended bytes, each existing or intended parent identity, and the temporary file **before** the Python writer can mutate the canonical project. Descriptor-relative no-follow traversal creates missing parents, checks their identities and the leaf again, uses exclusive create or verified exchange, and reports completed, verified no-effect, or uncertain outcome. A cancelled/killed child leaves a prepared receipt; restart reconciliation checks the parent chain, temp, previous identity/hash and target without replaying a write. An uncertain receipt blocks retry and revert.
- `packages/theia-extension/src/node/local-agent-turn-loop.ts`: the existing Direct `edit_file` path passes cancellation to the journal and mirrors the recorded canonical after-state to the disposable candidate with P2's whole operation, including nested parents. The new internal `executeFileOperation` broker seam provides whole write and exact edit for P4. It checks request/grant/project/task/run/model selection and scope before the journal; the candidate mirror requires the canonical before hash, so divergent candidate content is not silently overwritten. A canonical effect followed by mirror failure is returned as applied-but-unavailable for source review. Real owner/source conflicts return `DIRECT_EDIT_SOURCE_CONFLICT`, distinct from authority denial.
- `packages/agent-core/src/node/isolated-file-operations.ts`: optional expected source hash for the internal Direct candidate mirror. Ordinary Isolated calls retain their existing behavior and candidate review authority.
- `test/unit/direct-work-journal.test.ts` and `test/unit/direct-work-runtime.test.ts`: disposable Git fixture coverage and conservative legacy restart expectations. Older prepared receipts without a recorded before identity are uncertain rather than guessed to be not applied.

## Source-bound checks

| Check | Result |
| --- | --- |
| Nested create, second write to agent-created file, unique exact edit, BOM/CRLF and candidate mirror | PASS; canonical and isolated model view matched; no raw Pi or isolated writable mount pointed at canonical project |
| Exact selected tool, forged selection, grant/effect and delegated scope; ignored/protected/symlink/hardlink paths | PASS; denied before canonical mutation |
| Saved and unsaved simulated tabs, owner dirty/untracked bytes, concurrent same-byte identity swap and owner replacement while staged | PASS; saved tab allowed, real conflicts preserved owner bytes and were classified as conflicts |
| Rapid same-file calls | PASS; overlapping call rejected, sequential calls journaled separately |
| Mid-parent cancellation, mid-file staged fault, post-file fault and restart | PASS; verified rollback classified no-effect, committed-but-unacknowledged effect classified uncertain, partial parent classified uncertain; retries blocked on uncertain journal |
| Selective and mixed safe/unsafe revert | PASS; only verified after identity/hash reverted; owner-used and pre-existing directories retained; empty attributable directories removed |
| Direct validation/review and historical restart path | PASS in focused runtime suite; older prepared entries with no before identity conservatively remain uncertain |

Commands on the final P3 working tree:

- `corepack yarn workspace @dope/agent-core build` — PASS.
- `corepack yarn workspace @dope/theia-extension build` — PASS.
- `node test/unit/direct-work-journal.test.ts` — PASS, 28/28.
- `node test/unit/direct-work-runtime.test.ts` — PASS, 6/6.
- `node test/unit/isolated-file-operations.test.ts` — PASS, 4/4.
- `node test/unit/pi-work-execution.test.ts` — PASS, 10/10.
- `git diff --check` — PASS.

P4 must bind Pi-maintained tool definitions to the internal whole-operation seam and test actual Pi schema/result behavior. P5 must migrate new-run selections; these operations have not been model-facing registered by P3. A real open editor tab and model/browser qualification remain P8. The deliberate fault fixtures may leave **disposable** journals in `uncertain` state; production retry/revert fails closed for those receipts, and no such state was created in the owner project.
