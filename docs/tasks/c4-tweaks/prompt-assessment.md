# Correction 4 Prompt Assessment — sMap Terminology and Workbench Placement

Status: APPROVED / READY AFTER P5
Correction folder: `c4-tweaks`
Prompt-authoring source: `1032a20e51a1258fcd1dc4a03ba8ba6c80a0435d`
Execution baseline: exact successful Product Phase 4 P5 handoff at unchanged package version `0.4.5`
Authority: ADR 0008, ADR 0007 as amended, `BOOT.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT-MODEL.md`, Phase 4 plan/activation and roadmap

## Conclusion

Use three ordered correction prompts at unchanged package version `0.4.5`:

canonical sMap clean rename -> workbench placement + direct requalification -> evidence-only correction closeout.

This correction is mandatory after P5 and before Phase 4 P6 closeout. It fixes terminology and presentation architecture discovered during direct P5 use without pulling Phase 5 visual-map work forward.

| Prompt | Boundary | Primary evidence | Routing |
| --- | --- | --- | --- |
| P1 | Clean-break live rename from Software Model terminology to Software Map/sMap terminology | package/source/test/build rename, positive canonical-name assertions, negative legacy-name guard, aggregate/restart checks | GPT-6 Sol High |
| P2 | Move the sMap inspector to the left Activity Bar/primary sidebar and requalify the changed GUI/package | left-side Activity Bar placement, no sMap default in right sidebar, representative Physical Map workflow, restart/package/browser evidence | GPT-6 Sol High, browser required |
| P3 | Evidence-only correction closeout | exact `0.4.5` candidate, rename/layout guards, final package/browser evidence, Phase 5 boundary preserved | GPT-6 Sol High |

P1 is runner-owned. P2 requires browser-capable interactive qualification. P3 is the manual final correction closeout.

## Trigger and sequencing

The correction must not execute against P4 or an incomplete P5 checkpoint.

Execution requires:
- the exact successful P5 handoff commit with subject `0.4.5`;
- P5 direct GUI evidence Green for its applicable matrix;
- clean intended Git state apart from explicitly recorded unrelated user changes;
- the ADR 0008 documentation commit reachable in history or otherwise reconciled into the P5 branch before correction execution.

If P5 finishes on a branch that does not yet contain ADR 0008, reconcile that branch first without rewriting P5 historical evidence. Then run this correction.

Phase 4 P6 is blocked until this correction closes Green/qualified.

## Current implementation findings available to planning

The direct P5 screenshot and the Phase 4 P4/P5 contracts establish the live shape that the correction must inspect at execution:

- the architecture domain currently lives under `packages/software-model/`;
- current code includes `SoftwareModel...`-named contracts/controllers and a `software-model` Theia presentation surface;
- the Theia integration includes focused `software-model-controller.ts` and `software-model-widget.ts`-style files plus frontend/backend registration;
- the current inspector displays the Physical architecture hierarchy, analysis status and code entities;
- the current inspector is occupying the right-side workbench area;
- the right-side area conflicts with the now-authoritative future Agent Mind/chat placement;
- Phase 4 already owns deterministic graph/evidence/query behavior and must not lose it during the rename/layout correction.

The remote prompt-authoring branch does not yet contain the in-flight local P1-P5 implementation commits. Therefore P1 must begin by inspecting the exact P5 source before editing and must treat the concrete P5 source/tests as implementation authority. The correction plan names expected families, not permission to blindly rename nonexistent paths.

## Rename decision

The live architecture feature must use the product vocabulary from ADR 0008:

- **Software Map** — umbrella architecture feature;
- **sMap** — short UI/product label;
- **Physical Map** — current evidence-backed implemented reality;
- **Planning Map** — future target/proposal map introduced in Phase 5.

Internal graph terminology remains valid for graph data structures, graph algorithms, nodes, edges and graph queries. The correction must not mechanically ban the word `model` across the repository: AI models, Model Runtime, provider models, generic data models and historical documents remain legitimate.

The correction should make a pre-stability clean break in live architecture code. No compatibility aliases, shadow packages, duplicate exports, old command aliases or dual IDs are required merely to preserve the superseded prototype naming.

Expected live rename surface, subject to exact P5 inspection:
- `packages/software-model/` -> `packages/software-map/`;
- `@dope/software-model` -> `@dope/software-map`;
- architecture-feature symbol families such as `SoftwareModel*`, `PhysicalSoftwareModel*`, service/client/path names and exported types -> SoftwareMap/PhysicalMap equivalents;
- Theia files/classes/view IDs/commands/widgets from `software-model-*` / SoftwareModel naming -> `software-map-*` / SoftwareMap/sMap equivalents;
- root workspaces, build/typecheck/test scripts, package dependencies, baseline assertions and package inspection expectations;
- current nonhistorical storage/recovery guide filename and references if it is still named `docs/software-model-storage.md`;
- current unit/integration test filenames and descriptions where they name the live feature.

Do not rename generic `graph.ts`, graph node/edge/query terms, TypeScript analyzer packages, `.dope/architecture.json`, System/Subsystem/Component/CodeEntity IDs, or evidence semantics merely for branding.

Do not cosmetically rewrite historical Phase 4 P1-P5 prompts/evidence or ADR 0007's preserved historical wording.

## Workbench placement decision

The default product layout is:

- left primary sidebar / Activity Bar: dedicated **sMap** entry and inspector;
- center workspace: editors now; visual Physical Map / Planning Map canvases beginning in Phase 5;
- right secondary sidebar: reserved by default for future Agent Mind/chat/AI interaction;
- bottom panel: terminal, Problems, tests/runtime diagnostics.

The sMap surface must use supported Theia contribution/view-container APIs rather than broad shell-internal surgery.

The correction must distinguish default placement from user customization. Users may rearrange views. The regression guard should prevent Dope's source/default contribution from assigning the sMap inspector to the right side; it should not try to forbid an individual user from moving it.

Because pre-correction profiles may persist the old widget/view identity on the right, the clean-break rename should ensure the new canonical sMap view identity does not resurrect or default to the old right-side placement. P2 must explicitly test a clean/default profile. If existing persisted layout state can still instantiate a ghost legacy view or force the new sMap view right, fix that narrowly and add a regression test rather than introducing a generalized layout migration framework.

## Preserved behavior

The correction must preserve:
- deterministic source analysis and Physical Map graph construction;
- architecture declaration parsing and `.dope/architecture.json`;
- stable declared architecture IDs and current derived identity semantics;
- evidence/provenance;
- aggregated dependencies and rule violations;
- unassigned/unknown truth;
- query service/backend root isolation and stale-generation protection;
- Analyze/Refresh and source navigation;
- Project Mind and ordinary IDE behavior;
- TypeScript/code-analysis package boundaries;
- Theia 1.75.0, Electron 42.8.1, Node 24;
- package version exactly `0.4.5`;
- P5 evidence as historical qualification evidence for the pre-correction surface.

## Permanent guards

P1 must add a current-production terminology guard that:
- positively requires the canonical `@dope/software-map` package/path/export surface;
- fails on live `@dope/software-model`, `packages/software-model`, SoftwareModel/PhysicalSoftwareModel architecture-feature symbols or legacy software-model command/view IDs;
- scopes itself to current production/build/test/package surfaces;
- intentionally excludes historical prompts/evidence and ADR 0007 historical text;
- does not flag legitimate AI/model-runtime terminology or generic graph/model language unrelated to the architecture feature.

P2 must add/extend a placement guard that:
- positively requires the dedicated sMap Activity Bar/view contribution;
- requires the default area to be the left primary sidebar;
- fails if the current sMap contribution defaults to or programmatically attaches into the right secondary sidebar;
- proves the right side is not required for sMap initialization;
- preserves ordinary user layout customization as presentation state.

## Main risks

- **Blind global rename:** an unrestricted `model -> map` replacement could corrupt AI Model Runtime terminology, generic domain models or historical evidence.
- **Package graph breakage:** directory/package renames can leave root scripts, TypeScript project references, package dependencies, test commands, artifact inspection or generated metadata stale.
- **Identity breakage:** renaming product symbols must not silently change declared architecture IDs, CodeEntity identities, graph identities or provenance semantics unless those IDs literally encode the obsolete UI/package identifier.
- **RPC mismatch:** service/client/path renames must remain coherent across framework-independent contracts, backend registration and frontend proxy use.
- **Persisted-layout ghost:** an old widget/view ID or stored layout can keep the obsolete right-side inspector alive after the new sMap contribution lands.
- **Framework coupling:** solving placement through Theia shell internals would create avoidable upgrade risk.
- **False UI qualification:** a static unit test can prove contribution metadata but not that the actual Activity Bar/sidebar behavior is useful. P2 therefore requires direct browser interaction.
- **Evidence invalidation:** the correction changes final Phase 4 product/package source, so the pre-correction P4 AppImage cannot be claimed as the final package. P2 must build/inspect a correction candidate package.
- **Phase creep:** the central graph/map canvas is Phase 5. The correction must not add diagram rendering, planning interactions or graph-layout libraries.

## Qualification decision

P2 should repeat only the changed-surface qualification plus a representative Physical Map smoke path. It does not need to redo the entire P5 controlled-violation matrix unless a repair touches those semantics or evidence becomes invalid.

Minimum direct browser evidence:
- clean/default profile shows a dedicated sMap Activity Bar control;
- activating it opens the inspector in the left primary sidebar;
- editor remains center;
- sMap does not require or default into the right secondary sidebar;
- Analyze/Refresh works;
- representative System -> Subsystem -> Component -> code navigation works;
- at least one dependency/evidence/source-navigation path works;
- current diagnostics/violations render;
- dark/default and explicit light remain readable;
- restart/reopen preserves a usable sMap surface without creating a ghost legacy right-side view.

A repair during P2 requires permanent regression coverage and replay of the affected evidence.

## Deferred

Do not implement the Phase 5 central visual Physical Map canvas, Planning Map editing, semantic zoom canvas, layout engine, graph-derived work ontology, AI Presence, Agent Mind, provider/model runtime, delegation or framework upgrade.
