# c14-work-redesign — Conversational Work session redesign

Status: [P1-R2 manual recovery passed](qualification/2026-11-24-p1-r2-manual-recovery-pass.md) and was checkpointed as `6052c54`. Two P2 runner attempts returned `PARTIAL`; their `.codex-runs` evidence remains. [P2-R1 manual recovery](manual/P2-R1-local-pi-recovery.txt) was executed and [qualified for its scoped local Pi and hosted one-shot paths](qualification/2026-11-24-p2-r1-manual-recovery.md). Its [local Pi scope amendment](scope-amendment-2026-11-24-p2-r1.md) and the [earlier P1-R2 amendment](scope-amendment-2026-11-24.md) govern forward acceptance without rewriting the original P1–P4 prompt files. P3 remains a separate runner step; P4 remains independent MANUAL connected-browser qualification. Do not auto-run P4 or use `--closeout`.

Authority: docs/ui/work-conversational-session-contract.md; ADR 0030 forward amendment; docs/workflow.md; BOOT.md; AGENTS.md. Inspect actual local HEAD, dirty work, version and tests before execution: remote main may lag local source. Preserve all historical NOT GREEN evidence and current Phase 13 recovery.

P1: persistent session lifecycle, immutable configuration, FIFO queued delivery, explicit Finish/Stop, recovery and linked follow-up. Interrupt/Pause/Resume is deferred.
P2: local Pi New Work and WorkItem transform the same dockable panel into a durable conversation with queue/Finish/Stop controls; hosted Work remains a clearly labeled one-shot path. Shared Chat presentation retains distinct Work authority; the center-only transcript was retired after scoped parity checks. No Pause control. P2-R1 was manually qualified on the P1 source basis.
P3: persistence, historical compatibility, follow-up/fork, security and integration regression under the amended lifecycle.
P4: independent real connected-browser manual closeout under the amended acceptance criteria; no automatic runner execution or required Interrupt replay.

Validate before the next owner Run: `npm run codex:phase:validate -- c14-work-redesign`. A deliberate normal runner invocation after the P2 checkpoint starts P3; it does not qualify P4 or award a product Gate.
