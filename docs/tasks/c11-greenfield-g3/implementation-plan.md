# /prompt-plan — c11-greenfield-g3

**Date:** 2026-10-28/29 · **Status:** DOCS ONLY. **GitHub authoring source:** `c947700a6e57f81a40d43a256fe6814c55a18ea4`, version `0.11.8`. [Assessment](prompt-assessment.md) · [G3 contract](../../planning/p11/greenfield-experience-contract.md). The original `c11-greenfield-patch` P1/P2/P3 are immutable and untouched. The user reports G2 completed; this author did not operate the local browser.

## Single user journey

Use the developer's own tower-defense project as a read-only context source and **only explicitly authorized** project Roadmap draft. Actual phases can differ; 5-phase MVP example only: Foundation -> Map/Enemies -> Towers/Combat -> Progression -> MVP Polish, with bounded milestones/dependencies. Ordinary Chat should offer a concise initial implementation direction and, after checking actual Roadmap state, say creating a draft is available. **Button** or exact context-bound reply "Yes, create the roadmap" triggers identical server-side approval of generation, never canonical publication. The selected model drafts complete strategic phases; validate first; focus the **existing** Roadmap central editor on the reviewable draft with truthful operation progress. Preserve Chat placement. If a Roadmap already exists, offer Open/Continue/Review instead. A lone "yes" without a matched current offer is ordinary Chat, not authorization.

## Task split and concrete change ownership

| Prompt | Main current owners | Definition of done in focused tests |
| --- | --- | --- |
| **P1 — Concise offer** | `chat-context-composer.ts`, `chat-backend.ts`, read-only `RoadmapStore` service seam | Brief but substantive G3-A answers (soft 100–170 words) + checked project/owner revision and pending/draft state. No model assumption or repeat-nagging; no offer when existing/competing Roadmap. No model tool write. |
| **P2 — Single authorization** | `packages/chat/src/service.ts` types, `chat-backend.ts`, `chat-panel-controller.ts` and `chat-panel-widget.ts` | Typed proposal ID/project/chat/owner revision, one-time approval token, current owner/lease/server reread. Button and explicit matched developer text route to same approval; reject/Not now; ambiguous and foreign/stale/wrong-owner/double-call denied. Start generation only, not canonical publish. |
| **P3 — Whole draft** | `roadmap-greenfield.ts`/Roadmap service, model-envelope validation and Chat backend orchestration | One complete bounded strategic multi-phase/checkpoint/dependency proposal from local selected model; strict completed output parser, source/owner revision; full draft preview then separate accept to noncanonical state. No 2–3 action loop or changed dependency-level `projectImplementationPlan` semantics; no file writes. |
| **P4 — Progress and editor** | `chat/service.ts` event, `ChatBackend` stage reports, `chat-panel-controller/widget.ts`, `roadmap-navigation-contribution.ts` and single `roadmap-canvas-widget.ts` | Accurate events waiting/generating/validating/ready/error/cancel, quiet during inference but visibly alive, safe cancel, no invented intermediate steps, existing `dope.roadmap.open` and newly available current draft fit/reveal, Chat dock unchanged. |
| **P5 — Cross-seam regression** | existing `test/unit/chat-backend.test.ts`, `chat-context-composer.test.ts`, `roadmap-greenfield.test.ts`, `roadmap-canvas.test.ts`, `chat-panel.test.ts`, current service/renderer integration | A fake-model deterministic path from checked offer -> dual consent -> model output -> validated whole draft -> reviewed draft -> editor focus; negatives: existing Roadmap, competing draft, stale basis, project/Chat switch, unreadable/secret/hosted, invalid output/cancel, no auto Markdown. |
| **P6 — Manual G3 closeout** | actual Chrome/Codex browser, selected loaded Q4 on real app and safe test projects | Independently operate G3-A/B/C/D as user, record real proposal, button path, conversational path, observable progress, current editor, approval separation, explicit negative tests; one aggregate only if live gates pass; correction scoped Green != Phase 11 Green. |

## Reviewer and authority sequence

1. Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, existing G3 contract and old G1/G2 reports; inspect **actual local** git HEAD, dirty tree/version, recent G2 code, model/provider ready state and unrelated owners. Preserve old changes. Stop on version drift.
2. Run each bounded change with focused tests after compiled `lib`. **Manual browser quick look after P1** to confirm real Chat brevity/offer and Roadmap state (not a final Green). **Manual approval/security check after P2** before authorizing P3. **Real browser full draft after P3–P4** before P5's broad regression, if practical. Avoid six cycles of artificial sample planning.
3. Existing runtime controls provider data egress and explicit model; if selected Q4 unavailable, use deterministic focused tests for safety but mark real G3 blocked, never swap host/claim pass.
4. Once direct G3-A–D all pass in one exact-source app, P6 writes a new source-bound qualification record and one justified final `npm run check`; preserve older failed P8/P5, original Greenfield P3, G1 scoped success, G2 owner result. No premature full Phase 11 closeout.

## Validation truth / non-goals

- **Two distinct approvals:** (A) user grants permission to generate one roadmap draft; (B) user reviews and approves the generated draft; then (C) separate canonical linked Markdown publication preview/approval. Never collapse B/C or silently write project `ROADMAP.md` at A.
- Existing Roadmap and competing draft/pending intent suppress duplicate offers. Server must recheck state at action time, not rely on UI-supplied booleans, Chat text or cached snapshots. One offer used once.
- G3-A brevity should not reduce detailed help or remove reasoning necessary for safety. Measure output token/time and user usefulness; do not enforce length via hard truncation.
- No new plan/Roadmap store, chat subclass, arbitrary agent tools, runtime provider default, shell/network access, new dependencies or edits to old authored stack/history.
- Native Electron GUI still unobserved unless independently operated; builds alone cannot prove parity. Preserve G2 real-project files, source truth and project isolation. The first real request may contain files already; cannot claim an empty project from absent Auto context.

**Handoff:** source-authoring only. Merge separately, then owner explicitly launches; no `/activate` and no background execution implied.
