# c11-guidance — targeted manual verified-guidance repair contract

**Status:** OWNER-APPROVED DOCUMENTATION / **M1 EXECUTABLE PROMPT NOT YET AUTHORED OR RUN**.
**Decision:** 2026-10-16 /docs-review -> /docs-apply.
**Track:** UX-003 / supplemental recovery following [P3 Not Green](../closeout.md). **Version:** unchanged `0.11.8`. Product Phase 11 remains OPEN / NOT QUALIFIED.
**Authoritative evidence:** [P3 saved turns](../evidence/p3-saved-chat.json), [P3 source-bound closeout](../closeout.md), [earlier P11 P8](../../p11/known-issue-closeout.md), [Phase 11 issue ledger](../../../planning/p11/usability-issue-ledger.md), ADR 0036/0037, [repository workflow](../../../workflow.md).

## Purpose, design and scope

One future manually executed `M1-verified-guidance-repair.txt` should repair **completeness and factual correctness** of Dope-specific UI-help replies after capability routing. The first `c11-guidance` correction established that the original user phrasing now matches the source-change capability; P3 reproduced remaining errors on product `3acbb6e` in one saved Chat using a loaded local Q4:

- **4/4** original requests reached the correct Change linked file UI route, but **0/4** gave the complete procedure: preview the proposed replacement, explicitly confirm, and understand that the original Markdown file remains on disk.
- A synced Roadmap was incorrectly described as conflicted by the model's refresh response.
- An unrelated Planning Map link question received misleading Objective-edit and Roadmap source-change instructions, despite the deterministic matcher not classifying it as Roadmap source replacement.
- Saving/reloading Chat and Roadmap no-write were directly observed; focused checks were 28/28 and the browser build passed. The full aggregate, native Electron GUI and hosted/Codex parity were not run in P3.

**Chosen approach:** Reuse the existing capability selector, project-state checks, ChatBackend/ChatContextComposer, validated local no-action transport and saved ChatPanel. Add the **smallest authoritative guidance presentation/response boundary** where source-verified procedure and live state can be stated completely without depending on Q4 restating every required safety fact. Keep a clear distinction between source-verified Dope guidance and model-generated commentary. Do not silently rewrite an untrusted model answer and claim that the model said something else, or portray a contradictory generated action instruction as verified. Preserve raw result inspectability, provenance, failure/retry visibility, accessibility and saved Chat replay.

The Roadmap source-change instruction, when currently available, must communicate:
1. Open **Roadmap → Roadmap Markdown and setup → Change linked file**.
2. Select the intended supported project Markdown file and **review the replacement preview** (including affected Roadmap content).
3. **Explicitly confirm** the replacement after review; nothing changes merely by asking Chat or opening a preview.
4. **The previously linked Markdown file is not deleted** from disk.
5. Chat itself **cannot** change the link or grant itself higher action authority; if the feature is blocked, show the real source/permission/precondition and safe recovery action.

For an actual `synced` Roadmap, do not invent a conflict. For a Planning Map link question, do not recommend replacing the linked Roadmap Markdown, and do not infer that editing a checkpoint Objective changes a Planning Map link. For unsupported/unverified procedures, transparently state what can and cannot be confirmed rather than borrowing a neighboring capability's instructions.

## Single manual repair / verification loop

When the owner separately authorizes and **writes** the executable M1 prompt, run it **manually**, not via `npm run codex:phase`. That operator must:
1. Inspect actual checkout HEAD/version/dirty state, source owners and the P3 evidence. Keep all P8/P3 original failures unchanged. Use disposable projects for live GUI writes; do not change real user data or authorize hosted network/tool behavior by default.
2. Trace which instructions are sourced from trusted capability/state versus local-model-generated prose, and identify where incomplete, false or cross-capability guidance gains apparent authority. Avoid expanding the matcher or inventing UI routes without evidence.
3. Make the smallest bounded correction, add focused behavioral/negative regression tests, and test the unchanged `0.11.8` version with only necessary changed-package builds. Preserve strict bounded JSON grammar, local Q4 selection, no extra inference turns, no automatic write and no model/provider fallback.
4. Use real browser/Q4 interaction on the corrected exact-source candidate; replay the original failed cases, record each result, then iterate **repair → focused tests → browser retest** only as needed. Recheck saved Chat, source hashes/revisions and no-authority escalation. Observe rather than fabricate test actor, context, timing, screenshots, request counts or provider use.
5. Run a single final coherent `npm run check` **only if needed for a fresh whole-source qualification claim**, never on each small iteration; it includes typecheck, product tests and browser/Electron builds. A build alone cannot establish native Electron UI evidence.
6. Produce a **new** scoped M1 source-bound report under this manual directory, with exact candidate hash, tested environment/model, steps, PASS/FAIL/BLOCKED/NOT RUN and residual limits. Do not overwrite the historical P3 or P8 closeouts.

## Acceptance matrix — the future M1 must demonstrate

| Gate | Expected direct evidence |
| --- | --- |
| M1-A | The owner's exact request with and without selected checkpoint gives all five source-change guidance elements above, repeatedly, in readable Chat |
| M1-B | Natural paraphrases also provide complete, accurate help without a brittle exact-phrase special case |
| M1-C | Current `synced` state is described accurately; missing/conflict/pending/permission states have truthful non-claiming recovery |
| M1-D | Planning Map links, checkpoint Objective edits, progress/factual Roadmap questions and other links do not inherit Roadmap file-change instructions |
| M1-E | Validated `no-action` means no file/index mutation; source-verified guidance is distinguished from generated prose; invalid outputs remain unvalidated/inspectable |
| M1-F | Saved Chat/reload, copy/expand, model provenance, exact source hashes and negative authority boundaries remain intact |

If any mandatory gate is unobserved or fails, record NOT GREEN or Evidence Gap. **A scoped browser/local-Q4 success would not qualify native Electron, hosted/Codex parity, the separate manual Usability Hunter or product-wide Phase 11.**

## Execution and handoff authority

This file is a **decision and acceptance contract**, not a prompt to run. The executable file `docs/tasks/c11-guidance/manual/M1-verified-guidance-repair.txt` **does not exist yet by design**. A subsequent explicit `/prompt-write` authorization is required before authoring it, followed by a separate owner action to run it manually. No `/activate` gate, no automatic implementation from a hunt/report, no runner stack, no version bump, no Phase 11 Green by implication.

After any scoped repair, continue the independent [manual Usability Hunter](../../p11/usability-hunt-manual.md), first on a different under-tested workflow such as History → exact continuation → Work status/review; that hunt has **not** been run.
