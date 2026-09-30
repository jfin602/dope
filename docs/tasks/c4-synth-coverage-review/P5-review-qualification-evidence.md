# P5 — center review and Search Deeper browser qualification

Date: 2026-09-30. Result: **qualified for the P5 interaction matrix, with the evidence gaps below**. This is not the P6 architecture-quality or performance gate.

## Candidate and setup

- Dope source: `9692f88171d4f24587f65e0191e106209466e5f9` (`main`), directly after P4 `85ff0ca`; package and browser app version `0.4.6`. P5 has an uncommitted, focused evidence-view budget repair and regression in `packages/software-map/src/hierarchical-synthesis.ts` and `test/unit/evidence-planner.test.ts`, plus this report.
- Direct browser: built `@dope/browser` 0.4.6 on Theia 1.75.0, Node 24.21.0. Browser workbench served locally on ports 3077 (controlled fixtures) and 3078 (Adaptive SEO), with separate `THEIA_CONFIG_DIR` profiles. The browser UI was exercised through the Codex in-app browser, not inferred from tests.
- Controlled Git roots: `/tmp/dope-c4-p5-review/both` at `983aee794a6249230f3162479781b2cde80f0d21`, `/tmp/dope-c4-p5-review/readme` at `674da1527804c517388fbf825dcea1af5cf42c9a`, `/tmp/dope-c4-p5-review/none` at `fb376f4bfa0b4903073a612a6df7b0832f0c370e`, and `/tmp/dope-c4-p5-review/switch` at `674da1527804c517388fbf825dcea1af5cf42c9a`.
- Real requested root: `/home/jfin/dev/adaptive-seo-dope-p8` at `0b26a25107be7d8dfb2210bc7258ccac8603197e`. Its user-provided, untracked root `MODULES.md` was 4,741 bytes, SHA-256 `4493ed1f1714e7826629d75a1593e31645b1ef5e636518c386e481a7921fe2f2`; root README was also present. The document was not edited. Final Git status there remained only `?? MODULES.md`; no `.dope/architecture.json` or `.dope/smap.json` exists.

## Bootstrap document matrix

| Root documents | Direct browser result |
| --- | --- |
| `MODULES.md` + README | Sidebar identified root MODULES as the architecture seed and described it as Documented intent; README remained secondary orientation. The real Adaptive SEO review exposed separate `modules-seed · MODULES.md` and `readme-orientation · README.md` evidence links. |
| README only | Sidebar recommended MODULES and offered **Continue with README**. Clicking it reached synthesis setup. |
| Neither | Sidebar recommended MODULES and offered **Analyze repository anyway**. Clicking it reached synthesis setup. |

The README and neither-document flows displayed **Copy Prepare this repository for Dope prompt**. In the switched fixture, clicking it placed the exact prompt on the browser clipboard. It asks for only a root `MODULES.md`, explicitly says not to modify application code, and requires source and existing-document evidence. No bootstrap choice wrote canonical architecture before final acceptance.

## Center review and explicit acceptance

The controlled `both` fixture opened its pending review in the center editor. The hierarchy was indented System → Subsystem → Component, with one selected-node detail editor. Inferred, Observed and Documented appeared as distinct sections. Clicking source evidence opened `src/orders/order-service.ts`; clicking document evidence opened root `MODULES.md`.

Browser edits renamed a System, added then removed a Component, added a second System and reparented a Subsystem into it (split equivalent). Another Subsystem was renamed and broadened to absorb a sibling responsibility, and that sibling was removed (merge equivalent). The hierarchy then contained three Systems, three Subsystems and three Components. Before canonical IDs/roots were corrected, the UI reported `Invalid architecture declaration: systems[0].id` and disabled **Accept architecture**. After valid, nonoverlapping IDs and roots were entered, the UI reported a valid canonical architecture and enabled the button. The fixture had no `.dope/architecture.json` or `.dope/smap.json` before that click. Clicking **Accept architecture** produced Generation 1, 77 physical nodes, zero violations and no pending review; both files then existed in `.dope/` with the corrected Systems. This acceptance was confined to the disposable fixture.

## Search Deeper on the real Adaptive SEO root

The first successful Gemini 3.8 Flash review showed one proposed System, three Subsystems, zero Components, zero open questions and 26 unresolved source-backed coverage cues. This is interaction evidence, not an architecture-quality endorsement. The browser showed a source-backed review using the supplied MODULES and README. A source link opened `src/server/http/installation-delivery-routes.ts`; the document link opened the supplied root `MODULES.md`.

Two unrelated Subsystems were manually renamed in the browser: `Adaptive SEO Workspace` → `Workspace and Access`, and `Feed and Installation Delivery` → `Feed Delivery Manual Edit`. Search Deeper remained available on the edited Feed Subsystem. While it ran, only that selected target displayed `Searching this branch…`; selecting the unrelated Workspace branch showed no busy or error text. Search buttons on other branches were disabled for the concurrent call. The preview explicitly said `current draft unchanged`, retained `Feed Delivery Manual Edit`, and proposed three source-backed Components. The hierarchy still had zero Components before a decision. **Reject refinement** removed the preview without changing the hierarchy. A second search again retained the manual name; **Accept refinement** added three Components only under Feed, while `Workspace and Access` and `Project Performance Insights` remained as edited. Final architecture acceptance stayed disabled because canonical IDs were still invalid.

Selecting the System showed Search Deeper. Its preview included the System and all current descendant Subsystems and Components, including both manual names; Reject preserved the draft. In the fixture, selecting a Component showed no Search Deeper control. The browser thus exercised both target kinds and the Component exclusion. The accepted Subsystem refinement stayed under its original parent System.

For stale-result behavior, Search Deeper started on `Project Performance Insights`, then its name was changed to `Insights Edited While Searching` before the provider returned. The UI reported `Error: Target branch changed during Search Deeper`, showed no preview, and preserved the new name.

## Project switching and transient state

During a pending Adaptive SEO review, **File → Close Workspace** removed the review. Opening the controlled `switch` root through the workbench showed an uninitialized Software Map and no Adaptive SEO review, preview, progress or result. Returning to Adaptive SEO showed `No architecture review is pending for this project`, consistent with the current nonpersistent review contract.

A second Adaptive SEO synthesis produced a new pending review (one System, five Subsystems, zero Components, one open question, 23 unresolved coverage cues). Search Deeper was started on Feed and the target visibly entered `Searching this branch…`. The workspace was closed while the call was in flight, then `switch` was opened. It remained uninitialized after the old call had time to finish. Returning to Adaptive SEO again showed `No architecture review is pending for this project`; no old preview or result reappeared. The second proposal differed from the first, so neither was treated as a frozen architecture-quality result.

## Repair and replay

The first live Adaptive SEO run failed before System Discovery: a minimal source-backed evidence skeleton plus MODULES, README and supporting docs exceeded the provider input budget. A first 16,000-character document cap moved the failure to System Challenge. The final focused repair caps projected document content at 12,000 characters for System Discovery and reduces the later-stage allowance by the already-selected source evidence. MODULES and README retain space ahead of supporting docs; truncation is marked in the projected view. The final browser build was rerun. The repaired browser flow reached review twice on the real root, and the permanent focused planner regression covers both System Discovery and System Challenge with a realistic document set. No provider-independent synthesis semantics or canonical storage contract changed.

## Checks and evidence gaps

- Focused review/bootstrap/evidence-navigation guards passed (38/38) before browser work. The planner regression passed (8/8) after repair. The combined final focused set passed 46/46. `npm run build:browser` passed after the final repair. `npm run codex:phase:validate -- c4-synth-coverage-review` and `git diff --check` passed.
- The browser progress list visibly separated initial provider stages and attempts, including System Discovery, System Challenge and per-Subsystem Component Discovery. Focused service tests assert `stage: target-refinement` and consumed status for Search Deeper calls. There is no direct browser view of the retained target-refinement attempt ledger after review, so that exact ledger record was not independently observed in the browser.
- No live quality assessment, cross-repository synthesis matrix, eight-minute Green claim, full `npm run check`, restart, packaging or native launch was performed here; those belong to P6. The real Adaptive SEO proposal was deliberately left unaccepted, and its untracked `MODULES.md` was preserved.

P5 interaction behavior is ready to hand to P6, with the attempt-ledger browser visibility limit above and architecture quality still open.
