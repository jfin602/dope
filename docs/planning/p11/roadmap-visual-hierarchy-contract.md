# Roadmap Visual Hierarchy & Progression — owner-approved UX contract

**Date:** 2026-10-29 (America/Chicago)
**Status:** APPROVED DESIGN / DOCUMENTATION ONLY. Not implemented or qualified by this document.
**Owner visual target:** the owner's 2026-10-29 image `this-style.png` shared in the Dope IDE conversation, showing three horizontally linked dark phase cards, nested checkpoint rows, colored status icons and progress bars, and prominent directional arrows. The image itself is a conversation attachment, not a repository asset as of this document. This text is the portable implementation and acceptance description; do not silently substitute a different layout.
**Scope:** bounded Phase 11 Roadmap presentation and grounded Dope Help correction, `c11-roadmap-visual-hierarchy`.
**Related authority:** [ADR 0036](../../decisions/0036-unified-roadmap-and-local-first-ai-planning.md), [ADR 0016](../../decisions/0016-dope-dark-visual-identity.md), [ADR 0037](../../decisions/0037-human-centered-ui-and-usability.md), [Phase 11 plan](phase-11-plan.md), [existing c10-horizontal-color evidence](../../tasks/c10-horizontal-color/closeout.md), [existing help correction](../../tasks/c11-guidance/README.md).

## Decision and visual fidelity

Make the Roadmap a left-to-right **phase progression map**, not a flat canvas of identical phase and checkpoint graph cards. The supplied screenshot is the primary visual style reference. Retain the existing full-editor canvas, ordinary user pan/zoom, responsive focus/viewport persistence, dockable ChatPanel and in-canvas Software Map-style inspector. Do not build another roadmap data owner, chat system or independent checkpoint editor.

Each phase uses a larger dark rounded container, visually and semantically different from its children:

- Regular horizontally aligned phase cards of comparable width, with readable spacing and a clear arrow **between** cards. Content-driven height is fine; phase cards must not overlap or force body text to tiny sizes.
- Small uppercase `PHASE N` label at top left and compact status icon at top right; a larger high-contrast title below. Do not give every card an orange border.
- A short, truthful checkpoint-count/qualification summary, a restrained thin progress track/fill, then a subtle divider.
- Under the divider, each checkpoint appears as one **nested row** with its own status icon, title, and trailing foldout chevron. Rows are visually subordinate to the enclosing phase, not miniature versions of the phase card.
- Foldouts expand **within the parent phase** to show a concise objective, independent checkpoint state, criteria/dependencies, corrections and an affordance for opening full details. Keep detailed edits, source evidence, approval and history in the existing in-stage inspector overlay; do not spawn a standalone page or duplicate edit authority.
- A phase with no accepted checkpoints shows an intentionally dim neutral card, empty progress track and helpful 'Add a checkpoint' treatment. Its title remains legible; dimming is not achieved by making all text inaccessible.
- Visually match the screenshot's restrained charcoal surfaces, fine borders, generous card separation, thin bar, understated status icons/chevrons and arrow emphasis. Avoid huge floating checkpoint cards, noisy animation, sprawling line buses, crowded badges and constant orange highlights. Centralize semantic colors via Theia/Dope theme tokens; support light/custom themes rather than hard-coded dark-only widget CSS.
- Default collapsed/expanded behavior must be deliberate, stable on refresh and reasonable with very long phases. Large phase inventories may collapse or virtualize child content but may not hide state, truncate identity irrecoverably, or change source ordering silently.

The screenshot's Phase 1 Green, Phase 2 orange Active and Phase 3 dim Empty are **illustrative examples**, not claims about the owner's real PixiJS project. A proposal on canvas must be visibly marked proposed regardless of attractive colors.

## Planning presence versus implementation and qualification

Preserve existing canonical status taxonomy (`green`, `active`, `not-green`, `waived`, `not-implemented`, `unknown`) and source-backed historical qualification truth. Introduce **planning presence only as derived presentation**, never a canonical Green status.

| Roadmap condition | Required presentation and meaning |
| --- | --- |
| Zero accepted child checkpoints | Dim/neutral **Unplanned** appearance, visibly empty; no inferred completion |
| One or more accepted child checkpoints, not otherwise qualified/active/blocked | Restrained warm neutral/copper **Planned** appearance; planning has begun, **not** implementation done |
| Source-evidenced active work | Intentional orange **Active** styling |
| Source-evidenced blocked / Not Green | Muted red/error **Not Green** label/icon; do not conceal the blocker with a positive fill |
| Evidence-backed Green | Success green; Green only under the existing independent owner/qualification rules |
| Waived / Unknown | Distinct existing semantic treatment and literal label; never collapse into Green or general completion |
| Nonaccepted proposal | Clearly marked **Proposed / Not accepted** preview treatment, with explicit Accept/Reject; none of its children count toward accepted planning presence |

A provisional accepted draft awaiting separate linked Markdown publication also needs its existing truthful approval/publication label. Do not conflate (1) permission to generate, (2) accepting the Roadmap draft, (3) publishing the linked Markdown, or (4) earning Green.

Progress summaries and progress bars must derive from **well-defined checkpoint sets and evidence**. A label such as '2 of 3 complete' must specify whether completion refers to implementation or qualification. Never count mere authored/proposed/discovered prompts, supporting task stacks, card placement or line fill as implemented work. Never infer phase Green solely from every displayed child looking Green; phase qualification follows its recorded evidence and gates. Empty/missing evidence stays Unknown/Not Implemented as appropriate.

Phase/correction status, child status, progress fraction and arrow color may reflect different facts: display enough non-color cues to avoid a misleading uniform success impression. A Green progression segment is earned only by authoritative evidence; a direction arrow by itself denotes **sequence, not a dependency or gate**.

## Relationships and parent ownership

The default presentation is an unambiguous horizontal **Phase A -> Phase B -> Phase C**. Use real directional arrowheads, robust card-edge anchor points and a distinct arrow color/label style; no anonymous dashed lines between unrelated checkpoint cards and no connector traversing another card's text.

- Represent normal phase/checkpoint ownership through actual nesting. Never draw a synthetic branch connector just to communicate a child row's parent.
- Keep semantic source dependencies in their existing graph/owner model, distinct from chronological phase arrows and inferred presentation memberships. Surface a checkpoint's actual dependencies in its foldout/inspector. If cross-phase dependency lines are offered, show them only in an explicit relationship/dependency mode with direction, labels, accessible descriptions, collision avoidance and a way to return to the uncluttered default.
- Present corrections/qualification work as explicitly labeled subordinate groups or clearly owned branches associated with the correct parent. Preserve stable source identities, original ordering, historical correction outcomes, task/prompt navigation and the existing Hide Prompts accounting. Do not turn supporting task stacks into semantic checkpoints.
- If a correction/checkpoint has missing, conflicting or unresolved parent association, do **not** attach it to a guessed neighboring phase. Retain it in the existing discoverable unassigned/issues area with diagnosis and recovery.
- Connector/layout changes are presentation-only; they must not persist inferred dependencies, rewrite source Markdown, modify Roadmap revisions, or manufacture qualification evidence.

Preserve the existing viewport/actionable-phase camera rules, deliberate saved pan/zoom, Fit/Focus behavior, selected checkpoint focus, keyboard spatial navigation, pointer/touch scrolling and reduced-motion fallback. Expanding child content must not unexpectedly recenter the whole canvas or change saved graph geometry. The full editor, inspector, Markdown/setup overlay and independent Chat docking must remain usable together.

## Dope Help / local model guidance

Extend the **existing** verified capability-help registry and ordinary saved Chat grounding. Do **not** create a second help assistant, a new chat backend, a model-only authority path or any unconsented hosted fallback.

Dope Help must accurately explain: create/add a phase or first checkpoint through a **verified existing UI path**; why a phase is dim; why the first **accepted** checkpoint changes planning presence but not qualification; the meaning of Planned/Active/Green/Not Green/Unknown/Waived; foldouts/inspector; what a progress bar counts; correction ownership and actual dependencies; proposed versus accepted Roadmap and separate linked Markdown publication; and what evidence makes Green. Current project, selected phase/checkpoint, owner revision and supported UI capability may be read through existing bounded, permission-checked context, with safe no-action responses when unavailable.

Example safe response to 'Why is this phase grey?': 'This phase has no accepted checkpoints, so planning has not started. Add an accepted checkpoint to give it a Planned appearance. Green still requires the phase's qualification evidence.' This is an example, **not** hard-coded output and must be adjusted to the actual project state. Never invent an 'Add checkpoint' control, a changed source status or missing permission. Guidance is read-only unless the developer separately requests and approves a supported typed Roadmap action.

Keep the existing c11-guidance scoped Green/Not Green evidence and all historical failed cases intact; new help scope needs new local-Q4 and real-GUI qualification.

## Implementation seams, non-goals and safeguards

Likely presentation seams to inspect before implementation: `roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, `roadmap-status-style.ts`, `roadmap-viewport.ts`, centralized semantic theme/CSS, existing inspector widgets, and `dope-capability-help.ts` plus shared Chat grounding. Verify actual current source before changing anything; the issue screenshots are evidence of UX, not proof of current runtime architecture.

Retain `RoadmapStore`, `RoadmapGreenfield`, `ProjectPlanningActions`, stable owner IDs, linked Markdown reconciliation, source hashes/revisions, preview/Accept/Reject and stale-state rejection. Scope is primarily presentation and help, not a Roadmap schema rebuild, new agent runtime, automatic Work launch, alternative document writer or broad redesign of Chat/Planning Maps/Software Map. Preserve source/project isolation, permission boundaries, native/browser behavior and source-grounded status truth.

## Three bounded implementation/qualification loops (NOT AUTHORIZED TO RUN HERE)

| Loop | Focus | Source-bound acceptance |
| --- | --- | --- |
| R1 — hierarchy and navigation | Screenshot-matched containers, in-phase checkpoint rows/foldouts, arrows and inspector/viewport continuity | Three-phase sample visually matches target; hierarchy and arrow direction obvious; long/narrow views, keyboard, pan/zoom, overlay, selected phase and proposals remain usable |
| R2 — progress and relationship truth | Derived Unplanned/Planned visual presence, six canonical evidence statuses, honest summaries/bars, correction ownership, dependency de-cluttering | Empty / first accepted checkpoint / active / blocked / Green / Waived / Unknown / proposed/accepted-draft matrix; no false Green or orphan connector, no guessed cross-phase parent, historical status unchanged |
| R3 — guidance and regression | Extend Dope Help and bounded context; Markdown/revision/approval and broader presentation regression | Local Q4 (explicitly selected) explains actual fixture state and supported controls; negative controls deny invented paths/authority; browser evidence on current rebuilt source, relevant tests and exact-source closeout |

Each loop may use up to **three bounded repair/qualification cycles**, with a direct **Codex Chrome browser** replay for the affected behavior and focused tests. Record source SHA/version, fixture, screenshots, pass/fail/gaps; do not re-label historical correction results. Native Electron equivalence is a separate owner-controlled evidence gate wherever Phase 11 requires it; a Chrome pass alone is not a claim of native parity or full Phase 11 Green. No standalone version bump or production mutation is authorized by these docs.

### Explicit acceptance checklist

- [ ] The first visible Roadmap state resembles the supplied screenshot's phase-centered visual grammar (within responsive/theme constraints), with no floating lookalike checkpoint cards.
- [ ] A phase visually changes from dim Unplanned to muted Planned after its first **accepted** checkpoint only; proposals remain plainly noncanonical.
- [ ] Directional phase arrows are clearly visible; relationship lines do not cross card content and no unrelated checkpoint is visually attached to another phase.
- [ ] Nested checkpoint identity, state, foldout and full inspector work by pointer, keyboard and narrow/split workbench.
- [ ] Progress labels/bars and six status treatments are honest across dark/light/custom contrast, hover, selection and reduced motion.
- [ ] Correction, task-stack/prompt navigation, parent diagnostics, Markdown sync/conflict/relink, source approval, viewport retention and existing Chat placement survive.
- [ ] Dope Help offers accurate, state-grounded, local-model-compatible explanation and never silently edits work or fabricates qualification.
- [ ] Direct GUI evidence and exact-source tests support the limited outcome; unobserved gates remain Not Green/Evidence Gap.

**Disposition:** Design approved, implementation not yet performed, qualification not yet earned. Preserve previously recorded Phase 10 and Phase 11 histories and current Phase 11 OPEN/NOT QUALIFIED status.
