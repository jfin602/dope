# C2 R1 + R2 — Pi tool protocol and diagnostic recovery

**Disposition:** Deterministic recovery implemented; no live Pi qualification. This report was prepared on `main` at entry and final HEAD `32a5880b5363ebc750ea963f118581b80db4805d`, product version `0.12.7`. The entry tree was clean. The final product and test changes are uncommitted; HEAD is unchanged. C2-Q remains **NOT GREEN** and its original evidence is unchanged.

## Rejected requests: evidence and limits

The saved C2-Q Chat turn records four denied `read_file` calls but no raw arguments. It therefore cannot prove whether a missing source hash, invalid offset, page size, protected path, output budget, or another condition caused any individual denial. Source inspection proves that the existing backend mapped all range-read exceptions to a generic denial and the Pi worker reduced noncompleted replies to “denied or exceeded output limit.” The saved final claim of reading offset 20,000 from a 14,339-byte file remains unsupported and impossible. This repair does not relabel that answer as grounded.

The saved Work turn proves a stop at `request-parse`, but its arguments and parser exception were not retained. The exact rejected field remains unknown. Source inspection proves two contract defects capable of this failure family: the Work Pi schema required `maxBytes` even for a first read, and the parser required it as well; all parser exceptions were treated as fatal authority denials. No claim is made that the historical Pi call omitted `maxBytes`. The new test reproduces missing continuation identity and invalid page size, then successfully corrects each within the same synthetic Work run.

## Tool contract and authority

Chat and Work keep `read_file`, UTF-8 byte offsets, the 4,096-byte page ceiling, exact page JSON, source identity and existing tool-call limits. An exact first page uses `offset: 0`; `maxBytes` defaults to 4,096. A legacy path-only Work read defaults to 8,192 bytes and keeps its sanitized prefix behavior. A page supplies `sourceHash` and `nextOffset`; a later page requires `expectedSourceHash` equal to that hash. There is no independent nonzero first read. Existing project-root/path checks, candidate fingerprint checks, no-follow reads, output bounds and redaction remain in force.

Harmless malformed read arguments now return bounded model-visible codes such as `INVALID_ARGUMENTS`, `INVALID_OFFSET`, `INVALID_PAGE_SIZE`, `INVALID_SOURCE_IDENTITY` and `SOURCE_IDENTITY_REQUIRED`; parser failures cause no broker effect. Chat stale source and page budget failures also return `STALE_SOURCE` or `OUTPUT_BUDGET`. The Work read broker reports an out-of-range or split UTF-8 offset as `INVALID_OFFSET` only after confirming the same candidate and source identity; a stale hash remains denied. Work missing or expired retained command output returns `OUTPUT_HANDLE_EXPIRED`; an invalid retained-output offset returns `INVALID_OFFSET`. These results use failed tool status and leave Pi free to make a corrected call within the existing session. Expired output never reruns the command.

Protected paths, symlink or project escapes, stale or foreign candidate identity, revoked grants, cancelled turns, invalid workspaces, model/source changes and unauthorized commands remain fatal. The broker and grant checks remain authoritative on every corrected call. A failed approved command remains failed, with its actual bounded sanitized output available through the existing continuation handle; retained output is still limited to two results and expires after 120 seconds.

## Diagnostics and provenance

Chat's saved tool events now carry a bounded code and stage, whether the broker was called, valid requested range metadata, source-hash presence, and successful end offset. Failed reads add no file source reference. Successful search, file, and command events remain separate and keep their existing statuses and source kinds. No raw arguments or model reasoning are added to saved diagnostics.

Chat command events record Ask/Allow mode, approval outcome (`granted`, `denied`, `expired`), actual execution, broker invocation and a SHA-256 digest of the requested command. The event is stored inside the originating assistant turn and project Chat. The command text, approval token and lease secret are not stored for this audit. Work uses its existing provider events for safe parser code, offset and page-size category, hash presence, broker invocation and successful page boundaries. No new logging subsystem was introduced.

## Focused qualification

The final-source focused suites exercise a malformed Chat range followed by first and later pages beyond byte 8,192, denied protected paths, no false source reference, and persisted failure codes. The Work callback test exercises malformed inputs, an out-of-range offset, correction in one run, an authorized later candidate page and no candidate edit. Adjacent tests cover revoked Work authority, candidate confinement, protected paths, exact UTF-8 pages, stale identity including an invalid offset paired with a stale hash, command redaction, one command execution with output continuation, and Chat Ask/Allow sandbox behavior. The command test checks saved approval/execution provenance and absence of raw command text. Existing Pi repeat limits and tool inventory tests also run.

Final focused result: **50/50 passed** across `chat-backend`, `chat-grounded-turn`, `chat-file-range`, `pi-work-execution`, `pi-runtime`, and `local-tool-broker-read`. After the final Chat error wording and Work check simplification, the affected `@dope/theia-extension` build and **20/20** `pi-runtime`/`pi-work-execution` tests passed again. The `@dope/agent-core` and `@dope/chat` builds also passed. `git diff --check` passed. No full check, live provider inference, browser, Chrome, Electron or package run was performed.

## Remaining limits and R3

The exact historical Chat and Work rejected arguments cannot be reconstructed from C2-Q. Deterministic recovery proves the tested failure classes and their correction path; it does not prove how the real model will choose tools or describe evidence. R3 must use a fresh exact-source build and saved Chat/Work transcripts to observe: (1) first-page and later-page reads past 8,192 bytes with a source-matched hash; (2) a harmless malformed call followed by model correction; (3) protected/stale/foreign or revoked denials without bypass; (4) a short approved command with Ask or Allow provenance, actual status, one execution and later sanitized output; and (5) a final answer grounded only in successful source retrieval. Preserve C2-Q's original NOT GREEN result regardless of R3 outcome.

No C1, C3 or R3 work was started. `C0-measurements.json` was not changed because no new provider measurements were collected.
