# c8-work-mode / P9 — GUI qualification closeout

Date: 2026-10-08

Disposition: **NOT GREEN — real GUI blocker**

Final inspected source HEAD: `48dcfd202866dfd3814c7292d331ef9a886fadb6`
Package version: `0.8.20` (unchanged)

## Candidate and validation

P1–P8 are committed at `b6c3951`, `a62910f`, `16f63e2`, `33d95ba`, `196cac2`, `6eee315`, `f640970`, and `48dcfd2`. Their handoffs and focused evidence were reviewed. P2's original handoff recorded a 15/16 adapter-file failure involving its isolated npm-toolchain case; that observation remains historical. The same file passed in the final-candidate supplemental run below.

`npm run check` was executed **once** on the final source candidate and passed: typecheck; runner 103/103; baseline 11/11; local-install 1/1; product 329/329 plus 28/28; IDE 1/1; browser and Electron builds. That is 473 passing tests in the aggregate. The eight Work-related test files absent from the aggregate were run afterwards and passed 32/32, including the provider adapter file. `git diff --check` passed. No root `package-lock.json` exists. The root and browser manifests remain `0.8.20`.

The committed P1–P8 source diff was inspected around provider observations, runtime transcript projection, panel/launcher wiring and sequence selection. No P9 source edits were made. Provider sandbox, candidate validation, authorized promotion, manual-gate and checkpoint rules were not exercised by this GUI pass, so this closeout does not make a fresh dynamic qualification claim for those boundaries.

## Direct GUI observations

The real browser-hosted Theia application was launched against disposable Git project `/home/jfin/dev/c8-work-mode-p9-WAQ12E` (baseline `0a6f87fea6603e956db6e7b8eee800409cbf8bca`). Left and right Work toolbar icons opened separate panels. The command palette listed `Dope: Open Work` and Work-in-Left/Right/Center/Bottom; its Bottom and Center actions visibly opened Work panels in those areas. The fixed `Chat | Work` toggle rendered in the panels, and narrow sidebars kept their header and `New Work` button visible.

**Blocking failure:** Work stayed at **“Loading Work…”** with no history or usable direct composer. The browser console reported `Another channel with the id '/services/dope/agent-runtime' is already open.` for multiple panel proxies. Current source binds `AgentRuntimeService` through `ServiceConnectionProvider.createProxy` in `packages/theia-extension/src/browser/frontend-module.ts` without singleton scope, while each Chat/Work panel obtains that service. This is a concrete likely cause of the observed channel collision. The binding and the live failure need an explicit source repair and requalification; the aggregate tests did not detect it.

Consequently no direct Work or explicit execution grant was started in the disposable project. Agent-visible text, chronological transcript, command collapse/details, safe formatting, validation/authority display, scroll follow, Latest, Stop versus panel navigation, stable task-derived title, same-Work ownership, distinct Work selection, and no duplicate run on selection could **not** be qualified in the GUI. No saved disposable Work exists to reopen after restart. These are evidence gaps, not passes.

## Restart and completed-project regression

The browser backend was stopped and restarted with `/home/jfin/dev/adaptive-seo-dope`, then the UI was reloaded. The application showed the Adaptive SEO workspace and its saved Chat list, and Work again stayed at **“Loading Work…”**. The completed `c4-dope-phase-stack-smoke` Prompt Stack did **not** auto-discover visibly in Work, so its GUI titles, checkpoint display, legacy transcript fallback, and old Agent Run/Phase Stack command routes remain unqualified. A saved Chat entry was visible; opening its full conversation, settings, model routing, formatted content and ownership was not established. The AI Center displayed the saved Codex connection, but this does not qualify Work execution routing.

Read-only file/Git checks before and after the Adaptive SEO reopen confirmed unchanged HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`, clean Git status, and 12 existing run directories. The completed sequence file stayed byte-identical (SHA-256 `894e93b7276bfbda45c8e133df3f8a3de47991bbc7666d4f54dace35b0662469`). Its stored P1–P4 titles remained `Add Project Overview data-scope badge`, `Harden Project Overview data-scope presentation and regression coverage`, `Browser qualification for Project Overview data scope`, and `Dope phase-stack smoke closeout`; its four checkpoint SHAs remained `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, `d5c583b52abae24eb98fd2f28e4134ef61de93b4`, `57980fe9cb86c48dc7e5b587a50a21f137a8045b`, and `d4dfbf38628ba70726cf3b3610c2279643f500dc`. Saved Chat index and conversation files also stayed byte-identical. These file checks establish preservation, not GUI readability.

## Required repair and disposition

Plan a bounded source repair for the duplicate Agent Runtime RPC channel: give the frontend one shared runtime proxy/client channel across all Chat/Work panels, retain the existing event fan-out, and add a regression guard that instantiates the real multi-panel service wiring. Then rerun the affected integration check and only aggregate evidence invalidated by the repair, followed by the full P9 live Work, restart and Adaptive SEO read-only inspections. Preserve this failed observation in the later evidence.

**NOT GREEN.** No Green closeout checkpoint was created; the exact P9 Green commit subject is reserved until the browser gate passes. No Adaptive SEO source, deployment, production service, or Dope implementation source was changed by P9.

## Repair and requalification replay — 2026-10-08

The preceding Not Green observation is retained as the original P9 result. The bounded repair is committed at `ef540e1db2816490466455fe629e79ca675769af` from starting HEAD `48dcfd202866dfd3814c7292d331ef9a886fadb6`. Version remains `0.8.20`.

### Source repair and validation

`AgentRuntimeService` now has one renderer-scoped frontend RPC proxy. Its one client fans state notifications to mounted Work panels and matching center transcript tabs. The backend serializes concurrent attach, reuses a handle for the same root, and rotates the handle when the renderer attaches a different project. An old handle cannot read the new project. Attach failures surface with Retry in Work. A real service-wiring regression exercises two consumers, notification fan-out, concurrent attach, root switching and stale-handle rejection. Chat and Work launch as fixed, separate modules without a Chat | Work toggle; saved combined-panel identities restore to a fixed module.

Select Work now shows Running, History and discovered Prompt Stacks. Running is derived from an actual running AgentRun, including the active child of a running sequence; completed, failed, cancelled and pending work stays in History. Selecting Work opens the sidebar control/observation detail with status, model, ordered steps, validation, candidate/authority diagnostics and checkpoint data. It does not replace the center editor. Explicit Open Transcript creates or focuses one read-only center tab per project/run and pages saved transcript evidence from the beginning. Legacy runs without recorded transcript display an explicit fallback.

Final-source focused runs passed **15/15** (runtime wiring, Work selection/integration, stack UI and transcript presentation) and **23/23** (Agent store and Chat panel). Final `npm run check` passed once after the coherent source edits: typecheck; runner 103/103; baseline 11/11; local-install 1/1; product 329/329 and 28/28; IDE 1/1; browser and Electron builds. This is **473/473 aggregate tests**. `git diff --check` passed; root, browser, Electron and extension manifests remain `0.8.20`; no root `package-lock.json` exists.

### Disposable-project GUI replay

The browser-hosted GUI loaded `/home/jfin/dev/c8-work-mode-p9-WAQ12E` from left and right Work launchers with no duplicate Agent Runtime channel. Closing/reopening the workspace loaded Work again. A backend restart and browser reload restored the saved Work detail and the open center transcript. Chat opened independently with its own Select Chat and no toggle. Work's Select Work displayed Running and History. While a direct task ran it appeared in Running; its completed result moved once to History. Selecting saved Work left the center tab alone; repeated Open Transcript focused the same tab, whose saved agent message read “Qualification observed.” Work controls remained in the sidebar while the center showed the transcript. Closing/hiding Work during a run did not stop it.

Four disposable direct runs were observed. `6645d869-5b30-4000-a0fc-2cbde19abffe` completed a no-tool reply. `f1d79cc3-507c-4be3-a137-6836193d4922` was stopped through the explicit **Stop Work** control; the saved run changed to `cancelled` with “Agent run stopped.” The file-create run `3d182019-4d01-434e-a4c4-8d4faff66706` and single-command run `630fe5d9-8893-4333-aced-384d8243328c` ended `authority-denied`. The former recorded a candidate file change but no Dope validation or promotion; the latter recorded no displayable command row. The disposable project's Git HEAD stayed `0a6f87fea6603e956db6e7b8eee800409cbf8bca`; only test `.dope/agent/` records are untracked. No provider authority or promotion rule was widened to make those runs pass.

### Adaptive SEO read-only regression

Work loaded `/home/jfin/dev/adaptive-seo-dope` and auto-discovered completed `c4-dope-phase-stack-smoke`. Its detail showed all four saved entry titles and checkpoint SHAs: P1 `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, P2 `d5c583b52abae24eb98fd2f28e4134ef61de93b4`, P3 `57980fe9cb86c48dc7e5b587a50a21f137a8045b`, P4 `d4dfbf38628ba70726cf3b3610c2279643f500dc`. Explicit Open Transcript on P1 opened a center tab titled from the saved P1 task and showed “Transcript not recorded for this historical run.” Chat opened separately with the existing saved Chat entry and settings control. The project remained at HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`, version `0.4.7`, clean Git status and 12 run directories. The sequence file remained byte-identical at SHA-256 `894e93b7276bfbda45c8e133df3f8a3de47991bbc7666d4f54dace35b0662469`.

### Remaining qualification gate

**NOT GREEN.** The required live transcript gate includes an actual compact command row with expandable output. The disposable command run returned `authority-denied` and produced no displayable command evidence, so that gate remains unqualified. The authority result also prevented live validation/promotion qualification for the file task. Keep the P9 Green commit subject reserved, preserve this failed evidence, and do not advance Phase 8D. The next repair should determine why the reference execution adapter denies these in-grant disposable commands while retaining ADR 0028 isolation and Dope's existing authority boundary; then replay the command and validation gates in a disposable project.

## Documentation-only pre-qualification UI decision — 2026-10-08

Following the repaired but **Not Green** P9 replay above, the owner approved a bounded `c8-chat-work-ui` correction **before further qualification**. This decision aligns Select Chat, Select Work, Chat/Work controls and center AgentRun transcript presentation with the AI Center visual grammar and the superseding `#336699` Dope Dark palette (ADR 0016 amendment; ADR 0030).

The correction must reuse Chat's centered, safe-Markdown assistant-message layout for AgentRun text without fabricating user bubbles; preserve chronological collapsed commands, truncation, scrolling, panel ownership, run continuation, project isolation, alternative themes and accessibility. This entry records approval/docs routing **only**, not an implementation, visual test, candidate result, or Green P9 checkpoint.

The existing live command expansion/required validation and authority-denied gaps above remain open and must be repaired/requalified separately under unchanged ADR 0028/0029 constraints. Historical Not Green evidence remains unchanged; Phase 8D is still gated.

## Three-cycle P9 qualification replay — 2026-10-08

**Final disposition: GREEN / QUALIFIED for `c8-work-mode` P9.** The original and repaired **Not Green** observations above remain historical facts. This section records a new exact-candidate qualification; it does not change Phase 8B/8C, Adaptive SEO or future Phase 8D qualification claims.

### Candidate and checkpoints

The loop began at `21c49546a08320be140a8764cf50735c19cb5758`, the qualified `c8-chat-work-ui` implementation source. Its pending closeout, README and one obsolete grant-label assertion were reviewed and checkpointed alone at `2d3a73430bc2f41a2f6b89d94bb4a4054db523b3`; the assertion still requires the explicit **Accept project execution grant** action. Cycle 1 repair/evidence is `951df43960c6ce838236043fc461db20c18541ce` (tree `cd2673b598bd85f8defcbb981156ba37cee23f5a`). Cycle 2 is `9bb1f912303aef8da36205a2ea2c0fdf89f53f47` (tree `4e49421e84a96e97f2f064d746215bd19effad9e`). Cycle 3 GUI/preservation evidence is `bc0be6fe787c254edd16ea3792072df9d0b449fc` (tree `9955dabd5b9ae06d83a9a91d6ca4fcf9d915057a`), the exact reviewed qualification candidate. No product source changed after Cycle 2. Package version stayed `0.8.20`.

Cycle records and bounded real-run data are in [qualification-loop/](qualification-loop/). No transcript fixture or simulated provider observation was used for the live command or validation claims.

### Gates A and B — execution, authority and command transcript

The earlier `authority-denied` was reproduced with a real Codex command that exited 0. The adapter emitted an empty relative cwd when Codex executed at the ExecutionWorkspace root. Durable transcript validation requires the root identity `.`; rejecting the command observation made Agent Runtime classify the observation-write failure as authority denial. Cycle 1 changed only this cwd normalization and added a runtime persistence regression. No grant, sandbox, network or approval policy changed.

Installed Codex App Server 0.155.1 reports command `aggregatedOutput` for combined stdout/stderr. Cycle 2 added bounded, redacted provider-neutral combined output to the execution event, durable transcript, runtime projection and expanded Work detail, labeled **output (combined)**. Missing output remains explicitly unrecorded, and split output remains supported.

Real browser Work run `22f5f7fc-45af-4550-a07b-9b327b72552a` used an explicit accepted grant under the hosted Codex adapter. Provider observations and durable transcript contain agent prose, one stable command ID (`exec-fcd77dc0-0c10-440e-807e-918ef9cbf58f`) with chronological start/finish sequences 3/4, cwd `.`, exit 0, 25 ms duration and combined output `hello`. The center row was collapsed by default; expansion displayed the saved output. The run completed with no unexpected approval escalation and no task file mutation. Browser reload restored the saved Work and one center transcript tab.

### Gate C — required validation and authoritative promotion

Fresh disposable Git project `/tmp/dope-p9-gui-candidate-UaQgdC` began clean at `c0a5dbf610f34dbf40635d64ca6db97459d2d3a8`. Direct Work run `c08da97e-1f64-47ba-853f-f549b5e78dcb` used an explicit grant; the provider completed after producing one allowed `create candidate.txt` CandidateDelta. Frozen candidate fingerprint `93c31a1d75f3b769efb41abae1cec24b047985c668e8cff8aaf78c1812791ca7` matches the Dope-owned required validation result. Dope executed developer-approved `test -f candidate.txt` in separate ValidationWorkspace `85281829-953b-4b23-a581-645612258810`; it passed with exit 0. Only after that pass did Authority allow the delta and Dope apply only `candidate.txt` with content `qualified` plus newline. Work displayed the validation and authority results; reload retained them. The authoritative Git HEAD stayed unchanged, with only `.dope/` and `candidate.txt` untracked. No provider Git commit occurred.

### Gates D, E and F — boundaries, GUI and preservation

The affected adapter/runtime/transcript/presentation tests passed **49/49** after Cycle 2, including redaction/truncation, sandbox profile, unexpected tool/outside-file denial, exact model/grant and durable root-cwd command evidence. Candidate/workspace validation tests passed **9/9** for protected state, candidate containment, failure and cancellation/child cleanup. The final exact-candidate run of those six files passed **58/58**. Existing runtime tests also verify failed required validation and changed frozen candidate prevent promotion. These are focused regression results; the real in-grant command and fresh candidate above provide the positive dynamic evidence. ADR 0028/0029 restrictions were not relaxed, and the denied classes remain fail closed.

Real Work showed Running, History, model provenance and current activity. Closing a center Work panel during running command run `64d5f464-4611-4340-aa5a-cb26889b147e` left the same run active with **Stop Work** available when reopened; it later completed without Stop. Real 100-item agent Markdown in run `2e43979c-ba65-4b89-bb87-b5042d893d77` made the center transcript scrollable. Manual upward scroll exposed **Latest**, which resumed bottom follow. Reload restored one transcript tab, and Chat opened independently. No duplicate run appeared; the disposable command project's Git HEAD stayed unchanged.

Adaptive SEO was opened read-only. Work discovered completed `c4-dope-phase-stack-smoke` and displayed all four saved titles and checkpoint SHAs: P1 `96fe8c9b5500e3dce6c9dc24cbc1bc19b978907a`, P2 `d5c583b52abae24eb98fd2f28e4134ef61de93b4`, P3 `57980fe9cb86c48dc7e5b587a50a21f137a8045b`, P4 `d4dfbf38628ba70726cf3b3610c2279643f500dc`. P1 Open Transcript showed **“Transcript not recorded for this historical run.”** Before/after checks remained clean at HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`, 12 existing run directories and byte-identical sequence SHA-256 `894e93b7276bfbda45c8e133df3f8a3de47991bbc7666d4f54dace35b0662469`. No stack run or checkpoint was added.

### Gate G — final exact-candidate audit and manual review

On `bc0be6fe787c254edd16ea3792072df9d0b449fc`, one `npm run check` passed: typecheck, runner 103/103, baseline 11/11, local-install 1/1, product 330/330 plus 28/28, IDE 1/1, and browser/Electron builds with zero build errors. Total aggregate is **474/474** tests. Six affected files outside that aggregate passed **58/58**. `npm run codex:phase:validate -- c8-work-mode` reported valid P1–P9 grammar and required unchanged `0.8.20`. `git diff --check` passed; root, both app and all package manifests remained `0.8.20`; no root `package-lock.json` or untracked Dope repository file appeared. The GUI backend was stopped after replay, and the final process audit found no qualification-owned provider or validation child process.

Manual closeout review matched each claim above to the committed cycle records, saved disposable run/transcript/validation/authority data, direct GUI observations and before/after Adaptive SEO checks. The narrow fixes preserve the existing execution grant and candidate promotion boundary. There are no outstanding P9 gates. This Green result permits subsequent Phase 8 routing under its separate approval and qualification rules; it does not itself activate Phase 8D.
