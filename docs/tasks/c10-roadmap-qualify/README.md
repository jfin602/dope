# c10-roadmap-qualify — Phase 10 final Roadmap qualification correction

**Status (2026-10-13):** **/docs-apply + /prompt-ass + /prompt-plan + /prompt-write complete; READY FOR DIRECT RUN / NOT IMPLEMENTED / NOT QUALIFIED.**
**Mode:** Correction 10. **Fixed package version: `0.10.16` UNCHANGED**, all 13 root/app/package manifests and 20 pinned `@dope/*` references.
**Exact entry:** `71d91efb3668e57816bb031f82ab309acea17cfc` product source, subsequent `c620bc0a3be714b7dc329dc5c872a064b1f8003a` P19 evidence-only commit. P19 passed 671/671 automated tests and both builds but **NOT GREEN** live. Original P16 remains **NOT GREEN**. Phase 10 not owner-closed; Phase 11/12 inactive.
**Authority:** ADR 0036 (2026-10-13 amendment), `docs/planning/p10/phase-10-plan.md`, `prompt-assessment.md` and `implementation-plan.md`.

## Correction stack

| Prompt | Responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 — Intent contract](P1-local-intent-contract.txt) | Compact source-aware model intent, nested strict validation, editable capabilities | T2 | GPT-6 Sol High | no |
| [P2 — Local context](P2-local-context-budget.txt) | Bounded 4,096-token packet and NEXT-turn refresh | T2 | GPT-6 Sol High | no |
| [P3 — Relink](P3-linked-document-relink.txt) | Explicit safe moved-file relink | T2 | GPT-6 Sol High | no |
| [P4 — Recovery](P4-document-recovery.txt) | Conflict/crash fault replay and bounded repair | T2 | GPT-6 Sol High | no |
| [P5 — Greenfield](P5-greenfield-completion.txt) | Manual and saved Chat greenfield acceptance | T2 | GPT-6 Sol High | no |
| [P6 — Chat lease](P6-chat-lease-restoration.txt) | Reproduce/recover Chat lease across restart | T2 | GPT-6 Sol High | no |
| [P7 — Spatial UI](P7-roadmap-ui-gates.txt) | Touch/keyboard/prompt navigation and layout gates | T1 | GPT-6 Sol Medium | no |
| [P8 — Integration](P8-qualification-integration.txt) | Cross-owner/adversarial regression integration | T2 | GPT-6 Sol High | no |
| [P9 — Final closeout](P9-roadmap-qualification-closeout.txt) | **Manual actual browser/native Electron/local-model/egress qualification** | T3 | GPT-6 Sol High | **yes** |

## Execution preflight

Starting this selected stack via the runner is sufficient implementation authorization; no separate `/activate` command or activation record is needed. Reconcile actual local HEAD/version/dirty tree safely before mutation. Native Electron window controls/capture, browser+touch/keyboard-equivalent actions and network/process-tree observations remain mandatory P9 T3 qualification evidence, not a pre-P1 implementation gate. A process launch or Electron build is not sufficient. Do not weaken T3 qualification due to missing tooling.

After local checkout contains the authored files, validate runner syntax:
```sh
npm run codex:phase:validate -- c10-roadmap-qualify
```
This command is required at execution; static authoring checks do not substitute for it.

After satisfactory execution preflight:
```sh
npm run codex:phase -- c10-roadmap-qualify
```
The runner owns P1–P8 commits and hands off P9 as its **sole manual, browser-required** closeout. Implementation agents may not commit. Never rerun `p10` or `c10-roadmap-create-sync` to fix this.

## Preservation / pass law

No version bump, yarn.lock/dependency churn, root package-lock or hidden model fallback. Do not overwrite/delete any unrelated dirty checkout files or the historical P16/P19 closeouts. Source-backed unsupported Markdown remains read-only; valid model intent must go through deterministic IDs/hashes, ProjectPlanningActions preview and human approval. No separate Chat or Work runtime, no implicit prompt execution or status Green. Final Green requires all live gates on exact committed source: accepted model proposal → preview → approved linked Markdown/graph write → *fresh next turn*, real greenfield/import/recovery, one saved Chat in every dock, canvas/mouse/touch/keyboard, independent egress and actual native Electron GUI, plus final aggregate. Even if correction qualifies, Phase 10 owner-close is a **separate** decision.

See [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md) and historical [P19 closeout](../c10-roadmap-create-sync/closeout.md).
