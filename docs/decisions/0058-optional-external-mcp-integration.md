# ADR 0058 — Global MCP Installation, Per-Project Activation, and External Tool Independence

**Date:** 2026-11-17. **Status:** OWNER-APPROVED DESIGN / DOCUMENTATION APPLIED; IMPLEMENTATION NOT STARTED OR QUALIFIED. **Product version:** `0.13.11` unchanged. **Future implementation target:** `c13-external-mcp-compat` (not an authored/executed Prompt Stack).

## Context

The owner wants to use Dope's normal Chat, Roadmap, planning, code editing, and Work to develop Godot projects while retaining Godot as an independent application and keeping Dope a general-purpose IDE. An existing Godot MCP bridge already works with Pi outside Dope; reuse it rather than create a Godot-specific integration.

Inspection of the GitHub Dope source shows bundled Pi `1.4.0` behind a supervised worker with explicitly registered, attested tool sets and Dope-brokered authorization. No general external MCP registration path was demonstrated in that integration. Standalone Pi's bridge support must not be assumed available in Dope until independently qualified.

## Decision

**Install or register MCP servers once for the user's Dope installation; make installed servers discoverable in all projects; enable or disable each server independently for each project; authorize each tool invocation separately.**

MCP Servers is a **section inside the existing AI Center**, not a separate application, editor, workspace, model connection, or project-specific installation manager. The existing AI Center model connection identity and capability routing retain their current owners. A generic MCP registry/adapter may be a distinct tool-connection owner behind that UI; it does not redefine the AI model registry.

### Global server installation and configuration

- One machine-local, application-global MCP server catalog per OS user/Dope installation persists server identity, transport, safe launch/endpoint configuration, health, and enabled/installed status across projects, windows and restarts.
- Install, configure, update and uninstall from **AI Center → MCP Servers**. Installation/registration is never repeated merely because another project is opened. One installation can serve multiple independently configured project activations.
- Server process/executable installation, endpoint configuration and trust belong to global application state; installation requires deliberate user action. Credentials must use existing secure credential handling, never a project repository, `.dope/`, plaintext settings/logs or model prompt.
- An unavailable, disabled, outdated, failed or uninstalled server remains distinguishable from per-project disabled state; removal revokes use in every project, with truthful recovery guidance.
- No automatic untrusted package installation, arbitrary repository-discovered MCP command execution, ambient connection, or startup just from opening a project.

### Per-project activation (not installation)

- Every globally installed server appears as an available option in every project, with a **project-specific on/off toggle** in AI Center's MCP Servers section.
- New or previously unconfigured projects default to **off** for each server until the user enables it, preventing accidental project-data exposure.
- Activation preferences are machine-local and associated with validated stable project identity; they are not canonical `.dope/` knowledge and do not travel automatically with a Git clone. Cross-window/restart state must reconcile without confusing projects.
- Enabling a server only permits it to be considered for explicitly authorized operations in that project; it is **not** a grant of blanket file, network, process, Git, credential, or mutation authority.
- Disabling a server removes its tool exposure for new calls and cancels/revokes outstanding requests where safe, without deleting its global installation or affecting another project's toggle.
- Project A's activation never changes Project B's activation.

### Pi and tool execution authority

- Reuse the existing bundled Pi runtime, saved Chat, Work, tool broker and immutable execution/grant/review owners; do not introduce a parallel agent or provider-owned tool system.
- A trusted Dope-owned adapter validates MCP server identity, tool name/schema, transport, capability declaration and per-project activation before selectively exposing tools to the eligible Pi session. Preserve fixed built-in tool attestation; dynamic MCP manifests must be separately bounded and checked, never an arbitrary Pi-extension escape hatch.
- Treat MCP discovery metadata, instructions, and results as untrusted inputs. Apply argument validation, output limits/redaction, project identity, permission checks, cancellation, timeouts and truthful provenance/results.
- Observation permission is separate from mutation. Read-only inspection is the initial target. Tool calls with direct live filesystem, scene/resource, process, external application or network side effects must never bypass Dope's Authority/ExecutionGrant/ToolExecutor and Work's isolated candidate/review/promotion boundaries.
- The existing local tool sandbox denies network/socket access; a connection to a local or remote MCP server requires an explicitly scoped, tested Dope-owned transport/process boundary, **not** disabling or weakening the existing sandbox or granting generic host execution.
- Fail closed for unknown or changed tools, denied access, unavailable servers, out-of-project actions, stale identities, disconnects, partial errors or unavailable sandbox/authority enforcement. Never silently fall back to a different server or AI provider.

### Application and editor independence

- Godot remains a separate application responsible for scenes, animation, rendering, engine execution and native playtesting. Dope handles ordinary text editors, AI-assisted planning, source edits, review, Git and task coordination.
- GDScript and Godot file support use standard Theia/Monaco, language services and optional Open VSX/VS Code extension compatibility wherever viable. Verify `.gd`, `.gdshader`, `.gdshaderinc`, `.tscn`, `.tres`, `project.godot`, `.gdextension` and asset/UID preservation without creating a duplicate Godot editor.
- The existing project's Godot files remain authoritative for Godot state. Dope's project knowledge and planning remain separately owned; unsupported deterministic GDScript/scene analysis must be reported as unsupported, not fabricated as physical truth.
- No Godot-specific dependency, toolbar, domain model, schema, application mode, runtime requirement or MCP-specific privilege is permitted in Dope core. Godot may be absent or disconnected without impairing ordinary coding projects.
- The same generic MCP contract must accommodate a second unrelated server (for example Blender) without per-server changes to Dope's core.

## Delivery and qualification

The follow-on `docs/planning/p13/external-mcp-compat-contract.md` defines a bounded four-part path: M1 existing Godot bridge/Pi audit; M2 generic global MCP registry and brokered, read-only Pi support; M3 extension-based GDScript/Godot resource editing qualification; M4 real independent-app/security/manual qualification. No implementation, prompt files, command execution, Work Run or Gate GREEN results follow from this documentation application.

Before extension beyond read-only interaction, separately approve and qualify an explicit direct-live-effect policy. A model-visible Godot MCP tool does not establish that such effects are authorized.

## Scope and non-effects

This ADR amends the general AI Center/tool-runtime boundary and clarifies ADR 0003's observation/mutation distinction and ADR 0039's bundled Pi ownership; it does not supersede their safety contracts. Preserve existing Phase 13 recovery, original Not Green/evidence gaps, no `/activate`, source/owner approvals, existing prompt-stack workflow and unchanged version `0.13.11`. Approval of these docs is not implementation, qualification or a release.
