# c12-docs-workflow — Planning documentation, applied-only History and Work context

**Owner decision:** 2026-10-30 (America/Chicago). **Status:** ASSESSED / PLANNED / AUTHORED ONLY — NOT RUN, IMPLEMENTED OR QUALIFIED. **Correction version:** `0.12.7` unchanged. **Assessment source:** `c01711345ba3d83900b20242948abdabaeeeb6ac` on `jfin602/dope` main.

[ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md) · [Product contract](../../planning/p12/documentation-workflow-contract.md) · [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md)

## Intended outcome

Planning turns an agreed decision into a reviewed documentation change. Only verified actual applied document effects appear as documentation-change entries in Project History. Fresh coding work receives the applicable updated requirements without manual repetition or attachments.

The owner authorized documentation changes and this stack's assessment, planning and authoring. These files do not execute the implementation or establish new qualification. A later deliberate owner Run of this stack supplies implementation authorization; no `/activate` or second activation-only approval is required.

## Stack

| Prompt | Primary deliverable | Model | Tier |
| --- | --- | --- | --- |
| [P1](P1-document-context.txt) | Resolve bounded project documentation context | Sol Medium | T1 |
| [P2](P2-documentation-proposals.txt) | Persist source-bound documentation proposals | Sol High | T1 |
| [P3](P3-documentation-file-apply.txt) | Implement journaled single-document publication primitives | Sol High | T1 |
| [P4](P4-documentation-application.txt) | Coordinate documentation application and recovery | Sol High | T1 |
| [P5](P5-documentation-roadmap.txt) | Coordinate documentation with the existing Roadmap writer | Sol High | T1 |
| [P6](P6-documentation-service.txt) | Expose project-scoped documentation review and apply authority | Sol High | T1 |
| [P7](P7-documentation-chat-routing.txt) | Route documentation review through the existing Planning Chat | Sol High | T1 |
| [P8](P8-documentation-chat-ui.txt) | Add documentation review and apply controls to the existing ChatPanel | Sol Medium | T1 |
| [P9](P9-documentation-history-source.txt) | Project only verified documentation applications into History | Sol Medium | T1 |
| [P10](P10-documentation-history-navigation.txt) | Open original applied documentation diffs from History | Sol Medium | T1 |
| [P11](P11-documentation-work-context.txt) | Capture current documentation context in prepared Work | Sol High | T1 |
| [P12](P12-documentation-work-delivery.txt) | Deliver prepared documentation requirements to coding agents | Sol High | T1 |
| [P13](P13-documentation-work-freshness.txt) | Reconcile documentation changes before pending work starts | Sol High | T1 |
| [P14](P14-documentation-workflow-integration.txt) | Verify the integrated documentation workflow and regression registration | Sol High | T2 |
| [P15](P15-manual-closeout.txt) | Manual documentation workflow end-to-end closeout | Sol High | T3 / manual |

P1–P13 target <=8 minutes each including essential checks, with a 10-minute soft ceiling and 15-minute hard budget. These are planning estimates, not measured timings. P14 is the deliberately shared cross-owner integration gate. P15 owns one final aggregate plus live qualification and is exempt from ordinary implementation timing when the evidence requires it.

## Entry and dependency checks

At execution inspect the actual local checkout, not the authoring snapshot: `git status --short`, `git rev-parse HEAD`, coherent package/internal-pin version, owner changes, concurrent work and relevant source/evidence. Never reset, stash or clean owner work.

[Project-aware Pi Chat/Planning](../../planning/p12/agentic-chat-permissions.md) and `c12-pi-agentic-chat` were authored but not run at this assessment source. Verify their required discovery/read/search, selected-model and typed-owner seams against the actual checkout before dependent Chat integration and live local proof. A prompt title, version number or authored predecessor is not capability evidence. If a required seam is absent or unsafe, stop the dependent work and report it; do not silently implement that other stack, broaden grants or fabricate readiness. Independent internal domain work must not expose incomplete writes to users.

Do not require all historical Phase 11 gates, full Phase 12 Green or Phase 13 background alignment as entry ceremony. Their failed/unobserved results remain truthful history. This stack has its own scoped DW1–DW10 qualification.

Run grammar validation before execution:

```sh
npm run codex:phase:validate -- c12-docs-workflow
```

When the owner deliberately chooses implementation:

```sh
npm run codex:phase -- c12-docs-workflow
```

The normal runner handles P1–P14 and its Git checkpoints. **P15 is browser-required manual T3; do not pass `--closeout` or run it headlessly.** Operate [P15](P15-manual-closeout.txt) separately, with actual browser and independent owner-operated installed Electron evidence. Implementation agents do not self-commit.

## Boundaries

- Reuse one saved ChatPanel, existing Work, current schema-2 Phase/Gate/Criterion Roadmap, History and editor/diff surfaces.
- Preserve Commands Ask/Allow; it does not grant documentation writes. Only the Dope-owned exact reviewed application may publish eligible docs.
- Proposal/journal records are not History events. Zero retained effects always means zero documentation-change entry.
- The application owner retains stable identity and original diff evidence; History reads bounded metadata without writes or inference.
- Preserve unrelated dirty content, canonical document ownership, project/root identity, selected provider/model and local-only controls.
- No automatic Work, Git commits, grant expansion, Architecture adoption, Gate Green, phase closeout or version change.
- Pending prompt content follows the current reviewed before-run edit policy; no inferred stack-reordering permission and no rewriting running/completed snapshots.
- Initial operations create/update recognized documentation. File deletion/rename, every-editor-save auditing, ambient rewriting and broad Phase 13 monitoring remain outside scope.

## Evidence and qualification

The product contract defines DW1–DW10. P1–P13 add focused behavioral regression tests, P14 joins the owner boundaries, and P15 supplies real developer-task, local-model, restart and native/browser evidence on the final source.

At authoring, only documentation/grammar/efficiency consistency may be checked. Product tests, UI observations and actual execution times are **not** claimed. A later `closeout.md` is written from actual P15 observations; absent or failed mandatory evidence remains NOT GREEN / EVIDENCE GAP. Correction Green does not close Phase 12 or waive existing Pi B1–B9 obligations.

