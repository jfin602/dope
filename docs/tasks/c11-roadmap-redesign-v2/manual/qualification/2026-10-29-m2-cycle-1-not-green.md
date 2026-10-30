# M2 cycle 1 — NOT GREEN / browser and local-model evidence gap

Date: 2026-10-29 UTC. This is a bounded, source-bound manual implementation and qualification record, not a P14 PASS marker. M1's owner-accepted visual Green and the original P14 NOT GREEN remain unchanged. Product version remains 0.11.8. No M3/P15, native parity, Pi runtime, or Phase 11 Green is asserted.

## Source and served identity

- Base HEAD: `014a112480e0ecf2784402f4411de2d42fb9e5bd` on `main`.
- Implementation is dirty and uncommitted. At record time, tracked diff SHA-256 was `a6769c6a4dd0bb3f14a88194099f0e112cc9216cf1bdc9196159361116cb42c6`; the new `roadmap-gate-chat.ts` and its test are untracked and excluded from that digest. No original P*.txt was edited.
- Separate test backend: `http://127.0.0.1:3011`, launched from the rebuilt `apps/browser` tree. Frontend `lib/frontend/bundle.js` SHA-256 `c03f44ef62782c58ec601fe97c2ffcf532718ddbf112939f1c2b9054e15a47e6`; backend entry `lib/backend/main.js` SHA-256 `57fa88ebe331187e16d0b4003a51cfe1f6456bc5f010cd3b6c3a319d29d6c1ba`; compiled Chat backend `packages/theia-extension/lib/node/chat-backend.js` SHA-256 `6cd32fdc350cdbc6eccdfc4df92c0856b79e5757e0c00f41be2840d5d3ce61cf`.
- The compiled Chat repository default was rebuilt after the two observed turns; its current hash does not identify those turns. Any later qualification needs a fresh final-source rebuild and served hash capture.

## Implemented but not qualified

The existing saved ChatPanel now recognizes schema-two Roadmap Phase/Gate selection and passes bounded current revision context to the local model. A strict proposal envelope can carry one to three related Phase/Gate/criterion/correction actions with temporary IDs bound to durable UUIDs. `ProjectPlanningActions` previews the batch through the existing Roadmap writer, checks owner/revision/source, and applies only after Chat Accept; Reject leaves the file unchanged. A linked Markdown field edit uses the existing reviewed document patch path. Read-only focus, qualification reasons, and reviewed undo routes were added. The new default Chat settings expose schema-two Roadmap context while retaining the legacy source for older Chats.

This is partial M2 implementation. Evidence review, owner-confirmed coverage/waiver workflows, Work/Planning source attachment where authorized, full manual interaction coverage, and model-selected end-to-end authoring have not passed this cycle.

## Real browser and model observations

- Connected Google Chrome tab ID `528923245` opened the disposable project `/tmp/dope-m2-chat-bsPaCj`; owner ID `5ce7a8f4-a570-43e9-8ee6-4ac97ca29d22`. Saved Chat ID `d1d2cdaa-70b9-4b3d-83aa-1edf32b3d5c6` followed `Roadmap roadmap` in the right dock.
- AI Center's local LM Studio connection at loopback `127.0.0.1:1234/v1` showed the usable, explicitly selected `qwen3-coder-30b-a3b-instruct@q4_k_m`, with loaded context 32,768. The first natural-language Phase-create turn used output reserve 1,024 and ended `Local generation timed out`; Chrome displayed no preview or Accept action.
- The same saved Chat was set to Roadmap context and output reserve 384. A second identical explicitly selected Q4 turn ended `Local generation failed`, again without preview or write. The model was reloaded by the owner around this observation; no cause for the second failure is inferred.
- Chrome accessibility state and screenshot showed the failed saved turns, selected local-model provenance, and empty Roadmap canvas. The persisted `.dope/roadmap.json` stayed at revision 1 with zero Phases/Gates/corrections. No approval token was produced, and no linked Markdown exists in this fixture.
- The owner then requested confirmation in the Codex in-app browser. Creating an in-app browser page on the same loopback backend timed out before webview attach; its browser inventory contained no attached tab. Around that failure, the host had about 180–214 MiB available RAM and no swap. This is an environment observation, not a diagnosed causal claim. Browser confirmation remains an evidence gap.
- No selected/pinned target, moved/reordered Gate, two criteria, dependency/correction, Reject/Accept/reload, stale owner, foreign project, malicious instruction, or linked-source replay was observed in a live model-selected browser path. There is no M2 Green claim.

## Focused verification

- `@dope/chat`, `@dope/project-intelligence`, and `@dope/theia-extension` builds and `npm run build:browser` passed before the default Chat setting/test adjustment. `@dope/chat` rebuilt after that adjustment; final full browser rebuild is still required.
- `roadmap-gate-chat.test.ts` passed 2/2, including a fake-model saved-Chat preview, Reject no-write, and Accept through the real schema-two writer. `chat-repository.test.ts` plus `roadmap-chat-context.test.ts` passed 11/11 after updating the new Chat default assertion. Earlier targeted `dope-capability-help`, `chat-backend`, `roadmap-local-model`, `roadmap-chat-context`, `roadmap-greenfield`, `project-planning-actions`, and `roadmap-gate-chat` run passed 53/54. The one failure is the existing `chat-backend.test.ts:849` assertion that expects `canonical.planOrigin?.planRevision === 3` on the current schema-two Roadmap; it was not rewritten in this cycle.
- `git diff --check` passed at this record time. None of these tests substitutes for the required local-model browser path.

## Decision

**M2 NOT GREEN / EVIDENCE GAP.** Keep the original P14 NOT GREEN; do not create the P14 Git PASS marker or start M3/P15. Retry on a rebuilt final source after the local model and browser can complete a live saved-Chat turn, then exercise the remaining M2 operations and negatives. Preserve this failed cycle as history.
