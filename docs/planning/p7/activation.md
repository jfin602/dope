# Product Phase 7 — AI Presence Activation

Status: **OWNER APPROVED — ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Date: 2026-10-03
Package baseline: `0.7.0`
Activation baseline commit: `59c7f72a29dcdecdf9b908176754bfd02179b004`
Planning source: Phase 6 owner-close `0.6.8` plus ADR 0025 / Phase 7 docs approval
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, `docs/planning/p7/phase-7-plan.md`, current product/architecture/stability contracts

## Entry disposition

Product Phase 6 — Flow is owner-closed for sequencing. Its P8 audit remains Not Qualified and the accepted G/H evidence gaps remain historical truth. Product Phase 5 likewise retains its owner-close gaps. Phase 7 does not relabel either phase.

The bounded activation transition changed only live Dope package/app versions, internal `@dope/*` references and the baseline-version regression assertion from `0.6.8` to coherent `0.7.0`. It added no Chat/AI runtime behavior.

## Phase purpose

Phase 7 introduces durable provider-independent AI Presence through Dope-owned project Chats and reusable ChatPanels. Chat remains a project context surface, not the center of product authority.

Locked outcomes include:
- `.dope/chats/` durable conversation context with nested user folders and stable Chat identity;
- reusable left/right/center/bottom ChatPanels over one shared Chat repository;
- one live panel owner per Chat;
- per-message connected-model choice and durable actual model/provider provenance;
- a persistent two-row composer and per-Chat settings cog;
- bounded editor/project/Project Mind/Architecture/Physical Map/Flow/Planning/saved-Chat context;
- read-only Ask / Explain / Trace / Find Related assistance;
- no silent provider fallback and no provider-native session as canonical Chat identity.

## Authority boundary

Phase 7 is observational/read-only with respect to general project mutation.

Do not introduce:
- general filesystem/process/Git/network mutation tools;
- ProposedAction execution or Authority bypasses;
- autonomous coding/delegation;
- Phase 8 background alignment monitoring;
- automatic promotion of conversation into Project Mind, Architecture or Planning truth.

## Runtime boundary

ADR 0022's existing synthesis/runtime seam is reused and extended. General Chat gets its own application-level Model Connections registry; a Software Map synthesis provider selection does not implicitly authorize Chat context transfer.

Provider connection metadata may be application/user state, but credentials/tokens must not be written into `.dope/` or persisted insecurely as ordinary project/workbench JSON. Environment-provided credentials and session-only secret entry are acceptable Phase 7 mechanisms.

## Framework/version boundary

- Dope package family: `0.7.x`;
- activation baseline: coherent `0.7.0` at the commit above;
- Theia remains `1.75.0`;
- Electron remains `42.8.1`;
- React remains `19.2.8`;
- Node remains major 24;
- no root `package-lock.json`.

## Execution readiness

The executable P1-P9 stack is under `docs/tasks/p7/`.

Validate:

`npm run codex:phase:validate -- p7`

Then execute through the phase runner. P8 is the browser/manual qualification handoff and P9 is evidence-only closeout.
