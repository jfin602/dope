# /prompt-ass — c12-dope-colors

**Assessment date:** 2026-11-01. **Source:** GitHub `jfin602/dope` main `2ffa61b6e0ed79e7f9259e866f2b605c3fdfd9b1`. **Status:** ASSESSED / DOCS ONLY; no implementation, package version change, test or qualification. **Governing requirement:** [ADR 0043](../../decisions/0043-dope-colors-project-identity.md), strict `dope-dark` theme eligibility.

## Source-backed state

1. **Existing theme substrate:** `packages/theia-extension/src/browser/dope-theme.ts` registers one `dope-dark` theme with body activation/deactivation; `frontend-module.ts` registers it through Theia `ThemeService`. Both browser and Electron packages specify `defaultTheme: dope-dark`. Do not fork Theia/register eight full themes.
2. **Central tokens:** `packages/theia-extension/src/browser/dope.css` defines `.dope-dark` variables (`--dope-primary: #FF7A1A`, highlight, deep, dark/neutral surfaces, and mapped `--theia-*` tokens). Many Dope widgets already consume tokens. Some widget selectors use a hardcoded orange fallback outside the main scoped definition; audit and remove any actual alternate-theme leakage before accepting the new implementation.
3. **Semantic risk:** `--dope-roadmap-planned` is currently mixed from `--dope-deep` and `--dope-roadmap-active` aliases `--dope-highlight`. These are presently branded accents but become unsafe if a project accent can be blue/green. Split meaningful Roadmap/Gate planning/qualification status colors from project customization, without changing existing Gate rules or stored status.
4. **Presentation state precedent:** `SmapPresentationState` in `smap-presentation-state.ts` persists user-visible node colors through Theia `StorageService`, but its key is the workspace URI. **Do not simply reuse that path-keyed store** for Dope Colors, which ADR 0043 requires to follow stable project identity and synchronize across windows. Keep independent map/Flow node colors.
5. **Stable project identity:** `ProjectMindController` exposes `snapshot.projectId` after attach and uses `WorkspaceService`; canonical project identity is independent of path. A project may be uninitialized, switched, or unavailable; derive identity through the appropriate existing validated project owner, and use a bounded no-collision fallback without creating canonical project data.
6. **Window/presentation seam:** `DopeWindowTitleService` in `dope-workbench.ts` currently preserves app name `Dope`; `frontend-module.ts` binds it and `WorkspaceService`. Implement a restrained Dope-owned window/header/project indicator through supported browser/Electron/Theia presentation hooks; do not assume platform-native title bars can be painted.
7. **Tests and regression:** `test/unit/dope-theme.test.ts` asserts the historic one-orange-palette mapping and theme deactivation; update tests deliberately for one default plus curated variants, keeping contrast/isolation assertions. `test/unit/smap-presentation-state.test.ts` covers async attach/late restore races worth mirroring. The project version remains `0.12.7`.

## Key risks and mitigations

- **Non-Dope theme contamination (highest priority):** resolve selected theme ID from real `ThemeService`, not a CSS guess or persisted preferred theme. Fully clear Dope accent override vars and indicators on deactivation, no startup flashes or hardcoded orange fallback; disabled controls cannot mutate appearance until eligible.
- **Shared-state vs window-state collision:** global preference is user/application local; project override is user-local and keyed by validated project identity. Preference event sync must work across distinct browser/Electron windows. A renderer-local `StorageService` alone is insufficient unless cross-window propagation is proven; validate actual Theia user preference APIs before choosing persistence. Avoid last-write-wins overwriting unrelated project overrides in a shared map.
- **Unknown/uninitialized project:** do not create `.dope/project-mind.json`, initialize AI/Map, or infer identity from Chat/active editor. Show global default until a safe identity is available; allow only non-colliding bounded fallback/migration with tests.
- **Theme semantics/accessibility:** eight design seeds are not eight guaranteed AA-ready palettes. Test computed foreground/background, 4.5:1 normal text, 3:1 applicable nontext/focus, keyboard labels and color-vision-independent window identity. No unconditional accent on every control.
- **Concurrency/lifecycle:** change project during async load, switch themes while loading or store change arrives late, same-project multi-window updates, new window, close/dispose, reload, stale project override must all fail safely.
- **Scope creep:** no whole-shell replacement, second Settings framework, other theme styling, Chat/Work agent behavior, Roadmap domain mutation, phase progression or version bump.

## Efficient six-gate split

**P1** makes the design-token foundation safe before applying alternate hues. **P2** owns authoritative selection, persistence and window-state resolution before any new control exists. **P3** wires global first-launch/settings only. **P4** wires project choice and restrained in-window identity cue. **P5** does deterministic integrated regression/builds on exact source. **P6** is the sole manually operated connected Chrome and owner-native qualification boundary. This is smaller and more repairable than one mega-UI prompt and keeps unsafe source/state changes out of a visual qualification step.

### Stop / owner safety

Source was read from GitHub main, not a local `git status`; inspect actual local checkout before a later Run. If source drift, uncommitted work or theme API differences invalidate a gate, halt/report and adapt the unstarted prompt via review, rather than clobber. Prompt authoring is not implementation or qualification.
