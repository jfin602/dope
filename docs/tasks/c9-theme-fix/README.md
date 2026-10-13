# c9-theme-fix — Restore restrained-orange Dope Dark

**Status:** APPROVED AUTHORITY / SOURCE-INSPECTED / PROMPTS WRITTEN / NOT EXECUTED
**Mode:** bounded correction, not a new product phase
**Authority:** ADR 0016 October 12, 2026 amendment (supersedes October 8 blue-primary allocation); ADR 0030 UI grammar; `docs/ARCHITECTURE.md`; `AGENTS.md`; `docs/workflow.md`
**Reviewed source:** `e11b72fe35f86f1700861101184760b80254c659`; documentation application `6e76285616eb73e9d65ee2e56cb16ef5b6bd9d83`; current GitHub `main` package `0.9.23` at writing.
**Required unchanged project version:** `0.9.35` after Phase 9 qualification. Confirm a coherent local `0.9.35` checkout and safe worktree. Do not run alongside any other mutating stack; if the local version advances again, retarget both prompts before running.

## Outcome

Restore original Dope Dark branding with **intentional** orange primary actions/emphasis and restrained neutral UI controls:
- `#1F1F1F` foundation; `#FF7A1A` primary, `#FFB15C` hover/highlight, `#C75100` pressed/deep reference;
- `#303030` neutral secondary controls and `#484848` neutral borders/separators;
- theme-scoped, contrast-tested focus/selection, opt-in primary action buttons, subdued status chrome with only the Git segment permitted a persistent filled orange brand area;
- preserved diagnostics/syntax/SCM, ten Chat organization colors, map/Flow palette, and explicit alternate-theme deactivation.

No new component library or panel architecture. The AI Center's restrained visual grammar remains the reference for Chat, Work and other Dope-owned surfaces.

## Ordered tasks

| Prompt | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Restore central Dope Dark token mapping and focused regression guards | T1 | GPT-6 Sol High | no |
| P2 | Direct GUI/contrast/alternate-theme qualification; evidence-only closeout | T3 / manual | GPT-6 Sol High | yes |

P1 is the sole ordinary implementation responsibility (<=8-minute target, 10-minute soft, 15-minute hard). P2 is the **only** manual real-GUI and aggregate gate, and the single final closeout. The runner must stop at P2 for manual execution. A failure in P2 is Not Green, not authority to conduct broad UI redesign.

## Scope and sequencing safeguards

- **No project version change.** Historical c4/c8 theme qualification remains untouched; this is a new bounded UI correction.
- Phase 9 is now GREEN / QUALIFIED at unchanged `0.9.35` / `af3447c` (owner closeout pending). Preserve History and past evidence, and never run competing mutating stacks. Recheck live source before executing the retargeted prompts.
- No Chat/Work/AgentRun/Session/History/Planning/Map behavior, domain, persistence, transport, provider, model routing, permissions, grants, app shell ownership, or editor interaction changes. Keep direct real GUI evidence honest.
- Alternate user themes, readability and non-color interaction cues are non-negotiable.

## Files and commands

Planning: `prompt-assessment.md`, `implementation-plan.md`

Execution: `P1-theme-tokens.txt`, `P2-ui-qualification-closeout.txt`

Validate grammar: `npm run codex:phase:validate -- c9-theme-fix`

Run P1, with manual stop before P2: `npm run codex:phase -- c9-theme-fix`

Actual source, version, focused tests, computed colors, GUI observations and GREEN/NOT GREEN must be recorded by P2 in `closeout.md`. Documentation and prompt creation are not source implementation or qualification.

## Execution clarification — 2026-10-12 after Phase 9 Green

This originally drafted correction now uses **unchanged version `0.9.35`** (Phase 9 qualified source `af3447c`; GitHub main `adf5c073` theme CSS/test rechecked). Earlier `0.9.23` dates/source claims remain historical planning context, not executable version metadata. The task remains **palette/theme-only**: no every-panel human usability redesign, now separately planned as Phase 11 (ADR 0037). Verify actual checkout source and worktree before mutation.
