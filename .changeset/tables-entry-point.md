---
"@sbh321/docs-editor-core": minor
---

**Breaking:** interactive table editing moved behind its own entry point and is
now passed to `EditorState.create` instead of enabled with a flag
(Phase 6, Milestone 6.6).

```diff
+import { tableEditing } from "@sbh321/docs-editor-core/tables";
+
-EditorState.create({ schema, doc, tables: true });
+EditorState.create({ schema, doc, tables: tableEditing });
```

Migration is that one import. The table *commands* (`addRowAfter`,
`mergeCells`, …) are unchanged and stay on the main entry point.

**Why.** Supporting `tables: true` required the core to import the table plugin
unconditionally: a reference inside `if (options.tables)` is one no bundler can
prove unreachable. So *every* `EditorState` — table schema or not — pulled in
`prosemirror-tables` and, through it, `prosemirror-view`. A headless bundle
weighed almost exactly the same as a full React editor.

Passing the plugin in means importing it is what pulls the implementation, so a
document that never uses tables never pays for it:

| Bundle | Before | After |
| --- | ---: | ---: |
| headless (schema + state + one command) | 73.5 KB gz | **36.0 KB gz** (−51%) |
| minimum React editor | 74.1 KB gz | 71.3 KB gz |

Taken while the package is pre-release, when the change is cheapest, and it is
the shape `CLAUDE.md` already calls for — plugins extend the core rather than
being baked into it. The engine boundary is preserved: `EditorPlugin` is opaque
and its internals are stripped from the published types, so no ProseMirror type
crosses the package boundary.

Also adds `scripts/explain-bundle.mjs`, which prints the shortest import path
from an entry point to any package — turning "the bundle grew" into a specific
import to fix.
