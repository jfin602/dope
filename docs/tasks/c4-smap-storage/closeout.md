# c4-smap-storage closeout

Status: **GREEN / QUALIFIED**
Date: 2026-09-30
Exact P2 output candidate and pre-P3 HEAD: `bb91abc00171d51e544a46a6392a0a7715ea44d7`
Package: `0.4.6` (unchanged)

P2 qualified the P1 product source at `1cad776ba742ea7cfb8af07c0c833c01c170d460`, then added only the Dope marker and its evidence file. The P2 output commit contains no product-source change, and the working tree had no product-source drift at P3 preflight.

| Gate | Disposition | Evidence |
| --- | --- | --- |
| A. Canonical project truth | Green | Production `readArchitecture` reads project-local `.dope/architecture.json`; `readInitialization` requires the schema-1 `.dope/smap.json` fingerprint to match its exact bytes. Dope's current architecture SHA-256 and marker fingerprint are both `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`. No machine-local state participates in this read. |
| B. Copy/reopen portability | Green | P2's focused regression passed 1/1: accepted fixture copied with `.dope/` to a distinct temporary root; a fresh analyzer/index/backend reported initialized and recovered identical System, Subsystem, Component IDs and containment. |
| C. Derived rebuild | Green | The fresh backend rebuilt a ready Physical Map from copied source/config and canonical architecture. Editing copied source changed generation and input fingerprint; both durable files retained their exact bytes. |
| D. Machine-local/transient separation | Green | The fresh backend had no synthesis provider, model, credentials, session, cache or UI state. Source keeps review, evidence, Physical Map, coverage, attempts and Search Deeper state transient; P1 added only a regression test and P2 added only the marker/evidence, with no new persistence subsystem or derived artifact. |
| E. Isolation and fail-closed recovery | Green | The sibling copy without `.dope/` stayed uninitialized and could not analyze; root switching invalidated the prior handle. Five focused existing guards passed for local reads, project isolation, malformed/mismatched markers and symlinked state; malformed/symlink tests preserve declaration bytes, and read paths do not rewrite them. |
| F. Dope dogfood | Green | The P2 output tracks `.dope/smap.json`. P2 invoked production `SoftwareMapBackend.acceptExisting` on Dope's existing tracked declaration; it returned ready. A separate fresh backend and production `readInitialization` reported initialized, without a synthesis provider. The declaration bytes were unchanged. |
| G. Version / phase boundary | Green | Package is `0.4.6`; no root `package-lock.json`. Provider comparison remains deferred, Phase 5 remains inactive, and no broad storage subsystem was added. |

## Validation and limits

P2 evidence: [portability qualification](P2-portability-qualification-evidence.md). Its exact focused commands passed 1/1 for copy/reopen and 5/5 for fail-closed/isolation. P1's permanent regression passed on unchanged product code. P3 ran `npm run codex:phase:validate -- c4-smap-storage` (valid), `git diff --check` (pass), package-version/no-root-lock checks (pass), and checked the exact architecture SHA-256 against the tracked marker. P3 did not repeat P2 qualification or run provider, browser, full-suite, restart-matrix or packaging checks.

**Residual storage-only gaps: none.** Earlier synthesis quality and provider-comparison gaps remain in their owner-closed Not Qualified corrections; this closeout does not relabel them or claim broader release qualification.

**Decision:** `c4-smap-storage` is Green/Qualified for its project-local persistence contract. Next is the bounded Dope logo-palette/application-color alignment. After that step, begin a fresh Product Phase 5 `/docs-review`; Phase 5 implementation remains inactive until its own approval path.
