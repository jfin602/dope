# Dope Project Overview

Status: INITIAL PRODUCT CONTRACT

This document is the compact routing contract for Dope's product identity. Deeper authority lives in VISION.md, PRINCIPLES.md, PRODUCT-MODEL.md, ARCHITECTURE.md, and THEIA-SPIKE.md.

## Single-sentence definition

Dope is an AI-native software development environment designed to keep the developer at the center of the engineering process, combining a full IDE with visible agent state, continuous steering, ambient intelligence, planning, research, architecture, project memory, and scoped automation so developers can accomplish dramatically more without giving up understanding, authorship, or the satisfaction of building software themselves.

## Why Dope exists

Modern coding agents can own too much of the cognitive development loop: understanding the system, making implementation decisions, discovering constraints, writing code, testing, and returning a finished result.

That increases output but can reduce the developer's connection to and understanding of the software.

Dope explores a different relationship: AI as a programming exoskeleton.

## North star

At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

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

## Core inversion

The AI should inhabit the IDE.

The IDE should not inhabit the AI chat.

Code and direct manipulation remain central.

## Session over prompt

The development session is the fundamental interaction unit.

A session can include manual coding, AI-assisted coding, delegated work, research, decisions, plan changes, tests, runtime inspection, ideas, and review. All of those should update shared durable project state.

## Build + Think

BUILD:
- editor
- terminal
- debugger
- tests
- source control
- runtime
- agent execution
- review

THINK:
- notes
- ideas
- questions
- research
- decisions
- planning
- architecture
- exploration

These are views into the same project.

## Non-goals

Do not drift into:
- chatbot-first UX;
- agent-as-protagonist UX;
- maximizing the percentage of code written by AI;
- hiding architecture decisions for convenience;
- giant black-box autonomous runs as the default;
- project knowledge being synonymous with chat history;
- notes/plans as secondary disconnected markdown;
- agent runtime coupled to Theia UI;
- Project Intelligence coupled to framework internals;
- an early Theia fork;
- reimplementing commodity IDE functionality;
- constant AI interruption;
- mandatory explanations when the developer does not need them;
- assuming automation is always preferable to direct coding.

Autonomous implementation remains a supported capability, not the premise of the product.

## Emotional direction

Curiosity -> Understanding -> Capability -> Momentum -> Accomplishment -> Pride

> Leave every session more capable than you entered it.

Desired completion feeling:

> I built that. I understand it. I got somewhere today.

## Current gate

Foundation Spike 0 is the only approved implementation gate.

Dope must first qualify Theia 1.75.0 across IDE basics, custom product UI, backend communication, local AI, editor-agent integration, Project Intelligence persistence, deep customization, restart restoration, Linux packaging, and a framework-version upgrade test.

No later product phase is considered approved for implementation until the substrate gate is closed.
