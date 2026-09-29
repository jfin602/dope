# Correction 4 Closeout — sMap Architecture Synthesis

Status: **OWNER-CLOSED / NOT QUALIFIED**
Owner disposition date: 2026-09-29
Correction authority name: `c4-architecture-discovery`
Execution folder: `c4-smap-synth`
Unchanged package version: `0.4.6`
Terminal implementation/evidence source: `0f94b0e3ba46e395394acdb5badc00dd092b37d0`
Superseding forward authority: ADR 0012 and `c4-smap-hierarchical-synthesis`

## Disposition

The owner closes this stack as complete historical work without qualifying it Green.

P1-P6 established useful product substrate:
- provider-independent synthesis/proposal contracts and strict source-reference validation;
- deterministic ArchitectureEvidencePacket generation;
- deterministic Theia/Inversify framework extraction;
- local LM Studio/Qwen discovery, structured-output probe and pre-project warm-up;
- explicit sMap initialization/canonical-acceptance lifecycle;
- Analyze Project onboarding, review/correction and manual/existing-architecture paths.

P7 then exercised the real local Qwen path and exposed the architectural-design defect that now governs forward work.

P8 is not executed as a success closeout. This document records the explicit owner disposition instead.

## P7 result retained as historical evidence

The exact P7 evidence is `docs/tasks/c4-smap-synth/P7-smap-synth-evidence.md`.

The important observed facts are:

- the real LM Studio/Qwen reference path connected, probed and warmed successfully;
- the first full request was about 95,870 tokens and was rejected by the then-loaded 32,768-token context;
- the compacted request reached Qwen and returned schema/reference-valid JSON after about seven minutes;
- semantic quality was unacceptable: the proposal produced only **Browser System** and **Electron System**, no Subsystems or Components, and reused weak/unrelated evidence;
- no generated proposal was accepted as canonical architecture;
- a later prompt revision was cancelled at the owner's direction rather than being used to continue tuning the one-shot design;
- controlled warm-up failure correctly blocked project-evidence submission;
- useful provider/UI repairs were committed in the terminal P7 source;
- final restart/package/native/acceptance/manual-path evidence remained incomplete.

This is a **core architecture-quality failure**, not merely a context-size failure.

## Gate disposition

| Gate | Disposition |
| --- | --- |
| Deterministic evidence + provenance | Green enough as predecessor substrate |
| Framework extraction | Green enough as predecessor substrate |
| Local provider probe/warm ordering | Green enough as predecessor substrate |
| Strict schema/reference validation | Green enough as predecessor substrate |
| Initial System discovery quality | **Not Green** |
| Full acceptance/restart/manual qualification | Evidence Gap |
| Final corrected package/native qualification | Evidence Gap |
| Phase 5 eligibility | **Blocked** |

A valid JSON response is not sufficient when the generated Systems are materially wrong.

## Forward route

The next mandatory correction is `c4-smap-hierarchical-synthesis` at unchanged `0.4.6`.

It replaces one-shot architecture inference with:
- deterministic bounded evidence planning;
- repository-global System Discovery;
- an explicit System Challenge merge/split/reject pass;
- per-System Subsystem/Component descent;
- reconciliation and targeted verification;
- provider-aware context budgeting;
- user-visible stage/call-purpose progress;
- stage/call timing;
- a <=8-minute end-to-end initial-analysis qualification objective with no eight-minute runtime cutoff.

The current local Qwen qualification setup is 65,536 loaded context. That is headroom, not a Software Map constant and not a request-size target.

`c4-smap-storage` remains queued until the hierarchical correction closes Green. Product Phase 5 remains inactive.
