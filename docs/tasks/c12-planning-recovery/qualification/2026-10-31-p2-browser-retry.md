# C12 planning recovery P2 — browser retry (NOT GREEN)

Date: 2026-10-31 local / 2026-11-01 UTC. Product version: `0.12.7`. Source HEAD: `84aca10d4a4096c6fe6483cf89623d9ddf24d486`. This run left six product/test files modified and this report untracked; it made no commit or version/provider/lockfile change. The existing Codex in-app browser, local Dope browser server and LM Studio `qwen3.5-9b` at 16,384 loaded context were used. LM Studio Structured Output remained off; it requested a fixed schema and was not used. The requested Qwen3-Coder-30B Q4 model was not loaded. No native Electron qualification was attempted.

## Verdict

**P2 NOT GREEN.** The unlinked preview/reject/approved apply and a human-readable read-only answer passed, as did one linked single-field Markdown patch review and apply. A linked structural request produced unsupported model JSON on the first live attempt. After the fifth repair and rebuild, the retest was blocked by the local Pi tool verification gate before model output. A stale/modified Markdown apply was not exercised in the browser. These gaps prevent the requested linked safety qualification.

## Source and contract

- `roadmap-gate-chat.ts` advertises 19 typed schema-2 actions, one to three atomic actions per `roadmap-gate-proposal`, a 16,000-byte envelope limit, and temporary `new:` IDs bound to owner UUIDs. No replacement plan schema or `submit_plan` route was introduced.
- `ChatBackend.gateProposal` creates a reviewed proposal. A single source-owned Phase/Gate/Criterion field edit uses `RoadmapStore.previewGateDocumentPatch`; linked structural edits require reviewed Markdown synchronization. The fifth repair additionally rejects typed structural or multi-action references to linked source sections before normal Planning preview.
- The five bounded repairs addressed demonstrated malformed action keys/temporary IDs, retry guidance, a read-only answer that the model returned as plain prose, and linked structural guidance/guarding. None bypassed Pi tools, review, source hashes, or approval.

## Browser evidence

### A: unlinked schema-2 Roadmap

Disposable project: `/tmp/dope-c12-p2-unlinked-vRy7wy`, selected `phase-one`. Original `.dope/roadmap.json` SHA-256: `d0529a0ed4057e7fe6ccb1711b64ee43c9a46ae134df7eed011b5a4e304fc7dd`, revision 1.

- A new Chat proposed Gate `G1 · Readiness`, purpose `Verify demo readiness`, with Criterion `Demo works`, expected result `A demo completes without error`. The typed review card appeared. Reject showed `Denied · no change`; the original file hash was unchanged.
- A separate new Chat proposed the same Gate/Criterion. The file was unchanged before approval. Apply showed `Roadmap updated at revision 2`. The saved Gate and Criterion have durable IDs and `unknown` qualification status. File SHA-256 became `b3938edcbb9f2d1b62a7ae302f89c14ee3e56420604d78649305138a169d0aab`.
- A fresh Chat asked only for Gate G1's purpose. After the fourth rebuild it answered, `The purpose of Gate G1 ("Readiness") is to verify demo readiness.` The UI marked `No planning action`; no proposal appeared. The file hash remained `b3938edc...`.
- Earlier model outputs with display names as IDs were rejected with `New Roadmap entities need distinct temporary IDs`. Some initial attempts failed local tool verification. No unapproved write occurred.

### B: linked schema-2 Roadmap and Markdown

Independent disposable project: `/tmp/dope-c12-p2-linked-IPuMHJ`, selected `phase-one`, source-owned `ROADMAP.md`. Initial Roadmap hash `b4f8fd48c0a5c6a3f507265325e8605149ddd5bc09ecb32b4ca1aba64a3e0d71`; initial Markdown hash `a4cad7e98ff072122f7f3e7361e4d174cfcb1c35d16751443e7619e1411c6892`.

- A Chat requested only `gate-one` title `Release check` → `Release readiness`, retaining its purpose. Pi read `ROADMAP.md`. The review card showed exactly that one Markdown heading-line change and the original source hash. Neither file changed before approval. Apply saved Roadmap revision 3 and Markdown hash `e16a9a8a2c68fb0c1e9a320405e0cf9bd5242d48635a35e2acc28563075331cf`; Roadmap hash became `a9f0e0fc640dbdacb2b72fac7acce3ed4650be6ad3e57c6781eef15daf8221b5`.
- A structural request to remove `gate-one` and its Criterion made two read-only `ROADMAP.md` tool calls, then returned unsupported `{"type":"final",...}` describing deletion as if it could be approved. Dope showed `Unvalidated local planning output`; the two files retained the exact post-apply hashes. This is a truthful no-write failure, but not the required usable refusal/review-sync guidance.
- The fifth rebuild added explicit linked-structure guidance and a deterministic typed-action guard. The live retest ended before model output with `Verify Local agent execution in AI Center before using tools`. A manual AI Center synthetic tool check reported `Local tool capability: supported`; the next Chat turn again failed the gate. No fifth-cycle live structural result or stale-source browser result is claimed.

## Verification and limits

Each of five repair cycles was rebuilt and tested before the next browser attempt. On the exact final source, `npm run build:browser` passed with zero browser/node errors, `npm run typecheck` passed, and the four focused Roadmap test files passed **27/27**, including source drift after preview, competing publication, temporary IDs, schema-2 no-action, and linked source reference coverage. `git diff --check` passed. The two disposable linked files retained the post-apply hashes above at close. These source tests do not substitute for the missing browser stale-source replay.

Only `gate.create` with inline Criterion, `gate.edit`, read-only no-action, and the rejected linked structural request were exercised through Chat in this retry. The other advertised action families, >3 action rejection, stale project/lease, sync conflict, protected file, independent native Electron UI, and broader Phase 12 remain unqualified here. P1's previously recorded scoped Green is preserved without relabeling this P2 result.

Smallest next work: make the automatic local tool probe stable across a refreshed connection and subsequent Chat turn, then replay linked structural refusal and preview→source drift→Apply in the same disposable browser fixture. Do not mark P2 Green until both are observed without unauthorized publication.
