# Product Phase 7 — AI Presence Activation

Status: **OWNER APPROVED — ACTIVE / PHASE 7A RECORDED / P13 NOT QUALIFIED / c7 QUALIFIED / PHASE 7B NEXT**
Date: 2026-10-03
Package baseline: `0.7.0`
Activation baseline commit: `59c7f72a29dcdecdf9b908176754bfd02179b004`
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, ADR 0026, `docs/planning/p7/phase-7-plan.md`, current product/architecture/stability contracts

## Entry disposition

Phase 6 is owner-closed for sequencing; its P8 Not Qualified evidence remains historical truth. Phase 7 does not relabel Phase 5/6.

The activation transition changed only live package/app versions, internal `@dope/*` references and baseline assertions from `0.6.8` to coherent `0.7.0`. It added no Chat/AI behavior.

## Phase boundary

Phase 7 is one `0.7.x` product phase with three ordered slices:

- **7A — AI Presence:** durable provider-independent Chats, reusable ChatPanels, per-message connected-model routing, per-Chat settings, bounded read-only project context, Model Connections registry and reference provider adapters.
- **7B — AI Center:** a dedicated global connection/model management surface opened from the bottom-left AI launcher and backed by the 7A registry.
- **7C — AI Roles & Routing:** global role policies and capability/constraint-aware resolution for Interactive, Deep Reasoning, Background, Software Map and Coding Agent work.

Phase 7 does not add mutation/delegation or Phase 10 background alignment itself.

General Chat uses the application-level Model Connections boundary separate from Software Map synthesis strategy/authority. Phase 7B promotes that boundary into one logical machine-local/application-global revisioned AI registry with secure credential sources and no plaintext fallback. Phase 7C adds deterministic role policy over stable connection/model identities. AI Center/role policy never grants sMap evidence-egress consent; global role constraints may restrict but never broaden feature authority. Phase 10-compatible Background work remains local-only/no-hosted-fallback. Existing 7A Chat exact defaults are preserved; new 7C Chats default to Follow Interactive. Secrets do not belong in `.dope/`, Chat persistence or ordinary plaintext persisted workbench state.

## Framework/version boundary

- package family `0.7.x` from coherent `0.7.0`;
- Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`, Node 24;
- no root `package-lock.json`.

## Execution readiness

Phase 7A P1-P12, the bounded P12 blocker correction, and the P13 evidence-only audit are recorded. P13 remains **Not Qualified** because Phase 7B/7C were not yet implemented. The bounded `c7-chat-conversation-ux` correction is **Green / Qualified** at unchanged `0.7.13` and preserves the retained P12/P13 history.

Current continuation baseline: coherent `0.7.13`.

Next execution sequence:

1. use the promoted Phase 7B authority in ADR 0026 / the Phase 7 plan;
2. run `/prompt-ass -> /prompt-plan -> /prompt-write p7` for a contiguous Phase 7B continuation from the current source;
3. implement and qualify AI Center without role routing;
4. continue with Phase 7C role policy/routing;
5. perform exactly one later final Phase 7 closeout over 7A+7B+7C.

7B/7C are normal Phase 7 capability, not defect repair. Do not replay Phase 7A merely because the continuation advances within the same `0.7.x` family.
