# c8-chat-work-ui - Prompt assessment

Status: **APPROVED / TASK STACK PREPARED**
Date: 2026-10-08
Source reviewed: Dope `main` `d7aa27040d6387d6f98649b0e6b1db35a709495b`, package `0.8.20`
Authority: ADR 0030, ADR 0016 superseding theme amendment, ADR 0025/0027/0028/0029, Product Model, Architecture, `docs/tasks/c8-work-mode/closeout.md`

## Decision and decomposition

Use **four bounded implementation prompts and one T3 manual/browser closeout**. This preserves the user's priority on selector styling and centered AgentRun Markdown, without combining unrelated source/mutation fixes into a visual qualification prompt.

| Step | Narrow responsibility | Validation | Model | Dependency |
| --- | --- | --- | --- | --- |
| P1 | Update central dark-theme accent/control/statusbar mapping and locked-theme regression | T1 | GPT-6 Sol High | current docs/source |
| P2 | Select Chat tree/rows/context actions and Chat panel visual hierarchy | T1 | GPT-6 Sol Medium | P1 tokens |
| P3 | Select Work rows/groups, work-detail information density and composer styling | T1 | GPT-6 Sol High | P1/P2 shared styles |
| P4 | Share safe assistant Markdown rendering; center AgentRun message/command layout | T2 | GPT-6 Sol High | P1-P3 styles; current transcript renderer |
| P5 | One real browser GUI, restart/theme/placement pass and exact-candidate closeout | T3 | GPT-6 Sol High | P1-P4 checked |

No separate P5 implementation cleanup or duplicate aggregate validation. P1-P4 use narrow guards; P5 owns one final broad check. If P4 cannot safely be completed in one implementation budget, split its code work before execution, but retain a single T3 gate.

## Source findings and ownership

1. `packages/theia-extension/src/browser/dope.css` owns the `.dope-dark` theme map; `dope-theme.ts` activates the class. Current central CSS still sets `--dope-primary: #FF7A1A` and `--dope-secondary: #4FA3A5`. Theme tests in `test/unit/dope-theme.test.ts` explicitly require that **historical** palette and status-bar mapping. P1 must update both, not merely restyle Chat.
2. `ai-center-widget.ts`/`dope.css` use a compact connection-button list, neutral secondary buttons, border-left selected row, and primary-action opt-in. Keep that layout language; do not copy AI Center's full center-width two-column panel into narrow Chat/Work.
3. `chat-panel-widget.ts:renderTree` builds nested folder `details` and per-chat rows with persistent Rename/Move buttons next to color/time/title; its Select Chat header lives in `render()`. This is the main clutter source. P2 adjusts **presentation and accessible actions only**, not `ChatRepository`, folders, timestamps, ordering or `ChatOpenOwners`.
4. `chat-panel-widget.ts:renderWork` appends Running/History rows as concatenated text buttons and separate small activity labels; Prompt Stacks are another basic section. `work-selection-controller.ts:workRows` already computes truthful running/history grouping and status, activity, time. P3 should style/compose these rows without reimplementing their domain semantics. Work detail embeds controls/diagnostics and must not hide approval/Stop behind decorative UI.
5. `chat-panel-widget.ts` renders assistant Chat Markdown via `MarkdownStringImpl(...,{supportHtml:false,isTrusted:false})`, `CoreMarkdownRenderer`, `safeChatLink`, and `.dope-chat-transcript` centered max-width 900px CSS. `agent-transcript-widget.ts` duplicates safe Markdown/link logic and appends messages directly to `.dope-chat-scroll` (no centered transcript wrapper), though it reuses follow behavior. P4 shares a **small** rendering helper and assistant document wrapper, with independent center-transcript state and no fabricated user messages.
6. Existing tests: `dope-theme.test.ts`, `chat-panel.test.ts`, `chat-presentation.test.ts`, `work-selection.test.ts`, `work-transcript-presentation.test.ts`, `work-integration.test.ts`, `shared-panel-state.test.ts`. The Chat and Work presentation tests include source-pattern assertions; adjust those when extracting a shared renderer while retaining equivalent behavioral/safety regressions.

## Risks / controls

- **Global theme blast radius:** changing central accent affects tabs, status bar, menus, editor selections, other Dope views. Keep exact dark/theme scope and semantic diagnostics; add focused central token/scope/status-bar tests, then exercise the real workbench once in P5.
- **Narrow selectors and keyboard actions:** folder disclosure, row selection, menu focus and long labels must remain usable in sidebars. Do not replace real buttons with hover-only unlabeled icons; test accessible labels.
- **Work authority:** controls and statuses cannot be made visually attractive by changing eligibility or default grants. Disabled action remains disabled, Stop remains explicit and close/relocate does not stop Work.
- **Shared Markdown sanitization:** reuse untrusted Theia rendering, strip disallowed links, preserve code/tables/list indentation and unreadable-metadata avoidance. A CSS/global `ol,ul {list-style:none}` rule must not suppress Markdown list markers. Preserve transcript incomplete and legacy no-record markers.
- **Scroll and restoration:** center transcript scroll must be independent of Chat/Work selection, and manual scroll-away must not turn into forced auto-follow. Reuse existing guard/helper paths with no new backend reads or persisted viewport schema.
- **Historical evidence:** October 8 repaired `c8-work-mode` P9 remains **Not Green** due to `authority-denied` command; no UI pass can claim live command/validation promotion evidence or change previously qualified Adaptive SEO checkpoint SHAs.

## Explicitly deferred

No provider adapter fix, grants or authority expansion, AgentRun schema/store/RPC changes, tool output-size changes, project database reset, Phase 8D delegation, Chat model-routing changes, map work or full-workbench restyling beyond central token impact. The separate adapter/authority defect must be diagnosed and requalified **after** this UI pass, before original P9 can close Green.

## Evidence allocation

- P1 **T1:** `node --test test/unit/dope-theme.test.ts`; CSS/theme scope and semantic diagnostic guard.
- P2 **T1:** `test/unit/chat-panel.test.ts` and `test/unit/chat-presentation.test.ts` plus smallest new selector guard; extension package build as needed.
- P3 **T1:** `test/unit/work-selection.test.ts` and narrow Work-facing presentation tests; extension package build as needed.
- P4 **T2:** changed-extension build and affected Chat/AgentRun renderer and integration tests; no standalone browser build.
- P5 **T3:** one `npm run check`, only otherwise-uncovered focused Work tests, direct GUI and restart/alternate-theme checks, evidence closeout. Use fixture commands strictly as *presentation* evidence; do not claim the separate live execution gate.

No full `npm run check` in P1-P4. Ordinary prompts target <=8 minutes and must not run to 15 minutes merely to fill the budget.
