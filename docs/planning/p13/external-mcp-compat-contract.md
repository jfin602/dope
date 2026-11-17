# External MCP and Godot Project Compatibility — Forward Contract

**Date:** 2026-11-17. **Status:** OWNER-APPROVED DESIGN / DOCUMENTATION ONLY; NOT IMPLEMENTED OR QUALIFIED. **ADR:** [0058](../../decisions/0058-optional-external-mcp-integration.md). **Prompt stack:** [c13-mcp](../../tasks/c13-mcp/README.md), assessment/plan/P1–P10 AUTHORED ONLY / NOT EXECUTED: P1–P9 runner-managed after explicit owner Run and P10 independently MANUAL/browser-required; no source execution or Work Run authorized by authoring. **Version:** `0.13.11` unchanged.

## Product objective and invariants

Dope remains a general-purpose IDE. Pi can use optional external MCP tools for a project under Dope-owned permission/authority without bringing the external application's editor into Dope. Godot MCP is the first qualification adapter and GDScript/Godot resource editing is an ordinary Theia compatibility task. Godot must remain fully usable without Dope, and Dope must remain fully usable without Godot.

**Installation/configuration is global; activation is per-project; invocation permission is per-operation.** MCP Servers belongs as a **section inside the existing AI Center**. Do not create a second AI Center, global mode, Godot workspace, MCP-specific Chat/Work panel or persistent server-per-repository installation.

## Proposed ownership and configuration

| Concern | Owner and persistence | Rules |
| --- | --- | --- |
| Installed/registered MCP servers | One app-global, machine-local, revisioned registry per OS user | Stable server ID, display name, trusted transport/endpoint or executable config, health, install/update/remove; cross-window reconciliation; no `.dope/` canonical copy |
| Credentials and sensitive launch parameters | Existing secure application secret handling | Environment/session/OS secure store as supported; never persist plaintext secrets in project files, logs, Chat/Work or connection metadata |
| Enablement | Machine-local per-project preference keyed by validated stable project identity and server ID | Defaults off, independent project toggles, visible in AI Center → MCP Servers; survives restart; no install duplication; no migration into repo |
| Pi tool exposure | Existing supervised Pi host and Dope-authorized broker | Intersect trusted manifest with project activation, current operation and permission ceiling; preserve known built-in tool attestation |
| Per-call tool authority | Existing Dope permission, grant and ToolExecutor owners | Enabling ≠ authorization; reject unapproved actions; no direct authoritative effects through provider/extension/network/server |
| Chat, Work, Roadmap and History | Existing owners | Existing Chat/Planning/Work semantics and source-bound evidence unchanged; MCP activity is provenance, not separate canonical truth |

Installed servers are discoverable across projects **without being automatically connected or exposing project information**. A server enabled for one project must not leak its tools, invocation context or results into another project's session. An enabled server can be unavailable, denied or unsupported in a particular operation; the UI and tool result must distinguish these states. Global uninstall removes the server from all project choices but should preserve recoverable project preferences as disabled/inert or explicitly purge them according to an owner-reviewed policy; never revive permissions automatically on reinstall.

## AI Center UX

Within the existing AI Center, add a discoverable **MCP Servers** section (tab or subsection according to current AI Center patterns), with a global installed-server list and install/configure/update/uninstall/connection-health controls. With an active project, show its **Enable for this project** toggle per server. Make global installation and project enablement unmistakably different controls. The same installed server appears in another project without another install. Server activation status is visible in the relevant Chat/Work tool workflow, with per-call approvals governed by existing Commands Ask/Allow and Work grants. Honor keyboard navigation, accessibility labels, narrow layouts, error recovery and no unexpected modal workflows. Do not add a Godot-specific permanent control or a second tools/AI workspace.

## Protocol, security and lifecycle

1. Begin with an evidence-backed audit of the owner's already-working Godot MCP bridge (actual server distribution, entrypoint, supported transport, runtime prerequisites, tool list, behavior and identity). Do not guess a server package, executable or URL and do not rebuild the bridge.
2. Reuse the bundled pinned Pi runtime and existing tool broker. Explicitly design bounded stdio or Streamable HTTP support only after confirming the existing bridge transport; defer transport variants not required by the qualified server.
3. The MCP adapter owns validated discovery, tool allowlisting/schema checks, request IDs, typed results, bounded output, tool identity/provenance, cancellation, timeout, disconnect and lifecycle cleanup. Tool inventory changes must not defeat built-in fixed-tool-set checks or allow implicit new tools.
4. Servers and MCP tool descriptions are untrusted. No repository instructions, tool metadata or MCP response grants elevated authority. No arbitrary user/project Pi extensions, shell execution, network reachability or credentials through tool descriptions.
5. Preserve Dope's currently isolated Linux process/workspace sandbox. It blocks socket operations; an MCP transport cannot simply punch a hole in it. Implement an independently bounded, auditable server supervision/transport route with least privilege and explicit user configuration; if the required access/containment cannot be proven, mark that server unavailable and stop.
6. Chat/Planning only exposes safe, explicitly approved observational tools at Stage 1. Work's candidate files stay confined to ExecutionWorkspace, then CandidateDelta review/approved promotion. An MCP tool writing a live Godot scene/project or running arbitrary engine commands is a direct effect and is **not** allowed in Stage 1 merely by enabling the server; a distinct owner-reviewed direct-effect mechanism is required later.
7. Preserve source identity, project/root containment, no implicit hosted egress, grant expiry, cancellation and exact results. No tool success from a model's assertion; retain logs/receipts of actual outcomes with redaction.
8. Restart, project switch, server exit, uninstall and disconnect must close or invalidate affected sessions without cross-project reuse. Cross-process registry changes must reconcile as one logical app-global state.

## Language and file compatibility

Use native Theia Explorer/Monaco editors, language services and compatible Open VSX/VS Code extensions rather than embedding a Godot editor. First test an existing Godot/GDScript extension in actual Dope browser and native Electron where needed; record exact extension/version and GDScript LSP diagnostics rather than assuming VS Code compatibility guarantees support.

| File or feature | Stage 1 requirement |
| --- | --- |
| `.gd` | Plain editor read/save, GDScript syntax, diagnostics and navigation where extension/LSP works; distinguish unsupported from broken |
| `.gdshader`, `.gdshaderinc` | Safe text editor/source highlighting where supported |
| `.tscn`, `.tres` | Text view/save and external-change conflict behavior without silently damaging resource identities |
| `project.godot`, `.gdextension` | Ordinary text/config editing; no automatic Godot configuration rewrite |
| `.uid`, `.import`, resource paths | Preserve IDs/import metadata and Git state; no unsolicited regeneration |
| `.scn`, `.res`, `.glb`, images, audio | Detect/support as binary assets; never treat as ordinary editable text |
| File changes between Dope and Godot | Reload clean buffers; warn/protect unsaved buffers; save/reopen retains references and source bytes |
| Physical Map/Flow analysis | If GDScript/scene relations lack deterministic analyzer support, report limitation without fabricated evidence or forced new analyzer |

## Implementation and qualification sequence

**M1 — Audit/preflight (no product feature changes):** Record exact Dope checkout/source/version/dirty state and existing Godot MCP server/standalone Pi setup. Compare with bundled Pi worker fixed tool sets, tool transport, broker, sandbox/authority and actual Theia extension capability. Use a disposable Godot fixture; preserve the original game. Deliver a verified compatibility-gap report before implementation scope is finalized.

**M2 — Generic MCP catalog and Pi connection:** Implement the smallest needed global registry, AI Center MCP Servers section, per-project activation and Dope-controlled Pi MCP exposure/health handling. Reuse any existing capable infrastructure; preserve model registry identities and strict execution boundary. Start with observational calls and one real registered bridge. No unrestricted host command, direct mutation or parallel chat/agent owner.

**M3 — GDScript/Godot file compatibility:** Verify/install a compatible language extension in Dope via existing extension mechanism. Repair only demonstrated general Theia file/extension support gaps. Validate GDScript and scene/resource file identity, external changes and normal SCM. Do not implement a Godot scene editor or special IDE mode.

**M4 — Real manual qualification and independence:** Run the MCP integration through bundled Pi with the already-working Godot bridge on a disposable project; then test a safe copy of the fish game. Confirm read-only call receipts, authorization denial of mutations, lifecycle/restart/cancel/disconnect, cross-project toggles and missing-server behavior, and regression against a non-Godot project. Report exact source/build/model/server/extension identities, evidence and gaps. Manual owner visual/playthrough is distinct from automated validation.

## Acceptance gates

| Gate | Minimum independently observed proof |
| --- | --- |
| G1 Global install | Configure a server once; see the same stable global identity in two projects and after restart |
| G2 Project isolation | Enable in A, disable in B; test project switch, restart, new-project off-default and no cross-project results |
| G3 AI Center surface | Installed/health/configure vs per-project toggle are accessible, coherent and truthful in existing AI Center |
| G4 Bundled Pi | Selected Pi session discovers only approved MCP tools; real brokered inspection result and source-bound trace |
| G5 Permissions | Denied mutation/network/outside-root/secrets/unknown tool cannot bypass broker, existing sandbox or Work review |
| G6 Failures | Server missing/exit, invalid schema, timeout, cancellation, uninstall and tool-list drift fail closed without stale calls |
| G7 GDScript files | Edit/save/reload scripts, text resources and shader files; binary/UID metadata preserved; extension features recorded |
| G8 Application independence | Godot usable without Dope; Dope usable without Godot or the MCP server, including general TypeScript/Rust work |
| G9 Genericity | Second unrelated MCP server can be configured with same core interfaces and no Godot-specific Dope core changes |
| G10 Evidence truth | Exact source/dirty state, technical tests, real native UI/effects, manual fish-game check and outstanding gaps distinguished |

Qualification states remain implementation vs verification vs progression (ADR 0048); no green from commit, model prose, mock success or document adoption. Stop on unsafe direct mutation/authority bypass, loss of project data, cross-project leakage or unverified sandbox escape.

## Explicit exclusions and sequence

Not in this scope: embedded Godot viewport, scene graph editor, 3D tooling, permanent Godot toolbar, custom Godot project model, Godot-specific Roadmap commands, automatic external-engine launch, ambient MCP execution, direct live scene mutation, general unrestricted networking, and rebuilding Pi or the existing Godot bridge. Deferred capabilities require a separate owner decision.

Run this only after the applicable Phase 13 recovery/source baseline is reconciled. The present change is **documentation application**, not generated executable prompts, code, server installation, a work grant, a Work Run, a Godot qualification or a product version update. Preserve all historical failure and success evidence.
