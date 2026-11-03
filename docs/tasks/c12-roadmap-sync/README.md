# c12-roadmap-sync — Native Roadmap authoring, granular approval, automatic Markdown and formal Undo/Redo

**Owner authorization:** 2026-11-02 America/Chicago, /prompt-ass + /prompt-plan + /prompt-write. **State:** RUNNER PROMPTS AUTHORED ONLY — product work not executed, not qualified, no package/version/model change. Baseline reference 0.12.7; operator must inspect actual LOCAL checkout. **Architecture:** [ADR 0047](../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md), [native authoring contract](../../planning/p12/native-roadmap-authoring-contract.md), [ADR 0046](../../decisions/0046-roadmap-revision-navigation-and-restore.md), [historical restore contract](../../planning/p12/roadmap-revision-navigation-and-restore.md). [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md).

This is the **one executable successor** to the design-only [c12-roadmap-native-authoring](../c12-roadmap-native-authoring/README.md) R1–R5 and **integrates** the separately authored [c12-undo](../c12-undo/README.md) P1–P4. Do not run those two overlapping sets in parallel or re-run completed source work. Reuse verified current implementations and qualification evidence; preserve all older prompt bytes/results and historical NOT GREEN.

## User outcome
- Chat/Pi produces real versioned Phase → Gate → Criterion/Correction objects through authorized staged tools, never by parsing saved assistant prose. The complete tower-defense outline must survive proposal preview, selective approval, canvas, reload, and linked Markdown with stable IDs.
- Direct Roadmap canvas editing via small pencil controls; one existing Chat proposal card and provisional canvas share backend authority. **Apply/Reject one, Phase group, selected subset, or all remaining** with dependency and revision protection.
- The only normal Markdown interaction is first destination selection/confirmation. Every later successful canonical change requests automatic safe source sync with truthful pending/conflict/recovery status.
- Permanent icon-only **Undo / Redo** navigate *verified historical snapshots without writing*. Compare + explicitly Confirm Restore creates a **new monotonic head** with editable structure, source safety, evidence/qualification protection, and one receipt. No destructive Ctrl+Z takeover or second writer.
- Phase/Gate planning state and real GREEN qualification stay separate. Preserve user-owned files, Work/Chat history, owner permission boundaries, and active Roadmap visual grammar.

## Runner stack (strict order)

| Prompt | Mode | Qualified result |
| --- | --- | --- |
| [P1](P1-native-tool-staging.txt) | Runner | Protected Pi broker read/stage/cancel; versioned objects, safe leases |
| [P2](P2-draft-validation-preview.txt) | Runner | Bounded complete draft, exact validated Chat/canvas preview, no response parser |
| [P3](P3-granular-transactions.txt) | Runner | Individual/Phase/selected/all-remaining decisions, atomic subset and retry |
| [P4](P4-durable-revision-archive.txt) | Runner | Verified immutable baseline + all subsequent writer revisions |
| [P5](P5-initial-link-auto-sync.txt) | Runner | Single file choice, checked asynchronous sync, crash/conflict recovery |
| [P6](P6-canvas-inline-editor.txt) | Runner | Pencil editing + same-authority canvas review; form retired after parity |
| [P7](P7-undo-redo-historical-view.txt) | Runner | Permanent toolbar; read-only historical preview/compare |
| [P8](P8-reviewed-restore.txt) | Runner | Approved new-head restore and linked-source/evidence safety |
| [P9](P9-integration-regressions.txt) | Runner | Final-source cross-component tests, cleanup, explicit unresolved blockers |
| [P10](P10-codex-browser-qual-loop.txt) | **MANUAL connected Codex Chrome** | Up to 3 targeted repair/requal cycles, final exact-source PASS/NOT GREEN |

**Runner commands (only after owner elects Run):**
\`\`\`bash
npm run codex:phase:validate -- c12-roadmap-sync
npm run codex:phase -- c12-roadmap-sync
\`\`\`
Run P1–P9 via the runner, then **STOP before P10**. Do not use \`--closeout\` or manufacture a P10 PASS marker. P10 is manually executed using the connected Codex Google Chrome browser, with up to three narrowly scoped observed-defect repair/requal cycles. Runner owns its passing implementation commits; prompts do not self-commit. If validation rejects metadata or manual boundary, fix the new *unstarted* stack contract first, not the runner implementation to bypass safety.

## Universal safety, execution and reporting
Read BOOT.md, AGENTS.md, docs/workflow.md, current local source, assessment and plan at every entry. Verify \`git status --short\`, \`git rev-parse HEAD\`, active branch/version, in-flight source, actual connected app state, existing documentation implementation, tests and qualification evidence. Never assume remote GitHub main equals the local owner's working tree. No reset/stash/clean, force push, touching owner's persistent tower-defense workspace, provider/model/lockfile/version change, unauthorized shell, startup auto-write, or bypass of /roadmap/Ask/Allow/approval/source hash/lease/project boundaries. Use disposable projects. Each runner Pn is a bounded focused step (target <=8 minutes, hard 15-minute stop per cycle); if mandatory work cannot safely fit, STOP NOT GREEN with exact smallest remaining repair, not partial fake PASS. Do not start Pn+1 after failure.

Every prompt reports exact HEAD/diff, files touched, real test counts and failures, source hash/fixture names, write/no-write proof, remaining risks and scoped disposition. Only actual effects enter Project History. Browser builds are not native GUI evidence; owner-native Electron is a separate observation/gap. No automatic Phase 12 Green, version bump, old evidence rewrite or full-product closeout by this correction.

## Qualification owner boundary
The final browser loop must operate the *real connected Codex Chrome* against exact built source; verify the stable project graph, granular Apply/Reject, direct inline inputs, linked Markdown, durable Undo/Redo/restore, interruptions, security negatives and model availability. If live local model or owner-native is unavailable, record precisely which mandatory case is an **EVIDENCE GAP**; no simulated evidence passes as live. Preserve original c12-undo and c12-roadmap-publish-ux records as historical truth.
