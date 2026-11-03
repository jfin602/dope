# M3-R2 manual closeout — 2026-11-03

**Verdict: NOT GREEN / DOGFOOD HOLD.** The owner stopped the single permitted retest after 6m22s of format deliberation without a completed RM1 answer or proposal. No further repair, model run, Apply, or Work action was performed.

## Source and test attribution

- Local HEAD: `3f55bf49f722df024189c055be3a968ae2c92a16`; product version `0.12.7`. The working tree was clean at entry. No commit or version/model/provider change was made.
- Six failed `chat-backend.test.ts` cases called the retired `offerRoadmap` API. Current `ChatBackend` deliberately rejects response-parsed Roadmap offers. Obsolete cases were replaced by current-interface retirement and typed proposal coverage; the API was not restored.
- The seventh failed case used a fake context composer that returned no references. A real composer binds the current Roadmap reference for preview and turn, and the test verifies untrusted RM1 staging without canonical writes.
- After the live baseline showed a format deliberation loop, one narrow RM1 instruction edit made P/G/C ordering and separator counts explicit and requested immediate output. The associated instruction test was updated. This edit did not change the parser, authority, model, or token ceiling.
- Changed source: `packages/theia-extension/src/node/roadmap-local-model.ts`; changed tests: `test/unit/chat-backend.test.ts`, `test/unit/roadmap-local-model.test.ts`. Focused tests after compiling imported extension output: **40/40 pass**. `npm run build:browser` passed with zero build errors. `git diff --check` passed. No full suite was run.

## Browser qualification

- One Codex in-app Browser tab, one Dope server, and disposable project `/tmp/dope-m3-r2-tower-a2FbkT` were used. The selected local model was `LM Studio · qwen3.5-9b`, loaded at 16,384 context tokens; Chat remained `Follow Interactive` with no fallback change. The running source routes greenfield `/roadmap` through `greenfield-roadmap-markers` and checks for one trusted RM1 instruction. Protected raw outbound arguments were not exposed, so exact wire-message contents were not independently captured.
- Rebuilt extension `roadmap-local-model.js` SHA-256: `fba65b38510e9a251b456a0b13fe3269c964d5f5a8c420426500d00724911861`. Backend bundle: `74134fb6cd993bbd2a270e5e32c31d62a01bf000182f07b440fb527c847d2de4`. Frontend bundle: `f7a15f674a1c486074f6cfa20ce11b01e2547178beb88e3671929417d6476f2d`; the served frontend bundle matched the built file before the instruction edit and was rebuilt to the same hash.
- The original tower-defense brief was sent once at baseline. After **6m24s**, Dope reported `finishReason=length`, absent provider final text and absent `END`, with 3,944 reasoning tokens, 152 final tokens, 4,512 total tokens and a 4,096 requested output-token ceiling. No proposal appeared.
- The same brief was sent once after the instruction edit. The visible reasoning still repeatedly analyzed RM1 line order, separator counts and mechanics instead of delivering a final answer. At the owner's stop request, the turn was canceled after **6m22s**. Dope displayed “No proposal from this turn was applied.” There is no finish reason or final token count for this canceled retest. Reasoning fragments are not candidate output.
- The canvas remained empty. `.dope/roadmap.json` and `ROADMAP.md` were absent before and after; no applied Roadmap History was observed. There was no proposal to review, Apply, reload, or hand to Prepare Work. These downstream steps remain unverified.

## Classification

- **Implementation:** Part A test repair and one prompt clarification implemented, uncommitted.
- **Verification:** Focused source checks pass; live generation **NOT GREEN**. No validated Phase/Gate/Criterion counts, canvas review, checked Apply or Prepare Work receipt.
- **Progression:** **DOGFOOD HOLD.** The observed blocker is extended local-model reasoning about the marker format within the existing output budget. Reconsider the generation approach before another manually authorized qualification. Prior F6 and M3 NOT GREEN evidence remains unchanged; no native Electron or broader Work qualification is claimed.
