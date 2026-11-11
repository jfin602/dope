# /prompt-ass — c13-gen-stack (human-authored correction assessment)

**Status:** Authored documentation, not a native /prompt-ass execution. Version 0.13.11 unchanged. This file makes the correction runner-compatible; the proposed product will NOT require it from end users.

## Problem

Live GPT-OSS repeatedly failed the mandatory three-stage authoring protocol despite scripted tests passing. Assessment was simplified, but Planning still rejected PLAN_UNSUPPORTED_SOURCE and no Prompt Stack Proposal was reached in P5-D3. Intermediate sealed records are not the user outcome. The new outcome is one complete, source-relevant, executable, reviewable task stack.

## Work division

**Five work prompts + one terminal manual qualification:**
- P1: trusted explicit /gen-stack and one durable draft owner, no required Assessment/Plan.
- P2: direct model-facing bounded file/chunk staging and verified continuation.
- P3: complete-stack validation, importer/composer compatibility and existing guarded publisher.
- P4: progressive native review and targeted file-level revision.
- P5: real-worker deterministic T2 integration, negative security cases and substantial scale.
- P6: independent real local-model connected-browser qualification, owner review and explicit approval subgate.

## Dependencies, constraints and deferrals

P1 → P2 → P3 → P4 → P5 → P6. Preserve old active authoring routes during qualification; **retire only after** successful P6 plus owner acceptance via separate cleanup. Reuse existing broker, controller, composer/importer, proposal card and publisher. Do not invent a new writer, runtime, Docs workspace or mandatory Assessment/Plan records. Maintain source/lease/owner, no overwrite, version and Work/Roadmap protections. P5 tests ten-plus files; P6 is not an artificial huge live stress test.

## Source seams

Inspect current local source rather than treating this as a complete technical inventory: packages/theia-extension/src/node/chat-backend.ts, chat-skills.ts, incremental-proposal-controller.ts, incremental-prompt-stack.ts, prompt-stack-proposal.ts, planning-stack-publication.ts; packages/pi-runtime/worker.mjs; packages/agent-core/src/phase-stack-composer.ts; native Chat/proposal UI and relevant tests. D3 is historical evidence, not permission to rewrite its report.
