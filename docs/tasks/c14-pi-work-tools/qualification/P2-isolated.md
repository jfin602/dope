# C14 P2 — Isolated file operation qualification

Date: 2026-11-27. **P2 PASS for the headless Isolated operation layer.** Pre-task and final HEAD: `eaf393ef0a6c8de1c23141910c47fd9ff654e433`. Initial `git status --short` was empty. Root and Pi runtime package versions remain `0.14.0`; pinned Pi SDK remains `@earendil-works/pi-coding-agent` `1.4.0`. P1's source-bound audit is a tracked PASS. No Work/model run, provider switch, product version/dependency change, or Git commit was made.

## Changed paths

- `packages/agent-core/src/node/isolated-file-operations.ts` — new operation entry against the existing `ExecutionWorkspace`, grant and sandbox. It requires the selected legacy `read_file` or `edit_file` identity until P4/P5 registration migration, checks each write parent and leaf effect, and obeys authorized/reserved paths. Read uses the current bounded source-hashed broker. Write and exact edit use a fixed Python operation under the isolated `/work` mount: no-follow descriptor traversal, bounded payload, parent creation and rollback, temporary file, target metadata and content recheck, atomic replace/link, and explicit `recovery-required` on uncertain settlement. Completed writes report created parent paths and written byte count. Edits preserve UTF-8 BOM and CRLF where applicable. There is no model-facing registration.
- `test/unit/isolated-file-operations.test.ts` — disposable clones of the pre-task HEAD with an explicitly captured untracked `index.html` dirty basis. Tests do not move the main checkout's HEAD.
- This report.

## Results

| Check | Result |
| --- | --- |
| Nested `src/main.ts` create under missing `src/` | PASS; one parent reported, 20 bytes written, candidate only until Accept |
| Complete `index.html` overwrite and unique exact edit | PASS; BOM and CRLF preserved; canonical bytes unchanged before Accept |
| Candidate Reject / Accept | PASS; Reject fixture disposed without canonical writes; Accept promoted exactly `index.html` and `src/main.ts` |
| Absent, multiple and overlapping edit matches | PASS; denied without target write |
| Over-limit, NUL and invalid surrogate content | PASS; denied before parent creation |
| Protected, traversal, absolute, symlink leaf and symlink parent | PASS; denied; outside file unchanged |
| Missing-parent denial and failed nested create | PASS; denied write left no `new/` parent, including an overlong leaf that fails after parent creation |
| Concurrent replacement | PASS; an instrumented delay at the operation's real target recheck allowed an external replacement after staging; recheck denied and preserved the replacement. A stale authorized read followed by a replacement also denied the exact edit. |
| Cancellation | PASS for pre-aborted request: `cancelled` before mutation. A live abort triggered by the staged temporary file returned `recovery-required` and `RECONCILE_CANDIDATE`; the caller must reconcile candidate before continuing. Timeout/abnormal exit uses the same conservative branch. |

Commands and outcomes:

- `corepack yarn workspace @dope/agent-core build` — PASS (twice after source changes).
- `node --test test/unit/isolated-file-operations.test.ts` — PASS (final run, 1 file suite, 0 failures).
- `node --test test/unit/local-tool-broker-edit.test.ts test/unit/local-tool-broker-read.test.ts test/unit/agent-execution-workspace.test.ts` — PASS (3 file suites, 0 failures).
- `corepack yarn workspace @dope/theia-extension build` — PASS.
- `git diff --check` — PASS. At this checkpoint the source and test paths are untracked, so Git's diff check does not inspect their bytes; TypeScript build and Node test parse did inspect them.

The fixed operation permits no untrusted Pi process to write the candidate. The old `edit_file` wrapper remains the only registered model file writer; P4 must bind Pi-compatible definitions/adapters to this operation, and P5 must migrate exact tool selections. Direct Work, candidate promotion rules, command isolation and historical evidence were not changed. A `recovery-required` result is a hard stop for future callers; it is not a successful or cleanly denied effect.
