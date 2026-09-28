# Product Phase 2 Prompt Assessment

Status: APPROVED/PREPARED — EXECUTION BLOCKED
Baseline: `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`
Package baseline: `0.2.0`; baseline repair and pending sequencing eligibility: `docs/planning/p2/activation.md`
Authority: `docs/planning/p2/phase-2-plan.md`

## Conclusion and dependencies

Use six ordered prompts. Storage/UI depend on the domain schema; UI depends on durable revision-aware transport; restart/package verification depends on actual UI integration; GUI dogfooding depends on the packaged/automated candidate; closeout audits the exact successful manual handoff. No new runtime subsystem or framework investigation is required.

Preparation approval is not activation. Keep Phase 1 Not Qualified truth and require qualification or a separately recorded sequencing waiver before committed `0.2.0` activation. This stack does not repair Phase 1 or silently inherit a Green IDE claim. Reassess affected assumptions if a Phase 1 correction changes source.

| Prompt | Boundary | Evidence | Routing |
| --- | --- | --- | --- |
| P1 | DTOs and one real Project Intelligence package | Framework-independent type/lifecycle/link/query validation | GPT-6 Sol High |
| P2 | Node adapter and typed backend | Migration, failed writes, lock/revision conflicts and project isolation | GPT-6 Sol High |
| P3 | Existing Theia presentation | Dirty draft/stale response/event cleanup and accessible controls | GPT-6 Sol High |
| P4 | Integrated application/process/package | Reopen/restart and exact AppImage/resources/native launch | GPT-6 Sol High |
| P5 | Actual developer workflow | Direct GUI on Dope and second local project; manual handoff | GPT-6 Sol High |
| P6 | Evidence audit only | Exact-candidate Qualified/Not Qualified and retained failures | GPT-6 Sol Medium |

P1-P4 are runner-owned; P5 is the only interactive/manual prompt; P6 is final closeout. No XHigh is planned. Version targets are exactly `0.2.1` through `0.2.6`; no Phase 3 prompts.

## Current source and behavior to preserve

The strict spike Note contract has stable UUID and developer provenance but no timestamps/status/links. One readable JSON file and temporary replacement already exist. Same-process write queuing and event/disposal behavior are reusable; they do not provide cross-process exclusion or optimistic revisions. The widget has a load-generation guard only for read rendering, no save-completion project guard, and no dirty-draft protection against events/switches. Existing tests cover Note identity/reconstruction, corrupt/future data preservation, events and transport separation.

Preserve Theia 1.75.0/Electron baseline, ordinary IDE foreground, WorkspaceMode, extension testing pin and user-controlled themes. Keep legacy Note reading until explicit migration replaces its UI path. Domain code remains free of framework/provider imports, and readable knowledge remains recoverable externally.

## Applicable risk and required checks

- Persistence: duplicate migration, invented dates, unsupported schema overwrites, partial writes/acknowledgement, abandoned locks and lost updates. Permanent data-preservation/revision/independent-process tests are required.
- Filesystem/project scope: arbitrary client URI, traversal/symlink storage redirection, wrong project/handle and missing file references. Validate at the backend and test two roots.
- Presentation: late read/save/event on a different project, dirty draft replaced by notification, disposed callbacks and false saved indicators. Test controlled delayed responses and visible conflict/error state.
- Integrated reality: app restart may stall despite unit/headless passes; native package may omit new code/resources. P4/P5 own separate evidence; exact candidates and logs must be recorded.
- Git: knowledge capture intentionally writes `.dope`; distinguish those approved writes from controlled source probes and preserve unrelated changes.

## Stability answers

1. Behavior at risk: spike Note access/migration, normal IDE startup, new artifact editing/navigation/search and restart/package composition.
2. Invariants: canonical knowledge belongs to Project Intelligence; UI/profile/provider state is derived; no implicit Idea promotion or privileged self mode.
3. Integrated-only evidence: usable restart, actual search/link/edit flow, keyboard/theme presentation and packaged native launch.
4. Baseline: exact `0.1.6` closeout source; future activation is recorded separately after gate resolution.
5. Durable knowledge: approved contracts, storage/recovery guide, package/restart evidence, GUI matrix and closeout.
6. UI-state risk: selected artifact, unsaved draft, filters, search and layout do not become canonical artifact content automatically.
7. Provider coupling: zero model dependency or AI runtime; future vocabulary does not authorize implementation.

## Deferred

Database/index service, semantic search, AI/automatic ingestion, Plan/Task, Sessions, remote/multi-root support and team/sync infrastructure. One readable collection and one exclusive mutation lock are sufficient for this bounded scope; document the snapshot-size ceiling in implementation.
