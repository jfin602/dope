# /prompt-plan — Gate-first Roadmap qualification only (c11-roadmap-redesign-v2)

**2026-10-29 OWNER NARROW-SCOPE OVERRIDE:** Phase 11 ends after owner-qualified Roadmap manipulation, visual progression, source/evidence behavior and alpha cleanup. [Authoritative exit amendment](../../planning/p11/roadmap-only-exit-amendment-2026-10-29.md). The previously authored WorkItem/prompt-composer/agent handoff P15–P23 is **deferred**; existing separate Planning Map/Work features are not deleted. Product version 0.11.8 remains until explicit owner phase handoff. This is docs/prompt authoring only.
**Source contract:** [ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md), [visual layout](../../planning/p11/roadmap-visual-hierarchy-contract.md), [manual M1–M3](manual/README.md), [unstarted-source supersession](roadmap-only-pending-supersession-2026-10-29.md).
**Technical rule:** Existing executed P1–P13/P14 prompt files and qualification evidence remain unchanged; do not fake P14 PASS, modify its first-authored bytes or automatically turn historical Bridge failure into Green. Only new unstarted P15/P16 plus final P17 are authored.

## Already scoped P1–P14 — preserve, finish manual recovery

P1–P7 established the canonical schema/authority and typed operations. P8–P11 cover Roadmap Markdown/create/Chat local planning, P12–P13 canvas and selected-Gate details. They have reported/committed scoped output but **not independently sufficient visual qualification**. P14 source-bound Chrome observed undersized Phase cards, weak progression color and menu-heavy Gate editing; its prior NOT GREEN is not erased.

**Manual recovery gate:** M1 large readable Phase cards, real effective camera and source-based progression colors. M2 full Gate/Phase/criterion/relation/correction editing by conversation in existing saved Chat with schema-validated preview/approve, proper model provenance and source safety. M3 selected-item Inspector read-only until Edit toggled and independent combined Chrome; only after all M1–M3 + original P14 evidence PASS may its exact commit subject mark completion.

## Remaining short implementation sequence

### P15 — Dead Roadmap code cleanup (runner)

Inspect actual source post-P14 and delete unused Roadmap checkpoint/milestone model/aliases/adapters, duplicate view/edit paths and obsolete tests. No runtime legacy compatibility to broken alpha indices; retain explicit safe incompatible-schema rejection and owner-approved reimport. **Do not** remove independent Planning Map, Work, History, phase-stack composer or agent runtime code simply because Gate→Work integration is deferred. Keep a truthful disabled/deferred Roadmap Prepare Work affordance instead of a broken enabled control. Focus tests and diff/build.

### P16 — Roadmap source/tooling integration (runner)

Verify all Roadmap mutations through existing ChatPanel and optional selected Inspector Edit, exact approved project/owner/source revisions, draft preview/reject/accept, linked Markdown sync/relink/conflicts, current evidence-based phase/gate state, corrections/dependencies, colors/camera and source safety. Run affected tests, one `npm run check` when coherent, and browser/Electron builds. **No WorkItem authoring, stack generation, Pi integration, Work Run or automatic result-to-Gate evidence** as an acceptance gate. STOP on real Roadmap false Green, unavailable Chat edit or harmful old code.

### P17 — Roadmap and Phase 11 manual closeout (independent Chrome)

Fresh source/served browser and actual local-model (if available) tests for readable large Phase cards, state colors, conversational Phase/Gate/criterion/relation/correction manipulation, source-bound approvals, optional Edit, Markdown, evidence/qualification, project isolation, keyboard/theme/narrow/restart. Independent source hash/build/test/Git evidence and scoped owner-native handoff/gap. Report PASS/NOT GREEN; **owner explicitly closes Phase 11 only after Roadmap qualifies** for amended scope, with older unrelated failures/deferred work explicitly recorded. Owner Phase 11 closeout then permits separately authored 0.12.0 baseline and Phase 12 Pi entry subject to their own prerequisites.

## Runner order

`npm run codex:phase:validate -- c11-roadmap-redesign-v2` validates the active P1–P17 stack. The runner stops at browser-required P14 until genuine manual PASS subject; then runs P15/P16 and stops at manual final P17. Every original prompt path P1–P14 is unchanged; previous unstarted P15–P23 paths are retired from active tree but preserved in Git history. No new branch, reset/stash/clean, version bump, model default changes or unauthorized project source write.

**Phase 11 scope is narrowed; historical Work/Bridge/Hunts outcomes are not requalified or deleted.**
