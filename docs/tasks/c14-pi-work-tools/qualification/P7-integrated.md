# C14 P7 — Headless Work integration and wrapper retirement

## Final exact-source recovery — PASS

After the earlier successful aggregate, a final wording audit found two remaining Direct-mode descriptions. The approved-command catalog still said "isolated Work workspace," and the resume context described a Direct run as a pending candidate. The current tree changes the command description to the selected Work mode and makes Direct recovery list applied effects and require applied-source review; Isolated recovery retains candidate wording. A focused Direct recovery test checks this boundary. No effect, grant, sandbox or journal authority changed.

- Exact pre-checkpoint HEAD: `be3aef1f00c924a5a921f299d2cd600326142b17`. Current tracked implementation diff SHA-256: `ab032c507eb3a916e2fc886513f2a3d823a7fb7c1d89fd8447451df9675963c6` (`git diff --binary | sha256sum`). This report is untracked and excluded from that hash. Product and Pi runtime remain `0.14.0`; pinned Pi SDK remains `1.4.0`.
- `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/theia-extension build`, `node --check packages/pi-runtime/worker.mjs`: PASS. `node --test test/unit/work-recovery.test.ts test/unit/work-tool-selection.test.ts test/unit/pi-work-execution.test.ts`: **25/25 PASS**, including Direct/Isolated selected calls and the new mode-correct recovery assertion. `git diff --check`: PASS.
- One `npm run check` on this final source: **exit 0**. Product tests **811/811**, IDE tests **28/28** and **1/1**, browser/node/Electron builds completed. The aggregate log was captured at `/tmp/c14-p7-final-check.log`. No source changed during that command.
- Final P7 headless T2 disposition: **PASS**. The initial PARTIAL and earlier failed aggregate attempts below remain historical. P8 may begin only as an independent manual exact-source closeout after the runner creates its P7 checkpoint. Real open-tab/preview and same-model browser behavior remain P8 evidence gaps.

## Earlier aggregate recovery — preserved

Date: 2026-11-27. **This earlier P7 verdict was PASS for headless T2.** The initial P7 PARTIAL and both failed aggregate attempts remain recorded below. Its `npm run check` exited **0** on the revised tests and then-current P7 product implementation. This does not qualify a real model, open editor tab, preview, browser Work journey or native GUI; those remain P8.

- Exact pre-checkpoint HEAD: `be3aef1f00c924a5a921f299d2cd600326142b17`. Tracked diff SHA-256 before runner checkpoint: `6c1fe13ad6a4c6cbcfd56d011b7ebce3e173a688c2a67ef3e50c34d031af2b5f`. The P7 report is untracked; the runner owns staging and commit. Product version remains `0.14.0`; Pi SDK remains pinned at `1.4.0`.
- The three first-aggregate Chat failures came from fixed wall-clock assumptions under the default concurrent product run. The restoration test now explicitly refreshes both panels before checking their saved Chat list. The orphaned lease test proves denial while the lease is valid, then shortens expiry and verifies restore. The Roadmap Chat test waits for the actual lease file removal after each asynchronous disposal. Its temporary-project cleanup retries transient filesystem contention.
- The second aggregate passed the revised Chat tests but failed **810/811** in an Assessment resource-ceiling fixture. Under aggregate load, its 129 sequential filesystem-backed tool calls took about 62 seconds, allowing lease authority to overtake the intended count ceiling. The fixture now renews its owner lease every 16 calls. The focused ceiling case passes; no Assessment broker policy or product code was changed.
- Final affected Chat files: `node --test test/unit/chat-panel.test.ts test/unit/roadmap-chat-panel.test.ts` **53/53**. Focused Assessment ceiling case: **1/1**. Final `npm run check`: **exit 0**, product tests **811/811**, subsequent IDE tests **28/28** and **1/1**, with preceding runner/baseline/local-install groups also passing; browser, node and Electron builds finished with zero errors. `git diff --check`: **PASS**.
- P7 Work tool retirement and T2 safety evidence in the initial matrix below remains applicable: no P7 product source was changed during this recovery. No Work Run, provider switch, model, browser, native GUI, Roadmap Gate or version change was made. The runner must checkpoint this PASS before P8; P8 remains manual and must not be auto-run.

## Initial runner attempt — preserved PARTIAL

Date: 2026-11-27. **Verdict: PARTIAL. P8 entry: closed.** The relevant headless Work safety checks passed after one stale assertion was corrected, but the required single `npm run check` invocation exited nonzero in three Chat lease/restoration tests. Those three tests and their two complete files passed in affected reruns on unchanged product source. The aggregate itself is recorded as **FAIL, 808/811**; it is not relabeled PASS. P8 requires an exact-source P7 PASS and must be initiated manually.

## Source and boundary

- Pre-task and final HEAD: `be3aef1f00c924a5a921f299d2cd600326142b17`. The working tree was clean at entry. The implementation remains uncommitted for the runner. Pre-report tracked diff SHA-256: `46df94ba32a8d2cd109129ce20ef0e916844121ec75050d038b8716da8ecd3f9` (`git diff --binary | sha256sum`). This report is an additional untracked file.
- Changed source: `packages/agent-core/src/work-tool-selection.ts`, `packages/pi-runtime/worker.mjs`, `packages/theia-extension/src/node/pi-work-execution.ts`. Changed tests: `test/unit/work-tool-selection.test.ts`, `test/unit/mcp-work-worker.test.ts`, `test/unit/agent-execution-runtime.test.ts`. No manifests, lockfiles, dependency pins, model/provider selection or product version changed. Root and Pi runtime remain `0.14.0`; pinned Pi SDK remains `1.4.0`.
- P1–P6 reports were inspected. P6's final source-bound headless gate is PASS at this entry HEAD; its earlier failures remain historical. No Work run, real model, browser, native GUI, Roadmap Gate change or Git commit was performed here.

## Retirement proof

`WORK_TOOL_CATALOG` now contains only the four registered Pi file tools, the two bounded approved-command adapters and the reviewed MCP observation. Archived `read_file`, `list_files` and `edit_file` identities live only in the historical selection parser; saved choices containing them require fresh review, and new custom groups and selections reject them. The worker's Work registration selects native `read`, `write`, `edit`, `ls` plus the approved command adapters and optional reviewed MCP observation. Its former Work file-wrapper descriptions are gone. The Pi Work Local-protocol bridge maps only `run_command` and `read_command_output`; file effects use `executePiFileOperation`. The two command names are retained deliberately as bounded Dope adapters, not arbitrary Pi Bash. Chat/Planning tool definitions, historical transcript rendering and shared legacy record parsing remain readable and were not removed.

The source boundary is checked independently by the worker's selected registration, the host's trusted registry and per-call schema hash, and the Work adapter's grant, project, task, model, mode, workspace and selected-tool checks. No default Pi file/process tools or model-facing old file wrappers are offered for a new Pi Work session. The worker runs with `noTools: 'all'`; the file callback delegates each whole effect to the Dope broker. The Direct sandbox test confirms the model command process cannot write canonical project bytes.

## Headless T2 matrix

| Case | Result | Source-bound evidence |
| --- | --- | --- |
| Fresh missing `src/`, nested create, index overwrite, exact edit | PASS | `pi-native-file-tools`, `isolated-file-operations`, `direct-work-journal` whole-operation fixtures. |
| Selected read/list; search eligibility | PASS | Native `read`/`ls` bridge and worker tests passed. `find` and `grep` remain unavailable with reasons; no raw search process was offered as a Work tool. |
| Saved versus unsaved editor, owner dirty source, concurrent replacement | PASS | `direct-work-journal` tests cover saved tab write, unsaved conflict, stale exact edit, identity swap and concurrent owner change. |
| Unselected, forged, stale, duplicate and changed-schema call | PASS | `pi-work-execution`, `pi-runtime`, `work-tool-selection` and host tests reject these before effects. Archived choices require review. |
| Protected, traversal, absolute, symlink, ignored and hardlinked paths | PASS | `pi-native-file-tools`, `direct-work-journal`, `isolated-file-operations` and sandbox tests cover no-write denials. |
| OS/process/network/Git effect ceiling and command allowlist | PASS | `local-tool-sandbox`, `local-tool-broker-process`, Work selection and Direct command-isolation tests. Only approved test/build command IDs and retained output pages are offered; raw Bash/PowerShell are unavailable. |
| Cancellation, restart, partial or uncertain journal | PASS | `direct-work-journal`, `direct-work-runtime`, `isolated-file-operations`, `pi-work-execution` and Work runtime tests cover stop, killed writer, prepared receipt and no unsafe replay. |
| Direct applied review, selective revert and validation truth | PASS | Direct journal/runtime and Work selection tests cover owner-safe revert, source conflicts, stopped/failed provider and failed validation. |
| Isolated reject/accept and candidate authority | PASS | Isolated operations, Work integration and agent runtime tests cover no promotion on reject, exact validation and guarded accept. |
| Transcript, saved History and terminal tool receipts | PASS | Pi Work conversation/history, session runtime, transcript presentation and P6 lifecycle tests passed. |
| WorkItem, Prompt Stack, retry, fork and resume | PASS | Work selection, WorkItem delegation, phase-stack and agent execution runtime tests passed after correction of a stale Direct wording assertion. |
| Real open tab, preview, same-model task and GUI | GAP | Reserved to manual P8; no claim here. |
| Product aggregate | FAIL | `npm run check` exited nonzero at product tests: 808/811. Three Chat lease/restoration tests failed under aggregate load. Exact three targeted cases passed 3/3; both affected files passed 53/53 on the same product source. No Chat product change was made. |

## Commands and outcomes

- `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/theia-extension build`, `node --check packages/pi-runtime/worker.mjs`: PASS.
- Initial focused `node --test test/unit/work-tool-selection.test.ts test/unit/pi-work-execution.test.ts test/unit/pi-runtime.test.mjs`: 79/80, one archived custom-group fixture expected old registration. It was corrected to assert that archived wrappers cannot enter a new group. The changed selection/MCP worker tests then passed 12/12.
- Broad 28-file focused Work T2 run (`node --test --test-concurrency=4` across the affected operation, broker, selection, runtime, MCP, Direct, Isolated, phase-stack, History and WorkItem files): 208/209 initially. The sole failure expected the retired phrase “Direct Work validation or candidate review”; the current source correctly says “applied-source review.” The assertion was updated and its exact test passed 1/1. No effect-authority failure appeared in the sweep.
- Single `npm run check`: typecheck and preliminary test stages passed; product tests 808/811, then the command stopped before browser/Electron builds. The three failures were `chat-panel` restoration/lease cases and one `roadmap-chat-panel` lease case. Targeted rerun 3/3 and full affected-file rerun 53/53 passed without a source change.
- `npm run build:browser && npm run build:electron`: PASS, including zero-error browser, node and Electron builds. These were run separately because the failed aggregate stopped before its build stages.
- `git diff --check`: PASS. No staging or commit was made.

The isolated aggregate failures are consistent with timing sensitivity under load, but that is an inference from the passing affected reruns, not a passing aggregate receipt. There is no observed P7 security bypass. The runner should stop before staging or committing under the stated PASS-only boundary. A later exact-source P7 disposition must resolve the aggregate gate before P8 is opened.
