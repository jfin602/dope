# Phase 11 — Roadmap and Chat Usability Recovery Contract

**Date:** 2026-10-16. **Approval:** Owner /docs-review followed by /docs-apply.
**Status:** APPROVED DOCUMENTATION / 0.11.0 VERSION-ONLY BASELINE / NO PHASE 11 IMPLEMENTATION, RUN, OR QUALIFICATION.
**Authority:** [ADR 0037](../../decisions/0037-human-centered-ui-and-usability.md), [Phase 11 plan](phase-11-plan.md), [preliminary panel matrix](panel-usability-matrix.md), ADR 0036 for Roadmap/ProjectPlanningActions, ADRs 0025/0030 for Chat. Phase 10 last directly qualified source remains 0.10.16 / af2b0f0 within R6 approved limits.

## Report and evidence

The owner-provided Firelaunch screenshot shows a wrongly selected mvp-roadmap.md link, a Roadmap Markdown button with no apparent path to relink, and a planning Chat no-action JSON response containing a useful message that is visually buried. The follow-up explanation addresses read-only objective editing rather than explaining how to change the Roadmap source. The still image also shows Loading Roadmap, a duplicated/truncated correction title, many icon controls and verbose transcript metadata.

These are reported/screenshot observations, not exact-source reproduction. A still image does NOT prove that loading is permanently stuck. Phase 11 must gather live evidence and honestly retain Not Green/Evidence Gap where necessary.

## A. Safe Roadmap relinking — P0

1. The existing Roadmap Markdown control exposes the current linked path/status and a discoverable **Change linked file** action. It must also support the initial unlinked-file selection flow.
2. Show a preview of old/new path, source parse compatibility, the active Roadmap fields that will change and unsynchronized edits. Explicit warning: **Replacing the active project Roadmap does not delete the previous Markdown file on disk.** Acknowledge the replacement only after explicit human confirmation; do not silently discard uncommitted edits.
3. Preflight authorized workspace/project path, file existence/access, schema and round-trip ability. Capture project identity, expected Roadmap revision and both source fingerprints; on cancel, invalid Markdown, missing file, stale edits, rejected ownership, interrupted import or failed preflight, keep the previous active Roadmap and link unchanged. Expose a non-destructive recovery path, including cancel/preserve/export for unsynced edits.
4. Commit the new active state and linked source using existing deterministic Dope-owned adapter/authority. If multiple stores cannot be committed atomically, use durable journal/recovery and do not claim success until the active pointer, revision and projection agree. Never let a model bypass this via direct filesystem or shell edits.
5. Rebind watchers and bidirectional Markdown reconciliation to the new source ONLY; release the old subscription, preserve the original Markdown bytes and persist correctly across restart. A later external edit to the new source must still be detected and reconciled safely. No cross-project link leak, phantom checkpoint ID remap or silent import-as-Green; preserve independent historical gate and evidence truth.
6. A human must accomplish the replacement with no model connected. Chat may explain the real Markdown path even if its allowed planning actions cannot relink directly.

## B. Human-readable planning outcomes — P0

1. Reuse ChatPanelWidget, ChatPanelController, ChatService, saved Chats, normal context-composition and provider/permission pathways. No second Roadmap-specific chat runtime, model selection mode or transcript store.
2. At the typed planning-result presentation boundary, a validated user-directed result message is normal assistant prose even when the action type is **no-action**. Show the message prominently unless an existing assistant turn has already clearly conveyed it. No bare JSON as the sole answer, no duplicate summary, and no imagined successful write.
3. Clearly distinguish **nothing changed**, **proposal**, **approved/committed**, **denied**, **stale**, **cancelled**, and **error**. Rendering untrusted result text must use the normal safe Markdown/escaping flow; never execute HTML or assume action authority from a model JSON claim.
4. Place raw structured tool results, model/turn IDs, timing and provenance in one compact, muted, truncated, click/keyboard-expandable activity entry with inspect/copy JSON. Keep the transcript conversation-first even in narrow, right, bottom and center Chat placements and after restart.
5. Use truthful lightweight in-flight progress only where existing events permit, without expensive extra model turns. A completed turn ends with an accurate natural-language outcome and a pertinent next action/question where useful.

## C. Capability-grounded Dope guidance — P0

1. When asked for an unsupported or blocked operation, the assistant should state what it can and cannot do through the **current Chat action**, why, and how to complete the intended goal using an **actually available** Dope feature. Avoid an unrelated clarifying question when the user's task is clear.
2. Use a small versioned, testable capability/help inventory sourced from real registered routes/commands, with navigation, prerequisites, permission, available action and recovery guidance. Retrieve only relevant entries into normal Chat grounding. This is informational, not a new agent tool/permission registry or duplicate chat architecture.
3. Validate source/project and UI availability before recommending a route; never fabricate controls or claim changes it did not perform. If no supported alternative exists, say so candidly and offer only a genuine fallback such as filing an issue or exporting preserved data.
4. Preserve manually usable no-model UI, selected local Q4 capacity, bounded compact context, Codex/hosted contextual consent, provider provenance and no silent hosted fallback. Guidance may not escalate an ordinary planning Chat to Work/Agent shell/filesystem powers or switch the selected/global model.

## D. Secondary GUI recovery and readability — investigation

Directly test the Loading Roadmap indicator before assuming a stuck loader. Investigate correction-overlay duplicate/title wrapping, toolbar tooltip/label/focus density, excessive technical Chat metadata, Follow Interactive explanation, empty/error/blocked/retry feedback and narrow-pane/keyboard operation. Apply the smallest verified improvements with existing restrained dark theme tokens, non-color cues and Theia placement; no wholesale theme rewrite.

## E. P11 acceptance and sequence

| Gate | Required source-bound direct evidence |
| --- | --- |
| U1 | Wrong Roadmap -> Markdown -> Change linked file -> replacement preview -> correct new map on confirm |
| U2 | Cancel/invalid/missing/stale/import-fail leave original link/map and unsynced edits safe |
| U3 | Restart, external edit/new-source reconcile, old source unchanged, project isolation |
| U4 | Local planning no-action message visible as honest main assistant reply, no duplicated narrative |
| U5 | Structured activity collapsed but expandable/copyable, persisted and keyboard/narrow accessible |
| U6 | Chat explains how to relink and other unsupported actions with truthful verified Dope workflows |
| U7 | Explicit local Q4 and Codex-backed selections produce grounded guidance without provider/consent/default changes |
| U8 | Live loading/empty/error/overlays/toolbars/Follow/focus/narrow-pane paths are tested and dispositioned |
| U9 | Phase 10 authority, historical status, revision safety, linked Markdown and saved Chat single-owner regression tests |

**Updated sequencing:** A/B/C above are the **initial known-issue repair tranche**, with U1–U9 as scoped regression gates, not the full Phase 11 exit matrix. D-style visual investigations recur after direct reproduction; E-style verification follows each change. Then run the [manual Hunter](../../tasks/p11/usability-hunt-manual.md), [deduplicated issue triage](usability-issue-ledger.md), small separately authorized repairs and real GUI verification, repeatedly and on different under-covered tasks per [the Phase 11 plan](phase-11-plan.md). No fixed number of loops, source edits by a hunt or Green claim without complete observed coverage and owner signoff.

**Non-goals:** No product code now, no Phase 10 rerun/retroactive Green claim, no Phase 12 activation, no global model changes, no extra process/network permission, no new chat system, no P11 version bump or qualification implied by these docs.
