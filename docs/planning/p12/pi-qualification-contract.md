# Phase 12 — Bundled Pi qualification contract (B1–B9)

Status: Design only. Standalone Pi success is an entry prerequisite, not integration qualification.

| Gate | Required evidence |
| --- | --- |
| B1 Bundled distribution | Official pinned Pi runtime and dependencies, license notices, no global Pi/user profile/launch-time dependency installation. |
| B2 Model auto-wiring | Selected enabled local AI Center connection maps exact model ID, endpoint, actual loaded context/capabilities and credential policy into Pi. Missing, cold or wrong model fails safely. |
| B3 Default routing | Pi is default eligible local Chat/Planning inference and Work agent execution; Chat/Planning gets no coding tools. Existing Codex, hosted explicit selection, manual/no-model work unchanged. |
| B4 Tool authority | Disable Pi built-in filesystem/shell tools and arbitrary extensions; register only Dope-brokered tools. Enforce isolated workspace, ExecutionGrant, path/symlink, command, network and egress policy. |
| B5 Product continuity | Single saved ChatPanel, Roadmap/Planning, Work candidate accept/reject, project-scoped History/transcripts and existing approvals retained. |
| B6 Context | Repeat turns using verified local 32,768-token Qwen reference; bounded tool results, truthful compaction, decision retention, no fake context increase. |
| B7 Fresh AppImage | Installed packaged Electron launches Pi without checkout, Node/npm/global pi or preexisting Pi profile. Build/update/rollback, license and resource paths verified. |
| B8 Recovery | Cancel, timeout, model unload/reload, Pi crash, restart, project-switch, source drift and duplicate starts leave truthful recoverable state with no unapproved promotion. |
| B9 Real work and GUI | Pi independently completes a genuine multi-file edit/test/repair using selected local model in disposable fixture. Actual Codex Chrome plus owner-operated Electron GUI qualification; builds/mocks are not GUI proof. |

For each gate: record exact Dope source/build, Pi version/lock hash, model/connection/loaded context, actor, tool events, tests and GUI evidence, and PASS/NOT GREEN/BLOCKED/EVIDENCE GAP. No canonical Roadmap writes or Work runs without separate Dope approvals. p12 closeout covers bundled Pi only, not all Phase 12 tower-defense real-use testing.
