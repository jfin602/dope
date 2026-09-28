# Product Phase 2 — Project Mind Task Stack

Status: APPROVED / ACTIVATED BY OWNER SEQUENCING WAIVER — READY FOR EXECUTION
Preparation: September 28, 2026, `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`
Activation source/package baseline: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, `0.2.0`; owner waiver: `docs/planning/p2/activation.md`
Theia baseline: `1.75.0`

## Prerequisite

The owner explicitly authorized "Proceed with Phase 2 despite Phase 1 being Not Qualified." The separate sequencing waiver in `docs/planning/p2/activation.md` satisfies the p2 prerequisite. Phase 1 failures remain recorded and cannot be relabeled Green; Phase 2 qualification requirements remain unchanged.

Committed activation source: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, coherent `0.2.0`. The authorization commit is identified in the activation record. Require a clean intended tree and normal baseline checks. No P1 success marker exists yet. The runner validates version/commit history, not qualification; prompt preflight reads the waiver instead of requiring Phase 1 Green.

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

Retry the authorized stack with closeout enabled: `npm run codex:phase -- p2 --closeout`. P1 starts from `0.2.0`; the runner still stops at P5 for direct GUI qualification.

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
