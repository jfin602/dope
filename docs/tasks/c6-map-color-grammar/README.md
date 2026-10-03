# Correction 6 — Map Color Grammar

Status: **OWNER APPROVED / NOT IMPLEMENTED**
Correction folder: `c6-map-color-grammar`
Required unchanged version: `0.6.7`
Activation source: `8625df1f468c2c8db1c1a03244a4d45b39ef2731`
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: current Phase 6 plan, ARCHITECTURE, PRODUCT-MODEL, Phase 5 visual grammar, workflow, and retained Phase 6 qualification evidence

## Purpose

Improve Software Map readability from first render by giving the visual map a bounded, deterministic color grammar without turning color into architecture or Flow truth.

Architecture uses hierarchical color inheritance. Flow is the intentional exception: it may use the same bounded palette as a projection-specific directional aid so a developer can follow evidenced source -> downstream progression.

## Locked product laws

1. **Curated bounded palette**
   - Provide no more than ten map-safe colors.
   - The node color selector exposes `Automatic` plus the palette.
   - Every explicit color option shows a visible swatch and readable label.
   - The palette must remain usable in Dope Dark, supported alternate themes and color-vision-deficiency scenarios.

2. **Architecture defaults from first render**
   - Architecture/Physical Map Systems receive deterministic Automatic colors without requiring manual setup.
   - Assignment is stable for the same project and stable map identities across restart, refresh and re-analysis.
   - More Systems than palette entries may deterministically reuse palette colors rather than expanding the palette or inventing unstable colors.

3. **Parent inheritance**
   - Normal Architecture inheritance is:
     `System -> Subsystem -> Component -> deeper mapped implementation`.
   - Descendants inherit the nearest resolved ancestor color.
   - An explicit developer override becomes a new inherited color root for that branch.
   - A deeper explicit override wins for its own branch.
   - Clearing an override returns that node/branch to `Automatic`.

4. **Presentation-only persistence**
   - Explicit developer color choices are project-scoped presentation preferences and may survive restart.
   - Automatic System assignment and descendant inheritance are deterministic derived presentation state.
   - Colors do not alter canonical identity, evidence, realization, drift, Planning semantics, staleness or reconciliation.
   - Resetting color preferences must change only presentation.

5. **Planning Map continuity**
   - Planning Map projections preserve ordinary Architecture color identity so current and target structure remain recognizable.
   - Added/removed/changed/drift/realization meaning must retain non-color semantics such as shape, border, badge, edge treatment or text.

6. **Flow directional exception**
   - Flow may temporarily depart from Architecture parent inheritance.
   - Map visible evidenced source -> downstream layers deterministically through the bounded palette to reinforce direction/progression.
   - Nearby layers may share palette treatment when the visible path is deeper than the palette.
   - Branches at the same approximate downstream stage may share treatment.
   - Joins progress into the later-stage treatment.
   - Cycles/back-edges keep explicit arrow direction and must not be forced into a misleading linear color sequence.
   - Optional node/edge tinting may reinforce the directional treatment but stays visually subordinate.

7. **Direction is never color-only**
   - Deterministic layout, arrowheads, edge routing, labels, selection/trace state and other non-color cues remain authoritative.
   - Flow color must not invent execution facts, ordering, path continuity or runtime observation unsupported by evidence.

8. **Overrides stay separated**
   - Ordinary Architecture color preferences are not rewritten by Flow projection coloring.
   - If a future explicit Flow-only override is supported, it is separate presentation state and must not silently modify the node's Architecture preference.

## In scope

- curated <=10-color map palette;
- node color dropdown/swatch presentation;
- `Automatic` state;
- deterministic Architecture System defaults;
- parent-color inheritance;
- explicit override/clear behavior;
- project-scoped explicit preference persistence using the existing presentation boundary;
- Planning Map color continuity;
- Flow directional palette projection and restrained node/edge tinting;
- supported-theme and non-color accessibility treatment;
- focused presentation/controller regression coverage;
- direct GUI qualification on the accepted Adaptive SEO test workspace.

## Out of scope

Do not change:
- canonical System / Subsystem / Component identity or declarations;
- deterministic Physical Map evidence, graph facts or violations;
- `PhysicalFlowFact`, derived endpoints, extraction, stitching, aggregation, overview budgets or trace truth;
- PlanningMap / PlannedTransformation / WorkItem semantics;
- architecture synthesis or model/provider runtime;
- map persistence/domain schemas solely to store automatic colors;
- package version;
- earlier P7 or map-canvas qualification history.

## Qualification expectations

Direct GUI qualification must prove at minimum:
- a fresh Architecture map is color-grouped immediately with no manual setup;
- parent inheritance is visually correct across at least System -> Subsystem -> Component;
- explicit override -> descendant inheritance -> clear back to Automatic works and survives the intended presentation-preference restart path;
- dropdown options visibly show their colors;
- Planning Map retains recognizable Architecture color identity without losing planning-state cues;
- a representative Adaptive SEO Flow uses color to help follow source -> downstream progression while arrows/layout/labels remain sufficient without color;
- a branch and join remain understandable;
- alternate-theme and color-vision-deficiency-oriented checks retain non-color direction/state cues;
- refresh/re-analysis does not reshuffle Automatic colors for stable identities.

## Routing

Keep package version `0.6.7`.

Use one bounded manual **GPT-6 Sol High** one-off implementation prompt. Do not run this correction through `codex:phase`.

The implementation may add focused permanent regressions and perform direct GUI qualification, but it must preserve earlier P7/map-canvas Not Green evidence. A successful correction is supplemental qualification for this presentation behavior only; it does not by itself mark P7 Green or unblock P8.
