# C13 P7 implementation evidence — 2026-11-05

Pre-task HEAD: `94f37e8aa1cb81a905fbf1924fd8d6b73a9a012e`. Project version remains `0.13.8`. This report describes uncommitted working-tree changes; the phase runner owns the implementation commit and its resulting source identity.

The existing Chat skill registry now exposes protected `/docs-review` and `/docs-apply` built-ins. The backend binds exact built-in snapshots at send time, rejects forged saved identities, and keeps literal slash examples inert. Explicit review performs bounded project `.md`/`.txt` inventory and keyword/heading discovery, gives the selected local Pi model brokered read tools, records actual read coverage and omissions, and stages only an eligible P5 source-bound diff. Brokered command execution is denied during review. Ordinary Chat/Work receives no new documentation scan. `/docs-apply` checks for exactly one current pending proposal and leaves the unchanged P6 publisher behind the separate saved proposal card's developer Apply decision; command text never approves or writes. The existing P6 journal and applied-only History owner remain the publication path.

Verification on this working tree:

- `npm run build:extension` — passed.
- `corepack yarn workspace @dope/browser build` — passed.
- `corepack yarn workspace @dope/electron build` — passed.
- `corepack yarn workspace @dope/theia-extension build` after final backend edit — passed.
- `node --test --test-concurrency=1 test/unit/chat-backend.test.ts test/unit/chat-skills.test.ts test/unit/chat-panel.test.ts test/unit/documentation-skills.test.ts test/unit/documentation-skill-backend.test.ts test/unit/documentation-review.test.ts test/unit/documentation-application.test.ts` — 7/7 test files passed. A focused backend fixture also passed after adding the quoted-literal check.
- `git diff --check` — passed.

The fixture verifies brokered initial and late-page reads, pending review with unchanged bytes and no applied History, deterministic `/docs-apply` with no write, separate exact approval, retained approved bytes and one documentation History entry. P5/P6 focused tests retain stale, foreign, symlink, collision, linked Roadmap, recovery and applied-only History coverage.

Remaining gap: P8 must run the manual connected real-browser documentation journey and Work consumption on the runner's committed final source. This implementation report does not award product GREEN or Phase completion.
