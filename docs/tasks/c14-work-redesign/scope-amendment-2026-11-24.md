# c14 Work redesign — P1-R2 scope amendment (2026-11-24)

Status: owner decision for the current correction. This amendment supersedes the Interrupt Requested → Paused → Resume requirements in the forward Work contract and authored c14 P1–P4 prompts. Those prompt files and earlier qualification records remain unchanged as historical source.

## Revised behavior

- A Work session keeps one embedded Pi SDK session and one isolated candidate workspace across ordinary turns. A completed turn waits for more input; only explicit **Finish** freezes the accumulated candidate, runs Dope validation and enters guarded review. **Stop** terminates execution and preserves evidence.
- Messages submitted during Running persist as **Queued** immediately. Dope delivers them FIFO after the current Pi turn and its brokered operations settle. A message becomes **Delivered** only after an exact Pi acknowledgment of its ID. Delivery may wait for the whole turn; a busy-worker control request is unnecessary.
- An uncertain delivery or tool effect after a crash requires **Recovery required** and verified deliberate continuation. Dope must not inject an uncertain message or replay a tool effect automatically.
- Post-review follow-up retains the Work session identity and original model, maximum tool and sandbox ceiling. It uses a linked new immutable AgentRun segment, a verified source and candidate basis, and a fresh grant decision within that ceiling.
- No Interrupt, Pause or Resume control or service API is supported in this correction. Pi `abort()`, Stop and worker disposal must not be presented as pause.

## Stack routing

P1-R2 must prove the runtime, store, worker, queue, Finish/Stop, recovery and follow-up gates against the real supervised worker and Work adapter. P2 builds the dockable Work presentation using truthful queue/Finish/Stop states only. P3 integrates persistence, historical records, grants and candidate review without a Pause control. Manual P4 qualifies those paths in the connected browser; an Interrupt replay is not an acceptance gate. P1–P3 remain runner-managed after a truthful P1 checkpoint; P4 stays independent and manual. Product version remains `0.13.11`.

An implementation checkpoint does not award product Roadmap Gate GREEN. Earlier BLOCKED reports and `.codex-runs` evidence are preserved.
