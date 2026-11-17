# /prompt-ass — c13-mcp

Status: AUTHORED ONLY; NOT RUN OR QUALIFIED. Owner slug: c13-mcp. Authority: ADR 0058 and docs/planning/p13/external-mcp-compat-contract.md. Manual prompts, not the phase runner.

## Objective
Install or register each MCP server once globally, manage it in the MCP Servers section of the EXISTING AI Center, toggle availability independently per project (off by default), and give bundled Pi authorized observational access without weakening Dope's authority or sandbox. Reuse the existing standalone Godot MCP bridge and qualify GDScript/Godot source-file support using ordinary Theia extensions. Godot remains an independent application.

## Inspected source/constraints
- packages/pi-runtime/worker.mjs: fixed Chat/Work tool registrations.
- packages/theia-extension/src/node/pi-model-bridge.ts and pi-runtime-host.ts: exact tool attestation and worker tool protocol.
- packages/theia-extension/src/node/pi-conversation-runtime.ts: brokered Chat tool routing.
- packages/theia-extension/src/browser/ai-center-widget.ts: existing singleton AI Center tabs/controls.
- packages/ai/src/index.ts: application-global MODEL registry, not a place to store a fake MCP model.
- packages/agent-core/src/node/local-tool-broker.ts and local-tool-sandbox.ts: authority and blocked socket execution.
- docs/decisions/0003-observation-mutation-authority.md: MCP may not bypass authoritative promotion.

GitHub source review did not verify the user's external Godot MCP bridge executable/transport/version/tool list; P1 must do so on the actual machine. Do not invent package names or claim standalone Pi tools are available in Dope.

## Number of prompts and responsibilities
Ten independently run manual prompts:
P1: bridge and security capability audit, no code.
P2: global versioned MCP registry and secure configuration.
P3: project-specific activation state (off default).
P4: MCP Servers section in existing AI Center.
P5: constrained transport and server lifecycle.
P6: bundled Pi Chat observational MCP broker.
P7: bundled Pi Work observational MCP exposure (no direct effects).
P8: GDScript and Godot resource file extension/editor compatibility.
P9: cross-system integration and adversarial regression qualification (T2).
P10: independent real Godot and non-Godot manual qualification (T3).

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10; P8's configuration-only assessment may occur earlier but no qualification shortcut.

## Risks and deferrals
An MCP server may cause effects on launch, before a model call; tool readOnly metadata is not a security guarantee. Dope's local tool sandbox denies sockets; never disable it to make MCP work. Direct agent-driven Godot scene/project mutation, arbitrary remote MCP servers, auto-installs, godot-specific Dope core, full Godot editor and unsupported Software Map analyzers are deferred. Any unavailable trusted execution/transport boundary is BLOCKED, not a reason to relax policy.

Assessment approval is not implementation, Work Run, Git commit, Roadmap GREEN or version change. Preserve existing Phase 13 failures and evidence.