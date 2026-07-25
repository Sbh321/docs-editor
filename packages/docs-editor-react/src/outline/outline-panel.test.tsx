import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorProvider } from "../editor-provider";
import { useEditorState } from "../use-editor-state";

import { OutlinePanel } from "./outline-panel";
import { TableOfContents } from "./table-of-contents";

import type { ReactNode } from "react";

function createHeadingState() {
  const schema = createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
      text: { group: "inline", isText: true, marks: "all" },
    },
  });
  const doc = schema.createDocument([
    schema.node("heading", { level: 1 }, [schema.text("Intro")]),
    schema.node("paragraph", undefined, [schema.text("Body")]),
    schema.node("heading", { level: 2 }, [schema.text("Details")]),
  ]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

function Harness({ children }: { readonly children: ReactNode }): ReactNode {
  return <EditorProvider initialState={createHeadingState()}>{children}</EditorProvider>;
}

function SelectionProbe(): ReactNode {
  const state = useEditorState();
  return <output data-testid="selection">{state.selection.anchor}</output>;
}

describe("OutlinePanel", () => {
  it("lists headings and navigates the selection on click", () => {
    render(
      <Harness>
        <OutlinePanel />
        <SelectionProbe />
      </Harness>,
    );

    expect(screen.getByRole("button", { name: "Intro" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    // "Details" heading node starts at position 13; its first inside position is 14.
    expect(screen.getByTestId("selection")).toHaveTextContent("14");
  });
});

describe("TableOfContents", () => {
  it("nests headings by level into ordered lists", () => {
    render(
      <Harness>
        <TableOfContents />
      </Harness>,
    );
    const nav = screen.getByRole("navigation", { name: "Table of contents" });
    // The H2 nests under the H1: an <ol> inside the first <li>.
    const topList = nav.querySelector(":scope > ol");
    expect(topList?.querySelectorAll(":scope > li")).toHaveLength(1);
    expect(topList?.querySelector("li ol")).not.toBeNull();
  });
});
