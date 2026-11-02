# C2-R5 — Work live retrieval and transcript closeout

**Disposition: PARTIAL.** One real Pi Work run completed hash-bound file paging through the candidate tail and displayed live transcript updates. The approved command was denied before execution because the disposable fixture supplied an unsupported **test** command shape. Command-output continuation, final answer grounding, C2-B LIVE GREEN, combined C2 scoped Green, and C1 entry are not established. No second run or product repair was made. Historical C0, C2-Q, C2-R3, R4-A and R4-B results remain unchanged.

## Source and runtime

- Entry and final product HEAD: `217f46bc6589a8760b8e69641dc303c243944f45` on `main`, version `0.12.7`; product tree clean at entry. R4-A and R4-B source changes are committed at this HEAD. No product source changed in R5.
- Built `@dope/theia-extension` and `@dope/browser` once. Served backend `apps/browser/lib/backend/main.js` SHA-256: `6df0a5e6e15a3c7308fe1d2a3609352f9b2e507db902d5b1f7971aad92f884a6`. Served frontend `apps/browser/lib/frontend/bundle.js` SHA-256: `2d8f25ba4435e21f0198177388827009f6c28bf1d05078e702e1e39d6766035e`. One Dope server at `127.0.0.1:3000` and one Codex in-app browser tab were used. No external Chrome or Electron was launched.
- `lms ps` once reported the existing local `qwen3.5-9b`, Q4_K_M, context 16,384, parallel 2, idle. AI Center refreshed the existing LM Studio connection and its successful synthetic tool probe verified Coding Agent eligibility. Work selected that exact local model with observed context 16,384. No model context, quantization, reasoning, offload, parallelism or routing setting changed.
- Reused `/tmp/dope-c2-q-work` at unchanged project HEAD `4d97004565f1e7503960416973761b0f2144c323`. `CANDIDATE_SOURCE.md` was 24,509 bytes, SHA-256 `f0b9fdd8f125195e049254dd21f1ca5e552c71cef099093133ead5eb3d1a3d3d`. Its tail marker `FILE-QUASAR-7319` begins at byte 24,492. The marker was absent from Pi's task instructions. The existing `verify.mjs` emits more than 1,024 characters and ends with `OUTPUT-COMET-5826`; the marker was not given to Pi.
- New direct Work task `bdeee9e1-6459-49f7-bf42-4ecc6bc01187` used the reviewed default project ExecutionGrant `a20c3737-fbff-4061-94fb-c3b1c6da6200`, revision 1. The UI showed workspace read, process, test and build allowed; network, secrets, private state, outside-root, destructive actions and Git writes denied. The exact selected model connection was `21d03643-2aca-407e-b090-af59979b6c2f`. Required validation was configured as `node verify.mjs`.

## Single live Work run

Run `4de70831-2953-46f2-ab56-715cfa686f7b` started `2026-11-02T19:22:56.493Z` and ended `19:25:08.122Z` (131,629 ms). The transcript was opened about 11 seconds after start, before the first `read_file` callback at `19:23:14.575Z`.

| Tool call | Actual recorded request and outcome |
| --- | --- |
| `pi-1` `read_file` | `CANDIDATE_SOURCE.md`, offset 0, 4,096 bytes; broker completed range 0–4,096, source hash `1a17160d776040514a08bcdb4bcf4edec9478244224121f4f452d29d5d4ea605`, next offset 4,096. |
| `pi-2` `read_file` | Same path, offset 20,000, 4,096 bytes, expected source hash supplied; broker completed 20,000–24,096, same hash, next offset 24,096. |
| `pi-3` `read_file` | Attempted continuation at 24,096 with source identity; parser returned recoverable `INVALID_PAGE_SIZE` at `request-parse`. Broker invoked **no**, effect executed **no**. Corrective feedback reached Pi, which made the next call. |
| `pi-4` `read_file` | Corrected path, offset 24,096, 4,096 bytes, source identity supplied; broker completed 24,096–24,509, same hash, `nextOffset: null`, `truncated: false`. The verified fixture marker lies within this returned range. The saved metadata do not retain the raw page, so no separate byte-for-byte provider receipt or Pi final answer is claimed. |
| `pi-5` `run_command` | `commandId: validation-1`, `kind: test`; grant check passed. Broker returned `AUTHORITY_DENIED` at `broker-execute`; broker invoked **yes**, effect executed **no**. The run stopped as `authority-denied`. |

The command ID and kind were the ones supplied in Pi's Work execution reference. `read_command_output` was never called. The counter file is absent, consistent with zero command executions; no output handle or later command page exists. Dope validation remained `not-started` because the provider/candidate did not reach it. The candidate delta and changed task files were empty; final fixture Git HEAD and tracked bytes stayed unchanged. No completed final Pi answer was recorded. Provider token counts were unavailable; no token estimate is substituted.

## Denial diagnosis

The recorded `run_command` request was syntactically valid, and its grant revision was verified before broker dispatch. `localCommands()` registered `node verify.mjs` as `validation-1` with kind `test`. The broker's existing `supportedCommand()` policy accepts a test command only in the form `node --test <path>.test.[c|m]js`; a single script path is allowed only for kind `build`. Thus this fixture command could not pass the broker's command-shape check. The broker emits generic `AUTHORITY_DENIED` for that check, so the transcript does not identify the internal rejection branch by itself. The source-to-fixture comparison explains this run without changing security policy. This is a fixture setup error, not a demonstrated product defect. The R5 one-run limit bars an additional unchanged-source run; no repair cycle was started.

## Live transcript and visual checks

- With the transcript already open, reasoning appeared before tools as a collapsible section. A bounded omission marker was visible. The reasoning stayed separate from tool cards; no final answer appeared after the authority stop. Whether every emitted paragraph received its intended fade was not measured.
- Each of the five observed tool calls had one card at its chronological position. Expanding cards showed safe request fields, actual ranges, source hashes, error code and stage, and broker/effect flags. The recoverable `INVALID_PAGE_SIZE` card differed from the fatal `AUTHORITY_DENIED` card. No duplicate generic Live Activity row was observed in the structured transcript. The short broker callbacks completed too quickly to separately prove every in-place intermediate status transition.
- After the first tool activity, scrolling upward exposed **Latest**. A subsequent corrected-read card arrived while the viewport remained on earlier content; it did not force a jump to the bottom. Clicking Latest returned to the end. Expanded cards remained open as further events arrived. The transcript visibly changed before any reopen, establishing browser-observed incremental arrival.
- The browser reported `prefers-reduced-motion: reduce` as **false**. The earlier deterministic R4-B fixture was opened in the same Codex browser tab after the live run; this environment did not expose a reduced-motion emulation control through the permitted browser interface. Reduced-motion browser behavior remains **UNVERIFIED**. The existing focused CSS/test result is historical source evidence, not a substitute for this browser check.

## Exit

- **C2-R5 PARTIAL.** File paging and truthful failure observation passed in the bounded live run; full Q1 final grounding and Q2 command continuation did not.
- **C2-B LIVE NOT GREEN.** The command did not execute and no continuation page was retrieved. Existing C2-A LIVE GREEN remains applicable to its recorded source and scope; **combined C2 scoped Green is unavailable**.
- **R4-B PARTIAL.** Live incremental transcript and Latest behavior passed the observed checks; requested/completed transition timing, final-answer layout on a completed Work run, fade and reduced-motion behavior remain unverified.
- **C1 Prompt Diet entry is not cleared.** The smallest follow-up is a separately authorized Work fixture with a broker-supported approved command and validation separated from the one-time counter. No C1 or C3 implementation is included here.
