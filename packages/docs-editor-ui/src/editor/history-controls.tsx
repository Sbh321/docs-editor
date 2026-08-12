import { redo, undo } from "@sbh321/docs-editor-core";
import { ToolbarButton, ToolbarGroup } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

/**
 * Undo and redo.
 *
 * A component rather than two lines in the toolbar's body, so `"history"` can be
 * addressed like every other toolbar item — hidden, reordered, or reused in an
 * application's own bar.
 */
export function HistoryControls(): ReactNode {
  return (
    <ToolbarGroup label="History">
      <Tooltip label="Undo (Ctrl+Z)">
        <ToolbarButton command={undo} iconName="undo" label="Undo" />
      </Tooltip>
      <Tooltip label="Redo (Ctrl+Shift+Z)">
        <ToolbarButton command={redo} iconName="redo" label="Redo" />
      </Tooltip>
    </ToolbarGroup>
  );
}
