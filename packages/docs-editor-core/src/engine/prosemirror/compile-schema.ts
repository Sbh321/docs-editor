import { Schema as ProseMirrorSchema } from "prosemirror-model";

import { parseContentExpression } from "../../schema";
import { EngineSchemaError } from "../errors";

import type { AttributeSpec, MarkSpec, NodeSpec, Schema } from "../../schema";
import type {
  AttributeSpec as ProseMirrorAttributeSpec,
  DOMOutputSpec,
  MarkSpec as ProseMirrorMarkSpec,
  NodeSpec as ProseMirrorNodeSpec,
} from "prosemirror-model";

/**
 * Compiles a docs-editor {@link Schema} into a real `prosemirror-model`
 * `Schema`. This is the only place in the package that constructs a
 * ProseMirror schema — everything else operates on docs-editor's own
 * `Schema`/`DocumentNode`/`Mark` types.
 *
 * Our content-expression grammar (sequence + `* + ?` quantifiers) is a
 * deliberate subset of ProseMirror's own (which also supports `|`
 * alternation, `()` grouping, and `{m,n}` ranges), so expression strings
 * pass through unchanged.
 */
export function compileEngineSchema<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
): ProseMirrorSchema {
  requireSingleTextNodeNamedText(schema.spec.nodes);

  const nodes: Record<string, ProseMirrorNodeSpec> = {};
  for (const [name, nodeSpec] of Object.entries<NodeSpec>(schema.spec.nodes)) {
    nodes[name] = compileNodeSpec(schema.spec.nodes, name as NodeName, nodeSpec);
  }

  const marks: Record<string, ProseMirrorMarkSpec> = {};
  for (const [name, markSpec] of Object.entries<MarkSpec>(schema.spec.marks ?? {})) {
    marks[name] = compileMarkSpec(name, markSpec);
  }

  return new ProseMirrorSchema({ nodes, marks, topNode: schema.topNodeType });
}

function requireSingleTextNodeNamedText(nodes: Readonly<Record<string, NodeSpec>>): void {
  const textNodeNames = Object.entries(nodes)
    .filter(([, spec]) => spec.isText)
    .map(([name]) => name);

  if (textNodeNames.length !== 1) {
    throw new EngineSchemaError(
      `The ProseMirror engine requires exactly one node type with "isText: true" ` +
        `(found ${textNodeNames.length}${textNodeNames.length > 0 ? `: ${textNodeNames.join(", ")}` : ""}).`,
    );
  }

  const [textNodeName] = textNodeNames;
  if (textNodeName !== "text") {
    throw new EngineSchemaError(
      `The ProseMirror engine requires the text node type to be named "text" ` +
        `(found "${textNodeName}"). Rename it in the schema spec.`,
    );
  }
}

function compileNodeSpec<NodeName extends string>(
  nodes: Readonly<Record<NodeName, NodeSpec>>,
  name: NodeName,
  nodeSpec: NodeSpec,
): ProseMirrorNodeSpec {
  const compiled: ProseMirrorNodeSpec = {
    marks: computeContentMarksConstraint(nodes, name, nodeSpec),
  };

  if (nodeSpec.content !== undefined) {
    compiled.content = nodeSpec.content;
  }
  if (nodeSpec.group !== undefined) {
    compiled.group = nodeSpec.group;
  }
  if (nodeSpec.inline !== undefined) {
    compiled.inline = nodeSpec.inline;
  }
  const attrs = translateAttrs(nodeSpec.attrs);
  if (attrs !== undefined) {
    compiled.attrs = attrs;
  }
  if (nodeSpec.code !== undefined) {
    compiled.code = nodeSpec.code;
  }
  if (nodeSpec.tableRole !== undefined) {
    compiled.tableRole = nodeSpec.tableRole;
  }
  if (nodeSpec.isolating !== undefined) {
    compiled.isolating = nodeSpec.isolating;
  }
  if (!nodeSpec.isText) {
    compiled.toDOM = () => defaultToDOM(name, nodeSpec.content !== undefined);
  }

  return compiled;
}

/**
 * Placeholder DOM rendering, present so `prosemirror-view` has *something*
 * to render every node/mark as (it requires `toDOM` to exist; text nodes
 * are the one exception, handled natively). Renders each node/mark as an
 * element literally named after it (`<paragraph>`, `<bold>`, ...) — visible
 * in devtools, trivially CSS-targetable, but deliberately unstyled. Real,
 * customizable rendering (a renderer map supplied to `EditorView`, decoupled
 * from `Schema` — see docs/ROADMAP.md's Phase 2 notes) is follow-up work,
 * not part of this milestone.
 */
function defaultToDOM(name: string, hasContent: boolean): DOMOutputSpec {
  return hasContent ? [name, 0] : [name];
}

/**
 * ProseMirror's `NodeSpec.marks` is a constraint on a *container's content*
 * ("what marks may this node's children carry"), checked against the
 * parent when a mark is applied. Docs-editor's own `NodeSpec.marks` is
 * declared the other way around — on the node itself ("what marks can a
 * node of this type carry"), checked by `Schema.text()`/`Schema.node()` at
 * the moment that specific node is constructed, before its eventual parent
 * is even known. Both are valid ways to describe the same real constraint;
 * this function bridges the two by computing, for each container, the
 * union of the "marks" declared by every node type that can appear in its
 * content (resolving group references), and using that as ProseMirror's
 * per-container constraint.
 */
function computeContentMarksConstraint<NodeName extends string>(
  nodes: Readonly<Record<NodeName, NodeSpec>>,
  name: NodeName,
  nodeSpec: NodeSpec,
): string {
  if (nodeSpec.content === undefined) {
    return translateMarksConstraint(nodeSpec.marks);
  }

  const expression = parseContentExpression(name, nodeSpec.content);
  const possibleChildNames = new Set<NodeName>();
  for (const term of expression.terms) {
    if (term.name in nodes) {
      possibleChildNames.add(term.name as NodeName);
      continue;
    }
    for (const [candidateName, candidateSpec] of Object.entries<NodeSpec>(nodes)) {
      if (candidateSpec.group === term.name) {
        possibleChildNames.add(candidateName as NodeName);
      }
    }
  }

  let allowsAll = false;
  const allowedMarkNames = new Set<string>();
  for (const childName of possibleChildNames) {
    const childMarks = nodes[childName].marks ?? "none";
    if (childMarks === "all") {
      allowsAll = true;
    } else if (childMarks !== "none") {
      for (const markName of childMarks) {
        allowedMarkNames.add(markName);
      }
    }
  }

  if (allowsAll) {
    return "_";
  }
  return [...allowedMarkNames].join(" ");
}

function compileMarkSpec(name: string, markSpec: MarkSpec): ProseMirrorMarkSpec {
  const compiled: ProseMirrorMarkSpec = { toDOM: () => defaultToDOM(name, true) };
  const attrs = translateAttrs(markSpec.attrs);
  if (attrs !== undefined) {
    compiled.attrs = attrs;
  }
  return compiled;
}

function translateMarksConstraint(marks: NodeSpec["marks"]): string {
  if (marks === undefined || marks === "none") {
    return "";
  }
  if (marks === "all") {
    return "_";
  }
  return marks.join(" ");
}

function translateAttrs(
  attrs: Readonly<Record<string, AttributeSpec>> | undefined,
): Record<string, ProseMirrorAttributeSpec> | undefined {
  if (!attrs) {
    return undefined;
  }
  const translated: Record<string, ProseMirrorAttributeSpec> = {};
  for (const [key, attrSpec] of Object.entries(attrs)) {
    translated[key] = "default" in attrSpec ? { default: attrSpec.default } : {};
  }
  return translated;
}
