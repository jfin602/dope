# c8-work-mode / P9 — GUI qualification closeout

Date: 2026-10-08

Disposition: **NOT GREEN — real GUI blocker**

Final inspected source HEAD: `48dcfd202866dfd3814c7292d331ef9a886fadb6`
Package version: `0.8.20` (unchanged)

## Candidate and validation

P1–P8 are committed at `b6c3951`, `a62910f`, `16f63e2`, `33d95ba`, `196cac2`, `6eee315`, `f640970`, and `48dcfd2`. Their handoffs and focused evidence were reviewed. P2's original handoff recorded a 15/16 adapter-file failure involving its isolated npm-toolchain case; that observation remains historical. The same file passed in the final-candidate supplemental run below.

`npm run check` was executed **once** on the final source candidate and passed: typecheck; runner 103/103; baseline 11/11; local-install 1/1; product 329/329 plus 28/28; IDE 1/1; browser and Electron builds. That is 473 passing tests in the aggregate. The eight Work-related test files absent from the aggregate were run afterwards and passed 32/32, including the provider adapter file. `git diff --check` passed. No root `package-lock.json` exists. The root and browser manifests remain `0.8.20`.

The committed P1–P8 source diff was inspected around provider observations, runtime transcript projection, panel/launcher wiring and sequence selection. No P9 source edits were made. Provider sandbox, candidate validation, authorized promotion, manual-gate and checkpoint rules were not exercised by this GUI pass, so this closeout does not make a fresh dynamic qualification claim for those boundaries.

## Direct GUI observations

The real browser-hosted Theia application was launched against disposable Git project `/home/jfin/dev/c8-work-mode-p9-WAQ12E` (baseline `0a6f87fea6603e956db6e7b8eee800409cbf8bca`). Left and right Work toolbar icons opened separate panels. The command palette listed `Dope: Open Work` and Work-in-Left/Right/Center/Bottom; its Bottom and Center actions visibly opened Work panels in those areas. The fixed `Chat | Work` toggle rendered in the panels, and narrow sidebars kept their header and `New Work` button visible.

**Blocking failure:** Work stayed at **“Loading Work…”** with no history or usable direct composer. The browser console reported `Another channel with the id '/services/dope/agent-runtime' is already open.` for multiple panel proxies. Current source binds `AgentRuntimeService` through `ServiceConnectionProvider.createProxy` in `packages/theia-extension/src/browser/frontend-module.ts` without singleton scope, while each Chat/Work panel obtains that service. This is a concrete likely cause of the observed channel collision. The binding and the live failure need an explicit source repair and requalification; the aggregate tests did not detect it.

Consequently no direct Work or explicit execution grant was started in the disposable project. Agent-visible text, chronological transcript, command collapse/details, safe formatting, validation/authority display, scroll follow, Latest, Stop versus panel navigation, stable task-derived title, same-Work ownership, distinct Work selection, and no duplicate run on selection could **not** be qualified in the GUI. No saved disposable Work exists to reopen after restart. These are evidence gaps, not passes.

## Restart and completed-project regression

The browser backend was stopped and restarted with `/home/jfin/dev/adaptive-seo-dope`, then the UI was reloaded. The application showed the Adaptive SEO workspace and its saved Chat list, and Work again stayed at **“Loading Work…”**. The completed `c4-dope-phase-stack-smoke` Prompt Stack did **not** auto-discover visibly in Work, so its GUI titles, checkpoint display, legacy transcript fallback, and old Agent Run/Phase Stack command routes remain unqualified. A saved Chat entry was visible; opening its full conversation, settings, model routing, formatted content and ownership was not established. The AI Center displayed the saved Codex connection, but this does not qualify Work execution routing.

Read-only file/Git checks before and after the Adaptive SEO reopen confirmed unchanged HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`, clean Git status, and 12 existing run directories. The completed sequence file stayed byte-identical (SHA-256 `894e93b7276bfbda45c8e133df3f8a3de47991bbc7666d4f54dace35b0662469`). Its stored P1–P4 titles remained `Add Project Overview data-scope badge`, `Harden Project Overview data-scope presentation and regression coverage`, `Browser qualification for Project Overview data scope`, and `Dope phase-stack smoke closeout`; its four checkpoint SHAs remained `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, `d5c583b52abae24eb98fd2f28e4134ef61de93b4`, `57980fe9cb86c48dc7e5b587a50a21f137a8045b`, and `d4dfbf38628ba70726cf3b3610c2279643f500dc`. Saved Chat index and conversation files also stayed byte-identical. These file checks establish preservation, not GUI readability.

## Required repair and disposition

Plan a bounded source repair for the duplicate Agent Runtime RPC channel: give the frontend one shared runtime proxy/client channel across all Chat/Work panels, retain the existing event fan-out, and add a regression guard that instantiates the real multi-panel service wiring. Then rerun the affected integration check and only aggregate evidence invalidated by the repair, followed by the full P9 live Work, restart and Adaptive SEO read-only inspections. Preserve this failed observation in the later evidence.

**NOT GREEN.** No Green closeout checkpoint was created; the exact P9 Green commit subject is reserved until the browser gate passes. No Adaptive SEO source, deployment, production service, or Dope implementation source was changed by P9.
