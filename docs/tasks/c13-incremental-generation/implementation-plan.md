# /prompt-plan — c13-incremental-generation

**Authority:** [ADR 0055](../../decisions/0055-incremental-proposal-generation.md), [technical contract](../../planning/p13/incremental-proposal-generation-contract.md), [assessment](prompt-assessment.md), `docs/workflow.md` and ADR 0054. **State:** prompt authoring only; not executed/qualified. Product version `0.13.11` must remain unchanged. R3B's original work and evidence stay unchanged, but its technical PASS/report is **not** an entry prerequisite for independent P1/P2 or shared noncanonical staging. Inspect real delivered interfaces at their dependent P3/P5 boundaries; deny unsafe publication without holding unrelated implementation.

## Architectural plan

```text
fresh protected /docs-review or /prompt-write <folder> (saved Chat, project/owner lease)
              |
       existing selected Pi tool loop / bounded broker reads
              |
     Dope-owned incremental staging controller (ONE lifecycle owner)
      | status / stage document / stage prompt / proposal_finish
      | validates source, sequence, chunk hash, size, audit, idempotence
      v
  durable noncanonical staged bytes + compact per-file progress receipts
      |
  finish validates complete request and independently assembles exact proposal
      |-- Docs proposal -> existing Docs Accept/Reject/Revise + applied-only History
      |-- Prompt Stack -> R3B saved proposal + distinct guarded publisher
      v
  natural finalMessage above ONE native review card; readonly tabs/Open All
      |
    explicit Accept -> existing domain-specific guarded publisher only
```

Stage tools are **not** unrestricted filesystem commands. Model output is small typed arguments; complete proposal bytes and digests are owned by Dope. The shared controller is reusable; Docs/prompt validation and publication remain separate.

## Source-based implementation order

**P1 — Shared controller and Pi staging tool integration (T1).** Inspect `chat-backend.ts`, actual Pi project tool contract, ChatRepository and lease lifecycle, current event/continuation handling, saved proposal models, project/worktree identity. Add the smallest generic durable staging session with begin from trusted bound skill (not model), monotonic staged operations, per-tool bounded payloads, idempotent receipts/status, cancellation/restart, source/owner checks and finish sealing protocol with required text field. Domain handlers initially plugged in via typed interface; do not change Docs or Prompt generation or UI. Keep candidate bytes noncanonical. Test session state machine, replays, wrong project, malformed tool calls, budgets, abort and no project writes. Build only changed dependency packages.

**P2 — Incremental Docs adapter (T1).** Reuse `documentation-discovery.ts`, exact source pages, `documentation-review.ts`, `documentation-skill-review.ts` and guarded `documentation-application.ts`. Replace the model's monolithic final changes JSON contract for the **protected** skill with successive `proposal_stage_document` calls: anchored short replacements for existing source, bounded new-file chunks. Backend materializes full candidate and checks required create/update coverage at `proposal_finish`, then creates the existing typed pending Docs proposal and real tabs/card state. Keep revision old-candidate retention and unchanged applied-only History. Focused Docs skill/backend and application tests; no browser.

**P3 — Incremental Prompt adapter (T1).** Reuse protected `/prompt-ass`/`/prompt-plan` source IDs, `prompt-authoring-stage.ts`, `phase-stack-composer.ts`, `phase-stack discovery/validator`, and actual delivered R3B proposal owner. Stage one prompt/work step or bounded section per tool; use deterministic composer for stable grammar/boilerplate. Remove `finishedPromptStack`'s four-work-item generation cap as a forward default without deleting historical tests; use explicit measured per-file/total/call budgets. Enforce ordered contiguous P1–Pn and one final manual closeout; format includes assessment/plan/manifest and source/role/version binding. Seal into existing R3B review proposal, **not** a second publisher. Prompt composition and saved draft tests. No Work grant/Run.

**P4 — Native progress and finalMessage (T1 UI).** Connect shared controller receipts/events to existing saved Chat activity and native Theia read-only proposal resources, with clear incomplete state, file-level progress and actionable failure. Render `finalMessage` **as sanitized ordinary prose immediately above one proposal card only after verified finish**, exactly once across stream/reload/retry. Keep card Accept disabled on provisional state; preserve same Docs and prompt React/DOM/Monaco controls, Open All and theme tokens. Do not reintroduce the removed Documents view or make provisional files writable. Focused `chat-panel` and proposal-tab tests; defer human visual qualification to P6.

**P5 — Cross-domain integration/safety (T2).** Run deterministic fixtures for both skills through actual tool entry, multiple stages and finish; include 10+ substantial prompt files, long/multiple Docs edits, source-backed late-page changes and real publisher adapters in **test mode**. Verify replay/out-of-order, cancel/restart, wrong project, stale basis, change collisions, symlink/traversal, failed revision retention, loop limits, partial finish, idempotence and no canonical file/Work/History/Gate side effects before Accept. Verify actual approved Docs application and approved prompt publication only under explicit simulated owner decisions. Resolve only scoped integration defects; no broad GUI or unrelated feature work. Focused T2 suite with minimal changed-workspace builds.

**P6 — Manual connected browser qualification (T3).** After runner stops and owner begins manual task, use a disposable small repo and real selected GPT-OSS 20B. Invoke `/docs-review` for multi-file/long edits and `/prompt-ass -> /prompt-plan -> /prompt-write c13-incremental-generation` (or a distinct unused fixture stack folder) with 10+ substantial prompts. Observe per-file progress, terminal prose above single card, exact read-only source/diff, Open All, Accept/Reject/Revise, reload and source/owner negative paths. Show no canonical writes until approval and no Work Run/qualification through proposal actions. Capture runtime SHA/bundle, timings, model calls/context/outputs where available; record actual PASS/FAIL/BLOCKED/EVIDENCE GAP without inventing Electron parity. Up to three narrow fix/retest cycles; make no version change.

## Test/build precision and runner contract

Use repository `scripts/codex-phase-core.mjs` grammar exactly: `Correction 13 / Pn — ...`, one `- Recommended configuration: `GPT-6 Sol ...`.`, one `- Browser required: no.` except P6 `yes.`, one `- Required unchanged project version: `0.13.11`.`, and one final P6 closeout. Runner stops after P5; P6 is manually invoked. Existing tests include `test/unit/documentation-skill-review.test.ts`, `documentation-skill-backend.test.ts`, `documentation-review.test.ts`, `documentation-application.test.ts`, `prompt-authoring-stage.test.ts`, `phase-stack-composer.test.ts`, `chat-backend.test.ts`, `pi-conversation-runtime.test.ts`, `native-doc-editor-proposal.test.ts` and `chat-panel.test.ts`. Determine exact import ownership and compiled `lib` paths before each run; `npm run build --workspace @dope/theia-extension` only when its output must be fresh, build `@dope/chat`/`@dope/agent-core` first only if changed. Favor direct `node --test --experimental-strip-types <narrow tests>`; verify current Node scripts locally. Do not run aggregate `npm run check` or package Electron per prompt.

**Prompt Efficiency Gate:** each P1–P4 has one primary boundary and focused tests; P5 is the only shared T2 integration; P6 is the only browser T3. The full controller/skill work is nontrivial and may need narrowly justified scope beyond an eight-minute typical implementation+test target; require Codex to stop with an evidence-based BLOCKED/PARTIAL instead of skipping security/tests to fit a timer. UI theme/usability covered by existing semantic tokens and P6 human test; do not repeat full UX requirements in backend tasks.

## Source, failure, and exit discipline

Before P1, inspect ACTUAL owner checkout, `git status`, available R3B source/status (including non-GREEN or missing report), real code/compiled modules and exact `package.json` version; do not infer these from the authoring baseline or overwrite R3B. **Do not STOP P1 merely for missing/non-GREEN R3B qualification**: P1 has no publisher dependency. Stop for dangerous dirty-tree, source/lease or broker authority conflicts. At P3/P5, inspect the actual distinct publisher and fail closed only on a missing/unsafe integration interface. Preserve truthful historical status and all owner work. Do not reset/stash/clean, do not rewrite running/completed prompt snapshots. Prompt authoring creates no product code/Run/Green.

Runner preflight: `npm run codex:phase:validate -- c13-incremental-generation`. Later, after explicit owner Run authorization and safe entry: `npm run codex:phase -- c13-incremental-generation` (no `--closeout`). Stop-on-failure, source-tested commits/report for each checkpoint and no version bump. Run **P6 manually** with connected Codex browser only after P1–P5 evidence and owner review. Resume P13 R3/R2/R4 only after separate owner disposition of P6 and reconciliation against actual implemented interfaces, not by auto-awarding Green.
