# Feature Ideas

This file is the running feature idea log for ideas proposed in this chat.

## Proposed Ideas

### +F6QK — 2026-10-01 — Selectable sMap box colors for readability

- **Status:** Proposed
- **Summary:** Allow developers to choose the display color of individual sMap boxes so visually dense maps can be organized and scanned more easily.
- **Description:** Systems, Subsystems, Components, and other box-based sMap nodes should expose a simple color selection control. The chosen color should apply to the node's visual surface and use compatible text, border, selection, hover, and focus treatment so the full label remains readable in both light and dark contexts.
- **Behavior:** Color selection should be fast, reversible, and persistent for the project. A small curated palette should be available by default, with a clear reset/default option. Changing a box color should update the map immediately without requiring re-analysis or changing the node's underlying identity.
- **Architecture boundary:** Box color is developer-authored presentation metadata only. It must not change canonical System / Subsystem / Component identity, hierarchy, provenance, analysis evidence, planning semantics, staleness, or implementation behavior. AI and deterministic analyzers must not infer architectural meaning from a manually selected color unless a future explicit semantic-color feature defines that contract.
- **Readability requirements:** Every supported color must maintain sufficient contrast for labels, paths, badges, icons, and selection states. Color customization must work with the existing Dope theme and must not reintroduce text truncation or make long names harder to read.
- **Potential uses:** Visually group related areas, distinguish workstreams or responsibilities, make large maps easier to scan, emphasize important or actively edited regions, and create developer-specific visual organization without restructuring the architecture.
- **Open questions:** Decide whether colors should be selectable only per node or also inherited by descendants as an optional convenience, and whether the initial palette should be fixed theme-aware swatches or also permit custom colors.

## Shipped Ideas

## Maintenance Notes

- Add newly proposed feature ideas under **Proposed Ideas** with a short description, date, status, and any relevant context.
- Move shipped feature ideas to **Shipped Ideas** with the implementation summary and shipped date.
- Every feature idea title must begin with a plus symbol followed by a unique 4-character ID, followed by the date and title: `### +ID — YYYY-MM-DD — Feature title`.
- Feature idea IDs use this restricted Base32 alphabet after the plus symbol: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The characters I, O, 0, and 1 are excluded to reduce confusion.
- Assign IDs pseudo-randomly rather than sequentially. IDs are permanent and are never changed or reused, including after a feature idea is shipped.
- Include enough detail that the idea can be converted into an implementation prompt later.
