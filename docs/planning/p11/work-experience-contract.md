# Phase 11 — Work Experience UX and Transcript Contract

**CURRENT 2026-10-19 BRIDGE BACKEND/UX OWNERSHIP:** [Verified disposable candidate review](../../tasks/c11-bridge-execution-recovery/qualification/2026-10-19-dirty-basis-final.md) now proves correct reject/accept, exact two-file promotion and Work checkpoint in the existing backend (D6 scoped PASS). Remaining [c11-bridge-final-evidence R1–R5](../../tasks/c11-bridge-final-evidence/README.md) owns live History Loading, Phase Focus verified checkpoint projection, source-truth structural/relink and remaining qualification. The independently approved c11-work-experience remains **DESIGN ONLY** for better Work layout and full safe Markdown transcript presentation, consuming the existing authoritative AgentRun/History/Phase Focus state. No parallel review owner or product implementation via this document; Phase 11 OPEN/NOT QUALIFIED.


**Forward dependency/ownership note (2026-10-18/19, DOCS ONLY):** The independent [`c11-bridge-execution-recovery` E1–E5 contract](../../tasks/c11-bridge-execution-recovery/recovery-contract.md) owns the *security-critical* phase-stack candidate-review hold/accept/reject/promotion and sequence-state semantics observed missing in real Bridge D6. This Work Experience proposal continues to own **presentation only** (legible Work status, safe Markdown transcript, disclosed existing review controls and recovery). It must consume the same authoritative `AgentRun`/`AgentTask`/`ExecutionGrant` state after backend qualification rather than implementing a parallel approval mechanism, and must avoid overlapping product edits until owner/worktree reconciliation. Both designs are accepted, **neither new correction is implemented or qualified here**; original Bridge NOT GREEN and Phase 11/12 boundaries stay unchanged.


**Status (2026-10-18 America/Chicago):** OWNER-APPROVED **DOCUMENTATION DESIGN ONLY** via `/docs-review` followed by `/docs-apply`. No implementation, executable P*.txt, Run, qualification, new version, or owner-close is implied. Proposed correction identifier: `c11-work-experience`. Phase 11 remains **OPEN / NOT QUALIFIED**; Phase 12 remains inactive.

**Evidence and applicability:** The owner supplied two screenshots from a disposable `dope-bridge-qual-*` project, showing a Prompt Stack operation at P1 of 3 with dense, scattered controls, `blocked · worktree-drift`, a required `npm run check` that could not run because `tsc` was unavailable, an offline dependency attempt reporting `ENOTCACHED`, and a text-heavy Work transcript. Treat these as direct owner-provided UI observations, **not** an independently reproduced product-source defect, a claim that all Work messages are unformatted, or proof of the root cause of drift. The focused runtime assertions and `git diff --check` in the screenshot passed; that must **not** be presented as full validation. Current Planning Bridge `c11-bridge-repair` P5 remains **NOT GREEN** despite a 772/772 full check on its recorded scope because remaining live Bridge gates were not qualified. Preserve its original P15/P5 failures, P4 native evidence gap, and all authored prompt provenance.

## Goal

Make Work a human-centered, polished, predictable **supervision and review** experience, not a developer-facing runner debugger. A developer should understand: **What is this Work? What is happening? What evidence passed or failed? Does it need my decision? What can I safely do next?** Advanced machine details remain inspectable, copyable and source-bound. This is a presentation and interaction correction over existing `Select Work / Work detail / AgentRun transcript`, not a replacement agent runtime.

## Existing owners and non-negotiable constraints

- Reuse the current separate **Chat and Work modules**, existing `AgentTask`, `AgentRun`, `AgentTaskSequence`, ExecutionGrant, CandidateDelta, CandidateValidation, task/sequence state, History, WorkItems and prompt-stack discovery. There is **no second Chat system, Work store, transcript store, runner, approval service, or provider**. Work stays independently selectable and freely supported by existing workbench placements.
- `.dope/agent/runs/<run-id>/transcript.jsonl` and normalized command/events are the durable source for agent-visible history. Existing saved Chat presentation/safe Markdown semantics are shared **only at the renderer/presentation boundary**. Do not introduce a second provider transcript or import Chat authority into Work.
- Keep completion, successful tests, **required full validation**, candidate acceptance/promotion, Git checkpoint, prompt-sequence advancement and **owner qualification** distinct. A completed agent turn does **not** mark required validation, a checkpoint or phase Green. Missing/unrun checks are never Pass.
- Human approvals remain distinct: reviewing an executable prompt stack, starting a Run, accepting an ExecutionGrant, continuing after worktree changes, promoting a candidate, adopting architecture and owner closeout are not interchangeable. Do not auto-Run, auto-resume, auto-accept, bypass a grant, or weaken existing validator and source-drift blocks.
- Preserve verified project identity, source fingerprints, immutable authored prompt order, snapshot/trace provenance, permission boundaries, no unauthorized hosted egress, no secrets/hidden reasoning, strict cancellation and restart semantics. Never mutate project truth from read-only transcript or History views.
- Use restrained Dope Dark styling: neutral charcoal surfaces/controls, subtle separators/focus, orange reserved for primary actions and active emphasis, and semantic error/warning/success colors. Alternative theme support comes from current theme tokens, not hardcoded orange on every surface.

## Work detail — information hierarchy

1. **Stable header:** clear task/Prompt Stack title, direct-vs-stack origin when known, current step `P1 of 3`, independently sourced run/sequence condition and optional provenance disclosure. Avoid repeating title in overlapping tabs or manufacturing progress from incomplete events.
2. **Compact progress:** a readable ordered, fixed authored-step navigator or progress rail, with completed/current/upcoming/blocked and qualification kept meaningfully separate. A step changing the working tree is not automatically marked complete. When no sequence exists, show direct-task status instead of fictional steps.
3. **Contextual decision/recovery surface:** one prominent next action only when backed by a registered, authorized operation; explain the plain-language problem and consequence. Supporting controls are neutral, appropriately disabled when unavailable, and never implied to be successful before the backend confirms.
4. **Current activity and result summary:** human-readable agent outcome, useful file/validation highlights and newest significant event. Machine-only command/tool records appear compact, muted, expandable, and remain ordered/auditable.
5. **Review and details:** candidate file count/diff, approval/grant, validation evidence, exact raw errors/commands, authority, source SHA/fingerprint, Git state and saved transcripts use progressive disclosure. Do not hide a consequential failure in collapsed content with a fake overall success state.
6. **Navigation:** `Select Work` maintains Running, History and Prompt Stack discovery; same-project same-Work focus does not spawn another owner; selecting Work does not steal open editor/roadmap/Chat focus. Explicit Open Transcript uses the existing read-only AgentRun center editor, with distinct Work titles and ordinary close/reopen.

## State-aware action rules

| Observed state | Human-visible meaning | Permitted interaction |
| --- | --- | --- |
| Pending/ready | What will run, exact stack/objective, permissions, source basis | Review stack, separately Start Work and approve any required grant |
| Running | Which task/step is active, meaningful progress and recent action | Inspect evidence; Stop/Cancel only where backend supports it |
| Approval needed | Exact effect, scope, source and consequences | Review; explicitly approve or decline; no approval by navigating |
| Dirty worktree / drift | Which files/basis differ, why continuing may be unsafe | Inspect exact change set; reconcile or explicitly continue **only if** current authority and backend allow; never silently override source drift |
| Validation unavailable | Required validation **not run**, environmental cause if verified | Inspect command, show corrective steps only when supported; re-run the original required check after correction |
| Validation failed | Check ran and failed; distinct from an unavailable check | Read failure, preserve candidate and logs, retry/revise only with supported controls |
| Agent finished; review outstanding | Work execution finished but decision/validation/promotion remains | Inspect diff and required checks; accept/reject separately |
| Completed and qualified | Show exact validated result and explicitly sourced owner qualification, if any | Return to History/Roadmap; no fabricated Green |

In the supplied screenshot, **`worktree-drift` and the missing `tsc` validation evidence are separate problems**. Present both with an intelligible recommendation, preserving exact authoritative status and historical denial. An unavailable compiler or `ENOTCACHED` does not authorize skipping `npm run check`, changing package files, online install, or falsely passing validation. Recovery guidance is informational until the user invokes an existing permissible action.

## Transcript — full formatted text, compact tools

- Use the existing safe Markdown message renderer for *sanitized agent-visible prose*: headings, paragraphs, emphasis, ordered/unordered/task lists, inline code, fenced code blocks with language-aware highlighting, blockquotes, tables, safe links and source references when supported. Preserve whitespace in raw command/output blocks. Handle partial/malformed Markdown gracefully.
- Give readable prose a centered, comfortable document width with generous vertical rhythm, consistent typography and unobtrusive timestamps/metadata. No forced user bubbles, fake assistant dialogue or repeated top-level headers per machine event.
- Preserve command start/end/correlation, precise exit outcomes, output, timestamps and authority attribution as individually distinguishable muted expandable events. Long stdout/stderr is bounded in the initial view but **complete safe durable evidence remains accessible**, subject to existing data retention/normalization; avoid incorrectly merging distinct commands.
- Make transcript scrolling predictable: follow latest only when already near the bottom; indicate new content while scrolled away; include Jump to Latest. Retain useful scroll position on refresh and accessible keyboard operation. Read-only transcript must survive reopening/restart and project switching with no cross-project data leak.
- Apply existing content sanitization/egress constraints **before DOM insertion**. Untrusted Markdown may not execute HTML/scripts, generate remote image/network fetches, expose secrets/provider internals/hidden reasoning, or escalate filesystem/actions through links. Preserve the previously qualified model-image egress denial and adjacent Chat renderer behavior.
- Support empty, live, failed, cancelled, interrupted, recovered and long transcript states. Ordinary text is shown as readable text even if formatting is malformed; diagnostic metadata remains available but subordinate.

## Usability and accessibility

Neutral secondary buttons; restrained primary CTA; consistent line height, spacing, icons and text; narrow panes must wrap/stack without clipping or hiding safety decisions. Keyboard tab order and Enter/Space/Escape behavior must be intentional; focus visible but subdued; tooltips/labels and assistive descriptions identify commands; collapsible sections announce expanded state. Preserve scroll and focus across step change, refresh, restart and Work/Transcript navigation. A readable UI should require fewer unexplained choices, **not fewer approvals**.

## Proposed correction stack — design split, not authored prompts

| Prompt | Bounded scope | Tier / model | Execution |
| --- | --- | --- | --- |
| P1 | Source-truth state adapter and Work status/progress/action hierarchy; no authority changes | T2 / GPT-6 Sol High | Focused tests |
| P2 | Work detail layout, contextual blocked/recovery/grant/candidate review surfaces | T2 / GPT-6 Sol High | Focused tests |
| P3 | Shared safe Markdown AgentRun transcript and collapsed semantic command output | T2 / GPT-6 Sol High | Focused tests |
| P4 | Styling, navigation, accessibility, narrow pane, Work/Transcript scroll/focus | T1/T2 / GPT-6 Sol Medium | Focused tests |
| P5 | Cross-seam regressions: state, source, persistence, authority, no-egress, renderer and history | T2 / GPT-6 Sol High | Focused tests |
| P6 | Manual real browser/available native GUI qualification and scope-bound closeout | T3 / GPT-6 Sol High | **Manual only** |

Prompt authorship is a separate `/prompt-ass -> /prompt-plan -> /prompt-write c11-work-experience` after inspecting exact local product HEAD, dirty worktree and overlap with current Bridge work. P1–P5 target **~8 minutes** each with 15-minute hard cap and bounded focused tests; do not run full checks on every CSS change. P6 is outside automated headless `codex:phase`. The developer's later deliberate Run is the only implementation authorization; **no `/activate` gate**, no self-commit, no version bump merely for these docs. Once executable prompts are written, do not reorder/renumber them in place.

## Source-bound acceptance matrix

| Gate | Required real evidence |
| --- | --- |
| W1 — Discoverability | From Select Work, locate an actual direct Work, Prompt Stack, Running and History entry without duplicate owners/tabs |
| W2 — Accurate status | Distinguish P1/P2/P3, agent completion, validation not run vs failed vs passed, candidate review, sequence block and owner qualification |
| W3 — Failure/recovery | Reproduce drift and missing/unavailable check separately; inspect actual changed files; safe refusal and explicit decision, no bypass |
| W4 — Approval authority | Run/grant/dirty-tree/candidate acceptance remain separate user actions with stale/foreign/permission negatives |
| W5 — Transcript formatting | Real agent Markdown headings/lists/code/tables/links display correctly; commands are muted/collapsible and exact error/output recoverable |
| W6 — Transcript safety | Malicious HTML, image URL, unsafe link, oversized output, secret/provider-internal payload and cross-project negatives fail closed |
| W7 — Persistence/navigation | Existing `transcript.jsonl` reopens after reload/restart; jump-to-latest, scrolled-away behavior, History and multiple Work identities are accurate |
| W8 — Human polish | Work/Transcript in narrow/wide panes, keyboard/screen-reader focus, alternate theme, loading/empty/cancel/failure states show no trapped action |
| W9 — Cross-feature integration | Phase Focus, Bridge D6–D8, WorkItems, candidate/validation, Chat renderer, Roadmap and immutable prompt order remain truthful |
| W10 — Manual qualification | Record exact source SHA/version/dirty state, user steps, screenshots/outcomes and an applicable final-candidate aggregate; distinguish browser from native Electron direct observation |

**Pass criteria:** each supported action must be operated in the real UI on an exact source candidate, including at least one successful Work and one genuinely blocked/failing Work with inspectable evidence. Unit/build passes alone are not UI Green. Independent native Electron operation is recorded if available; if unavailable, record **Evidence Gap** unless the owner explicitly narrows the correction-scope gate, without inventing native parity. Preserve historical Bridge/Phase Focus failures and partial Green labels. These gates qualify at most the Work correction; Phase 11 D1–D8, two materially distinct broad clean Hunts and explicit owner acceptance remain separate.

## Documentation ownership / sync

This approved `/docs-apply` only establishes a contract and adds entries to the Phase 11 plan, issue ledger, usability matrix and existing architecture description. Do **not** rewrite root `ROADMAP.md` or `.dope/roadmap.json` outside their linked Roadmap approval/reconciliation path. No implementation source, tests, prompts, runtime status, existing closeouts or external provider settings are changed.
