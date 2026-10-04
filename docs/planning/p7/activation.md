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

Phase 7A implementation/evidence and the qualified `c7-chat-conversation-ux` correction are retained. Phase 7B AI Center is **QUALIFIED / CLOSED at coherent `0.7.23`**. Phase 7C Roles & Routing is the remaining Phase 7 slice.

Current continuation baseline: coherent `0.7.24`; the 7C P1 contracts are defined, with P2 persistence next.

Execution sequence:

1. validate the written `p7c` continuation;
2. execute P1-P7 (`0.7.24`–`0.7.30`);
3. perform P8 direct integrated qualification at `0.7.31`;
4. run P9 as the one final Product Phase 7 closeout at `0.7.32`;
5. if Phase 7 closes Green, start a fresh Phase 8 Scoped Delegation `/docs-review`; do not create Phase 8 implementation prompts from the closeout.

7C is normal Phase 7 capability, not defect repair. It must not add mutation/delegation or Phase 10 background-alignment consumers.
