# Phase 11 — Conversational Planning Experience Contract

**Date:** 2026-10-24 (America/Chicago)  
**Status:** OWNER-APPROVED DESIGN / DOCS ONLY. `/docs-review` accepted in conversation; `/docs-apply` documents this scope. Product implementation, prompts, execution and qualification are separate steps.  
**Correction:** `c11-conversational-planning`, under Phase 11 Human-Centered Development Workflow.  
**Basis:** GitHub `main` `503dae3773ab768719c0a2e1d3e4fef5e7c41cde`, project manifest `0.11.8`; developer local HEAD, dirty tree and running GUI **not inspected**.  
**Related authority:** [ADR 0036](../../decisions/0036-unified-roadmap-and-local-first-ai-planning.md), [ADR 0038](../../decisions/0038-planning-bridge-and-idea-to-implementation-workflow.md), [Phase 11](phase-11-plan.md), [Brainstorm](../../tasks/c11-brainstorm/README.md), [Planning Bridge](../../tasks/c11-planning-bridge/README.md).

## Experience to deliver

A developer types an idea and a few product constraints in the **existing saved, freely dockable ChatPanel**. Dope examines *relevant actual project evidence* using bounded, safe read-only capabilities, then offers a coherent ordered **first-pass implementation plan**: what to change, why, approximate ownership/affected source areas, dependencies, how to verify, risk/assumptions and recommended sequence. The developer may naturally say "use our existing diff editor", "combine steps 3 and 4", "do this before auth" or "make step 2 smaller". The existing Chat/plan interface shows a meaningful reviewed draft of the resulting plan and only the affected revisions. There is no mandatory questionnaire, forced `Prepare Work` wizard or manual Roadmap assembly.

**First useful planning response = an actionable plan.** When the actual repository is readable and the idea is sufficiently actionable, prefer a complete multi-step first-pass plan in the first user-visible planning outcome, not repeated one-node-at-a-time tool JSON or a series of forced interrogative turns. An indispensable unresolved product decision may warrant **one specific question plus the feasible provisional plan**, clearly labeling assumptions. If evidence access fails or a safe output cannot be completed within measured model limits, disclose that explicitly and show the supported partial plan/recovery path; never fabricate inspection or complete state. The plan is reviewable before any canonical write.

Example: "Add Git branches, commits and visual diffs using our editor" should yield a coherent overview and ordered repository-grounded steps (inspect existing Git/diff integration, branch actions, staging/commit, reuse editor diff, tests and GUI gates). Dope should distinguish confirmed code from assumptions; never claim a file exists without its cited source.

## Three layers — exactly one owner at each boundary

1. **Conversation:** Existing `ChatPanel`, `ChatBackend`, `ChatContextComposer`, durable `@dope/chat` message/proposal/activity/lease records. Chat explains, asks, revises and shows source references. No duplicate chat, transcript, provider, model-role setting or planning-session owner.
2. **Noncanonical structured implementation-plan draft:** A **single bounded, revisioned, durable plan representation**, associated with the existing greenfield/selected Roadmap draft and Chat identity. Preserve stable IDs for proposed steps, objective, developer constraints, ordering/dependencies, acceptance and test strategy, provenance, assumptions, freshness, proposal/accepted-draft distinctions and cancellation/restart. Prefer an additive `RoadmapGreenfield`/associated draft-owner contract rather than a parallel authoritative planning database. Plan changes are *draft* changes; no direct architecture, Roadmap Markdown, WorkItem, runner, repository or code write. Deterministic validators own IDs, cycles, scope, revisions, shape, conflict resolution and byte caps; never promote natural-language model claims into verified state.
3. **Approved artifacts:** Existing `RoadmapStore` + linked `ROADMAP.md`/source reconciliation and `ProjectPlanningActions` own strategic checkpoints. Only after explicit Roadmap approval can the existing ADR 0038 **Prepare Work** path use `Physical Map -> Planning Map -> WorkItem -> prompt composer`. Target architecture and eventual prompt stack have their **separate explicit approvals**. Approval alone never Runs Work or grants an ExecutionGrant. `Adopt Target`, candidate promotion, validation, qualification and owner-close remain separately authoritative.

Dope may show pending draft plan steps in the **same** Roadmap canvas as provisional visual nodes and update its in-place inspector. Presentation is a revision-checked projection, not an independent canvas/plan authority. Existing linked Markdown is not silently rewritten by a draft edit. External source edits trigger change detection, re-read, diff/approval or denial; stale model output never overwrites a newer developer action.

## Plan quality and grounding contract

Each first-pass plan includes:
- **Goal and success definition:** developer's requested behavior, explicitly preserved constraints, scope/non-goals and user-important outcomes.
- **Repository facts:** bounded evidence references for existing modules and reusable components, with freshness/source identity, and a distinct `unverified` category for assumptions.
- **Implementation sequence:** ordered steps with stable draft IDs, objective, deliverable, likely existing owner/file area *only if supported*, dependencies, what can be reused, meaningful acceptance/verification and effort/risk indicator. Avoid creating a hundred microscopic nodes for a six-step feature.
- **Safety and qualification:** unit/integration/build checks appropriate to the changes, required direct GUI/manual checks, security/permission negatives, explicit known gaps; "implemented" never means "Green".
- **Alternatives and decisions:** summarize important architectural tradeoffs and decision points, distinguish developer-confirmed decisions from model suggestions. Don't invent specifications, code evidence or false confidence.

For a small correction, provide a small practical plan and allow the ADR 0038 fast lane: architecture may be **N/A** when legitimately not required, without fake Planning Map nodes or WorkItems. For larger features, present a coherent overview first, allowing the user to expand step depth. Before publication, validate dependencies and conflict with existing authored/started work. Plan depth and output are proportional to scope; no fixed number of steps.

## Guided investigation without Work authority

Reuse `ChatProjectGrounder` (bounded path/text search, reads, evidence refs and diagnostics), `ChatContextComposer`, current Software/Physical Map and relevant project docs through the existing authorized **read-only** data surfaces. Implement a deterministic/capped planning-research loop only if insufficient context: select small relevant read/query operations, validate paths, project identity and size, assemble evidence packet, then synthesize a plan. The user should not have to perform each read manually. No access to agent shell, git write, arbitrary network/MCP, code promotion, hidden secrets or model-issued unreviewed filesystem operations. No whole-repo ingestion or implicit background scanning. Exclude symlinks/path escapes; cite evidence accurately and report truncated/unavailable results. Record budget/time/step limits and user-visible recovery for read or model failure.

The existing `ChatProjectGrounder` has bounded file/search primitives; the existing `roadmap-local-model.ts` enforces completed strict JSON and size/retry limits. **Do not discard either protection.** A robust plan can be human-readable prose with a separate strictly validated bounded plan payload, or one schema-validated completed structured answer with a prose projection. Use a deterministic representation; never mix actionable raw JSON into the ordinary reply. Keep the existing short no-action response for non-plan messages; do not simply enlarge the 4,000-character `no-action` text or raise the Roadmap 1–3-action cap to allow arbitrary unapproved mutation.

## Local-model / execution limits

- Reuse the **user-selected** connected provider and measured loaded capacity; Qwen3-Coder 30B A3B Q4_K_M at **32,768** context is the owner reference **for qualification**, not a global app default, provider mandate or 64K guarantee. Support no-model/manual draft editing.
- Keep instructions, recent confirmed decisions, relevant source excerpts and reserved output **inside the actual measured budget**. Expose missing evidence/truncation rather than claiming it was read; reject unsafe overflow.
- Default to one planning inference where possible. A plan may require a small **explicitly bounded** investigate/synthesize continuation; surface real progress, cancellation and failure. No endless model loops, hidden hosted fallback, provider switching or invented tool capabilities.
- Validate completed JSON/schema and owner/revision/source identity **before** preview/apply. Streaming prose can be displayed when safe, but incomplete stream/tool JSON never becomes actionable draft/canonical state.
- Every new draft/plan revision records what changed, and prevents stale acceptance after model turn/restart/owner handoff. Preserve independently confirmed developer decisions and rejected proposals in conversation truthfully.

## Chat, visual and review behavior

Keep existing user-docked Chat in any supported panel position; do not auto-open/reposition a second chat. A compact, readable plan is the **primary assistant response**; raw model actions become muted expandable details. The existing Roadmap canvas, horizontally progressing phases and vertically branching corrections, displays provisional nodes with clear `proposed / accepted draft / canonical` labeling, update events and source-bound warnings; its editor/inspector continues in-place. Plan preview supports accept/reject/revise and highlights changed steps without requiring the user to approve dozens of atomized node edits one by one. A single **reviewed transaction** may intentionally translate a larger *validated draft* into bounded, owner-approved batches; partial cross-owner failure must be surfaced with recovery, never pretended atomic. Keyboard, narrow docks, alt theme, focused scroll, restart and project isolation remain required.

## Authored work immutability and handoff

Before prompt-file authoring, a provisional implementation outline and associated WorkItems can reorder with valid dependencies. **Once P*.txt files have been authored, their order and source are fixed—even if unstarted.** A wholly unstarted authored stack may be changed only via explicit reviewed supersession/new fingerprint preserving prior source. Executed/completed prompt text/hash/order/checkpoints, Git/run history and historical qualification are immutable. Replanning against completed work produces new correction/follow-up, not an in-place edit. Planning approval != publication != separate deliberate Work Run != grants != review/promotion != owner qualification. No `/activate` gate.

## Qualification gates (correction scope only)

| Gate | Required real observation |
| --- | --- |
| CP1 — First-pass plan | One short idea and 2–3 constraints yields a coherent ordered plan before manual Roadmap construction; reuse and qualification steps are explicit. |
| CP2 — Grounding | Source-backed references match real project files/architecture; absent/unreadable/truncated evidence is marked Unknown; injection/path escapes rejected. |
| CP3 — Local Q4 | Real selected Q4_K_M/32768 planning, plan revision and cancellation/limits, measured provider provenance; no silent hosted switch. |
| CP4 — Edit & preserve | Conversational combine/split/reorder/new constraint changes only affected un-authored draft steps; accepted decisions and stable IDs survive. |
| CP5 — Persistence | Chat + accepted draft survive reload/restart; stale proposal denied and project A/B isolated. |
| CP6 — Roadmap | Same-canvas provisional projection -> explicit approve -> current Roadmap + linked Markdown; external source conflict refuses overwrite. |
| CP7 — Bridge | Approved plan becomes existing checkpoint/Prepare Work input with independent architecture, WorkItem and stack review/approval, no automatic Run. |
| CP8 — Immutable history | Post-authoring reorder denied; prior prompt/result preserved; changed completed work becomes correction/supersession with evidence. |
| CP9 — UX and safety | Readable prose, compact tool activity, narrow/keyboard/theme, no HTML/network/secret/agent permission escalation; no-model path intact. |
| CP10 — Exact-source verification | Focused tests, one justified final aggregate, browser real task on disposable repo, exact source/bundle/provenance and honest native observation status. |

Pass a gate only with **source-bound observable evidence**. Manual closeout distinguishes PASS / FAIL / BLOCKED / EVIDENCE GAP / NOT RUN. A correction-scope Green does not by itself qualify Phase 11: existing Bridge D1–D8, two materially distinct broad usability Hunts, other corrections and explicit owner closeout stay independent. Phase 12 is inactive.

## Delivery boundary

Use [c11-conversational-planning](../../tasks/c11-conversational-planning/README.md) P1–P7 for bounded implementation and P8 for **manual browser/selected-local-model** evidence outside the headless runner. Aim <=8 minutes/prompt, 10 soft, 15 hard; split implementation only by reviewed new source rather than changing already authored prompts. No product-code edits, tests, new version or project Roadmap writes are authorized by this document itself.
