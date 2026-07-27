import { DuplicateFormatError, UnknownFormatError } from "./errors";

import type { DocumentExporter, DocumentImporter } from "./types";
import type { DocumentNode } from "../schema";

/**
 * Looks importers and exporters up by format id — the surface a format package
 * or plugin registers into (per ARCHITECTURE.md's Plugin System, which lists
 * Serializers, Importers, and Exporters as contributions). Ships empty:
 * nothing is auto-registered, matching {@link import("../commands").CommandRegistry}
 * and CLAUDE.md's "Explicit Over Implicit".
 *
 * ```ts
 * const registry = new SerializationRegistry<NodeName>()
 *   .registerExporter(new JsonExporter(schema))
 *   .registerImporter(new JsonImporter(schema));
 *
 * const html = registry.export("html", doc);   // once an HTML exporter is registered
 * const doc2 = registry.import("json", jsonString);
 * ```
 */
export class SerializationRegistry<NodeName extends string = string> {
  private readonly exporters = new Map<string, DocumentExporter<NodeName>>();
  private readonly importers = new Map<string, DocumentImporter<NodeName>>();

  /** Registers `exporter` under its `format`. Throws if that format already has one. */
  registerExporter(exporter: DocumentExporter<NodeName>): this {
    if (this.exporters.has(exporter.format)) {
      throw new DuplicateFormatError(exporter.format, "exporter");
    }
    this.exporters.set(exporter.format, exporter);
    return this;
  }

  /** Registers `importer` under its `format`. Throws if that format already has one. */
  registerImporter(importer: DocumentImporter<NodeName>): this {
    if (this.importers.has(importer.format)) {
      throw new DuplicateFormatError(importer.format, "importer");
    }
    this.importers.set(importer.format, importer);
    return this;
  }

  /** The exporter registered for `format`, or `undefined`. */
  getExporter(format: string): DocumentExporter<NodeName> | undefined {
    return this.exporters.get(format);
  }

  /** The importer registered for `format`, or `undefined`. */
  getImporter(format: string): DocumentImporter<NodeName> | undefined {
    return this.importers.get(format);
  }

  /** Whether an exporter is registered for `format`. */
  hasExporter(format: string): boolean {
    return this.exporters.has(format);
  }

  /** Whether an importer is registered for `format`. */
  hasImporter(format: string): boolean {
    return this.importers.has(format);
  }

  /** The format ids with a registered exporter. */
  exportFormats(): readonly string[] {
    return [...this.exporters.keys()];
  }

  /** The format ids with a registered importer. */
  importFormats(): readonly string[] {
    return [...this.importers.keys()];
  }

  /** Exports `doc` to `format`. Throws {@link UnknownFormatError} if no exporter is registered. */
  export(format: string, doc: DocumentNode<NodeName>): string {
    const exporter = this.exporters.get(format);
    if (!exporter) {
      throw new UnknownFormatError(format, "exporter");
    }
    return exporter.serialize(doc);
  }

  /** Imports `input` from `format`. Throws {@link UnknownFormatError} if no importer is registered. */
  import(format: string, input: string): DocumentNode<NodeName> {
    const importer = this.importers.get(format);
    if (!importer) {
      throw new UnknownFormatError(format, "importer");
    }
    return importer.parse(input);
  }
}
