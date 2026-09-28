# Product Phase 2 — Project Mind Task Stack

Status: APPROVED/PREPARED — EXECUTION BLOCKED
Preparation: September 28, 2026, `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`
Package baseline: `0.2.0`; baseline repair commit and pending sequencing eligibility: `docs/planning/p2/activation.md`
Theia baseline: `1.75.0`

## Prerequisite

The owner approved docs/assessment/plan/prompt writing. Phase 1 remains Not Qualified. Do not execute this stack until Phase 1 qualifies and findings are reconciled against the approved Phase 2 docs, or a separate explicit owner sequencing waiver is recorded. The existing P6 waiver only permitted the Phase 1 audit.

After that decision, activate separately: record exact parent/activation SHA, set all workspace/root versions/internal references and baseline tests coherently to `0.2.0`, validate and commit from a clean tree. No package bump or activation occurred during preparation. The later `0.2.0` baseline repair is recorded in `docs/planning/p2/activation.md` and does not grant sequencing eligibility. The runner validates grammar/version markers, not product qualification; every prompt checks the documented gate.

## Stack

| Prompt | Version | Work | Model | GUI |
| --- | --- | --- | --- | --- |
| P1 | `0.2.1` | Artifact contracts, transitions, queries and independent core | GPT-6 Sol High | no |
| P2 | `0.2.2` | Durable storage, migration, conflict/isolation safety and transport | GPT-6 Sol High | no |
| P3 | `0.2.3` | Project Mind UI and safe editing | GPT-6 Sol High | no |
| P4 | `0.2.4` | Restart integration and Electron package/native launch | GPT-6 Sol High | no |
| P5 | `0.2.5` | Direct interactive Project Mind dogfooding | GPT-6 Sol High | yes |
| P6 | `0.2.6` | Evidence-only closeout | GPT-6 Sol Medium | no |

## Execution

Safe now: `npm run codex:phase:validate -- p2` (grammar only).

After the prerequisite and committed activation: `npm run codex:phase -- p2`.

P1-P4 are runner-owned; implementation agents do not commit. The runner stops at P5 for manual GUI work. P5 may use direct interactive browser-hosted Theia or Electron. Headless/CDP/screenshot-only evidence is insufficient. Successful P5 gets the exact-subject `0.2.5` commit and a clean tree; failed/incomplete qualification stays a checkpoint, not a success marker. Resume P6 with `npm run codex:phase -- p2 --closeout` only after that success, unless a new explicit audit waiver is documented.

P4 proves the resulting Electron package/native launch; P5 proves actual Project Mind use and reopen continuity. P6 records qualification truth, preserves inherited/observed gaps and routes Qualified work to post-Phase-2 `/docs-review`; Phase 3 remains unapproved.

## Authority and output records

- `docs/planning/p2/phase-2-plan.md`
- `prompt-assessment.md`
- `implementation-plan.md`
- P2 creates `docs/project-mind-storage.md`.
- P4 creates `P4-restart-package-evidence.md`.
- P5 creates `P5-project-mind-dogfooding-evidence.md`.
- P6 creates `closeout.md`.

These evidence records are implementation outputs, not pre-filled passes. No model/provider configuration is needed for Phase 2.
