# Owner-approved scope change — conversational Planning, not implementation-plan product

**Date:** 2026-10-31. **Applies at:** `0.12.7`. **Status:** forward design directive, not source implementation/qualification.

1. **Natural AI development conversation** is ordinary existing ChatPanel + selected Pi model and approved project tools. It may investigate, compare, clarify and refine without a formal JSON `implementation-plan`, `question` field, pending implementation-plan card or special `planOnly` owner.
2. **Structured Roadmap work** uses the existing schema-2 Phase/Gate/Criterion/Correction action owner, linked Markdown writer, previews, revisions and human approval. Roadmap generation is already present and must not regress. A conversational edit is not an automatic canonical change or Gate Green.
3. **Documentation management** uses `/docs-review` to inspect source/current docs and propose precise diffs, and `/docs-apply` to target an already reviewed change set through exact-source human-authorized publication, recovery and applied-only History. The original 15-prompt design remains a source of safety requirements, but broad optional Work-reference and context-cost optimization is deferred.
4. **Retire the C12 experimental standalone implementation-plan submission/retry/semantic-review machinery** only after tracing call sites and keeping unrelated Roadmap, Planning Map, source grounding, Chat, Work, leases, permissions, history and recovery intact. Preserve the dated failed reports, do not reinterpret them as GREEN.
5. **Implementation sequence:** P1 cleanup → P2 targeted Roadmap editing repair/qualification → P3 core Docs entry/qualification. Each prompt is manual, Ponytail Full for Sol High where available; no runtime Ponytail injection into Pi. Keep `0.12.7`, local owner work and native gaps.

Supersedes the *forward requirement* that successful rigid implementation-plan submission is a gate before useful Roadmap editing or Docs review. It does not automatically implement Docs, waive source-bound approvals or qualify C12/Phase12.
