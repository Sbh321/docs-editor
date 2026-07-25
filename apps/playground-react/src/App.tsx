import {
  addColumnAfter,
  addRowAfter,
  chainCommands,
  createSchema,
  deleteColumn,
  deleteRow,
  deleteTable,
  EditorState,
  exitCode,
  findText,
  lift,
  liftListItem,
  mergeCells,
  newlineInCode,
  redo,
  selectionTo,
  setBlockType,
  sinkListItem,
  splitListItem,
  toggleHeaderRow,
  toggleMark,
  undo,
  wrapIn,
  wrapInList,
} from "@sbh321/docs-editor-core";
import { Editor, EditorProvider, useEditor } from "@sbh321/docs-editor-react";
import { useState } from "react";

import { DocumentPreview } from "./DocumentPreview";

type NodeName =
  | "doc"
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "divider"
  | "code_block"
  | "image"
  | "figure"
  | "caption"
  | "table"
  | "table_row"
  | "table_cell"
  | "table_header"
  | "text";
type MarkName = "bold" | "link";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
    blockquote: { group: "block", content: "block+" },
    bullet_list: { group: "block", content: "list_item+" },
    ordered_list: { group: "block", content: "list_item+", attrs: { order: { default: 1 } } },
    list_item: { content: "paragraph block*" },
    // No `content` at all: a leaf node — no children ever allowed.
    divider: { group: "block" },
    code_block: { group: "block", content: "text*", marks: "none", code: true },
    // `src` needs a default so `image` is "generatable" — it's required
    // (not optional) in `figure`'s content below, and ProseMirror's schema
    // compiler rejects a required content position filled by a node type
    // it can't construct from defaults alone.
    image: { group: "block", attrs: { src: { default: "" }, alt: { default: "" } } },
    figure: { group: "block", content: "image caption?" },
    caption: { content: "inline*" },
    // Tables. `table_row`'s content uses the shared "tablecell" group both
    // cell types declare (the content grammar has no alternation, but the
    // matcher resolves groups). `tableRole` is what the engine's table
    // support keys off; cells are `isolating` and carry colspan/rowspan.
    table: { group: "block", content: "table_row+", tableRole: "table", isolating: true },
    table_row: { content: "tablecell+", tableRole: "row" },
    table_cell: {
      content: "block+",
      group: "tablecell",
      tableRole: "cell",
      isolating: true,
      attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
    },
    table_header: {
      content: "block+",
      group: "tablecell",
      tableRole: "header_cell",
      isolating: true,
      attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
    },
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {
    bold: {},
    link: { attrs: { href: {} } },
  },
});

function createInitialState() {
  const doc = schema.createDocument([
    schema.node("paragraph", undefined, [schema.text("Hello, Docs Editor.")]),
  ]);
  return EditorState.create({
    schema,
    doc,
    selection: { anchor: 1, head: 1 },
    history: true,
    tables: true,
  });
}

function EditorPlayground() {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const [href, setHref] = useState("https://example.com");
  const [imageSrc, setImageSrc] = useState("https://placekitten.com/200/120");
  const [query, setQuery] = useState("Docs");
  const [replacement, setReplacement] = useState("Replaced");

  function findNext() {
    const matches = findText(state.doc, query);
    if (matches.length === 0) {
      return;
    }
    const cursor = selectionTo(state.selection);
    const next = matches.find((match) => match.from >= cursor) ?? matches[0];
    if (next) {
      dispatch(state.tr.setSelection({ anchor: next.from, head: next.to }));
    }
  }

  function replaceSelection() {
    const from = Math.min(state.selection.anchor, state.selection.head);
    const to = Math.max(state.selection.anchor, state.selection.head);
    dispatch(state.tr.insertText(replacement, from, to));
  }

  function insertTable() {
    const cell = (text: string) =>
      state.schema.node("table_cell", undefined, [
        state.schema.node("paragraph", undefined, [state.schema.text(text)]),
      ]);
    const row = (a: string, b: string) =>
      state.schema.node("table_row", undefined, [cell(a), cell(b)]);
    // A table is an ordinary node inserted with insertNode() — no bespoke
    // "insertTable" command, the same primitive dividers/images use.
    dispatch(
      state.tr.insertNode(state.schema.node("table", undefined, [row("A", "B"), row("C", "D")])),
    );
  }

  return (
    <main>
      <h1>Docs Editor Playground</h1>
      <p>
        <code>@sbh321/docs-editor-react</code>'s <code>&lt;Editor /&gt;</code> below is real,
        typeable <code>contentEditable</code> rendering. Phase 3: <code>heading</code> changes a
        block's type in place via <code>setBlockType</code>; <code>blockquote</code> wraps/unwraps
        via <code>wrapIn</code>/<code>lift</code>; <code>link</code> is just <code>toggleMark</code>{" "}
        with an attribute-carrying mark; lists use <code>wrapInList</code> plus <code>Enter</code>/
        <code>Tab</code>/<code>Shift-Tab</code> bound to <code>splitListItem</code>/
        <code>sinkListItem</code>/<code>liftListItem</code> — click into a list item and try them.{" "}
        <code>divider</code>/<code>image</code>/<code>figure</code> are leaf/near-leaf nodes
        inserted via <code>Transaction.insertNode()</code>. <code>code_block</code> declares{" "}
        <code>code: true</code>, so <kbd>Enter</kbd> inside it inserts a newline (
        <code>newlineInCode</code>) instead of splitting, and <kbd>Ctrl/Cmd-Enter</kbd> exits it (
        <code>exitCode</code>). <code>table</code> is a real table (<code>tableRole</code>-tagged{" "}
        <code>table</code>/<code>table_row</code>/<code>table_cell</code> nodes): "Insert table"
        builds one with <code>insertNode()</code> (no bespoke command), and with{" "}
        <code>tables: true</code> enabled you can drag across cells to make a rectangular{" "}
        <code>cell</code> selection (a new <code>Selection</code> <code>type</code>), then run{" "}
        <code>addRowAfter</code>/<code>addColumnAfter</code>/<code>deleteRow</code>/
        <code>deleteColumn</code>/<code>mergeCells</code>/<code>toggleHeaderRow</code>/
        <code>deleteTable</code>. <code>nodeRenderers</code>/<code>markRenderers</code> map{" "}
        <code>paragraph</code> → <code>&lt;p&gt;</code>, <code>heading</code> →{" "}
        <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>, <code>blockquote</code> →{" "}
        <code>&lt;blockquote&gt;</code>, <code>bullet_list</code>/<code>ordered_list</code>/
        <code>list_item</code> → <code>&lt;ul&gt;</code>/<code>&lt;ol&gt;</code>/
        <code>&lt;li&gt;</code>, <code>divider</code> → <code>&lt;hr&gt;</code>,{" "}
        <code>code_block</code> → <code>&lt;pre&gt;&lt;code&gt;</code>, <code>image</code> →{" "}
        <code>&lt;img&gt;</code>, <code>figure</code>/<code>caption</code> →{" "}
        <code>&lt;figure&gt;</code>/<code>&lt;figcaption&gt;</code>, <code>bold</code> →{" "}
        <code>&lt;strong&gt;</code>, and <code>link</code> → <code>&lt;a href&gt;</code> — there's
        still no theme system (Phase 4), so anything without an entry in those maps still falls back
        to a generic, unstyled element named after it. Other shortcuts: <kbd>Ctrl/Cmd-B</kbd>{" "}
        (bold), <kbd>Ctrl/Cmd-Z</kbd> (undo), <kbd>Ctrl/Cmd-Shift-Z</kbd> (redo). "Find next" uses
        the new <code>findText()</code> — a pure function over the document tree, no engine involved
        — and "Replace" is just <code>insertText</code> over a match's range; there's no separate
        replace primitive. The tree below the buttons is a separate debug preview of the same state.
      </p>
      <div>
        <button onClick={() => dispatch(state.tr.insertText("Hi! "))}>Insert "Hi! "</button>
        <button onClick={() => toggleMark("bold")(state, dispatch)}>Toggle bold</button>
        <button onClick={() => setBlockType("heading", { level: 1 })(state, dispatch)}>
          Heading 1
        </button>
        <button onClick={() => setBlockType("heading", { level: 2 })(state, dispatch)}>
          Heading 2
        </button>
        <button onClick={() => setBlockType("paragraph")(state, dispatch)}>Paragraph</button>
        <button onClick={() => setBlockType("code_block")(state, dispatch)}>Code block</button>
        <button onClick={() => wrapIn("blockquote")(state, dispatch)}>Quote</button>
        <button onClick={() => lift(state, dispatch)}>Un-quote</button>
        <button onClick={() => wrapInList("bullet_list")(state, dispatch)}>Bullet list</button>
        <button onClick={() => wrapInList("ordered_list")(state, dispatch)}>Ordered list</button>
        <button onClick={() => dispatch(state.tr.insertNode(state.schema.node("divider")))}>
          Insert divider
        </button>
        <input
          aria-label="Link href"
          value={href}
          onChange={(event) => setHref(event.target.value)}
        />
        <button onClick={() => toggleMark("link", { href })(state, dispatch)}>Toggle link</button>
        <input
          aria-label="Image src"
          value={imageSrc}
          onChange={(event) => setImageSrc(event.target.value)}
        />
        <button
          onClick={() =>
            dispatch(state.tr.insertNode(state.schema.node("image", { src: imageSrc, alt: "" })))
          }
        >
          Insert image
        </button>
        <button
          onClick={() =>
            dispatch(
              state.tr.insertNode(
                state.schema.node("figure", undefined, [
                  state.schema.node("image", { src: imageSrc, alt: "" }),
                  state.schema.node("caption", undefined, [state.schema.text("A caption.")]),
                ]),
              ),
            )
          }
        >
          Insert figure
        </button>
        <button onClick={() => undo(state, dispatch)}>Undo</button>
        <button onClick={() => redo(state, dispatch)}>Redo</button>
      </div>
      <div>
        <input aria-label="Find" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button onClick={findNext}>Find next</button>
        <input
          aria-label="Replace with"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
        <button onClick={replaceSelection}>Replace</button>
      </div>
      <div>
        <button onClick={insertTable}>Insert table</button>
        <button onClick={() => addRowAfter(state, dispatch)}>Add row</button>
        <button onClick={() => addColumnAfter(state, dispatch)}>Add column</button>
        <button onClick={() => deleteRow(state, dispatch)}>Delete row</button>
        <button onClick={() => deleteColumn(state, dispatch)}>Delete column</button>
        <button onClick={() => mergeCells(state, dispatch)}>Merge cells</button>
        <button onClick={() => toggleHeaderRow(state, dispatch)}>Toggle header row</button>
        <button onClick={() => deleteTable(state, dispatch)}>Delete table</button>
      </div>
      <Editor
        className="playground-editor"
        nodeRenderers={{
          paragraph: () => ["p", 0],
          heading: (node) => [`h${Number(node.attrs.level) || 1}`, 0],
          blockquote: () => ["blockquote", 0],
          bullet_list: () => ["ul", 0],
          ordered_list: (node) => ["ol", { start: String(node.attrs.order) }, 0],
          list_item: () => ["li", 0],
          divider: () => ["hr"],
          code_block: () => ["pre", ["code", 0]],
          image: (node) => ["img", { src: String(node.attrs.src), alt: String(node.attrs.alt) }],
          figure: () => ["figure", 0],
          caption: () => ["figcaption", 0],
          table: () => ["table", ["tbody", 0]],
          table_row: () => ["tr", 0],
          table_cell: (node) => [
            "td",
            { colspan: String(node.attrs.colspan), rowspan: String(node.attrs.rowspan) },
            0,
          ],
          table_header: (node) => [
            "th",
            { colspan: String(node.attrs.colspan), rowspan: String(node.attrs.rowspan) },
            0,
          ],
        }}
        markRenderers={{
          bold: () => ["strong", 0],
          link: (mark) => ["a", { href: String(mark.attrs.href) }, 0],
        }}
        keymap={{
          "Mod-b": toggleMark("bold"),
          "Mod-z": undo,
          "Shift-Mod-z": redo,
          Enter: chainCommands(newlineInCode, splitListItem("list_item")),
          "Mod-Enter": exitCode,
          Tab: sinkListItem("list_item"),
          "Shift-Tab": liftListItem("list_item"),
        }}
      />
      <div className="document-preview">
        <DocumentPreview node={state.doc} />
      </div>
    </main>
  );
}

export function App() {
  const [initialState] = useState(createInitialState);

  return (
    <EditorProvider initialState={initialState}>
      <EditorPlayground />
    </EditorProvider>
  );
}
