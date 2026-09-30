# Correction 4 — sMap Synthesis Improvements

Status: **APPROVED / QUEUED**
Correction folder: `c4-synth-improvements`
Required unchanged version: `0.4.6`
Activation source: `8ea34ae1300a387ac63aad9462ae649ac78a9605`
Predecessor: owner-closed / Not Qualified `c4-smap-gemini-provider`
Authority: ADR 0014 plus ADR 0008-0013 where not amended
Theia: `1.75.0`; Electron: `42.8.1`; Node: 24

## Purpose

Correct the shared sMap synthesis design so the hierarchy represents software responsibilities rather than reproducing repository layout or frontend/backend technical tiers.

The Adaptive SEO Gemini result is diagnostic evidence, not an answer key:
- one top-level System is plausible;
- Backend/Frontend Subsystems are materially weak;
- stronger responsibilities span client/server/worker/persistence/delivery boundaries.

## Intended stack

1. responsibility-oriented deterministic planning + stronger System support;
2. Subsystem-only discovery + bounded Subsystem Challenge + Component descent;
3. orchestration/reconciliation updates + center-editor tree review;
4. real Gemini Adaptive SEO requalification and consolidated expensive checks;
5. evidence-only closeout.

All prompts keep package version exactly `0.4.6`.

## Core invariants

> Architecture follows responsibility, not folder/runtime topology.

> Deterministic responsibility signals guide synthesis but never become architecture authority.

> Establish one hierarchy level before descending to the next.

> Developer review and explicit acceptance remain the only canonical transition.

## Qualification reference

Pinned benchmark:
- root: `~/dev/adaptive-seo-dope-p8`
- source: `jfin602/adaptive-seo`
- SHA: `0b26a25107be7d8dfb2210bc7258ccac8603197e`
- push remains disabled.

A credible result may contain one Adaptive SEO System. Green does **not** require a particular count or exact names.

Green does require meaningful Subsystems/Components that reflect source-backed responsibilities crossing technical layers where appropriate.

## Review UX target

The review opens in the center editor area as an indented hierarchy tree. The left sMap sidebar remains setup/progress/navigation.

Selecting a tree node exposes its editable detail/evidence. Do not render the entire proposal as one giant repeated form stack.

This is not the Phase 5 visual map canvas.

## Scope guard

No benchmark-specific hard-coded domain names, no fixed System/Subsystem count, no hidden architecture-doc answer key, no aggressive Local-specific chunking/compression, no mixed-provider voting/debate, no general Agent Runtime, and no Phase 5 Planning Map canvas.

## Routing

If Green, route to a fresh bounded provider-comparison qualification before `c4-smap-storage`. Do not reopen the closed `c4-smap-gemini-provider` correction.
