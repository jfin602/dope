# C13 MCP P5-R3 — source-bound P6 entry gate

**Date:** 2026-11-17 (America/Chicago). **Technical verdict: GREEN FOR P5 REQUIRED SCOPE. P6 may resume at its own guarded entry and negative-test gates.** This is a supplemental qualification of the local final source, not a new runner P5 checkpoint, product Gate award, P6 implementation, or real Godot qualification. The original [P5 NOT GREEN](p5-transport-supervision-2026-11-17.md), [R1 BLOCKED](p5-r1-containment-recovery-2026-11-17.md), and [R2 NOT GREEN](p5-r2-containment-recovery.md) remain intact as dated evidence.

## Source and authority

- HEAD remained `d1fe3c0fc72c766e6688453fdc9bf2d03afaf781` throughout. The starting worktree contained only R2's uncommitted protocol fix, two test edits and R2 report. The final worktree adds this R3 correction to those files; all changes remain uncommitted for owner review. Product and affected package versions remain `0.13.11`; no manifest, lockfile, dependency, Pi pin or runner-history change.
- This run used the default local command execution environment on Linux x86-64. It could create a user/private network namespace, raise private loopback, bind a host loopback test port and relay to a Unix socket. No `sudo`, elevated permission, outside-sandbox escalation, live Godot MCP server, real fish game, model tool call, Work grant or phase runner was used. R2 records why the earlier runner environment failed these operations and why that failure cannot be erased by this run.
- Final source SHA-256 anchors: `mcp-contained-launch.ts` `1c0526a8445c94bd047248c0d9ee87d1581eb4f1a2f5c50184ff40371232f016`; `mcp-stdio-discovery.ts` `536c47fcd98333afde7a1f168c81e5f6ef4bbf0ceb02e215dea14af1df2a9212`; `mcp-server-registry-store.ts` `489482b0c5b5ea8593518658e7132b3f345e7109e85f05224a881f771d20d521`; `mcp-project-activation-backend.ts` `0e5627c878bd3fe821b38e01a4e202e57f8d87eb04ef33222f6cb3af3d7080d4`; `ai-center-widget.ts` `828346ff56ee6e0bdc6ddd80f347eebe890de10f26abc8268e122290790acb6e`. The exact final bytes must be rehashed if this uncommitted source changes before P6.

## P5 completion performed

1. **Secure bridge-token configuration:** AI Center now provides an explicit password field for an existing global server. The backend writes a 32–256 character token to the existing OS secure-store interface, persists only a secure credential reference in the global catalog, and exposes availability without returning the token. Stale catalog revisions and unavailable secure storage fail closed. A configured launch must be disabled globally before token rotation; registry change revokes active sessions. New setup is ordered: register inert server, set token, then add isolated launch profile. No project file or model prompt receives the token.
2. **Trusted project binding:** Removed `WorkspaceServer.getMostRecentlyUsedWorkspace()` as a launch authority because that value is global and can differ from the current window. AI Center's per-connection selection has no launch provider and therefore cannot start a server. `MCPProjectActivationBackend.launchContained()` requires a backend operation owner to supply its current active root, then checks exact root equality, stable project key, registration revision, project enablement, secure credential and generation again at launch. P6 must supply the trusted Chat backend root; a browser-supplied root or global recent-workspace value is not a substitute.
3. **Health and failure truth:** AI Center shows secure-token availability and says connection health is not checked there, without triggering startup. The contained discovery client records connecting/discovered/unavailable state, safe error and exit details for the authorized operation that actually starts a session. P6 must carry that status through its broker/Chat receipt; this R3 does not add an ambient health probe or a browser launch RPC.
4. **Protocol and fixture safety:** R2's fixed-version initialization rejection remains. The contained fixture additionally checks project symlink escape; the combined test now passes through registry setup, secure-store adapter, project activation, trusted-root denial, private launch, real stdio `initialize`/`tools/list`, no startup project write, session revocation and status transition. Test fixtures select an available loopback port instead of colliding with a running Godot listener or each other.

## Final validation

| Command | Result |
| --- | --- |
| `corepack yarn workspace @dope/contracts build` | Exit `0` |
| `npx tsc -p packages/theia-extension` | Exit `0`; compiled output refreshed before tests |
| `node --test test/unit/mcp-contained-launch.test.ts test/unit/mcp-stdio-discovery.test.ts test/unit/mcp-server-registry.test.ts test/unit/mcp-project-activation.test.ts test/unit/ai-center.test.ts` | Exit `0`, **26/26 passed** on the final source and test files |
| `git diff --check` | Exit `0` |
| Host listener and relay inspection after the tests | No listener on fixed 9081/9082 and no `dope-mcp-relay-*` directory remained; fixture ports are selected dynamically |

The first combined rerun hit `EADDRINUSE` because two test files used fixed port 9081 concurrently. That was a fixture collision, not a containment bypass: the launcher refused the occupied host port. The fixtures were corrected to use available ports and the full focused matrix passed. The failed rerun remains part of this record.

## Security matrix and limits

| Gate | Final observation |
| --- | --- |
| Startup identity and credential | **PASS in isolated fixture.** Catalog entry, secure token adapter, active project, registration generation and approved executable resolved before launch; mismatched root/no trusted provider and stale token revision denied. Actual OS keyring UI use was not manually exercised. |
| Network | **PASS for exposed-host boundary.** Only configured host loopback relay is exposed; unrelated outbound network and occupied host port are denied; wrong bridge token rejected. A child may bind another port *inside its private namespace*, as R2 records, but that listener is not host-exposed. This does not grant generic host networking. |
| Filesystem | **PASS in fixture.** Approved project read succeeds; project write, `.env`, outside secret and symlink escape fail; canonical fixture files remain unchanged. Runtime `/usr` and the approved install root remain intentionally readable. |
| Lifecycle | **PASS in fixture.** Cancellation, lifetime expiry, early exit, project switch and global removal close the process/relay and release resources. No orphan host listener or Unix relay path observed after tests. |
| Protocol | **PASS in focused tests.** Real isolated fake-server handshake and listing, invalid schema, malformed JSON, mismatched IDs, oversized output, cancellation, version mismatch and manifest drift fail closed. No `tools/call` authority exists in P5. |
| Registry, activation, health | **PASS for P5 boundary.** Global registration and independent project toggles remain separate; credential availability is shown without claiming live health; discovery status belongs to the operation that starts it. |

**P6 entry decision:** The contained discovery route and its security negatives are qualified on these final local source bytes. P6 can implement its separate Pi Chat observational broker using a backend-owned current project root, explicit per-call authorization, current registry/project checks and the existing fixed-tool attestation. P6 must stop if its own execution environment cannot run the contained canary or if any authority denial fails. This R3 does not qualify live Godot, the native UI, Work, arbitrary MCP tool calls or Phase 13/Gate GREEN. Since the correction is uncommitted and the runner owns checkpoints, the owner must review/checkpoint these bytes before any runner resume; no P5 marker or runner history was forged.
