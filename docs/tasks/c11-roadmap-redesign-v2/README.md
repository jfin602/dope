# c11-roadmap-redesign-v2 — Qualified Gate-first Roadmap (Phase 11 final scope)

**CURRENT OWNER SCOPE CHANGE (2026-10-29):** Phase 11 is now **Roadmap-only**. The [owner exit amendment](../../planning/p11/roadmap-only-exit-amendment-2026-10-29.md) supersedes the previously planned Gate→WorkItems→prompt-stack/agent integration. **Do not execute former v2 P15–P23 Work-generation prompts.** Pi is a separate Phase 12 engine and future Gate-to-agent integration is deferred for later review after Pi evidence. Existing independent Work/Planning Map code remains intact, not deleted merely because it is deferred.
**Current reported progress:** P1–P13 have execution commits on GitHub main and P14 is **NOT GREEN** at source-bound attempted manual qualification. M1–M3 are the approved manual Chrome UX recovery, **NOT YET qualified by this documentation**. Product version `0.11.8`; Phase 11 OPEN / NOT QUALIFIED. Verify actual local HEAD, dirty worktree and current P14 evidence; never infer unobserved native/test results.
**Owner references:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md); [visual contract](../../planning/p11/roadmap-visual-hierarchy-contract.md); [manual M1–M3](manual/README.md); [assessment](prompt-assessment.md); [implementation plan](implementation-plan.md); [unstarted prompt supersession](roadmap-only-pending-supersession-2026-10-29.md).
**Source immutability:** P1–P14 authored `P*.txt` source remains byte-identical. Only unstarted former P15–P23 filenames are retired from active tree and new, distinct P15–P17 authored in their place. The runner requires contiguous P numbering, exactly ONE final closeout, and the exact previously required P14 PASS commit subject. This change is **reviewed future-source supersession**, not rewriting any started prompt or bypassing Git proof.

## Product boundary

Dope's Roadmap is a visual, conversational planning and qualification tool:
- Phase → required Gate → verifiable Criterion with explicit source/project identity, dependencies and correction ownership.
- Large legible horizontal Phase cards; nested expandable Gate content; visible Unplanned / Planned / Active / NOT GREEN / GREEN / Blocked / stale / waiver states, no fake completed percentage, readable normal default zoom and stable navigation.
- Existing freely dockable saved ChatPanel is the **primary editor**: reviewable typed Phase/Gate/criterion/relation/correction changes, preview/Accept/Reject, source/owner revision and evidence validation; no duplicate Chat/Roadmap authority or model-awarded Green.
- Selected item inspector is read-only until **Edit** toggled, then local field editing uses the same validated backend; cancel and conflict handling safe.
- Linked Markdown create/import/sync/relink/conflict/restart; explicit draft and publication approval, project isolation; alpha cleanup removes dead Roadmap checkpoint/milestone code with no broken-version compatibility shims.
- **Deferred:** Gate → Prepare Work / Planning Map / WorkItems / generated prompt stack / coding-agent execution / automatic Work result qualification. Do not implement, test as a Phase 11 exit gate, or claim this works now. If an existing Prepare Work CTA cannot be supported, make it visibly disabled with an honest deferred explanation; preserve independent actual Work capabilities.

## Current prompt execution

| Prompt(s) | Mode | Qualifying outcome |
| --- | --- | --- |
| P1–P13 | Existing runner commits | Gate domain, import/sync, drafts, local/chat semantics, card layout and inspector; **historical code slices, not full UI Green** |
| **P14 + M1–M3** | **Manual connected Chrome** | Large readable cards, prominent progression colors, full Chat-first Roadmap manipulation, selected-item Edit toggle and original P14 scenarios. Only actual M1–M3 + P14 PASS earns P14 Git marker. |
| **P15 — Roadmap alpha cleanup** | Runner | Delete obsolete unused Roadmap-specific checkpoint code and aliases; protect shared Work/History/Planning modules |
| **P16 — Roadmap tooling regressions** | Runner | Chat edits, manual edits, qualification/evidence, Markdown and layout tests with no Work generation |
| **P17 — Roadmap Phase 11 closeout** | **Independent manual Chrome** | Final Roadmap UI/Chat/source/security qualification plus explicit owner decision whether Phase 11 is closed for narrowed scope |

Manual M1–M3 source under `manual/*.md` remains unchanged; original P14 `P14-chrome-gate-ui-qualification.txt` remains immutable. Do **not** start P15 until real P14 Chrome PASS on the owner-corrected UI. Each runner prompt requires actual tests, not successful-looking output. No default whole-project/agent Work Run.

## Safe runner continuation

1. Check exact local P1–P13 commits, source and worktree, including any uncommitted P14/M1–M3 fixes; preserve all work (no forced reset/stash/clean). If local main is ahead of remote, `git fetch origin` and review a non-destructive merge of docs instead of assuming `git pull --ff-only` will work.
2. Manually run [M1](manual/M1-phase-layout-progression.md) → [M2](manual/M2-chat-first-roadmap-actions.md) → [M3](manual/M3-edit-toggle-p14-closeout.md) using real Codex Google Chrome. STOP on NOT GREEN. Original P14 NOT GREEN history is immutable.
3. Only on verified M1–M3+P14 PASS, create the exact source-bound **`c11-roadmap-redesign-v2/P14: Chrome UI integration qualification`** commit. No fake marker merely to unblock the runner.
4. Validate `npm run codex:phase:validate -- c11-roadmap-redesign-v2`. Resume `npm run codex:phase -- c11-roadmap-redesign-v2`; runner must recognize P1–P14 exact commit subjects and start **P15**, then run P16, then stop at **P17** for manual Chrome closeout. Stop if history/prefix disagrees; don't rewrite prompt source/history.
5. P17 records the qualified Roadmap scope plus native-Electron actual results or explicit owner-accepted native gap. **Phase 11 stays OPEN until an explicit owner closeout** based on the narrowed Roadmap-only contract; then Phase 12 version baseline and Pi qualification/Run are separate decisions.

**Historical source truth:** Original oversized P1 NOT GREEN, v2 original P14 NOT GREEN, older G3 Chrome gaps and incomplete Bridge/D1–D8/Hunts are preserved as historical unqualified/deferred work. No version bump, product implementation, Chrome qualification or Phase 11 Green occurs by this documentation change.
