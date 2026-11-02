# C2-R3 — Final live recovery qualification

**Disposition: PARTIAL.** On 2026-11-02, one fresh Chat turn passed C2-A's live ranged-read gate; one Work run stopped with an authority denial before later-file retrieval or command execution. C2-B LIVE GREEN and combined C2 recovery scoped Green are **not established**. C1 Prompt Diet is **not cleared** under this gate. The earlier C2-Q NOT GREEN result remains unchanged.

## Exact source and setup

- Product HEAD: `82a8aab780f4148b84f864783b959bdbf047db7f` (`main`), version `0.12.7`; working tree clean at entry. This commit contains the R1/R2 recovery. No product source changed during R3.
- Built `@dope/theia-extension` and `@dope/browser` once, then started one Dope server at `127.0.0.1:3000`. The served `apps/browser/lib/backend/main.js` SHA-256 was `7cce382ea8e09039015f512e31190a35886b9704b672cfb60765874cb8195657`; `apps/browser/lib/frontend/bundle.js` was `680d54d1b6a53f37d7ba621c29f9f02d5f487d5e4a26d822bf6232b7f977a7fd`. One Codex in-app browser tab was used. No external Chrome or Electron was launched.
- The already loaded LM Studio model was `qwen3.5-9b`, Q4_K_M, 16,384 context, parallel 2 (`lms ps`). AI Center reported one usable model after Refresh Models. Chat explicitly selected it; Work selected the same exact local model and displayed observed context 16,384. No model or server setting was changed.
- The C0-R1 `LONG_SOURCE.md` remained 14,339 bytes, SHA-256 `da602862507cbe127c4389d7ce09f8e3505571fc7491cbe62d36c4c8302ffa7f`. The C2-Q Work `CANDIDATE_SOURCE.md` remained 24,509 bytes, SHA-256 `f0b9fdd8f125195e049254dd21f1ca5e552c71cef099093133ead5eb3d1a3d3d`. Expected tail markers were absent from both model-visible task prompts.

## Q1 — Chat: C2-A LIVE GREEN

A new empty saved Chat received the R3 ranged-read prompt exactly once. Saved assistant execution `34bd4ddb-cafc-4e77-ae08-4d2a9a1695ec` records three genuine completed, broker-executed `read_file` calls:

| UTF-8 byte range | Supplied source hash | Saved result |
| --- | --- | --- |
| `0–4,096` | No | Completed; first source identity returned |
| `8,192–12,288` | Yes | Completed; later page |
| `12,288–14,339` | Yes | Completed; ending page, 2,051 included bytes |

All three saved file source references carry source hash `bf722655fc2d103b384cd9507716bfd196dbc5a70afb5ff3be55be682a164d60`. The final page contains the verified fixture ending. The committed final answer correctly gave calibration code `TAIL-NEBULA-9247` and reviewer `Mira Vale`, identified the actual successful ranges, and grounded the values in the ending page. The second call begins **at** 8,192, while the third begins **beyond** 8,192; the latter satisfies the strict gate. No Chat tool error or corrective retry occurred. No command tool was invoked; Commands stayed at Ask.

Provider-reported usage: 4,735 input, 664 output, 305 reasoning, 5,399 total tokens. Saved start `17:26:33.667Z`, finish `17:29:37.057Z`: 183,390 ms. Tool count: 3. This targeted workload is not a like-for-like performance comparison with C0-R1's ordinary tail question.

## Q2 — Work: C2-B LIVE GREEN not achieved

The existing disposable C2-Q project and candidate were reused. The UI showed the local model at 16,384 context; the fixed project execution grant was reviewed and accepted. It allowed workspace read/process/build/test within the fixture and denied network, secrets, private state, outside-root, destructive actions and Git writes. Required validation was `npm test`. The R3 Work prompt was submitted once through New Work, with no marker supplied to Pi.

Saved run `c0aa6dc7-684a-4620-b9f1-364796ea3c1f` started `17:31:22.601Z` and ended `17:32:21.808Z` (59,207 ms). It was bound to local `qwen3.5-9b`, grant ID `84781d0c-2042-4684-8d44-144901d30e28`, revision 1. The event stream records one `read_file` start/end, a second `read_file` start, then provider status and `Execution authority denied`. The run outcome is `authority-denied`.

The persisted Work event and transcript summaries do **not** preserve the requests' raw arguments, successful page boundaries, returned source identity, diagnostic error code, broker-invocation flag, or stop stage for this failure. Thus the first read's exact result and the second request's offset/hash cannot be asserted. The second denial is a real authority stop, not evidence of a correctable parser error or model recovery. No later candidate-file range or file-tail marker is proven to have reached Pi. No `run_command` or `read_command_output` event occurred; the ignored execution counter file is absent, consistent with zero build executions. Work provider token counts and a final Pi answer are unavailable. Dope validation remained `not-started` because the provider/candidate did not reach it.

The saved run reports zero changed task files, empty candidate delta, clean unchanged basis/final HEAD `4d97004565f1e7503960416973761b0f2144c323`, and candidate fingerprint `57d0a3a1a4d62d1a14df906052dee34b178f4b9efc18af8566fd9ed66c5698e3`. The candidate file still has its entry SHA-256. No canonical promotion or unauthorized write was observed. The exact cause of the second denial is not established, so no source repair or second live Work attempt was made.

## Final-source and exit check

The served bundle hashes above were checked after execution. The product working tree was clean before evidence authoring; `git diff --check` passed. The existing focused R1/R2 deterministic qualification remains applicable to this unchanged product source; it was not rerun. The Work fixture Git tree has only its pre-existing untracked `.dope/` metadata, with no tracked change. No C1, C3, Pi compaction, execution-authority or product change was made.

**Independent dispositions:** C2-A LIVE GREEN; C2-B LIVE NOT GREEN on this bounded attempt. **C2-R3 PARTIAL.** C2 combined scoped Green is unavailable, and C1 Prompt Diet should wait for a separately authorized, source-bound Work recovery qualification. The principal evidence gap is the generic persisted Work authority event: it does not identify the denied request's arguments or precise stage.
