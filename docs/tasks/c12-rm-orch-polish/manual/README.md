# c12-rm-orch-polish — deliberately manual UI prompts

The flat runner root has three implementation prompts P1–P3 and one final P4 manual-closeout index. These M*.txt prompts live in `manual/` specifically so `npm run codex:phase -- c12-rm-orch-polish` will **not execute visible UI changes without browser observation**.

**Owner decision:** 2026-11-04. **Status:** Manual prompts AUTHORED ONLY; no UI source changes, browser sessions or qualification by writing them. [ADR 0050](../../../decisions/0050-roadmap-chat-polish-and-review-controls.md) · [contract](../../../planning/p12/roadmap-chat-polish-contract.md) · [stack](../README.md).

## Manual order

1. [M1 — Roadmap review tabs](M1-roadmap-review-tabs.txt): visually integrated protruding upper-right element tab with icon-only checkbox, Apply check, Reject X. Compact bulk controls, real owner dependency/confirmation. **Connected Browser qualification within M1**.
2. [M2 — Chat transcript polish](M2-chat-transcript-polish.txt): delete separate tool-call dropdown/list, keep one real reasoning/tool activity timeline, compact Roadmap result, response footer absolute bottom. **Connected Browser qualification within M2**.
3. [M3 — Integrated browser qualification](M3-browser-qualification.txt): rerun M1/M2 with P1/P2/P3 source safety, normal Apply History and persistence, theme/keyboard/zoom/reduced-motion/inactive-tab coverage. Independent native Electron evidence gap. **Final manual closeout**.

Run each prompt separately, in order, only when prior stage source/visual evidence supports it. Do not batch them into a runner Pn. UI fixes require real connected Codex Browser on exact built source; if unavailable, label EVIDENCE GAP. Avoid live Qwen inference unless owner separately authorizes a fresh bounded trial, and never use the owner's real tower-defense workspace for destructive fixtures.

**No self-commits, no force push, reset/stash/clean, model/provider/version changes, generic model filesystem channels, hidden compatibility fallbacks or Gate/Phase GREEN claims.** Protect accepted Roadmap and linked Markdown, and preserve source/revision/lease/permission/owner Apply checks. Report exact tests, screenshots/observations and remaining gaps rather than code-only GREEN.
