# Phase 8B — Agent execution core closeout

Status: **Not Green / Not Qualified** (P7, 2026-10-05 project date; evidence captured 2026-10-06 UTC).

## Exact candidate

- Assigned version: `0.8.13`. All 13 live package manifests and internal `@dope/*` references agree.
- Pre-P7 HEAD: `3fb5609e5e442939bccdb52daf107a40c6e4dfc9` (`0.8.12`). P7 changes are uncommitted as required, so there is no commit SHA for the `0.8.13` candidate.
- Exact tracked working-tree SHA-256 after the README status update: `0932c62f137ae22e4d058cc6b739ba2ba986bc9efefe9fade9e634c4d518f450`. Reproduce by iterating `git ls-files -z` in order and hashing, for each path, its eight-byte big-endian UTF-8 path length, path bytes, eight-byte big-endian file length, and file bytes. The only change after the passing checks was the README closeout status; it did not change product or test source. This closeout and its screenshot are new, untracked evidence files and were not inputs to that fingerprint.
- Installed reference CLI: `codex-cli 0.155.1`. Mutation fixture: newly created clean repository `/tmp/dope-p8b-p7-loMRAW`, starting and final HEAD `cf9997eb1cb16816b0220c03e2e5cb784080d3e3`; tracked `state.txt` and `validate.sh` were prepared for a bounded edit/validation task.

## Automated T3

| Evidence | Result |
| --- | --- |
| Focused `node --test` over agent-core, store, Codex adapter/auth/App Server, execution runtime, Git evidence, Agent Run UI, and Electron restart tests | **63/63 pass**. The generic Electron restart test passed; it does not prove restart of a live AgentRun. |
| `npm run check` on the repaired exact candidate | **Pass**: typecheck; runner 103/103, baseline 11/11, local-install 1/1, product 305/305 plus 28/28, IDE 1/1; browser and Electron builds completed with zero build errors. |
| `npm run codex:phase:validate -- p8b` | **Pass**; P7 is recognized as the manual browser closeout at `0.8.13`. |
| Manifest/internal-reference, no root npm lock, `git diff --check` | **Pass**; 13 manifests coherent, no root `package-lock.json` or `npm-shrinkwrap.json`, no whitespace errors. |

The first `npm run check` attempt failed because `test/unit/theia-baseline.test.ts` still asserted `0.8.6`. P7 updated that version guard to `0.8.13` and included the new `agent-core` manifest. Its focused test passed 3/3; the subsequent full `npm run check` passed. No product execution code was changed in P7.

## Direct native and browser evidence

The real installed `codex sandbox -P dope_run -C <disposable repo>` could not launch its sandboxed child. Its stderr reported `bwrap: execvp .../codex: No such file or directory`; the command exited 1 before the first allowed fixture write. The private, outside-root, Git, and project canaries remained unchanged. The production `CodexAgentExecutionAdapter.start()` path, using its real sandbox preflight and installed CLI, returned `unsupported-capability: Codex sandbox cannot enforce the accepted grant`; authentication calls and App Server child spawns both remained **zero**. This is a fail-closed refusal, not proof that an executing harness enforces the grant.

The newly built source Electron application was launched with a fresh disposable application profile and the disposable repository. Via the real workbench browser, **Dope: Open Agent Run** opened. The view showed the default allow/deny grant, accepted the checkbox, and still disabled **Start** because the profile had **no eligible Coding Agent target**. There were zero runs. [Browser screenshot](evidence/p7-agent-run-blocked.png) records the visible view; the DOM inspection also confirmed the checked grant, disabled Start, and zero run entries. The existing user application registry likewise contained no Codex connection. No ChatGPT-plan account was provisioned for this disposable profile after the sandbox preflight failed.

## Direct happy path and change truth

**Not executed.** No mutation-capable AgentTask could start safely: the adapter rejects the grant before authentication/spawn, and the fresh UI profile has no eligible target. Consequently there is no observed completed run, agent/command/file activity, validation result, changed-file summary, or persisted restart inspection to compare with filesystem truth. The fixture stayed clean, `state.txt` stayed `status=baseline`, and its HEAD did not move; this verifies only the refusal path. No agent or Dope stage/commit occurred.

## Authority adversarial results

Five controlled direct adapter requests against the disposable repository attempted the following denied classes. Each returned `unsupported-capability` at the same real sandbox preflight, before authentication or App Server spawn. Before/after hashes of the private, outside-root, `.git/config`, and project canaries matched; HEAD and `git status --porcelain` were unchanged.

| Denied class requested | Observed result | Qualification limit |
| --- | --- | --- |
| Network | Preflight unsupported; zero App Server child spawns or effects | No executing-network denial was observed. |
| Outside-project read/write | Preflight unsupported; outside canary unchanged | No executing filesystem denial was observed. |
| Private HOME/credential-like access | Preflight unsupported; private canary unchanged | No executing private-state denial was observed. |
| `.git` / history-control mutation | Preflight unsupported; `.git/config` and HEAD unchanged | No executing Git-control denial was observed. |
| Destructive/system/package-administration effect | Preflight unsupported; project canary unchanged | No executing destructive/system/package-admin denial was observed. |

The adapter produced a typed unsupported error, but these direct adapter probes did not create a durable AgentRun or an `authority-denied` event. The P3 source and commit already record that the installed sandbox has not proved a distinction between permitted workspace writes and prohibited destructive actions inside that workspace. Neither prompt instructions nor unchanged canaries after a rejected preflight satisfy the required live enforcement claim. The default grant was not relaxed.

## Cancellation, restart, and security

**Cancellation and active-run restart interruption remain untested.** The second and third live tasks could not start. There is therefore no evidence of `cancelling -> cancelled/interrupted`, stopped provider process with no later effects, preservation of a pre-stop edit, or reconciliation of a live run on fresh backend ownership. The 63 passing focused tests include simulated adapter cancellation and generic Electron restart behavior; those are narrower than P7's direct claims.

The disposable repository has no `.dope/agent/` task/run/event files because no run started. The browser view exposed no token, hidden reasoning, environment dump, or sensitive private path; the direct adapter preflight made no authentication call and spawned no App Server. Those observations do **not** qualify the security of persisted live run/events, provider payload bounds, logs during a hosted task, or recovery metadata after restart. A live security/persistence inspection remains required.

## Decision and next route

**Phase 8B is Not Green / Not Qualified on this exact `0.8.13` candidate.** Automated and presentation checks pass, and the reference adapter fails closed when its required sandbox cannot start. The required mutation, authority-enforcement, cancellation, restart, and persisted-security evidence is absent. The missing eligible Codex target is a separate live-qualification prerequisite. Keep Phase 8C sequential task/phase-stack planning gated on a fresh 8B qualification; do not add AgentTaskSequence, dirty-tree continuation, or checkpoint commits through this closeout.

## Supplemental Cycle 1 disposition — 2026-10-06 UTC

**Decision remains NOT GREEN / NOT QUALIFIED.** The historical P7 record above is retained unchanged. The clean pre-cycle checkout was `12a74ccd76813c9466a2796295f4baef328c5612`, whose tracked-tree SHA-256 was `309a7f17d500f87c7d9282b00bdbc7750ea513b0798935c44b78c09983220ae8` using the P7 method. The P7 candidate had already been checkpointed in `031a095`; subsequent tracked closeout/loop docs explain why the present fingerprint differs from the historical uncommitted P7 fingerprint. Product source remains at `0.8.13` with no Cycle 1 code repair.

Cycle 1 proved the `bwrap: execvp` startup error comes from `:root = "deny"` hiding the resolved standalone Codex executable. A disposable profile with an exact read rule for that ELF started successfully. The executing sandbox then allowed a normal project write **and deletion of a tracked project file**. It denied the tested outside/private canaries, `.git/config`, `.env`, network attempt and system write; HEAD stayed fixed. The deletion directly violates the default grant's denied destructive class. The current adapter preflight would reject this profile after startup, so its fail-closed behavior remains appropriate.

No live eligible target, model mutation, five-class executing authority result, cancellation, active-run restart or persisted-run security/reopen was qualified. The loop stopped after Cycle 1 rather than weakening the grant or improvising a new sandbox architecture. The evidence-only checkpoint and exact probe details are in [Cycle 1 evidence](../c8-p8b-qualification-loop/cycle-evidence.md). A fresh docs/architecture review must resolve how Dope can enforce denied destructive effects while allowing project mutation/processes. Phase 8C is not eligible.

## Supplemental final Green disposition — 2026-10-06

**Decision: GREEN / QUALIFIED** for the corrected direct AgentTask scope at `0.8.13`.

- Qualified product/test source: `bd0b6ff`.
- Docs-only closeout checkpoint: `c11756e`.
- Four of five post-correction cycles were used.
- All eight post-correction qualification gates passed with live agent execution, including authoritative promotion/denial, cancellation, restart interruption and Agent Run reopen.
- Final reported automated evidence: `npm run check` pass; 69/69 focused tests; p8b validator pass; fresh sandbox proof pass; seven direct promotion fixtures pass.
- The earlier P7 Not Green result and original authority-gap Cycle 1 above remain historical evidence and are not erased by this later qualification.
- Phase 8C is eligible for the sequential task / phase-stack implementation slice.
