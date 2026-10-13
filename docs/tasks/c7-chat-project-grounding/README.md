# Correction 7 — Chat Project Grounding

Status: **P3 NOT GREEN / OWNER-ACCEPTED FOR PHASE 8 SEQUENCING** — see [closeout](closeout.md)
Correction folder: `c7-chat-project-grounding`
Required unchanged package version: `0.7.31`
Activation/source baseline: `2a83c637415f682b91d60babd8f89c6cb896662a`
Phase context: Product Phase 7 Qualified / Closed; post-closeout correction before Phase 8
Authority: ADR 0025 c7-chat-project-grounding amendment, ARCHITECTURE, PRODUCT-MODEL, stability contract and retained Phase 7 closeouts

## Purpose

Make ordinary repository/map questions in Dope Chat deterministically evidence-backed without requiring the developer to manually attach context every time, while preserving the Phase 7 read-only authority boundary.

## Stack

| Prompt | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | project grounding engine, containment, intent, repository/map evidence | T1/T2 | GPT-6 Sol High | no |
| P2 | Chat composition/routing/retry integration + Auto context provenance/UI | T2 | GPT-6 Sol High | no |
| P3 | adversarial direct qualification + correction closeout | T3 | GPT-6 Sol High | yes |

All prompts keep `0.7.31` unchanged.

## Core laws

- No project fact is presented as inspected/verified without supplied current evidence.
- Automatic grounding is deterministic backend retrieval, not model-controlled filesystem tools.
- Repository access is project-relative, realpath-contained and excludes generic `.dope/` access.
- Auto context is visible and durable as turn provenance.
- Automatic grounding is not disabled by the existing default-empty manual `allowedSources` list.
- Hosted egress, Interactive routing, exact selection/no fallback and retry evidence stability remain authoritative.
- No writes, process execution, Git, arbitrary network action or delegation.

## Execution

Validate:
`npm run codex:phase:validate -- c7-chat-project-grounding`

Execute:
`npm run codex:phase -- c7-chat-project-grounding`

The runner owns P1/P2 commits and stops for the P3 browser/manual closeout.

P3's direct browser pass and bounded repairs are recorded in `closeout.md`. Remaining direct and aggregate gates remain open. On 2026-10-05 the owner explicitly accepted these gaps for sequencing into Phase 8 only; this does **not** relabel the correction Green. Phase 8 activation is recorded separately.
