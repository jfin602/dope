> **OWNER SEQUENCING AMENDMENT (2026-10-31):** [c12-planning-recovery](../c12-planning-recovery/README.md) supersedes the rigid implementation-plan prerequisite. First clean up the experimental path and qualify conversational schema-2 Roadmap editing; then enter a narrow core `/docs-review`/`/docs-apply` vertical slice. The historical 15-prompt stack remains authored/not run and its publication/recovery/History/Work-reference safety requirements are preserved, not silently claimed implemented. Advanced scope is deferred to separate qualification. No version or GREEN claim by docs.

# c12-docs-workflow — Planning documentation, applied-only History and agent-led reading

**Owner decision:** 2026-10-30 (America/Chicago). **Status:** ASSESSED / PLANNED / AUTHORED ONLY — NOT RUN, IMPLEMENTED OR QUALIFIED. **Correction version:** `0.12.7` unchanged. **Runtime assessment source:** `c01711345ba3d83900b20242948abdabaeeeb6ac` on `jfin602/dope` main.

[ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md) · [Product contract](../../planning/p12/documentation-workflow-contract.md) · [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md)

## Intended outcome

Planning turns an agreed decision into a reviewed documentation change. Only verified actual applied document effects appear as documentation-change entries in Project History. Coding agents receive small pointers to applicable docs, choose relevant reads through their authorized tools and use their own existing session/context handling to digest what they read. Work should follow applicable requirements without the user repeating or attaching them.

The owner corrected the earlier body-packet design because repeatedly loading documentation could crowd context and slow responses. This amendment is based on the authored stack at `ed95e29aee95dc2c7f2c901be4294d1573c534ca`. It replaces body extraction/prefill with optional references and agent-led reading. The prior compatibility strengthening after `5daccac5744b8e2bbb6a3c9e1dc79931b79072be` remains as WC1–WC4. Neither amendment executes product work or establishes qualification.

Dope discovers references from cheap existing declarations, selections and task/owner links. It does not build a new corpus index/cache, select/summarize docs with another model, reread documentation per turn or force bodies into every call. A small relevant hint is offered at an existing applicable handoff or explicit steering boundary only when absent from restored context. Relevant deltas never inject themselves into an active run; normal native history replay remains allowed. Explicit documentation review/apply still reads and verifies its actual target sources.

## Stack

| Prompt | Primary deliverable | Model | Tier |
| --- | --- | --- | --- |
| [P1](P1-document-context.txt) | Discover task-relevant documentation references | Sol Medium | T1 |
| [P2](P2-documentation-proposals.txt) | Persist source-bound documentation proposals | Sol High | T1 |
| [P3](P3-documentation-file-apply.txt) | Implement journaled single-document publication primitives | Sol High | T1 |
| [P4](P4-documentation-application.txt) | Coordinate documentation application and recovery | Sol High | T1 |
| [P5](P5-documentation-roadmap.txt) | Coordinate documentation with the existing Roadmap writer | Sol High | T1 |
| [P6](P6-documentation-service.txt) | Expose project-scoped documentation review and apply authority | Sol High | T1 |
| [P7](P7-documentation-chat-routing.txt) | Route documentation review through the existing Planning Chat | Sol High | T1 |
| [P8](P8-documentation-chat-ui.txt) | Add documentation review and apply controls to the existing ChatPanel | Sol Medium | T1 |
| [P9](P9-documentation-history-source.txt) | Project only verified documentation applications into History | Sol Medium | T1 |
| [P10](P10-documentation-history-navigation.txt) | Open original applied documentation diffs from History | Sol Medium | T1 |
| [P11](P11-documentation-work-context.txt) | Record optional documentation references and access evidence | Sol High | T1 |
| [P12](P12-documentation-work-delivery.txt) | Offer references and preserve safe agent-led documentation reads | Sol High | T1 |
| [P13](P13-documentation-work-freshness.txt) | Resolve changed accepted requirements before pending Work | Sol High | T1 |
| [P14](P14-documentation-workflow-integration.txt) | Verify documentation workflow, compatibility and context cost | Sol High | T2 |
| [P15](P15-manual-closeout.txt) | Manual documentation workflow and context-cost closeout | Sol High | T3 / manual |

P1–P13 target <=8 minutes each including focused validation, with a 10-minute soft ceiling and 15-minute hard budget. These are estimates, not measured timings. P12's necessary bounded-read repair is the main feasibility risk; the assessment narrows its scope and records the stop/report obligation. P14 concentrates cross-owner evidence. P15 owns one final aggregate and live qualification.

## Entry and execution

Inspect the actual local checkout: `git status --short`, `git rev-parse HEAD`, coherent package/internal-pin version, owner changes, concurrent work and relevant source/evidence. Preserve dirty work; never reset, stash or clean it. The recorded SHA is an assessment basis, not an instruction to reset a newer compatible checkout.

[Project-aware Pi Chat/Planning](../../planning/p12/agentic-chat-permissions.md) and `c12-pi-agentic-chat` were authored but not run at that runtime source. Verify required discovery/read/search and typed-owner seams before dependent Chat work. Do not infer readiness from prompt titles or silently implement that other stack. Ordinary independent work does not require broad Phase 11/12 Green or a new activation ceremony.

Work supports distinct native adapters: Codex uses sandboxed shell reads; Pi uses Dope's bounded broker. P12 repairs the concrete Pi prefix/continuation limitation while preserving authorization and existing context/overflow behavior. Neither adapter may gain broad host resource loading. Read visibility and token telemetry differ; report unknowns instead of forcing preloading or claiming universal receipts.

Validate grammar before execution:

```sh
npm run codex:phase:validate -- c12-docs-workflow
```

A deliberate owner Run supplies scoped implementation authorization:

```sh
npm run codex:phase -- c12-docs-workflow
```

The runner handles P1–P14 and checkpoints. **P15 is manual Browser-required T3; do not pass `--closeout` or run it headlessly.** Use real browser and independently observed installed Electron evidence. No `/activate`, second activation-only approval or agent self-commit is required.

## Preserved boundaries

- Reuse existing Chat, Work, schema-2 Phase/Gate/Criterion Roadmap, History and editor/diff owners.
- Commands Ask/Allow and document references do not grant publication or execution authority. A Dope-owned exact reviewed application controls document writes.
- Zero retained effects means no documentation-change entry. Stable application identity and original diff evidence remain owner-backed; History reads metadata without recovery writes or inference.
- Optional refs are not frozen requirements. An offered/read document does not automatically change the accepted task basis or its grant; only an actual accepted-basis conflict uses reviewed pending replacement.
- Preserve current provider/model, local-only controls, immutable task/run history, original prompt content, current pending-content editing policy and existing Git/source checks.
- No automatic Work, Git commit, qualification, Architecture adoption, stack reordering or version change. Initial doc operations remain create/update; delete/rename, ambient rewriting and every-editor-save History remain deferred.

## Required evidence

WC1–WC4 remain mandatory subcases of DW7/DW8/DW10, with no new runtime approval for unaffected work.

| Case | Required result | Evidence owners |
| --- | --- | --- |
| **WC1 — No applicable refs** | Successful cheap discovery yields no hint/feature-initiated body prefetch/extra Dope model call and unchanged original prompt. Required missing/inaccessible evidence remains distinct. | P1/P11/P12; P14; P15 control. |
| **WC2 — Existing tasks** | Otherwise valid legacy origins retain current supported paths and grants. Advisory metadata alone never forces migration/review. Actual accepted-basis replacement preserves immutable prior tasks/runs/checkpoints. | P11/P13; P14 origin/state cases; P15. |
| **WC3 — Bound changes only** | Unread hints, index changes and read observations do not adopt requirements. Unrelated/unchanged/nonsemantic bound-source changes add no documentation approval; material bound conflicts resolve explicitly. | P13; P14 controls; P15. |
| **WC4 — Current coding flow and cost** | Empty/relevant refs preserve tools, validation, Accept/Reject and supported continuation. A late-section agent read leads to correct actual code. Same-model controls expose hint/read cost and prevent automatic scans/prefill/reinjection. | P12; P14 lifecycle/counters; P15 real model/platform measurements. |

Evidence distinguishes **offered**, **observably read** and **followed in validated behavior**. A pointer is not a read receipt; a read receipt is not adoption or proof of implementation. The decisive requirement must lie beyond the first 1,024 characters and outside the prompt/hint. Unknown native read/token details stay unknown.

DW10/WC4 compares no refs, offered-but-unused refs and useful agent reads under matched model/task conditions. Record discovery/preparation time, hint/tool bytes, reported tokens, native versus auxiliary calls, first response/action and total time. Necessary reads and native context handling can cost time/tokens; no zero-cost promise or invented numerical SLO is made. New hosts must not append hints already present in restored Chat history or retry prompts. Independent native reads remain allowed and separately measured. Repeatable material responsiveness regression unexplained by deliberate retrieval or measured model variability remains FAIL/EVIDENCE GAP pending resolution/disposition; recorded numbers alone are not PASS.

P14 reports automated evidence separately from P15 observations. Required failures/gaps prevent feature acceptance and Correction Green. Authoring validates documentation/grammar only; product tests, UI behavior and execution timings remain unrun. Correction Green does not close Phase 12 or waive Pi B1–B9.
