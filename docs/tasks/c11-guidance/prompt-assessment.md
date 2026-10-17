# /prompt-ass — c11-guidance

**Status:** OWNER-APPROVED DESIGN / PROMPTS AUTHORED / NOT RUN, NOT IMPLEMENTED OR QUALIFIED.
**Date:** 2026-10-16 (P8 handoff); **Mode:** Correction 11, **unchanged** coherent `0.11.8`.
**Scope:** UX-003 Dope-aware Chat guidance failure only. The [manual P8 source-bound closeout](../p11/known-issue-closeout.md) is historically **NOT GREEN**. Phase 11 remains OPEN; Phase 10 R6 is historically owner-closed only for approved scope.

## Evidence and actual source trace

P8 reproduced **"I linked the wrong Roadmap, how do I change it?"** failing with (a) no selected checkpoint: Q4 asks which application is intended despite current Dope workspace; (b) selected checkpoint: unvalidated non-JSON model output incorrectly suggests editing ROADMAP.md/Objective. The phrase **"How do I change the linked Roadmap file in Dope?"** succeeded with correct no-action help. The tool display appropriately said no write; old Markdown and index are not the immediate failure. See browser captures/hashes in P8 evidence. P8's exact source was product `8cad838` with subsequent manual `0.11.8` manifest transition; this result was later committed on main as `266720b` **without an independent new GUI replay**. The native Electron GUI and Codex parity remain unqualified.

At `packages/theia-extension/src/node/dope-capability-help.ts`, `selectDopeCapabilityHelp` requires token `file|document|source|link` for a Roadmap source-change request; the word **linked** fails the standalone `link` token check. The matcher therefore returns undefined for the exact phrase. `packages/theia-extension/src/node/chat-backend.ts` computes `helpTurn` and local `roadmapTurn` from this classifier, while `chat-context-composer.ts` recomputes classification and only supplies `helpContext` if matched. Without it, selected-checkpoint requests are grounded in Objective editing rather than UI navigation. `roadmap-local-model.ts` validates strict JSON no-action for help mode; do not relax validation or present unvalidated text as verified help. `test/unit/dope-capability-help.test.ts` checks availability and UI labels but lacks paraphrase/negative intent classification coverage.

## Smallest coherent work

| Prompt | Work / ownership | Tier | Model | Time |
| --- | --- | --- | --- | --- |
| P1 | Intent matching and positive/negative table-driven tests in capability-help owner | T1 | GPT-6 Sol Medium | <=8m target |
| P2 | ChatBackend + ChatContextComposer help routing/strict no-action cross-seam focused proof, minimal repair if necessary | T2 | GPT-6 Sol High | <=8m target |
| P3 | Manual browser/local Q4 exact-phrase and variant qualification, truthful scoped closeout | T3 manual | GPT-6 Sol High | manual; longer allowed |

**Dependency:** P1 → P2 → P3. P1 and P2 may run in the existing phase runner after deliberate owner Run (no /activate gate); P3 is separate manual browser-required closeout and does **not** auto-run. Exactly one closeout prompt. No new model/provider routing, no background work or changes to the Roadmap source replacement/store. Version stays `0.11.8` for *every* prompt; do not bump manifests. Agents do not self-commit; runner owns implementation commits.

## Scope boundaries and deferred evidence

Do not invent UI routes, force every Roadmap question into help mode, break checkpoint edits, mask invalid model responses as success, introduce another classifier model call, widen Chat into agent actions, allow hosted fallback or rewrite P8 Not Green history. Positive matches should cover wrong/linked/switch/relink/replace/source selection; negative matches include checkpoint Objective/title/status, normal Roadmap questions, Planning Map links, unrelated links and sync/refresh. P2 verifies both routing call sites agree; tests use current measured local context budget and project identity. P3 demonstrates real Q4 behavior in one saved Chat with/without selection and repetitions; it may close only scoped browser/local UX-003 after adequate direct evidence. Native GUI and consent-dependent hosted/Codex parity remain separately identified Evidence Gaps rather than being silently waived or called passed. Separate manual Usability Hunter remains not run; its first proposed target remains History → Work.

## Prompt efficiency gate

One owner per ordinary prompt. P1 source unit tests only; P2 only directly impacted context/backend tests, rebuilding changed extension output *only if tests import lib*, not routine full `npm run check`. P3 alone owns real browser/model evidence and any one necessary final candidate aggregate. No redundant tests, no new version, no heavyweight search framework. Estimates are not measured. No product-source mutation from authoring this stack.
