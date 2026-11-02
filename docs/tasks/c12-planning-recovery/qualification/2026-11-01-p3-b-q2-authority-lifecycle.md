# P3-B Q2 authority and proposal lifecycle — 2026-11-01

**Q2 GREEN on the source and browser scope below. P3-B Core remains NOT GREEN pending Q3 and Q4.** Q1's earlier GREEN remains applicable: this qualification changes only focused test assertions and this report. Historical P3-B-R4 and H3 NOT GREEN records remain unchanged.

## Source and scope

- Clean entry `main` at `5e801fac733b18a9a6551c3a7772967457eace97`, one UI-only commit after the reported `11fae46e` baseline. Version remained `0.12.7`. No product code, provider configuration, dependencies, version, phase status, B-R2 Chat publication, or remote branch changed.
- Connected Codex Chrome used an isolated final-source Dope server at `127.0.0.1:3023`; browser `bundle.js` SHA-256 `d2e8ded6bd6600bbe9c1ba86a970c16b3aa09033b1d1cf0603b2e008a8dd38d0`. The selected and loaded local LM Studio model was `qwen3.5-9b` (Q4_K_M, 16,384 context, parallel 2); Chat Commands was Ask. AI Center's existing LM Studio connection was refreshed for readiness without changing its configuration.
- Disposable project A `/tmp/dope-p3b-q2-a-Yjtpc9` (project `16354581…f0af`) and project B `/tmp/dope-p3b-q2-b-bJUlrQ` (`5754598f…3c4d`) each began with a separate schema-2 Roadmap at revision 1. A's saved Chat was `26cfbadd…18be`. No owner project was opened or written.

## Deterministic authority matrix

| Invalidation class | Final-source evidence and result |
| --- | --- |
| Stale Roadmap revision | `project-planning-actions` rejects a preview or approval after a newer owner revision; the accepted index remains at the newer revision. **PASS** |
| Replaced proposal | `roadmap-gate-chat` retires the old activity as `superseded`, rejects its decision ID, and preserves canonical bytes. **PASS** |
| Lost or expired lease | The added schema-2 test releases the writer, confirms the old decision fails, reclaims the Chat, confirms the prior proposal still fails, records `stale`, and checks unchanged Roadmap bytes. Existing Chat lease tests cover expiration and lost writer. **PASS** |
| Foreign project/root | Planning owner preview rejects foreign handles and owners; Chat repository/backend isolation tests reject cross-project ownership. **PASS** |
| Wrong Chat/handle | The added decision assertions reject a foreign Chat ID; planning owner tests reject a foreign handle before write. **PASS** |
| Wrong/reused approval token | Planning owner tests reject wrong tokens; the added Chat test rejects wrong lease/proposal IDs and repeated decision after successful Apply. **PASS** |
| Changed linked Markdown source | `roadmap-document-patch` rejects source drift and preserves the external bytes and canonical revision; the competing-write test preserves external content with a recoverable pending intent. **PASS** |
| Cancelled/interrupted turn | `roadmap-gate-chat` cancels a pending proposal, saves `cancelled`, rejects later Apply, and preserves the index. Failed protected-turn retry is rejected before another model call. **PASS** |
| Old skill snapshot/retry | The protected `/roadmap` retry test requires a fresh turn and leaves Roadmap unchanged; skill snapshot binding tests pass. **PASS** |
| Repeated approval | The added successful-Apply replay assertion rejects the consumed proposal ID. **PASS** |

These checks exercise the actual backend decision and `RoadmapStore`/planning-action writer boundaries, not a hidden-button substitute. They establish zero unauthorized canonical writes for the tested invalidations. Saved proposal details contain no reusable approval token; the fresh repository read and guarded activity transition tests pass.

## Connected Chrome lifecycle

1. With Roadmap active beside Chat, a genuine `/roadmap` turn produced proposal `a1ed464e…b078` for Gate `gate-g1` at revision 1. Chat displayed a pending review card, and the canvas automatically showed the provisional purpose change. Canonical hash remained `4b2ab388d29634a44e016ec0333b883e7064c466fdb37081cf628e04c5fec038` before and during preview.
2. A second genuine `/roadmap` turn requested Gate `gate-g2` instead. The backend changed the old saved activity to `superseded` and created current proposal `5015aebd…31d4`. Chat displayed the old card without Apply/Reject, while the canvas showed only the new G2 provisional change. Canonical revision and hash were still 1 and `4b2ab388…f628e04c5fec038`.
3. Developer approval of only the current G2 proposal wrote revision 2, SHA-256 `ec2a9717f7e13c34d0862ff38910f3a184f85118213ea8dd7a41f2144af71063`. G1 retained `Check first phase`; G2 became `Verify second gate lifecycle`. The G2 card became `Applied · revision 2`; the provisional overlay cleared. The old G1 card stayed `Superseded` and non-actionable. Backend denial of its obsolete decision ID is covered by the deterministic replacement test; no obsolete Apply button was recreated in Chrome.
4. The same Chrome tab loaded project B. Its Roadmap had no foreign preview, Chat had no foreign history, and its canonical revision 1/hash `2b499f945897ceea6f2e105b1c2590f65daa8a31d5d038c83538ccc6938631c0` stayed unchanged. Returning to A and reloading showed the old expandable Superseded card and the Applied card with no decision controls or ghost overlay. Expanded old details retained the original revision-1 review basis and before/after values, without restoring approval authority.

Earlier source-applicable Chrome evidence covers a rejected compact card and a stale card after reload; the final-source deterministic tests cover the lost-authority saved `stale` transition. This run directly observed pending, superseded and applied states. It did not manufacture a browser lease failure or force obsolete controls back into the UI. No Gate/Phase qualification status changed.

## Final-source verification and disposition

Focused Chat/lease/skill/approval, Roadmap source/revision, saved-card/presentation, canvas and viewport tests passed **139/139**. `npm run typecheck`, `npm run build:browser`, `npm run build:electron`, and `git diff --check` passed. The Electron build is not native GUI evidence; native Electron GUI remains unverified. No full repository suite or Q1 19-action rerun was performed.

**Q2 GREEN:** stale, replaced, foreign, lost-lease and reused authority fails closed in current-source tests, and the representative connected Chrome replacement/apply/project-switch/reload path preserved canonical and historical truth. Q3 skill/context completeness and Q4 narrow layout/keyboard qualification remain separate. B-R2 protected Chat publication remains unimplemented and untouched; P3-B Core remains NOT GREEN.
