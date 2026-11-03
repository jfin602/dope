# c12-rmr-man/fast — Fast typed Roadmap creation and canvas-only review

**Owner direction:** 2026-11-03 (America/Chicago), following `/docs-review → /docs-apply → /prompt-ass → /prompt-plan + /prompt-write`. **Status: ASSESSED / PLANNED / SIX MANUAL PROMPTS AUTHORED ONLY.** No product implementation, execution, test qualification, version bump, provider switch or Phase 12 GREEN is claimed by creating this folder. Documentation source reference: `8447c4ac801329c9a228cfd09a01304c6a426b93` on GitHub main; the operator must verify their **actual local checkout** before each task.

**Goal:** Restore useful, fast Roadmap creation without giving the local model per-element transaction choreography. Prefer one completed typed Phase → Gate → Criterion proposal, attach trusted metadata and stable IDs in Dope, validate/preview through the **existing** schema-2 backend owner, and review **only on the Roadmap canvas**. Chat is one compact progress/result summary with View in Roadmap. Incremental rendering is optional and must add no model/tool latency. Reuse native granular tooling for edits and bounded fallback. No prose-to-canonical parsing.

## Manual execution (not codex:phase)

| Prompt | Primary responsibility | Tier |
| --- | --- | --- |
| [F1 — Benchmark](F1-generation-benchmark.txt) | Matched latency/quality baseline, no production edits | T2/T3 observational |
| [F2 — Typed output](F2-typed-greenfield-generation.txt) | Compact, complete, local-model-friendly typed proposal envelope | T1 |
| [F3 — Existing authority](F3-typed-proposal-authority.txt) | Convert validated structure into existing noncanonical proposal and subset transaction service | T2 |
| [F4 — Canvas review](F4-canvas-contextual-review.txt) | Contextual selection and one integrated review toolbar; remove floating raw-operation list after parity | T1/T2 |
| [F5 — Chat consolidation](F5-chat-summary-navigation.txt) | One durable compact Chat status/summary + View; remove duplicate normal Roadmap approval buttons after F4 parity | T1 |
| [F6 — Final qualification](F6-connected-chrome-qualification.txt) | Real selected-local-model Chrome/benchmark comparison, safety, reviewed subset persistence | T3 manual |

Copy/run **one prompt manually** at a time in Sol High. No runner invocation, automatic chaining, /activate, self-commit, or unapproved owner-project writes. A failed security/authority prerequisite blocks dependent work; non-security benchmark deficiencies are recorded and may permit **explicit conditional** progress for a measurable prototype, never fake benchmark PASS. F6 never starts until F2–F5 safety critical paths are demonstrated.

**Source rules:** Read [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [ADR 0047](../../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md), and [native authoring contract](../../../planning/p12/native-roadmap-authoring-contract.md) before executing. Preserve old `c12-rmr-man/r4-r` prompts and dated R3/R4/R4-R3-R1/R4-R3-R2 NOT GREEN records unchanged. The original `c12-roadmap-sync` P9 and P10-A linked Markdown/manual-authoring issues remain independent. The connected Chrome preference is **Google Chrome**; native Electron GUI qualification requires a separate owner observation.

**Finish:** F1 establishes a defensible benchmark, F2/F3 generate a complete safe reviewable tree, F4/F5 consolidate the UI without changing approval authority, and F6 evaluates correct full MVP coverage, useful latency, no-write before Apply, selected decision receipts and reload in the real built app. Each manual step reports Implementation / Verification / Progression independently. **Exactly one final F6 closeout**; no other prompt may claim stack or Phase 12 GREEN.
