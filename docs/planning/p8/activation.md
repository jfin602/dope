# Product Phase 8 — Coding Agent / Scoped Delegation Activation

Status: **OWNER APPROVED — ACTIVE**
Date: 2026-10-05
Package baseline: `0.8.0`
Activation source: `18fe5d8ae50bcb15e3639b3ec3b9acbf44eccfbb` at `0.7.31`
Authority: ADR 0027, ADR 0026, ADR 0006, `docs/planning/p8/phase-8-plan.md`, current Product Model / Architecture / Stability contracts

## Entry disposition

Product Phase 7 is owner-approved / qualified / closed at the actual `0.7.31` source.

The post-Phase-7 `c7-chat-project-grounding` correction subsequently executed at unchanged `0.7.31` and closed **Not Green**. Its implementation is retained, but its direct qualification remains incomplete.

On 2026-10-05 the owner explicitly instructed Phase 8A creation after that pushed closeout. This is the sequencing waiver authorizing Phase 8 activation despite the retained grounding gaps.

The waiver does **not** relabel `c7-chat-project-grounding` Green or erase any open gate in its closeout.

## Activation transition

The activation transition moves the coherent root/workspace package family and internal `@dope/*` references from `0.7.31` to `0.8.0`, updates baseline version assertions, and records Phase 8 authority.

It adds no Phase 8A Codex connection behavior itself.

## Phase 8 sequencing

Phase 8 is ordered:

1. **8A — Codex reference connection** — AI Center Codex agent-runtime connection, ChatGPT-plan auth, App Server lifecycle, model inventory and Coding Agent role eligibility. No project mutation.
2. **8B — Agent execution core** — AgentTask / AgentRun / ExecutionGrant and one bounded mutation-capable coding task.
3. **8C — Sequential phase-stack execution** — reproduce the external phase-runner workflow inside Dope.
4. **8D — General Scoped Delegation** — WorkItem-derived tasks, ownership, steering, diff/review and validation.
5. **8E — Local coding-agent compatibility** — reuse the same contracts against local agent/model adapters.

## First active slice

The canonical first-slice execution folder is **`p8a`**.

Pre-1.0 slice semantics are:
- slice `A` may start at patch 1 from the phase baseline;
- later lettered slices are continuations starting from their actual preceding patch.

Therefore Phase 8A targets:
- P1 -> `0.8.1`
- ...
- P6 -> `0.8.6`

The earlier `docs/tasks/p8/` draft is superseded as execution routing by `docs/tasks/p8a/`.

## Framework/version boundary

- package family `0.8.x` from coherent `0.8.0`;
- Theia `1.75.0`;
- Electron `42.8.1`;
- React `19.2.8`;
- Node 24;
- no root `package-lock.json`.

## Authority boundary

Phase 8 activation authorizes implementation of ADR 0027 in ordered slices.

Phase 8A does **not** itself authorize repository mutation by Codex. It owns only connection/auth/runtime/model/role readiness.

Mutation authority begins only when Phase 8B introduces AgentTask / ExecutionGrant execution under the documented Authority boundary.

## Immediate execution

Validate:

`npm run codex:phase:validate -- p8a`

Then execute:

`npm run codex:phase -- p8a`

P6 is the browser/manual Phase 8A qualification handoff. A Green P6 closes 8A only and routes to a fresh 8B docs review.

