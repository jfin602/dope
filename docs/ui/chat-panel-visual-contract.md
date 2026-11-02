# Chat panel visual and interaction contract

**Owner-approved target:** 2026-10-31 interactive Chat UI repair loop, on the existing `0.12.7` ChatPanel. This document records the current browser-visible target for future Chat work and applicable Dope controls. It is a design baseline, not a claim that C12 P4, native Electron, or Phase 12 has passed qualification. Preserve the dated [P4 evidence](../tasks/c12-reasoning-streaming/README.md).

## Overall layout

- Keep one saved ChatPanel. The chat title, transcript, composer, and settings belong to that panel.
- The transcript is the scrolling surface for messages, reasoning, and final answers. Expanded reasoning uses the normal chat width and edges; it does not add a nested vertical scrollbar after completion.
- Chat settings is a sheet over the conversation, starting directly below the Chat toolbar. It does not move or resize the transcript or composer. The composer remains visible below the conversation. The sheet scrolls independently when its contents exceed the available height.
- While the sheet is open, the toolbar label reads **CHAT SETTINGS** and the normal conversation title row is hidden. There is no title row inside the sheet: **Appearance** starts at its top. The toolbar settings cog becomes an X and returns to the cog when the sheet closes.
- The sheet ends just below **Save settings** instead of filling the conversation height. A small centered tab with an up arrow protrudes from its bottom edge. Clicking that tab, the toolbar X, the dimmed conversation, or pressing Escape closes the sheet. Saving closes it after a successful save.
- The conversation beneath the sheet has a translucent black dimmer while settings is open. The sheet slides down and the dimmer fades in quickly on open; both reverse on close. Honor reduced-motion preferences. The dimmer and sheet must not restart their entrance animations when settings rerenders, including after a Chat color change. Color selection updates its pressed state while the sheet stays open and visually steady.
- The composer stays at the bottom of Chat. Its compact toolbar and attachment popup use Dope control colors and fit a narrow docked panel. The composer container gets the focus border; focusing its textarea must not draw a second border or outline inside it. The selectors retain visible keyboard focus treatment.

## Composer toolbar and attachment menu

- The toolbar order is attachment, model, Commands, Send. The attachment control is a plain plus icon and Send is a plain up-arrow icon; neither has its own button background or border. Keep accessible names, keyboard focus, and a useful hover state.
- The model selector grows into the available horizontal space. Its sparkle icon sits **inside** the left edge of the dropdown. The Commands selector has a terminal icon **inside** its left edge and displays only **Ask** or **Allow**; there is no visible `Commands:` label. Icons must not block the native selectors.
- Send is muted while disabled. When a nonempty draft and usable model make Send available, its arrow fades to `--dope-primary` orange without adding a button background. Disable the transition for reduced motion.
- **Allow** colors the Commands dropdown border, terminal icon, and selected text orange. **Ask** uses neutral control colors. Changing the mode must preserve the existing command permission behavior.
- When the selected model or its connection is unusable, the **whole model dropdown** (border, sparkle icon, and selected text) uses the error color and its selected label is **No Model**. Keep unavailable connections and models visible as disabled, error-colored entries in the model list. Healthy selectable models retain normal colors. The **last** entry is always **Manage Models**; choosing it opens AI Center without changing the selected Chat model.
- The plus popup is titled **Add Context:** and contains only applicable direct attachment actions: **File**, **Selected code** when a valid project editor selection exists, **Current planning selection** when valid and not already included, and **Saved Chat excerpt** when retrieval is enabled. Each action has a small icon. Do not return prompt shortcuts, model management, troubleshooting, or raw ID/path entry to this popup.
- The popup stays inside the viewport at narrow widths, closes on outside click or Escape, supports keyboard navigation, and closes after an attachment is chosen. Attached items appear as concise removable chips near the composer without covering Send or changing Chat identity.

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

## Inline Roadmap proposal cards (2026-11-01 owner refinement)

- A newly validated reviewable Roadmap edit proposal is represented by **one card inside its originating assistant's committed final response**, after one concise summary from the proposal JSON and immediately above that response's Copy/Info/timestamp footer. That summary is the final answer text and the ordinary Copy Response text; do not add template questions or repeat the card's status/revision above it. The normal Working/Finished activity disclosure remains outside the final answer. Do not append a separate assistant message, “Roadmap change” activity row, duplicate status line, or nested activity wrapper for the same proposal. The existing underlying activity/event, decision and audit data are retained.
- The proposal card occupies **100% of the available assistant-content width**, respecting the normal Chat transcript padding; remove unnecessary nested max-width constraints and avoid horizontal clipping. At narrow dock widths, actions wrap, descriptions and diffs remain inspectable, and the overall transcript does not gain a horizontal scrollbar. Preserve keyboard focus, screen-reader status, reduced-motion, selection and drag/touch scrolling.
- While pending and valid, the card presents an exact bounded change summary, expandable details/diagnostic diff, current source/revision status, and **Apply (Accept)**, **Reject** and **View in Roadmap** where supported. These are the existing reviewed backend actions, not new approval authority.
- On a verified decision or invalidation, **the same card at the same transcript position** transitions into a compact, optionally expandable historical state: applied, developer-rejected, denied, stale, failed, cancelled or superseded as actually evidenced. Do not retain a live Apply action on a historical/expired review. Preserve proposal-to-originating-turn identity across multiple turns, rerenders and saved Chat reopening, without duplicating cards.
- Keep the ordinary clean Copy/Copy Transcript behavior and the existing separate diagnostic Copy with Reasoning behavior. The card must not cause raw debug payloads or private approval tokens to enter ordinary copied text. See [Roadmap proposal lifecycle](../planning/p12/roadmap-proposal-lifecycle-and-publication.md) and [hybrid canvas preview](../planning/p12/chat-roadmap-hybrid-proposal-review.md) for the authoritative preview/approval and active-tab-only auto-preview rules.

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
4. Open settings with the cog; verify **CHAT SETTINGS** in the toolbar, **Appearance** at the top of the sheet, the composer still visible, and the sheet ending below Save with its protruding up-arrow tab. Verify the conversation dims as the sheet slides down, with no transcript layout or scroll jump.
5. Change Chat color twice while settings stays open; verify each selected swatch updates, and neither the sheet nor dimmer closes, flashes, or replays its entrance animation. Check another settings control that rerenders the sheet for the same behavior.
6. Close with the up-arrow tab, toolbar X, dimmed conversation, and Escape in separate attempts; verify the sheet slides up, the dimmer fades out, and the toolbar returns to **CHAT**. Check reduced-motion behavior and a short viewport where the sheet must scroll while the pull tab remains reachable.
7. At narrow Chat width, check the icon-only plus and Send controls; sparkle and terminal icons inside their dropdowns; absence of `Commands:`; and the single outer composer focus border. Type and clear a draft with a usable model to verify the Send arrow fades orange and returns to muted, including reduced motion.
8. Switch Ask/Allow and verify the orange Commands border, icon, and text only in Allow. Make a selected model or connection unavailable; verify the red model border, icon, and **No Model** text, disabled red entries in the list, and a healthy model's neutral state. Check **Manage Models** is last, opens AI Center, and preserves the Chat model selection.
9. Open **Add Context:** and verify only applicable File, Selected code, Current planning selection, and Saved Chat excerpt actions; attachment chips and removal; keyboard focus, Escape/outside close, and viewport fit.

Run the focused Chat activity, panel, and presentation tests for behavior changes. A browser check does not qualify native Electron or clear the historical C12 P4 result.
