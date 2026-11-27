# P8 absolute execution-workspace path repair — focused source verification

Date: 2026-11-27 (America/Chicago). Status: **focused repair verified; P8 remains NOT GREEN**. This report is additive to [the transparent rerun](P8-transparency-rerun-2026-11-27.md) and the original [P8 closeout](P8-final-closeout.md); neither historical report or its evidence was changed.

## Source and change

Entry Git HEAD: `6007b12c6d63b5348f8d46c9b0fa51452f7d8d71` on `main`; product version `0.14.0`; Pi SDK `1.4.0`. The entry tree already contained the untracked transparent-rerun report and its evidence directory. Those remain untracked and untouched. This repair is uncommitted.

Pi's original file-tool argument remains in the requested Work observation. The trusted adapter now converts the active `ExecutionWorkspace.root` to `.` and a strict descendant to its project-relative path, then records `resolvedProjectPath` in a validating observation before Work routing and broker execution. Project-relative arguments remain accepted. Outside roots, matching-prefix siblings, dot traversal, repeated separators, trailing separators, backslashes, controls, home and drive paths fail before broker execution. An absolute canonical-project path has no special authority. The selected-tool, grant, source-basis, protected-path, sandbox, Direct journal, and Isolated candidate owners still receive the resolved path. Direct Work also checks the candidate path for symlinks before canonical journaled mutation, preventing a model-view symlink from causing a canonical write followed by a failed mirror. Only Pi Work descriptions' incorrect relative-path requirement changed; Pi-maintained tool schemas, definitions, hashes and prompt guidelines did not.

| Changed source | SHA-256 at verification |
| --- | --- |
| `packages/pi-runtime/worker.mjs` | `b9e898234050d060c48902f897745281a1f02034d74fced301b4c3e80eb7a1e7` |
| `packages/theia-extension/src/node/pi-work-execution.ts` | `b389103927663b02bc5f443bc54bdd3490d06f67840ac19e0b6a9f0b9d218f20` |
| `packages/theia-extension/src/node/local-agent-turn-loop.ts` | `27ec2c4e7bc9ea713c8d0b348ddb49dced10e431443cab82ad2f08b859bccc8d` |
| `test/unit/pi-work-execution.test.ts` | `6ad1160d00c4ebe4079707611248ba042bc8c67c37b9450a7627ed3937628c03` |
| `test/unit/pi-native-file-tools.test.ts` | `d1a2f863b203776d892c2f3184d1e2b8b3447eb31125ef460d4ea6001f877cf4` |

## Verification

- Focused Pi path and bridge tests: **5/5 PASS**. They cover absolute-root `ls`, absolute read/write/edit in both modes, relative compatibility, original argument and resolved-path observations, absolute protected path denial, strict outside/traversal/malformed rejection, symlink escape denial, stale workspace denial, and a saved open editor tab allowing a Direct edit. A synthetic saved-tab callback was used; this is not a live GUI claim.
- Direct journal and local edit regressions: **29/29 PASS**, including saved-tab versus unsaved-buffer conflicts and canonical source protection.
- `npm run check:pi-runtime`: **PASS**, Pi `1.4.0` integrity check.
- `corepack yarn workspace @dope/theia-extension build`, `npm run build:browser`, `npm run build:electron`, and `git diff --check`: **PASS**. The browser and Electron builds reported zero compile errors. The final extension build and focused test rerun occurred after the last source edit.
- An initial expanded fixture test failed because it placed a symlink in the project before `ExecutionWorkspace.create`, which correctly rejects that unsafe source entry. A later in-workspace symlink test exposed the Direct ordering issue described above; after the preflight fix, the focused suite passed. These attempts did not modify the owner project.

## Remaining gaps

No fresh ordinary-task live rerun occurred. The Codex browser inventory had no connected tab and no Dope server listening on port `3000`; LM Studio was listening on port `1234`. A fresh disposable-project browser run without relative-path guidance remains pending. The transparent rerun's validation failure and the original P8 parallel first-write reliability gap are separate and **not fixed or qualified** by this repair. No Gate, Phase, or version status changed; no commit was made.
