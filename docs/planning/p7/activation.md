# Product Phase 7 — AI Presence Activation

Status: **OWNER APPROVED / QUALIFIED / CLOSED AT ACTUAL `0.7.31` SOURCE**
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

## Final disposition

Product Phase 7 completed 7A durable Chat/AI Presence, 7B AI Center and 7C deterministic Roles & Routing on the actual `0.7.31` source. The planned `0.7.32` closeout version transition did not materialize and is not claimed.

On 2026-10-05 the owner explicitly approved Phase 7 closeout. Historical P12/P13 evidence remains unchanged and is not relabeled by this disposition.

The post-closeout `c7-chat-project-grounding` correction remains a separate approved correction at unchanged `0.7.31`. It is not implicitly Green through Phase 7 owner approval and must retain its own qualification result.

Next gate before Phase 8: execute/qualify `c7-chat-project-grounding`, then begin a fresh Product Phase 8 — Scoped Delegation / Coding Agent `/docs-review`.
