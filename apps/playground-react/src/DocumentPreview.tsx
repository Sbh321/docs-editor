import { isTextNode } from "@sbh321/docs-editor-core";
import { memo } from "react";

import type { DocumentNode } from "@sbh321/docs-editor-core";

interface DocumentPreviewProps {
  readonly node: DocumentNode;
}

/**
 * Debug-only tree view of a `DocumentNode` — not a real rendering pipeline.
 * There's no theme system yet (Phase 4), so there's no principled way to
 * decide "a paragraph renders as `<p>`, bold renders as `<strong>`" — this
 * exists purely to prove `EditorProvider` re-renders on dispatched
 * transactions, not as a preview of what a real editor UI should look like.
 *
 * Memoized on `node` identity, which is what makes it cheap on a large
 * document: since Phase 6 the document model reuses the very same node objects
 * for subtrees an edit didn't touch, so this re-renders only along the changed
 * path instead of rebuilding the whole tree on every keystroke. (Before that,
 * every node was a fresh object each transaction and memoization could never
 * hit — see docs/PERFORMANCE.md.)
 */
export const DocumentPreview = memo(function DocumentPreview({ node }: DocumentPreviewProps) {
  if (isTextNode(node)) {
    const marks = node.marks.map((mark) => mark.type).join(", ");
    return (
      <span>
        {node.text}
        {marks.length > 0 && <sub> [{marks}]</sub>}
      </span>
    );
  }

  return (
    <div style={{ marginLeft: 16, borderLeft: "1px solid #ccc", paddingLeft: 8 }}>
      <strong>{node.type}</strong>
      {node.content.map((child, index) => (
        <DocumentPreview key={index} node={child} />
      ))}
    </div>
  );
});
