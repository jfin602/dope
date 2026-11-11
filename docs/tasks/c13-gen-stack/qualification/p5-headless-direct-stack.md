# P5 — deterministic direct-stack headless qualification

**Verdict: NOT GREEN (2026-11-11).** The local broker and direct-stack unit paths pass, but the required real Pi worker → deterministic provider → protected broker → Accept journey could not run. This sandbox rejects both TCP loopback and Unix socket listeners with `EPERM`. The new real-worker test is authored and syntax-checked, but has no executed staging or publication result here. P6 and real GPT-OSS reliability are not inferred.

## Exact basis and change

- Pre-task product HEAD: `fa69fbeec470f3f075e2d5722e3eb410da86ce88`; `git status --short` was empty. P1–P4 are the immediately preceding commits. All P5 changes are uncommitted. Product version remains `0.13.11`; no manifest, dependency or lockfile changed.
- Final source hashes: `packages/pi-runtime/worker.mjs` SHA-256 `ac0f6cabd0c7563a4d16eabd7b4ad911a376376d8f12e393b651a74d7ae9120c`; `packages/theia-extension/src/node/chat-backend.ts` SHA-256 `22eb70ca76794059f9442a385e2b268e90c6bf231f806ab5092cd8b4d21f6958`; compiled backend `packages/theia-extension/lib/node/chat-backend.js` SHA-256 `df815e6d83c7cb0af660582399e7a2cf18b96c2d4cd6fccbaa755948961ae131`.
- P1–P4 had left a two-turn route: initial `/gen-stack <slug> <details>` saved a draft and instructed a second `continue` turn. P5 connects initial draft creation to the protected model turn, retaining `continue` for recovery and pinning that turn to the model saved with the draft. The built-in skill text now describes that route. The first Chat user message remains the sole original request and draft owner.
- The historical [c13-ass-fix P5-D3 NOT GREEN](../../c13-ass-fix/qualification/p5-d3-live-authoring-qualification.md) is unchanged. It reached Assessment but failed Planning on `PLAN_UNSUPPORTED_SOURCE`; this P5 test does not turn that historical result into a PASS.

## Observed local broker journey

The focused `chat-backend` test uses a deterministic model stub at the **Chat backend broker**, not the Pi worker. One trusted `/gen-stack direct-task ...` turn saved the original request and prior discussion, performed a brokered `read_file package.json`, staged `P1-implement-separator-behavior.txt` and `P2-manual-separator-closeout.txt`, called `proposal_finish`, and produced one pending native Prompt Stack Proposal. The draft had no Assessment or Plan record. The proposal contained exactly README plus two prompt files; there were no dummy supporting records. The test checked absent canonical files and absent Work discovery before Accept, denied a wrong digest, then called the guarded `publishPromptStack` with the saved digest. Every published file matched its reviewed `after` bytes and Work discovery found two prompts. No Work grant, Run, Docs applied History or Gate award was invoked.

The separate direct-stack suites passed 1, 3 and 10 work-file assembly, importer/runner grammar, source evidence checks, source drift, exact publication bytes, file-specific validation, long chunks, durable restart, bounded limits and copy-on-write revision preservation. These are controller/publisher tests, not a real-worker result.

## Real-worker fixture and blocked boundary

`test/unit/direct-stack-worker.test.ts` defines a fresh Git fixture per case, actual `PiRuntimeHost` worker, OpenAI-compatible streaming provider, and the ChatBackend broker. It specifies two and ten work prompts plus one terminal manual closeout, a two-chunk long P1, a brokered `src/labels.js` read, proposal/importer checks, wrong-digest rejection, explicit Accept, exact-byte publication and Work discovery. Planned staged titles are `Implement label case 1` through `Implement label case 2` or `Implement label case 10`, followed by `Manual label closeout`. **None of these files was actually staged by that test in this environment.** Actual real-worker staged count, file byte lengths, final digest, read receipts, guarded Accept and Work discovery are **UNKNOWN / NOT EXERCISED**; they must not be copied from the scripted operation list or the local broker unit test.

Running that test failed before provider interaction: `Error: listen EPERM: operation not permitted 127.0.0.1`. A separate Unix socket probe also returned `EPERM`. Existing `prompt-chain-headless` and `protected-assessment-worker` real-provider tests hit the same listener restriction. The unrelated Pi runtime session-initialization test exited at the worker boundary in the aggregate; it was not used as direct-stack evidence. The real-worker fixture remains available for a network-capable runner, where any subsequent failures must be diagnosed on their own merits.

## Security and recovery matrix

| Boundary | Evidence in this turn |
| --- | --- |
| Quoted slash inertness; unsafe, reserved and duplicate slug | Existing `prompt-authoring-stage`, `chat-skills` and `chat-backend` cases passed. |
| Foreign owner/lease/project; source drift; stale stage; cancel/restart/resume; malformed, out-of-order, duplicate or conflicting chunk; resource ceiling | Existing `incremental-proposal-controller`, `incremental-prompt-stack`, `chat-backend` and publication cases passed locally. |
| Missing closeout, incomplete file, bad metadata, unsupported existing-source evidence, future file, invalid dependency | Existing direct-stack validator/controller cases passed locally. |
| Symlink/path traversal, collision, partial publication retry, wrong digest, changed Git source | Existing publication and direct-stack cases passed locally; wrong digest also passed in the one-turn broker journey. |
| Foreign Chat, wrong/expired revision, worktree/version drift, failed finish, stale proposal Accept, owner dirty source, historical accepted/executed snapshots, legacy route coexistence | Some component checks exist, but the required combined real-worker authority matrix was **not executed**. No combined PASS is claimed. |
| Targeted file Revise through a real-worker turn, unchanged-byte retention and prior candidate after rejection | Controller/UI component checks passed; combined real-worker path **not executed**. |

No fallback to the three-stage route was added. Legacy routes and historical drafts remain present; no cleanup, Work execution or Roadmap status change occurred.

## Build and tests

- `npm run build:extension` — PASS, dependency order. After the skill-text and model-pinning edits, `corepack yarn workspace @dope/theia-extension build` passed twice to refresh the changed extension package after each edit. No other package was rebuilt.
- One consolidated `node --test` matrix over worker, runtime, backend, controller, composer, publisher, Chat presentation and native-tab suites — **9 file suites passed, 5 failed**. Three failures were listener `EPERM`; `chat-presentation` and a Pi direct-tool expectation exposed stale P4 assertions, corrected in this change. This aggregate is **not a PASS**.
- Focused follow-up: `chat-presentation` 36/36, `chat-backend` 21/21 before the final local broker assertion, `incremental-prompt-stack` 6/6, `planning-stack-publication` 8/8, `incremental-proposal-controller` 6/6; the final one-turn broker test, Pi direct-tool test and `chat-skills` test each passed. `node --check test/unit/direct-stack-worker.test.ts` and `git diff --check` passed.
- Real-worker test: failed at listener creation before any Pi turn or source read. No final full aggregate was rerun after the assertion repairs because the same environment restriction would keep the real-worker gate red.

**Required next evidence:** run the authored real-worker fixture in an environment that permits a local deterministic provider, resolve any subsequent failures, then complete the combined negative and revision matrix on the exact final source. P6 remains separately manual and unstarted.
