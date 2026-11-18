# C13 MCP — P6 core recovery and P7 Work authorization contract

**Date:** 2026-11-17 (America/Chicago). **Source:** HEAD `e3368c66ca488de24a22ca33934b035618cec25c` plus the uncommitted changes in this report. **Version:** `0.13.11` unchanged. **P6 core verdict: scoped PASS on the exact local source below.** The prior [P6 NOT GREEN attempt](p6-chat-broker-attempt-2026-11-17.md) and [P7 blocked audit](p7-work-observation-blocked-2026-11-17.md) remain dated historical evidence; neither was rewritten. This is not a runner checkpoint or a product Roadmap Gate award.

## P6 worker and broker recovery

The first real bundled-worker fixture exposed a P6 schema defect: `mcp_godot_server_info` was advertised, but Pi validated `{}` as though the schema's `type`, `properties` and `additionalProperties` fields were tool arguments. `packages/pi-runtime/worker.mjs` now supplies a zero-property TypeBox object for reviewed MCP descriptors while retaining the separate manifest validation and exact built-in tool attestation.

`test/unit/mcp-chat-worker-integration.test.ts` runs the actual bundled Pi worker against a fake Local model and an isolated stdio MCP server through `MCPChatObservation.open`, the checked P5 supervisor, current global registry and enabled project. It observes one actual `tools/call` result in the next model turn. Before dispatch, it rejects a mutating tool name, nonempty scene-path arguments and denied approval. After project disablement, another call is denied. The contained child attempts a canonical `/work/new-file` write at startup and verifies the write is blocked. The original Chat broker test checks wrong project, changed registration and approval refusal; protocol tests check manifest drift, malformed results, size limits and cancellation. No real Godot server was launched.

The focused P5/P6/Work authority group passed **21/21** after rebuilding `@dope/agent-core`; the affected Theia extension build and worker syntax check passed. The six Pi Work candidate/revocation/output tests passed **6/6**. `git diff --check` passed. A broader optional aggregate was interrupted after 123 passing cases while a long runtime test was still active; its cancellation is not counted as qualification evidence.

Exact source SHA-256 anchors: `worker.mjs` `f3055cc2437f9774445812b6514d803798fb39ea32a2aab47c14fc6804ba9e6a`; `mcp-chat-observation.ts` `949af7167082ec15c255c7b4f94c09ecf19ebacc4b6094fcd088386ba502c9ef`; `mcp-stdio-discovery.ts` `95c5424e571877c453415bc61a33cc1e181f399f0a6e85e97bc21db58aca7e8a`; `mcp-contained-launch.ts` `1c0526a8445c94bd047248c0d9ee87d1581eb4f1a2f5c50184ff40371232f016`.

**P6 entry decision:** the contained worker-to-broker observational core and its immediate denial canaries pass on these source bytes. This does not qualify real Godot, native UI, all host lifecycle paths or P9/P10 integration.

## P7 Work authority contract

`ExecutionGrant` now has an optional, separately accepted `mcpObservation` scope. Default grants carry none. The scope names one project key, server ID and registration revision, reviewed method, exact Local connection/model, one call maximum and an expiry no more than 30 minutes after acceptance. Revising the grant drops the scope. The existing fixed file/process/network effect permissions remain unchanged.

`WorkMCPObservationCallApproval` is a strict, parsed developer approval for one exact grant revision, task, project, server/method, model, candidate workspace/fingerprint and call ID. `checkWorkMCPObservationApproval` rejects missing authority, mismatch, stale approval, expiry and reuse. `WorkMCPObservationReceipt` defines a durable outcome without external response text or credentials. The Work contract tests cover default denial, one allowed fixture, task/project/model/server/method/candidate drift, malformed fields, blanket-call attempts and receipt shape.

This contract is **inert** until P7 wires a developer-visible Work acceptance and per-call approval owner, trusted observational classification, current registry/project/selection checks, checked MCP dispatch and factual saved receipts into the existing Pi Work session. No Work MCP descriptor or invocation was added here. Project enablement and external metadata still confer no Work permission. Direct external effects remain deferred to a separate policy decision.

Contract SHA-256: `packages/agent-core/src/authority.ts` `711d590e86946feb3715317688e65e7eefcc2be5a9e269454e6a303eeee56ece`.
