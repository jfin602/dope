# P2-R1 targeted recovery — source-bound GREEN

Date: 2026-11-02 America/Chicago. Scope: P2 qualification repair only. Pre-repair HEAD `4d53b58fc921c95c8a2fceca85da61ca403d504e` on `main`, initially clean, version `0.12.7`. The existing [P2 NOT GREEN](p2-source-bound-not-green.md) record remains unchanged. P1 is `3cbb49b7dc32038189158901e2465bb20ab7e34d`; P2 is `4d53b58fc921c95c8a2fceca85da61ca403d504e`. Their commit bodies say NOT GREEN and are historical, not retroactive PASS claims.

## Failure and repair

`node --test test/unit/roadmap-gate-chat.test.ts` reproduced 3/4 passing. The saved Chat test failed at its first protected `/roadmap` turn with `Protected native Roadmap tools are unavailable; no proposal was staged`. Its fixture omitted the `ChatProjectGrounder` needed for brokered project tools and expected a retired response-parsed proposal with P3-style Apply behavior. A trial linked-source fixture also exposed that a `synced` document needs an accepted `lastSynced` basis. These were fixture defects; no production persistence or review defect was observed.

Changed only `test/unit/roadmap-gate-chat.test.ts`: the saved Chat scenario now uses `roadmap_read` and two ordered `roadmap_stage` batches through the protected Chat tool broker. Five Phases and four Gates with Criteria in three Phases produce one proposal. The test checks stage/proposal ID, cross-batch parent IDs, 13 changed entities, nine preview steps, exact owner/project/revision/source identity, pending state, source refs, and full serialized validated preview after a fresh backend/repository load. A `/roadmap` response containing proposal JSON without staging creates no proposal. Canonical `.dope/roadmap.json` and linked `ROADMAP.md` bytes remain identical before and after both turns and reload. No approval token is supplied or Apply performed.

Pre-commit diff: one test file, 112 insertions and 222 deletions; the `git diff -- test/unit/roadmap-gate-chat.test.ts` SHA-256 is `1e3fc682dbd4eb052cacfc2c6546a654bdee0fa9bf152056e46c8a05eda2aa94`. `git diff --check` passed. Production source, version, provider, lockfiles, runner, and previous qualification evidence were unchanged.

## Repaired-source checks

- Previously failing file: **4/4 PASS**.
- Relevant P1/P2 and Chat/canvas/store/Pi regression files, run serially to avoid a temporary-directory cleanup race: **123/123 PASS**.
- `chat-backend.test.ts` alone: **16/16 PASS**. An earlier parallel aggregate had 122/123 with `ENOTEMPTY` while removing an unrelated temporary Chat directory; the isolated and serial reruns passed.
- `codex-phase-runner.test.ts`: **84/84 PASS**; parse-only `codex:phase:validate`: **VALID**.
- `npm run typecheck`, `npm run build:extension`, `npm run build:browser`, `npm run check:pi-runtime`, and `git diff --check`: **PASS**.

The P2 prompt marks browser qualification **not required**. Existing source checks cover native stage identity and validation, bounded projection, saved Chat, canvas presentation controls, and no-write before Apply. Connected browser UI behavior, actual selected Dope local-model generation, and native Electron GUI were not observed here; they remain separate P10/manual evidence gaps, not claims made by this source-bound result. The connected browser service twice failed to initialize its request-header policy. A local LM Studio endpoint listed models, but that listing does not prove a selected Dope model turn.

## Runner boundary

The runner's `detectCompletedPromptPrefix` matches exact reachable commit subjects. On this source it recognizes P1 at `3cbb49b7` and P2 at `4d53b58f`, reports `completedCount: 2`, `nextPrompt: 3`, and unchanged version `0.12.7`. A distinct repair commit does not duplicate either marker; do not amend or recreate P1/P2. Resume only from a clean tree after this qualification repair is separately committed. The runner will select P3; this report does not start P3 or assert any later prompt passed.

Disposition: **P2-R1 SOURCE-BOUND GREEN for the P2 runner gate**. Browser and owner-native evidence remain unobserved for their separately designated qualification stage.
