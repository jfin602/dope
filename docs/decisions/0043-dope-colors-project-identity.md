# ADR 0043 — Dope Colors: Dope Dark accents and project identity

**Decision:** 2026-11-01, owner-approved design.
**Status:** ACCEPTED FOR FORWARD IMPLEMENTATION / DOCUMENTATION ONLY; NOT IMPLEMENTED OR QUALIFIED.
**Product:** `0.12.7` unchanged.
**Related authority:** [ADR 0016](0016-dope-dark-visual-identity.md) (restrained-orange Dope Dark), [ADR 0037](0037-human-centered-ui-and-usability.md), [ARCHITECTURE](../ARCHITECTURE.md), [PRODUCT-MODEL](../PRODUCT-MODEL.md).

## Context and intent

Dope Dark currently expresses the application's identity through restrained orange interaction accents over neutral charcoal surfaces. The owner wants a user-chosen default accent and an independent per-project accent, chiefly so multiple open Dope windows have recognizable project identities at a glance. This must extend, not replace, the existing Theia-based theme and semantic token architecture.

## Decision — strict theme eligibility

**Dope Colors works only while the selected theme ID is `dope-dark` (Dope Dark).**

- No custom accent token overrides, Dope Colors window indicators or new Dope Colors color-picker interactions may affect other themes, including Theia light/dark themes, third-party themes and high-contrast/custom themes. Their theme colors and their existing controls remain authoritative.
- When any other theme is active, Dope Colors configuration is hidden or clearly disabled with an explanation that it requires Dope Dark. Saved global/project selections remain intact but dormant; switching back to `dope-dark` restores their effective values without another choice.
- Do not auto-switch users into Dope Dark when they create/open a project or choose another compatible theme. Dope Dark stays the browser/Electron **default**, not a forced theme.
- The color-selection offer is optional and nonblocking on first eligible Dope Dark use. Users on a different theme are not interrupted by a Dope Colors onboarding dialog.

## User experience and precedence

1. **Global Dope Color:** an application/user-level preference; first eligible launch offers a curated color choice with **Dope Orange** preselected, and Skip retains orange. The choice is editable later in Dope appearance settings, only when Dope Dark is active.
2. **Project Color:** each eligible project can choose **Inherit Global** (default) or an explicit curated preset. Offer the choice nonblockingly when creating/opening a project and through project appearance/settings after opening it. Do not add mandatory setup steps or replace the existing project-opening flow.
3. **Effective accent:** only under `dope-dark`, `effectiveAccent = projectOverride ?? globalDefault ?? orange`. Explicit project overrides win; a global change updates only inheriting project windows. Reset to Inherit restores the then-current global color.
4. **Multi-window identity:** the effective project accent applies to that window only, including a restrained Dope-owned window-header/project identity cue and appropriate existing action/active tokens. Each open project's name or label remains legible as a non-color identifier; color is reinforcement. Use supported Electron/browser shell capabilities and do not assume platform-native OS title bars are arbitrarily recolorable.
5. **Persistence and refresh:** settings survive restart, browser reload, project re-opening and window re-creation. When the same stable project is shown in multiple windows, project-preference changes synchronize consistently; two different projects never leak accent state between windows.

## Curated accents and derived token roles

Initial curated candidates are **Orange** `#FF7A1A` (canonical default), **Blue** `#579CF5`, **Purple** `#A782ED`, **Emerald** `#37BE91`, **Crimson** `#E56A72`, **Amber** `#D9A944`, **Cyan** `#43BAC9`, and **Pink** `#E18DBB`. Except for the established orange default, these are **design seed references**, not pre-qualified final token or contrast values. Adjust derivatives or seed values as needed to pass visual and accessibility checks before shipping.

A selected seed resolves centrally into contrast-tested accent, hover/highlight, pressed/deep, on-accent foreground, focus-visible, selection and translucent accent tokens. Map compatible Dope/Theia **interaction** tokens through the existing `dope-dark` theme layer; do not create eight complete themes, fork Theia, hard-code color copies across widgets or repaint neutral panels. Preserve the existing `#1F1F1F` workbench anchor, subdued neutral surfaces/borders, compact AI Center/Chat/Work grammar, and the restrained primary-action allocation of ADR 0016. The bounded filled Git branch segment may use the effective Dope accent when Dope Dark is active, with independently validated foreground contrast.

**Project identity color is never a semantic state color.** Do not recolor error/warning/success, tests, SCM meaning, syntax, diagnostic severity, Roadmap/Gate planning-versus-qualification states, chart categories, Chat's independent ten-color organizational palette, or map/Flow node palettes. In particular, existing Roadmap status variables currently derive some status colors from `--dope-highlight` / `--dope-deep`; implementation must separate semantic statuses from customizable project accents. Selection and active emphasis may use the accent, but meaningful progress/status colors cannot inherit it. Retain readable labels, state text/icons and focus cues so color is not the sole signal.

## State ownership and isolation

Global Dope Color belongs to local application/user presentation preferences. A project override is **user-local project presentation metadata**, keyed by validated durable project identity rather than only a mutable absolute path or window ID. It is neither canonical Project Mind data nor Architecture/Physical Map evidence, Roadmap semantics, Git metadata, provider settings or AI input. Do not write it into `.dope/project-mind.json` or create a new canonical project owner. Where project identity is not yet initialized, use a bounded safe fallback and reconcile to stable identity on attachment; multi-root/remote/invalid identities must fail safely rather than sharing unrelated colors.

Use one existing supported Theia theme registration/selection seam; resolve preferences/window-scoped CSS variable overrides in the Dope-owned frontend presentation layer only. Theme change, project switch, and disposal must remove stale overrides before showing another project. No inference/model calls, work execution, Git mutations, new chat system or backend authority changes are needed to color a window.

## Qualification and rollout

Implementation is a **future, separately authorized bounded correction**, not part of active Phase 12 Pi/Planning/Docs correction stacks. Required direct evidence:

- First eligible Dope Dark launch defaults to orange and offers an accessible, skippable choice; global selection persists through restart.
- Project creation and opening can inherit or override; editing/reset works, and two different simultaneous project windows retain independent identifiers and colors through reload and switching.
- Multiple windows for the same project synchronize preference changes; global changes affect inheriting windows only.
- Every non-`dope-dark` theme receives **zero Dope Colors overrides** and no active Dope Colors controls; switching away and back restores preferences without contaminating or forcing the other theme.
- Verify accessible contrast (WCAG AA 4.5:1 for normal text and 3:1 for applicable nontext/interactive boundaries), keyboard/focus/non-color cues, narrow panes and all curated variants with actual computed styles.
- Verify semantic Gate/status colors, diagnostics, editor syntax, SCM, independent Chat/map palettes and neutral workbench surfaces remain truthful and legible under every accent.
- Regress existing theme registration/preferences and browser/Electron lifecycle; directly test Chrome and independently qualify native Electron window behavior where relevant. Source tests alone do not establish GUI Green.

This ADR records the **approved future behavior only**. No product code, package version, historical qualification or runtime behavior changes through documentation adoption.
