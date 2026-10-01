# Correction 5 — Synthesis Observability and Dry Run

Status: **PLANNED / QUEUED FOR EXECUTION**
Correction folder: `c5-synth-observe`
Current package baseline: `0.5.11`; execute without a version bump if this baseline still applies.
Phase context: Product Phase 5 P11 paused; separate from `c5-smap-acceptance-debug-loop`.
Authority: ADR 0012 and ADR 0014 as amended here, ADR 0013, ADR 0016, current Software Map and Phase 5 contracts.
Assessment: `prompt-assessment.md`; plan: `implementation-plan.md`; execution briefs: P1–P3 in this folder.

## Purpose

Make long-running synthesis truthful and understandable when a model call fails, retries, or stops. Let the developer inspect deterministic generation inputs and saved run state without paying for another model call.

## Scope

- Distinguish a failed call attempt, an automatic retry in progress, and a terminal failed run in the Software Map sidebar. Show attempt number, stage/subject, selected model, safe failure reason and recovery state without exposing raw provider errors or secrets.
- Label completed, current, queued and failed stages in text and semantic theme colors. Color is supplementary; status remains readable with keyboard access and alternate themes.
- Place **Retry failed stage with [selected model]** alongside the model dropdown after terminal failure. A changed Gemini model must pass its capability test before retry. Keep validated completed checkpoints and their original provider/model provenance; retry only failed and dependent work. Keep fresh analysis separate.
- Offer **Dry run (no model calls)** from synthesis setup. Reuse the existing deterministic evidence collector and validators; report input fingerprint, evidence/document summary, collection/validation errors and, for an existing failed run, saved completed/failed/pending work. Identify model-dependent stages as untested. Do not configure/call a provider, write `.dope/` or other project files, create a proposal/review, or alter an active/saved run.
- Preserve the existing provider-independent attempt ledger and align retry classification with ADR 0014: one visible malformed-output retry is permitted, but invalid architecture/content is terminal unless the developer chooses manual retry. An individual failed attempt must never render as terminal analysis failure while another attempt is running.

The dry run differs from the active `c5-smap-acceptance-debug-loop` offline checker: that checker validates a generated, unaccepted Architecture Review. This correction inspects inputs before generation or recovery state after a failed run. It does not repair architecture, change synthesis prompts/evidence selection, or qualify generated architecture quality.

## Streamlined stack

| Prompt | Work | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | truthful attempt/run status, colored stage list, model-coupled manual retry and permanent focused regressions | T1 | GPT-6 Sol High | no |
| P2 | read-only generation dry run through existing evidence/run readers, UI report and focused no-provider/no-write checks | T2 | GPT-6 Sol High | no |
| P3 | one direct browser check of retry/failure/recovery and dry run, then evidence closeout | T2 | GPT-6 Sol Medium | yes |

## Exit

Green requires a controlled retry to remain visibly active until success or terminal failure; model switching and manual retry to preserve validated checkpoints; and a dry run on a fresh and a failed project to produce truthful reports with zero provider calls and zero project writes. Preserve prior Not Qualified synthesis evidence and the active acceptance-debug correction's scope and work state.

This stack is queued separately from the current acceptance-debug machinery. It does not change that correction's required closeout, the preserved Adaptive SEO review, or the existing P11/P12 gates. Implementation planning follows `/prompt-ass -> /prompt-plan -> /prompt-write c5-synth-observe`.
