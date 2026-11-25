# c14 Work segments P2 — independent browser qualification blocked

Date: 2026-11-25, America/Chicago. Overall verdict: **BLOCKED; no segmented Work behavior qualified**.

## Exact source and entry

- Product HEAD: `5a067c1875ba4018e9c9c784d7237115b79d508d`; version: `0.13.11`.
- P1 and pre-existing owner changes remained uncommitted. The tracked product-code and focused-test diff at 09:29:11 CST had SHA-256 `efccd879310afc3c1ff016f02a8e76b1127b901caee41f31558ad697ae66f9e0` (the diff is the listed modified `packages/agent-core`, `packages/contracts`, `packages/theia-extension`, and six focused `test/unit` files). Historical c14 P4 report/screenshots and c14 segment prompts remained untracked and untouched.
- Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, the 2026-11-25 Work conversation amendment, this task README, P1's reported result, and the historical c14 P4 browser report. P1 reported affected builds and 45/45 focused tests passing, plus 9/9 final navigation/runtime checks; these are **P1-reported**, not independent P2 browser results.
- Independently ran `npm run build:browser` on this dirty source: PASS, zero browser/node bundle errors. No product code was changed in P2.

## Actual browser attempt

At approximately 09:24–09:28 CST, launched the newly built Dope browser backend at `http://127.0.0.1:3001` and used the connected Codex in-app browser. AI Center showed the LM Studio connection `ready · 1 usable model`; its Models view showed `unsloth/gemma-4-26b-a4b-it-qat` as local/ready. The local LM Studio inventory identified that loaded model as trained for tool use. **The model's loaded context and Dope's coding-tool probe were not observed**, so eligibility for this P2 Work run was not established.

Opened the disposable Git project `/tmp/dope-c14-segments-p2-fixture` through Dope's File > Open dialog. Its baseline was `cbe0293ea674bbf43719509de3958297b4e7b111`, with `README.md` containing `cedar` and `.dope/` ignored. A harmless canary `/tmp/p2-parent-canary.txt` was prepared for the outside-root denial case; it was never submitted to Pi. The fixture remained clean and no `.dope/` state or AgentRun was created.

The `Dope: Open Work` command opened a Work tab, but it displayed **“Phase Stack could not attach to this project.”** Clicking **Retry connection** returned to Connecting and then the same attachment error. Clicking **Back to Select Work** displayed **“Work is unavailable.”** Another Work activity action timed out, after which the Codex browser inventory returned no connected browsers, including after a session reset. Dope and LM Studio processes remained listening locally, but the required connected browser was unavailable. There is no screenshot or saved Work receipt from this attempt; the quoted UI states were observed through the browser accessibility tree. A direct API or mock run would not satisfy this prompt.

## Case verdicts

| Requested case | Verdict | Evidence limit |
| --- | --- | --- |
| 1. No-effect Pi denial, same-composer fresh segment, separator and run IDs | BLOCKED | Work never reached setup or a Pi run. |
| 2. Two-message FIFO queue, terminal Send, panel/backend restart persistence | BLOCKED | No Work session or message ID existed. |
| 3. Candidate review, next segment basis, unresolved gate, Stop | BLOCKED | No candidate or run existed. |
| 4. Controlled uncertain interruption and inline reconciliation | BLOCKED | No in-flight run existed; browser disconnection is not evidence for this case. |
| 5. Per-segment model/tools/grant/sandbox, inline model change and negatives | BLOCKED | AI Center readiness alone did not establish a Work grant or segment. Second eligible loaded model, source drift and hostile Send were not tested. |
| 6. Docks, keyboard, scroll, hostile text and theme | EVIDENCE GAP | Only the Work entry error was seen in a normal browser window. Native Electron, hosted one-shot labeling, touch and screen-reader behavior were not observed. |

## Narrow follow-up entry

First restore a connected Codex browser and establish that **New Work/Select Work opens for a fresh disposable Git project** on this exact P1 source. Diagnose the observed Phase Stack attachment/Work unavailable state if it repeats, without altering this report. Then replay P2 cases 1–6 in the real UI with the bundled Pi worker, verified eligible model/context, timestamps, screenshots, saved run/message IDs and candidate receipts. Any product repair requires a fresh exact-source replay of affected cases. The historical c14 P4 result is not proof of P1 segmented behavior.

No self-commit, follow-on Run, version change, Phase close or Roadmap Gate award occurred.
