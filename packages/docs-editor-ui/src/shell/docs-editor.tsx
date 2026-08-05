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

import type { DocumentNode, MediaUploader, PageLayout, Schema } from "@sbh321/docs-editor-core";
import type { ColorSchemePreference, EditorTheme, SlashMenuItem } from "@sbh321/docs-editor-react";
import type { ReactNode } from "react";

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
  /** Initial colour scheme. Defaults to following the operating system. */
  readonly colorScheme?: ColorSchemePreference;
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
   */
  readonly fileMenu?: boolean;
  /** Replaces the default toolbar. */
  readonly toolbar?: ReactNode;
  /**
   * Extra controls appended to the **default** toolbar — an app's own actions,
   * rendered inside the editor's providers so `useEditor` works in them.
   * Ignored when `toolbar` replaces the whole bar.
   */
  readonly toolbarExtras?: ReactNode;
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
  /** Rendered inside the canvas, over the page — an app's own overlays. */
  readonly children?: ReactNode;
  readonly className?: string;
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
 * parity with the playground in Phase 9, Milestone 9.10).
 *
 * ```tsx
 * import { DocsEditor } from "@sbh321/docs-editor";
 * import "@sbh321/docs-editor/styles.css";
 *
 * export default () => <DocsEditor uploader={myUploader} />;
 * ```
 *
 * It assembles the default preset, the styled surfaces, and every provider the
 * headless layer needs — including the slash menu, the find bar, the floating
 * selection toolbar, the page-layout panel, drag-to-reorder, and (given an
 * `uploader`) the whole upload flow. Props exist only for what is genuinely
 * the *application's* business — the document, changes to it, upload
 * transport, and which pieces of chrome to replace.
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
  colorScheme = "system",
  theme = editorTheme,
  uploader,
  onInsertImage,
  fileMenu = true,
  toolbar,
  toolbarExtras,
  slashMenuItems,
  sidebar,
  statusBar,
  children,
  className,
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
  const sidebarProps = hasDefaultSidebar
    ? {
        sidebar: <PageSetupControls />,
        sidebarLabel: "Layout",
        sidebarOpen: layoutOpen,
        // No hamburger: the Layout button is the only control, so a second one
        // would be a duplicate with nothing extra to say.
        sidebarToggle: false,
      }
    : sidebar
      ? { sidebar }
      : {};

  const defaultToolbar = (
    <EditorToolbar
      {...(onInsertImage ? { onInsertImage } : {})}
      {...(fileMenu
        ? {
            leading: <FileMenu onImport={replaceDocument} allowImport={!readOnly} />,
          }
        : {})}
    >
      {hasDefaultSidebar && (
        <LayoutButton
          pressed={layoutOpen}
          onToggle={() => {
            setActivePanel((panel) => (panel === "layout" ? null : "layout"));
          }}
        />
      )}
      {uploads !== null && !readOnly && <UploadMediaButton uploads={uploads} />}
      {toolbarExtras}
    </EditorToolbar>
  );

  return (
    <ThemeProvider
      theme={theme}
      defaultColorScheme={colorScheme}
      // The editor *is* the page here, so the body background should match it —
      // otherwise overscroll reveals a white gap behind a dark editor.
      applyToDocument
      className={cn("de-root", className)}
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
              toolbar={toolbar ?? defaultToolbar}
              {...sidebarProps}
              {...(statusBar === null
                ? {}
                : {
                    statusBar: statusBar ?? (
                      <StatusBar>
                        <MediaAccessibilityBadge />
                        <ZoomControls />
                      </StatusBar>
                    ),
                  })}
            >
              <EditorSurface paginate={paginate} readOnly={readOnly} uploads={uploads} />
              {/* Floating over the document, opened with Ctrl/Cmd+F. */}
              <FindBar />
              {/* A selection toolbar, so formatting is at hand without a trip
                  to the top of the window. */}
              <FloatingToolbar>
                <TextFormatControls />
              </FloatingToolbar>
              {/* `/` opens a complete insertion palette by default. */}
              <SlashMenu items={slashMenuItems ?? slashDefaults} />
              {children}
            </EditorShell>
          </EditorProvider>
        </ZoomProvider>
      </PageLayoutProvider>
    </ThemeProvider>
  );
}
