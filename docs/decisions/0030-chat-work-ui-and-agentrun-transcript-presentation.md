# ADR 0030 — Shared Chat/Work UI and AgentRun transcript presentation

Status: **Accepted for documentation / implementation pending**
Date: 2026-10-08
Correction: `c8-chat-work-ui` (pre-`c8-work-mode` P9 requalification, version `0.8.20` unchanged)

## Context

Dope's AI Center has a recognizable restrained dark interaction grammar. Chat and Work panels, especially **Select Chat** and **Select Work**, do not consistently express that grammar. Their navigation/actions are dense and visually disconnected. The existing AgentRun center transcript can safely render Markdown but does not consistently use Chat's centered assistant-message document layout. The user requested a bounded UI alignment pass before qualification.

ADR 0016 originally allocated orange as the primary action color. Its October 8 amendment now makes `#336699` the current primary interactive accent, with a `#1F1F1F` foundation and neutral `#303030` / `#484848` control/border references. The previous orange/teal palette remains historical and is not an active competing control scheme. Implementation still requires evidence; documents alone do not change CSS.

## Decision

### 1. One visual grammar, separate module identities

AI Center is the reference for dark-surface hierarchy, control density, whitespace, neutral buttons/inputs, subdued boundaries, selected/focus/hover affordances and meaningful primary emphasis. Share semantic Theia/Dope theme tokens and small reusable presentation primitives; avoid copying literal hex values into multiple widgets. Compatible user themes and meaningful diagnostic colors must remain intact. Orange can be used sparingly when purposeful, not as default interface chrome.

**Chat** and **Work** remain distinct panels/launchers with independent selection, persistence and authority. They may be placed in left/right/center/bottom Theia areas and must remain usable in narrow panes. Do not revive a Chat | Work mode toggle.

### 2. Compact selectors

**Select Chat:** use a legible nested folder/chat browser, stable chat color dots, title and muted last-interaction metadata, clear selected and keyboard-focus states. Keep create/rename/move/folder operations, but put lower-frequency row actions behind contextual or similarly low-noise affordances. Preserve ordering, one-live-owner Chat behavior, restoration and folder semantics.

**Select Work:** distinguish Running, History and discovered Prompt Stacks with compact section headers, readable task-derived titles and secondary status/activity/time information. Use the same selection/row grammar as Select Chat without conflating their records. Keep run/task/sequence selection truthful; never call blocked, pending or completed work Running. Preserve default task folder `docs/tasks/`, refresh and work reopening. Work detail surfaces primary status/progress/controls while minimizing verbose diagnostics behind accessible disclosures.

### 3. Shared assistant-message transcript presentation

Chat's centered, constrained-width, unboxed **assistant** document is the presentation model for AgentRun messages in a **read-only center transcript tab**. Safely render supported Markdown (paragraphs, headings, lists, links, block quotes, inline/code blocks, tables). No user chat bubbles, fabricated developer turns or faux provider conversation framing in AgentRun output.

AgentRun command entries stay structured and chronological, collapsed initially with explicit command/status/exit/duration and bounded expandable output where evidence exists. Keep system/validation/authority/checkpoint/truncation messages visually subdued and distinct from agent prose. Reuse a small safe message-rendering and CSS seam rather than duplicating unsafe Markdown/link code. Reuse shared scroll-follow conventions but keep **independent** transcript scroll/selection state. Preserve manual scroll-away, Latest, pagination, restart, safe links, explicit legacy no-transcript fallback and reduced-motion accessibility.

### 4. Boundaries and sequencing

This is **presentation-only**. Do not change `AgentTask`, `AgentRun`, `AgentTaskSequence`, `ExecutionGrant`, Chat identity, `.dope/chats/`, `.dope/agent/`, canonical Software Map, transcript schemas, provider transport, Coding Agent routing, candidate validation, authorization/promotion, checkpoint SHAs or app package version. Closing, moving or selecting a panel cannot cancel/start/duplicate a run. UI defects must not be hidden by loosening permissions.

Qualification for the existing `c8-work-mode` P9 remains **Not Green** after its October 8 RPC repair/replay: the live command-expansion gate could not be observed because the disposable command run was `authority-denied`; candidate validation/promotion remained unqualified. Preserve this history and investigate the execution-adapter/authority issue **separately** under ADR 0028/0029. UI work does not make P9 Green and Phase 8D stays gated.

## Rationale and alternatives

A shared small presentation seam prevents Chat and AgentRun styling from drifting while keeping distinct business/domain ownership. Styling Work as terminal logs or duplicating Chat conversation records would sacrifice readable evidence and improperly couple authority. Global Theia theme overrides or hard-coded widget palettes would contaminate user-selected themes and complicate maintenance.

## Acceptance and follow-up

A bounded `c8-chat-work-ui` correction should split selector/control presentation from center transcript presentation, then perform one focused direct GUI qualification pass. Verify narrow left/right panels and center/bottom placement, Chat folder/actions/color identity, Work group/status truth, agent Markdown/code/table/command readability, keyboard/focus/accessibility, default/alternate themes, scroll restoration/Latest, restart, ownership and no execution regressions. Add focused permanent regression guards without broad authority or storage rewrites.

**Document approval is not implementation evidence.** After UI correction qualification, investigate/replay the independent command/validation blocker and resume the original `c8-work-mode` P9 closeout. Revisit this ADR if a future unified presentation framework or user theme system replaces Theia's current semantic token boundary.
