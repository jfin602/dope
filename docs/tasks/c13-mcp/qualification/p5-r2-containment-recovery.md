# C13 MCP P5-R2 — containment recovery and independent qualification

**Date:** 2026-11-17 (America/Chicago). **Verdict: NOT GREEN. P6 entry remains blocked.** This is a supplemental, source-bound record; it does not replace the original [P5 failure](p5-transport-supervision-2026-11-17.md), [P5-R1 recovery](p5-r1-containment-recovery-2026-11-17.md), or [P1 supplement](p1-containment-supplement-2026-11-17.md). No phase runner, real Godot server, fish-game project, MCP `tools/call`, Work run, Git commit, version update, or Roadmap award occurred.

## Source and environment

- Initial and final HEAD: `d1fe3c0fc72c766e6688453fdc9bf2d03afaf781` (`c13-mcp/P5`). Initial worktree clean; final worktree contains only the two source/test corrections described below and this report. Required product version remains `0.13.11` in the root and changed packages. Compiled `lib/node/mcp-*` files were newer than their TypeScript sources before testing; `npx tsc -p packages/theia-extension` rebuilt the affected output after the edit.
- Current default command environment: Linux x86-64, unprivileged (`CapEff: 0000000000000000`), with `Seccomp: 0`, `Seccomp_filters: 0`, and a full current UID mapping. No `sudo`, elevated tool permission, sandbox override, or separate native-host escalation was requested. This environment differs observably from the prior P5 runner context. Its precise host policy is not recorded by this report.
- Final source SHA-256: `mcp-contained-launch.ts` `1c0526a8445c94bd047248c0d9ee87d1581eb4f1a2f5c50184ff40371232f016`; `mcp-stdio-discovery.ts` `536c47fcd98333afde7a1f168c81e5f6ef4bbf0ceb02e215dea14af1df2a9212`; `mcp-project-activation-backend.ts` `623a1c72a54fcd9728346ef1979b74f53921bbd27e78fc0c67c98a54f9addd87`; `backend-module.ts` `08649bf2b0028f49c56be71e52cddfbc11fd5d17b0134a06b216dbecd4871e50`.

## Original failure and reproduction classification

The original P5 integrated canary failed before the fake server initialized. Its recorded `/usr/bin/unshare --user --map-root-user --net` succeeded, but `ip link set lo up` failed opening a netlink socket with `EPERM`; a host `127.0.0.1:9081` listener also failed with `EPERM`. Those observations are retained as **NOT GREEN** for that execution context. They do not demonstrate a protocol defect, and earlier P1 success on another source/context did not qualify P5.

The same operations now succeed without source changes to containment: `/usr/bin/unshare --user --map-root-user --net -- /usr/bin/ip link set lo up` exited `0`; a Node `net.createServer()` host loopback bind exited `0`; the final contained fake-server tests, including actual MCP `initialize` and `tools/list`, passed. Thus namespace creation, loopback initialization, netlink operations, host loopback bind, Unix relay, process startup and cleanup are available **in this current execution context**. The earlier failure is consistent with restrictions imposed by that runner's outer execution context rather than missing machine-wide Linux capabilities or the P5 launch order. The earlier sandbox's exact policy was not captured, so its particular denial mechanism cannot be proven retrospectively. This successful run must not be generalized to all Codex runner environments.

## Narrow correction

`MCPStdioDiscovery` now rejects a server that negotiates a protocol version other than the one Dope requested (`2025-06-18`) and requires a bounded server version. Previously any short protocol-version string passed initialization. A focused test proves an incompatible version closes discovery before `tools/list`. The containment canary now checks that a project symlink to a host secret cannot read or alter that secret. The launch policy, namespaces, seccomp posture, relay, installation root, credential path, registry, activation and local agent sandbox were not weakened or redesigned.

## Commands and observed results

| Command / operation | Exit / observation |
| --- | --- |
| `git rev-parse HEAD`; `git status --short --branch` | `d1fe3c0fc72c766e6688453fdc9bf2d03afaf781`; initially clean |
| `/usr/bin/unshare --user --map-root-user --net -- /usr/bin/ip link set lo up` | Exit `0` |
| Node host-loopback probe (exact command below) | Exit `0`; bound `127.0.0.1:37507` |
| `npx tsc -p packages/theia-extension` | Exit `0` |
| `node --test test/unit/mcp-contained-launch.test.ts test/unit/mcp-stdio-discovery.test.ts test/unit/mcp-server-registry.test.ts test/unit/mcp-project-activation.test.ts test/unit/ai-center.test.ts` | Exit `0`; **25/25 passed**, including real isolated fake-server startup, bridge traffic, MCP handshake and listing, denial and revocation checks |
| Private-port probe (exact command below) | Exit `0`; **private** port 9082 bind succeeded. This is a private-namespace listener, not a host listener. |
| `ss -ltnp '( sport = :9081 or sport = :9082 )'`; `find /tmp -maxdepth 1 -type d -name 'dope-mcp-relay-*'` | Exit `0`; no host listener or relay directory after tests |
| `git diff --check` | Exit `0` |

The fake server was disposable, created under the test's temporary fixture and removed by the test. It used the unchanged contained launcher plus the rebuilt discovery client. It did not contact the real Godot addon. The fixed test port 9081 was free for these runs and was not left bound; this does not prove that port will be free beside a running Godot instance.

Exact ad hoc network probe commands:

```sh
node -e "const n=require('node:net'); const s=n.createServer(); s.on('error',e=>{console.log(e.code,e.message);process.exit(2)});s.listen(0,'127.0.0.1',()=>{console.log('listening',s.address());s.close()})"
/usr/bin/unshare --user --map-root-user --net -- /bin/sh -c '/usr/bin/ip link set lo up && python3 -c "import socket; s=socket.socket(); s.bind((\"127.0.0.1\", 9082)); print(\"private bind 9082 succeeded\")"'
```

## Containment and protocol matrix

| Requirement | Result on final source |
| --- | --- |
| Trusted executable, approved installation and project identity | **PASS in fixture.** Canonical install path, executable escape and mismatched project key rejected; backend active-root mismatch rejected in tests. Production per-window root authority remains unresolved below. |
| Secure credential and explicit startup authorization | **PARTIAL.** Fake token supplied through the backend and private FD; wrong token rejected at the bridge. Secure-store read exists, but there is no user-facing secure bridge-token setup, and production launch cannot be configured through the current AI Center form. No automatic startup from opening a project was observed or added. |
| MCP handshake and discovery | **PASS in fixture.** Actual isolated stdio child completed `initialize`, initialized notification and `tools/list` with a stable manifest. No `tools/call` exists in this recovery. |
| Network and relay | **PARTIAL.** Child outbound `1.1.1.1:80` denied; only the configured host loopback relay was exposed; occupied port refused without replacing its listener; wrong bridge token refused. A child can bind another port inside its private namespace, so literal denial of **all** unauthorized listener creation is unproven/false. That private listener was not host-visible. No running-Godot port coexistence test. |
| Filesystem | **PASS in fixture.** Project read succeeded, project write denied, `.env` and outside host secret inaccessible, symlink escape read/write denied, original project/secret bytes unchanged. Runtime `/usr` and approved installation are intentionally readable; this is not a proof that every conceivable outside path is inaccessible. |
| Lifecycle | **PASS in fixture.** Abort, lifetime expiry, early child exit, active project switch and global removal released the bridge and process; no listener/relay directory remained. Production window/restart and real-server lifecycle were not exercised. |
| Protocol negatives | **PASS in focused tests.** Invalid schema, malformed JSON, wrong response ID, oversized output, cancellation, tool-manifest change and incompatible negotiated version rejected/closed. All paging edge cases were not separately replayed in this R2 run. |
| Existing local agent sandbox | **UNCHANGED by diff.** This R2 did not requalify that independent denial boundary. |

## Remaining P5 functionality and decision

1. **Secure token setup is incomplete.** `MCPServerRegistryStore.readBridgeToken()` requires an OS-secure-store entry, but the MCP registry RPC and AI Center form provide no path to create/rotate it. The form itself says credential setup and connection health are unavailable. A catalog entry without a credential cannot become a configured isolated launch through the UI. Rotation must revoke active sessions and avoid exposing the token in catalog, Chat, logs or source.
2. **Trusted active-project binding is not yet reliable.** `backend-module.ts` supplies `getMostRecentlyUsedWorkspace()` to `MCPProjectActivationBackend`, a global recent-workspace value rather than the active root of that client connection. Equality checks fail closed when it differs, but a recent workspace is not a reliable per-window authority for launch. Establishing the correct backend-owned connection context is a material authority boundary requiring owner-reviewed design before wiring server startup.
3. **Health is internal only.** `MCPStdioDiscovery.status()` records state and safe errors, but no backend/UI connection-health lifecycle is wired. Registry configuration and project enablement cannot truthfully report a live connection.
4. **Registration and activation are only partly integrated with launch.** Their focused tests pass, including revocation, but the production secure token and trusted root prerequisites above prevent a complete registered-server discovery path. The real Godot bridge, addon authentication, startup side effects and port coexistence remain untested.

**P6 entry gate: BLOCKED.** The current execution environment clears the prior namespace/loopback test-host gap and proves a contained fake-server discovery path on the final source. P5 still lacks the secure configuration, trustworthy per-connection root binding and truthful health needed to expose MCP tools to Pi. The owner must review the active-project authority boundary and secure token/health flow; implement and qualify that bounded P5 completion on its exact source before P6 resumes. Do not alter runner P5 markers or historical evidence, install/launch the real Godot server, weaken containment, or infer a Roadmap Gate result from this supplement.
