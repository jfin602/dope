# GPT-OSS 20B Roadmap finish correction — 2026-11-04

**Disposition:** Correction source verified; one bounded GPT-OSS 20B live run reached review-ready. This report does not qualify M3, the full tower-defense Roadmap, native Electron UI, or broader Roadmap generation. Product version remains `0.12.7`.

## Original failure and attribution

The saved Chat execution in the disposable `/tmp/dope-p7-reliability-elvJyD` project selected `openai/gpt-oss-20b` and records `roadmap_phase` completed twice, then `roadmap_finish` failed twice, in one Pi execution. It ended after 36,231 ms with two validated Phases and two retries. The LM Studio server log (`/home/jfin/.lmstudio/server-logs/2026-11/2026-11-04.1.log`) retains both exact finish arguments and broker replies in order:

| Attempt | Arguments | Result |
| --- | --- | --- |
| First | `{"version":1,"unresolved":[]}` | `{"version":1,"accepted":false,"error":"ROADMAP_GENERATION_SCOPE_UNRESOLVED"}` |
| Second | `{"version":1,"unresolved":[]}` | `{"version":1,"accepted":false,"error":"ROADMAP_GENERATION_SCOPE_UNRESOLVED"}` |

The same log shows successful preceding native receipts with counts 1/1/2 and 2/2/4 for Phases/Gates/Criteria. Full Phase argument bodies are truncated by the server log, so this report does not claim their exact bytes. Both finish calls met the versioned Pi schema and passed backend argument parsing and controller admission. The failure occurred in the controller's keyword-based scope check, before `StageOwner.finish` or review-lease preparation. It treated lack of matching words as a missing requirement when `unresolved` was empty. Equivalent wording could therefore reject a structurally complete draft. The original Markdown `**2 Phases**` also escaped the controller's Phase-count parser, though the observed failure was the scope check. The first rejection allowed the second call; the second failed for the same reason and exhausted the one-correction retry allowance. The second attempt was not denied by call budget, source, revision or lease.

## Repair

The controller now checks explicit requested Phase count after removing Markdown emphasis and requires the actual staged count to match. It leaves keyword matches as advisory candidates in the proposal's semantic-coverage ledger; every requirement remains visible and coverage remains labeled **unverified**. An empty `unresolved` array is valid when the model reports none. Explicit unresolved items remain visible. Structural validation, dependency closure, checked source/revision/project/lease, cancellation, deadline, retry bounds and the noncanonical StageOwner completion remain in force. Finish errors now explain malformed arguments, missing Phases, no staged Phase, stale authority and duplicate completion without changing the native tool schema. The continuous Pi worker and Phase staging paths were not redesigned.

## Verification on corrected source

- Workspace typecheck and extension build: PASS.
- Focused controller, Chat command, real Pi worker integration, native generation stage and native StageOwner: **41/41 PASS**. The real worker case returned a checked `roadmap_finish` receipt after two checked Phase receipts with `unresolved: []`, retained unverified semantic diagnostics and made no canonical or Markdown write before owner review. Focused negatives cover malformed finish arguments and correction, missing requested Phase, retry exhaustion, duplicate or premature finish, invalid Gate/Criterion, source/revision drift, cancellation and approval boundaries.
- Linked source and sync recovery tests: **8/8 PASS**.
- Browser and Electron builds: PASS. `git diff --check`: PASS.
- One disposable local GPT-OSS 20B run through LM Studio and the protected Pi worker: **review-ready in 32,980 ms**, first Phase 11,335 ms, second Phase staged before finish, review-ready at 32,935 ms in the controller. Ordered broker events: `roadmap_phase completed`, `roadmap_phase completed`, `roadmap_finish completed`; 2 Phases, 2 Gates, 4 Criteria; 3 calls, 0 retries. The resulting proposal held four pending operations, semantic coverage was explicitly unverified, and the canonical Roadmap remained byte-equivalent to its pre-run state. No project file or linked Markdown was written. The disposable fixture was removed.

**Remaining evidence gap:** The corrected source has one bounded live GPT-OSS run, not a repeated reliability trial or full MVP qualification. M3 remains separate. Historical NOT GREEN reports are unchanged.
