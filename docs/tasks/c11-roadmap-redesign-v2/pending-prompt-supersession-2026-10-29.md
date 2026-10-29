# Reviewed P8+ prompt-source supersession — 2026-10-29

**Owner request:** After reporting P7 finished, the owner explicitly asked to update remaining prompts to make the Roadmap the planning control center leading naturally to implementation prompts for the future Pi coding agent.

## Why new filenames are necessary

Current `scripts/codex-phase.mjs` compares each P*.txt file with the bytes from its first Git add commit and stops on changes. The owner authorized changing **unstarted** pending prompts, not rewriting completed prompt history or disabling source drift detection. Therefore:

- Do not edit P1–P7 source bytes or their completed runner commits.
- Remove old **unstarted** active P8–P19 paths from the current tree (still retrievable unchanged from prior Git history).
- Add materially revised, **new filename** prompt files with contiguous P8–P23 numbering and one final P23 closeout. This is a new reviewed first-authored source for each future path; no runner code or source guard bypass.
- Keep P14 `TASK: Correction 11 / P14 — Chrome UI integration qualification` unchanged in title, so its required manually-qualified Git subject remains `c11-roadmap-redesign-v2/P14: Chrome UI integration qualification`. Do not create that commit unless P14 is truly qualified.
- The runner validates the source for each active prompt and resolves completed P1–P7 using original commit subjects. No completed prompt text, title, test or checkpoint is silently reinterpreted.

## Revised functional direction

Existing source: `PlanningMapController` already handles scope approval/WorkItems/stack outline/publish and `launchWorkItem`; `VisualPlanningBackend` and `phase-stack-composer.ts` provide pure WorkItem-to-prompt conversion; `PlanningStackPublication` has source/approval validation. Prior full Planning Bridge GUI had known gaps. Refactor these SAME owners from checkpoint to Gate with explicit links and source/version/criterion traces, not a new prompt subsystem. Keep agent runtime selection provider-neutral; Phase 12 will bundle Pi but is not present today.

## Source/qualification boundary

Initial owner-reported local P1–P7 completion is not independently visible on remote main at time of authoring; do not treat that report as a source SHA. The operator must retain actual local commits and verify runner prefix P1–P7 before continuing. The future P8+ files are unrun, no implementation or Gate qualification claimed. Historical original failed P1 evidence and G3 Chrome gaps remain.

## Superseded historical active paths

Former v2 P8–P19 paths, as first authored before this decision:

```text
P8-gate-markdown-import.txt
P9-linked-document-roundtrip.txt
P10-greenfield-gate-drafts.txt
P11-chat-roadmap-semantics.txt
P12-phase-canvas-layout.txt
P13-gate-foldout-inspector.txt
P14-chrome-ui-qualification.txt
P15-status-corrections-dependencies.txt
P16-gate-dope-help.txt
P17-remove-legacy-domain.txt
P18-cross-seam-integration.txt
P19-independent-closeout.txt
```

Current authoritative future paths are enumerated in the README. Removing their old active names does not delete Git history or assert that any of them passed.
