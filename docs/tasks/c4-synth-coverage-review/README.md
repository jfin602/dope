# Correction 4 — sMap Coverage + Iterative Review

Status: **APPROVED / PROMPT STACK READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Docs authority commit: `10d01373096458e4614bd4e1b2216fe3789997f6`
Assessment: `77e379f9f7e86d17c69f35b5304802d2054b0268`
Plan: `416dbc7ec42357e3dbca8e6d547a0782b167cbdd`
Predecessor: owner-closed / Not Qualified `c4-synth-improvements`
Authority: ADR 0015 plus ADR 0014 as amended 2026-09-30 and ADR 0008-0013 where not amended

## Purpose

Close the architecture-quality gaps exposed by the real Adaptive SEO Gemini run without discarding the useful responsibility-oriented hierarchy and center review already implemented.

The correction makes coverage inspectable, lets Subsystem Challenge recover omitted source-backed responsibilities, makes empty Component descent explicit, retains every provider call attempt, and lets the developer **Search Deeper** on one System or Subsystem without replacing unrelated review work.

The initial repository-global synthesis now resolves an optional root `MODULES.md` first. When present, `MODULES.md` is the preferred **Documented** architecture seed; root `README.md` remains secondary project orientation. When `MODULES.md` is absent, onboarding recommends creating it but preserves **Continue with README** or repository-only analysis paths. A portable **Prepare this repository for Dope** prompt may bootstrap `MODULES.md` from another AI environment without modifying application code.

`MODULES.md` is bootstrap-only: it does not become canonical architecture and is not continuously synchronized. After explicit acceptance, `.dope/architecture.json` remains canonical; later `MODULES.md` changes cannot silently reshape the sMap.

## Stack

| Prompt | Work | Validation | Browser/live provider |
| --- | --- | --- | --- |
| P1 | provider-attempt ledger + bounded Gemini retry | T1 | no |
| P2 | MODULES/README bootstrap + docs evidence + coverage ledger + omitted-responsibility recovery | T1 | no |
| P3 | typed Component-descent + coverage diagnostics | T1 | no |
| P4 | branch-local Search Deeper integration | T2 | no |
| P5 | direct center-review correctness qualification | T3 | browser |
| P6 | multi-repository live architecture qualification + consolidated expensive validation | T3 | browser + Gemini |
| P7 | evidence-only correction closeout | T3 audit | no new live runs |

All prompts use `GPT-6 Sol High` and keep package version exactly `0.4.6`.

## Core invariants

> `MODULES.md` is preferred bootstrap architecture intent, not proof or canonical state.

> Root README is secondary orientation, not proof.

> Documentation tells Dope what the project says; implementation/runtime evidence tells Dope what is observed; synthesis is inference; the developer owns canonical architecture.

> Coverage diagnostics do not become target-count scores or deterministic architecture.

> Search Deeper refines one current edited review branch and requires explicit preview Accept/Reject.

> Every actual provider attempt remains visible, including failures and retries.

## Qualification targets

P6 must cover:
- pinned Adaptive SEO;
- an uncontaminated Dope benchmark root;
- one smaller structurally clear repository/fixture.

Each generated hierarchy is frozen before independent expected architecture/reference material is consulted.

Repository-owned `MODULES.md`, ordinary README and current docs are legitimate synthesis context under their documented authority levels. Qualification must cover MODULES+README, README-only and no-bootstrap-doc flows, plus stale/conflicting documentation. Historical task/qualification/answer-key material is excluded by default.

Green does not require exact names/counts. It requires material implemented responsibilities to be represented or explicitly unresolved, typed Component descent, useful review refinement and <=8-minute review-ready initial analyses.

## Routing

If P7 closes Green, route to a fresh bounded `c4-smap-provider-comparison` correction, then `c4-smap-storage`.

Do not reopen closed corrections and do not activate Phase 5 early.
