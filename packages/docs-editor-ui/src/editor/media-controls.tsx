import {
  mediaAccessibilityIssues,
  removeMedia,
  selectedNode,
  setMediaAlignment,
  setMediaAlt,
} from "@sbh321/docs-editor-core";
import { ToolbarButton, ToolbarGroup, useEditor } from "@sbh321/docs-editor-react";

import { Input } from "../primitives/input";
import { Popover } from "../primitives/popover";
import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

/**
 * Media controls (ROADMAP Phase 8, Milestone 8.4).
 *
 * Shown only when media is selected. A toolbar full of permanently-disabled
 * controls teaches people to ignore that whole region, so these appear when
 * they apply and are absent otherwise.
 */
export function MediaControls(): ReactNode {
  const { state, dispatch } = useEditor();
  const selected = selectedNode(state);

  // Dry-running a media command is the honest test of whether one applies:
  // it accounts for the node type declaring the attributes, not merely for
  // something being selected.
  if (!selected || !setMediaAlignment("center")(state)) {
    return null;
  }

  const alt = typeof selected.node.attrs.alt === "string" ? selected.node.attrs.alt : "";

  return (
    <ToolbarGroup label="Media">
      {/* These shipped without an `iconName`, so each rendered as an empty
          square — present to a screen reader and invisible to everyone else. */}
      <Tooltip label="Align media left">
        <ToolbarButton
          command={setMediaAlignment("left")}
          iconName="alignLeft"
          label="Align media left"
        />
      </Tooltip>
      <Tooltip label="Align media centre">
        <ToolbarButton
          command={setMediaAlignment("center")}
          iconName="alignCenter"
          label="Align media centre"
        />
      </Tooltip>
      <Tooltip label="Align media right">
        <ToolbarButton
          command={setMediaAlignment("right")}
          iconName="alignRight"
          label="Align media right"
        />
      </Tooltip>

      <Popover
        label="Alt text"
        trigger={
          <Tooltip label="Edit alt text">
            <ToolbarButton iconName="altText" label="Edit alt text" />
          </Tooltip>
        }
      >
        <div className="de-media-alt">
          <Input
            label="Alt text"
            value={alt}
            hint="Describe the media, or mark it decorative if it carries no meaning."
            onChange={(event) => {
              setMediaAlt(event.target.value)(state, dispatch);
            }}
          />
          <button
            type="button"
            className="de-button de-button--outline de-button--sm"
            onClick={() => {
              setMediaAlt("", { decorative: true })(state, dispatch);
            }}
          >
            Mark decorative
          </button>
        </div>
      </Popover>

      <Tooltip label="Remove media">
        <ToolbarButton command={removeMedia} iconName="delete" label="Remove media" />
      </Tooltip>
    </ToolbarGroup>
  );
}

export interface MediaAccessibilityBadgeProps {
  readonly className?: string;
}

/**
 * How many media accessibility problems the document has.
 *
 * Surfacing the count is what makes alt text a gate rather than an aspiration —
 * an author can see, without leaving the editor, that something still needs a
 * description.
 */
export function MediaAccessibilityBadge({ className }: MediaAccessibilityBadgeProps): ReactNode {
  const { state } = useEditor();
  const issues = mediaAccessibilityIssues(state.doc, state.schema);

  return (
    <span
      className={className ?? "de-a11y-badge"}
      data-a11y-issues={String(issues.length)}
      // Polite: an author typing should not be interrupted the instant they
      // insert an undescribed image.
      aria-live="polite"
    >
      {issues.length === 0
        ? "No media accessibility issues"
        : `${String(issues.length)} media accessibility issue${issues.length === 1 ? "" : "s"}`}
    </span>
  );
}
