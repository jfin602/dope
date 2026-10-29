# /prompt-ass — c11-roadmap-redesign-v2

**CURRENT v2 EXECUTION AUTHORITY (2026-10-29):** The owner deliberately started the named v2 runner; its first attempt stopped at preflight with zero code changes and no P1 PASS. That direct execution action is the **new, distinct v2 sequencing decision**, recorded in [owner-run authorization](qualification/2026-10-29-owner-run-authorization.md). It supersedes the earlier documentation-only preflight request for another written approval. Old P1's exception remains limited to old P1; G3 Chrome R1–R7 gaps remain evidence gaps. Re-run v2 P1 normally with all original technical tests and stop conditions; **do not edit immutable P*.txt source** or forge a completed prompt.

**2026-10-29 / OWNER REQUEST / AUTHORING ONLY.** Supersede executable scope of unqualified original `c11-roadmap-redesign` P1–P7 without changing those immutable prompt bytes or rewriting P1 evidence. Current source must be rechecked locally. Product `0.11.8`, Phase 11 OPEN/NOT QUALIFIED.
**Primary references:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md), [visual contract](../../planning/p11/roadmap-visual-hierarchy-contract.md), [v2 plan](implementation-plan.md).

## Diagnosis from actual P1 record

P1 cycle 2 direct `RoadmapIndex` replacement did not compile across store/projection/sync/greenfield. Cycle 3 compiled pure schema/qualifier prototypes but they were **not wired** to `RoadmapStore` or UI. Cycle 4 retained safe incompatible-schema rejection and 21 focused tests/Chrome unchanged index. Original P1 **NOT GREEN**; no live Gate/Phase authoritative writer, criteria/evidence path, service projection or new GUI. Repetition of three browser rebuilds on disconnected prototypes cannot satisfy architecture cutover. See [record](../c11-roadmap-redesign/qualification/2026-10-29-p1-repair-cycles.md). Latest P1 product source and report were committed to main separately; no phantom unfinished code should be treated as complete.

## Architecture and minimal functional vertical slice

The smallest reliable implementation is **type/validator -> accepted store schema -> mutation API -> Gate evidence evaluation -> Phase eligibility -> canonical service/projection -> typed action**. Each prompt proves exactly its stage with focused tests. A temporary compile-safe contract seam is permitted **within the existing owner** while callers are ported, but it is not a second writable store, runtime schema fallback, or long-term checkpoint compatibility. P17 must remove every such temporary seam. Incompatible old index must remain non-destructively rejected until developer-approved rebuild/reimport.

After the domain is connected, implement Markdown import/sync, greenfield review and AI source semantics, then derived React Flow Phase containers with nested Gate foldouts. Required **intermediate real Chrome** occurs after the UI is testable, not after domain prototypes; final Chrome follows status/help/cleanup/full integration. Source-grounded Green status and separately approved complete Gate set remain mandatory; no silent qualification by task completion or visual fill.

## Why 19 prompts

Previous P1 alone had ~6 independent owners and untestable GUI prerequisites. V2 creates **18 single-outcome implementation or integration scopes plus one independent closeout**, with P14 a manual Chrome implementation-qualification boundary. Runner executes uninterrupted P1–P13 and, after a documented/manual P14 PASS commit, P15–P18. P19 is manual. Lower mental load is more valuable than fewer files; do not merge adjacent prompts to chase an arbitrary time target.

Runner limitation verified in `scripts/codex-phase.mjs`: a `Browser required: yes.` stage stops automation; `detectCompletedPromptPrefix` resumes only from exact Git commit subjects and immutable authored P*.txt source. Hence v2 is a new folder, P14 must have actual browser PASS and commit exactly `c11-roadmap-redesign-v2/P14: Chrome UI integration qualification` before runner resumption. Recording failure evidence under that subject would mislead the runner and is forbidden. P19 independent manual closeout is not an automated pass.

## Risk and qualification priorities

- **Compilation frontier:** new domain types may be staged as pure, compiling code first, then wired across the *same* Roadmap owner; each prompt must leave TypeScript compiling for changed packages.
- **No false proof:** unit success for old `checkpoints[]` is not new schema success; a UI error saying schema incompatible is safety, NOT Gate implementation.
- **Explicit ownership:** Gate belongs to one Phase; Correction parent is Gate or Phase; no c10/c100 inference/graph-proximity assignment.
- **Semantic AI planning:** arbitrary task bullets cannot become required Gates without reviewable acceptance criteria. Phase-only proposals remain incomplete but reviewable.
- **Source safety:** one writer; links to existing Markdown preserve unrelated prose, revision/hashes and separate accept/publish approval.
- **Gate Green:** all mandatory criteria current and verified with authority; Phase Green also requires approved complete gate set/no blockers, waiver explicit exception not counted as Green.
- **Human UX:** exact screenshot grammar, not checkbox-only card. Keep in-stage inspector, ChatPanel, pan/zoom, source-anchored selected Gate, theme/accessibility and real browser visibility.
- **Alpha cleanup:** delete obsolete checkpoint/milestone Roadmap APIs, old parser shims and duplicated nodes by P17. Historical qualification evidence survives, Work runner's execution checkpoint terminology may remain where semantically unrelated.
- **External constraints:** prior P1 sequencing exception applies only to old P1, NOT to v2 execution; G3 Chrome evidence gaps remain gaps. No Phase 11 or native Green inferred.

## Verification policy

Runner prompts: `Browser required: no.` means code/test contract only and must NOT claim a Chrome pass. Run focused tests and one affected compile/build as appropriate with `git diff --check`; record exact source. Manual P14/P19: real connected Chrome screenshot, click/keyboard action, saved project/served bundle identity, no-write/proposal negatives and explicit observed failures. All stop on failure, with targeted repair of the **same narrowly scoped objective**, not an automatic three-cycle retry or broad refactor. Avoid repeated full `npm run check` until P18/final coherent source.
