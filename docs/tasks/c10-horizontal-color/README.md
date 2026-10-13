# c10-horizontal-color — Horizontal Roadmap progression and completion color

**Status (2026-10-13): DOCS APPLIED / ASSESSMENT + PLAN + PROMPTS AUTHORED; IMPLEMENTATION NOT EXECUTED; PRODUCT NOT QUALIFIED.**
**Scope:** bounded Phase 10 presentation correction before the existing manual qualification matrix.
**Required unchanged version:** `0.10.16` across all 13 manifests and 20 internal pins.
**Entry authority:** current ADR 0036, ADR 0016 theme, ADR 0037 usability, Phase 10 plan, current `c10-roadmap-qualify` P1–P8 implemented baseline. Reconcile actual local HEAD, Git ancestry, package versions, worktree and open manual evidence before execution; GitHub authoring HEAD 0882f8551877bd6db1653508954dfc8da1ecc886 is not an assertion about local HEAD.

## Product outcome

The Roadmap main progression is left-to-right in phase/checkpoint order. Corrections and failed qualification work branch above the path; supporting task stacks, prompt groups and evidence branch below it. The existing React Flow canvas keeps zoom/pan, Fit/Focus, Arrange-only drag, the in-place inspector and one freely dockable saved ChatPanel. The semantic graph, linked Markdown owner, checked mutation approval and historical status evidence never change merely because a node is moved or tinted.

Automatic status colors reflect the six *existing* authoritative Roadmap statuses: Green (muted green), Active (restrained orange), Not Green (muted red), Waived (distinct muted violet), Not implemented (neutral gray), Unknown (muted neutral). Noncolor icon/text/shape cues are mandatory. Waived/owner-closed-for-sequencing is NOT Green; a completed task stack is NOT proof of phase qualification. Color-only progress cannot invent status, status persistence, canonical edges or percentage completion. Visual paths may appear completed only where underlying endpoint/edge evidence truly warrants it.

## Prompt stack

| Prompt | Bounded responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1](P1-horizontal-roadmap-layout.txt) | Horizontal primary path, vertical non-overlapping branches, edge/keyboard direction, legacy viewport migration | T2 | GPT-6 Sol High | no |
| [P2](P2-qualification-color-grammar.txt) | Six-state theme-derived node/edge colors and noncolor accessibility | T1 | GPT-6 Sol Medium | no |
| [P3](P3-presentation-implementation-closeout.txt) | Focused integration and implementation-only handoff to existing manual qualification | T2 | GPT-6 Sol Medium | no |

Exactly one final root P3 closeout. P1–P3 belong to the existing correction runner grammar; no separate `/activate` gate. No new manual browser prompts or second qualification matrix. After implementation, `docs/tasks/c10-roadmap-qualify/manual/P9`–`P14` run **manually outside the runner** with their existing five family loops and single final aggregate. In particular, P12 qualifies real browser/native visual behavior and P13 verifies no status/authority escalation.

## Implementation preflight and execution

From the actual local checkout, read BOOT.md, AGENTS.md, docs/workflow.md, this README, [assessment](prompt-assessment.md) and [plan](implementation-plan.md). Verify runner metadata and the real dirty tree; do not reset, clean, stash or overwrite developer changes. Never start another mutating runner concurrently.

```sh
npm run codex:phase:validate -- c10-horizontal-color
npm run codex:phase -- c10-horizontal-color
```

Runner owns prompt commits. Use `--closeout` when explicitly choosing the non-browser P3 closeout, if the runner leaves that step pending. Prompt agents do not self-commit. Execute focused tests only; no full `npm run check` here. Existing manual P14 runs the **one final exact-candidate aggregate**, redoing only earlier live gates invalidated by this correction or later repairs.

## Preservation / non-goals

No version bump, new dependency, root package-lock, yarn.lock churn, model/provider change, background AI, new Chat, source Markdown rewrite, ProjectPlanningActions change, new Work/AgentTask authority, false Green, or Phase 11/12 activation. Retain P16/P19 historical NOT GREEN and Phase 10 NOT OWNER-CLOSED. Keep the current manual P9–P14 qualification matrix and its three-cycle caps without weakening any gate.

**Success is implementation-ready-for-live-qualification, not Phase 10 Green.** See the separate manual P14 closeout for the final Phase 10 correction disposition.
