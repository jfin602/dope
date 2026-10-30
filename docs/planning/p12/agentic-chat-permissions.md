# Phase 12 — full Pi agentic Chat and Planning permissions

**Owner decision:** 2026-10-30. **Status:** APPROVED DESIGN / NOT IMPLEMENTED. **Version:** 0.12.7 unchanged. **Correction:** [c12-pi-agentic-chat](../../tasks/c12-pi-agentic-chat/README.md).

## Scope and ownership
Pi must retain its tool-selecting, iterative coding-agent capabilities in Chat, Planning and Work. Dope owns the one saved ChatPanel, project root/identity, AI Center selection, permissions, Roadmap and linked Markdown, Work grants, candidate review, durable History and approvals. Do not build a second Chat, Work or agent loop or treat Pi's session as canonical state.

Native tower-defense testing found ordinary Chat could not autonomously inspect its project without manually supplied source. This is a defect in the *integration policy*: current no-tools Chat mode aborts Pi tool calls. Automatic eligible project file discovery, search and reading must work without attachments. Manual attachments are optional emphasis; "every file" is subject to project ownership, protected paths, credential and isolation rules, not full host filesystem access.

## Composer — Commands: Ask / Allow
Use a compact visible two-option control beside model selection in the **existing composer**:
- **Ask** (default): Pi may list/read/search eligible project files automatically. Before a command execution, pause the Pi agent and show its exact command, project/cwd, sandbox scope and effect summary. Developer may **Allow once** or **Deny**; no command executes while pending. One-use approval binds Chat + project + current turn + exact command digest + canonical root/source basis + expiry. Cancel, change, stale, wrong owner or reuse denies.
- **Allow**: Pi may run sandbox-*eligible* investigation or test commands without asking each time, with observable activity. This does NOT confer arbitrary host shell, secrets, network, outside-root access, canonical writes, Git mutation, automatic Work or Roadmap publication. Unsafe commands deny regardless of toggle.
- Mode is scoped to one Chat/project/active app session. A new Chat starts Ask; switching project or restarting app resets Ask; another Chat cannot inherit this Chat's Allow. Persist audit results, never a reusable authority token.
- Reads, listings and text/path searches do not require approval. Stream compact expandable tool activity without contaminating copied AI response or transcript with debug/secret metadata. Preserve drag-to-scroll, selection/copy and cancellation.

## Pi agent tool bridge
Use Pi's actual custom-tool/multi-step agent loop through the existing pinned worker and Dope host. Expose brokered read/list/path search/text search backed by ChatProjectGrounder's current safe realpath/symlink checks, content limits, source hashes and evidence. Chat/Planning tools are read-only or sandboxed commands; do not expose Pi built-in unrestricted read/write/bash tools in the host process. Pi makes tool-selection decisions, Dope enforces effects. Cap input/output/tool calls and accurately report truncation/omissions; no silent provider fallback.

Command execution must have an OS-enforced project-read-only sandbox, ephemeral temporary writes, sterile env, inaccessible private home and credential mounts, no network sockets (namespace/seccomp), limited process/CPU/time/output. A command's apparent read-only wording is not an access control; never run a model-chosen command in the unsandboxed Dope backend shell. Fail closed when sandbox is unavailable. Allow should not be made useless by an artificially tiny test/build-only command list, but cannot weaken OS protection.

Planning uses the same investigation tools while preserving typed proposals, Roadmap revision/provenance validation and explicit approval to publish. G3 deterministic response-first/no-action routes must not introduce a gratuitous second inference. Chat can **prepare an existing Work draft** for review, but not execute Work, edit canonical files or approve promotion. Work retains current candidate workspace, grants, tests, Accept/Reject and History. Preserve provider independence, exact model and local-only settings.

## Qualification
Real source-bound browser and owner-operated installed Electron must show: tower-defense code exploration with no file attachment; actual Pi read/search events with verified file references and grounded milestone; Ask deny/approve-once, Allow eligible command; sandbox denial of writes, network, secrets, outside-root, symlink escape; Planning review without automatic mutation; cancellation/restart/project-switch permission reset; preserved Chat copy, continuity, provider choices and prior Work success. Browser and native evidence independent. Old P12 P1–P8 and B1–B9 results remain historical; this contract does not grant new Green, Run or a version change.
