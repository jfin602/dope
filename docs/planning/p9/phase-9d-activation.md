# Phase 9D — Owner Activation and P1 Recovery Gate

**Date:** 2026-10-11 (America/Chicago)  
**Disposition:** **OWNER-APPROVED FOR PHASE 9D P1–P13, CONDITIONED ON P1 REQUALIFICATION BEFORE P2**  
**Owner instruction:** "i approve. and p1 did not complete correctly. it started already completed for some reason" (2026-10-12T02:12:05Z).  
**Design authority:** ADR 0034 and `docs/planning/p9/phase-9-plan.md`.  
**Task authority:** `docs/tasks/p9d/README.md`, `prompt-assessment.md`, `implementation-plan.md`, P1–P13. This is the **separate owner activation document** demanded in every p9d prompt.

## Approval

The owner explicitly approves the **final Phase 9 subphase `p9d` P1–P13**, covering legacy Session export/recovery, removal of old Session UI/backend, factual right-toolbar History, verified one-click continuation, opt-in local-only contextual understanding and the **single manual P13 final Phase 9 qualification/closeout**. There is no p9e. Phase 10 remains inactive and requires separate owner approval.

**This document authorizes implementation; it does not certify that P1 completed correctly or that Phase 9 is Green.** All preserved authority laws apply: never delete/overwrite `.dope/development-sessions.json`; read-only opt-in v1/v2 recovery before deletion of its runtime; preserve Chat/Work/Planning/Mind data and developer authority; no silent hosted data egress; no auto-execution from History; truthful validation, review and Git events. Historical 9A/9B bounded Green and Phase 5 Not Green/Phase 8 Green evidence remain unchanged. Historical p9c P10 is superseded and MUST NOT run.

## P1 was incorrectly classified as previously completed

The owner reports the local runner showed `[+] PREVIOUSLY COMPLETED P1`, citing `9c6258d` with package `0.9.23`, **but P1 did not complete correctly**. The subsequent P2 failed its required preflight because this activation file was absent; P2 changed zero files and ran no implementation tests. The report lists a clean local pre-P2 HEAD `133196b91d294c0a6ba5b4e08432c299fa3201a6`. The actual local P1 contents and test evidence have **not been independently inspected** via this documentation action.

The phase runner detects completed implementation prompts by reachable Git commit **subject** equal to the target version (`0.9.23`) plus coherent current package version. That is a resume marker, **not proof that P1 implemented its scope, ran tests or met acceptance criteria**. Thus the current local `0.9.23` marker must not be promoted to P1 Green merely because the runner skipped it.

### Required bounded P1 repair/requalification gate before P2

1. In the user's **local** checkout, preserve any unpushed local commits/work; inspect `git status --short`, `git log -6 --format='%h %s'`, `git show --stat 9c6258d` and compare P1 implementation against `docs/tasks/p9d/P1-legacy-session-export.txt`. Inspect whether `scripts/export-legacy-development-sessions.mjs` (or equivalent standalone offline utility), archival guide and focused regression test actually exist. Record exactly what the current `0.9.23` commit contains, not just its subject.
2. If any P1 deliverable/evidence is missing, **repair P1 at unchanged `0.9.23`** using a bounded GPT-6 Sol High task/one-off correction. Keep the existing Git history, prevent P2 from running before repair, and do not fake a new `0.9.23` version transition or change the manifest to `0.9.24`. The repair should be a separate accurately titled checkpoint (not another bare `0.9.23` resume marker), created through the normal safe commit workflow.
3. P1 requires a **standalone opt-in read-only legacy Session v1/v2 export** that still functions after Session domain/backend removal, documented usage, explicit project/root and bounded file/schema/path/symlink/foreign-root handling. Prove original legacy files and owner-sentinel bytes unchanged on valid, corrupt, oversize and moved project cases; no Project Mind migration, model call or Session backend runtime dependency.
4. Run the focused P1 export regression tests and minimum required builds/typecheck, `git diff --check`, inspect the P1 repair checkpoint and write a truthful **P1 Requalified / Not Green** result. If validation is Not Green, **do not start P2**. A newer P1 repair commit after `0.9.23` may coexist with the runner's earlier P1 version marker; runner may still label P1 "previously completed", so this **independent requalification** is mandatory before trusting resumed P2.

## Remote/local synchronization

At activation creation, the connected remote `main` is at `91331b6c11594ecd72eb69b1dfffc5f37e52933b` / `0.9.22`; the user's reported local checkout already has a `0.9.23` checkpoint and later local HEAD `133196b...`. **Do not assume remote and local branches are fast-forward compatible.**

The developer should first inspect local status and `git fetch origin`, make a temporary backup branch/tag if local commits are not pushed, compare `git log --oneline --graph --decorate --all`, and only then safely integrate the activation commit into local history. If the local checkout contains intentional work, protect it rather than blindly resetting or force-pushing. A simple `git pull --ff-only` may be impossible if both local and remote have moved; reconcile explicitly. Never use `git reset --hard` or automatically rewrite P1 history.

## Version and phase boundaries

The **real pre-P1 baseline** was coherent `0.9.22` / `0752415`. The user reports a local `0.9.23` P1 marker but not a valid P1 qualification. Once P1 has independently passed at unchanged `0.9.23`, **P2 may advance versions to `0.9.24` during its implementation**, and P3–P12 to their assigned targets through `0.9.34`. P13 is manual and must establish a real, separate `0.9.35` source/version checkpoint before real GUI/full aggregate/evidence-only Phase 9 closeout. The runner never pre-bumps versions. The old Session p9c P10 remains superseded and unexecuted.

This owner authorization does not alter package manifests/source, certify P1/P2 or close Phase 9. **Phase 9 remains NOT QUALIFIED; Phase 10 is inactive.**
