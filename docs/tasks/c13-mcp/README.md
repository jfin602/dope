# c13-mcp — Manual MCP / Godot Compatibility Stack

**Status:** PROMPT ASSESSMENT, PLAN, AND MANUAL P1–P10 AUTHORED ONLY. NOT EXECUTED / NOT QUALIFIED. **Date:** 2026-11-17. **Baseline:** preserve verified current local source/version (repository docs report 0.13.11; no version change from authoring). **Authority:** [ADR 0058](../../decisions/0058-optional-external-mcp-integration.md) and [MCP contract](../../planning/p13/external-mcp-compat-contract.md).

## Purpose

Dope stays a general-purpose IDE. Install/register MCP servers **once globally** through **MCP Servers inside the existing AI Center**. Every project can see the installed catalog and toggle availability independently (off by default). Every MCP call remains subject to separately checked project and operation authority. Reuse the owner's existing standalone Pi↔Godot MCP bridge as the first real test, then qualify GDScript and Godot resources through standard Theia editor/language tools. Do not build Godot inside Dope.

## Authored workflow

- [Assessment](prompt-assessment.md): actual source seam, ten-task responsibility wireframe and unknown external server facts.
- [Plan](implementation-plan.md): dependency-ordered implementation, T1/T2/T3, efficiency and safety checks.
- **Manual prompts:** copy one P*.txt into the selected coding agent at a time after reviewing local source and prior evidence. **Do not run codex:phase or --closeout** against this folder; these are not automatic runner steps, and no prompt can trigger the next one.

| Prompt | Tier | Browser | Single responsibility |
| --- | --- | --- | --- |
| [P1](P1-source-and-godot-mcp-audit.txt) | Audit, no code | no | Identify real Godot bridge, transport, tool risks, Pi/Dope gaps |
| [P2](P2-global-mcp-registry.txt) | T1 | no | Versioned, secure global MCP registry |
| [P3](P3-project-activation.txt) | T1 | no | Per-project activation, default off, restart and revocation |
| [P4](P4-ai-center-mcp-section.txt) | T1 | no | Existing AI Center MCP Servers section; no second UI |
| [P5](P5-mcp-transport-supervision.txt) | T1 + safety | no | Minimal safe transport/supervision of P1-verified server |
| [P6](P6-pi-chat-mcp-broker.txt) | T1 + safety | no | Brokered Pi Chat observational tool exposure |
| [P7](P7-pi-work-observation.txt) | T1 + safety | no | Brokered Pi Work observation without direct effects |
| [P8](P8-godot-editor-compatibility.txt) | T1 | no | Godot Tools / GDScript + scenes/shaders/editor compatibility |
| [P9](P9-integrated-mcp-safety.txt) | T2 | no | Cross-boundary safety, persistence, independent server and regression |
| [P10](P10-manual-godot-closeout.txt) | T3 | **yes** | Independent real Godot/native Dope and non-Godot closeout |

## Execution ordering and gates

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10. P1 can stop transport work if the existing Godot bridge is inaccessible or unsafe. P5 must not weaken the local tool sandbox's socket/host execution restrictions; P6/P7 require immediately checked per-call denial tests. The manual P10 is separate from implementation and headless qualification.

Each individually run manual prompt must inspect actual HEAD/dirty tree/version, avoid self-commits unless explicitly directed by owner, run only applicable focused checks, and record exact evidence and source changes. Ordinary implementation targets <=8 min (10 soft/15 hard), with safe narrowing or explicit owner-approved split if needed. P9 owns integrated T2; P10 owns GUI/native T3 and manual owner visual decision. Do not run full builds/tests after every prompt. Preserve original historical evidence.

No global arbitrary installer/package execution, no project-scoped install, no automatic activation, no arbitrary Pi extensions, no new AI runtime, no hidden provider fallback, no broad network permission, no unreviewed agent-triggered Godot scene/resource mutation, and no Godot-specific Dope core. A standard editor save performed directly by the developer is a separate ordinary action.

## Status truth

This commit creates documentation and executable **manual prompt text only**. Nothing has been implemented, installed, connected, tested or qualified by these documents. The project version, active Phase 13 recovery, unrelated runner prompts, historical NOT GREEN reports, Work grants, and Roadmap/Gate status are unchanged.
