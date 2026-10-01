# Correction 4 Implementation Plan — Dope Color Theme

Status: **APPROVED / READY**
Correction folder: `c4-color-theme`
Required unchanged package version: `0.4.6`
Activation source: `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`
Assessment source: `c9aaf9495b8ccdc1a4b48a03d147fc78880135b7`
Authority: ADR 0016 plus current ARCHITECTURE.md / roadmap / principles

## Shared contract

Locked palette:
- `#1F1F1F` — workbench/editor anchor;
- `#FF7A1A` — primary orange;
- `#FFB15C` — highlight orange;
- `#C75100` — deep orange.

Dope Dark is the default, not a forced global override.

Dope-owned widgets continue consuming semantic Theia variables. Brand hex values are centralized in the theme layer.

Do not recolor semantic diagnostics or syntax wholesale.

Package stays exactly `0.4.6`.

## P1 — Implement Dope Dark

### Goal

Introduce one first-class Dope Dark theme through supported Theia theming seams, make it the browser/Electron default, and add focused permanent regressions.

### Preferred implementation

Inspect the pinned Theia 1.75 theme lifecycle before editing.

Prefer:
- a small browser presentation file such as `dope-theme.ts`;
- a Theme with stable ID `dope-dark`, label `Dope Dark`, type `dark`, and the existing dark editor theme as the syntax base;
- supported `ThemeService.register` integration through a normal frontend contribution;
- theme `activate` / `deactivate` behavior that scopes Dope-specific CSS variables to an explicit class on the document root/body;
- no ThemeService fork/rebind unless the supported registration path cannot correctly activate the configured default;
- existing `dope.css` as the central stylesheet, with a single clearly marked Dope Dark token block.

The exact lifecycle implementation may differ if current Theia APIs require it, but keep the seam localized.

### Token mapping

Centralize the four brand constants once.

Map them into representative semantic Theia workbench variables for:
- editor/workbench background;
- focus border;
- primary button/background/hover/pressed treatment;
- links;
- active Activity Bar/navigation state;
- active tabs;
- list/tree selection and selection outline;
- editor selection/highlight where appropriate;
- badges/progress.

Use derived transparent orange values only inside the central theme block.

Do not duplicate locked hex values in Project Mind or sMap widget selectors.

Solid primary-orange controls should use a dark foreground where necessary for contrast.

### User override

Dope Dark activation must be reversible.

When another Theme becomes active:
- remove the Dope Dark class/token scope;
- allow the selected theme's own `--theia-*` values to take over;
- preserve normal Theia user preference persistence.

No custom Dope Light theme is required.

### App defaults

Update both:
- `apps/browser/package.json`;
- `apps/electron/package.json`;

so frontend `defaultTheme` is `dope-dark`.

Do not add a user-level hard-coded `workbench.colorTheme` preference that would override later explicit user choice.

### Permanent regression coverage

Add one focused theme test, preferably `test/unit/dope-theme.test.ts`, and wire it into the appropriate baseline/product script.

Prove statically or with the smallest practical unit harness:
- stable ID/label/type;
- locked palette values;
- palette centralized in theme implementation/CSS block;
- both apps default to `dope-dark`;
- activation/deactivation is scoped/reversible;
- Dope widget CSS remains semantic-token based;
- obvious old direct blue brand constants are not introduced.

Update existing `theia-baseline.test.ts` expectations from `dark` to `dope-dark` where applicable.

### P1 validation

Run:
- focused theme test;
- `theia-baseline.test.ts`;
- extension build;
- browser build;
- `git diff --check`;
- package version/no-root-lock check;
- correction prompt validation when prompts exist.

Do not run:
- AppImage packaging;
- native Electron launch;
- full browser interaction;
- Phase 5 work.

### P1 handoff

Report exact changed files, registration approach, token mapping, tests/builds and readiness for manual P2.

## P2 — Manual browser visual check + closeout

### Goal

Quickly verify the actual default workbench appearance and user theme override, then close the correction.

### Execution

Manual only. Browser required.

Use a fresh browser profile/context or otherwise clear prior theme state so an old persisted theme cannot mask the application default.

Start/open the browser Dope application against the real Dope repository.

### Visual/default checks

Confirm:
- current theme is Dope Dark by default;
- main editor/workbench anchor visibly matches `#1F1F1F`;
- primary action/focus accent is `#FF7A1A`;
- hover/highlight treatment uses `#FFB15C`;
- deep/pressed/emphasis treatment uses `#C75100` where implemented;
- primary-orange control text remains readable;
- active Activity Bar/nav/tab state reads as branded but not noisy;
- list/tree/editor selection accents are coherent;
- Project Mind and sMap inherit the theme without widget-specific mismatched blue;
- errors/warnings/success/syntax remain semantically distinguishable.

Use visual inspection plus a few computed-style checks where easy. Do not exhaustively sample every token.

### Override check

Through normal Appearance / Color Theme UI:
1. switch to a non-Dope theme, preferably Light (Theia) or Dark (Theia);
2. confirm the selected theme takes over;
3. confirm Dope orange override variables/class no longer contaminate it;
4. optionally switch back to Dope Dark.

This is the required user-control proof.

### Tiny-fix allowance

If the visual check exposes one small direct defect such as:
- unreadable foreground;
- missed focus token;
- stale orange class after theme switch;
- one obvious lingering default-blue active indicator;

P2 may apply the smallest theme/CSS correction, add/update the focused regression, rebuild the extension/browser, and recheck that exact surface.

Do not use this allowance for layout redesign, theme architecture replacement or Phase 5 work. Larger defects make the closeout Not Green.

### Closeout evidence

Write:
- `docs/tasks/c4-color-theme/closeout.md`;
- update this correction README status/routing.

Record:
- exact candidate;
- focused P1 validation;
- browser/default result;
- override result;
- any tiny P2 correction;
- residual visual gaps;
- Green/Not Green decision.

No AppImage/native packaging is required.

## Exit

If Green, route to a fresh Product Phase 5 `/docs-review`.

Phase 5 implementation remains inactive until that docs review is approved.
