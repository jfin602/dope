# Phase 9B — Typed Artifact Linking and Resolution

**Status:** ASSESSMENT/PLAN/PROMPTS AUTHORED — NOT OWNER-ACTIVATED OR IMPLEMENTED
**Entry:** 9A bounded Green at `0.9.6` / `6b51ee96`; evidence-only closeout `bb266b3`. Phase 9 overall NOT QUALIFIED; 9C–9E inactive.
**Authority:** `docs/planning/p9/phase-9b-plan.md`, ADR 0033, `docs/stability-contract.md`.
**Execution folder:** `p9b`. Actual root/app/package manifests remain `0.9.6`. No version advance is authorized by these docs.

| Prompt | Target | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.9.7 | Strict v2 typed refs and v1 normalization | T1 | GPT-6 Sol High | no |
| P2 | 0.9.8 | Atomic migration and 9A compatibility | T2 | GPT-6 Sol High | no |
| P3 | 0.9.9 | Read-only Chat/Planning resolution | T2 | GPT-6 Sol High | no |
| P4 | 0.9.10 | Agent/Project Mind resolution | T2 | GPT-6 Sol Medium | no |
| P5 | 0.9.11 | Membership attach/detach and RPC | T2 | GPT-6 Sol High | no |
| P6 | 0.9.12 | Bounded cross-store integration fixture | T2 | GPT-6 Sol High | no |
| P7 | 0.9.13 | Real Planning-to-Work qualification and closeout | T2/manual | GPT-6 Sol High | no |

**Version law:** Each prompt, including manual P7, owns its assigned coherent version transition across all 13 root/app/package manifests and pinned internal `@dope/*` references. The runner verifies but does not bump. P1 starts from the Git-proven `0.9.6` predecessor only after explicit separate 9B owner activation. P7 needs a separate legitimate source/version checkpoint before evidence-only closeout. Never create a root package-lock or change unrelated dependencies/lockfiles.

**Efficiency:** P1–P5 aim <=8 minutes with focused tests; 10-minute soft, 15-minute hard. P6 is bounded T2 integration; P7 manual real replay may take longer. Build only touched package outputs required by tests; register new tests once in `test:product`. No per-prompt full `npm run check`, browser/Electron/native build, GUI or model calls. P7 alone owns the real authorized headless replay; 9E owns full GUI and aggregate.

**Safety:** Typed links are organizational only. Never mutate Chat/Planning/Agent/Project Mind by resolving or detaching. Preserve 9A lifecycle, project-root identity, stale revisions, missing/unavailable links, Phase 5 Not Green and Phase 8 Green. No automatic execution, provider fallback, session-origin task or AI context.

**Execution gate:** The stack is ready for a separate owner decision to activate 9B. When that activation is recorded, safely sync Git, verify coherent `0.9.6` and run:
```bash
npm run codex:phase:validate -- p9b
npm run codex:phase -- p9b
```
P7 is the **sole manual scoped 9B closeout**. It must not activate 9C, claim full Phase 9 Green or bump to `0.9.14`.
