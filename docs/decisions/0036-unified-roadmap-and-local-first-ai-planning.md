# ADR 0036 — Unified Roadmap and local-first AI planning

**Status:** ACCEPTED PRODUCT DESIGN / DOCUMENTATION ONLY / NOT IMPLEMENTED OR QUALIFIED
**Date:** 2026-10-12 (America/Chicago)
**Related authority:** ADR 0016 (October 12 restrained-orange amendment), 0017, 0022–0026, 0028–0030, 0034–0035.

## Decision

The **Roadmap** becomes the project's primary *strategic* spatial planning workspace. Represent existing phase plans as connected game-map-like checkpoints; corrections are branches and unscheduled **Ideas / Issues** are detached pools. A checkpoint carries a stable project-scoped ID, kind (phase/correction/milestone), title, objective, explicit ordering and dependencies, typed links to phase documents, issue/idea records, Planning Maps/WorkItems and evidence-backed gate/closeout status. Node position, viewport, colors and selection are presentation state. Never mark a checkpoint Green solely because a path is filled, an AgentRun ended, or AI says it is done. Preserve historical Not Green, waiver, deferred and unknown evidence.

Checkpoint selection/editing uses the existing **Software Map-style in-place left details inspector**, never a standalone checkpoint detail page. Keep a reusable project-grounded saved **ChatPanel** dockable alongside the center Roadmap (ordinarily right), as with Planning Maps. The Roadmap answers *where and why*, the Software Map answers *what exists*, Planning Maps answer *what architectural changes are proposed*, and History answers *what happened*. Roadmap is not another manual Development Session or task database.

## One state, independent owners

Existing Markdown roadmaps/phase plans, Project Mind Notes/Ideas/Questions/Decisions, project issue registries, Planning Maps/WorkItems, canonical Architecture, agent/validation evidence, Chats and History remain independent data owners. Retire only the separate **Project Mind navigation surface**, after durable knowledge access/recovery is preserved. Unsequenced Issues/Ideas can be promoted/linked without copying their records. History stays a read-only owner-backed activity projection; Planning Maps retain architectural-basis/rebase/adoption authority and cannot be silently rewritten by Roadmap positioning.

A versioned project-local structured Roadmap store/index beneath `.dope/` may own stable checkpoint identities, semantic edges and explicitly roadmap-owned fields/links. Establish **exactly one writer for each editable field**: a validated lossless Markdown round-trip adapter where supported, or structured state with an external source reference. Existing unsupported Markdown stays read-only until safe explicit import/ownership mapping. Never introduce two independently editable versions of phase prose, delete existing Project Mind records, or claim cross-store distributed atomicity.

## Shared human / AI editing contract

Provide a small provider-neutral `ProjectPlanningActions` boundary: selected checkpoint/neighbor/linked-record reads, deterministic previews, typed semantic changes (create, edit, link, reorder, promote idea/issue, propose a Planning Map transformation). Manual inspector/drag gestures and model proposals invoke **the same** Dope-owned validated operations. Bind every request to project-root identity/opaque handle and expected owner revision (plus Planning Map basis/map revision when applicable). Validate schema, identities, dependency cycles, lifecycle, permissions, adoption constraints and referenced owners deterministically. An owner commits its own operation atomically; cross-owner steps must report partial outcomes explicitly rather than pretending to transact across stores.

Commits publish bounded affected object IDs, owner revisions and factual change summaries. Canvas, inspector and other subscribers update immediately; the AI **next step** receives fresh selected-object context. An already-in-flight model cannot absorb external edits into its generation; stale proposals must reject and re-read instead of overwriting manual work. Support revision-safe undo for eligible non-destructive operations; destructive/broad restructuring, adoption, closeout and ambiguous conflicts require explicit preview and developer approval. Model text/JSON is **untrusted proposed action data**, never direct project mutation or proof.

Ordinary Chat planning tools do **not** inherit Phase 8 agent shell, filesystem, process, MCP, network or code-promotion grants. Model proposals go through Dope's own authority service; direct writes to Markdown/JSON by the model are prohibited. ADR 0035's Codex subscription ordinary Chat Responses transport **remains tool-free**; a future Dope planning orchestration layer may validate *completed* conversational output outside that provider transport. Work and CandidateDelta promotion remain separate.

## Local-model-first is a release gate

All Roadmap and Planning Map manual operations work with **no AI model**. A small local model must accomplish supported conversational planning using compact selected-object/neighborhood context and narrow on-demand reads, one short validated action at a time. Do not require loading the whole repo/roadmap/old chats or native provider function-calling. Prefer native structured tools where supported but **require** a strict JSON/constrained-output, schema-validated fallback for runtimes lacking tool APIs. Dope, not the model, computes identity, dependency topology, state transitions and graph invariants.

Qualify a **4,096-total-token context profile**, including output reservation and instructions, where a model supports it; use measured/verified capability limits, never guessed capacity. Bound retries, cancellation, malformed output and context omissions; failures are non-mutating and visible. Local-only means **no silent hosted fallback, egress or background hosted inference**, even on retries; explicitly selected hosted models still require contextual project-data consent and actual model provenance. Provider configuration/capacity is application state, never roadmap truth.

## Presentation

Use center checkpoint map, meaningful branching and visually detached pools, with accessible keyboard navigation, full readable checkpoint identities and left details inspector. The ChatPanel may remain visible in a right/other dock; narrow and resized panes retain usability. Use the **current October 12 Dope Dark restrained-orange** semantics (ADR 0016): neutral dark surfaces/utility controls, brand orange only for intentional active selection/primary action, independently meaningful gate/diagnostic colors, visible subtle keyboard focus, non-color cues and alternate-theme isolation. Brand literal colors belong only in central semantic theme tokens. Preserve independent chat/map color choices.

## Sequencing, approval and qualification

Phase 9 Developer Continuity/History remains separately active and **not qualified**. Preserve `p9d`, older 9A/9B Green, 9C/legacy Session data recovery, and independent `c9-codex-chat` / `c9-theme-fix` scope and versions. Insert **new Phase 10 — Unified Roadmap & Local-First AI Planning** (design approved, not activated). Resequence former Phase 10 Living Software Knowledge Model to **Phase 11** while preserving ADR 0023's deterministic-first background, local-only/no-hosted-fallback, resource and no-silent-canonical-mutation requirements. Interactive Phase 10 chat editing does **not** activate Phase 11 background alignment.

Qualification must demonstrate real existing Markdown/Project Mind preservation; zero-model manual editing; a real short-context local-model create/edit/link workflow without native tool calls; immediate human/AI state visibility and next-step refresh; stale-race, malformed output, unauthorized mutation, restart and cross-project isolation; true historical gate status; no hosted fallback; and direct Theia GUI/theme/accessibility evidence. Failed or unobserved gates are Not Green.

This approval is **documentation only**. It does not implement UI/contracts, create an executable runner stack, bump any version, activate Phase 10/11 or claim qualification.

## Forward amendment — 2026-10-12: Human-Centered UI phase

ADR 0037 inserts **Phase 11 Human-Centered UI** after this existing Phase 10 Roadmap, moving the Living Software Knowledge Model to **Phase 12**. Prior Phase 11 labels above are historical, not current execution guidance. Phase 10's local-model/manual Roadmap contracts remain unchanged and not activated; its UI will be included in the Phase 11 usability audit once implemented. Phase 9 subsequently qualified Green at `0.9.35` / `af3447c` with owner closeout pending. The independent `c9-theme-fix` is palette-only.
