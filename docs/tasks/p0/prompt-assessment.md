# Foundation Spike 0 Prompt Assessment

Status: IN EXECUTION — P1-P3 COMPLETE / P4 NEXT

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Original assessment baseline: main `e90164da659b21a3d24e87b7ce3ff2a7f995cace`, package `0.0.0`.  
Current committed prefix: P1 `0.0.1`, P2 `0.0.2`, P3 `0.0.3`.  
Current main at scope revision: `2e6efe76284611aa5c459a2b816daff8e4b9f93f`.

## Assessment conclusion

Keep the completed P1-P3 work exactly as committed and shorten the unexecuted tail.

The final stack is **five implementation/qualification prompts plus one evidence-only closeout**:

- P1-P3: completed and immutable for this replan.
- P4: one direct GUI/tooling qualification.
- P5: runner-owned Linux package/build/launch smoke.
- P6: evidence-only Foundation Spike closeout.

The synthetic 1.75 -> 1.76 upgrade experiment and its repeated GUI qualification are removed. Upgradeability remains a design requirement and will be qualified on the first natural framework upgrade.

## Current-source findings

P1-P3 established:
- Theia 1.75.0 browser and Electron applications;
- Yarn workspaces with no root `package-lock.json`;
- shared Dope extension and standalone contracts package;
- Project Mind and Planning spike views;
- BUILD/PLAN WorkspaceMode;
- branding/styling and a real service rebind;
- customization coupling ledger;
- typed frontend/backend service;
- Dope-owned Note persistence under workspace state;
- stable identity/corruption/reconstruction tests.

The current package is `0.0.3`.

P3 reported 101 passing tests, typecheck, browser/Electron builds, and GUI restart behavior deferred to P4.

The Electron build required X11 development headers supplied through a temporary local sysroot. P5 must record the real Linux packaging dependency/result truthfully rather than hiding this requirement.

## Remaining decomposition

### P4 / 0.0.4 — Foundation IDE GUI + tooling qualification

Single manual browser/GUI gate.

Qualify the real shared workbench once:
- IDE basics;
- TypeScript/JavaScript, JSON, Markdown;
- search, SCM, terminal, debugger, Problems;
- ESLint, Prettier, one additional Open VSX extension;
- Project Mind/Planning views;
- BUILD/PLAN;
- customization/rebind effect;
- Note persistence/restart.

### P5 / 0.0.5 — Linux Electron packaging + launch smoke

Runner-owned, `Browser required: no.`

Produce the real Linux desktop artifact, record identity/hash/size and Linux prerequisites, launch it outside the dev server, capture process/runtime evidence, verify packaged-resource independence, and use programmatic renderer/CDP smoke only if practical.

Do not pretend to visually inspect the native Linux desktop window. Preserve native-GUI-only evidence as an explicit gap.

### P6 / 0.0.6 — Foundation Spike closeout

Evidence-only.

Audit Gates A-F and decide Qualified / Not Qualified. If Qualified, update the Theia decision and route to the required post-spike `/docs-review`.

Do not generate Phase 1 prompts.

## Browser/manual handoff

Only P4 requires the GUI/browser-capable environment.

After successful P4 completion, commit exactly once with subject `0.0.4`, leave the tree clean, then resume the normal runner. P5 is runner-owned. P6 is the final closeout.

## Model selection

- P1-P5: GPT-6 Sol High
- P6: GPT-6 Sol Medium

No XHigh is planned.

## Deferred by contract

Phase 0 does not implement:
- model/provider runtime
- Theia AI product reuse
- Agent Mind
- tool/authority runtime
- AI editor integration
- scoped delegation
- ambient intelligence
- production Project Mind
- production Planning

## Stability questions

### 1. User-visible / aggregate behavior at risk

IDE startup/build behavior, editor/workspace functionality, terminal/debugger/SCM/search/problems, extension loading, layout persistence, custom-view restoration, package build/launch, and Linux native prerequisites.

### 2. Product/architecture invariants

Theia remains a substrate; custom state remains Dope-owned; browser is a qualification surface; Electron remains the product target; no AI runtime is pulled forward; no broad private API coupling; no early Theia fork.

### 3. Integrated-only evidence

P4 must directly observe real workbench behavior and restart persistence. P5 must use the produced Linux package rather than only dev-server builds. Native Linux visual interaction may remain a bounded gap when unavailable.

### 4. Baseline

Original Phase 0 baseline remains package `0.0.0` / Theia 1.75.0. The executed prefix currently ends at package `0.0.3`.

### 5. Durable project knowledge

The stack retains the customization-coupling ledger and adds P4 GUI evidence, P5 Linux package evidence, and P6 closeout.

### 6. UI/framework canonical-state risk

Custom widgets, Theia layout state, Perspectives, frontend stores, or framework session objects must not become canonical Project Mind state.

### 7. Provider/model coupling risk

No provider/model code belongs in Phase 0.
