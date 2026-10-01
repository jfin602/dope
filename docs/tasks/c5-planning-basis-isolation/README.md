# Correction 5 — Planning Basis Isolation

Status: **APPROVED / READY FOR EXECUTION**
Correction folder: `c5-planning-basis-isolation`
Required unchanged version: `0.5.11`
Activation source: `2c21fcf244e42fb806ba01d27c68addc5ffb198e`
Phase context: Product Phase 5 P11 paused / Not Green
Authority: ADR 0019, ADR 0017 where not amended, current Software Map / Visual Planning / stability contracts

## Purpose

Repair false Planning Map staleness without weakening real staleness detection.

The latest P11 run proved two defects:
1. `.dope/planning-maps.json` becomes a TypeScript-analyzer config input and changes the Physical Map fingerprint;
2. a generation-only Physical Map refresh is treated as semantic Planning Map change.

## Scope

- exclude `.dope/` from generic analyzer source/config discovery, including explicit configured-source/reference paths where necessary;
- keep `.dope/architecture.json` represented only by the dedicated declaration fingerprint;
- distinguish semantic Planning Map basis equality from exact observation equality;
- remove generation-only false stale/current failures;
- keep exact generation guards for asynchronous/snapshot concurrency;
- add permanent regressions reproducing the exact P11 sequence and proving real source/canonical changes still stale correctly.

## Stack

| Prompt | Work | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | implement input isolation + planning-basis semantics + permanent regressions | T2 | GPT-6 Sol High | no |
| P2 | evidence-only correction closeout | T2 audit | GPT-6 Sol Medium | no |

Both prompts keep package version exactly `0.5.11`.

## Scope guard

Do not:
- modify or regenerate the accepted Adaptive SEO sMap;
- migrate/recover the disposable failed P11 planning store;
- change synthesis/provider behavior;
- suppress legitimate source/config/canonical staleness;
- remove exact generation race guards globally;
- auto-rebase Planning Maps;
- redesign persistence or planning ontology;
- run P11/P12;
- advance package version.

## Exit

Green means Dope metadata writes and unchanged reanalysis no longer stale Planning Maps, while real software/canonical changes still do and exact snapshot-generation protections remain intact.

After Green closeout, recreate `/tmp/adaptive-seo-dope-p11` from the accepted reference and rerun P11.
