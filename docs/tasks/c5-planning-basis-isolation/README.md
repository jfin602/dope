# Correction 5 — Planning Basis Isolation

Status: **APPROVED / MANUAL ONE-OFF**
Required unchanged version: `0.5.11`
Activation source: `2c21fcf244e42fb806ba01d27c68addc5ffb198e`
Phase context: Product Phase 5 P11 paused / Not Green
Authority: ADR 0019, ADR 0017 where not amended, current Software Map / Visual Planning / stability contracts

## Purpose

Repair false Planning Map staleness without weakening real staleness detection.

The latest P11 run proved two defects:
1. `.dope/planning-maps.json` becomes a TypeScript-analyzer config input and changes the Physical Map fingerprint;
2. generation-only Physical Map refresh is treated as semantic Planning Map change.

## Execution

This correction is deliberately one manual implementation prompt:

`one-off-planning-basis-isolation.txt`

Use GPT-6 Sol High. Do not run this folder through `codex:phase`. There is no separate prompt assessment, implementation plan, or correction closeout prompt; the next P11 rerun is the qualification gate.

## Required repair

- exclude `.dope/` from generic analyzer source/config discovery, including explicit configured-source/reference paths where necessary;
- keep `.dope/architecture.json` represented only by the dedicated declaration fingerprint;
- distinguish semantic Planning Map basis equality from exact observation equality;
- remove generation-only false stale/current failures;
- keep exact generation guards for asynchronous/snapshot concurrency;
- add permanent regressions reproducing the exact P11 sequence and proving real source/canonical changes still stale correctly.

## Scope guard

Do not:
- modify or regenerate the accepted Adaptive SEO sMap;
- migrate/recover the disposable failed P11 planning store;
- change synthesis/provider behavior;
- suppress legitimate source/config/canonical staleness;
- remove exact generation race guards globally;
- auto-rebase Planning Maps;
- redesign persistence or planning ontology;
- run the full P11 GUI qualification inside the correction;
- advance package version.

## Validation

Focused implementation evidence only:
- affected TypeScript analyzer tests;
- Software Map index/backend tests;
- planning rebase/staleness tests;
- visual-planning storage/backend tests;
- planning-map controller/UI tests touched by the change;
- affected package builds/typecheck;
- `git diff --check`;
- exact `0.5.11` / no-root-lock checks.

Do not run full `npm run check`, AppImage/native packaging, providers, or the P11 browser matrix here.

## Exit routing

If focused implementation validation is Green:

`manual c5-planning-basis-isolation -> recreate /tmp/adaptive-seo-dope-p11 -> rerun P11 -> P12 only if P11 Green`.
