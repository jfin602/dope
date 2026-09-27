# Foundation Spike 0 Implementation Plan

Status: IN EXECUTION — P1-P3 COMPLETE / P4 NEXT

Phase: 0 — Theia substrate qualification  
Execution folder: `p0`  
Current package: `0.0.3`.  
Current main at scope revision: `2e6efe76284611aa5c459a2b816daff8e4b9f93f`.

P1-P3 are committed and must not be rewritten or replayed by this scope change.

## Current implemented foundation

```text
Browser qualification app        Electron desktop app
          \                         /
           \                       /
            shared Dope Theia extension
             |  Project Mind spike view
             |  Planning spike view
             |  BUILD / PLAN adapter
             |  branding / styling / rebind
             |
        Dope-owned contracts
             |  WorkspaceMode
             |  ProjectArtifact / Note
             |
        typed backend service
             |
     workspace persistence
```

Theia baseline remains exactly 1.75.0 for the rest of Phase 0.

## Completed P1 — Theia 1.75 application foundation

Target/commit subject: `0.0.1`.

Keep the committed implementation and evidence exactly as history records it.

## Completed P2 — Dope workbench surfaces + customization stress

Target/commit subject: `0.0.2`.

Keep the committed implementation and `customization-coupling-ledger.md`.

## Completed P3 — typed backend + minimal Project Mind persistence

Target/commit subject: `0.0.3`.

Keep the committed Dope-owned Note contract, backend service, persistence and tests.

## P4 — Foundation IDE GUI + tooling qualification

Target: `0.0.4`.

Browser/GUI execution required.

Qualify the exact P3 candidate through the real shared Theia workbench:
- repository/workspace open;
- explorer;
- edit/save;
- TypeScript/JavaScript behavior;
- JSON and Markdown;
- search;
- Git/SCM;
- terminal;
- Node debugger;
- Problems/markers;
- Open VSX;
- ESLint;
- Prettier;
- one additional non-AI extension;
- Project Mind;
- Planning;
- BUILD/PLAN;
- branding/layout/styling;
- service-rebind effect;
- Note persistence across restart.

Create `docs/tasks/p0/P4-gui-evidence.md`.

Allow only bounded Phase 0 repairs with regression coverage.

P4 is the single mandatory manual GUI handoff.

## P5 — Linux Electron packaging + launch smoke

Target: `0.0.5`.

Runner-owned; no browser/GUI requirement.

Produce the real Linux distributable from the P4 candidate using the supported Electron packaging path available in the repository.

Required evidence:
- artifact exists;
- Dope branding/metadata;
- exact artifact type/path/size/SHA-256;
- packaging command and warnings;
- Linux native/build prerequisites, including any X11 development requirement;
- native process launches outside the dev server and remains alive long enough to establish startup viability;
- startup/runtime logs do not show a substrate-level fatal error;
- packaged resources resolve without relying on source-tree/dev-server paths;
- strongest practical programmatic renderer/CDP smoke, if a clean existing seam is available.

Do not add a large automation framework solely to inspect the native window.

If native visual interaction cannot be observed from the runner environment, record it as Evidence Gap. P4 already owns direct shared-workbench GUI evidence.

Create `docs/tasks/p0/P5-linux-package-evidence.md`.

## P6 — evidence-only Foundation Spike closeout

Target: `0.0.6`.

Audit Gates A-F:
- A commodity IDE;
- B Dope UI;
- C backend/persistence;
- D customization/coupling;
- E extension/tooling;
- F Linux package/build/launch.

Do not repair implementation or add product scope.

If Qualified:
- create `docs/tasks/p0/closeout.md`;
- mark the task README COMPLETE / GREEN;
- update the Foundation Spike decision record with executed evidence;
- update ADR 0001 from provisional to accepted if supported;
- update `BOOT.md` to route to post-spike `/docs-review`;
- do not create Phase 1 prompts.

If Not Qualified, preserve exact blockers and leave Product Phase 1 blocked.

## Phase 1 transition

If P6 qualifies Theia, the next action is a short post-spike `/docs-review`.

That review incorporates substrate findings and then an approved activation change sets the package baseline from `0.0.6` to `0.1.0` before the `p1` implementation stack is written/run.

Do not change the phase-runner version convention to avoid this explicit transition.

## Phase 0 boundaries

Never implement model/provider runtime, Agent Mind, tool/authority runtime, AI editor integration, autonomous mutation, scoped delegation, ambient intelligence, production Project Mind, or production Planning.
