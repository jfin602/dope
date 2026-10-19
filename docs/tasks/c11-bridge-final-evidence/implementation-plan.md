# /prompt-plan — c11-bridge-final-evidence

**Status:** Five owner-requested manual, browser-required qualification/repair prompts **PLANNED / AUTHORED ONLY, NOT RUN** on remote source `d4141f90e34d76b418a06b8d101a039657d95a50`, product version `0.11.8`. This implementation/qualification plan inherits [campaign contract](campaign-contract.md) and [assessment](prompt-assessment.md), not authority to mutate real source or accept candidate/work/architecture approvals.

## Execution model: manually operated successive loops

- **P1–P4** are *manual T3 real-browser observe/repair/replay families*, rather than headless implementation prompts. Each gets up to **three bounded diagnostic repair iterations**, only against an actually observed defect and a later authorized source-change decision. Each iteration records before, exact actor/tool/environment, source/head/fingerprint, test command/result, browser evidence, negatives, and after; don't change code simply to eliminate an evidence gap.
- If local browser unavailable or a necessary owner approval missing, write **BLOCKED/EVIDENCE GAP**, preserve current pass results, and move only to independent nonmutating checks. Never auto-approve architecture adoption, Work Run/grant, candidate accept/reject outside explicitly approved disposable fixture semantics. Automated browser controls in a disposable fixture are recorded as automation-operated, not independent owner signoff.
- **P5** solely performs the coherent real D5–D8/PB5–PB8 final replay and stable-source aggregate, based on retained R1–R4 evidence; original P15 and earlier R5/Not Green remain separately immutable. P5 can return NOT GREEN or EVIDENCE GAP; it must not backfill PASSES for absent live observations.
- Do not reimplement already qualified candidate review/Dope Work. Earlier 56/56 and 772/772 are historical matching source proofs, not measured outcomes on any changed source.

## Owners, dependencies and tests

| Prompt | Boundaries | Focused testing / real browser acceptance |
| --- | --- | --- |
| P1 / R1 | `HistoryWidget.refresh`, `HistoryService` RPC proxy/binding, `HistoryBackend`, `history-work-git`, WorkspaceService event lifecycle | Existing History panel/integration/navigation tests; browser real Work run/candidate/checkpoint entries after refresh/restart, A→B→A, spinner exits into content or truthful actionable error, no duplicated entries. |
| P2 / R2 | `readPhaseFocusEvidence` / `phaseFocusSequenceEvidence` / `selectPhaseFocus` and live Roadmap canvas refresh; AgentStore/Git/source checks | Existing `phase-focus-evidence`, `agent-sequence(-persistence)`, `roadmap-task-discovery`, Roadmap projection tests. Exact P1 checkpoint shows **Completed implementation**, manual P2 status remains manual, qualification stays **Unknown** sans citation; wrong root, drift, duplicate, foreign, missed prefix remain blocked/unknown. |
| P3 / R3 | `PlanningMapController`, `visual-planning-backend`, `roadmap-planning-links`, physical basis and `visual-planning/reconciliation` | Reproduce generation mismatch/denial on exact fixture, explicit reviewed link recovery without weakening owner/stale check, correct physical evidence; target stays Not Implemented unless a separately approved actual implementation/target revision qualifies. |
| P4 / R4 | Existing Work/Chat/History/Phase Focus user-facing negatives and safe permissions; separate Electron direct inspection | Actual browser same/cross project, grants/candidate replay and drift, missing prompt, failed validation, preserved immutable P source, provider consent, saved dockable Chat, keyboard/narrow/restart. Native window evidence or explicit scope decision; no self-waiver. |
| P5 / R5 | Complete revised Bridge D5–D8/PB5–PB8 and upstream D1–D4 where changed | One source-bound final browser path, real Work and reviewed state, exact source/Git checkpoint and Physical/Planning map, test/build aggregate, evidence matrix and terminal disposition. |

**Manual route:** Do not use `npm run codex:phase -- ...` to perform these GUI prompts. Run `npm run codex:phase:validate -- c11-bridge-final-evidence` on the **actual local checkout** as grammar/readiness check only, after protecting dirty source/evidence. This docs authoring was performed from GitHub and cannot attest to local validator, typecheck, unit tests, browser or Electron. Do not claim a passed parser until actually observed.

## Evidence storage and acceptance

Write actual evidence **only when prompts are run** under `qualification/r1-history/`, `qualification/r2-phase-focus/`, `qualification/r3-target-relink/`, `qualification/r4-safety-usability/` and `qualification/r5-final/`. Each recorded cycle: PASS/FAIL/BLOCKED/NOT RUN, observed vs inferred, source path/fingerprint, test/log hash, browser action and signed/automated owner decision distinction. Only after P5 run create `closeout.md` with one Bridge-scope overall verdict and D/PB/F4 matrix. Keep all original P1–P15, started fixture sequences and previously dated Not Green reports unchanged.

**Scope edge:** Full Phase 11 still OPEN/NOT QUALIFIED until other usability/Hunt/owner gates; Phase 12 inactive. Version `0.11.8` unchanged; prompt review ≠ Run, candidate review ≠ Work grant, real Work completion ≠ architectural target adoption or roadmap qualification.
