# ADR 0003 — Observation and mutation authority are separate

Status: Accepted
Date: 2026-09-27

Decision:
Models may observe permitted project state without automatically receiving mutation permission. All effects flow through ProposedAction, Dope authority policy, and ToolExecutor.

Rationale:
Scoped delegation requires AI to review human-owned work without silently taking ownership.

Consequence:
Editor observation, ambient intelligence, and review features must not bypass mutation policy.
