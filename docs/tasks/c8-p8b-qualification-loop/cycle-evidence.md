# Phase 8B qualification loop evidence

Date: 2026-10-06.
Version remains `0.8.13`.
Maximum cycles: 5.

## Retained P7 baseline

- Decision: **Not Green / Not Qualified**.
- Reported P7 base HEAD: `3fb5609e5e442939bccdb52daf107a40c6e4dfc9`.
- Reported tracked candidate SHA-256: `0932c62f137ae22e4d058cc6b739ba2ba986bc9efefe9fade9e634c4d518f450`.
- Focused automated suite: 63/63 pass.
- Aggregate `npm run check`: pass after repairing the stale baseline version assertion.
- `npm run codex:phase:validate -- p8b`: pass.
- Version/internal-reference/no-root-lock/diff checks: pass.
- Installed reference CLI at P7: `codex-cli 0.155.1`.
- Disposable mutation fixture HEAD remained unchanged.
- Real sandbox preflight failed before auth/App Server spawn with a bubblewrap executable/path startup error.
- All five denied probes returned `unsupported-capability` before an executing harness existed.
- Native Agent Run UI opened, but Start was disabled because the disposable profile had no eligible Codex target.
- No live mutation, validation, cancellation, active-run restart or persisted live-run security evidence exists.

This file is append-only qualification evidence. Do not rewrite earlier failed cycles into Green after a later repair.

## Pre-Cycle 1 actual-checkout record

Fill this before editing:
- actual HEAD:
- git status:
- current tracked working-tree SHA-256:
- current untracked evidence files:
- current `0.8.13` coherence:
- current Codex CLI version/path:
- exact sandbox command and failure:
- whether the historical P7 candidate is still uncommitted or has since been checkpointed for preservation:

Do not reset/discard the current candidate to force it to match the historical base. Explain any expected docs/checkpoint drift.

## Cycle 1

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 2

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 3

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 4

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Cycle 5

- Pre-cycle candidate:
- First blocker:
- Direct reproduction:
- Diagnosis:
- Repair:
- Files changed:
- Focused validation:
- Direct replay:
- Cleared gates:
- Next blocker:
- Candidate/checkpoint:
- Decision after cycle:

## Final exact-candidate gate

Fill only when either all direct gates appear Green or Cycle 5 has ended.

- exact final HEAD / tracked-tree identity:
- focused 8B suite:
- `npm run check`:
- `npm run codex:phase:validate -- p8b`:
- version/internal-reference/no-root-lock:
- `git diff --check`:
- real sandbox startup:
- real happy-path mutation:
- live denied-class enforcement:
- live cancellation:
- live restart interruption:
- persisted-run security:
- residuals:
- final Phase 8B decision:
