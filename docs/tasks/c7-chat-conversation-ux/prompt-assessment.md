# Correction 7 Prompt Assessment — Chat Conversation UX

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c7-chat-conversation-ux`
Required unchanged package version: `0.7.13`
Activation/source baseline: `5b3653bc13d7632720550d42fe898830b8330d5f`

## Conclusion

Use exactly three ordered prompts.

| Prompt | Boundary | Validation tier | Routing |
| --- | --- | --- | --- |
| P1 | durable Chat color domain + safe migration/persistence | T1 | GPT-6 Sol High |
| P2 | complete conversation-surface presentation correction | T1 | GPT-6 Sol High |
| P3 | exact-candidate integration/browser qualification + closeout | T3 | GPT-6 Sol High |

This is the smallest efficient split. P1 isolates the only persistence/schema risk. P2 can then treat color as a stable product contract and change only presentation behavior. P3 owns expensive validation once, avoiding repeated broad suites during implementation.

## Current-source findings

### Chat color belongs in the durable Chat domain

`packages/chat/src/index.ts` currently stores stable Chat identity, folder/title/timestamps, settings, and messages, but no color.

`ChatSettings` is specifically model/context behavior. The approved contract therefore fits a top-level Chat color field, not `ChatSettings`.

`packages/chat/src/service.ts` has explicit Chat mutations for title/settings/message lifecycle but no color mutation. P1 should add one narrow `set-color` operation rather than overloading settings.

### Existing persisted Chats need a real repository migration/default path

`ChatRepository` creates Chats in the `create-chat` mutation and strictly parses persisted Chat JSON. Existing v1 Chat files have no color.

Migration must:
- accept valid pre-color Chat files;
- derive color only from stable Chat ID;
- persist the migrated color under the existing repository lock/revision model;
- not change `lastInteractedAt`;
- not reorder Chats;
- remain idempotent;
- still fail closed for genuinely corrupt/unsupported Chat data.

Do not create a second metadata store merely for color.

### The ten-color visual grammar already exists

`smap-presentation-state.ts` and `dope.css` already use the names blue/cyan/teal/green/yellow/orange/red/pink/purple/indigo with theme-aware chart tokens.

Chat should reuse the same palette vocabulary/theme treatment without coupling Chat persistence to Software Map presentation state. The Chat domain can own its own narrow color type/validator while the UI reuses equivalent CSS token mappings.

### ChatPanel is currently one scrolling utility surface

`dope.css` currently gives `.dope-chat-panel` `overflow: auto`, so header, transcript, and composer all scroll together.

The widget currently appends header, optional settings, transcript, then composer into one content flow. P2 must make Chat mode a bounded shell where only the transcript scrolls. Select Chat mode can retain its normal list scrolling behavior.

### Transcript currently renders like a log

`chat-panel-widget.ts` creates a `strong` You/Assistant label, a full timestamp, a plain `p.textContent`, then separate status/provenance elements for every turn.

P2 should replace this with role classes/accessibility semantics, developer bubbles, assistant document output, and compact metadata.

### Markdown should use a real renderer

There is no existing Dope Markdown implementation in the repository. P2 should first inspect supported public Theia Markdown rendering APIs available through the existing `@theia/core` dependency. Prefer that supported renderer if it satisfies safe rendering.

If no suitable supported renderer exists, add one small direct frontend dependency with raw HTML disabled/sanitized. Do not implement a regex Markdown parser. Links must not create script/injection paths.

### Streaming rerenders the widget

Assistant deltas update `ChatPanelController.stream` and call the widget render callback. P2 must preserve draft/model/context state and implement bottom-follow based on whether the developer was at/near bottom before rerender.

Do not force scroll-to-bottom after the developer scrolls upward. A small jump-to-latest control is sufficient.

## Risk assessment

Highest risks:
1. silently breaking old persisted Chats during color rollout;
2. color migration accidentally changing interaction ordering/revisions incorrectly;
3. unsafe Markdown rendering;
4. full rerenders defeating manual scroll-away or composer focus;
5. CSS that works only in the right sidebar but breaks center/bottom panels.

These risks are handled by focused P1/P2 regressions and one P3 direct replay.

## Validation strategy

### P1 — T1

Run only focused Chat domain/repository tests and `@dope/chat` build. No browser build, no provider calls, no restart suite, no `npm run check`.

### P2 — T1

Run focused ChatPanel/composer presentation tests and `@dope/theia-extension` build. Add the smallest test needed for Markdown safety/rendering. No broad product suite or browser qualification.

### P3 — T3

Concentrate expensive evidence here:
- `npm run check`;
- focused Chat composer test if still outside the aggregate suite;
- direct real browser GUI replay;
- reload/restart persistence checks;
- multi-placement visual/interaction checks;
- final correction closeout.

No AppImage/package qualification unless the implementation unexpectedly changes packaging/runtime substrate.
