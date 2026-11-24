# Work tool selection and reusable groups — approved design

**Date:** 2026-11-24. **Status:** OWNER-APPROVED DESIGN / DOCUMENTATION APPLIED; not implemented or qualified. **Scope:** Work tool access and its review surface only. This approval does not change product UI, execution policy, prompt stacks, version, or historical evidence.

## Problem and current boundary

New Work currently asks the owner to **Accept project execution grant**, then displays a long fixed allow/deny list in a separate review disclosure. The checkbox does not let the owner choose which model-facing tools a particular task needs. That is especially noisy for a smaller model asked to navigate a broad tool catalog.

The existing `ExecutionGrant` is a fixed effect ceiling. Its parser rejects changes to that ceiling: candidate workspace reads, writes, bounded processes, tests/builds, project create/modify, and Git inspection are allowed; delete/rename, Git writes/history, network, secrets, private state, outside-root, destructive, system, and package administration are denied. Local Pi Work currently exposes `read_file`, `list_files`, `edit_file`, `run_command`, and `read_command_output` through Dope's broker. A Work tool selector would narrow this set for a run. It cannot turn a denied effect into an allowed one.

## Approved experience

1. Replace the blanket checkbox in each Work start/restart path with **Tools for this Work**. Show a compact selected-group summary, an individual tool checklist, and an exact effective-tool preview. Keep task, model, and required validation visible alongside it.
2. Offer built-in groups initially: **Inspect** (`read_file`, `list_files`), **Edit** (`edit_file`), and **Commands** (`run_command`, `read_command_output`). The ordinary Work preset can select all eligible built-ins for compatibility; a smaller-model preset can begin with Inspect and add only needed tools. Group labels organize choices; they do not introduce new execution authority. If command execution is unavailable for the task, Commands is unavailable. `read_command_output` is useful only with `run_command` and must not be exposed alone.
3. Let the owner create, rename, duplicate, and delete reusable custom groups by explicitly checking tool identities. In a Work draft, allow group selection plus individual overrides; an explicit individual denial wins over a group inclusion. Show the final list and why any requested tool is unavailable. No wildcard, “all future tools,” or silent membership expansion.
4. At **Start Work**, approve the exact task, model/provider, project, resolved tool list, and existing effect ceiling together. The action issues the existing Work grant and a bound, immutable tool-selection record. The model sees only selected supported tools; the broker independently rejects an unselected tool call. Dope-owned required validation, candidate review, promotion, and History remain separate steps and do not disappear when a model tool is deselected.
5. Group definitions are reusable across projects, but the selected groups and overrides for a Work task are project/task scoped. A saved default selection may be project local; it never auto-approves a new Work run. Editing a reusable group does not modify a running or previously approved run. A retry/resume must recheck the frozen selection and current provider/tool availability; material drift requires a new review.

## Authority and provider rules

The effective tool set is the intersection of: trusted tool catalog, provider capability, project enablement, selected groups and overrides, existing grant/effect policy, and any narrower task restrictions. A denial at any layer wins. Check the selection at model registration **and** each broker invocation so a hidden or forged request cannot execute. Bind the approved snapshot to stable tool IDs, schema/catalog revisions, provider/model, project, task, and grant revision; fail closed on an unknown, removed, changed, or stale tool. Keep safe tool-call outcomes in the originating Work transcript and saved History without storing credentials, protected arguments, or source bodies.

Local Pi is the first implementation target because Dope registers and brokers its tools. Other providers may have different enforcement capabilities. If a provider cannot honor the exact list and broker gate, show that limitation and do not present its tools as individually controllable; do not silently switch provider or claim parity. The tool selector must also cover Work started from a WorkItem, Prompt Stack, phase runner, and retries, rather than only the New Work composer.

External MCP tools have a separate boundary under [ADR 0058](../../decisions/0058-optional-external-mcp-integration.md) and its [compatibility contract](external-mcp-compat-contract.md): installation/configuration is global, project activation defaults off, and each invocation needs Dope authorization. A custom group can reference a qualified MCP tool only when its exact server/tool identity is available and approved for that project. Selecting a group never installs or activates a server, supplies credentials, approves a call, or permits a direct live effect. Initial read-only MCP observation and its single-call approval remain distinct from built-in Work tools.

This design preserves the current OS sandbox, isolated ExecutionWorkspace, command allowlist, path/source checks, candidate validation and promotion, and separate owner review. Future tools needing currently denied effects require a separate explicit policy decision and security qualification; group creation alone cannot expand the fixed grant.

## Suggested delivery and checks, after separate implementation authorization

1. Inventory every Work entry path and actual provider tool catalog. Define a versioned, stable tool identity and effect mapping, with unavailable reasons and dependency rules.
2. Add a Dope-owned group store and project preference with cross-window/restart reconciliation. Store names and tool IDs only; no credentials or project source. Freeze resolved selections per accepted run.
3. Apply the filter to Pi registration and enforce it again in the broker. Rework all Work grant review surfaces around the same effective-list preview and explicit Start Work decision. Preserve existing run and promotion records.
4. Verify group and individual precedence, project isolation, stale catalog/provider changes, unknown calls, cancellation/retry, command dependency, no accidental MCP activation, and the existing candidate accept/reject flow. Test a small-model task with a narrow list against the normal list, recording tool count, prompt/tool-schema bytes, completion, and denied-call behavior rather than assuming a performance benefit.

## Owner decisions

- Reusable custom group definitions are machine-local to the Dope installation. A project may save a default *selection*, but definitions do not travel with the project.
- The initial implementation keeps the existing fixed effect ceiling while making tool exposure selectable. A specific tool needing a currently denied effect requires a separate bounded policy decision and security qualification.
- A group edit affects only future approvals. An in-progress Work run keeps its frozen list or is deliberately stopped and restarted.
