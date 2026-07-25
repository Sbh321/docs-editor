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
import { defaultIcons } from "@sbh321/docs-editor-icons";
import {
  ContextMenu,
  ContextMenuItem,
  Editor,
  EditorProvider,
  FloatingToolbar,
  OutlinePanel,
  SlashMenu,
  TableOfContents,
  ThemeProvider,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  useEditor,
  useIsBlockActive,
  useIsMarkActive,
  useSearchHighlight,
  useZoom,
  ZoomControls,
  ZoomProvider,
} from "@sbh321/docs-editor-react";
import { useMemo, useState } from "react";

import { DocumentPreview } from "./DocumentPreview";

import type { Command, DocumentNode, Schema } from "@sbh321/docs-editor-core";
import type { EditorTheme, SlashMenuItem } from "@sbh321/docs-editor-react";

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

const IMAGE_SRC = "https://placekitten.com/200/120";

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
    divider: { group: "block" },
    code_block: { group: "block", content: "text*", marks: "none", code: true },
    image: { group: "block", attrs: { src: { default: "" }, alt: { default: "" } } },
    figure: { group: "block", content: "image caption?" },
    caption: { content: "inline*" },
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

// Inserts, expressed as commands so they compose with the toolbar, slash menu,
// and context menu the same way `toggleMark`/`setBlockType` do — there's no
// bespoke "insert" primitive, just `Transaction.insertNode()`.
function insertNodeCommand(build: (nodeSchema: Schema) => DocumentNode): Command {
  return (state, dispatch) => {
    dispatch?.(state.tr.insertNode(build(state.schema)));
    return true;
  };
}

const insertDivider = insertNodeCommand((s) => s.node("divider"));
const insertImage = insertNodeCommand((s) => s.node("image", { src: IMAGE_SRC, alt: "" }));
const insertFigure = insertNodeCommand((s) =>
  s.node("figure", undefined, [
    s.node("image", { src: IMAGE_SRC, alt: "" }),
    s.node("caption", undefined, [s.text("A caption.")]),
  ]),
);
const insertTable = insertNodeCommand((s) => {
  const cell = (text: string) =>
    s.node("table_cell", undefined, [s.node("paragraph", undefined, [s.text(text)])]);
  const row = (a: string, b: string) => s.node("table_row", undefined, [cell(a), cell(b)]);
  return s.node("table", undefined, [row("A", "B"), row("C", "D")]);
});

const theme: EditorTheme = {
  icons: defaultIcons,
  classNames: {
    toolbar: "pg-toolbar",
    toolbarGroup: "pg-toolbar-group",
    toolbarSeparator: "pg-toolbar-separator",
    toolbarButton: "pg-toolbar-button",
    toolbarButtonActive: "pg-toolbar-button--active",
    floatingToolbar: "pg-floating-toolbar",
    slashMenu: "pg-slash-menu",
    slashMenuOption: "pg-slash-option",
    slashMenuOptionActive: "pg-slash-option--active",
    contextMenu: "pg-context-menu",
    contextMenuItem: "pg-context-item",
    outline: "pg-outline",
    tableOfContents: "pg-toc",
    zoomControls: "pg-zoom",
    zoomButton: "pg-zoom-button",
    zoomLabel: "pg-zoom-label",
  },
  tokens: { accent: "#2563eb" },
};

const slashItems: readonly SlashMenuItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    iconName: "heading1",
    keywords: ["h1", "title"],
    command: setBlockType("heading", { level: 1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    iconName: "heading2",
    keywords: ["h2"],
    command: setBlockType("heading", { level: 2 }),
  },
  { id: "quote", label: "Quote", iconName: "quote", command: wrapIn("blockquote") },
  {
    id: "bullet",
    label: "Bullet list",
    iconName: "bulletList",
    keywords: ["ul"],
    command: wrapInList("bullet_list"),
  },
  { id: "code", label: "Code block", iconName: "code", command: setBlockType("code_block") },
  {
    id: "divider",
    label: "Divider",
    iconName: "divider",
    keywords: ["hr", "rule"],
    command: insertDivider,
  },
  { id: "table", label: "Table", iconName: "table", command: insertTable },
];

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

/** A formatting button whose pressed state tracks whether the mark is active. */
function MarkButton(props: {
  readonly mark: MarkName;
  readonly iconName: string;
  readonly label: string;
}) {
  return (
    <ToolbarButton
      command={toggleMark(props.mark)}
      active={useIsMarkActive(props.mark)}
      iconName={props.iconName}
      label={props.label}
    />
  );
}

/** A block-style button whose pressed state tracks the active block type. */
function BlockButton(props: {
  readonly nodeType: NodeName;
  readonly attrs?: Record<string, unknown>;
  readonly command: Command;
  readonly iconName?: string;
  readonly label: string;
  readonly children?: React.ReactNode;
}) {
  const active = useIsBlockActive<NodeName, MarkName>(props.nodeType, props.attrs);
  return (
    <ToolbarButton
      command={props.command}
      active={active}
      label={props.label}
      {...(props.iconName ? { iconName: props.iconName } : {})}
    >
      {props.children}
    </ToolbarButton>
  );
}

function MainToolbar() {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const [href, setHref] = useState("https://docs-editor.example/");

  return (
    <Toolbar label="Formatting" className="pg-toolbar">
      <ToolbarGroup label="History">
        <ToolbarButton command={undo} iconName="undo" label="Undo" />
        <ToolbarButton command={redo} iconName="redo" label="Redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Text">
        <MarkButton mark="bold" iconName="bold" label="Toggle bold" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Blocks">
        <BlockButton
          nodeType="heading"
          attrs={{ level: 1 }}
          command={setBlockType("heading", { level: 1 })}
          iconName="heading1"
          label="Heading 1"
        />
        <BlockButton
          nodeType="heading"
          attrs={{ level: 2 }}
          command={setBlockType("heading", { level: 2 })}
          iconName="heading2"
          label="Heading 2"
        />
        <BlockButton
          nodeType="paragraph"
          command={setBlockType("paragraph")}
          iconName="paragraph"
          label="Paragraph"
        />
        <BlockButton
          nodeType="code_block"
          command={setBlockType("code_block")}
          iconName="code"
          label="Code block"
        />
        <ToolbarButton command={wrapIn("blockquote")} iconName="quote" label="Quote" />
        <ToolbarButton command={lift} label="Un-quote" />
        <ToolbarButton
          command={wrapInList("bullet_list")}
          iconName="bulletList"
          label="Bullet list"
        />
        <ToolbarButton
          command={wrapInList("ordered_list")}
          iconName="orderedList"
          label="Ordered list"
        />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Insert">
        <ToolbarButton command={insertDivider} iconName="divider" label="Insert divider" />
        <ToolbarButton command={insertImage} iconName="image" label="Insert image" />
        <ToolbarButton command={insertFigure} label="Insert figure" />
        <ToolbarButton command={insertTable} iconName="table" label="Insert table" />
        <ToolbarButton onClick={() => dispatch(state.tr.insertText("Hi! "))} label='Insert "Hi! "'>
          Hi!
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Link">
        <input
          aria-label="Link href"
          value={href}
          onChange={(event) => setHref(event.target.value)}
        />
        <ToolbarButton command={toggleMark("link", { href })} iconName="link" label="Toggle link" />
      </ToolbarGroup>
      <ZoomControls className="pg-zoom" />
    </Toolbar>
  );
}

function TableToolbar() {
  return (
    <Toolbar label="Table" className="pg-toolbar">
      <ToolbarButton command={addRowAfter} label="Add row" />
      <ToolbarButton command={addColumnAfter} label="Add column" />
      <ToolbarButton command={deleteRow} label="Delete row" />
      <ToolbarButton command={deleteColumn} label="Delete column" />
      <ToolbarButton command={mergeCells} label="Merge cells" />
      <ToolbarButton command={toggleHeaderRow} label="Toggle header row" />
      <ToolbarButton command={deleteTable} label="Delete table" />
    </Toolbar>
  );
}

function FindReplace() {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const [query, setQuery] = useState("Docs");
  const [replacement, setReplacement] = useState("Replaced");

  const from = Math.min(state.selection.anchor, state.selection.head);
  const to = Math.max(state.selection.anchor, state.selection.head);
  const matches = useMemo(() => (query ? findText(state.doc, query) : []), [state.doc, query]);
  // The "active" match is whichever one the selection currently covers.
  const activeIndex = matches.findIndex((match) => match.from === from && match.to === to);

  // Paint every match live as the query/document change; the selected match
  // gets the active class. This is the Milestone 3.10 deferral resolved:
  // `findText` gives positions, `useSearchHighlight` paints them via the new
  // decoration layer.
  useSearchHighlight(query, activeIndex >= 0 ? { activeIndex } : {});

  function findNext() {
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
    dispatch(state.tr.insertText(replacement, from, to));
  }

  return (
    <div className="pg-panel">
      <h2>Find &amp; replace</h2>
      <input aria-label="Find" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button onClick={findNext}>Find next</button>
      <input
        aria-label="Replace with"
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
      />
      <button onClick={replaceSelection}>Replace</button>
    </div>
  );
}

function EditorWorkspace() {
  const { state } = useEditor<NodeName, MarkName>();
  const { editorStyle } = useZoom();

  return (
    <div className="pg-layout">
      <aside className="pg-sidebar">
        <div className="pg-panel">
          <h2>Outline</h2>
          <OutlinePanel className="pg-outline" />
        </div>
        <div className="pg-panel">
          <h2>Table of contents</h2>
          <TableOfContents className="pg-toc" />
        </div>
        <FindReplace />
        <div className="pg-panel">
          <h2>Document (debug)</h2>
          <div className="document-preview">
            <DocumentPreview node={state.doc} />
          </div>
        </div>
      </aside>

      <main>
        <h1>Docs Editor Playground</h1>
        <p>
          Phase 4 headless UI: a roving-focus <code>Toolbar</code> whose buttons reflect active
          state (<code>useIsMarkActive</code>/<code>useIsBlockActive</code>), a{" "}
          <code>FloatingToolbar</code> over the selection, a <code>/</code> <code>SlashMenu</code>,
          a right-click <code>ContextMenu</code>, <code>OutlinePanel</code>/
          <code>TableOfContents</code> navigation, <code>ZoomControls</code>, and a headless{" "}
          <code>ThemeProvider</code> supplying the class names, tokens, and{" "}
          <code>@sbh321/docs-editor-icons</code> — all fully replaceable, styling optional.
        </p>

        <MainToolbar />
        <TableToolbar />

        <FloatingToolbar className="pg-floating-toolbar">
          <MarkButton mark="bold" iconName="bold" label="Bold (floating)" />
          <FloatingLinkButton />
        </FloatingToolbar>

        <SlashMenu items={slashItems} className="pg-slash-menu" />

        <ContextMenu className="pg-context-menu">
          <ContextMenuItem command={toggleMark("bold")} iconName="bold">
            Bold
          </ContextMenuItem>
          <ContextMenuItem command={setBlockType("heading", { level: 1 })} iconName="heading1">
            Heading 1
          </ContextMenuItem>
          <ContextMenuItem command={wrapIn("blockquote")} iconName="quote">
            Quote
          </ContextMenuItem>
          <ContextMenuItem command={deleteTable} iconName="table">
            Delete table
          </ContextMenuItem>
        </ContextMenu>

        <div className="pg-editor-frame">
          <Editor
            className="playground-editor"
            style={editorStyle}
            nodeRenderers={{
              paragraph: () => ["p", 0],
              heading: (node) => [`h${Number(node.attrs.level) || 1}`, 0],
              blockquote: () => ["blockquote", 0],
              bullet_list: () => ["ul", 0],
              ordered_list: (node) => ["ol", { start: String(node.attrs.order) }, 0],
              list_item: () => ["li", 0],
              divider: () => ["hr"],
              code_block: () => ["pre", ["code", 0]],
              image: (node) => [
                "img",
                { src: String(node.attrs.src), alt: String(node.attrs.alt) },
              ],
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
        </div>
      </main>
    </div>
  );
}

/** A link toggle for the floating toolbar, using a fixed demo href. */
function FloatingLinkButton() {
  return (
    <ToolbarButton
      command={toggleMark("link", { href: "https://docs-editor.example/" })}
      active={useIsMarkActive("link")}
      iconName="link"
      label="Link (floating)"
    />
  );
}

export function App() {
  const [initialState] = useState(createInitialState);

  return (
    <EditorProvider initialState={initialState}>
      <ThemeProvider theme={theme}>
        <ZoomProvider>
          <EditorWorkspace />
        </ZoomProvider>
      </ThemeProvider>
    </EditorProvider>
  );
}
