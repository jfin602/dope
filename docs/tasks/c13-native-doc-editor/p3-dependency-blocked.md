# P3 card navigation — dependency blocked

**Disposition: BLOCKED; no P3 implementation or qualification.** Pre-task HEAD `469fa8adb7283024af1ec27aabb69e3c1bd01206`; package version `0.13.11`. The working tree was clean at entry.

## Source-bound dependency

P1 and P2 source is present in commits `877c0c95` and `469fa8ad`. P2 provides read-only proposal editor tabs through `ProposalDocumentTabs`, currently opened from retained or checked Docs proposal bytes. The existing Documentation Chat card and controller use the guarded Docs decision owner; the older Documents widget remains registered.

Native `/prompt-write` still produces an unpublished stack JSON draft in the saved assistant response (`prompt-authoring-stage.ts` and `chat-backend.ts`). `ChatPlanningActivity` has no native prompt-stack proposal kind or retained proposal bytes, and the originating Chat UI has no Prompt Stack Proposal card, Accept/Reject/Revise controller, or guarded R3B publisher. `PlanningStackPublication` is the separate Planning Bridge publisher and cannot substitute for that owner. This matches the preserved c13-docs-view P7/P8 dependency findings.

P3 requires navigation on **both** originating proposal cards while preserving their distinct decision authorities. Implementing the prompt card or publisher here would cross the prompt's explicit stop boundary. The native R3B pending proposal read model, Chat card/controller, and guarded publisher must be implemented and source-verified first; then P3 can add the two cards' file links and Open All behavior against those actual interfaces.

No source, tests, manifests, pins, or lockfiles were changed. No build, test, browser, Work Run, grant, publisher, Docs apply, or Git commit was performed because preflight failed before implementation.
