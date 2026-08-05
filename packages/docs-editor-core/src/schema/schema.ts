import { matchesContentExpression, nodeGroups, parseContentExpression } from "./content-expression";
import {
  InvalidAttributeError,
  InvalidContentError,
  InvalidMarkError,
  SchemaError,
  UnknownContentReferenceError,
  UnknownMarkTypeError,
  UnknownNodeTypeError,
} from "./errors";

import type { ContentDescriptor, ContentExpression } from "./content-expression";
import type { AttributeSpec, DocumentNode, Mark, MarkSpec, NodeSpec, SchemaSpec } from "./types";

interface CompiledNodeType<NodeName extends string> {
  readonly name: NodeName;
  readonly spec: NodeSpec;
  /** `null` means the node type declares no content constraint (a leaf). */
  readonly content: ContentExpression | null;
}

/**
 * Validates and constructs {@link DocumentNode}s and {@link Mark}s against a
 * {@link SchemaSpec}. A `Schema` instance is the only way to create nodes —
 * this keeps every document that exists guaranteed to satisfy its schema's
 * structural and attribute constraints.
 */
export class Schema<NodeName extends string = string, MarkName extends string = string> {
  readonly spec: SchemaSpec<NodeName, MarkName>;
  readonly topNodeType: NodeName;

  private readonly nodeTypes: ReadonlyMap<NodeName, CompiledNodeType<NodeName>>;
  private readonly markSpecs: ReadonlyMap<MarkName, MarkSpec>;

  constructor(spec: SchemaSpec<NodeName, MarkName>) {
    const nodeNames = Object.keys(spec.nodes) as NodeName[];
    const firstNodeName = nodeNames[0];
    if (firstNodeName === undefined) {
      throw new SchemaError("A schema must declare at least one node type.");
    }

    const topNodeType = spec.topNode ?? firstNodeName;
    if (!(topNodeType in spec.nodes)) {
      throw new UnknownNodeTypeError(topNodeType);
    }

    const groups = new Set<string>();
    for (const name of nodeNames) {
      for (const group of nodeGroups(spec.nodes[name].group)) {
        groups.add(group);
      }
    }

    const nodeTypes = new Map<NodeName, CompiledNodeType<NodeName>>();
    for (const name of nodeNames) {
      const nodeSpec = spec.nodes[name];
      const content = nodeSpec.content ? parseContentExpression(name, nodeSpec.content) : null;

      if (content) {
        for (const term of content.terms) {
          if (!(term.name in spec.nodes) && !groups.has(term.name)) {
            throw new UnknownContentReferenceError(name, nodeSpec.content ?? "", term.name);
          }
        }
      }

      nodeTypes.set(name, { name, spec: nodeSpec, content });
    }

    this.spec = spec;
    this.topNodeType = topNodeType;
    this.nodeTypes = nodeTypes;
    this.markSpecs = new Map<MarkName, MarkSpec>(
      Object.entries(spec.marks ?? {}) as Array<[MarkName, MarkSpec]>,
    );
  }

  /** Creates and validates a non-text node of the given type. */
  node(
    type: NodeName,
    attrs?: Record<string, unknown>,
    content: readonly DocumentNode<NodeName>[] = [],
    marks: readonly Mark[] = [],
  ): DocumentNode<NodeName> {
    const compiled = this.requireNodeType(type);
    if (compiled.spec.isText) {
      throw new SchemaError(
        `Node type "${type}" is a text node type; use schema.text() to create it.`,
      );
    }

    this.validateContent(type, compiled, content);
    this.validateMarks(type, compiled.spec, marks);
    const resolvedAttrs = resolveAttrs(type, compiled.spec.attrs, attrs);

    return Object.freeze({
      type,
      attrs: resolvedAttrs,
      content: Object.freeze([...content]),
      marks: Object.freeze([...marks]),
    });
  }

  /**
   * Creates a text node. `type` only needs to be passed when the schema
   * declares more than one node type with `isText: true`.
   */
  text(value: string, marks: readonly Mark[] = [], type?: NodeName): DocumentNode<NodeName> {
    if (value.length === 0) {
      throw new SchemaError("Text nodes must have non-empty text.");
    }

    const textType = type ?? this.findTextNodeType();
    const compiled = this.requireNodeType(textType);
    if (!compiled.spec.isText) {
      throw new SchemaError(
        `Node type "${textType}" is not a text node type (missing "isText: true").`,
      );
    }

    this.validateMarks(textType, compiled.spec, marks);

    return Object.freeze({
      type: textType,
      attrs: Object.freeze({}),
      content: Object.freeze([]),
      marks: Object.freeze([...marks]),
      text: value,
    });
  }

  /** Creates and validates a mark of the given type. */
  mark(type: MarkName, attrs?: Record<string, unknown>): Mark<MarkName> {
    const markSpec = this.markSpecs.get(type);
    if (!markSpec) {
      throw new UnknownMarkTypeError(type);
    }
    const resolvedAttrs = resolveAttrs(type, markSpec.attrs, attrs);
    return Object.freeze({ type, attrs: resolvedAttrs });
  }

  /** Convenience for `schema.node(schema.topNodeType, ...)`. */
  createDocument(content: readonly DocumentNode<NodeName>[] = []): DocumentNode<NodeName> {
    return this.node(this.topNodeType, undefined, content);
  }

  /**
   * Validates `type` and `attrs` for an existing non-text node type, without
   * requiring content — used by commands that change a block's type in
   * place (`setBlockType`, e.g. paragraph → heading) rather than
   * constructing a brand new node.
   */
  blockType(
    type: NodeName,
    attrs?: Record<string, unknown>,
  ): { readonly type: NodeName; readonly attrs: Readonly<Record<string, unknown>> } {
    const compiled = this.requireNodeType(type);
    if (compiled.spec.isText) {
      throw new SchemaError(`Node type "${type}" is a text node type; it cannot be a block type.`);
    }
    return Object.freeze({ type, attrs: resolveAttrs(type, compiled.spec.attrs, attrs) });
  }

  private requireNodeType(type: NodeName): CompiledNodeType<NodeName> {
    const compiled = this.nodeTypes.get(type);
    if (!compiled) {
      throw new UnknownNodeTypeError(type);
    }
    return compiled;
  }

  private findTextNodeType(): NodeName {
    const textTypes = [...this.nodeTypes.values()].filter((nodeType) => nodeType.spec.isText);
    if (textTypes.length === 0) {
      throw new SchemaError('Schema does not declare any node type with "isText: true".');
    }
    if (textTypes.length > 1) {
      throw new SchemaError(
        "Schema declares multiple text node types; pass the desired type explicitly to schema.text().",
      );
    }
    const [only] = textTypes;
    // The two guards above leave exactly one entry, but the array-access
    // result is still typed as possibly `undefined` under noUncheckedIndexedAccess.
    if (!only) {
      throw new SchemaError('Schema does not declare any node type with "isText: true".');
    }
    return only.name;
  }

  private validateContent(
    nodeType: NodeName,
    compiled: CompiledNodeType<NodeName>,
    content: readonly DocumentNode<NodeName>[],
  ): void {
    if (compiled.content === null) {
      if (content.length > 0) {
        throw new InvalidContentError(
          nodeType,
          "<none>",
          content.map((child) => child.type),
        );
      }
      return;
    }

    const descriptors: ContentDescriptor[] = content.map((child) => {
      const childType = this.requireNodeType(child.type);
      const { group } = childType.spec;
      return group ? { type: child.type, group } : { type: child.type };
    });

    if (!matchesContentExpression(compiled.content, descriptors)) {
      throw new InvalidContentError(
        nodeType,
        compiled.content.source,
        content.map((child) => child.type),
      );
    }
  }

  private validateMarks(nodeType: NodeName, nodeSpec: NodeSpec, marks: readonly Mark[]): void {
    for (const mark of marks) {
      if (!this.markSpecs.has(mark.type as MarkName)) {
        throw new UnknownMarkTypeError(mark.type);
      }
    }

    const allowed = nodeSpec.marks ?? "none";
    if (allowed === "all") {
      return;
    }
    if (allowed === "none") {
      const [first] = marks;
      if (first) {
        throw new InvalidMarkError(
          nodeType,
          first.type,
          `node type "${nodeType}" does not allow marks.`,
        );
      }
      return;
    }
    for (const mark of marks) {
      if (!allowed.includes(mark.type)) {
        throw new InvalidMarkError(
          nodeType,
          mark.type,
          `not permitted on node type "${nodeType}".`,
        );
      }
    }
  }
}

/**
 * Builds a {@link Schema} with `NodeName`/`MarkName` inferred purely from the
 * shape of `nodes`/`marks`. Prefer this over `new Schema(...)` with an inline
 * spec object: TypeScript infers a single shared type parameter from the
 * first property of an object literal that constrains it, so when `topNode`
 * and `nodes` both reference the same parameter, `new Schema({ topNode, nodes })`
 * can infer a narrower type than intended depending on property order.
 * Typing `topNode` here as `keyof Nodes` (a non-inferential position) avoids
 * that ambiguity entirely.
 */
export function createSchema<
  Nodes extends Readonly<Record<string, NodeSpec>>,
  Marks extends Readonly<Record<string, MarkSpec>> = Record<string, never>,
>(spec: {
  readonly topNode?: Extract<keyof Nodes, string>;
  readonly nodes: Nodes;
  readonly marks?: Marks;
}): Schema<Extract<keyof Nodes, string>, Extract<keyof Marks, string>> {
  return new Schema<Extract<keyof Nodes, string>, Extract<keyof Marks, string>>(spec);
}

function resolveAttrs(
  ownerType: string,
  declared: Readonly<Record<string, AttributeSpec>> | undefined,
  provided: Record<string, unknown> | undefined,
): Readonly<Record<string, unknown>> {
  const declaredEntries = declared ?? {};
  const providedEntries = provided ?? {};

  for (const key of Object.keys(providedEntries)) {
    if (!(key in declaredEntries)) {
      throw new InvalidAttributeError(ownerType, key, "not declared in the schema.");
    }
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, attrSpec] of Object.entries(declaredEntries)) {
    if (key in providedEntries) {
      resolved[key] = providedEntries[key];
    } else if ("default" in attrSpec) {
      resolved[key] = attrSpec.default;
    } else {
      throw new InvalidAttributeError(ownerType, key, "is required and has no default value.");
    }
  }

  return Object.freeze(resolved);
}
