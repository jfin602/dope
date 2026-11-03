# Engineering qualification and safe progression — detailed forward contract

**Date:** 2026-11-03 (America/Chicago). **Decision:** [ADR 0048](../../decisions/0048-engineering-qualification-ratings-and-progression.md). **Status:** APPROVED DESIGN / DOCS ONLY; not implemented, run or qualified. **Follow-on:** [c12-qualification-reporting](../../tasks/c12-qualification-reporting/README.md). Preserve existing [stability contract](../../stability-contract.md), actual runner safety checks and immutable historical evidence.

## 1. Three axes, plus per-case results

| Axis | Values | Meaning |
| --- | --- | --- |
| Implementation | not-started; in-progress; partial; implemented | Whether the actual intended behavior exists; an implemented feature still may be unqualified |
| Verification | not-assessed; qualified; scoped-qualified; evidence-gap; failed; blocked | Best truthful aggregate for an explicit **declared scope**; retain multiple per-case results underneath |
| Progression | continue; conditional; hold; stop | Whether the *next named task* may safely begin, based on a verified dependency set rather than the aggregate label |
| Attribution (per failure) | introduced-regression; verified-pre-existing; flaky-or-environmental; obsolete-assertion; unattributed | Why an individual test failed, with reproducible proof and known impact |

Per-case results: `PASS`, `FAIL`, `NOT RUN`, `BLOCKED`, `EVIDENCE GAP`, `NOT APPLICABLE` (with rationale). A `qualified` summary must cover every mandatory case for the chosen scope. `scoped-qualified` must explicitly name reduced scope and any omitted cases; it never becomes broader GREEN by implication. Verification status can reflect multiple cases but does not erase individual results.

**Reporting grammar:** `Implementation: Implemented | Verification: Evidence Gap (browser) | Progression: Conditional (P8 backend only)`, followed by the tested source identity, blocking prerequisites, explicit owner decision and assigned later qualification. Never use “mostly Green” as a substitute for evidence. `Partial` must name missing functionality, not merely absent testing.

## 2. Dependency-specific progression rules

For each Pn, record:
- **Required to start**: concrete type/API/data/permission/source invariants consumed by Pn, with evidence of their existence.
- **Required to call this Pn qualified**: exact test, security, browser and persistence acceptance.
- **Deferred to a later gate**: specifically named nonblocking evidence, not a generic future promise, with its owner and due stage.
- **Hard-stop conditions**: unsafe or nonfunctional prerequisite (e.g. missing archive, unverified owner lock, broken source writer, data-loss risk).

A later implementation may proceed **conditionally** when its consumed interface and safety properties are verified, even though prior UX or native-device evidence remains pending, *only* after a recorded explicit scope decision when it differs from a previous approved stop requirement. The new decision preserves the earlier NOT GREEN result. An unimplemented prerequisite that the next step genuinely consumes is HOLD; security failure or unsafe corruption is STOP. A known failed optional check can be deferred only when truly outside the bounded next scope and a follow-up qualification remains mandatory. An unattributed failure is not auto-waived.

## 3. Evidence provenance and failure attribution

Every claim requires the actual candidate HEAD/diff/dirty state, package version, exact test/build command and result, observable UI/backend/source action, relevant file/hash/fixture identity, runtime/model selection when applicable, and explicit NOT RUNs. Unit tests do not count as connected browser observation; browser builds do not prove native Electron GUI; an agent's narrative does not prove approved file bytes.

- **Introduced regression:** current failure attributable to this candidate, reproduced versus verified same-environment baseline or directly confirmed changed behavior; repair or explicitly block relevant scope.
- **Verified pre-existing:** demonstrate comparable baseline failure or reliable prior source-bound record; preserve ownership and issue ID, not hide failure.
- **Flaky/environmental:** show repeat/reproduction conditions, tooling/host prerequisites and impact; a nondeterministic test potentially indicating data loss or race remains safety-relevant until investigated.
- **Obsolete assertion:** document the approved contract changed and confirm new assertion tests the same surviving behavior; never simply delete a meaningful test.
- **Unattributed:** report failure and unresolved impact; do not call PASS or claim unrelated from guesswork.

Test-suite summaries always display total tested/pass/fail plus separate attributable blockers, baseline debt and unobserved cases. Project-wide failures should not automatically make every unrelated component “broken,” but project-wide release/phase GREEN must still respect its own explicit full-suite criteria.

## 4. Human approvals and nonnegotiable invariants

A model never approves itself, chooses its own coverage/waiver or grants its own continuation on a previously binding stop. Conditional progression decisions require explicit recorded owner/delegate authority, exact task(s), why the next operation is safe, and named remaining obligations. No unsafe source write, data corruption, cross-project leakage, stale approval, privilege bypass, missing core owner interface, fabricated proof, or changed source identity may be waived with a softer rating. Avoid casual wording such as “waived Gate”; a sequencing exception is **not** qualification or an evidence waiver.

Dope's product Roadmap Phase/Gate/Criteria statuses and GREEN semantics under ADR 0040 remain unchanged. The engineering runner's statuses are separate metadata and never mutate product Roadmap qualification/evidence.

## 5. Future runner receipt schema (conceptual, not shipped)

The runtime must decide exact safe versioned representation after inspecting local code; do not treat the example as an existing API:

```json
{
  "schemaVersion": 1,
  "stack": "c12-example",
  "prompt": "P3",
  "source": { "head": "exact-sha", "dirtyDigest": null, "version": "0.12.7" },
  "implementationStatus": "implemented",
  "verificationStatus": "evidence-gap",
  "qualificationScope": "typed backend preview and atomic application",
  "cases": [
    { "id": "stage", "result": "PASS", "evidence": "immutable-path-or-id" },
    { "id": "chrome", "result": "EVIDENCE GAP", "evidence": null }
  ],
  "attribution": [],
  "progression": {
    "decision": "conditional",
    "next": "P4",
    "prerequisitesVerified": ["owner lock", "typed preview"],
    "remaining": ["Chrome UI -> final closeout"],
    "approvedBy": "recorded authorized developer decision"
  },
  "checkpoint": { "commit": "exact-checkpoint-sha", "verified": true }
}
```

Source/trust boundary: a proposed classification returned by Codex is **untrusted input**. Runner independently validates actual command outcomes, checkout state, output integrity, existence of referenced evidence and approval provenance. Never let a JSON field override real failures or existing workflow permission gates. Once written, receipts are immutable/append-only; corrections are new linked decisions with actor/source/time, not overwritten older records. Avoid secrets and absolute user paths in publishable receipts.

## 6. Runner dashboard, checkpoint and resume contract

- Display distinct `IMPLEMENTED · QUALIFICATION PENDING`, `PARTIAL`, `EVIDENCE GAP`, `BLOCKED`, `FAILED`, and `QUALIFIED` based on separately verified fields. Never display `PASSED` based on commit existence alone. Existing markers should appear as `historical checkpoint committed · qualification unknown` unless verified independent receipts are available.
- A prompt that safely stops on a real prerequisite with zero diff must end `BLOCKED: named missing dependency` (no false `implementation completed / commit failed`). A legitimate no-change pass requires independent demonstration the contract is already satisfied, not an empty marker.
- Implement safe `--stop-after Pn` or equivalent optional stop (including after qualified or reviewed conditional continuation) while preserving current version, Git, dirty-tree, prompt snapshot and source-bound commit controls. Do not auto-run Pn+1 when explicitly stopped. A stop is not an automatic qualify/commit.
- Progression uses the exact next Pn's consumed prerequisites, not every case in the previous stage; known critical failures still prohibit progress. Permit manually recorded owner-approved conditional decisions without pretending scoped GREEN.
- Keep historic commit-prefix detection as a provenance input; qualification receipt and current dependency decisions are separate. Do not reinterpret preexisting Git subjects or original reports silently.
- The current runner code **does not implement this policy**. Before Q2 qualifies, use human-reviewed evidence and existing strict runner behavior; do not rely on aspirational states or claim automatic safe continuation.

## 7. Representative qualification and migrations

Test cases for Q2/Q3:
1. Commit exists with final report NOT GREEN => display implemented/pending or partial; never auto-qualified by subject.
2. No-diff safe prerequisite stop => BLOCKED with precise reason, zero fake commit.
3. Missing essential service/source owner => HOLD/STOP; cannot conditional-continue on nonexistent dependency.
4. Verified backend API with unobserved browser-only unrelated case => owner-authorized conditional next backend implementation, deferred browser gate preserved.
5. Security/data-loss failure => STOP regardless of passing test count or user urgency.
6. Failed broad suite attributable to unrelated pre-existing Work/UI or environment => separate debt with baseline evidence; never silently turn suite GREEN.
7. Version/hash changed, stale receipt, forged approval, conflicting Git history, edited prompt during run, hidden dirty tree => fail closed.
8. `--stop-after Pn` does not start next prompt; legit checkpoint and report survive restart/resume; manual closeout still needs actual connected browser.
9. Exact-source success and reduced-scoped owner disposition => separate scoped qualification from broader unqualified phase.
10. Saved older NOT GREEN qualification => immutable; later scoped requalification linked, never retroactively rewritten.

## 8. Adoption boundary for c12-roadmap-sync

P6 can be represented as Partial (pencils work; structural creation/form parity absent). P7 as Implemented with core history browser evidence but gaps. P8 as scoped source-qualified. P9 as Partial, including native revision-zero staging gap; missing this is an actual architecture blocker for one-request Roadmap. Full c12-roadmap-sync GREEN requires the approved end-to-end user workflow, secure persistence and qualified relevant browser evidence, not just 93/93 source tests. Retain the existing manual P10 prompt; revise its *future invocation contract* only through a separately reviewed, not-yet-executed amendment after Q2 qualification. No redesign of product Roadmap Gate GREEN.
