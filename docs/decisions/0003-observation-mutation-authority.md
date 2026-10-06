# ADR 0003 — Observation and mutation authority are separate

Status: Accepted
Date: 2026-09-27
Amended: 2026-10-06 by ADR 0028

Decision:
Models may observe permitted project state without automatically receiving mutation permission.

A standing developer-approved ExecutionGrant may pre-authorize routine bounded effects, so a separate ProposedAction is not required for every already-approved operation. That convenience does not move the authoritative mutation boundary into the provider.

Provider/model execution may produce candidate work inside an isolated ExecutionWorkspace. Any effect that changes the developer's authoritative project state must still cross Dope-owned Authority and ToolExecutor enforcement before it becomes real.

Conceptually:

```text
AI / AgentExecutionAdapter
    -> isolated ExecutionWorkspace
    -> CandidateDelta
    -> Authority / ExecutionGrant
    -> ToolExecutor
    -> authoritative project / Git / other effect adapters
```

Effects outside the standing grant remain blocked. ProposedAction is used when an effect requires explicit consequential review or later escalation policy.

Rationale:
Scoped delegation requires AI to review and implement work without silently taking ownership. Phase 8B qualification proved that a raw write-capable filesystem sandbox cannot reliably distinguish an allowed project edit from a denied project-file deletion. Dope therefore owns the authoritative promotion boundary rather than inferring authority from provider sandbox write access.

Consequence:
Editor observation, ambient intelligence, provider sandboxes, remote tools, MCP servers and coding-agent harnesses must not bypass Dope mutation policy. Provider write access to disposable execution state is not authoritative project mutation.
