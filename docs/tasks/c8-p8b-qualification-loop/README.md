# Phase 8B Iterative Qualification / Repair Loop

Status: **STOPPED AFTER CYCLE 1 — PHASE 8B NOT GREEN / NOT QUALIFIED; ARCHITECTURE DECISION REQUIRED**
Date: 2026-10-06
Folder: `c8-p8b-qualification-loop`
Version policy: **keep Phase 8B at `0.8.13`**
Maximum cycles: **5**
Execution: **manual GPT-6 Sol High with browser/native access; do not run through `codex:phase`**

## Starting evidence

The retained P7 closeout records Phase 8B as **Not Green / Not Qualified**.

Reported exact P7 candidate:
- base HEAD: `3fb5609e5e442939bccdb52daf107a40c6e4dfc9`;
- tracked working-tree SHA-256: `0932c62f137ae22e4d058cc6b739ba2ba986bc9efefe9fade9e634c4d518f450`;
- package family: coherent `0.8.13`;
- focused suite: **63/63 pass**;
- `npm run check`, `npm run codex:phase:validate -- p8b`, version/internal-reference checks and diff checks: pass;
- stale baseline version assertion repaired.

The live blocker is earlier than model execution:

**The real Codex sandbox cannot start.**

The installed sandbox probe exits before authentication or App Server spawn with a bubblewrap executable/path failure. The production adapter therefore returns `unsupported-capability` and fails closed.

Consequences:
- all five denied-class probes were refused before an executing harness existed;
- unchanged canaries prove only fail-closed refusal, not live enforcement;
- the disposable native profile had no eligible Codex target, so Agent Run Start remained disabled;
- no live mutation, command/file activity, changed-file/diff evidence or validation evidence exists;
- cancellation, active-run restart interruption and persisted-run security remain unqualified.

See:
- `docs/tasks/p8b/closeout.md`
- `docs/tasks/p8b/evidence/p7-agent-run-blocked.png`

## Loop law

Run at most five cycles.

Each cycle:
1. start at the **first currently unproven 8B qualification gate**;
2. reproduce the blocker directly;
3. diagnose from exact source/runtime evidence;
4. make the smallest repair inside the approved 8B boundary;
5. run only focused evidence invalidated by the repair;
6. replay the blocked direct gate;
7. if it passes, continue through later direct gates until the next blocker or all Green;
8. record evidence and checkpoint the coherent candidate.

Stop immediately when all 8B gates are Green.

After Cycle 5, stop regardless of outcome. Preserve every cleared gate and remaining blocker as Not Green / Evidence Gap or Not Qualified truth. Do not activate Phase 8C unless Phase 8B is Green.

## Gate order

The loop qualifies gates in this order:

1. **Real sandbox startup and enforceable default grant**
2. **Eligible live Codex target / ChatGPT-plan runtime**
3. **One real happy-path mutation + local validation**
4. **All five denied authority classes under an executing harness**
5. **Live cancellation after a real partial workspace effect**
6. **Forced restart interruption of a live run**
7. **Persisted run/event security + restart inspection**
8. **Exact-final-candidate aggregate validation**

Do not skip forward merely because a later controlled test is already Green.

## Scope boundary

Allowed repairs:
- Codex executable discovery/invocation needed by the sandbox;
- Linux sandbox startup and verified current CLI/profile/config compatibility;
- the bounded `dope_run` permission/profile mapping;
- sandbox preflight implementation when its probe is wrong or incompatible;
- Codex mutation adapter startup/config/event/cancellation integration;
- Agent Runtime target readiness wiring needed to expose a valid already-approved Coding Agent target;
- qualification-only diagnostics that contain no secret material;
- focused tests/regressions for observed defects;
- Agent Run presentation defects that block direct qualification.

Not allowed:
- relaxing the default ExecutionGrant;
- replacing real enforcement with prompt instructions;
- accepting unchanged canaries from a refused preflight as authority proof;
- allowing Git writes/history mutation, network, secrets/private-home access, outside-root effects or destructive/system/package-admin effects;
- silent provider/API-key billing fallback;
- AgentTaskSequence, prompt-stack sequencing, checkpoint commits, dirty-tree continuation or other Phase 8C work;
- WorkItem delegation or later Phase 8 features;
- version advance beyond `0.8.13`.

If a repair would require a materially new sandbox architecture rather than a bounded 8B correction, record that as the blocker instead of redesigning the product ad hoc.

## Execution prompt

Use:

`docs/tasks/c8-p8b-qualification-loop/one-off-p8b-qualification-repair-loop.txt`

Record every cycle in:

`docs/tasks/c8-p8b-qualification-loop/cycle-evidence.md`

## Cycle 1 disposition

The installed `codex-cli 0.155.1` sandbox startup defect was isolated to `:root = "deny"` hiding the resolved standalone Codex ELF. An exact read allowance for that executable starts the sandbox in a disposable config. Under that executing profile, a shell command could delete a tracked project file while ordinary project writes remained allowed. This violates the fixed 8B `destructive = false` grant. The product source was left fail-closed; a startup-only change would not qualify the grant.

The loop stops after one cycle under its architecture-gap rule. No eligible live target, model mutation, cancellation, active-run restart, or persisted live-run security gate was reached. Phase 8C remains gated. Route the conflict between arbitrary project write/process access and denied destructive project effects to a fresh docs/architecture review before considering another implementation or qualification loop. See [Cycle 1 evidence](cycle-evidence.md) and the retained [P7 closeout](../p8b/closeout.md).


## Post-review architecture disposition

The required fresh authority review is complete. ADR 0028 adopts an isolated ExecutionWorkspace -> CandidateDelta -> Dope Authority/ToolExecutor promotion boundary. This does not relabel Cycle 1 Green and does not resume Cycles 2-5.

Next route: plan and implement correction `c8-agent-authority-boundary` at unchanged `0.8.13`, then perform a fresh bounded 8B qualification. Phase 8C remains gated.
