# Correction 7 — Chat Conversation UX closeout

**Decision: GREEN / QUALIFIED for the bounded c7-chat-conversation-ux correction.**

Exact P1+P2 candidate: `24e5de80fbb68560ed8e94fbd46f5caafd4f1ed6`. P1 result identity: `957804ba8c851819a4eb1bbddd2fd41392cf633d` (focused Chat color/persistence validation Green). P2 result identity: `24e5de80fbb68560ed8e94fbd46f5caafd4f1ed6` (focused conversation-surface validation Green). The candidate was clean before P3; P3 made no product-code repair or commit. All package manifests remain at `0.7.13`.

## Automated T3 gate

Run once against that exact candidate:

| Gate | Result |
| --- | --- |
| `npm run check` | Pass: typecheck, aggregate tests, browser and Electron builds. Log: `/tmp/dope-c7-p3-check.log`. |
| `node --test test/unit/chat-composer.test.ts` | Pass, 4/4. This focused test is outside the aggregate check. |
| `npm run codex:phase:validate -- c7-chat-conversation-ux` | Pass. |
| `git diff --check` | Pass. |
| Exact manifest/internal-reference/root-lock inspection | Pass: all 11 package manifests and internal `@dope/*` references remain at `0.7.13`; no root `package-lock.json`. |

Package/AppImage qualification was not added: this correction did not change the packaging or runtime substrate.

## Direct browser qualification

The browser ran the candidate against a disposable copy at `/tmp/dope-c7-p3-hwddbdqz/project`. Its preserved source was `/tmp/dope-p7-qualification-9qzsPm/dope-p7`, a real P12 project with three pre-color Chats. Local model connection configuration was copied into the disposable run. The original project was not used as the writable test target.

### Shell and placements

The 15-turn migrated Chat provided a long scrollable transcript. In the right placement, its header and composer remained in view while the transcript moved from bottom to an earlier turn; Jump to latest returned to the bottom. The same Chat was opened in the center and bottom placements. In each, only the transcript scrolled, while Back/title/settings and the unified composer stayed fixed. The default narrow right and short bottom panels were cramped but usable; widening the right panel improved reading without changing the shell behavior.

### Transcript, Markdown, and safety

Developer turns rendered as right-aligned bubbles using the Chat color. Assistant turns rendered as neutral, unboxed prose. Repetitive visible You/Assistant headings were absent while accessible role semantics remained. A live LM Studio GPT-OSS answer rendered a heading, emphasis, ordered and unordered lists, inline code, fenced TypeScript code, a link, a blockquote, and a table. The response included literal `<script>alert("do not run")</script>` text; DOM inspection showed zero script elements from the answer, and the link used `noopener noreferrer`. The answer occupied the main reading area; ordinary status/provider/model/context data appeared in a compact secondary line. Migrated failed and cancelled turns, plus a newly cancelled turn, remained visibly marked. A final long live turn was interrupted by stopping the disposable backend while Cancel was active. After restart, the GUI showed that turn as `failed · Interrupted before completion`, with its provider/model provenance still visible.

### Composer and model/context boundaries

The multiline input and bottom controls read as one composer. The GUI file-context action attached `package.json`; Preview showed one source and its token count. Explain populated an editable draft. The model selector, Send, Cancel, and Retry were reachable and exercised. The cancelled turn retained its context reference and selected/actual GPT-OSS provenance. On the restarted backend, the connection was unavailable: the UI showed “Default model unavailable” and disabled Send/Retry rather than silently selecting another model. The direct live run had one loaded model, so a second-model override was not replayed in P3; the focused explicit-model/no-fallback regression passed in P2 and the retained P12 evidence covers a distinct explicit Qwen turn. This closeout does not claim a fresh two-model browser comparison.

### Scroll follow

A live streamed answer started at the bottom and followed new content to the end. During a second streamed answer, scrolling upward left the transcript at its chosen position as content increased the maximum scroll range. Jump to latest appeared, moved to the new bottom when clicked, and restored follow behavior.

### Color, migration, and restart

The three source Chats lacked color. Opening their copied project migrated them under the repository's lock/revision path: manifest revision moved from 56 to 57 once, each Chat received a valid deterministic color, and the original titles, transcript, settings, timestamps, and order were preserved. A later reload and backend restart before the deliberate interruption did not repeat migration; the post-interaction manifest stayed at revision 83 across that restart.

Three newly created Chats showed valid palette indicators with orange, indigo, and cyan assignments. In settings, the primary migrated Chat changed from green to pink. Its Select Chat marker and existing/new developer bubbles reflected pink. Renaming it to “C7 pink qualification chat,” moving it to `Qualification/Architecture`, relocating its panel, reloading, and restarting the backend preserved the color and transcript. The copied source project remained intact.

### Canonical-state boundary

SHA-256 hashes of the disposable project's `.dope/architecture.json`, `.dope/project-mind.json`, `.dope/planning-maps.json`, and `.dope/smap.json` were identical before and after the presentation/color activity. No canonical Architecture, Project Mind, Planning, or sMap state changed merely from these actions.

## Repair, residuals, and routing

P3 used **no tiny fix**. No code or package changes were made.

During a same-backend browser reload with both center and bottom Chat panels open, restored panels briefly showed a same-panel-ID ownership message and returned to Select Chat. A backend restart cleared the message; the Chats, color, transcript, and migration state persisted, and the Chat could be selected again. This is a lease/restoration observation outside this correction's presentation/color boundary, not evidence of color loss. It should be tracked separately if reproducible in ordinary multi-panel use. The fresh direct model check used only one loaded model, as noted above. Neither observation changes the bounded correction result.

Return to **bounded Phase 7B/7C continuation planning** under the current Phase 7 plan. Product Phase 7 and the retained P13 audit remain Not Qualified; this Green decision applies only to c7-chat-conversation-ux. Preserve P12/P13 historical evidence unchanged.
