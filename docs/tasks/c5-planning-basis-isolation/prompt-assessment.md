# Correction 5 Prompt Assessment — Planning Basis Isolation

Status: **APPROVED / READY**
Correction folder: `c5-planning-basis-isolation`
Required unchanged package version: `0.5.11`
Activation source: `2c21fcf244e42fb806ba01d27c68addc5ffb198e`
Authority: ADR 0019 and current Phase 5 Software Map / Visual Planning contracts

## Conclusion

Use exactly two ordered prompts:

1. **P1 — Planning basis isolation implementation.** Fix analyzer `.dope/` contamination, separate semantic basis equality from exact observation equality, and add permanent regression coverage.
2. **P2 — Evidence-only closeout.** Audit the exact P1 candidate using focused evidence only. Do not run P11 inside the correction.

P1 uses GPT-6 Sol High because the repair crosses language analysis, Software Map fingerprinting and Visual Planning stale/concurrency semantics. P2 uses GPT-6 Sol Medium.

## Current source findings

### Analyzer-specific input discovery violates the Software Map boundary

`SoftwareMapIndex` fallback filesystem fingerprinting already skips `.dope`, but `TypeScriptAnalyzer.inputPaths()` supplies an analyzer-specific source/config list and its ignored directory set omits `.dope`.

The same method adds every discovered JSON file to `configFiles`. Therefore project-local Dope JSON under `.dope/` can enter `configFingerprint`. The analyzer's normal config walk uses the same ignored set, so `.dope` must be excluded consistently.

The correction must also consider explicitly configured source files/project references: adding `.dope` only to recursive discovery is insufficient if a tsconfig explicitly includes a path beneath `.dope`.

Canonical architecture is already read separately by `SoftwareMapIndex` through `readArchitecture()` and contributes `declarationFingerprint`, so `.dope/architecture.json` does not need generic config discovery.

### Generation is currently used as semantic stale identity

`PlanningMapController.basisMatches()` requires current status generation to equal the stored Planning Map generation in addition to architecture/input fingerprints.

`stalePlanningMap()` sets `physicalChanged` when either the Physical Map input fingerprint **or generation** changes.

This makes unchanged reanalysis falsely stale the map even after `.dope` contamination is fixed.

### Whole-basis equality serves two different jobs

Visual Planning currently uses whole-basis JSON equality in several places. Some are true optimistic-concurrency/snapshot guards and should continue to include generation. Others answer semantic stale/current questions and should ignore generation.

P1 must audit at least:
- `PlanningMapController.basisMatches()` and edit/undo/redo gating;
- `stalePlanningMap()` / `previewRebase()` behavior;
- Planning Map creation snapshot comparison;
- reconciliation/closeout stale checks;
- backend/store preview/rebase/adoption equality checks.

Do not mechanically replace every exact comparison. Introduce or reuse explicit semantic-vs-observation helpers so each caller states its intent.

## Required regression shape

The permanent integrated regression should reproduce P11:

`analyze -> create Planning Map -> write planning-maps.json -> inputs remain current -> unchanged reanalyze -> generation advances -> fingerprint unchanged -> map not stale -> editing remains available`.

Then prove the opposite with a real source/config change and canonical architecture change.

## Fixture policy

The two Planning Maps currently present in the disposable P11 workspace were created under broken basis semantics. They are qualification artifacts, not compatibility data. Do not build migration code for them.

After correction closeout, P11 should recreate `/tmp/adaptive-seo-dope-p11` from the accepted reference.

## Main risks

- fixing only `.dope` discovery while leaving generation-only false stale;
- globally ignoring generation and weakening race/snapshot consistency;
- hiding real source/config/canonical changes;
- special-casing only `planning-maps.json` instead of enforcing the `.dope` boundary;
- using raw whole-basis equality where the product question is semantic staleness;
- expanding into PlanningMap schema migration or persistence redesign.

## Green definition

Green requires both absence of false stale and preservation of true stale/race behavior at unchanged `0.5.11`.
