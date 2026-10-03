# Known Issues

This file is the running issue log for problems reported in this chat.

## Open Issues

### UBGG — 2026-10-02 — Architecture cannot assign distinct ownership within one source file

- **Status:** Open — deferred
- **Summary:** Edit Architecture and Search Deeper cannot assign a distinct canonical implementation root to a proposed Component when its parent Subsystem and the Component are evidenced by separate responsibilities inside the same source file. Current roots are project-relative path selectors; a file path can have only one exact owner.
- **Observed behavior:** In the disposable Adaptive SEO qualification workspace, accepted-map Search Deeper on `Customer PHP Feed Rendering` proposed a Component using `src/server/installations/generated-php-installation.ts`, the same file already owned by that Subsystem. A replay with Gemini `gemini-3.5-flash` produced a source-backed preview, but accepting the proposed structure would create `ambiguous_root`. The current guard keeps this conflicting result in preview with a diagnostic and leaves the draft and canonical files unchanged. The file contains both `validDeliveryOrigin` and `generatePhpInstallation`; the evidence does not provide separate file paths for them.
- **Expected behavior:** When distinct responsibilities within one file warrant distinct Architecture boundaries, Dope needs an explicit, source-backed way to assign each boundary accurately, or a clear leaf/no-stable-Component disposition when that cannot be established. Search Deeper must not silently invent a path, assign the same exact root to multiple boundaries, or imply that a blocked proposal is savable.
- **Authority boundary:** Canonical ownership remains developer-controlled. Assigning the surrounding `src/server/installations` directory to this Subsystem would also claim unrelated files, so it is not a valid automatic repair for this case. Any future subfile/symbol-level ownership scheme must define stable identity, source navigation, deterministic analysis and persistence semantics before it can replace path-only roots.
- **Disposition:** Defer the ownership-granularity design and implementation to a separately approved task. The current correction retains the safe preview diagnostic; it does not change canonical root semantics or the retained Phase 6 qualification status.
- **Regression coverage:** Keep the same-file conflict guard. A future resolution should test distinct responsibilities in one file, sibling and ancestor ownership, source changes and renames, canonical save/reload, deterministic map projection, and the case where evidence supports no stable Component boundary.
- **Developer impact:** The developer cannot accept a legitimate Component split inside one file through Search Deeper today without restructuring source files or retaining the responsibility as a leaf Subsystem.

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
