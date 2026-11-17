# /prompt-plan — c13-mcp (runner-compatible implementation plan)

**Status:** AUTHORED ONLY / NOT EXECUTED / NOT QUALIFIED. **Version:** unchanged `0.13.11` per repository contract; reconcile actual local source/version before owner Run. **Source authority:** ADR 0058, `docs/planning/p13/external-mcp-compat-contract.md`, `docs/workflow.md`. **Runner:** P1–P9 only. **P10:** manually initiated browser-required terminal closeout.

## Source-grounded sequence and per-prompt checkpoints

| Prompt | Tiers / source owner | Actual deliverable and bounded tests |
| --- | --- | --- |
| **P1** | Audit / no product code | Inspect real standalone Pi/Godot MCP configuration and actual tool list, bundled Pi worker, fixed tool attestation, local broker and socket-denying sandbox. **Write `qualification/p1-audit.md`** as real source-backed report for runner checkpoint. Missing bridge facts are marked unknown and block P5, not invented. |
| **P2** | T1 / application-global tool registry | Stable validated server IDs and transport config, secure credential references, versioned/revision-safe persistence and restart; focused schema/store/secret tests; no new model connection type. |
| **P3** | T1 / project preference owner | Machine-local server enablement keyed by stable project identity, off default, cross-window/restart conflict and server disable/remove; focused project isolation tests. |
| **P4** | T1 / existing AI Center widget/controller | MCP Servers section for global register/configure/health/remove and current-project enable. No duplicate workspace; focused accessibility/controller/theme tests. Native GUI is P10. |
| **P5** | T1 with immediate security / supervisor | P1-verified stdio or HTTP transport only, safe process startup/endpoint containment, handshake/tools/list, bounded metadata/output/timeouts and lifecycle; direct safety canaries must pass before P6. |
| **P6** | T1 with immediate security / Pi Chat broker | Separate validated MCP manifest intersected with tool/project/Chat permission; maintain exact built-in tool attestation; focused allow/deny/changed tools/cancel tests. |
| **P7** | T1 with immediate security / Work grant and tool broker | Observational MCP only, exact Work task/grant/candidate boundary and no live Godot effect; deny outside-root/scene/process/secret escalation; focused negative tests before P8. |
| **P8** | T1 / native Theia file/editor extension | Test Godot Tools or equivalent in current Theia/Godot; preserve .gd, .tscn, .tres, shaders, binary/UID/import identities, external change conflict; **write `qualification/p8-editor-compatibility.md`** as durable runner checkpoint even with no product change. |
| **P9** | T2 integrated | One consolidated actual bundled Pi + fake/real bounded MCP worker/transport, registry, Chat/Work, UI, project isolation, cancellation/secret/side-effect negative matrix and second unrelated server; report `qualification/p9-integrated-safety.md`. |
| **P10** | Manual T3 | Run only by owner/agent as independent exact-source real Godot/browser/native visual qualification. Check true bridge, G1–G10, safe fish-game copy, non-Godot project, human task success and no effect bypass. |

## Runner and review boundary

Use `npm run codex:phase:validate -- c13-mcp` before a separately authorized `npm run codex:phase -- c13-mcp`. Correction runner checkpoints P1–P9 with exact per-prompt commit subject `c13-mcp/Pn: <title>` and unchanged version `0.13.11`. Do not self-commit, amend checkpoints, or run P10 through `--closeout`. The browser-required final P10 must remain outside the runner.

P1's audit must be an actual evidence file, not an empty/no-op checkpoint; unverified live bridge limits later tool transport. P8 commits truthful compatibility/setup findings even when no product code change is required. P9 commits real source-bound evidence. Never claim STOP/NOT GREEN conditions are qualified merely because a runner commit exists; source/authority security blockers must stop safe progression and be reported.

## Prompt Efficiency Gate (10 checks)

**Single owner:** P1 audit, P2 global registry, P3 project activation, P4 AI Center UI, P5 transport, P6 Chat broker, P7 Work grant, P8 editor extension, P9 cross-boundary integration, P10 manual qualification. Prompt boundaries do not duplicate stores or agents.

**Time:** T1 P2–P8 target <=8 minutes, 10-minute soft/15-minute hard budget; P5–P7 security cannot be sacrificed to save time. A material split needs owner review and matching revised runner prompt/numbering before Run. T2/T3 have qualified exceptions.

**Tests/builds:** Each T1 invokes focused tests and only required changed-package builds in proper dependency order; check whether tests import compiled `lib`. Always `git diff --check`. Avoid `npm run check`/full tests/native packaging per T1. P5–P7 immediately test critical denial canaries. P9 owns one affected-system T2 aggregate. P10 owns necessary browser/native/package/full qualification, only if actually needed, with no redundant passing broad tests.

**Model:** GPT-6 Sol Medium for focused project preference/UI/editor work; Sol High for registry design, process security, Chat/Work authority, T2/T3 and audit. Do not use Terra or routine XHigh.

**UI:** P4 follows ADR 0016/0037, existing AI Center tab patterns, semantic theme tokens, keyboard/narrow-pane, truthful states/feedback/recovery. P10 proves real GUI. No Godot toolbar or new editor.

**Security/permission:** server startup and tool metadata are untrusted; no blanket socket/host/network bypass, project leakage, credential exposure, false permission escalation or authoritative scene writes. Dope owns effects and reviews. Preservation of existing Pi, Chat, Work, Roadmap, History, Project Mind and Godot file identities is explicit.

**Evidence:** Existing-source facts require actual inspected source. P1/P8/P9 reports commit real findings; unknown or failed cases stay unknown/NOT GREEN. Preserve historical failures. No auto Run, owner approval, Gate GREEN or version change from authoring.
