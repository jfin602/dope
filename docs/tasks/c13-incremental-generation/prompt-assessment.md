# /prompt-ass — c13-incremental-generation

**Owner-approved scope (2026-11-08):** Implement ADR 0055 after the already-running Phase 13 R3B recovery task. **State:** assessment and prompt authoring only; no product changes or execution. **GitHub authoring basis:** main `eb11adb05b1bd228894cbd45f075f875d3d6d89e`, manifest version `0.13.11`. The owner's live checkout may contain newer, dirty R3B output; all execution must inspect its actual state before touching code.

## Outcome and acceptance

Make **incremental Pi tool-driven proposal generation the default** for native `/docs-review` and `/prompt-write <folder>`. One explicit protected Chat command owns one durable proposal session; Pi reads relevant project sources and stages bounded typed changes across multiple model/tool interactions; **Dope** owns accumulated candidate bytes, source identities, ordering, consistency checks, digest and final review packet. A protected `proposal_finish({ finalMessage })` seals a complete validated candidate and renders the sanitized natural-language finalMessage *above* exactly one native proposal card. Staging and preview must not write canonical files; card Accept remains the existing respective Docs application owner or distinct R3B Prompt Stack publisher.

The new correction must handle a long multi-file Docs edit and a **10+ prompt, substantial-content** executable stack without a giant single model-output JSON object or a four-work-item authoring cap. Preserve deterministic shared boilerplate/grammar where it adds value; multiple bounded tool arguments still have strictly checked schemas.

## Existing source and key boundaries observed in current main

| Owner | Source to inspect locally | Current behavior / seam |
| --- | --- | --- |
| Protected skills and Chat turn | `packages/theia-extension/src/node/chat-skills.ts`, `chat-backend.ts`; `packages/chat/src/service.ts`, models/repository | Protected command identification, saved Chat, project lease, model routing, tool brokering and final completion |
| Pi model/tool loop | `packages/theia-extension/src/node/chat-backend.ts` `projectTools`; local-agent/Pi bridge implementation and `test/unit/pi-conversation-runtime.test.ts` | Project read/search tools; authoring turns deny `run_command`. Inspect real tool-registration boundary, not guessed APIs |
| Docs generation | `packages/theia-extension/src/node/documentation-skill-review.ts`, `documentation-discovery.ts`, `documentation-review.ts`, `documentation-application.ts` | Final model text parsed into one JSON changes packet (4 changes, 60 KB output); exact unique replacements can preserve original bytes |
| Prompt generation | `packages/theia-extension/src/node/prompt-authoring-stage.ts`, `packages/agent-core/src/phase-stack-composer.ts` | Final model compact JSON outline capped at four work entries; deterministic composer supports broader count but 12,000 characters per rendered prompt |
| Native review | `packages/theia-extension/src/browser/chat-panel-widget.ts`, native document proposal tabs and R3B's **actual newly delivered** native Prompt Stack card/publisher (not assumed present) | Existing proposal card Accept/Reject/Revise and readonly Theia tabs. Do not replace them with new UI or a second publisher |
| Tests | `test/unit/documentation-skill-review.test.ts`, `documentation-skill-backend.test.ts`, `prompt-authoring-stage.test.ts`, `phase-stack-composer.test.ts`, `chat-backend.test.ts`, `pi-conversation-runtime.test.ts`, `native-doc-editor-proposal.test.ts`, `phase-stack-ui.test.ts` | Relevant focused tests exist; determine direct source vs compiled `lib` imports before selecting build commands |

No claim that new post-R3B source already exists on GitHub main. R3B is underway in the owner's checkout; never overwrite, replay, or expand its task. Source inventory/line references in this assessment are prompts for **actual local verification**, not authoritative future implementation facts.

## Preservation and authority

- Maintain one existing Chat/Pi runtime, selected model, brokered source reads, Ask/Allow, cancel/retry/continuation, saved conversation and root/worktree/owner/lease protections. Model prose and quoted commands are not trusted invocations.
- Staged candidates are noncanonical and **cannot** create files, run commands, grant Work, publish a stack, record applied-only History, qualify a Roadmap Criterion/Gate, or mark a Phase Done.
- Docs proposal publisher may create/update eligible documents only; no new delete/rename privilege. Keep exact source/excerpt evidence, byte/hash preservation, real source drift and path protections.
- Prompt Stack publisher is **distinct**. Reuse the R3B card, journal, publication and Work-discovery boundary as actually delivered; preserve selected `/prompt-ass` and `/prompt-plan`, correct grammar/dependencies/one terminal manual closeout, and immutable previously accepted/executed prompts.
- Keep ADR 0054 real Theia `.md`/`.txt` editor, native virtual read-only proposal tabs, Open All Files and existing UI/theme patterns. No second Documents workspace.
- Preserve R3A scoped PASS, R3B's actual independent qualification, legacy NOT GREEN/evidence gaps, and Phase 13 R3/R2/R4 until owner explicitly updates their instructions after this correction.

## Risks and mitigations

1. **R3B source drift:** original GitHub authoring baseline does not contain active local R3B implementation. At run start require actual source/dirty-tree inspection and source-backed R3B qualification; stop BLOCKED if absent/unsafe, never invent duplicate publisher.
2. **Unbounded Pi loops/context pollution:** set server-side per-stage/per-file/total bytes, call and elapsed-time budgets; short receipts and compact state summaries; no echo of accumulating proposed bytes.
3. **Incomplete or wrong packet:** typed stage identities + monotonic sequence + per-target digest, durable stage snapshots, and one backend `proposal_finish` that validates complete coverage and final bytes independently of model claims.
4. **Stale/unsafe writes:** never allow model tools to call canonical FileService/write_file; keep existing Docs/Prompt publishers solely after human Accept, with source/owner/role/path/collision rechecks.
5. **Context/retry bugs:** candidate revision copy-on-write; idempotent stage replay; stale or wrong-project denial; stopped/cancelled partials nonactionable; restart does not recover spurious approval.
6. **UI false completion:** progressive stages are visually provisional; Accept disabled until sealed; `finalMessage` untrusted display only, rendered once above card after successful finish.
7. **Runner correctness:** version `0.13.11` unchanged, no preemptive product Green from commits; P1–P5 headless T1/T2 with a final independently manual P6 T3 live run.

## Prompt boundaries and validation tiers

| Prompt | Narrow responsibility | Tier | Runner |
| --- | --- | --- | --- |
| P1 | Shared durable incremental staging controller + bounded typed Pi tool interface | T1 | Yes |
| P2 | Wire `/docs-review` through incremental document stage/finish; preserve Docs owner | T1 | Yes |
| P3 | Wire `/prompt-write` through incremental prompt stage/finish and deterministic composer | T1 | Yes |
| P4 | Progress/finalMessage + single existing native Chat/readonly proposal presentation | T1 | Yes |
| P5 | Cross-domain lifecycle/authority regression and long-stack headless integration | T2 | Yes |
| P6 | Real connected Codex browser, GPT-OSS 20B, independent manual closeout | T3 | **No — manual** |

**Deferred:** R3/R2/R4 downstream Roadmap/Work recovery, changes to R3B itself, general model-speed optimization, new publishing or delete powers, native Electron parity without observation and unrelated UI revamps. These cannot dilute required security/approval checks.

**Evidence required:** actual source/diff/compile/test receipts at each runner prompt; independent P6 browser observations with exact served SHA, local-model outputs, 10+ prompt files, long Docs edits and all negative authority cases. A completed commit, a mocked tool call or model-prose success is not qualification.
