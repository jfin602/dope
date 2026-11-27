# C14 P4 — Pi file adapter source-bound qualification

Date: 2026-11-27. **Initial runner attempt: NOT GREEN. Subsequent recovery: P4 PASS for its scoped headless gate, pending runner-owned checkpoint.** The original attempt's failures and limitations are preserved below. The blocked worker/bridge suites passed when rerun outside the restricted runner sandbox; one existing test also needed to pass its selected tools explicitly to the worker after the new fail-closed default.

Pre-task HEAD: `f8fbbf19fe386a8a34b6e70514fafdc48ad56679` (P3 runner checkpoint). Initial `git status --short` was empty. Root and `@dope/pi-runtime` versions are still `0.14.0`; the installed and pinned `@earendil-works/pi-coding-agent` is still `1.4.0`. P1, P2 and P3 each have tracked source-bound PASS reports at that HEAD. No real-model Work, browser, provider switch, version/dependency/lockfile change or Git commit occurred. All implementation and test changes remain uncommitted.

## Implementation

- `packages/pi-runtime/worker.mjs` imports the public Pi `read`, `write`, `edit` and `ls` definitions to carry their names, JSON schemas and available prompt guidance. It attests pinned schema SHA-256 and Pi version at open and call time, then registers a small Dope callback adapter instead of the SDK's filesystem `execute` function. A missing Work selection now activates zero tools. `noTools: 'all'` remains in force; no raw Bash, grep, find, network, extension or default file tool was registered.
- The worker and `pi-runtime-host.ts` carry and check revision 3, schema hash and Pi version on every native file request. `pi-work-execution.ts` checks the same contract, exact selected identity, project/task/model/grant binding, source and candidate, AGENTS routing and result safety before invoking the new broker entry.
- `local-agent-turn-loop.ts` maps read/list to existing sandboxed descriptor operations, and write/edit to P2 isolated or P3 Direct whole operations. Direct mirrors only after its journaled canonical effect. Native `write` is a complete rewrite with missing-parent creation and overwrite; native `edit` uses unique original-text replacements. The broker bounds paths, read scan and output, lists, edit arrays and payload bytes. Expected conflicts are not reported as successful writes.
- `work-tool-selection.ts` provides a revision-3 native file selection for new UI choices and keeps revision-1/2 selections readable. Older saved file IDs are marked unavailable for a new approval. The prior IDs remain runnable for existing selections until P5/P7 migration and retirement. The existing bounded approved command pair remains separate.

## Pi contract and safe deviations

The pinned schemas have hashes `read=134f19bc…`, `write=e98a2484…`, `edit=55866598…`, `ls=ad4ee186…`. The registered model-visible tools in the synthetic worker test were exactly `read`, `write`, `edit`, `ls`; no raw built-in appeared. The write success is Pi's `Successfully wrote to <path>` text. Edit success says `Successfully edited <path>` and includes bounded old/new replacement excerpts. This is a safe deviation from Pi's full unified patch and render details: its public edit callbacks split access/read/write and cannot commit the prechecked original identity as one effect. Pi write's `mkdir` callback was not injected because it could mutate before the journal; parent creation is inside the P2/P3 whole operation. Pi read's resolver performs filesystem probes before injected callbacks, so the adapter uses brokered path resolution instead. Read is text-only, scans at most 64 KiB per call, and returns at most 16 KiB; `offset`/`limit` remain line-based. `ls` caps at 100 entries. The descriptions disclose these bounds instead of advertising unsupported images, 50 KiB output or 500 entries. `find` has no qualified Dope glob operation; `grep` can spawn `rg`; unrestricted Bash remains ineligible.

## Checks and observations

| Check | Result |
| --- | --- |
| New `pi-native-file-tools.test.ts` | PASS, 2/2: selected read/list/write/edit in Direct and Isolated; nested create, overwrite, BOM/CRLF exact edit, protected/absolute/traversal/over-limit and unselected denial, pre-abort, secret-content read denial, external source replacement, canonical/candidate separation and Direct journal count. |
| Native `pi-work-execution.test.ts` bridge tests | PASS, 2/2 new tests; full file PASS, 12/12. Selected calls cross the actual Work adapter, AGENTS/source/model checks and P2/P3 operations in both modes. |
| `direct-work-journal.test.ts`, `direct-work-runtime.test.ts`, `isolated-file-operations.test.ts`, `work-tool-selection.test.ts`, `work-selection.test.ts` | PASS: 28/28, 6/6, 4/4, 8/8 and 20/20 respectively. The P2/P3 suites include staged race, cancellation, rollback and uncertain-effect checks. |
| `pi-runtime.test.mjs` | 56/57 PASS. Synthetic model-visible Pi schemas/results, exact selection, no default tools, and host rejection of a forged schema hash passed. The existing child-worker initialization case failed with `worker_exit`. A separate minimal `spawn(process.execPath, ['-e','console.log(123)'])` in this sandbox also exited 0 with no child stdout; this does not prove the deployed worker path. |
| `pi-model-bridge.test.ts` | 17/18 PASS. The sole failed real-worker sampling case could not bind a loopback listener: `listen EPERM: operation not permitted 127.0.0.1`. The other binding, exact-model and tool-boundary checks passed. |
| `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/theia-extension build`, `node --check packages/pi-runtime/worker.mjs`, `git diff --check` | PASS on the final source. |

The complete child-worker test and loopback bridge case remain required verification gaps. In-flight cancellation through the new worker/host path and full Pi edit patch/result parity are also not established by this P4 run; the P2/P3 operation-layer cancellation and race tests passed. P5 must complete trusted registration-backed catalog migration and all entry/retry/resume selection checks; P6 owns terminal receipt and mode-specific finalization. No P5 work was run here.

**Original gate:** NOT GREEN; the runner correctly stopped without staging or committing. The following recovery evidence is later than this original disposition.

## P4 recovery on the same uncommitted product source

The pre-task and current HEAD remained `f8fbbf19fe386a8a34b6e70514fafdc48ad56679`; product and Pi versions remain `0.14.0` and `1.4.0`. A second execution environment permitted child Node stdout and loopback binding. `node --test test/unit/pi-runtime.test.mjs test/unit/pi-model-bridge.test.ts` passed **75/75**, including both original blocked cases. No worker or product-code change was needed for those two failures.

An aggregate focused run exposed a separate legacy test-fixture mismatch: `Pi Work model-selected read/edit/test stays in a disposable candidate until Dope promotion` called the worker's `open` without `workToolNames`, then expected the former implicit five-tool set. P4 intentionally makes an omitted selection expose **zero** tools. The test now forwards the exact reviewed selection from the bridge into the synthetic worker. `node --test test/unit/pi-work-execution.test.ts` then passed **12/12**, including the existing Isolated candidate test and both new Pi-native Direct/Isolated bridge cases. The combined P4 file, Direct, Isolated, selection and Work UI suite then passed **80/80**. This changes the test fixture only; it does not restore implicit tool exposure.

The new Pi file adapter's pre-abort, source-race and whole-operation safety paths remain covered by the P4-focused tests listed above; the full worker/host in-flight cancellation and terminal-receipt lifecycle remain explicit P6/P7 integration obligations. Pi edit patch/render parity is a documented safe adapter deviation under ADR 0060, not an unbrokered effect. No real-model or browser claim is made by this headless gate.

**Recovery gate:** P4 scoped headless PASS on the current uncommitted source and updated test fixture. The runner must still inspect this exact dirty tree, verify its own PASS verdict, and create its checkpoint before P5. A commit alone will not qualify P5–P8 or the whole correction.

## Final runner handoff recheck

The source and HEAD remained unchanged during this recheck. The pre-existing dirty implementation and report were preserved. The affected `@dope/agent-core` and `@dope/theia-extension` builds, `node --check packages/pi-runtime/worker.mjs`, and `git diff --check` passed. Separate focused runs passed: Pi native file operations 2/2, Pi Work execution 12/12, Direct journal 28/28, Direct runtime 6/6, Isolated file operations 4/4, Work tool selection 8/8, and Work selection UI 20/20.

This restricted runner environment again produced the same two infrastructure failures as the initial attempt: `pi-runtime.test.mjs` passed 56/57 with the child-worker initialization case ending in `worker_exit`, and `pi-model-bridge.test.ts` passed 17/18 with loopback `listen EPERM` on `127.0.0.1`. Their 75/75 combined recovery run above was on this same product source in an environment that permitted those capabilities. This recheck adds no new product failure and makes no new real-model or browser claim.
