# c14 Work redesign P3 runtime retry — scoped PASS

Date: 2026-11-24 America/Chicago (2026-11-25 UTC). Source parent: `5dd3db2ecc380c1ba76b5da97c5bbefda73d8314`, the P2 checkpoint. Product version: `0.13.11`, unchanged. The original runner receipt at `.codex-runs/c14-work-redesign/2026-11-25T04-13-44-285Z/P3.final.txt` remains `PARTIAL` historical evidence; this report records the subsequent manual verification and checkpoint.

## Reviewed result

P3 changes the saved Work session, task and runtime paths in `packages/agent-core` and `packages/theia-extension`. Never-delivered queued messages remain eligible for FIFO delivery after reviewed recovery; a message already entering delivery is abandoned rather than replayed. Linked follow-up uses a new reviewed task and grant within the sealed model, tool, permission and sandbox ceiling. A separate fork creates a new task with source-run provenance and fresh review. Saved continuation context includes recorded turns and warns when legacy or incomplete transcript evidence is unavailable. Candidate review, grant and Roadmap evidence remain with their existing owners.

The runner passed typecheck, agent-core/theia-extension/browser/electron builds, and 13 focused store, Work, grant, candidate, History and Roadmap suites, but could not bind the real Pi fixture in its sandbox. A retry in the current environment bound the fixture's automatically assigned loopback port. Its first run exposed a stale fixture: the new continuation rule preserves the original accepted objective while allowing fresh instructions; the fixture used a new objective. `test/unit/work-session-runtime.test.ts` now uses the same objective with new instructions for linked follow-up and deliberate recovery. It also checks that an uncertain in-flight message is not replayed and a safe queued message is delivered once.

## Verification

- `node test/unit/work-session-runtime.test.ts` — PASS, 1/1 real Work service test after the fixture correction.
- `npm run codex:phase:validate -- c14-work-redesign` — PASS; P4 remains the manual browser closeout.
- `git diff --check` — PASS.
- `package.json` — `0.13.11`, unchanged.
- Runner P3 receipt — typecheck, four changed-package builds and 13 focused suites PASS on this P3 implementation before the fixture correction. No product source changed after those checks.

**P3 verdict: PASS for the amended persistence, compatibility and security integration scope.** This is a correction-stack implementation checkpoint, not independent connected-browser proof, native Electron GUI parity, product Roadmap Gate GREEN or Phase 14 completion. P4 must verify the real browser on this exact source. The authored prompts and original runner artifacts remain unchanged.
