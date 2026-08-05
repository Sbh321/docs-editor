import { insertMedia, lift, wrapIn } from "@sbh321/docs-editor-core";
import {
  ToolbarButton,
  ToolbarGroup,
  useEditor,
  useIsBlockActive,
} from "@sbh321/docs-editor-react";

import { DropdownMenu } from "../primitives/dropdown-menu";
import { Tooltip } from "../primitives/tooltip";

import { buildTable } from "./insert-actions";

import type { DropdownMenuItem } from "../primitives/dropdown-menu";
import type { ReactNode } from "react";

export interface InsertMenuProps {
  /** Called when the user asks to insert an image, so the app can pick a file. */
  readonly onInsertImage?: () => void;
  /** Extra items appended to the menu. */
  readonly items?: readonly DropdownMenuItem[];
}

/**
 * The insert menu (ROADMAP Phase 8, Milestone 8.4).
 *
 * A menu rather than a row of buttons: insertions are infrequent and numerous,
 * which is exactly the shape a menu suits and a toolbar does not.
 */
export function InsertMenu({ onInsertImage, items = [] }: InsertMenuProps): ReactNode {
  const { state, dispatch } = useEditor();

  const menuItems: DropdownMenuItem[] = [
    {
      id: "image",
      label: "Image",
      // Delegated: choosing a file means a picker and an upload, both of which
      // are the application's business, not the editor's.
      onSelect: () => onInsertImage?.(),
      disabled: onInsertImage === undefined,
    },
    {
      id: "table",
      label: "Table",
      onSelect: () => {
        dispatch(state.tr.insertNode(buildTable(state.schema, 3, 3)));
      },
    },
    {
      id: "divider",
      label: "Divider",
      onSelect: () => {
        dispatch(state.tr.insertNode(state.schema.node("divider")));
      },
    },
    {
      id: "embed",
      label: "Embed",
      onSelect: () => {
        insertMedia("embed", { alt: "Embedded content" })(state, dispatch);
      },
    },
    ...items,
  ];

  // Whether the cursor is already inside a quote, which decides whether the
  // toggle wraps or lifts.
  const quoted = useIsBlockActive("blockquote");

  return (
    <ToolbarGroup label="Insert">
      <DropdownMenu
        label="Insert"
        items={menuItems}
        trigger={
          <Tooltip label="Insert">
            <ToolbarButton iconName="add" label="Insert" />
          </Tooltip>
        }
      />
      {/* A **toggle**, not two buttons. It used to sit beside a bare `lift`
          button labelled "Outdent" which had no icon and so rendered as an
          invisible gap in the toolbar — and "outdent" is now the indentation
          group's job anyway. Quoting and unquoting is one idea, so it is one
          control. */}
      <Tooltip label="Quote">
        <ToolbarButton
          command={quoted ? lift : wrapIn("blockquote")}
          active={quoted}
          iconName="quote"
          label="Quote"
        />
      </Tooltip>
    </ToolbarGroup>
  );
}
