# Phase 9 — Owner Activation (9A)

**Date:** 2026-10-10
**Status:** **PHASE 9 ACTIVE / 9A IMPLEMENTATION OWNER-AUTHORIZED — NOT QUALIFIED**
**Owner instruction:** "yea its clear to go" following the 2026-10-10 P9A P1 activation-gate failure.
**Activation baseline:** committed coherent `0.9.0` version-only baseline `e250a07c9b4b7ec29fd178a22036094307237b23`.
**Last qualified product source:** Phase 8 Green/owner-closed `0.8.47` at `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06`.

## Scope of authorization

The owner **explicitly activates Product Phase 9 and authorizes execution of only the existing 9A — Session Identity and Persistence P1–P6 stack** in `docs/tasks/p9a/`. Phases 9B (artifact linking), 9C (session workspace), 9D (resume/closeout projection) and 9E (Dope Builds Dope qualification) remain **NOT ACTIVATED**. Phase 9 is not Green, and Phase 10 remains inactive.

The first local `p9a` P1 attempt stopped at its then-unsatisfied activation preflight after approximately 22 seconds; it changed **zero files**, ran no implementation checkpoint, and left all manifests at `0.9.0`. The runner's "expected `0.9.1`; found `0.9.0`" is the consequence of that preflight stop, not evidence of failed session code or a reason to pre-bump.

## Execution/version contract

- The `0.9.0` version baseline was already established by a separate owner decision; **this activation is documentation-only**. Keep all 13 root/app/package manifests and pinned internal `@dope/*` dependencies at `0.9.0` until P1 actually implements and advances them to `0.9.1`.
- P1–P5 each owns its assigned coherent patch version (`0.9.1` through `0.9.5`) and focused tests. The phase runner checks versions but does not bump them. P6 is the sole manual/headless 9A closeout at `0.9.6` and requires a separate legitimate source/version checkpoint before evidence-only closeout.
- **Activation is now satisfied.** The P1–P6 agents must read this activation record as the current authority, not block on historical baseline/planning text saying "not activated." Verify the actual prior Git checkpoint and version for each prompt; preserve any unrelated local dirty work. The prior P1 attempt changed zero files, so restart from P1.
- No new agent runtime, new permission, mandatory sessions, copied Chat/Planning/Work state, model call, automatic WorkItem completion, Phase 5 retrospective Green, Phase 8 history rewrite or Phase 10 implementation.
- P1–P4 retain <=8-minute implementation-plus-focused-test targets; P5 is bounded integration and P6 scoped closeout. No routine full `npm run check`, GUI, browser/Electron/native packaging in 9A; final real GUI/full aggregate is Phase 9E.

## Local execution after safe sync

Inspect `git status --short` and reconcile the local branch with this documentation without overwriting dirty files. Confirm root version `0.9.0` and the activation record, then:

```bash
npm run codex:phase:validate -- p9a
npm run codex:phase -- p9a
```

This owner activation does not claim that these commands were executed, that P1 is complete, or that Phase 9 has been qualified.
