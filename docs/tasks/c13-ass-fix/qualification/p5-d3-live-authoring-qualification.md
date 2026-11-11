# P5-D3 — independent live authoring qualification

**Final verdict: NOT GREEN (2026-11-10, 18:08:48–18:12:11 CST live journey).** The owner loaded the required model after the earlier blocked preflight below. On the same committed D2 source, one fresh real-model Assessment sealed and its checked Planning handoff worked. Planning failed without an accepted step or `plan_finish`; Prompt Write and proposal review were therefore not run. The first material failing boundary is `PLAN_UNSUPPORTED_SOURCE: Read each working file and validation target in this Plan turn`. No automatic retry or repair followed.

## Resumed exact-source and model lock

- Product HEAD remained `00222cb386fad4b72ffa93c954fce3af60ee50ac`; only this untracked D3 qualification report existed in the product worktree. Product version remained `0.13.11`. The successful `npm run build:browser` and compiled hashes recorded in the earlier preflight section below remained byte-identical at resume. Backend `apps/browser/lib/backend/main.js` SHA-256: `c9ac91a99afe83ed81d1e78d66dbd96f8b1d244238639d49593dc52e9d358833`; worker: `50e577d568e6f7a8c25cd0ce454d245521a1a1fcb1c967fc78f26a1b9d470bc3`. The backend started from the fixture, listened at `127.0.0.1:3085`, and deployed 94 accepted plugins. Served `/bundle.js` SHA-256 `e5dd7d1adc9e4b1270bea131543df8995a3fe004ed6c2466dcfdc15bd7fb1b3f` matched the compiled frontend exactly. The connected Codex in-app browser opened `http://127.0.0.1:3085/#/tmp/dope-c13-p5-d3-9RumP6` and displayed that project. No stale tab or output was used.
- LM Studio `/api/v1/models` now showed one **loaded** `openai/gpt-oss-20b` MXFP4 instance with context length 16,384, parallelism 1 and selected variant `openai/gpt-oss-20b@mxfp4`. AI Center's existing LM Studio connection became **ready · 1 usable model** after Refresh Models; no configuration was edited. The Chat picker explicitly selected `LM Studio · openai/gpt-oss-20b` for both turns. Saved executions confirmed connection `21d03643-2aca-407e-b090-af59979b6c2f` and actual local `openai/gpt-oss-20b` for both. Chat settings showed Managed context, generation limit Ask each time and Commands Ask. LM Studio's request log showed outgoing `reasoning_effort: low`, `temperature: 1`, `top_p: 1`; these are requested values, not measured engine-effective values. No model, context, parallelism, sampling, reasoning or policy setting was changed.
- Resource preflight after loading: 30 GiB RAM total, 11 GiB available; no swap; root filesystem 147 GiB total, 3.5 GiB available, 98% used. No resource termination was observed.

## Fresh disposable fixture

Project: `/tmp/dope-c13-p5-d3-9RumP6`. Baseline Git HEAD `a3063029d80692abae7f73db74b20c0d17ad9fbc`, initially tracked-clean, package version `0.1.0`, baseline `npm test` **2/2 PASS**. `.dope` and `docs/tasks/slug-separators-d3` were absent before the Chat. These original UTF-8 files ended with newlines and matched the historical small slug-helper fixture byte for byte:

`package.json` — SHA-256 `84b4497290f391ecb0c41352fcdc569721d44a7b5ce109650c7b7df8e29c7c5f`

```json
{
  "name": "label-slug-fixture",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

`src/labels.js` — SHA-256 `65291ec53aeb7848d3442a917ea2ea0fbd605377b8c4e8875c6971446f0f017d`

```js
export function toSlug(label) {
  if (typeof label !== 'string') {
    throw new TypeError('label must be a string');
  }
  return label.trim().toLowerCase().replace(/\s+/g, '-');
}
```

`test/labels.test.js` — SHA-256 `885b65ec26309ab94471b346b64a4cfd026df868e405c4a41ae6962ddd781f5f`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlug } from '../src/labels.js';

test('converts words to a lowercase slug', () => {
  assert.equal(toSlug('Blue Chair'), 'blue-chair');
  assert.equal(toSlug('  Oak Table  '), 'oak-table');
});

test('rejects non-string input', () => {
  assert.throws(() => toSlug(null), TypeError);
});
```

`docs/slug-format.md` — SHA-256 `3618c4f7bf823affc1d93943cda6765da73eb82a6b19fd58ecdc54e3763b24b2`

```md
# Slug format

The public `toSlug(label)` helper trims a label, lowercases it, and joins whitespace-separated words with hyphens. Callers use the returned string as a URL segment. Non-string input throws TypeError.

The current implementation leaves repeated literal hyphens and surrounding punctuation untouched. A correction should make separator handling predictable while preserving the exported function name and existing word conversion.
```

## One live journey and first failing boundary

1. At 18:08:48 CST, submitted exactly one trusted native command: `/prompt-ass slug-separators-d3 Correct the toSlug helper so repeated spaces and hyphens become one separator, remove leading and trailing separators, preserve non-string behavior, update tests and documentation, and prepare a small executable Prompt Stack with a separate manual closeout.` Saved Chat ID `b6e3ee65-62f1-4660-a30a-92bc14cb935d`; user message `76c1657d-2adb-435f-a248-5204a4dbeaf2`; assistant message `49a50d57-0d67-4694-962f-23922a827bb5`; execution `aa01f531-5203-464a-983a-63eeda4cf4d8`; draft ID `8170e5d6-0e98-44e8-89ff-24f89458dee0`. The draft pinned the fixture HEAD and `0.1.0` version.
2. The saved broker sequence was **`assessment_stage` completed, `assessment_finish` completed**. The stage receipt classified `ASSESSMENT_ACCEPTED`; there were no brokered source reads, no source claims and no rejected Assessment submission. The accepted model payload used the reduced work-array interface; the saved canonical wireframe contains Dope-derived `count: 1`, `step-1`, `dependsOn: []`, revision 1 and content hash `907b3dfa38e2ce20dc64ffc4944252d42ae25c862be3ab8a10d298ab2d8a8054`. Explicit dependency conversion and live rejection recovery were **NOT EXERCISED**. The saved record and card matched: objective “Clarify the requested behavior”; rationale “One bounded task covers the change”; work title “Clarify behavior”, objective “Define the behavior”, boundary “Behavioral contract”; separate “Manual closeout — Check the result; Independent human review.” This wireframe is mechanically sealed but generic: it does not name the requested separator behavior, tests or documentation in its task boundary. Assessment protocol: **PASS**; substantive task division: **PARTIAL**. Provider-reported Assessment usage: 4,729 input, 181 output, 4,910 total tokens, including 68 reasoning tokens; saved context estimate 439/8,192.
3. The Draft card showed **Assessment ready · Plan next** and `/prompt-plan`. Clicking it prefilled `/prompt-plan`, attached the trusted `slug-separators-d3 · Assessment` chip, kept the same draft and revision, and did not auto-submit. At 18:09:44 CST, submitted one Planning turn asking for a complete source-grounded Plan and reads of helper, tests, documentation and package configuration. Planning user message `46db041f-49f1-4979-93aa-3eb6dbd0c3c8`; assistant `c5ce8d5b-5143-4f31-ab07-40786f68c422`; execution `f84ba054-82f8-4838-8884-628e7e23167a`. The same explicit GPT-OSS model was used.
4. The saved Planning broker sequence had 16 events in order: `list_files` completed, failed, completed; `read_file src/labels.js` completed; `list_files` failed; `search_paths` failed; `list_files` failed; `search_paths` denied with `AUTHORITY_DENIED`; `read_file test/labels.test.js` completed; `read_file package.json` completed; `plan_stage_step` failed; `read_file src/labels.js` completed; `read_file test/labels.test.js` completed; `plan_stage_step` failed; `plan_status` completed; `plan_stage_step` failed. The three unique successful file reads matched the original fixture hashes. `docs/slug-format.md` was **not** broker-read. Directory search failures were recoverable enough for the model to read known file paths, but its source coverage remained incomplete. No accepted `plan_stage_step`, `plan_stage_closeout`, `plan_stage_efficiency` or `plan_finish` event occurred. The model's displayed table and text claiming an accepted step, closeout and ten gates were untrusted provisional content, not receipts; its ten `plan_stage_efficiency(...)` lines were prose in a code block, not broker calls.
5. The saved Planning execution ended **failed** at 18:12:11 CST with `PLAN_UNSUPPORTED_SOURCE: PLAN_UNSUPPORTED_SOURCE: Read each working file and validation target in this Plan turn`; the real Chat card displayed that block. The code checks that every proposed working-set path and at least one validation target path had a brokered read. The exact protected stage arguments and individual tool-result bodies are not saved in the public event projection, so which submitted path first failed is **UNKNOWN**. The provisional text visibly named `node:test` as a validation target and omitted the documentation file; that is suggestive, not proof of the precise rejected argument. No partial Plan step was accepted. The draft retained only Assessment revision 1; it has no `plan`, `partialPlan` or Prompt Stack Proposal. Planning provider aggregate token usage is **UNKNOWN**; saved context estimate 443/8,192. Planning duration was 2m26s.

## Downstream, reload and authority

| Check | D3 result |
| --- | --- |
| Assessment sealed and saved/card match | **PASS for protocol**, **PARTIAL for task-specific substance**, as above. |
| Checked Planning prefill, chip and no auto-send | **PASS.** |
| Source-grounded incremental Plan, accepted work step, ten efficiency findings, separate T3 closeout, `plan_finish`, current PlanRecord | **NOT GREEN.** Three rejected step calls, no accepted step or finish. |
| Checked `/prompt-write` handoff, incremental proposal, `proposal_finish`, generated files/digest and native review | **NOT EXERCISED.** No Plan seal unlocked these actions. |
| Owner Accept, guarded publication, Work discovery | **NOT EXERCISED.** No proposal or explicit approval existed. |
| Reload and saved authority | **PASS for reached state.** Browser reload retained the completed Assessment, its one work prompt and the blocked Planning card. No Plan or duplicate proposal appeared. The next-turn model picker returned to Follow Interactive, while saved executions retained the selected/actual GPT-OSS identity. |
| No canonical/source/Work/Roadmap effects | **PASS for this stopped attempt.** Original four fixture hashes still match baseline, fixture Git status contains only untracked `.dope/` evidence, and `docs/tasks/slug-separators-d3` is absent. No Work Run/grant, Roadmap Gate/Phase award, product source change, version advance or self-commit occurred. |
| Keyboard, focus, narrow pane, hostile/stale controls and Electron parity | **NOT EXERCISED** beyond ordinary Chat focus and reload. Browser observations do not establish native Electron parity. |

The D3 live result is **Assessment protocol PASS, Planning NOT GREEN, Prompt Write NOT EXERCISED, overall NOT GREEN**. The model did not complete the source-read/validation-target rule and then described nonexistent accepted stages in prose. This is a real-model Planning failure on exact D2 source, not a D2 Assessment argument-rejection recurrence. The historical P5, P5-Q1, P5-D1 and P5-D2 records remain unchanged. The stopped fixture and Chat are preserved for read-only diagnosis. No D4, Q2, repair cycle or duplicate hidden authoring command was started.

## Earlier blocked preflight (preserved)

**Date:** 2026-11-10, preflight closed at 18:05 CST. **Verdict: BLOCKED before live inference.** The required `openai/gpt-oss-20b` MXFP4 model was present in LM Studio's catalog but had `loaded_instances: []` on both preflight reads. The D3 instruction requires a loaded instance and says to stop BLOCKED when model readiness is insufficient. No Assessment, Planning, Prompt Write, review or publication turn was submitted. This is not a judgment that D2's live behavior failed.

## Source and build basis

- Product HEAD and D2 source identity: `00222cb386fad4b72ffa93c954fce3af60ee50ac` (`d2`, committed 2026-11-10 12:42:41 CST). `git status --porcelain=v1` was empty before preflight and after the build. Product and browser package versions: `0.13.11`. The D2 commit includes the Assessment source, worker, skill and focused-test changes described in [P5-D2](p5-d2-assessment-interface-repair.md); no unrelated uncommitted source change was present.
- Source inspection confirmed the reduced `assessment_stage` model schema in `packages/pi-runtime/worker.mjs`: `objective`, `rationale`, an ordered `work` array with `title`, `objective`, `boundary` and optional `dependsOn`, a separate `closeout`, and optional constraints, deferrals and source claims. The model schema has no canonical `count` or step IDs. `normalizeAssessmentSubmission` in `prompt-authoring-stage.ts` derives `count` from `work.length`, assigns `step-1` onward and maps earlier one-based dependency ordinals to those IDs; omitted dependencies become empty arrays. The source validation path still checks claims against brokered reads. Field-specific validation errors and error projection are present. The built-in `/prompt-ass` skill and protected stage instruction both describe the reduced shape, one-based dependencies and Dope-owned count/IDs. The saved canonical `AssessmentWireframe` shape is retained.
- The worker declares `plan_status`, `plan_stage_step`, `plan_correct_step`, `plan_stage_closeout`, `plan_stage_efficiency` and `plan_finish`. The protected stage instruction calls for bounded step/closeout/efficiency staging. `proposal_stage_prompt`, `proposal_finish`, the incremental proposal controller and guarded prompt publisher remain wired in source. These are source observations, not live-model PASS results.
- `npm run build:browser` passed from this HEAD. SHA-256 of compiled artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `packages/chat/lib/index.js` | `7f39ae7fdf5188b9998822cb3539e219960344f21605bd5b5bc187b0685ee4d7` |
| `packages/theia-extension/lib/node/chat-backend.js` | `db76f0fd26356b3aa2ff4b410a15c6843cf71c66314b26df85e800ce5343ba78` |
| `packages/theia-extension/lib/node/prompt-authoring-stage.js` | `ab7f4eaa3a093c5116d3fb4c58ccef77152e3d5074b7db1ed600af1d3ff57e18` |
| `packages/theia-extension/lib/node/incremental-plan.js` | `bea8d5b6722379d4061adf4faa5188fef4ae4dd8059b7b946e67ae0cfa4bbae5` |
| `packages/pi-runtime/worker.mjs` | `50e577d568e6f7a8c25cd0ce454d245521a1a1fcb1c967fc78f26a1b9d470bc3` |
| `apps/browser/lib/frontend/bundle.js` | `e5dd7d1adc9e4b1270bea131543df8995a3fe004ed6c2466dcfdc15bd7fb1b3f` |
| `apps/browser/lib/backend/main.js` | `c9ac91a99afe83ed81d1e78d66dbd96f8b1d244238639d49593dc52e9d358833` |

The browser backend was not started because the model-readiness stop was established before a journey could begin. Served frontend/backend/worker hashes and connected-browser freshness are **NOT EXERCISED**, not inferred from compiled files.

## Model and machine preflight

- LM Studio answered at `127.0.0.1:1234`. Two read-only `GET /api/v1/models` results showed catalog key `openai/gpt-oss-20b`, selected variant `openai/gpt-oss-20b@mxfp4`, MXFP4 quantization and **`loaded_instances: []`**. The other listed models were unloaded too. A catalog or selected variant is not a loaded execution instance. No model was loaded or changed by D3.
- Dope's selected connection and actual execution model: **UNKNOWN / NOT EXERCISED** because no Dope session or request began. Requested `temperature: 1`, `top_p: 1`, `reasoning_effort: low`, managed context, generation Ask and commands Ask were **not measured for D3**. Engine-effective settings are likewise **UNKNOWN**. No model settings, context limits, parallelism or LM Studio global configuration were changed.
- Resource preflight: 30 GiB RAM total, 18 GiB available; zero swap; root filesystem 147 GiB total, 3.5 GiB available, 98% used. These are current observations. The immediate stop was the absent loaded model; no inference resource consumption was measured.

## Journey checkpoints

| Required checkpoint | D3 observation |
| --- | --- |
| Fresh disposable project, four fixture source bytes/hashes, fixture Git baseline/status, `npm test`, fixture version, absent draft/canonical folder | **NOT EXERCISED.** No fixture was created after the model-readiness stop. |
| One `/prompt-ass slug-separators-d3 ...` command, saved Chat/draft/execution identifiers and broker sequence | **NOT EXERCISED.** No command or inference was submitted; no saved identifiers exist. |
| Reduced Assessment submission, derived count/IDs, source checks, rejection feedback, accepted stage and `assessment_finish` | **NOT EXERCISED.** Source implementation was inspected; live behavior and rejection recovery were not. |
| Checked `/prompt-plan` chip/prefill, source reads, bounded steps, T1/T2/T3, ten efficiency findings, `plan_finish` and PlanRecord | **NOT EXERCISED.** No Assessment seal exists for D3. |
| Checked `/prompt-write` chip/prefill, incremental staging, `proposal_finish`, generated files and digest | **NOT EXERCISED.** No Plan seal exists for D3. |
| Native proposal card, read-only links/Open All, generated file bytes, Accept/Reject/Revise | **NOT EXERCISED.** No proposal exists. |
| Explicit owner Accept, exact publication, Work discovery | **NOT EXERCISED.** No approval was requested or given; no canonical files were written. |
| Reload integrity, stale/wrong controls, keyboard/focus/narrow pane, native Electron parity | **NOT EXERCISED.** No connected browser journey was opened. |

There was no D3 tool, provider or worker failure: no D3 model request reached those boundaries. The sole observed blocking condition is the unloaded required model. No fixture, product source, manifest, lockfile, version or historical report was changed. No Work Run or grant, Roadmap Gate/Phase award, canonical prompt publication, self-commit or additional correction campaign occurred. Historical P5, P5-Q1, P5-D1 and P5-D2 dispositions remain separate and unchanged.

**Remaining gate:** a new, separately authorized exact-build live qualification can begin when the owner-selected GPT-OSS 20B instance is actually loaded. D3 has no Assessment, Planning or Prompt Write PASS claim, and no scoped authoring PASS.
