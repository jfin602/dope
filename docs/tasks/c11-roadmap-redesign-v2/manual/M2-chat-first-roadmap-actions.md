# M2 — Conversation-first Roadmap authoring through the existing ChatPanel

**Execution:** MANUAL implementation + qualification with **real Codex Google Chrome browser**. Model recommendation: GPT-6 Sol High. **Browser required: yes.** Depends on genuine M1 scoped PASS; does not alone qualify P14.

## Preflight and architectural authority

Read [manual README](README.md), ADR 0040/0036, current Roadmap visual contract, existing `ProjectPlanningActions`, `RoadmapService`, `RoadmapGreenfield`, `chat-backend.ts`, `roadmap-local-model.ts`, `chat-context-composer.ts`, `chat-panel-controller.ts`, selection context and saved Chat routes. Verify actual post-P13 schema/typed actions on local source (remote code may lag); don't assume old `RoadmapCheckpoint` API still exists. Protect exact owner/source hashes, local dirty P14 work and saved project state. No separate Chat, planning assistant, editor model or model-only writer. No version change or hosted fallback.

## Objective — Chat is the normal Roadmap editor

**All supported Roadmap authoring/edit operations must be possible using ordinary conversation in the same existing dockable saved ChatPanel.** Manual UI forms are secondary (M3). Do not require a multi-step Gate wizard, multiple nested menus or clicking individual fields to create structure.

Implement a trusted provider-neutral **Chat -> structured intent -> read-only diff/preview -> explicit Accept/Reject -> same existing Roadmap authority** flow, grounded in current project, Roadmap revision, selected Phase/Gate/correction and saved Chat identity. Reuse validated typed Roadmap/Greenfield actions and provenance; extend the *existing* action vocabulary only where a Gate operation is missing. The LLM can formulate **proposals**, not publish a linked Markdown document, waive a Gate, run Work, grant tools or claim Green on its own.

Coverage must include:
- **Phase:** create, rename, revise objective, reorder, remove (with impacted dependent Gate/Work disclosure), and select/focus.
- **Gate:** propose/add required Gate under explicit Phase, rename/revise objective, reorder/move within/between Phases (with parent/dependency validation), remove with preview of affected criteria/evidence/links, and select/focus.
- **Criterion:** add/edit/reorder/remove testable acceptance criteria, expected results, with source/evidence invalidation and Gate requalification when necessary.
- **Relations:** create/remove explicit Gate/Phase dependencies; attach/inspect/move corrections only under explicit valid parent; link appropriate Work/Planning source where authorized.
- **Qualification:** ask 'why not Green?', show missing/stale evidence and propose review of an evidence record, Gate-set completeness and explicit waiver. **No chat-authored naked Green/waiver status**; require actual evidence and owner-confirmed qualification/exception actions, no false state promotion.
- **Existing linked Markdown:** when a chat edit touches source-owned fields, route through the existing source-aware preview/approval/conflict/relink mechanism; Draft accept ≠ canonical Markdown publication.

Natural examples on a new disposable Roadmap:
> "Add a Phase called Combat Systems."
> "Put a Gate in Combat Systems requiring persistent main-tower health, and add a criterion that zero health ends the game."
> "Actually rename that Gate to Defeat and Health; move it above Tower Targeting."
> "Add a dependency on the enemy wave Gate."
> "Remove that mistaken criterion" / "Undo the last change."
> "Why isn't Phase 2 Green?" / "Show me the evidence we're missing."

The reply should be concise natural language plus one clean proposed-change summary where appropriate, not raw action JSON/tool debug. **Text alone is not authorization** for destructive edits: show the exact diff/affected IDs, click Accept/Reject or explicit unambiguous message-bound approval using current, bounded token/revision checks. Follow/Pin selection, natural 'this Gate', multiple Chats, stale selection, chat reload and cross-project boundaries must remain safe. Batch multiple related changes when validated and atomic; if a partially unsupported action is requested, clearly explain rather than silently dropping it. Keep bounded schema/action counts suitable for local Q4 32,768 context. Never claim the model can qualify a Gate without actual source-backed proof.

## Mandatory real Chrome + focused tests

Operate current rebuilt Dope in real connected Chrome with saved Chat and at least one **actually selected/available local Q4** if accessible; record provider/model/context. If unavailable, explicitly mark local model qualification **EVIDENCE GAP**, do not substitute fabricated model output. Start a disposable project, use natural Chat to create Phase + Gate + two criteria, revise Gate/criterion, reorder/move, link dependency/correction, reject another proposed change and confirm unchanged source, accept a valid edit and reload. Use the **same ChatPanel** docked left/right/narrow, test selected vs pinned target, a new turn using 'that Gate', reload persisted Chat, stale owner and other project, changing/removed linked Markdown and malicious instruction/unsupported operation. Qualifying the model-selected end-to-end path is mandatory for M2 Green; deterministic parsing/integration tests are supplemental, not sufficient alone.

Test affected `dope-capability-help`, `chat-backend`, `roadmap-local-model`, `roadmap-chat-context`, `roadmap-greenfield`, `project-planning-actions`, source sync, ChatPanel and permission unit/integration tests, plus build and `git diff --check`. Record exact HEAD, served bundle/backend hash, saved Chat ID, model and approval tokens without secrets, screenshots/actions, preview diff, before/after Roadmap revision and linked Markdown source hash.

**PASS** only when conversation genuinely performs all supported authoring edits via reviewed typed authority without arbitrary menus or silent mutation. If missing a required operation, inventing controls, bypassing authority, losing history/Chat or local inference proof unavailable, report **NOT GREEN/EVIDENCE GAP** and stop before M3. No manual P14 PASS commit, Pi runtime, native Electron or Phase 11 Green claim.
