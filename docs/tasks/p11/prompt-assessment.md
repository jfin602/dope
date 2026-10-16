# /prompt-ass — Phase 11 initial known-issue repairs

**Status:** Assessment approved for prompt authoring; not implemented or executed. **Date:** 2026-10-16. **Baseline:** version-only 0.11.0, main b60afd4. Phase 10 0.10.16 / af2b0f0 remains the last directly qualified product under R6 scope.

## Grounded defects and important existing behavior

The owner reported UX-001 wrong linked Roadmap cannot be replaced; UX-002 valid no-action message hidden in JSON; UX-003 Chat fails to guide Dope actions. See the [issue ledger](../../planning/p11/usability-issue-ledger.md). Static screenshot is not source-bound reproduction, and "Loading Roadmap" cannot be presumed stuck.

**Roadmap:** `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` already exposes Markdown/source overlay, normal import when no index, and a limited `Relink Markdown` action **only if sync state is relink-needed**. `packages/project-intelligence/src/node/roadmap-store.ts` `previewRelink/applyRelink` allows only **missing old source + identical mapped bytes/fields**. It explicitly rejects a still-present wrong file and changed content. `acceptImport` also rejects a different linked document and may preserve existing checkpoints; it must NOT be reused as a destructive replacement without a separate contract. Source sync, pending recovery, observers, typed RoadmapService and Theia backend-module are already present. We need a new explicit **replace active project Roadmap** operation with preview and consent, without weakening safe moved-file relink.

**Chat:** `chat-backend.ts` validates strict `no-action` with a user-directed `message`; `roadmap-local-model.ts` caps it and forbids empty boilerplate. `chat-panel-presentation.ts` already projects compact machine activity and **generic** no-action outcome, while `chat-panel-widget.ts` displays a muted `details` JSON activity and that generic summary/questions. This explains why the valid message can be visually buried. Earlier c10-better-planning scoped Green remains historical and cannot be rewritten. Show the validated no-action message as primary assistant prose, deduplicate generic narrative, preserve raw JSON/metadata and honest no-write.

**Guidance:** `chat-context-composer.ts` offers instructions centered on Objective editability, making an unlink request likely to receive an unrelated checkpoint editability explanation. Need small grounded capability/UI guidance using actual registered controls and project link state, not a generalized agent skill grant, second Chat, filesystem access or heavy Q4 prompt.

## /prompt-ass decomposition

| Prompt | Coherent responsibility | Tier / model | Target |
| --- | --- | --- | --- |
| P1 Replacement preview | Read-only, typed project-scoped replacement candidates/impact/preflight | T2 / Sol High | <=8m |
| P2 Replacement commit | Revision/fingerprint guarded replacement and durable source rebind | T2 / Sol High | <=8m |
| P3 Replacement UI | Existing Markdown overlay selection, warning, approval/cancel/retry | T1 / Sol Medium | <=8m |
| P4 No-action prose | Existing Chat activity presentation surfacing validated message as main reply | T1 / Sol Medium | <=8m |
| P5 Dope capability guide | Small verifiable UI help inventory contract, no provider action authority | T1 / Sol Medium | <=8m |
| P6 Contextual help grounding | Inject bounded truthful relevant UI guidance into existing Chat composer | T2 / Sol High | <=8m |
| P7 Cross-seam safety | Focused integrated regression and corrective seams across Roadmap/Chat | T2 / Sol High | <=8m |
| P8 Scoped known-issue closeout | Manual real-GUI U1–U9, aggregate and discovery handoff | T3 / Sol High | manual |

**Dependency order:** P1→P2→P3; P4 independently repairs existing Chat projection; P5→P6 for authoritative Dope help; P7 after P2–P6; P8 after P7. A future Hunter may still find more UX defects. P8 is a **scoped initial-repair closeout**, never automatic product Phase 11 Green; subsequent evidence-driven hunts and distinct correction stacks remain required.

## Non-goals and risk

Do not implement the speculative loading/overlay/toolbar findings without live reproduction. Do not delete the old file, wipe Project Mind/History/independent owners, invent status Green, override unsupported prose ownership, grant ordinary Chat shell/MCP/network/agent permissions, create another chat runtime, alter global model choice, silently call hosted models or activate Phase 12. Do not weaken existing moved-file same-bytes `relink` or pending-sync recovery. If selected replacement has unsynced changes, reject safely or offer explicit non-lossy preservation/backup before approval; do not silently overwrite. All relevant paths stay project-contained/symlink safe. New source provenance, revisions and source watcher lifecycle must be correct across restart and project switches.

## Execution and efficiency

One coherent goal per ordinary prompt, minimum affected builds/tests, at most one full final aggregate in P8. Runtime estimates are **predictions, not measured timings**. Because source ownership/linked-data mutation is involved, P1/P2/P6/P7 carry focused invariant tests despite 8m target. No browser for P1–P7; manual P8 runs with real browser/Electron tools separately and may exceed ordinary prompt budget. After P8, use existing [manual Hunter](usability-hunt-manual.md), the living issue ledger and future `c11-<slug>` correction stacks; do not pre-author an artificial fixed number of discovery cycles.

## Runner version failure correction — 2026-10-16

The initial P1 agent produced its source and focused test but left the root package at 0.11.0. The runner, which only checks and commits, stopped before committing P1 because expected 0.11.1. Original prompts incorrectly delegated manifest bumps to the runner/operator. Corrected P1–P7 now require **each Codex implementation agent** to edit all 13 project package versions and 20 internal @dope/* pins before returning, with the baseline test checking coherence; P8 manual operator owns the final manual version transition. The P1 dirty source/test files are preserved for an expressly approved dirty-tree continuation. This documentation correction does not create a product commit or qualify P1.
