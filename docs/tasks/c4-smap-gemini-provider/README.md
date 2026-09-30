# Correction 4 — Gemini Provider + Compact Shared sMap Pipeline

Status: **APPROVED / PROMPT STACK READY — execute after `c4-smap-hierarchical-synthesis` truthful closeout**
Correction folder: `c4-smap-gemini-provider`
Required unchanged version: `0.4.6`
Predecessor: `c4-smap-hierarchical-synthesis` after truthful closeout
Authority: ADR 0013; ADR 0004 and ADR 0009-0012 where not amended
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24

This correction does two deliberately coupled things:

1. remove prose-heavy model-to-model state from hierarchy-first sMap synthesis and replace it with strict compact provider-independent intermediate JSON; and
2. add Gemini 3.8 Flash through AI Studio API keys as an explicit provider beside Local, then compare both providers on the same corrected pipeline before any aggressive Local-specific optimization.

## Stack

| Prompt | Work | Model | Browser/live provider |
| --- | --- | --- | --- |
| P1 | compact shared intermediate contracts + deterministic review assembly | GPT-6 Sol High | no |
| P2 | Gemini adapter + provider-independent timing/token telemetry | GPT-6 Sol High | no real provider |
| P3 | provider-neutral backend selection, secret handling, collapsible Local/Gemini setup + progress metrics | GPT-6 Sol High | focused UI tests only |
| P4 | real Local/Gemini same-pipeline comparison + consolidated full qualification | GPT-6 Sol High | yes |
| P5 | evidence-only closeout | GPT-6 Sol High | no live reruns |

All prompts keep project version exactly `0.4.6`.

## Product invariant

> Deterministic evidence is authority. Intermediate synthesis exchanges compact typed architectural state. Local and Gemini implement the same contracts. Provider choice is explicit. The developer owns canonical architecture.

## Compact stage rule

Intermediate outputs contain only downstream-required state:
- stage/version/packet/view identity;
- temporary candidate IDs;
- System/Subsystem/Component kind, name, parent and short bounded responsibility;
- evidence/provenance and ownership refs;
- confidence;
- typed ambiguity/unresolved codes;
- typed candidate relationships;
- challenge mappings;
- unresolved items/verification status.

Do not carry model-authored rationale essays, sibling-distinction prose, arbitrary uncertainty paragraphs or reconciliation messages between stages.

Human-readable review text is derived outside the provider data bus from typed state/evidence.

## Provider rule

Local and Gemini:
- use the same stage schemas;
- see the same deterministic planning semantics;
- receive no provider-specific architecture contract;
- never silently fall back to one another.

Gemini uses the Gemini Developer API / AI Studio key path. A key may come from `GEMINI_API_KEY` or session-only entry. Never persist or expose the secret.

## Measurement rule

Every provider call records:
- stage/subject/provider/model;
- duration;
- request/output bytes;
- input/output/total tokens when available;
- token measurement source: provider-reported/tokenizer/estimated/unavailable;
- cache reuse;
- retry/error state.

Dope orchestration owns timing. Do not represent Local estimates as exact merely to match Gemini metrics.

## Testing discipline

P1-P3 use focused permanent tests plus minimum compile/typecheck feedback.

Do **not** repeatedly spend time on full `npm run check`, restart matrices, Electron packaging, browser dogfooding or live provider runs after each implementation prompt unless focused evidence reveals a cross-cutting failure.

P4 performs the real Local/Gemini comparison and consolidated expensive qualification once.

P5 reads exact P4 evidence and does not rerun live synthesis merely to replace missing evidence.

## Controlled comparison

Before Local-specific chunking/compression work, compare Local and Gemini using:
- the same benchmark repository commit;
- the same deterministic packet/planner version;
- the same compact stage contracts/order;
- the same evidence-selection rules;
- the same validation/reconciliation/verification bounds.

Prefer the existing clean Adaptive SEO benchmark clone selected for the hierarchical P8 work so results are comparable to earlier evidence.

Record architecture quality, candidate hierarchy, unresolved state, stage timings, token/input/output volume, model-call count, provider-call time, deterministic/planning time and total elapsed time.

## Scope guard

No:
- automatic provider fallback;
- provider voting/debate/ensemble;
- per-stage mixed-provider routing;
- aggressive Local-specific chunking/compression heuristics;
- Gemini account/billing UI;
- persistent plaintext/API-key preference storage;
- general AI Presence/chat/tools;
- Phase 5 visual canvas;
- Theia upgrade.

## Exit gate

Green requires:
- compact strict intermediate contracts with no surplus prose;
- same contracts and validators for Local/Gemini;
- Gemini 3.8 Flash real AI Studio-key path;
- secret non-persistence/non-leakage;
- explicit collapsible Local/Gemini setup;
- no silent fallback;
- comparable per-stage token/time telemetry;
- real same-pipeline Local/Gemini qualification;
- source-backed materially reviewable architecture;
- Local regression safety;
- final browser/restart/package/repository checks;
- unchanged `0.4.6`.

After Green closeout, route to `c4-smap-storage`, not directly to Phase 5.
