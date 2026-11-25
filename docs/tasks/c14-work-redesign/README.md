# c14-work-redesign — Conversational Work session redesign

Status: owner-approved documentation and authored prompts; [P1-R2 manual recovery passed the amended runtime scope](qualification/2026-11-24-p1-r2-manual-recovery-pass.md) after the preserved [earlier BLOCKED result](qualification/2026-11-24-p1-r2-manual-recovery-blocked.md). P2/P3 are not run or qualified; P4 remains independent MANUAL connected-browser qualification. Do not auto-run P4 or use --closeout. The [2026-11-24 P1-R2 scope amendment](scope-amendment-2026-11-24.md) controls forward acceptance without rewriting the authored prompt files.

Authority: docs/ui/work-conversational-session-contract.md; ADR 0030 forward amendment; docs/workflow.md; BOOT.md; AGENTS.md. Inspect actual local HEAD, dirty work, version and tests before execution: remote main may lag local source. Preserve all historical NOT GREEN evidence and current Phase 13 recovery.

P1: persistent session lifecycle, immutable configuration, FIFO queued delivery, explicit Finish/Stop, recovery and linked follow-up. Interrupt/Pause/Resume is deferred.
P2: same dockable panel transforms setup to live transcript with queue/Finish/Stop controls; shared Chat presentation with distinct Work authority; retire center-only transcript after parity. No Pause control.
P3: persistence, historical compatibility, follow-up/fork, security and integration regression under the amended lifecycle.
P4: independent real connected-browser manual closeout under the amended acceptance criteria; no automatic runner execution or required Interrupt replay.

Validate later in owner checkout: `npm run codex:phase:validate -- c14-work-redesign`. Separate owner Run required for implementation; no version change or Gate award from prompt authoring.
