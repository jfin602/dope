# H2 — History evidence preview readability

**Run:** 2026-10-16 America/Chicago. **Disposition:** UX-010 **SCOPED GREEN for the deterministic browser/local preview** on the uncommitted candidate below. Phase 11 remains **OPEN / NOT QUALIFIED**. This report supplements [H01](h01-history-usability-hunt.md) and [H1](h1-history-continuation-diagnostics.md); it does not overwrite either result.

## Exact candidate and change

- Git HEAD: `1732626b6aa9d33db52019ce75eef330470d6464`; package version `0.11.8` unchanged. The worktree was clean before H2 and is uncommitted after H2. H1's changes were already in HEAD and were preserved.
- Product changes: `packages/theia-extension/src/browser/history-presentation.ts`, `history-widget.ts`, `dope.css`. Focused test change: `test/unit/history-context-preview.test.ts`. SHA-256 of the listed-order `sha256sum` output for these four files: `17c5511625d46e70aa5c7ddbc07b35cdfe881c4743336d47c5eac412188eaa51`. Documentation is excluded from this fingerprint.
- Before: a single line foregrounded category, owner kind, source ID, raw event/observation timestamps, fingerprint and evidence basis. After: each selected item has a numbered safe title, factual activity summary, known status, readable event/observation time when available, and explicit unknowns. Per-item source IDs, fingerprints and raw timestamps, plus preview basis, project ID, byte/token diagnostics and the full privacy contract, remain in collapsed, keyboard-expandable technical disclosures. No preview schema, evidence collector, backend, model route or permission changed.
- The presentation reads only the existing bounded `HistoryContextPreview`. Dirty-tree text states that uncommitted changes were detected, while author, exact change time, contents and diffs remain unknown. Chat/Planning metadata is called an observation, not completed development work. Work run state, validation, review and promotion are displayed as separate known fields when supplied by the existing summary.

## Validation actually run

| Gate | Result |
| --- | --- |
| Build | `npm run build --workspace @dope/theia-extension` and `corepack yarn workspace @dope/browser build` passed on the final product source. |
| Focused tests | 21/21 passed across History preview, local understanding, panel, integration and projection. They cover bounded bytes/tokens, excluded titles/contents, no preview on open, explicit confirmation, local-only routing, cancellation/timeout, stale basis, project isolation and read-only owner behavior. `git diff --check` passed. |
| Real browser | Rebuilt Dope at `http://127.0.0.1:3011` with disposable project A `/tmp/dope-p11-h2-CABagU` and empty project B `/tmp/dope-p11-h2-other-gVuHig`. The final browser bundle was loaded after the last product change; the dirty-tree and Chat cards were observed together on that exact bundle. |

## Direct browser observations

1. Opened History, selected the dirty-tree activity and clicked **Preview selected evidence**. The normal collapsed view led with “Working tree changes,” a factual uncommitted-change statement, “Changes present when observed,” a localized observation time, and unknown author/exact change time. It did not claim a diff, file contents, author or change time. The ~165 px right pane wrapped text and controls without visible clipping.
2. Expanded the per-item technical disclosure by click and Enter. Category, owner kind, source ID, original metadata summary, raw event/observation timestamps and fingerprint were present. The separate preview disclosure exposed the basis, project ID, byte/token counts and full privacy contract. Both were collapsed initially. Checkbox Space, preview-button Enter and disclosure Enter worked in the accessibility tree.
3. Deselected the item. The preview disappeared and the explanation button disabled. After creating a new saved empty Chat in disposable A, Refresh History showed both Git and Chat entries. Selecting both produced distinct numbered cards; Chat was described as metadata observed, with no claim of completed development work. No message was sent and no model ran during ordinary preview.
4. Changed A's disposable `README.md` after preview. The next preview attempt cleared the old display and returned “History evidence changed; refresh and select again”; explanation was disabled. Refresh produced a new selection state and a new preview. Browser reload and a backend restart also reopened History on current evidence.
5. Loaded disposable B in the browser. History showed ordinary empty state with no A Chat, Git entry or prior preview. Project identity and owner nonmutation are also covered by the focused backend tests. No Dope repository source or owner data was written by preview; test fixture A changed only through the deliberate README edit and new empty Chat used for this qualification.
6. With a confirmed two-item preview, clicked **Confirm preview and explain locally**. The UI returned “Local explanation unavailable: No eligible connected local conversational model.” LM Studio reported Q4_K_M loaded at 16,384 context/parallel 1, but Dope had no eligible connected local conversational route. No provider/default/permission setting was changed and no hosted fallback was attempted. A live model response, provenance display and in-flight cancellation were **NOT RUN**; focused tests cover those contracts.

## Privacy, recovery and remaining gaps

The deterministic preview still uses the existing selected-only metadata package, 8-item and 4096-byte/1024-token caps, current-basis verification and no-inference path. The browser did not invoke a model on open or preview. The backend still requires explicit confirmation, re-verifies the package and basis, rejects hosted routing and checks cancellation. These backend assertions are focused-test evidence; the browser run did not include network tracing or a successful local inference. No additional source contents, diffs, prompts, transcripts, secrets, files or unselected context were fetched for readability.

Native Electron GUI, a successful local explanation/provenance/cancellation turn, live AgentRun and Planning Map cards, and a source-wide `npm run check` at this H2 source remain evidence gaps. The browser backend exited with code 139 during three reload/build transitions and was restarted; the cause was not classified as a Dope product defect. The final exact-bundle two-item preview passed after restart. The project-isolation check used a browser workspace URL and reload; an uninterrupted File-menu workspace switch was not established. These gaps limit this result to the deterministic browser/local UX-010 preview, not Phase 11 qualification.

**Next separate Hunter:** Software Map → Physical Map / Flow → evidence-to-code navigation. H2 did not launch it.
