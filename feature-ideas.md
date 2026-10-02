# Feature Ideas

This file is the running feature idea log for ideas proposed in this chat.

## Proposed Ideas

### +F6QK — 2026-10-01 — Selectable sMap box colors for readability

- **Status:** Proposed
- **Summary:** Allow developers to choose the display color of individual sMap boxes so visually dense maps can be organized and scanned more easily.
- **Description:** Systems, Subsystems, Components, and other box-based sMap nodes should expose a simple color selection control. The chosen color should apply to the node's visual surface and use compatible text, border, selection, hover, and focus treatment so the full label remains readable in both light and dark contexts.
- **Behavior:** Color selection should be fast, reversible, and persistent for the project. A small curated palette should be available by default, with a clear reset/default option. Changing a box color should update the map immediately without requiring re-analysis or changing the node's underlying identity.
- **Architecture boundary:** Box color is developer-authored presentation metadata only. It must not change canonical System / Subsystem / Component identity, hierarchy, provenance, analysis evidence, planning semantics, staleness, or implementation behavior. AI and deterministic analyzers must not infer architectural meaning from a manually selected color unless a future explicit semantic-color feature defines that contract.
- **Readability requirements:** Every supported color must maintain sufficient contrast for labels, paths, badges, icons, and selection states. Color customization must work with the existing Dope theme and must not reintroduce text truncation or make long names harder to read.
- **Potential uses:** Visually group related areas, distinguish workstreams or responsibilities, make large maps easier to scan, emphasize important or actively edited regions, and create developer-specific visual organization without restructuring the architecture.
- **Open questions:** Decide whether colors should be selectable only per node or also inherited by descendants as an optional convenience, and whether the initial palette should be fixed theme-aware swatches or also permit custom colors.

### +M7RK — 2026-10-02 — AI-driven live IDE self-customization

- **Status:** Proposed
- **Summary:** After Dope reaches a mature baseline, let developers ask Dope in chat to add or change IDE UI and workflow features for themselves, with the customization becoming usable immediately without closing or restarting the IDE.
- **Description:** A developer should be able to request things such as a new macro, toolbar button, command, shortcut, panel, menu action, status indicator, layout adjustment, or other personal IDE behavior in natural language. Dope should translate the request into a bounded customization, validate it, activate it in the running IDE, and persist it at the appropriate project or user scope.
- **Core experience:** Requests such as “add a button beside Run that executes my frontend smoke test” or “make a macro that opens the sMap and terminal together” should result in a working customization that appears immediately in the current session.
- **Architecture boundary:** Prefer a first-class runtime extension/contribution layer over arbitrary live mutation of Dope core source. The layer should support declarative UI contributions where possible, registered commands/actions, macros, panels, menus, shortcuts, and controlled extension code behind explicit capabilities.
- **Safety and control:** Generated customizations should be inspectable, permission-bounded, reversible, and validated before activation. Dope should support hot load/unload, rollback/version history, conflict detection, and a safe disabled state if a generated customization fails.
- **Persistence and scope:** Customizations should clearly distinguish user-global, workspace/project, and session-only scope. Persistent customizations should survive restart even though creating or activating them should not require one.
- **Promotion path:** A mature workflow may allow a proven personal customization to be promoted into normal Dope source code or a distributable extension, while keeping everyday customization separate from core mutation.
- **Open questions:** Define the initial contribution API, sandbox/capability model, whether larger changes require preview or explicit activation, how generated customizations are represented and versioned, and which Theia/Electron surfaces can be safely hot-reloaded without weakening Dope's provider-independent architecture.

### +V8HD — 2026-10-02 — Isolated Express view live preview

- **Status:** Proposed
- **Summary:** Add a Live Server-like preview tool for Express-rendered frontend views so developers can iterate on HTML/templates, CSS, client JavaScript, and visual UI without starting the application's complete backend stack.
- **Description:** Dope should provide a lightweight preview harness that can render a selected Express view inside the IDE or a browser preview using only the minimum dependencies required for that view. The developer should be able to edit a template or frontend asset, save, and immediately see the updated result without booting databases, workers, external integrations, schedulers, authentication infrastructure, or other unrelated application services.
- **Core experience:** From an Express view, route, or supported template file, expose an action such as `Preview View`. Dope should identify the configured Express view engine and relevant static assets, construct a bounded preview context, render the page, and live-refresh or hot-update the preview as frontend files change. The experience should feel as lightweight as Live Server even when the production application normally requires a much larger server startup.
- **View context:** Views often depend on `res.render(..., locals)`, layout data, middleware-provided values, helpers, sessions, or route parameters. The preview tool should make those dependencies visible and let the developer supply reusable mock/fixture values. Where deterministic repository evidence can recover simple render locals, Dope may prefill them, but it must not invent production data or silently execute unrelated backend behavior.
- **Express integration:** Prefer a small isolated Express-compatible preview runtime or renderer adapter rather than launching the application's normal entrypoint. Support should be capability-based by view engine so EJS, Pug, Handlebars, or future engines can plug into the same preview contract. Static asset mounting, layouts/partials/includes, and common template helpers should be supported when their configuration can be safely resolved.
- **Frontend iteration:** Changes to templates, CSS, images, and browser JavaScript should trigger immediate preview refresh. Where safe and practical, preserve browser state across style/template refreshes; otherwise use fast full-page reload. The preview should expose responsive viewport controls and ordinary browser/devtools inspection.
- **Point-and-annotate editing:** The preview should have an annotation/selection mode that lets the developer point directly at a rendered UI element, select it, and attach a natural-language change request such as “make this card narrower,” “move this below the heading,” “use the primary button style here,” or “this spacing is wrong.” The selected rendered element, its DOM identity, computed layout/style context, relevant screenshot/region, and deterministic source/template provenance should travel with the request so the developer does not have to describe the target in text.
- **Source-aware targeting:** When possible, Dope should map a selected preview element back to the template/component, partial/include, CSS rule, and relevant client-side code that produced it. A requested visual change should be scoped to that evidence-backed source region rather than asking an agent to rediscover the entire frontend. Ambiguous mappings should be shown explicitly and resolved by the developer instead of silently guessing.
- **Annotation workflow:** Support multiple temporary annotations on one preview, including element selections, point markers, boxes/regions, and short notes. The developer should be able to review the annotation set with Dope, ask for one or several changes, preview the resulting edits immediately, accept/reject them, and keep iterating without leaving the visual context.
- **Backend boundary:** This is not a fake full application server. Database access, external API calls, jobs, queues, privileged middleware, and arbitrary production startup side effects should remain disabled unless the developer explicitly opts into a bounded dependency. Missing runtime data should surface as a clear preview dependency rather than causing Dope to start the whole application automatically.
- **Developer workflow:** Allow named preview scenarios such as `logged-out`, `empty-state`, `admin`, or `error`, each with its own fixture locals/request context. Scenarios should be project-local, reviewable, easy to switch, and reusable by future visual testing workflows.
- **Architecture opportunity:** The same isolated preview contract could later power screenshot-based UI review, visual regression checks, AI-assisted frontend editing, component/page comparison, and direct "change this UI" workflows without granting an agent authority over the complete running backend. Point-and-annotate requests should integrate naturally with Dope's future AI editing flow: visual target + source provenance + requested outcome become bounded implementation context.
- **Open questions:** Determine how much Express/router configuration should be auto-discovered, whether preview scenarios live under `.dope/` or conventional test fixtures, how to sandbox template helpers/client code, which view engines ship first, and when a preview should graduate from isolated rendering to a developer-selected partial backend dependency graph.

## Shipped Ideas

## Maintenance Notes

- Add newly proposed feature ideas under **Proposed Ideas** with a short description, date, status, and any relevant context.
- Move shipped feature ideas to **Shipped Ideas** with the implementation summary and shipped date.
- Every feature idea title must begin with a plus symbol followed by a unique 4-character ID, followed by the date and title: `### +ID — YYYY-MM-DD — Feature title`.
- Feature idea IDs use this restricted Base32 alphabet after the plus symbol: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The characters I, O, 0, and 1 are excluded to reduce confusion.
- Assign IDs pseudo-randomly rather than sequentially. IDs are permanent and are never changed or reused, including after a feature idea is shipped.
- Include enough detail that the idea can be converted into an implementation prompt later.
