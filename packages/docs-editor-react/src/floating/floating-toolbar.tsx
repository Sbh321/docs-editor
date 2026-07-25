import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset as offsetMiddleware,
  shift,
  useFloating,
} from "@floating-ui/react";
import { isSelectionEmpty } from "@sbh321/docs-editor-core";
import { useCallback, useEffect } from "react";

import { useThemeClassName } from "../theme/use-theme";
import { useEditorState } from "../use-editor-state";
import { useEditorView } from "../use-editor-view";

import { selectionRect } from "./selection-rect";

import type { Placement } from "@floating-ui/react";
import type { CSSProperties, ReactNode } from "react";

export interface FloatingToolbarProps {
  /** The toolbar's contents — typically `Toolbar`/`ToolbarButton`s scoped to inline formatting. */
  readonly children?: ReactNode;
  /** Placement relative to the selection. Defaults to `"top"`. */
  readonly placement?: Placement;
  /** Gap in pixels between the selection and the toolbar. Defaults to `8`. */
  readonly offset?: number;
  /** Class name for the floating container (in addition to the `"floatingToolbar"` theme class). */
  readonly className?: string;
  readonly style?: CSSProperties;
  /**
   * Overrides when the toolbar shows. By default it appears whenever there's a
   * non-empty text selection. Return `false` to force it hidden (e.g. while a
   * dialog is open).
   */
  readonly open?: boolean;
}

/**
 * A toolbar that floats above the current text selection, following it as it
 * changes, and disappears when the selection collapses — the familiar
 * "select text to format it" surface. Headless: it only positions and
 * shows/hides its `children`; what goes inside (and how it looks) is yours.
 *
 * Anchors to the live `EditorView`'s caret coordinates, so it must be rendered
 * within the same `EditorProvider` as an `<Editor />`.
 */
export function FloatingToolbar(props: FloatingToolbarProps): ReactNode {
  const { children, placement = "top", offset = 8, className, style, open: openOverride } = props;
  const state = useEditorState();
  const view = useEditorView();
  const themeClassName = useThemeClassName("floatingToolbar");

  const hasRangeSelection =
    !isSelectionEmpty(state.selection) && state.selection.type !== "cell" && view !== null;
  const open = (openOverride ?? true) && hasRangeSelection;

  const { refs: floatingRefs, floatingStyles } = useFloating({
    placement,
    open,
    middleware: [offsetMiddleware(offset), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Re-anchor to the selection rectangle whenever the selection (or view)
  // changes. A virtual position reference lets us point Floating UI at a
  // document range that has no single DOM element of its own.
  useEffect(() => {
    if (!open || !view) {
      return;
    }
    floatingRefs.setPositionReference({
      getBoundingClientRect: () => selectionRect(view, state.selection),
      contextElement: view.dom,
    });
  }, [open, view, state.selection, floatingRefs]);

  // Access the ref setter inside a callback (not during render) — accessing
  // `floatingRefs.setFloating` directly in the `ref` prop trips the compiler's
  // "no ref access during render" rule, though it's a stable callback setter.
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => floatingRefs.setFloating(node),
    [floatingRefs],
  );

  if (!open) {
    return null;
  }

  return (
    <FloatingPortal>
      <div
        ref={setFloating}
        role="presentation"
        className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
        style={{ ...floatingStyles, ...style }}
        // Keep the editor selection intact when interacting with the toolbar:
        // a mousedown inside contentEditable-adjacent UI would otherwise move
        // the caret and collapse the selection before the click fires.
        onMouseDown={(event) => event.preventDefault()}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}
