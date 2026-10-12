# Phase 9 final qualification — GREEN

**Date:** 2026-10-12 (America/Chicago)
**Disposition:** **GREEN / QUALIFIED** for the approved ADR 0034 Phase 9 scope. This is qualification, not owner closure or Phase 10 activation.
**Exact committed product-source candidate:** `af3447ccc419cc9c06051dbd4046a9145d7bf0ae` at unchanged `0.9.35`.
**Historical evidence retained:** original P13 Not Green at `7fdf7b3f43d695e12fa3390f7fbad63d90e5cfa5`; five-cycle repair-loop Not Green and 553/553 aggregate at `2210a54d72fc0c0c31f617c42da7d4c9ee55fce9`.

This record closes only the three blockers named by the bounded final qualification prompt. It does not reopen completed Phase 9 workstreams, erase earlier failures, owner-close Phase 9, or activate Phase 10.

## Repair cycles

Two of the permitted five cycles were required.

| Cycle | Failed assertion and root cause | Repair | Focused evidence | Result |
| --- | --- | --- | --- | --- |
| 1 | Local Qwen received the preview privacy notice as model input and could cite it as if it described the completed inference. Output-validation failures did not identify the invalid section/index. Manual Architecture acceptance also retained a stale initialization fingerprint, which falsely staled the disposable Planning Map used by the real Work gate. | `11e049563c7f068a90d8897618b9c4813522059f` sends only bounded evidence metadata, rejects model/provider/inference/egress claims as unsupported, reports actionable section/index validation errors, and refreshes the accepted canonical basis from `initializationStatus`. | The affected extension build passed; History-local-understanding and Software Map UI suites passed with the new regressions. | GREEN for the repaired boundaries; live gates continued. |
| 2 | The first real authorized run reached review, but acceptance failed closed with `Frozen review candidate fingerprint changed`. Provider-run Python tests had created ignored `__pycache__` output. The fingerprint included those nonpromotable bytes while durable review storage correctly retained only promotable delta bytes, so reconstruction could never match. | `af3447ccc419cc9c06051dbd4046a9145d7bf0ae` removes generated Git-ignored files inside the isolated ExecutionWorkspace before candidate fingerprinting and Dope validation. Validation, durable review and promotion now identify the same promotable bytes. | Agent core and extension builds passed. The focused Work review, Architecture basis and local-understanding set passed 58/58, including a regression that creates ignored output, reconstructs review and promotes once. The real GUI replay then completed. | GREEN. |

Cycle 1 changed `packages/theia-extension/src/node/history-local-understanding.ts`, `packages/theia-extension/src/browser/software-map-controller.ts`, `test/unit/history-local-understanding.test.ts` and `test/unit/software-map-ui.test.ts`. Cycle 2 changed `packages/agent-core/src/node/execution-workspace.ts`, `packages/theia-extension/src/node/agent-execution-runtime.ts` and `test/unit/agent-delegation-review.test.ts`.

The affected `@dope/agent-core` and `@dope/theia-extension` workspace build commands exited 0. The final focused confirmation command, `node --test test/unit/agent-delegation-review.test.ts test/unit/software-map-ui.test.ts test/unit/history-local-understanding.test.ts`, passed 58/58 with zero failures.

No product source changed after `af3447c` and before the final aggregate.

## Gate 1 — real AgentRun, validation and History truth

**Result: GREEN.**

Qualification used the real Dope GUI against the disposable Git project `/home/jfin/dev/dope-p9-final-disposable`. The project began clean at `f9f1a2e0d665829e5d76f02a104f7cfa30157e0b` and contained a small calculator fixture whose test already required a missing `subtract` function.

- The accepted Architecture and refreshed Physical Map backed active Planning Map `map-41644e20-90bf-4ce7-a9d3-4114317e75a3` and WorkItem `work-6af7f683-845c-4881-9a67-992c8d65f1a4`.
- The WorkItem remained a separate Planning fact with status `ready`, AI ownership, `calculator.py` as working/delegable scope and no human-reserved path.
- The GUI created persisted AgentTask `work-449711681f9ba04126b91b6c88947fb8`, displayed the fixed grant, required explicit acceptance and required separate authorization to send this synthetic project to the hosted Coding Agent.
- AI Center reported eligible exact target `6-Sol High · GPT-5.6-Sol`; the persisted run provenance identifies connection `6bb256ca-64fd-4054-a0c7-65da754acd68`, provider `codex`, hosted runtime and adapter `codex-app-server-execution`.
- Genuine AgentRun `03deb998-2281-4d13-84e3-b9a74b429bf6` changed only `calculator.py` in its isolated candidate. Dope-owned validation ran `python3 -m unittest -v` against candidate fingerprint `c1209461e6c9eb7b1f2283dbb15acec756d69c6a2e6682b25812ea81c6b81918`, exited 0 and passed both tests.
- Work held the frozen candidate for developer review. Explicit **Accept candidate** recorded review revision 1, an allowed authority decision and applied path `calculator.py`; the run became `completed`. The authoritative disposable worktree then showed only `M calculator.py`, and the same two tests passed directly.
- The earlier pre-fix run `dc8d1d46-86e7-4166-9952-3a07b14037a6` remains persisted as `cancelled`, validation passed, review rejected and promotion not applied. It was not rewritten into a success.

After refresh, History separately displayed:

- WorkItem `ready`;
- the repaired AgentTask origin;
- AgentRun `completed`;
- validation `passed`;
- review accepted and promotion applied;
- the dirty Git snapshot;
- the earlier cancelled run with promotion not applied.

The completed-run Open action reported `Opened the exact owner target` and focused the corresponding Work record. After stopping and restarting the backend, Work restored the completed run, accepted review, validation and allowed authority facts; History restored both terminal attempts and their exact owner actions.

## Gate 2 — reliable local contextual understanding

**Result: GREEN.**

AI Center connected local LM Studio at `http://127.0.0.1:1234/v1` and reported exact model `qwen3-coder-30b-a3b-instruct@q3_k_l`, 16,384 loaded context, `conversationalText: yes`, locality `local`, connection `98c9cf59-9550-4e91-a63f-141f990d5913`. The Background role was exact, local-only, required conversational text, forbade hosted project-data egress and had no fallback.

The real History GUI selected three known items: the completed AgentRun, the current dirty Git snapshot and the Planning WorkItem. Preview reported 3 items, 1,392/4,096 bytes, estimated 348/1,024 tokens and basis `a506fc941377489f353f21ede547c88546233a2ee161e67dfe2272a911fec3c1`. It explicitly excluded transcripts, prompts, diffs, secrets, file contents and unselected context.

Two consecutive explicit confirmations succeeded; there were no intervening validation failures:

1. The first response returned exact local provenance, the three deterministic facts, three separately labeled model interpretations and citations to the corresponding run, Git and WorkItem source IDs.
2. The second response returned the same grounded facts and equivalent cited interpretations. Unknowns remained empty rather than inventing missing time or author facts.

Neither response claimed that no model call occurred, altered canonical or owner state, or presented interpretations as project truth. Focused regressions also prove that unsupported inference/provider/egress claims are rejected with an actionable section and item index, citations remain mandatory, stale preview and cancellation fail closed, and hosted-only/fallback targets cannot execute this feature.

## Gate 3 — independent network observation

**Result: GREEN.**

The backend was started under OS-level process tracing:

```text
strace -ff -tt -T -e trace=connect \
  -o /home/jfin/dev/dope-p9-trace/history-final-connect \
  node src-gen/backend/main.js /home/jfin/dev/dope-p9-final-disposable \
  --hostname=127.0.0.1 --port=3000 --plugins=local-dir:../../plugins
```

The relevant backend trace was `history-final-connect.30142`. Observed Chicago-local times:

| Window/action | Observed connects |
| --- | --- |
| Local AI Center reconnect at 14:12:19.952–14:12:20.013 | Two connects to `127.0.0.1:1234` only. |
| History open, refresh, selection and local evidence preview after 14:12:20.013 and before explicit confirmation at 14:13:00.798 | No network connect. This directly confirms no automatic inference on open, refresh or preview. |
| First explicit request, 14:13:00.798–14:13:38.357 | One connect at 14:13:02.979 to `127.0.0.1:1234`; request succeeded. |
| Second explicit request, 14:13:41.215–14:14:04.315 | One connect at 14:13:43.922 to `127.0.0.1:1234`; request succeeded. |

Across the traced backend lifetime there were no external `AF_INET` or `AF_INET6` connection attempts. The only other connect records were local `AF_UNIX` attempts for DBus/nscd. This is independent evidence from the OS boundary, not a Dope routing label or model assertion. The exact-policy/no-fallback unit regressions passed on the same source, and the live GUI had previously failed closed with no eligible connected local model after restart instead of selecting hosted Codex.

## Final exact-source aggregate and invariants

One full `npm run check` ran after all source repairs on committed source `af3447ccc419cc9c06051dbd4046a9145d7bf0ae` and exited 0:

- runner: 103/103;
- baseline: 11/11;
- local install: 1/1;
- product: 412/412;
- Software Map initialization: 28/28;
- IDE fixture: 1/1;
- total: **556/556**, zero failures;
- browser build: 0 errors;
- Electron browser/node/electron builds: 0 errors.

`git diff --check` passed. The root plus 12 workspace manifests remain `0.9.35`, and all 20 internal `@dope/*` dependency pins remain exactly `0.9.35`. No root `package-lock.json`, unrelated dependency, theme, right-toolbar layout, source-repository owner store or historical qualification record changed.

## Decision and owner routing

All three bounded blockers are qualified. Phase 9 is therefore **GREEN / QUALIFIED** for the approved ADR 0034 scope. Earlier P13 and repair-loop Not Green results remain valid historical evidence of their exact candidates.

Recommended next owner action: review this evidence and make a separate explicit Phase 9 owner-close/sequencing decision. Phase 10 remains design approved and inactive until separately activated.
