# Roadmap Element → Chat context picker — approved design

**Owner decision:** 2026-11-01 (America/Chicago). **Status:** APPROVED DESIGN / DOCUMENTATION ONLY; NOT IMPLEMENTED OR QUALIFIED. **Version:** `0.12.7` unchanged. **Owners:** existing saved ChatPanel, composer/context assembly, Roadmap center-editor canvas and authoritative Roadmap store, protected Skills dispatcher, existing backend schema-2 proposal and Accept/Reject authority. [ADR 0044](../../decisions/0044-roadmap-element-context-picker.md) · [Skills](skills-framework-contract.md) · [Roadmap visual](../p11/roadmap-visual-hierarchy-contract.md) · [Hybrid proposal review](chat-roadmap-hybrid-proposal-review.md).

**Sequence:** This is an independently authorized **follow-on after qualification of generic P3-A Skills and protected P3-B `/roadmap`**, not a silent amendment to already-authored C12 P3-A/P3-B/P3-C, P2/H3 or Docs-skills prompts. Historical NOT GREEN and native gaps remain unchanged. Recheck the actual local product source before implementation.

## User interaction

When the existing **Chat and Roadmap are simultaneously visible in the same project window**, **Add Context** in the existing composer gains **Roadmap Element** beside File. When the Roadmap is not visible or not the same project, this action is unavailable; do not open an editor or second Chat as an automatic side effect.

Clicking Roadmap Element enters a temporary **multi-selection mode within the existing Roadmap canvas**. The user can toggle supported elements, select multiple, deselect and commit through **Add Selected** or cancel through **Cancel/Escape**. Individually selectable records can include Phase, Gate, Criterion, Correction and other actually supported typed Roadmap elements *only when* they have stable, authoritative project-scoped identity and readable authorized fields. Do not invent IDs for icons, decorations or visual-only shapes. Preserve canvas pan/zoom, folding, existing keyboard/screen-reader interactions, current selection and accessible focus. Distinguish deliberate context selection from normal Inspector Edit and from an output proposal's `View in Roadmap` overlay. Cancel and empty selection change no draft.

Selected items become **removable context chips** in the same fixed-height Chat composer (e.g., `G1 · Readiness`); display accessible element type and stable label. Multiple chips supported, no duplicate entries. No new composer panel, second editor or persistent Roadmap copy. Chips survive normal focus/panel switching while the same draft is active; when Roadmap hides, chips stay visible but no new picker operation is offered. Respect existing draft persistence where supported; do not silently copy chips into a new Chat or project. Keep File attachments, slash completion, IME, fixed composer height, internal scrolling, Ask/Allow, model selection, text selection/copy, Enter-to-send and cancel behavior intact.

## Explicit protected-skill invocation

**User selection is explicit invocation, not automatic relevance detection.** Adding the **first** Roadmap Element chip automatically and visibly places **`/roadmap` at the start of the outgoing user prompt**. A manually typed `/roadmap` in command position is never duplicated. Preserve the user's remaining draft text; do not auto-send. Track whether the prefix was auto-added. Removing the final chip removes **only an auto-added** prefix; a manually entered command remains. If chips remain and the user deletes/changes the required prefix, restore it or block Send with a clear explanation. Resolve conflicting slash commands visibly, never silently change their meaning.

At Send, Dope resolves the protected skill ID/version/snapshot once in **trusted turn-scoped request metadata**, bound to the exact Chat, project and selected typed element IDs; the visible token is an indication, **not** the security boundary. Plain text, forged chip markup or model-produced `/roadmap` strings cannot authorize edit proposals. Inject the single compact skill body exactly once (avoid Pi/Dope double injection), preserve existing retry snapshot semantics and freshly validate Roadmap sources at retry. No attached selection or skill-body prefill occurs in unrelated ordinary Chat. Read-only Roadmap discussion without selecting elements continues to work under existing P3-B policy.

## Complete and selective context

Resolve selected chips at Send from the **authoritative structured Roadmap**, never from canvas pixels, DOM text, old Chat answer, speculative model output or provisional unaccepted preview ghosts. Include the selected record's full available authorized stored context and necessary interpretation metadata: project/owner/source identity, stable record ID and designation, phase/parent path, title/objective/purpose/description, actual lifecycle and qualification evidence, nested criteria and observations, dependencies, corrections, related stored fields, linked Markdown identity/hash when applicable, Roadmap revision and approval/publication state. Unknown/unrecorded fields remain truthfully unknown; relevant available history can be bounded and identified as such.

- **Gate**: full owned record and nested criteria/evidence plus necessary ancestor/source identity; **exclude unrelated sibling Gates**.
- **Phase**: the deliberately selected phase's full authorized subtree, including owned Gates/criteria/corrections, because the phase itself was selected.
- **Criterion or Correction**: its own record and necessary parent constraints, not every sibling.
- **Multiple selections**: preserve exact selected IDs; deduplicate parent paths, shared child content, repeated entities and explicit parent/child overlaps. Dependency references do not automatically authorize entire unrelated records.
- **Source status**: preserve **canonical published**, **accepted-but-unpublished draft**, **unaccepted draft** and applicable linked-source status as distinct; screenshot label `Accepted draft · not yet canonical` must never be presented as canonical. Planned color/appearance is not qualification Green.

Honor the existing progressive context barrier: no default whole-Roadmap injection, no bulk schema/editor grammar in ordinary Chat, no additional model, index, summarizer, scans or hidden source reads. Bound to the current model context; show limitations and request narrowed selection or **fail closed** when required identity/fields/criteria/source constraints cannot fit. Optional long history may be omitted **only with a visible truthful omission disclosure**, never disguise partial payload as complete. Validate project/root, chip IDs, Roadmap revision, linked-source identity/hash, permission and record existence against the selection basis at Send. If source changed, item disappeared/moved, scope changed or the request is oversized, refresh/reselect/abort explicitly rather than silently substitute stale content. Backend preview and Accept revalidate again.

## Authority separation

Attaching elements grants **selected read context and the explicit protected /roadmap skill route only**. It never approves a write, schema-2 proposal, Work grant, shell command, Git change, linked Markdown publication, status Green or Gate evidence. All AI Roadmap mutations still require existing backend-validated schema-2 proposal, 19 typed operations and 1–3 action envelope, source/lease/revision safeguards and human **Accept/Reject**. The linked source-owned single-field route stays narrower than generic unlinked structural editing. Manual Inspector edits/import/greenfield remain separate authorities.

**Input context picker ≠ `View in Roadmap`:** the picker selects existing records for the *next user prompt*; View in Roadmap displays the *unapproved model-generated proposal* transiently for inspection. Both may use the existing canvas without sharing a second store or approval path. Opening menu, selecting, adding/removing chips, asking read-only questions or generating a preview changes **zero canonical bytes**.

## Future Chrome qualification

In a disposable connected real Chrome project with side-by-side Chat/Roadmap, capture actual typed payload, skill invocation and source state:

1. Visibility only when both views share a project; File remains intact; hiding/reopening Roadmap doesn't silently drop active chips.
2. Multi-select, toggle, Cancel, parent/child and duplicate deduplication; keyboard/narrow/touch/accessibility, pan/zoom/foldout/Inspector coexistence.
3. Fixture with G1 Readiness and G2 Other readiness: selected G1 edit-purpose request resolves G1 without asking which Gate; unselected ambiguous control still clarifies.
4. Full Gate owned fields, criteria/evidence and ancestor/source context; **no G2 sibling leak**; selecting Phase includes the authorized full subtree.
5. Prefix insertion/deduplication, manual prefix retention, final-chip cleanup, tampering/conflicting commands, draft text/IME/attachments/Ask-Allow and no auto-send.
6. Trusted Dope invocation, one skill body, unskilled mutation denial, no ordinary Chat context leak, saved turn/retry snapshot and fresh-source revalidation.
7. Accepted-unpublished versus canonical and provisional proposal state are distinct in actual request and UI; no false Green.
8. Stale/deleted/moved/cross-project, external linked Markdown edits, cancellation/reload and 16,384-token budget overflow fail visibly without silent required-data truncation.
9. Read-only/no-action/Reject produce zero canonical changes; only explicit reviewed Accept can apply; linked unsupported structural edits remain blocked.
10. Matched same-model/no-selection/selection requests record serialized input bytes/tokens, tool calls and timing; prove no automatic full schema/skill prefill.

Run focused tests, typecheck, affected builds and exact-source real Chrome qualification; native installed Electron separately owner-qualified, never inferred from browser. No new Green/status/version claim by authoring.

**Status truth:** This file is an approved design, not an implemented UI, executed prompt or applied Roadmap edit.
