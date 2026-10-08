# c8-chat-work-ui - Source-aware implementation plan

Status: **APPROVED / PROMPTS WRITTEN / EXECUTION PENDING**
Date: 2026-10-08
Source starting point: `d7aa27040d6387d6f98649b0e6b1db35a709495b`, `0.8.20`; refresh Git HEAD and read predecessor handoff before each prompt
Assessment: `prompt-assessment.md`
Authority: ADR 0030, ADR 0016 current amendment, `docs/ARCHITECTURE.md`, `docs/PRODUCT-MODEL.md`

## Producer / consumer / state boundaries

- Theme registration: `packages/theia-extension/src/browser/dope-theme.ts`, `frontend-module.ts`; token owner and consumer styles: `dope.css`. Test: `test/unit/dope-theme.test.ts`. `.dope-dark` activated/deactivated on explicit theme changes; user theme override must never be contaminated.
- AI Center reference: `ai-center-widget.ts` and `dope.css` `.dope-ai-*` styles. **Visual reference only**, no new cross-module controller or center tab ownership.
- Chat source: `chat-panel-widget.ts:renderTree/render`, `chat-panel-controller.ts`, `chat-panel-presentation.ts`; Chat repository/service owns durable identity, folder/sort/color/lease. UI may change row DOM/CSS but not Chat mutation semantics.
- Work source: `chat-panel-widget.ts:renderWork/renderWorkComposer`, `work-selection-controller.ts:workRows/workTitle`, `shared-panel-state.ts`, `phase-stack-controller.ts`. Agent Runtime owns task/run truth and grants; the panel only renders/dispatches existing actions. `frontend-module.ts` owns launchers/one renderer-scoped RPC; leave it intact unless a strictly necessary presentation reference is added.
- Transcript source: Chat `chat-panel-widget.ts` uses `CoreMarkdownRenderer`, `MarkdownStringImpl`, `safeChatLink` and `.dope-chat-transcript`; Work `agent-transcript-widget.ts` uses same Markdown safety in duplicate and `work-transcript-presentation.ts` for command labels, pagination/scroll. `AgentTranscriptEntry`, `readTranscript`, storage and provider adapter remain unchanged.
- Tests: `dope-theme.test.ts`, `chat-panel.test.ts`, `chat-presentation.test.ts`, `work-selection.test.ts`, `work-transcript-presentation.test.ts`, `work-integration.test.ts`, `shared-panel-state.test.ts`. Some assert literal source strings; update guards to verify the new reusable safe path, not remove security assertions.

## P1 - Theme tokens and central scope (T1)

Change **only** the central theme variables and directly necessary mapping in `dope.css`, plus `test/unit/dope-theme.test.ts`:
- `#1F1F1F` anchor, `#336699` as brand/interactive primary, neutral `#303030` secondary controls and `#484848` borders; derived low-noise focus/hover/selection colors should be theme-scoped and accessible.
- Replace orange-as-primary / teal-as-global-focus mappings with semantic use of the current tokens. Old orange/teal may remain for intentional color choices, warnings or chart semantics, not automatic every-control emphasis.
- Keep status bar mostly dark, preserve one Git accent region and semantic diagnostics; avoid returning to a full-width filled status bar. Keep AI Center's existing primary-action opt-in and ordinary secondary buttons neutral.
- Preserve alternate-theme deactivation and syntax coloring. Preserve user-selected ten Chat colors, which are separate from brand tokens.
- Test the new literal palette **centrally**, status bar semantics, absence of unintended global widget hex overrides and theme activation/deactivation. No broad UI redesign of unrelated panels.

Smallest validation: `node --test test/unit/dope-theme.test.ts`, `git diff --check`, package/version/no-root-lock checks. No browser build or full suite.

## P2 - Select Chat and shell (T1)

Main files `chat-panel-widget.ts`, `dope.css`; tests `chat-panel.test.ts` and `chat-presentation.test.ts`.
- Keep selector header fixed/compact; list independently scrollable. Present each chat as a keyboard-accessible primary title row with a durable color dot and muted last-interacted time; handle wrapping, long titles and nested depth without horizontal overflow.
- Convert low-frequency Rename/Move and folder actions from always-prominent inline button crowds to an accessible contextual disclosure/menu or similarly quiet control. Use existing `name`, `folderChoice`, `mutate` and `newChat/newFolder` handlers, not a second mutation API.
- Preserve folder `details` disclosure, nested selection and actions independently. Make keyboard focus/active and hover recognizable without relying on the accent alone. Do not create hover-only functionality inaccessible to keyboard/touch.
- Harmonize Chat header/buttons/settings/fixed composer with AI Center neutral control grammar. Do not change model, context, composer send/stop/retry, streaming or `ChatOpenOwners` behavior.
- Focused checks should assert action reachability, folder hierarchy, selection/focus/labels, color dot and dates; retain existing conversation safety checks.

Smallest validation: changed extension workspace build only if needed for compiled tests, `node --test test/unit/chat-panel.test.ts test/unit/chat-presentation.test.ts`, `git diff --check`. No T3 browser or full `npm run check`.

## P3 - Select Work and Work detail (T1)

Main files `chat-panel-widget.ts:renderWork/renderWorkComposer`, `dope.css`; preserve `work-selection-controller.ts:workRows` as truth source.
- Render Running/History/Prompt Stacks with compact section headings, row primary title + secondary status/activity/time, semantic status cue, selected/focus/hover, empty states and stable task-derived titles; no giant concatenated text buttons.
- Preserve actual `workRows` Running filter (true active runs only), history ordering, nested Prompt Stack/run grouping, `docs/tasks/` input, refresh and existing valid/invalid stack semantics. Never edit task/run/sequence state to shape the list.
- Work detail hierarchy: actionable run progress and Stop/Open Transcript/Start/Resume/manual-grant/checkpoint controls remain explicit and visible; move verbose diagnostics to a low-emphasis accessible disclosure. Preserve every status, validation/authority denial, checkpoint and truncation.
- Present New Work composer as a compact integrated neutral form (comfortable narrow panes, no distracting thick borders or resize affordance). Keep explicit grant checkbox/model/validation and disabled-start eligibility intact; no in-flight steering.
- Add focused UI regression for row rendering/status labels/controls, plus tests protecting no new run or grant mutation merely from selection. Do not claim a live command is now authorized.

Smallest validation: changed extension workspace build as required, `node --test test/unit/work-selection.test.ts test/unit/shared-panel-state.test.ts` and the smallest new Work UI test, `git diff --check`. No broad product suite or live provider run.

## P4 - Center AgentRun transcript (T2)

Main files `agent-transcript-widget.ts`, `chat-panel-widget.ts`, a minimal shared frontend helper (new only if useful), `dope.css`, relevant presentation tests. Do not touch `AgentStore`, `AgentRuntimeBackend`, provider adapter, grants or DTOs.
- Extract/reuse one safe untrusted Markdown message rendering helper for Chat assistant turns (including streaming) and AgentRun messages. Prefer existing Theia renderer; retain `supportHtml:false`, `isTrusted:false`, allowlisted link navigation and `rel=noopener noreferrer`. No new Markdown dependency or raw HTML.
- Give center AgentRun `.dope-chat-scroll` a centered max-width transcript/document wrapper equivalent to Chat `.dope-chat-transcript`, with assistant-only unboxed message containers. No fabricated user messages, user bubbles, role-name repetition or backend conversational mapping.
- Keep chronological command `details` rows interleaved in the same centered reading column, collapsed by default; summarize command/status/exit/duration and reveal bounded output only where stored. Keep neutral system markers, honest truncation and legacy transcript-not-recorded text.
- Protect Markdown list bullets/numbering inside both renderers from generic panel `ul/ol {list-style:none}`, and ensure code/table overflow is horizontal inside the column rather than widening the workbench.
- Preserve center transcript's independent follow state, jump-to-latest, paging from first entry, scroll-up and restart/fallback. Do not interfere with panel controls or Chat conversation follow.
- Update source-string-based tests as needed to assert a **shared trusted rendering path and actual security contract**; retain explicit malicious-link and escaped HTML regressions, independent scroll and default-collapsed command checks.

T2 validation: build the changed `@dope/theia-extension` package once if compiled tests need it; run `node --test test/unit/chat-presentation.test.ts test/unit/work-transcript-presentation.test.ts test/unit/work-integration.test.ts`, plus only another directly broken Chat guard. `git diff --check`. Do not run a separate browser build or `npm run check`.

## P5 - Exact-candidate GUI / closeout (T3, manual)

Preflight review P1-P4 commits/handoffs, confirm `0.8.20`, single coherent source and no unrelated/dirty changes. Run **one** `npm run check`; then only uncovered focused tests (e.g., `work-selection`, `work-transcript-presentation`, `work-integration`, `shared-panel-state` when not included by the aggregate). Confirm `npm run codex:phase:validate -- c8-chat-work-ui` and `git diff --check`. No AppImage package unless changing packaging substrate.

Using a disposable real project in browser-hosted or native Electron Theia, directly inspect AI Center and each selector/Chat/Work at dark default, narrow left/right, center/bottom and one alternative theme. Exercise keyboard and touch-equivalent access, focus, long names, folder and Work grouping, accessible actions, stable titles, status labels, grant/Stop visibility, centered Markdown headings/lists/table/code/links, safe untrusted HTML, command collapse/expand where recorded, scroll-away/Latest, and restart/restoration. An existing synthetic **recorded** command may verify disclosure UI only; record that this does not prove the separately blocked P9 live command/authorization gate.

Open `/home/jfin/dev/adaptive-seo-dope` strictly read-only to inspect saved `c4-dope-phase-stack-smoke` and legacy transcript fallback without re-running that stack, changing SHA, or modifying product/database/production. Avoid agent writes to that project. Log exact source SHA, tests, direct GUI evidence, unresolved defects and **Green / Not Green for this UI correction alone** in `closeout.md`, and update the correction README. Do not edit/overwrite historical `c8-work-mode` P9 failure evidence. Green routes to separate authority-denied command investigation then P9; Phase 8D remains blocked.

## Non-goals / invalid shortcuts

No hard-coded per-widget color palette, theme override contamination, fake stream/user bubbles, invisible command permission bypass, fake provider output recorded as live execution, backend AgentRun or Chat schema changes, duplicate RPC client, additional Work identity, auto-cancel-on-navigation, reopening/committing the Adaptive SEO reference, or repeating the expensive aggregate in every prompt.
