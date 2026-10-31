# c12-planning-recovery — narrow conversational Planning recovery

**Owner decision:** 2026-10-31. **Status:** DESIGN / ASSESSED / PLANNED / THREE MANUAL PROMPTS AUTHORED. NOT EXECUTED OR QUALIFIED BY THIS DOCUMENTATION CHANGE. **Version:** `0.12.7` unchanged.

**2026-10-31 execution update:** P1 cleanup reached **GREEN for its recovered scope** after the [P1-R1 completion repair and real Qwen30 browser qualification](qualification/2026-10-31-p1-r1-chat-completion.md). The [original P1 NOT GREEN report](qualification/2026-10-31-p1-cleanup.md) remains historical evidence. P2 and P3 have not started; C12 and native Electron are not qualified. Version remains `0.12.7`; no self-commit.

**Later 2026-10-31 reliability follow-up:** [P1-R2](qualification/2026-10-31-p1-r2-loop-context-isolation.md) repaired repeated-evidence containment, failed/cancelled context isolation and explicit no-tool routing on uncommitted `0.12.7` source. Focused checks and builds pass. At the owner's correction, live replay used `qwen3.5-9b`: one source turn and a fresh no-tool control completed, and a separate read-only control received exact automatic file context. The exact post-cancellation follow-up failed at the output limit. **P1-R2 NOT GREEN; do not start P2.** This does not revise the narrower earlier P1-R1 Green or any original failed evidence.

**Why:** The experimental `implementation-plan`/Planning-only `submit_plan` route proved Pi source inspection and model submissions but repeatedly failed to yield a valid human-reviewable plan. The owner no longer wants a parallel implementation-plan product. Natural project-aware Chat should discuss architecture freely, then propose explicit changes through the **existing** Phase → Gate → Criterion Roadmap and, separately, through reviewed documentation changes. Retain actual NOT GREEN reports and owner-native evidence gaps; mark the obsolete *requirement* superseded, never its failed tests PASS.

[Assessment](prompt-assessment.md) · [Plan](implementation-plan.md) · [Owner scope](scope.md) · [original C12](../c12-pi-agentic-chat/README.md) · [original Docs](../c12-docs-workflow/README.md)

## Manual execution, in order

| Prompt | Narrow responsibility | Exit |
| --- | --- | --- |
| [P1](P1-planning-cleanup.txt) | Remove only the superseded implementation-plan/submit_plan pathway; preserve Pi tools, Chat, Work, Roadmap and unrelated Planning Map | Focused tests, typecheck/build and real Chat smoke; no orphan route |
| [P2](P2-roadmap-conversation.txt) | Test existing schema-2 conversational Roadmap editing and repair only demonstrated gaps | Real project-aware Pi conversation, reviewed actions, accept/reject, revision/Markdown controls |
| [P3](P3-docs-core-entry.txt) | Establish or qualify the smallest safe /docs-review → reviewed diff → /docs-apply vertical slice, reusing original design | Either verified real review/apply/recovery/History outcome or explicit scoped BLOCKED/incomplete handoff |

All three are **manual** GPT-6 Sol High runs with an available Ponytail skill in Full mode for the **implementation agent only**, never a persistent injection into Qwen/Pi. Use Codex in-app browser to check UI. No automatic runner, no self-commits, no 0.12.7 change. Run each prompt only after inspecting and preserving the actual local checkout; GitHub `main` documentation may lag uncommitted product changes.

P3 does **not** purport to replace the original 15-prompt `c12-docs-workflow` specification. Advanced automatic document-reference delivery, Work context/freshness, large recovery matrices and full native closeout remain separately scoped. Do not promise all Docs management is GREEN in a single prompt.

## Non-negotiables

One existing ChatPanel and Pi loop. No special structured plan for ordinary discussion. Schema-2 Roadmap actions and linked Markdown remain authoritative; only approved reviewed action sets mutate them. Documentation apply is distinct and exact-source approved; no shell/Chat tool can silently publish canonical docs. Applied-only History and honest zero/partial effects. No new model calls in deterministic no-action paths. No source/approval/model safety regressions.

Prior source-bound Pi tool/Chat/Work tests remain historical evidence, not a blanket full C12 or Phase 12 GREEN. Installed-native Electron is still an owner-operated gap. The owner-selected standard local model for relevant live tests is `qwen3-coder-30b-a3b-instruct@q4_k_m` at 16,384 context/parallel 1 unless the actual runtime requires a recorded difference.
