import { DOMParser as ProseMirrorDOMParser, DOMSerializer } from "prosemirror-model";

import { EngineConversionError } from "../errors";

import { compileEngineSchema } from "./compile-schema";
import { fromEngineMark, fromEngineNode, toEngineNode } from "./node-conversion";

import type { DOMOutputSpec, MarkRenderer, NodeRenderer } from "../../dom-output-spec";
import type { HtmlParseSpec } from "../../dom-parse-spec";
import type { DocumentNode, Mark, Schema } from "../../schema";
import type {
  DOMOutputSpec as ProseMirrorDOMOutputSpec,
  ParseRule,
  Schema as ProseMirrorSchema,
} from "prosemirror-model";

// Our `DOMOutputSpec` is a general readonly array; ProseMirror's is a
// `[string, ...]` tuple. They're runtime-identical (see dom-output-spec.ts),
// so this adapts our renderer output to the type `DOMSerializer` expects.
function asEngineSpec(spec: DOMOutputSpec): ProseMirrorDOMOutputSpec {
  return spec as unknown as ProseMirrorDOMOutputSpec;
}

export interface EngineHtmlSerializeOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly nodeRenderers?: NodeRenderer<NodeName>;
  readonly markRenderers?: MarkRenderer<MarkName>;
  /** The DOM `document` to build with — defaults to `globalThis.document`; pass jsdom's in Node. */
  readonly document?: Document;
}

/**
 * Serializes a {@link DocumentNode} to an HTML string, using the same
 * `DOMOutputSpec` renderer maps the view uses — so exported markup matches what
 * `EditorView` renders. Delegates to `prosemirror-model`'s `DOMSerializer`
 * (this file is inside the engine boundary), building it from the compiled
 * schema's default `toDOM` and overriding per-type with the supplied renderers.
 */
export function engineSerializeToHtml<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
  doc: DocumentNode<NodeName>,
  options: EngineHtmlSerializeOptions<NodeName, MarkName> = {},
): string {
  const targetDocument = options.document ?? resolveGlobalDocument();
  const engineSchema = compileEngineSchema(schema);
  const engineDoc = toEngineNode(engineSchema, doc);
  const serializer = buildDomSerializer(engineSchema, options.nodeRenderers, options.markRenderers);

  const fragment = serializer.serializeFragment(engineDoc.content, { document: targetDocument });
  const container = targetDocument.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}

function resolveGlobalDocument(): Document {
  const globalDocument = (globalThis as { document?: Document }).document;
  if (!globalDocument) {
    throw new EngineConversionError(
      "HTML serialization requires a DOM `document`. Pass `document` in the options " +
        "(e.g. from jsdom) when running outside a browser.",
    );
  }
  return globalDocument;
}

function buildDomSerializer<NodeName extends string, MarkName extends string>(
  engineSchema: ProseMirrorSchema,
  nodeRenderers: NodeRenderer<NodeName> | undefined,
  markRenderers: MarkRenderer<MarkName> | undefined,
): DOMSerializer {
  // Start from the compiled schema's own default toDOM for every type, then
  // override the ones the caller provides a renderer for. Our `DOMOutputSpec`
  // is structurally ProseMirror's, so it passes straight through.
  const nodes = DOMSerializer.nodesFromSchema(engineSchema);
  if (nodeRenderers) {
    for (const [name, render] of Object.entries(nodeRenderers) as [
      NodeName,
      ((node: DocumentNode<NodeName>) => DOMOutputSpec) | undefined,
    ][]) {
      if (render) {
        nodes[name] = (engineNode) => asEngineSpec(render(fromEngineNode(engineNode)));
      }
    }
  }

  const marks = DOMSerializer.marksFromSchema(engineSchema);
  if (markRenderers) {
    for (const [name, render] of Object.entries(markRenderers) as [
      MarkName,
      ((mark: Mark<MarkName>) => DOMOutputSpec) | undefined,
    ][]) {
      if (render) {
        marks[name] = (engineMark) => asEngineSpec(render(fromEngineMark(engineMark)));
      }
    }
  }

  return new DOMSerializer(nodes, marks);
}

export interface EngineHtmlParseOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly parseSpec?: HtmlParseSpec<NodeName, MarkName>;
  /** DOM `document` to build with (defaults to `globalThis.document`; pass jsdom's in Node). */
  readonly document?: Document;
}

/**
 * Parses an HTML string into a validated {@link DocumentNode}, using the
 * supplied parse rules to map tags → node/mark types. The HTML is first loaded
 * into an **inert document** (so no resources load and no handlers run) and
 * **sanitized** (dangerous elements removed; `on*` handlers and
 * `javascript:`/`vbscript:` URLs stripped), so arbitrary HTML is never
 * executed — the concrete implementation of ARCHITECTURE.md's Security section.
 * The result is rebuilt through the schema by the caller, so it's validated
 * like every other import.
 */
export function engineParseFromHtml<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
  html: string,
  options: EngineHtmlParseOptions<NodeName, MarkName> = {},
): DocumentNode<NodeName> {
  const owner = options.document ?? resolveGlobalDocument();
  // An inert document: its subtree is not connected to a browsing context, so
  // `<img onerror>` never fires, external resources never load, and injected
  // `<script>` never executes.
  const inert = owner.implementation.createHTMLDocument("");
  inert.body.innerHTML = html;
  sanitizeElement(inert.body);

  const engineSchema = compileEngineSchema(schema);
  const parser = new ProseMirrorDOMParser(engineSchema, buildParseRules(options.parseSpec));
  const engineDoc = parser.parse(inert.body);
  return fromEngineNode(engineDoc);
}

const DANGEROUS_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "LINK",
  "META",
  "BASE",
  "NOSCRIPT",
  "TEMPLATE",
]);
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction", "poster"]);
/** Schemes a browser may execute. Never permitted, in any attribute. */
const EXECUTABLE_URL = /^\s*(?:javascript|vbscript):/i;
const DATA_URL = /^\s*data:/i;
/** A `data:` payload that is media rather than markup. */
const MEDIA_DATA_URL = /^\s*data:(?:image|video|audio)\//i;
/**
 * Attributes that *load* a resource, as opposed to *navigating* to one.
 *
 * The distinction matters for `data:` URLs: `data:image/svg+xml` in an
 * `<img src>` cannot execute script, but the same URL in an `href` renders as a
 * document when followed, where it can. So inline media is allowed to load and
 * never to navigate.
 */
const LOADING_ATTRIBUTES = new Set(["src", "poster"]);

function isDangerousUrl(attributeName: string, value: string): boolean {
  if (EXECUTABLE_URL.test(value)) {
    return true;
  }
  if (DATA_URL.test(value)) {
    // Inline images travel this way in exported HTML and are safe to load;
    // anything that is not media, or that would be navigated to, is not.
    return !(LOADING_ATTRIBUTES.has(attributeName) && MEDIA_DATA_URL.test(value));
  }
  return false;
}

/** Strips dangerous elements, event-handler attributes, and script-y URLs in place. */
function sanitizeElement(root: Element): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (DANGEROUS_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      } else if (URL_ATTRIBUTES.has(name) && isDangerousUrl(name, attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

/** Converts our {@link HtmlParseSpec} into ProseMirror `ParseRule`s. */
function buildParseRules<NodeName extends string, MarkName extends string>(
  spec: HtmlParseSpec<NodeName, MarkName> | undefined,
): ParseRule[] {
  const rules: ParseRule[] = [];
  for (const rule of spec?.nodes ?? []) {
    rules.push(toParseRule({ tag: rule.tag, node: rule.node }, rule.getAttrs, rule.priority));
  }
  for (const rule of spec?.marks ?? []) {
    rules.push(toParseRule({ tag: rule.tag, mark: rule.mark }, rule.getAttrs, rule.priority));
  }
  return rules;
}

function toParseRule(
  target: { tag: string; node?: string; mark?: string },
  getAttrs: ((element: HTMLElement) => Record<string, unknown> | null) | undefined,
  priority: number | undefined,
): ParseRule {
  const rule: ParseRule = { ...target };
  if (getAttrs) {
    // Our rules return `null` to decline a match; ProseMirror uses `false`.
    rule.getAttrs = (dom) => getAttrs(dom) ?? false;
  }
  if (priority !== undefined) {
    rule.priority = priority;
  }
  return rule;
}
