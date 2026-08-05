import { describe, expect, it } from "vitest";

import { matchesContentExpression, nodeGroups, parseContentExpression } from "./content-expression";
import { InvalidContentExpressionError } from "./errors";

import type { ContentDescriptor } from "./content-expression";

function descriptor(type: string, group?: string): ContentDescriptor {
  return group ? { type, group } : { type };
}

describe("parseContentExpression", () => {
  it("parses a sequence of terms with quantifiers", () => {
    const expression = parseContentExpression("doc", "paragraph+ heading* note?");
    expect(expression.terms).toEqual([
      { name: "paragraph", min: 1, max: Number.POSITIVE_INFINITY },
      { name: "heading", min: 0, max: Number.POSITIVE_INFINITY },
      { name: "note", min: 0, max: 1 },
    ]);
  });

  it("defaults an unquantified term to exactly one", () => {
    expect(parseContentExpression("doc", "title").terms).toEqual([
      { name: "title", min: 1, max: 1 },
    ]);
  });

  it("throws on malformed terms", () => {
    expect(() => parseContentExpression("doc", "1invalid")).toThrow(InvalidContentExpressionError);
  });

  it("treats an empty expression as no content", () => {
    expect(parseContentExpression("doc", "   ").terms).toEqual([]);
  });
});

describe("matchesContentExpression", () => {
  it("matches a simple required sequence", () => {
    const expression = parseContentExpression("doc", "paragraph");
    expect(matchesContentExpression(expression, [descriptor("paragraph")])).toBe(true);
    expect(matchesContentExpression(expression, [])).toBe(false);
    expect(
      matchesContentExpression(expression, [descriptor("paragraph"), descriptor("paragraph")]),
    ).toBe(false);
  });

  it("matches zero-or-more and one-or-more quantifiers", () => {
    const star = parseContentExpression("doc", "paragraph*");
    expect(matchesContentExpression(star, [])).toBe(true);
    expect(matchesContentExpression(star, [descriptor("paragraph"), descriptor("paragraph")])).toBe(
      true,
    );

    const plus = parseContentExpression("doc", "paragraph+");
    expect(matchesContentExpression(plus, [])).toBe(false);
    expect(matchesContentExpression(plus, [descriptor("paragraph")])).toBe(true);
  });

  it("matches by group as well as exact type", () => {
    const expression = parseContentExpression("doc", "block+");
    expect(
      matchesContentExpression(expression, [
        descriptor("paragraph", "block"),
        descriptor("heading", "block"),
      ]),
    ).toBe(true);
    expect(matchesContentExpression(expression, [descriptor("text", "inline")])).toBe(false);
  });

  it("backtracks when a greedy match would leave nothing for a later required term", () => {
    // Greedily giving "a*" all three "a"s leaves nothing for the trailing "a" term;
    // a correct matcher must retry with a smaller count for "a*".
    const expression = parseContentExpression("doc", "a* a");
    expect(
      matchesContentExpression(expression, [descriptor("a"), descriptor("a"), descriptor("a")]),
    ).toBe(true);
  });

  it("fails when even backtracking cannot satisfy the sequence", () => {
    const expression = parseContentExpression("doc", "a+ b+");
    expect(matchesContentExpression(expression, [descriptor("a"), descriptor("a")])).toBe(false);
  });

  it("rejects a sequence that doesn't fully match", () => {
    const expression = parseContentExpression("doc", "paragraph+ image?");
    expect(
      matchesContentExpression(expression, [
        descriptor("paragraph"),
        descriptor("image"),
        descriptor("image"),
      ]),
    ).toBe(false);
  });
});

describe("multi-group nodes", () => {
  it("splits a whitespace-separated group list", () => {
    expect(nodeGroups("block media")).toEqual(["block", "media"]);
    expect(nodeGroups("block")).toEqual(["block"]);
    expect(nodeGroups("  block   media  ")).toEqual(["block", "media"]);
    expect(nodeGroups(undefined)).toEqual([]);
    expect(nodeGroups("")).toEqual([]);
  });

  it("matches a node by any of its groups", () => {
    // A node declaring `group: "block media"` must satisfy a content expression
    // referring to either group. Treating the field as a single opaque name
    // silently matched neither, which is what the media node specs hit.
    const image = descriptor("image", "block media");

    expect(matchesContentExpression(parseContentExpression("doc", "block+"), [image])).toBe(true);
    expect(matchesContentExpression(parseContentExpression("figure", "media"), [image])).toBe(true);
    expect(matchesContentExpression(parseContentExpression("doc", "inline+"), [image])).toBe(false);
  });
});
