# R3B native Prompt Stack proposal — partial qualification, 2026-11-08

**Disposition: PARTIAL; hold downstream R3.** The native proposal implementation is local and uncommitted. Focused source tests and a supplemental headless browser fixture passed the paths described below, but the mandatory connected Codex browser and real selected-model workflow did not run. This is not R3B PASS, R2 requalification, Work Run authority, Roadmap Gate GREEN, Phase 13 completion, or a product version change. Product version remains `0.13.11`.

## Source basis and work performed

- Started from clean `main` / `origin/main` at `dc60ae100af7b85f1ae6a67f90929288f57d247b`; there were no owner edits to displace. R3A's dated PASS and c13-native-doc-editor R2's NOT GREEN/Prompt Stack BLOCKED evidence remain unchanged.
- Local source adds a typed, bounded, exact-byte `prompt-stack-proposal` to saved Chat. `/prompt-write` stages it from the verified R3A assessment, plan, composer and importer output, including ordered files, hashes, source HEAD/version/worktree, owner/Chat/lease identity and revision. Pending proposals have no canonical project file write. Source or owner drift fails closed.
- The existing Chat card gains individual file links, **Open All Files**, Accept, Reject and Revise Proposal. The frontend uses the existing read-only native proposal resource/tab system through a typed Prompt Stack adapter; `.txt` and `.md` modes remain distinct. Successful revision supersedes the old proposal; failed revision retains it. An unrelated generic Roadmap outcome shown in the supplemental browser fixture was removed in the final local source, but that last presentation change was not rechecked in a browser.
- Native Accept is a narrow standalone entry to the existing `PlanningStackPublication` journal, lock, byte writer and recovery owner. It validates the source and proposal, checks absent targets, writes only reviewed bytes, then verifies persisted bytes and Work stack discovery. Existing Bridge entry requirements remain in its Bridge path. No Work task, grant, Run, candidate promotion or Roadmap status is created.

## Source checks

- `@dope/chat`, `@dope/theia-extension`, and `@dope/browser` builds: **PASS** in dependency order on the final local source.
- Focused backend, authoring, publisher, editor adapter, card/presentation and existing Chat/Docs seams: **114/114 PASS**, including source drift, wrong digest, revision retention/supersession, exact-byte Accept, replay denial, publisher collision/tamper/symlink denial and native tab adapter checks. An initially obsolete source-shape assertion in `chat-presentation.test.ts` was updated to the existing native Docs review handoff; the final rerun passed.
- `git diff --check`: **PASS**. No broad check, packaging, native Electron or hosted parity claim.

## Supplemental disposable browser observation

An isolated headless Chromium session used `/tmp/dope-r3b-browser-BkHpkT`, a disposable Git project at `a980c8b48cd4c3e7183d75185bc741807e3438cb` / fixture version `1.0.0`. A **synthetic, backend-validated** saved Chat proposal exercised the actual browser UI; it was not a real local-model `/prompt-ass → /prompt-plan → /prompt-write` sequence. Proposal `b213843a-1c65-48ed-9bf9-4a90807001e4` in Chat `cd62ef0e-376b-4422-995b-1a622a4bdc20` had five ordered files under `docs/tasks/c0-browser-review3/`. Its pending card and no-write state survived reload and a new panel owner. The individual `.txt` and `.md` links opened read-only proposal-scoped main-area tabs; `.md` Formatted rendered. Open All retained five distinct tabs, reused them on repeat, and activated the first assessment tab. See [single file](2026-11-08-r3b-single-headless.png) and [Open All](2026-11-08-r3b-open-all-headless.png).

Clicking Accept on this synthetic fixture changed the card/tab to applied/accepted. All five persisted file hashes matched the proposal, the native publication journal recorded `published`, and existing Work discovery found the stack without a diagnostic. No Work grant or Run appeared. See [accepted card/tab](2026-11-08-r3b-accept-headless.png). The headless `.txt` Source editor surface appeared blank, so its content, Save/Ctrl+S denial and keyboard behavior were **not** verified here; R2's separate connected-browser Docs Source evidence does not qualify this Prompt Stack case. The saved screenshots predate the final generic Roadmap-outcome text fix.

## Missing acceptance and next boundary

The required connected Codex browser interaction was unavailable in this tool session. The app model selector reported all connections unavailable although LM Studio's models endpoint responded with `openai/gpt-oss-20b`. Therefore the real selected-model assessment/plan/write chain, live revision add/remove and failed retention, independent Reject no-write case, Prompt Stack Source/readonly/Ctrl+S, project-switch/restart, and browser security negatives remain unobserved. Supplemental headless checks cannot substitute for those gates.

Keep the local product source and focused tests for review; they were deliberately **not** committed as qualified product code. The safe delivered checkpoint is this report and its clearly labeled supplemental screenshots only. Reconnect the real model/browser and perform the full mandatory R3B acceptance on a fresh disposable project, repairing any observed failures before a separate source commit or R3 progression. Preserve R3A and R2 historical verdicts.
