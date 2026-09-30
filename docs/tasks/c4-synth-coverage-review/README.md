# Correction 4 — sMap Synthesis Coverage + Iterative Review

Status: **APPROVED / PROMPT STACK READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Predecessor: owner-closed / Not Qualified `c4-synth-improvements`
Authority: ADR 0014 including the 2026-09-30 amendment, plus ADR 0008-0013 where not amended
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24

## Purpose

Turn the improved-but-incomplete responsibility hierarchy into a synthesis/review system that:
- retains complete provider-attempt evidence;
- recovers material responsibilities omitted by initial discovery;
- explains empty Component descent;
- lets the developer re-investigate only a weak System or Subsystem without discarding good review work;
- proves quality across more than one repository.

## Stack

| Prompt | Work | Tier | Browser |
| --- | --- | --- | --- |
| P1 | provider-attempt telemetry + bounded Gemini retry reliability | T2 | no |
| P2 | stronger source-backed coverage cues + Subsystem recovery contract | T1 | no |
| P3 | typed Component-descent + coverage/reconciliation diagnostics | T2 | no |
| P4 | branch-local **Search Deeper** review feature | T2 | no |
| P5 | direct browser review/Search Deeper qualification | T3 | yes |
| P6 | multi-repository architecture-quality + consolidated release validation | T3 | yes |
| P7 | evidence-only correction closeout | T3 | no |

All prompts keep package version exactly `0.4.6`.

## Core invariants

> Evidence coverage is diagnostic, not canonical architecture.

> Subsystem Challenge can recover a substantial responsibility that discovery omitted.

> Empty Component descent is explicit and typed; Dope never invents Components merely to fill a tree.

> Search Deeper edits nothing until the developer accepts the branch proposal.

> A branch-local refinement never silently destroys unrelated reviewed work.

> Every provider-call attempt is observable; retries are bounded, explicit and provider/model-stable.

## Search Deeper product contract

Every System and Subsystem in pending center review exposes **Search Deeper**.

The targeted run starts from the current edited branch plus its source-backed evidence, deliberately expands into relevant uncovered/cross-boundary evidence, and returns a preview replacement for that branch.

System refinement may replace/refine that System and its descendants. Subsystem refinement may refine or split that Subsystem within the same parent System and rediscover Components.

Unrelated branches/manual edits remain unchanged. A rejected proposal leaves the draft unchanged. A stale target branch cannot accept an older proposal.

## Qualification set

Required real repositories:
- pinned Adaptive SEO benchmark at `0b26a25107be7d8dfb2210bc7258ccac8603197e`;
- Dope itself through an uncontaminated benchmark root at the exact final candidate;
- one smaller structurally clear repository or controlled repository fixture, recorded before execution.

Reference architecture may be consulted only after each generated tree is frozen.

## Routing

Green -> fresh bounded provider-comparison correction -> `c4-smap-storage` -> fresh Phase 5 review.

Do not reopen closed correction histories.
