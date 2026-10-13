# Adaptive SEO Phase Stack qualification — fresh loop

Status: **GREEN / QUALIFIED after Cycle 2 of 5**. The Cycle 1 architecture
stop below is retained as historical evidence; ADR 0029 resolved that boundary
before Cycle 2. Target: `docs/tasks/c4-dope-phase-stack-smoke` at Adaptive SEO
`0.4.7`.

## Cycle 1 — isolated P1 validation

- Dope pre-cycle HEAD: `66a19909dc6a14534d91116dcacae352cc6adae0`.
  Adaptive SEO pre-cycle and final HEAD:
  `0b26a25107be7d8dfb2210bc7258ccac8603197e`. Its accepted ordinary
  dirty basis remained the `.gitignore` edit and untracked `MODULES.md`.
- The live browser build reopened existing sequence
  `1693b3b8-71be-47e9-89c8-35b345dc886e`, P1 current. AI Center's real
  Codex Test Connection returned ready with five usable hosted models. An
  accepted bounded grant and exact `npm run check` were present.
- The first two live retries created independent ExecutionWorkspaces but failed
  before provider start. A temporary backend diagnostic identified the exact
  error as `Node 24 npm executable unavailable`. Theia's Yarn launch had put a
  temporary Node 24 shim before the installed Node/npm pair on backend `PATH`.
  The resolver selected the shim and npm preparation failed. The diagnostic
  was removed. The permanent repair skips Node shims without a verified
  sibling npm installation. The regression test reproduces the PATH ordering.
- After that repair, live hosted P1 AgentRun
  `7eda984b-fa5b-41f1-92dd-e8c86b6e4ed0` started in
  `/tmp/dope-execution-wgS7YV/work`, independently cloned from the
  authoritative `/home/jfin/dev/adaptive-seo-dope` at the exact stated HEAD.
  Provider work modified only `src/client/app/application.tsx` and
  `src/client/styles.css`. The existing dependency-copy strategy supplied a
  real `node_modules` tree and the disposable npm launcher/runtime.
- A read-only process watcher observed the exact required validation as Node
  24 running candidate-local `node_modules/.dope-npm/bin/npm-cli.js run check`.
  Its cwd was the candidate root, its `PATH` included candidate-local
  `.dope-bin`, and candidate `package.json` had SHA-256
  `1beed2d8d4af9a95b48c01d0533658411d1582bd69edf3228a0d5ba06958a307`.
  The candidate's two source hashes at process start match the final
  CandidateDelta. The observed command exited 1 after 9,773 ms; the durable
  AgentRun records one failed `phase-stack` validation, `validationBasis:
  execution-workspace`, and `validation-failed`. It records no bounded stdout
  or stderr. No promotion, authority decision, or checkpoint occurred.
- A source snapshot taken at validation time was reconstructed into a fresh
  ExecutionWorkspace with the same accepted dirty basis and dependencies.
  `npm run check` there, outside the Codex mutation sandbox, passed: format,
  lint, typecheck, 120 unit passes, one documented skip, client build and
  server build. The unmodified authoritative workspace also passed this check
  in the prior loop. Thus the P1 source change itself is not the failing
  condition.
- Running the reconstructed candidate's `npm run test:unit` in the actual
  `dope_run` sandbox failed in
  `test/unit/server/collection-fetcher.test.ts` and
  `test/unit/server/migrations.test.ts` (31/33 test files passed). The migration
  test calls `mkdtemp(os.tmpdir())`; a direct same-profile probe of `/tmp`
  returned `EROFS`. The collection fetcher test starts a loopback HTTP
  fixture; the profile's sandbox preflight explicitly proves loopback listen
  is denied. The current mutation profile denies temp and all network by
  design. Correctly running this project check within that profile requires
  capabilities it intentionally withholds.
- Dope files changed: `packages/theia-extension/src/node/codex-agent-execution.ts`,
  `test/unit/codex-agent-execution.test.ts`, and this new evidence file.
  Focused Codex adapter tests passed 15/15 after rebuilding the extension;
  `npm run build:browser` passed; `git diff --check` passed. The initial test
  attempt before rebuilding compiled source failed two resolver assertions and
  is not counted as final evidence.
- Gates cleared: live P1 provider start, exact candidate command invocation,
  correct cwd/Node/npm/dependency topology, durable failed exit status,
  independently classified two-file CandidateDelta, and no promotion on
  failure. P1 PASS, promotion, checkpoint, P2, P3, P4, restart gates and
  completed reopen remain unproven. P1/P2/P3/P4 checkpoint SHAs: **none**.
- Adaptive SEO remained at version `0.4.7`, with no root `package-lock.json`.
  The local stack is excluded through `.git/info/exclude`; `.dope/agent/` is
  ignored. Neither appears in the Adaptive SEO commit history, and no new
  Adaptive SEO commit was created.

## Cycle 1 stop decision (historical)

The task's architecture stop rule applies. The current provider mutation
sandbox cannot run Adaptive SEO's required validation reproducibly while
retaining its temp and network denials. Moving validation to a Dope-owned
process with a separately justified filesystem/network profile and durable,
bounded stdout/stderr requires a fresh `/docs-review` of the validation
execution boundary. Do not relabel the observed exit 1 as PASS, run the check
against the authoritative project as a substitute, or broaden `dope_run` to
force this stack through. The separate missing-terminal-result case and Agent
Run output visibility also remain unresolved for that review.

## Cycle 2 — Dope-owned candidate validation and complete real stack

- Dope starting HEAD after a normal non-destructive merge of retained local
  implementation with ADR 0029 on origin/main:
  `61cb9c4e9ce444ebf3d1966dca2adf0c2e635db7`. The Cycle 1 Node/npm
  repair at `f04a044ed762ad71e1caa587f69a42cba194690b` and ADR 0029
  both remained in history. Adaptive SEO started at
  `0b26a25107be7d8dfb2210bc7258ccac8603197e`, version `0.4.7`, with
  the accepted `.gitignore` and untracked `MODULES.md` basis intact.
- The repair adds provider-independent `CandidateValidationRunner` in
  `@dope/agent-core`: a frozen non-dependency candidate fingerprint, a
  candidate-derived disposable ValidationWorkspace, Node 24/npm resolution,
  Linux bubblewrap namespaces, private bounded `/tmp` and home, private
  loopback, no host network or private HOME/authoritative project access,
  process-group termination, timeout/cancellation, bounded sanitized output,
  durable terminal result, and post-validation candidate recheck. The
  Codex/provider mutation sandbox was not widened. Provider command
  observations remain command evidence and cannot fulfill CompletionPolicy.
- The focused namespace test proved both `TMPDIR` and hard-coded `/tmp`
  writable in the validation namespace, an in-namespace server/client over
  `127.0.0.1`, and denial of a host-loopback fixture, LAN, Internet, ambient
  host temp, private HOME sentinel and authoritative file path. It also
  proved validation build output does not modify the frozen candidate.
  Other focused tests proved pass/fail/cancel/not-started results, bounded
  stdout/stderr with truncation flags, timeout, child cleanup, provider
  command non-substitution, and fingerprint mismatch blocking promotion.
- Real P1 AgentRun `8a32a4d0-05ef-41be-8d2c-e444e6ec46d0` completed in
  isolated ExecutionWorkspace
  `3de03a4e-a689-4b65-b146-c86da469df08`. Provider command evidence
  did not satisfy the required target. Frozen fingerprint:
  `7f62df80dc623968be59844a0fcf4284735da2ef98d7130ca38d8f6d4a6cfa67`.
  Dope invoked `npm run check` in candidate-derived ValidationWorkspace
  `3fc3629f-7d1b-4b5c-96af-a66aee5bab21`; durable `owner: dope` result
  passed at exit 0 in 13,909 ms with bounded output and truthful stdout
  truncation. The original candidate fingerprint remained unchanged.
  Authority allowed exactly `src/client/app/application.tsx` and
  `src/client/styles.css`; only those candidate files were promoted.
  The P1 checkpoint is
  `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, including the two
  explicitly accepted pre-existing dirty files. A single-package/tracked
  shrinkwrap version-coherence correction was required. The first checkpoint
  attempt committed Git before sequence state advanced; exact commit
  verification recovered the SHA without a duplicate commit, and a focused
  regression guard now covers that commit/state gap.
- Real P2 started from the exact P1 SHA. AgentRun
  `3520990b-ea55-4302-81a3-ccf10001a2cf` froze fingerprint
  `61e68599e84a55f6b1c9151154474a6494e5f288b5e0703896e3367d87ef99f2`.
  Dope-owned `npm run check` passed at exit 0 in 14,335 ms in
  ValidationWorkspace `78092dac-707c-4af7-8ac2-739db1c2ab98`;
  Authority promoted only `test/browser/p5-shell.spec.ts`. Dope recorded
  exact P2 checkpoint `d5c583b52abae24eb98fd2f28e4134ef61de93b4`
  and advanced only to P3 waiting-manual.
- An early P3 reconciliation did not advance. The snapshotted P3 prompt was
  visible and no coding-agent run was created for the manual gate. The
  serial desktop/mobile Playwright suite passed 48/48 after a focused
  Project-switching regression addition; desktop/mobile scope, chart,
  provenance and mobile no-overflow assertions passed. A separate browser
  inspection showed the badge/charts and 14-to-7-day replacement on Project
  switch. `npm run check` passed (120 unit passes, one existing PHP skip),
  and `git diff --check` passed. P3 evidence:
  `docs/validation/c4-dope-phase-stack-smoke.md`. Exact external P3 SHA:
  `57980fe9cb86c48dc7e5b587a50a21f137a8045b`; Dope reconciled it
  without duplicate commit.
- Before P4, Dope was closed and relaunched. The same sequence and P1-P3
  SHAs reopened, P4 remained waiting-manual with its exact prompt, and the
  durable agent store still had one sequence and 12 historical runs. P4
  static review found a data-driven badge from the existing Overview
  response, preserved charts/provenance, and no new backend/API/provider
  path or fixed-width overflow. `npm run check` passed; browser discovery
  listed 48 tests; `git diff --check` passed. P4 closeout evidence:
  `docs/validation/c4-dope-phase-stack-smoke-closeout.md`. Exact external
  P4 SHA: `d4dfbf38628ba70726cf3b3610c2279643f500dc`; Dope reconciled
  it to completed.
- A second full Dope close/relaunch/reopen auto-discovered the existing
  completed sequence with all four unchanged SHAs, coherent source
  fingerprint, no Start/Resume control, no auto-run, and no Git change.
  The agent store remained at one sequence and 12 historical runs.
- Focused Dope tests passed 75/75 across candidate validation, AgentRun
  contracts/store, runtime, execution workspace, Codex sandbox, sequence
  persistence/checkpoint and manual-gate surfaces. `npm run build:browser`
  passed, `git diff --check` passed, and `0.8.20` was coherent across all
  12 Dope workspaces. No root Dope lockfile was created.
- Adaptive SEO finished clean at `0.4.7`. Its four commits have the exact
  required order/subjects and contain no local task-stack files,
  `.dope/agent/**`, validation temp/build output, or root `package-lock.json`.
  The pre-existing tracked `npm-shrinkwrap.json` was unchanged. Final
  `npm run check` passed in P4. Browser evidence uses local fixture API
  responses; production integrations and live analytics were outside this
  smoke qualification.

Decision: **GREEN / QUALIFIED, 2 cycles used of 5**. No Cycle 3 was needed.
