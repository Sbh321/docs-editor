import { describe, expect, it } from "vitest";

import { defaultParseSpec } from "../preset/default-parse-spec";
import { defaultMarkRenderers, defaultNodeRenderers } from "../preset/default-renderers";
import { defaultSchema } from "../preset/default-schema";
import { HtmlExporter, HtmlImporter } from "../serialization";
import { EditorState } from "../state";

import {
  activeList,
  activeTaskItem,
  setListStyle,
  toggleList,
  toggleTaskItem,
} from "./list-commands";

import type { Dispatch } from "../commands";
import type { DefaultMarkName, DefaultNodeName } from "../preset/default-schema";
import type { DocumentNode } from "../schema";

/**
 * Lists (ROADMAP Phase 9, Milestone 9.3).
 *
 * The behaviour that matters is conversion *in place* — a list that changes
 * kind without losing its nesting or its cursor — and that checklists survive
 * a round-trip through the markup other applications produce.
 */

type State = EditorState<DefaultNodeName, DefaultMarkName>;

const paragraph = (text: string): DocumentNode<DefaultNodeName> =>
  defaultSchema.node("paragraph", undefined, [defaultSchema.text(text)]);

function listState(
  listType: "bullet_list" | "ordered_list" | "task_list",
  itemType: "list_item" | "task_item",
  anchor = 5,
): State {
  const doc = defaultSchema.createDocument([
    defaultSchema.node(listType, undefined, [
      defaultSchema.node(itemType, undefined, [paragraph("One")]),
      defaultSchema.node(itemType, undefined, [paragraph("Two")]),
    ]),
  ]);
  return EditorState.create({ schema: defaultSchema, doc, selection: { anchor, head: anchor } });
}

function paragraphState(): State {
  return EditorState.create({
    schema: defaultSchema,
    doc: defaultSchema.createDocument([paragraph("Hello")]),
    selection: { anchor: 2, head: 2 },
  });
}

function run(
  state: State,
  command: (state: State, dispatch?: Dispatch<DefaultNodeName>) => boolean,
): { state: State; handled: boolean } {
  let next = state;
  const handled = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { state: next, handled };
}

describe("toggleList", () => {
  it("wraps a plain paragraph", () => {
    const { state, handled } = run(paragraphState(), toggleList("bullet_list"));
    expect(handled).toBe(true);
    expect(state.doc.content[0]?.type).toBe("bullet_list");
  });

  it("lifts out when already that kind of list", () => {
    const { state, handled } = run(
      listState("bullet_list", "list_item"),
      toggleList("bullet_list"),
    );
    expect(handled).toBe(true);
    expect(state.doc.content[0]?.type).toBe("paragraph");
  });

  it("converts between list types without unwrapping", () => {
    const { state, handled } = run(
      listState("bullet_list", "list_item"),
      toggleList("ordered_list"),
    );
    expect(handled).toBe(true);
    const list = state.doc.content[0];
    expect(list?.type).toBe("ordered_list");
    // Both items survived as items — an unwrap-and-rewrap would have flattened
    // them into paragraphs on the way through.
    expect(list?.content).toHaveLength(2);
    expect(list?.content[0]?.type).toBe("list_item");
    expect(list?.content[1]?.content[0]?.content[0]?.text).toBe("Two");
  });

  it("converts item types too when the target uses a different one", () => {
    const { state, handled } = run(listState("bullet_list", "list_item"), toggleList("task_list"));
    expect(handled).toBe(true);
    const list = state.doc.content[0];
    expect(list?.type).toBe("task_list");
    expect(list?.content.map((item) => item.type)).toEqual(["task_item", "task_item"]);
    expect(list?.content[0]?.attrs.checked).toBe(false);
  });

  it("preserves nesting through a conversion", () => {
    // The reason conversion is in-place: unwrapping a nested outline collapses
    // it, and the user watches three levels become one.
    const doc = defaultSchema.createDocument([
      defaultSchema.node("bullet_list", undefined, [
        defaultSchema.node("list_item", undefined, [
          paragraph("Outer"),
          defaultSchema.node("bullet_list", undefined, [
            defaultSchema.node("list_item", undefined, [paragraph("Inner")]),
          ]),
        ]),
      ]),
    ]);
    const state = EditorState.create({
      schema: defaultSchema,
      doc,
      selection: { anchor: 4, head: 4 },
    });

    const { state: next } = run(state, toggleList("ordered_list"));
    const outer = next.doc.content[0];
    expect(outer?.type).toBe("ordered_list");
    // The inner list is still there, still nested, still a list.
    expect(outer?.content[0]?.content[1]?.type).toBe("bullet_list");
    expect(outer?.content[0]?.content[1]?.content[0]?.content[0]?.content[0]?.text).toBe("Inner");
  });
});

describe("activeList", () => {
  it("reports the innermost list", () => {
    expect(activeList(listState("ordered_list", "list_item"))?.type).toBe("ordered_list");
  });

  it("reports null outside a list", () => {
    expect(activeList(paragraphState())).toBeNull();
  });
});

describe("setListStyle", () => {
  it("sets and clears the marker style", () => {
    const { state, handled } = run(listState("bullet_list", "list_item"), setListStyle("square"));
    expect(handled).toBe(true);
    expect(activeList(state)?.style).toBe("square");

    const cleared = run(state, setListStyle(null)).state;
    expect(activeList(cleared)?.style).toBeNull();
  });

  it("declines when the style is already applied", () => {
    const { state } = run(listState("bullet_list", "list_item"), setListStyle("circle"));
    expect(run(state, setListStyle("circle")).handled).toBe(false);
  });

  it("declines outside a list", () => {
    expect(run(paragraphState(), setListStyle("square")).handled).toBe(false);
  });
});

describe("toggleTaskItem", () => {
  it("checks and unchecks the item at the cursor", () => {
    const { state, handled } = run(listState("task_list", "task_item"), toggleTaskItem());
    expect(handled).toBe(true);
    expect(activeTaskItem(state)?.checked).toBe(true);

    expect(activeTaskItem(run(state, toggleTaskItem()).state)?.checked).toBe(false);
  });

  it("takes an explicit value so a click cannot undo itself", () => {
    // Toggling from a stale read is how a double dispatch ends up back where it
    // started; a checkbox knows the value it wants.
    const { state } = run(listState("task_list", "task_item"), toggleTaskItem(true));
    expect(run(state, toggleTaskItem(true)).handled).toBe(false);
  });

  it("declines outside a task list", () => {
    expect(run(listState("bullet_list", "list_item"), toggleTaskItem()).handled).toBe(false);
  });
});

describe("HTML round-trip", () => {
  const exporter = new HtmlExporter<DefaultNodeName, DefaultMarkName>({
    schema: defaultSchema,
    nodeRenderers: defaultNodeRenderers(),
    markRenderers: defaultMarkRenderers,
  });
  const importer = new HtmlImporter<DefaultNodeName, DefaultMarkName>({
    schema: defaultSchema,
    parseSpec: defaultParseSpec,
  });

  it("round-trips a checklist with its checked state", () => {
    const { state } = run(listState("task_list", "task_item"), toggleTaskItem(true));
    const html = exporter.serialize(state.doc);
    const back = importer.parse(html);

    const list = back.content[0];
    expect(list?.type).toBe("task_list");
    expect(list?.content[0]?.attrs.checked).toBe(true);
    expect(list?.content[1]?.attrs.checked).toBe(false);
  });

  it("reads a checklist pasted from another application", () => {
    // No `data-task-list` of ours — just the checkbox markup GitHub and Google
    // Docs emit. Without recognising it, a pasted checklist arrives as text.
    const doc = importer.parse(
      '<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>',
    );
    expect(doc.content[0]?.type).toBe("task_list");
    expect(doc.content[0]?.content[0]?.attrs.checked).toBe(true);
    expect(doc.content[0]?.content[1]?.attrs.checked).toBe(false);
  });

  it("still reads an ordinary bullet list as a bullet list", () => {
    // The task-list rules run first, so this is the case that would break if
    // they matched too eagerly.
    const doc = importer.parse("<ul><li>Plain</li></ul>");
    expect(doc.content[0]?.type).toBe("bullet_list");
  });

  it("round-trips a marker style", () => {
    const { state } = run(listState("ordered_list", "list_item"), setListStyle("lower-roman"));
    const back = importer.parse(exporter.serialize(state.doc));
    expect(back.content[0]?.attrs.listStyle).toBe("lower-roman");
  });
});
