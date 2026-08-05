import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  toggleHeaderRow,
} from "@sbh321/docs-editor-core";
import { ToolbarButton, ToolbarGroup, useEditor } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

/**
 * Table controls (ROADMAP Phase 8, Milestone 8.4).
 *
 * Shown only with the cursor inside a table, for the same reason as the media
 * controls: a row of permanently-disabled buttons is noise that trains people
 * to stop looking at that part of the toolbar.
 *
 * Whether they apply is decided by **dry-running a command** rather than by
 * inspecting the document here — the command already knows, and a second
 * implementation of that rule would eventually disagree with it.
 */
const TABLE_ACTIONS = [
  { command: addRowAfter, icon: "addRow", label: "Add row" },
  { command: addColumnAfter, icon: "addColumn", label: "Add column" },
  { command: deleteRow, icon: "deleteRow", label: "Delete row" },
  { command: deleteColumn, icon: "deleteColumn", label: "Delete column" },
  { command: mergeCells, icon: "mergeCells", label: "Merge cells" },
  { command: toggleHeaderRow, icon: "headerRow", label: "Toggle header row" },
  { command: deleteTable, icon: "delete", label: "Delete table" },
] as const;

export function TableControls(): ReactNode {
  const { state } = useEditor();

  if (!addRowAfter(state)) {
    return null;
  }

  return (
    <ToolbarGroup label="Table">
      {/* Each of these shipped without an `iconName`, and a `ToolbarButton` with
          neither an icon nor children renders an **empty square** — the whole
          table group was invisible, named only to a screen reader. */}
      {TABLE_ACTIONS.map((action) => (
        <Tooltip key={action.label} label={action.label}>
          <ToolbarButton command={action.command} iconName={action.icon} label={action.label} />
        </Tooltip>
      ))}
    </ToolbarGroup>
  );
}
