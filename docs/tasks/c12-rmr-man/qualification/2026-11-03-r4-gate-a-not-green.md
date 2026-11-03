# c12-rmr-man R4 — Gate A connected Chrome attempt, NOT GREEN

**Date:** 2026-11-03 (America/Chicago)  
**Scope:** R3 controlled live-stage Chrome proof required before R4 Gates B–E. One baseline cycle was attempted.  
**Verdict:** **R3 PARTIAL / NOT GREEN; R4 NOT GREEN.** Gate A1 showed Stage 1 but did not produce accepted Stages 2 and 3. Gate A2/A3 remain unobserved. The original tower-defense prompt and Gates B–E were not run.

## Source and environment

- Git branch `main`, HEAD `501f80976daaeb6f4e305bbea0306c20db25c50d`, product version `0.12.7`. The five existing R3 dirty files were preserved: `chat-panel-controller.ts`, `chat-panel-widget.ts`, `frontend-module.ts`, `roadmap-canvas-widget.ts`, and `roadmap-chat-panel.test.ts`. Their full `git diff --binary` SHA-256 remained `b4e85d0a5594fde34d943eb478e4ccb05d0e6332fb8d4e2e8a32ddea536224b1`. This attempt changed no product source, package version, provider configuration, or owner project.
- `npm run build:browser` passed. Local and HTTP-served `apps/browser/lib/frontend/bundle.js` SHA-256 both `a20a03199698335ac8bee425a3ce2b349f9475d1bbc571e131a7f1d311fc091b`. Backend `apps/browser/src-gen/backend/main.js` SHA-256 `c439e8af210e6533a8650785a633240a90d34698847ffe0a1f8a3412b8d46db1`. Theia listened on `127.0.0.1:3000`.
- Connected Google Chrome browser ID `2`, Dope tab `528924224`, loaded `http://127.0.0.1:3000/#/tmp/dope-r4-gatea-20261103`. The disposable root had a minimal TypeScript file and no pre-existing Roadmap. The owner tower-defense project was never opened in this attempt.
- LM Studio `qwen3.5-9b` was actually loaded with a 16,384-token context. Dope AI Center reported the saved LM Studio connection **ready · 1 usable model**, and the Chat turn selected `LM Studio · qwen3.5-9b`. A stale UI banner still read “Connection check failed”; the selected connection details and model availability showed ready. No model/provider setting was changed.
- Focused final-source command `node --test test/unit/roadmap-native-stage.test.ts test/unit/roadmap-gate-chat.test.ts test/unit/roadmap-canvas.test.ts test/unit/roadmap-chat-panel.test.ts test/unit/roadmap-history-navigation.test.ts` passed **41/41** after the build. These tests do not substitute for missing Chrome stages.

## Actual Gate A observations

The Roadmap center-editor was active before a **different, disposable three-batch prompt** was sent through the saved ChatPanel. The prompt asked the selected model to call `roadmap_read`, then stage Phase Alpha; then Phase Beta plus a Gate/criterion under Alpha; then a Gate/criterion under Beta and `done`. It explicitly prohibited Apply. The original R4 tower-defense model prompt was withheld because Gate A had not passed.

1. The model used `roadmap_read`; its visible activity showed revision zero and `stageBasis` with `expectedRevision: 0` and JSON `expectedSourceHash: null`. This activity display is not an independent payload trace.
2. One `phase.create` batch was accepted by the native owner and reached the production Chat event bridge: Chrome visibly rendered a dashed **Proposed · Not applied** Phase Alpha before the final assistant response. Canvas and Chat both showed **Stage 1 · 1 Phase, 0 Gates, 0 Criteria · Incomplete**. [Stage 1 screenshot](2026-11-03-r4-evidence/gate-a-stage-1.png), SHA-256 `a6685ae1c39860e58acf0f22150f2db6cc31b6e349dae778dc507c99d5bea076`.
3. A manual canvas drag shifted the Phase Alpha card left by about 200 screen pixels while the turn ran. No later accepted stage arrived, so preservation of that camera position across updates was **not verified**.
4. The model's visible activity then repeatedly discussed an `expectedSourceHash` argument error, alternating `None`/`null` reasoning and later mentioning `ROADMAP_TOOL_FAILED`. There was **no independently captured actual Stage 2 request payload or backend error trace**. The reason for rejected calls is **unattributed**; the display alone cannot establish whether the model, serialization, or backend failed. No second or third accepted snapshot appeared during the nearly six-minute turn.
5. The turn was cancelled through Dope's **Cancel** control. Chrome immediately removed the provisional Phase and showed **Proposed · Not applied · Cancelled**. The saved Chat answer said the turn was cancelled and no proposal applied. [Cancelled-state screenshot](2026-11-03-r4-evidence/gate-a-cancelled.png), SHA-256 `6ac36689e2b2dc265c2eeeafc51e53974820779c78604785027d91c5870d48ac`.
6. `/tmp/dope-r4-gatea-20261103/.dope/roadmap.json` and `/tmp/dope-r4-gatea-20261103/ROADMAP.md` were absent before the turn and remained absent after cancellation. No review, Apply, or Project History application was claimed. Exact staged entity IDs and backend graph counts beyond the visible Stage 1 status were not independently captured.

## Gate disposition and progression

| Requirement | Outcome |
| --- | --- |
| A1 Stage 1 before final response | Observed in connected Chrome |
| A1 Stages 2 and 3, nested relationships, backend ID/count agreement | **Evidence gap / failed progression**: no accepted later batch |
| A2 closed-editor manual View and later updates | Unrun |
| A3 camera across updates, duplicate/delayed events, project/history/layout isolation | Unrun; cancellation clearing observed only |
| A4 R3 SCOPED GREEN decision | **Not met** |
| B real tower-defense model, C authority, D negatives, E full final qualification | **Held by Gate A** |

**Implementation:** Partial for the R3 acceptance scope; no R4 source correction was made.  
**Verification:** R3 **Evidence Gap** on mandatory Chrome stages; R4 **Evidence Gap / NOT GREEN**.  
**Progression:** **Stop** before Gate B under the R4 prompt. Do not infer a Green from the build, 41 passing tests, or one provisional Phase.

**Smallest safe next action:** On this disposable fixture, capture the actual rejected `roadmap_stage` argument shape and exact safe backend error code for Stage 2 through a bounded diagnostic trace, then attribute model output versus transport versus backend validation. If a product defect is demonstrated, make one narrow repair and rebuild/replay Gate A on that exact source. Otherwise obtain a deterministic, backend-validated three-stage browser replay through the existing native owner and production event bridge. Do not use fabricated DOM/presentation state or the original tower-defense prompt before Gate A qualifies. The shared R4 budget has consumed its baseline cycle; no second repair cycle was attempted without a demonstrated attributable source defect.

Historical P9/P10-A NOT GREEN reports, linked Markdown/editor parity gaps, and native Electron qualification remain unchanged.
