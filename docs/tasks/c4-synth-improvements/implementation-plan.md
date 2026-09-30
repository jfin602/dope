# Correction 4 Implementation Plan — Responsibility-oriented sMap Synthesis

Status: **OWNER-CLOSED / NOT QUALIFIED — HISTORICAL PLAN; P5 UNEXECUTED**
Correction folder: `c4-synth-improvements`
Required unchanged package version: `0.4.6`
Activation source: `8ea34ae1300a387ac63aad9462ae649ac78a9605`
Authority: ADR 0014

## Preflight

Read:
- BOOT.md / AGENTS.md;
- ADR 0008-0014;
- current ARCHITECTURE / PRODUCT-MODEL / roadmap / storage authority;
- `c4-smap-gemini-provider/closeout.md`;
- pushed `P4-local-gemini-comparison-evidence.md`;
- exact current synthesis planner/contracts/orchestrator/provider prompts/UI.

Require:
- package exactly `0.4.6`;
- activation source reachable;
- clean intended Git state;
- old hierarchical P8/P9 remain unexecuted;
- closed Gemini-provider correction is not reopened.

## P1 — Responsibility-oriented evidence planning and System support

Preserve the complete ArchitectureEvidencePacket.

Add deterministic responsibility-oriented planning metadata derived only from existing source-backed evidence. Candidate mechanisms may include recurring semantic/domain concepts across source areas, public/HTTP contracts, worker/job registrations, state ownership, external delivery boundaries, framework registrations and dependency communities.

Every derived responsibility signal must retain source evidence refs and remain reproducible/rebuildable. It is guidance, not architecture truth.

Do not hard-code Adaptive SEO concepts.

Improve global/per-System planner selection so source-area diversity does not itself bias synthesis toward frontend/backend/package boundaries.

Strengthen System support:
- direct production behavior must support System responsibility;
- root manifest/start-script/config/topology evidence may supplement but not solely establish responsibility;
- System Challenge explicitly tests a one-System candidate for umbrella collapse;
- one System remains valid when source evidence supports one coherent product responsibility.

Add controlled fixtures for:
- one genuinely cohesive System;
- several Systems in one repository;
- umbrella-collapse candidate;
- frontend/backend directories that belong to one System responsibility.

## P2 — Subsystem Challenge and separate Component descent

Advance shared stage/prompt/cache identity.

Change per-System lower hierarchy to:
1. Subsystem Discovery — Subsystems only;
2. Subsystem Challenge — explicit keep/merge/split/reject;
3. Component Discovery — Components only inside stabilized Subsystems.

Subsystem Challenge must test whether proposed boundaries mainly mirror technical planes such as client/server/frontend/backend/HTTP/database/framework/repository/worker/package/directory without independent responsibility evidence.

Do not ban these words or structures mechanically. Reject only unsupported technical-layer promotion.

Preserve compact provider-independent JSON and bounded typed ambiguity/finding codes.

Add permanent fixtures proving:
- one responsibility spans client + server + worker files;
- a bad Frontend/Backend first pass is corrected into responsibility-oriented boundaries;
- a legitimate execution-platform Subsystem can survive when it owns independent behavior;
- Components cannot escape challenged parent Subsystems.

## P3 — Orchestration/reconciliation and center-editor review

Update orchestration/progress/telemetry for new stages:
- subsystem-discovery;
- subsystem-challenge;
- component-discovery.

Update reconciliation to reason about stabilized System/Subsystem/Component hierarchy and detect technical-layer/ownership conflicts without using path labels as canonical truth.

Maintain bounded verification and provider-independent telemetry.

Replace the stacked review form with an editor-like center workspace review:
- indented System -> Subsystem -> Component tree;
- node selection;
- focused detail/evidence editor;
- rename/add/remove/reparent and merge/split-equivalent developer correction;
- evidence/source navigation;
- explicit Accept.

Canonical ID and raw roots are secondary/advanced fields.

Keep left sMap sidebar for setup, provider progress, status and Open Architecture Review navigation.

Do not implement Phase 5 diagram/layout/Planning Map behavior.

## P4 — Real Gemini Adaptive SEO requalification

Browser/live Gemini required.

Use the exact pinned benchmark `~/dev/adaptive-seo-dope-p8` at `0b26a25107be7d8dfb2210bc7258ccac8603197e`, clean with push disabled.

Use an explicitly selected and successfully probed Gemini generation model; record exact model ID.

Capture:
- deterministic packet/planner/responsibility-signal summary;
- System Discovery + Challenge;
- Subsystem Discovery + Challenge;
- Component Discovery;
- reconciliation/verification;
- full per-stage timing/token/byte telemetry;
- end-to-end elapsed time;
- final hierarchy;
- representative evidence refs/source navigation;
- center-editor tree review behavior;
- developer correction/acceptance negative/positive controls.

Freeze the generated hierarchy before comparing with developer architecture docs/reference material.

Architecture Green requires materially credible responsibility boundaries, not exact reference names/counts. Frontend/backend-only decomposition is Not Green unless direct evidence establishes those as independent responsibilities.

Keep <=8 minutes as the end-to-end performance objective, not a hard timeout.

Run consolidated expensive validation once on the exact final candidate:
- focused correction tests;
- `npm run check`;
- `npm run test:restart`;
- correction prompt validation;
- unchanged-version/no-root-lock/Theia/Electron/internal-reference checks;
- Linux AppImage/package/native launch evidence where required;
- `git diff --check`.

Do not run Local comparison in this correction.

## P5 — Evidence-only closeout

Audit exact P4 candidate/evidence without repairing product behavior or rerunning live synthesis merely to fill gaps.

Gates:
A. responsibility-oriented deterministic planning;
B. System support / one-System umbrella challenge;
C. Subsystem Discovery quality;
D. Subsystem Challenge effectiveness;
E. Component descent;
F. reconciliation/provenance/verification;
G. real Gemini architecture quality;
H. timing/token/performance objective;
I. center-editor review / developer authority;
J. regression/restart/package/version/phase boundary.

Green requires all mandatory gates Green.

If Green, route to a new bounded provider-comparison correction. Do not reopen `c4-smap-gemini-provider`.

## Non-goals

No Adaptive SEO-specific domain dictionary in synthesis, no forced boundary counts, no architecture docs as model input, no aggressive Local optimization, no provider ensemble/mixing, no general AI Presence and no Phase 5 visual planning canvas.

## Owner close amendment — 2026-09-30

Execution stopped after P4 by owner decision. P4 is Not Green on architecture quality; P5 is cancelled and unexecuted. Preserve this plan as historical intent rather than rewriting it to match later work.

The mandatory successor is `c4-synth-coverage-review` at unchanged `0.4.6`, governed by ADR 0014's September 30 amendment.
