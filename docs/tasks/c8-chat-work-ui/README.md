# c8-chat-work-ui - Chat and Work presentation alignment

Status: **PLANNED / PROMPTS WRITTEN / NOT IMPLEMENTED**
Mode: Correction
Phase: 8
Required unchanged project version: `0.8.20`
Planning baseline: `d7aa27040d6387d6f98649b0e6b1db35a709495b` (2026-10-08; inspect live HEAD before editing)
Approval: ADR 0030, ADR 0016 October 8 palette amendment; Product Model, Architecture, Phase 8 plan
Predecessor: `c8-work-mode` P1-P8 plus repaired P9 source; repaired P9 remains **NOT GREEN**.

## Goal

Make Chat, Work, Select Chat and Select Work follow the existing AI Center's restrained dark design language, with current Dope Dark primary accent `#336699`, neutral controls and subtle borders. Present the optional center AgentRun transcript as the **same centered, safe-Markdown, unboxed assistant document** used by Chat, but **without user bubbles**. Work remains an execution control/observation panel; its center transcript remains read-only.

Keep the separate Chat and Work modules, current launchers, layouts and user-selected themes. No change to agent persistence or execution authority.

## Ordered prompt stack

| Prompt | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Current Dope Dark token allocation, AI Center-compatible control emphasis, theme regression guards | T1 | GPT-6 Sol High | no |
| P2 | Select Chat hierarchy/row actions, readability and narrow-panel presentation | T1 | GPT-6 Sol Medium | no |
| P3 | Select Work grouping/row readability, Work detail/composer visual hierarchy | T1 | GPT-6 Sol High | no |
| P4 | Shared safe Markdown presentation and centered AgentRun transcript, affected integration tests | T2 | GPT-6 Sol High | no |
| P5 | Exact-candidate real GUI visual/functional qualification and correction closeout | T3 | GPT-6 Sol High | yes |

P1-P4 are runner-owned implementation checkpoints, with focused tests and minimal changed-package builds. P5 is the **single browser-required manual closeout**; avoid full suite/browser/Electron repeat work in P1-P4. Normal implementation goal <=8 minutes, 10-minute soft ceiling, 15-minute hard ceiling; split a revealed large task rather than silently broadening a prompt.

## Non-negotiable boundaries

- Keep package `0.8.20` and existing Theia theme selection/activation semantics. Do not introduce CSS overrides that leak into user-selected compatible themes, or recolor syntax/diagnostics. Ten per-Chat color choices remain distinct organizational metadata; do not replace them with the global accent.
- Chat remains `.dope/chats/`, Interactive role, project-scoped single-Chat ownership; Work remains `.dope/agent/`, Coding Agent role, AgentTask/AgentRun/AgentTaskSequence/ExecutionGrant, work owner focus and explicit control. No Chat | Work toggle.
- Preserve Prompt Stack discovery (`docs/tasks/`), Running/History truth, historical stable task titles, panel placement/restore, stop vs close, process/project isolation and source/contract authority.
- Preserve canonical Markdown safety: Theia `MarkdownStringImpl` untrusted options, safe-link filtering, HTML/command-link denial, output bounds, no provider hidden reasoning. Do not create user turns from AgentRun data.
- Command entries remain chronological, structured and default-collapsed with explicit output/terminal status/truncation. A legacy run without recorded transcript reports this honestly.
- The original `c8-work-mode` P9 **Not Green** remains separate: a disposable in-grant command ended `authority-denied`, so live command expansion, required validation and promotion were not qualified. This UI stack **must not** widen ADR 0028/0029 grants, rewrite evidence, mark P9 Green or advance Phase 8D.

## Qualification contract

P5 verifies visually and functionally: AI Center-matched default presentation, `#336699` emphasis, readable narrow left/right selectors, center/bottom placements, Chat folder/title/date/color/actions, Work Running/History/Prompt Stack and status, Work controls/diagnostics, centered AgentRun Markdown/code/table/list/link presentation without bubbles, collapsed/expanded commands where safely recorded, scroll-away/Latest, legacy fallback, keyboard/focus and alternative theme, Chat/Work owner/restoration and no unintended execution.

Use one `npm run check` on the final coherent candidate, and separately run only focused UI tests missing from that aggregate. A recorded-fixture command can prove UI disclosure rendering, but **does not** qualify the separate P9 live execution/authority gate. No AppImage packaging unless the source change actually requires it. Keep any failed GUI observation truthful.

## Files and execution

Planning:
- `prompt-assessment.md`
- `implementation-plan.md`

Executable:
- `P1-theme-tokens.txt`
- `P2-select-chat.txt`
- `P3-select-work.txt`
- `P4-agentrun-transcript.txt`
- `P5-ui-qualification-closeout.txt`

Validate: `npm run codex:phase:validate -- c8-chat-work-ui`

Run: `npm run codex:phase -- c8-chat-work-ui`

The runner executes P1-P4 and stops for the P5 browser/manual gate. P5 records `closeout.md` with exact source/evidence and **Green or Not Green**. A Green UI closeout only returns to the **separate command/validation blocker** then `c8-work-mode` P9; it is not itself Phase 8D authorization.
