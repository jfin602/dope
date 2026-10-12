# p10 — Unified Roadmap & Local-First AI Planning

**Status 2026-10-12:** /prompt-ass + /prompt-plan + /prompt-write completed; **P1–P16 OWNER-ACTIVATED (2026-10-12) / NOT YET IMPLEMENTED / NOT QUALIFIED**.
**Entry:** Phase 9: owner-closed Green at qualified 0.9.35 source af3447c; Phase 10 coherent version-only 0.10.0 baseline 2fc3b93c01ed56b5c848e80181d630c390f3e551. Phase 10 design is approved and its P1–P16 implementation is separately owner-activated; no prompt execution or qualification is claimed.
**Activation preflight SATISFIED:** the separate explicit owner decision `/activate p10` is recorded in `docs/planning/p10/activation.md`. P1 must inspect that file plus coherent Git-proven `0.10.0`/worktree before implementation; do not block on earlier design-only historical labels. This task stack/baseline alone did not confer approval.

| Prompt | Version | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 — Read-only Roadmap source inventory](P1-source-import.txt) | 0.10.1 | T2 | GPT-6 Sol High | no |
| [P2 — Revision-safe project-local Roadmap store](P2-roadmap-store.txt) | 0.10.2 | T2 | GPT-6 Sol High | no |
| [P3 — Shared validated planning action boundary](P3-planning-actions.txt) | 0.10.3 | T2 | GPT-6 Sol High | no |
| [P4 — Project Mind Ideas and external Issues references](P4-owner-links.txt) | 0.10.4 | T2 | GPT-6 Sol High | no |
| [P5 — Planning Map basis-safe references](P5-planning-links.txt) | 0.10.5 | T2 | GPT-6 Sol High | no |
| [P6 — Truthful checkpoint and branch projection](P6-graph-projection.txt) | 0.10.6 | T1 | GPT-6 Sol Medium | no |
| [P7 — Center Roadmap tab and accessible graph UI](P7-roadmap-canvas.txt) | 0.10.7 | T1 | GPT-6 Sol High | no |
| [P8 — In-place checkpoint detail inspector and manual editing](P8-left-inspector.txt) | 0.10.8 | T1 | GPT-6 Sol High | no |
| [P9 — Ideas and Issues pools with safe promotion](P9-detached-pools.txt) | 0.10.9 | T1 | GPT-6 Sol Medium | no |
| [P10 — Reuse ChatContextComposer for roadmap evidence](P10-chat-context.txt) | 0.10.10 | T2 | GPT-6 Sol High | no |
| [P11 — Selection Follow and Pin in normal ChatPanel](P11-chat-follow-pin.txt) | 0.10.11 | T2 | GPT-6 Sol High | no |
| [P12 — Preview and apply untrusted conversational proposals](P12-chat-actions.txt) | 0.10.12 | T2 | GPT-6 Sol High | no |
| [P13 — Small-context local planning transport and JSON fallback](P13-local-model.txt) | 0.10.13 | T2 | GPT-6 Sol High | no |
| [P14 — Protect Project Mind access before navigation retirement](P14-mind-access.txt) | 0.10.14 | T2 | GPT-6 Sol High | no |
| [P15 — Cross-owner and Chat safety integration](P15-integration.txt) | 0.10.15 | T2 | GPT-6 Sol High | no |
| [P16 — Manual real UI/local model qualification and Phase 10 closeout](P16-phase-10-closeout.txt) | 0.10.16 | T3 | GPT-6 Sol High | yes |

## Execution law

P1–P5 preserve external sources and build safe shared planning action authority; P6–P9 present checkpoint path, branches, left inspector and detached pools; P10–P13 reuse existing Chat, Follow/Pin and local-model proposals; P14 guards Project Mind knowledge before launcher removal; P15 is T2 integration; **P16 is sole manual T3 final Phase 10 qualification/closeout**.

`p10` is historical pre-1.0 runner folder: version `0.10.0` -> `0.10.1` through `0.10.16`, exactly 13 manifests and 20 internal pins updated during every step, no pre-bump, yarn.lock changes or root package-lock. Runner owns ordinary P1–P15 commits and stops for P16. Manual P16 must create a real committed 0.10.16 source before evidence-only closeout.

**After safe local sync and preflight (owner activation now recorded):**

```sh
npm run codex:phase:validate -- p10
npm run codex:phase -- p10
```

## Mandatory T3 evidence

One real saved Chat must successfully plan with the real local model from left/right/bottom/center, including actual center **split** with Roadmap/Planning Map/editor visible, without identity/model/lease loss or forced Chat layout. Prove zero-model manual editing; real existing Markdown round-trip and truthful Not Green; new map/inspector/context next-turn refresh, stale/foreign denial, cross-owner status/adoption controls; real local 4,096-total-token constrained profile where supported and no native tools; fail closed/no silent hosted fallback with independent network observation; durable restart and Project Mind/History access; dark/light/keyboard/narrow; one full `npm run check` on exact committed candidate, browser/Electron builds. Mock-only or missing critical evidence is NOT GREEN.

`docs/tasks/p10/closeout.md` is written only after actual P16; it does not independently owner-close Phase 10 or activate Phase 11/Phase 12. c9-codex-chat and c9-theme-fix historical targets remain separate and must be reconciled before independent execution.
