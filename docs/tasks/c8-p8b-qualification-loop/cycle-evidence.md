# Phase 8B qualification loop evidence

Date: 2026-10-06.
Version remains `0.8.13`.
Maximum cycles: 5.

## Retained P7 baseline

- Decision: **Not Green / Not Qualified**.
- Reported P7 base HEAD: `3fb5609e5e442939bccdb52daf107a40c6e4dfc9`.
- Reported tracked candidate SHA-256: `0932c62f137ae22e4d058cc6b739ba2ba986bc9efefe9fade9e634c4d518f450`.
- Focused automated suite: 63/63 pass.
- Aggregate `npm run check`: pass after repairing the stale baseline version assertion.
- `npm run codex:phase:validate -- p8b`: pass.
- Version/internal-reference/no-root-lock/diff checks: pass.
- Installed reference CLI at P7: `codex-cli 0.155.1`.
- Disposable mutation fixture HEAD remained unchanged.
- Real sandbox preflight failed before auth/App Server spawn with a bubblewrap executable/path startup error.
- All five denied probes returned `unsupported-capability` before an executing harness existed.
- Native Agent Run UI opened, but Start was disabled because the disposable profile had no eligible Codex target.
- No live mutation, validation, cancellation, active-run restart or persisted live-run security evidence exists.

This file is append-only qualification evidence. Do not rewrite earlier failed cycles into Green after a later repair.

## Pre-Cycle 1 actual-checkout record

Recorded before editing on 2026-10-06 UTC:
- Actual HEAD: `12a74ccd76813c9466a2796295f4baef328c5612` (`main`); `git status --short --branch` was clean and `git diff HEAD` was empty.
- Current tracked working-tree SHA-256 by the P7 eight-byte big-endian length/path/content method: `309a7f17d500f87c7d9282b00bdbc7750ea513b0798935c44b78c09983220ae8`.
- No untracked repository files. The P7 candidate is preserved by `031a095` (`p7 not green`), followed by the docs-only loop setup commit `12a74cc`. Those tracked docs and the P7 closeout/screenshot explain the difference from the historical pre-closeout P7 fingerprint `0932c62...`; no candidate was reset or recreated.
- All 13 root/workspace package manifests and live internal `@dope/*` references are coherent at `0.8.13`; neither root `package-lock.json` nor root `npm-shrinkwrap.json` exists.
- Installed CLI: `codex-cli 0.155.1`. Launcher `/home/jfin/.local/bin/codex` is a symlink to a standalone static ELF at `/home/jfin/.codex/packages/standalone/releases/0.155.1-x86_64-unknown-linux-musl/bin/codex`.
- Exact reproduced argv on a newly created clean Git fixture: `codex sandbox -P dope_run -C /tmp/dope-c8-probe-9ztg8jr4/project /bin/sh -c 'printf allowed > allowed'`. The config was the current `mutationConfig(root)` under a fresh `CODEX_HOME`; exit 1, no allowed file, stderr: `bwrap: execvp /home/jfin/.codex/packages/standalone/releases/0.155.1-x86_64-unknown-linux-musl/bin/codex: No such file or directory`. This is payload/bootstrap exec visibility, after argument parsing and profile resolution, before `/bin/sh` executes.

Do not reset/discard the current candidate to force it to match the historical base. Explain any expected docs/checkpoint drift.

## Cycle 1 — stopped at an authority architecture gap

- Pre-cycle candidate: clean `12a74ccd76813c9466a2796295f4baef328c5612`, tracked-tree SHA-256 `309a7f17d500f87c7d9282b00bdbc7750ea513b0798935c44b78c09983220ae8`.
- First blocker: the real Codex sandbox bootstrap cannot execute its own resolved binary under the existing `:root = "deny"` profile.
- Direct reproduction: the disposable clean Git fixture and exact argv above reproduced the P7 `bwrap: execvp` failure. The fixture is separate from the Dope repository.
- Diagnosis: `codex sandbox --help` for installed 0.155.1 requires `-P/--permission-profile`; `-C` selects the working directory. Minimal `-P :read-only` and `-P :workspace` commands both executed `/bin/sh` with the same disposable `CODEX_HOME`. The current named `dope_run` profile parsed successfully. Removing `:root = "deny"` in a **temporary fixture config** starts the sandbox but broadens outside reads. Replacing it with `:root = "read"` also starts. The narrow variant keeping `:root = "deny"` and adding an exact `read` rule for the resolved Codex ELF starts successfully. The launcher symlink itself is outside the sandbox's minimal readable paths; bubblewrap reports the resolved ELF, not Node or `/bin/sh`. This is executable mount visibility, not CLI syntax, project trust or an App Server protocol failure.
- Current provider contract checked: official [Permissions](https://learn.chatgpt.com/docs/permissions) documents `:root`, `:minimal`, named profiles, exact-path reopen rules, workspace-root protections and disabled network; [Advanced Config](https://learn.chatgpt.com/docs/config-file/config-advanced) and [Config Reference](https://learn.chatgpt.com/docs/config-file/config-reference) define `writable_roots`, `/tmp`/`TMPDIR` exclusions and `network_access`; [App Server](https://learn.chatgpt.com/docs/app-server) documents thread/turn start and `turn/interrupt`; [ChatGPT-plan App Server integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) requires the supplied access token and forbids inferring entitlement from model inventory alone. Installed help and source were checked before any profile experiment. No installed version or protocol was changed.
- Direct executing probe: a **second newly created clean Git fixture** at `/tmp/dope-c8-enforcement-cuj6m7ig/project` used the unchanged profile plus only the exact resolved-ELF `read` rule in its disposable config. The one sandboxed shell run reported `project_write=yes`, `outside_read_denied=yes`, `outside_write_denied=yes`, `private_read_denied=yes`, `private_write_denied=yes`, `git_write_denied=yes`, `project_env_read_denied=yes`, `project_env_write_denied=yes`, `token_env_absent=yes`, `network_denied=yes`, `system_write_denied=yes`, **`destructive_project_delete_denied=no`**. It deleted the tracked `destructive-canary` inside the writable project. Outside/private canaries and `.git/config` remained intact; starting/final HEAD matched. The `/proc/$PPID/environ` path was readable, although a follow-up non-secret marker check did not find the `ACCESS_TOKEN` marker there. This does not establish a complete credential-isolation proof.
- Architecture diagnosis: the fixed grant simultaneously allows arbitrary workspace writes and denies destructive effects. The installed filesystem/network profile can distinguish paths and network access, but the executing probe shows it does not distinguish deleting a writable project file from an allowed edit. The current adapter's deterministic preflight explicitly tests this and would still fail at its destructive-canary check after an executable-visibility repair. A command-level effect classifier/mediated execution boundary would be a material new authority architecture, outside this bounded repair loop. Do not make the startup-only profile edit or weaken `destructive = false` to get a live model run.
- Repair: none committed. The existing product remains fail-closed at preflight. Only qualification evidence and disposition docs change.
- Focused validation: direct installed-CLI profile bisection and executing disposable sandbox probe above. `git diff --check` passed, `npm run codex:phase:validate -- p8b` passed, all 13 manifests/internal references are `0.8.13`, and no root npm lock exists. No product/test source changed, so the retained P7 63/63 focused and passing aggregate checks remain historical evidence; they are not a substitute for live gate qualification. The broad `npm run check` was not repeated for a docs-only checkpoint.
- Direct replay: executable startup was proven in the temporary narrow-profile variant, but full Gate 1 **failed** because destructive project deletion succeeded. No model/App Server task was started.
- Cleared gates: none of the seven full direct gates. The startup sub-defect has an exact diagnosis and a bounded candidate remedy, but Gate 1 remains blocked.
- Next blocker: Phase 8B grant enforcement needs a fresh architecture decision that can mediate or reliably prohibit destructive project effects while allowing bounded edits. Eligible target, live mutation, five-class live authority, cancellation, active-run restart and persisted-run security remain untested.
- Candidate/checkpoint: this evidence-only Cycle 1 is checkpointed under the prescribed `c8-p8b-qualification-loop/cycle-1` commit subject; no source repair or version change.
- Decision after cycle: **STOPPED / NOT GREEN / NOT QUALIFIED**. Do not spend Cycles 2–5 repeating the same architectural gap or activate Phase 8C.

## Cycle 2

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 3

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 4

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 5

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Final disposition after architecture-gap stop

- Exact final candidate: unchanged product/test source at `0.8.13`; the evidence-only Cycle 1 checkpoint commit is identified by its subject `c8-p8b-qualification-loop/cycle-1: document sandbox authority gap` and final `git rev-parse HEAD`.
- Focused 8B suite: retained P7 63/63 pass; no source changes made in Cycle 1.
- `npm run check`: retained P7 pass on the unchanged product/test source; not rerun for docs-only Cycle 1.
- `npm run codex:phase:validate -- p8b`: pass in Cycle 1.
- Version/internal-reference/no-root-lock: pass, 13 manifests at `0.8.13`, no root lock.
- `git diff --check`: pass before Cycle 1 checkpoint.
- Real sandbox startup: existing profile fails; temporary exact-executable read allowance starts.
- Real happy-path mutation: untested; full grant fails before App Server execution.
- Live denied-class enforcement: temporary executing sandbox denied tested network, outside/private, Git and system writes but **allowed destructive deletion of a project file**. The five-class gate is not Green.
- Live cancellation: untested.
- Live restart interruption: untested.
- Persisted-run security/reopen: untested; no live AgentRun exists.
- Residuals: material authority architecture gap for destructive project effects; eligible live target remains absent/unqualified; subsequent gates not reached.
- Final Phase 8B decision: **NOT GREEN / NOT QUALIFIED**. Phase 8C is not eligible.


## Post-correction requalification template

Use this section only after `c8-agent-authority-boundary` has finished. The historical Cycle 1 above remains immutable evidence and does not consume the fresh post-correction five-cycle budget.

### Post-correction pre-cycle baseline — 2026-10-06

- Entry source: clean `468aa1c74bbc49caf8f69a25d6f7ae725c2d2331` (`correction 1`); `git diff HEAD` was empty. The tracked-tree SHA-256 by the retained P7 path/length/content method was `5751884bb292bcf78970dd944a47b655b10d0b377062e753d0973b4e548c8ce0`.
- ADR 0028 remains accepted. Source inspection found the separate `ExecutionWorkspace`, deterministic `CandidateDelta`, fixed create/modify-allowed and delete/rename-denied `ExecutionGrant`, Dope-owned promotion executor, and distinct run candidate/authority/applied evidence. Agent Runtime passes the isolated workspace root to the Codex adapter as execution cwd. It accepts only a direct 8B task; no AgentTaskSequence execution or 8C checkpoint behavior was found.
- All 13 root/workspace manifests and live internal `@dope/*` references are exactly `0.8.13`. No root `package-lock.json` or `npm-shrinkwrap.json` exists. `git diff --check` passed.
- Installed Codex is `codex-cli 0.155.1` via `/home/jfin/.local/bin/codex`, resolving to the standalone 0.155.1 ELF. Installed `codex sandbox --help` and `codex app-server --help` were inspected. Current official provider configuration, App Server, and ChatGPT-plan App Server documentation were checked before provider integration work; no CLI upgrade or billing fallback was made.
- New disposable clean Git repository: `/tmp/dope-p8b-post-7gmxhn/project`, starting HEAD `1b3047d62d757dc15bdf8a95e771f20880b43821`. A separate disposable application configuration/profile was created under `/tmp/dope-p8b-post-7gmxhn/app-profile`. The Dope repository is not a live mutation target.
- Focused correction build and tests passed: agent-core and Theia extension builds; 36/36 tests across agent-core, execution workspace, execution runtime, and Codex adapter. The browser bundle was also built with zero errors for direct UI qualification.

### Post-correction direct Gates 1–2 — Cycle 1

- Gate 1: `ExecutionWorkspace.create()` made a separate canonical clone of the disposable Git repository. The installed Codex 0.155.1 executable started under the generated `dope_run` profile; the production `verifyInstalledSandbox()` preflight passed. A second direct `codex sandbox -P dope_run -C <execution workspace>` shell probe modified `state.txt`, created `created.txt`, and deleted `keep.txt` inside that workspace. The resulting Dope delta was create + delete + modify. Before promotion, authoritative `state.txt` remained `status=baseline` and authoritative `keep.txt` remained byte-for-byte `keep\n`. Workspace deletion succeeded as allowed candidate work.
- The executing sandbox probe denied tested outside-workspace and private-canary reads/writes, direct and symlink/parent-root paths to the authoritative project, `.git/config` writes, a system `/etc` write, and a local network listener. A marker `ACCESS_TOKEN` was absent from model-directed shell. The production preflight separately tested `.env`, private HOME config, and Git-control symlink access. No authoritative project path was passed as writable provider cwd. Gate 1 is Green for the tested 0.155.1 host profile.
- Gate 2: seven fresh clean Git fixtures directly exercised Dope's `ExecutionWorkspace.delta()` and `promote()` without provider narration. Modify-only and create+modify deltas were classified and promoted exactly; fixture HEADs remained fixed and the index stayed empty. A delete candidate, conservative rename as create+delete, and mixed modify+delete candidate were each fully blocked with zero authoritative files applied. An owner edit after basis capture failed closed. A workspace symlink and an authoritative symlink parent each failed before apply. All seven direct fixture assertions passed. The focused execution-workspace tests additionally passed 5/5.
- Gate 3: The first sign-in browser crashed; a fresh authorization request completed in Firefox. The disposable AI Center profile showed a signed-in ChatGPT-plan account, four real discovered Codex models, and a ready connection after Test Connection. The Coding Agent role was set to the exact `gpt-5.6-terra` model with no fallback; Agent Run resolved that hosted target and enabled Start only after task fields and grant acceptance. The earlier scratch Test Connection used its then-default Astra model before the owner's correction. No mutation run used Astra. All subsequent qualification inference uses Terra. Gate 3 is Green for that observed session.

### Post-Correction Cycle 1

- Pre-cycle candidate: clean `468aa1c74bbc49caf8f69a25d6f7ae725c2d2331`; tracked-tree SHA-256 `5751884bb292bcf78970dd944a47b655b10d0b377062e753d0973b4e548c8ce0`.
- Entry-gate correction verification: ADR 0028 isolated execution and Dope-owned promotion structure, exact `0.8.13` versions, no root lock, and no Phase 8C execution were confirmed above.
- First blocker: Gate 4 real Terra Agent Run stopped at provider startup before a model turn. Its durable run `da5c4991-5f6a-4fe3-9e43-36a20f208221` ended `failed` with `provider-error` / `Agent start failed`, no changed files, no validation, and no promotion; authoritative HEAD was unchanged.
- Direct evidence: The production sandbox preflight passed. A direct adapter replay returned sanitized `Codex request failed`; an isolated exact App Server RPC probe identified `thread/start.runtimeWorkspaceRoots requires experimentalApi capability` (`-32600`). This was a protocol handshake error, not a model or authority denial.
- Diagnosis: The execution adapter sent the experimental `runtimeWorkspaceRoots` field at `thread/start` but omitted `capabilities.experimentalApi: true` at `initialize`. The installed 0.155.1 App Server rejected the request. The 8A read-only Test Connection does not use that field.
- Repair: Add the experimental capability handshake only to the 8B Codex execution adapter. Make the fake App Server reject a missing handshake and assert the capability in the focused adapter test. No sandbox/grant/promotion semantics changed; version remains `0.8.13`.
- Files changed: `packages/theia-extension/src/node/codex-agent-execution.ts`, `test/unit/codex-agent-execution.test.ts`, and this evidence file.
- Focused validation: Theia extension build passed; focused Codex execution adapter tests passed 11/11. A real installed-CLI Terra smoke turn in a disposable ExecutionWorkspace then started and completed without tools. No Astra was used for this replay.
- Replay result: The exact startup failure cleared in direct live App Server execution. On restarting Dope for the native UI replay, AI Center lost its in-memory readiness observation; two model-catalog refresh attempts failed. A direct authenticated `/v1/models` probe timed out, while the direct Terra inference succeeded. The native Gate 4 mutation/promotion replay remains pending.
- Cleared gates: Gate 1 isolation/sandbox, Gate 2 CandidateDelta/authority promotion, Gate 3 eligible live Terra target in the earlier ready UI session; Gate 4 startup protocol defect repaired and smoke-tested.
- Next blocker: Gate 4 native UI replay requires a successful live model-catalog refresh/readiness observation after the backend restart. This is an observed catalog transport timeout; its persistence and impact on qualification need the next cycle's direct observation.
- Candidate/checkpoint: normal Cycle 1 checkpoint commit recorded below.
- Decision after cycle: Not Green / Not Qualified; continue from Gate 4 within the five-cycle budget.

### Post-Correction Cycle 2

- Pre-cycle candidate:
- First blocker:
- Direct evidence:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Replay result:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

### Post-Correction Cycle 3

- Pre-cycle candidate:
- First blocker:
- Direct evidence:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Replay result:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

### Post-Correction Cycle 4

- Pre-cycle candidate:
- First blocker:
- Direct evidence:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Replay result:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

### Post-Correction Cycle 5

- Pre-cycle candidate:
- First blocker:
- Direct evidence:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Replay result:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

### Post-Correction Final Exact-Candidate Gate

- exact final candidate:
- ExecutionWorkspace isolation:
- coarse host sandbox:
- CandidateDelta classification:
- create/modify authoritative promotion:
- delete/rename/mixed-candidate full block:
- eligible live Codex target:
- real hosted mutation/validation/promotion:
- live cancellation without promotion:
- active-run restart interruption without promotion:
- persisted-run security/reopen:
- focused suite:
- npm run check:
- p8b validator:
- version/no-root-lock/diff:
- residuals:
- final Phase 8B decision:
