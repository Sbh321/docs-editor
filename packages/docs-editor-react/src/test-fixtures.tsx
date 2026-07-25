import { createSchema, EditorState } from "@sbh321/docs-editor-core";

import { EditorProvider } from "./editor-provider";

import type { Schema, Selection } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

export type FixtureNode = "doc" | "paragraph" | "heading" | "text";
export type FixtureMark = "bold" | "link";

/** A small schema (paragraph, heading, bold, link) shared by the React UI tests. */
export function createTestSchema(): Schema<FixtureNode, FixtureMark> {
  return createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
      text: { group: "inline", isText: true, marks: "all" },
    },
    marks: {
      bold: {},
      link: { attrs: { href: {} } },
    },
  });
}

export function createTestState(text = "Hello", selection: Selection = { anchor: 1, head: 1 }) {
  const schema = createTestSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text(text)])]);
  return EditorState.create({ schema, doc, selection, history: true });
}

/** Wraps `children` in an `EditorProvider` seeded with `state`. */
export function EditorHarness({
  state,
  children,
}: {
  readonly state: EditorState<FixtureNode, FixtureMark>;
  readonly children: ReactNode;
}): ReactNode {
  return <EditorProvider initialState={state}>{children}</EditorProvider>;
}
