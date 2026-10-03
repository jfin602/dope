# Correction 6 — Map Canvas Priority

Status: **P3 NOT GREEN / P7 AND P8 BLOCKED**
Correction folder: `c6-map-canvas-priority`
Required unchanged version: `0.6.7`
Activation source: `561ad62678f6e20a6da21b3537d136290d07f0e3`
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: current Phase 6 plan, ARCHITECTURE, PRODUCT-MODEL, roadmap, workflow, retained P7 evidence, and the subsequent P7 requalification result

## Purpose

Make the Physical Map / Flow center workspace diagram-first without changing Software Map or Flow truth.

The map is the primary workspace. Supporting controls and immediate inspection UI must consume the minimum persistent space necessary.

The correction addresses the fresh P7 presentation failure in which the intended focused Flow is now available but the focused Subsystem canvas is too dim to read immediately.

## Locked product laws

1. **One compact map toolbar**
   - Architecture/Flow mode and genuinely map-global actions share one compact toolbar.
   - The toolbar overlays or minimally borders the map rather than creating a large permanent region above it.
   - Context-specific node/edge actions remain contextual rather than bloating the global toolbar.

2. **Icon-first controls**
   - Replace ordinary text-heavy map tool buttons with recognizable icons where a clear visual representation exists.
   - Every icon action has a descriptive tooltip, accessible name, keyboard operation, and non-color active/disabled state.
   - Dope-specific actions that are not self-evident must remain explicitly explained.

3. **Maximum practical canvas**
   - Architecture and Flow consume the maximum useful center-workspace area.
   - No persistent center details pane may substantially shorten the graph viewport.
   - Architecture and Flow use the same canvas-priority shell.

4. **Floating selected-object inspection**
   - The current center details area becomes a floating overlay over the map.
   - It supports **expanded**, **compact**, and **minimized** states.
   - Minimized state remains a small recoverable affordance rather than clearing the selection.
   - Existing deterministic evidence/provenance/source actions remain available.

5. **Stable context and geometry**
   - Overlay state changes preserve selection, focus, trace and source-navigation context.
   - Opening, compacting or minimizing details should not force graph re-layout.
   - Actual workspace resize may recompute available canvas bounds normally.

6. **Immediate readability**
   - The focused map must be readable immediately under Dope Dark and supported alternate themes.
   - Active/focused paths and selected objects remain clear.
   - Subdued context remains perceptible instead of becoming effectively invisible.
   - Color is not the only state cue.

7. **Inspector authority remains split correctly**
   - The floating overlay is immediate map inspection.
   - The left sMap inspector remains the deeper provider-free hierarchy, responsibility, relationship, evidence, source and diagnostics surface.
   - This correction does not move that authority into the center overlay.

## In scope

- shared Physical Map / Flow center workspace presentation shell;
- toolbar consolidation;
- icon controls and tooltips;
- overlay details presentation and minimize/restore behavior;
- responsive canvas sizing;
- theme/readability tuning required by the P7 failure;
- focused presentation/controller tests;
- direct GUI qualification on the accepted Adaptive SEO test workspace.

## Out of scope

Do not change:
- `PhysicalFlowFact`, Flow endpoint or extraction semantics;
- Flow overview/query/aggregation behavior;
- hard query budgets;
- trace semantics repaired by `c6-flow-overview-priority`;
- canonical architecture or accepted sMap state;
- Flow persistence;
- Planning Map domain semantics;
- Phase 7 AI Presence;
- the packaged AppImage controlled-shutdown defect unless UI work directly causes it.

The native controlled-shutdown failure remains a separate P7 blocker.

## Approved decomposition

| Prompt | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | canvas-first shared map shell + unified toolbar | T2 | GPT-6 Sol High | no |
| P2 | inspection overlay + icon controls + focused readability | T2 | GPT-6 Sol High | no |
| P3 | direct Adaptive SEO GUI qualification + correction closeout | T3 | GPT-6 Sol High | yes |

Prompt files:
- `P1-canvas-first-workspace.txt`
- `P2-inspection-overlay-icons.txt`
- `P3-browser-qualification-closeout.txt`

Supporting planning:
- `prompt-assessment.md`
- `implementation-plan.md`

P1-P2 are runner-friendly implementation/integration prompts at unchanged `0.6.7`. P3 is the manual browser handoff.

## Version and routing

- Keep every correction prompt at coherent package version `0.6.7`.
- Do not advance to `0.6.8`.
- Preserve all earlier P7 Not Green evidence.
- After this correction qualifies, resume P7 rather than treating the correction itself as Phase 6 closeout.
- P8 remains blocked until P7 is Green, including native release/process evidence.

## P3 disposition

P1/P2 are implemented at `0.6.7`. P3's direct browser replay at `d4f17c7338196aaf78f5851dce42622527c166e4` is **Not Green**: the query reports 27 summarized Adaptive Recommendations relationships, but the Flow canvas renders zero participants/edges because its projector consumes raw `facts` rather than overview `aggregates`. The focused suite and `npm run check` also fail. See `closeout.md` for the exact automated and nine-area GUI evidence.

Repair this projection contract and its stale backend test in a separately bounded correction, then replay the exact GUI gate. P7/P8 remain blocked; the packaged AppImage controlled-shutdown failure is a separate unresolved P7 blocker. Do not advance the package version or relabel earlier P7 evidence.
