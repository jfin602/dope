# c9-theme-fix — Restore restrained-orange Dope Dark

**Status:** APPROVED AUTHORITY / SOURCE-INSPECTED / PROMPTS WRITTEN / NOT EXECUTED
**Mode:** bounded correction, not a new product phase
**Authority:** ADR 0016 October 12, 2026 amendment (supersedes October 8 blue-primary allocation); ADR 0030 UI grammar; `docs/ARCHITECTURE.md`; `AGENTS.md`; `docs/workflow.md`
**Reviewed source:** `e11b72fe35f86f1700861101184760b80254c659`; documentation application `6e76285616eb73e9d65ee2e56cb16ef5b6bd9d83`; current GitHub `main` package `0.9.23` at writing.
**Required unchanged project version:** `0.9.23` for this prepared stack. **Before running**, confirm the actual checkout is coherent at `0.9.23`; do not downgrade or reset a checkout that has advanced. If p9d or another stack advanced the version, first re-plan/rewrite **both** c9 correction prompts' fixed unchanged-version metadata at that future coherent baseline, then validate again. Do not run concurrent mutation stacks on the same worktree.

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
- `p9d` is separately owner-activated, and its P1 exporter was requalified at `0.9.23`. Do not redo its gate, modify its phase versions, replace its History owner, or run c9 in parallel with active p9d steps. The pending `p9d/P7-history-right-toolbar.txt` was reconciled with current theme authority in the documentation application; do not reopen executed p9d work.
- No Chat/Work/AgentRun/Session/History/Planning/Map behavior, domain, persistence, transport, provider, model routing, permissions, grants, app shell ownership, or editor interaction changes. Keep direct real GUI evidence honest.
- Alternate user themes, readability and non-color interaction cues are non-negotiable.

## Files and commands

Planning: `prompt-assessment.md`, `implementation-plan.md`

Execution: `P1-theme-tokens.txt`, `P2-ui-qualification-closeout.txt`

Validate grammar: `npm run codex:phase:validate -- c9-theme-fix`

Run P1, with manual stop before P2: `npm run codex:phase -- c9-theme-fix`

Actual source, version, focused tests, computed colors, GUI observations and GREEN/NOT GREEN must be recorded by P2 in `closeout.md`. Documentation and prompt creation are not source implementation or qualification.
