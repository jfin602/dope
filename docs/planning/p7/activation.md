# Product Phase 7 — AI Presence Activation

Status: **OWNER APPROVED — ACTIVE / STREAMLINED P1-P13 STACK READY**
Date: 2026-10-03
Package baseline: `0.7.0`
Activation baseline commit: `59c7f72a29dcdecdf9b908176754bfd02179b004`
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, `docs/planning/p7/phase-7-plan.md`, current product/architecture/stability contracts

## Entry disposition

Phase 6 is owner-closed for sequencing; its P8 Not Qualified evidence remains historical truth. Phase 7 does not relabel Phase 5/6.

The activation transition changed only live package/app versions, internal `@dope/*` references and baseline assertions from `0.6.8` to coherent `0.7.0`. It added no Chat/AI behavior.

## Phase boundary

Phase 7 adds durable provider-independent Chats, reusable ChatPanels, per-message connected-model routing, per-Chat settings and bounded read-only project context. It does not add mutation/delegation or Phase 8 background alignment.

General Chat uses an application-level Model Connections boundary separate from Software Map synthesis provider selection. Secrets do not belong in `.dope/` or ordinary plaintext persisted workbench state.

## Framework/version boundary

- package family `0.7.x` from coherent `0.7.0`;
- Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`, Node 24;
- no root `package-lock.json`.

## Execution readiness

The streamlined executable P1-P13 stack is under `docs/tasks/p7/`. It splits only boundaries that were likely to exceed the ordinary <=8-minute target: persistence/backend, runtime/adapters, and context/AI behavior.

Validate once before execution:

`npm run codex:phase:validate -- p7`

Then execute through the runner. P12 is the browser/manual qualification handoff and P13 is evidence-only closeout.
