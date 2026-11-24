# c14-work-redesign — Conversational Work session redesign

Status: owner-approved documentation and authored prompts only; NOT RUN or qualified. Four prompts: P1–P3 runner-managed implementation/integration; P4 independently MANUAL connected-browser qualification. Do not auto-run P4 or use --closeout.

Authority: docs/ui/work-conversational-session-contract.md; ADR 0030 forward amendment; docs/workflow.md; BOOT.md; AGENTS.md. Inspect actual local HEAD, dirty work, version and tests before execution: remote main may lag local source. Preserve all historical NOT GREEN evidence and current Phase 13 recovery.

P1: session lifecycle, immutable configuration, FIFO queued delivery, safe interrupt/resume.
P2: same dockable panel transforms setup to live transcript; shared Chat presentation with distinct Work authority; retire center-only transcript after parity.
P3: persistence, historical compatibility, follow-up/fork, security and integration regression.
P4: independent real connected-browser manual closeout, no automatic runner execution.

Validate later in owner checkout: `npm run codex:phase:validate -- c14-work-redesign`. Separate owner Run required for implementation; no version change or Gate award from prompt authoring.
