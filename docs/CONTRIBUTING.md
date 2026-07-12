# Contributing to Docs Editor

First of all, thank you for your interest in contributing to Docs Editor.

This project aims to become a professional, open-source, framework-agnostic document editor for modern web applications. We welcome contributions of all sizes—from documentation improvements and bug fixes to new features and architectural discussions.

Before contributing, please read this guide carefully.

---

# Code of Conduct

Be respectful.

Be constructive.

Assume good intent.

Focus discussions on technical merit rather than personal preference.

We want Docs Editor to be a welcoming project for developers of all experience levels.

---

# Project Philosophy

Docs Editor is built around a few core principles:

- Performance First
- Architecture Before Features
- Headless by Default
- Framework Agnostic
- Type Safe
- Extensible
- Well Tested
- Maintainable

Every contribution should reinforce these principles.

---

# Repository Structure

```
docs-editor/

apps/
    playground-react        # internal dev app, verifies workspace linking

packages/
    docs-editor-core        # @sbh321/docs-editor-core — framework agnostic
    docs-editor-react       # @sbh321/docs-editor-react — React adapter

examples/
    basic-react             # public-facing minimal integration reference

tooling/
    typescript-config       # @docs-editor/typescript-config — shared tsconfig bases
    eslint-config            # @docs-editor/eslint-config — shared flat configs

docs/

.github/
```

`tooling/*` packages are private and unpublished — they exist purely to share
TypeScript and ESLint configuration across the workspace as versioned
packages instead of copy-pasted config files.

Do not introduce unnecessary coupling between packages.

The editor core must remain framework agnostic.

---

# Development Environment

Requirements:

- Node.js (LTS)
- pnpm
- Git

Clone the repository:

```bash
git clone https://github.com/Sbh321/docs-editor.git
```

Install dependencies:

```bash
pnpm install
```

Run development:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
```

Run linting:

```bash
pnpm lint
```

Type-check all packages (TypeScript project references):

```bash
pnpm typecheck
```

Build all packages:

```bash
pnpm build
```

---

# Branch Naming

Use descriptive branch names.

Examples:

```
feature/table-selection

feature/image-resize

fix/history-memory-leak

fix/paste-markdown

docs/plugin-guide

refactor/history-engine
```

Avoid generic names like:

```
new

update

test

temp

feature1
```

---

# Commit Convention

Follow Conventional Commits.

Examples:

```
feat(core): add image node

feat(history): snapshot API

fix(editor): resolve selection issue

fix(table): keyboard navigation

docs: update architecture guide

refactor(core): simplify transactions

test(history): add undo tests

perf(renderer): reduce rerenders

build: update dependencies

chore: cleanup workspace
```

---

# Pull Requests

Keep pull requests focused.

One pull request should solve one problem.

Avoid combining unrelated changes.

Good:

- Add image resizing

Bad:

- Image resizing
- Toolbar redesign
- Package updates
- Documentation rewrite

---

# Before Opening a Pull Request

Ensure:

- Project builds successfully
- Tests pass
- Lint passes
- Types pass
- Documentation updated
- Public API reviewed

---

# Code Style

Prefer readability over cleverness.

Avoid unnecessary abstraction.

Avoid premature optimization.

Avoid large functions.

Prefer composition over inheritance.

Prefer explicit APIs over implicit behavior.

Avoid hidden side effects.

Write code that future contributors can understand.

---

# TypeScript Guidelines

Use strict typing.

Avoid:

```
any
```

Prefer:

- unknown
- generics
- discriminated unions
- interfaces where appropriate

Public APIs should always be fully typed.

---

# Package Boundaries

Never place framework-specific logic inside:

```
docs-editor-core
```

Never duplicate business logic across adapters.

Framework packages should remain thin wrappers.

---

# Performance Guidelines

Performance is a feature.

Consider:

- unnecessary renders
- allocations
- bundle size
- serialization costs
- memory usage
- transaction efficiency

Avoid optimizing prematurely, but do not ignore performance implications.

---

# Testing Requirements

Every feature should include tests where appropriate.

Testing includes:

- Unit tests
- Integration tests
- Regression tests
- Serialization tests
- History tests
- Clipboard tests

Bug fixes should include regression tests whenever possible.

---

# Documentation

Documentation is part of the implementation.

If you change:

- Public API
- Architecture
- Plugin API
- Theme API

Update the corresponding documentation.

Documentation should never fall behind implementation.

---

# Accessibility

Accessibility is a core feature.

New functionality should support:

- Keyboard navigation
- Focus management
- ARIA best practices
- Screen readers where applicable

Accessibility regressions should be treated as bugs.

---

# Public API

Public APIs should be:

- Stable
- Predictable
- Well documented
- Backward compatible

Breaking changes require careful discussion.

---

# Plugin Development

Plugins should extend the editor without modifying the core.

Avoid introducing special cases into the editor for individual plugins.

The plugin system should remain generic.

---

# Issue Reporting

When reporting bugs, include:

- Operating System
- Browser
- Package versions
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable

Minimal reproducible examples are highly encouraged.

---

# Feature Requests

Before requesting a feature, consider:

- Does it belong in the editor?
- Does it belong in a plugin?
- Does it belong in the consuming application?

The editor should remain focused on document editing.

---

# Review Guidelines

During review, we evaluate:

- Correctness
- Architecture
- Readability
- Maintainability
- Performance
- Accessibility
- Documentation
- Test coverage

A feature may be technically correct but still require revision if it negatively impacts the architecture.

---

# Design Principles

When making engineering decisions, prioritize:

1. Maintainability
2. Simplicity
3. Performance
4. Extensibility
5. Developer Experience

Never sacrifice long-term architecture for short-term convenience.

---

# Long-Term Vision

Docs Editor is intended to become a foundational open-source editor framework.

Every contribution should move the project closer to:

- Stable APIs
- Excellent documentation
- Strong plugin ecosystem
- Outstanding developer experience
- Production reliability

We appreciate every contribution that helps achieve this vision.

Thank you for contributing to Docs Editor.