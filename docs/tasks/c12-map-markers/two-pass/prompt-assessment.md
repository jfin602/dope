# Prompt assessment — automatic two-pass Roadmap generation

**Date:** 2026-11-03. **Approval:** owner asked for up to three manual prompts; this folder delivers exactly D1, D2 and D3. Documentation/prompt authoring only.

## Evidence and what changes

Existing F6 typed-JSON and M3 marker-only greenfield generation are NOT GREEN. [M3-R2](../qualification/2026-11-03-m3-r2-manual-closeout.md) recorded a length-ended model run (about 6m24s, 3,944 reasoning tokens, only 152 final tokens reported) and an owner-cancelled 6m22s retest. The strict RM1 parser and native staging owner are not the demonstrated primary failure; the local model repeatedly deliberated over format. The owner now directs **automatic two-pass generation**: free-form *human-readable* planning first, lock completed final text, then narrowly convert it to RM1 in a fresh second inference, while showing **one** Chat turn.

## Actual source and authority seams

- `packages/theia-extension/src/node/chat-backend.ts`: `runTurn` currently wraps **one** `generate()`, appends one user and one assistant, calls `finish-assistant`, and stages the validated candidate via `stageTypedRoadmapDraft`. It must orchestrate two internal calls **before** the single final assistant completion.
- `packages/chat/src/index.ts`: `ChatAssistantMessage` has `content`, `execution`, `planningActivity`, `roadmapAction` but **no immutable locked-plan field**. `parseChatMessage` rejects unknown fields; D1 must define and validate a small backward-compatible optional plan artifact.
- `packages/chat/src/service.ts` and `packages/chat/src/node/chat-repository.ts`: strict mutation grammar, lease and assistant state transition paths. A durable lock while the assistant remains pending/streaming requires a checked repository operation or equivalent internal backend-owned serialized mutation. **Do not use transient activity logs as the durable source.**
- `packages/theia-extension/src/node/roadmap-local-model.ts`: current strict RM1 parser returns `UntrustedTypedRoadmapCandidate`. Keep it; add only bounded natural-plan completion/sanity handling and a narrow converter prompt in D1/D2.
- `packages/theia-extension/src/node/roadmap-typed-stage.ts` and `RoadmapNativeStageOwner`: existing server-owned staged proposal and checked subset transactions. Preserve: the locked natural plan is NOT an approval token or alternate authoring owner.
- `packages/theia-extension/src/node/chat-context-composer.ts` / `chat-skills.ts`: fresh greenfield marker mode and skill instruction purge implemented previously. First pass needs natural-planning mode; second pass **must not recombine history/skills/legacy JSON instructions** or accidental context selection.
- `packages/theia-extension/src/node/pi-conversation-runtime.ts` and `packages/pi-runtime/worker.mjs`: each call independently runs within loaded model/output constraints. Preserve local-only routing and actual usage/finish provenance. No assumption that a second call is faster, and no silent reasoning disable/hosted fallback.
- `packages/theia-extension/src/browser/chat-panel-widget.ts`, `chat-panel-controller.ts`, `packages/chat/src/service.ts` existing progress events: only a narrow status/locked-plan display extension if needed; not another Chat message or separate proposal panel.

## Three single-owner prompts

**D1 (T2):** implement a bounded natural-plan generation helper and immutable, recoverable, project-scoped **Chat-owned** lock. Does not switch the production greenfield flow to two calls yet. Validate exact final text, minimum recognizable Phase/Gate/observable-criterion sections, required coverage warnings, no authorizing bytes and a cryptographic content hash. Validate round-trip persistence, interrupted process/turn and cross-project/lease safety, and hidden-plan protection against model history or assistant-delta replay.

**D2 (T2):** integrate D1 lock into existing `runTurn`, automatic fresh minimal same-model conversion as second internal inference, deterministic equivalence checks against the locked plan and standard strict RM1 stage/proposal. Preserve single `append-user`, `begin-assistant`, `finish-assistant`, one assistant reply and routing/permission/History truth. On conversion failure, keep the locked plan inert and viewable, no auto third call; a later Retry Conversion is an explicitly authorized separate workflow only if implemented, not a reason to expand scope.

**D3 (T3):** one exact-source Codex Browser selected-model end-to-end trial measuring both passes, validating locked text survives an interrupted conversion, valid Phase/Gate/Criteria and tower-defense mechanics, canvas checked Apply, reload/Markdown and accepted Gate → Prepare Work entry. Limit costly repeated model inference; record failures honestly.

## Prompt efficiency gate

1. **Scope separation:** persistence/first-pass vs orchestration/conversion vs GUI proof. No extra runner or generic repair prompt.
2. **Time:** D1/D2 <=8 min target, soft 10, hard 15; if repository schema changes exceed bounds, STOP with smallest remaining source boundary rather than bypass validation. D3 dedicated T3 can take longer but cannot spin endless Qwen calls.
3. **Narrow tests:** D1 `chat-repository` + first-pass helper/Chat schema; D2 `chat-backend`, `roadmap-local-model`, `roadmap-typed-stage` plus affected Chat panels only if types/UX changed. D3 real served UI/specific authority path. Test changed compiled `lib` fresh.
4. **No redundant builds:** `@dope/chat` build before `@dope/theia-extension` only if Chat schema changes require it; `npm run build:browser` only in D3 (includes extension). No `npm test`/`npm run check` by habit.
5. **Model economy:** GPT-6 Sol High manually for security/cross-boundary implementation; the existing user-selected local Qwen is the runtime model, not silently switched. No live inference D1/D2.
6. **Safety:** no canonical writes before owner Apply, one project/Chat/turn lease, immutable lock, fail closed on conversion mismatch or status changes. Preserve old reports, actual dirty source, honest unobserved native Electron/Work qualification.
7. **Presentation:** reuse one existing assistant card and semantic theme tokens, accessible planning/converting/ready statuses and inspectable locked plan; no second bubble, focus hijack or new canvas UI.

**Disposition:** assessment supports three manual prompts; this plan is not implementation, qualification or Phase 12 Green.
