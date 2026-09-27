# Dope Vision

Status: FOUNDATIONAL PRODUCT VISION
Planning baseline: 2026-09-27

## Problem

AI coding agents can dramatically increase software output while quietly removing the developer from the engineering loop that creates understanding and satisfaction.

A typical autonomous loop can absorb nearly every cognitive stage:
- reading and understanding the existing system
- choosing implementation details
- discovering constraints
- making architecture decisions
- writing the implementation
- producing tests
- debugging
- reporting a completed result

The developer may still approve high-level direction, but the software increasingly becomes something they commissioned rather than something they built.

Dope exists to reject that trade.

## Vision

Dope is an AI-native development environment where the programmer remains the protagonist and AI acts as an exoskeleton for programming.

It should increase what one developer can accomplish without requiring them to surrender understanding, authorship, engineering judgment, skill growth, direct manipulation, or pride in the result.

## North star

> At the end of a four-hour session, the developer should understand the software better than they did when they started, while accomplishing dramatically more than they could alone.

The product must also preserve that understanding beyond the session.

Plans, discoveries, architecture reasoning, decisions, research, ideas, validation, and implementation history should become durable project knowledge instead of disappearing into transient chat context.

## Core mission

Give developers dramatically more leverage with AI while preserving and actively increasing their understanding, authorship, skill, and control over the software they build.

The environment should ensure that the understanding survives the session.

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

## Project Mind before AI dependence

Dope's early differentiated value should not require an LLM.

A real IDE, durable Project Mind, and live Planning should already improve the developer's ability to understand and direct a project.

AI is then introduced into an environment with durable human-meaningful state instead of becoming the foundation that everything else depends on.

## Model and provider independence

Dope must remain poised to change with a fast-moving model ecosystem.

No model, model family, LLM provider, hosted service, local runtime, or provider-native session format is foundational to the product.

OpenAI/ChatGPT/Codex compatibility is a first-class requirement.

Local-model compatibility is also a first-class requirement.

Future providers should be adoptable through replaceable capability-based adapters without rewriting Project Mind, Planning, Agent Mind, authority, sessions, or other canonical product state.

Provider abstraction should preserve useful provider-specific capabilities rather than forcing all models into the same lowest-common-denominator behavior.

## Progressive self-development

Dope should progressively become capable of supporting its own development lifecycle.

That does not mean an unfinished Dope must build itself from the beginning, and it does not authorize pulling later AI capabilities into Foundation Spike 0.

The intended progression is:

external bootstrap
-> Dope as editor
-> Dope as project brain
-> Dope as planner
-> Dope as agent supervisor
-> Dope develops Dope

Self-development is a qualification strategy, not a privileged product mode.

The Dope repository should pass through the same Project Mind, Planning, authority, provider, execution, validation, and session contracts as any other software project.

A broken Dope must also never make Dope unrepairable.

The repository, Git history, build/test commands, and durable project knowledge must retain a documented path for inspection, recovery, and repair with conventional external tooling.

Dogfooding Dope on Dope is a strong necessary test of the product, but it is not proof of generality. Product contracts must remain suitable for projects with different languages, frameworks, architectures, and workflows.

## Local and hosted AI

Local models are strategically important because Dope may eventually need many small, continuous interactions: observe edits, inspect selections, update a project model, run micro-analysis, compare implementations, support passive review, and maintain context.

Hosted frontier models are strategically important for demanding reasoning, implementation, research, vision, and other capabilities that may exceed local models.

Dope should be able to combine these roles over time.

The product architecture should assume model capabilities, economics, APIs, and market leaders will change.

## Brand feeling

Dope is not a personified assistant. Dope is the environment.

The desired reaction after a productive session is:

> That was dope.

The AI itself is not named Dope.
