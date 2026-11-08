# R3A native prompt authoring qualification — 2026-11-07

**Disposition: PASS for R3A's scoped native authoring and unpublished draft boundary.** This is not R3B publication, R3 Roadmap handoff, R2 evidence qualification, P9/P12 technical GREEN, or Phase 13 closeout. Product version remains `0.13.11`.

## Source and implementation

- Started from clean tracked `main` at `4cd6fb7e7181ab8f70d856e1563c905db853bc3e` (`origin/main`). No owner changes were present. This report and the R3A source/tests are the only repository changes for this checkpoint.
- Registered protected built-in `/prompt-ass`, `/prompt-plan`, and `/prompt-write <folder>` skills in `packages/theia-extension/src/node/chat-skills.ts`; custom skills cannot collide. Send-time Chat binding requires the exact protected skill snapshot and a leading slash command. Ordinary quoted/embedded text does not invoke the stage.
- `packages/theia-extension/src/node/chat-backend.ts` binds the stage to the saved Chat and current project, selects the latest completed prior assessment/plan (including retry chains), checks their broker-read source identities, uses the selected local model and project-read broker, denies `run_command`, and suppresses unrelated Roadmap proposal generation. It does not publish files, grant/run Work, or award Gate status.
- `packages/theia-extension/src/node/prompt-authoring-stage.ts` builds bounded assessment and plan drafts with verified retrieval counts and requested-path omissions. Its write stage converts a compact model outline to the existing composer/importer grammar, requires planned test files in the working set, rejects copied generic acceptance/validation text, and saves exact candidate bytes plus stable digest and assessment/plan message IDs in Chat. `packages/agent-core/src/phase-stack-composer.ts` accepts draft Chat plan steps without fabricating accepted WorkItems while retaining the existing ready-WorkItem route.
- Tests changed: `test/unit/chat-backend.test.ts`, `test/unit/chat-skills.test.ts`, `test/unit/prompt-authoring-stage.test.ts`. No tower-defense or historical R1/P9/P12 files changed.

## Validation

- `npm run build --workspace @dope/theia-extension`: PASS.
- `npm run build:browser`: PASS after the semantic guards were added. The last change after that build was a backend-only guard refinement; the extension package build passed again and the isolated backend was restarted.
- `node --test --experimental-strip-types test/unit/prompt-authoring-stage.test.ts test/unit/chat-backend.test.ts test/unit/chat-skills.test.ts test/unit/phase-stack-composer.test.ts`: **26/26 PASS** on final source. One earlier parallel run had an unrelated temporary Chat directory `ENOTEMPTY` cleanup race; the final rerun passed.
- `git diff --check` and `git diff --cached --check`: PASS at delivery.

## Connected browser, disposable project

The isolated Dope browser at `127.0.0.1:3003` used `/tmp/dope-p13-r3a-Ow7C6Z`, a small `1.0.0` project with `src/feature.js`, `test/feature.test.js`, and `AGENTS.md`. The existing local LM Studio `openai/gpt-oss-20b` model was selected. The owner's tower-defense project and the existing browser server were untouched.

- A natural-language feature brainstorm remained in the same saved Chat. `/prompt-ass` completed with scope, preservation, dependencies, risks, source basis, authority, and T1/T2/T3 evidence; its verified retrieval showed two actually read files and three directory listings. The model did not read the requested `AGENTS.md` in that earlier live turn; the later source-omission footer was added and unit tested, but that particular footer change was not replayed in a fresh assessment turn.
- `/prompt-plan` consumed the saved assessment, read the source and test again, and saved ordered implementation, test, integration, and manual steps. Both source identities remained usable across backend restarts.
- `/prompt-write c0-excited-label` ultimately completed with draft ID `c6ea380657c36d07c9db5b906e9d4ba3d482a49142e53a3e3b1f1c0e9a9493e8`, the selected assessment/plan message IDs, source version `1.0.0`, exact assessment/plan candidate files, P1 implementation, P2 integration, and one P3 manual closeout. P1's working set includes both source and test and its acceptance checks both default and excited greetings. P3 has `Browser required: yes`. The final draft remained visible after reload.
- Earlier live write attempts exposed malformed/full-schema output, a redundant source-read requirement, an omitted planned test file, and generic acceptance text. Focused repairs addressed each. A generic example rejection appeared visibly as a Chat error; its retry preserved the saved stage and produced the final accepted draft. The narrow right-side Chat panel remained usable, and Enter submitted the command from the composer.
- `docs/tasks/c0-excited-label/` did not exist in the fixture after generation. The fixture Git status showed only `.dope/` Chat state; no product source/test edits, Work/grant/run files, or canonical stack publication were observed.

## Limits and next boundary

This qualifies an unpublished standalone correction draft in the connected browser, not every model/output variation or a Roadmap-bound Phase stack. The particular live assessment predated the explicit omission-footer patch; unit coverage verifies that footer. Native Electron parity was not tested. R3B must independently guard review and publication of exact bytes before any Work discovery; this R3A PASS gives no publication or Run authority.
