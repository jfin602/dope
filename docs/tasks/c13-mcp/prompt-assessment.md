# /prompt-ass — c13-mcp (runner conversion assessment)

**Status:** REVIEWED AUTHORING / RUNNER-READY TEXT, NOT EXECUTED / NOT QUALIFIED. **Owner slug:** `c13-mcp`. **Required unchanged product version:** `0.13.11`. **Authority:** ADR 0058 and external-mcp-compat-contract.md.

## Objective

Global once-per-user MCP catalog inside the existing AI Center; per-project off-by-default enablement and independently authorized Pi observational tools. Reuse the owner's existing Godot MCP bridge for a first integration case. Support GDScript/resources through standard Theia extension/editor mechanisms. Dope must remain a general-purpose IDE and Godot a separate application.

## Inspected source and uncertainties

The existing GitHub implementation shows fixed bundled Pi tool sets (`packages/pi-runtime/worker.mjs`), exact tool verification (`pi-model-bridge.ts`), worker/host dispatch (`pi-runtime-host.ts`, `pi-conversation-runtime.ts`), a singleton AI Center UI (`ai-center-widget.ts`), a distinct AI model registry (`packages/ai/src/index.ts`), and guarded local broker/sandbox (`packages/agent-core/src/node/local-tool-{broker,sandbox}.ts`). MCP is not presently qualified as a generic Pi tool source in this source snapshot. The actual owner's standalone Godot MCP server/version/transport/tools cannot be established from GitHub; P1 must audit that on the execution host.

## Runner work division

Exactly **nine** runner-managed, source-bound P1–P9 prompts and **one** terminal, independently initiated P10 manual closeout:

1. P1: real Godot MCP / bundled Pi boundary assessment and evidence report (no product source change needed, but report is runner checkpoint).
2. P2: global versioned registry and secure configuration.
3. P3: machine-local project-specific activation/revocation.
4. P4: MCP Servers section inside AI Center with clear installation vs project toggle.
5. P5: supervised transport only for actual verified required MCP transport; immediate sandbox/startup safety gate.
6. P6: broker-checked Pi Chat observational MCP tools preserving built-in tool integrity.
7. P7: broker-checked Work observation only, retaining ExecutionGrant/candidate review.
8. P8: compatible GDScript/Godot resource editing and durable compatibility report (source patch only for verified generic defect).
9. P9: T2 worker/permission/transport/registry/second-server integration and adversarial regression.
10. P10: manual T3 real Godot/browser/native/non-Godot owner closeout.

Dependency P1→P2→P3→P4→P5→P6→P7→P8→P9, then independently manual P10. Never auto-run browser P10 or silently start a separate Work grant. P1 missing bridge details are an explicitly documented P5 blocker, not grounds to invent executable/URL or relax local sandbox.

## Hard boundaries and honest status

Global install/config, project enablement and per-tool permission are separate. The sandbox blocks sockets; MCP transport must use a separately contained, trusted, Dope-owned route. Tool metadata does not prove a method is observational. Direct Godot scene/resource mutation, unrestricted remote servers, auto-install, embedded Godot, GDScript analyzer, permanent Godot UI and arbitrary Pi extension loading are deferred. Source modifications and server startup both require approved trust boundaries. Preserve Phase 13 historical NOT GREEN and exact evidence.

The assessment and runner conversion are **documentation-only**. The explicit owner Run alone starts P1–P9. The runner owns Git commits; implementation prompts do not self-commit or claim qualification. P10 remains manual.
