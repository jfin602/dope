# Correction 5 — sMap Readability

Status: **PLANNED / BLOCKED ON PHASE 5 CLOSEOUT**
Correction folder: c5-smap-readability
Required unchanged package version after activation: 0.5.12
Activation source: **TBD — record the exact committed Phase 5 P12 closeout candidate before execution**
Authority: ADR 0008, ADR 0017, ADR 0020, current PRODUCT-MODEL / ARCHITECTURE / roadmap, issue K7MX, feature +F6QK

## Purpose

Make the existing Physical Map and Planning Map easier to understand without creating another map model or changing architectural truth.

The correction is presentation-first:
- progressive semantic detail;
- hierarchy-first rendering;
- relationships on demand;
- stable focus/orientation;
- complete visible labels;
- consistent visual grammar;
- project-scoped selectable node colors.

## Activation guard

Do **not** execute this stack while Phase 5 P11/P12 is still open.

Activation requires:
1. P11 Green;
2. P12 Phase 5 closeout Green;
3. exact committed package version 0.5.12;
4. exact activation commit recorded in this README;
5. clean intended working tree.

This correction keeps package version 0.5.12 unchanged. It must not be folded into the current 0.5.11 P11 interruption.

## Product contract

### Progressive disclosure

The project default remains Systems + immediate Subsystems.

Semantic LOD is bounded by focus:
- project overview can collapse farther to Systems only;
- a focused System may reveal Components beneath its Subsystems at closer detail;
- a focused Subsystem may reveal Components and then Code roots at closer detail;
- a focused Component may reveal Code;
- the whole repository must not explode into all Components/Code simply because the user zoomed in.

Geometric zoom may change semantic detail, but semantic-detail changes must not force a new Fit Architecture and snap the user back.

### Relationship disclosure

Containment is the quiet default.

Do not continuously render every valid dependency edge.

Selection/focus promotes the relevant typed dependency neighborhood. Focused views retain simplified cross-boundary dependency context. Unrelated edges remain hidden or visually subdued. The left sMap inspector remains the detailed provider-free explanation surface for incoming/outgoing relationships, evidence and source.

### Label truth

Issue K7MX is authoritative for labels.

A label may be absent because its semantic LOD is intentionally not active. If a label is rendered, its complete value must be visible. No ellipsis, clipping or hidden suffix may substitute for a System, Subsystem, Component, code entity, module/file path or other displayed identity.

Wrapping, path-aware break opportunities, node growth and layout reflow are allowed and expected.

### Orientation

Preserve:
- shared selection identity;
- Project -> System -> Subsystem -> Component breadcrumbs;
- Focus / Up / Fit Architecture;
- focused tabs;
- source-navigation round trip;
- outside-focus context where needed.

### Colors

Feature +F6QK is implemented as presentation metadata only.

Use a small curated theme-aware palette plus Default/Reset. Store only a stable palette key by project/workspace + architecture identity. Do not store arbitrary semantic meaning.

Color may tint/fill/accent a node, but:
- text must remain readable;
- realization/drift/planning/conflict borders and markers remain meaning-bearing;
- color must not replace shape/hierarchy/edge semantics;
- analyzers, canonical architecture, Physical Map evidence and Planning Map logic never consume the color;
- color persistence is workbench presentation state, not .dope architecture/planning truth.

Initial correction requires restart persistence in the same Dope profile/project. Cross-machine/project-copy portability is not required.

## Existing implementation seams

Primary files:
- packages/theia-extension/src/browser/physical-map-projection.ts
- packages/theia-extension/src/browser/physical-map-controller.ts
- packages/theia-extension/src/browser/physical-map-widget.ts
- packages/theia-extension/src/browser/planning-map-projection.ts
- packages/theia-extension/src/browser/software-map-widget.ts
- packages/theia-extension/src/browser/dope.css
- packages/theia-extension/src/browser/frontend-module.ts

Existing focused tests:
- test/unit/physical-map-canvas.test.ts
- test/unit/physical-map-navigation.test.ts
- test/unit/planning-map-ui.test.ts
- test/unit/software-map-ui.test.ts

The current left inspector already exposes selected-node purpose/source/incoming/outgoing/evidence. Reuse and synchronize that surface; do not introduce a provider-backed Explain This feature.

## Prompt stack

| Prompt | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | projection/detail/relationship model + deterministic layout | T1 | GPT-6 Sol High | no |
| P2 | React Flow semantic zoom + full labels + visual/orientation integration | T2 | GPT-6 Sol High | no |
| P3 | project-scoped theme-aware node colors | T1 | GPT-6 Sol Medium | no |
| P4 | direct Adaptive SEO browser qualification + closeout | T3 | GPT-6 Sol High | yes |

P1-P3 are runner-friendly only **after activation**.
P4 is a manual browser handoff.

## Non-goals

No:
- Data Flow;
- new durable map/database;
- canonical architecture schema changes;
- Physical Map evidence/domain changes;
- PlanningMap/PlannedTransformation/WorkItem semantic changes;
- staleness/rebase/adoption/reconciliation redesign;
- model/provider calls;
- AI explanation/chat;
- agent authority/delegation;
- free-form custom color picker;
- new Theia shell architecture.

## Exit

Green means a developer can open the mapped Adaptive SEO fixture and:
- understand project hierarchy before seeing dense dependencies;
- zoom/focus deeper without viewport snap-back or project-wide detail explosion;
- select a node and see only the relevant relationship neighborhood while the inspector explains full detail;
- read every displayed map identity in full;
- stay oriented through breadcrumbs / Focus / Up / Fit Architecture;
- assign/reset a theme-aware node color and see it persist across reopen/restart without changing map semantics;
- use the same behavior in Physical and Planning Map projections;
- preserve alternate-theme readability.

If Green, Phase 6 may activate from the successor 0.6.0 baseline.

Registry entries K7MX and +F6QK are **not** automatically resolved by this stack. Use the explicit /resolve workflow after Green closeout.
