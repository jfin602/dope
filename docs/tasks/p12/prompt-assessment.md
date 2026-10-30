> **CURRENT RUN STATUS (2026-10-29):** The owner authorized P1–P7 with the [provisional entry decision](../../planning/p12/owner-entry-authorization-2026-10-29.md). The `0.12.0` baseline and narrow Phase 11 owner closeout are established; historical authoring statuses below are superseded for entry only. P8 is manual and full Pi qualification remains required.

# /prompt-ass — p12 first stack: bundled Pi Agent

**Authored:** 2026-10-29. **Scope:** Phase 12 first implementation workstream, descriptive name `p12-pi-agent`. **Status:** ASSESSED / DOCS ONLY, NOT RUN OR QUALIFIED. **Source snapshot at review:** GitHub main after G3 P1 owner commit `2a53f87`; current checkout/dirty state and Pi standalone qualification not independently read. Phase 11 OPEN; no 0.12.0 baseline or phase activation. Follow [ADR 0039](../../decisions/0039-bundled-pi-local-agent-runtime.md), [Phase 12 plan](../../planning/p12/phase-12-plan.md) and [B1–B9](../../planning/p12/pi-qualification-contract.md).

## Architecture discovered

- `packages/ai/src/index.ts`: Dope AI registry has connection-scoped `local/lm-studio` config, exact providerModelKey, model locality, tools/agentExecution capabilities and known-context metadata. It must stay authoritative; do not create a separate user-facing Pi connection.
- `packages/theia-extension/src/node/local-agent-execution.ts`, `local-agent-capability.ts`, `agent-execution-runtime.ts`, `agent-runtime-backend.ts`: current local Work transport/capability probe, provider routing and Work authority. Replace only local agent loop behind existing adapter; preserve host-owned checks and hosted/Codex path.
- `packages/agent-core/src/authority.ts`, `node/local-tool-sandbox.ts`, `execution.ts`, `transcript.ts`: grants, isolated workspace, candidate review and transcript domain. Pi must not duplicate/bypass.
- `packages/theia-extension/src/node/model-connections.ts` and Chat backend/context compose: currently route normal model inference, conversation persistence and planned Roadmap operations. Reuse with no-tool Pi mode; default local use must not introduce auto Work or secret-unsafe Pi plugin discovery.
- `apps/electron/package.json`: `electron-builder`, ASAR, explicit `extraResources`, AppImage; `apps/electron/scripts/packaged-main.cjs` and `scripts/local-install.mjs` resolve/install actual package. Pi dependency may be accidentally excluded by `files: ["!**/node_modules/**"]`; packaging must be proven on a pristine install.
- `test/unit/local-agent-integration.test.ts` exercises actual local broker edit, synthetic capability probe, Dope validation and promotion; `test/unit/work-integration.test.ts`, `ai.test.ts`, `model-connections.test.ts`, `chat-backend.test.ts` provide adjacent regressions.
- `packages/agent-core/src/sequence.ts` runner folder grammar accepts `p12` or continuation `p12a` or correction `c12-...`, **NOT `p12-pi-agent`**. Use `docs/tasks/p12/P*.txt`; do not change grammar just to name first workstream.

## Design/implementation risks

1. Pi upstream package API, license, transitive deps, SDK vs isolated worker and native/ASAR resource compatibility require exact release inspection; do not trust article performance. Prefer minimal SDK bounded by Dope; select RPC worker if required by packaging/fault isolation.
2. SDK default tools, global/project `.pi` config and third-party extensions are unsafe if exposed; override resource loader and tools. Dope remains authority and should fail closed when bridge unavailable.
3. Default local Pi routing is mode-specific: ordinary Chat/Planning needs no coding tools, while Work needs an explicit grant. Preserve currently working deterministic Roadmap zero-second-model-call G3 path.
4. Model capability unknown, exact model not loaded or context mismatch must not become global model defaults or silent hosted fallback. No Qwen weights in installer.
5. Pi session/compaction is transport context, not canonical Chat/Work/History, roadmap draft or source proof. Rehydration and repeated turns must preserve decisions and traceability.
6. Existing G3/Phase 11 is open, and standalone Pi result pending. This authored stack must not be executed or used to relabel Phase 11.

## Efficient decomposition and sequencing

8 prompts: P1 dependency/runtime and build surface, P2 AI Center exact model mapping, P3 default no-tool Chat/Planning, P4 authorized Work tools, P5 Work/History/candidate continuity, P6 compaction/recovery, P7 packaged AppImage/zero-setup UX, P8 independent manual Chrome and owner-native evidence closeout. Ordinary prompts favor <=8 minutes with focused tests; permit bounded rescope instead of shortcuts. P8 manual T3 only. No unapproved broad rewrite, no automatic Run, no Phase 12 owner-close.
