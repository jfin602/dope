# Phase 8C — Sequential execution closeout

Status: **GREEN / QUALIFIED / CLOSED** for the approved Phase 8C scope on the exact candidate below.
Date: 2026-10-06 project date; direct evidence captured 2026-10-07 UTC.
Assigned version: `0.8.20`.

## Exact candidate and retained implementation

The pre-P7 HEAD is `6b0371a4fdddbc07be6f4abc1fef3ec87c6aacae`. P7 is an uncommitted working-tree candidate at coherent `0.8.20`; its final tracked-tree fingerprint is recorded under Automated T3 below. The final-source qualification fixture is `/home/jfin/.cache/dope-p8c-qualification/final-candidate-project/`, and the authorized account profile is `/home/jfin/.cache/dope-p8b-post-qualification/app-profile/`. Both are outside the product repository. No fixture Git history was written into the Dope repository.

P1–P6 are committed as `3878aab` (`0.8.14` import/domain), `1985b27` (`0.8.15` persistence/reconciliation), `fe11910` (`0.8.16` execution/retry), `b6e046c` (`0.8.17` dirty basis/checkpoint), `453ed28` (`0.8.18` manual gates), and `f6da8ec` (`0.8.19` UI). Their commit descriptions report focused validation but leave live sequence, checkpoint, browser and restart proof to P7. The separate `6b0371a` commit is the retained corrected Phase 8B requalification source; it does not replace the Phase 8C evidence below.

Three narrow P7 repairs were necessary: Phase Stack now requires one exact validation command and a passing observed result before a task can checkpoint; the Codex mutation adapter resolves standalone Node 24 for its sandbox network preflight under Electron instead of invoking the Electron binary as Node; and the sequence coordinator links a durably created failed-start AgentRun to its sequence. The native startup failures before the Node repair remain preserved in the disposable fixture and are not counted as successful attempts.

## Automated T3

| Gate | Exact-candidate result |
| --- | --- |
| Focused p8c/agent sequence, import, store, runtime, checkpoint, manual-gate, Git, Codex and UI tests | PASS, 79/79 |
| `npm run check` | PASS: typecheck; runner 103/103, baseline 11/11, local install 1/1, product 327/327 plus 28/28, IDE 1/1; browser and Electron builds |
| `npm run codex:phase:validate -- p8c` | PASS: P1–P7 grammar, versions, model and Browser metadata |
| 13 live package manifests, internal `@dope/*` references, forbidden root npm locks, `git diff --check` | PASS: all 13 at `0.8.20`, all internal references exact, no root npm lock, clean whitespace check |
| Tracked working-tree SHA-256 | `3674d98d99d1f214c07847ad9cc0b97890dd00a5c371b406c87edf7babf430f3` |

The focused command was:

```sh
node --test test/unit/agent-core.test.ts test/unit/agent-sequence.test.ts test/unit/agent-sequence-persistence.test.ts test/unit/agent-execution-workspace.test.ts test/unit/agent-execution-runtime.test.ts test/unit/agent-checkpoint.test.ts test/unit/agent-manual-gate.test.ts test/unit/agent-git-evidence.test.ts test/unit/agent-store.test.ts test/unit/agent-run-ui.test.ts test/unit/phase-stack-ui.test.ts test/unit/codex-agent-execution.test.ts
```

The tracked-tree fingerprint hashes every `git ls-files` path and its current bytes in sorted order with length prefixes; it excludes this new closeout and its PNG evidence. The first focused run passed 76/77; one existing multi-run validation test hit an active-run timing race and passed its isolated rerun. The first `npm run check` stopped on `theia-baseline.test.ts` still expecting historical `0.8.13`. P7 updated that guard to `0.8.20`; its 3/3 focused assertions then passed and the second full check passed (runner 103/103, baseline 11/11, local install 1/1, product 327/327 plus 28/28, IDE 1/1, browser and Electron builds). Those earlier failures remain part of the record; the final aggregate after all P7 code repairs is reported in the table.

## Direct hosted sequence and checkpoint evidence

A clean disposable Git workspace began at `c365e7635ed5ddcfc5cab40ca007b0a4f950dd65`, version `0.8.13`. Its copied `p8c` continuation stack follows the real grammar and version/checkpoint laws: P1 `0.8.14`, P2 `0.8.15`, browser-required P3 `0.8.16`, final manual P4 `0.8.17`. The real Electron Phase Stack view imported fingerprint `a4ad3923d4f5c397fb365ea4315dc610762b13f21b8f031039ec3ebc39d8d864`; it displayed each full prompt, `GPT-6 Sol High` recommendation, `high` reasoning, target version and Browser flag. [Imported view from the first live pass](evidence/imported-stack.png).

The retained AI Center profile completed a fresh real Test Connection with a signed-in ChatGPT-plan Codex connection, a ready hosted agent-execution inventory, and exact Coding Agent target `gpt-5.6-terra` with no fallback. The imported Sol recommendation remained snapshot metadata; the actual model was Terra according to the configured Coding Agent role. In the first live pass, four UI attempts failed closed at native sandbox preflight (`17`) before a hosted turn, validation, promotion or commit. That pass subsequently completed, but a failed-start bookkeeping guard landed afterward. The entire happy path was therefore repeated in a fresh repository on the final source. Its first Start failed before AgentRun creation because the new Electron process had `unknown` connection health; real Test Connection made it ready. No project bytes or Git history changed during that preflight failure. The following table and gate evidence are from the final-source run.

| Entry | AgentRun and direct result | Checkpoint |
| --- | --- | --- |
| P1 | `d88a4c40-333d-4dbc-9b94-14f096f73734`: hosted run completed; `./validate.sh` observed passed in the ExecutionWorkspace; CandidateDelta had four `modify` effects; Dope Authority allowed and promoted exactly those four files; pre-checkpoint HEAD remained baseline. | `3e2f52b67f7b7c5c4af49578a1c8f84d7bd64256`, subject `0.8.14`, author `Dope`; exact paths: `apps/browser/package.json`, `package.json`, `packages/core/package.json`, `state.txt`. Sequence advanced only to P2. |
| P2 | `df92989d-73fd-463d-8ae9-b0416dc7a4f6`: hosted run completed; the same required validation passed; CandidateDelta had four `modify` plus `summary.txt` `create`; Authority promoted exactly five files; pre-checkpoint HEAD remained P1. | `603f7cf7ee97f3ff0a8bf740aa021b3fe1e07fab`, subject `0.8.15`, author `Dope`; exactly the five promoted paths. Sequence advanced only to P3 and stopped. |

Both Dope commit bodies identify the task/run, passed validation, applied paths and accepted-dirty scope from Dope evidence, with no provider final response. The model had no authoritative project or Git-write path: it wrote an isolated ExecutionWorkspace, and Dope classified CandidateDelta, promoted permitted bytes, then staged and committed the verified scope. The fixture kept `.dope/agent/**` untracked; neither Dope checkpoint contains runtime state. The first live pass also completed P1/P2 with SHAs `f4f0a26a7ce8b5ad0b645285278f39098828c92e` and `1eff67378de0652b9bc04775dfdf0dc19c7d9cff`; its [running](evidence/p1-running.png) and [gate](evidence/p3-manual-gate.png) screenshots are retained historical evidence, not the final candidate's checkpoint IDs.

## Browser/manual gate and restart

P3 displayed the exact 628-character imported prompt snapshot and was never sent to Coding Agent. Clicking **External completion: reconcile gate** before external work left P3 `waiting-manual`, with no new run or commit. A real Electron process restart reopened the same P3 gate, both checkpoint SHAs and queued P4; HEAD and the two existing run directories did not change. [Final-source reopened gate](evidence/final-candidate-restarted-gate.png). The first pass's [reopened gate](evidence/p3-after-restart.png) remains separate historical evidence.

The external P3 operation updated root/workspace/internal versions and `state.txt` to `0.8.16`, passed `./validate.sh`, and made one clean Git commit, `e3f6eedc64a2085fb12e31f476cd847db7475946`, with subject `0.8.16`. Dope re-read Git, version, worktree and stack fingerprint, recorded that SHA without making another commit, and stopped at the final P4 manual gate. After external `0.8.17` validation and clean commit `a504eb19980a08545907294cc8fecf14b07a91ac`, Dope reconciled to `completed` with four checkpoints and current entry 5. [Final-source completed view](evidence/final-candidate-completed.png). The first live pass also reached its [final gate](evidence/p4-final-gate.png) and [completed view](evidence/sequence-completed.png), using different Git SHAs; another backend reconcile rejected its completed gate without adding a commit.

## Direct failure and safety matrix

| Case | Observation |
| --- | --- |
| Validation failure | Real hosted run `79160911-87a0-463f-b127-e80c0671ee1b` recorded failing `./validate.sh` and a `modify:state.txt` candidate; zero applied files, no checkpoint, P1 blocked `validation-failed`, original bytes and HEAD intact. |
| Cancellation | Real hosted run `f38ae928-18c8-4f8a-aaaa-49388c33fbf5` was stopped after a workspace file change; persisted `cancelled`, no applied files/checkpoint/advance, authoritative bytes and HEAD intact. |
| CandidateDelta authority block | Real hosted run `5ecb689d-cc68-425f-9c20-d01e90c60fb8` proposed `delete:keep.txt`, with passed validation; Authority denied the whole delta, applied zero files, no checkpoint/advance, original tracked bytes and HEAD intact. |
| Capacity failure | Three controlled production-runtime/Git integration fixtures passed: one narrow capacity retry reused the same AgentTask and ExecutionWorkspace with partial candidate work and no interim promotion; four-attempt exhaustion blocked with no authoritative effect; Stop during wait and non-capacity failure did not retry. No spontaneous hosted capacity response occurred. |
| Unexpected HEAD before checkpoint | Controlled real-Git run `980bd82f-9635-4269-88f2-9dc9e7e26f5e` completed promotion, then an external empty commit moved HEAD from `8c6e43ec30a34367970fa5c8f4c3dcec149723cf` to `134c4e2eab8ec75df6cb619e26618559ef4caca5`. Dope blocked `head-drift`, made no checkpoint and did not reset or repair history. |
| Explicit dirty continuation | Real hosted run `a555039d-4b4c-4279-a10e-45ef440fc788` accepted exact untracked `notes.txt` as the pre-task basis, promoted only three task effects, passed validation, and Dope checkpointed exactly `notes.txt` plus those effects as `f56dde0014503c4016907509766371ba99268916` (`0.8.1`). |
| Later unrelated dirty change | Real hosted run `6546739a-7cea-4b2a-9ddf-a07cba963187` completed with accepted `notes.txt` and passing validation; adding unrelated `ambient.txt` after promotion made checkpoint fail `Unaccepted ambient change`, left P1 `checkpoint-failed`, HEAD unchanged and zero checkpoints. |
| Stack source changed after import | Disposable copy edited P4 source after import; backend attachment and gate reconciliation both remained blocked `source-drift`, retaining the snapshotted prompt and checkpoint prefix. |
| Persisted sequence versus Git | An external extra HEAD commit on a copied completed-prefix fixture blocked `head-drift` without rewriting sequence state; a deliberately corrupt sequence file was separately rejected untouched by the strict store parser. |
| Manual evidence mismatch | Separate real-Git copies with a `0.8.17` subject but wrong version, a wrong subject, and uncommitted work blocked as `version-mismatch`, `head-drift`, and `worktree-drift`; none advanced or made a Dope commit. |
| Verified checkpoint restart and runtime-state scope | Real Electron restart kept P1/P2 SHAs and the same P3 gate without auto-run. Reconciliation recorded external gate SHAs once, rejected duplicate terminal reconciliation, and all Dope checkpoint trees excluded `.dope/agent/**`. |

A scan across 43 persisted task/run/event/sequence files from the first happy and adversarial fixtures, plus all seven final-source files, found zero access/refresh-token, Authorization/Bearer, hidden-reasoning, arbitrary environment, or private absolute-path patterns. The largest final-source file was 6,293 bytes and largest event line 189 bytes; candidate and applied paths were project-relative. These are bounded observations, not a claim about every possible provider payload.

## Residuals and decision

The exact capacity pathway was qualified through controlled adapter fault injection because a genuine hosted capacity response could not be induced safely; there is no observed live 429. The restored profile exposed Terra, not a GPT-6 Sol agent target, so the live task's actual model differed from the imported recommendation while the prompt's model/reasoning metadata remained intact. Native startup failures before the standalone-Node repair, the final-source preflight failure from unknown connection health, and the first automated failures above remain preserved. The native repair requires a real Node 24 executable on PATH and fails closed if absent.

**Decision: GREEN / QUALIFIED / CLOSED for Phase 8C** on the exact final candidate. The qualified scope is one sequential phase stack over ADR 0028 promotion and Dope-owned checkpoints, including explicit dirty continuation, manual gates and restart reconciliation. Route next to a fresh **Phase 8D General Scoped Delegation docs review**. Do not implement 8D from this closeout.
