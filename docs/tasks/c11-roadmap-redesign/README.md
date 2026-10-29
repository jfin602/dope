# c11-roadmap-redesign — Gate-first Roadmap model and screenshot-matched editor

**Latest G3 handoff (2026-10-29, d19833b4):** The originally failed zero-health request recognition has a scoped R3 code/Chrome repair and focused tests, but the **full G3 P4 Chrome matrix remains NOT GREEN / EVIDENCE GAP**, and owner-native Electron is unqualified. Do not rerun or duplicate the already-fixed R3 slice by default; finish remaining P4 gates and native disposition, or obtain a new explicit owner-approved sequencing exception, before c11-roadmap-redesign P1. This docs/prompt authoring does not implement the redesign or qualify Phase 11.

**Date:** 2026-10-29 (America/Chicago)
**Status:** /docs-apply + /prompt-ass + /prompt-plan + /prompt-write AUTHORING ONLY on GitHub main. **No product changes, local runner validation, application test, browser/native qualification or version bump made by this authoring.**
**Baseline:** GitHub main `68cdec71af735af1d1a4d60590c345a07890bf82`, project version `0.11.8` at review; recheck actual source/local dirty worktree before Run.
**Authority:** [ADR 0040 Gate domain](../../decisions/0040-phase-gate-roadmap-domain.md), [visual and acceptance contract](../../planning/p11/roadmap-visual-hierarchy-contract.md), [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md).
**Visual target:** owner image `this-style.png` from the 2026-10-29 conversation (attachment is not a repository asset). Dark rounded horizontal phase cards, nested Gate foldouts, clear arrows, restrained orange and evidence-honest progress. No checkpoint nodes.
**Canonical stack:** this directory alone; no second executable visual-hierarchy stack.

## Hard sequencing prerequisite — G3 Chrome P4 currently NOT GREEN

The latest committed [G3 P4 closeout](../c11-g3-recovery/closeout.md) reports **CHROME NOT GREEN** at `68cdec71af73`: user explicitly requested zero-health loss, but coverage reported 'Not in saved request'. G3 P3 is browser-scoped Green; the full P4 matrix and native Electron parity remain open. Do not silently consider G3 closed or run P1 on the strength of P3.

**Required before P1:** independently repair the narrow G3 zero-HP requirement parser defect in its own approved recovery, rerun exact-source G3 P4 to a real Chrome PASS, and record owner-native G3 confirmation; otherwise obtain a **new explicit documented owner sequencing exception** stating which gaps are accepted. P4 failure is not repaired by merely authoring this stack, and neither scope inherits unobserved qualifications. Avoid Phase 12 activation.

## Execute one prompt at a time

| Prompt | Owns | Qualification |
| --- | --- | --- |
| [P1 — Gate domain/authority](P1-gate-domain-authority.txt) | Replace checkpoint schema with separate Phase/Gate/Correction, criterion/evidence/qualification domain | Source/test proofs + mandatory real Chrome smoke, max 3 cycles |
| [P2 — Markdown and AI planning](P2-markdown-ai-planning.txt) | Phase/Gate import, sync, greenfield, Chat/local model, typed approvals; negative task-bullet semantics | Source/test proofs + real Chrome draft/sync, max 3 cycles |
| [P3 — Phase/Gate canvas](P3-phase-gate-canvas.txt) | Exact screenshot hierarchy, nesting, foldouts, arrows, inspector, viewport | Source/test proofs + real Chrome visual/interaction, max 3 cycles |
| [P4 — Qualification/progress/relations](P4-qualification-truth.txt) | Status derivation, evidence freshness, gate-set approval, correction/dependency semantics | Source/test proofs + real Chrome matrix, max 3 cycles |
| [P5 — Dope Help](P5-dope-help.txt) | Existing help registry/Chat grounded in Gates and verified UI paths | Local-Q4 where available + Chrome saved Chat, max 3 cycles |
| [P6 — Cleanup/integration](P6-cleanup-integration.txt) | Delete dead checkpoint paths; cross-feature integration and exact-source acceptance | Focused/aggregate tests + real Chrome integration, max 3 cycles |
| [P7 — Independent closeout](P7-independent-closeout.txt) | Fresh final-source independent Chrome replay and owner-native handoff | Manual Chrome evidence only by default; no fabricated Green |

P1–P6 each have at most **three** bounded implement/repair/qualification cycles, usual implementation target <=8 minutes per slice (never cap actual needed test/GUI observation). Browser required for **each** prompt; if absent, the prompt is BLOCKED/NOT GREEN. P7 independently verifies what the earlier loops actually proved, including negative cases, source/hash and missing native scope. One source-bound final aggregate near P6/P7; avoid repeatedly running full `npm run check`.

## Manual execution

1. Confirm G3 P4 actual Chrome PASS and native result or explicit new owner exception; inspect HEAD, status, version and fresh source. Do not reset/stash/clean/force push or overwrite owner files.
2. Run `npm run codex:phase:validate -- c11-roadmap-redesign` locally. This GitHub authoring has **not run** the validator. No /activate.
3. Manually run P1, then P2, ... P7 **in Codex with connected real Google Chrome browser**; use disposable project roots for mutation/security/negative cases. Ordinary unattended `npm run codex:phase -- c11-roadmap-redesign` is not a substitute for browser-required gates.
4. Between prompts, require explicit PASS on exact source, write evidence in this stack, and stop immediately on unqualified prerequisite. Do not infer native Electron results from Chrome or an Electron build; owner operates native separately.
5. Preserve working authority: single RoadmapStore writer, single saved dockable ChatPanel, in-stage inspector, linked Markdown approval/conflict/relink, actual project source/root/hash, Planning Map, Phase Focus, Work/History, Git and prompt navigation. No unapproved linked-document publication, model provider change, autonomous Work or version bump.

## Alpha removal policy

Remove obsolete checkpoint/milestone Roadmap schema, aliases, prompt/view/projection handlers and dead tests/documents. Do not add a compatibility layer. Unsupported old `.dope` Roadmap index must fail with safe explicit reset/reimport guidance; neither silently clobber original Markdown nor delete game data. Historical qualification evidence can retain its original terminology and should not be relabeled Green.

**Not implemented; not qualified; Phase 11 remains OPEN/NOT QUALIFIED.**
