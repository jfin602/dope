# c10-roadmap-qualify — Phase 10 final Roadmap qualification correction

**Status (2026-10-13):** **P1–P8 IMPLEMENTED/COMMITTED on main through `bcf2b628f`; LIVE MANUAL QUALIFICATION P9–P14 NOT YET EXECUTED / NOT GREEN.**
**Mode:** Correction 10. **Fixed package version: `0.10.16` UNCHANGED**, all 13 root/app/package manifests and 20 pinned `@dope/*` references.
**Exact entry:** `71d91efb3668e57816bb031f82ab309acea17cfc` product source, subsequent `c620bc0a3be714b7dc329dc5c872a064b1f8003a` P19 evidence-only commit. P19 passed 671/671 automated tests and both builds but **NOT GREEN** live. Original P16 remains **NOT GREEN**. Phase 10 not owner-closed; Phase 11/12 inactive.
**Authority:** ADR 0036 (2026-10-13 amendment), `docs/planning/p10/phase-10-plan.md`, `prompt-assessment.md` and `implementation-plan.md`.

## Correction stack

| Prompt | Responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 — Intent contract](P1-local-intent-contract.txt) | Compact source-aware model intent, nested strict validation, editable capabilities | T2 | GPT-6 Sol High | no |
| [P2 — Local context](P2-local-context-budget.txt) | Adaptive measured context, bounded output and NEXT-turn refresh | T2 | GPT-6 Sol High | no |
| [P3 — Relink](P3-linked-document-relink.txt) | Explicit safe moved-file relink | T2 | GPT-6 Sol High | no |
| [P4 — Recovery](P4-document-recovery.txt) | Conflict/crash fault replay and bounded repair | T2 | GPT-6 Sol High | no |
| [P5 — Greenfield](P5-greenfield-completion.txt) | Manual and saved Chat greenfield acceptance | T2 | GPT-6 Sol High | no |
| [P6 — Chat lease](P6-chat-lease-restoration.txt) | Reproduce/recover Chat lease across restart | T2 | GPT-6 Sol High | no |
| [P7 — Spatial UI](P7-roadmap-ui-gates.txt) | Touch/keyboard/prompt navigation and layout gates | T1 | GPT-6 Sol Medium | no |
| [P8 — Integration](P8-qualification-integration.txt) | Cross-owner/adversarial and shared-Markdown handoff regression integration | T2 | GPT-6 Sol High | no |
| [P9 — Runner handoff](P9-roadmap-qualification-closeout.txt) | **Manual browser-required handoff only; see manual P9–P14 below** | T3 | GPT-6 Sol High | **yes** |

## Adaptive local context — default chosen in P9

P2 removes the fixed 4,096-total-token ceiling from local Roadmap planning and uses the verified loaded model context with task-sized context, consistent preview/send/retry accounting, explicit omission diagnostics and bounded JSON output separately from reserved generation tokens. P2 does **not** select a permanent 16K/32K/64K default. **Manual P11** compares the same actual local model/quantization/runtime at loaded **16K, 32K and 64K** across real narrow/large/multi-turn tasks, latency, memory and stability; record limitations and choose the smallest reliably sufficient profile only after measuring. 4K is optional narrow compatibility stress, neither a production maximum nor a full-workflow requirement. Missing comparisons remain an evidence gap, not a fabricated winner. Preserve real local-only and approval/security boundaries.

## Codex ↔ Dope linked Markdown acceptance

Codex CLI and Dope may alternate on **one accepted linked Markdown file in the same local project working tree**. Codex edits the source directly; Dope watches/compares, shows the exact external difference, and requires **Apply source changes** for supported non-conflicting mappings. Dope edits require its existing deterministic preview/approval and minimal document patch; Codex sees the updated source on a fresh file read/turn. Different clones require Git exchange. `.dope/` owns checkpoint IDs, links/graph, layout and sync state; Markdown does not independently own those fields or historical Green/Not Green decisions. Unsupported prose remains source-owned/read-only, and ambiguity, stale edits, move/relink and conflict remain fail-closed review flows—not automatic reconciliation.

P8 owns focused disposable shared-file regression; **manual P9** now owns the **required real Codex CLI → Markdown → Dope UI → Markdown → fresh Codex read**, repeat/restart and conflict/relink replay with hashes, stable IDs, revisions and evidence. No new prompts or second sync service. Mock Codex-like edits alone do not qualify a live handoff; missing Codex/GUI evidence is Not Green / Evidence Gap.

## Manual browser qualification P9–P14 (outside runner)

P1–P8 are committed runner checkpoints. To avoid forcing browser-tool work through the CLI runner, keep the root P9 as its **single final manual handoff file** for parser compatibility. The actual qualification prompts are authored under `manual/` and must be run individually in the browser-enabled interactive environment, **not** through `npm run codex:phase` or artificial Git prompt checkpoints:

| Manual prompt | Family | Execution |
| --- | --- | --- |
| [P9 — Linked Markdown/Codex](manual/P9-markdown-codex-handoff.md) | Genuine Codex → Dope → Codex → Dope, source reconciliation, import/relink/conflict | T3/manual, up to 3 cycles |
| [P10 — Local AI](manual/P10-local-ai-planning.md) | Valid local-model approval, next-turn freshness, manual/Chat greenfield | T3/manual, up to 3 cycles |
| [P11 — Context](manual/P11-context-profiles.md) | Measured 16K/32K/64K comparison and preferred/default-deferred decision | T3/manual, up to 3 cycles |
| [P12 — UI and Chat](manual/P12-interface-chat-electron.md) | Real browser and native Electron, Roadmap, saved Chat four docks and restart | T3/manual, up to 3 cycles |
| [P13 — Authority and egress](manual/P13-authority-egress.md) | Security, stale/foreign denial, historical status, whole-app network observation | T3/manual, up to 3 cycles |
| [P14 — Final closeout](manual/P14-final-qualification-closeout.md) | Reconcile families on exact product SHA, one full aggregate, final Green/Not Green | T3/manual, sole final disposition |

Each P9–P13 group stops early on Green, records append-only `qualification/loop-N-*/cycle-N.md` and its family matrix, and commits any narrow product-source repair separately. After three unsuccessful cycles, preserve the blocker without claiming Green; independent later groups can still gather evidence if safe. P14 checks invalidation from subsequent repairs before reusing earlier evidence and is the **only** writer of the terminal `closeout.md`. No second Chat/sync implementation, phase bump, separate activation or new runner grammar.

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
The runner has completed P1–P8 commits and hands off the root P9 **only as a browser-required manual pointer**; manually execute `manual/P9` through `manual/P14`. Implementation agents do not self-commit; actual manual repairs require deliberately separate product commits. Never rerun `p10` or `c10-roadmap-create-sync` to fix this.

## Preservation / pass law

No version bump, yarn.lock/dependency churn, root package-lock or hidden model fallback. Do not overwrite/delete any unrelated dirty checkout files or the historical P16/P19 closeouts. Source-backed unsupported Markdown remains read-only; valid model intent must go through deterministic IDs/hashes, ProjectPlanningActions preview and human approval. No separate Chat or Work runtime, no implicit prompt execution or status Green. Manual P14 can declare final Green only after all live gates on exact committed source: accepted model proposal → preview → approved linked Markdown/graph write → *fresh next turn*, real greenfield/import/recovery, one saved Chat in every dock, canvas/mouse/touch/keyboard, independent egress and actual native Electron GUI, plus final aggregate. Even if correction qualifies, Phase 10 owner-close is a **separate** decision.

See [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md) and historical [P19 closeout](../c10-roadmap-create-sync/closeout.md).
