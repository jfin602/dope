# /prompt-ass — c10-roadmap-qualify

**Status:** SOURCE-ASSESSED / DOCUMENTATION-APPROVED / READY FOR DIRECT RUN; NOT IMPLEMENTED OR QUALIFIED
**Date:** 2026-10-13 (America/Chicago)
**Entry:** P19 `c10-roadmap-create-sync` tested product source `71d91efb3668e57816bb031f82ab309acea17cfc`, evidence-only commit `c620bc0a3be714b7dc329dc5c872a064b1f8003a`, package `0.10.16`. Exact aggregate **671/671 and browser/Electron builds PASS**, but P19 **NOT GREEN**. P16 predecessor NOT GREEN. Actual local Git/worktree status was not independently observed during prompt authoring.
**Authority:** ADR 0036 including 2026-10-13 compact-intent and supported-field amendment, current ADR 0016, ADR 0025/28/29, ADR 0037, `docs/planning/p10/phase-10-plan.md`, `docs/workflow.md`, `BOOT.md`, `AGENTS.md`, P19 closeout.
**Correction:** `c10-roadmap-qualify`, Correction 10, all prompts target **unchanged `0.10.16`**.

## Source/evidence reality

- Real local Qwen `qwen3-coder-30b-a3b-instruct@q3_k_l`, 4,096 measured total tokens, completed two turns. First lacked nested action type; second supplied `type: edit` for linked Markdown, which Dope correctly rejected as needing `document-edit`. No accepted preview, human approval, durable model change or fresh NEXT turn. `chat-context-composer.ts` already says `document-edit`, so generic instruction reiteration alone cannot solve this.
- `packages/theia-extension/src/node/roadmap-local-model.ts` `localPlanningJson` currently shape-checks outer proposal without rigorously checking the nested action before accepting a completed local response. Its observed 4,096 hard cap and conservative byte-based budget can reject requests even when a larger local model is loaded; `chat-backend.ts` uses the existing Chat lease/proposal/approval service.
- `packages/project-intelligence/src/node/roadmap-document-patch.ts` only patches supported unambiguous `Objective:`, `Order:`, `Prose:` labels. Dope's own longform `docs/roadmap/mvp-roadmap.md` phase sections have no such `Objective:` mapping; even correct `document-edit` JSON cannot guarantee an edit there. An eligibility/capability check, and a positive editable fixture, are required. No arbitrary narrative rewrite.
- P18 integration explicitly observed `relink-needed` on moved source without a relink action; `roadmap-document-sync.ts` and `roadmap-store.ts` have conflict/pending-sync machinery with fault injection tests, but live relink/conflict/crash is not qualified. The linked source watcher and UI currently detect external changes and present explicit **Apply source changes** rather than silently applying them. P19 observed an external heading edit and accepted sync, **not** a live Codex CLI → Dope → Codex handoff.
- `roadmap-greenfield.ts` has approved previews, new file creation and draft Chat binding; the P19 browser only saw Create Manually and Plan with Chat, not a completed accepted greenfield. `chat-panel-controller.ts` had a one-off lease/restart problem; root cause is unproven.
- React Flow map, source-backed c10 P1–P19 nodes, exact P19 file double-click and phase gate truth were observed. Fit/mouse/touch/pinch/Arrange/keyboard, Chat left/right/bottom/center, prompt malicious cases, light theme and native Electron GUI were not exercised on this exact candidate. P19's loopback backend connect trace does not prove whole-app egress.

## Recommended bounded sequence

| Prompt | One coherent task | Tier | Model | Rule |
| --- | --- | --- | --- | --- |
| P1 | Source-aware, compact local planning intent contract, nested strict validation and editable-field capabilities | T2 | GPT-6 Sol High | No direct model write |
| P2 | Adaptive verified-capacity context/output budgeting (16K/32K/64K) and NEXT-turn freshness | T2 | GPT-6 Sol High | No hosted fallback or fixed 4K cap |
| P3 | Explicit secure moved-document relink | T2 | GPT-6 Sol High | No overwrite/dual source |
| P4 | Focused conflict/pending-sync/crash reproduction, narrow evidence-backed repair | T2 | GPT-6 Sol High | Do not invent defects |
| P5 | Greenfield manual and existing-Chat UI completion / narrow repair | T2 | GPT-6 Sol High | No second Chat |
| P6 | Reproduce saved Chat lease/restart/stream issue and guard or repair narrowly | T2 | GPT-6 Sol High | No parallel lease owner |
| P7 | Focused canvas/gesture/accessibility/editor navigation regressions | T1 | GPT-6 Sol Medium | No broad UI redesign |
| P8 | Cross-owner/adversarial and shared-local-Markdown round-trip integration gate | T2 | GPT-6 Sol High | No aggregate |
| P9 | **Sole manual T3: live Codex↔Dope handoff, 16K/32K/64K and full closeout** | T3 | GPT-6 Sol High | Final exact source |

P1 before P2 because context/intent agree on allowed operations. P3/P4 are owner-file integrity before wide UI acceptance. P5/P6/P7 are reproduction-first: **Evidence Gap is not proof of a source bug**. P8 integrates all including the shared-file fixture; P9 alone qualifies actual Codex↔Dope live handoff, chooses the best measured 16K/32K/64K profile or records an unresolved decision, and runs the final check. Do not preselect a default in P2; retain 4K only as optional narrow stress.

## Codex ↔ Dope qualification boundary

External editing is source-file interoperability, **not** a new Codex adapter or automatic background merge. One accepted Markdown file is shared in the same checkout; different checkouts need Git exchange. The supported title/Objective/Order/Prose fields round-trip after explicit review; the `.dope/` graph/identity/layout and historic qualification status do not become Markdown-owned. P8 covers file-driven simulated external edit → detected preview → explicit apply → Dope approved patch → fresh file read, including repeated edits/restart, ambiguous/moved/conflicting/stale denial and unchanged unsupported bytes. P9 must independently use **actual Codex CLI and Dope UI** on one checkout, verify the fresh Codex read and restart and record hashes/revisions/stable IDs. Synthetic tests are insufficient for live Green; no silent auto-apply, duplicate checkpoint, second synchronization service, or new prompt.

## Mandatory P9 qualification instrumentation

The final **P9 T3** operator must demonstrate a controllable/capturable native Electron window (not just a process or build), browser inputs and keyboard/touch-equivalent gestures, and browser/backend/renderer/Electron/child-process/network observation during successful local inference. Record methods, OS environment and limits. Missing capabilities block the relevant Green claim, **not** P1–P8 source implementation. Keep the actual live gates unchanged.

## Adaptive-context qualification questions

- Compare verified **16,384 / 32,768 / 65,536** loaded tokens using the same Qwen model, quantization and comparable runtime/offload settings; do not infer loaded context from model name. When a profile cannot be loaded or measured, record the limitation rather than asserting equivalence.
- Compare simple approved edits, Phase-10-sized multi-checkpoint comprehension, post-approval next-turn freshness, extended Chat continuity, invalid/stale denial, response/first-token latency, actual or estimated usage, RAM/memory pressure and repeated-run stability.
- P2 implements capability-derived budgets and separate output-token/JSON-byte limits with an optional 4K stress regression. P9 decides on evidence: **smallest reliably sufficient** profile, 64K only for material gains over 32K; absent comparative proof means **default not yet determined**.

## Preserved behavior and non-goals

- Do not modify historical `docs/tasks/p10/closeout.md` or `docs/tasks/c10-roadmap-create-sync/closeout.md`, their original source SHAs, P1–P19 files or evidence.
- Current `0.10.16` version, 13 manifests, 20 pins, yarn.lock and root package-lock absence stay unchanged; no unrelated dirty-tree reset/clean/discard and no overlapping mutating runner.
- Existing saved ChatPanel in all four docks; ProjectPlanningActions is the only planning mutation authority; separate Work/AgentTask/candidate gates. No new Chat, no model shell/Git/MCP/fs tools, no hidden hosted egress.
- Linked Markdown owns supported mapped text, `.dope` owns IDs/basis/sync/projections; unknown/unsupported content is read-only unless developer-approved structural conversion is explicitly previewed. No AI repair of docs and no false source/runner derived Green.
- Original Phase 10 P16 and correction P19 are historical NOT GREEN; Phase 10 not owner-closed, Phase 11 Human-Centered UI and Phase 12 alignment inactive.

## Efficiency gate

Eight ordinary narrow implementation/integration tasks (target <=8 minutes, 10 soft / 15 hard); source-aware safety and T2 integration may justify limited extra, but no habitual `npm run check`. P9 manual T3 is exempt and must contain hard stopping gates. Focused tests use actual existing `test/unit/roadmap-*.test.ts` and directly affected Chat/Store/Map suites; tests importing compiled `@dope/*/lib` need only changed package output rebuilt in dependency order, not `npm run build:extension` for every prompt. Register new tests in root `test:product` once. Final `npm run check` includes typecheck, tests, browser/Electron builds; run once per final candidate after changes. Runner validator must be executed locally after writing stack; static consistency alone is not runtime validation.

**Grammar:** `P1`–`P9` contiguous; `TASK: Correction 10 / P<n> — <title>`; fixed unchanged version metadata in each; one sole final `P9-...-closeout.txt` with closeout also in TASK title and Browser required yes. All P1–P8 browser no. This document authors prompts but does **not** execute the correction; selecting the stack to run needs no separate activation.
