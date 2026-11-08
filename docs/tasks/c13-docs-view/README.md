> **2026-11-08 OWNER CLOSEOUT — CLOSED FORWARD / TECHNICAL NOT GREEN RETAINED:** The owner explicitly closed `c13-docs-view` as a superseded Documents workspace correction after selecting native Theia editor integration, with no further standalone correction run. Read [owner closeout](qualification/owner-closeout-2026-11-08.md). Original P7/P8 BLOCKED and P9 NOT GREEN reports, executed P*.txt, screenshots and source evidence stay unchanged. [c13-native-doc-editor](../c13-native-doc-editor/README.md) replaces the presentation; remaining native Prompt Stack R3B dependency and unverified related UX/safety gates are routed to [Phase 13 recovery R3B](../p13/recovery/R3B-prompt-proposal-publication.txt). This does **not** award a technical PASS, Work Run, version advance or Phase 13 GREEN.

# c13-docs-view — Unified Documents workspace correction

> **OWNER-SELECTED PROMPT STACK / AUTHORING ONLY (2026-11-07):** The owner invoked `/prompt-ass + /prompt-plan + /prompt-write c13-docs-view` after approving [ADR 0053](../../decisions/0053-documents-workspace-and-proposal-review.md) and the [Documents UI contract](../../ui/documents-workspace-contract.md). This folder is the **single named implementation route**, replacing the earlier provisional `c13-documents-workspace` identifier. Product baseline is coherent **0.13.11** at GitHub source `3dc25ff8abab`; local source and implementation status must be rechecked before execution. No source code, package/version, Work Run, qualification or Green is changed by these authored files.

**Documents:** [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), and nine runner-grammar-compatible P*.txt prompts below. Implement only against actual source. Existing [Docs proposal UI](../../planning/p12/documentation-workflow-contract.md) and [native prompt-stack authoring](../../planning/p13/native-prompt-stack-authoring-contract.md) keep distinct guarded publication owners.

## Ordered prompt stack

| Prompt | Single primary responsibility | Tier | Browser |
| --- | --- | --- | --- |
| [P1](P1-documents-viewport-shell.txt) | Shared center Documents widget, mode/selection/navigation model | T1 | No |
| [P2](P2-project-docs-tree.txt) | Bounded real project `.md`/`.txt` explorer | T1 | No |
| [P3](P3-safe-document-preview.txt) | Safe Markdown/plain-text document preview and source display | T1 | No |
| [P4](P4-manual-document-editing.txt) | Normal editor-integrated manual editing/save/conflict UX | T1 | No |
| [P5](P5-proposal-version-diff.txt) | Complete Original/Proposed projection and accurate diff | T1 | No |
| [P6](P6-documentation-proposal-handoff.txt) | Docs proposal card ↔ viewport shared decisions | T1 | No |
| [P7](P7-prompt-stack-documents.txt) | Native draft/published prompt-stack document review | T1 | No |
| [P8](P8-documents-integration.txt) | Source-bound cross-boundary safety/recovery integration | T2 | No |
| [P9](P9-manual-browser-closeout.txt) | Connected Codex browser manual qualification and final closeout | T3 | **Yes — MANUAL** |

P1–P8 are implementation/integration prompts for `npm run codex:phase -- c13-docs-view`; **never** use `--closeout` to auto-run P9. P9 remains a separately initiated owner/manual Codex browser checkpoint. A runner checkpoint or passing focused tests are not product GREEN.

## Dependencies, current-source gaps and boundaries

- **P1 -> P2/P3 -> P4; P1/P3 -> P5 -> P6; P1/P3 -> P7; P1–P7 -> P8 -> P9.** Shared files must not be modified concurrently by independent prompts.
- Remote inspection found `ChatDocumentationProposal.targets` supports `create | update`, *not* delete. Generic diff UI can display a verified deletion/synthetic absent version, but **do not extend Docs publication with delete authorization**. Test unsupported delete requests fail closed; report the live deletion review as unavailable rather than inventing an applied delete.
- The 2026-11-07 native `/prompt-write` proposal/publisher contract is partly **forward-only** on the inspected GitHub source; existing `PlanningStackPublication` is a separate Bridge publisher. P7 must verify whether the native R3A/R3B owner/card actually exists in the implementation checkout; if absent, stop **BLOCKED / dependency** for native-draft integration, with only safe published-stack presentation allowed. Never create a competing prompt-stack owner.
- Keep Chat as the only conversation, existing Docs application/History owner as the sole Docs publisher, existing prompt-stack publication/Work owners, Roadmap Gate evidence and Phase closeout separate. Manual Source/Edit save is ordinary editor/filesystem activity and must not manufacture a Docs-application History receipt.
- Do not copy/clone/clean/stash owner projects, alter executed P*.txt, change `0.13.11` manifests, or declare historical Phase 13 P8/P9/P12/R1 Green by inference.

## Implementation use (later deliberate owner Run)

Validate from the applicable local checkout, after checking HEAD, dirty worktree, actual package version, native prompt-stack readiness, and whether the source already contains overlapping changes:

```bash
npm run codex:phase:validate -- c13-docs-view
npm run codex:phase -- c13-docs-view
```

This authoring action **did not run** these commands. Normal implementation prompts target <=8 minutes with only relevant `@dope/theia-extension` output/test rebuilds and narrow tests. P8 handles integrated cases. After P8, manually perform P9 in the connected Codex browser with disposable project fixtures and append exact-source PASS / FAIL / BLOCKED / EVIDENCE GAP. Any mandatory safety or UI failure remains NOT GREEN. No automatic source commit/version bump or native Phase 13 closeout.
