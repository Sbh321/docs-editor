import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Editor } from "../editor";
import { EditorProvider } from "../editor-provider";

import { PageLayoutProvider } from "./page-layout-provider";
import { PageSurface } from "./page-surface";

/**
 * Teardown regression tests for live pagination (ROADMAP Phase 6, Milestone
 * 6.5).
 *
 * Pagination attaches a `ResizeObserver` and schedules debounced timers and
 * animation frames. ARCHITECTURE's Memory Management section forbids leaks and
 * retained observers, and a leaked observer here would keep firing against a
 * destroyed editor for the life of the page — invisible to every functional
 * test. jsdom has no `ResizeObserver`, so it is stubbed to record its lifecycle.
 */

const observers: StubResizeObserver[] = [];

class StubResizeObserver {
  observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {
    /* not used by the hook */
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

function createTestState() {
  const schema = createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { group: "block", content: "inline*" },
      text: { group: "inline", isText: true, marks: "all" },
    },
  });
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

function renderPaginated(paginate: boolean) {
  return render(
    <EditorProvider initialState={createTestState()}>
      <PageLayoutProvider>
        <PageSurface paginate={paginate}>
          <Editor className="paged-editor" />
        </PageSurface>
      </PageLayoutProvider>
    </EditorProvider>,
  );
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pagination teardown", () => {
  it("observes the editor while paginating and disconnects on unmount", () => {
    const { unmount } = renderPaginated(true);

    expect(observers).toHaveLength(1);
    expect(observers[0]?.observed.length).toBeGreaterThan(0);
    expect(observers[0]?.disconnected).toBe(false);

    unmount();

    expect(observers[0]?.disconnected).toBe(true);
  });

  it("leaves no pending timer or animation frame behind after unmount", () => {
    const { unmount } = renderPaginated(true);
    // A measurement pass is queued on mount.
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    // Nothing may remain that could fire against the destroyed editor.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not accumulate observers across repeated mount/unmount cycles", () => {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const { unmount } = renderPaginated(true);
      unmount();
    }

    expect(observers).toHaveLength(10);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("attaches no observer when pagination is disabled", () => {
    const { unmount } = renderPaginated(false);
    expect(observers).toHaveLength(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
