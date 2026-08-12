import { EditorState } from "@sbh321/docs-editor-core";
import { defaultSchema } from "@sbh321/docs-editor-core/preset";
import { EditorProvider, ThemeProvider, ToolbarGroup } from "@sbh321/docs-editor-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { editorTheme } from "../editor-theme";

import { EditorToolbar } from "./editor-toolbar";
import { DEFAULT_TOOLBAR_ITEMS, resolveToolbarItems } from "./toolbar-items";

import type { ReactNode } from "react";

/**
 * Toolbar composition (ROADMAP Phase 9.5, Milestone 9.5.2).
 *
 * The claim under test is that the default bar is *configuration*, not a fixed
 * sequence: every control can be removed, reordered, replaced or joined by one
 * of the application's own without replacing the toolbar and reimplementing the
 * rest.
 */

function renderToolbar(ui: ReactNode) {
  const state = EditorState.create({
    schema: defaultSchema,
    doc: defaultSchema.createDocument([
      defaultSchema.node("paragraph", undefined, [defaultSchema.text("Hello")]),
    ]),
    selection: { anchor: 1, head: 1 },
    history: true,
  });

  return render(
    <ThemeProvider theme={editorTheme}>
      <EditorProvider initialState={state}>{ui}</EditorProvider>
    </ThemeProvider>,
  );
}

describe("resolveToolbarItems", () => {
  it("defaults to the standard bar", () => {
    expect(resolveToolbarItems()).toEqual(DEFAULT_TOOLBAR_ITEMS);
  });

  it("subtracts hidden ids from whatever roster is in play", () => {
    expect(resolveToolbarItems(["history", "link", "lists"], ["link"])).toEqual([
      "history",
      "lists",
    ]);
    // `hide` composes with the default roster too, which is the common case:
    // "the usual bar, minus this".
    expect(resolveToolbarItems(undefined, ["colorScheme"])).not.toContain("colorScheme");
  });

  it("keeps a repeated id once, at its first position", () => {
    // A control rendered twice would also collide on its React key, so the
    // rule is stated rather than left to whatever the renderer does.
    expect(resolveToolbarItems(["history", "link", "history"])).toEqual(["history", "link"]);
  });

  it("ignores an id that is hidden and absent", () => {
    expect(resolveToolbarItems(["history"], ["media", "table"])).toEqual(["history"]);
  });
});

describe("EditorToolbar composition", () => {
  it("hides a control without touching the rest of the bar", () => {
    renderToolbar(<EditorToolbar hide={["link", "clearFormatting"]} />);

    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear formatting" })).not.toBeInTheDocument();
    // Everything else is still there — the point of a subtractive API.
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("renders exactly the roster it is given, in order", () => {
    renderToolbar(<EditorToolbar items={["textFormat", "history"]} />);

    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();

    const groups = screen.getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Text formatting",
      "History",
    ]);
  });

  it("renders nothing for an id nothing supplies", () => {
    // `"file"`, `"layout"` and `"upload"` are in the default roster but have no
    // control of their own — a bare toolbar must not sprout chrome it cannot
    // wire.
    renderToolbar(<EditorToolbar />);

    expect(screen.queryByRole("button", { name: "File" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Layout" })).not.toBeInTheDocument();
  });

  it("replaces a built-in control through its slot", () => {
    renderToolbar(
      <EditorToolbar
        slots={{
          history: (
            <ToolbarGroup label="History">
              <button type="button">My undo</button>
            </ToolbarGroup>
          ),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "My undo" })).toBeInTheDocument();
    // Replaced, not joined — a slot that rendered alongside ours would leave
    // two controls for one job.
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("renders nothing for a slot explicitly set to null", () => {
    renderToolbar(<EditorToolbar items={["history", "textFormat"]} slots={{ history: null }} />);

    // A slot table computed from a permission check reads the way it looks:
    // `null` removes the control rather than restoring the built-in one.
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });

  it("places an application's own control anywhere in the bar", () => {
    renderToolbar(
      <EditorToolbar
        items={["history", "share", "textFormat"]}
        slots={{
          share: (
            <ToolbarGroup label="Share">
              <button type="button">Share</button>
            </ToolbarGroup>
          ),
        }}
      />,
    );

    const labels = screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"));
    expect(labels).toEqual(["History", "Share", "Text formatting"]);
  });

  it("puts children at the extras position and leading ahead of everything", () => {
    renderToolbar(
      <EditorToolbar
        items={["extras", "history"]}
        leading={
          <ToolbarGroup label="Leading">
            <button type="button">Lead</button>
          </ToolbarGroup>
        }
        trailing={
          <ToolbarGroup label="Trailing">
            <button type="button">Trail</button>
          </ToolbarGroup>
        }
      >
        <ToolbarGroup label="Extras">
          <button type="button">Mine</button>
        </ToolbarGroup>
      </EditorToolbar>,
    );

    const labels = screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"));
    expect(labels).toEqual(["Leading", "Extras", "History", "Trailing"]);
  });
});
