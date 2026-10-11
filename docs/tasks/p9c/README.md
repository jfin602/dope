# Phase 9C — Development Sessions Workspace UI

**Status:** ASSESSMENT / PLAN / PROMPTS AUTHORED — NOT OWNER-ACTIVATED OR IMPLEMENTED
**Entry:** 9A Green 0.9.6/6b51ee96; 9B bounded Green 0.9.13/5aa0bac (25/25 focused tests and real local Qwen Planning-to-Work replay). Phase 9 overall NOT QUALIFIED.
**Authority:** `docs/planning/p9/phase-9c-plan.md`, ADR 0033 and ADR 0025.
**Current version:** `0.9.13`; no 9C version or implementation changes from prompt authoring.

| Prompt | Target | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | 0.9.14 | T1 | GPT-6 Sol High | no |
| P2 | 0.9.15 | T1 | GPT-6 Sol High | no |
| P3 | 0.9.16 | T1 | GPT-6 Sol Medium | no |
| P4 | 0.9.17 | T2 | GPT-6 Sol High | no |
| P5 | 0.9.18 | T1 | GPT-6 Sol Medium | no |
| P6 | 0.9.19 | T2 | GPT-6 Sol High | no |
| P7 | 0.9.20 | T2 | GPT-6 Sol High | no |
| P8 | 0.9.21 | T3/manual | GPT-6 Sol High | yes |

**Preflight/activation:** Every prompt requires a *separate explicit owner-approved* record at `docs/planning/p9/phase-9c-activation.md`; these documents are NOT owner activation. Do not start P1 or pre-bump from `0.9.13` while absent.

**Version law:** P1 moves all 13 root/app/package manifests and pinned internal `@dope/*` references to `0.9.14` only during implementation; each subsequent Pn owns next patch through P7 `0.9.20`. P8 is sole manual T3 and must create separate legitimate `0.9.21` exact source/version checkpoint before evidence-only closeout. Runner verifies but does not bump. No root package-lock.json or unrelated lock/dependency edits.

**Safety:** No implicit task run, model context, owner-store write, Chat recovery, duplicate Chat/Work owner, silent WorkItem completion, Architecture adoption or Phase 9 overall Green claim. 9D richer progress/closeout, 9E full Dope Builds Dope and Phase 10 remain deferred. P1–P6 <=8-minute focused goal; P7 bounded T2 and P8 direct real Theia GUI only. New tests registered exactly once; no per-prompt full `npm run check` or native packaging.

After separate owner approval, safe Git sync and baseline verification only:
```bash
npm run codex:phase:validate -- p9c
npm run codex:phase -- p9c
```
P8 remains **MANUAL / CLOSEOUT**; the above runner runs implementation prompts P1–P7.
