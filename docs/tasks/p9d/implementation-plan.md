# /prompt-plan — p9d Final Phase 9 Implementation Plan

**Status:** SOURCE-INSPECTED / PLANNED / NOT OWNER-ACTIVATED
**Entry:** 0.9.22 / 0752415. Current design ADR 0034; former Session 9C P10 unexecuted. Historical 9A/9B bounded Green preserved, Phase 9 NOT QUALIFIED.
**Version law:** P1–P13 are 0.9.23–0.9.35; each assigned prompt advances all 13 root/app/package manifest versions plus pinned internal @dope/* references. Runner verifies but does not bump. Manual P13 requires a legitimate separate 0.9.35 source/version commit BEFORE evidence-only closeout. Keep yarn.lock, unrelated dependencies and absence of root package-lock.

## Execution seams

**P1 — Legacy export (T2).** New standalone offline scripts/export-legacy-development-sessions.mjs, archival guide and test. Read existing DeveloperSessionStore/contract as reference but exporter must still run after those modules are removed. Safe local project path, v1/v2, explicit user request, output to stdout, bounded validation; original bytes unchanged. Reject or clearly report copied-root mismatches/corruption. Validate malformed/symlink/oversize and owner bytes. No product Runtime Session dependency.

**P2 — Frontend retirement (T1).** Remove developer-session-widget/controller/navigation/presentation and left Sessions launcher/command/CSS from frontend-module; tolerate old layout restoration safely. Keep right and left Chat/Work and Planning/Mind editor behavior. Delete obsolete UI tests/test:product registrations explicitly with their implementation; targeted existing panel tests/typecheck.

**P3 — Backend/domain retirement (T2).** Remove Session-specific contracts, backend/store/resolver/candidates and backend-module RPC/DI after tracing consumers. Rehome neutral read-only metadata primitives when needed for P5/P6, not Session entities. Preserve AgentTask persisted origin compatibility, offline exporter, and all legacy user data. Negative production runtime/registration checks, bounded Chat/Agent/Planning tests.

**P4 — Projection contract (T1).** Pure History entry/target types and bounded deterministic ordering, dedup, sources, timestamp/unknown/snapshot state, suggested-vs-observed continue. WorkItem/run/validation truth separate. New history-projection.test.ts.

**P5 — Read-only Chat/Planning/Mind (T2).** Extend ChatRepository.peek* metadata path for non-recovering lastInteractedAt (no ChatBackend.read/list). Bounded root-safe PlanningStore/ProjectMindStore metadata projections with no writes/rebase/Mind initialization. New history-owner-metadata.test.ts with interrupted Chat byte checks.

**P6 — Agent/Git metadata (T2).** Compact scoped task/run/sequence validation-review-promotion metadata and fixed-argument bounded read-only Git commit + current dirty snapshot. Never read/copy transcripts/diffs or fabricate edit history. history-work-git.test.ts with disposable real Git.

**P7 — History panel (T1).** Right activity bar History button next to Chat/Work in frontend-module; supported view contribution and narrow backend RPC over P5/P6, one idempotent right widget. Compact Continue header, Recent Activity, Understanding action placeholder, accessible neutral dark/light style. history-panel/back-end tests; no real GUI claim until P13.

**P8 — Meaningful focus (T2).** Reuse normal workbench restore/focus when sufficient; otherwise minimal bounded per-project last meaningful owner target and observed time. Exclude History opening/scrolling, cancel late root changes, withstand restart/corruption. history-focus.test.ts.

**P9 — Owner navigation (T2).** Narrow adapter calling ChatOpenOwners/WorkOpenOwners, PlanningMapController, ProjectMindWidget, editor opener. Reuse neutral functionality from former Session navigation without hidden Session types. Exact root/item checks around awaits; no new agent execution or duplicate writer. history-navigation.test.ts.

**P10 — Context preview (T1).** Explicit user-selected bounded, inspectable evidence package with hashes/provenance, omissions and stale basis; excludes transcript/tool/secrets and does not call provider. history-context-preview.test.ts.

**P11 — Local understanding (T2).** After explicit preview confirmation, use existing ModelConnectionsRegistry/AIRoleRoutingService and conversational runtime with hard locality local-only, hostedProjectDataAuthorized=false and no hosted fallback. Cancellable ephemeral explanation (Facts/Interpretation/Unknowns) with references, output caps, no Chat or Agent writes. history-local-understanding.test.ts including hosted denial.

**P12 — Integrated safety (T2).** Focused cross-owner migration/export, panel, model, restart/isolation and no-History regressions; negative Session production wiring check. One scoped node --test pass covering changed seams, minimal dependency build/typecheck, no full npm run check or pretend GUI.

**P13 — Manual final Phase 9 closeout (T3).** Separate coherent 0.9.35 source/version commit, real Theia GUI (right-toolbar History, Continue, chronology, actual local explanation, restart, A/B isolation and no-AI normal work), legacy export/no writes, no execution/hosted egress. One full final npm run check plus independent required safety/restart proof on same candidate; docs/tasks/p9d/closeout.md records exact SHA and GREEN/NOT GREEN for **Phase 9 overall**, with observed failures. Current docs reconciliation once; owner close and Phase 10 activation remain separate.

## Implementation budget and boundaries

Tests in test/unit import compiled package lib; compile only affected package outputs and transitive consumers, not a blanket build after each task. New test entries appear once in root test:product. P1–P11 are bounded owner seams (T2 longer only for necessary integration), P12 combines final affected regression, P13 is the sole T3 GUI and aggregate. No second event database, no manual Sessions, no automatic context, no Phase 10 background alignment, no Phase 9E. Separate owner activation at docs/planning/p9/phase-9d-activation.md mandatory before P1.
