# C13 MCP P1 — source and Godot bridge audit

**Date:** 2026-11-17. **Verdict:** P1 audit evidence complete for runner review; integration and live Godot behavior **not qualified**. **Dope source:** `47164e9a91a2a958762e2d5cc0e7a8de41f0a7a5`, `main` ahead of `origin/main` by six commits, product version `0.13.11`. The Dope worktree was clean before this report. This report is the only intended Dope change. No P2 work, product code, Godot scene, or package manifest was changed here.

## Observed installation and transport

The isolated standalone Pi configuration is `/home/jfin/dev/pi-godot-td/pi-config/mcp.json` (SHA-256 `9447533ca1934b62e3103b169d97a9a0b064f13797fcb1b5324304905eddf128`). It starts `godot` with command `/home/jfin/.local/bin/godot-editor-mcp`, no arguments, cwd `/home/jfin/dev/pi-godot-td/game`, `GODOT_MCP_BRIDGE_URL=ws://127.0.0.1:9081`, `GODOT_MCP_PROJECT_DIR=/home/jfin/dev/pi-godot-td/game`, and `GODOT_MCP_GODOT_BIN=/home/jfin/.local/bin/godot`. The command is a symlink to `/home/jfin/.local/share/uv/tools/godot-editor-mcp/bin/godot-editor-mcp`; that environment's installed distribution metadata identifies `godot-editor-mcp 2026.11.04b2` from hybridindie. The project's enabled addon at `game/addons/godot_mcp/plugin.cfg` also says `2026.11.04b2` (SHA-256 `9f845dafd09fb3f121405b4a8ec50eacfcd3f1fd7c31bca0f68ed7fd796ef9ce`). The earlier mismatch came from the isolated Pi configuration using a project-local b2 environment while Codex used a global 2026.11.04 environment; the owner-directed installation sync moved active configurations to this one global b2 executable. These paths are machine-local, outside the Dope repository.

From the isolated game directory, `PI_CODING_AGENT_DIR=/home/jfin/dev/pi-godot-td/pi-config PI_OFFLINE=1 /home/jfin/dev/pi-godot-td/tools/node_modules/.bin/pi mcp list --json` returned one enabled `godot` connection, source the exact config above, `state: connected`, `exposure: direct`, 29 advertised tools, `resources: true`, and no errors. This is an actual MCP tool-list exchange with the configured executable. `main.py` (SHA-256 `a98590d857a53992b8586f6e651695ed0bf664d534d7f2eb636c49d10f642cb3`) selects **stdio** by default; `GODOT_MCP_TRANSPORT=http` would select Streamable HTTP, but it is not set in this Pi configuration. `server.py` (SHA-256 `383c675fecd81b9b427b86cb3874fa1533d0751111416cad4a837e019235e78e`) starts a separate loopback **WebSocket listener** for the Godot addon during server lifespan. Port 9081 is this editor bridge, not the MCP client transport or an HTTP MCP endpoint. The WebSocket listener is ephemeral with the Pi-launched stdio server. At the process snapshot there was no 9081 listener or isolated Godot editor process; an unrelated Codex-launched Godot MCP process held 9080. A live editor handshake, scene read, and mutation denial were **not** tested.

The server's startup can bind a loopback port, load modules, and initialize toolsets; a live addon can connect to it. It runs under the launching user's filesystem and network privileges, with the project directory and Godot binary configured. No server or addon-level containment or Dope permission enforcement is inferred from tool annotations, default `dry_run`, or this discovery. The config contains no approval webhook, required approval flag, bridge token, or HTTP auth token. The installed source treats those controls as optional. Update checks are opt-in by source default; `godot_check_for_updates` was not called.

## Actual advertised tool inventory

The 29 names below are from the isolated Pi MCP list, rather than a static count of Python functions. Toolsets can expose many additional registrations after enablement, so an allowlist must be based on each current discovery and must fail closed on drift. Classification is conservative; **no tool call below was made**.

| Class | Advertised names | Reason / P1 limit |
| --- | --- | --- |
| Metadata observation candidates | `godot_get_server_info`, `godot_list_toolsets`, `godot_list_tools_by_safety_class`, `godot_describe_tool` | Describe server/tool metadata; must still be checked for hidden startup/network effects and exact schemas before Dope exposure. |
| Potential project observation candidates | `godot_list_history`, `godot_inspection_get_project_info`, `godot_inspection_get_active_scene`, `godot_inspection_list_scenes`, `godot_inspection_get_scene_tree`, `godot_inspection_get_selected_node`, `godot_inspection_get_node_properties`, `godot_inspection_get_node_property`, `godot_inspection_get_node_property_list`, `godot_inspection_get_node_groups`, `godot_inspection_snapshot_subtree`, `godot_inspection_diff_snapshots`, `godot_read_resource` | Reads or snapshot bookkeeping by name; live editor access and actual side effects are unverified. Scope output to approved project and protect private files. |
| Unknown or mixed | `godot_health_check`, `godot_describe_class`, `godot_debug_workflow`, `godot_check_for_updates` | Health may probe processes; class lookup may use an engine; debug workflow may run actions; update check may use network. Do not allowlist from name alone. |
| Definitely state-changing or control-changing | `godot_undo`, `godot_redo`, `godot_checkpoint_create`, `godot_checkpoint_restore`, `godot_vcs_snapshot`, `godot_vcs_restore`, `godot_enable_toolset`, `godot_disable_toolset` | Changes editor/project/VCS state or server tool exposure; excluded from Stage 1 observational use. |

Metadata lookup is only an **allowlist candidate**, not an authorization. `readOnlyHint` and server `safety_class` are claims from an external server. Enabling toolsets can reveal project-authoring, runtime, input, import, script, export, and batch tools that may mutate a live Godot project or launch processes. No mutating tool or toolset toggle was invoked. The installed Python source contains many registrations beyond the initial 29; this report does not equate source registration with the currently offered tool list.

## Dope boundary at this source

The bundled worker (`packages/pi-runtime/worker.mjs`) uses an isolated resource loader, disables Pi resource discovery, and offers fixed Chat/Work tool schemas. `pi-runtime-host.ts` spawns only the Dope-owned worker with a narrow environment; it does not resolve a user Pi command from `PATH`. `pi-model-bridge.ts` verifies exact worker version `1.4.0`, isolated resources, and the complete expected fixed tool-name set for each operation. `pi-conversation-runtime.ts` sends model tool calls to the Dope project tool executor and retains failure/denial outcomes. There is **no existing MCP tool channel** to piggyback without an explicit, source-reviewed extension to that attestation and broker.

`local-tool-broker.ts` checks grants, task/project/workspace identity and active candidate basis for Work reads, edits and approved commands. `local-tool-sandbox.ts` uses a Linux namespace, private mounts, a cleared environment, protected-path masks, and seccomp rejection of `socket(2)` and `io_uring` socket paths; it has no raw host-spawn fallback. The Chat command route uses the read-only sandbox. An MCP stdio child or WebSocket bridge cannot be placed inside that sandbox and still connect by simply allowing sockets. The current AI Center has Connections, Models and Roles tabs and one OS-user AI model registry (`ai-registry-store.ts`); it has no MCP catalog or per-project enablement. These are gaps for P2–P7, not existing protections for an external server.

Source SHA-256 anchors:

| Source | SHA-256 |
| --- | --- |
| `packages/pi-runtime/worker.mjs` | `ac0f6cabd0c7563a4d16eabd7b4ad911a376376d8f12e393b651a74d7ae9120c` |
| `packages/theia-extension/src/node/pi-runtime-host.ts` | `ce84bcebdc5bd1c66726bfe4c2ced16ee0fc4d27539694f0f167871596b52c8f` |
| `packages/theia-extension/src/node/pi-model-bridge.ts` | `b0cc979c8e91f909a202ca4f652f1663a3b4b3926226aa48ceaa8812e26634bf` |
| `packages/theia-extension/src/node/pi-conversation-runtime.ts` | `65139d9a64f43d8976c80974abd3089774f20e801800dcc09d765f0c55df4876` |
| `packages/agent-core/src/node/local-tool-broker.ts` | `568927bdc0d4d8fe70fb3362836423af60b8917b1dace56a96e54cbe5cc37e84` |
| `packages/agent-core/src/node/local-tool-sandbox.ts` | `5224faf66c8e0f0a8c386642d4e675e1dfc21cba5545ac114e2e36d529164184` |
| `packages/theia-extension/src/browser/ai-center-widget.ts` | `d0b8e40f8bec6cf55f937a0640f40c22b821becc79d90abdf62e6daac34f5853` |
| installed `godot_editor_mcp-2026.11.4b2.dist-info/METADATA` | `2a9aeb4e0920805fec3ceef1085e4533661170f0ef5ff6953d4359bd686ed192` |

## Narrow architecture and risks for the next prompts

P2 should add a revisioned **global MCP catalog** with executable/transport identity and protected credentials, distinct from the existing AI model registry. P3 should add machine-local per-project enablement, default off, keyed by validated project ID. P4 should present these in the existing AI Center. P5 must design a separately supervised stdio transport for this installed server, bound to exact executable identity, project, environment, schema, request IDs, cancellation, timeout, output limits and tool-list changes; the bridge WebSocket is the server's own editor connection. P6/P7 should offer only individually reviewed observational calls through a Dope-owned broker and current Chat/Work authority. Work candidate approval remains the only file promotion route. P8 can then assess normal Theia `.gd`, `.tscn`, `.tres` and `project.godot` editing. P9 must exercise actual integration, failures and a second non-Godot server; P10 remains separate manual browser/Godot closeout.

| Risk | Present evidence | Required gate |
| --- | --- | --- |
| Direct effects outside Dope grants | External server can reach the live editor, filesystem and network; optional server approval is unset. | **P5 blocker:** do not invoke it from Dope until containment and per-call authority are demonstrated. No blanket sandbox socket exception. |
| Tool-list and schema drift | Basic 29-tool list is dynamic; toolset enabling changes exposure. | Pin per-session inventory/schema identity, deny new or changed tools, and recheck after reconnect/update. |
| Cross-project leakage | One global install can serve multiple projects; isolated Pi config carries a project path. | Default-off per-project activation and session invalidation on project switch, disable and uninstall. |
| Server startup effects | Starting stdio also starts a 9081 WebSocket listener; editor may connect. | Treat connect/start as a separately authorized operation; constrain process and endpoints before live Dope use. |
| Ambiguous editor state | No 9081 listener or live editor at final snapshot; no live call receipt. | P9/P10 need disposable Godot fixture, exact connected addon identity, real read receipt and mutation denial. |
| Credentials and data exposure | Process inherits launcher capabilities; external metadata and results are untrusted. | Secure global secrets, minimal environment, output redaction/bounds, no project content before enablement and per-call grant. |

**P1 handoff:** server identity, stdio transport, bridge separation and live MCP inventory are observed, so the prior identity blocker is removed. This does **not** mark P5–P10 green or authorize live MCP invocation from Dope. P2 may begin only after a verified P1 checkpoint; the runner should inspect this report as its source-bound handoff.
