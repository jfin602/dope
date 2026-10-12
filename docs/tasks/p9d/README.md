# p9d — Final Phase 9: Developer Continuity and History

**Status:** ASSESSED / PLANNED / PROMPTS AUTHORED — NOT OWNER-ACTIVATED OR IMPLEMENTED
**Entry:** actual committed `0.9.22` / `0752415be76ef3f87e1a34bf17c4009a888be085`. ADR 0034 approves replacing Sessions with **History in the RIGHT activity toolbar**, automatic factual context, one-click continuation and optional local-first understanding.
**Historical scope:** 9A bounded Green `0.9.6`, 9B bounded Green `0.9.13`. Original Session 9C P1–P9 reached `0.9.22`; P10 was superseded/unexecuted. **Phase 9 overall NOT QUALIFIED.**
**Finality:** This p9d stack replaces the deprecated Session 9D and 9E plans; **no p9e subphase**. P13 is the sole manual **FINAL Phase 9** qualification/closeout, not a limited 9D-only audit.

| Prompt | Target | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 — Legacy export | 0.9.23 | T2 | GPT-6 Sol High | no |
| P2 — UI retirement | 0.9.24 | T1 | GPT-6 Sol High | no |
| P3 — Backend retirement | 0.9.25 | T2 | GPT-6 Sol High | no |
| P4 — History projection | 0.9.26 | T1 | GPT-6 Sol Medium | no |
| P5 — Chat/Planning/Mind | 0.9.27 | T2 | GPT-6 Sol High | no |
| P6 — Agent/Git metadata | 0.9.28 | T2 | GPT-6 Sol High | no |
| P7 — Right History panel | 0.9.29 | T1 | GPT-6 Sol High | no |
| P8 — Meaningful focus | 0.9.30 | T2 | GPT-6 Sol High | no |
| P9 — Exact continuation | 0.9.31 | T2 | GPT-6 Sol High | no |
| P10 — Evidence preview | 0.9.32 | T1 | GPT-6 Sol Medium | no |
| P11 — Local explanation | 0.9.33 | T2 | GPT-6 Sol High | no |
| P12 — Integration | 0.9.34 | T2 | GPT-6 Sol High | no |
| P13 — FINAL Phase 9 closeout | 0.9.35 | T3/manual | GPT-6 Sol High | yes |

## Activation and version law

**Require a separate explicit owner authorization at `docs/planning/p9/phase-9d-activation.md` before ANY implementation.** These docs and prompts do not self-activate. At entry all 13 root/app/package manifests and pinned `@dope/*` dependencies remain `0.9.22`. P1 advances them to `0.9.23` during implementation; each subsequent prompt owns the next patch. P13 manually creates a separate legitimate `0.9.35` source/version checkpoint BEFORE evidence-only closeout. Runner verifies but never bumps. Preserve developer dirty files, `yarn.lock`, unrelated dependencies and no root `package-lock.json`.

The former `p9c` P10 MUST NOT RUN and cannot claim `0.9.23`. Stop at the owner-activation gate rather than trying to fix a post-stop version mismatch through pre-bump.

## Efficiency and evidence

P1 exports user Session data safely before P2/P3 code removal; P4–P6 source actual read-only chronology; P7–P9 build right-panel UX/continuity; P10/P11 add explicit preview/local-only explanation; P12 is targeted integration. P1–P12 require smallest focused validation with no routine full `npm run check`; normal prompts target <=8 minutes (10-minute soft / 15-minute hard); T2 bounded security/integration may take longer when justified. Register each new test exactly once in `test:product`, remove tests only when their former owner is retired.

**P13 T3/manual:** real Theia GUI on actual Dope and disposable project, one-click exact continuation, no-Sessions experience, v1/v2 export preserving bytes, a real eligible LOCAL-only explanation, direct isolation/restart/authority proof and one full exact-candidate `npm run check`. Honest Phase 9 **GREEN / NOT GREEN**; Phase 10 and phase owner-closure require separate decisions.

After owner authorization and safe Git sync:
```bash
npm run codex:phase:validate -- p9d
npm run codex:phase -- p9d
```
The runner executes P1–P12 and stops for manual P13. No auto-activated p9e or Phase 10.
