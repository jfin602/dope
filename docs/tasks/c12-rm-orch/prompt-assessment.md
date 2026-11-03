# /prompt-ass — c12-rm-orch source-grounded design assessment

**Decision:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md). **Status:** assessed against repository documentation and known owner-reported runs; **not** a verified inspection of the current local dirty checkout. P1 requires actual source audit.

## What is observed versus hypothesized

- Earlier Qwen3.5-9B local generation yielded a useful Phase + checklist plan in about 2m13s, but output structure varied; phase-only extraction lost children. This demonstrates useful planning, not a reliable parser contract.
- Strict large JSON and RM1 attempts failed to deliver acceptable full Roadmaps consistently; a documented F6 trial emitted reasoning only with zero usable final draft. A two-pass natural-to-RM1 D2 path reached source-level partial/hold with unverified live success. The owner reports later >6-minute runs and no reliable final result. Precise latency attribution is **not established**.
- User-observed small individual Roadmap edits, project awareness and conversational answers are the strongest working 9B building blocks; a full incremental controller is **not yet demonstrated**.
- Existing documents identify schema-2 RoadmapStore/Service, ProjectPlanningActions, native Pi staging, typed candidate owner, single proposal, canvas granular selection, Markdown sync and History as existing/partially qualified seams. Do not confuse docs contracts with implementation proof or old PASS claims with current HEAD.

## Decision matrix

| Option | Status | Why |
| --- | --- | --- |
| Return to original freeform full plan + tolerant parser | Reject as production generator | Variable output creates unbounded ambiguity; no guaranteed nested Gate/Criteria capture |
| Large typed JSON whole Roadmap | Retire | Excess structured burden for 9B; observed failures |
| RM1 strict markers | Retire | Model deliberation/stall; fragile one-shot success |
| Two-pass natural → RM1 | Retire | Sequential conversion, extra latency and failure boundary |
| 30B model-only switch | Not the architectural fix | Potentially useful benchmark but latency/visible reasoning concerns; no automatic switch |
| **Dope-owned serial bounded Phase/Gate operations** | **Selected** | Fits demonstrated small operations; source-validated incremental progress; model not responsible for overall choreography |

The key cost is possible higher aggregate latency from multiple serial calls. It must be measured; no fabricated speed claim.

## Explicit removal inventory for P1

Inspect (without assumptions) actual Chat greenfield dispatch/routing, Pi prompt construction, response extractors, RM1 parser/test fixtures, `UntrustedTypedRoadmapCandidate` whole-plan converter uses, locked plan/second-pass lifecycle, old multi-batch plan coordinator, provider fallbacks, feature flags, UI phase cards/status strings and completion handlers. For each symbol classify **legacy generator exclusively**, **shared security/proposal owner**, or **unrelated Markdown/import/Chat functionality**; delete only the first class. Shared typed proposal/staging is preserved. Record all callsites and test owners so new controller is sole reachability root; tests replace old grammar assertions with new source/security expectations. Remove any dead code that could reintroduce old paths.

Do not delete historical docs/evidence or user-authored plans. In-flight old-format generation must terminate explicitly on cutover rather than silently upgrade; archived inert responses remain readable but never become new mutation authority. No compat shim.

## Proposed boundaries

Controller (Chat/backend) owns session identity/selected-model binding/call schedule; Pi runs only bounded actual native Phase/Gate edit calls; existing StageOwner owns noncanonical proposal + trusted root/project/revision/source identity; service owns canonical Apply/History/Markdown; canvas listens to validated proposal stage events. There is no planner-output parser and no second source of truth.

The initial content request must not demand a strict full plan. A current-Phase request can use minimal native tool argument schema, with Dope assigning IDs and stage scopes. If the model fails to call a usable tool, the controller safely retries a *targeted* small operation once, then marks incomplete. Additional calls do not modify the project without owner approval.

## Risks and negative scenarios

- **Lost context / repetition:** compact scope ledger + bounded project memory; duplicate/relation validation and visible gaps.
- **Bad end condition:** do not confuse model 'done' or Phase count with verified semantic completeness; capture uncovered requirements for human review.
- **Provisional/canonical confusion:** one proposal ID; incomplete stages non-applicable; actual Apply lease recheck; no GREEN from staged presence.
- **Stale/wrong source/project:** exact root/chat/turn/owner/revision/hash/lease/model constraints; fail closed and do not auto-rebase.
- **Cancellation races:** late Pi events discarded by generation ID; active calls aborted where supported; no new call after cancel.
- **UI backpressure:** nonblocking event transport, coalescing projection renders only; never delay inference or tool execution.
- **Runner/historical risk:** keep old reports, source receipts, dirty D2 code and independent Work/evidence/qualification concerns intact.

## Scope excluded

No Work agent/Gate GREEN automation (Phase 13), provider replacement/30B default, arbitrary parser training, new renderer/store/editor, global themes, unrelated Chat/Work polish, Git history rewriting or broad product-version bump.

## Assessment disposition

Proceed with P1 fail-closed legacy retirement and P2–P6 replacement on a safely reconciled local tree. P7 alone assesses real selected-model/browser behavior; exact-source native Electron owner test remains separately required. No guarantee of 2-minute totals or 100% project semantics before measurement.
