# P4 headless Assessment → Plan → Prompt Write integration

**Date:** 2026-11-10. **Verdict:** **PARTIAL / NOT GREEN** for the complete P4 contract. The checked one-work-step worker-to-publisher path and the separate ten-work-step bounded stack pass. A reviewed, owner-facing revision of an existing Assessment wireframe is still absent, so the requested cross-stage revision lifecycle is not qualified. **BLOCKED:** no external service or test runner blocker. This is headless evidence only; P5 has not run.

## Source basis and preparation

- Entry HEAD: `a2e4d859177a31a0430d47a3404f481276a30efc` (`p3`), clean worktree, product version `0.13.11`. P1 `bf375e5a` and P2 `8f770b6f` precede this HEAD. No owner edits were present at entry. Historical P12/R1–R9 evidence was left intact.
- Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, the named-chain contract, and this correction's assessment and plan. Inspected the committed P1 wireframe/worker/store changes, P2 checked Plan validator and broker, and P3 incremental composer/publisher changes and their targeted tests. Their checkpoint labels were not used as proof.
- Rebuilt compiled imports in dependency order: `corepack yarn workspace @dope/agent-core build`, `corepack yarn workspace @dope/chat build`, `corepack yarn workspace @dope/theia-extension build` — all **PASS**. `packages/pi-runtime/worker.mjs` is source JavaScript and needed no build.
- P4 changed only `test/unit/prompt-chain-headless.test.ts` (new integration fixture), `test/unit/pi-runtime.test.mjs` (retired exhaustive schema assertion replaced with the wireframe schema), and this report. No production source, manifest, dependency, lockfile, or version changed. No reset, stash, clean, commit, Work Run, browser run, or Roadmap award occurred.

## Positive receipts

The new disposable Git project contains tracked `src/clamp.js`, `test/clamp.test.js`, and a `0.13.11` package file. A deterministic OpenAI-compatible streaming endpoint directs the **actual bundled Pi worker** through the **actual ChatBackend protected broker**, saved Chat and `PromptDraftStore`, incremental Prompt Stack composer, and guarded `ChatBackend.publishPromptStack`/native publisher. The endpoint scripts tool choices; it does not establish live-model reliability.

| Boundary | Observed result |
| --- | --- |
| Assessment | `/prompt-ass clamp-api-correction ...` submitted one bounded `wireframe` and `assessment_finish`; zero source reads, no five-file coverage or tier packet. Saved revision 1 has count **1**, `step-1`, and no source refs. Reloaded Chat projects the next state as **Plan**. |
| Plan | The selected Assessment chip bound the same draft, message, revision, project, source fingerprint and lease. The worker made brokered `read_file` calls for `src/clamp.js` and `test/clamp.test.js`; the Plan quote was checked against actual `src/clamp.js` bytes. The saved Plan dependency hash equals the Assessment content hash. It preserves `step-1`, its boundary, T1, relevant working set/test, separate T3 closeout and ten efficiency checks. Reloaded Chat projects **Prompt Write**. A one-step task did not acquire fabricated T2 work. |
| Prompt Write | The selected Plan chip staged `step-1`, then one manual closeout, then one `proposal_finish`. Protected call order was `assessment_stage`, `assessment_finish`, two `read_file` calls, two `proposal_stage_prompt` calls, `proposal_finish`. The checked proposal contains five files in `docs/tasks/clamp-api-correction/`: `prompt-assessment.md`, `implementation-plan.md`, `README.md`, `P1-validate-scalar-clamp.txt`, `P2-manual-clamp-closeout.txt`. The work file retains `step-1`; the closeout says `Browser required: yes`. |
| Guarded Accept | The canonical folder was absent before approval. Wrong digest was refused. Explicit `publishPromptStack` with the saved digest returned `published` for five paths; every published byte equals the saved proposal byte. Work discovery sees two prompt files and `executable=false`; no Work Run or grant occurred. |

The final standalone worker fixture run passed **1/1** in 6.81 s. Its disposable proposal digest was `865f08e2cd99f05b0183743e133b1fbc5d6631a98bd0a2c5d0f2319d9d2c16f6`; the digest is fixture-specific because Chat/proposal IDs change between runs. The saved proposal's own digest and per-file bytes were the publication authority.

Separately, `incremental-prompt-stack.test.ts` stages substantial `step-1` through `step-10` in bounded chunks plus a distinct terminal manual **P11**. It checks 14 total files (three supporting docs and eleven prompts), contiguous runner numbering, exact per-file hashes, no preapproval folder, phase-stack import, native publication, and Work discovery without an executable grant. `prompt-authoring-stage.test.ts` validates one-, three-, and ten-step Plans against exact wireframe IDs, boundaries, source-backed work, and efficiency. The ten-step case uses controlled stage/Plan fixtures, not a second real-worker Assessment journey.

## Negative coverage and limits

| Case | Evidence |
| --- | --- |
| Missing/forged/foreign chip, project, owner lease, alternate folder, stale stage revision, source drift, wrong digest | Rejected in the real-worker/ChatBackend disposable chain before protected stage or publication. The source change was restored only inside that disposable project. |
| Malformed count/IDs/order/dependency, unsupported claims, missing Plan read, UI/ADR applicability and ten gates | Focused wireframe/Plan validator tests reject these. The Plan validator requires brokered evidence for factual file claims. |
| Cancellation, repeated/stale stages, partial finish, prior-candidate preservation, collision, symlink, foreign project, changed bytes and interrupted publication | Focused controller, incremental stack, draft-store and publisher tests reject these. The ten-step fixture also confirms duplicate stage idempotence and incomplete-stack refusal. |
| Quote-only slash mention | `prompt-authoring-stage.test.ts` verifies quoted or nonleading `/prompt-ass` and nonleading `/prompt-write` remain ordinary Chat policy. |
| Saved draft reload | The real-worker fixture reopens the Chat repository after Assessment and Plan; projections remain Plan-ready and Write-ready respectively. Blocked-state recovery is covered in focused saved-state tests, not this one chain. |
| Card/chip click | Source inspection shows `preparePromptDraft` only fills composer text and a bound chip; the backend requires a submitted selected chip. No native click was exercised in P4; P5 owns live interaction evidence. |

**Material gap:** `PromptDraftStore.stage('assessment')` can atomically replace a wireframe and invalidate the stored Plan, and a replacement Plan can make prior Prompt Stack proposals stale. The owner-facing new `/prompt-ass` route instead calls `assertPromptDraftNameAvailable` for the same slug, while the card exposes only Plan and Write prefill. There is no reviewed same-draft Assessment redivision path to exercise end to end. Store-level invalidation and proposal staleness are narrower evidence than the requested owner revision lifecycle; previous checked candidates may remain historical, but this P4 cannot claim the complete revision scenario passed. This is a precise P2 dependency, not a reason to restore exhaustive Assessment or bypass the name/identity guard.

## Validation matrix

One consolidated affected matrix ran `node --test --test-concurrency=1 --experimental-strip-types` over `protected-assessment-worker`, `prompt-draft-store`, `prompt-authoring-stage`, `chat-backend`, `pi-runtime`, `incremental-proposal-controller`, `incremental-prompt-stack`, `planning-stack-publication`, `chat-presentation`, `native-doc-editor-modes`, `native-doc-editor-proposal`, and the new `prompt-chain-headless` suites: **166 tests, 166 pass, 0 fail**, 56.69 s. The first matrix exposed an obsolete Pi tool-schema assertion; it was corrected to assert the committed wireframe contract, then the same matrix passed. After adding repository-reload assertions to the new fixture, that fixture passed alone **1/1**. `git diff --check` passed. No aggregate test sweep, Electron package, or browser campaign was run.

**Classification:** Core one-step chain **PASS**; ten-step bounded stage/publisher scale **PASS**; full revision and native click coverage **PARTIAL**; complete P4 contract **NOT GREEN**; external blocking condition **none**. P5 remains unstarted, and there is no live-model, native UI, Work, Gate, or Phase qualification from this report.
