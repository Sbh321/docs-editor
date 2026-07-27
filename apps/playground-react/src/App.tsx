import {
  addColumnAfter,
  addRowAfter,
  baseKeymap,
  chainCommands,
  createParagraphNear,
  createSchema,
  deleteColumn,
  deleteRow,
  deleteTable,
  EditorState,
  exitCode,
  findText,
  HtmlExporter,
  HtmlImporter,
  JsonExporter,
  JsonImporter,
  lift,
  liftEmptyBlock,
  liftListItem,
  mergeCells,
  newlineInCode,
  PrintExporter,
  redo,
  removeFormatting,
  selectionTo,
  SerializationRegistry,
  setBlockType,
  setMark,
  sinkListItem,
  splitBlock,
  splitListItem,
  toggleHeaderRow,
  toggleMark,
  undo,
  wrapIn,
  wrapInList,
} from "@sbh321/docs-editor-core";
import { defaultIcons } from "@sbh321/docs-editor-icons";
import { MarkdownExporter, MarkdownImporter } from "@sbh321/docs-editor-markdown";
import {
  ContextMenu,
  ContextMenuItem,
  Editor,
  EditorProvider,
  FloatingToolbar,
  OutlinePanel,
  PageLayoutProvider,
  PageSetupControls,
  PageSurface,
  SlashMenu,
  TableOfContents,
  ThemeProvider,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  useActiveMarks,
  useEditor,
  useEditorView,
  useIsBlockActive,
  useIsMarkActive,
  usePageLayout,
  useSearchHighlight,
  useZoom,
  ZoomControls,
  ZoomProvider,
} from "@sbh321/docs-editor-react";
import { useCallback, useMemo, useState } from "react";

import { DocumentPreview } from "./DocumentPreview";

import type {
  Command,
  DocumentNode,
  HtmlParseSpec,
  MarkRenderer,
  NodeRenderer,
  PageLayout,
  Schema,
} from "@sbh321/docs-editor-core";
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
type MarkName =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "highlight"
  | "link"
  | "font_family"
  | "text_color";

const DEFAULT_TEXT_COLOR = "#111111";
const DEFAULT_HIGHLIGHT_COLOR = "#fef08a";

/**
 * Web-safe font families users expect, each with a fallback stack so it renders
 * everywhere. The `family` mark attr stores the full stack; Arial is the base
 * font (see `.playground-editor` in styles.css) and the default selection.
 */
const FONT_FAMILIES: readonly { readonly label: string; readonly value: string }[] = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
  { label: "Palatino", value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: "Lucida Console", value: '"Lucida Console", Monaco, monospace' },
];
const DEFAULT_FONT = FONT_FAMILIES[0]?.value ?? "Arial, Helvetica, sans-serif";

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
    italic: {},
    underline: {},
    strikethrough: {},
    // Inline code excludes all other marks (can't be bold-and-code at once).
    code: { excludes: "_" },
    // Highlight carries a background color; toggling uses the default.
    highlight: { attrs: { color: { default: DEFAULT_HIGHLIGHT_COLOR } } },
    // Non-inclusive: typing just past a link isn't part of the link.
    link: { attrs: { href: {} }, inclusive: false },
    // Carries a font-family stack; set (not toggled) via the core `setMark`.
    font_family: { attrs: { family: { default: DEFAULT_FONT } } },
    // Text color, set via `setMark`.
    text_color: { attrs: { color: { default: DEFAULT_TEXT_COLOR } } },
  },
});

// The node/mark render maps are shared: the live `Editor` renders with them,
// and the HTML/print exporters serialize with the *same* maps, so exported and
// printed markup matches exactly what's on screen.
const nodeRenderers: NodeRenderer<NodeName> = {
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
};

const markRenderers: MarkRenderer<MarkName> = {
  bold: () => ["strong", 0],
  italic: () => ["em", 0],
  underline: () => ["u", 0],
  strikethrough: () => ["s", 0],
  code: () => ["code", 0],
  highlight: (mark) => ["mark", { style: `background-color: ${String(mark.attrs.color)}` }, 0],
  link: (mark) => ["a", { href: String(mark.attrs.href) }, 0],
  font_family: (mark) => ["span", { style: `font-family: ${String(mark.attrs.family)}` }, 0],
  text_color: (mark) => ["span", { style: `color: ${String(mark.attrs.color)}` }, 0],
};

/**
 * Builds a print-ready HTML document from the current doc and prints it in a
 * detached window — the browser's print dialog then handles "Save as PDF". The
 * print view is generated from the model (no editor chrome), so it prints as a
 * clean report. See `PrintExporter`.
 */
function printDocument(doc: DocumentNode<NodeName>, pageLayout: PageLayout): void {
  const html = new PrintExporter<NodeName, MarkName>({
    schema,
    nodeRenderers,
    markRenderers,
    title: "Docs Editor Document",
    pageLayout,
  }).serialize(doc);

  // No `noopener` here: we need the returned reference to write the print
  // document into the new window (`noopener` would sever it and return null).
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for layout/images so the printed output is complete.
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

// The inverse of `nodeRenderers`/`markRenderers`: maps DOM tags back to node
// and mark types so pasted or imported HTML (including from Google Docs / Word)
// rebuilds through the schema. `HtmlImporter` sanitizes before this runs, so
// scripts and unsafe URLs never reach these rules.
const htmlParseSpec: HtmlParseSpec<NodeName, MarkName> = {
  nodes: [
    { tag: "p", node: "paragraph" },
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      tag: `h${level}`,
      node: "heading" as const,
      getAttrs: () => ({ level }),
    })),
    { tag: "blockquote", node: "blockquote" },
    { tag: "ul", node: "bullet_list" },
    { tag: "ol", node: "ordered_list" },
    { tag: "li", node: "list_item" },
    { tag: "hr", node: "divider" },
    { tag: "pre", node: "code_block" },
    { tag: "figure", node: "figure" },
    { tag: "figcaption", node: "caption" },
    {
      tag: "img",
      node: "image",
      getAttrs: (el) => ({
        src: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
      }),
    },
  ],
  marks: [
    { tag: "strong", mark: "bold" },
    { tag: "b", mark: "bold" },
    { tag: "em", mark: "italic" },
    { tag: "i", mark: "italic" },
    { tag: "u", mark: "underline" },
    { tag: "s", mark: "strikethrough" },
    { tag: "del", mark: "strikethrough" },
    { tag: "code", mark: "code" },
    {
      tag: "mark",
      mark: "highlight",
      getAttrs: (el) => {
        const match = /background-color:\s*([^;]+)/i.exec(el.getAttribute("style") ?? "");
        return match?.[1] ? { color: match[1].trim() } : {};
      },
    },
    { tag: "a", mark: "link", getAttrs: (el) => ({ href: el.getAttribute("href") ?? "" }) },
    {
      tag: "span",
      mark: "font_family",
      // Only a span that actually declares a font-family becomes a font mark;
      // returning null declines the match for any other span.
      getAttrs: (el) => {
        const match = /font-family:\s*([^;]+)/i.exec(el.getAttribute("style") ?? "");
        return match?.[1] ? { family: match[1].trim() } : null;
      },
    },
    {
      tag: "span",
      mark: "text_color",
      // A `color:` not preceded by `-` (so it ignores `background-color`).
      getAttrs: (el) => {
        const match = /(?:^|;)\s*color:\s*([^;]+)/i.exec(el.getAttribute("style") ?? "");
        return match?.[1] ? { color: match[1].trim() } : null;
      },
    },
  ],
};

/**
 * One registry wiring every format's importer and exporter — the same plugin
 * surface a real app would use. JSON round-trips exactly; HTML and Markdown are
 * faithful within their expressible features.
 */
const serializationRegistry = new SerializationRegistry<NodeName>()
  .registerExporter(new JsonExporter<NodeName, MarkName>(schema))
  .registerImporter(new JsonImporter<NodeName, MarkName>(schema))
  .registerExporter(new HtmlExporter<NodeName, MarkName>({ schema, nodeRenderers, markRenderers }))
  .registerImporter(new HtmlImporter<NodeName, MarkName>({ schema, parseSpec: htmlParseSpec }))
  .registerExporter(new MarkdownExporter<NodeName>())
  .registerImporter(new MarkdownImporter<NodeName, MarkName>(schema));

type SerializationFormat = "json" | "html" | "markdown";

/** Triggers a browser download of `bytes` as `filename`. */
function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * DOCX is binary + async, so it isn't part of the sync string registry — it's
 * handled directly. The `docx`/`mammoth` libraries are heavy, so they're loaded
 * lazily via dynamic `import()`, keeping them out of the main bundle until the
 * user actually exports or imports a `.docx`.
 */
async function exportDocx(doc: DocumentNode<NodeName>): Promise<void> {
  const { DocxExporter } = await import("@sbh321/docs-editor-docx");
  const bytes = await new DocxExporter<NodeName>().serialize(doc);
  downloadBytes(bytes, "document.docx", DOCX_MIME);
}

async function importDocx(file: File): Promise<DocumentNode<NodeName>> {
  const { DocxImporter } = await import("@sbh321/docs-editor-docx");
  const importer = new DocxImporter<NodeName, MarkName>({ schema, parseSpec: htmlParseSpec });
  return importer.parse(await file.arrayBuffer());
}

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
    pageCanvas: "pg-page-canvas",
    page: "pg-page",
    pageHeader: "pg-page-header",
    pageFooter: "pg-page-footer",
    pageSetup: "pg-page-setup",
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
  readonly iconName?: string;
  readonly label: string;
}) {
  const active = useIsMarkActive<NodeName, MarkName>(props.mark);
  return (
    <ToolbarButton
      command={toggleMark(props.mark)}
      active={active}
      label={props.label}
      {...(props.iconName ? { iconName: props.iconName } : {})}
    >
      {props.iconName ? undefined : props.label.replace(/^Toggle /, "")}
    </ToolbarButton>
  );
}

/** A font-family dropdown that reflects and sets the active font via `setMark`. */
function FontFamilySelect() {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const view = useEditorView();
  const activeMarks = useActiveMarks<NodeName, MarkName>();
  const active = activeMarks.find((mark) => mark.type === "font_family");
  const value = typeof active?.attrs.family === "string" ? active.attrs.family : DEFAULT_FONT;

  return (
    <select
      aria-label="Font family"
      className="pg-font-select"
      value={value}
      style={{ fontFamily: value }}
      onChange={(event) => {
        setMark("font_family", { family: event.target.value })(state, dispatch);
        // Return focus to the editor so typing continues in the chosen font.
        view?.focus();
      }}
    >
      {FONT_FAMILIES.map((font) => (
        <option key={font.label} value={font.value} style={{ fontFamily: font.value }}>
          {font.label}
        </option>
      ))}
    </select>
  );
}

/** Reads a color-carrying mark's `color` attr, falling back if absent or non-hex. */
function activeColor(
  marks: readonly { readonly type: string; readonly attrs: Record<string, unknown> }[],
  type: MarkName,
  fallback: string,
): string {
  const color = marks.find((mark) => mark.type === type)?.attrs.color;
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

/** Text-color and highlight-color pickers, applied with the core `setMark`. */
function ColorControls() {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const view = useEditorView();
  const marks = useActiveMarks<NodeName, MarkName>();

  const apply = (mark: MarkName, color: string) => {
    setMark(mark, { color })(state, dispatch);
    view?.focus();
  };

  return (
    <>
      <label className="pg-color-field" title="Text color">
        <span aria-hidden="true">A</span>
        <input
          type="color"
          aria-label="Text color"
          value={activeColor(marks, "text_color", DEFAULT_TEXT_COLOR)}
          onChange={(event) => apply("text_color", event.target.value)}
        />
      </label>
      <label className="pg-color-field" title="Highlight color">
        <span aria-hidden="true">▉</span>
        <input
          type="color"
          aria-label="Highlight color"
          value={activeColor(marks, "highlight", DEFAULT_HIGHLIGHT_COLOR)}
          onChange={(event) => apply("highlight", event.target.value)}
        />
      </label>
    </>
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
  const { layout } = usePageLayout();
  const [href, setHref] = useState("https://docs-editor.example/");

  return (
    <Toolbar label="Formatting" className="pg-toolbar">
      <ToolbarGroup label="History">
        <ToolbarButton command={undo} iconName="undo" label="Undo" />
        <ToolbarButton command={redo} iconName="redo" label="Redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Font">
        <FontFamilySelect />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Color">
        <ColorControls />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Text">
        <MarkButton mark="bold" iconName="bold" label="Toggle bold" />
        <MarkButton mark="italic" iconName="italic" label="Toggle italic" />
        <MarkButton mark="underline" iconName="underline" label="Toggle underline" />
        <MarkButton mark="strikethrough" iconName="strikethrough" label="Toggle strikethrough" />
        <MarkButton mark="code" iconName="code" label="Toggle inline code" />
        <MarkButton mark="highlight" label="Toggle highlight" />
        <ToolbarButton command={removeFormatting} label="Clear formatting">
          Clear
        </ToolbarButton>
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
      <ToolbarGroup label="Export">
        <ToolbarButton onClick={() => printDocument(state.doc, layout)} label="Print / Export PDF">
          Print
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

/**
 * Import/export controls for every registered format plus print. Export reads
 * the live document; import replaces it with a freshly parsed, schema-validated
 * document (see `App`'s `handleImport`).
 */
function ImportExportPanel(props: { readonly onImport: (doc: DocumentNode<NodeName>) => void }) {
  const { state } = useEditor<NodeName, MarkName>();
  const { layout } = usePageLayout();
  const [format, setFormat] = useState<SerializationFormat>("json");
  const [io, setIo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    try {
      setIo(serializationRegistry.export(format, state.doc));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function handleImport() {
    try {
      props.onImport(serializationRegistry.import(format, io));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : String(cause));
  }

  function handleExportDocx() {
    exportDocx(state.doc).then(() => setError(null), report);
  }

  function handleImportDocx(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) {
      return;
    }
    importDocx(file).then((doc) => {
      props.onImport(doc);
      setError(null);
    }, report);
  }

  return (
    <div className="pg-panel pg-io-panel">
      <h2>Import &amp; export</h2>
      <label>
        Format{" "}
        <select
          aria-label="Serialization format"
          value={format}
          onChange={(event) => setFormat(event.target.value as SerializationFormat)}
        >
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="markdown">Markdown</option>
        </select>
      </label>
      <div>
        <button onClick={handleExport}>Export</button>
        <button onClick={handleImport}>Import</button>
        <button onClick={() => printDocument(state.doc, layout)}>Print / PDF</button>
      </div>
      <textarea
        aria-label="Serialized document"
        value={io}
        onChange={(event) => setIo(event.target.value)}
        rows={6}
      />
      <div>
        <button onClick={handleExportDocx}>Export DOCX</button>
        <label className="pg-docx-import">
          Import DOCX{" "}
          <input
            aria-label="Import DOCX file"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleImportDocx}
          />
        </label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

/** Page-setup panel: the headless `PageSetupControls` plus header/footer text. */
function PageSetupPanel(props: {
  readonly paginate: boolean;
  readonly onPaginateChange: (value: boolean) => void;
}) {
  const { layout, setHeader, setFooter } = usePageLayout();

  return (
    <div className="pg-panel">
      <h2>Page setup</h2>
      <PageSetupControls className="pg-page-setup" />
      <label className="pg-field">
        <input
          type="checkbox"
          aria-label="Live pagination"
          checked={props.paginate}
          onChange={(event) => props.onPaginateChange(event.target.checked)}
        />{" "}
        Live pagination (multi-page)
      </label>
      <label className="pg-field">
        Header{" "}
        <input
          aria-label="Page header"
          value={layout.header ?? ""}
          onChange={(event) => setHeader(event.target.value)}
        />
      </label>
      <label className="pg-field">
        Footer{" "}
        <input
          aria-label="Page footer"
          value={layout.footer ?? ""}
          onChange={(event) => setFooter(event.target.value)}
        />
      </label>
    </div>
  );
}

function EditorWorkspace(props: { readonly onImport: (doc: DocumentNode<NodeName>) => void }) {
  const { state } = useEditor<NodeName, MarkName>();
  const { editorStyle } = useZoom();
  const [paginate, setPaginate] = useState(true);

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
        <PageSetupPanel paginate={paginate} onPaginateChange={setPaginate} />
        <ImportExportPanel onImport={props.onImport} />
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
        <p>
          Phase 5 import/export: the sidebar <strong>Import &amp; export</strong> panel drives a{" "}
          <code>SerializationRegistry</code> over JSON, HTML (sanitized on import), and Markdown (
          <code>@sbh321/docs-editor-markdown</code>), plus a <code>PrintExporter</code>-backed{" "}
          <em>Print / PDF</em> action. Phase 5.7 adds binary <strong>DOCX</strong> (
          <code>@sbh321/docs-editor-docx</code>) — export downloads a Word file, import reads one
          through the sanitized HTML path — lazy-loaded so <code>docx</code>/<code>mammoth</code>{" "}
          stay out of the main bundle.
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
          <PageSurface style={editorStyle} paginate={paginate}>
            <Editor
              className="playground-editor"
              nodeRenderers={nodeRenderers}
              markRenderers={markRenderers}
              keymap={{
                // The base keymap first (Backspace/Delete join & delete, Mod-a,
                // Escape selects the parent, …), then our overrides. Enter chains
                // the code-block and list behaviours ahead of the base Enter
                // (createParagraphNear → liftEmptyBlock → splitBlock), so Enter
                // splits a paragraph, creates a new list item, exits an empty list
                // item, and inserts a newline in a code block — all as expected.
                ...baseKeymap,
                "Mod-b": toggleMark("bold"),
                "Mod-i": toggleMark("italic"),
                "Mod-u": toggleMark("underline"),
                "Mod-Shift-x": toggleMark("strikethrough"),
                "Mod-e": toggleMark("code"),
                "Mod-Shift-h": toggleMark("highlight"),
                "Mod-\\": removeFormatting,
                "Mod-z": undo,
                "Shift-Mod-z": redo,
                Enter: chainCommands(
                  newlineInCode,
                  splitListItem("list_item"),
                  liftEmptyBlock,
                  createParagraphNear,
                  splitBlock,
                ),
                "Mod-Enter": exitCode,
                Tab: sinkListItem("list_item"),
                "Shift-Tab": liftListItem("list_item"),
              }}
            />
          </PageSurface>
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
  const [seed, setSeed] = useState(createInitialState);
  // `EditorProvider` reads `initialState` only on mount, so loading an imported
  // document means seeding a fresh state and remounting the provider via `key`.
  // Importing a whole document *is* creating a new `EditorState` — the existing
  // core primitive — rather than a bespoke "replace document" transaction.
  const [instanceKey, setInstanceKey] = useState(0);

  const handleImport = useCallback((doc: DocumentNode<NodeName>) => {
    setSeed(EditorState.create({ schema, doc, history: true, tables: true }));
    setInstanceKey((key) => key + 1);
  }, []);

  return (
    <EditorProvider key={instanceKey} initialState={seed}>
      <ThemeProvider theme={theme}>
        <ZoomProvider>
          <PageLayoutProvider>
            <EditorWorkspace onImport={handleImport} />
          </PageLayoutProvider>
        </ZoomProvider>
      </ThemeProvider>
    </EditorProvider>
  );
}
