# CLAUDE.md

> AI engineering guidelines for Docs Editor.

This document defines how Claude Code should contribute to this repository.

It supplements the project documentation and should be treated as required guidance whenever making changes.

---

# Project Identity

Docs Editor is a professional, headless, framework-agnostic document editor.

It is **NOT**:

- a note-taking application
- a SaaS
- a CMS
- a collaborative editor
- an AI writing assistant
- a business application

It is a reusable editing engine.

Every decision should reinforce this goal.

---

# Source of Truth

When making decisions, use the following priority:

1. Explicit user instructions
2. docs/PROJECT_SPEC.md
3. docs/ARCHITECTURE.md
4. docs/ROADMAP.md
5. This CLAUDE.md
6. Existing implementation

If implementation conflicts with documentation, assume the documentation represents the intended architecture unless instructed otherwise.

---

# Engineering Expectations

Approach every task with the judgment expected of an experienced software architect and open-source maintainer.

Prioritize:

- Long-term maintainability
- Correctness
- Clear architecture
- Explicit APIs
- Performance
- Excellent developer experience

Do not optimize for producing the largest amount of code.

Optimize for producing the highest quality implementation.

---

# Core Philosophy

Prioritize:

1. Architecture
2. Correctness
3. Maintainability
4. Extensibility
5. Performance
6. Developer Experience

Never prioritize implementation speed over architecture.

---

# Architecture First

Never introduce code simply because it solves the immediate problem.

Every implementation should fit naturally into the long-term architecture.

If the requested implementation exposes an architectural weakness:

- explain it
- propose improvements
- implement the most maintainable solution

Architecture takes precedence over convenience.

---

# Before Writing Code

Before implementing anything:

1. Understand the existing architecture.
2. Read relevant documentation.
3. Identify affected packages.
4. Determine whether the change belongs in:
   - core
   - framework adapter
   - plugin
   - theme
   - playground
   - documentation
5. Explain the implementation plan if the task is non-trivial.

Never immediately begin modifying files.

---

# Package Responsibilities

## docs-editor-core

Contains:

- editor engine
- commands
- transactions
- history
- serialization
- plugins
- document model

Must remain framework agnostic.

Never import React.

Never import Vue.

Never depend on UI libraries.

---

## docs-editor-react

Contains React integration and the headless UI layer (Phase 4).

Examples:

- Editor component
- hooks
- providers
- contexts
- headless UI components (toolbar, floating toolbar, slash/context menus,
  outline, table of contents, zoom controls, theme provider)

React must remain a thin adapter. The UI components are presentation and
interaction only — they delegate all editing behavior to core commands and
queries and must never reimplement it.

Never duplicate editor logic here.

## docs-editor-icons

Optional default icon set for the headless UI (Phase 4). React components only;
never imported by the core. The React UI stays icon-agnostic — icons reach it
through the theme or an explicit prop, so this package is always opt-in.

---

# Package Ownership

docs-editor-core owns:

- document model
- commands
- transactions
- history
- serialization
- plugins

Framework adapters own:

- rendering
- lifecycle
- hooks
- providers

Applications own:

- storage
- authentication
- AI
- permissions
- routing
- business logic

Never blur package responsibilities.

---

# Dependency Direction

Package dependencies must always flow inward.

Applications
        ↓
Framework Adapters
        ↓
docs-editor-core
        ↓
Browser APIs / ProseMirror

Lower layers must never depend on higher layers.

Examples:

✅ docs-editor-react → docs-editor-core

❌ docs-editor-core → docs-editor-react

❌ docs-editor-core → Next.js

❌ docs-editor-core → Tailwind CSS

Package dependency direction should remain acyclic.

---

# Architecture Rules

Never violate package boundaries.

Business logic belongs only inside the core.

Framework adapters should remain minimal.

Plugins should extend behavior instead of modifying the core whenever possible.

Avoid introducing global state.

Favor composition over inheritance.

Favor explicit APIs over implicit behavior.

---

# Scope Discipline

If a requested feature belongs in the consuming application instead of the editor:

Do not implement it.

Instead explain why it belongs outside the editor.

Examples:

❌ Authentication

❌ User accounts

❌ Permissions

❌ Cloud storage

❌ Billing

❌ Notifications

❌ AI workflows

❌ Project management

These are application concerns.

---

# Explicit Over Implicit

Prefer:

- explicit registration
- explicit APIs
- explicit configuration

Avoid:

- hidden behavior
- automatic registration
- global mutable state
- runtime magic

Code should be understandable by reading it.

---

# Never Guess

If requirements are ambiguous:

Stop.

Explain the ambiguity.

Recommend one or more approaches.

Wait for clarification before making architectural decisions.

Do not invent missing requirements.

---

# Performance

Performance is a feature.

Always consider:

- render frequency
- allocations
- memory usage
- transaction costs
- bundle size

Avoid unnecessary abstractions.

Avoid unnecessary rerenders.

Avoid expensive document traversals.

Prefer incremental updates whenever possible.

---

# TypeScript

Use strict typing.

Never introduce `any` unless absolutely unavoidable.

Prefer:

- generics
- discriminated unions
- readonly types
- utility types

Public APIs must always be strongly typed.

---

# Public APIs

Every public API should be:

- intuitive
- predictable
- minimal
- composable
- documented

Breaking changes require strong justification.

---

# API Design

Public APIs should be:

- discoverable
- consistent
- composable
- predictable
- framework independent

Avoid boolean flags that drastically change behavior.

Prefer options objects over long parameter lists.

Prefer explicit names over abbreviations.

Favor additive APIs over breaking redesigns.

---

# Backward Compatibility

Avoid breaking public APIs.

If a breaking change is necessary:

- explain why
- document migration
- update roadmap
- update documentation

Prefer additive evolution whenever possible.

---

# Code Quality

Write code for future maintainers.

Avoid:

- overly clever code
- hidden behavior
- unnecessary abstractions
- deep nesting
- duplicated logic

Prefer:

small functions

clear names

predictable flow

self-documenting code

---

# Naming Conventions

Use clear, descriptive, and consistent names.

Names should communicate responsibility rather than implementation.

Examples:

EditorProvider

HistoryManager

DocumentSerializer

CommandRegistry

ThemeProvider

MarkdownExporter

PluginRegistry

TransactionDispatcher

Avoid vague or generic names such as:

Manager

Util

Helper

Common

Base

New

Temp

Misc

Thing

Names should be:

- explicit
- searchable
- consistent
- domain-driven

Favor descriptive names over abbreviated ones.

---

# Documentation

If implementation changes:

Update documentation.

Never allow documentation to become outdated.

Public API changes require documentation updates.

---

# Documentation Synchronization

Documentation is part of the implementation.

Whenever architecture, public APIs, package boundaries, project structure, engineering decisions, workflows, or long-term direction change, determine whether any project documentation should also be updated.

Always consider the following documents:

- docs/PROJECT_SPEC.md
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- CONTRIBUTING.md
- CLAUDE.md
- README.md
- package READMEs
- API documentation
- examples
- Storybook documentation

Documentation should evolve together with the codebase.

Avoid allowing documentation to become stale.

---

## Recursive Documentation Review

After completing any non-trivial task, recursively review the documentation hierarchy.

For every change ask:

- Does this change affect the project vision?
- Does it affect the architecture?
- Does it introduce a new package?
- Does it modify package responsibilities?
- Does it change a public API?
- Does it introduce a new extension point?
- Does it affect roadmap priorities?
- Does it require migration guidance?
- Does it require updating examples?
- Does it affect contributor guidelines?

If the answer to any question is yes, update the corresponding documentation before considering the task complete.

Documentation updates are considered part of the implementation, not optional follow-up work.

Documentation should always accurately reflect the current state of the project.

---

# Testing

Every meaningful feature should include tests.

Bug fixes should include regression tests.

Test:

- behavior
- serialization
- history
- clipboard
- transactions

---

# Accessibility

Accessibility is mandatory.

Consider:

- keyboard navigation
- focus management
- screen readers
- ARIA

Accessibility regressions should be treated as bugs.

---

# Error Handling

Never silently swallow errors.

Fail safely.

Preserve document integrity.

Never corrupt editor state.

---

# Diagnostics

Errors should be actionable.

Provide meaningful messages for developers integrating the editor.

Avoid:

- silent failures
- vague exceptions
- hidden behavior

Where appropriate:

- expose useful debugging information
- preserve stack traces
- include contextual information
- fail predictably

Diagnostics should help developers identify problems without exposing unnecessary implementation details.

---

# Working Style

For every non-trivial task:

1. Analyze the existing codebase.
2. Produce a short implementation plan.
3. Identify affected packages.
4. Explain architectural impact.
5. Implement incrementally.
6. Run formatting, linting, type checking, and relevant tests.
7. Review your own code for correctness and maintainability.
8. Summarize what changed, any trade-offs, and any future improvements.

Never make large, sweeping changes without first explaining the plan.

---

# Implementation Checklist

Before marking any task complete verify:

- Project builds
- TypeScript passes
- Lint passes
- Tests pass
- Documentation updated
- Public APIs reviewed
- Package boundaries respected
- No duplicated logic
- No unnecessary dependencies

---

# Dependency Policy

Dependencies should only be introduced when they provide significant long-term value.

Before adding a dependency evaluate:

- maintenance activity
- community adoption
- TypeScript support
- browser compatibility
- bundle size
- tree shaking
- licensing
- long-term stability

Prefer mature, battle-tested libraries.

Avoid dependencies that solve trivial problems.

---

# Refactoring

Do not perform unrelated refactoring.

Stay focused on the requested task.

Large architectural refactors require discussion first.

---

# Incomplete Work

Every commit should leave the repository in a healthy state.

Avoid:

- partially implemented features
- commented-out code
- dead code
- temporary hacks
- unfinished TODOs without context

If a feature cannot be completed in one iteration:

- keep the implementation buildable
- clearly separate completed and pending work
- document follow-up tasks where appropriate

Do not leave the project in a broken or inconsistent state.

---

# Large Tasks

Break large work into smaller milestones.

Implement incrementally.

Ensure the project builds after each milestone.

Do not leave the repository in a broken state.

---

# Git Workflow

Prefer small commits.

Each commit should represent one logical change.

Follow Conventional Commits.

---

# Decision Making

When multiple implementations are possible:

Explain trade-offs.

Recommend the most maintainable solution.

Do not automatically choose the easiest implementation.

---

# Code Review

Before finishing:

Review your own changes.

Check for:

- duplication
- architecture violations
- unnecessary complexity
- performance regressions
- missing tests
- missing documentation

Improve before considering the task complete.

---

# Communication

Be concise.

Be honest.

Do not invent APIs.

Do not assume behavior that does not exist.

If uncertain:

Ask.

Do not guess.

---

# Future-Proofing

Design implementations that can evolve.

Examples:

History should anticipate visual diffs.

Plugins should anticipate third-party extensions.

Commands should anticipate collaboration.

Themes should anticipate multiple design systems.

Do not over-engineer.

Do not block future evolution.

---

# AI Working Agreement

Optimize for architecture rather than volume of code.

When appropriate:

- break work into milestones
- explain trade-offs
- recommend improvements
- review your own implementation

Prefer incremental progress over one-shot implementations.

Think before coding.

Review before finishing.

---

# Long-Term Vision

Every change should move Docs Editor toward becoming a professional open-source editing framework comparable in engineering quality—not feature parity—to projects like:

- ProseMirror
- Monaco Editor
- CodeMirror
- Radix UI

The project should be known for:

- clean architecture
- stable APIs
- excellent performance
- extensibility
- maintainability

---

# Release Philosophy

Docs Editor is intended to become a long-lived open-source framework.

Releases should prioritize:

- stability
- compatibility
- maintainability
- predictable evolution

Avoid unnecessary breaking changes.

Public APIs should remain stable whenever possible.

Experimental APIs should be clearly identified.

Breaking changes require:

- architectural justification
- migration documentation
- release notes
- versioning in accordance with Semantic Versioning

Prefer incremental improvements over disruptive redesigns.

Every release should improve the developer experience while preserving trust in the ecosystem.

---

# Final Rule

When in doubt:

Choose the solution that will still make sense five years from now.

Optimize for long-term maintainability over short-term convenience.