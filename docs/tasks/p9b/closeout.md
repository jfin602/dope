# Phase 9B closeout — typed artifact linking and read-only resolution

**Date:** 2026-10-11 (America/Chicago)
**Disposition:** **GREEN FOR BOUNDED 9B ONLY**
**Exact product source/version candidate:** `0.9.13` / `5aa0bacecb4c26bf1806821747f36fae57077b1a`
**Scope:** 9B only. Phase 9 overall remains NOT QUALIFIED; 9C–9E and Phase 10 remain inactive.

## Entry and exact candidate

The separate owner activation is `docs/planning/p9/phase-9b-activation.md`. P1–P6 are consecutive committed checkpoints: `bde9801299f5b72b3140886db86ada020d1f855a` (`0.9.7`), `c378c47ef2152d88b8cd7c3d1f82f30864e07678` (`0.9.8`), `9f02dedd97a421d854a4defbf49d39760fa422cd` (`0.9.9`), `fb966a530d2d7d967d386e1ec327452e26882419` (`0.9.10`), `8ee5082786d7202f448bcdb982355aa6cd25ec9b` (`0.9.11`) and `90e7c7a8f5247557ff7a841a29fe6c34993bf657` (`0.9.12`). P6's synthetic persisted AgentRun was a projection fixture, never counted as live execution.

P7 advanced all 13 root/app/package manifests and every pinned internal `@dope/*` reference from `0.9.12` to `0.9.13` in the separate source/version checkpoint above. That checkpoint changes only those manifests. `yarn.lock`, unrelated dependencies and source behavior were unchanged, and no root `package-lock.json` was created. The candidate worktree was clean before and after qualification; the disposable project worktrees were separate.

## Focused exact-candidate evidence

One `node --test` invocation on `5aa0bac` ran the six Session files: contracts, store, backend, resolver, membership and cross-store integration. **25/25 passed, zero failed, zero skipped.** The original 9A's 13 named tests remain present; their v1 assertions were adapted for v2 normalization, not removed. Each of the six files occurs exactly once in root `test:product`. `git diff --check` passed. P6's prior focused handoff was reviewed; the version-only P7 transition did not change production Session code, and the focused suite was rerun once on the exact candidate. No unconditional `npm run check`, browser, Electron, native package or full Phase 8 matrix was run.

The tests prove strict composite typed references; deterministic v1 read normalization with byte-unchanged original files; explicit locked, revision-checked v2 persistence preserving IDs, project binding, revisions, timestamps, notes and closeout; duplicate attach without revision bump; shared membership, detach-only behavior, closed-session denial, stale revision and A/B project-handle isolation. A cross-store fixture resolves existing Chat, Planning Map, WorkItem, AgentTask, AgentRun, AgentTaskSequence and Project Mind records across two Sessions and restart. It covers missing, stale and unavailable targets; generation-only Physical Map changes do not cause semantic Planning staleness. Legacy/interrupted Chat metadata peeks and owner-store reads preserve their bytes; no transcript or candidate diff is copied into Session resolution. The P6 held/accepted run records were synthetic and are projection evidence only.

## Real local Planning-to-Work replay

The user approved local Qwen execution and the exact nonempty Dope validation command `node --test math.test.js` for a disposable project. LM Studio loaded `qwen3-coder-30b-a3b-instruct@q3_k_l` with **16,384 measured context tokens**. A real zero-project-data tool-loop probe returned `supported`; Linux sandbox preflight returned `all-denials-and-workspace-write-proved`. Coding Agent routing selected that local model only; hosted project-data authorization was `false`, with no hosted fallback.

A fresh disposable Git project had an initialized canonical Architecture and a real TypeScript/JavaScript Physical Map analysis. Its active Planning Map `math-plan` had a current source/declaration basis and ready AI WorkItem `fix-add-work`, with `src/math.js` as the sole delegable file and the approved validation command required. The existing revision-checked `launchWorkItem` created a persisted WorkItem-origin AgentTask and **zero** AgentRuns. The normal fixed ExecutionGrant then started that same task ID. The model worked in an isolated candidate. Dope's validator ran the approved test on the frozen candidate and passed 2/2. The candidate changed only `src/math.js`, from `return a - b` to `return a + b`.

| Evidence | First accepted-path replay | Held replay for explicit developer review |
| --- | --- | --- |
| Disposable project | `/tmp/dope-p9b-p7-real-V92aBE` | `/tmp/dope-p9b-p7-real-LAmJrs` |
| Project ID | `project-f2f4041f-d67c-4c46-bb09-0e142ec0aac0` | `project-cb1d9d7d-3aba-464f-8b2b-578b09452523` |
| Map / WorkItem | `math-plan` / `fix-add-work` | `math-plan` / `fix-add-work` |
| AgentTask | `work-45f335cf6f54952031e64faa50862245` | `work-7b354ba30b6c427b7a237f98926d2704` |
| AgentRun | `1409e48e-789c-49a1-8802-8f744ae92aa2` | `f9e427a5-cba4-4655-9368-9d78a7364e89` |
| Candidate fingerprint | `1d6ff80aaf5578c6403eb1930c4fd69c1fc43574faf1c575c1a953bfb6eae15c` | same |
| Validation | Dope-owned test, exit 0, 2/2 passed | Dope-owned test, exit 0, 2/2 passed |
| Review | Qualification operator invoked Accept; applied `src/math.js` | User explicitly accepted the frozen candidate; Dope applied `src/math.js` |

The first replay was a diagnostic accepted-path run by the qualification operator; it is not used as the sole developer-review proof. It completed after the review API accepted the exact frozen fingerprint. Its run recorded `reviewDecision: accept`, `authorityDecision.allowed: true`, `appliedFiles: [src/math.js]` and unchanged Git HEAD `c93a4f1bca2b821db2ac9d9a36402ccf532914f7`. A fresh Session backend resolved its exact persisted task/run links as completed, validation passed, accepted and applied. The WorkItem remained `ready`; after fresh Physical Map analysis of the changed source, the Planning Map and WorkItem links correctly became semantically `stale`. Ten Chat/Planning/Agent/Project Mind owner files, Git status and the sole run ID remained unchanged across another fresh Session resolution; resolution did not re-execute work.

The second replay was deliberately held before candidate acceptance so the user could review the exact one-line diff. Before review, a fresh Session backend resolved the exact run as `blocked`, validation passed and not applied, with WorkItem still `ready` and one run record. The user then explicitly answered **"accept, continue"**. Dope's normal review API accepted review revision 0 and the frozen fingerprint at `2026-10-11T12:47:18.515Z`, recording review decision revision 1. The run became `completed`; authority allowed promotion; only `src/math.js` was applied. Git HEAD stayed `82d29c8f76d018d2728a13b4a7b2c0b688cfb899` with that one tracked source modification, and a post-promotion `node --test math.test.js` passed 2/2.

After another fresh Session backend attach and two real Physical Map analyses of the changed source, the Session retained six links and resolved the run as `completed`, validation `passed`, review `accept` and promotion `applied`. The WorkItem remained `ready`; its link and the active Planning Map link were correctly `stale` against the changed physical input fingerprint `cbce103bc68812845758db79378b08eb6933c9eb38ef725ec93f7f85994db5a1`. The second unchanged analysis advanced observation generation to 2 without changing that fingerprint. Ten Chat/Planning/Agent/Project Mind owner files were byte-identical across Session resolution; Git status and the sole AgentRun ID were unchanged. Session resolution did not execute a task or mutate an owner store. The compact observed evidence is in `qualification/p7-replay-evidence.json`.

## Decision

The strict typed-link, migration, read-only resolution, revision-safe membership, isolation, restart and genuine accepted Planning-to-Work replay gates passed on the exact `0.9.13` source. **9B is GREEN for this bounded backend/headless scope.** This is not an owner closeout of Phase 9.

## Remaining boundary

9B Session membership organizes existing records. It grants no authority, starts or cancels no AgentRun on view, does not complete WorkItems or adopt Architecture, mutates no owner store or Git during resolution and does not automatically provide linked data as model context. The original Phase 5 P11 Not Green / P12 unexecuted disposition and Phase 8 owner-closed Green remain unchanged. 9C Session UI, 9D richer progress/resume projections and 9E real Dope Builds Dope GUI, full aggregate, package/native and phase-level qualification remain unqualified and inactive. No `0.9.14` transition or Phase 9 closeout is implied.
