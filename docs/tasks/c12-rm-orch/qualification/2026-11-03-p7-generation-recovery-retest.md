# P7 live generation recovery and retest — PARTIAL / NOT GREEN

**Local date:** 2026-11-03 (America/Chicago); live observations 2026-11-04 04:02:01–04:08:04 UTC. **Version:** `0.12.7` unchanged. **Disposition:** **P7 PARTIAL / NOT GREEN.** Connection reliability and first-Phase generation passed in one connected Codex Browser run; complete Roadmap generation, review and persistence did not pass. Preserve the earlier [P7 NOT GREEN report](2026-11-03-p7-connected-browser-closeout.md) as historical evidence.

## Source and repair

- Starting and ending HEAD: `3230e4b9ddfd970f396cb85303d020412aea185b`. The worktree was clean at entry and remains uncommitted. No runner invocation, checkpoint commit, version change, provider switch or model configuration change occurred. The final tracked diff SHA-256 before this evidence file was `f1233fe0a69bce46b1d3018199cca3f01d72a8e7ecaebd6df6cbb75b1fa96c8e`.
- Modified: `packages/contracts/src/model-runtime.ts`, `packages/pi-runtime/worker.mjs`, `packages/theia-extension/src/node/{chat-backend,pi-conversation-runtime,pi-model-bridge,pi-runtime-host,roadmap-generation-controller}.ts`, and `test/unit/{pi-model-bridge,roadmap-generation-controller,roadmap-generation-worker-integration}.test.ts`. This report is new; the old P7 report and authored prompts were not edited.
- Exact disconnection cause: `RoadmapGenerationController.timed()` imposed a one-shot 60-second timeout at Phase call dispatch. It did not reset on genuine provider thinking or tool-argument output. The timer began **before** Pi binding and the LM Studio request. At its expiry the controller aborted the Pi client, explaining LM Studio's prior client-disconnection log while the model was still producing tokens. The worker's separate turn timeout was 900 seconds and did not cause the prior disconnect.
- The repaired Phase-call timer refreshes only on bounded, generation/call/sequence-validated provider reasoning, final text, or actual provider tool-argument deltas. A separate absolute generation timer remains. Idle expiry aborts active work; user cancellation, source/lease/model checks and late-output rejection remain. Generic timed-work cleanup now removes timer and abort listeners when a race settles. No unrelated UI event refreshes the timer.
- The first Phase exposes only `roadmap_phase`; `roadmap_finish` becomes eligible after a Phase exists. The first-Phase instruction was shortened without changing required title, objective, Gate purpose or observable Criteria, output budget, reasoning mode, provider or model. No new operation protocol or output-budget increase was introduced.

## Deterministic gates

- `npm run typecheck` passed. Final `@dope/theia-extension` and browser builds passed; the browser build reported zero errors. `node --check packages/pi-runtime/worker.mjs`, `npm run check:pi-runtime`, and `git diff --check` passed.
- Focused controller, worker integration, bridge, Pi conversation and Chat backend tests: **48/48 passed** on the final source. They cover genuine activity longer than a scaled idle interval, idle timeout with rejected late output, streaming cancellation, continuous output stopped by the absolute deadline, serial staging, phase-only first tool exposure and source drift. Ordinary Pi Chat and Work runtime regressions: **27/27 passed**. These are fixture results, not live qualification.
- Served browser frontend SHA-256 equalled the built frontend (`0aafb2584187cadc37941cffc38160f1d29a74d34a9991ef54ad46067f7281cf`). The restarted browser backend bundle SHA-256 was `c925f693e9feece1abf7a180f8fad3b901f68cfa2520c1765a67d90bb7504435`.

## One live Qwen run

The connected Codex Browser opened disposable project `/tmp/dope-p7-recovery-ybgrq76w`, containing a minimal TypeScript/PixiJS entry. The selected and actual model was loaded LM Studio `qwen3.5-9b` Q4_K_M at its unchanged 16,384-token context; Chat permission remained Ask. The host and LM Studio were responsive before the request, with about 9 GiB memory available. The exact owner-specified `/gen-roadmap Build a playable TypeScript/PixiJS tower-defense MVP...` prompt was submitted once. Generation ID: `569ad390-feec-4847-bce5-e6dbcd116356`; saved execution ID: `828b0940-e3f2-49e5-a7fc-f80f85644f30`. No second live inference trial or automatic model adjustment was made.

| Event | UTC time | Elapsed from Chat acceptance |
| --- | --- | ---: |
| Command accepted and controller started | 04:02:01.790 | 0 s |
| First Phase dispatched | 04:02:01.797 | 0.007 s |
| Pi worker turn started | 04:02:26.059 | 24.269 s |
| First LM Studio request initiated | 04:02:26.094 | 24.304 s |
| First genuine provider output, reasoning | 04:02:30.570 | 28.780 s |
| First tool arguments streaming | 04:02:46.022 | 44.232 s |
| First `roadmap_phase` call completed | 04:03:16.753 | 74.963 s |
| First Phase validated, staged and visible on active canvas | by 04:03:33.282 | by 91.492 s |
| Second Phase staged; Phase 3 dispatched | 04:05:16.219 | 194.429 s |
| Third Phase staged; Phase 4 dispatched | 04:06:37.973 | 276.183 s |
| Fourth `roadmap_phase` call completed | 04:07:49.613 | 347.823 s |
| Controller failed on projection limit and aborted | 04:08:04.610 | 362.820 s |

The first request exposed **one** tool. Later requests exposed `roadmap_phase` and `roadmap_finish`. Four tool calls completed through the Dope broker. All four model calls ended with provider finish reason `stop`; there was no 60-second client disconnect. The first call reported 1,684 input, 243 output, 89 reasoning and 1,927 total tokens. The saved four-call aggregate reported 8,223 input, 1,135 output, 428 reasoning and 9,358 total tokens. The 2,048 output-token budget was not exhausted in the first call. Initial Pi binding took about 24 seconds before the actual LM Studio request; subsequent Pi worker starts took about 0.5 seconds. The binding path can run the existing local tool-capability probe when the refreshed inventory lacks a verified result, but this trace alone does not isolate every millisecond of initial binding cost.

The first actual Phase was visible while generation remained active, with **3 proposed Gates and 9 proposed Criteria**. The canvas then updated to **2 provisional Phases, 8 Gates, 26 Criteria**, and **3 provisional Phases, 11 Gates, 34 Criteria**. Each displayed item was marked proposed, not applied; the active Roadmap tab remained usable. Phase calls were sequential. No repeated camera jump or focus theft was observed in this bounded browser pass.

Phase 4's model tool call completed, but the native stage rejected the expanded draft with `ROADMAP_STAGE_PROJECTION_LIMIT: reduce the draft to 64 entities` (`roadmap-native-stage.ts`). The Chat ended **Error** after 6m2s; the canvas reported **Proposed · Not applied · Failed** and no review-ready proposal. The live draft therefore did not reach five ordered Phases, owner Apply/Reject, linked Markdown sync or reload verification. The three staged Phases also put most core mechanics into Phase 2 and integration/polish into Phase 3; semantic coverage and desired five-Phase ordering were not qualified. The new projection limit is a separate issue from the repaired client disconnection and must be assessed before another live trial.

### Saved Chat reasoning evidence

The owner supplied the saved failed Chat's visible reasoning and provisional tool-outcome text after the run. Its [verbatim transcript](2026-11-03-p7-live-chat-reasoning.txt) is retained as a separate evidence log for execution `828b0940-e3f2-49e5-a7fc-f80f85644f30`; it is a user-provided copy of that Chat, not a replacement for backend lifecycle or stage records. It shows the model planning Phase 1, then Phase 2, Phase 3 and Phase 4, with a visible `roadmap_phase · completed` outcome after each. The model reasoned that three Phases already completed the MVP roadmap, then continued with a fourth focused on extra polish and readiness. It also called Phase 4 “accepted” and prepared a final answer. Those are **model interpretations**, not authoritative stage or approval receipts: native staging rejected the fourth Phase at the 64-entity cap, and no final answer or owner review was produced. This reasoning supports the quality finding that the model grouped most required mechanics early and did not maintain the requested five-Phase progression. No protected tool arguments, credentials or source file contents were added to this evidence log.

## Authority and independent outcomes

The disposable project's `package.json`, `src/main.ts` and `index.html` retained their pre-run SHA-256 values (`5043a0ec...`, `556e9c64...`, `86aa0685...`). Its `.dope` directory contained Chat lease/index/session files and `history-focus.json`, with no canonical Roadmap index, linked Roadmap Markdown, revision archive or applied History record. No Apply or Reject was available or exercised. The failure path removed the provisional canvas content; inspectable partial-draft recovery in the failed UI remains a gap. Native Electron GUI was not tested.

- **A. Connection reliability: PASS for this defect and tested source.** The initiating one-shot controller timer was identified and corrected. Streaming activity continued beyond 60 seconds, inactivity and absolute timers were fixture-tested, and the real model remained connected through four calls. This does not prove long-term reliability across other hosts or models.
- **B. First-Phase generation: PASS.** Actual Qwen3.5-9B completed a valid brokered `roadmap_phase`, and Dope validated, staged and displayed it during active generation.
- **C. Complete Roadmap generation: NOT GREEN.** Phase 4 exceeded the existing 64-entity projection cap; five Phases and owner review/persistence were not observed.

**Overall: P7 PARTIAL / NOT GREEN.** Stop at this single controlled run. Preserve the saved failed Chat and old qualification evidence. Do not mark a runner PASS, call Phase 12 qualified or infer owner approval from the model's completed tool calls.
