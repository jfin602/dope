# c6-smap-sidebar-density closeout

Result: **Green for this bounded correction** (2026-10-02). The retained Phase 6 P7 result remains Not Green and P8 remains blocked.

## Candidate and scope

- Pre-task HEAD: `847b8098776a29991f2ce33844740823a6747dca`, clean Dope worktree.
- Final implementation candidate: the correction commit containing this closeout, the widget/CSS change and three focused test files. All live package versions and internal `@dope/*` dependencies remain exactly `0.6.7`.
- Changed: `packages/theia-extension/src/browser/software-map-widget.ts`, `dope.css`, `test/unit/software-map-outline.test.ts`, `test/unit/smap-placement.test.ts`, new `test/unit/software-map-sidebar-density.test.ts`, this README and closeout.
- No controller, backend, domain DTO, schema, persistence, map color or provider code changed. No root `package-lock.json` was introduced.

## Focused automated evidence

- `npm run build:extension`: passed.
- `corepack yarn workspace @dope/browser build`: passed with zero build errors.
- Affected Software Map UI/outline, placement, theme and new sidebar-density tests: 37 passed, 0 failed on the final candidate.
- After the Light-theme contrast repair and topbar correction, affected extension and browser builds passed. The focused outline, sidebar-density and theme tests passed (10/10), followed by the full directly affected set (37/37).
- The permanent sidebar tests guard the topbar title, two-row controls and disabled editor seam, published status grammar, separate diagnostics, reduced outline spacing, kind-token classes, wrapping, and selected/shared identity behavior. Existing outline tests still guard collapsed initial state and ancestor reveal preserving manually expanded branches.
- `git diff --check`, exact `0.6.7` version scan and root lockfile check passed.

## Targeted browser GUI evidence

The built Dope browser ran against `/tmp/adaptive-seo-sidebar-f1VuOm`, a disposable copy of the accepted `/home/jfin/dev/adaptive-seo-dope` reference. Source `.dope/architecture.json` and `.dope/smap.json` SHA-256 values stayed `b5a09a50397149f589a80c2f9987ec66c0023a85c75ad98b4a973ebd1d370208` and `b35801cb0d6ea2100c7fa47c28f2e75b186dab8ff9fae28cdf7fff446b4bc583`. No synthesis, regeneration or acceptance ran.

- The panel topbar rendered **SMAP CONTROLS** with no duplicate body heading. OPEN and REFRESH were inline and balanced; disabled EDIT ARCHITECTURE aligned beneath them. OPEN opened the Physical Map and REFRESH published generation 1.
- Published status read `SYNTHESIS G1 | partial | 4419 nodes | 0 violations`. The partial-analysis warning remained separately visible.
- Expanding Adaptive SEO Service showed compact file and Subsystem rows with reduced horizontal indent, colored kind tokens, and wrapping full paths/names. The accepted reference exposed no Component; focused style coverage guards it.
- Selecting Adaptive Recommendations in the outline showed its selected row, purpose, incoming/outgoing relationships and evidence. OPEN showed the same selected identity on the center map.
- Selecting Customer PHP Feed Rendering on the center map opened its missing System ancestor, scrolled and selected its outline row, and preserved a manually expanded Adaptive SEO Service branch.
- In Light (Theia), kind text and controls remained readable. The first pass exposed pale selected text; one bounded CSS repair changed selection to use the theme foreground over a focus-tinted background. The repaired selected row had readable text, a left border and heavier weight. Dope Dark was restored and the selected row remained distinct.

## Evidence limits

The accepted reference had zero architecture violations and no visible Component in this view, so those cases were covered by focused source/style tests rather than direct GUI observation. Setup, synthesis and review controls were not exercised in this initialized GUI replay; their existing action styling remains outside the compact selector and focused tests guard the separation. No AppImage or full Phase 6 qualification matrix ran for this T2 correction.
