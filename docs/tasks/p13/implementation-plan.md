# /prompt-plan — p13 Roadmap-Controlled Development

**Owner direction:** 2026-11-05. **Status:** plan and prompt authoring only, no implementation/qualification. **Baseline:** `0.13.0` committed `f908c447`. **Authority:** [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md), [contract](../../planning/p13/roadmap-work-lifecycle-contract.md), [assessment](prompt-assessment.md). **Execution folder:** `p13`. Former LSKM Phase 13 reservation deferred unassigned.

| Prompt | Target version | Smallest coherent change | Primary evidence |
| --- | --- | --- | --- |
| P1 | 0.13.1 | Durable Phase coverage lock/revision validation, without Work execution | Gate-set approval, project/source/lease rejects, other Phase editable |
| P2 | 0.13.2 | Exact locked-Phase → current Planning Bridge/WorkItem links and reviewed Prepare Work | ID basis, one-to-many links, stale/foreign/no-grant rejects |
| P3 | 0.13.3 | Canvas Planning/Ready labels, Finish Planning and locked editing affordances | status projection and keyboard/narrow/theme focused UI tests |
| P4 | 0.13.4 | Immutable validated Work/criterion evidence receipt association | source/candidate/trust checks, no naive exit-zero GREEN |
| P5 | 0.13.5 | Existing qualification owner consumes verified receipts; derived Gate/Phase eligibility | incomplete/failed/waived/unknown and passing cases |
| P6 | 0.13.6 | Reviewable post-lock amendments, affected-only stale/evidence invalidation | source drift and irrelevant-change discriminators |
| P7 | 0.13.7 | Restart-safe Work events, evidence/History navigation and receipt deduplication | interrupted/replayed/rejected run and immutable-history tests |
| P8 | 0.13.8 | Roadmap live Work/evidence monitoring with direct Work/History detail links | truthful UI counts, no competing status, no focus steal |
| P9 | 0.13.9 | Integration and security regression, precise dependency/authority proof | cross-owner end-to-end + negative matrix, source/build |
| P10 | 0.13.10 | Manual real browser + owner-native Phase 13 closeout | actual chosen model/run, promoted source, evidence, owner decision |

## Sequencing and dependency safety

P1's lock receipt supplies P2/P3 authority. P2's typed basis is needed before P4 association. P4 receipts are not statuses; P5 alone calls existing qualification boundary. P6 protects changed requirements/source; P7 durable replay/History; P8 renders reconciled facts; P9 verifies actual integration. P10 is manual and must not be fabricated by runner/test mocks. A later source repair invalidates only affected evidence and requires targeted requalification on final source.

## Universal preflight

Before each P*, read BOOT.md, AGENTS.md, docs/workflow.md, ADRs 0038/0040/0046/0047/0048/0049/0050/0051, the contract, actual current HEAD/tree/version and previous prompt effects. Verify tracked/dirty files without reset, stash or clean. Do not rerun/publish the historical generation stacks. Preserve Ask/Allow, source leases, candidate review and explicit execution grants. Do not self-commit, merge, release, rewrite earlier evidence or automatically move to next Phase on commit presence.

## Prompt efficiency audit

P1/P2 backend ownership separate from P3 UI; P4 immutable receipt intake separate from P5 qualification evaluator and P6 invalidation; P7 records/projections separate from P8 UI; P9 T2 source/security and P10 T3 human GUI. Ordinary prompts target <=8 minutes with hard 15-minute stop, inspect concrete existing source/tests, build only necessary packages and run one narrow test group each. P9/P10 hold expensive aggregate/browser/native coverage. No redundant per-prompt full builds, speculative performance claims or unqualified GREEN. Keep exactly one final manual P10 closeout.

