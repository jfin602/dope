# Dope Project Overview

Status: INITIAL PRODUCT CONTRACT

This document is the compact routing contract for Dope's product identity. Deeper authority lives in VISION.md, PRINCIPLES.md, PRODUCT-MODEL.md, ARCHITECTURE.md, THEIA-SPIKE.md, and the accepted ADRs.

## Single-sentence definition

Dope is an AI-native software development environment designed to keep the developer at the center of the engineering process, combining a full IDE with durable project knowledge, live planning, visible and steerable AI collaboration, and scoped automation so developers can accomplish dramatically more without giving up understanding, authorship, skill, or the satisfaction of building software themselves.

## Why Dope exists

Modern coding agents can own too much of the cognitive development loop: understanding the system, making implementation decisions, discovering constraints, writing code, testing, and returning a finished result.

That increases output but can reduce the developer's connection to and understanding of the software.

Dope explores a different relationship: AI as a programming exoskeleton.

## North star

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The environment must also ensure that the understanding survives the session as durable project knowledge.

## Product laws

1. Developer as protagonist.
2. Visible useful agent working state, not raw hidden reasoning.
3. Continuous steering during work.
4. Ambient intelligence that watches the developer's back without constant interruption.
5. Scoped delegation and explicit ownership.
6. Conceptual observability before file-level diff inspection.
7. Passive Ideas capture without task derailment.
8. A living, explorable software model.
9. Persistent development context for the developer.
10. Friction removal without skill removal.
11. Planning, research, decisions, tasks, implementation, validation, and history live in one integrated environment.

These eleven pillars remain the product pillars. Framework and model/provider independence are cross-cutting architecture constraints rather than additional pillars.

## Core inversion

> The AI should inhabit the IDE. The IDE should not inhabit the AI chat.

Code and direct manipulation remain central.

## Project Mind

Project Mind is the developer-facing durable memory of the software project.

It is implemented by Dope-owned Project Intelligence and must remain useful even when no AI provider is configured.

Early Project Mind starts with:
- Note
- Idea
- Question
- Decision

Planning builds on that state later with Plan and Task.

## Build + Think

BUILD includes:
- editor
- terminal
- debugger
- tests
- source control
- runtime
- AI execution when delegated
- review

THINK includes:
- notes
- ideas
- questions
- research
- decisions
- planning
- architecture
- exploration

These are views into the same project.

## Session over prompt

The development session is the fundamental interaction unit.

A session can include manual coding, AI-assisted coding, delegated work, research, decisions, plan changes, tests, runtime inspection, ideas, and review.

Durable development state must not be trapped inside chat history.

## Model and provider independence

Dope must not be married to any model, model family, provider, hosted service, local runtime, or provider-native chat/session format.

First-class compatibility targets include:
- OpenAI / ChatGPT / Codex workflows and capabilities
- local models and local inference runtimes
- future providers through replaceable capability-based adapters

Project Mind, Plans, Tasks, Agent Mind, Sessions, Decisions, Authority, and Validation are Dope-owned state.

Provider-specific IDs, context formats, sessions, and capabilities remain adapter concerns.

Provider abstraction must not force every model into a lowest-common-denominator feature set.

## Initial roadmap

The initial sequence is intentionally conservative:

Foundation Spike 0 — qualify Theia
-> Phase 1 — IDE Alive
-> Phase 2 — Project Mind
-> Phase 3 — Planning
-> Phase 4 — AI Presence
-> Phase 5 — Scoped Delegation
-> Phase 6 — Development Sessions

The first major product milestone is a real IDE plus Project Mind plus live Planning that remains useful with zero configured LLMs.

## Non-goals

Do not drift into:
- chatbot-first UX
- agent-as-protagonist UX
- maximizing the percentage of code written by AI
- hiding architecture decisions for convenience
- giant black-box autonomous runs as the default
- project knowledge being synonymous with chat history
- notes/plans as secondary disconnected markdown
- agent runtime coupled to Theia UI
- Project Intelligence coupled to framework internals
- model/provider state becoming canonical product state
- an early Theia fork
- rebuilding commodity IDE functionality
- constant AI interruption
- mandatory explanations
- assuming automation is always preferable to direct coding

Autonomous implementation remains a supported capability, not the premise of the product.

## Emotional direction

Curiosity -> Understanding -> Capability -> Momentum -> Accomplishment -> Pride

> Leave every session more capable than you entered it.

Desired completion feeling:

> I built that. I understand it. I got somewhere today.

## Current gate

Foundation Spike 0 is the only approved implementation gate.

The current spike qualifies Theia across:
- IDE basics
- custom Dope UI
- typed frontend/backend seams
- minimal Dope-owned persistence
- restart restoration
- deep customization/rebinding
- Linux packaging
- one framework-version upgrade

Actual model integration, Agent Mind execution, tool calling, and editor-agent mutation are intentionally deferred.

No later product phase is approved for implementation until the substrate gate closes and the post-spike docs review is accepted.
