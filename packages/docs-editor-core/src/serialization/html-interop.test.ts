import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { HtmlImporter } from "./html";

import type { HtmlParseSpec } from "../dom-parse-spec";
import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

/**
 * Informal Google Docs / Word interop: markup pasted (or exported) from those
 * apps is messy — style-driven formatting, wrapper elements, conditional
 * comments, `<style>`/`<meta>` cruft. These assert it imports with minimal loss
 * and, crucially, never executes anything. See ROADMAP Phase 5, Milestone 5.6.
 */
const schema = createFixtureSchema();

/** Reads an inline `font-weight`/`font-style` style the way Docs/Word emit it. */
function isBold(style: string | null): boolean {
  if (!style) {
    return false;
  }
  const weight = /font-weight\s*:\s*(\d+|bold)/i.exec(style)?.[1];
  return weight === "bold" || (weight !== undefined && Number(weight) >= 600);
}

const parseSpec: HtmlParseSpec<FixtureNodeName, FixtureMarkName> = {
  nodes: [
    { tag: "p", node: "paragraph" },
    { tag: "h1", node: "heading", getAttrs: () => ({ level: 1 }) },
    { tag: "h2", node: "heading", getAttrs: () => ({ level: 2 }) },
  ],
  marks: [
    // Google Docs wraps a whole paste in `<b style="font-weight:normal">`; that
    // wrapper must NOT bold everything, so `b` declines unless it's really bold.
    {
      tag: "b",
      mark: "bold",
      getAttrs: (el) => (isBold(el.getAttribute("style")) || !el.getAttribute("style") ? {} : null),
    },
    { tag: "strong", mark: "bold" },
    // Docs/Word express bold on spans via inline styles; decline non-bold spans.
    { tag: "span", mark: "bold", getAttrs: (el) => (isBold(el.getAttribute("style")) ? {} : null) },
    { tag: "a", mark: "link", getAttrs: (el) => ({ href: el.getAttribute("href") ?? "" }) },
  ],
};

function importer() {
  return new HtmlImporter<FixtureNodeName, FixtureMarkName>({ schema, parseSpec });
}

describe("HTML interop (Google Docs / Word)", () => {
  it("imports a Google-Docs-style paste, honoring style-driven bold", () => {
    const pasted =
      '<meta charset="utf-8">' +
      '<b style="font-weight:normal" id="docs-internal-guid-abc">' +
      '<p dir="ltr"><span style="font-weight:700">Bold</span> and plain.</p>' +
      "</b>";

    const doc = importer().parse(pasted);
    const paragraph = doc.content.find((node) => node.type === "paragraph");
    expect(paragraph).toBeDefined();

    const bold = paragraph?.content.find((node) => node.text === "Bold");
    expect(bold?.marks[0]?.type).toBe("bold");

    // The outer `<b style="font-weight:normal">` wrapper did not bold the rest.
    const plain = paragraph?.content.find((node) => node.text?.includes("plain"));
    expect(plain?.marks).toEqual([]);
  });

  it("drops Word's <style>/<meta> cruft and conditional comments", () => {
    const wordHtml =
      '<meta name="Generator" content="Microsoft Word 15">' +
      "<style>p { mso-something: 1; }</style>" +
      "<!--[if gte mso 9]><xml>junk</xml><![endif]-->" +
      "<p>Real content.</p>";

    const doc = importer().parse(wordHtml);
    const text = JSON.stringify(doc);
    expect(text).toContain("Real content.");
    expect(text).not.toContain("mso-something");
    expect(text).not.toContain("junk");
  });

  it("never executes scripts hidden in pasted markup", () => {
    const doc = importer().parse('<p onclick="steal()">hi</p><script>window.x = 1</script>');
    const text = JSON.stringify(doc);
    expect(text).toContain("hi");
    expect(text).not.toContain("steal");
    expect(text).not.toContain("window.x");
  });
});
