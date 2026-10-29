# ADR 0039 — Bundled Pi default local agent runtime

**Decision date:** 2026-10-29. **Status:** OWNER-APPROVED DESIGN, NOT IMPLEMENTED OR QUALIFIED. **Entry:** Phase 12 after separately documented Phase 11 owner closeout and version-only 0.12.0 baseline. [Phase plan](../planning/p12/phase-12-plan.md).

## Decision

Bundle a pinned, reviewed Pi Coding Agent runtime inside the distributed Dope application. Pi is the DEFAULT runtime for eligible **local-model conversational, planning and coding execution paths**, with capability-specific tools and permissions. Pi is not a separate user-installed app or second IDE. Users install Dope once, select or connect a model using the **existing AI Center**, and Dope supplies the exact model ID, endpoint, verified loaded context and capabilities to Pi automatically. A local model/server is still a separate prerequisite: Dope does not secretly download a multi-GB model or silently start a hosted service.

Dope continues to own the single saved dockable ChatPanel, model connection registry, role routing, Roadmap and linked Markdown, Project Mind, Physical/Planning Maps, WorkItems, Work/AgentTaskSequence, grants, isolated execution workspace, candidate verification/promotion, source/Git checkpoints and user-facing History. Pi provides bounded inference loop, agent session, context/compaction, selected tools and structured runtime events. **Never substitute Pi sessions for canonical project or Chat/Work state.** Existing Codex and other explicitly selected providers remain selectable; manual/no-model work is unchanged.

## Host and authority

- Prefer a bounded Pi **SDK** adapter under the existing Node backend; choose an isolated supervised RPC worker instead if native imports, fault isolation or app packaging evidence favors it. Document the decision before broad implementation.
- Own Pi dependency, runtime assets, license/notice, secure updates and reproducible lockfile through Dope. Pack the exact dependency into the Linux AppImage and test on a fresh machine/user profile. Do not run `npm install -g pi`, require a user Pi profile, modify `~/.pi`, or discover arbitrary user/project Pi extensions/skills.
- Translate the existing AI Center's connection-scoped model identity and local-only policy into Pi's model runtime. Fail closed for missing, cold, unsupported, switched or inadequately measured models; no silent model/provider fallback or hosted egress. Dope's 32,768-token Qwen Q4 local profile is a test reference, **not** a global default.
- **Chat/Planning mode:** no filesystem/shell/write/network tools; proposals only through existing typed validation and explicit Dope approval, with no unrequested second inference. **Work mode:** register ONLY Dope-brokered capability-specific tools, authorized per project/task/ExecutionGrant; default Pi shell/file tools are disabled. Existing OS isolation, path/symlink checks, command policy, candidate review and separate promotion remain mandatory; Pi model text never grants permissions.
- Pi's compaction may be used as bounded conversation context, not as a store of approvals or canonical history. Keep Dope-owned signed/hashed references, durable transcript, cancellation/restart recovery and precise provider/model attribution. Suppress debug/secrets from user-facing copies.
- If Pi is unavailable, show a truthful recoverable error or an **explicit** alternate provider/engine choice. No invisible fallback or privilege expansion.

## Non-goals and phase ownership

Do not build a second ChatPanel, replace AI Center/model registry, remove Codex, mandate Pi CLI installation, bundle Qwen model weights, make default hosted inference, bypass current candidate review, or import Pi's own UI. Phase 12 is the bundled engine plus real-use qualification; the originally approved **Living Software Knowledge Model** is preserved as **Phase 13** (ADR 0023's background knowledge/egress invariants remain intact).

## Evidence needed before Green

Pinned dependency/license integrity, no-global-install packaged AppImage, connection/model selection and context probe, no-tool Chat safety, grant-brokered Work execution, actual candidate reject and accept, structured transcripts/History, cancellation/crash/restart, compaction/32K load, browser plus owner-operated Electron, and genuine local multi-file repair. Standalone Pi tests alone do not qualify the integration. See [qualification](../planning/p12/pi-qualification-contract.md).
