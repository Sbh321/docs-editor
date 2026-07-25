# Docs Editor Architecture

> Architecture and engineering design for Docs Editor.

Version: Draft

---

# Philosophy

The architecture prioritizes:

- Maintainability
- Performance
- Extensibility
- Predictability
- Framework independence
- Long-term evolution

The project intentionally separates document editing from presentation.

Business logic never belongs inside the editor.

---

# Design Principles

## Layered Architecture

Every layer has one responsibility.

Higher layers may depend on lower layers.

Lower layers must never depend on higher layers.

```
Applications
    ↓

Framework Adapters
    ↓

Editor Core
    ↓

Editor Engine
    ↓

Browser
```

---

## Headless First

The editor owns behavior.

Applications own appearance.

Everything visible should be replaceable.

Examples:

Toolbar

Buttons

Dropdowns

Icons

Menus

Panels

Dialogs

Floating menus

Slash menu

Selection menu

Context menu

Nothing should require a specific design system.

---

# High Level Architecture

```
                    Applications

 Next.js

 React

 Vue

 Nuxt

 Angular

 Svelte

------------------------------

Framework Adapters

docs-editor-react

docs-editor-vue

------------------------------

Editor Core

Commands

Transactions

History

Selection

Clipboard

Schema

Plugins

Serialization

Export

------------------------------

Editing Engine

(Current)

ProseMirror

The editor core should depend on an abstract editing engine contract rather than ProseMirror-specific APIs wherever practical.

This minimizes lock-in and isolates engine-specific implementation details.

------------------------------

Browser

Selection API

DOM

Clipboard API

Pointer Events

Keyboard Events
```

---

# Package Boundaries

## docs-editor-core

Responsible for:

- Document Model
- Commands
- Transactions
- History
- Serialization
- Plugins
- Theme contracts
- Export
- Import

Should never import React.

Should never import Vue.

Should never import UI libraries.

---

## docs-editor-react

Responsible for:

React integration and the headless UI layer.

Provides:

Editor component

Hooks

Context

Providers

Utilities

Headless UI components (toolbar, floating toolbar, slash/context menus,
outline, table of contents, zoom controls, theme provider)

React should remain a thin wrapper around the core: the UI components are
*presentation and interaction only*. They must never reimplement editing
behavior — every one delegates to core commands and queries (`toggleMark`,
`isMarkActive`, `getOutline`, …), keeping the "business logic belongs in the
core" boundary intact. Each component is headless (unstyled, `role`-correct,
`className`/render-prop driven); styling and icons are opt-in via the theme
and the separate `@sbh321/docs-editor-icons` package.

---

## Future Framework Packages

Vue

Angular

Svelte

Should only wrap the core.

Never duplicate business logic.

---

# Dependency Rules

Dependencies must always flow toward the core.

Applications
      ↓

Framework Adapters
      ↓

Core
      ↓

Editor Engine

Core must never depend on framework adapters.

Plugins may depend on the public API but should not depend on application code.

Circular dependencies are prohibited.

---

# Document Model

The document is the single source of truth.

Never use HTML as the canonical representation.

```
Document

Heading

Paragraph

Quote

List

Table

Image

Code Block

Divider

Page Break
```

Every node must be:

Serializable

Immutable-friendly

Strongly typed

Composable

---

# Document Lifecycle

A document progresses through a predictable lifecycle.

Import / New Document
        ↓
Document Model
        ↓
Editor State
        ↓
Commands
        ↓
Transactions
        ↓
History
        ↓
Rendering
        ↓
Export / Serialization


Every stage should preserve document integrity.

No stage should mutate data outside its responsibility.

The document model remains the single source of truth throughout the lifecycle.

---

# Rendering Pipeline

```
Document JSON

↓

Commands

↓

Transactions

↓

Editor State

↓

Renderer

↓

DOM
```

Rendering should be deterministic.

---

# Rendering Philosophy

Rendering should be deterministic.

Rendering should never contain business logic.

Rendering should react to document state rather than mutate it.

Rendering should remain replaceable by framework adapters.

The editor should minimize DOM updates through incremental rendering strategies.

---

# Commands

Every user action becomes a command.

Examples:

Insert Paragraph

Delete Block

Insert Image

Toggle Bold

Toggle Italic

Insert Table

Undo

Redo

Commands should never manipulate the DOM directly.

Commands modify the document.

Rendering reacts to document changes.

---

# Command Execution

All editing operations flow through a single command pipeline.
User Action
↓
Command
↓
Validation
↓
Transaction
↓
History
↓
Render

Commands should be:

- deterministic
- replayable
- testable
- serializable

Commands should never directly manipulate the DOM.

---

# Transactions

Commands produce transactions.

Transactions produce state.

Transactions should be:

Atomic

Serializable

Replayable

Undoable

Composable

Future collaboration should be possible without redesigning transactions.

---

# State Architecture

Editor state should be divided into independent domains.

Core document state:

- Document
- Selection
- History
- Transactions

Transient UI state:

- Open menus
- Hover state
- Dialogs
- Floating toolbars
- Search panel

Application state:

- Storage
- Authentication
- AI
- Routing

Only the first category belongs inside docs-editor-core.

UI state belongs to framework adapters.

Application state belongs to the consuming application.

---

# History Engine

History should not rely on browser undo.

Architecture:

```
Command

↓

Transaction

↓

Snapshot

↓

History

↓

Undo / Redo
```

Future support:

Named versions

Version restore

Version comparison

Visual timeline

---

# History Storage

History should support multiple storage strategies.

Examples:

- In-memory
- IndexedDB
- Remote persistence
- Snapshot storage

The history engine should remain independent of storage implementation.

Storage should be replaceable through adapters.

---

# Diff Engine

Future architecture:

```
Version A

↓

Document Diff

↓

Version B

↓

Visual Diff
```

The diff engine should support:

Inserted blocks

Removed blocks

Modified blocks

Moved blocks

Future UI should resemble Git.

---

# Selection System

Selection is independent.

Supports:

Caret

Range

Block selection

Table selection

Future:

Multi-selection

---

# Clipboard System

Responsible for:

Copy

Paste

Cut

Internal serialization

External HTML

External Markdown

Future DOCX support.

---

# Serialization Architecture

The editor should support multiple serialization targets while maintaining one canonical document model.

        Document Model
              │
  ┌───────────┼───────────┐
  │           │           │
 JSON       HTML      Markdown
  │
 DOCX
  │
  PDF

The internal document model remains authoritative.

Importers translate external formats into the document model.

Exporters translate the document model into external formats.

No external format should become the canonical representation.

---

# Plugin System

Everything should be pluggable.

Examples:

Math

Mermaid

Video

Timeline

Citation

Footnotes

Reference Manager

Plugins should register:

Nodes

Marks

Commands

Keyboard shortcuts

Menus

Serialization

Plugins may contribute:

- Nodes
- Marks
- Commands
- Keymaps
- Input Rules
- Paste Rules
- Toolbars
- Floating Menus
- Slash Commands
- Context Menus
- Serializers
- Importers
- Exporters
- Themes
- Icons
- Validators

---

# Theme System

Headless.

Theme controls:

Typography

Spacing

Icons

Toolbar

Colors

Animations

Menus

Consumers may replace everything.

---

# Extension Lifecycle

Extension

↓

Registration

↓

Schema

↓

Commands

↓

Keyboard

↓

Rendering

↓

Serialization

---

# Performance Strategy

Performance is a feature.

Priorities:

Minimal rerenders

Efficient transactions

Lazy loading

Code splitting

Tree shaking

Memoization where appropriate

Avoid unnecessary DOM mutations.

Large documents should remain responsive.

---

# Performance Budget

Performance considerations should guide architectural decisions rather than being treated as post-implementation optimizations.

The editor should continuously monitor and optimize:

- Initial bundle size
- Typing latency
- Transaction latency
- Rendering latency
- Scroll performance
- Memory consumption
- History memory usage
- Serialization performance
- Import and export performance
- Large document responsiveness

Performance regressions should be treated as architectural issues.

Optimizations should preserve API stability and maintainability whenever possible.

---

# Scalability Strategy

Docs Editor should scale from simple notes to large, professionally structured documents without requiring architectural redesign.

The architecture should remain responsive as document size, feature complexity, and extension count increase.

Architectural decisions should favor solutions whose performance characteristics remain predictable as documents and feature sets grow.

## Large Documents

The editor should comfortably support:

- Hundreds of pages
- Thousands of paragraphs
- Large tables
- Hundreds of images
- Complex nested document structures
- Extensive formatting
- Large editing histories

Performance should remain predictable as document size grows.

---

## Architectural Strategies

Scalability should be achieved through techniques such as:

- Incremental rendering
- Efficient document traversal
- Lazy-loaded extensions
- Virtualization where appropriate
- Efficient transaction processing
- Structural sharing where beneficial
- Minimal DOM mutations
- Incremental serialization
- Background processing for expensive operations
- Efficient history management

The architecture should minimize unnecessary work during common editing operations.

---

## Extension Scalability

Extensions should remain isolated.

Adding additional plugins should not significantly impact:

- typing performance
- rendering performance
- startup time
- memory usage

Extensions should only execute when relevant to the current editing context.

---

## Memory Management

Memory usage should grow predictably.

Avoid:

- duplicated document state
- unnecessary object allocation
- retained detached DOM nodes
- memory leaks
- unbounded history growth

Large editing sessions should remain stable over extended periods.

---

## Rendering Scalability

Rendering should update only the portions of the document affected by changes.

The architecture should avoid full document rerenders whenever possible.

Large documents should remain smooth during:

- typing
- scrolling
- selection
- formatting
- undo/redo

---

## Import and Export Scalability

Importing and exporting large documents should avoid blocking the main editing experience whenever practical.

Expensive operations should be designed to support:

- streaming
- chunked processing
- progress reporting
- cancellation
- future background execution

---

## Future Scalability

The architecture should accommodate future capabilities without requiring significant redesign.

Examples include:

- Track Changes
- Git-style document history
- Real-time collaboration
- CRDT-based synchronization
- Large media documents
- Plugin ecosystems
- Mobile editing
- Cloud persistence adapters

Scalability should be considered a core architectural requirement rather than a later optimization.

---

# Import Pipeline

Supported:

JSON

HTML

Markdown

Architecture should support DOCX later.

---

# Export Pipeline

Supported:

JSON

HTML

Markdown

PDF

Future:

DOCX

---

# Interoperability

The editor should exchange documents with external applications through standardized formats.

Primary targets include:

- Google Docs
- Microsoft Word
- Markdown editors
- Static site generators
- HTML editors

Round-trip fidelity should be maximized for commonly supported document features.

Perfect fidelity is not required where underlying document models fundamentally differ.

---

# Error Handling

Recover gracefully.

Never corrupt document state.

Invalid transactions should fail safely.

Document integrity is always preferred over partial updates.

---

# Accessibility Architecture

Accessibility is a foundational architectural concern rather than a feature.

The editor architecture should support:

- Keyboard-first editing
- Screen reader compatibility
- ARIA best practices
- Logical focus management
- High contrast themes
- Reduced motion preferences
- Semantic document structure

Accessibility should be independent of any specific framework or theme.

Framework adapters and themes should enhance accessibility without changing editor behavior.

---

# Testing Strategy

Unit Tests

Integration Tests

Playwright

Serialization Tests

Clipboard Tests

History Tests

Performance Benchmarks

Regression Tests

Every public API should have tests.

---

# Security

Never execute arbitrary HTML.

Sanitize pasted content.

Validate imported documents.

Prevent unsafe serialization.

---

# Public API Philosophy

Public APIs should be:

Predictable

Stable

Minimal

Strongly typed

Composable

Backward compatibility is preferred.

---

# Future Evolution

Planned capabilities:

Visual history

Git-like diffs

Track changes

Comments

Realtime collaboration

CRDT support

Vue package

Angular package

Svelte package

Mobile optimization

These should be additive.

The architecture should never require major redesign to support future features.

---

# Mobile Strategy

Mobile support should evolve from the same editor architecture rather than introducing a separate implementation.

The editor should support touch-first interactions while reusing the existing document model, command system, transaction pipeline, and history engine.

Future mobile capabilities may include:

- Touch selection
- Floating editing controls
- Mobile toolbars
- Gesture support
- Responsive layouts
- Virtual keyboard optimizations

Framework adapters should provide platform-specific user experiences while sharing a common editing core.

The architecture should avoid assumptions that limit future mobile support.

---

# Architectural Principles

The project values:

Architecture over shortcuts.

Composition over inheritance.

Explicit APIs over magic.

Type safety over convenience.

Performance over abstraction.

Maintainability over cleverness.

Long-term evolution over rapid feature accumulation.

Every architectural decision should reinforce these principles.