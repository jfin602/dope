# Cycle 2 — future generated prompt authority

**Verdict: BLOCKED for real-agent qualification; source and grammar checks passed.** Starting and ending HEAD `12a2df3b7f922f9cc5f76493b30e3d0d4a0d2f15`, version `0.11.8`; product/test changes uncommitted, with pre-evidence diff SHA-256 `149923bd63c3df20b80feacdcfe6642f97de807c63e4d6c9d09cee9204c29181`.

The original P2 transcript in the [prior qualification](../../c11-planning-bridge/qualification/2026-10-18-stack-authoring-execution.md) records an agent treating the draft's no-Run/no-write sentence as a veto after an explicit Work grant; its required test file was never created. The exact old P1–P3 files and hashes in the disposable project were left unchanged.

`phase-stack-composer.ts` now says authoring/preview/approval grants no execution, while a developer-started Dope Work task with an accepted ExecutionGrant can carry out its bounded assignment. It states that runtime permissions, source restrictions, validation and decisions remain authoritative. Future generated prompts also carry the reviewed delegable and human-reserved path lists for candidate review. `planning-correction.ts` compares these fields when composing a correction from current WorkItems.

Changed files for this cycle: `packages/agent-core/src/phase-stack-composer.ts`, `packages/theia-extension/src/node/planning-correction.ts`, and `test/unit/phase-stack-composer.test.ts`.

Focused composer tests passed: deterministic generated text, import through the existing Work grammar, runner plan parsing, version policy, immutable source representation, and the new authority/path wording. No actual fresh P2-like model task has run under this text. No grant or candidate decision was made by the agent in the browser.

**Next action:** Use a new reviewed stack identity with matching Roadmap phase, then obtain a separate developer Work Start/grant and observe the model create and validate the required test file. A passing text assertion is not proof of model behavior.
