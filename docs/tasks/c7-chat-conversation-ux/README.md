# Correction 7 — Chat Conversation UX

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c7-chat-conversation-ux`
Required unchanged package version: `0.7.13`
Activation/source baseline: `5b3653bc13d7632720550d42fe898830b8330d5f`
Phase context: Product Phase 7 active / P13 evidence audit Not Qualified / Phase 7B-7C outstanding
Authority: ADR 0025 as amended by c7-chat-conversation-ux, current Phase 7 plan, PRODUCT-MODEL, ARCHITECTURE, workflow, and retained P12/P13 evidence

## Purpose

Make Dope Chat read and behave like a familiar modern AI conversation surface without changing Phase 7 model, context, persistence, or authority semantics.

The correction also gives every Chat a durable ten-color organizational identity used in the Chat selector and developer message bubbles.

## Locked behavior

1. **Persistent three-region shell**
   - Fixed Chat top bar: Back, title, settings always visible.
   - Transcript is the only scrolling conversation region.
   - Composer stays fixed at the bottom of the ChatPanel.
   - Works in left, right, center, and bottom ChatPanel placements.

2. **Unified composer**
   - Multiline input and bottom tool/action row are one visual container.
   - Context controls, Ask / Explain / Trace / Find Related, model selection and Send/Stop/Retry remain available.
   - Selected context stays compact and associated with the composer.
   - Do not change per-turn model authority or no-silent-fallback behavior.

3. **Conversation-first transcript**
   - Developer messages: right-aligned bubbles.
   - Assistant messages: neutral, unboxed formatted document text.
   - Remove repetitive visible You / Assistant headings.
   - Preserve accessible role semantics.
   - Render assistant Markdown safely: headings, emphasis, lists, links, inline/fenced code, blockquotes, and tables where supported.
   - Do not permit model-authored raw HTML/script injection.

4. **Compact response data**
   - Normal timestamps/status/provider/model/context metadata are visually secondary and compact.
   - Failed/cancelled/interrupted turns remain clearly visible and inspectable.
   - Main answer text remains the focal point.

5. **Scroll-follow behavior**
   - Streaming follows newest content only while the developer is at/near the bottom.
   - Manual upward scrolling stops forced auto-follow.
   - Provide a compact return/jump-to-latest affordance.

6. **Durable Chat color identity**
   - Palette: blue, cyan, teal, green, yellow, orange, red, pink, purple, indigo.
   - New Chats get a deterministic/distributed assignment from stable Chat ID.
   - Existing Chats without color are deterministically migrated/defaulted and persisted.
   - Color is Chat metadata, not model/context `ChatSettings`.
   - Chat selector displays a small color indicator.
   - Developer bubbles use the Chat color with readable contrast.
   - Assistant responses remain neutral.
   - Chat settings exposes a visual ten-color picker.
   - Rename, folder move, panel relocation, auto-title, and restart preserve color.
   - Color carries no product-defined semantic meaning.

7. **Left/right Chat launchers**
   - Left primary toolbar/activity bar shows a Chat button that opens/reveals Select Chat in the left panel.
   - Right secondary toolbar/activity bar shows the same Chat button for the right panel.
   - Repeated activation reuses/reveals the existing launcher panel on that side rather than opening duplicates.
   - If the side launcher is inside a Chat, toolbar activation returns it to Select Chat and releases that Chat ownership normally.
   - Reuse the existing left/right Chat commands where practical; keep center/bottom command-palette Chat opening available.
   - Use supported Theia workbench/view/shell contribution APIs only; no DOM/private-shell hacks.
   - Chat organizational color does not tint the global launcher icon.

## Preserved boundaries

Do not change:
- provider/model connection ownership;
- explicit per-turn model selection;
- no-silent-fallback behavior;
- Chat ownership/lease semantics;
- context composition/provenance;
- Phase 7 read-only tool boundaries;
- canonical Project Mind / Architecture / Planning truth;
- Software Map / Flow / Planning behavior;
- package version;
- P12/P13 historical evidence.

## Prompt stack

| Prompt | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Chat color domain, mutation, persistence, deterministic migration | T1 | GPT-6 Sol High | no |
| P2 | Conversation shell + left/right launcher actions + transcript/Markdown/composer/color UI | T1 | GPT-6 Sol High | no |
| P3 | exact-candidate browser/integration/launcher qualification + correction closeout | T3 | GPT-6 Sol High | yes |

Major testing is intentionally concentrated in P3. P1/P2 run only focused regressions and the smallest required package build.

## Prompt files

- `P1-chat-color-persistence.txt`
- `P2-conversation-surface.txt`
- `P3-browser-qualification-closeout.txt`

Planning artifacts:
- `prompt-assessment.md`
- `implementation-plan.md`

## Execution

Validate first:

`npm run codex:phase:validate -- c7-chat-conversation-ux`

Then run the implementation prompts:

`npm run codex:phase -- c7-chat-conversation-ux`

Automation must stop for P3 manual/browser qualification.

## Next routing

If P3 is Green, return to bounded Phase 7B/7C continuation planning. Do not rewrite the existing P13 evidence audit as Green.
