# R4-R3-R2 trusted staging basis and Chat tool transcript — 2026-11-03

**Disposition: PARTIAL / NOT GREEN overall.** The deterministic trusted-basis protocol and saved tool-call recording pass. The required exact-source connected Chrome Stage 1 → 2 → 3 replay has not passed. This report does not change earlier R3/R4 or R4-R3-R1 records.

## Source and scope

- Git HEAD: `ab3926eef1ba94ff067079db9db85879c1d24a6c` (`main`). Product version remains `0.12.7`.
- Dirty tracked diff SHA-256: `dab60f52906deaa0b0820af154ccb2ce96597117cd5e88e7475c0e412b717015` (`git diff --binary | sha256sum`). Untracked records are outside that digest. No commit was made.
- Pre-existing uncommitted R4-R3-R1 work was preserved in `packages/pi-runtime/worker.mjs`, `packages/theia-extension/src/node/roadmap-native-stage.ts`, and their Pi/native/Chat tests. Its untracked Stage 2 diagnostic report was preserved.
- This recovery changed `worker.mjs`, `chat-backend.ts`, `test/unit/pi-runtime.test.mjs`, and `test/unit/roadmap-gate-chat.test.ts`. The later owner instruction to retain all tool calls also changed `AGENTS.md`, `packages/chat/src/{activity,index}.ts`, `packages/theia-extension/src/browser/{chat-panel-presentation,chat-panel-widget,dope.css}`, and `test/unit/chat-panel.test.ts`.

## Implementation evidence

The Pi-facing `roadmap_stage` schema no longer offers `expectedRevision` or `expectedSourceHash`. `roadmap_read` establishes a single turn-local trusted basis containing root, Roadmap owner/project, Chat, turn, lease, revision, nullable source hash, link state and expiry. A later read does not silently rebase it. The broker rejects model-supplied authority fields, missing/expired basis, changed revision, changed linked source and mismatched identity, then injects the retained revision and source hash into the existing strict native staging owner. Cancellation clears the basis. Typed actions, aliases, stage sequence and native approval remain in their existing authority boundaries.

Protected `roadmap_read`, `roadmap_stage` and `roadmap_cancel` invocations now record ordered running/outcome activity and saved execution tool events, including rejected calls. A persistent list appears in the originating assistant Chat message and in copied transcripts. It shows names and outcomes only, with no arguments, source contents or lease tokens. `AGENTS.md` records this forward rule. The list is inside the existing assistant message, not a second Chat card.

## Verification

- `npm run build:extension`: passed.
- `npm run build:browser`: passed (frontend and node bundles, zero build errors). Final built browser `apps/browser/lib/frontend/bundle.js` SHA-256: `d231d8d701dd455adf95ef3ddb6498932d0486572bb0c0f7788cf28a829b903a`. This final bundle was built but **not served for a fresh Chrome replay** after the transcript change.
- `node --test test/unit/pi-runtime.test.mjs test/unit/roadmap-gate-chat.test.ts test/unit/roadmap-native-stage.test.ts test/unit/chat-panel.test.ts`: **71/71 passed** on the final extension build. An initial parallel run had a transient fixture directory cleanup (`ENOTEMPTY`) failure; the same complete suite passed when rerun. Tests verify three consecutive Pi/broker/native stages, two Phase/two Gate/two Criterion counts, stable aliases, reviewable but unapplied proposal, real null source hash, no canonical write, rejected premature/spoofed/duplicate/invalid batches, stale linked source, cancellation and saved tool-call order/status. No live-model conclusion follows from these fixtures.
- `npm run check:pi-runtime`: passed (Pi 1.4.0, 121 integrity-locked packages).
- `git diff --check`: passed.

## Connected Chrome observations and boundary

The connected Codex Chrome replay used the exact compact qualification request, a fresh disposable revision-zero project, and the available LM Studio **Qwen3.5-9B** through Dope AI Center. A live run on the rebuilt trusted-basis source accepted provisional Stage 1 (Phase Alpha) and displayed its canvas preview, but did not produce an accepted Stage 2 or Stage 3 before cancellation. The resulting saved assistant turn is cancelled. A second fresh traced run emitted an actual `roadmap_read`; the model then continued reasoning until its output length limit before calling `roadmap_stage`, leaving a failed turn. Both saved turns lack tool events because they ran **before** the transcript-recording change. Reasoning text alone is not counted as a tool call. The final transcript build has no connected Chrome verification; its UI behavior is supported by code/build/tests only.

Both disposable projects have no `ROADMAP.md` or canonical `roadmap.json` file after staging attempts. No Apply was performed; there is no evidence of a canonical Roadmap or linked Markdown write. The latest model continuation failure prevents a live three-stage qualification and live UI validation of the new persistent call list.

## Qualification decision

- **Implementation:** trusted-basis repair and tool-transcript rule implemented in the dirty working tree; no commit/version change.
- **Verification:** deterministic protocol, persistence and copy tests plus builds pass. Final-source connected Chrome replay is an evidence gap. Earlier live Qwen attempts are PARTIAL and do not prove Stage 2/3 acceptance.
- **Progression:** **R4-R3-R2 PARTIAL / NOT GREEN.** Do not advance to remaining R4 UI closeout or R4-R4 final tower-defense qualification based on this report. A fresh connected Chrome run against the final served bundle must show actual accepted Stage 1 → 2 → 3, visible persisted tool calls and no pre-Apply write before scoped Green can be considered.
