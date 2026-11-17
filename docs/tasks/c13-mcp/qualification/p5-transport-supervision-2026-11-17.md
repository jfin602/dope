# C13 MCP P5 — transport and supervision attempt

**Date:** 2026-11-17. **Verdict:** **NOT GREEN / BLOCKED for P6 entry.** Pre-task HEAD `4339b09d3177e01194fbd88adbd718badd321b5f`; product version `0.13.11`. The runner owns the checkpoint commit. The pre-existing dirty P5 containment recovery was preserved and continued. No live Godot server, addon, scene, MCP tool call, Work run, or Git commit was made.

## Selected route and source boundary

P1 observed the installed hybridindie Godot MCP server using **stdio** for MCP. Its `127.0.0.1:9081` WebSocket listener is a separate editor bridge. The installed Python MCP stdio implementation reads and writes one JSON-RPC object per newline. This P5 attempt adds bounded stdio `initialize`, `notifications/initialized`, and `tools/list` discovery only. Streamable HTTP, remote endpoints, other transports, arbitrary arguments, shell commands, and MCP `tools/call` remain unsupported. Tool descriptions, annotations, results, prompts, and resources grant no authority.

The existing dirty recovery provides a private network/PID namespace, read-only project mount with private path masks, narrow executable installation mount, constrained environment, resource and lifetime limits, loopback host relay, cancellation, and project switch/remove revocation. This attempt also reads the bridge token from the OS secure store at launch, checks the trusted backend workspace root against the activated root, and keeps transport status separate from catalog and project enablement. The local model process sandbox's socket denial was untouched. No browser or model RPC can launch this session.

The protocol code correlates numeric request IDs, rejects unsolicited or malformed responses, caps line size, tool count, pages, metadata and timeout, and produces a manifest hash from current server/tool metadata. A changed approved hash aborts discovery. Its status records stdio, server registration, project key, manifest revision, exit code/signal and a safe error reason without raw server output or credentials.

## Validation and blocker

`corepack yarn workspace @dope/ai build` and `npx tsc -p packages/theia-extension` passed. `mcp-server-registry` and `mcp-project-activation` focused suites passed. The pure protocol cases passed for handshake/list, manifest change, malicious schema, wrong response ID, oversized output and cancellation. `git diff --check` passed.

The required **integrated contained fake server** canary failed before the fake could initialize. The combined contained-launch suite also failed. Direct isolation probe showed `/usr/bin/unshare --user --map-root-user --net` succeeds, but raising loopback inside that namespace fails with `Cannot open netlink socket: Operation not permitted`. The current runner sandbox also rejects a host `127.0.0.1:9081` listen with `EPERM`. The isolated child therefore exits during startup; handshake, socket/host-secret/outside-root denial, no startup effects, and cleanup cannot be re-proved on this exact execution environment. The earlier P1 supplement reports a successful fake-server containment canary on a different host execution context; it is preserved, but does not convert this run into an exact-source pass.

No fallback to host networking or an unconfined spawn was added. The production UI has no bridge-token setup path yet, and the connection method remains backend-internal with no Pi exposure. P5 is incomplete and the server must remain unavailable. Re-run the full fake server containment and protocol canaries in a permitted runner context, then review the credential setup and startup/health path before P6 tool exposure. Do not infer Godot editor or live tool qualification from this report.
