import { useMemo } from "react";

import { useThemeClassName } from "../theme/use-theme";
import { useOutline } from "../use-outline";

import { useOutlineNavigation } from "./use-outline-navigation";

import type { OutlineEntry, OutlineOptions } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

interface TocNode {
  readonly entry: OutlineEntry;
  readonly index: number;
  readonly children: TocNode[];
}

/** Nests a flat, level-tagged heading list into a tree for `<ol>` rendering. */
function buildTree(entries: readonly OutlineEntry[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];

  entries.forEach((entry, index) => {
    const node: TocNode = { entry, index, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.entry.level >= entry.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  });

  return roots;
}

export interface TableOfContentsProps {
  /** How to recognize headings — forwarded to the core `getOutline`. */
  readonly options?: OutlineOptions;
  /** Renders one entry's label. Defaults to its text. */
  readonly renderEntry?: (entry: OutlineEntry, meta: { readonly index: number }) => ReactNode;
  /** Shown when the document has no headings. Defaults to nothing. */
  readonly emptyLabel?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** An accessible name for the navigation region. Defaults to `"Table of contents"`. */
  readonly label?: string;
}

/**
 * A nested, ordered table of contents built from the document's headings —
 * each level becomes a nested `<ol>`, so numbering and hierarchy come from
 * semantic markup you can style freely. Clicking an entry navigates to its
 * heading. See `OutlinePanel` for a flat variant.
 */
export function TableOfContents(props: TableOfContentsProps): ReactNode {
  const { options, renderEntry, emptyLabel, className, style, label } = props;
  const outline = useOutline(options);
  const navigate = useOutlineNavigation();
  const tree = useMemo(() => buildTree(outline), [outline]);

  const navClassName = useThemeClassName("tableOfContents");
  const listClassName = useThemeClassName("tableOfContentsList");
  const itemClassName = useThemeClassName("tableOfContentsItem");

  if (outline.length === 0) {
    return emptyLabel ? <>{emptyLabel}</> : null;
  }

  const renderNodes = (nodes: readonly TocNode[]): ReactNode => (
    <ol className={listClassName}>
      {nodes.map((node) => (
        <li
          key={`${node.entry.from}-${node.index}`}
          className={itemClassName}
          data-level={node.entry.level}
        >
          <button type="button" onClick={() => navigate(node.entry)}>
            {renderEntry
              ? renderEntry(node.entry, { index: node.index })
              : node.entry.text || "Untitled"}
          </button>
          {node.children.length > 0 ? renderNodes(node.children) : null}
        </li>
      ))}
    </ol>
  );

  return (
    <nav
      aria-label={label ?? "Table of contents"}
      className={[navClassName, className].filter(Boolean).join(" ") || undefined}
      style={style}
    >
      {renderNodes(tree)}
    </nav>
  );
}
