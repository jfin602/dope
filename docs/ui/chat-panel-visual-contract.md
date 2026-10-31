# Chat panel visual and interaction contract

**Owner-approved target:** 2026-10-31 interactive Chat UI repair loop, on the existing `0.12.7` ChatPanel. This document records the current browser-visible target for future Chat work and applicable Dope controls. It is a design baseline, not a claim that C12 P4, native Electron, or Phase 12 has passed qualification. Preserve the dated [P4 evidence](../tasks/c12-reasoning-streaming/README.md).

## Overall layout

- Keep one saved ChatPanel. The chat title, transcript, composer, and settings belong to that panel.
- The transcript is the scrolling surface for messages, reasoning, and final answers. Expanded reasoning uses the normal chat width and edges; it does not add a nested vertical scrollbar after completion.
- Chat settings overlays the **entire Chat shell**, including the title, transcript, and composer, at the shell's full available width. Its own scroll does not change the transcript's scroll position or height. The toolbar settings cog changes to an X while open and changes back when closed. The settings sheet has no second Close button. Escape may dismiss it.
- The composer stays at the bottom of Chat. Its model selector, Commands selector, buttons, and + popup use the same Dope control colors, borders, radius, and visible focus treatment as settings. The + popup has themed select options, actions, hover, disabled, and expanded states.

## Assistant turn

| State | Required presentation |
| --- | --- |
| Working | A borderless, backgroundless `▾ Working...` disclosure with elapsed time at the right. It opens by default and streams captured reasoning or provisional activity beneath it as readable Markdown. Clicking the row collapses it to one line. |
| Finished | The same disclosure becomes `Finished`, retains the elapsed time, and collapses automatically when the final answer begins. The answer streams below it as normal Chat text. A subtle horizontal rule separates it from the disclosure. |
| Canceled or Error | The same disclosure becomes `Canceled` or `Error`, retains the elapsed time, and keeps available activity inspectable. If no final answer was committed, show `No final response`. |

- Render captured prose with its paragraphs, line breaks, lists, code, and spacing intact. Preserve the order of text and tool events. Provider-exposed reasoning and unclassified provisional activity retain truthful labels in data and diagnostic copy; the UI must not invent private reasoning.
- Show each tool call on its own line at the point it occurred. Use a slightly smaller, muted, normal-weight line starting with the tool name, followed by a safe project-relative file path when applicable. Omit the `Tool Call` prefix. Never show raw tool payloads, secrets, or unsafe paths.
- Do not render a separate Project activity block or a `Surfaced Reasoning` heading. Do not repeat the committed final answer inside the reasoning disclosure or Copy with Reasoning.
- Keep user bubbles and assistant text aligned with the existing chat transcript. Reasoning uses the chat background and shares the assistant content edges, without a card border.

## Response footer and copy

- Directly below the final answer or `No final response`, use one row: Copy and Info controls on the left; the turn's date and time on the right, for example `10/31/2026, 2:54:10 PM`.
- Keep status, execution ID, model, routing/provenance, and “Why this model?” diagnostics hidden by default. The Info control toggles a compact block under that row and toggles it closed again.
- Left-click Copy retains the clean response or transcript payload. Right-click / keyboard context menu offers **Copy with Reasoning** when captured activity exists. That diagnostic copy preserves formatted text order and includes the same safe tool-call lines and applicable path. It must not include a duplicate final answer.
- Copy feedback appears briefly at the button itself (`Copied.` or `Copied with reasoning.`). Do not append a lasting copy-status line to the transcript.

## Theme guidance for related controls

Use Dope/Theia theme tokens already defined in `packages/theia-extension/src/browser/dope.css`. Apply this control grammar to future Chat components and other applicable Dope popups, rather than relying on white browser-default form controls.

| Element | Theme treatment |
| --- | --- |
| Panel and popup surfaces | `--theia-editor-background` or `--theia-editorWidget-background`, with `--theia-widget-border` for meaningful separation. |
| Selects and numeric fields | `--theia-input-background`, `--theia-input-foreground`, `--theia-input-border`; box sizing, compact padding, rounded corners, and a visible `--theia-focusBorder` focus outline. Style option colors where supported. |
| Neutral buttons and menu items | Theia secondary button colors and borders, with distinct hover and disabled states. |
| Primary save action and checked controls | `--dope-action-background` / `--dope-primary`, paired with `--dope-on-primary`; reserve the accent for meaningful actions and selection. |
| Metadata and tool lines | `--theia-descriptionForeground` and smaller type. Keep reasoning prose and final answer at normal readable text size and weight. |

At narrow side-panel widths, controls remain within the panel and labels stay readable. Popups and overlays have their own bounded scrolling where needed. Retain keyboard focus, accessible names, and disclosure state when restyling.

## Implementation seams

- `packages/theia-extension/src/browser/chat-panel-widget.ts` owns the single Chat shell, settings overlay, composer, disclosure state, footer, and copy controls.
- `packages/theia-extension/src/browser/chat-panel-presentation.ts` owns the chronological activity, tool-line, final-answer, and diagnostic-copy projections.
- `packages/theia-extension/src/browser/dope.css` owns the Chat geometry and theme rules; `frontend-module.ts` owns the cog/X toolbar state.
- `packages/chat/src/activity.ts` and the Chat backend own bounded, sanitized activity and safe tool-path metadata. Presentation changes must preserve those boundaries.
- Focused behavior coverage lives in `test/unit/chat-activity.test.ts`, `chat-grounded-turn.test.ts`, `chat-panel.test.ts`, and `chat-presentation.test.ts`.

## Regression review

When changing Chat presentation or shared controls, inspect the connected browser at the actual narrow Chat width and check these paths:

1. Stream a turn with captured reasoning/provisional text and a tool call; verify readable Markdown, event order, file path safety, and disclosure toggle.
2. Finish a turn; verify automatic collapse, one final answer, subtle rule, footer alignment, Info toggle, and both copy modes.
3. Cancel and fail a turn; verify truthful state, elapsed time, retained inspectable activity, and `No final response` when appropriate.
4. Open and close settings with the cog/X; verify full-shell coverage, themed controls, independent scrolling, and unchanged transcript scroll position.
5. Open the + menu and inspect model/Commands selectors, menu select, actions, hover/focus/disabled states, and narrow-width fit.

Run the focused Chat activity, panel, and presentation tests for behavior changes. A browser check does not qualify native Electron or clear the historical C12 P4 result.
