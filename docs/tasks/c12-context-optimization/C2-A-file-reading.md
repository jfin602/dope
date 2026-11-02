# C2-A — Secure, recoverable file reading

**Disposition: IMPLEMENTED / LIVE QUALIFICATION PENDING.** Recorded 2026-11-02 on `main` HEAD `2ab8f1a195dbe61cd8019a795727bbc8a6d22f22`, product version `0.12.7`. Product edits are uncommitted. The entry tree was clean. C0-R1 had completed before this work; its fixture, model settings and measurements were preserved.

Entry SHA-256 values were `worker.mjs` `78fabbd93db53104400f5e311b084208b16148dc04d2c06760d39b2299b8912c`, `chat-backend.ts` `cdb969bceee6dc085e5f1e34848fbd3b7f3208851f76841f4479a0c551086b90`, `chat-project-grounder.ts` `11cf9400e6ad0c1eef914e62fc4f39b7bd4eb7b59c63c87204a2f8a5eaad902e`, `pi-work-execution.ts` `0a55f3b1a4c9f47800c36e1b6482343f4a00caa3ca863169256186b616c52d1e`, `local-tool-broker.ts` `b2041d5ebf43a9ecbd9626dc30054401549dc6189e3b0a6f85cef6358fa41f39`, and `local-tool-contracts.ts` `f70895e790fda108cc1d2ec913549e36e66b05f32831336be9d272ec566c9f54`. Final changed-source SHA-256 values are `fee5dcd290d242bcaccd7f316efe21f3998bdfce8af24a8b5dc0a09571d9aa75`, `ebc8a1a73cc025b9cf915983e79b042d213fbd83960f180acce2ac6e72e20ef1`, and `f198c55515e9f1e563d31674c8c6c338b595eec460a9dd18a28c5a0f530e9492` in the same changed-module order.

## Change and contract

Changed `packages/pi-runtime/worker.mjs`, `packages/theia-extension/src/node/chat-backend.ts`, and `packages/theia-extension/src/node/chat-project-grounder.ts`; added `test/unit/chat-file-range.test.ts`. Pi's existing Chat `read_file` now advertises optional `offset`, `maxBytes`, and `expectedSourceHash`. `read_file({path})` retains its former prefix response and source-reference behavior. A range request returns JSON with `path`, `offset`, `endOffset`, `nextOffset`, `fileBytes`, exact `text`, `truncated`, and `sourceHash`. Offsets and limits are UTF-8 byte counts; the maximum requested page is 4,096 bytes. `nextOffset: null` and `truncated: false` mean end of file. A range at end of file returns empty text. The backend never clips this JSON envelope; the page is shortened at a UTF-8 boundary until its serialized form fits 8,000 bytes, and the Chat turn's 32 KiB aggregate output budget still applies. Pi chooses every path and range.

The source identity hashes canonical project root, authorized relative path and the complete file digest. Requests beyond offset zero must supply the prior `sourceHash`. Each request rechecks the path policy, root confinement, file descriptor and source identity. An expected hash from changed content or another project is rejected; a stale source has a distinct reread error. Invalid offsets, non-boundary UTF-8 offsets, excessive lengths, protected `.dope` paths and symlink escapes are rejected. A read uses a no-follow descriptor, hashes the whole file and verifies inode, size and timestamps before returning its page. No new permission, source preselection, model call, network, write or promotion capability was added.

## Focused verification

- The extension TypeScript build passed; Pi runtime integrity check passed; browser build passed before the final stale-error wording edit.
- `chat-file-range.test.ts` and `chat-backend.test.ts`: 16/16 passed. The disposable >16 KiB UTF-8 file reconstructed exactly across pages, including reads after byte 8,192 and a clean EOF. Tests covered invalid/out-of-range and mid-character offsets, oversized pages, JSON escaping bounds, protected/traversal/symlink paths, changed content and cross-project continuation. The path-only grounder read remained available.
- `pi-runtime.test.mjs`: 16/16 passed, including existing Chat tool and Work wrapper behavior. `git diff --check` passed.

These deterministic results exercise the range primitive and adjacent existing tool paths. They do not prove a real Pi model chose a tail range.

## C0-R1 comparison and live limit

C0-R1 Test B used the same 14,339-byte `LONG_SOURCE.md` fixture (SHA-256 `da602862507cbe127c4389d7ce09f8e3505571fc7491cbe62d36c4c8302ffa7f`) and question. On its older source `bfe1aee27ef48e8871ef7ae77c7226b4998bf713`, Qwen3.5-9B Q4_K_M at 16,384 context and parallel 2 answered correctly by `list_files`, an 8,192-byte `read_file` prefix, and two `search_text` calls: 3,763 provider input tokens, 178 output tokens, 66.239 seconds. The fixture still had that exact hash and the model was loaded with those settings during C2-A. The updated browser built and the Dope server started at `127.0.0.1:3000`; the Codex in-app browser opened the saved C0-R1 project, but its debugging connection detached during the live check. No C2-A Pi turn completed, so tool ranges, tokens, duration, final answer and comparison outcome are **unavailable**. No repeated model attempt or alternate browser was used. This blocks C2-A Scoped Green.

## Work and C2-B

**Work file ranges: DEFERRED TO C2-B.** The existing Work broker enforces the grant, candidate workspace, source basis, no-follow path checks and revocation, but `pi-work-execution.ts` forwards only `safe(output, 1024)`. That sanitizer redacts secrets and also replaces line breaks/control characters, so simply raising the limit would still fail exact, gap-free source retrieval. Work needs an explicitly structured, bounded file-page reply with its own candidate-bound freshness identity and preserved redaction policy. The general output limit for commands, tests and builds must stay unchanged. C2-B should address this alongside its tool-output continuation design, then test stale/foreign candidates and revoked grants. This C2-A change did not alter Work output handling.

## Regression and rollback

The range path reads and hashes an entire authorized file for each page. This avoids mixing versions but adds I/O cost for very large files. The 32 KiB per-turn Chat output budget and 16-call ceiling still limit how much can be traversed in one turn; direct offsets can reach later portions. The change is isolated to optional Chat `read_file` arguments. Reverting those changes and the new test restores the prior prefix-only behavior. No source, model, grant, compaction, context-limit or canonical write setting was changed.
