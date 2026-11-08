# P7 prompt-stack Documents adapter — dependency blocked

**Disposition: BLOCKED.** Pre-task HEAD `bb06b44d84e41dfd878883975abead3119979297`; product version `0.13.11`. The execution checkout had no pre-existing dirty files. This is a dependency finding, not an integrated P7 pass or a product qualification.

## Exact missing dependency

R3A's protected `/prompt-ass`, `/prompt-plan`, and `/prompt-write` stages are present. `finishedPromptStack` in `packages/theia-extension/src/node/prompt-authoring-stage.ts` saves a validated stack and digest as JSON in the assistant's unpublished final text. `packages/theia-extension/src/node/chat-backend.ts` emits that text, but does not create a native pending Prompt Stack proposal. `ChatPlanningActivity` in `packages/chat/src/index.ts` has no prompt-stack proposal kind; `packages/theia-extension/src/browser/chat-panel-widget.ts` has no originating Prompt Stack Accept/Reject/Revise card; `chat-panel-controller.ts` and the Chat backend expose no guarded native prompt-stack decision or publication action.

`packages/theia-extension/src/node/planning-stack-publication.ts` is the older Planning Bridge publisher. Its `currentSource` requires a linked Planning Map, approved scope and target, and ready WorkItems. `visual-planning-backend.ts` alone calls it for Bridge stack preview/publication. It cannot publish R3A's standalone Chat draft under the native R3B contract. `phase-stack-controller.ts` and the Work discovery tests cover existing published stack selection, without providing the missing native proposal authority.

## P7 result and continuation

No P7 product source, tests, version files, Work state, or started/executed prompt snapshots were changed. Existing Documents viewer and Docs review work are retained. The required R3B pending proposal read model, originating Chat card, and guarded publisher must be implemented and source-verified first. Then rerun P7 against those actual interfaces, including draft and published file presentation, shared card/viewport decisions, exact paths/digests/version/project checks, and no-Run/grant negatives.

The focused P7 build and tests were not run because the mandated dependency check failed before an adapter could be implemented. No browser, Work Run, or Git commit was performed.
