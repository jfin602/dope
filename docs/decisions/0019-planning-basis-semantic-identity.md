# ADR 0019 — Planning basis semantic identity and observation generations

Status: Accepted
Date: 2026-10-01
Builds on: ADR 0009, ADR 0017
Amends: ADR 0017 planning-basis/staleness semantics

## Context

Phase 5 P11 created durable Planning Maps on an accepted Adaptive SEO workspace. Writing `.dope/planning-maps.json` then caused the Software Map to report changed inputs even though source and canonical architecture were unchanged. A subsequent reanalysis advanced the Physical Map generation and the unchanged Planning Maps were marked stale.

Two implementation facts caused the failure:
- analyzer-specific input discovery treated Dope-owned `.dope/` JSON as generic configuration input;
- Planning Map stale/current checks treated the Physical Map generation as semantic identity rather than observation provenance.

ADR 0017 originally stated that a Planning Map becomes stale when either the Physical Map input fingerprint or generation changes. P11 demonstrates that this is too strong: generation can advance while the software inputs remain identical.

## Decision

### Dope project state is not generic Physical Map input

Dope-owned state beneath `.dope/` is excluded from generic language-analyzer source/config discovery and fingerprinting. This includes Planning Maps, Project Mind data, synthesis work, initialization markers and other Dope metadata.

`.dope/architecture.json` remains canonical architecture authority. It affects the Software Map through the dedicated architecture reader and declaration fingerprint, not because it happens to be JSON beneath `.dope/`.

A future analyzer may use a Dope-owned artifact only through an explicit typed product contract that preserves provenance and avoids recursive self-invalidation; generic filesystem/config discovery is not such a contract.

### Planning basis distinguishes semantics from observation

A Planning Map may continue storing:
- canonical architecture revision/fingerprint;
- Physical Map input fingerprint;
- Physical Map generation.

Their meanings differ.

**Semantic planning-basis identity** is the canonical architecture identity plus the Physical Map input fingerprint. This answers: did the software/canonical basis meaningfully change?

**Physical observation identity** additionally includes the published generation. This answers: is this request/result tied to the same concrete Physical Map snapshot?

Generation-only advancement with identical semantic basis is not stale.

### Where generation remains authoritative

Generation remains an exact concurrency/provenance guard for:
- paged graph queries;
- late asynchronous results;
- snapshot assembly/read consistency;
- preview/accept flows whose result must match the exact observation on which it was calculated;
- any operation where mixing generation N and generation N+1 data could publish an incoherent result.

These guards do not imply semantic staleness.

### Staleness

A Planning Map becomes semantically stale when its canonical architecture identity or Physical Map input fingerprint changes. Explicit comparison may then localize source, relationship, hierarchy, identity and contract differences to affected transformations/branches.

Unchanged reanalysis may advance generation and refresh observation provenance without marking the plan stale.

### Comparison discipline

Code should expose named comparison semantics rather than repeatedly using raw whole-object equality:
- semantic-basis equality ignores generation;
- exact-observation equality includes generation.

Exact names and placement are implementation details, but consumers must choose the comparison that matches the product question.

## Consequences

Planning persistence no longer changes the Physical Map it references. Reanalysis can safely produce a new observation generation without falsely invalidating unchanged plans. Legitimate source/config/canonical changes remain detectable, while generation continues protecting snapshot/race consistency.
