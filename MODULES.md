# MODULES.md

This document describes the repository's intended high-level software architecture for use by humans and architecture-aware development tools.

It describes durable responsibility boundaries, not a complete code inventory.

## System: Development Workbench

**Purpose:**  
Provide the desktop development environment for editing, navigating, running, testing, debugging, and reviewing a project.

**Primary paths:**  
- `apps/electron/package.json`
- `apps/browser/package.json`
- `packages/theia-extension/src/browser/frontend-module.ts`
- `packages/theia-extension/src/browser/dope-workbench.ts`

**Major relationships:**  
- Composes Theia's IDE capabilities and hosts the Project Mind and Software Map views. Theia supplies commodity IDE behavior; Dope's project state belongs to the Systems below.
- The Electron app is the delivered desktop shell; the browser app is a development and qualification surface for the same extension.

## System: Project Mind

**Purpose:**  
Own durable project knowledge as Notes, Ideas, Questions, and Decisions, including their lifecycle, links, and project-local state.

**Primary paths:**  
- `packages/contracts/src/project-mind.ts`
- `packages/project-intelligence/src/`
- `packages/theia-extension/src/node/project-mind-backend.ts`
- `packages/theia-extension/src/browser/project-mind-controller.ts`
- `packages/theia-extension/src/browser/dope-workbench.ts`

**Major relationships:**  
- The workbench presents and edits Project Mind through typed frontend/backend service contracts; Project Mind's rules and `.dope/project-mind.json` state are Dope-owned.
- Artifact links may refer to project files or other artifacts. Project Mind does not own Software Map architecture state.

## System: Software Map

**Purpose:**  
Help the developer discover, define, inspect, and compare software architecture with source-backed implementation evidence.

**Primary paths:**  
- `packages/software-map/src/`
- `packages/code-analysis/src/`
- `packages/code-analysis-typescript/src/`
- `packages/theia-extension/src/node/software-map-backend.ts`
- `packages/theia-extension/src/browser/software-map-*.ts`

**Major relationships:**  
- Uses the workbench for onboarding, review, inspection, and source navigation while keeping map contracts and architecture rules independent of Theia.
- Canonical developer-owned architecture is stored in `.dope/architecture.json`; derived evidence and proposals do not silently change it. Project Mind and Software Map are separate project-state owners.

### Subsystem: Source Evidence

**Responsibility:**  
Collect deterministic repository, TypeScript, and framework facts with traceable provenance for architecture discovery and physical analysis.

**Primary paths:**  
- `packages/code-analysis/src/index.ts`
- `packages/code-analysis/src/node/architecture-evidence.ts`
- `packages/code-analysis-typescript/src/`
- `packages/software-map/src/contracts.ts`

**Key relationships:**  
- Supplies source-backed facts to Architecture Discovery and Physical Realization; the TypeScript analyzer emits language-independent Software Map data.

### Subsystem: Architecture Discovery

**Responsibility:**  
Interpret bounded source-backed evidence into candidate Systems, Subsystems, and Components through staged discovery, boundary challenges, coverage checks, and reconciliation.

**Primary paths:**  
- `packages/software-map/src/evidence-planner.ts`
- `packages/software-map/src/system-*.ts`
- `packages/software-map/src/hierarchical-synthesis.ts`
- `packages/software-map/src/reconciliation.ts`
- `packages/theia-extension/src/node/*synthesis-provider.ts`
- `packages/theia-extension/src/node/software-map-backend.ts`

**Key relationships:**  
- Consumes Source Evidence and optional documented architecture intent; local and Gemini adapters implement the same Dope-owned stage contracts. Its output is a proposal for developer review, not physical proof or canonical state.

### Subsystem: Architecture Authority

**Responsibility:**  
Let the developer initialize, correct, and explicitly accept canonical architecture boundaries, including manual and existing-declaration paths.

**Primary paths:**  
- `packages/software-map/src/architecture.ts`
- `packages/software-map/src/refinement.ts`
- `packages/software-map/src/synthesis.ts`
- `packages/code-analysis/src/node/architecture-file.ts`
- `packages/code-analysis/src/node/smap-initialization-file.ts`
- `packages/theia-extension/src/browser/software-map-controller.ts`
- `packages/theia-extension/src/browser/software-map-review-widget.ts`
- `packages/theia-extension/src/node/software-map-backend.ts`

**Key relationships:**  
- Reviews Architecture Discovery proposals against evidence and persists accepted declarations in project-local `.dope/` state; Physical Realization uses those declarations as the intended architecture.

### Subsystem: Physical Realization

**Responsibility:**  
Build and query the current Physical Map by matching observed code and dependencies against canonical boundaries, preserving unassigned evidence and reporting dependency violations.

**Primary paths:**  
- `packages/software-map/src/graph.ts`
- `packages/software-map/src/assembly.ts`
- `packages/code-analysis/src/node/software-map-index.ts`
- `packages/theia-extension/src/node/software-map-backend.ts`
- `packages/theia-extension/src/browser/software-map-widget.ts`

**Key relationships:**  
- Combines Source Evidence with Architecture Authority's declarations; its derived graph is presented by the workbench inspector and remains distinct from canonical architecture.

## System: Agent Runtime

**Purpose:**
Own bounded coding-agent tasks, observable runs, and developer-approved execution authority.

**Primary paths:**
- `packages/agent-core/src/contracts.ts`
- `packages/agent-core/src/authority.ts`
- `packages/agent-core/src/state.ts`

**Major relationships:**
- The Phase 8B core defines portable task/run records, the run transition table, and a fixed accepted grant for project-local effects. AI Center owns connection and model selection; a later runtime resolves that selection and records actual execution provenance.
- The core has no provider, filesystem, process, Git, or Theia dependency. Project-local persistence, effect enforcement, and presentation attach to this boundary in later 8B tasks.
