# c13-context-recovery — context policy and protected Pi failure recovery

**Status: ASSESSED / PLANNED / PROMPTS AUTHORED ONLY (2026-11-09).** Source basis `c32eb290`, product version `0.13.11` **unchanged**. This correction has not been run or technically qualified by authoring. [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md).

## Purpose

Make protected Assessment/Chat failure causes truthful, remove competing Dope-only generation/tool quotas, and replace numeric context settings with a per-Chat **Managed / Unmanaged** toggle. Managed selects task/stage/tool-aware capacity-fitting budgets; Unmanaged defers context management to Pi inside actual selected-model limits. Preserve native Ask/Allow/Cancel, permission/source guards, partial transcripts, and reviewed application.

**Why:** 16K, 32K, 64K source-matched Assessments returned `tool_protocol_unknown` with 4/5, 4/5 and 1/5 source coverage respectively. None reached output limit or `assessment_finish`. The source has a generic tool-16 cutoff despite protected Assessment's 128-tool allowance. This is a strong failure candidate for the first two, not proven historical attribution; the 64K early failure is unresolved. See [supplement](../c13-pfix/qualification/p8-r11-supplemental-32k-64k-benchmark-2026-11-09.md) and [forward plan](../c13-pfix/context-policy-correction-plan.md).

## Ordered runner stack

| Prompt | Responsibility | Validation | Browser |
| --- | --- | --- | --- |
| [P1](P1-worker-failure-origin.txt) | Worker-origin cause codes and >16 tool reproduction | T1 | No |
| [P2](P2-failure-propagation.txt) | Host/adapter/saved Chat diagnostics | T1 | No |
| [P3](P3-operation-policy-resolver.txt) | One trusted operation policy | T1 | No |
| [P4](P4-worker-policy-enforcement.txt) | Remove contradictory worker budgets | T1 | No |
| [P5](P5-chat-settings-migration.txt) | Managed/Unmanaged persisted schema | T1 | No |
| [P6](P6-chat-request-composition.txt) | Composer/backend policy application | T1 | No |
| [P7](P7-pi-capacity-binding.txt) | Pi bridge and provider capacity | T1 | No |
| [P8](P8-tool-result-paging.txt) | Tool/page/stage payload policy | T1 | No |
| [P9](P9-output-result-retention.txt) | Frame/aggregate result retention | T1 | No |
| [P10](P10-pi-compaction-continuation.txt) | Effect-safe Pi continuation integration | T2 | No |
| [P11](P11-context-toggle-integration.txt) | Settings control and targeted cross-boundary qualification | T2 | No |
| [P12](P12-manual-browser-closeout.txt) | Real GPT-OSS five-file Assessment + modes | T3 | **YES — MANUAL** |

**Dependency order:** P1→P2; P3→P4→P5→P6→P7→P8→P9→P10→P11→manual P12. P5 depends on P3 contract. Preserve all historical `c13-pfix` prompts/qualification and existing P13 R3B/R2/R4 owner boundaries; do not run them as a side effect.

## Future execution (separate owner Run required)

`npm run codex:phase:validate -- c13-context-recovery`

`npm run codex:phase -- c13-context-recovery`

Normal runner executes **P1–P11 only**, then stops at P12 manual browser handoff. **Do not invoke `--closeout`.** Runner owns commits. Check actual local checkout/HEAD/dirty work before Run; do not overwrite owner changes, assume remote matches local execution evidence or replay historical stacks. The T1 small-scope targets are ≤8 minutes implementation plus focused validation; T2 integration and T3 manually verified cases have their own evidence budgets.

## Completion and preserved truth

A successful repair must demonstrate the actual reason for worker stopping, genuine >16 protected tool operations within its resolved policy, and at least one complete five-file source-backed `assessment_finish` with a sealed Assessment and Plan availability on one coherent served product candidate. Managed/Unmanaged must demonstrably change runtime behavior, not just settings UI. Do not infer 32K/64K benefits from failed runs.

The original R9/R10/R11 **NOT GREEN/PARTIAL** reports stay unchanged. No product code, version, Work Run, Roadmap Gate/Phase Green, canonical publisher or real GUI proof arises from creating this prompt stack.
