import { describe, expect, it, vi } from "vitest";

import { createFixtureSchema } from "../../schema/schema.fixtures";

import {
  applyEngineTransaction,
  createEngineState,
  createEngineTransaction,
  engineTransactionInsertText,
} from "./state";
import {
  createEngineView,
  destroyEngineView,
  engineViewDom,
  engineViewHasFocus,
  focusEngineView,
  updateEngineViewState,
} from "./view";

function createTestEngineState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return createEngineState(schema, doc, { anchor: 1, head: 1 });
}

describe("engine view", () => {
  it("mounts an editable DOM node under `mount`", () => {
    const mount = document.createElement("div");
    const view = createEngineView(mount, createTestEngineState(), { onDispatch: () => {} });

    expect(mount.contains(engineViewDom(view))).toBe(true);
    expect(engineViewDom(view).getAttribute("contenteditable")).toBe("true");

    destroyEngineView(view);
  });

  it("editable: false renders a non-editable node", () => {
    const mount = document.createElement("div");
    const view = createEngineView(mount, createTestEngineState(), {
      onDispatch: () => {},
      editable: false,
    });

    expect(engineViewDom(view).getAttribute("contenteditable")).toBe("false");

    destroyEngineView(view);
  });

  it("routes dispatched transactions through onDispatch instead of applying them automatically", () => {
    const mount = document.createElement("div");
    const state = createTestEngineState();
    const onDispatch = vi.fn();
    const view = createEngineView(mount, state, { onDispatch });

    const tr = createEngineTransaction(state);
    engineTransactionInsertText(tr, "Hi ", 1, 1);
    view.dispatch(tr);

    expect(onDispatch).toHaveBeenCalledWith(tr);
    // `onDispatch` never called `updateEngineViewState`, so the view's own
    // state must be untouched — proving we (not prosemirror-view) own
    // deciding what the next state is, matching how `EditorView` wraps this.
    expect(view.state).toBe(state);

    destroyEngineView(view);
  });

  it("updateEngineViewState() syncs the view's rendered DOM to a new state", () => {
    const mount = document.createElement("div");
    const state = createTestEngineState();
    const view = createEngineView(mount, state, { onDispatch: () => {} });

    const tr = createEngineTransaction(state);
    engineTransactionInsertText(tr, "Hi ", 1, 1);
    const nextState = applyEngineTransaction(state, tr);
    updateEngineViewState(view, nextState);

    expect(engineViewDom(view).textContent).toBe("Hi Hello");

    destroyEngineView(view);
  });

  it("focusEngineView()/engineViewHasFocus() expose the view's focus state", () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const view = createEngineView(mount, createTestEngineState(), { onDispatch: () => {} });

    expect(engineViewHasFocus(view)).toBe(false);
    focusEngineView(view);
    expect(engineViewHasFocus(view)).toBe(true);

    destroyEngineView(view);
    mount.remove();
  });
});
