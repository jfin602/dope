# Product Phase 7C Implementation Plan

Status: **ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Product source baseline: `42353d5d817b1c57c72ccb28e52a6bdf5eb1d66b`, coherent `0.7.23`
Task folder: `p7c`
Version sequence: `0.7.24` through `0.7.32`

## Shared execution rules

Read BOOT, AGENTS, p7c assessment/plan, the immediately preceding p7c result, and only directly affected source/tests. Preserve Phase 7A/P12/P13/c7 and Phase 7B closeout truth.

Ordinary prompts run focused tests and narrow package builds only. P8 owns broad direct/T3 evidence. 7C remains read-only with respect to project mutation.

## P1 — role/routing domain contracts (`0.7.24`)
Add fixed role IDs, role policies/entries, hard constraints, soft preferences, role health, unresolved target descriptors and immutable RoutingProvenance to `@dope/ai`; add typed service DTO foundations. No persistence/runtime/UI.

## P2 — global role-policy store/service (`0.7.25`)
Add revisioned machine-global role-policy persistence, locking/watch/live propagation, stale rejection, fixed-role initialization, preserved unresolved exact-target descriptors and no project state. No automatic assignments.

## P3 — deterministic resolver (`0.7.26`)
Implement pure/provider-neutral role resolution over policy + inventory + feature constraints: narrowing/intersection, exact/constraint entries, deterministic soft-preference/tie ordering, derived health and explanations. No model execution.

## P4 — routed execution/fallback/provenance (`0.7.27`)
Add application routing service above existing exact Model Runtime. Enforce pre-output bounded fallback classes, egress authorization, one-attempt-per-candidate, no fallback for explicit exact/cancel/auth/partial output/semantic failures, and immutable execution provenance.

## P5 — AI Center Roles UI (`0.7.28`)
Add Roles beside Connections/Models with fixed-role list, policy editor, preferred/fallback ordering, hard constraints/preferences, eligible/ineligible explanations, health and keyboard reorder. Feature-imposed constraints are explanatory/read-only; Coding Agent says No active consumer yet.

## P6 — Chat role policy integration (`0.7.29`)
Migrate Chat settings to Exact or Follow Interactive; preserve existing exact defaults; new/no-exact Chats follow Interactive. Role-following sends use router; exact one-turn/default remains no-fallback. Add hosted-role egress confirmation and durable RoutingProvenance + Why this model? without changing auto-title model reuse.

## P7 — Software Map and future role seams (`0.7.30`)
Use Software Map role only to propose/default eligible candidate, then retain visible exact run target, consent/probe/warm-up/strategy. Expose Background local-only/no-hosted-fallback and Coding Agent/Deep Reasoning request contracts without implementing future consumers.

## P8 — direct 7C qualification (`0.7.31`)
Dogfood Roles UI, deterministic policies, live role-following Chat, exact override, allowed/disallowed fallback, hosted egress guard, Software Map role boundary, Background future constraints, provenance/Why-this-model, policy restart/multi-window/update and package/native behavior.

## P9 — final Product Phase 7 closeout (`0.7.32`)
Evidence-only audit of 7C plus aggregate 7A/7B/7C Phase 7 exit condition. If all Green, close/qualify Product Phase 7 and route next to Phase 8 Scoped Delegation docs review. Do not implement Phase 8.
