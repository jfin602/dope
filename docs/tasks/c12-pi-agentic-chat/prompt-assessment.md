# /prompt-ass — c12-pi-agentic-chat

**Reviewed:** 2026-10-30; owner-approved scope. **Status:** ASSESSED, NOT RUN. **Version:** 0.12.7 unchanged. Local checkout and owner changes require separate preflight at implementation. [Contract](../../planning/p12/agentic-chat-permissions.md).

## Direct source assessment
- `packages/pi-runtime/worker.mjs` opens Chat with `tools: []` and `noTools: 'all'` and aborts tool attempts. Work already has custom Pi read/list/edit/process tools and a real multi-turn tool loop.
- `pi-runtime-host.ts` and `pi-conversation-runtime.ts` stream Chat text/final only; an authorized tool-request/event/approval bridge is missing.
- `chat-backend.ts`, `packages/chat/src/service.ts` and ChatPanel own saved conversations, leases, context, selected provider, approvals. Do not create another canonical state.
- `chat-project-grounder.ts` has bounded protected readFile/listDirectory/searchPaths/searchText, realpath/symlink checks and source hashes. Reuse for model-directed project exploration.
- `chat-panel-widget.ts` and ChatPanelController have existing model selector, + context, activity, copy, drag-to-scroll and cancellation. There is no Ask/Allow or command approval UI.
- `local-tool-broker.ts` is built for granted **Work candidate** Node test/build commands, not general Chat investigation. `local-tool-sandbox.ts` has bwrap/unshare/sterile environment and seccomp socket denial, but new commands need a **read-only project mount**.
- `agent-core/authority.ts` has fixed Work ExecutionGrant defaults; don't turn these into blanket Chat command permissions.
- ADR 0039 and P12 B3/B4 deliberately say no-tools Chat; forward amendment is necessary, preserving original prompts/evidence.

## Risks and design judgment
Native tower-defense answers without code evidence show the integration is not Codex-like project-aware Chat. Enable Pi's useful tool autonomy, not unsafe unrestricted host shell. Ask is default, Allow session-bounded and only for sandbox-eligible commands. Approval replay, project switch, cancellation, source drift, private paths, network and unreviewed writes must deny at backend/OS boundary, not via model instructions. Preserve existing Green Chat continuity, Work repair, candidate review, History and provider alternatives.

## Efficient decomposition
Five prompts: P1 read/list/search tool loop; P2 Ask/Allow and one-use approval; P3 sandboxed exploratory commands; P4 agentic Planning/activities/Prepare Work; P5 manual real browser/native closeout. P1–P4 focused <=8m target (10m soft/15m hard), P5 manual T3. /docs-apply and /prompt-write do not authorize Run or /activate; no package/version changes.
