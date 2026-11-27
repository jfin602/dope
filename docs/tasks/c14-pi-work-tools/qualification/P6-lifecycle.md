# C14 P6 — Work feedback, terminal receipts and mode outcomes

Date: 2026-11-27. **Scoped headless verdict: PASS.** Pre-task and final HEAD: `6dce83cd120e40c7348f0bc6a5a445fb577e0ea3` (`c14-pi-work-tools/P5`). The P5 report records an exact-source headless PASS at this checkpoint; its earlier NOT GREEN and PARTIAL attempts remain intact. The tree was clean before P6. All P6 source, test and report changes remain uncommitted for the phase runner. Root and Pi runtime versions remain `0.14.0`; the pinned Pi SDK remains `1.4.0`. No manifest, lockfile, provider or model selection changed.

## Implemented behavior

- Isolated whole operations now return bounded codes for missing file, existing target, stale expected source and non-unique or absent edit text. Brokered read/list distinguish missing file/directory from a policy denial. Direct exact edits distinguish missing target, match conflict, and unsaved/concurrent source conflict. The Pi adapter gives safe next actions for these cases and unavailable approved commands. Protected paths and genuine grant denials remain denials with no path, source or policy detail.
- The worker records a hash of the Pi call ID beside the broker ID (`pi-N`), forwards malformed native arguments as a bounded failed call, and leaves raw arguments out of that failure. Each callback emits one terminal observation. The runtime deduplicates terminal observations and closes any still-open call before its `run-ended` marker. The host drains broker callbacks even when a stopped worker reports the session result first. Restart reconciliation emits one interrupted receipt per saved native call and synthesizes a journal receipt only if no write/edit call was recorded.
- Direct finalization retains completed and uncertain journal effects, applied file paths and validation status on success, provider failure and Stop. A stopped Direct run with applied bytes is `cancelled`, with those bytes still applied. Direct review/failure/continuation UI and model context describe applied source; candidate promotion language remains confined to Isolated review and promotion. Isolated candidate Accept/Reject behavior stays guarded.

Sanitized model-facing examples from the checked paths:

| Case | Feedback |
| --- | --- |
| Missing read | `MISSING_FILE: Check the path with ls, then use an existing file or write to create one.` |
| Missing list target | `MISSING_DIRECTORY: List an existing parent or create the directory through an authorized write.` |
| Exact edit mismatch/ambiguity | `EDIT_MATCH_CONFLICT: Read the file again and supply one unique exact match.` |
| Stale source | `STALE_SOURCE: Read the current file and retry against its latest contents.` |
| Unsaved/concurrent Direct edit | `SOURCE_CONFLICT: The file or editor buffer changed. Save or review it before retrying.` |
| Unsupported command ID | `COMMAND_UNAVAILABLE: Use an approved command ID and kind shown for this Work, or let Dope run required validation.` |
| Genuine authority denial | `Work authority denied this call.` |
| Uncertain file effect | `EFFECT_UNCERTAIN: The file effect needs journal review before further Work.` |

## Terminal traces and mode outcomes

| Headless trace | Result |
| --- | --- |
| Selected `read`, `write`, `edit`, `ls` in each mode, followed by protected write | Six distinct `pi-N` IDs, each with exactly one terminal phase; protected path absent from observations. Successful calls preserve Pi-compatible text. |
| Missing read/list → corrected list; malformed native read arguments | Each call has one `recoverable` or `completed` terminal phase. Malformed call retains a hashed Pi-call identity and does not invoke the file broker. |
| Revocation followed by a late callback after cancellation | Revoked call records one denial; late call records one cancellation. Late Pi session activity is ignored. |
| Worker session result arrives before broker callback finishes | Host `runWork` stays unsettled until the callback completes; no finalization can overtake the broker operation. |
| Restart with prepared Direct journal effect and saved native `write` request | One interrupted terminal receipt for the saved call before `run-ended`; no duplicate synthetic `edit_file` receipt. Missing request uses one journal-recovered unknown-tool receipt. |
| Direct successful write, failed provider, failed validation, or Stop after write | Applied file and journal bytes remain recorded; failed/stop runs retain Review Changes, validation truth and owner files. Stop reports `cancelled`, and no Direct outcome says candidate promotion failed or offers Accept Candidate. |
| Isolated whole operations | Missing parents are created for authorized writes; conflicts return bounded feedback; candidate remains separate until guarded Accept. |

## Validation and history

- `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/theia-extension build`, and `node --check packages/pi-runtime/worker.mjs`: PASS.
- `node --test test/unit/pi-runtime.test.mjs test/unit/pi-model-bridge.test.ts`: 76/76 PASS. The Work-specific final worker/host rerun passed 10/10 after the call-ID fallback change.
- `node --test test/unit/pi-work-execution.test.ts`: 12/12 PASS. Later added assertions for protected-path redaction, exactly one terminal phase per native call, parse failure and unavailable command passed their targeted reruns.
- `node --test test/unit/direct-work-runtime.test.ts`: 11/11 PASS, including failed provider, failed validation, Stop with owner dirty source, and native restart reconciliation.
- `node --test test/unit/isolated-file-operations.test.ts`: 4/4 PASS. `pi-native-file-tools.test.ts`: 2/2 PASS.
- `node --test test/unit/work-session-runtime.test.ts test/unit/pi-work-history.test.ts test/unit/work-transcript-presentation.test.ts`: 12/12 PASS.
- The broader affected runtime run passed 76/78 initially. One old Isolated fixture expected `denied` for a newly recoverable edit conflict; it was corrected and its file passed 4/4. One Work session polling assertion observed `running` before `awaiting-input` under the concurrent aggregate load; the same test passed in two subsequent bounded reruns. These initial results remain recorded here rather than reclassified as passes.
- `git diff --check`: PASS. No product version, dependency pin, manifest, lockfile, Git HEAD, Work run or Roadmap/Gate status changed.

P8 still owns real-model behavior, browser rendering, same-model standalone Pi comparison and native observations. This P6 headless PASS does not qualify those gates.
