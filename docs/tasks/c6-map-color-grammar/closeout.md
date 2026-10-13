# c6-map-color-grammar closeout

**Decision: GREEN / QUALIFIED for the bounded map color correction at `0.6.7`.** This is supplemental presentation qualification. Product Phase 6 P7 remains **Not Green** and P8 remains blocked. The retained `c6-map-canvas-priority` P3 Not Green evidence, including the 0.564x first-fit readability blocker, is unchanged.

## Candidate and boundaries

- Pre-task HEAD: `18ce3973d0566ef9062874653e4a064f78a35888`; worktree was clean.
- Required authority `3c9e9d1367a45ee98d2b16fc558085783fcd87ea` and activation source `8625df1f468c2c8db1c1a03244a4d45b39ef2731` were fetched and reachable. The documentation-only authority was cherry-picked as `1fa6012fd6a0d4de70998488ef343a5a3a13e313`, preserving the local sMap outline work.
- Qualified implementation candidate: `9bb0a3a97e4c6bcfb5044a6d5ea6cee64deac837`.
- Production changes: `packages/theia-extension/src/browser/{smap-presentation-state.ts,physical-map-widget.ts,flow-map-projection.ts,dope.css}`. Regression changes: `test/unit/{smap-presentation-state.test.ts,flow-map-projection.test.ts}`.
- No Software Map, Physical Map, Flow query/fact, Planning Map, or project persistence schema changed. All live packages and apps remain `0.6.7`; no root `package-lock.json` was introduced.

## Implemented grammar

- One presentation palette exposes **Automatic** plus exactly ten explicit colors: blue, cyan, teal, green, yellow, orange, red, pink, purple, indigo. CSS uses Theia theme tokens and derived mixes. No per-node hex input or dependency was added.
- Automatic System colors use a stable FNV-style 32-bit hash of the System ID modulo ten. Input order, refresh, and restart cannot change a stable identity's base color; computed colors are never stored.
- Effective Architecture color resolves explicit node override, nearest explicit ancestor, automatic owning System, then neutral for unresolved ancestry. Projected parents take precedence for planned moves; source parents supply ancestry outside the visible focus. An explicit override starts a new branch hue. Clearing it removes that preference and resumes Automatic resolution.
- The developer's direct GUI correction also requires adjacent hierarchy levels to read as layers. The inherited **hue** stays related across a branch, while System, Subsystem, Component, and deeper code use distinct theme-aware fill strengths (27%, 9%, 21%, 6%). Labels, containment, border shapes, planning badges, drift styles, and outlines retain non-color meaning.
- `SmapPresentationState` still stores only explicit overrides under `dope.smap.node-colors.v1:<workspace>` in Theia StorageService. Version 1 and existing blue/green/orange/purple values remain valid. Automatic is the internal `default` reset sentinel and deletes the node's stored entry. Existing workspace isolation and late-restore/edit guards remain intact.
- The native text-only select became a compact Chromium popover listbox with ten real CSS swatches, Automatic, readable labels, an effective-color swatch in the closed button, selected state, focus-visible styling, keyboard arrows/Home/End/Escape, and screen-reader labels/state.
- Physical and Planning Map nodes pass through the same effective Architecture color resolver. Planning intent/state classes remain separate. Flow instead uses its existing deterministic layer map: layers 0–9 take successive palette entries; deeper graphs map `floor(layer * 9 / maxLayer)` to ten monotonic bins without wrapping. Edges receive a restrained target-stage tint; selection, arrows, labels, async, back-edge, role, and trace styling remain authoritative.

## Validation and direct GUI evidence

- `corepack yarn workspace @dope/theia-extension build`: pass.
- Focused six requested unit files plus `dope-theme.test.ts`: **43/43 pass** on the final candidate. Regression checks cover palette/storage validity, automatic determinism, ancestor and planned-parent resolution, workspace races, picker structure and keyboard behavior, Planning continuity, Flow branch/join/cycle and deep-layer compression, and non-color cues.
- `git diff --check`: pass. `npm run check`: pass on the final candidate, including typecheck, test suites, browser build, and Electron build.
- Used the real Dope Theia browser GUI on disposable `/tmp/adaptive-seo-map-color-ZPCDgk`, copied from `/home/jfin/dev/adaptive-seo-dope`. The source workspace was not changed. The accepted architecture was neither regenerated nor reaccepted.
- First Architecture render showed two distinct automatic System hues (Adaptive SEO Service green; Customer Site Feed Runtime indigo). Their Subsystems inherited the respective branch hue, with visibly distinct tier fills. The picker displayed Automatic and all ten named swatches in Dope Dark and Light (Theia). Arrow-key navigation moved focus through options.
- An explicit purple override on Adaptive Recommendations changed that Subsystem without recoloring its sibling or parent. It survived a workbench reload. Resetting to Automatic restored the green inherited hue. A planned Component in a disposable Planning Map inherited the Subsystem hue, used a distinct Component fill, and retained its “Declared only · Planned addition” badge/border. A deeper explicit pink Component override won only on that Component; clearing it restored Automatic inheritance. No target adoption was exercised.
- Adaptive Recommendations Flow showed 18 participants and 27 evidenced interactions: blue Inputs, cyan route processing, teal repository/output participants, and a green Store at later graph layers. The GET opportunities path, branches into the route, joins, labels, role shapes, left-to-right position, and arrows remained present. A downstream trace used stronger selected edge/node emphasis than the ordinary edge tint; partial coverage stayed visible. Flow did not alter Architecture preferences.
- Light (Theia) retained readable node text, swatches, planning badges, Flow roles, and direction. Dope Dark was restored. After restarting the browser backend, Refresh Software Map again published generation 1 as partial with **4,419 nodes and zero violations**. Stable System identities kept the same automatic hues. On the final candidate, Dope Dark showed distinct System, Subsystem, and planned Component fills; Light (Theia) directly showed distinct Subsystem and planned Component fills.

## Residual limits

- The accepted Adaptive SEO architecture has no canonical Components under Adaptive Recommendations, so direct Component layering was exercised through a planned target in the disposable copy; pure tests cover ordinary Physical/Planning ancestry and deeper overrides.
- The separate map density/first-fit issue and packaged AppImage shutdown issue were not changed or requalified. This closeout does not relabel P7, unblock P8, or claim a full Phase 6 qualification replay.
