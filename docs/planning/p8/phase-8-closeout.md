# Product Phase 8 — Owner Closeout

**Date:** 2026-10-10
**Disposition:** **OWNER-CLOSED / GREEN / QUALIFIED FOR APPROVED PHASE 8 SCOPE**
**Qualified product source:** `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06`, version `0.8.47`
**Final 8E evidence closeout:** `304d429f866976307a70559cf29c98d8c0276ce5` (`docs/tasks/p8e/closeout.md`)
**Owner authorization:** `/closeout phase 8` (2026-10-10)

## Decision and evidence

The owner closes **Product Phase 8 — Coding Agent / Scoped Delegation**, incorporating qualified 8A–8E and their applicable corrections, on the exact committed product source above. This is an **owner phase-level disposition**, not a new product implementation, new tests, retroactive alteration of failed qualification evidence or Phase 9 activation. All 13 root/app/package manifests and pinned internal `@dope/*` dependencies remain at `0.8.47`; there is **no automatic `0.9.0` transition**.

Phase 8E P14 supplies the terminal evidence: real Dope GUI Direct Work and saved WorkItem AgentRuns using LM Studio Qwen3-Coder `qwen3-coder-30b-a3b-instruct@q3_k_l` at **16,384 observed context tokens**, Linux x86-64 OS-enforced tool sandbox, isolated candidates and required Dope-owned validation, held review surviving restart and explicit developer Accept, active Stop/cancel/reopen, AI Center Reconnect capability invalidation, and a hosted Codex comparison with explicit consent. Final `npm run check` passed **506/506 tests** with browser/Electron builds, plus **67/67** omitted agent/security tests and the p8e stack validator. These are previously recorded P14 results, not tests rerun for this closeout.

## Qualified slices and historical evidence

| Slice | Qualified contribution | Reference |
| --- | --- | --- |
| 8A | Codex AI Center connection, reference adapter and lifecycle | Green at `0.8.6`; Phase 8 plan and 8A qualification-loop records |
| 8B | Direct AgentTask/AgentRun, fixed ExecutionGrant, isolated candidate and Dope-owned authoritative promotion | Green at `0.8.13`; Phase 8B plan / ADR 0028 |
| 8C | AgentTaskSequence, Prompt Stack Git/version/manual gates and recovery, real Adaptive SEO dogfood | Green for `0.8.20` scope and subsequent bounded correction evidence; Phase 8 plan / `docs/tasks/c8-work-mode/closeout.md` |
| 8D | WorkItem-origin tasks, HUMAN/AI/SHARED ownership, frozen review, accept/reject, steering and map impact | Green at `0.8.33` source `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec` via `docs/tasks/c8-fix/closeout.md` cycle 2; original `docs/tasks/p8d/closeout.md` P13 **NOT GREEN** remains unchanged history |
| 8E | Local LM Studio agent harness, OS-contained broker, AI Center capability, shared Work/Dope validation, hosted comparison | Green at `0.8.47` source `bcc5cb8b9f7ee565bf443122ca18b92beb6e0d06`; `docs/tasks/p8e/closeout.md` |

Earlier c8 authority/candidate-validation, c8-work-mode and historical 8A–8C correction dispositions retain their original exact-candidate meaning; this owner closeout does not broaden their evidence.

## Scope limits and safety

Phase 8 Green is **limited to the approved and directly evidenced scope**. The 8E local reference is the specified Qwen model, measured loaded context, Linux x86-64 sandbox and observed Direct Work/WorkItem tasks. Live LM Studio model unload, reduced-context load, transport failure and unexpected tool result were **not deliberately induced**; their deterministic guards passed but these variants remain unqualified live scenarios. No arbitrary local-model parity, complex-task superiority, packaged-native distribution, production deployment, every operating system or every model failure path is claimed.

ADR 0028/0029/0031 authority remains unchanged: developer-accepted grant, isolated ExecutionWorkspace, frozen CandidateDelta, Dope-owned ValidationWorkspace and Authority/ToolExecutor promotion. Provider output cannot grant itself Git writes/history, private state, network/loopback, outside-root paths, delete/rename or other denied effects. No hidden hosted fallback or automatic canonical Software Map adoption is authorized. Phase 5/6 owner-sequencing waivers and original 8D P13 Not Green remain historical rather than being relabeled Green.

## Transition

**Phase 8: OWNER-CLOSED / GREEN for approved scope.** **Phase 9 — Development Sessions: NEXT / NOT ACTIVATED.** Phase 9 requires separate owner activation, fresh docs/architecture review, explicit source/version baseline and an optimized implementation Prompt Stack. No `0.9.0` manifest has been created; Phase 10 background alignment is not implemented.

This is a **documentation-only** owner closeout based on committed P14 evidence. No new GUI run, local inference, aggregate, sandbox test, native build, package or deployment was performed for this decision. Historical P14 logs, original P13 Not Green and later c8-fix Green evidence remain intact.
