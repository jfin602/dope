# Dope Vision

Status: FOUNDATIONAL PRODUCT VISION
Planning baseline: 2026-09-27

## Problem

AI coding agents can dramatically increase software output while quietly removing the developer from the engineering loop that creates understanding and satisfaction.

A typical autonomous loop can absorb nearly every cognitive stage:
- reading and understanding the existing system;
- choosing implementation details;
- discovering constraints;
- making architecture decisions;
- writing the implementation;
- producing tests;
- debugging;
- reporting a completed result.

The developer may still approve high-level direction, but the software increasingly becomes something they commissioned rather than something they built.

Dope exists to reject that trade.

## Vision

Dope is an AI-native development environment where the programmer remains the protagonist and AI acts as an exoskeleton for programming.

It should increase what one developer can accomplish without requiring them to surrender understanding, authorship, engineering judgment, skill growth, direct manipulation, or pride in the result.

## North star

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The product must also preserve that understanding beyond the session.

Plans, discoveries, architecture reasoning, decisions, research, ideas, validation, and implementation history should become durable project knowledge instead of disappearing into transient chat context.

## What the product is

A useful shorthand is:

VS Code × Codex-style agent environment × debugger × architecture explorer × planning/research workspace × pair programmer

But the shorthand is subordinate to the inversion:

> The AI should inhabit the IDE. The IDE should not inhabit the AI chat.

Code remains the center of gravity.

Conversation is useful, but conversation is one interface among many for manipulating shared development state.

## Fundamental unit

The prompt is not the product unit.

The development session is.

A single session can move fluidly among understanding, manual coding, ambient AI observations, delegated implementation, research, architecture exploration, plan changes, debugging, validation, review, and idea capture.

Dope should preserve continuity across those modes without forcing the developer to repeatedly restate context.

## Desired experience

When the developer returns to a project, Dope should reconstruct their own mental context: what was being built, what is complete, what remains unresolved, what decisions were made, what tests fail, and what ideas were captured.

During coding, AI should often behave as a quiet second set of eyes: notice existing implementations, surface invariant violations, identify downstream assumptions, point out missing tests, recognize duplication, and warn about dangerous mutation paths.

It should interrupt only when value or severity justifies interruption.

When work is delegated, the developer should see useful structured state: objective, plan, current step, assumptions, risks, questions, working set, ownership, pending actions, and validation state.

When work completes, Dope should explain the change conceptually before forcing the developer into raw diffs.

## Knowledge should compound

The project should become easier to understand over time because the environment retains decisions and rationale, plans and execution history, research and sources, unresolved questions, ideas, architecture relationships, changesets, validation evidence, and session summaries.

The developer should not need an AI's private memory to understand their own project.

## Local AI

Local models are strategically important because Dope needs many small, continuous interactions: observe edits, inspect selections, update a project model, run micro-analysis, compare implementations, support passive review, and maintain context.

That favors local inference for ambient intelligence and bounded helper roles, while stronger remote models may still be used for demanding delegated work.

## Brand feeling

Dope is not a personified assistant. Dope is the environment.

The desired reaction after a productive session is:

> That was dope.

The AI itself is not named Dope.
