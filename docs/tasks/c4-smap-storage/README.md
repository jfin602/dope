# Correction 4 — sMap Project-Local Persistence

Status: **GREEN / QUALIFIED — P3 EVIDENCE-ONLY CLOSEOUT**
Correction folder: `c4-smap-storage`
Required unchanged version: `0.4.6`
Activation source: `c059f67a5fd85c81183ba09044e550462c9000a1`
Predecessor: owner-closed / Not Qualified `c4-synth-coverage-review`
Assessment: `b438c58d5b8b5cfe237230f61386a72c8211956a`
Plan: `6a2f7200bce741fd559cbd0b8a22f342f8a859a0`
Prompts: P1 `2ee3f477688affc8186f46fc7d58a8a6be792307`; P2 `033a415e66caecaac2a43bc7df4b2d48b3b1f045`; P3 `22e30b2cf34c1a76268413e2c6a2d6e6b4ebca61`
Authority: `docs/software-map-storage.md`, ADR 0014 owner sequencing amendment, ADR 0008-0015 where not amended
Closeout: `closeout.md` at P2 output candidate `bb91abc00171d51e544a46a6392a0a7715ea44d7`; package `0.4.6` unchanged.

Next: bounded Dope logo-palette/application-color alignment, then a fresh Product Phase 5 `/docs-review`. Phase 5 implementation is not active. The earlier synthesis/provider corrections remain owner-closed Not Qualified.

## Purpose

Prove and, only where necessary, repair the project-local Software Map persistence boundary so repository + `.dope/` is sufficient to recover durable sMap truth on a fresh backend/process/root.

This is not a new persistence subsystem.

Current source already implements the intended core shape:
- `.dope/architecture.json` — canonical developer-owned architecture;
- `.dope/smap.json` — accepted-initialization marker bound to exact architecture bytes;
- strict/fail-closed path, schema, mismatch and symlink handling;
- transient in-memory Physical Map/synthesis state;
- machine-local provider preferences and credential storage.

## Scope law

Prefer proof over implementation.

Do not persist rebuildable/transient artifacts merely to make the test easier:
- synthesis review drafts;
- evidence packets/proposals;
- physical graph snapshots/indexes;
- coverage ledgers;
- synthesis attempts/cache/progress;
- Search Deeper previews;
- provider/model setup;
- UI/workspace state.

A concrete discovered portability defect may receive the smallest bounded repair plus a permanent regression guard.

## Streamlined stack

| Prompt | Work | Validation |
| --- | --- | --- |
| P1 | audit durable/transient boundary; repair only concrete portability defects; permanent focused guards | T1/T2 focused |
| P2 | short copy/reopen/restart portability proof + Dope dogfood initialization | T2 focused qualification |
| P3 | evidence-only closeout | audit only |

P2 is intentionally short. No Local/Gemini comparison, no architecture-quality benchmark, no AppImage/native packaging, and no broad browser qualification unless P1 makes a change that directly requires one of those checks.

## P2 direct proof

Use one controlled repository/fixture:
1. establish accepted canonical architecture through the real production acceptance path;
2. verify `.dope/architecture.json` + `.dope/smap.json`;
3. dispose/restart the backend;
4. copy the repository including `.dope/` to a different filesystem root;
5. open it with a fresh backend and no retained synthesis session/cache;
6. prove initialized state and canonical IDs/containment recover;
7. rebuild derived Physical Map state from source/config + canonical architecture;
8. discard machine-local preference/cache state and prove project truth is unchanged;
9. mutate source and prove derived state rebuilds without silently rewriting canonical architecture;
10. open a copy without `.dope/` and prove it does not inherit initialization;
11. prove A/B project isolation and malformed/mismatched/symlink fail-closed behavior;
12. initialize Dope's tracked `.dope/architecture.json` through the production acceptance path and retain the resulting valid `.dope/smap.json`.

## Exit

Green means durable Software Map truth demonstrably follows repository + `.dope/`, not machine-local state, with focused regression protection and Dope itself carrying a valid accepted marker.

Then route to the bounded Dope logo-palette/application-color alignment step. After that visual-identity alignment is complete, route to a fresh Product Phase 5 `/docs-review`.
