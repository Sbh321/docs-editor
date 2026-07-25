import { describe, expect, it } from "vitest";

import { createSchema } from "./index";

describe("@sbh321/docs-editor-core public API", () => {
  it("exports createSchema and builds a document end to end", () => {
    const schema = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline", isText: true, marks: "all" },
      },
    });

    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello, Docs Editor.")]),
    ]);

    expect(doc.type).toBe("doc");
    expect(doc.content[0]?.content[0]?.text).toBe("Hello, Docs Editor.");
  });
});
