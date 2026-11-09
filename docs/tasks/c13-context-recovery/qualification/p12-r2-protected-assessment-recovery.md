# c13-context-recovery P12-R2 — protected Assessment recovery

**Date:** 2026-11-09. **Verdict:** PASS for deterministic headless P12-R2. Original live P12 remains **NOT GREEN**; P12-R1 remains a scoped targeted PASS. No live model, browser, Work, publication, Roadmap award, version change, or P12-R3 was run.

## Source basis and diagnosis

- Entry and final product HEAD: `0be54a048b2c2cdd08b9f152867162640cff9a05` (`p12-r1`), on `main`; initial worktree was clean. P12-R1's five affected source/test files were already committed in this HEAD, rather than uncommitted on `595b6533211de1da6c933aaff680503a21d014e8` as the task handoff expected. Product version remains `0.13.11`. Compiled `lib/` output was rebuilt locally and is ignored; this correction is left uncommitted.
- The live P12 record proves the late-guide continuation at offset 4096 omitted `expectedSourceHash`. The first-page broker result already contained `path`, `sourceHash`, `offset`, `endOffset`, `nextOffset` and `fileBytes`; `assessment_status` also reported the expected hash. Thus missing result metadata and a broker hash-generation defect were not the cause. The raw model call and its receipt were not persisted, so why the model omitted the field is **UNKNOWN**. The former worker tool description did not spell out the exact retry argument pair. The broker correctly denied the missing identity; it now returns the verified prior hash and next offset as an actionable diagnostic, without performing the read. A retry still passes current-file identity checks.
- The live Assessment has one `ASSESSMENT_CITATION` and three `ASSESSMENT_UNSUPPORTED_SOURCE` rejections, but does not retain their raw arguments. Their exact authoring mistakes are **UNKNOWN**. The existing validator correctly requires exactly `claim,path,quote`, a short unique verbatim quote within a successful broker read, and broker-owned offsets/hash. The updated worker guidance states those requirements explicitly; rejection feedback now distinguishes malformed fields, unread paths, absent verbatim quotes and ambiguous matches. No citation rule was relaxed.
- The deterministic bound Plan probe found a separate worker operation-policy mismatch: checked Chat draft selection accepted `/prompt-plan`, but the ordinary read-tool worker allowlist rejected the trusted `prompt-plan` policy. The worker now permits that exact operation in its ordinary read-tool mode. Chat's saved draft identity, selected card, source and lease checks remain required.

## Changes

- `packages/pi-runtime/worker.mjs`: explicit source-hash continuation and exact citation guidance; allow trusted `prompt-plan` policy in the existing read-tool mode.
- `packages/theia-extension/src/node/chat-backend.ts`: actionable missing-hash receipt for a verified Assessment page; require the exact next offset and prior source hash for requested Assessment continuations; specific citation recovery guidance. A denied continuation does not enter coverage.
- `packages/theia-extension/src/node/prompt-authoring-stage.ts`: specific citation shape, unread-path, missing-quote and ambiguity diagnostics; unchanged exact matching.
- `test/unit/protected-assessment-worker.test.ts`: deterministic OpenAI-compatible streaming provider, bundled Pi worker/host, real Chat broker and protected Assessment owner on the exact tracked-clean five-file P12 fixture bytes. Also checks failed continuation and staging attempts, sealed record, and selected-draft Plan entry.
- `test/unit/pi-conversation-runtime.test.ts`: updated one obsolete expected diagnostic to the precise P12-R1 provider message.

## Deterministic run and negative evidence

The fixture hashes match the live P12 record for all five files. `src/clamp.js` (89/89), `test/clamp.test.js` (264/264), `package.json` (118/118), `docs/late-guide.md` (4096/6584, then 6584/6584), and `RELEASE_NOTES.md` (147/147) were successfully broker-read. The mock provider extracted the guide hash from the prior Pi tool-result message and sent it with offset 4096; the late page ended at EOF and its source-backed risk quote began beyond byte 4096. The Assessment sequence made 21 tool calls: 9 read attempts (6 successful), 3 status calls, 7 stage attempts (6 accepted), and 2 finish attempts (1 successful). The separate Plan entry probe made one further read. No listing/search was used in the full run; existing focused tests verify that discovery results do not count as read coverage.

The real Assessment owner accepted four findings (observations, preservation, dependencies, risks), scope and T1 focused source/unit, T2 integration, T3 independent manual browser tiers. One early `assessment_finish` was rejected for incomplete categories; a rejected unsupported quote preserved the previously accepted finding. The final `assessment_finish` completed, produced revision 1 and one checked sealed Assessment record with five distinct source files and no omissions. The saved Chat projected `plan` availability. A selected-card `/prompt-plan` request passed checked draft/lease/source authority and reached Plan validation; its intentionally invalid mock Plan was rejected, leaving no staged or canonical Plan.

The same worker run rejected missing hash (`SOURCE_IDENTITY_REQUIRED`), wrong hash (`STALE_SOURCE`) and a jump from verified offset 4096 to 5000 (`INVALID_OFFSET`) without crediting those reads. Existing focused suites cover changed-file drift, unsupported and ambiguous quotes, listing/search noncoverage, preserved accepted stages, incomplete finish, foreign lease/project/stale draft, replayed tool results, provider failure and no duplicate effects. The fixture's tracked source and canonical task path were not published.

## Validation and remaining limits

- `corepack yarn workspace @dope/theia-extension build` — PASS.
- Final consolidated `node --test` matrix: `protected-assessment-worker`, `prompt-authoring-stage`, `prompt-draft-store`, `incremental-proposal-controller`, `pi-runtime`, `pi-conversation-runtime`, `pi-transport-fault-matrix`, `chat-backend` — **124/124 PASS** on final source. P12-R1 worker-frame, transport integrity, provider diagnostics and exact acknowledgement tests are included.
- `git diff --check` — PASS.

The provider is deterministic; this does **not** identify the historical 82.241-second live provider failure, prove a local GPT-OSS model will follow guidance, or qualify connected-browser/native behavior. Original P12 remains **NOT GREEN**. No canonical Prompt Stack files, Work result, Roadmap Gate/Phase GREEN, or version advance follows from this headless PASS.
