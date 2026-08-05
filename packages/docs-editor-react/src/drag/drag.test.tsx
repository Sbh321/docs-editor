import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Editor } from "../editor";
import { createTestState, EditorHarness } from "../test-fixtures";

import { BlockDragLayer } from "./block-drag-layer";
import { useFileDrop } from "./use-file-drop";

import type { ReactNode } from "react";

/**
 * Drag and drop (ROADMAP Phase 9, Milestone 9.4).
 *
 * jsdom has no layout, so geometry — which gap the pointer is nearest — is not
 * testable here and is covered by the Playwright suite instead. What *is*
 * testable, and is where the subtle bugs live, is the event bookkeeping: the
 * enter/leave depth counter, and cancelling `dragover` so the browser does not
 * navigate away to the dropped file.
 */

function fileDragEvent(type: string, files: File[]): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files, dropEffect: "none" },
  });
  return event;
}

function Harness({
  onFiles,
  accept,
}: {
  onFiles: (files: readonly File[]) => void;
  accept?: (file: File) => boolean;
}): ReactNode {
  const { isDraggingOver } = useFileDrop({ onFiles, ...(accept ? { accept } : {}) });
  return <div data-testid="state">{isDraggingOver ? "over" : "idle"}</div>;
}

function renderWithEditor(ui: ReactNode) {
  return render(
    <EditorHarness state={createTestState()}>
      <Editor />
      {ui}
    </EditorHarness>,
  );
}

/** The editable element the hook attaches its listeners to. */
const editable = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>("[contenteditable='true']");
  if (!node) {
    throw new Error("no editable element rendered");
  }
  return node;
};

describe("useFileDrop", () => {
  it("stays 'over' across nested enter/leave pairs", async () => {
    // The bug this guards: dragging across a document made of many elements
    // fires enter/leave for each one, so a plain boolean flickers the whole way.
    const onFiles = vi.fn();
    renderWithEditor(<Harness onFiles={onFiles} />);
    const dom = editable();
    const file = new File(["x"], "a.png", { type: "image/png" });

    dom.dispatchEvent(fileDragEvent("dragenter", [file]));
    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("over");
    });

    // Entering a child, then leaving it: still over the editor.
    dom.dispatchEvent(fileDragEvent("dragenter", [file]));
    dom.dispatchEvent(fileDragEvent("dragleave", [file]));
    expect(screen.getByTestId("state")).toHaveTextContent("over");

    // Leaving the last one: now genuinely out.
    dom.dispatchEvent(fileDragEvent("dragleave", [file]));
    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    });
  });

  it("cancels dragover, without which the browser navigates to the file", () => {
    renderWithEditor(<Harness onFiles={vi.fn()} />);
    const event = fileDragEvent("dragover", []);

    editable().dispatchEvent(event);
    // The default action for a dropped file is to open it, replacing the page —
    // and any unsaved document with it.
    expect(event.defaultPrevented).toBe(true);
  });

  it("hands the dropped files to the application", async () => {
    const onFiles = vi.fn();
    renderWithEditor(<Harness onFiles={onFiles} />);
    const file = new File(["x"], "a.png", { type: "image/png" });

    editable().dispatchEvent(fileDragEvent("drop", [file]));
    await waitFor(() => {
      expect(onFiles).toHaveBeenCalledWith([file]);
    });
  });

  it("applies the accept filter and stays silent when nothing matches", async () => {
    const onFiles = vi.fn();
    renderWithEditor(
      <Harness onFiles={onFiles} accept={(file) => file.type.startsWith("image/")} />,
    );
    const doc = new File(["x"], "a.pdf", { type: "application/pdf" });

    editable().dispatchEvent(fileDragEvent("drop", [doc]));
    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("ignores a drag that carries no files", () => {
    const onFiles = vi.fn();
    renderWithEditor(<Harness onFiles={onFiles} />);

    const event = new Event("dragenter", { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, "dataTransfer", { value: { types: ["text/plain"], files: [] } });
    editable().dispatchEvent(event);

    // Dragging selected *text* within the document is the engine's business, so
    // this hook must not react to it at all.
    //
    // Deliberately not asserting `defaultPrevented` here: the engine cancels
    // the event itself to run its own text drag, so a `false` assertion would
    // fail and a `true` one would credit this hook with someone else's
    // behaviour. What belongs to this hook is its own state and callback.
    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe("BlockDragLayer", () => {
  it("renders no handle until the pointer is over a block", () => {
    // A document being read rather than edited should carry no extra chrome.
    renderWithEditor(<BlockDragLayer />);
    expect(screen.queryByTitle("Move block")).not.toBeInTheDocument();
  });
});
