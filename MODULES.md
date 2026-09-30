# MODULES.md

This document describes the repository's intended high-level software architecture for use by humans and architecture-aware development tools.

It describes durable responsibility boundaries, not a complete code inventory. It is a bootstrap seed; accepted Software Map architecture belongs in `.dope/architecture.json`.

## System: Development Workbench

**Purpose:**
Provide the everyday coding workspace in which developers edit, run, test, debug, and navigate projects.

**Primary paths:**
- `apps/electron/`
- `apps/browser/`
- `packages/theia-extension/src/browser/dope-workbench.ts`

**Major relationships:**
- Composes Theia IDE capabilities and hosts Project Mind and Software Map views through `packages/theia-extension/src/browser/frontend-module.ts`.

### Subsystem: IDE Workspace

**Responsibility:**
Own the Dope application shell and workbench presentation around Theia's editor, terminal, source control, debugging, tests, and extension support. Electron is the desktop target; the browser target supports development and qualification.

**Primary paths:**
- `apps/electron/`
- `apps/browser/`
- `packages/theia-extension/src/browser/dope-workbench.ts`
- `packages/theia-extension/src/browser/dope.css`

**Key relationships:**
- Hosts product views while Project Mind and Software Map retain their own state and contracts.

## System: Project Mind

**Purpose:**
Preserve developer-authored project knowledge as durable, navigable Notes, Ideas, Questions, and Decisions.

**Primary paths:**
- `packages/contracts/src/project-mind*.ts`
- `packages/project-intelligence/src/`
- `packages/theia-extension/src/browser/project-mind-controller.ts`
- `packages/theia-extension/src/node/project-mind-backend.ts`

**Major relationships:**
- Uses typed contracts between its Theia view/backend and framework-independent artifact logic; persists project knowledge in `.dope/project-mind.json`.

### Subsystem: Project Knowledge

**Responsibility:**
Own artifact identity, lifecycle, links, queries, project-local storage, and explicit migration of the earlier single-Note format; present that knowledge for editing and navigation.

**Primary paths:**
- `packages/contracts/src/project-mind*.ts`
- `packages/project-intelligence/src/`
- `packages/theia-extension/src/browser/project-mind-controller.ts`
- `packages/theia-extension/src/browser/dope-workbench.ts`
- `packages/theia-extension/src/node/project-mind-backend.ts`
- `packages/theia-extension/src/node/note-store.ts`

**Key relationships:**
- Opens linked source files through the workbench; legacy `.dope/note.json` is migration input, not a separate current knowledge store.

## System: Software Map

**Purpose:**
Help developers define software architecture and inspect its evidence-backed realization in the current repository.

**Primary paths:**
- `packages/software-map/src/`
- `packages/code-analysis/src/`
- `packages/code-analysis-typescript/src/`
- `packages/theia-extension/src/browser/software-map*.ts`
- `packages/theia-extension/src/node/software-map*.ts`

**Major relationships:**
- Deterministic source evidence feeds architecture proposals and the Physical Map; only explicit developer acceptance establishes canonical architecture.

### Subsystem: Source Evidence

**Responsibility:**
Discover repository structure and extract traceable source, semantic, dependency, and recognized framework facts for architecture analysis.

**Primary paths:**
- `packages/code-analysis/src/node/architecture-evidence.ts`
- `packages/code-analysis-typescript/src/`
- `packages/code-analysis/src/index.ts`

**Key relationships:**
- Supplies provider-independent evidence to Architecture Discovery and code facts to Physical Mapping.

### Subsystem: Architecture Discovery and Review

**Responsibility:**
Plan bounded evidence views, synthesize and challenge candidate Systems and Subsystems, reconcile coverage, and let the developer inspect or correct proposals before acceptance.

**Primary paths:**
- `packages/software-map/src/evidence-planner.ts`
- `packages/software-map/src/hierarchical-synthesis.ts`
- `packages/software-map/src/reconciliation.ts`
- `packages/theia-extension/src/node/*synthesis-provider.ts`
- `packages/theia-extension/src/node/software-map-backend.ts`
- `packages/theia-extension/src/browser/software-map-review-widget.ts`

**Key relationships:**
- Consumes Source Evidence through Dope-owned synthesis contracts; local and Gemini providers interpret evidence but do not own canonical state.

### Subsystem: Canonical Architecture and Physical Mapping

**Responsibility:**
Validate developer architecture declarations, accept initialization, build and query the current Physical Map, and show realization, dependencies, evidence, and violations.

**Primary paths:**
- `packages/software-map/src/architecture.ts`
- `packages/software-map/src/graph.ts`
- `packages/software-map/src/assembly.ts`
- `packages/code-analysis/src/node/software-map-index.ts`
- `packages/code-analysis/src/node/*-file.ts`
- `packages/theia-extension/src/node/software-map-backend.ts`
- `packages/theia-extension/src/browser/software-map-widget.ts`

**Key relationships:**
- Combines accepted `.dope/architecture.json` declarations with Source Evidence; `.dope/smap.json` records initialization, while the current analysis index is disposable.

## System: Repository Automation

**Purpose:**
Run Dope's bounded implementation workflow and manage local desktop releases during development.

**Primary paths:**
- `scripts/codex-phase*.mjs`
- `scripts/validate-codex-phase.mjs`
- `scripts/local-install.mjs`

**Major relationships:**
- Operates on task prompts, Git state, package versions, and Electron AppImages; it supports development and installation rather than the running Dope product.

### Subsystem: Prompt Stack Execution

**Responsibility:**
Validate numbered phase/correction prompts, run bounded Codex tasks, track execution and Git outcomes, and support resumption and closeout.

**Primary paths:**
- `scripts/codex-phase-core.mjs`
- `scripts/codex-phase.mjs`
- `scripts/validate-codex-phase.mjs`

**Key relationships:**
- Reads `docs/tasks/` prompt stacks and repository history; its behavior is exercised by `test/unit/codex-phase-*.test.ts`.

### Subsystem: Local Release Management

**Responsibility:**
Install, activate, list, and roll back local Linux AppImage builds with retained release metadata and a desktop launcher.

**Primary paths:**
- `scripts/local-install.mjs`
- `apps/electron/package.json`

**Key relationships:**
- Consumes packaged Electron output and keeps release history outside the source checkout.

## Architectural uncertainties

- **Existing declaration scope:** `.dope/architecture.json` declares only a Physical Map System and groups its source analysis, inspector, and transport by implementation layer. It has no accompanying `.dope/smap.json` initialization marker. The current source and product contracts support the broader responsibility boundaries above, but a developer should decide how to reconcile that earlier, narrower declaration when accepting canonical architecture.
