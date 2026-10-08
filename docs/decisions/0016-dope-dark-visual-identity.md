# ADR 0016 — Dope Dark visual identity and theme boundary

Status: **Accepted**
Date: 2026-10-01

## Context

Dope already ships a custom logo and app icon, but the application still defaults to Theia's generic dark theme. Most Dope-owned CSS correctly consumes semantic `--theia-*` variables, so the visible Microsoft/VS Code-like blue accent is inherited from the default workbench theme rather than scattered hard-coded widget styling.

The visual-map phase will add a much larger branded surface. The default visual language should therefore be established before Phase 5 so the future map does not grow on top of a temporary color system.

The existing product contract is dark-first but user-controlled: explicit light/dark/custom theme selections are presentation preferences and must continue to override Dope's default.

## Decision

Dope owns a first-class default dark theme named **Dope Dark**.

Locked palette:
- workbench/editor anchor: `#1F1F1F`;
- primary orange: `#FF7A1A`;
- highlight orange: `#FFB15C`;
- deep orange: `#C75100`.

### Theme ownership

Brand hex values live centrally in the Dope theme layer.

Dope-owned widgets continue to use semantic Theia variables such as button, focus, list-selection and editor background tokens. They must not duplicate the brand palette throughout component CSS.

The preferred implementation is a Dope-owned Theme registered through supported Theia theming APIs, with a narrowly scoped activation class/token layer if needed for workbench CSS variables. Do not fork Theia or replace the shell merely for branding.

Browser and Electron applications use Dope Dark as their application default.

### Brand mapping

The palette is used for product identity and interaction emphasis:
- `#1F1F1F` anchors the main workbench/editor background;
- `#FF7A1A` is the primary focus/action/active accent;
- `#FFB15C` is the lighter hover/link/highlight accent;
- `#C75100` is the deeper pressed/border/emphasis accent.

Solid primary-orange controls use a dark foreground when needed for readable contrast.

Selections may use transparent/derived variants of the orange palette; those variants remain defined centrally with the theme rather than copied into widgets.

### Status bar treatment

The default Dope Dark status bar uses a dark full-width base rather than a full-width orange fill.

The status bar contract is:
- the far-left Git branch selector is the only persistent filled brand region and uses the primary orange with a readable contrasting foreground;
- ordinary status-bar text and icons use primary orange `#FF7A1A` on the dark base;
- diagnostics adjacent to the branch selector retain semantic colors by type rather than inheriting the general orange foreground: errors remain error/red, warnings use the warning/orange semantic color, and information, hints, and other diagnostic classes use their appropriate semantic theme colors;
- no other status item receives a persistent orange background block;
- existing status-bar height, spacing, ordering, click targets, commands, hover behavior, focus behavior, and semantic meaning remain unchanged.

This treatment is scoped to Dope Dark. Alternate user themes retain their own status-bar contract when selected.

### What is not recolored

Brand identity must not destroy semantic meaning.

Do not globally recolor:
- syntax/token classification;
- errors;
- warnings;
- success state;
- source-control semantic state;
- extension-owned semantic colors where the extension/theme contract should remain authoritative.

Do not orange-wash every panel or separator.

### User override

Dope Dark is the default, not a forced mode.

An explicit compatible user theme selection must:
- remain available through the normal Theia appearance/theme controls;
- persist through Theia's existing preference mechanism;
- override the application default;
- remove/deactivate Dope Dark-specific CSS/token overrides so another theme is not contaminated by orange branding.

No Dope Light theme is required by this correction.

### Scope

This correction may change:
- frontend theme registration;
- browser/Electron default-theme configuration;
- central Dope presentation/theme CSS;
- focused presentation tests.

It must not change:
- workspace layout;
- sMap architecture semantics;
- project/domain persistence;
- planning ontology;
- Phase 5 visual-map implementation;
- editor interaction design.

## Consequences

- The app and logo share one recognizable identity before visual-map work begins.
- Existing Dope widgets benefit automatically because they already use semantic tokens.
- Future Phase 5 surfaces can consume the same theme contract.
- User-selectable alternate themes remain first-class.
- Theme code becomes a localized Theia presentation seam rather than a cross-product styling concern.

## Qualification

`c4-color-theme` uses two prompts:
1. implement/register Dope Dark, set it as default, and add focused regression/build evidence;
2. manually perform a quick browser visual check of default appearance plus theme override and close out the correction.

Green routes to a fresh Product Phase 5 `/docs-review`.

## Amendment — 2026-10-08: current Dope Dark palette and emphasis

This amendment supersedes the October 1 locked orange-as-primary color allocation and its brand-mapping examples above for **current and future UI implementation**. Those earlier values and the Green result of historical `c4-color-theme` remain accurate history; this decision does not assert that current source CSS has been migrated or that earlier qualification covers the new palette.

Current Dope Dark design tokens / intent:
- Workbench/editor anchor: `#1F1F1F` (dark-first, calm and neutral).
- **Primary interactive accent: `#336699`**, for selective active states, primary actions and intentional visual emphasis.
- Neutral secondary-control surface: `#303030`; neutral border/separator reference: `#484848`. Derive hover/focus/selected variants centrally with sufficient contrast rather than hard-coding component-specific colors.
- Orange from the original branding may remain a **rare, purposeful accent**, never the persistent default button, input-border, panel-outline, status-text or selection color. The earlier teal palette is historical and is not a competing global action accent.
- Errors, warnings, success, syntax and source-control semantics retain their meaningful theme/status colors. Do not substitute the brand accent for those semantic channels.

AI Center is the accepted reference for the quiet, compact dark visual grammar. Chat, Work, their selection states and AgentRun transcripts must use the same semantic Theia/Dope token layer, restrained boundaries and understated utility controls; see ADR 0030. Focus must remain visibly distinguishable without loud persistent borders, selected state must have non-color cues, and the user's explicitly selected compatible theme must still override Dope Dark without leakage.

Implementation and direct browser/Electron visual evidence for the updated palette are pending the bounded pre-qualification `c8-chat-work-ui` correction at unchanged `0.8.20`. Do not relabel its documentation approval as implementation or qualification.
