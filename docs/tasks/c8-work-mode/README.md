# c8-work-mode - Work mode and Prompt Stack presentation

Status: APPROVED DOCUMENTED CORRECTION / NOT EXECUTED
Phase: 8
Mode: Correction
Required unchanged Dope version: `0.8.20`
Primary authorities: ADR 0025 (Chat panel), ADR 0027 (AgentTask/Sequence), ADR 0028 (promotion), ADR 0029 (Dope-owned validation), `docs/planning/p8/phase-8-plan.md`, `docs/PRODUCT-MODEL.md`, `docs/ARCHITECTURE.md`.

## Goal

Make **Work** the developer-facing agent execution mode inside the same reusable panel experience as Chat. The persistent **Chat | Work** switch should be available at the top, with Work launchers from left/right toolbars and panel placement in left/right/center/bottom. **Prompt Stack** is the common product name for phase and correction stacks.

The correction retains the previously approved complete sanitized agent transcript and minimized, structured command history scope. The source-of-truth remains AgentTask, AgentRun and AgentTaskSequence, not a new Work domain or Chat records.

## Prompts

| Prompt | Focus | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Durable transcript domain, store and read API | T1 | GPT-6 Sol High | no |
| P2 | Codex provider-visible message and command observations | T1 | GPT-6 Sol High | no |
| P3 | Agent Runtime ordered transcript projection, paging and recovery | T2 | GPT-6 Sol High | no |
| P4 | Reusable Chat/Work panel state, mode and ownership | T2 | GPT-6 Sol High | no |
| P5 | Work selection, Prompt Stack discovery, stable titles | T1 | GPT-6 Sol High | no |
| P6 | Work transcript UI, compact command history and follow behavior | T2 | GPT-6 Sol Medium | no |
| P7 | Work launchers, new direct Work composer and legacy actions | T2 | GPT-6 Sol High | no |
| P8 | Focused cross-panel/restart compatibility integration | T2 | GPT-6 Sol High | no |
| P9 | Native/browser GUI qualification and final closeout | T3 | GPT-6 Sol High | yes |

P1-P8 are implementation/integration prompts with runner-owned commits. P9 is the **only final closeout prompt**, a browser-required manual handoff. No agent-run transcript, task snapshots, Git subjects or historical closeout is rewritten to match the new user-facing vocabulary.

## Expected outcome

- User sees `Work`, `New Work`, `Work history`, `Prompt Stack`; legacy command IDs remain functional aliases.
- Two panel modes share placement, scrolling and navigation mechanics but not execution authority or storage.
- Prompt Stack discovery defaults to `docs/tasks/`; no manual Import Stack step.
- Selected Work title comes from the snapshotted prompt entry or direct task objective; prior run titles stay stable.
- User-visible agent text and structured command history persist and fully reload under bounded, explicit truncation limits. Commands are collapsed by default.
- Closing/toggling/relocating a panel never cancels work, creates a second run, or bypasses execution grant/validation.
- Completed Adaptive SEO `c4-dope-phase-stack-smoke` sequence remains readable with P1-P4 SHAs unchanged.

## Completion / checkpoint rules

Dope package/version stays `0.8.20`; no root npm lock is created. The runner owns P1-P8 implementation commits, and P9 requires its explicit manual/browser qualification and external closeout checkpoint before a final Green claim. Do not execute `scripts/codex-phase*.mjs` as the product Work runtime.

P9 must report **GREEN / QUALIFIED** or **NOT GREEN** based on direct evidence. Do not reinterpret Phase 8B/8C qualification or the prior Adaptive SEO Green dogfood.
