# Work conversational session contract — approved 2026-11-24

Status: owner-approved design; not product implementation or qualification.

Work is one persistent dockable session surface. New Work starts in editable setup (prompt, model, tool ceiling, sandbox). Start seals an immutable per-session execution contract and transforms the same surface into the live structured conversation. The full transcript remains accessible after completion, failure, stop, panel close and restart. Existing Select Work entries reopen their actual run histories; missing legacy events are explicitly labeled unavailable, never fabricated.

## Interaction
- During Running, composer submissions persist immediately as Queued and are delivered FIFO at the next safe agent boundary. Acknowledgment changes Queued to Delivered only after actual runtime receipt. Retry/restart must be idempotent; no duplicate worker or message injection.
- Interrupt is distinct from Stop: show Interrupt Requested until safe suspension, then Paused. The user can supply intervention instructions and explicitly Resume. Respect noninterruptible tool operations, pending approvals and rollback/checkpoint safety. Stop terminates active execution without erasing evidence.
- Completed sessions accept follow-up turns with original maximum grants, model and sandbox; Fork creates a separately reviewed new setup. No silent permission expansion.
- Preserve typed tool invocations, agent responses, approvals, errors, diagnostics, checkpoints, candidate review and evidence receipts. Do not misrepresent tool activity as conversational prose.

## Presentation and authority
Use shared safe Chat Markdown/scroll/composer primitives but separate Chat identity and authority from Work AgentRun, ExecutionGrant and broker. Compact locked configuration disclosure remains inspectable. Work can dock left/right/bottom/center and maximize within existing Theia layout; no second center-only transcript owner. Retire legacy center AgentRun transcript only after parity verification; no hidden fallback. Editor/preview/Roadmap stay available.

## Qualification
T1 lifecycle/queue/interrupt and UI tests; T2 persistence, old-run compatibility, grants, candidate validation and Roadmap evidence; T3 independent connected browser with live tool calls, queued messages, interrupt/resume, restart, history and docking. Record exact-source evidence and gaps. Docs approval alone does not implement, Run, award Gate GREEN or change version.
