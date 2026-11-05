# c13-doc-routing — P1 entry recovery and conditional correction start (2026-11-05)

**Owner request:** Revise the existing `c13-doc-routing` prompt stack against current committed Dope code after its first P1 attempt stopped on an obsolete P4-PASS prerequisite. **Product basis at request:** main `7fce64a178de37cf7ff1aa7e98c145a1983d461d`, coherent `0.13.8`. **Disposition:** P1 entry attempt BLOCKED / no implementation; P2–P4 not executed; correction P5 and p13 P9 NOT GREEN. This note is a *prospective correction-entry decision*, not an owner-reviewed P4 PASS, Work grant or permission to qualify Roadmap GREEN.

## Why the entry changed

[Original P4 Checkpoint A](../../p13/qualification/checkpoint-a.md) reports BLOCKED / NOT GREEN and incomplete live negative/WorkItem coverage; preserve its recorded observations. The [later P13 P5-only conditional decision](../../p13/qualification/p5-conditional-entry-2026-11-05.md) independently verified Planning lock, Prepare Work linkage and applicable safety interfaces on a prior source, and authorized **P5 entry only**; it did not authorize a global PASS. The owner now specifically requests correction of this stack's P1 entry deadlock so missing documentation-routing implementation can proceed before p13 P9.

The first `c13-doc-routing` P1 invocation at `7fce64a1` returned with zero file changes, so the runner reported no-change commit-boundary failure. Preserve that invocation/output as historical evidence; the [original P1 prompt bytes](../archive/P1-attempted-2026-11-05.txt) are archived. The revised P1 prompt is a prospective retry and must **not** be represented as previously executed or qualified.

## Narrow progression decision

Permit c13 correction P1–P4 implementation to begin at verified p13 P8 / `0.13.8` despite absent P4 full-browser PASS **only when** the current source independently confirms the APIs and safety properties consumed by this correction: canonical task/run/WorkItem and Roadmap identities, locked source and permission boundaries, candidate review and grant enforcement, correct source/project/root attribution and a safe unchanged worktree. Reuse the prior P5 decision as historical supporting context, but verify applicability to current source; a commit/version marker alone is insufficient. Stop immediately for missing essential ownership, source drift, unauthorized access or known safety-critical failure. No automatic P9 run follows this permission.

The root and nested AGENTS flow, bounded reads, Task Contract and safe recovery remain **implementation requirements**, not presumed existing behavior. Current source inspected for this replan includes `packages/theia-extension/src/node/{pi-work-execution,agent-execution-runtime,workflow-lineage,planning-bridge-approvals,roadmap-work-evidence}.ts` and `packages/pi-runtime/worker.mjs`. The isolated Pi worker currently exposes empty `getAgentsFiles`; Work has brokered `read_file`/`list_files`, exact hash-bound page continuation and protected candidate tool effects. Reverify these details on the executing checkout.

## Deferred qualification, not a waiver

1. Correction manual P5 must demonstrate real AGENTS-first, bounded documentation routing, safe recovery and actual coding/tests in connected Codex in-app browser (or another real connected browser), with explicit owner-reviewed source-bound PASS. No model narration or mock substitutes.
2. Before p13 P9 PASS, replay any P4 case whose seams changed and complete all carried P4 live requirements: Planning Map/WorkItem handoff without implicit grant, locked/editable Phase behavior, review/read-only controls, source-stale and negative/reconciliation cases.
3. P9, P12, correction F1 and P13 retain their independent evidence/owner-closeout boundaries. An unverified case remains EVIDENCE GAP; historical reports remain unchanged. The correction must keep product `0.13.8`, 13 manifests/20 pins and all original p13 prompt bytes unchanged until a separately approved version transition.

**Resume:** inspect HEAD/dirty work and P8 provenance; validate `npm run codex:phase:validate -- c13-doc-routing`; on a separately deliberate owner Run, use `npm run codex:phase -- c13-doc-routing`. Do not claim a local validation was run merely because these instructions were updated in GitHub.
