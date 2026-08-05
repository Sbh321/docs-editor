import {
  HtmlExporter,
  HtmlImporter,
  JsonExporter,
  JsonImporter,
  PrintExporter,
} from "@sbh321/docs-editor-core";
import {
  defaultMarkRenderers,
  defaultNodeRenderers,
  defaultParseSpec,
} from "@sbh321/docs-editor-core/preset";
import { ToolbarButton, ToolbarGroup, useEditor, usePageLayout } from "@sbh321/docs-editor-react";
import { useRef } from "react";

import { DropdownMenu } from "../primitives/dropdown-menu";
import { Tooltip } from "../primitives/tooltip";

import type {
  DocumentNode,
  HtmlParseSpec,
  MarkRenderer,
  NodeRenderer,
} from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

/*
 * The editor context is type-erased (`Schema<string, string>`), while the
 * preset artifacts are typed to the default names. Widening them here is
 * sound: renderers and parse rules are lookup tables keyed by type name, and a
 * name the schema never produces is simply never looked up.
 */
const presetNodeRenderers = (): NodeRenderer<string> =>
  defaultNodeRenderers() as unknown as NodeRenderer<string>;
const presetEagerNodeRenderers = (): NodeRenderer<string> =>
  defaultNodeRenderers({ loading: "eager" }) as unknown as NodeRenderer<string>;
const presetMarkRenderers = defaultMarkRenderers as unknown as MarkRenderer<string>;
const presetParseSpec = defaultParseSpec as unknown as HtmlParseSpec<string, string>;

export interface FileMenuProps {
  /**
   * Receives the parsed document when the user imports a file. `DocsEditor`
   * wires this to replace the open document; a custom composition decides for
   * itself.
   */
  readonly onImport?: (document: DocumentNode) => void;
  /**
   * Show the Import item. `DocsEditor` turns it off in read-only mode — an
   * import that replaces a document nobody may edit is an action that will be
   * refused.
   */
  readonly allowImport?: boolean;
  /** Base name for exported files. Defaults to `"document"`. */
  readonly documentTitle?: string;
  /**
   * Called when an import or export fails — an unreadable file, a parse error.
   * Defaults to `console.error`, because failing silently is how a user
   * concludes their file was imported when it was not.
   */
  readonly onError?: (error: Error) => void;
}

/** The import format a file's extension implies, or `null` for none. */
export function importFormatForFile(name: string): "json" | "markdown" | "html" | "docx" | null {
  const extension = /\.([^.]+)$/.exec(name.toLowerCase())?.[1];
  switch (extension) {
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "html":
    case "htm":
      return "html";
    case "docx":
      return "docx";
    default:
      return null;
  }
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function download(data: BlobPart, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked immediately: the download has already been handed to the browser,
  // and an unreleased object URL keeps its blob alive for the page's lifetime.
  URL.revokeObjectURL(url);
}

/**
 * The file menu: import, export in every shipped format, print
 * (ROADMAP Phase 9, Milestone 9.11).
 *
 * ## Why this is the editor's and not the application's
 *
 * The playground carried all of this for two phases on the grounds that
 * CLAUDE.md makes storage an application concern — and that classification was
 * wrong, caught the third time the same drift was pointed out. Look at the
 * ingredients: `PrintExporter`, the default schema, renderers, parse spec,
 * every importer and exporter. All package-owned. Downloading a file and
 * printing are *browser* interactions, like copy and paste; nothing here
 * touches storage, credentials or a network. What remains genuinely the
 * application's is what it does with `onChange` and what its `uploader` does —
 * the seams stay exactly where CLAUDE.md drew them.
 *
 * ## Loading
 *
 * Markdown and DOCX are imported dynamically, on the click that needs them:
 * DOCX alone is ~262 KB of consumer bundle, and an editor session that never
 * exports one should never download the machinery (the same rule
 * docs/PERFORMANCE.md records for the playground's original wiring). JSON and
 * HTML ride on the core, which is already here.
 *
 * Export uses the **preset** renderers, so a consumer whose schema merely
 * extends the default gets correct markup for every default node; nodes only
 * their schema knows fall back to the exporters' defaults.
 */
export function FileMenu({
  onImport,
  allowImport = true,
  documentTitle = "document",
  onError = (error) => {
    console.error("[docs-editor] file operation failed:", error);
  },
}: FileMenuProps): ReactNode {
  const { state } = useEditor();
  const { layout } = usePageLayout();
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Funnels every failure — sync throw or rejected promise alike — into
  // `onError`, so no export path can fail silently.
  const guard = (work: () => void | Promise<void>): void => {
    void Promise.resolve()
      .then(work)
      .catch((error: unknown) => {
        onError(error instanceof Error ? error : new Error(String(error)));
      });
  };

  const exportHtml = (): string =>
    new HtmlExporter({
      schema: state.schema,
      nodeRenderers: presetNodeRenderers(),
      markRenderers: presetMarkRenderers,
    }).serialize(state.doc);

  const items = [
    ...(allowImport && onImport
      ? [
          {
            id: "import",
            label: "Import…",
            onSelect: () => {
              fileInput.current?.click();
            },
          },
        ]
      : []),
    {
      id: "export-markdown",
      label: "Export as Markdown",
      onSelect: () => {
        guard(async () => {
          const { MarkdownExporter } = await import("@sbh321/docs-editor-markdown");
          download(
            new MarkdownExporter().serialize(state.doc),
            `${documentTitle}.md`,
            "text/markdown",
          );
        });
      },
    },
    {
      id: "export-html",
      label: "Export as HTML",
      onSelect: () => {
        guard(() => {
          download(exportHtml(), `${documentTitle}.html`, "text/html");
        });
      },
    },
    {
      id: "export-json",
      label: "Export as JSON",
      onSelect: () => {
        guard(() => {
          download(
            new JsonExporter(state.schema).serialize(state.doc),
            `${documentTitle}.json`,
            "application/json",
          );
        });
      },
    },
    {
      id: "export-docx",
      label: "Export as DOCX",
      onSelect: () => {
        guard(async () => {
          const { DocxExporter } = await import("@sbh321/docs-editor-docx");
          const bytes = await new DocxExporter().serialize(state.doc);
          download(bytes as BlobPart, `${documentTitle}.docx`, DOCX_MIME);
        });
      },
    },
    {
      id: "print",
      label: "Print",
      onSelect: () => {
        guard(() => {
          const html = new PrintExporter({
            schema: state.schema,
            // Eager: a lazy image that never entered the viewport may not be
            // fetched in time, and a missing image in a PDF is a permanent,
            // silent loss.
            nodeRenderers: presetEagerNodeRenderers(),
            markRenderers: presetMarkRenderers,
            title: documentTitle,
            pageLayout: layout,
          }).serialize(state.doc);

          const printWindow = window.open("", "_blank");
          if (!printWindow) {
            throw new Error("The browser blocked the print window (popup blocking?).");
          }
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        });
      },
    },
  ];

  const importFile = (file: File): void => {
    guard(async () => {
      const format = importFormatForFile(file.name);
      if (format === null) {
        throw new Error(`"${file.name}" is not an importable format (.json, .md, .html, .docx).`);
      }
      switch (format) {
        case "json":
          onImport?.(new JsonImporter(state.schema).parse(await file.text()));
          break;
        case "markdown": {
          const { MarkdownImporter } = await import("@sbh321/docs-editor-markdown");
          onImport?.(new MarkdownImporter(state.schema).parse(await file.text()));
          break;
        }
        case "html":
          onImport?.(
            new HtmlImporter({ schema: state.schema, parseSpec: presetParseSpec }).parse(
              await file.text(),
            ),
          );
          break;
        case "docx": {
          const { DocxImporter } = await import("@sbh321/docs-editor-docx");
          onImport?.(
            await new DocxImporter({ schema: state.schema, parseSpec: presetParseSpec }).parse(
              await file.arrayBuffer(),
            ),
          );
          break;
        }
      }
    });
  };

  return (
    <ToolbarGroup label="File">
      <DropdownMenu
        label="File"
        items={items}
        trigger={
          <Tooltip label="File">
            <ToolbarButton iconName="file" label="File" />
          </Tooltip>
        }
      />
      {/* Rendered even while the menu is closed, so the picker the Import item
          opens always exists. `display: none` is fine *here*, unlike on the
          upload button: the Import menu item is the keyboard route, so the
          input being out of the tab order removes a redundant invisible stop
          rather than the only path. */}
      {allowImport && onImport && (
        <input
          ref={fileInput}
          type="file"
          aria-label="Import file"
          accept=".json,.md,.markdown,.html,.htm,.docx"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              importFile(file);
            }
            // Reset, so importing the same file again fires another change.
            event.target.value = "";
          }}
        />
      )}
    </ToolbarGroup>
  );
}
