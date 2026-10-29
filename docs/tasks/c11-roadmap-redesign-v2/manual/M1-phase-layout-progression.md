# M1 — Readable Phase cards and visible progression

**Execution:** MANUAL implementation + qualification with **real Codex Google Chrome browser**. Model recommendation: GPT-6 Sol High. **Browser required: yes.** This is NOT a `codex:phase` runner stage and is NOT the final P14 gate.

## Preflight

Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0016/0040, the approved [visual hierarchy contract](../../../planning/p11/roadmap-visual-hierarchy-contract.md), [manual README](README.md), real `roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, `roadmap-status-style.ts`, `roadmap-viewport.ts` and relevant theme CSS. Inspect local Git HEAD/status and **in-progress P14 work**; never discard uncommitted owner changes or blindly replace locally edited source. Version `0.11.8` unchanged; use disposable fixtures. Do not claim M1 complete from a diagram, CSS assertions or build only.

## Objective — owner-visible correction

The current Phase cards look tiny, forcing Gate detail to be tiny. Correct their **actual displayed geometry and viewport behavior**, not merely enlarging cards within a globally zoomed-out canvas. At ordinary working zoom the Phase is a dominant readable planning container; Gate status, title, short objective and key criteria are comfortable without microscopic expansion.

Implement:

1. **Content-first card sizing.** As initial targets for a normal desktop viewport: Phase card roughly **440–560 CSS px wide**, dominant phase title about **20–24 px**, readable Gate text **14–16 px**, Gate row minimum **48–56 px**, generous internal padding, subtle dividers and independently expandable criterion/evidence details. These are **starting measures**, adapt to current Theia scaling and accessibility rather than hardcoding. Cards grow vertically for visible Gate content; long text wraps usefully, does not overlap/crop. Test real computed screen text size at displayed zoom; do not pass if CSS width is large yet canvas auto-zoom makes it unreadable.
2. **Legibility-first camera.** Initial open should focus the first actionable phase(s) at a **readable effective zoom**, not call Fit-All on 3–10 phases until they are tiny. Horizontal pan/scroll naturally reveals subsequent phases; explicit Fit All is an overview action, not the default working mode. Preserve saved intentional pan/zoom, semantic zoom, selected Gate focus, keyboard and Chat split. Don't jump/recenter when expanding a Gate.
3. **Material progression color.** Derive Phase and Gate presentation from **actual source-backed planning + qualification facts**, with semantic theme tokens, visible status/accent and thin progress track:
   - 0 accepted required Gates = readable but dim **Unplanned** neutral.
   - >=1 accepted Gate = distinct warm copper **Planned**, not implementation or qualified.
   - evidence-backed work **Active** = restrained Dope orange.
   - verified **NOT GREEN / Blocked** = muted red and textual warning.
   - current qualified **GREEN** = green label/accent/progress, only with required Gate-set approval and valid evidence.
   - Unknown/Waived/Stale = distinct named neutral/exception states, no false Green.
   Use accent rails/headers/track/fill/arrow-state where grounded, not only tiny icons. Orange remains reserved mainly for active/selected/primary action; avoid orange flood, low contrast, color-only truth, animated noise. Chronological arrows denote sequence, **never a dependency or proof**.
4. Keep original target visual grammar: charcoal rounded large Phase containers horizontally aligned, small PHASE N label, prominent title, qualified/required Gate summary, nested subordinate Gate rows and clear arrows. No equal-weight floating Gate cards/dashed ownership spaghetti; correction groups remain owned.
5. Adjust existing React Flow node measurement/handles and theme CSS **within the existing editor**. Do not create a replacement canvas, second store, new Chat or source-writing layout side effect.

## Required qualification — actually operate Chrome

Use current rebuilt Dope in connected real Chrome. Capture actual screenshot **at a usable zoom before Fit All** for a 3-Phase fixture with (A) Green evidence-backed phase, (B) planned/active or Not Green, (C) unplanned; then a 5–8 Phase long/dense variant. Show the displayed Phase width and *effective* text readability, Gate objective/criteria wrap/expansion, arrow direction, color hierarchy, normal horizontal navigation, Fit All (overview only), Fit/Focus, reload saved viewport and no surprise recentering. Exercise right/left docked Chat and narrow split, light/custom/high contrast themes, keyboard, focus/selection, reduced motion and source hashes unchanged by presentation. Do not fabricate Green fixtures without valid evidence.

Run focused `roadmap-canvas`, `roadmap-spatial-canvas`, `roadmap-semantic-zoom`, `roadmap-viewport`, status truth/theme tests, actual affected browser build, `git diff --check`. Record exact SHA, backend/served JS bundle hash, project fixture, viewport size/zoom, screenshots and DOM actions.

**PASS** only if the full-size appearance is plainly legible with meaningful progression colors at normal view. Tiny cards, fake colors/Green, missing dark/light contrast, zoom-induced unreadability or missing real-browser proof = **NOT GREEN**. Fix/replay scoped issues before continuing. Preserve any failure record. If scope passes, record manual M1 source-bound result; do **not** create a P14 PASS Git subject or start runner P15. No native Electron claim.
