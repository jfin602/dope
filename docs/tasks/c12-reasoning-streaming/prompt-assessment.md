# /prompt-ass — c12-reasoning-streaming

**Reviewed:** 2026-10-31, GitHub main source. **Status:** ASSESSED / DOCS ONLY, not executed, not qualified. **Baseline:** 0.12.7 at review; owner local checkout may have uncommitted changes. [ADR 0042](../../decisions/0042-chat-reasoning-lifecycle-and-diagnostic-copy.md).

## Source-backed findings

- packages/pi-runtime/worker.mjs currently declares local model reasoning:false and streams Pi assistantMessageEvent text_delta only. No proven surfaced thinking_delta or split thinking/final channel. Do not assume Qwen or another selected provider exposes hidden reasoning. With or without explicit thinking, incomplete text can be presented as provisional activity until provider completion.
- pi-runtime-host.ts and pi-conversation-runtime.ts carry delta/complete; ChatBackend currently concatenates streamed delta text to output and publishes assistant-delta. On finish it stores output as Chat assistant content; on failure/cancel it also stores partial output in assistant content.
- packages/chat/src/index.ts defines ChatAssistantMessage.content as visible answer only; no durable reasoning record exists. packages/chat/src/service.ts has assistant-delta and tool-progress but no typed reasoning/provisional diagnostic events.
- chat-context-composer.ts already selects only completed assistant messages for normal next-turn conversation. This is partial protection, not sufficient: unclassified streamed text can be committed as a complete answer. Saved-chat retrieval, title, Planning/Roadmap and other Chat consumers must be audited.
- chat-panel-widget.ts renders streaming assistant text through regular markdown, while activity/tool details are already expandable. chatResponseCopyText/chatTranscriptCopyText in chat-panel-presentation.ts produce clean projections. Copy Response, Copy Transcript and Copy JSON controls exist. Preserve those default payloads, selection and drag-to-scroll.
- Existing tests test/unit/chat-panel.test.ts and test/unit/chat-presentation.test.ts cover clean-copy and input/scroll invariants; reuse and extend rather than building a second Chat UI.
- C12 planning recovery replaces rigid implementation-plan as product goal, but its cleanup is independently scoped and may be in flight locally. Do not revive submit_plan or edit canonical Roadmap/Markdown in this correction.

## Risks and controls

1. **Misclassification:** provider internal reasoning is not available merely because output looks like thinking. Use typed provider events and tested delimiters only; classify other incomplete output as provisional; do not relabel repeated words as private thoughts.
2. **False completion:** a timeout, abort, error or missing final event must not create a final answer; cancelled output remains diagnostic, not conversational.
3. **State compatibility:** persist diagnostic activity by existing turn IDs with size/event limits and strict parser handling. Keep older schema-1 chats openable and ordinary context/history clean. Preserve real failure evidence and existing approval boundaries.
4. **Leaks:** reasoned text is voluntarily exportable only when surfaced and captured, not provider-hidden; tool logs must be redacted and bounded. No protected file bodies, permission tokens or untrusted raw provider objects in stored/exported diagnostics.
5. **Performance and UX:** twelve duplicate paragraphs and long-lived agent streams must not force huge Chat DOM rerenders, context growth or auto-scroll jumps. Keep activity height limited, progressive updates bounded, user expansion stable, and manual browser verification independent.
6. **Scope:** do not change Work authority, Pi tool broker, Chat settings/provider routing, Roadmap, program versions or existing past qualification.

## Efficient split

- **P1 runner:** typed provider-to-backend activity/final separation; failure/cancel semantics and bounded durable activity record. Audit exact event capabilities first.
- **P2 runner:** activity projection and lifecycle UI in existing ChatPanel, with context/recovery isolation regressions; no copy-menu work.
- **P3 runner:** shared right-click copy-with-reasoning menu and deterministic serializers for all Dope-owned Chat copy controls; copy/context/security tests.
- **P4 MANUAL Codex browser closeout:** real browser source-bound scenarios, cancel/run/reopen/context/copy/scroll, plus separate owner native Electron evidence or honest EVIDENCE GAP.

No /activate or self-commits by the coding prompts (runner owns commits), no package/version bump. P1-P3 target <=8 min each, soft 10/hard 15; stop honestly on uncaptured provider thinking or unsafe migration. P4 is never headless-runner Green.
