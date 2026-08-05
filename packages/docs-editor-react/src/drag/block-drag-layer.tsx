import { moveNode, topLevelBlocks } from "@sbh321/docs-editor-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { useThemeClassName, useThemeIcon } from "../theme/use-theme";
import { useEditor } from "../use-editor";
import { useEditorView } from "../use-editor-view";

import type { ReactNode } from "react";

export interface BlockDragLayerProps {
  /** Accessible name for the handle. Defaults to `"Move block"`. */
  readonly label?: string;
  readonly className?: string;
}

/** Where the handle should sit, and which block it belongs to. */
interface HandleTarget {
  readonly pos: number;
  readonly top: number;
  readonly left: number;
  readonly height: number;
}

/**
 * Drag handles for reordering blocks (ROADMAP Phase 9, Milestone 9.4).
 *
 * A handle appears in the margin beside whichever block the pointer is over;
 * dragging it moves that block, with a line showing where it will land.
 *
 * ## Why a hover handle rather than dragging the block itself
 *
 * Text is *selectable*. If a block were draggable directly, every attempt to
 * select a sentence with the mouse would start a drag instead — the two
 * gestures are the same gesture. A separate handle in the margin is what keeps
 * both available, which is why Notion, Craft and Google Docs all use one.
 *
 * ## Accessibility
 *
 * A drag handle is a pointer-only affordance, so the same operation is bound to
 * `Alt+Shift+Up/Down` in the default keymap (core's `moveBlock`). This layer is
 * an *addition* to that route, never the only one. The handle itself is not a
 * tab stop: it appears on hover and would otherwise put an unreachable,
 * invisible button between every pair of blocks.
 *
 * Renders nothing until the pointer is over a block, so a document being read
 * rather than edited carries no extra chrome.
 */
export function BlockDragLayer({
  label = "Move block",
  className,
}: BlockDragLayerProps): ReactNode {
  const { state, dispatch } = useEditor();
  const view = useEditorView();

  const [target, setTarget] = useState<HandleTarget | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<{ pos: number; top: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleClassName = useThemeClassName("blockDragHandle");
  const indicatorClassName = useThemeClassName("blockDropIndicator");
  const icon = useThemeIcon("dragHandle");

  const editable = view?.dom ?? null;

  /**
   * Maps each top-level block to the rectangle it renders as.
   *
   * The document model knows the order; only the DOM knows the geometry. They
   * are matched by *index* rather than by position, because the editable's
   * children are exactly the top-level blocks in the same order.
   */
  const blockRects = useCallback((): { pos: number; rect: DOMRect }[] => {
    if (!editable || !containerRef.current) {
      return [];
    }
    const blocks = topLevelBlocks(state);
    const children = [...editable.children];
    return blocks.flatMap((block, index) => {
      const element = children[index];
      return element ? [{ pos: block.pos, rect: element.getBoundingClientRect() }] : [];
    });
  }, [state, editable]);

  /**
   * Track which block the pointer is over, to place the handle.
   *
   * Listened for on the layer's **parent**, not on the editable. The handle
   * sits in the margin *outside* the editable, so tracking the editable alone
   * meant that moving the mouse towards the handle fired `mouseleave`, unmounted
   * it, and made it impossible to grab — the control vanished exactly as you
   * reached for it. The hit test is still against block rectangles, so the
   * handle only appears beside a real block.
   */
  useEffect(() => {
    const zone = containerRef.current?.parentElement;
    if (!zone || !editable) {
      return undefined;
    }

    const onMove = (event: MouseEvent) => {
      if (dragging !== null) {
        return;
      }
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) {
        return;
      }
      const hit = blockRects().find(
        ({ rect }) => event.clientY >= rect.top && event.clientY <= rect.bottom,
      );
      setTarget(
        hit
          ? {
              pos: hit.pos,
              top: hit.rect.top - container.top,
              left: hit.rect.left - container.left,
              height: hit.rect.height,
            }
          : null,
      );
    };

    const onLeave = () => {
      if (dragging === null) {
        setTarget(null);
      }
    };

    zone.addEventListener("mousemove", onMove);
    zone.addEventListener("mouseleave", onLeave);
    return () => {
      zone.removeEventListener("mousemove", onMove);
      zone.removeEventListener("mouseleave", onLeave);
    };
  }, [editable, dragging, blockRects]);

  /** The gap nearest the pointer, as a drop position and a line offset. */
  const dropTargetAt = useCallback(
    (clientY: number): { pos: number; top: number } | null => {
      const container = containerRef.current?.getBoundingClientRect();
      const rects = blockRects();
      if (!container || rects.length === 0) {
        return null;
      }

      for (const { pos, rect } of rects) {
        if (clientY < rect.top + rect.height / 2) {
          return { pos, top: rect.top - container.top };
        }
      }
      // Past the last block's midpoint: the end of the document.
      const last = rects[rects.length - 1];
      if (!last) {
        return null;
      }
      const blocks = topLevelBlocks(state);
      const end = blocks.reduce((total, block) => total + block.size, 0);
      return { pos: end, top: last.rect.bottom - container.top };
    },
    [blockRects, state],
  );

  const onDragStart = (event: React.DragEvent) => {
    if (target === null) {
      return;
    }
    setDragging(target.pos);
    // Required for a drag to start at all in Firefox, and the payload is
    // deliberately inert text rather than anything a drop elsewhere could act
    // on.
    event.dataTransfer.setData("text/plain", "");
    event.dataTransfer.effectAllowed = "move";
  };

  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };

  /**
   * Drag tracking, attached to the layer's **parent** in the capture phase.
   *
   * Two reasons it cannot be a React handler on the layer itself. The layer is
   * `pointer-events: none` so that it never intercepts clicks on the document,
   * which also means it is never the target of a drop. And the editable
   * underneath has the engine's own drop handler on it — which, in the bubble
   * phase, would run first and try to insert the drag's payload as content.
   * A capture-phase listener on an ancestor sees the event before either.
   */
  useEffect(() => {
    const container = containerRef.current;
    const zone = container?.parentElement;
    if (!zone || dragging === null) {
      return undefined;
    }

    const onDragOver = (event: DragEvent) => {
      // Without cancelling this, no drop event is delivered at all.
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      setDropAt(dropTargetAt(event.clientY));
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      // Stopped so the engine does not also handle a drop this layer has
      // already turned into a node move.
      event.stopPropagation();
      const destination = dropTargetAt(event.clientY);
      if (destination) {
        moveNode(dragging, destination.pos)(state, dispatch);
      }
      setDragging(null);
      setDropAt(null);
      setTarget(null);
    };

    zone.addEventListener("dragover", onDragOver, true);
    zone.addEventListener("drop", onDrop, true);
    return () => {
      zone.removeEventListener("dragover", onDragOver, true);
      zone.removeEventListener("drop", onDrop, true);
    };
  }, [dragging, dropTargetAt, state, dispatch]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {target !== null && (
        <div
          className={handleClassName}
          role="presentation"
          draggable
          onDragStart={onDragStart}
          onDragEnd={endDrag}
          aria-label={label}
          title={label}
          style={{
            position: "absolute",
            top: target.top,
            left: target.left,
            height: Math.min(target.height, 24),
            pointerEvents: "auto",
            cursor: "grab",
          }}
        >
          {icon}
        </div>
      )}

      {dropAt !== null && (
        <div
          className={indicatorClassName}
          role="presentation"
          style={{ position: "absolute", top: dropAt.top, left: 0, right: 0 }}
        />
      )}
    </div>
  );
}
