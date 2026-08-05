import { useEditorState } from "@sbh321/docs-editor-react";

import { cn } from "../class-names";

import type { DocumentNode } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

export interface StatusBarProps {
  readonly className?: string;
  /** Extra content, rendered at the end — save state, collaborators, a zoom control. */
  readonly children?: ReactNode;
}

/** Counts words and characters in a document. */
function countText(doc: DocumentNode): { words: number; characters: number } {
  let characters = 0;
  let words = 0;

  const visit = (node: DocumentNode) => {
    if (typeof node.text === "string") {
      characters += node.text.length;
      // Counted per text run: a run boundary is a formatting change, never a
      // word boundary, so trailing/leading spaces decide and empty runs add
      // nothing.
      const trimmed = node.text.trim();
      if (trimmed !== "") {
        words += trimmed.split(/\s+/).length;
      }
      return;
    }
    for (const child of node.content) {
      visit(child);
    }
  };

  visit(doc);
  return { words, characters };
}

/**
 * A status bar showing document statistics.
 *
 * Recomputed from the document on each render rather than tracked
 * incrementally. Word counting is a whole-document walk, which Phase 6 measured
 * at well under a millisecond even at `huge` — an incremental counter would be
 * a cache to invalidate for no measurable gain.
 */
export function StatusBar({ className, children }: StatusBarProps): ReactNode {
  const state = useEditorState();
  const { words, characters } = countText(state.doc);

  return (
    <div className={cn("de-status-bar", className)}>
      {/* Polite, so a screen reader is not interrupted on every keystroke. */}
      <span aria-live="polite" className="de-status-bar__stat">
        {words} {words === 1 ? "word" : "words"}
      </span>
      <span className="de-status-bar__stat">
        {characters} {characters === 1 ? "character" : "characters"}
      </span>
      <span className="de-status-bar__spacer" />
      {children}
    </div>
  );
}
