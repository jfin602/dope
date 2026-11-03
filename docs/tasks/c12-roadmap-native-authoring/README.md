> **2026-11-02 RUNNER AUTHORING SUCCESSOR:** The owner selected the unified [c12-roadmap-sync](../c12-roadmap-sync/README.md) correction for implementation. Its assessment/plan, P1–P9 runner prompts and manual P10 Codex-Chrome closeout now cover this R1–R5 design **plus full ADR 0046 formal Undo/Redo and reviewed restore**. This README remains an earlier design-only index, not a second runnable stack. Do not run overlapping c12-undo prompts concurrently or rewrite their historical evidence. No product implementation/Green/version change is claimed by prompt authoring.

# c12-roadmap-native-authoring — Native generation, granular canvas editing and automatic Markdown sync

**Owner direction:** 2026-11-02 (America/Chicago). **Status:** DOCS/ARCHITECTURE APPROVED ONLY — NO IMPLEMENTATION PROMPTS AUTHORED, NO RUN, NO GREEN, NO PRODUCT VERSION CHANGE. **Reference:** [ADR 0047](../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md) · [Detailed contract](../../planning/p12/native-roadmap-authoring-contract.md).

## Scope

Replace fragile response-parsed Roadmap mutation with Pi-brokered, versioned typed staged operations. Reuse schema-2 RoadmapStore/Service/ProjectPlanningActions, the one saved ChatPanel proposal card and existing horizontal center-editor canvas. Deliver individual/Phase-group/selected/all-remaining decisions, atomic subset commits with dependency checks, pencil-based direct field editing and a single initial Markdown selection/confirm flow followed by background checked synchronization. Integrate existing ADR 0046 revision/restore and History semantics; do not invent new writer, rollback path, model privileges, automatic GREEN or giant setup form.

## Five independently qualified corrections (planning only)

| Gate | Delivery | Acceptance boundary |
| --- | --- | --- |
| R1 — Native protocol and staging | Read/stage/preview/cancel with typed bounded schema-2 tool calls and incremental local-model generation; remove text parsing as authoritative writer | Verified Phase/Gate/Criterion identities survive staged preview, no silent malformed/partial success |
| R2 — Granular transactions | Individual, parent/group, selected and remaining bulk decisions; dependency closure, partial revision rebasing and idempotency | Exactly selected valid subset commits atomically; rejected and stale operations do not write |
| R3 — Canvas direct editing and review | Pencil per field, safe local save/cancel/stale handling, same proposal backend in Chat and canvas, retire large editing form after parity | Browser-visible editing and granular review, focus and history overlay isolation |
| R4 — File link, sync and revisions | One-time destination+confirm, durable automatic source synchronization, conflicts/restart, proposal transaction integration with ADR 0046 | Exact source hashes/mappings, protected unrelated prose, truthful pending/conflict, append-only receipts |
| R5 — Real-use qualification | Real local-model tower-defense generation + full connected Chrome and native Electron evidence | Nested Gates match Chat/preview/index/canvas/Markdown after reload; all required security/recovery cases pass or explicitly NOT GREEN |

## Sequencing and protections

Before writing prompts or implementation, inspect actual local HEAD/status/dirty files and current implementation/evidence. Preserve existing changes, source-bound history and prior NOT GREEN. In particular reconcile existing c12-roadmap-publish-ux Unit A (persistent inline proposal cards) and Unit B (currently explicit publication), c12-undo archive/restore, c12-planning-recovery protected /roadmap, Pi tool broker, schema-2 linked Markdown adapter and c11-roadmap-redesign-v2 historical Roadmap contract. Do not run existing immutable prompts out of sequence or reinterpret their qualification.

This README is a proposed correction stack index, **not an executable runner**. Dedicated assessment, implementation plan and R1–R5 prompts require a later explicit owner /prompt-ass + /prompt-plan + /prompt-write or equivalent authorization. No automatic work begins from /docs-apply.
