# P8 — Integrated AI roles and routing qualification evidence

Status: **Green for the P8 direct and T3 qualification matrix** on the coherent `0.7.31` candidate. P9 is eligible to perform the evidence-only final Phase 7 closeout at `0.7.32`; this record does not itself make that formal closeout decision or activate Phase 8 mutation-capable delegation.

## Candidate and preflight

- Exact predecessor: clean `0.7.30` commit `753dd6b504c1fffdfdc23b4e639d337e4b9ccca3`.
- Candidate: that predecessor plus the bounded P8 repair, test alignment, version advance and this evidence in the manual `0.7.31` checkpoint. All 12 live root/workspace manifests, internal `@dope/*` references and the baseline guard are exactly `0.7.31`.
- Qualified framework baseline remains Theia `1.75.0`, Electron `42.8.1` and React/ReactDOM `19.2.8`. No root `package-lock.json` or `npm-shrinkwrap.json` exists.
- Authorities read before qualification: `docs/tasks/p7c/prompt-assessment.md`, `docs/tasks/p7c/implementation-plan.md`, ADR 0026 and its qualification boundary, the exact P1-P7 prompt results, `docs/tasks/p7b/closeout.md`, retained P7B P9 evidence, Phase 7A P13 evidence and the `c7-chat-conversation-ux` closeout.
- Retained Phase 7B credential/provider/keyring evidence was reused where behavior was unchanged. No hosted generation or paid hosted probe was performed.

| Prompt | Exact checkpoint | Retained result used as preflight |
| --- | --- | --- |
| P1 | `094c137cb5d814eb326c5dc80278627df5ebda24` (`0.7.24`) | Five fixed roles, target/constraint contracts and bounded immutable provenance; builds and focused/baseline gates passed. |
| P2 | `bad95702f0507ca89f3ba34456074e054565db95` (`0.7.25`) | Revisioned machine-global persistence, process locking, stale rejection, tombstones and same-ID restoration; focused/baseline/build gates passed. |
| P3 | `14300ae7251f841f1fc669b24771b4fe0d9e0c1e` (`0.7.26`) | Pure deterministic resolver, conservative Unknown handling and caller-owned hosted authorization; 20 focused tests and package builds passed. |
| P4 | `9491ea6bba5bd315915816a2c5d008fd09e6a34d` (`0.7.27`) | Bounded pre-output routing/fallback and non-secret provenance; 45 focused/adjacent tests and affected builds passed. |
| P5 | `438ef7cedf9b8fb72cf6f6cb3fc2e44f7887462c` (`0.7.28`) | Roles UI, ordering, eligibility explanations and deep links; 22 focused tests, baseline and extension build passed. |
| P6 | `6733089782d3da46b9c4d113985897794939f09a` (`0.7.29`) | Follow Interactive Chat, exact precedence, Chat-owned hosted consent and Why-this-model provenance; focused builds/tests passed, with no prior GUI claim. |
| P7 | `753dd6b504c1fffdfdc23b4e639d337e4b9ccca3` (`0.7.30`) | Software Map role proposal becomes a visible exact run target; probe, warm-up and consent remain feature-owned; future role contracts have no consumers. |

## Direct setup and non-secret identities

- Browser qualification used two independent Theia backend/window processes and a no-project window, then the disposable project `/tmp/dope-p7c-p8-live-project`. Role state was application-global rather than project-local.
- The real Local runtime was the existing LM Studio service on loopback port 1234. The exercised model was `openai/gpt-oss-20b`; no secret was read or recorded.
- The hosted-classified guard used the OpenAI-compatible adapter pointed at the same loopback service. It classified the candidate as hosted without transmitting data to a third party.

| Connection | Stable ID | Qualification use |
| --- | --- | --- |
| Local | `98c9cf59-9550-4e91-a63f-141f990d5913` | Original real Local target, exact turns, permitted fallback and Software Map exact setup. |
| P8 Local Alternate | `dd582338-4ff1-48df-868c-ce73048abf6d` | Independent same-endpoint target used for policy switching, pinning, disable/restore and preferred recovery. |
| P8 Hosted Guard | `ab906b45-2b71-4407-a6c5-f5e51c4b8bb6` | Hosted-classified, credential-free loopback target used only to exercise egress eligibility and no-send behavior. |

No connection credential, provider response body, hidden reasoning or hidden score appears in this record.

## Direct A–J matrix

| Item | Decision | Direct observation and focused support |
| --- | --- | --- |
| A — Roles UI and persistence | **Green** | With no project open, all five fixed roles were configured with exact/constraint targets, preferred/fallback order, hard constraints and preferences. A second process observed the same policies and health. Restart restored them. A draft staged in one process lost to a winning save in the other and was explicitly rejected as stale rather than overwriting the winner. The final focused store suite independently passed default OS-user scope, RPC external propagation, two-process races, abandoned-lock recovery and stale revision rejection. |
| B — Determinism | **Green** | Repeated unchanged policy/inventory/request resolution remained byte-for-byte stable in focused resolver exercises. Policy entry order precedes preferences; preference order and immutable connection/model IDs provide stable ties. Unknown conversational capability or unknown required context failed closed and was reported rather than guessed. |
| C — Inventory change | **Green** | Interactive preferred `dd582338-…/openai/gpt-oss-20b` with exact fallback `98c9cf59-…/openai/gpt-oss-20b`. Disabling the preferred connection retained policy intent and displayed the preferred as disabled; a following turn used the fallback without rewriting/promoting it. Re-enabling the same ID restored the preferred on the next turn. Focused tombstone tests proved removal retains the bounded descriptor, same-ID return restores it, and a newly created ID does not inherit the relationship. |
| D — Chat Interactive | **Green** | A new Chat opened as `Follow Interactive`. A real Local turn returned the requested `P8 LIVE LOCAL OK` through the original target. Changing Interactive to the alternate target changed the next following turn, which returned `P8 ROLE CHANGED`. An exact-default Chat later remained on the alternate target after Interactive was changed back to the original, and returned `P8 PINNED STAYS`. |
| E — Exact authority | **Green** | One-turn exact selection chose the original connection while Interactive preferred the alternate; the turn completed `P8 EXACT TURN`, durable provenance recorded source `explicit-turn`, and the composer reset to Follow Interactive afterward. Neither the Chat default nor global policy changed. Deterministic routing/Chat tests forced unavailable/failing exact targets and proved there is one attempt with no role fallback. |
| F — Fallback | **Green** | Disabling the alternate preferred target before output produced a successful real Local following turn `P8 FALLBACK OK` through the original fallback. Why-this-model showed the disabled preferred attempt followed by the selected fallback. Re-enabling the same preferred ID produced `P8 PREFERRED RETURNS`. Deterministic adapters separately staged transient transport/upstream and preflight unavailability as permitted fallback classes, and proved cancellation, authentication, invalid configuration/JSON, nonretryable/semantic failures and any failure after a meaningful delta never fallback or splice output. |
| G — Hosted egress | **Green** | AI Center classified `P8 Hosted Guard` as hosted and reported `Hosted project-data egress needs feature approval`; global role policy alone could not make it eligible. A Follow Interactive Chat submission retained its draft, persisted no user or assistant message and made no generation call. Because the arbitrary compatible adapter has no known context capacity, the real candidate conservatively failed the Chat hard-context requirement before a consent dialog could be offered. The focused Chat integration supplies known hosted capacity, exercises the explicit user decline path, and proves the history remains unchanged and the hosted runtime is never called; authorization is request-scoped and not stored in role policy. No hosted quota or project data was used. |
| H — Why this model | **Green** | Durable routing provenance was inspected after preferred, explicit and fallback turns. The transcript explanation showed role/source, effective locality/capability/context/egress constraints, preferred target, actual execution label and ordered attempts. The fallback record showed `dd582338-… disabled → 98c9cf59-… selected`; exact records used `explicit-turn` or `chat-exact-default`. Schema guards reject secrets, provider payloads and hidden scoring. |
| I — Software Map | **Green** | The Software Map role proposed `98c9cf59-…/openai/gpt-oss-20b` into Synthesis setup as a visible exact selector. The same setup retained synthesis-specific loaded context, structured-output probe, Local warm-up boundary and hosted-consent authority; generic AI Center Test Connection remained explicitly insufficient. While that setup was active, the role was changed to `dd582338-…`; the active selector visibly remained the original exact target. Focused setup tests also prove failed probes and role changes cannot introduce semantic fallback or replace an active exact target. |
| J — Future seams | **Green** | Background's hard Local-only request rejects hosted candidates and cannot authorize hosted fallback. Coding Agent remained configurable and visibly identified as a future role with no active consumer. Deep Reasoning had no automatic classifier. Source and focused-contract inspection showed no role-triggered mutation, tool execution, delegation runtime or authority expansion. |

## Direct routing and provenance transcript

The relevant durable/non-secret observations were:

1. Preferred Local turn: `interactive · role-policy`; preferred and actual were `98c9cf59-…/openai/gpt-oss-20b`; one `selected` attempt.
2. Changed-role turn: the same following Chat resolved the next request through `dd582338-…/openai/gpt-oss-20b` without rewriting the Chat.
3. Exact one-turn override: source `explicit-turn`, actual `98c9cf59-…`; the next-turn selector returned to Follow Interactive and global policy remained unchanged.
4. Pinned Chat: source `chat-exact-default`, actual `dd582338-…`, despite a different current Interactive preference.
5. Permitted fallback: preferred `dd582338-…`; attempts recorded `dd582338-… disabled` then `98c9cf59-… selected`; actual execution label was Local `openai/gpt-oss-20b`.
6. Preferred recovery: after re-enabling the same stable ID, the next following turn again selected `dd582338-…`; the fallback was not promoted.

## Bounded P8 repair and preserved failed attempts

The first live Local Chat attempt failed before visible output. LM Studio emitted a valid standard SSE role frame with `delta.content: null`, followed by a provider-specific hidden-reasoning frame. `LocalConversationalProvider` treated the explicit `null` as malformed even though it carried no display text. The repair is deliberately narrow: `undefined` and `null` content are both ignored, strings remain the only accepted display delta, and hidden reasoning is still neither emitted nor persisted. The permanent regression test now begins with the role-only `content: null` frame plus a `reasoning_content` frame before the visible deltas. The smallest provider test passed 7/7 before the final focused and broad gates.

The first focused qualification run also exposed one stale pre-P6 unit expectation that a Chat without an exact setting should silently pick the first inventory model. Production correctly follows Interactive instead. The test was renamed and aligned to expect no exact model. Its smallest Chat panel run passed 18/18; no production behavior changed for this alignment.

Both failed attempts remain part of the evidence chain; neither is relabeled as a first-pass success.

## T3 validation and package evidence

| Evidence | Result |
| --- | --- |
| Focused role/store/resolver/router/AI Center/Chat/provider/Software Map suite | **126/126 pass** on final production source. Includes real stream regression, stale role writes, two-process locking/propagation, deterministic/Unknown behavior, all fallback classes, hosted denial/no-send, exact authority, provenance and active Software Map target stability. |
| `npm run check` | **Pass once on the final source**: typecheck; runner 95/95; baseline 11/11; local-install 1/1; product 292/292; Software Map initialization 28/28; IDE 1/1; browser and Electron builds completed with zero build errors. |
| `npm run codex:phase:validate -- p7c` | **Pass**: historical Phase 7 grammar is valid, P1-P8 map exactly to `0.7.24`–`0.7.31`, P8 is browser-required, and P9 is the manual closeout at `0.7.32`. |
| `npm run package:linux` | **Pass**. Rebuilt Electron and emitted `dist/linux/Dope-0.7.31.AppImage`. |
| AppImage inspection | Executable mode 755, 191,081,565 bytes, SHA-256 `bdf7008fc4bd8d4bab033386abb8a8b85503b6418fd1eee9a30fb8b7436ea8d1`; packaged manifest is `@dope/electron` `0.7.31`, main `scripts/packaged-main.cjs`; `resources/app.asar.unpacked/lib/backend/native/keytar.node` is present. |
| Exact AppImage startup/close | **Pass** with isolated `--user-data-dir` and Theia config: backend listened on loopback, 91 plugins deployed, frontend reached `ready`, and shutdown closed frontend/service channels and stopped backend contributions with exit 0. |
| Version/framework/no-lock/diff | All 12 live manifests and internal references are `0.7.31`; Theia `1.75.0`, Electron `42.8.1`, React/ReactDOM `19.2.8`; no root npm lockfile; `git diff --check` passed. |

## Residual evidence and limits

1. The real hosted-classified OpenAI-compatible guard correctly remained ineligible for Chat because its arbitrary provider does not report a known context capacity and Unknown hard requirements fail closed. Therefore the browser exercised the pre-send block/no-persistence path, while the explicit decline dialog/no-runtime-call assertion comes from the deterministic Chat integration with known hosted capacity. This is retained as an evidence-shape limit, not permission to weaken Unknown handling or manufacture capacity.
2. No paid hosted generation, hosted Test Connection or Software Map hosted probe was repeated. P7B secure-store/provider evidence remains authoritative where unchanged.
3. Computer-use exposed the browser application but not native Electron window controls. Exact-package startup and orderly close were observed through the isolated AppImage process logs, including frontend `ready`, channel closure and stopped backend contributions.
4. Phase 5/6 dogfooding and their retained Not Green/Not Qualified results were not rerun or reclassified. Phase 7A/c7 and Phase 7B qualification history remains unchanged.

## P9 eligibility

The integrated 7A+7B+7C collaboration substrate is coherent at `0.7.31`: durable read-only AI Presence, global AI Center, deterministic role policies, Chat routing/authority/provenance and Software Map exact-run boundaries operate together without project policy leakage, silent fallback, hosted-egress expansion, mutation authority or tool execution. P9 is eligible to advance to `0.7.32` and perform the final evidence-only Phase 7 A–H audit. P9 must retain the evidence-shape limits above and decide the formal Phase 7 Qualified/Not Qualified status without implementing Phase 8 or Phase 10 behavior.
