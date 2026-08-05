# Docs Editor

> A professional, headless, extensible, and framework-agnostic document editor built for modern web applications.

---

# Status

- Version: 0.1.0 (Draft)
- Project Status: Phases 0–8 complete — see [ROADMAP.md](./ROADMAP.md)
- Repository Owner: Sbh321
- Primary Language: TypeScript
- Package Manager: pnpm
- License: MIT

---

# Vision

Docs Editor aims to become the modern open-source foundation for building professional document editing experiences on the web.

The project is inspired by the philosophy of Monaco Editor, ProseMirror, Radix UI, shadcn/ui, and CodeMirror.

Instead of building another note-taking application or document platform, Docs Editor provides a reusable editor framework that developers can integrate into their own products.

The goal is to provide an editing experience suitable for writing professional reports, documentation, proposals, manuals, technical specifications, research papers, and other structured documents while remaining completely independent of application-specific business logic.

Documents produced by Docs Editor should integrate naturally into existing professional workflows, including compatibility with widely used office applications such as Google Docs and Microsoft Word through standard document formats.

---

# Philosophy

The editor should own document editing and nothing else.

It should never assume:

- authentication
- users
- organizations
- storage
- databases
- collaboration
- AI
- cloud services
- permissions
- billing
- application workflows

Everything outside document editing belongs to the consuming application.

---

# Goals

The project should provide:

- Professional writing experience
- Excellent typing performance
- Framework agnostic architecture
- Headless UI
- Rich extension system
- Strong TypeScript support
- High performance
- Excellent accessibility
- Predictable APIs
- Long-term maintainability
- Production readiness

---

# Design Goals

Docs Editor should feel:

- Native
- Fast
- Predictable
- Professional
- Familiar
- Keyboard-first
- Accessible
- Extensible

The editing experience should prioritize flow over excessive interface complexity.

Users should spend their time writing rather than learning the editor.

Every interaction should reduce friction.

---

# Non Goals

The project will NOT include:

- Authentication
- User management
- Note management
- File management
- Cloud storage
- Realtime collaboration
- AI writing
- Chat
- Comments
- Sharing
- Notifications
- Permissions
- Business logic
- Analytics

These capabilities should be implemented by applications consuming the editor.

---

# Out of Scope

The editor will not attempt to compete with:

- Microsoft Word
- Google Docs
- Notion
- Figma

Instead, it provides the editing foundation that applications can build upon.

Features requiring backend infrastructure remain outside the core project.

---

# Target Users

Primary audience:

- Software engineers
- SaaS companies
- Documentation platforms
- Knowledge management products
- CMS platforms
- Internal enterprise systems
- Educational software
- Research tools

Secondary audience:

- Open source contributors
- Framework maintainers
- Plugin developers

---

# Core Principles

## Headless First

The editor should never *force* styling. Consumers must always be able to
control the appearance completely.

Since Phase 8 that is a statement about **layers**, not about the absence of a
default. A styled, batteries-included layer ships on top, so the common case is
one import rather than a thousand lines of assembly — but it is a separate
package that a consumer chooses. The layer beneath it remains genuinely
headless: it renders no styles, ships no CSS, and imposes no design system.

The test of whether this holds is not intent but bytes. **Nobody pays for a
layer they do not import**, enforced by bundle-size budgets in CI rather than
asserted in prose.

---

# Architectural Principles

The project follows:

- Layered Architecture
- Headless UI
- Plugin-Based Design
- Composition over Inheritance
- Strong Typing
- Framework Independence
- Immutable-friendly Document Model

---

# Interoperability

Docs Editor should integrate seamlessly with the broader document ecosystem.

Documents created with Docs Editor should be portable and usable across widely adopted document editing platforms whenever technically feasible.

The project should prioritize compatibility with common industry formats while maintaining its own structured document model internally.

Goals include:

- Reliable HTML import and export
- High-quality Markdown import and export
- Professional PDF export
- DOCX import and export
- Preservation of document structure during conversion
- Preservation of formatting where supported by the target format

Documents produced by Docs Editor should be suitable for continued editing in applications such as Google Docs and Microsoft Word.

Likewise, documents originating from those applications should be importable with minimal loss of structure or formatting.

Perfect fidelity across all document formats is not expected due to differences in editor capabilities, but interoperability should remain a first-class design objective.

---

## Framework Agnostic

Business logic must remain independent from UI frameworks.

Framework adapters should remain thin wrappers around the editor core.

---

## Extensible

Every major capability should be replaceable or extendable through plugins.

---

## Performance First

Typing performance should never degrade regardless of editor complexity.

Performance should always take priority over unnecessary abstractions.

---

## Accessibility

Keyboard navigation and screen readers should be considered first-class citizens.

---

## Maintainability

The project should prioritize architecture over short-term implementation speed.

---

# Scope

The editor should support creation of professional documents including:

- Paragraphs
- Headings
- Lists
- Tables
- Media (images, video, audio, file attachments, embeds)
- Code blocks
- Quotes
- Page breaks
- Links
- Rich formatting
- Search
- Replace
- Undo
- Redo
- Document outline
- Table of contents

---

# Editing Capabilities

The editor should eventually support the following. Items marked ✅ ship today;
the rest remain planned.

## Text Formatting

- Bold ✅
- Italic ✅
- Underline ✅
- Strike ✅
- Highlight ✅
- Inline Code ✅
- Superscript
- Subscript
- Font Color ✅
- Background Color ✅
- Font Family ✅
- Font Size ✅ — stored in **points**, not pixels: page layout is already in
  physical units, DOCX stores half-points so the round-trip is exact, and the
  number shown matches what Word and Google Docs show for the same document
- Remove Formatting ✅ — `clearFormatting` clears marks *and* paragraph
  formatting in one transaction, so one press of undo restores everything

## Paragraph Formatting

- Alignment ✅
- Indentation ✅ — one pair of commands, list-aware: inside a list they nest
  and unnest the item, elsewhere they change a block attribute. An indent
  *attribute* on a list item would render as indented while remaining a
  structural sibling, which every exporter would then disagree with
- Line Height
- Spacing
- Direction
- Paragraph Styles

## Document Structure

- Headings (H1-H6) ✅
- Paragraphs ✅
- Block Quotes ✅
- Horizontal Rules ✅
- Page Breaks
- Block reordering ✅ — by drag handle **and** by keyboard
  (`Alt+Shift+Up/Down`); a drag-only affordance would be an accessibility
  regression

## Lists

- Bullet Lists ✅
- Numbered Lists ✅
- Nested Lists ✅
- Task Lists / Checklists ✅ — their own `task_list` / `task_item` node types
  rather than a flag on `list_item`: a checklist serializes differently in
  every format, and `checked: null` on every ordinary bullet would be noise
  each exporter has to step around
- List marker styles ✅ — disc/circle/square, decimal/alpha/roman
- List conversion ✅ — `toggleList` changes a list's type *in place*, so
  nesting and the cursor survive

## Tables

- Insert/Delete
- Merge Cells
- Split Cells
- Resize
- Header Rows
- Keyboard Navigation

## Media

Images, video, audio, file attachments and generic embeds are provided by the
core on a shared media foundation (see ROADMAP Phase 7 — Media):

- Upload
- Paste
- Drag & Drop
- Resize
- Alignment
- Caption
- Alt Text

Uploading itself is an application responsibility. The editor defines the
upload contract and drives its lifecycle — progress, cancellation, retry — but
never performs a network request or touches storage. Resolving a third-party
URL into a rich embed (oEmbed providers) is likewise out of scope for the core;
the generic `embed` node is the extension point.

Media accessibility is a requirement rather than a feature. Every gesture has a
keyboard equivalent — resizing and alignment are commands first and pointer
interactions second — media nodes are focusable and announce what they are, and
a decorative image is marked as a deliberate decision rather than inferred from
a blank alt field. The core reports a document's media accessibility problems
as data, so an application can gate on them.

## Links

- Hyperlinks ✅ — with an editor that reads back the link under the cursor,
  URL normalization (a bare `example.com` becomes `https://`), an optional
  title, and open-in-new-tab
- Internal Links ✅ — a rooted path or an anchor is kept exactly as typed
- Anchor Links ✅

A link's `href` is checked on the way **in and out**. Validating only on input
would be insufficient: a document can acquire an unsafe URL from an import, a
paste, or programmatic construction, so the renderer sanitizes as well. `rel="noopener noreferrer"`
is *derived* for `target="_blank"` rather than stored, which means an imported
link that omitted it is fixed rather than faithfully reproduced.

## Code

- Inline Code
- Code Blocks
- Syntax Highlighting

## Search

- Search
- Replace
- Replace All
- Match Case
- Regex (future)

## Navigation

- Outline
- Table of Contents
- Page Navigation
- Breadcrumbs

## Editing

- Undo
- Redo
- Multi Cursor (future)
- Clipboard
- Drag Selection
- Keyboard Shortcuts

## Import & Export

Supported formats should include:

- Native JSON _(shipped)_
- HTML _(shipped)_
- Markdown _(shipped — `@sbh321/docs-editor-markdown`)_
- PDF _(shipped as print-to-PDF via `PrintExporter`; programmatic PDF deferred)_
- DOCX _(shipped — `@sbh321/docs-editor-docx`)_

Future formats may include:

- ODT
- RTF
- EPUB

---

# Package Ecosystem

Shipped packages:

- @sbh321/docs-editor-core — the framework-agnostic engine, plus two optional
  entry points: `/preset` (a complete default schema with its renderers, parse
  rules and keymap) and `/tables` (interactive table editing)
- @sbh321/docs-editor-react — React adapter and headless UI components
- @sbh321/docs-editor — the batteries-included layer: styled components and
  `<DocsEditor />` (Phase 8)
- @sbh321/docs-editor-icons — optional default icon set (Phase 4)
- @sbh321/docs-editor-markdown — Markdown import/export (Phase 5)
- @sbh321/docs-editor-docx — DOCX import/export (Phase 5.7)

## Headless *and* batteries-included

These are usually presented as opposites, and the resolution is that they are
different **layers**, not different products. A consumer picks one and can drop
to the next whenever it stops fitting:

| Need | Layer |
| --- | --- |
| A working editor | `<DocsEditor />` |
| Our chrome, their layout | `EditorShell` plus the styled surfaces |
| Their own design system | the headless React primitives |
| No framework | the core engine |

The rule that keeps this honest: **nobody pays for a layer they do not import**.
An application using the primitives with its own design system downloads none of
the styled UI, none of the default schema and no icons. That is enforced by
bundle-size budgets in CI rather than asserted in prose (see
docs/PERFORMANCE.md).

Opinions live in the top layer. *Behaviour* does not: every control there
delegates to a core command, so the batteries change how an editor looks and
never what it does.

Planned packages:

- @sbh321/docs-editor-vue
- @sbh321/docs-editor-theme-default
- @sbh321/docs-editor-utils

Future packages:

- @sbh321/docs-editor-angular
- @sbh321/docs-editor-svelte

---

# Future Ecosystem

Potential packages include:

@sbh321/docs-editor-history

@sbh321/docs-editor-markdown _(shipped in Phase 5 — Markdown import/export)_

@sbh321/docs-editor-docx _(shipped in Phase 5.7 — DOCX import/export)_

@sbh321/docs-editor-export-pdf _(deferred; Phase 5 ships print-to-PDF via `PrintExporter` instead)_

@sbh321/docs-editor-mermaid

@sbh321/docs-editor-math

@sbh321/docs-editor-footnotes

@sbh321/docs-editor-citations

@sbh321/docs-editor-collaboration

@sbh321/docs-editor-devtools

These packages should evolve independently while sharing a common core.

---

# Plugin Philosophy

The editor should remain intentionally small.

Specialized functionality should be delivered through plugins.

Examples:

- Mermaid
- Math
- Footnotes
- Citations
- References
- Timeline
- Diagram
- Emoji
- Mentions

Applications should be able to install only the functionality they require.

---

# Theme Philosophy

Docs Editor is headless by default.

Themes control presentation only.

Themes must never contain business logic.

Applications should be free to implement:

- Material Design
- Tailwind
- Chakra UI
- Custom Design Systems

without modifying the editor.

---

# Public API Goals

The public API should be:

- Minimal
- Predictable
- Fully typed
- Stable
- Tree-shakeable
- Well documented

Breaking changes should be minimized.

---

# Performance Goals

The editor should comfortably support:

- Documents exceeding 100 pages
- Thousands of paragraphs
- Hundreds of images
- Hundreds of tables
- Fast undo/redo
- Smooth scrolling
- Responsive typing
- Efficient serialization
- Minimal re-renders
- Efficient transaction processing
- Lazy-loaded optional features
- Incremental updates
- Large document responsiveness
- Fast initial load
- Small bundle size
- Tree-shakeable packages

---

# Accessibility Goals

Support:

- Keyboard-first workflows
- Screen readers
- ARIA best practices
- Focus management
- High contrast themes

Accessibility is considered a core feature rather than an enhancement.

---

# Supported Platforms

Primary:

- React
- Next.js

Future:

- Vue
- Nuxt
- Angular
- Svelte

---

# Technical Foundation

The project deliberately builds upon mature, battle-tested open-source technologies where appropriate, while retaining ownership of higher-level architecture and developer experience.

Foundational libraries should solve low-level editing problems.

Docs Editor should solve application-facing editing architecture.

Examples include:

- ProseMirror as the editing engine
- Floating UI for positioning
- TurboRepo for monorepo management
- Storybook for component documentation
- Playwright for end-to-end testing
- Vitest for unit testing

These technologies may evolve as the project matures.

---

# Success Criteria

The project is considered successful when:

- Developers can integrate it in less than 30 minutes.
- Professional documents can be written without limitations.
- The public API remains stable.
- Framework adapters remain thin.
- Third-party plugins can be developed independently.
- Large documents remain responsive.
- Documentation is sufficient for new contributors.
- Documents exported from Docs Editor can be opened and edited in Google Docs and Microsoft Word with minimal formatting loss.

---

# Success Metrics

The project should eventually achieve:

- Stable public API
- Excellent documentation
- High test coverage
- Strong plugin ecosystem
- High performance
- Framework independence
- Active open source community

---

# Long-Term Vision

Docs Editor should become the document-editing equivalent of Monaco Editor for rich text.

Applications should be able to install a package, provide their own UI and business logic, and immediately gain access to a professional, extensible document editing engine.

The project should remain focused on editing technology while allowing the surrounding application to own product-specific concerns.

Every architectural decision should reinforce this separation of responsibilities.