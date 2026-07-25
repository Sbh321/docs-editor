import { useThemeClassName } from "../theme/use-theme";
import { useOutline } from "../use-outline";

import { useOutlineNavigation } from "./use-outline-navigation";

import type { OutlineEntry, OutlineOptions } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

export interface OutlinePanelProps {
  /** How to recognize headings — forwarded to the core `getOutline`. */
  readonly options?: OutlineOptions;
  /** Renders one entry. Defaults to its text, indented by level. */
  readonly renderEntry?: (entry: OutlineEntry, meta: { readonly index: number }) => ReactNode;
  /** Shown when the document has no headings. Defaults to nothing. */
  readonly emptyLabel?: ReactNode;
  /** Pixels of indentation per heading level past the first. Defaults to `12`. */
  readonly indent?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** An accessible name for the navigation region. Defaults to `"Document outline"`. */
  readonly label?: string;
}

/**
 * A flat, clickable list of the document's headings — a jump-to navigation
 * panel. Each entry moves the cursor to its heading and scrolls it into view.
 * Headless: an unstyled `<nav>` of buttons, indented by heading level; style
 * it via `className`, the `"outline*"` theme classes, or `renderEntry`.
 *
 * See `TableOfContents` for a nested, numbered variant.
 */
export function OutlinePanel(props: OutlinePanelProps): ReactNode {
  const { options, renderEntry, emptyLabel, indent = 12, className, style, label } = props;
  const outline = useOutline(options);
  const navigate = useOutlineNavigation();

  const navClassName = useThemeClassName("outline");
  const itemClassName = useThemeClassName("outlineItem");

  if (outline.length === 0) {
    return emptyLabel ? <>{emptyLabel}</> : null;
  }

  return (
    <nav
      aria-label={label ?? "Document outline"}
      className={[navClassName, className].filter(Boolean).join(" ") || undefined}
      style={style}
    >
      {outline.map((entry, index) => (
        <button
          key={`${entry.from}-${index}`}
          type="button"
          className={itemClassName}
          style={{ paddingInlineStart: (entry.level - 1) * indent }}
          data-level={entry.level}
          onClick={() => navigate(entry)}
        >
          {renderEntry ? renderEntry(entry, { index }) : entry.text || "Untitled"}
        </button>
      ))}
    </nav>
  );
}
