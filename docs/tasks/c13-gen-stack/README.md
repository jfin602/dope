# c13-gen-stack — Direct Prompt Stack Generation

**Status:** AUTHORED ONLY / NOT EXECUTED / NOT QUALIFIED. **Product version:** 0.13.11 unchanged. **Owner decision:** 2026-11-11. **Authority:** [ADR 0057](../../decisions/0057-direct-prompt-stack-generation.md) and [direct generation contract](../../planning/p13/direct-prompt-stack-generation-contract.md).

## Objective

Replace mandatory /prompt-ass → /prompt-plan → /prompt-write for **new** prompt-stack authoring with a direct /gen-stack <slug> route. Pi reads relevant source and stages substantive prompt-file text; Dope owns draft IDs, filenames, exact bytes, runner validation, review and the existing guarded publisher. A complete, usable task stack is the outcome. Optional conversational outline is not a mandatory sealed intermediate record.

## Prompt order

| File | Tier | Browser | Responsibility |
| --- | --- | --- | --- |
| [P1](P1-direct-entry-and-draft-owner.txt) | T1 | no | Trusted /gen-stack entry and single draft/session owner |
| [P2](P2-bounded-file-staging.txt) | T1 | no | Direct bounded file/chunk staging, status and recovery |
| [P3](P3-stack-validation-and-publication.txt) | T1 | no | Importer/grammar validation and guarded proposal/publisher |
| [P4](P4-native-progress-and-revision.txt) | T1 | no | Progressive native file previews, targeted Revise and card UX |
| [P5](P5-headless-integration.txt) | T2 | no | Real worker/broker end-to-end, authority, large-stack tests |
| [P6](P6-manual-live-closeout.txt) | T3 | **yes, manual** | Independent real GPT-OSS connected-browser stack generation |

P1–P5 are runner work; P6 is **separately initiated manual**. Do not use --closeout to auto-run P6. After inspecting actual HEAD/owner dirty state, validate with npm run codex:phase:validate -- c13-gen-stack; a separate explicit owner Run may use npm run codex:phase -- c13-gen-stack for P1–P5. Runner owns checkpoints/commits; agents must not self-commit.

## Critical transition gate

Do **not** remove old /prompt-ass, /prompt-plan, /prompt-write routes during P1–P6: preserve historical drafts and avoid destructive migration while replacement is unqualified. The new route is a bounded transitional candidate, not a permanent second writer or fallback. After successful P6 live source-grounded complete stacks, targeted revision, owner-approved disposable publication, Work discovery and owner acceptance of evidence, a **separate owner-approved cleanup** must retire old active command routes and unused stage controllers/chips/tests. Keep shared Pi broker, proposal storage, native editor, composer/importer, publisher and historical evidence. If P6 NOT GREEN, no retirement and no automatic correction loop.

## Evidence and boundaries

Existing c13-ass-fix/P5-D3 is NOT GREEN (Planning rejected source claims; no Prompt Write). Preserve all c13-ass-fix P*.txt and qualification files unchanged. Do not create fictitious prompt-assessment.md or implementation-plan.md for direct stacks; generate truthful README/manifest and any genuine requested docs. No canonical files until explicit Accept, no Work Run/grant or Roadmap award, no product version change by authoring. The 10-work-item scale case belongs to P5 headless; P6 focuses on real-model useful output.
