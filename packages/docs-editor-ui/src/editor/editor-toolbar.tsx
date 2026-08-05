import { redo, undo } from "@sbh321/docs-editor-core";
import { Toolbar, ToolbarButton, ToolbarGroup, useColorScheme } from "@sbh321/docs-editor-react";

import { cn } from "../class-names";
import { ToolbarSurface } from "../primitives/toolbar-surface";
import { Tooltip } from "../primitives/tooltip";

import {
  BlockTypeSelect,
  ColorControls,
  FontFamilySelect,
  ListControls,
  TextFormatControls,
} from "./format-controls";
import { InsertMenu } from "./insert-menu";
import { LinkButton } from "./link-editor";
import { MediaControls } from "./media-controls";
import { OverflowRow } from "./overflow-row";
import {
  AlignmentControls,
  ClearFormattingButton,
  FontSizeControl,
  IndentControls,
} from "./paragraph-controls";
import { TableControls } from "./table-controls";

import type { InsertMenuProps } from "./insert-menu";
import type { ReactNode } from "react";

export interface EditorToolbarProps extends InsertMenuProps {
  /**
   * Rendered before every other group — the file menu's seat. The overflow row
   * drops groups from the end, so what leads can never leave the bar.
   */
  readonly leading?: ReactNode;
  readonly className?: string;
  /** Show the light/dark toggle. Defaults to `true`. */
  readonly colorSchemeToggle?: boolean;
  /** Extra controls, appended before the overflow trigger. */
  readonly children?: ReactNode;
}

const SUN_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden>
    <circle cx="8" cy="8" r="3.25" strokeWidth="1.5" />
    <path
      d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const MOON_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden>
    <path
      d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Half sun, half moon — the conventional "follow the system" mark. */
const AUTO_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" />
  </svg>
);

/**
 * Cycles light → dark → follow-the-system.
 *
 * Icon-led rather than a bare word. This shipped first as a text button reading
 * "Auto", which nobody recognised as a theme control — the first question asked
 * about it was where the button *was*, while looking straight at it.
 */
function ColorSchemeToggle(): ReactNode {
  const { scheme, preference, toggle } = useColorScheme();
  if (!toggle) {
    return null;
  }

  // The *resolved* scheme is in the name too, so "Auto" says which way it
  // currently resolves rather than leaving the user to guess.
  const label = preference === "system" ? `Theme: auto (${scheme})` : `Theme: ${preference}`;
  const icon = preference === "system" ? AUTO_ICON : preference === "dark" ? MOON_ICON : SUN_ICON;

  return (
    <ToolbarGroup label="Appearance">
      <Tooltip label={`${label} — click to change`}>
        <ToolbarButton onClick={toggle} label={label} icon={icon} />
      </Tooltip>
    </ToolbarGroup>
  );
}

/**
 * The main toolbar (ROADMAP Phase 8, Milestone 8.4).
 *
 * Composed from the headless `Toolbar`, which owns roving-tabindex keyboard
 * navigation and the `toolbar` role, so the whole bar is a single tab stop.
 * Everything it contains delegates to a core command.
 *
 * Controls that do not fit move into an overflow menu rather than wrapping onto
 * a second row or running off the edge — see {@link OverflowRow}.
 */
export function EditorToolbar({
  leading,
  className,
  colorSchemeToggle = true,
  onInsertImage,
  items,
  children,
}: EditorToolbarProps): ReactNode {
  return (
    <ToolbarSurface className={cn("de-editor-toolbar", className)}>
      <Toolbar label="Formatting" className="de-toolbar">
        <OverflowRow>
          {leading}
          <ToolbarGroup label="History">
            <Tooltip label="Undo (Ctrl+Z)">
              <ToolbarButton command={undo} iconName="undo" label="Undo" />
            </Tooltip>
            <Tooltip label="Redo (Ctrl+Shift+Z)">
              <ToolbarButton command={redo} iconName="redo" label="Redo" />
            </Tooltip>
          </ToolbarGroup>

          <ToolbarGroup label="Paragraph style">
            <BlockTypeSelect />
          </ToolbarGroup>

          <ToolbarGroup label="Typeface">
            <FontFamilySelect />
          </ToolbarGroup>

          <FontSizeControl />

          <TextFormatControls />
          <ColorControls />

          <AlignmentControls />
          <ListControls />
          <IndentControls />

          <LinkButton />
          <ClearFormattingButton />

          <InsertMenu {...(onInsertImage ? { onInsertImage } : {})} {...(items ? { items } : {})} />

          {/* Contextual: each renders nothing unless it applies, so the bar
              does not carry a row of permanently-disabled buttons. */}
          <TableControls />
          <MediaControls />

          {children}
          {/* Last on purpose. The overflow row drops groups from the end, so
              whatever sits here is the first thing to leave the bar on a
              narrow window — and of everything present, the theme toggle is
              the control a writer needs least often mid-document. Before this
              it sat ahead of `children`, which pushed Layout, Upload and the
              application's own actions into the overflow menu while a
              nice-to-have kept its seat. */}
          {colorSchemeToggle && <ColorSchemeToggle />}
        </OverflowRow>
      </Toolbar>
    </ToolbarSurface>
  );
}
