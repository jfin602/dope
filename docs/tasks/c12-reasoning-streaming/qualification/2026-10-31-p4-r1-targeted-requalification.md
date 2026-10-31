# C12 Reasoning Streaming P4-R1 — targeted browser repair and requalification, 2026-10-31

**Disposition: GREEN FOR SCOPED BROWSER CORE.** The current Pi-capable LM Studio Qwen path now reports Reasoning Off as unavailable instead of offering a control that the provider ignores. Auto and On preserve genuine reasoning and separate final answers. The actual Chat copy handlers produced the expected clean and reasoning-inclusive payloads in a browser-boundary harness. Live Pi file access, cancellation, saved Chat reload, and the affected test/build groups passed. This is not full Phase 12 or native Electron GUI qualification. The original [P4 NOT GREEN report](2026-10-31-p4-browser-requalification.md) remains unchanged.

## Source, scope, and changes

- Git HEAD: `5b179ab4529192ea53091e71db26d84d442dbcec` on `main`; clean on entry and dirty only with the six product/test files below, this report, and its evidence harness at closeout. Product version remains `0.12.7`. No reset, stash, clean, or commit was made. The originally reported `464a29c` was historical; actual HEAD took precedence.
- Browser: connected Codex browser on `http://127.0.0.1:3018/#/tmp/dope-c12-p4-qual`, against the final rebuilt Dope source. LM Studio had only `qwen3.5-9b` Q4_K_M loaded at context 16,384 and parallel 2. No hosted route was observed.
- Changed: `packages/theia-extension/src/node/conversational-providers.ts`, `pi-model-bridge.ts`, `chat-backend.ts`, `packages/theia-extension/src/browser/chat-panel-widget.ts`, `test/unit/conversational-providers.test.ts`, and `test/unit/pi-model-bridge.test.ts`. Added `qualification/evidence/p4-r1-copy-boundary.cjs` and this report. The original P4 report was preserved.
- Fixture source stayed unchanged: `src/counter.js` SHA-256 `40230493a8ce898820f02e1214f53cd7d6463b95c7c8ba71a678a222c9020085`; `src/related.js` SHA-256 `5ca44575d6e01c31d44dad9b7fd48aea4630e5e45ccb7faef065c41c345a2359`.

## Reasoning Off root cause and repair

**Reproduction / FAIL before repair:** Saved `reasoning.effort: off` reached ChatBackend, the Pi model bridge, and installed Pi 1.4.0's OpenAI-compatible request as `chat_template_kwargs.enable_thinking=false` (with `preserve_thinking=true`). The live loaded Qwen model still emitted genuine `reasoning_content`. Direct requests to LM Studio's `/v1/chat/completions` with either `chat_template_kwargs.enable_thinking=false` or top-level `enable_thinking=false` also returned reasoning (169 and 161 provider reasoning tokens respectively). This is a provider endpoint behavior, not a missing Chat setting, misclassified visible answer, or a reason to hide reasoning.

**Provider comparison / PASS:** A direct request to the same loaded model through LM Studio's native `/api/v1/chat` with `reasoning: "off"` returned final `2` with zero reasoning-output tokens. [LM Studio's native chat documentation](https://lmstudio.ai/docs/developer/rest/chat) documents that control; its [API comparison](https://lmstudio.ai/docs/developer/rest) shows that the native endpoint lacks the custom tools required by the current Pi path. The endpoint that supports Pi tools therefore cannot reliably provide Off for this Qwen configuration.

**Repair / PASS:** Qwen3.5 on the Pi-capable path advertises only supported On when its reported default is On. A model reporting default Off does not get a falsely remapped Auto/On control. A stale saved/requested Off fails with `unsupported-capability` before opening Pi, and ChatBackend gives a specific explanation. Chat Settings offers Auto and On with that explanation; a previously saved Off appears as disabled “Off unavailable” so its state is not silently changed. Auto keeps the model default, On retains provider reasoning, and no model switch or reasoning-token suppression was introduced. GPT-OSS graded mapping and other providers were left intact. The final browser showed the Auto/On selector and explanation; Auto persisted after reload. The stale saved Off rejection was covered deterministically, not replayed as a live Chat turn.

## Connected browser and core regression replay

| Gate | Result | Final-source observation |
| --- | --- | --- |
| D1 arithmetic | **PASS** | On: `What is 3 + 3? Do not use tools.` completed as `6`, with no tool event and 173 provider-reported reasoning tokens in separate activity. |
| D2 Pi source | **PASS** | Auto: Pi chose exactly one brokered `read_file` on `src/counter.js`; final answered `increment(1) = 2`. Saved source reference was tool-origin with the fixture SHA-256; automatic source context had zero refs. No repeat read or write. |
| D3 reasoning | **PASS for Auto/On; Off UNSUPPORTED** | Genuine reasoning streamed separately from final and collapsed on completion. The Pi file turn reported 55 reasoning tokens. Off was absent from enabled choices with an explanation; stale Off is rejected before Pi. No claim is made that Off suppresses reasoning on `/v1/chat/completions`. |
| D4 cancellation | **PASS** | A live twelve-paragraph no-tool request showed provisional reasoning; Cancel produced saved `cancelled`, 444 activity events, no final, and “No final response.” The next no-tool `5 + 5` turn completed as `10`, with no tool event or cancelled draft in its final/context. |
| D5 persistence | **PASS** | Reload retained Auto, the completed file answer, cancelled activity attached to its turn, “No final response,” and the subsequent completed `10`. |
| D6 copy | **PASS at browser copy boundary; system clipboard EVIDENCE GAP** | Four actual UI handlers produced clean and reasoning-inclusive response/transcript payloads, detailed below. Connected browser clipboard read/paste remained inaccessible. |
| D7 authority | **PASS focused / PARTIAL live** | No fixture source changes, Roadmap or Work writes, or hosted fallback were observed. Ask/Allow, command/grant, project, and Work boundaries passed affected automated checks; this run did not repeat a complete live security matrix. |

## Copy verification

**Connected browser attempt / EVIDENCE GAP:** Left-click Copy Response displayed “Response copied.” Right-click exposed “Copy with Reasoning,” and choosing it displayed “Copied with reasoning.” `tab.clipboard.readText()` returned zero bytes and paste into the Chat composer failed with “Browser Use virtual clipboard has no data to paste.” This demonstrates a connected-browser clipboard access limitation; it does not prove a failed application copy. No successful system clipboard paste is claimed.

**Browser-boundary fallback / PASS:** The new [copy boundary harness](evidence/p4-r1-copy-boundary.cjs) opens the actual built Dope Chat, uses the visible buttons and context menus, and captures the selected textarea supplied to `document.execCommand('copy')` by the real handlers. It does not call a serializer directly or add a production debug control. All four copy calls were captured:

| Action | Result | Payload comparison |
| --- | --- | --- |
| Left-click Copy Response | **PASS** | Exact `1 + 1 = 2`; no reasoning or tool/debug text. |
| Left-click Copy Transcript | **PASS** | 2,724 bytes, chronological question before answer; no reasoning/provisional text, cancelled reasoning, raw tool/debug metadata, or “No final response.” |
| Right-click Copy Response → Copy with Reasoning | **PASS** | 471 bytes; contains `[Reasoning]` then `Final response:\n1 + 1 = 2`; no unrelated source path, tool metadata, or API-key marker. |
| Right-click Copy Transcript → Copy with Reasoning | **PASS** | 13,781 bytes; chronological question and final; captured reasoning, labelled cancelled turn with “No final response,” and completed `read_file` event without raw argument JSON or API-key marker. |

The harness also passed Shift+F10, Escape dismissal, restored Copy Response focus, text selection, and Space drag scrolling. Ordinary Chat turns had no Copy JSON control; existing explicit raw JSON behavior remains covered by deterministic tests, not a live click in this fixture. Protected-output and secret checks are limited to the tested transcript and existing redaction tests; this report does not claim every possible payload has been independently inspected.

## Final-source verification

- Broad Chat/Pi/provider/model group: `node --test test/unit/chat*.test.ts test/unit/pi*.test.ts test/unit/conversational-providers.test.ts test/unit/model-connections.test.ts` — **185/185 PASS**, including known G1/G2, reasoning, copy, cancellation, context, saved Chat, model binding, Pi source, and Work-adjacent tests.
- Additional Pi runtime/context/persistence group: `node --test test/unit/pi-runtime.test.mjs test/unit/history-context-preview.test.ts test/unit/local-context-budget.test.ts test/unit/agent-sequence-persistence.test.ts` — **29/29 PASS**. Combined final runs: **214/214 PASS**.
- Actual UI copy-boundary harness: **PASS**, four captured copy operations and all asserted gestures. `npm run typecheck`: **PASS**. `npm run build:browser`: **PASS**. `npm run build:electron`: **PASS**. `git diff --check`: **PASS**. These were run after the final product changes; the later evidence-only harness/report edits do not change product source.

## Remaining limits and disposition

- **EVIDENCE GAP:** The connected browser's virtual/system clipboard could not be read or pasted. Actual UI copy-handler payloads were verified at the browser copy boundary, as the P4-R1 fallback permits.
- **EVIDENCE GAP:** Native Electron GUI was not operated. A passing Electron build is not native UI qualification.
- **EVIDENCE GAP:** Legacy saved Off rejection and Copy JSON were deterministic-only in this run; no live turn or JSON fixture was used for those cases. The full earlier P4 gesture/security matrix was not rerun.
- **PASS for this scoped browser core:** Honest Off unavailability, no silent Off violation, actual clean/diagnostic copy-handler payloads, 214/214 affected and adjacent tests, live Pi tool source access, cancellation, context/persistence, and no observed authority regression meet the P4-R1 browser criteria. Phase 12 overall and native Electron remain unqualified.
