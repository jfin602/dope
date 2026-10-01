# Correction 4 Prompt Assessment — Dope Color Theme

Status: **APPROVED / READY**
Correction folder: `c4-color-theme`
Required unchanged package version: `0.4.6`
Activation source: `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`
Docs authority baseline: `cba099208eb4546e1e5149550ae7a225f25e4b86`
Authority: ADR 0016

## Conclusion

Use exactly two prompts.

1. **P1 — implementation.** Register Dope Dark through the supported Theia presentation seam, centralize the palette, set browser/Electron defaults, and add focused permanent regressions. Runner-friendly; no browser.
2. **P2 — manual visual closeout.** Launch browser Dope on a fresh profile, visually verify the palette and key interaction states, switch to another built-in theme to prove override/deactivation, then close out. One tiny visual token/CSS fix is allowed if directly observed.

Use **GPT-6 Sol Medium** for both.

## Current source findings

### The blue is inherited, not hard-coded

`packages/theia-extension/src/browser/dope.css` already uses semantic variables for buttons, focus, inputs, selections and backgrounds.

There are no current brand hex values in the theme/UI source.

Therefore do not recolor every Dope widget individually.

### Both apps still default to generic Theia dark

`apps/browser/package.json` and `apps/electron/package.json` currently use:

`defaultTheme: "dark"`

The pinned Theia 1.75 ThemeService supports registered Themes by ID and uses frontend `defaultTheme` as the default `workbench.colorTheme` preference. A registered custom Theme can therefore become the app default while explicit user preference remains authoritative.

### Smallest clean implementation

Likely implementation:
- add one `dope-theme.ts` presentation module;
- register a Theme with ID such as `dope-dark`, label `Dope Dark`, type `dark`, and the existing dark editor theme as its syntax base;
- activate/deactivate one body/root class for Dope-specific semantic variable overrides if needed;
- keep all four locked brand colors centralized in this theme layer;
- set both app manifests' `defaultTheme` to `dope-dark`;
- keep existing widget CSS semantic-token based.

Do not rebind ThemeService unless registration timing proves the supported contribution path insufficient. Prefer supported registration over framework replacement.

### Editor/theme boundary

Use the current dark editor syntax theme as the base unless a custom Monaco theme is actually required to set supported editor/workbench color tokens.

The correction is about Dope's interaction identity, not rewriting syntax colors.

### User override is a mandatory regression

A different selected theme must not retain the Dope activation class or brand variable overrides.

P1 should install a focused regression around:
- theme registration identity;
- locked palette centralization;
- both app defaults;
- activation/deactivation or equivalent scoping;
- no widget-level duplicate palette constants.

P2 then proves the real browser behavior.

## P1 validation

Keep it fast:
- new focused theme test;
- existing `theia-baseline.test.ts`;
- affected extension build;
- browser build;
- `git diff --check`;
- version/no-root-lock.

Do not package Electron/AppImage.

## P2 manual visual check

Use a fresh browser profile/state.

Check only a compact representative set:
- overall workbench/editor background;
- primary button + hover;
- input focus ring;
- active Activity Bar / active tab;
- list/tree selection;
- link/progress/badge if visible;
- Project Mind;
- sMap sidebar/review surface if easily reachable.

Then use normal Appearance/Color Theme UI to select a non-Dope theme such as Light (Theia) or Dark (Theia).

Confirm the alternate theme visibly takes over and Dope orange overrides are removed.

Switch back to Dope Dark if convenient.

Do not turn P2 into a full IDE/browser qualification.

## Green definition

Green requires:
- first-class Dope Dark theme;
- exact locked palette;
- both apps default to it;
- brand values centralized;
- Dope widgets stay semantic-token driven;
- representative default browser visuals are coherent/readable;
- explicit alternate theme works without orange contamination;
- package remains `0.4.6`;
- no Phase 5 implementation.

Green routes to fresh Phase 5 `/docs-review`.
