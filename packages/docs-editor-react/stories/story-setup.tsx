import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  createSchema,
  EditorState,
  liftEmptyBlock,
  liftListItem,
  redo,
  setBlockType,
  sinkListItem,
  splitBlock,
  splitListItem,
  toggleMark,
  undo,
  wrapIn,
  wrapInList,
} from "@sbh321/docs-editor-core";
import { defaultIcons } from "@sbh321/docs-editor-icons";

import {
  Editor,
  EditorProvider,
  ThemeProvider,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  useIsBlockActive,
  useIsMarkActive,
} from "../src";

import type { EditorTheme } from "../src";
import type { Command } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

/** A compact schema exercising the UI (headings, quote, lists, divider, bold/italic/link). */
export const storySchema = createSchema({
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
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {
    bold: {},
    italic: {},
    link: { attrs: { href: {} }, inclusive: false },
  },
});

export function createStoryState() {
  const doc = storySchema.createDocument([
    storySchema.node("heading", { level: 1 }, [storySchema.text("Getting started")]),
    storySchema.node("paragraph", undefined, [
      storySchema.text("Select text to format it, or type "),
      storySchema.text("/", []),
      storySchema.text(" for the slash menu. Right-click for a context menu."),
    ]),
    storySchema.node("heading", { level: 2 }, [storySchema.text("Details")]),
    storySchema.node("paragraph", undefined, [
      storySchema.text("A second section to navigate to."),
    ]),
  ]);
  return EditorState.create({
    schema: storySchema,
    doc,
    selection: { anchor: 1, head: 1 },
    history: true,
  });
}

const storyKeymap: Readonly<Record<string, Command>> = {
  ...baseKeymap,
  "Mod-b": toggleMark("bold"),
  "Mod-i": toggleMark("italic"),
  "Mod-z": undo,
  "Shift-Mod-z": redo,
  Enter: chainCommands(splitListItem("list_item"), liftEmptyBlock, createParagraphNear, splitBlock),
  Tab: sinkListItem("list_item"),
  "Shift-Tab": liftListItem("list_item"),
};

/** Commands used across the toolbar/menu stories. */
export const storyCommands = {
  bold: toggleMark("bold"),
  italic: toggleMark("italic"),
  heading1: setBlockType("heading", { level: 1 }),
  heading2: setBlockType("heading", { level: 2 }),
  paragraph: setBlockType("paragraph"),
  quote: wrapIn("blockquote"),
  bulletList: wrapInList("bullet_list"),
  orderedList: wrapInList("ordered_list"),
  undo,
  redo,
  insertDivider: ((state, dispatch) => {
    dispatch?.(state.tr.insertNode(state.schema.node("divider")));
    return true;
  }) as Command,
};

/** The theme the stories use — maps slots to the CSS classes injected by {@link StoryStyles}. */
export const storyTheme: EditorTheme = {
  icons: defaultIcons,
  classNames: {
    toolbar: "sb-toolbar",
    toolbarGroup: "sb-toolbar-group",
    toolbarSeparator: "sb-toolbar-separator",
    toolbarButton: "sb-toolbar-button",
    toolbarButtonActive: "sb-toolbar-button--active",
    floatingToolbar: "sb-floating-toolbar",
    slashMenu: "sb-menu",
    slashMenuOption: "sb-option",
    slashMenuOptionActive: "sb-option--active",
    contextMenu: "sb-menu",
    contextMenuItem: "sb-option",
    outline: "sb-outline",
    tableOfContents: "sb-toc",
    zoomControls: "sb-zoom",
    zoomButton: "sb-zoom-button",
    zoomLabel: "sb-zoom-label",
  },
  tokens: { accent: "#2563eb" },
};

const nodeRenderers = {
  paragraph: () => ["p", 0] as const,
  heading: (node: { attrs: Record<string, unknown> }) =>
    [`h${Number(node.attrs.level) || 1}`, 0] as const,
  blockquote: () => ["blockquote", 0] as const,
  bullet_list: () => ["ul", 0] as const,
  ordered_list: () => ["ol", 0] as const,
  list_item: () => ["li", 0] as const,
  divider: () => ["hr"] as const,
};

const markRenderers = {
  bold: () => ["strong", 0] as const,
  italic: () => ["em", 0] as const,
  link: (mark: { attrs: Record<string, unknown> }) =>
    ["a", { href: String(mark.attrs.href) }, 0] as const,
};

const editorStyle: CSSProperties = {
  border: "1px solid #d4d4d8",
  borderRadius: 8,
  padding: "12px 16px",
  minHeight: 120,
  background: "#fff",
};

/**
 * Wraps story content in a live editor (`EditorProvider` + `<Editor />`) so
 * toolbar buttons, menus, and navigation operate on a real document. Render
 * the component under test as `children` (above the editor).
 */
export function StoryEditor({ children }: { readonly children?: ReactNode }): ReactNode {
  return (
    <EditorProvider initialState={createStoryState()}>
      <StoryStyles />
      {children}
      <Editor
        style={editorStyle}
        nodeRenderers={nodeRenderers}
        markRenderers={markRenderers}
        keymap={storyKeymap}
      />
    </EditorProvider>
  );
}

/** A mark button whose pressed state tracks whether the mark is active. */
export function MarkToolbarButton(props: {
  readonly mark: string;
  readonly iconName: string;
  readonly label: string;
}): ReactNode {
  return (
    <ToolbarButton
      command={toggleMark(props.mark)}
      active={useIsMarkActive(props.mark)}
      iconName={props.iconName}
      label={props.label}
    />
  );
}

/** A block button whose pressed state tracks the active block type. */
export function BlockToolbarButton(props: {
  readonly nodeType: string;
  readonly attrs?: Record<string, unknown>;
  readonly command: Command;
  readonly iconName: string;
  readonly label: string;
}): ReactNode {
  const active = useIsBlockActive(props.nodeType, props.attrs);
  return (
    <ToolbarButton
      command={props.command}
      active={active}
      iconName={props.iconName}
      label={props.label}
    />
  );
}

/** The full demo toolbar reused by several stories. */
export function DemoToolbar(): ReactNode {
  return (
    <Toolbar label="Formatting">
      <ToolbarGroup label="History">
        <ToolbarButton command={storyCommands.undo} iconName="undo" label="Undo" />
        <ToolbarButton command={storyCommands.redo} iconName="redo" label="Redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Text">
        <MarkToolbarButton mark="bold" iconName="bold" label="Bold" />
        <MarkToolbarButton mark="italic" iconName="italic" label="Italic" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="Blocks">
        <BlockToolbarButton
          nodeType="heading"
          attrs={{ level: 1 }}
          command={storyCommands.heading1}
          iconName="heading1"
          label="Heading 1"
        />
        <BlockToolbarButton
          nodeType="heading"
          attrs={{ level: 2 }}
          command={storyCommands.heading2}
          iconName="heading2"
          label="Heading 2"
        />
        <BlockToolbarButton
          nodeType="paragraph"
          command={storyCommands.paragraph}
          iconName="paragraph"
          label="Paragraph"
        />
        <ToolbarButton command={storyCommands.quote} iconName="quote" label="Quote" />
        <ToolbarButton
          command={storyCommands.bulletList}
          iconName="bulletList"
          label="Bullet list"
        />
        <ToolbarButton
          command={storyCommands.insertDivider}
          iconName="divider"
          label="Insert divider"
        />
      </ToolbarGroup>
    </Toolbar>
  );
}

/** `StoryEditor` wrapped in the story `ThemeProvider`, so themed components render correctly. */
export function ThemedStory({ children }: { readonly children?: ReactNode }): ReactNode {
  return (
    <ThemeProvider theme={storyTheme}>
      <StoryEditor>{children}</StoryEditor>
    </ThemeProvider>
  );
}

/** Minimal CSS for the story theme's class slots — this is the *story's* styling, not the library's. */
export function StoryStyles(): ReactNode {
  return (
    <style>{`
      .sb-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 6px; border: 1px solid #d4d4d8; border-radius: 8px; margin-bottom: 12px; font-family: system-ui, sans-serif; }
      .sb-toolbar-group { display: flex; gap: 2px; }
      .sb-toolbar-separator { width: 1px; align-self: stretch; background: #d4d4d8; margin: 2px 4px; }
      .sb-toolbar-button { display: inline-flex; align-items: center; gap: 4px; min-width: 30px; height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; font: inherit; }
      .sb-toolbar-button:hover:not(:disabled) { background: #f4f4f5; }
      .sb-toolbar-button:disabled { opacity: 0.4; cursor: not-allowed; }
      .sb-toolbar-button--active { background: #dbeafe; border-color: #93c5fd; color: #2563eb; }
      .sb-floating-toolbar { display: flex; gap: 2px; padding: 4px; border-radius: 8px; background: #18181b; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
      .sb-floating-toolbar .sb-toolbar-button { color: #fafafa; }
      .sb-menu { min-width: 200px; padding: 4px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.15); font-family: system-ui, sans-serif; }
      .sb-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: none; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; font: inherit; }
      .sb-option--active, .sb-option:hover, .sb-option:focus-visible { background: #eff6ff; outline: none; }
      .sb-outline, .sb-toc { display: flex; flex-direction: column; gap: 2px; font-family: system-ui, sans-serif; }
      .sb-outline button, .sb-toc button { border: none; background: transparent; text-align: left; padding: 3px 4px; border-radius: 4px; cursor: pointer; font: inherit; }
      .sb-outline button:hover, .sb-toc button:hover { background: #f4f4f5; }
      .sb-toc ol { margin: 0; padding-left: 18px; }
      .sb-zoom { display: inline-flex; align-items: center; gap: 4px; }
      .sb-zoom-button { width: 28px; height: 28px; border: 1px solid #d4d4d8; border-radius: 6px; background: #fff; cursor: pointer; }
      .sb-zoom-label { min-width: 48px; border: none; background: transparent; cursor: pointer; font: inherit; }
    `}</style>
  );
}
