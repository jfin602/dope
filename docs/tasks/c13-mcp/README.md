# c13-mcp — Runner MCP / Godot Compatibility Correction Stack

**Status:** ASSESSED / PLANNED / RUNNER PROMPTS AUTHORED ONLY — NOT EXECUTED / NOT QUALIFIED. **Date:** 2026-11-17. **Required unchanged product version:** `0.13.11` (verify current local HEAD, manifests and dirty worktree before execution). **Authority:** [ADR 0058](../../decisions/0058-optional-external-mcp-integration.md), [MCP contract](../../planning/p13/external-mcp-compat-contract.md), and [repository workflow](../../workflow.md).

## Outcome and invariants

Dope stays a general-purpose IDE. Install or configure each MCP server **once globally** under **MCP Servers inside the existing AI Center**. Every project sees the shared installed catalog with its own *disabled-by-default* enablement; executing an MCP tool still requires separate Dope-granted authority. Reuse the owner's existing standalone Pi ↔ Godot MCP bridge for the first integration case and qualify GDScript/Godot file support through ordinary Theia tooling. Never embed Godot or weaken Dope's project/Work/Chat sandbox, approval or source-review boundaries.

## Prompt stack and execution

[Assessment](prompt-assessment.md) → [implementation plan](implementation-plan.md) → **P1–P9 via the existing phase runner** → **P10 independently initiated MANUAL/browser-required closeout**.

| File | Tier | Runner | Browser | Single responsibility |
| --- | --- | --- | --- | --- |
| [P1](P1-source-and-godot-mcp-audit.txt) | Audit/evidence | yes | no | Source and existing bridge audit; committed factual handoff report |
| [P2](P2-global-mcp-registry.txt) | T1 | yes | no | Versioned global catalog and secure server configuration |
| [P3](P3-project-activation.txt) | T1 | yes | no | Machine-local per-project enablement, default off and revocation |
| [P4](P4-ai-center-mcp-section.txt) | T1 | yes | no | MCP Servers section inside existing AI Center |
| [P5](P5-mcp-transport-supervision.txt) | T1/security | yes | no | Constrained verified MCP transport/connection lifecycle |
| [P6](P6-pi-chat-mcp-broker.txt) | T1/security | yes | no | Pi Chat checked observational tool routing |
| [P7](P7-pi-work-observation.txt) | T1/security | yes | no | Work observational MCP calls under existing grants |
| [P8](P8-godot-editor-compatibility.txt) | T1/evidence | yes | no | GDScript/file extension compatibility; durable report |
| [P9](P9-integrated-mcp-safety.txt) | T2 | yes | no | Real worker/transport integration, security and second-server regression |
| [P10](P10-manual-godot-closeout.txt) | T3 | **NO** | **yes** | Independently operated real Dope/Godot GUI and evidence closeout |

## Commands and authorization

After confirming exact local source/manifest coherence, prior active Phase 13 recovery status, P1 access to the existing Godot bridge and any owner dirty work, **validate first**:

`npm run codex:phase:validate -- c13-mcp`

An independent, explicit owner **Run** may then authorize:

`npm run codex:phase -- c13-mcp`

This runs P1–P9 only. It makes one runner-owned implementation checkpoint per completed prompt, and stops before browser-required P10. **Do not run `--closeout` for P10**; invoke P10 manually against the exact final source with real connected browser/native Godot evidence. This authoring and validation guidance does not initiate a Run, Git commit for product implementation, MCP install or Roadmap progress.

Corrections keep version `0.13.11` unchanged throughout. No implementation agent self-commit: the runner owns Git checkpointing and resumption. P1's audit report and P8's editor compatibility report are deliberate file changes, required even if no product source change is needed; the runner refuses an empty checkpoint. P9 owns the integrated T2 matrix. One terminal P10 owns manual T3 and owner visual judgement.

## Dependency and safety gates

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → **manual P10**. P1 records actual bridge transport/tool/side-effect evidence and unresolved prerequisites; P5 must not contact the bridge if safety is unproven. P5/P6/P7 include focused negative tests before any later gate and **must not claim a completed safe task** if an authority/containment check fails. Incomplete/unsafe paths mean STOP/NOT GREEN; a textual result alone is not proof of qualified operation.

Global install is independent of project enablement and individual tool permission. There must be no unchecked process execution, blanket network/socket exception, cross-project leak, hidden provider fallback, dynamic trust of MCP tool descriptions or unreviewed live scene/resource modification. Server startup itself can have side effects. Preserve existing worker fixed-tool attestation and ExecutionWorkspace/CandidateDelta/approved promotion. No parallel agent, duplicate AI Center, Godot-specific core subsystem or embedded scene editor.

Each ordinary implementation prompt targets <=8 minutes (10 soft/15 hard), uses changed-package/source-aware focused tests and `git diff --check`, with broad validation deferred to P9/P10 except necessary immediate security checks. If material source reality requires broader trust/authority redesign, return to Planning/owner rather than silently expand scope. Preserve historical NOT GREEN and owner-edited files.

## Status truth

This conversion changes **authored documentation and prompt text only**. P1–P10 remain NOT RUN and NOT QUALIFIED; real Godot MCP behavior, AI Center integration, GDScript extension support and native UI remain unverified until executed. Current Phase 13 recovery and pre-existing qualification evidence remain independent.
