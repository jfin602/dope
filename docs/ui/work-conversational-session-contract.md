# Work conversational session contract — approved 2026-11-24

Status: owner-approved forward design, amended by [c14 P1-R2 scope decision](../tasks/c14-work-redesign/scope-amendment-2026-11-24.md) and the [P2-R1 local Pi boundary](../tasks/c14-work-redesign/scope-amendment-2026-11-24-p2-r1.md); not product qualification.

For this correction, the persistent lifecycle applies to embedded local Pi New Work and WorkItem runs. Hosted Work retains its existing one-shot lifecycle and must be labeled so its controls and history make no persistent-session claim. Hosted conversational parity needs a separate runtime design and qualification; retain hosted selection and authorization. The interaction requirements below apply to persistent local Pi sessions unless they expressly describe legacy or hosted evidence.

Work is one persistent dockable session surface. New Work starts in editable setup (prompt, model, tool ceiling, sandbox). Start seals an immutable per-session execution contract and transforms the same surface into the live structured conversation. The full transcript remains accessible after completion, failure, stop, panel close and restart. Existing Select Work entries reopen their actual run histories; missing legacy events are explicitly labeled unavailable, never fabricated.

## Interaction
- During Running, composer submissions persist immediately as Queued and are delivered FIFO at the next safe agent boundary. Acknowledgment changes Queued to Delivered only after actual runtime receipt. Retry/restart must be idempotent; no duplicate worker or message injection.
- A Running message may wait until the current Pi turn and brokered operations settle. Dope does not expose Interrupt/Pause/Resume in this correction. Stop terminates active execution without erasing evidence. Finish explicitly freezes the candidate, runs Dope validation and enters guarded review.
- Completed sessions accept follow-up turns with original maximum grants, model and sandbox; Fork creates a separately reviewed new setup. No silent permission expansion.
- Preserve typed tool invocations, agent responses, approvals, errors, diagnostics, checkpoints, candidate review and evidence receipts. Do not misrepresent tool activity as conversational prose.

## Presentation and authority
Use shared safe Chat Markdown/scroll/composer primitives but separate Chat identity and authority from Work AgentRun, ExecutionGrant and broker. Compact locked configuration disclosure remains inspectable. Work can dock left/right/bottom/center and maximize within existing Theia layout; no second center-only transcript owner. Retire legacy center AgentRun transcript only after parity verification; no hidden fallback. Editor/preview/Roadmap stay available.

## Qualification
T1 lifecycle/queue/Finish/Stop and UI tests; T2 persistence, recovery, post-review follow-up, old-run compatibility, grants, candidate validation and Roadmap evidence; T3 independent connected browser with live tool calls, queued messages, Finish/Stop, restart, history and docking. Record exact-source evidence and gaps. Docs approval alone does not implement, Run, award Gate GREEN or change version.
