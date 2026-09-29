# ADR 0008 — Software Map terminology and workbench placement

Status: Accepted
Date: 2026-09-29
Amends: ADR 0007

## Context

ADR 0007 correctly moved Dope toward deterministic, architecture-centered software understanding before AI, but its product vocabulary used **Software Model** and **Physical Software Model**.

That terminology is now too ambiguous for an AI-native development environment. Dope also has AI models, provider models, local models and a Model Runtime. Using “model” for the architecture product creates unnecessary ambiguity in UI, documentation, code and conversation.

Phase 4 P5 also exposed a workbench-layout mismatch: the current architecture inspector is presented in the right-side area even though that area is intended to become the home of Agent Mind/chat/AI interaction. Architecture navigation belongs with project navigation on the left. The large visual architecture/planning experience remains a center-workspace concern.

## Decision

### Canonical product vocabulary

The architecture feature is the **Software Map**, shortened to **sMap**.

Its two primary product views are:
- **Physical Map** — evidence-backed current implemented reality;
- **Planning Map** — proposed target architecture and transformations that reference Physical Map identities.

The hierarchy remains:

Project
-> System
-> Subsystem
-> Component
-> CodeEntity
-> source

“Graph” remains valid as an internal data structure, query representation and algorithmic term. It is not the primary product name.

“Model” remains valid where it actually means an AI/model-provider concept, a generic software-design concept unrelated to sMap, or preserved historical wording. It is not the canonical name for Dope's software-architecture feature.

### Workbench placement

Default Dope placement is:

- **Left primary sidebar / Activity Bar:** project navigation, including a dedicated **sMap** Activity Bar button and the Software Map inspector. The inspector exposes hierarchy, dependencies, violations, evidence and source navigation.
- **Center workspace:** editors and ordinary working surfaces. Product Phase 5 adds visual **Physical Map** and **Planning Map** canvases here.
- **Right secondary sidebar:** reserved by default for **Agent Mind / chat / AI interaction**.
- **Bottom panel:** terminal, Problems, tests, runtime and similar execution/diagnostic surfaces.

Users may rearrange views through ordinary workbench customization. That layout preference is presentation state; the rule above defines Dope's default product placement.

### Phase boundary

Product Phase 4 builds the deterministic **Physical Map substrate**:
- architecture declarations and identities;
- source analysis;
- normalized graph/query structures;
- evidence and provenance;
- dependencies and violations;
- source navigation;
- the bounded left-side sMap inspector.

Phase 4 does **not** implement the large visual map/design canvas.

Product Phase 5 owns the visual experience:
- center-workspace Physical Map visualization;
- Planning Map creation and editing;
- semantic zoom from systems through code;
- planned add/modify/remove/move/split/merge/relationship transformations;
- graph-derived work decomposition;
- target-versus-physical reconciliation.

### In-flight Phase 4 transition

This ADR is accepted while Phase 4 P5 is already running against the pre-decision implementation.

Do not restart or rewrite P5 solely to make its prompt/evidence use the new terminology. Historical and in-flight qualification artifacts may preserve the vocabulary that existed when they were authored.

After P5 and before P6 closeout, run a bounded Phase 4 correction at the unchanged then-current package version. It must:
- rename live product/package/symbol/command/view/UI surfaces from the software-architecture `model` vocabulary to Software Map/sMap terminology;
- move the inspector from the right secondary sidebar to a dedicated left Activity Bar/primary-sidebar surface;
- add permanent regression guards for canonical terminology and default placement;
- preserve Phase 4 graph/evidence/query behavior;
- avoid pulling Phase 5 canvas or Planning Map editing into Phase 4.

Pre-stability clean-break rules apply. No compatibility layer is required merely to preserve the superseded internal `software-model` names.

## Consequences

- ADR 0007 remains architecturally valid but its product naming is superseded.
- Current authority docs use Software Map / Physical Map / Planning Map terminology.
- Existing historical evidence is not rewritten for cosmetic consistency.
- The post-P5 correction is a Phase 4 closeout prerequisite.
- Phase 5 remains the point where the actual visual graph/map canvas arrives.
- Phase 6 may use the right secondary sidebar for Agent Mind/chat without first evicting the architecture inspector.
