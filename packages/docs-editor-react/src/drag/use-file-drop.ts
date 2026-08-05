import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorView } from "../use-editor-view";

export interface FileDropOptions {
  /**
   * Called with the dropped files.
   *
   * Uploading is the **application's** job — credentials, storage and CORS are
   * all outside the editor (CLAUDE.md's scope discipline), so this hook detects
   * the drop and hands the files over rather than doing anything with them.
   */
  readonly onFiles: (files: readonly File[]) => void;
  /** Ignore drops that carry no matching file. Defaults to accepting everything. */
  readonly accept?: (file: File) => boolean;
  /** Turn the listener off without unmounting. Defaults to `true`. */
  readonly enabled?: boolean;
}

export interface FileDropState {
  /** Whether files are currently being dragged over the editor. */
  readonly isDraggingOver: boolean;
}

/**
 * Accepts files dropped onto the editor (ROADMAP Phase 9, Milestone 9.4).
 *
 * ## Why the counter
 *
 * `dragenter` and `dragleave` fire for every element the pointer crosses, so
 * dragging over a document made of many blocks produces a stream of enter/leave
 * pairs and a naive boolean flickers on and off the whole way across. Counting
 * depth and treating zero as "left" is what makes the highlight steady.
 *
 * ## Why `dragover` must be cancelled
 *
 * A browser's default action for a dropped file is to *navigate to it*,
 * replacing the page — the editor and any unsaved work with it. Cancelling
 * `dragover` is what prevents that, and it has to happen even when the drop
 * will be ignored.
 */
export function useFileDrop(options: FileDropOptions): FileDropState {
  const { onFiles, accept, enabled = true } = options;
  const view = useEditorView();
  const [isDraggingOver, setDraggingOver] = useState(false);
  const depth = useRef(0);

  // Held in a ref so changing the handler does not tear down and rebuild the
  // listeners mid-drag, which would lose the depth count.
  //
  // Updated in an effect rather than during render: writing a ref while
  // rendering is a real hazard (React may render without committing), and here
  // it is also unnecessary — the listeners only read it when an event fires,
  // which is always after commit.
  const handlers = useRef({ onFiles, accept });
  useEffect(() => {
    handlers.current = { onFiles, accept };
  });

  const carriesFiles = useCallback((event: DragEvent): boolean => {
    return [...(event.dataTransfer?.types ?? [])].includes("Files");
  }, []);

  useEffect(() => {
    const dom = view?.dom;
    if (!dom || !enabled) {
      return undefined;
    }

    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      depth.current += 1;
      setDraggingOver(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      // Without this the browser navigates away to the dropped file.
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) {
        setDraggingOver(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      depth.current = 0;
      setDraggingOver(false);

      const all = [...(event.dataTransfer?.files ?? [])];
      const filter = handlers.current.accept;
      const files = filter ? all.filter((file) => filter(file)) : all;
      if (files.length > 0) {
        handlers.current.onFiles(files);
      }
    };

    dom.addEventListener("dragenter", onDragEnter);
    dom.addEventListener("dragover", onDragOver);
    dom.addEventListener("dragleave", onDragLeave);
    dom.addEventListener("drop", onDrop);
    return () => {
      dom.removeEventListener("dragenter", onDragEnter);
      dom.removeEventListener("dragover", onDragOver);
      dom.removeEventListener("dragleave", onDragLeave);
      dom.removeEventListener("drop", onDrop);
      depth.current = 0;
    };
  }, [view, enabled, carriesFiles]);

  return { isDraggingOver };
}
