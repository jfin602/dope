# p9d P1 — Legacy Session export requalification

**Date:** 2026-10-12 (America/Chicago)  
**Disposition:** **GREEN for bounded P1 offline exporter only — P2 authorized to proceed.** Phase 9 overall is **NOT QUALIFIED**.  
**Verified repair commit:** `d58872f62eebc1426769c1c262807df8133406e9` (`Repair p9d P1 offline legacy Session export`).  
**Package version:** `0.9.23` across all 13 root/app/package manifests with pinned internal `@dope/*` dependencies coherent at `0.9.23`.  
**Source/qualification distinction:** Source code, exact commit, manifest coherence and test registration were inspected through connected GitHub. **The user supplied the agent's test execution result; the focused tests have not been independently rerun in this documentation action.** Do not convert these focused results into a full Phase 9 qualification.

## Why the first P1 marker was not a pass

The historical `0.9.23` version-only checkpoint `256bba696e4c52f09d76cc7579f945ae93a48889` did not supply a standalone exporter, archival guide or focused tests. The phase runner's `PREVIOUSLY COMPLETED` label came from a reachable commit with subject `0.9.23` plus matching package version; it **does not inspect implementation or proof**. Owner explicitly rejected that marker as an invalid P1 completion.

After the mandated stop at P2's gate, the real P1 implementation was added in the separate, accurately titled repair commit `d58872f` at unchanged `0.9.23`. It is **this repair and the evidence below**, not the earlier bare-version marker or the obsolete p9c P10 result, that satisfies the p9d P1 gate.

## Implemented deliverables (checked in committed repository)

| Deliverable | Committed location | Observed |
| --- | --- | --- |
| Standalone explicit offline v1/v2 export | `scripts/export-legacy-development-sessions.mjs` | Exists in repair commit; imports Node built-ins only, no Session runtime libraries |
| Focused regression | `test/unit/legacy-session-export.test.ts` | Exists, seven test cases (v1 and v2 separate), no changed compiled library dependency |
| User-directed recovery guide | `docs/tasks/p9d/legacy-session-recovery.md` | Documents `--project`, `--format text/json`, optional exact `--file`, stdout and preservation limits |
| Test registration | root `package.json` `test:product` | Registered exactly once |
| Version coherence | 13 package manifests plus `@dope/*` pins | All inspected at `0.9.23`; no early `0.9.24` bump |

The exporter validates strictly bounded legacy collection schemas, root identity and safe files, refuses symlink/traversal/corrupt/oversized/foreign inputs, preserves objectives, developer notes, next actions, closeout and typed references, and writes export data only to stdout when explicitly invoked. It neither initializes Project Mind nor performs implicit migration or inference. Source contents are not automatically part of History/model context.

## Focused validation — reported by implementing agent and developer

- `node --test test/unit/legacy-session-export.test.ts`: **7 passed, 0 failed**.
- `git diff --check`: **PASS**.
- Before/after legacy Session data and owner-store byte/hash comparisons: **no changes** from accepted and rejected exporter calls.
- Standalone export executed from an isolated directory with Session runtime package imports unavailable: **PASS**.
- No compiled dependency changed, so no build was needed.
- Full `npm run check`, real History GUI, and final Phase 9 aggregate: **NOT RUN for this P1 qualification**; they belong to later gates.

These observations are **user-provided execution evidence**, supported by committed tests and source inspection, not a transcript/log independently reproduced here. The seven cases cover v1/v2, malformed/oversized, symlink/path, copied/moved-root/Project Mind mismatch, explicit target and runtime independence. If subsequent tests contradict these observations, reopen P1 qualification rather than ignoring a failure.

## Exact handoff to P2

**P1's previously mandatory independent repair/requalification gate is now satisfied for the bounded export scope.** The owner separately approved p9d P1–P13 in `docs/planning/p9/phase-9d-activation.md`; its original "P1 missing" status remains historical and is superseded by this dated disposition.

P2 may start only if its checkout contains this qualification file, the exact `d58872f` repair (or a descendant including its exporter/tests/guide), coherent `0.9.23` package manifests and actual working exporter/tests. The runner may still label P1 `PREVIOUSLY COMPLETED` because it uses Git version commit subjects, but **P2 must use this evidence record and actual code**, not the marker, as its gate. P2 advances to `0.9.24` **during** work if successful. Do not pre-bump or rewrite existing Git history.

Original p9c P10 has a historical **NOT GREEN** GUI closeout and remains superseded by ADR 0034; this P1 pass does not alter that disposition, Phase 5/8 history, final Phase 9 gates or Phase 10 inactivity.
