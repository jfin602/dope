# c11-bridge-repair — Manual qualification cycle ledger

**Status:** Templates/procedure only; no loop has been run or qualified by authoring these documents. The original owner's uncommitted P15 `closeout.md` and `qualification/p15-manual/evidence.json` belong under `../c11-planning-bridge/` and must be preserved unchanged on the user's local checkout.

## Family directories created only when actually run

- `p1-identity/cycle-1.md` (and at most cycles 2–3 if an observed repair warrants them)
- `p2-first-test/cycle-1.md` (exact original test A identity; zero-code-change replay if already repaired)
- `p3-second-test/cycle-1.md` (independent original test B identity)
- `p4-electron/cycle-1.md` (real native GUI evidence, or explicitly BLOCKED)
- `p5-final/` for final exact-source screenshots/log hashes and D1–D8/PB1–PB8 matrix

Each actual cycle must record source SHA/version/tree/worktree, reported vs inspected evidence, exact input/test assertion, before/after, owner authorization, changed paths/compiled outputs, focused command results, browser/native steps, security negatives, outcome (PASS/FAIL/BLOCKED/NOT RUN), and follow-up. Preserve prior cycles append-only and keep original P15 Not Green. Do not invent fixture screenshots/logs or create a faux PASS based on a built Electron app.

The final `../closeout.md` is created **only after manual P5** and holds the sole repair-stack Green/Not Green/Evidence Gap decision for the fully approved Bridge scope; it never rewrites original P15 or owner-closes Phase 11.
