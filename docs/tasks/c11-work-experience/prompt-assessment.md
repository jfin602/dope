# c11-work-experience — Prompt assessment

**2026-10-18/19, documentation only.** Owner-approved `/docs-review` and `/docs-apply` contract: [Work Experience](../../planning/p11/work-experience-contract.md). This `/prompt-ass` assessment, subsequent `/prompt-plan` and `/prompt-write` are authored on a dedicated Git branch originating at main `c0b3771902918bd34dd25aa93a23d5a913ebca0d`. No product code has been changed, no agent/GUI test has been run, and Phase 11 is OPEN / NOT QUALIFIED. Current repo manifest is `0.11.8`. Remote documentation and code were inspected through GitHub; the owner's **local** checkout/head/dirty state and running bundle cannot be verified here.

## Evidence and critical diagnosis

The two owner screenshots show (1) dense Prompt Stack UI at P1 of 3, scattered status/progress/validation/grant/dirty-tree controls, `blocked · worktree-drift`, and (2) cramped Work transcript prose with command output competing for readability. The agent transcript states focused runtime checks and `git diff --check` passed, while required `npm run check` **did not execute** because TypeScript `tsc` was not installed and offline dependency resolution produced `ENOTCACHED`. That is an environmental validation gap, **not** proof of a runner bug, approved dirty-tree continuation, successful validation or Dope source root cause. Drift and unavailable validation must remain two independent facts.

Read-only repository inspection at the planning branch base confirms important pre-existing seams:

| Existing owner/seam | Actual inspected source | Implication |
| --- | --- | --- |
| Work panel, detail and composer | `packages/theia-extension/src/browser/chat-panel-widget.ts`; `renderWork()` and `renderWorkComposer()` | **Reuse**, separate Work mode and existing control callbacks. Current DOM has stacked paragraphs, details, controls and transcript actions; restructure presentation, not RPC authority. |
| Work selector/read model | `packages/theia-extension/src/browser/work-selection-controller.ts` | `workRows`/`workTitle`/`workReviewState`/`workReviewCanAccept` already check task, sequence, candidate and validation provenance. Use as read sources; do not make UI strings a new owner. |
| Prompt Stack controller/state | `packages/theia-extension/src/browser/phase-stack-controller.ts`, `packages/agent-core/src/sequence.ts` | Source/Git/fingerprint/sequence/manual gate protections exist; recheck actual controller implementation locally before editing. |
| Execution and grant controls | `packages/theia-extension/src/browser/agent-run-controller.ts` and `packages/contracts/src/agent-runtime-service.ts` | Start, stop, review, reconciliation and validation must remain backend-authorized. |
| Read-only transcript | `packages/theia-extension/src/browser/agent-transcript-widget.ts` | Already paginates durable entries and renders message prose with safe Markdown, command entries as collapsed `details`, and Latest/follow controls. This correction is **not** initial Markdown support or a new store. |
| Safe Markdown | `packages/theia-extension/src/browser/untrusted-message-markdown.ts` | Already uses markdown-it with HTML off, strips image tokens pre-DOM and sanitizes DOM via DOMPurify; safe links filtered. Preserve pre-DOM no-image/no-egress behavior. |
| Work transcript helpers | `packages/theia-extension/src/browser/work-transcript-presentation.ts` | Reuse command label/output and scroll-follow semantics; distinguish stored truncation from presentation collapse. |
| Shared layout and CSS | `packages/theia-extension/src/browser/shared-panel-state.ts`; `packages/theia-extension/src/browser/dope.css` | Current neutral token style/Work selectors/scroll and panel ownership are reusable; improve without duplicating Chat/Work. |
| Wiring | `packages/theia-extension/src/browser/frontend-module.ts` | Work launchers and AgentTranscriptWidget share existing frontend registrations; avoid new view/widget owners. |
| Runner grammar | `scripts/codex-phase-core.mjs` (`parsePrompt`/`buildPlan`) | `c11-*` correction; contiguous P1–P6; exactly one final P6 closeout; exact GPT-6 Sol config; correction version unchanged. |

## Existing versus actual requested gap

Existing transcript rendering is nominally Markdown-capable; owner screenshot is evidence that **formatting/polish and information hierarchy** remain poor. P3 should audit specific Markdown features, classes/CSS and security at the same seam; avoid replacing a renderer that is already present. Do not promise rich language syntax highlighting without first proving a safe supported local mechanism. Never inject raw agent HTML or remote images.

Existing Work UI already exposes some source/validation data and buttons. P1 should derive a **pure, read-only, truthful** presentation model and label the next available action from current existing service state. P2 should reorganize existing actions into contextual surfaces (grant, drift, validation, candidate review) instead of rewriting policy or adding power to panels. Distinguish direct AgentTask, WorkItem-held candidate and Prompt Stack sequence; they are not interchangeable.

## Risk / overlap assessment

- Most sensitive: `chat-panel-widget.ts` and `dope.css` are large shared files. Every implementation prompt needs a **fresh local HEAD/dirty preflight**, narrow edited section and clean checkpoint; no reset/stash/clean/force-push. Concurrent `c11-bridge-repair` source on the developer's local machine may differ from GitHub main; stop/coordinate if overlapping.
- Bridge `c11-bridge-repair` P5 remains **NOT GREEN** even though the last source-bound full aggregate was 772/772, because D5/D6/D7/D8 and broader proof are missing. Do not claim that prettier Work alone resolves those failures. Do not rewrite original P15, P5 or Phase Focus evidence, task/prompt history or published status.
- No new Chat, Work, History, transcript store, runtime service, model/provider, RPC, dependency just for styling, owner grants or source truth. P1 pure read model; P2 UI controls; P3 existing transcript renderer; P4 CSS/focus; P5 regression; P6 manual real GUI gate.
- Security: no HTML/script/image/network loads from untrusted Markdown, no provider hidden reasoning/secret leakage, no unsafe in-root/out-of-root command links, no cross-project transcript leak, no false complete/qualified state. Preserve existing DOMPurify and approved render/link filtering.
- Version: correction remains unchanged `0.11.8` if the actual working tree still matches. If source/version advanced, pause and re-assess rather than downgrade. No package-lock or manifest edits.
- Confidence: inspected GitHub source and docs are sufficient to write **bounded prompts**; no claim is made that actual selectors/actions/tests are already qualified in a running GUI.

## Split decision

Keep **six prompts**, P1–P5 headless T1/T2 with ~8-minute target, P6 sole manual T3 closeout. P1 must land before P2 so layout consumes truthful derived states; P3 transcript work can be independently reviewed after P2; P4 style/accessibility after structural edits; P5 final cross-seam regression; P6 live-source GUI observation separately. Write once in immutable P-number order; after authored prompts, changes require explicit reviewed supersession rather than silent renumbering.
