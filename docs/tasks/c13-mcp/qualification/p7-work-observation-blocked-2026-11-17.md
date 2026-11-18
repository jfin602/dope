# C13 MCP P7 — Work observation entry and authority audit

**Source:** HEAD `e3368c66ca488de24a22ca33934b035618cec25c`; product version `0.13.11`. **Verdict: BLOCKED / NOT GREEN.** This report does not replace the original P6 NOT GREEN record, create a P7 checkpoint, or authorize runner progression.

## Canary recovery

The contained fake-server startup, loopback relay, handshake and tools/list canary now passes in this execution environment. The focused MCP registry, project activation, discovery, Chat observation and model bridge tests passed (29/29 in the first MCP/bridge run; 56/57 in the wider run, with one unrelated stale Work fixture). The P6 Chat broker test is a pure mock, and no integrated bundled-worker-to-MCP observation receipt was established. P6's recorded NOT GREEN status therefore remains; the P7 entry requirement for P6 broker core security PASS at exact source is not met.

Two baseline Work test fixtures had drifted from current worker/parser contracts. The direct Pi Work fixture omitted the required `requestId` on `tool-result`; adding the matching frame ID made all six Pi Work candidate/revocation/output tests pass. The Local tool parser now intentionally defaults an omitted read `maxBytes`; its negative fixture now checks the actual denied continuation without source identity. The four focused grant/task/parser tests pass. No product authority, worker, transport or broker code changed. `git diff --check` passes.

## Named blocked interface: Work MCP observation authorization

`ExecutionGrant` in `packages/agent-core/src/authority.ts` is the fixed Phase 8B effect profile. It has no MCP observation capability or server/method/project binding. `workspace-read` permits candidate file reads only; `network` is false. Work start surfaces create only `createDefaultExecutionGrant`, and `AgentExecutionRuntime.localWorkspace` checks task, grant and candidate identity without an MCP-specific permission. `PiWorkExecutionAdapter` and the bundled worker attest only the existing Work wrappers. Chat's separate per-call Commands Ask/Allow approval cannot be borrowed as a Work grant.

P7 needs a reviewed **WorkMCPObservationAuthorization** interface: a developer-accepted, revocable permission bound to this grant revision, exact task, validated project identity, configured server registration revision and trusted observational method, plus a per-call approval receipt and current model/candidate checks. That interface must be designed and accepted by the Work authority owner before any MCP descriptor is offered in a Work Pi session. Mapping an external server call to `workspace-read`, or treating project enablement and server metadata as approval, would create unreviewed remote execution authority.

No MCP Work descriptor or call was added. No external app, Godot scene, project source, candidate promotion, Work run, or Roadmap Gate was affected. Direct live effects remain a separate policy decision.
