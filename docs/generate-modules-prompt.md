# Prepare this repository for Dope

You have agentic access to an existing software repository.

Your task is to independently examine the repository, determine the durable architecture of the software product, library, framework, service, or tool that the repository primarily exists to deliver, and create or update a root-level `MODULES.md` that can be used as an architecture seed by Dope.

This task is repository-generic. Do not assume any particular language, framework, repository layout, application type, deployment model, architecture style, or number of Systems or Subsystems.

## Objective

Produce a concise, evidence-based architectural description using this hierarchy:

```text
System
  -> Subsystem
```

`MODULES.md` should tell a capable developer or AI system:

- what major software Systems exist;
- what durable responsibility each System owns;
- how each System is divided into Subsystems;
- what responsibility each Subsystem owns;
- where those responsibilities are primarily implemented;
- what major dependencies or relationships connect them;
- where architectural boundaries remain uncertain.

The document is an architectural seed, not a complete inventory of the codebase.

Do not attempt to enumerate Components, classes, functions, symbols, or every directory/file.

---

# Operating rules

## 1. Investigate before writing

Do not infer the architecture from directory names alone.

Use your available repository tools to inspect enough of the actual codebase to understand how the software works.

You may inspect, search, trace, and run safe read-only repository commands as needed.

Examine relevant evidence such as:

- root and package-level README/documentation;
- package/workspace manifests;
- source trees;
- application and runtime entry points;
- imports and dependency relationships;
- domain/service code;
- APIs, routes, RPC or protocol definitions;
- workers, jobs, queues and schedulers;
- persistence/repository/data-access code;
- frontend/application state and major feature boundaries;
- integrations and provider adapters;
- build configuration;
- deployment/infrastructure configuration;
- tests;
- generated registrations or framework wiring when they reveal application responsibilities;
- existing architecture or decision documents;
- other repository evidence that helps establish enduring responsibility boundaries.

Existing documentation is useful evidence, but it is not automatically correct.

Verify architectural claims against the implementation wherever reasonably possible.

## 2. Architecture is responsibility, not folder structure

The primary question is:

> What enduring software responsibility does this boundary own?

Do not automatically turn any of the following into Systems or Subsystems:

- frontend/backend;
- client/server;
- controllers;
- database;
- API;
- workers;
- packages;
- directories;
- framework layers;
- deployment processes;
- repositories;
- adapters;
- infrastructure.

Those are implementation or runtime structures unless the repository demonstrates that they own a durable, independently meaningful software responsibility.

A technical boundary may still be architectural when the evidence supports that conclusion.

Prefer responsibility-oriented boundaries over directory-oriented boundaries.

## 3. Scope the delivered software, not repository-development machinery

Model the architecture of the software the repository primarily exists to build and deliver.

Do not promote repository-development machinery into Systems or Subsystems merely because it contains substantial code. By default, exclude things such as:

- CI/CD plumbing;
- build scripts;
- release automation;
- test harnesses and qualification infrastructure;
- repository maintenance utilities;
- documentation tooling;
- code-generation helpers;
- prompt/task runners;
- local developer convenience tooling.

Include such machinery only when one of these is true:

- the repository itself primarily exists to deliver that tooling;
- the tooling is a first-class shipped capability of the product;
- the tooling owns an indispensable runtime responsibility of the delivered software.

Ask:

> If this repository were packaged and delivered to its intended user, is this responsibility part of the software they are actually receiving or relying on?

If the answer is no, treat it as repository support rather than product architecture.

## 4. Do not force architecture counts

There is no expected number of Systems or Subsystems.

A repository may legitimately contain:

- one System;
- several Systems;
- one System with many Subsystems;
- several largely independent products/services;
- a small application with only a few meaningful boundaries.

Do not split architecture merely to make the hierarchy look more detailed.

A System does not need a Subsystem merely to satisfy the System -> Subsystem shape. If a System has no meaningful subordinate responsibility boundary, leave it without Subsystems.

Never create a one-to-one Subsystem that merely renames, restates, or wraps the parent System's responsibility.

Do not merge materially independent responsibilities merely to make it look simpler.

## 5. Distinguish Systems from Subsystems

Use **System** for a major coherent software/product/runtime responsibility that can reasonably be understood as a substantial whole.

Use **Subsystem** for a durable responsibility contained within a System.

Ask of each candidate System:

- Does this represent a coherent major software responsibility?
- Would its existence still make conceptual sense if the repository were reorganized?
- Is it more than a technical layer or folder grouping?

Ask of each candidate Subsystem:

- What responsibility does it own?
- What behavior or state belongs to it?
- Why is it a meaningful boundary rather than merely an implementation grouping?
- Does it belong inside this parent System?

## 6. Trace responsibilities across technical layers

A single architectural responsibility may span:

- UI;
- API;
- domain logic;
- persistence;
- workers;
- integrations;
- infrastructure.

Do not split one responsibility into separate architectural Subsystems merely because its implementation crosses these layers.

Conversely, do not combine unrelated responsibilities merely because they share a framework, package, process, database, or directory.

## 7. Challenge your first interpretation

Before finalizing `MODULES.md`, perform a deliberate architecture challenge.

For every proposed System, ask:

- Is this actually a System, or merely a broad umbrella hiding several independent Systems?
- Is it just a deployment or technical boundary?
- Are important responsibilities missing?
- Should it be merged with another System?

For every proposed Subsystem, ask:

- Is this responsibility-oriented or implementation-oriented?
- Is it really distinct from its siblings?
- Does it span source areas that my first pass overlooked?
- Did I accidentally omit a meaningful responsibility because it was less obvious in the folder structure?
- Should it be merged, split, moved, or removed?

Also search specifically for substantial implementation areas that are not represented by the proposed architecture.

Revise the hierarchy when the evidence warrants it.

## 8. Preserve uncertainty

Do not invent certainty.

If the repository does not provide enough evidence to establish an architectural boundary confidently:

- state the uncertainty;
- identify the competing interpretations;
- cite the relevant paths or evidence;
- choose the least-assumptive representation when a hierarchy is still necessary.

The `Architectural uncertainties` section is only for unresolved questions about responsibility boundaries, ownership, containment, or major architectural relationships.

Do not put ordinary repository-state or housekeeping concerns there, such as:

- initialization state;
- migration status;
- missing markers or metadata;
- pending cleanup;
- version drift;
- validation status;
- uncommitted work;
- operational TODOs.

Those may be useful observations during investigation, but they are not architectural uncertainties unless they materially change responsibility boundaries.

Do not manufacture architecture simply to eliminate ambiguity.

## 9. Existing MODULES.md is not unquestionable

If a root `MODULES.md` already exists:

- read it;
- treat it as developer-provided architectural intent;
- independently verify it against the current repository;
- preserve good existing intent where supported;
- correct stale or unsupported descriptions;
- add material responsibilities that the implementation demonstrates but the file omits.

Do not blindly reproduce the existing file.

## 10. Do not modify the application

Your only intended repository modification is the root-level:

```text
MODULES.md
```

Do not modify source code, tests, configuration, dependency files, generated files, other documentation, or repository state.

Do not commit, push, create branches, reformat unrelated files, install dependencies, or perform destructive operations.

Read-only investigation is allowed.

---

# Required MODULES.md format

Create `MODULES.md` at the repository root.

Use the following structure.

```markdown
# MODULES.md

This document describes the repository's intended high-level software architecture for use by humans and architecture-aware development tools.

It describes durable responsibility boundaries, not a complete code inventory.

## System: <System Name>

**Purpose:**  
<One concise explanation of what this System exists to do.>

**Primary paths:**  
- `<path or glob>`
- `<path or glob>`

**Major relationships:**  
- <Important dependency, upstream/downstream relationship, or shared architectural relationship if useful.>

### Subsystem: <Subsystem Name>

**Responsibility:**  
<Concise explanation of the durable responsibility owned by this Subsystem.>

**Primary paths:**  
- `<path or glob>`
- `<path or glob>`

**Key relationships:**  
- <Major dependency or interaction with another System/Subsystem if architecturally important.>

### Subsystem: <Another Subsystem>

...

## System: <Another System>

...

## Architectural uncertainties

Only include this section when meaningful architectural uncertainty remains about responsibility boundaries, ownership, containment, or major relationships.

Do not use this section for repository initialization, migration, validation, cleanup, versioning, or other operational state.

- **<Boundary or responsibility>:** <What is architecturally uncertain, what evidence supports each interpretation, and what should be verified later.>
```

Adapt the number of Systems and Subsystems to the repository.

Do not add empty sections merely to satisfy the template.

---

# Content requirements

## Names

Use names based on software responsibilities or established domain terminology.

Prefer:

- `Source Collection`
- `Identity and Access`
- `Billing`
- `Feed Production`
- `Execution Runtime`
- `Project Management`

over names such as:

- `Backend`
- `Frontend`
- `Services`
- `Controllers`
- `Database Layer`
- `Utils`

unless the technical term genuinely represents the durable responsibility in this particular repository.

Use established repository terminology when it accurately describes the architecture.

Do not invent branded or domain-specific terminology unsupported by the codebase.

## Purpose and responsibility descriptions

Keep descriptions short and architectural.

Explain **why the boundary exists and what it owns**, not how every implementation detail works.

Avoid vague descriptions such as:

> Handles various backend functionality.

Prefer descriptions such as:

> Owns ingestion, normalization, scheduling, and lifecycle management of external content sources.

## Primary paths

List representative implementation roots rather than every file.

Paths are supporting evidence and navigation hints, not definitions of the architecture.

A responsibility may legitimately list paths from several parts of the repository.

Examples:

```text
apps/api/src/projects/
apps/web/src/features/projects/
packages/project-domain/
```

This is preferable to splitting the responsibility solely because implementation spans multiple technical layers.

## Relationships

Only record relationships that help explain the architecture.

Examples include:

- depends on;
- publishes to;
- consumes from;
- invokes;
- owns shared state for;
- provides contracts to.

Do not attempt to create a complete dependency graph.

---

# Evidence discipline

Every architecture boundary in `MODULES.md` should be defensible from repository evidence.

Before including a System or Subsystem, verify that at least one meaningful implementation signal supports it.

Stronger signals include:

- domain behavior;
- exported application/service behavior;
- state ownership;
- persistence tied to a responsibility;
- public contracts;
- worker/job execution;
- integration behavior;
- dependency relationships;
- runtime registration tied to application behavior;
- multiple implementation areas participating in the same responsibility.

Weaker signals include:

- directory name alone;
- one isolated filename;
- generic terminology;
- framework convention;
- stale documentation without implementation support.

Use weaker signals only as supporting context.

---

# Repository types

Handle repository shape based on evidence rather than assumptions.

## Monorepositories

Do not automatically make every workspace/package a System.

Determine whether packages represent:

- separate Systems;
- Subsystems;
- shared implementation;
- libraries;
- tooling;
- infrastructure.

Model them according to responsibility.

## Multiple deployables

Do not automatically make every process or deployable a System.

Several deployables may implement one System.

One repository may also genuinely contain several independent Systems.

Determine this from responsibility and coupling.

## Libraries/frameworks

For a library, Systems and Subsystems should describe the library's major capabilities or responsibility domains rather than pretending it is an application.

## CLI/tooling repositories

Represent the tool's enduring functional responsibilities.

Do not manufacture application-style frontend/backend boundaries.

## Small repositories

Keep the architecture small.

A simple project may legitimately contain one System with only a few Subsystems.

## Partially implemented or evolving repositories

Describe what current implementation evidence supports.

Use `Architectural uncertainties` for meaningful unresolved intent rather than inventing planned architecture.

---

# Quality review before writing

Before saving `MODULES.md`, verify all of the following:

1. Every System represents a meaningful durable responsibility of the software the repository primarily exists to deliver.
2. Repository-development machinery was excluded unless it is itself the product, a first-class shipped capability, or an indispensable runtime responsibility.
3. Every Subsystem represents a meaningful responsibility inside its parent System.
4. No one-to-one Subsystem merely restates or wraps its parent System.
5. The hierarchy is not merely a copy of the directory tree.
6. Frontend/backend/client/server/framework layers were not promoted automatically.
7. Major implemented product responsibilities are not obviously missing.
8. Cross-layer responsibilities were followed across their implementation.
9. No architecture count was forced.
10. Existing documentation was verified rather than blindly trusted.
11. Primary paths actually exist and support the stated responsibility.
12. Architectural uncertainty is stated rather than hidden, and operational/repository-state concerns were not mislabeled as architecture uncertainty.
13. The document remains concise enough to serve as initial architecture context.
14. No Components/classes/functions/files were exhaustively cataloged.
15. No file other than root `MODULES.md` was modified.

If any of these fail, investigate further and revise before finishing.

---

# Final action

Write the completed architecture document to:

```text
MODULES.md
```

at the repository root.

After writing it, reread the file and perform one final consistency check against the repository.

Your final response should be concise and report:

- that `MODULES.md` was created or updated;
- the Systems identified;
- any meaningful architectural uncertainties;
- confirmation that no application files were modified.

Do not include a large duplicate copy of `MODULES.md` in the final response unless explicitly requested.
