# /prompt-ass — c12-docs-workflow

**Date:** 2026-10-30 (America/Chicago). **Status:** ASSESSED / AUTHORED ONLY — NOT RUN OR QUALIFIED. **Product:** `0.12.7` unchanged. **Runtime source:** `c01711345ba3d83900b20242948abdabaeeeb6ac`. **Current documentation amendment basis:** `ed95e29aee95dc2c7f2c901be4294d1573c534ca`.

[Contract](../../planning/p12/documentation-workflow-contract.md) · [ADR 0041](../../decisions/0041-planning-documentation-workflow-and-applied-history.md) · [Plan](implementation-plan.md)

## Goal and owner correction

Deliver the existing Planning Chat → reviewed canonical-document update → verified applied-only History route, then help coding agents find and read relevant requirements without the user repeating them. Only actual retained document effects produce documentation-change entries; review, approval-only, no-op, failed-zero and rejected/cancelled attempts with no retained effects remain excluded. Partial retained publication stays truthful.

The owner corrected the earlier assumption that Work should receive an extracted requirements packet. That approach would force body content into prompts, create preparation/state coupling and risk slower responses. The revised design offers compact task-relevant references from existing metadata and lets the selected agent request source reads and manage its own context. No new Dope selector/summarizer inference, corpus index/cache, body prefill, per-call scans or replacement compaction system is justified.

Explicit document review/apply still needs actual target bytes and exact verified effects. This is separate from routine Work/Chat context: a user requesting a concrete document change permits focused source reading, not automatic loading of the documentation corpus on unrelated turns. The first release remains eligible create/update; current documents are canonical, while proposal/journal/original-diff records are operational evidence.

## Inspected source and implications

These findings are from the pinned runtime source, including additional read-only inspection of the native adapters and their tests. They describe existing seams and gaps; they do not claim the new feature is implemented.

| Source | Observed behavior | Design consequence |
| --- | --- | --- |
| `chat-project-grounder.ts` | Bounded read/list/search, canonical/project boundary checks, protected names, source hashes and omissions. | Reuse approved metadata/read adapters. Do not import the whole Theia grounder into the domain or scan all docs to invent metadata. |
| `chat/src/service.ts`, `chat-backend.ts`, `chat-context-composer.ts` | Saved Chat, model/lease/context and proposal routing already exist. | Explicit review reads exact targets. Ordinary turns add no corpus composer or auxiliary documentation model pass. Account for replayed saved context before offering another hint. |
| `roadmap-store.ts` | Current `previewGateDocumentPatch`, `publishGateDocumentPatch`, `recoverGateDocumentPatch` own linked schema-2 Markdown and revision/recovery. | Keep the linked writer authoritative; accepted structured draft without Markdown effects is not document application. |
| `roadmap-gate-document.ts`, `roadmap-document-patch.ts` | Exact source/section validation, guarded formatting-preserving publication and byte identities. | Reuse appropriate safe patterns; no duplicate writer, legacy checkpoint semantics or false cross-store atomicity. |
| `contracts/src/history.ts`, History backend/metadata/work-Git sources | History deduplicates owner source IDs; ordinary Chat and Work already have chronology. | Project verified documentation applications only, with one stable ID and original diff; do not manufacture generic Work entries for reviews. |
| History widget/navigation | Existing right-panel owner navigation and async project/staleness checks. | Reuse ordinary editor/diff surfaces and preserve original evidence after source changes. |
| `AgentRuntimeBackend.createTask/launchWorkItem/prepareSequenceTask` | Direct, WorkItem and stack inputs have established task/source ownership; WorkItem launch keys are idempotent. | Optional advisory refs should not replace the original task or grant. Prefer ancillary provenance where practical. |
| `prepareSequenceTask`, `AgentStore.createTask/updateSequence` | Stable step IDs, full candidate JSON equality, saved-task overwrite rejection and a guarded current task link. | New advisory metadata must not cause identity churn. Repeated preparation preserves saved optional fields; later offers are separate observations. Never relax equality for substantive instructions/scope/grants. Actual accepted-basis replacement needs the narrow existing-owner transition. |
| `agent-core/src/contracts.ts`, `sequence.ts`, phase-stack composer | Strict schemas and an original instruction limit of 20,000 characters; parsed prompt source is explicit. | No larger body packet, forced migration, first-authored-byte lock or core → contracts/project-intelligence reverse import. |
| `agent-execution-runtime.ts` | Objective/instructions become the common request; capacity continuation is sequence-only and prefixes the existing request. | Add only relevant small refs at a supported handoff. A retry request already containing its hint must not get a second notice. Preserve current task/run/workspace/grant and orphan interruption. |
| `backend-module.ts` | Work currently registers Codex and Pi local adapters. | Do not assume a universal Pi API or revive the historical local turn-loop as a new context platform. |
| `codex-agent-execution.ts` | Isolated App Server/candidate sandbox, `project_doc_max_bytes = 0`, native shell commands, no dynamic/MCP tools, exact selected model. | Keep native project retrieval and automatic body-loading prohibition. References require no provider fallback or new tool authority. |
| Codex event normalization | Bounded command/output, message and file-change observations; no complete per-document-read receipt or token-usage forwarding is established here. | Expose observed/unknown accurately. Do not fabricate exact access/token counters, force preloading or block ordinary Work solely for missing telemetry. |
| `local-tool-contracts.ts`, `local-tool-broker.ts` | `read(path,maxBytes)` reads an initial prefix, bounded to 32,768 bytes, under grant/candidate/sandbox/private-path/symlink checks. No range/continuation selector exists. | P12 needs a narrowly scoped safe continuation/range path for later requirements; preserve all existing authority checks. |
| `pi-work-execution.ts` | Existing `dope_read`/`dope_list` route through that broker. Model-facing results use `safe(output,1024)`, flatten formatting and omit the broker truncation flag. Initial prompt plus execution reference is capped at 32,000 bytes. | A valid pointer can currently hide a later section. Repair the existing return/read path with format-preserving bounded content and honest continuation; do not compensate with prompt preloading or globally apply the Pi bound. |
| `pi-runtime/worker.mjs` | Isolated resources/agent files; native session history with a Dope exact-dedup compaction hook, limited output and overflow-retry rejection. Work sessions are consumed per host; a new retry host is not persistent native memory. | Preserve existing context/overflow/cancellation semantics. Let the agent reason over requested reads; do not promise general native semantic summarization or redesign compaction. |
| `ChatPanelWidget` Work detail / `WorkSelectionController` | Task instructions, model/provenance and diagnostics already share the existing Work surface. | P11 adds a small offered/access/unknown disclosure, not a context-body panel or new workspace. |

`local-tool-broker-read.test.ts` imports compiled core and verifies the real candidate/sandbox boundary. `pi-work-execution.test.ts` imports both the compiled adapter and actual worker dispatch, so the required read bridge can be exercised without another all-worker suite at T1. Existing sequence-persistence and execution-runtime tests remain the meaningful linkage/retry/candidate/restart companions.

## Reference and evidence decisions

References contain a relative path, known section/role, applicability reason and source/version information already available from current owners. Unknown values remain unknown. Discovery does not read/hash whole files just to populate them. Explicit required references and failed discovery remain distinguishable from a successful no-applicable-reference result.

Offer a short hint only at the next existing relevant handoff or explicit steering boundary. It must be absent from the incoming/restored context before another copy is added. Saved Chat may recreate a native host for each request; that does not justify appending the same notice every turn. A capacity retry may carry the original hint already; retain it once. Normal native transcript replay is ordinary context management, not duplicate Dope injection. No unsolicited mid-run pointer delta is allowed.

Keep three evidence states separate: **offered**, **observably read**, and **followed in actual code/validation**. A reference is not proof that content reached the model; access is not adoption of every document statement. Agent output alone cannot certify reading. Where native observations are incomplete, show unknowns. The decisive live fixture places its requirement beyond 1,024 characters and omits it from the task/hint, so a prefix-only or fabricated-read implementation cannot pass.

Only a requirement actually bound to an accepted task/WorkItem/preparation participates in P13 conflict handling. Unread hints, metadata/index changes and read observations alone cannot trigger a new task identity, grant reset or review. Material actual bound changes retain the reviewed immutable-preparation transition; independent Git/source/dirty-basis protections remain intact.

## Preserved WC1–WC4 gates

The earlier owner-requested compatibility amendment remains mandatory within DW7/DW8/DW10, refined for references rather than body packets.

| Case | Revised proof |
| --- | --- |
| WC1 | No applicable refs means unchanged original prompt, no hint bytes, no feature-initiated document-content prefetch and no auxiliary Dope model call. Independent native agent reads remain permitted and measured separately. Required missing/inaccessible evidence is not disguised as empty. |
| WC2 | Otherwise valid legacy direct/WorkItem/stack tasks keep current supported run/retry/resume/new-launch paths and grants. Advisory fields do not trip whole-task equality. Actual accepted-basis replacement preserves previous tasks/runs/checkpoints and correctly binds the new task/grant. |
| WC3 | Unread reference/index/read metadata changes do not adopt requirements. Unrelated files, unchanged bound sections and demonstrably nonsemantic formatting create no documentation-specific approval loop. Material/ambiguous actual bound conflicts get targeted resolution with true provenance. |
| WC4 | Ordinary tools, validation, candidate Accept/Reject, cancellation and supported continuation work with empty/relevant refs. Agent-issued late-section reads lead to correct real code. Structural overhead controls and matched responsiveness evidence protect the current experience. |

Keep one run per WorkItem task and its original launch-key mapping; another attempt uses the current new-launch path. Sequence capacity retries keep the same task/run/workspace/grant and one continuation prefix. Restart keeps orphan running/cancelling work interrupted; no automatic resume. Invalid or unapproved tasks remain invalid. These are qualification cases, not new runtime approvals or an activation ceremony.

## Responsiveness and cost acceptance

The user correction requires more than a smaller nominal prompt. T1/T2 must assert no body prefill, selector/summarizer inference, per-call scans or repeated notice injection, including restored Chat/retry inputs. In no-reference controls, count only feature-added work: zero added doc prompt bytes, forced/prefetched content reads and auxiliary Dope model calls. Independent native investigation and its normal history handling remain allowed.

P14/P15 compare matched no-ref, offered-but-unused and useful-read tasks on the same selected model/configuration. Record discovery/preparation time, hint/tool-return bytes, tokens when provider-reported, native versus auxiliary calls, first response/action and total time. Codex may lack exact native call/token/read telemetry; that is an evidence limitation, not permission to invent numbers or substitute Dope preloading.

Necessary retrieval and native context handling can add cost. No numerical SLO or zero-wallclock guarantee is invented. Measurements alone do not earn PASS: repeatable material responsiveness degradation unexplained by deliberate agent-requested reading or measured run/model variability stays FAIL/EVIDENCE GAP until repaired or explicitly dispositioned. Use bounded matched repeat controls where a concrete uncertainty remains. Do not add a benchmark/cache/index platform.

## Decomposition, model choice and feasibility

Keep P1–P15. P1 owns cheap reference discovery; P2–P6 exact proposal/application effects; P7/P8 existing Chat; P9/P10 History; P11 optional reference/provenance and small disclosure; P12 native hint/read integration; P13 actual accepted-basis conflict transitions. P14 owns the full compatibility/performance-counter matrix and P15 real model/browser/native evidence.

Sol Medium remains appropriate for P1 metadata selection with existing authority, P8 UI, P9 projection and P10 navigation. Sol High remains for P2–P7 durable/authority work, P11–P13 Work/native-read/state boundaries, P14 integration and P15 live diagnosis. No XHigh/Terra escalation is introduced.

Ordinary implementation retains the <=8-minute target, 10-minute soft ceiling and 15-minute hard limit. **P12 is the main feasibility risk:** the necessary read correction crosses the existing core broker/contract, worker schema and extension bridge. Moving disclosure to P11 and keeping only that read path/session handoff in P12 narrows it; no compaction, indexing, generic receipts or platform work is included. Its security/truncation/late-section checks cannot be deferred until unsafe execution advances. If the actual implementation still exceeds the bounded slice, stop/report the exact remaining read integration and needed split rather than silently expanding scope or claiming the target was met. P13 retains its existing narrowly guarded owner transition; it does not become a migration service.

P14 is dedicated T2 and P15 sole manual T3; their assigned broader evidence may exceed ordinary implementation timing. Real execution durations remain unmeasured.

## Build and efficiency audit

Existing runtime tests import compiled `lib/`. Contracts depends on AI and agent-core; project-intelligence depends on contracts. Build missing/stale upstream prerequisites once, including AI/agent-core before cold P1 contracts. Rebuild only changed owners before focused tests. P12 requires core then extension; the installed pinned Pi worker is loaded directly from `.mjs`. The plan records exact commands and the single added broker-read companion.

The final `npm run check` already nests typecheck, tests and browser/Electron builds. P15 invokes it once, then packages existing Electron output with the app workspace's `package:linux`, which performs established Pi preparation/check/AppImage verification without another app build. Repairs repeat only invalidated evidence.

**Prompt Efficiency Gate:** the revised responsibilities, model choices, focused commands and T2/T3 allocation are reviewed, with the explicit P12 feasibility risk above. No timing or product gate is claimed passed.

- One bounded responsibility per ordinary prompt; P11's small disclosure keeps P12 focused on usable authorized references.
- No new prompt, test file family, corpus infrastructure, body snapshot, native compaction redesign, extra activation or provider fallback.
- Existing planned tests gain parameterized cases. P12 adds only the directly affected broker-read companion; lifecycle/state/provider permutations remain P14.
- Empty-path and replay-dedup negatives run at the introducing seam; real read-to-code behavior and actual response cost remain P15.
- Existing UI tokens, neutral controls, keyboard/narrow behavior and copy/drag semantics remain; observed/unknown labels prevent false context claims.
- Contiguous Correction 12 P1–P15, unchanged `0.12.7`, sole Browser-required P15, no self-commit and no authoring-as-implementation.

Amendment authoring verification: `npm run codex:phase:validate -- c12-docs-workflow` returned VALID for P1–P15 at unchanged `0.12.7`, with sole Browser-required P15. A baseline comparison found exactly the ten assigned task/support files changed; model labels, numbering and version remain unchanged. Relative links, final newlines, whitespace and the exact P14-command match with this plan passed. No positive body-prefill/source-packet mandate remains in the amended files. Earlier authoring passes remain historical documentation evidence only; these checks do not prove WC/DW behavior, response performance or product Green. No product code, product tests or implementation prompts were executed.

## Deferrals

Ambient rewriting/drift scans, every-editor-save History, file delete/rename, generic prompt publication, new indexes/caches, precomputed corpus summaries, extra context agents, a universal read-receipt platform, compaction redesign, broader Architecture adoption and all-Phase12 qualification remain deferred. Safe bounded read continuation is included solely because the current local prefix path cannot reliably expose relevant later sections. Pending executable-prompt edits stay in their existing reviewed path.
