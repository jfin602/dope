# Pi Chat continuity recovery — cycle 1 (2026-10-30)

**Status: NOT GREEN / live request inspection gap.** The original P8 and the earlier provider-recovery dispositions remain unchanged. This cycle found no confirmed context-delivery defect, so it made no product repair.

## Exact source and environment

- Product HEAD `2c4c1028f601e8507a8bee418e5b7efe616566de`, clean at preflight and after Chrome testing; Dope version `0.12.7`. The previous worker-path and failed-test-feedback repairs are already committed in this HEAD.
- Bundled Pi `@earendil-works/pi-coding-agent` `1.4.0`. Selected AI Center connection `21d03643-2aca-407e-b090-af59979b6c2f`, Local LM Studio model `qwen3-coder-30b-a3b-instruct@q4_k_m`. `lms ps` reported the model IDLE at loaded context `32768`, CPU device, parallel `4` after the three turns. No model or quantization change.
- Running browser backend bundle SHA-256 `f986564158f18fac018e00427e3ddd8bbed2f61d01de88bcd17bdc3aec7626dc`; served and local frontend bundle both SHA-256 `e27f97a5dbd278f0d13bcc01375bf85ff27d0aae6e33c7f6e0c3d6d7dafa1143`. The extension TypeScript output was rebuilt during test investigation, without source changes or a browser backend restart.

## Diagnosis and request-context evidence

- The saved Chat ID was `ad7cd24d-012e-412f-9739-14d360e1cf0d` in the disposable `/tmp/dope-p8-ts-1bUVkx` fixture. Its first two completed pairs persisted in user, assistant, user, assistant order, with distinct message IDs. The third pair also completed and remained visible in Chrome.
- `ChatBackend.runTurn` composes against the saved Chat before appending the new user and pending assistant. `ChatContextComposer.compose` selects completed prior assistant turns and prior user turns in chronological order. `piConversation` creates an ephemeral tool-free Pi host per request; `worker.mjs` appends those prior turns to Pi's in-memory session before prompting. Pi's installed SDK projects these entries into model context. Recreating the Pi session is therefore not, by itself, a loss of Dope Chat history.
- A read-only replay of `ChatContextComposer.compose` against the saved Chat state immediately before the third request yielded exactly `[user(Copper Lantern/otter), assistant(first answer), user(first follow-up), assistant(second answer), user(second follow-up)]`, 699 estimated input tokens of the 8192 Chat budget, before automatic project grounding. `npm run test:pi-runtime` passed 9/9; its no-tool test captures an OpenAI-compatible request body containing a prior assistant message and verifies no tool definitions. This is structural request-construction evidence, **not** a capture of the exact live LM Studio HTTP body for these Chrome turns.
- The saved user turns showed one automatic `project-orientation` reference. Qwen's first two answers speculated about a browser game and described a project listing, although the test only asked it to remember a name and mascot. The listing claim was not used as evidence of conversation transport correctness.

## Real connected Chrome result

At `http://127.0.0.1:3000/#/tmp/dope-p8-ts-1bUVkx`, one existing docked ChatPanel created the disposable Chat. Each turn explicitly selected `LM Studio · qwen3-coder-30b-a3b-instruct@q4_k_m`; Chrome showed complete local provenance for each response.

1. `My fictional project is called Copper Lantern, and its mascot is an otter. Remember these details for this conversation.` → completed; the answer acknowledged both facts, then added unsolicited game advice.
2. `What is my fictional project's name and mascot?` → completed; the first sentence correctly named `Copper Lantern` and `otter`, then added unsupported game speculation.
3. `Earlier, what two details did I ask you to remember? Answer in one sentence.` → completed with `You asked me to remember that your fictional project is called "Copper Lantern" and its mascot is an otter.`

Chrome showed one ChatPanel, no Work controls invoked, and all six messages in order. The fixture's tracked source remained unchanged. No cancellation or browser reload was attempted in this cycle.

## Focused tests and classifications

- `npm run test:pi-runtime`: **9/9 PASS**.
- A nearby Chat test batch passed 28/31 after rebuilding extension output. Three existing failures were `automatic investigation references hash only bytes included in the measured context` (budget rejection) and two hosted-routing tests (hosted consent rejection). They were not altered or represented as continuity passes; their relation to this local Qwen path is not established.
- Context delivery: **EVIDENCE GAP for the exact live provider request**; source reconstruction and synthetic provider-body test pass.
- Context-based recall: **PASS in this bounded three-turn Chrome conversation**.
- Session identity: **PASS for same saved Dope Chat ID and explicit local model**; ephemeral Pi session IDs were not exposed.
- Chat persistence: **PASS for ordered saved messages in this cycle**; restart/reload remain untested.

Cycle 2 will test a fresh six-turn conversation and navigation lifecycle. No speculative history rewrite is justified by this cycle.
