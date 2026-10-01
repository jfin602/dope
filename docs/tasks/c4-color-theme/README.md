# Correction 4 — Dope Color Theme

Status: **GREEN / QUALIFIED — CLOSED**
Correction folder: `c4-color-theme`
Required unchanged version: `0.4.6`
Activation source: `7ef58e69c64e71ca0cceb5dd29ee540e7c70a8cf`
Predecessor: GREEN / QUALIFIED `c4-smap-storage`
Assessment: `c9aaf9495b8ccdc1a4b48a03d147fc78880135b7`
Plan: `29ecd10a302e28f32219ef7b0926befec1af8369`
Prompts: P1 `b67461ebdb5b05484339d44e88c7b858c5c475ff`; P2 `24461386505573442f954fb76ddb38772247d8f6`
Authority: ADR 0016 plus current ARCHITECTURE.md / roadmap / principles
Closeout: [closeout.md](closeout.md)

## Purpose

Make the default Dope workbench visually match the existing Dope logo before Phase 5 visual-map work starts.

This is a bounded theme correction, not a UI redesign.

## Locked palette

- background / workbench anchor: `#1F1F1F`
- primary orange: `#FF7A1A`
- highlight orange: `#FFB15C`
- deep orange: `#C75100`

## Product contract

Implement a first-class **Dope Dark** theme.

Dope Dark should map the palette into semantic workbench interaction colors such as:
- focus;
- primary buttons/actions;
- hover/pressed states;
- links;
- active Activity Bar/navigation state;
- active tabs;
- list/tree selection;
- editor selections/highlights where appropriate;
- badges/progress.

Keep semantic status and syntax colors meaningful.

Dope-owned CSS should continue consuming semantic `--theia-*` variables rather than hard-coding brand hex values into each widget.

Browser and Electron use Dope Dark as their default.

Explicit user-selected compatible themes must still work, persist normally, and deactivate Dope Dark-specific overrides.

## Scope guard

No:
- layout redesign;
- widget redesign;
- Phase 5 map canvas;
- planning model;
- Theia upgrade;
- AppImage packaging requirement;
- native GUI qualification requirement.

## Fast stack

| Prompt | Work | Execution |
| --- | --- | --- |
| P1 | implement Dope Dark + focused tests/builds | runner / no browser |
| P2 | quick visual browser check + closeout | **manual / browser required** |

P2 may make a tiny directly observed color-token/CSS fix if necessary, rerun only the affected focused check, then finish closeout. Broader defects remain Not Green rather than expanding the correction.

## Exit

Green means the default Dope browser workbench visibly uses the locked logo palette, Dope-owned surfaces inherit it coherently, and selecting another theme removes the Dope palette rather than contaminating the alternate theme.

Qualified by the P2 browser check. Route to a fresh Product Phase 5 `/docs-review`; Phase 5 implementation remains inactive until that review is approved.
