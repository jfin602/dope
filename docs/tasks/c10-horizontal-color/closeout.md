# c10-horizontal-color — Visual verification pending (P11)

**Status: P6-P10 IMPLEMENTATION COMMITTED through `726f10b4c9`; P11 VISUAL QUALIFICATION NOT GREEN / PENDING.**

The original P6 implementation-only handoff and its authentic focused test/evidence record are preserved verbatim in [history/P6-original-closeout.md](history/P6-original-closeout.md) and [history/P6-original-presentation-implementation-closeout.txt](history/P6-original-presentation-implementation-closeout.txt). Historical source had completed P1–P5, and the old P6 closeout was manually recorded at `ddbac418`. It **did not** include direct browser/native confirmation.

## Four observed live defects (plus motion)

1. Corrections from the imported Roadmap appeared in one flat horizontal row rather than above their numbered parent phases.
2. No meaningful relationship lines connected phases, corrections, supporting prompts or real dependencies.
3. Status color affected small text/indicators rather than the complete checkpoint card.
4. Initial viewport `fitView` made 31 imported checkpoints microscopic rather than focusing near the current active/actionable phase.
5. Restrained route/selection animation and reduced-motion behavior had not been proven.

The prior manual P9 family also ended **NOT GREEN after three cycles** due to an unrelated `c4-color-theme` source-status conflict (local Active vs summary Green). See `../c10-roadmap-qualify/qualification/loop-1-markdown/family-summary.md`. Do not silently resolve that contradiction through a visual change.

## Implementation and qualification split

New P6–P10 are bounded **source implementation prompts** within this correction; P11 is the **browser-required evidence closeout** that must update this living record only after direct testing of the exact committed product source. Prior qualification is not retroactively Green. `0.10.16` stays unchanged. P11 is not Phase 10 P14 and does not owner-close Phase 10.

## P11 completion record (fill with actual observed proof, not expectations)

- **Exact independently committed product SHA:** PENDING
- **Package/build and local Git state:** PENDING
- **Imported fixture file and original SHA-256:** PENDING
- **Browser UI controller, screenshot paths, actual first viewport/zoom and branch/line/color observations:** NOT RUN
- **Independently controlled native Electron window and screenshot paths:** NOT RUN
- **Dark/light/reduced-motion, narrow pane, semantic zoom/Focus/Fit/refresh/restart:** NOT RUN
- **Convention-derived parent association vs stored dependency check:** NOT RUN
- **Historical Not Green/Waived, unresolved-reference classes and authority non-mutation:** NOT RUN
- **Focused tests actually run / failures and their fixes:** NOT RUN
- **Final presentation-only disposition:** NOT GREEN / EVIDENCE GAP pending P11
- **Remaining Phase 10 qualifications:** owner-approved P9 requalification must preserve earlier NOT GREEN and resolve c4 source authority separately; P10–P14 still independently required. Historical P16/P19 NOT GREEN.

**Decision law:** mark *this presentation correction* Green only if P11 records direct browser AND native observations passing the four repairs, restrained/reduced motion, and preservation gates on a coherent committed candidate. Missing controller/evidence = BLOCKED/EVIDENCE GAP, never claimed PASS. Follow-up edits to code require source-specific re-observation. No manual P9/P12/P13/P14 or full `npm run check` outcome may be inferred from this closeout.

## Live P11 visual defect added before closeout: unwanted task-stack containers

A screenshot from the real P11 browser fixture shows unrequested full-size `task-stack` cards ("Phase 6 prompts", "Correction edit-architecture") emerging at closer zoom with `Unknown` and omitted-prompt text. The source model's phase/checkpoint `roadmapVisibleGraph()` auto-disclosure is consistent with this symptom. **The visual gate is NOT GREEN** until zoom-only clutter is removed and explicitly expanded prompt browsing is proved without hiding corrections, losing prompt navigation or leaving disconnected lines/large blank space. This note is a defect and acceptance requirement, **not** evidence of a repaired browser/native candidate. The actual P11 closeout must replace PENDING/NOT RUN entries only with direct source-bound observations; historical P6 records and P9 Not Green are retained.
