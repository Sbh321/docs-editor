import { Toolbar } from "@sbh321/docs-editor-react";
import { Fragment } from "react";

import { cn } from "../class-names";
import { ToolbarSurface } from "../primitives/toolbar-surface";

import { ColorSchemeToggle } from "./color-scheme-toggle";
import {
  BlockTypeControls,
  ColorControls,
  FontFamilyControls,
  ListControls,
  TextFormatControls,
} from "./format-controls";
import { HistoryControls } from "./history-controls";
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
import { resolveToolbarItems } from "./toolbar-items";

import type { ToolbarItemId, ToolbarItemName, ToolbarItemSlots } from "./toolbar-items";
import type { DropdownMenuItem } from "../primitives/dropdown-menu";
import type { ComponentType, ReactNode } from "react";

export interface EditorToolbarProps {
  /**
   * Which controls the bar holds, and in what order. Defaults to
   * `DEFAULT_TOOLBAR_ITEMS`.
   *
   * Ids with no built-in control (`"file"`, `"layout"`, `"upload"`) and ids of
   * your own render only when {@link EditorToolbarProps.slots} supplies them.
   */
  readonly items?: readonly ToolbarItemId[];
  /**
   * Controls removed from the roster — the subtractive form, for keeping the
   * default bar minus a few things without restating it.
   *
   * Composes with `items`: hiding applies to whatever roster is in play.
   */
  readonly hide?: readonly ToolbarItemId[];
  /**
   * Content for individual positions, keyed by item id. A built-in id
   * **replaces** that control; any other id defines one of your own, which then
   * has to appear in `items` to be rendered.
   */
  readonly slots?: ToolbarItemSlots;
  /**
   * Rendered before every item. The overflow row drops items from the end, so
   * what leads can never leave the bar.
   */
  readonly leading?: ReactNode;
  /** Rendered after every item, before the overflow trigger. */
  readonly trailing?: ReactNode;
  /** Called when the user asks to insert an image, so the app can pick a file. */
  readonly onInsertImage?: () => void;
  /** Extra entries appended to the insert menu. */
  readonly insertMenuItems?: readonly DropdownMenuItem[];
  /** Accessible name for the overflow trigger. Defaults to `"More tools"`. */
  readonly overflowLabel?: string;
  readonly className?: string;
  /** Extra controls, rendered at the `"extras"` position. */
  readonly children?: ReactNode;
}

/**
 * The controls each built-in id resolves to.
 *
 * `"file"`, `"layout"`, `"upload"` and `"extras"` are absent on purpose: they
 * need state this component does not have (an import handler, a panel's open
 * state, an upload registry) and arrive through slots or `children` instead.
 * `"insert"` is absent because it takes props, and is handled below.
 */
const BUILT_IN_CONTROLS: Partial<Record<ToolbarItemName, ComponentType>> = {
  history: HistoryControls,
  blockType: BlockTypeControls,
  fontFamily: FontFamilyControls,
  fontSize: FontSizeControl,
  textFormat: TextFormatControls,
  color: ColorControls,
  alignment: AlignmentControls,
  lists: ListControls,
  indent: IndentControls,
  link: LinkButton,
  clearFormatting: ClearFormattingButton,
  table: TableControls,
  media: MediaControls,
  colorScheme: ColorSchemeToggle,
};

/**
 * The main toolbar (ROADMAP Phase 8, Milestone 8.4; made item-addressable in
 * Phase 9.5, Milestone 9.5.2).
 *
 * Composed from the headless `Toolbar`, which owns roving-tabindex keyboard
 * navigation and the `toolbar` role, so the whole bar is a single tab stop.
 * Everything it contains delegates to a core command.
 *
 * Controls that do not fit move into an overflow menu rather than wrapping onto
 * a second row or running off the edge — see {@link OverflowRow}.
 *
 * ## Composing the bar
 *
 * Every control has an id, so the bar is configured rather than replaced:
 *
 * ```tsx
 * // The default bar, minus two controls.
 * <EditorToolbar hide={["fontFamily", "colorScheme"]} />
 *
 * // Exactly these, in this order.
 * <EditorToolbar items={["history", "textFormat", "lists"]} />
 *
 * // Your control in the middle of ours.
 * <EditorToolbar
 *   items={["history", "share", "textFormat"]}
 *   slots={{ share: <ShareButton /> }}
 * />
 * ```
 *
 * A slot's content is rendered as one overflow unit, so wrap several controls in
 * a `ToolbarGroup` to keep them together — that is also what gives them a name
 * in the accessibility tree.
 */
export function EditorToolbar({
  items,
  hide,
  slots,
  leading,
  trailing,
  onInsertImage,
  insertMenuItems,
  overflowLabel,
  className,
  children,
}: EditorToolbarProps): ReactNode {
  const rendered = resolveToolbarItems(items, hide).map((id) => {
    // A slot always wins, which is what makes every built-in replaceable
    // without forking the bar. `null` is a slot like any other and renders
    // nothing — falling back to the built-in there would make "remove this"
    // restore it, which is the opposite of what it reads as.
    if (slots !== undefined && id in slots) {
      const slot = slots[id];
      return slot === null ? null : <Fragment key={id}>{slot}</Fragment>;
    }

    if (id === "extras") {
      return children === undefined ? null : <Fragment key={id}>{children}</Fragment>;
    }

    if (id === "insert") {
      return (
        <InsertMenu
          key={id}
          {...(onInsertImage ? { onInsertImage } : {})}
          {...(insertMenuItems ? { items: insertMenuItems } : {})}
        />
      );
    }

    const Control = BUILT_IN_CONTROLS[id as ToolbarItemName];
    // An id nothing supplies renders nothing. That is what lets the default
    // roster name `"file"`, `"layout"` and `"upload"` unconditionally while a
    // bare `<EditorToolbar />` stays free of chrome it cannot wire.
    return Control ? <Control key={id} /> : null;
  });

  return (
    <ToolbarSurface className={cn("de-editor-toolbar", className)}>
      <Toolbar label="Formatting" className="de-toolbar">
        <OverflowRow {...(overflowLabel === undefined ? {} : { overflowLabel })}>
          {leading}
          {rendered}
          {trailing}
        </OverflowRow>
      </Toolbar>
    </ToolbarSurface>
  );
}
