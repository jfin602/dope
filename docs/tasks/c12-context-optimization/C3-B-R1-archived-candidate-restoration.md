# C3-B-R1 — Archived candidate restoration and safe Work resume

**Disposition: PARTIAL.** The create/modify restoration boundary passed focused deterministic checks. The Codex browser showed verified review and cancellation, but its selected Coding Agent was unavailable, so browser confirmation and live Pi continuation were not qualified. This record does not change the original [C3-B PARTIAL result](C3-B-safe-continuation.md).

## Source and scope

- Date: 2026-11-02. Entry and final HEAD: `4869c6c46a3aa0610da93ec71dd3a2fbae10ddad`, branch `main`, version `0.12.7`. Entry tree was clean. All R1 product, test and evidence changes are uncommitted; no owner files were overwritten, and no commit or push was made.
- Read `AGENTS.md`, `BOOT.md`, `docs/workflow.md`, C3-B, C3-A and the C0–C3 closeout. No C1/C2 or native compaction change was made.
- Supported restoration effects are **create** and **modify**. Delete and rename archives are explicitly ineligible. A delta without archived bytes is ineligible.

## Restoration and authority

`ExecutionWorkspace.restorePartial()` is separate from reviewed candidate restoration. It creates a fresh disposable clone, reads each archived file through no-follow paths, enforces 32 MiB per file and 64 MiB total, checks every SHA-256 against the recorded delta, applies only safe create/modify effects inside that clone, then recomputes the complete delta and workspace fingerprint. It checks the authoritative project basis again and disposes the clone on any failure. It never promotes to the canonical project.

The new `previewCandidateResume` RPC verifies a terminal failed/cancelled/interrupted run, original task, clean original source HEAD, matching current clean HEAD, supported delta, complete archive and fingerprint. It excludes accepted promotions, review holds, an active run and a source run already continued. It returns bounded task, outcome, effect and uncertain-command evidence for display. Missing or corrupt archives return an ineligible result.

`resumeCandidate` accepts an expected source-run fingerprint, a newly created task with the original objective, policy, scope and completion contract, and a newly accepted `ExecutionGrant`. The runtime re-verifies the archive, source, task, model provenance and grant before Pi starts. The new task ID and grant ID must differ from the originals. Changed model binding is rejected. The current WorkItem project, map revision, basis, ownership and delegation are checked by the RPC backend when applicable. The restored effects must fit the fresh grant and WorkItem delegated paths. A single active project slot and persisted `resumedFrom` lineage reject duplicate submissions. One source archive can start at most one continuation run.

The new run has its own ID, workspace, grant, transcript, validation and candidate review. Its immutable `resumedFrom` field names the original run and candidate fingerprint. The old run and archive remain intact. A bounded factual prompt names the new and original runs, verified changed paths, prior recorded successes, failure and uncertain commands. It asks Pi to inspect restored files. No old command or edit is replayed. The existing broker, cancellation, native Pi compaction guard, validation and human candidate review paths remain authoritative.

## Work and History presentation

The Work run shows **Resume from saved candidate** only after archive verification. Opening it shows the original task/run/outcome, source HEAD, fingerprint, effect counts and paths, uncertain commands or incomplete transcript warning, model, fresh grant and validation/review requirements. A separate grant checkbox and **Confirm Resume** start the new run; Cancel closes the preview without mutation. Confirm stays disabled without an available matching model. The new run displays its source-run link in Work; History labels it as resumed from the original run. Their transcripts remain separate.

## Qualification

- `npm run build:browser` passed, including the affected extension, contracts and agent-core builds. The focused AgentStore, workspace, runtime, Work UI and History suites passed **61/61** on the implementation before the final WorkItem preflight and asynchronous preview refinements. A final affected extension/browser rebuild passed, and the two new restoration tests passed **2/2** after the WorkItem preflight change. The runtime test restored one modified and one created file with exact bytes, a fresh task/grant and lineage, and no canonical write; it rejected corrupt archived bytes, dirty authoritative source, a stale fingerprint, a reused grant ID and duplicate continuation. The workspace test rejected corrupt and symlink archive bytes. The last UI preview timing refinement was build-checked but not rerun through the full 61-test set.
- Codex in-app browser at `http://127.0.0.1:3018/` opened disposable project `/tmp/dope-c3b-r1-browser-2cp1Bq`. The archived run appeared in Work. **Resume from saved candidate** opened a review with the actual two effects and fingerprint; Cancel returned to the stopped run. This interaction was repeated after the WorkItem preflight rebuild. Direct store inspection found only `resume-demo-run`; canonical `README.md` stayed `Original project file` and Git status remained clean. The selected model was **Unavailable**, so Confirm was disabled. No browser run creation, Pi continuation or browser Green is claimed. No model setting was changed. The final asynchronous preview timing refinement was built after this interaction and was not separately replayed in the browser.
- The fixture had no recorded transcript, so its preview truthfully marked the transcript incomplete. This did not claim an actual uncertain command invocation.

## Remaining limits

Browser confirmation/new-run interaction, genuine live model continuation, a current WorkItem-specific deterministic replay, and native Electron remain unqualified. The browser server and disposable fixture are local qualification state. Crash-time preservation of an in-flight workspace remains outside this result. C3-A live compaction and long-session performance were not measured. C3-B-R1 and the consolidated context optimization stack therefore remain **PARTIAL**.
