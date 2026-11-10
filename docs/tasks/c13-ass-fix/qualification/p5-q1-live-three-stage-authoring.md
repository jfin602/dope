# P5-Q1 live three-stage authoring qualification

**Date:** 2026-11-10, 11:43–11:50 CST. **Verdict: NOT GREEN.** The one fresh GPT-OSS 20B browser journey stopped at Assessment. Source/build/model preflight passed, but no Assessment wireframe was accepted or sealed. Planning, Prompt Write, proposal review, publication, Work and Roadmap were not run. Preserve the historical P4, P4-R1, P5 and P5-R1 verdicts.

## Exact candidate and ordinary Chat classification

- Product HEAD at entry and after the live run: `170416c655375875d8f46bb513de7b4d53be2646` (`p5-r1`, now committed). `main...origin/main` was tracked/untracked clean at entry. Product and browser package versions: `0.13.11`. No manifest, dependency, lockfile, version or product source was changed. This report is the only product-worktree addition; no self-commit.
- The six incremental Plan tools are in `incremental-plan.ts`, `chat-backend.ts` and the bundled Pi worker: `plan_status`, `plan_stage_step`, `plan_correct_step`, `plan_stage_closeout`, `plan_stage_efficiency`, `plan_finish`. The protected Plan instruction explicitly calls for bounded submissions and a short final summary, not a monolithic Plan JSON answer. `plan_finish` assembles and validates the established `PlanRecord`; `/prompt-write` checks its saved receipt and Assessment dependency. This is source inspection, not live Plan proof.
- The focused ordinary Chat suite on current source was **4/5**. The case “completed answer alone enters saved conversation; twelve cancelled drafts and errors remain diagnostic” failed with `Completed answer differs from saved partial` at `chat-repository.js:1071`.
- Classification **A — pre-existing on the exact pre-P5-R1 source**. In a detached `f3f78ed9` checkout, I built the baseline contracts, chat and extension, then ran the same one-file suite: **4/5**, same error and assertion. The test and repository invariant are unchanged by P5-R1. The fixture streams `draft answer` but supplies final `Final answer.`; the repository requires a completed answer to extend the saved partial. The completed-answer projection rejects those differing bytes. This is a separate ordinary Chat test/behavior evidence gap, not a new P5-R1 regression or a protected authoring authority failure. No Chat production repair or test rewrite was made.
- Candidate build: `npm run build:browser` passed from this HEAD. SHA-256: `packages/theia-extension/lib/node/chat-backend.js` `3b1a1cded330b877b01e5abb4da6248df5f18a709b0f471110a458c48dbc59d9`; `incremental-plan.js` `bea8d5b6722379d4061adf4faa5188fef4ae4dd8059b7b946e67ae0cfa4bbae5`; `prompt-authoring-stage.js` `da9dc94cac2aa693715fae9eac7747e24514480ca2626ed3f19bb64f3e1d5e56`; `packages/chat/lib/index.js` `56997ee629d779975b2ade28b24085d960a868178b83eddcb8ef4d4a1375d553`; `packages/pi-runtime/worker.mjs` `6e1b3dfcb63fb8bf8b1e183546f2ff362bbddff015e5c03136f2f27b6d4f6310`.
- Browser frontend `apps/browser/lib/frontend/bundle.js` SHA-256 `679be4f73809f42fe5cf474975422a477e12c5e8e0da727fb8ccf81876805264`; backend `apps/browser/lib/backend/main.js` `19b227e06ea2c007a5164b14de07a141605f578bed2e9bfab34ee95069940dd4`. The backend listened at `127.0.0.1:3085`, reported 94 accepted plugins, and its served `/bundle.js` SHA-256 matched the built frontend. The connected Codex in-app browser loaded `http://127.0.0.1:3085/#/tmp/dope-c13-p5-q1-mLd8Ph` and displayed that project. No stale served bundle was used.

## Model and disposable project

- LM Studio `/api/v1/models` showed a **loaded instance**, not only a catalog entry: `openai/gpt-oss-20b`, MXFP4, context 16,384, parallelism 1. The Chat model picker explicitly selected `LM Studio · openai/gpt-oss-20b`. Saved execution confirms selected connection `21d03643-2aca-407e-b090-af59979b6c2f` and actual `local/openai/gpt-oss-20b`. AI Center reported this connection ready with one usable model. No model/runtime configuration was changed.
- Chat settings showed Managed context, generation limit Ask each time, and Commands Ask. LM Studio logged outgoing `reasoning_effort: low`, `temperature: 1`, `top_p: 1` during this request. These are outgoing requested fields; engine-effective sampling was not established. Saved Dope context estimate was 410/8192 tokens; aggregate provider token usage was not established. The log file SHA-256 at report time was `dd7360b6006536dcba2423ea9de19c088224c8bccf9386736e7d921b9e8409d3` (the log is appendable).
- Preflight resources: 30 GiB RAM total, 6.9 GiB available; no swap. Disk had 4.0 GiB available at start, 3.9 GiB at close, 98% used. No competing loaded model was observed in LM Studio's model inventory; the required model had one loaded instance.
- Fresh fixture: `/tmp/dope-c13-p5-q1-mLd8Ph`, Git baseline `4268cb54ddee1e61890874e327488c7c2fd14e4b`, initially tracked-clean, no `.dope` and no `docs/tasks/slug-separators-q1`. Baseline `npm test` passed **2/2**. The four original UTF-8 files, each ending with a newline, were:

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

## One live Assessment and stop boundary

- At 11:46:56 CST, in a fresh Chat, submitted exactly one native command: `/prompt-ass slug-separators-q1 Correct the toSlug helper's separator handling, update the relevant tests and documentation, and produce a small executable prompt stack with a separate manual closeout.` No prior failed P5 Chat was reused.
- Saved Chat ID `6fda4300-1997-40b9-861e-d4e39794eb23`; user message `02322269-98ae-4edb-9eb9-476c6e755cf5`; assistant message `70ffa0b3-11ea-41c2-9210-0c2e3de6848c`; draft ID `acb8eb94-d819-4c88-80bf-3361b418ef3f`; execution ID `0dba917e-9437-4d13-a0a5-a3a74569640c`. The draft pins the fixture source HEAD and version `0.1.0`.
- Saved broker order: `list_files` completed; `search_paths` completed; `read_file docs/slug-format.md` completed; `search_paths` completed; `list_files src` completed; `read_file src/labels.js` completed; then `assessment_stage` failed three times with `ASSESSMENT_WIREFRAME_STEP`, with one failed `assessment_finish` between the second and third stage attempts. The two reads have source-content hashes matching the original fixture files. The failed stage calls were marked recoverable by the broker, but the model did not submit an accepted correction within this same turn. No Assessment finding was verified.
- The final saved execution status is `failed`, finished 11:49:10 CST after 2m14s. Exact safe failure: `Assessment blocked (ASSESSMENT_WIREFRAME_STEP): Stable ordered IDs and earlier dependencies required 2 brokered source pages; 0 verified findings; 0 requested sources remaining.` The draft remains active with two source pages, zero accepted findings, no sealed Assessment, Plan or Prompt. The model's final JSON-like prose is not a tool receipt and does not complete Assessment. The saved record does not expose the rejected tool arguments, so the precise field-level mistake is unproven; `field: internal` is all the safe broker metadata supplies. No provider or worker terminal error, context-limit or cancellation was recorded.
- The Chat card showed `Blocked · Assessment blocked (ASSESSMENT_WIREFRAME_STEP)` and a `Revise wireframe` control, not `Assessment ready · Plan next`. After a browser reload, the same blocked card and error survived; no Plan chip, PlanRecord, Prompt Stack Proposal or duplicate card appeared. The transient model picker reset to Follow Interactive, while the saved execution retained the actual GPT-OSS model. No additional inference was submitted to test presentation.

## Downstream status, safety and verdict

| Required checkpoint | Observed result |
| --- | --- |
| Reviewed compact Assessment count, ordered IDs, dependencies, separate manual closeout and seal | **FAIL / NOT GREEN:** no wireframe accepted or sealed; count and task division are unreviewed model prose only. |
| Checked `/prompt-plan` handoff, source reads, bounded stage calls, ten efficiency gates, `plan_finish`, one current `PlanRecord` | **NOT RUN:** no Assessment receipt unlocked Planning. Plan tool sequence, accepted steps, closeout, efficiency findings, dependency hash and record identity: none. |
| Checked `/prompt-write`, staged P1–Pn and separate T3, `proposal_finish`, file list/digest and native file links/Open All | **NOT RUN:** no checked Plan or Prompt Stack Proposal. Generated files/digest: none. |
| Read-only proposal review, Revise/Reject and explicit owner Accept/publication/Work discovery | **NOT RUN:** no pending candidate or owner Accept. Canonical target remains absent. |
| Reload, keyboard/narrow-pane and stale-chip negatives | Blocked Assessment persisted after reload. No keyboard, narrow-pane, stale/foreign chip or native Electron parity claim was made. |
| No unauthorized write, Work Run or Roadmap award | **PASS for this stopped attempt:** original four tracked fixture hashes were unchanged; `git diff --exit-code` passed; only untracked `.dope` Chat/draft evidence exists. Canonical `docs/tasks/slug-separators-q1` is absent. No Work or Roadmap action occurred. |

**P5-Q1 overall: NOT GREEN at the live Assessment stage.** The source/build/model lock and pre-existing Chat regression classification are established, but the required three-stage authoring chain was not reached. The one saved failed draft remains available in the disposable project for independent diagnosis. No second command, automatic retry, model tuning, implementation repair, canonical publication, Work Run, Roadmap/Phase award, version advance or self-commit followed. `git diff --check` passed for this report; no broad test campaign was run.
