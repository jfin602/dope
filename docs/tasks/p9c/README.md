# Phase 9C — Development Sessions Workspace

**Status:** ASSESSED / PLANNED / PROMPTS AUTHORED — NOT OWNER-ACTIVATED OR IMPLEMENTED
**Entry:** 9A bounded Green `0.9.6`; 9B bounded Green `0.9.13` / `5aa0bac`; Phase 9 overall NOT QUALIFIED.
**Authority:** `docs/planning/p9/phase-9c-plan.md`, ADR 0033/0025 and stability contract.
**Execution:** `docs/tasks/p9c/`. Actual coherent root/app/package version remains `0.9.13`.

| Prompt | Target | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | `0.9.14` | T1 | GPT-6 Sol High | no |
| P2 | `0.9.15` | T1 | GPT-6 Sol High | no |
| P3 | `0.9.16` | T1 | GPT-6 Sol Medium | no |
| P4 | `0.9.17` | T1 | GPT-6 Sol High | no |
| P5 | `0.9.18` | T2 | GPT-6 Sol High | no |
| P6 | `0.9.19` | T1 | GPT-6 Sol Medium | no |
| P7 | `0.9.20` | T2 | GPT-6 Sol High | no |
| P8 | `0.9.21` | T2 | GPT-6 Sol High | no |
| P9 | `0.9.22` | T2 | GPT-6 Sol High | no |
| P10 | `0.9.23` | T3/manual | GPT-6 Sol High | yes |

**Activation gate:** P1–P10 require a separate explicit owner-approved `docs/planning/p9/phase-9c-activation.md`. This authored stack and 9B Green do NOT activate 9C. Stop with zero changes if absent.

**Version law:** P1 starts from Git-proven `0.9.13`, moves all 13 root/app/package manifests and pinned internal `@dope/*` refs to `0.9.14` DURING implementation. Through P9 each prompt moves one patch to `0.9.22`. P10 MANUAL requires separately committed exact `0.9.23` source/version checkpoint before evidence-only closeout; never fabricate version/source SHAs. Preserve yarn.lock and unrelated dependencies; do not create root package-lock.json.

**Safety/efficiency:** Sessions are optional metadata and existing-artifact references only. No task origin, permission, new agent, Chat recovery, implicit model context, auto WorkItem completion, automatic Architecture adoption or duplicate Chat/Work writer. P1–P8 target <=8 minutes with focused tests; P5/P7/P8/P9 use bounded T2, P10 manual direct GUI T3. Build changed compiled libs only; register new test paths once in `test:product`, no per-prompt full npm run check / npm test / packaging. 9D richer progress/closeout and 9E full product GUI/aggregate remain inactive.

After separate owner activation and safe Git sync:
```bash
npm run codex:phase:validate -- p9c
npm run codex:phase -- p9c
```
P10 remains the **sole manual closeout**; the runner executes P1–P9.
