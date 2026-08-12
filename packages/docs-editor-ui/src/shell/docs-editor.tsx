import { EditorState, MediaUploadRegistry, insertMedia } from "@sbh321/docs-editor-core";
import {
  defaultKeymap,
  defaultMarkRenderers,
  defaultNodeRenderers,
  defaultSchema,
} from "@sbh321/docs-editor-core/preset";
import { tableEditing } from "@sbh321/docs-editor-core/tables";
import {
  BlockDragLayer,
  Editor,
  EditorProvider,
  FloatingToolbar,
  PageLayoutProvider,
  PageSetupControls,
  PageSurface,
  SlashMenu,
  ThemeProvider,
  ZoomProvider,
  useFileDrop,
  useEditor,
  useMediaNodeViews,
  useMediaUploads,
  useTaskItemNodeViews,
  useZoom,
} from "@sbh321/docs-editor-react";
import { useCallback, useState } from "react";

import { cn } from "../class-names";
import { EditorToolbar } from "../editor/editor-toolbar";
import { FileMenu } from "../editor/file-menu";
import { FindBar } from "../editor/find-bar";
import { TextFormatControls } from "../editor/format-controls";
import { defaultSlashItems } from "../editor/insert-actions";
import { LayoutButton } from "../editor/layout-button";
import { MediaAccessibilityBadge } from "../editor/media-controls";
import { StatusBar } from "../editor/status-bar";
import { UploadMediaButton } from "../editor/upload-media-button";
// The *styled* zoom group, not the headless one from the react package — the
// styled version carries tooltips, which the headless layer cannot reach.
import { ZoomControls } from "../editor/zoom-controls";
import { editorTheme } from "../editor-theme";

import { EditorShell } from "./editor-shell";

import type { EditorShellHeight } from "./editor-shell";
import type { ToolbarItemId, ToolbarItemSlots } from "../editor/toolbar-items";
import type { DropdownMenuItem } from "../primitives/dropdown-menu";
import type { DocumentNode, MediaUploader, PageLayout, Schema } from "@sbh321/docs-editor-core";
import type { ColorSchemePreference, EditorTheme, SlashMenuItem } from "@sbh321/docs-editor-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Places an application can put its own content, keyed by where it goes.
 *
 * Every field is optional and none of them changes editing behaviour — a slot is
 * a *position*, and what goes in it is entirely the application's. They exist so
 * that adding a save indicator or a share button does not mean replacing the
 * region that would otherwise have held it and reimplementing its contents.
 *
 * Slots render **inside the editor's providers**, so `useEditor()`,
 * `useColorScheme()` and the rest work in them.
 */
export interface DocsEditorSlots {
  /** Above the toolbar, full width — a title bar, a breadcrumb, a banner. */
  readonly header?: ReactNode;
  /** Below the status bar, full width. */
  readonly footer?: ReactNode;
  /** Before the toolbar's first item. Never moved into the overflow menu. */
  readonly toolbarStart?: ReactNode;
  /** After the toolbar's last item, before the overflow trigger. */
  readonly toolbarEnd?: ReactNode;
  /**
   * Content for individual toolbar positions, keyed by item id. A built-in id
   * (`"file"`, `"colorScheme"`, …) replaces that control; any other id defines
   * one of your own, which then has to appear in
   * {@link DocsEditorProps.toolbarItems} to be rendered.
   */
  readonly toolbarItem?: ToolbarItemSlots;
  /** Above the sidebar panel's content. */
  readonly sidebarStart?: ReactNode;
  /** Below the sidebar panel's content. */
  readonly sidebarEnd?: ReactNode;
  /** Before the status bar's statistics — a save indicator, a document name. */
  readonly statusBarStart?: ReactNode;
  /** At the end of the status bar, after the zoom controls. */
  readonly statusBarEnd?: ReactNode;
  /** Inside the scrolling canvas, above the page. */
  readonly aboveDocument?: ReactNode;
  /** Inside the scrolling canvas, below the page. */
  readonly belowDocument?: ReactNode;
  /**
   * Inside the canvas, over the page — an application's own overlays. The same
   * position as `children`, named for symmetry with the rest.
   */
  readonly canvasOverlay?: ReactNode;
}

export interface DocsEditorProps {
  /**
   * The document to open. Read **once, on mount** — later changes are ignored,
   * matching `EditorProvider`. Loading a different document means remounting,
   * which is what a `key` is for.
   */
  readonly initialDocument?: DocumentNode;
  /** Called after every change, with the new document. */
  readonly onChange?: (document: DocumentNode) => void;
  /**
   * A schema replacing the default. Use `extendDefaultSchema()` to add types
   * rather than starting over, so the toolbar's controls keep working.
   */
  readonly schema?: Schema;
  /** Read-only mode: the document renders but cannot be edited. */
  readonly readOnly?: boolean;
  /** Initial page layout. Defaults to A4 portrait. */
  readonly pageLayout?: PageLayout;
  /** Flow content onto multiple page sheets as it grows. Defaults to `true`. */
  readonly paginate?: boolean;
  /**
   * How tall the editor is. Defaults to `"parent"`: it fills the element you
   * render it into and forces no size of its own, so give that element a height
   * (`height: 100%`, a flex `1fr` track, a fixed size).
   *
   * Use `"viewport"` for an editor that *is* the page, and `"auto"` for one
   * embedded in a page that scrolls as a whole.
   */
  readonly height?: EditorShellHeight;
  /**
   * The colour scheme, **controlled**. Pair it with `onColorSchemeChange` to
   * keep the toolbar's toggle working; without one the toggle removes itself
   * rather than calling something that silently does nothing.
   *
   * Omit this to let the editor own the scheme, and set the starting point with
   * `defaultColorScheme`.
   */
  readonly colorScheme?: ColorSchemePreference;
  /**
   * The scheme to start in when `colorScheme` is not given. Defaults to
   * `"system"` — follow the operating system.
   */
  readonly defaultColorScheme?: ColorSchemePreference;
  /** Notified whenever the scheme changes — for persisting it, or for controlling it. */
  readonly onColorSchemeChange?: (preference: ColorSchemePreference) => void;
  /**
   * Also set the scheme on `<html>`. Defaults to `false`: an editor embedded in
   * an application must not restyle the document around it. Turn it on when the
   * editor *is* the page, so the body background matches and overscroll does
   * not reveal a white gap behind a dark editor.
   */
  readonly applyColorSchemeToDocument?: boolean;
  /** A theme replacing {@link editorTheme}. Spread that one to adjust it. */
  readonly theme?: EditorTheme;
  /**
   * Moves uploaded bytes to storage — the one piece of uploading that is the
   * application's business (credentials, endpoints, CORS). Given this, the
   * editor supplies everything else: a toolbar upload button, drop-a-file-on-
   * the-page, pending placeholders, and writing the finished URL back into the
   * document. Omit it and no upload affordances render.
   *
   * Read **once, on mount**, like `initialDocument`.
   */
  readonly uploader?: MediaUploader;
  /** Called when the user asks to insert an image, so the app can pick a file. */
  readonly onInsertImage?: () => void;
  /**
   * Show the File menu (import, export as Markdown/HTML/JSON/DOCX, print).
   * Defaults to `true`. Importing replaces the open document and fires
   * `onChange` with it.
   *
   * Equivalent to `hideToolbarItems={["file"]}`, and kept because removing the
   * File menu is a decision about a *feature* rather than about a toolbar.
   */
  readonly fileMenu?: boolean;
  /** Replaces the default toolbar entirely. */
  readonly toolbar?: ReactNode;
  /**
   * Which toolbar controls appear, and in what order. Defaults to
   * `DEFAULT_TOOLBAR_ITEMS`. Ids of your own render the matching entry in
   * `slots.toolbarItem`.
   */
  readonly toolbarItems?: readonly ToolbarItemId[];
  /**
   * Toolbar controls to remove — the subtractive form, for keeping the default
   * bar minus a few things without restating it.
   */
  readonly hiddenToolbarItems?: readonly ToolbarItemId[];
  /**
   * Extra controls at the toolbar's `"extras"` position — an app's own actions,
   * rendered inside the editor's providers so `useEditor` works in them.
   * Ignored when `toolbar` replaces the whole bar.
   */
  readonly toolbarExtras?: ReactNode;
  /** Extra entries appended to the toolbar's insert menu and nothing else. */
  readonly insertMenuItems?: readonly DropdownMenuItem[];
  /** Replaces the slash menu's default items. Pass an empty array for no menu. */
  readonly slashMenuItems?: readonly SlashMenuItem[];
  /**
   * Replaces the default sidebar panel — by default a page-layout panel
   * (size, orientation, margins, page numbers) that a toolbar Layout button
   * opens and closes. A custom sidebar renders always-open instead, since the
   * editor cannot know what to call its toggle; pass `null` for no sidebar.
   */
  readonly sidebar?: ReactNode | null;
  /** Replaces the default status bar. Pass `null` for none. */
  readonly statusBar?: ReactNode | null;
  /** An application's own content, by position — see {@link DocsEditorSlots}. */
  readonly slots?: DocsEditorSlots;
  /** Rendered inside the canvas, over the page — an app's own overlays. */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** The document a new editor opens with: one empty paragraph, ready to type into. */
function emptyDocument(schema: Schema): DocumentNode {
  return schema.createDocument([schema.node("paragraph", undefined, [])]);
}

/**
 * Connects a registry's finished uploads back to the document.
 *
 * A component rather than a call in `DocsEditor`, because `useMediaUploads`
 * needs the editor context and must not be called conditionally — mounting
 * this only when there is a registry keeps the hook rules honest.
 */
function MediaUploadSync({ registry }: { readonly registry: MediaUploadRegistry }): ReactNode {
  useMediaUploads(registry);
  return null;
}

/**
 * The editor surface itself — split out because `useMediaNodeViews` needs the
 * editor context, which only exists inside `EditorProvider`.
 */
function EditorSurface({
  paginate,
  readOnly,
  uploads,
}: {
  readonly paginate: boolean;
  readonly readOnly: boolean;
  readonly uploads: MediaUploadRegistry | null;
}): ReactNode {
  const { state, dispatch } = useEditor();
  // Merged: a document can hold both media and checklists, and each type
  // needs its own view.
  const nodeViews = { ...useMediaNodeViews(), ...useTaskItemNodeViews() };
  // Zoom is state, not rendering: `ZoomProvider` holds the factor and
  // `ZoomControls` changes it, but *applying* it is the consumer's job. Forget
  // this and the controls move a number that scales nothing.
  const { zoom } = useZoom();
  const zoomStyle = { transform: `scale(${String(zoom)})`, transformOrigin: "top center" };

  // Files dropped onto the page upload and insert, the same path as the
  // toolbar's picker. Enabled only when the application supplied an uploader —
  // accepting a drop the editor cannot store would swallow the file silently.
  const { isDraggingOver } = useFileDrop({
    enabled: uploads !== null && !readOnly,
    accept: (file) => file.type.startsWith("image/"),
    onFiles: (files) => {
      if (!uploads) {
        return;
      }
      for (const file of files) {
        const mediaId = uploads.start(file);
        insertMedia("image", { mediaId, alt: file.name })(state, dispatch);
      }
    },
  });

  return (
    <PageSurface
      paginate={paginate}
      style={zoomStyle}
      {...(isDraggingOver ? { className: "de-file-drop-target" } : {})}
    >
      <Editor
        className="de-editor"
        editable={!readOnly}
        nodeRenderers={defaultNodeRenderers()}
        markRenderers={defaultMarkRenderers}
        nodeViews={nodeViews}
        keymap={defaultKeymap}
      />
      {/* Not in read-only: a handle that reorders blocks in a document nobody
          can edit is an affordance for an action that will be refused. */}
      {!readOnly && <BlockDragLayer />}
    </PageSurface>
  );
}

/**
 * A complete, styled editor (ROADMAP Phase 8, Milestone 8.5; brought to full
 * parity with the playground in Phase 9, Milestone 9.10; opened up for
 * composition in Phase 9.5).
 *
 * ```tsx
 * import { DocsEditor } from "@sbh321/docs-editor";
 * import "@sbh321/docs-editor/styles.css";
 *
 * export default () => (
 *   <div style={{ height: "100dvh" }}>
 *     <DocsEditor uploader={myUploader} />
 *   </div>
 * );
 * ```
 *
 * It assembles the default preset, the styled surfaces, and every provider the
 * headless layer needs — including the slash menu, the find bar, the floating
 * selection toolbar, the page-layout panel, drag-to-reorder, and (given an
 * `uploader`) the whole upload flow.
 *
 * ## What its props are for
 *
 * Three kinds, and nothing else. **The document and its transport**
 * (`initialDocument`, `onChange`, `uploader`) — genuinely the application's.
 * **Composition** (`toolbarItems`, `hiddenToolbarItems`, `slots`, `height`) —
 * where the editor's chrome ends and yours begins. **Replacement** (`toolbar`,
 * `sidebar`, `statusBar`) — for when a whole region is yours.
 *
 * It owns its layout in none of those: `height` defaults to `"parent"`, so the
 * editor is exactly as big as the element you put it in.
 *
 * When it stops fitting, drop a layer rather than fighting it: compose
 * `EditorShell` with this package's surfaces, or go all the way down to
 * `@sbh321/docs-editor-react`'s primitives.
 */
export function DocsEditor({
  initialDocument,
  onChange,
  schema = defaultSchema,
  readOnly = false,
  pageLayout,
  paginate = true,
  height = "parent",
  colorScheme,
  defaultColorScheme = "system",
  onColorSchemeChange,
  applyColorSchemeToDocument = false,
  theme = editorTheme,
  uploader,
  onInsertImage,
  fileMenu = true,
  toolbar,
  toolbarItems,
  hiddenToolbarItems,
  toolbarExtras,
  insertMenuItems,
  slashMenuItems,
  sidebar,
  statusBar,
  slots,
  children,
  className,
  style,
}: DocsEditorProps): ReactNode {
  /**
   * The current editing session. `EditorProvider` reads its state only on
   * mount, so *replacing* the document — which is what the File menu's Import
   * does — means a fresh state and a fresh provider, keyed so React remounts
   * it. That is the same key-remount contract `initialDocument` documents for
   * the outside; this is its inside.
   */
  const [session, setSession] = useState(() => ({
    key: 0,
    state: EditorState.create({
      schema,
      doc: initialDocument ?? emptyDocument(schema),
      selection: { anchor: 1, head: 1 },
      history: true,
      // The default schema declares tables, so the batteries tier installs the
      // editing plugin that makes them behave — cell selection, Tab between
      // cells, structure repair. Shipping the schema without it was a
      // half-feature this milestone closed.
      tables: tableEditing,
    }),
  }));

  const replaceDocument = useCallback(
    (doc: DocumentNode) => {
      setSession((previous) => ({
        key: previous.key + 1,
        state: EditorState.create({
          schema,
          doc,
          selection: { anchor: 1, head: 1 },
          history: true,
          tables: tableEditing,
        }),
      }));
      // A remount does not dispatch a transaction, so the change callback is
      // fired by hand — the application saves imported documents like any
      // other edit.
      onChange?.(doc);
    },
    [schema, onChange],
  );

  // The registry owns the upload lifecycle — progress, cancellation, retry —
  // and never touches the document; `mediaId` correlates the two. Created once,
  // like the state: an uploader is wiring, not data.
  const [uploads] = useState(() => (uploader ? new MediaUploadRegistry({ uploader }) : null));

  // Stable identity, so the menu does not re-mount its items every render.
  const [slashDefaults] = useState(defaultSlashItems);

  // Which side panel is showing. A union rather than a boolean so a second
  // panel later — comments, revisions — is one more value, not a second piece
  // of state that can contradict the first.
  const [activePanel, setActivePanel] = useState<"layout" | null>(null);
  const layoutOpen = activePanel === "layout";

  /*
   * Three sidebar shapes:
   * - default: the page-layout panel, toggled by a toolbar Layout button
   * - a custom node: always open — the editor cannot know what to call a
   *   toggle for content it does not recognise
   * - `null`: none
   */
  const hasDefaultSidebar = sidebar === undefined;
  const sidebarContent = hasDefaultSidebar ? <PageSetupControls /> : sidebar;
  const sidebarProps =
    sidebarContent === null
      ? {}
      : {
          sidebar: (
            <>
              {slots?.sidebarStart}
              {sidebarContent}
              {slots?.sidebarEnd}
            </>
          ),
          ...(hasDefaultSidebar
            ? {
                sidebarLabel: "Layout",
                sidebarOpen: layoutOpen,
                // No hamburger: the Layout button is the only control, so a
                // second one would be a duplicate with nothing extra to say.
                sidebarToggle: false,
              }
            : {}),
        };

  /*
   * The toolbar positions this component is the only thing able to fill: each
   * needs state that lives here — an import handler, the panel's open state, an
   * upload registry. An application's own slots are spread last, so overriding
   * one of ours is a matter of naming it.
   */
  const toolbarItemSlots: ToolbarItemSlots = {
    ...(fileMenu ? { file: <FileMenu onImport={replaceDocument} allowImport={!readOnly} /> } : {}),
    ...(hasDefaultSidebar
      ? {
          layout: (
            <LayoutButton
              pressed={layoutOpen}
              onToggle={() => {
                setActivePanel((panel) => (panel === "layout" ? null : "layout"));
              }}
            />
          ),
        }
      : {}),
    ...(uploads !== null && !readOnly ? { upload: <UploadMediaButton uploads={uploads} /> } : {}),
    ...slots?.toolbarItem,
  };

  const defaultToolbar = (
    <EditorToolbar
      slots={toolbarItemSlots}
      {...(toolbarItems ? { items: toolbarItems } : {})}
      {...(hiddenToolbarItems ? { hide: hiddenToolbarItems } : {})}
      {...(onInsertImage ? { onInsertImage } : {})}
      {...(insertMenuItems ? { insertMenuItems } : {})}
      {...(slots?.toolbarStart === undefined ? {} : { leading: slots.toolbarStart })}
      {...(slots?.toolbarEnd === undefined ? {} : { trailing: slots.toolbarEnd })}
    >
      {toolbarExtras}
    </EditorToolbar>
  );

  return (
    <ThemeProvider
      theme={theme}
      {...(colorScheme === undefined ? {} : { colorScheme })}
      defaultColorScheme={defaultColorScheme}
      {...(onColorSchemeChange ? { onColorSchemeChange } : {})}
      applyToDocument={applyColorSchemeToDocument}
      className={cn("de-root", className)}
      {...(style ? { style } : {})}
    >
      <PageLayoutProvider {...(pageLayout ? { initialLayout: pageLayout } : {})}>
        <ZoomProvider>
          <EditorProvider
            key={session.key}
            initialState={session.state}
            {...(onChange
              ? {
                  onStateChange: (state) => {
                    onChange(state.doc);
                  },
                }
              : {})}
          >
            {uploads !== null && <MediaUploadSync registry={uploads} />}
            <EditorShell
              height={height}
              toolbar={toolbar ?? defaultToolbar}
              {...(slots?.header === undefined ? {} : { header: slots.header })}
              {...(slots?.footer === undefined ? {} : { footer: slots.footer })}
              {...sidebarProps}
              {...(statusBar === null
                ? {}
                : {
                    statusBar: statusBar ?? (
                      <StatusBar
                        {...(slots?.statusBarStart === undefined
                          ? {}
                          : { leading: slots.statusBarStart })}
                      >
                        <MediaAccessibilityBadge />
                        <ZoomControls />
                        {slots?.statusBarEnd}
                      </StatusBar>
                    ),
                  })}
            >
              {slots?.aboveDocument !== undefined && (
                <div className="de-canvas-slot de-canvas-slot--above">{slots.aboveDocument}</div>
              )}
              <EditorSurface paginate={paginate} readOnly={readOnly} uploads={uploads} />
              {slots?.belowDocument !== undefined && (
                <div className="de-canvas-slot de-canvas-slot--below">{slots.belowDocument}</div>
              )}
              {/* Floating over the document, opened with Ctrl/Cmd+F. */}
              <FindBar />
              {/* A selection toolbar, so formatting is at hand without a trip
                  to the top of the window. */}
              <FloatingToolbar>
                <TextFormatControls />
              </FloatingToolbar>
              {/* `/` opens a complete insertion palette by default. */}
              <SlashMenu items={slashMenuItems ?? slashDefaults} />
              {slots?.canvasOverlay}
              {children}
            </EditorShell>
          </EditorProvider>
        </ZoomProvider>
      </PageLayoutProvider>
    </ThemeProvider>
  );
}
