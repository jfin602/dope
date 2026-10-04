# Correction 7 Implementation Plan — Chat Conversation UX

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c7-chat-conversation-ux`
Required unchanged package version: `0.7.13`
Activation/source baseline: `5b3653bc13d7632720550d42fe898830b8330d5f`
Assessment: `prompt-assessment.md`

## Shared invariants

- Keep package version exactly `0.7.13`.
- Preserve P12/P13 evidence unchanged.
- Chat remains Dope-owned project context, not canonical Project Mind/Architecture/Planning truth.
- Preserve explicit per-turn model authority and no silent fallback.
- Preserve one-live-owner/lease behavior.
- Preserve context composition/provenance and read-only Phase 7 tools.
- Color is top-level durable Chat organization metadata, not `ChatSettings`.
- Assistant Markdown is visible output only; never persist hidden reasoning.
- Do not introduce a new global Chat theme/preferences subsystem.
- Do not run expensive broad validation in P1/P2.

## P1 — Chat color domain and persistence — T1

### Goal

Add the durable ten-color Chat identity with the smallest safe persistence/mutation change.

### Domain

Add a narrow Chat color type/validator for exactly:
- blue
- cyan
- teal
- green
- yellow
- orange
- red
- pink
- purple
- indigo

Add `color` to durable `Chat` metadata.

Provide one deterministic color assignment function based only on stable Chat ID. Use stable hashing/modulo over the ten colors; never depend on current list order, folder, title, time, or process randomness.

### Mutation

Add a narrow `set-color` Chat operation. It:
- validates the color;
- updates only color plus normal revision/update bookkeeping;
- does not change `lastInteractedAt`;
- requires no Chat ownership lease because it is ordinary Chat metadata/settings-like mutation.

### Create

New Chat creation assigns/persists deterministic color immediately.

### Existing Chat migration/defaulting

Support pre-color persisted Chat files safely.

Preferred invariant:
- old valid Chat file -> deterministic color -> durable migrated Chat;
- migration is serialized through existing repository locking;
- collection/chat revision changes only as needed to truthfully persist the migration;
- `lastInteractedAt`, title source, messages/settings, folder, and ordering semantics are unchanged;
- repeated reads do not keep rewriting;
- corrupt/unsupported records still fail closed.

Use the smallest schema evolution that meets that invariant. Do not create a separate color store.

### Focused regressions

Cover:
- deterministic color stability/distribution;
- new Chat gets valid persisted color;
- `set-color` persists and survives move/rename;
- legacy no-color Chat migrates once and preserves transcript/settings/timestamps/ordering;
- invalid color rejected;
- project isolation unchanged.

### Validation

T1 only:
- focused `chat.test.ts` and `chat-repository.test.ts`;
- `corepack yarn workspace @dope/chat build`;
- `git diff --check`;
- exact `0.7.13` / no-root-lock check.

## P2 — Conversation surface — T1

### Goal

Implement the complete approved ChatPanel UX over the stable P1 Chat color contract.

### Layout

Chat mode:
- fixed top bar;
- one flexing/scrolling transcript region;
- fixed bottom composer;
- no whole-panel Chat-mode scroll.

Top bar contains Back, title, settings and stays visible.

Select Chat mode remains a normal scrollable selection hierarchy.

### Chat selector color

Each Chat row shows a compact color dot/swatch immediately before the title. Do not make the whole selector row brightly colored.

### User and assistant turns

Developer:
- right aligned;
- max readable width;
- bubble uses Chat color;
- automatic readable foreground;
- no repetitive visible You heading.

Assistant:
- neutral/unboxed;
- readable width;
- no repetitive visible Assistant heading;
- render safe formatted Markdown/document output.

Retain semantic/accessibility role information.

### Markdown

Prefer a supported public Theia Markdown renderer already available through `@theia/core`.

If that is unsuitable, add one small direct renderer dependency. Raw HTML/script execution must remain disabled/sanitized. Do not write a homegrown regex Markdown parser.

Support at minimum when present:
- headings;
- emphasis;
- ordered/unordered lists;
- links;
- inline code;
- fenced code;
- blockquotes;
- tables.

Streaming partial Markdown may render progressively or use a safe plain/partial fallback until a stable fragment; it must never break the transcript DOM.

### Compact execution metadata

For normal completed assistant messages, collapse timestamp/status/provider/model into one subtle compact line/disclosure.

Failed/cancelled/interrupted messages keep a clear visible status and failure summary.

Do not remove durable provenance.

### Unified composer

One rounded/bounded composer surface contains:
- text area;
- context/tool controls;
- behavior actions;
- compact model selector;
- Send/Stop/Retry.

Selected context stays compact and removable without becoming a second large panel.

Do not change send/model/context semantics.

### Color settings

Chat settings adds a visual ten-color picker using the P1 `set-color` mutation.

Behavior/model/context settings continue through the existing `set-settings` mutation. Do not stuff color into `ChatSettings`.

### Scroll-follow

Track whether transcript is at/near bottom.

On streaming/rerender:
- if following, restore bottom;
- if user scrolled up, preserve that intent and do not yank them down;
- show a compact jump-to-latest control while newer content exists below;
- activating it resumes following.

Preserve composer draft/model/context state and avoid focus loss where practical.

### Focused regressions

Update/add focused tests for:
- no repetitive role-label source contract;
- selector color indicator + settings picker;
- three-region shell classes/structure;
- user/assistant role classes;
- safe Markdown rendering path and raw HTML safety;
- compact metadata;
- unified composer;
- scroll-follow state/jump-to-latest;
- color mutation wiring;
- existing explicit model/no-fallback behavior retained.

### Validation

T1 only:
- focused `chat-panel.test.ts` and `chat-composer.test.ts` plus any new narrow Markdown/presentation test;
- `corepack yarn workspace @dope/theia-extension build`;
- `git diff --check`;
- exact `0.7.13` / no-root-lock check.

Do not run `npm run check`, restart suite, package build, or manual browser qualification here.

## P3 — Exact-candidate browser qualification and closeout — T3

### Goal

Run broad/integration evidence once on the final P1+P2 candidate and close this bounded correction Green or Not Green.

### Automated gate

Run:
- `npm run check`;
- focused `node --test test/unit/chat-composer.test.ts` if it remains outside `npm run check`;
- `npm run codex:phase:validate -- c7-chat-conversation-ux`;
- `git diff --check`;
- exact `0.7.13` / internal-reference / no-root-lock checks.

### Browser qualification

Use a disposable real project copy with existing Chats or create representative Chats.

Directly prove:
- fixed header while transcript scrolls;
- fixed composer while transcript scrolls;
- composer controls visually integrated with input;
- right-aligned colored developer bubbles;
- assistant output is neutral, unboxed, and renders representative Markdown correctly;
- raw HTML/script-like model text does not execute;
- compact response metadata leaves prose dominant;
- failure/cancel states remain clear;
- streaming follows at bottom;
- scrolling up during streaming is not overridden;
- jump-to-latest restores following;
- Select Chat shows per-Chat color markers;
- new Chats receive stable distributed colors;
- changing color in settings updates selector + bubbles and survives reload/restart;
- rename/move preserve color;
- an older no-color fixture migrates safely and preserves transcript/order;
- right, center, and bottom ChatPanel placements remain usable;
- per-turn model selection/no-fallback/context actions still behave as before.

### Closeout

Write `docs/tasks/c7-chat-conversation-ux/closeout.md` and update the correction README with exact candidate, automated evidence, GUI evidence, any tiny bounded fix, residual gaps, and Green / Not Green result.

A tiny P3 repair is allowed only for directly observed presentation defects inside this correction. Persistence/schema redesign returns to P1; runtime/model/context redesign is out of scope.

If Green, route back to Phase 7B/7C continuation planning without rewriting P13 historical evidence.
