# P3-A minimal Skills framework — scoped GREEN in Codex browser/local Pi

**Date:** 2026-11-01 America/Chicago. **Source:** local `d51e97218a2e62923cf8ff464a4c12bbf165a5ac`, uncommitted P3-A changes. **Version:** `0.12.7` unchanged. No phase runner, `/activate`, self-commit, P3-B, or Docs skills. This supersedes this report's initial NOT GREEN disposition, recorded before the local model became available; it does not change historical C12 Planning or P4 results.

Ponytail was not installed during implementation discovery, so it was not used or injected into Pi.

## Implemented on the local checkout

- Dope-owned, user-scope persisted Skills registry with protected sample `/explain`, unique lowercase commands, reserved future names, bounded descriptions and 1,500-character plain-text bodies, Add/Edit/Delete/Enable controls in Chat settings.
- Existing Chat composer slash popup with prefix then substring matching, provenance display, keyboard Tab/Enter/Arrow/Escape and pointer selection. Selection edits the unsent draft. Composer height and existing attachment/Commands controls remain in place.
- Backend exact `/name` resolution, current-turn single instruction block, saved user-turn identity/version/body digest, unchanged retry snapshot after edits, and visible unknown/disabled failures. The pinned Pi 1.4.0 worker exposes no global skills (`getSkills` empty) and calls `session.prompt(..., { expandPromptTemplates: false })`, so no native `/skill:name` expansion or duplicate body injection was introduced.

## Deterministic evidence

- Final-source `node --test test/unit/chat-skills.test.ts test/unit/chat-grounded-turn.test.ts`: **13/13 pass**. The model-request harness confirms one invoked body, prior conversation, unchanged retry body after registry edit, and no body in normal turns. Existing Chat/backend/panel/repository focused run passed 69 preexisting cases; its initial new-test failure was a test fixture ID and was corrected. No permission broker or writer was expanded.
- Browser and Electron builds passed on the final source; TypeScript compiled with each build. `git diff --check` passed. Installed native Electron UI was not tested.
- The first Codex in-app browser pass on disposable `/tmp/dope-skills-p3a-5Grszs` added `/p3a-probe`; reload retained it, `/p3` displayed its user-provenance popup option, and Tab inserted `/p3a-probe ` without sending.

## Live Codex browser qualification

The owner explicitly requested the Codex browser for this continuation. The disposable project was `/tmp/dope-skills-p3a-5Grszs`, saved Chat `99b208ac-a9a2-40d2-8e78-2c1326ff95a4`, with exact selected **LM Studio `qwen3.5-9b`** through bundled Pi. AI Center reported the model ready, loaded context **16,384**, conversational text/streaming and local reasoning available. Commands remained **Ask**. No provider or model configuration was changed.

1. A normal discussion established **Finchboard**, an offline bird-sighting tracker with weekly summaries. An unskilled control before invocation summarized Finchboard and weekly summaries without the skill marker. Both completed on the selected model.
2. The user skill `/p3a-probe` instructed the answer to include exact phrase **amber lantern** and use prior discussion. Invoking `/p3a-probe Give a one-sentence recap of the app we discussed. Do not use tools.` produced: “Finchboard is an offline bird-sighting tracker that generates weekly summaries like an amber lantern.” The saved user turn retained the skill ID, name, version 1, digest, and body. No tool event was saved.
3. The Pi request trace at `2026-11-01T12:30:46.912Z` shows exactly one 243-byte skill system message, SHA-256 `e0d4b355d1a13d73cd11319a54ecb588711248b8039dd0fc7f88eb4ede9ed325`, for `qwen3.5-9b`. That hash matches the composed Dope skill block and body. The preceding normal/control requests had only the ordinary 504-byte system instruction and no skill block. No model request occurred while filtering or selecting the popup.
4. Reload retained the completed Chat. A reserved `docs-apply` add was rejected. Disabling the custom skill made an attempted invocation fail with a disabled-skill notice; `/unknown-skill` failed with an unknown-skill notice. Neither produced a new Chat turn or model request. The custom test skill was deleted afterward; only the protected built-in remains.
5. Built-in `/explain` completed through the same selected model. A longer `/explain` turn was canceled after 2 seconds; the saved UI showed **Canceled**, **No final response**, and Retry. Literal `/tmp/demo` inside a sentence and a slash on a later textarea line did not open the picker; Escape dismissed it. In the approximately 300-pixel Chat pane, the transcript, composer, attachment File menu, model control, and Ask/Allow control stayed usable.

The disposable project contained only saved Chat/history-focus data; no Roadmap or Work writes were observed. The browser remained usable with an empty draft and Ask selected.

## Scope and limits

**GREEN is limited to P3-A generic Skills invocation and management on this exact local source in the Codex in-app browser with the selected local Pi model.** The earlier no-model blocker is resolved. Connected Chrome, installed native Electron GUI, actual file attachment upload, Allow-mode tool execution, and broader malicious-skill permission attacks were not live-qualified. Their absence does not qualify Docs review/apply, C12 Planning P4, or the product as a whole. P3-B and P3-C remain unstarted. No owner workspace was mutated, no version changed, and no commit was made.
