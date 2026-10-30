# P4 Work tool qualification — 2026-10-29

Pre-task HEAD: `8a0e2348c46d175bedc30e49407389ad6883a500` (`0.12.3`); P1–P3 are committed. P4 source is uncommitted for the phase runner. Assigned manifest version: `0.12.4`.

The actual pinned Pi runtime (`1.4.0`) was invoked with a synthetic loopback Local model transport. It selected Dope read, edit and process tools. Dope's broker read `README.md`, edited only the disposable Git candidate, and ran the approved Node test. The canonical clone's `README.md` remained byte-for-byte unchanged before promotion. The Work session exposed exactly `dope_read`, `dope_list`, `dope_edit`, and `dope_process`; project extension discovery did not run. Chat's no-tool session retained zero active tools.

Focused checks passed: `@dope/theia-extension` build; Pi runtime tests (5/5); Pi model bridge tests (5/5); Pi Work invocation fixture; broker read, edit and process security fixtures; pinned Pi integrity check; `git diff --check`. The broker fixtures cover traversal, symlink escape, protected credentials, outside-root and canonical writes, unapproved command forms, network socket denial, changed source basis, and candidate-only effects. The Work fixture also rejects missing, foreign and malformed revisions and a changed authoritative source basis. These are scoped automated checks, not a Phase 12 or B1–B9 closeout.

**Local inference gap:** LM Studio was unavailable at `127.0.0.1:1234` (`curl` connection refused), so no loaded owner-selected model produced this run. The supervised worker child process could not be exercised from this restricted execution environment; a direct child spawn returned `EPERM`. The in-process pinned Pi model invocation and deterministic host transport double passed, but independent real-model and packaged process evidence remains open.

The older `local-agent-integration` fixture was run separately and failed its validation command because this environment denied a socket bind (`PermissionError`); no product correction or Green claim is inferred from it.
