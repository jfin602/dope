# Adaptive SEO Phase Stack qualification — fresh loop

Status: **NOT GREEN / architecture review required after Cycle 1 of 5**. The
architecture stop rule in the task applies; no Cycle 2 is started. Target:
`docs/tasks/c4-dope-phase-stack-smoke` at Adaptive SEO `0.4.7`.

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

## Stop decision

The task's architecture stop rule applies. The current provider mutation
sandbox cannot run Adaptive SEO's required validation reproducibly while
retaining its temp and network denials. Moving validation to a Dope-owned
process with a separately justified filesystem/network profile and durable,
bounded stdout/stderr requires a fresh `/docs-review` of the validation
execution boundary. Do not relabel the observed exit 1 as PASS, run the check
against the authoritative project as a substitute, or broaden `dope_run` to
force this stack through. The separate missing-terminal-result case and Agent
Run output visibility also remain unresolved for that review.
