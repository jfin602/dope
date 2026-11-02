# P3-B Q3 protected skill and selective context — 2026-11-01

**Q3 GREEN for the reduced four-gate contract. P3-B Core remains NOT GREEN pending Q4.** Q1 and Q2 GREEN remain applicable; this change does not alter their action, approval, lease, or writer paths. Historical NOT GREEN reports remain unchanged.

## Source and repair

- Entry was clean `main` at `a019cf5777828e0ae9174730d8efd17592ba07c4`, version `0.12.7`. The attributable product repair is limited to the selected Roadmap Element context builder and its composer call. Neither B-R2 Chat publication nor Pi tool permissions, Commands Ask/Allow, model settings, dependencies, or version changed. The local Q3 commit identifies the final source; nothing was pushed.
- Final product/test diff SHA-256 before commit: `d335b865bd604a678311acbeab14ba60e809c0d20f042e6f9ae7e745eadc3bc6`. The final browser bundle SHA-256 is `d2e8ded6bd6600bbe9c1ba86a970c16b3aa09033b1d1cf0603b2e008a8dd38d0` (unchanged from the bundle served for Chrome C1–C3).
- A selected Gate or Criterion previously carried its own fields and parent but no sibling order for a relationship edit. The repair adds ordered sibling IDs, designations, and ordinal values only when the current request is an order/move/reparent request. A move to a named Phase also includes the matched destination Phase identity and current Gate order. A normal field edit still excludes sibling content. The existing complete selected entity and linked-source metadata remain intact. If required selected context exceeds the input budget, composition raises an error before model transport or proposal review.

## Deterministic qualification

- The protected built-in `/roadmap` is reserved from user skill creation/edit/deletion. Exact built-in ID, version, body, and digest are required for the bound snapshot. Only a leading slash command resolves it; quoted or mid-message slash text does not. Backend tests show one current-turn instruction injection, no unskilled proposal, and a rejected protected retry before a second model call. Q2's stale snapshot, lease, project, revision, source, and replaced-proposal tests remain source-applicable.
- An unrelated ordinary Chat composition performs zero Roadmap reads and includes no typed edit grammar. Selected read-only Gate context includes current purpose, parent, criteria, and revision without the edit grammar or an actionable proposal. Explicit unselected `gate-50` resolution, selected Gate resolution, and ambiguous shared Gate-name refusal are covered by the existing focused suite.
- A deterministic 90-Gate fixture exceeds the normal compact preview size. A selected G1 field edit includes its full current Gate/criterion facts while omitting unrelated Gate purposes; a relationship request includes complete sibling order without sibling bodies. The assembled prompt, including the actual built-in skill text, passes the conservative **16,384-context / 2,048-output / 13,568 serialized-input-byte** bound. An oversized mandatory selected purpose fails before transport rather than being truncated. Optional older Chat exchanges already carry explicit omission diagnostics. No model summarizer or selector was added to context assembly. Composer token counts are estimates; the serialized-byte gate is the final deterministic bound.

## Connected Chrome comparison

Connected Codex Chrome used disposable schema-2 project `/tmp/dope-p3b-q3-bj4f6o1e`, saved Chat `1d20e36e-7116-4469-b44a-998f8c30ecfe`, and the existing LM Studio `qwen3.5-9b` Q4_K_M instance loaded at 16,384 context and parallel 2. Commands remained Ask. The browser served the built bundle before the selected-element-only repair; C1–C3 use the unchanged generic selected-Gate route, while the changed Roadmap Element route is covered by final-source deterministic tests. This is a source-applicable browser result, not a claim that the later bundle bytes were replayed in Chrome.

| Turn | Observed result |
| --- | --- |
| C1 ordinary read-only | “What is the purpose of Gate G1 in this Roadmap?” saved a current revision-1 `gate-g1` context reference, no skill snapshot. The model answered **Check first phase**, correctly placing G1 in Phase B and citing its criteria. No proposal appeared. Provider-reported input: 1,220 tokens; composer estimate: 705. |
| C2 protected edit | `/roadmap Update G1's purpose to clarify its readiness requirement.` saved `builtin:roadmap` version 1 with its current body digest and a revision-1 G1 reference. The model identified `gate-g1`, original purpose, `phase-b`, and unchanged title. Backend validation produced one `gate.edit` review card and matching provisional canvas purpose. Provider-reported input: 2,323 tokens; composer estimate: 2,271. Before and during preview, canonical revision stayed 1 and SHA-256 stayed `e93e562d74abc61805d9efa3b106a9f99f7477048877f163ad00216b1e55cec0`. Reject changed the card to “Rejected · no change”; revision/hash stayed unchanged. |
| C3 ordinary follow-up | “Briefly explain what a checksum is.” saved **no skill snapshot** and returned a normal checksum explanation. The explicitly pinned G1 read-only context remained attached, but no edit grammar, proposal, or old approval control returned. Provider-reported input: 1,464 tokens; composer estimate: 1,043. Canonical revision/hash remained 1/`e93e562d74abc61805d9efa3b106a9f99f7477048877f163ad00216b1e55cec0`. |

The selected C1/C3 context was user-pinned; it was one Gate, not a wholesale Roadmap injection. The ordinary unselected no-read path is separately asserted deterministically. There was no live Apply in Q3 because Q1 already proved it. The Electron build is a build check only; native Electron GUI remains unverified.

## Final-source checks and disposition

Focused Skills, Chat context, schema-2 protected proposal, selected element, local budget, and owner action suites passed **55/55**. Typecheck, browser build, Electron build, and `git diff --check` passed on the final source. The final staged diff was checked before the scoped local commit.

**Q3 GREEN:** the current-turn skill boundary, selective read/edit context, required-field completeness, no-truncation budget behavior, and representative Chrome read/edit/reject/ordinary sequence meet Q3. Q4 still requires independent Chat/Roadmap UI integrity qualification. B-R2 Chat publication remains untouched; no push was performed.
