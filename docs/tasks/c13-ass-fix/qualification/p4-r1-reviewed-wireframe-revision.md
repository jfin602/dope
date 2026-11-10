# P4-R1 reviewed Assessment wireframe revision

**Date:** 2026-11-10. **Verdict:** **SCOPED PASS for the P4-R1 headless correction.** The protected same-draft revision, owner review, atomic Assessment replacement, Plan/proposal invalidation, and deterministic real-worker regeneration pass on this local source. Native browser interaction and live-model behavior remain **UNOBSERVED**; this is not P5, Work, Gate, Phase, or product GREEN.

## Source and preservation

- Entry HEAD: `7d4f61ce5313f92ac93d36ee8be51b774d4d763d` (`p4`, `main`). Entry tracked worktree was clean. The owner's untracked `docs/tasks/c13-ass-fix/qualification/p5-manual-live-authoring.md` was already present and was not modified.
- Product version remains `0.13.11`. No dependency, manifest, lockfile, runner prompt, historical P4/P5 report, canonical task file, Work state, or Roadmap state was changed. No reset, stash, clean, commit, browser run, LM Studio inference, or publication occurred in this correction.
- Changed production files: `packages/chat/src/index.ts`, `packages/chat/src/service.ts`, `packages/theia-extension/src/browser/chat-panel-controller.ts`, `chat-panel-presentation.ts`, `chat-panel-widget.ts`, `dope.css`, and `packages/theia-extension/src/node/chat-backend.ts`, `incremental-assessment.ts`, `prompt-authoring-stage.ts`, `prompt-draft-store.ts`.
- Changed tests: `test/unit/chat-panel.test.ts`, `chat-presentation.test.ts`, `prompt-authoring-stage.test.ts`, `prompt-draft-store.test.ts`; added `prompt-revision-headless.test.ts`. This report is the only added documentation file.

## Trusted entry and review

The completed Prompt Stack Draft card offers **Revise wireframe** while its Assessment is editable. It fills `/prompt-ass <original-slug> ` and a typed Assessment chip, focuses the normal Chat composer, and does not submit. The card exposes the checked count and an expandable ordered task division. Pending revisions show **Accept revision** and **Reject revision**, with the candidate's rendered wireframe in the originating Chat response. Ordinary semantic buttons and the native disclosure retain keyboard focus and theme tokens; actual narrow-panel/browser behavior awaits P5.

Fresh `/prompt-ass` retains duplicate-name rejection. Revision requires a fresh protected invocation, exact slug, typed revision purpose, original draft/owner user ID, selected accepted Assessment message and stage revision, project ID, source fingerprint, and Chat lease. The backend rechecks the saved draft and source. Quoted commands, guessed names, wrong chips and stale stage revisions do not grant this path. The current accepted Assessment and Plan remain authoritative while the candidate is pending.

The real worker uses the existing bounded wireframe validator. In revision mode, `assessment_stage` and `assessment_finish` produce a candidate from the prior accepted wireframe plus owner instructions; there is no direct replacement. The candidate is saved under the same draft identity with its base Assessment hash/revision, checked source refs, content digest and Chat message ID. No canonical files are written. A failed or cancelled turn does not change the accepted stages; an orphaned candidate from an interrupted turn can be discarded on a new authorized revision attempt.

## Acceptance and invalidation

Explicit Accept verifies the pending Chat review, exact digest, original draft/owner, current lease, source basis, current Assessment revision, candidate bytes and broker-read refs again. One draft-store transaction preserves the previous Assessment and Plan in history, promotes the checked candidate to Assessment revision 2, and removes the dependent Plan. The original slug and draft ID remain unchanged. The card then says **Assessment revised · Plan needs updating** and offers the normal checked `/prompt-plan` chip. Reject removes only the pending candidate and retains the prior accepted Assessment, Plan and Prompt Stack proposal. A repeated Accept is denied; an uncertain Chat receipt write can be retried against the promoted digest without a second replacement.

Old Plan chips fail after acceptance. The earlier Prompt Stack proposal becomes stale through its saved Plan identity and cannot publish. Accepted canonical prompt files would block a new draft-stage transaction, so revision cannot rewrite a published/executed snapshot. Source drift marks a pending review stale with a diagnostic rather than replacing the coherent prior state.

## Verification

| Check | Result |
| --- | --- |
| `@dope/chat` build | PASS |
| `@dope/theia-extension` build | PASS |
| Consolidated affected matrix: Assessment worker/store/stage, Chat backend/panel/presentation, Pi runtime, incremental proposal/stack, publication and both real-worker chains | **200/200 PASS** |
| Final directly affected rerun after recovery edits | **95/95 PASS** |
| `git diff --check` | PASS |

The new real-worker fixture uses the bundled Pi worker, real protected Chat broker, saved `PromptDraftStore`, deterministic OpenAI-compatible endpoint, current incremental proposal controller and guarded publisher inspection. It executes Assessment v1 (**three** work prompts) → Plan v1 → Prompt Stack proposal v1 → selected `/prompt-ass` revision → staged **four**-prompt candidate → explicit Accept → Plan v1/proposal v1 stale → Plan v2 → Prompt Stack proposal v2. Before Accept, the saved Assessment still has three prompts and Plan v1 remains current. After Accept, the same draft has Assessment revision 2, prior stages in history, no current Plan, and proposal v1 cannot publish. Proposal v2 contains four ordered work prompts and one separate manual closeout; its five prompt files and supporting files remain noncanonical. A further five-prompt candidate is rejected, leaving Assessment v2, Plan v2 and proposal v2 applicable.

Focused negatives reject fresh duplicate slug, forged draft ID, wrong project/owner/lease, stale stage revision/digest, source drift, conflicting or invalid candidate, repeated Accept, old Plan chip, old proposal publication, canonical-folder collision, and unreviewed or incomplete stage input. The store test verifies reject, source-drift no-write, exact history and same identity. Card/controller tests verify prefill without send, typed chip, pending review and decision dispatch. Existing validator/publisher suites cover dependency graph, oversized wireframe, unsupported source claim, cancellation, path/symlink and publication guards. No test claims a native mouse, touch, narrow viewport or live-model observation.

## Remaining checkpoint

The historical P4 report remains **PARTIAL / NOT GREEN** as a dated result on its earlier source. This P4-R1 report establishes a passing headless correction on the present local diff; it does not rewrite that evidence. The existing P5 preflight-stop report also remains untouched. P5 can be deliberately resumed as the separate manual connected-browser checkpoint on an exact served build to verify the card, chips, live model, saved reload, theme/keyboard/narrow behavior and guarded owner publication. P5 was not started here.
