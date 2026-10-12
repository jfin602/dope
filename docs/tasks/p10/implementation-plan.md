# /prompt-plan — p10 Unified Roadmap & Local-First AI Planning

**Status:** SOURCE-ASSESSED / PLANNED / NOT OWNER-ACTIVATED
**Entry:** Phase 9: owner-closed Green at qualified 0.9.35 source af3447c; Phase 10 coherent version-only 0.10.0 baseline 2fc3b93c01ed56b5c848e80181d630c390f3e551. Phase 10 DESIGN APPROVED only, not owner-activated or qualified.
**Authority:** ADR 0036 and its existing-ChatPanel placement amendment, ADR 0016 current theme, ADR 0017, ADR 0034/0035, docs/workflow.md.
**Activation:** Only via separate explicit owner-approved `docs/planning/p10/activation.md`; do not pre-bump packages.

## Exact seams and tests

### P1 — Read-only Roadmap source inventory (T2, 0.10.1)

**Source:** docs/roadmap/mvp-roadmap.md, docs/planning/, docs/tasks/*/closeout.md, known-issues.md, ProjectMindStore.

**Delivery:** Implement bounded read-only source inventory and previewable import of existing phase/correction checkpoints and linked evidence. Derive stable IDs from canonical source paths/section keys and preserve source hashes, citations and unknown/waived/failed truth. Unsupported Markdown, duplicate headings, ambiguous status and missing refs remain explicitly read-only; no source file or Mind mutation.

**Evidence:** roadmap-import.test.ts: real Dope-shaped headings, source reorder, duplicate headings, unknown status, unsafe paths, byte-identical source and no hidden initialization.

### P2 — Revision-safe project-local Roadmap store (T2, 0.10.2)

**Source:** PlanningStore and ProjectMindStore durable persistence patterns; P1 import preview.

**Delivery:** Build one versioned .dope Roadmap index owning IDs, explicit roadmap fields and semantic links; project-root identity, size/symlink/version guards, atomic replacement, expected revisions, commit-only changed-object events, restart stability. Import only on explicit preview acceptance, never turn unsupported original Markdown into a second editable source.

**Evidence:** roadmap-store.test.ts: atomic/stale writes, crash/corruption, unknown schema, root switch, ID stability, import acceptance, source bytes unchanged.

### P3 — Shared validated planning action boundary (T2, 0.10.3)

**Source:** P2 Roadmap store; packages/visual-planning/src/service.ts and editing.ts; backend handle guards.

**Delivery:** Create provider-neutral ProjectPlanningActions for selected reads, preview, create/edit/link/unlink/reorder, evidence-safe status changes and eligible undo. Bind opaque project handle, owner ID, expected revision/source hash; reject invalid type, stale state, cycle, foreign link, unjustified Green or unapproved destructive changes. Human and model use same Dope-owned mutation entry; single owner transaction only.

**Evidence:** project-planning-actions.test.ts: stale race, invalid dependency cycle, foreign handle, forbidden gate promotion, preview/approval, per-owner atomic rollback, undo conflict, changed events.

### P4 — Project Mind Ideas and external Issues references (T2, 0.10.4)

**Source:** ProjectMind v2 contract/store, known-issues.md and P1/P3.

**Delivery:** Resolve original Idea/Question/Decision and issue-registry records through typed references with their owner revisions. Detached pool items remain owned by originals; promotion links, never copies, original records. Unsupported external Markdown is read-only. If changing a different owner, call its native revisioned mutation separately with explicitly reported partial outcome.

**Evidence:** roadmap-owner-links.test.ts: detached/promoted, duplicate refs, changed owner, foreign IDs, unsupported Markdown, never mutating owner bytes on link-only action.

### P5 — Planning Map basis-safe references (T2, 0.10.5)

**Source:** packages/visual-planning/src/adoption.ts, service.ts; visual-planning-backend.ts; P3.

**Delivery:** Resolve existing Planning Maps, transformations and WorkItems with exact project IDs/map revisions/current physical basis. Roadmap links are non-mutating to map owner. Optional transformation proposal delegates to Planning Map's normal preview/adoption authority with fresh basis and explicit approval; stale, foreign or conflicting status fails closed, no silent WorkItem completion or AgentTask creation.

**Evidence:** roadmap-planning-links.test.ts: basis changed after preview, map ID missing, link-only unchanged owner bytes, rejection of direct adoption, no AgentRun.

### P6 — Truthful checkpoint and branch projection (T1, 0.10.6)

**Source:** P1-P5 source/owner data and physical-map-projection.ts.

**Delivery:** Create pure deterministic checkpoint graph with explicit phases, milestone/correction branches, dependency edges and detached Idea/Issue pools. Status carries evidence, unknown/Not Green/waivers as written, never color/path-derived qualification. Separate viewport, drag placement and node colors from durable semantic graph; bounded selected-neighbor payload and noncolor cues.

**Evidence:** roadmap-projection.test.ts: stable order, corrections/branches, missing refs, disconnected pools, status truth and project switch.

### P7 — Center Roadmap tab and accessible graph UI (T1, 0.10.7)

**Source:** frontend-module.ts, physical-map-widget.ts, dope-theme.ts and current ADR 0016.

**Delivery:** Create user-invoked center editor-like Roadmap canvas using P6, with checkpoint path, branches, selected state, keyboard traversal, loading/recovery. Use restrained orange for primary active states only and neutral controls/real error status. Preserve ordinary Theia/editor/Planning Map docking and layout; never auto-create, move, focus or replace an existing Chat.

**Evidence:** roadmap-canvas.test.ts: one ordinary tab, key selection, safe labels, dark/light tokens, no Chat docking side effects or forced split.

### P8 — In-place checkpoint detail inspector and manual editing (T1, 0.10.8)

**Source:** software-map-widget.ts, software-map-controller.ts, P3 and P7.

**Delivery:** Add Software Map-style left inspector, not standalone checkpoint page. Show selected objective, evidence/gates, dependencies and typed links; manual edit submits P3 preview + expected revision and visible approval for high-impact changes. Maintain drafts through latency, stale/foreign response rejection, undo on eligible edit, keyboard/focus/narrow panes. Do not steal a user-controlled left Chat panel.

**Evidence:** roadmap-inspector.test.ts: edit/event sync, stale response, guarded gate, preservation of draft, no forced panel placement, keyboard error.

### P9 — Ideas and Issues pools with safe promotion (T1, 0.10.9)

**Source:** P4 owner resolver, P6 projection and P8 inspector.

**Delivery:** Present visually detached unsequenced Issues/Ideas with original titles/status/provenance, filtering and keyboard/pointer link/promote/unlink through P3. Do not synthesize second issue registry or erase original Mind record; broken refs visible and reversible link-only operations revision-safe.

**Evidence:** roadmap-pools.test.ts: detached/promoted/unlinked, duplicates, original bytes unchanged, stale owner, accessible keyboard and project isolation.

### P10 — Reuse ChatContextComposer for roadmap evidence (T2, 0.10.10)

**Source:** packages/chat/src/index.ts, service.ts, chat-context-composer.ts, chat-backend.ts.

**Delivery:** Extend existing saved Chat context selection/refs with bounded typed roadmap-checkpoint and neighbor/Planning Map facts. Re-resolve owner/source revision and current project at preview and send/retry; obey normal context budget, omission diagnostics, model choice and hosted consent. Never stuff entire roadmap/repo/chats, create a second transcript/provider or mutate roadmap by context reading.

**Evidence:** roadmap-chat-context.test.ts: typed refs and citations, stale import/source, wrong project, preview/turn equivalence, output reserve in 4,096 profile, no provider call on read.

### P11 — Selection Follow and Pin in normal ChatPanel (T2, 0.10.11)

**Source:** chat-panel-controller.ts, chat-panel-widget.ts, ChatOpenOwners and P10.

**Delivery:** Add visible Follow-active vs Pin selected checkpoint/Planning Map through existing ChatPanel, independent of left/right/bottom/center placement and saved Chat identity. Follow refreshes before next turn, Pin retains exact referent but fails stale/wrong-root; maps never force-open or relocate Chat. Preserve drafts, single writer/lease, model, stream, cancel and restore. Center split is mandatory live P16 gate.

**Evidence:** roadmap-chat-panel.test.ts: follow/pin, move/reopen, leases, stale/missing selections, no forced Chat launch, no saved Chat fork.

### P12 — Preview and apply untrusted conversational proposals (T2, 0.10.12)

**Source:** chat-backend.ts, conversational-providers.ts and P3/P10/P11.

**Delivery:** Extend existing Chat turn orchestration: only completed model output may be parsed as compact strict typed planning proposal; Dope validates project/owner revision and previews approval before P3 applies. In-flight model never gains external edits; rejected stale proposals re-read for next step, not overwrite. Stream/cancel/retry/malformed/unknown-ID and denied approval make no writes. No agent tools, filesystem, MCP, network, Git, code-promotion or mode fork. Hosted data still requires existing explicit consent.

**Evidence:** roadmap-chat-actions.test.ts: invalid JSON, fake IDs, unauthorized Green, manual/model stale race, approve/reject, changed-object refresh for next turn, no agent/write escape.

### P13 — Small-context local planning transport and JSON fallback (T2, 0.10.13)

**Source:** model-connections.ts, ai-role-routing.ts, local-context-budget.ts, ChatBackend.

**Delivery:** Support one narrow action per conversational step with measured local model capability, strict JSON fallback without native tools, input+system+output reserve under 4,096 total tokens when supported. Cap retries, abort, visible missing context; fail closed on unavailable local model or bad output. Never silent hosted fallback, background inference or new provider-specific action authority; explicitly chosen hosted Chat remains consented/provenanced.

**Evidence:** roadmap-local-model.test.ts: simulated non-tools local response, 4,096 total reserve, context truncation, bounded retries, abort, missing capability and hosted fallback denial. Genuine LM Studio only P16.

### P14 — Protect Project Mind access before navigation retirement (T2, 0.10.14)

**Source:** project-mind-controller.ts, frontend-module.ts, Mind owner backend, History navigation, P4/P9.

**Delivery:** Prove all Notes, Ideas, Questions and Decisions remain discoverable, editable at original owner and recoverable, including old layout/History exact refs. Only then remove redundant Project Mind navigation surface, never Mind data/RPC/Chat context owner. If recovery cannot be retained, keep old launcher and record blocker instead of removing it. Roadmap Issue display does not create new issue domain.

**Evidence:** roadmap-mind-access.test.ts: four Mind types, old restored layout, deep links, missing/corrupt/foreign refs, byte-identical original owner unless explicitly edited.

### P15 — Cross-owner and Chat safety integration (T2, 0.10.15)

**Source:** P1-P14 plus existing Chat, Planning, Project Mind and Agent tests.

**Delivery:** Integrate imported real-shaped roadmap, manual inspector, detached source link, Planning Map basis, existing Chat proposal and next-context freshness, saved Chat/restart and no-model mode. Prove stale/wrong-project/repeated proposal denied and no automatic model, agent, architecture adoption, owner overwrite, hosted fallback or false Green. Repair only affected seams, register all tests once; no full suite or real GUI Green.

**Evidence:** roadmap-integration.test.ts and narrow existing affected Chat/Planning/Mind/Agent regressions; changed-lib builds, 13 manifest coherence, git diff --check.

### P16 — Manual real UI/local model qualification and Phase 10 closeout (T3, 0.10.16)

**Source:** P1-P15 committed source, ADR 0036, Phase 10 plan and all acceptance gates.

**Delivery:** MANUAL SOLE FINAL PHASE 10 CLOSEOUT: establish independently committed coherent 0.10.16 source/version candidate BEFORE evidence. Use actual Dope + disposable project in Theia browser/Electron: truthful Markdown import/roundtrip, zero-model manual edit, branch/pool promotion, left inspector, restart, real local LM Studio 4,096-total-context if supported without native tools, human and AI shared action and NEXT-turn freshness, stale/foreign/malformed/approval fail closed, basis-safe Planning Map, full project/History/Mind access. Test SAME saved Chat in left/right/bottom/center, real center tab split beside map/code, Follow/Pin, lease/model/stream retention and no layout hijack. Inspect keyboard, narrow panes, dark/light restrained orange and real noncolor statuses; independently observe no silent hosted egress/agent grants. Run ONE full npm run check on exact committed candidate with browser/Electron builds, restart/authority evidence and git diff --check. Write docs/tasks/p10/closeout.md with exact SHA, per-gate GREEN/NOT GREEN/Evidence Gap. Missing real local, center split, authority or aggregate is NOT GREEN; owner closure and Phase11 activation require separate decision.

**Evidence:** P16 T3 direct GUI, connected local model, OS/connection egress observation, exact-source full check, restart, evidence-only closeout; no claimed Green from fixtures.


## Cross-cutting contracts

**Owners:** Markdown phase/gate prose remains source-owned; Roadmap `.dope/` index alone owns checkpoint IDs, links and roadmap fields; Project Mind owns idea/note/decision bodies; issue registry retains issue text; Planning Maps own architectural changes/adoption and WorkItems; Chat owns saved conversations/leases; History projects read-only activity, Work and validation/review facts are independent. Unsupported Markdown is read-only and linked, never overwritten; no cross-store fake transactions.

**Authority:** Every manual, model or keyboard action uses validated ProjectPlanningActions with exact root/handle, checkpoint ID, expected owner revision, optional source hash and PlanningMap basis/map revision; stale, malicious, inconsistent or denied proposals perform no write. Commit changes publish affected IDs/revisions for immediate canvas/inspector and NEXT Chat step, not in-flight model context. Model never receives agent/filerunner/code-promotion privileges.

**Chat:** No new Roadmap Chat runtime, mode, widget, lease or provider. Existing saved Chat can be placed anywhere in Theia without auto-opening/moving from maps. Follow-active vs Pin are visible and safe across root changes; actual center split beside map/code must be direct GUI-proven.

**Model:** True zero-model manual operation, one strict JSON planning action at a time on a measured eligible local short-context model (4,096 total incl. reserve where supported), no function-calling requirement; host consent and provenance unchanged, no silent hosted fallback or data egress.

**Style:** dark/neutral surfaces with restrained orange key active/primary only; semantic error/gate colors with labels, alternative theme, keyboard/focus/narrow layouts, Software Map-like left detail panel; avoid a separate detail page or a forced right Chat.

## Validation/version rules

P1–P14 focused T1/T2 and small changed-lib build, P15 one bounded T2 integration; final P16 T3 manual creates a separately committed coherent **0.10.16** source/version candidate after P15 **0.10.15**, exercises actual browser/Electron, Dope and disposable roots, all four Chat placements incl center split, eligible local LM Studio/no native tools, no-model fallback, stale/hosted/authority safety, evidence truth, restart, one full exact-source `npm run check` and truthful `docs/tasks/p10/closeout.md`. Missing evidence => Not Green. P16 closeout is not phase owner-close or Phase 11 activation.

For each Pn: version `0.10.(n-1)` -> `0.10.n` DURING prompt across all 13 manifests/20 `@dope/*` pins, runner checks but does not bump/agents do not commit on P1–P15, preserve yarn.lock/unrelated deps/root package-lock absence and local developer work. No auto-run while activation absent. After owner activation only, validate `npm run codex:phase:validate -- p10` then run `npm run codex:phase -- p10`; runner stops for manual final P16. Target <=8 min ordinary tasks, 10 soft/15 hard, and split unbounded new work rather than claiming Green.
