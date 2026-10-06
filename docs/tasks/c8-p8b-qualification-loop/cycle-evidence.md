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

### Post-Correction Cycle 1

- Pre-cycle candidate:
- Entry-gate correction verification:
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
