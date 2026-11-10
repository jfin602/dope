# /prompt-ass — c13-ass-fix

**Disposition:** Proposed correction wireframe; documentation/prompt authoring only. Source: main a410cb0eacb1122be3a84d4823a27943a8a7bb44; version 0.13.11. No implementation/test/live proof from this file.

## Proposed work count and division

**4 work prompts + 1 separate manual T3 closeout:**

- **P1 Assessment wireframe:** replace the exhaustive technical Assessment tool/citation/tiers contract with a concise prompt-count, task-boundary and sequencing record, keeping trusted source and saved-draft ownership.
- **P2 Detailed Planning:** consume the checked Assessment wireframe and perform full source-grounded technical step design, dependencies, acceptance, validation tiers, builds and efficiency.
- **P3 Prompt Write:** faithfully format the approved detailed Plan into runnable prompt files and one reviewable guarded proposal using existing publisher.
- **P4 Cross-stage integration:** test the whole lifecycle and negative owner/project/source/publication boundaries with the actual Pi worker/broker and deterministic provider.
- **P5 Manual closeout:** one real selected local-model, connected-browser end-to-end test on disposable source, with truthful evidence and no automatic Work/Gate effect.

## Inspected implementation seams

prompt-authoring-stage.ts currently defines exhaustive AssessmentRecord categories and Planning consumes that record; incremental-assessment.ts, prompt-draft-store.ts, chat-backend.ts and worker.mjs own the present protected stages, source and Chat identity. Existing incremental-proposal-controller, incremental-prompt-stack, composer and planning-stack-publication own final file staging and publication. Preserve these owners; do not invent a second writer or an auto-publisher.

## Constraints and deferrals

Preserve project/owner/lease/source identity, evidence authenticity, explicit owner review, Plan count/ID handoff, one manual closeout and no canonical files until Accept. Leave independent model parser/context benchmarks and broad Electron parity out of the correction. P4 covers substantial 10-work-item scale; P5 tests a small realistic task so success is defined by a complete useful workflow, not a model-heavy exhaustive Assessment simulation.
