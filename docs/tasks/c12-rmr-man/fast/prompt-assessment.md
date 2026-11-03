# Prompt assessment — c12-rmr-man/fast

**Date:** 2026-11-03. **Scope:** Manual fast greenfield generation + canvas-only approval successor to the held R4 campaign. No execution or source changes from authoring.

## Observed user problem and evidence

The owner saw one successful native three-batch two-Phase proposal in Chrome, but generation required model-managed stage numbers, action kinds and aliases. The Roadmap displayed a floating raw-operation review panel plus duplicate Apply/Reject in Chat; the Phase/Gate/Criteria visuals contained repeated provisional labels. The prior approximately one-minute prompt → extracted Roadmap is an owner-reported reference, **not a matched comparable measurement**, and its Gate completeness/safety must be checked. The successful two-Phase fixture is not evidence of the original five-Phase tower-defense MVP completeness. The original R4/R4-R3 partial and NOT GREEN reports remain historical.

## Current source and reuse

- `packages/theia-extension/src/node/roadmap-local-model.ts`: `parseStrategicDraft` already validates a complete typed strategic envelope, but currently insists that the model echo `projectId` and `ownerRevision`, and the local planning helper caps output at 4096 tokens / 32768 JSON bytes. Measure limits before reuse.
- `packages/project-intelligence/src/node/roadmap-greenfield.ts`: whole-draft preview has stable IDs and nested Gates/Criteria but a **separate historical greenfield draft owner**; reuse schema/validation logic only, not a competing authoritative create/apply path.
- `packages/theia-extension/src/node/chat-backend.ts`: protected current-turn `/roadmap` flow selects native `roadmap_read/stage` tools and creates final proposal after completion; fast creation must not accidentally bypass skill, grant, source or saved Chat lifecycle.
- `packages/theia-extension/src/node/roadmap-native-stage.ts`: one staged-proposal and individual/Phase-group/subset/all-remaining review/decide authority; keep it and `ProjectPlanningActions` / `RoadmapStore` instead of creating a new canonical writer. 8 actions per batch, 48 total, stage max bytes; deterministic Dope-side translation may use bounded internal batches.
- `packages/theia-extension/src/browser/roadmap-canvas-widget.ts`: `renderProposalBar` currently shows floating operation rows, raw IDs and per-operation controls; selected review backend exists and should be preserved.
- `packages/theia-extension/src/browser/chat-panel-widget.ts`: `roadmapProposalReviewCard` still displays native operation IDs and Apply/Reject controls, so the final UI consolidation must preserve a single saved summary and tool-call transcript but remove duplicate normal Roadmap decisions only **after** F4 canvas parity.
- Tests import both `src` and compiled `lib`; compile changed package outputs **once in dependency order** before lib-backed Node tests. Relevant focused suites: `roadmap-local-model`, `roadmap-greenfield`, `roadmap-native-stage`, `roadmap-gate-chat`, `chat-backend`, `roadmap-proposal-presentation`, `roadmap-proposal-cards`, `roadmap-canvas`, `roadmap-chat-panel`, `chat-panel`.

## Decomposition and progression

**F1 (T2/T3 observational):** establish comparable output and latency using three candidates. Existing multi-batch and extractor can be run if safe; since the one-pass product path is not implemented yet, use an isolated typed-draft prototype **through the same selected model and validated candidate format**, recording that it is a prototype rather than real product end-to-end timing. If a path is inaccessible, record N/A/unavailable instead of resurrecting unsafe code or faking a result.

**F2 (T1):** compact typed complete model-output contract, bounded output/reasoning and completion handling. No preview/apply or new editor. Goal: 5 complete Phases with nested Gate/Criteria through one normal generation where capacity allows, not a model tool choreography. No model-supplied privileged metadata.

**F3 (T2):** deterministic trusted-source mapping of complete draft to the single existing native proposal owner and checked subset approval; stale/no-write/partial/cross-owner negatives before progression. No new authoring store.

**F4 (T1/T2):** contextual canvas selection, actual element edit/review and integrated compact toolbar. Remove floating raw-operation panel only after equivalent tests, keyboard/narrow/focus/source parity. No changes to model generation.

**F5 (T1):** compact durable Chat card + View and transcript/tool events. Remove duplicate normal Roadmap approval controls after F4 without affecting non-Roadmap permission/publication approvals or saved activity. No second Chat system.

**F6 (T3):** only independent exact-source real Chrome qualification and final matched production timing; at most baseline plus two genuine narrowly scoped repair/retest cycles. Owner-native remains separately observed/unobserved.

## Prompt Efficiency Gate

- Six prompts, each with **one primary responsibility**; F1/F6 are dedicated observational/GUI gates, not ordinary <=8-minute coding tasks.
- F2–F5 target <=8 min implementation + focused checks, soft 10, hard 15 min per bounded cycle; narrow or STOP if larger. F3 cross-boundary authority is intentionally T2.
- Avoid `npm run check`, `npm test`, `npm run build:extension`/browser/Electron as generic boilerplate. Build only changed package output(s) and run smallest affected tests; browser bundle once per F6 candidate; broad aggregate only when justified.
- Use GPT-6 Sol High for cross-boundary security and final evidence; selected **local Qwen** remains under owner's existing Dope model settings, not silently replaced.
- Preserve ADR 0016 visual tokens, ADR 0037 human usability, keyboard/narrow/reduced-motion and actual user action. Native UI proof separate. No new version/commit/runner or R4 evidence reclassification.
