# Known Issues

This file is the running issue log for problems reported in this chat.

## Open Issues

### K7MX — 2026-10-01 — sMap box text truncates important paths and names
- **Status:** Open
- **Summary:** Text rendered inside sMap boxes must not be truncated, clipped, or replaced with ellipses when it represents an architectural name, code entity name, file/module path, responsibility label, or other map-visible identity. If information is important enough to appear on the map, the user must be able to read the complete value directly on the map.
- **Observed behavior:** Some sMap boxes can constrain their text to a fixed area and shorten long values, which can hide meaningful suffixes or path segments and make distinct architecture/code entities appear ambiguous or indistinguishable.
- **Expected behavior:** Whenever sMap box text is rendered, the complete value must remain visible. The renderer should prefer readable wrapping, path-aware line breaking, box growth, minimum-size adjustment, or layout reflow rather than truncation. Long file/module paths should wrap at sensible boundaries such as path separators when possible without altering the underlying text. A tooltip, hover state, inspector, or selection detail may supplement the box but must not be the only way to recover text that the box has truncated.
- **LOD boundary:** Intentional whole-label suppression at a deliberately lower-detail zoom level is separate from truncation. If a label is shown at a given level of detail, it must be shown completely rather than partially shortened. Zooming or fitting the map must not convert visible labels into ambiguous ellipsized versions.
- **Layout boundary:** The fix may change node dimensions, wrapping, spacing, and map layout calculations as needed to preserve legibility, but it must not alter canonical sMap names, paths, hierarchy, provenance, node identity, or architecture semantics merely to make text fit.
- **Regression coverage:** Add deterministic rendering/layout coverage for long System, Subsystem, Component, code-entity, and file/module-path labels. Tests should prove that rendered labels contain the full source text, no CSS/text-layout path applies ellipsis or clipping to map-visible identity text, path wrapping preserves every character in order, expanded boxes remain measurable by the layout engine, and fit/zoom/theme changes do not reintroduce truncation at supported detail levels.
- **User impact:** Truncated map text removes exactly the identifying information needed to understand and navigate the software. Complete labels make the sMap trustworthy as a working architectural view instead of forcing the developer to guess which path, component, or entity a box represents.

## Resolved Issues

## Maintenance Notes
- Add newly reported problems under **Open Issues** only. Refuse product ideas, feature ideas, or general enhancements for this file.
- Move solved problems to **Resolved Issues** with the fix summary and resolution date.
- Every issue title must begin with a unique 4-character ID, followed by the date and title: `### ID — YYYY-MM-DD — Issue title`.
- Issue IDs use this restricted Base32 alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The characters I, O, 0, and 1 are excluded to reduce confusion.
- Assign IDs pseudo-randomly rather than sequentially. Issue IDs are permanent and are never changed or reused, including after an issue is resolved.
