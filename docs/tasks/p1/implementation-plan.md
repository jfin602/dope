# Product Phase 1 Implementation Plan

Status: READY FOR EXECUTION

Phase: 1 — IDE Alive  
Execution folder: `p1`  
Activation baseline: `0.1.0`

## Source topology

```text
apps/electron (primary product shell)
        |
apps/browser (development/qualification)
        |
@dope/theia-extension
  | frontend-module.ts
  | dope-workbench.ts
  | dope.css
        |
@dope/contracts
  | WorkspaceMode
  | spike Note
        |
Theia frontend/backend services
```

Avoid new domain packages unless ordinary IDE product behavior truly needs them.

## P1 — Electron product shell + dark-first default

Target `0.1.1`: dark default with persistent user override, Dope branding/icon, ordinary-IDE-centered default layout, non-intrusive spike surfaces and deterministic shell/default regression coverage.

## P2 — IDE workflow completeness

Target `0.1.2`: inspect supported Theia 1.75 testing composition and complete integrated tests, Problems, preferences, keybindings, extensions, editor/search/terminal/SCM/debug workflow. Do not rebuild commodity IDE features.

## P3 — restoration and persistence hardening

Target `0.1.3`: workspace/editor/workbench restoration, explicit theme preference, preferences/keybindings and runtime-installed extension persistence, with safe stale-state fallback and no promotion into project-domain state.

## P4 — fresh-environment Linux package

Target `0.1.4`: qualify plugin/resource preparation from a fresh-enough state, branded AppImage/icon, resources, artifact identity and normal launch outside dev mode.

## P5 — interactive Theia GUI Dope-on-Dope dogfooding

Target `0.1.5`: direct interactive GUI gate on the actual Dope repository covering edit/search/terminal/SCM/debug/Problems/tests/preferences/keybindings/extensions/theme/restart. The GUI may be the browser-hosted Theia workbench or Electron. P4 remains authoritative for Electron packaging/native process launch. Headless/CDP-only evidence is insufficient. Record `P5-native-dogfooding-evidence.md`. Bounded repairs only; if a P5 repair changes product code, rebuild/re-smoke the Electron package so P4-style package evidence covers the repaired candidate. Finish with an exact commit subject `0.1.5`.

## P6 — evidence-only closeout

Target `0.1.6`: audit the exact P5 candidate. No repair. If Qualified, create closeout, mark README Green and route BOOT to post-Phase-1 `/docs-review` without generating Phase 2 prompts.

## Deferred

No production Project Mind, Idea/Question/Decision expansion, Planning, AI/model/provider runtime, Theia AI product integration, Agent Mind, tools/authority, AI mutation, scoped delegation or Development Sessions.

## Validation baseline

As applicable: focused tests, `npm run check`, `npm run codex:phase:validate -- p1`, no root `package-lock.json`, `git diff --check`, plus real packaging evidence for package prompts.
