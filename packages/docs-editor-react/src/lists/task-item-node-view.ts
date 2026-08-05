import {
  TASK_ITEM_CHECKED_ATTR,
  TASK_ITEM_DATA_ATTR,
  TASK_ITEM_NODE,
} from "@sbh321/docs-editor-core";

import type {
  Dispatch,
  DocumentNode,
  EditorState,
  NodeViewFactory,
  NodeViewMap,
} from "@sbh321/docs-editor-core";

export interface TaskItemNodeViewOptions {
  /** Node type to attach to. Defaults to `"task_item"`. */
  readonly itemType?: string;
}

/**
 * A node view making a checklist's boxes clickable (ROADMAP Phase 9,
 * Milestone 9.4).
 *
 * The *renderer* emits a **disabled** checkbox, which is right for an export: a
 * document is not an application, and a live control in exported HTML would
 * imply that ticking it changes something. Inside the editor the opposite is
 * true — a checklist whose boxes cannot be clicked is not a checklist.
 *
 * So the interaction lives here rather than in the renderer, which is the split
 * node views exist for: `nodeRenderers` answers "what DOM does this node
 * produce", and a node view owns a node the user manipulates.
 *
 * The checkbox sits **outside** `contentDOM` on purpose. Everything inside
 * `contentDOM` is content the editor parses back into the document, so a
 * control placed there would be read as text the user had typed.
 *
 * `ignoreMutation` is deliberately **not** implemented. This node has content,
 * so returning `true` unconditionally would make the editor ignore real typing
 * inside the item. Nothing here needs it: `checked` is a DOM *property*, and
 * setting it produces no mutation record for the editor to misread.
 */
export function createTaskItemNodeViews<NodeName extends string = string>(
  getState: () => EditorState<NodeName, string>,
  dispatch: Dispatch<NodeName>,
  options: TaskItemNodeViewOptions = {},
): NodeViewMap<NodeName> {
  const itemType = (options.itemType ?? TASK_ITEM_NODE) as NodeName;

  // Built as a typed factory first, then keyed — an object literal with a
  // computed key cannot be inferred against `Partial<Record<NodeName, …>>`.
  const factory: NodeViewFactory<NodeName> = ({ node, getPos }) => {
    const dom = document.createElement("li");
    const checkbox = document.createElement("input");
    const content = document.createElement("div");

    checkbox.type = "checkbox";
    // Named explicitly. The item's own text would be the natural label, but
    // associating them would put the whole editable inside a `<label>` —
    // clicking any word would then toggle the box instead of placing the
    // caret.
    checkbox.setAttribute("aria-label", "Done");

    const apply = (target: DocumentNode<NodeName>): void => {
      const checked = target.attrs[TASK_ITEM_CHECKED_ATTR] === true;
      checkbox.checked = checked;
      dom.setAttribute(TASK_ITEM_DATA_ATTR, checked ? "true" : "false");
    };
    apply(node);

    // Prevents the press becoming a text selection before the click lands,
    // which would drag the caret out of the item.
    const onMouseDown = (event: MouseEvent): void => {
      event.preventDefault();
    };

    const onChange = (): void => {
      const pos = getPos();
      if (pos === null) {
        return;
      }
      // Read at the moment of the click rather than captured when this view
      // was built — the document may have changed since.
      const state = getState();
      const validated = state.schema.blockType(itemType, {
        [TASK_ITEM_CHECKED_ATTR]: checkbox.checked,
      });
      dispatch(state.tr.setNodeAttrs(pos, validated.attrs));
    };

    checkbox.addEventListener("mousedown", onMouseDown);
    checkbox.addEventListener("change", onChange);
    dom.append(checkbox, content);

    return {
      dom,
      contentDOM: content,
      update: (next) => {
        if (next.type !== itemType) {
          return false;
        }
        apply(next);
        return true;
      },
      // The editor must not also act on a click meant for the checkbox.
      stopEvent: (event) => event.target === checkbox,
      destroy: () => {
        checkbox.removeEventListener("mousedown", onMouseDown);
        checkbox.removeEventListener("change", onChange);
      },
    };
  };

  return { [itemType]: factory } as NodeViewMap<NodeName>;
}
