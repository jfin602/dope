# ADR 0060 — Pi-native Work tools with Dope-controlled operations

Status: **Owner-approved forward design / documentation applied only**  
Date: 2026-11-26 (America/Chicago)  
Amends: [ADR 0039](0039-bundled-pi-local-agent-runtime.md), [ADR 0059](0059-direct-and-isolated-work-execution-modes.md), and the [Work tool selection contract](../planning/p13/work-tool-selection-proposal.md)

> **2026-11-27 owner debugging amendment:** For local Pi Work, saved and displayed transcripts retain the exact captured tool arguments, broker result and result sent to the model, including paths, source text and output handles. Captured local Pi reasoning and final text are retained verbatim. This supersedes the safe-summary and protected-argument redaction requirements below for this local Work transcript only. It does not broaden tool execution authority or restore data omitted from older runs or by the model provider. Existing storage ceilings must surface an incomplete transcript rather than silently claim a full one.

## Context

Dope currently disables Pi's built-in Work tools and presents five custom wrappers. This preserves Dope's authority checks but changes Pi's tool contracts and feedback. A local Direct Work investigation in `meteor-dodge-dope` found a successful first `index.html` create followed by a denied second create, repeated denied attempts to create `src/main.ts` when `src/` did not exist, generic model-facing denial text, a missing terminal transcript receipt for one completed call, and a final candidate-promotion failure label for Direct Work. Opening the file in the editor was not established as the cause. The exact run remains historical diagnostic evidence, not a qualification receipt.

Pi's maintained write implementation supports injected operations and creates parent directories. Reimplementing Pi's tool behavior in Dope creates avoidable semantic drift and may cost the model calls and context. Exposing unrestricted Pi file or shell tools would bypass Dope's project, grant, source and operating-system boundaries.

## Decision

For eligible Pi-backed Work tools, use the pinned Pi SDK's maintained tool definitions, names, input schemas, model-facing descriptions and result behavior where its public extension points permit **Dope-owned operations** to execute the effects. Dope selects and attests the exact tool implementation and schema revision at registration, and remains the sole authority for each operation. Do not copy Pi's implementation into a parallel Dope tool suite and do not expose raw Pi/plugin tools merely because Pi can register them.

If a Pi extension point cannot keep an entire effect within Dope's preflight, source check, journal, commit and receipt boundary, use a thin Pi-compatible adapter for that tool and document the specific compatibility gap. An injected callback is not sufficient if Pi can perform an unreviewed directory creation, write or shell effect before Dope authorizes and records it. Pin and review Pi upgrades; schema or behavior drift requires renewed catalog review and qualification before exposure.

## File and command behavior

- A selected file write should support Pi's ordinary create/overwrite behavior, including creation of missing parent directories **within the authorized project scope**. Check every path component, symlink, protected path, source basis, expected prior state and conflicting unsaved editor buffer before any mutation. Journal the intended directory and file effects before the first change; reconcile or safely roll back partial effects. Never remove an owner directory or unrelated file as part of recovery.
- Keep Pi-compatible read/list/search/edit semantics only where each can be brokered safely. An edit must distinguish a real content mismatch or stale source from a permission denial. A request to create a file that already exists must return the applicable conflict/overwrite guidance, not a generic authority failure. No tool may silently turn an authorized update into destructive replacement of owner bytes.
- Return bounded, actionable, model-facing results for expected errors: missing path or parent, existing target, edit-match conflict, stale source, unavailable command, and genuine policy denial. Do not disclose protected paths, source contents, credentials, private state or policy internals. Preserve safe tool-call names, order, outcomes and a **terminal receipt for every invocation** in the originating transcript and saved History, including failure, cancellation and uncertain effects. Reasoning text is not proof of a call.
- Keep command execution under the existing fixed effect ceiling, approved-command policy, operating-system confinement and selected-tool gate. Pi's unrestricted Bash behavior is not eligible under that ceiling. Offer Pi-compatible bounded command interaction only where a full Dope operation can enforce it; otherwise show the limitation before Start. Dope-owned required validation remains distinct from model-selected commands.

## Work authority and modes

**Tools for this Work** remains the sole user-facing execution-tool selector and **Start Work** the one ordinary approval for exact task, project/source, model, execution mode and selected tools. Build its catalog from trusted registration of safely brokerable Pi tools. New or upgraded Pi tools are never silently added to saved groups or active grants. Independently reject unselected, forged, stale and changed-schema calls. Retain the internal `ExecutionGrant`, denied-effect ceiling, hosted-data consent and MCP per-call review.

In Direct Work, a successful brokered file operation changes the canonical open project through ADR 0059's journaled authority path. Its result and final status must describe **applied changes**, including partial or uncertain outcomes; no candidate-promotion or Accept Candidate wording applies. In Isolated Work, the same eligible tool behavior operates inside the isolated workspace and retains candidate validation, Accept/Reject and guarded promotion. Editor viewing must not independently revoke a file operation; an actual unsaved-buffer or concurrent-write conflict must be identified precisely and resolved without clobbering owner edits.

## Implementation and qualification boundary

Implement in the existing Pi runtime, Work broker, selection catalog and Work session; do not start a second agent or parallel security owner. Inspect the current SDK and source first, then choose native injected operations per tool or a documented thin adapter. Preserve historical Work transcripts and failure evidence. This documentation approval does not change product code, prompts, version, Work runs, provider qualification, Roadmap or Gate status.

Qualify on a disposable fresh project with a missing `src/` directory and existing editor tabs. Verify authorized create/update/rewrite, parent creation, concurrent and unsaved-buffer conflicts, deep path/symlink/race/protected-file negatives, process isolation, selected versus forged/stale calls, cancellations and partial journal recovery, terminal receipts, Direct status wording, and Isolated candidate regression. Compare the **same local model and task** in standalone Pi and Dope: completed task and validation, tool-call count, tool-schema/prompt bytes, context use, elapsed time and denial recovery. Record actual source, Pi version, model/settings and limitations; no performance or safety claim follows from the design alone.

## Revisit condition

Revisit if Pi removes the needed operations interface, if Pi's result contract cannot be reproduced behind Dope's whole-operation authority, or if a proposed tool requires effects outside the current fixed ceiling. Any broader authority needs a separate owner decision and qualification.
