import { DOMSerializer } from "prosemirror-model";

import { EngineConversionError } from "../errors";

import { fromEngineMark, fromEngineNode } from "./node-conversion";

import type { DOMOutputSpec } from "../../dom-output-spec";
import type { DocumentNode, Mark } from "../../schema";
import type {
  DOMOutputSpec as ProseMirrorDOMOutputSpec,
  Mark as ProseMirrorMark,
  Node as ProseMirrorNode,
} from "prosemirror-model";
import type { MarkView, NodeView } from "prosemirror-view";

/**
 * Bridges a docs-editor renderer function (`(node) => DOMOutputSpec`) to a
 * `prosemirror-view` `NodeView`, so `../view`'s `nodeRenderers` option can
 * stay a plain function instead of consumers having to learn PM's full
 * `NodeView` protocol (`getPos`, decorations, `ignoreMutation`, ...).
 *
 * `update()` re-renders and compares specs by value: since a spec's `0` hole
 * doesn't encode content, this correctly reuses the existing DOM (letting
 * PM patch content into it) for ordinary content edits, and only rebuilds
 * when the node's *own* rendering actually changes (e.g. an attribute the
 * renderer reads changes what tag/attrs it produces).
 */
export function createGenericNodeView(
  node: ProseMirrorNode,
  render: (node: DocumentNode) => DOMOutputSpec,
): NodeView {
  let lastSpec = render(fromEngineNode(node));
  const { dom, contentDOM } = DOMSerializer.renderSpec(document, toEngineOutputSpec(lastSpec));
  return {
    dom,
    contentDOM: contentDOM ?? null,
    update(updatedNode) {
      const nextSpec = render(fromEngineNode(updatedNode));
      const unchanged = specsEqual(nextSpec, lastSpec);
      if (unchanged) {
        lastSpec = nextSpec;
      }
      return unchanged;
    },
  };
}

/** The {@link createGenericNodeView} counterpart for marks. */
export function createGenericMarkView(
  mark: ProseMirrorMark,
  render: (mark: Mark) => DOMOutputSpec,
): MarkView {
  let lastSpec = render(fromEngineMark(mark));
  const { dom, contentDOM } = DOMSerializer.renderSpec(document, toEngineOutputSpec(lastSpec));
  return {
    dom,
    contentDOM: contentDOM ?? null,
    update(updatedMark) {
      const nextSpec = render(fromEngineMark(updatedMark));
      const unchanged = specsEqual(nextSpec, lastSpec);
      if (unchanged) {
        lastSpec = nextSpec;
      }
      return unchanged;
    },
  };
}

function specsEqual(a: DOMOutputSpec, b: DOMOutputSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Our own {@link DOMOutputSpec} can't statically require a leading tag-name
 * string (a fixed-head tuple can't reference itself recursively), so this
 * checks it at the one point that matters — handing it to
 * `DOMSerializer.renderSpec`, which requires it — with an actionable error
 * instead of a confusing low-level ProseMirror crash.
 */
function toEngineOutputSpec(spec: DOMOutputSpec): ProseMirrorDOMOutputSpec {
  if (typeof spec[0] !== "string") {
    throw new EngineConversionError(
      `A renderer's DOMOutputSpec must start with a tag name string, got ${JSON.stringify(spec)}.`,
    );
  }
  return spec as unknown as ProseMirrorDOMOutputSpec;
}
