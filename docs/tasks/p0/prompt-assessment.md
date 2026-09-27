# Foundation Spike 0 Prompt Assessment

Status: CURRENT IMPLEMENTATION ASSESSMENT

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Assessment baseline: main `e90164da659b21a3d24e87b7ce3ff2a7f995cace`, package `0.0.0`.  
Assessment date: 2026-09-27.

## Assessment conclusion

Proceed as one bounded Phase 0 stack with **seven execution/qualification prompts plus one evidence-only closeout**.

The stack exists to answer one question:

> Can Eclipse Theia serve as a durable, upgradeable IDE/workbench substrate for Dope without forcing Dope-owned product state into framework internals?

Phase 0 does not implement Dope's AI runtime.

## Current-source findings

- The repository has no product implementation yet.
- The only executable code is the ported Codex phase runner and its regression tests.
- `package.json` is `0.0.0`, TypeScript + ESM, Node >=24 <25.
- `.npmrc` already prevents a root `package-lock.json`; the runner rejects one.
- `docs/tasks/p0` does not exist yet.
- The narrowed Phase 0 authority is already consistent across `BOOT.md`, `AGENTS.md`, `THEIA-SPIKE.md`, the qualification plan, architecture, roadmap, and stability contract.
- No model/provider, Agent Mind, authority, tool-runtime, or editor-agent mutation implementation is authorized in Phase 0.

## External substrate recon

Planning verification on 2026-09-27 found:

- `@theia/core@1.75.0` is a valid stable baseline.
- `1.76.0` is the immediate stable successor and therefore the concrete upgrade target for this spike.
- Theia 1.75 uses the esbuild-only application pipeline; webpack is no longer a supported build path.
- The official composition guidance uses a monorepo with browser and Electron applications plus custom Theia extensions.
- A browser application is useful as a qualification surface, but Electron remains Dope's product target.
- Theia's desktop product guidance uses electron-builder and produces a Linux AppImage on Linux.
- Theia frontend/backend are separate processes connected through typed service/RPC seams; this maps cleanly to the Phase 0 backend/persistence proof.

Reference material:
- https://theia-ide.org/docs/composing_applications/
- https://theia-ide.org/docs/architecture/
- https://theia-ide.org/docs/blueprint_documentation/
- https://theia-ide.org/docs/extensions/
- https://www.npmjs.com/package/@theia/core

## Package-manager / application-composition decision

Do not hand-build an outdated Theia scaffold.

P1 should follow the supported Theia 1.75 application topology closely enough to preserve upgradeability:
- browser qualification application;
- Electron desktop application;
- shared custom Dope Theia extension(s);
- shared Dope-owned domain package(s) only where Phase 0 actually needs them.

Official Theia examples currently favor Yarn workspaces. P1 may adopt a Corepack/Yarn-classic-compatible workspace if that is the cleanest supported Theia 1.75 path.

Requirements:
- preserve the root Codex runner;
- keep `npm run codex:phase ...` working;
- never create root `package-lock.json`;
- a Yarn lockfile is allowed if the chosen supported scaffold requires it;
- pin Theia framework packages coherently rather than mixing minor versions;
- do not copy the full Theia IDE/Blueprint product wholesale if a smaller composed application proves the required seams.

## Prompt decomposition

### P1 / 0.0.1 — Theia 1.75 application foundation

Bootstrap the supported Theia 1.75 browser + Electron composition, pin the baseline coherently, provide serious commodity IDE features, keep esbuild, preserve the runner, and establish truthful build/test/start commands.

No custom Project Mind persistence and no AI.

### P2 / 0.0.2 — Dope workbench surfaces + customization stress

Add Dope branding, Project Mind and Planning spike views, a Dope-owned BUILD/PLAN WorkspaceMode boundary, material layout changes, styling, hidden/replaced unwanted UI, and at least one real supported service rebind/replacement.

Create a durable customization-coupling ledger classifying each customization by API/coupling level.

No AI.

### P3 / 0.0.3 — typed backend + minimal Project Mind persistence

Add the smallest Dope-owned ProjectArtifact/Note contract, typed frontend/backend service seam, backend-originated update/event, transparent minimal persistence, stable identity/provenance, restart reconstruction, and framework-independent tests.

Use a fixture/test workspace for mutation-sensitive persistence proof. Do not expand into Phase 2 Project Mind.

### P4 / 0.0.4 — baseline GUI + tooling qualification

Browser/GUI handoff.

Qualify the exact 1.75 candidate across commodity IDE behavior, custom views/layout, BUILD/PLAN switching, service-rebind effect, TypeScript/JavaScript, JSON, Markdown, Git, terminal, debugging, ESLint, Prettier, one additional Open VSX extension, minimal note persistence, and restart restoration.

Write exact baseline GUI evidence.

### P5 / 0.0.5 — Linux package + packaged application qualification

Browser/GUI handoff.

Produce the real Linux desktop package using the supported Electron packaging path, launch the packaged application outside the dev server, open a real repository, prove state restoration and key IDE/custom surfaces, and record exact package evidence.

### P6 / 0.0.6 — Theia 1.76 upgrade + bounded repair

Upgrade the coherent Theia baseline from 1.75.0 to 1.76.0, classify every required dependency/config/source/CSS fix, rerun all automated build/test/package evidence, and reject broad product-domain or private-shell rewrites.

### P7 / 0.0.7 — upgraded GUI/package qualification

Browser/GUI handoff.

Repeat the applicable P4/P5 evidence against the exact 1.76 candidate, compare with the baseline, repair only bounded upgrade regressions, and produce the final qualification matrix and upgrade visual evidence.

### P8 / 0.0.8 — evidence-only Foundation Spike closeout

Audit P1-P7, decide Green / Not Green / Evidence Gap truth, update the substrate decision and current gate if justified, and stop before Product Phase 1 decomposition.

## Browser/manual handoffs

Browser required:
- P4 — baseline GUI/tooling qualification;
- P5 — packaged Linux desktop qualification;
- P7 — post-upgrade GUI/package qualification.

The phase runner should stop at each browser gate. After the browser-capable/manual environment successfully completes a gate, it must commit once with the exact version subject for that prompt and leave the repository clean before the runner resumes.

## Model selection

- P1: GPT-6 Sol High
- P2: GPT-6 Sol High
- P3: GPT-6 Sol High
- P4: GPT-6 Sol High
- P5: GPT-6 Sol High
- P6: GPT-6 Sol High
- P7: GPT-6 Sol High
- P8: GPT-6 Sol Medium

No XHigh is planned.

## Deferred by contract

Phase 0 does not implement:
- local or hosted LLM integration;
- OpenAI/Codex runtime integration;
- Theia AI agent/chat product reuse;
- AgentWorkingState or Agent Mind execution;
- model tool calling;
- ProposedAction / authority execution;
- AI diff/apply/reject;
- editor-agent observation/mutation;
- scoped delegation;
- ambient intelligence;
- production Project Mind;
- production Planning.

If implementation requires any of these to make Theia viable, return `Planning needed` rather than silently broadening the spike.

## Stability questions

### 1. User-visible / aggregate behavior at risk

IDE startup/build time, editor responsiveness, workspace open/save, terminal/debugger behavior, SCM/search/problem surfaces, extension loading, layout persistence, custom-view restoration, package size/startup, and upgrade repair burden.

### 2. Product/architecture invariants

Theia remains a substrate; custom state is Dope-owned; Product Mind spike state is not Theia chat/workspace truth; browser target is qualification support rather than product identity; Electron remains the product target; no AI runtime is pulled forward; no broad private API coupling; no early Theia fork.

### 3. Integrated-only evidence

Real editor/terminal/debugger/SCM/extension behavior, visual layout/customization, restart restoration in the running workbench, packaged Electron launch, and post-upgrade visual compatibility cannot be completely proven by unit tests.

### 4. Baseline

Main `e90164da659b21a3d24e87b7ce3ff2a7f995cace`, package `0.0.0`, Node 24 major, Theia baseline 1.75.0.

### 5. Durable project knowledge

The stack must leave a customization-coupling ledger, baseline GUI evidence, package evidence, upgrade repair ledger, upgraded qualification matrix, and closeout decision.

### 6. UI/framework canonical-state risk

Custom widgets, Theia layout state, Perspectives, frontend stores, or framework session objects must not become canonical Project Mind state.

### 7. Provider/model coupling risk

No provider/model code should exist in this spike. Any implementation convenience that introduces provider-specific product state is out of scope.
