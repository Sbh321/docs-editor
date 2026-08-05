import { DocsEditor } from "@sbh321/docs-editor";
import { defaultSchema } from "@sbh321/docs-editor-core/preset";

import { mockUploader } from "./mock-uploader";

import type { ReactNode } from "react";

/**
 * The Docs Editor playground — and the product's promise, executed literally:
 * install the package, plug it in, and a fully functioning editor exists.
 *
 * The **one** line of genuinely application code here is `uploader`. It is
 * irreducible: uploading means an endpoint, credentials and storage, which no
 * editor can invent for you — a real application replaces `mockUploader` with
 * a call to its own backend and changes nothing else. Everything visible —
 * toolbar, File menu (import/export/print), slash palette, find, layout
 * panel, uploads UI, drag-to-reorder, light/dark — is `<DocsEditor />`.
 *
 * If a feature ever needs more code here to work, that is a gap in the
 * package, not a job for this file. It has happened twice (Phases 8 and 9.10);
 * this file staying this size is the regression test.
 */

const initialDocument = defaultSchema.createDocument([
  defaultSchema.node("heading", { level: 1 }, [defaultSchema.text("Docs Editor")]),
  defaultSchema.node("paragraph", undefined, [defaultSchema.text("Hello, Docs Editor.")]),
]);

export function App(): ReactNode {
  return <DocsEditor initialDocument={initialDocument} uploader={mockUploader} />;
}
