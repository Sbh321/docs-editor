/**
 * How lists cross the HTML boundary (ROADMAP Phase 9, Milestone 9.3).
 *
 * Task lists render as the markup every other tool produces for them — a `ul`
 * of `li`s each holding a disabled checkbox — rather than as a bespoke element.
 * That is what makes a checklist pasted into Gmail, GitHub or Word arrive as a
 * checklist instead of as unexplained text.
 */

import {
  isListStyle,
  LIST_STYLE_ATTR,
  TASK_ITEM_CHECKED_ATTR,
  TASK_ITEM_NODE,
  TASK_LIST_NODE,
} from "./list-node-specs";

import type { DOMOutputSpec, NodeRenderer } from "../dom-output-spec";
import type { NodeParseRule } from "../dom-parse-spec";

/** The `data-` attribute marking a list as a task list in exported HTML. */
export const TASK_LIST_DATA_ATTR = "data-task-list";

/** The `data-` attribute recording an item's checked state. */
export const TASK_ITEM_DATA_ATTR = "data-checked";

/** The element attributes carrying a list's marker style, if it has one. */
export function listStyleAttributes(
  attrs: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const style = attrs[LIST_STYLE_ATTR];
  return isListStyle(style) ? { style: `list-style-type: ${style}` } : {};
}

/**
 * Renderers for the task list node types.
 *
 * The checkbox is `disabled` in exported markup on purpose: the export is a
 * *document*, not an application, and a live control in it would suggest that
 * clicking changes something. Inside the editor a node view replaces it with a
 * real one.
 */
export function taskListNodeRenderers<NodeName extends string = string>(): Partial<
  NodeRenderer<NodeName>
> {
  return {
    [TASK_LIST_NODE]: (node) =>
      ["ul", { [TASK_LIST_DATA_ATTR]: "true", ...listStyleAttributes(node.attrs) }, 0] as never,
    [TASK_ITEM_NODE]: (node) => {
      const checked = node.attrs[TASK_ITEM_CHECKED_ATTR] === true;
      const checkbox: DOMOutputSpec = [
        "input",
        checked
          ? { type: "checkbox", checked: "checked", disabled: "disabled" }
          : { type: "checkbox", disabled: "disabled" },
      ];
      return [
        "li",
        { [TASK_ITEM_DATA_ATTR]: checked ? "true" : "false" },
        checkbox,
        // The content hole sits beside the checkbox, so the item's paragraphs
        // stay ordinary blocks rather than being nested inside a label.
        ["div", 0],
      ] as never;
    },
  } as Partial<NodeRenderer<NodeName>>;
}

/**
 * Parse rules for task lists.
 *
 * These must come **before** the ordinary `ul`/`li` rules, since a task list is
 * a `ul` too and the first matching rule wins. `taskListHtmlParseRules` is
 * spread ahead of them in the preset for exactly that reason.
 *
 * A `ul` is recognised as a task list either by our own `data-` attribute or by
 * containing a checkbox input — the latter is what makes a checklist copied
 * from GitHub or Google Docs come in as one.
 */
export function taskListHtmlParseRules<
  NodeName extends string = string,
>(): readonly NodeParseRule<NodeName>[] {
  return [
    {
      tag: "ul",
      node: TASK_LIST_NODE as NodeName,
      getAttrs: (element) => {
        const declared = element.getAttribute(TASK_LIST_DATA_ATTR) === "true";
        const hasCheckbox = element.querySelector("li > input[type=checkbox]") !== null;
        // Declining (`null`) rather than matching lets the plain `ul` rule
        // handle an ordinary bullet list.
        return declared || hasCheckbox ? {} : null;
      },
    },
    {
      tag: "li",
      node: TASK_ITEM_NODE as NodeName,
      getAttrs: (element) => {
        const parent = element.parentElement;
        const inTaskList =
          parent?.getAttribute(TASK_LIST_DATA_ATTR) === "true" ||
          parent?.querySelector("li > input[type=checkbox]") !== null;
        if (!inTaskList) {
          return null;
        }
        const box = element.querySelector("input[type=checkbox]");
        const checked =
          element.getAttribute(TASK_ITEM_DATA_ATTR) === "true" ||
          (box !== null && box.hasAttribute("checked"));
        return { [TASK_ITEM_CHECKED_ATTR]: checked };
      },
    },
  ];
}

/** Reads a list's marker style back off an element, if it declares one. */
export function parseListStyle(element: Element): Record<string, unknown> {
  const style = element.getAttribute("style");
  const match = style ? /(?:^|;)\s*list-style-type\s*:\s*([^;]+)/i.exec(style) : null;
  const value = match?.[1]?.trim();
  return isListStyle(value) ? { [LIST_STYLE_ATTR]: value } : {};
}
