# c11-roadmap-redesign-v2 — Gate-first Roadmap and Gate-to-Work control center

**Updated:** 2026-10-29. **Owner decision:** Update unexecuted P8 onward after P7 completion, retaining P1–P7 exact authored bytes and completed work. **Product version:** `0.11.8` unchanged. Phase 11 remains OPEN until separately qualified.
**Approved design:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md); [visual target contract](../../planning/p11/roadmap-visual-hierarchy-contract.md); owner reference `this-style.png`. [Prompt assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [pending-source supersession record](pending-prompt-supersession-2026-10-29.md).
**Existing entry approval:** [Owner-run authorization](qualification/2026-10-29-owner-run-authorization.md) established separate v2 execution intent. Do not demand another approval merely to enter an authorized prompt. Individual scope, source writes, prompt publication, Work Run, tool grants and Gate qualification retain their own explicit authority.

## Canonical outcome

**Phase -> required Gates -> testable Criteria** answers *what must pass*. **Gate -> approved Planning Map / WorkItems -> reviewable prompt stack -> explicitly approved agent Work -> source-bound evidence** answers *what to build and what was proven*. The Roadmap is the planning/progression control center; existing Planning Maps own architecture design, WorkItems own scoped implementation, the Prompt Stack Composer owns executable text, Work owns execution/grants/candidates, and Gate evidence owns qualification. No duplicate Chat, Roadmap store, Planning Map or coding agent runtime.

A WorkItem or prompt completing does NOT qualify a Gate. A Phase is GREEN only with owner-approved complete Gate coverage, every required Gate GREEN on current evidence and no blockers. The owner-approved horizontal phase cards/nested Gate foldouts/clean chronological arrows remain the visual target. Linked Markdown/source hash and explicit approval remain authoritative.

**Pi:** Phase 12 [ADR 0039](../../decisions/0039-bundled-pi-local-agent-runtime.md) will bundle Pi as local coding runtime through existing AI Center/Dope grant broker. V2 must produce **provider-neutral** Gate->Work/prompt contracts using current available agent runtime, not install Pi, require Pi-specific tool calls or silently switch models. Pi can plug in later without another prompt/qualification owner.

## Source-history rule (important)

The repository runner checks the **first committed bytes of each P*.txt path**; it rejects in-place edits as authored-source drift. The owner asked to change only remaining unstarted prompts. Thus P1–P7 are **untouched** and source-bound historical P1 failure evidence is preserved. The earlier **unstarted** P8–P19 paths are deleted from the active tree and their historical content remains in Git; newly named, materially revised P8–P23 files were added in this same v2 folder. Contiguous P numbering, original completed prefix, strict runner grammar, stable version and manual P14 checkpoint subject are preserved. [Full mapping and supersession rationale](pending-prompt-supersession-2026-10-29.md). This is reviewed future-source supersession, **not** a bypass of runner validation, a rewrite of started prompts, or fake completion.

## Execution map

| Span | Route | Single scope / acceptance |
| --- | --- | --- |
| P1–P7 | Runner — **reported completed locally** | Authoritative Phase/Gate domain, evidence/Phase eligibility, projection/service and typed planning action |
| P8 | Runner | Phase/Gate/criterion Markdown import |
| P9 | Runner | Lossless linked Markdown sync/relink |
| P10 | Runner | Proposed/accepted Gate greenfield drafts |
| P11 | Runner | Chat/local planning semantics, no task->Gate auto-conversion |
| P12 | Runner | Horizontal Phase cards + arrows |
| P13 | Runner | Nested Gate foldouts, inspector and selected Gate |
| **P14** | **Manual real Chrome** | Actual Gate/editor/visual GUI qualification (not yet agent handoff) |
| P15 | Runner | Gate-scoped Prepare Work and Planning Bridge owner identity |
| P16 | Runner | Gate criteria -> reviewed ready WorkItems |
| P17 | Runner | Gate WorkItems -> valid prompt-stack draft |
| P18 | Runner | Preview/publish + separate approved Work execution |
| P19 | Runner | Run/test evidence -> Gate qualification/status/correction links |
| P20 | Runner | Existing Dope Help and saved Chat guidance |
| P21 | Runner | Remove unused Roadmap checkpoint/milestone code |
| P22 | Runner | Provider-neutral end-to-end integration and source-bound tests |
| **P23** | **Manual real Chrome** | Independent full Gate->Work->evidence GUI closeout; native owner handoff |

Each implementation prompt is bounded to one owner/seam and focused source tests; no recurring three-cycle browser requirement on disconnected backend work. P14 and P23 need **real connected Codex Chrome**, not a browser build/JSDOM. Browser status is scoped. Phase 11/native Pi are independently qualified later.

## How to resume after P7

1. Preserve and verify local completed P1–P7 runner commits, clean/approved worktree and `0.11.8`. This authoring connection cannot see local unpushed runner commits; no P1–P7 PASS is asserted from GitHub remote. Reconcile Git history without losing the original completed commits or source evidence. If local main is ahead of origin/main, `git pull --ff-only` may refuse; use a reviewed non-destructive merge after `git fetch` rather than resetting or discarding commits.
2. Run `npm run codex:phase:validate -- c11-roadmap-redesign-v2`; inspect P8–P23 active prompt names. Then `npm run codex:phase -- c11-roadmap-redesign-v2`. The runner must identify P1–P7 as previously completed by their exact commit subjects and continue at P8. If it starts at P1, STOP and inspect the Git prefix; don't manufacture markers.
3. It stops at **P14**. After genuine Chrome PASS only, commit evidence (and qualified fixes) with exact subject `c11-roadmap-redesign-v2/P14: Chrome UI integration qualification`. Then rerun runner for P15–P22. It stops again at **P23** for independent manual Chrome closeout.
4. Use disposable project roots for rejection/security fixtures; preserve owner PixiJS game files, source Markdown, original P1 NOT GREEN evidence, and original accepted G3 limitations. No /activate, branch reset, force push, auto Work, surprise publication, version bump or hosted fallback. Block on real safety/authority/test failure; don't request redundant execution consent.

**This commit only revises future documents/prompts; it does not run new product work, local validator, browser or native qualification.**
