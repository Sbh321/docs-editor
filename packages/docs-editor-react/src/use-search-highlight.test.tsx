import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Editor } from "./editor";
import { EditorProvider } from "./editor-provider";
import { SearchHighlight } from "./search-highlight";
import { createTestState } from "./test-fixtures";

import type { FixtureMark, FixtureNode } from "./test-fixtures";
import type { EditorState } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

function Harness({
  state,
  query,
  activeIndex,
}: {
  readonly state: EditorState<FixtureNode, FixtureMark>;
  readonly query: string;
  readonly activeIndex?: number;
}): ReactNode {
  return (
    <EditorProvider initialState={state}>
      <Editor nodeRenderers={{ paragraph: () => ["p", 0] }} />
      <SearchHighlight query={query} {...(activeIndex !== undefined ? { activeIndex } : {})} />
    </EditorProvider>
  );
}

describe("useSearchHighlight / SearchHighlight", () => {
  it("paints every match of the query", () => {
    const { container } = render(<Harness state={createTestState("Hello Hello")} query="Hello" />);
    expect(container.querySelectorAll(".docs-editor-search-match")).toHaveLength(2);
  });

  it("adds the active class to the match at activeIndex", () => {
    const { container } = render(
      <Harness state={createTestState("Hello Hello")} query="Hello" activeIndex={1} />,
    );
    const active = container.querySelectorAll(".docs-editor-search-match-active");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Hello");
  });

  it("clears highlights when the query is empty", () => {
    const { container, rerender } = render(
      <Harness state={createTestState("Hello Hello")} query="Hello" />,
    );
    expect(container.querySelectorAll(".docs-editor-search-match").length).toBeGreaterThan(0);

    rerender(<Harness state={createTestState("Hello Hello")} query="" />);
    expect(container.querySelectorAll(".docs-editor-search-match")).toHaveLength(0);
  });
});
