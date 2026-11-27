# C14 P5 — trusted Work selection (runner handoff)

Date: 2026-11-27. **Current exact-source headless P5 gate: PASS; earlier NOT GREEN and PARTIAL attempts are preserved below.** The initial runner attempt was NOT GREEN; a later normal-workspace recovery passed its then-scoped headless gate. A subsequent continuation found more affected fixtures and a broker attestation gap, repaired them, and reran expanded checks. The final exact-source checks are recorded at the end of this report. Pre-task and current HEAD: `aecbee8d5f4c5932bbe87ff82c218d22252b1612`. All P5 edits are uncommitted. Root and `@dope/pi-runtime` remain `0.14.0`; installed and pinned `@earendil-works/pi-coding-agent` remains `1.4.0`. P1–P4 source-bound reports were inspected; P4's scoped PASS is tracked at this HEAD, with its original infrastructure failures retained in that report.

## Implemented boundary

- Catalog revision 4 uses the trusted Work registration in `work-tool-selection.ts`: each eligible built-in has a Dope broker operation and an independently checked schema hash. New selections bind exact tool IDs/hashes, Pi version, project URI, task ID, provider connection/model, execution mode, grant ID and revision. Historical revisions 1–3 parse for saved evidence; the local Pi runtime rejects them for a fresh start. A changed, duplicated or removed identity fails parsing. The runtime, host, worker and broker also check the selected names or attested call contract.
- All new Work start UI paths were updated to create the grant ID before the selection snapshot: New Work, WorkItem, Prompt Stack sequence, resume and conversation follow-up. The older file IDs are absent from the new UI catalog and cannot enter a revision-4 selection. A historical follow-up starts with an empty tool choice for fresh review. Revision-1 saved group/default preferences require per-task review; disabled command choices now block Start instead of silently disappearing.
- The worker's new Work registration includes Pi `read`, `write`, `edit`, `ls` definitions with Dope whole-operation callbacks, plus bounded `run_command` and `read_command_output` adapters. The old `read_file`, `list_files`, `edit_file` wrappers are no longer registered for new Work opens. The worker checks the pinned Pi version and schema at open and each native call; command adapter schemas are checked at open and each call. The host accepts only the selected Work names and verifies the per-call revision/hash/version. The broker rechecks the grant snapshot and registration before dispatch. MCP observation remains separately registered and requires its existing per-call approval.
- The bounded command adapter retains only approved test/build command IDs, the isolated process sandbox, canonical Direct read-only view, retained output handles and Dope-owned required validation. Pi Bash and PowerShell are not exposed.

## Exact registered catalog

| ID | Origin / broker | Model argument shape | Schema SHA-256 |
| --- | --- | --- | --- |
| `read` | Pi definition / bounded file read | `path`, optional line `offset`, `limit` | `134f19bcabe3e29d63c5cebb38f1d2556759fd08adad6bc90a4b4d3cd1fb8441` |
| `write` | Pi definition / whole write | `path`, `content` | `e98a2484f667cf7c22d76ca103bf2022bf9113dc63fe38b899e71c328cb1e833` |
| `edit` | Pi definition / whole exact edit | `path`, `edits[]` with `oldText`, `newText` | `55866598f02c5e00ddfcbcae3df78081e3712de09a622bac7a6bc02ef2acc1bc` |
| `ls` | Pi definition / bounded directory list | optional `path`, `limit` | `ad4ee18683e9c3d6bfa7969709a0683bc9f896099ed6a74db0b6c49444718a0c` |
| `run_command` | bounded Pi-compatible adapter / approved test-build ID | `kind: test\|build`, `commandId` | `1899c5839e68fff80875e8fac665418167014806c11b9d01b175985ae3f917f7` |
| `read_command_output` | bounded Pi-compatible adapter / retained output | `handle`, `offset`, `maxBytes` | `e348a67f7d8edb7f5559b125ff141746efac1299b9dd6d3cd83ce2cb4afce07c` |

`read_command_output` requires selected `run_command`. The separate `mcp_godot_server_info` remains subject to project activation, observation consent and per-call approval; it is not a built-in Work registration. The UI shows Pi `find` unavailable (no qualified bounded glob broker), `grep` unavailable (can spawn `rg` outside the broker), and `bash`/`powershell` unavailable (unrestricted shell cannot meet the Work effect ceiling). The installed Pi SDK's `createAllToolDefinitions` source lists these eight Pi names; no unknown Pi registration is auto-selected.

## Checks and unresolved gates

| Check | Result |
| --- | --- |
| Agent core and Theia extension builds; worker syntax; `git diff --check` | PASS |
| Work tool selection 10/10, Work selection UI 20/20, native file operations 2/2, Agent Run UI 10/10, Prompt Stack UI 8/8 | PASS |
| Pi runtime worker tests | 56/57: current Work registration/schema/selection tests PASS; child-worker initialization exits in this restricted sandbox. P4 separately recorded a full 75/75 recovery in an environment permitting child stdout/loopback. |
| Pi model bridge | 17/18: Work attestation tests PASS; real-worker loopback listener gets `EPERM` in this restricted sandbox. |
| Pi Work execution bridge | **4/12 PASS.** Eight historical fixtures still send retired wrapper calls or assert the old byte-page/source-hash protocol. They require native-schema rewrites; this is a P5 acceptance gap, not a claim that old calls executed. |
| Agent execution runtime | 38/42 initial aggregate; four failures were outdated selection fixture construction. The four exact cases passed on rerun after the fixture update. The full aggregate was not rerun. |
| Work session runtime and Pi conversation real-worker checks | Blocked by loopback `EPERM` before the Work path. |

No real-model, browser, native Electron or full P5 all-entry qualification is claimed. The red historical broker fixtures and blocked worker/loopback checks prevent a P5 PASS. P6 must not be advanced from this result. The runner owns any later checkpoint after the P5 gate is actually satisfied; this report does not authorize a commit.

## Recovery on the same uncommitted P5 source

After the runner stopped, the eight obsolete `pi-work-execution` fixtures were updated to call the revision-4 `read`, `ls`, `write`, `edit` and bounded-command registrations with the registry-attested contract. The synthetic model fixture now reads a document and writes the disposable candidate through Pi's current schemas. Older byte-page and source-hash expectations were replaced with native line-range and whole-operation checks; malformed-schema calls were removed from same-run retry expectations because they are rejected before broker execution. The scoped P6 feedback prompt remains responsible for actionable malformed-call behavior. The historical first-run failures above remain recorded.

Recovery evidence on this source:

| Check | Result |
| --- | --- |
| `node --test test/unit/pi-work-execution.test.ts` | **12/12 PASS**; includes selected native calls, forged unselected edit denial, source isolation, cancellation, candidate promotion boundary, command output and handle redaction. |
| `node --test test/unit/pi-runtime.test.mjs test/unit/pi-model-bridge.test.ts` | **75/75 PASS** in the normal workspace, including child-worker and loopback cases blocked in the restricted runner sandbox. |
| `node --test test/unit/work-tool-selection.test.ts test/unit/work-selection.test.ts test/unit/pi-native-file-tools.test.ts test/unit/agent-execution-runtime.test.ts` | **74/74 PASS**. |
| `git diff --check` | PASS. |

The initial runner attempt did not create a checkpoint. The recovery results above remain historical evidence for that exact intermediate source. P8 real-model and GUI qualification remains separate and unexecuted.

## Expanded continuation on the uncommitted tree

The new Pi file broker now parses and checks the full current selection at its own entry, including catalog/Pi revision, selected identity/schema, grant ID and execution mode, before any operation. Tests assert changed grant ID, mode and schema are denied without a file effect. Direct journal legacy-call regression tests now use a current write selection while the model-facing legacy edit call stays denied. Additional affected Work, MCP and Direct/Isolated fixtures were migrated to revision 4; historical revision parsing remains covered.

Current sandbox checks after those changes: agent-core and Theia extension builds PASS; worker syntax and `git diff --check` PASS. `work-tool-selection` 10/10, `work-selection` 20/20, `agent-run-ui` 10/10, `phase-stack-ui` 8/8, `work-mcp-authorization` 5/5, `pi-native-file-tools` 2/2, `pi-work-execution` 12/12, `agent-execution-runtime` 42/42, `direct-work-journal` 28/28, `direct-work-runtime` 6/6, `isolated-file-operations` 4/4, `pi-work-history` 3/3, and focused local broker process/read/edit tests all PASS. The source-bound test run used direct `node test/unit/<file>` execution because the multi-file `node --test` invocation yielded no output in this sandbox and was stopped.

`pi-runtime` remains 56/57 in this sandbox: the child-worker initialization test ends with `worker_exit`. `pi-model-bridge` remains 17/18 because `listen` on `127.0.0.1` returns `EPERM`. `work-session-runtime`, `pi-work-conversation` and `mcp-work-adapter-integration` cannot get past the same loopback `EPERM` preflight; their updated current-schema fixtures are therefore unverified here. Earlier 75/75 normal-workspace Pi runtime/bridge recovery was recorded before the new broker and fixture edits, so it does not by itself close this final-source gap. No authority mismatch is known from the passing focused tests, but the current source has not passed every required acceptance check. **P5 PARTIAL; P6 must not start from this report.**

## Exact-source recovery after the PARTIAL runner stop

The normal workspace rerun on the expanded source passed `pi-runtime` and `pi-model-bridge` **75/75**. The three loopback integration tests then exposed one real host error and two stale fixtures. `PiRuntimeHost` still allowed only the retired Work wrapper names for `tool_execution_*` events, so a native `read` event produced `worker_protocol`. The host now validates event names against the trusted Work registry plus the separately reviewed MCP observation name. The Pi conversation fixture now uses Pi's one-based read offset; the MCP expired-grant fixture binds its selection to the expired grant ID.

On this final source, the affected Theia extension build passes. `node --test test/unit/work-session-runtime.test.ts test/unit/pi-work-conversation.test.ts test/unit/mcp-work-adapter-integration.test.ts` passes **3/3**, including a supervised native `read` turn and an MCP receipt. The prior expanded-continuation focused gates remain recorded above; the host event change and two fixture corrections do not broaden tool execution authority. The first NOT GREEN and subsequent PARTIAL decisions remain historical. The scoped P5 headless gate is now **PASS pending runner-owned checkpoint**; P8 real-model and GUI closeout remains separate.

## Final runner exact-source recheck

The current dirty tree was inspected and retained; HEAD stayed `aecbee8d5f4c5932bbe87ff82c218d22252b1612`. No manifest, dependency pin, lockfile, provider, model or product version changed. The latest source also corrects an old Work documentation pointer that instructed the model to call retired `read_file` and use byte/source-hash paging. It now names the selected Pi `read` tool and its one-based line range. The runtime's safe Pi event summary recognizer also includes current native and bounded-adapter names. The focused document-routing test asserts the prompt no longer contains the retired protocol.

On this source, `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/theia-extension build`, `node --check packages/pi-runtime/worker.mjs` and `git diff --check` all passed. An expanded `node --test` invocation across 17 affected selection, UI, phase-stack, runtime, host, worker, broker, MCP, Direct and Isolated files passed **228/228**. This includes the real supervised child worker and loopback cases that the earlier runner sandbox could not execute, plus Work starts, forged/unselected calls, current schema attestation, commands and candidate boundaries. After the final documentation-pointer and event-summary edits, the Theia extension rebuilt and `node --test test/unit/work-document-routing.test.ts` passed **7/7**; `git diff --check` passed again. Those two final edits do not change tool dispatch or effects.

**P5 headless gate: PASS.** The runner owns staging and the checkpoint commit. This does not assert P8 real-model, browser or native GUI qualification or product Roadmap Gate progress.
