# Manual P11 cycle 2 — serialized budget

**Entry product source:** `94096a13fbc67d8905a5608609e716fb88c3fcf3`, package `0.10.16`; same disposable project, Qwen quantization, 16,384 loaded context, linked file hash and Roadmap revision as [cycle 1](cycle-1.md). The heavy request again failed before provider inference with `Local planning context exceeds the measured budget; reduce the request`. The selected checkpoint now fit, so the remaining failure was the final serialized message size, including escaped file content. The project file hash and Roadmap revision stayed unchanged.

**Source repair:** `ChatContextComposer` now charges JSON-serialized UTF-8 cost and uses bounded search to truncate an optional source at that cost. A focused 43 KB-style file test covers 16K/32K/64K context composition and final preview. Separate source checkpoint: `98ae3534dc81f4129f23725019fb9b765e429c59`.

**Replay caveat:** An initial browser replay after this commit still displayed the old budget failure because the browser app's bundled backend predated the source change. The extension package build alone had updated `packages/theia-extension/lib`, but `apps/browser/lib/backend/main.js` still had its older timestamp. Subsequent app rebuild changed the bundle SHA-256 to `e9e874dbbc210a9fd4f9e504f203fe7a40165bb934c418380aa4ef80294c0e60` and exercised the corrected source. The stale-bundle failure is a setup invalidation, not evidence of a new product defect at `98ae3534`.

The exact final envelope still required headroom beyond individual block estimates, so a further bounded repacking repair was made in cycle 3. No profile comparison or family Green is claimed here.
