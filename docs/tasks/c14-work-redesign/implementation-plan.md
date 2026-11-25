# Implementation plan — c14-work-redesign

Forward execution uses the [2026-11-24 P1-R2 scope amendment](scope-amendment-2026-11-24.md). The original plan below records authoring history where it mentions Interrupt/Resume; the following routing overrides those portions. P1 proves whole-turn FIFO delivery, exact acknowledgment, Finish/Stop, recovery and post-review linked follow-up. P2 presents truthful Queued/Delivered, Finish and Stop controls, without Pause. P3 integrates that lifecycle. Manual P4 omits Interrupt replay. Authored P1–P4 prompt bytes remain unchanged.

## P1 (T1, GPT-6 Sol High)
Inspect existing Work/AgentRun/Pi execution lifecycle, queue and persistence owners. Extend existing runtime without a parallel agent to model setup, running, interrupt requested, paused, resumed and terminal states; immutable config and ordered durable message queue. Acknowledge actual delivery; idempotent recovery; explicit safe boundaries. Focused unit tests for state transitions, restart and grant preservation.

## P2 (T1, GPT-6 Sol High)
Inspect Work panel, selector, center transcript, shared Chat presentation and Theia docking. Transform New Work panel into live transcript after Start; retain typed event rendering and compact locked config, composer queue, Interrupt/Resume/Stop, full history reopening. Reuse safe Markdown/theme/scroll primitives without merging authority. Retire redundant center-only transcript only after parity tests. Test narrow/keyboard/docking.

## P3 (T2, GPT-6 Sol High)
Integrate persistence and legacy records, follow-up/fork, approvals, sandbox, candidate validation, history and Roadmap evidence. Focused integration and relevant builds; no second worker, duplicate message or silent escalation. Preserve old-run missing evidence as explicit gaps. Run appropriate targeted regression and report actual results.

## P4 (T3, GPT-6 Sol High, MANUAL)
Connected Codex browser on actual local running Dope: setup/start, live tool transcript, queue/delivery, interrupt/pause/instructions/resume, completion follow-up, failed/stopped history, restart, left/right/bottom/center docking, locked grants and candidate review. Record screenshots, exact source and outcomes; native-only gaps remain explicit.

## Efficiency and sequencing
Exactly P1–P4; P1→P2→P3→manual P4. Each routine prompt targets <=8 minutes and stops on architectural mismatch instead of broad refactor. No automatic P4, no self-commit, no unrelated Chat/Roadmap changes, no fabricated GREEN. Inspect current local version rather than hardcode historical remote version.
