> **2026-11-04 TOOL-LOOP FIX PROMPTS AUTHORED — NOT RUN:** For the current approved continuous Pi generation approach and next-Phase loading state, see [c12-rm-orch/fix](fix/README.md) and the sole runner-compatible [c12-rm-orch-fix prompts](../c12-rm-orch-fix/README.md). Historical P1–P7 prompts and P7 NOT GREEN remain unchanged. No implementation or new qualification by this note.

> **2026-11-04 CURRENT FORWARD GENERATION REFINEMENT — DOCS ONLY:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md) now specifies **one continuous, protected Pi tool execution** accepting serial `roadmap_phase` tool proposals rather than launching an independent inference execution per Phase. The tool must **validate and stage before reporting success**, and the live Roadmap canvas must immediately show each **staged/provisional** Phase with Gates/Criteria plus one subtle nonblocking `Generating next Phase…` placeholder. Only explicit owner Apply makes an element canonical/accepted. See [R1–R3 prospective correction](continuous-tool-loop/README.md). Historical P1–P6 checkpoints and P7 NOT GREEN remain immutable and must not be rerun/relabelled. No product change, new prompts, model trial or GREEN by this docs update.\n\n# c12-rm-orch — clean Roadmap orchestration replacement

**Owner authorization:** 2026-11-03, `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c12-rm-orch`. **Status:** architecture/assessment/plan/runner prompts authored; **NOT RUN or qualified**. Product reference: `0.12.7` (verify actual owner's local manifest before any run). **Authority:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md) · [Detailed contract](../../planning/p12/roadmap-phase-orchestration-contract.md) · [Assessment](prompt-assessment.md) · [Plan](implementation-plan.md).

## Purpose

Replace every obsolete greenfield Roadmap generation method with **one Dope-owned synchronized phase-by-phase controller**, using Qwen3.5-9B's proven bounded native edit capabilities. Sequentially request a Phase plus small nested Gate/Criteria operations, validate/stage each real result in one authoritative noncanonical proposal, and display the growing draft on the existing canvas. No whole-plan output format, model-driven orchestration, response parsing, RM1 grammar, two-pass conversion, old fallback or parallel writer. Human Apply remains mandatory.

## Explicit command entry

The **sole executable entry** to the Roadmap Generation Controller is a **trusted user-authored Chat submission** starting with the exact leading command `/gen-roadmap <roadmap prompt>`. Parse at the Chat command boundary **before any Pi inference**; after normalizing outer composer whitespace, require the exact `/gen-roadmap` token, a whitespace separator and a nonempty trimmed prompt (multiline body allowed). Strip the token before passing the body to the controller, retain trusted user-command provenance, and show usage with **zero controller/inference/stage/write calls** for missing body. Never scan quoted/code/prose content or model/tool output for executable commands. No intent classifier or natural-language routing, no automatic greenfield or Planning invocation, no `/roadmap` or `/roadmap generate` alias, no direct Generate Roadmap button, Work, injected tool/model text, old-format fallback or replay invocation. A retained UI affordance may only prefill the command for the user to submit. Normal Chat/Planning and ordinary `/roadmap` editing are unaffected. The command conveys requested intent, **not** permission to bypass Ask/Allow, project/source/revision/lease checks or final owner Apply.

## Superseded implementation routes

The following remain historical evidence, **not active generation implementation instructions or parallel stacks**: `c12-roadmap-sync`'s generation strategy; `c12-rmr-man`, `c12-rmr-man/fast`, `c12-map-markers` M1–M3 and its `two-pass` D1–D3; related F*/R* repair prompts and old output grammars. Do not rewrite old prompts/qualification or remove accepted Roadmaps. Keep ADR 0047's schema-2, canvas edit/decision and Markdown sync protections and ADR 0048's independent engineering qualification.

**Dirty source warning:** Prior D2 closeout reported nine locally modified/uncommitted files. Remote repository is NOT the owner's local checkout. Before P1 inspect exact local status/diff, identify D2 files and intended deletions, and safely reconcile them without reset/stash/clean. If safe reconciliation is impossible, STOP with explicit conflicts. This documentation branch has not inspected or changed the owner's local dirty tree.

## Runner stack — strict order

| Prompt | Mode | Owner and bounded exit |
| --- | --- | --- |
| [P1 — Retire legacy generators](P1-legacy-retirement.txt) | Runner | Exactly one `/gen-roadmap`-only fail-closed seam; all old executable generation routes, flags and exclusive tests deleted; intentionally fail-closed until new controller |
| [P2 — Controller runtime](P2-controller-state-machine.txt) | Runner | Bound serialized Phase calls, model/context/session identity, timeouts/cancel and no parallel generation |
| [P3 — Native Phase/Gate staging](P3-native-phase-staging.txt) | Runner | Actual phase-level validated typed staging under one existing proposal; no canonical write |
| [P4 — Live Roadmap projection](P4-live-canvas-progress.txt) | Runner | Incremental nonblocking server-validated staged Phase/Gate/Criteria updates in canvas |
| [P5 — Scope, completion and recovery](P5-completion-recovery.txt) | Runner | Bounded failure/retry/coverage ledger, review readiness, partial/cancel/stale safety |
| [P6 — Final consolidation](P6-integration-cleanup.txt) | Runner | Dead-path/code/import removal, existing authority regression suite, accurate measured instrumentation and clean command-only entry |
| [P7 — Connected browser closeout](P7-codex-browser-closeout.txt) | **Manual** | Exact-source selected-local-model Chrome dogfood; independent Electron owner gap; full no-write/Apply/Markdown proof |

**Existing runner grammar:** `P1`–`P7` contiguous with exactly one last `closeout`; each prompt identifies `Correction 12 / Pn`, `GPT-6 Sol High`, Browser required, and unchanged `0.12.7`. Only P1–P6 are implementation checkpoints. The runner owns successful commits; implementation agents do not self-commit. P7 must never be marked PASSED merely because P1–P6 committed.

## Commands — only when owner explicitly starts the runner

```bash
npm run codex:phase:validate -- c12-rm-orch
npm run codex:phase -- c12-rm-orch
```

Stop before manual P7. Follow current runner's safety and checkpoint behavior, not ADR 0048's future unimplemented receipt automation. Do not start the runner as part of docs writing.

## Universal restrictions

Inspect `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, local `git status --short`, current package version and source-owned Roadmap/Chat/Pi files before editing. No reset/stash/clean/force push, no running overlapping correction stacks, no silent provider/model/context/reasoning switch, no writing owner's real tower-defense workspace, no generic model filesystem authority, and no bypass of /roadmap/Ask/Allow/source hashes/revisions/leases/owner approval. Use disposable fixtures.

Target <=8 minutes per focused runner step (hard 15-minute stop): report Partial/NOT GREEN with exact blocker rather than fabricate completion. Source tests cannot claim live model, connected browser, or native Electron success. For every step report HEAD/diff, files, exact tests, observed transitions, no-write evidence, issues and explicit independent implementation/verification/progression outcomes. A failed safety prerequisite is STOP, not a conditional pass.

## End-to-end acceptance

One saved Chat request creates a project-bound generation session. **During local-model inference** the Roadmap canvas receives multiple genuine, sequentially validated provisional Phase/Gate changes (without focus hijack or UI backpressure). A full MVP tower-defense draft contains >=5 ordered Phases, each with Gates and observable Criteria covering fixed waypoints, enemy spawn/health, targeting/shooting and cooldown, waves, kills/currency/spend, persistent main-tower health and loss at zero. Owner can inspect and selectively Apply/Reject; no canonical Roadmap, linked Markdown or applied History writes before Apply. After Apply verify identity and source persistence/reload. Show true model thinking if provider exposes it, otherwise honest staged progress. Record time to first stage and total draft duration, calls/retries and confidence limits rather than promising a particular runtime. Strict P7 NOT GREEN/EVIDENCE GAP if unavailable.
