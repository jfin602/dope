# ADR 0059 — Direct and Isolated Work execution modes

Status: **Owner-approved forward design / documentation applied only**
Date: 2026-11-25 (America/Chicago)
Amends: ADR 0027, ADR 0028, ADR 0029, ADR 0031 and the November 25 Work-tool-selection contract
Scope: Dope IDE Work, especially local Pi New Work, WorkItem, and compatible Prompt Stack/phase-stack launch paths

## Owner decision and shipped-state boundary

**Direct Work is the default selected mode for all new eligible Prepare Work setups, once this change is implemented.** Isolated Work remains an explicit alternative. The choice appears in the existing **Prepare Work** area, adjacent to project/model and **Tools for this Work**, not in a new modal or parallel workspace. This replaces **mandatory isolation as a universal execution requirement** only for the specifically authorized, qualified Direct Work path. It does **not** remove or weaken the original isolation behavior, deny lists, candidate review, Git/source safety, or authoritative qualification. Do not label Direct Work available before its safe implementation passes qualification; documentation approval alone changes no product source, version, Run, grant, Roadmap or Gate status.

Current source (before implementation) always creates an isolated `ExecutionWorkspace` and promotes a held `CandidateDelta`. The 2026-11-24 c14 P4 browser closeout qualified this isolated local-Pi path only for its reported scope. Older ADRs and evidence stay historically true. This ADR governs forward behavior, and its mode-specific exceptions supersede incompatible "always isolated" language in earlier forward contracts.

## Prepare Work choice and microcopy

Present a clearly labeled two-option **Execution Mode** selector, with **Direct Work** preselected when creating a new eligible Work setup. Always show the selection and effective consequences before Start; one normal **Start Work** approval seals the exact mode, target project, model, selected tools, grant ceiling and source basis. The selector is not an additional permission checkbox.

- **Direct Work — Default:** "The agent edits your open project as it works. Changes appear in the editor immediately. You can review changes and safely revert agent-owned edits."
- **Isolated Work:** "The agent edits a separate copy. Your project stays unchanged until you review and accept the candidate."

Persist the chosen execution mode on each task/run/segment and in History. Do not retroactively convert legacy or active runs. A new standalone Prepare Work defaults to Direct even after the user chose isolated in a different run; it does not silently inherit a previous session mode. A follow-up in the same Work conversation is a fresh reviewed segment: show/confirm the mode, preserve an active segment's frozen mode, and require a new appropriate approval if switching. Unsupported provider or entry paths must be labeled unavailable for Direct and require an explicit alternate choice; never quietly downgrade to Isolated or expand tool authority. Cover New Work, WorkItem, Prompt Stack/phase stack and retry/fork/recovery only where the same safety contracts can actually be enforced. Hosted one-shot limitations must remain truthful.

## Direct Work: immediate working-tree mutation

During a Direct run, the authorized Pi tool broker can create/modify approved regular files directly in the canonical open project. Changes must become visible in existing Theia editor tabs, Explorer, project diagnostics, Git diff and development preview through the normal file-watch infrastructure; do not build a second fake file tree or copy into source after Finish.

**Direct Work is not permission to give the model/OS process unrestricted canonical write access.** All actual canonical mutations must pass a trusted Dope-owned per-operation file broker with canonical project identity, delegated path scope, exact selected tool, current grant, expected previous file identity/hash, source basis, symlink/traversal/protected-file checks and crash-safe per-file journal written **before** the first mutation. New file creation requires expected absence and safe parent checks. If another writer or an unsaved editor buffer changes an affected path, refuse the conflicting mutation and require user reconciliation; do not clobber owner changes. Treat owner dirty source as an explicit start-time review, preserving all owner bytes and baseline history.

OS confinement remains mandatory. Never mount the authoritative worktree writable to an untrusted provider process or general shell. Model-controlled commands must have a read-only canonical view (or safe temporary execution view) and a separate transient scratch area with no path back to authoritative writes. Dope-owned approved validation is a different command authority. If this separation cannot be enforced on the current platform/provider, disable Direct with a real reason rather than weakening existing ADR 0028 boundaries. Retain the current fixed deny ceiling for deletes/renames, Git writes/history, network, credentials/private state, outside-root, destructive/system/package effects, and unapproved MCP calls. Tool selection alone cannot authorize them.

## Direct Work lifecycle, review, recovery

**Direct:** Prepare → Start (explicit direct-write consent) → live authorized file edits → Finish/Stop/failure → frozen truthful applied-change receipt → Dope-owned validation against a reproducible verified snapshot → Review Changes → complete/partial/failed. A successful provider claim or exit 0 is never a substitute for Dope validation. **No candidate promotion or Accept Candidate** in Direct: edits are already on disk. Review shows paths, diff, original and resulting hashes, agent/tool provenance, validation status and conflicts. Do not call an already-applied edit a pending candidate.

A **Revert Agent Changes** affordance may restore precisely attributable agent-created/modified bytes, individually or in aggregate, only when the current file hash/identity still equals the recorded agent after-state and the original before-image is safely available. Never use destructive `git reset --hard`, `git clean`, checkout, stash or broad overwrite. On divergence, stop that path and offer a conflict decision; mixed safe/unsafe revert results must be truthful. Preserve pre-existing and subsequently added owner edits, even on interrupted or failed runs.

Stop, crash, backend restart, denial and failed validation leave *verified* direct edits applied; they do not silently undo them, and a stopped run is not automatically completed or GREEN. Journal first, reconcile outstanding writes on startup and distinguish completed, partial and **uncertain** effects. Never replay an uncertain tool call or queued message. A new segment must recheck project/source/owner identity, previously applied receipts and any unresolved conflicts. Keep immutable per-run evidence and allow the Work conversation to continue under fresh authority.

## Isolated Work remains

Maintain current `ExecutionWorkspace`, OS sandbox, `CandidateDelta`, frozen candidate validation, guarded Accept/Reject promotion and source-drift checks. Its unchanged semantics are reviewed proposal → authoritative application; Direct has no promotion boundary. Future live candidate viewing can open its worktree read-only but is not required to ship this decision. Do not alter or rewrite historical Isolated run records or previous qualification.

## Validation, Roadmap and checkpoint semantics

Direct required validation runs under Dope-owned bounded authority against a captured, hash-verified snapshot of the resulting actual source, never an unrestricted provider command in the writable worktree. Track the exact snapshot identity and check applicability to current canonical source before awarding project-applicable evidence; changes after validation can stale it. Validation failure does not roll back edits; blocks qualification and reports remediation. A Work task may be implemented but unqualified. For Prompt Stack/phase-runner checkpoints, distinguish applied direct files from verified validation and explicit Dope-owned checkpoint commit. No model-selected Git writes or automatic Gate GREEN. Current Roadmap Criterion/Gate/Phase authority and owner closeout remain distinct.

## Implementation and qualification (separate owner-run work)

Implement the two modes in the **existing** Work/AgentTask/AgentRun runtime, broker and UI, not a parallel Work product. Prove direct broker operation-level safety before making Direct selectable and default. Source inspection is mandatory: the existing isolated clone path cannot simply be pointed at the canonical root.

Minimum T1/T2 negatives: default and sealed mode everywhere; legacy mode migration; safe create/modify; deny delete/rename/Git/system/secret/network; selected versus unselected tools; symlink/race/traversal/absolute paths; no bypass via process or validation command; start with dirty/untracked/unsaved edits; concurrent owner edit; rapid successive changes; multi-file partial failure; journal crash/restart and ambiguous writes; after-state-only selective restore; canceled/stopped/failed runs; stale source/validation; recovery/fork/provider changes; exact WorkItem/delegation and phase stack; History/Roadmap evidence and no false promotion; standalone Isolated regression.

Mandatory independent T3: real local Pi in disposable Git project, connected Theia browser and owner-native Electron where available. Observe file changing in canonical editor and development preview during the turn, not only after Finish; Stop leaves correct partial bytes; Review/Revert preserves owner edits; Isolated continues to hold unpromoted changes. Record exact source, model, settings, screenshots/tool traces and any evidence gaps. Never test against the owner's persistent game project.

## Change boundary

This decision is a **docs-only /docs-apply**. No product code, authorized Work Run, tests, self-commit by an agent, version, roadmap result or historical receipt changes here. A separate, targeted implementation and independent live qualification are required.
