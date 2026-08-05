import {
  activeFontSize,
  adjustFontSize,
  clearFormatting,
  FONT_SIZE_PRESETS,
  indent,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  outdent,
  setFontSize,
  setTextAlign,
  TEXT_ALIGNMENTS,
  textAlign,
} from "@sbh321/docs-editor-core";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from "@sbh321/docs-editor-icons";
import { ToolbarButton, ToolbarGroup, useEditor } from "@sbh321/docs-editor-react";
import { useState } from "react";

import { DropdownMenu } from "../primitives/dropdown-menu";
import { Tooltip } from "../primitives/tooltip";

import type { TextAlign } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

/**
 * Paragraph-level controls (ROADMAP Phase 9, Milestone 9.6).
 *
 * Every one of these is presentation only: it reads a core query to decide what
 * to show and runs a core command to change it, exactly as the headless UI
 * does. None of them knows how alignment or indentation are *stored*.
 */

const ALIGN_LABELS: Readonly<Record<TextAlign, string>> = {
  left: "Align left",
  center: "Align center",
  right: "Align right",
  justify: "Justify",
};

const ALIGN_ICONS: Readonly<Record<TextAlign, string>> = {
  left: "alignLeft",
  center: "alignCenter",
  right: "alignRight",
  justify: "alignJustify",
};

const ALIGN_SHORTCUTS: Readonly<Record<TextAlign, string>> = {
  left: "Ctrl+Shift+L",
  center: "Ctrl+Shift+E",
  right: "Ctrl+Shift+R",
  justify: "Ctrl+Shift+J",
};

const ALIGN_MENU_ICONS: Readonly<Record<TextAlign, ReactNode>> = {
  left: <AlignLeftIcon />,
  center: <AlignCenterIcon />,
  right: <AlignRightIcon />,
  justify: <AlignJustifyIcon />,
};

/**
 * Alignment as one dropdown, not four buttons.
 *
 * It began as a row of toggles, and the row was a real cost: three extra slots
 * of a toolbar that already overflows at 1280px, pushing genuinely singular
 * controls — Insert, Layout, an application's own actions — into the overflow
 * menu. Alignment is a choose-one-of-four, which is exactly the shape a menu
 * expresses in one slot; it is also the form Google Docs settled on. The
 * trigger's glyph mirrors the selection's current alignment, so the state the
 * four `aria-pressed` toggles used to show is still visible at a glance, and
 * `data-align` carries it for styling and tests.
 *
 * A mixed selection shows `left` and reports `data-align="none"` — a specific
 * glyph lighting up for a selection it does not entirely describe would lie.
 * The keyboard shortcuts (`Ctrl+Shift+L/E/R/J`) are unchanged and listed
 * beside each item.
 */
export function AlignmentControls(): ReactNode {
  const { state, dispatch } = useEditor();
  const current = textAlign(state);

  return (
    <ToolbarGroup label="Alignment">
      <DropdownMenu
        label="Alignment"
        items={TEXT_ALIGNMENTS.map((align) => ({
          id: align,
          label: ALIGN_LABELS[align],
          icon: ALIGN_MENU_ICONS[align],
          shortcut: ALIGN_SHORTCUTS[align],
          onSelect: () => {
            setTextAlign(align)(state, dispatch);
          },
        }))}
        trigger={
          <Tooltip label="Alignment">
            <ToolbarButton
              iconName={ALIGN_ICONS[current ?? "left"]}
              label="Alignment"
              data-align={current ?? "none"}
            />
          </Tooltip>
        }
      />
    </ToolbarGroup>
  );
}

/**
 * Increase and decrease indent.
 *
 * One command each, list-aware in the core: inside a list these nest and unnest
 * the item, everywhere else they change the block's indent attribute. The
 * buttons do not need to know which case applies.
 */
export function IndentControls(): ReactNode {
  return (
    <ToolbarGroup label="Indentation">
      <Tooltip label="Decrease indent (Ctrl+[)">
        <ToolbarButton command={outdent()} iconName="outdent" label="Decrease indent" />
      </Tooltip>
      <Tooltip label="Increase indent (Ctrl+])">
        <ToolbarButton command={indent()} iconName="indent" label="Increase indent" />
      </Tooltip>
    </ToolbarGroup>
  );
}

/** Clears marks *and* paragraph formatting — see the core `clearFormatting`. */
export function ClearFormattingButton(): ReactNode {
  return (
    <ToolbarGroup label="Clear">
      <Tooltip label="Clear formatting (Ctrl+\)">
        <ToolbarButton
          command={clearFormatting}
          iconName="clearFormatting"
          label="Clear formatting"
        />
      </Tooltip>
    </ToolbarGroup>
  );
}

/**
 * The `− 12 +` size stepper.
 *
 * The number is an editable field *and* the dropdown trigger, which is how
 * Google Docs and Word both behave: type an exact size, or click for the
 * preset ladder. Committing on blur and on Enter — and reverting on Escape —
 * is what stops a half-typed "1" from being applied as 1pt on the way to 18.
 */
export function FontSizeControl(): ReactNode {
  const { state, dispatch } = useEditor();
  const size = activeFontSize(state);
  // The draft remembers which size it was typed against. Comparing that during
  // render is what makes the field follow the document — move the cursor into
  // 24pt text and the readout updates — without an effect that resets state
  // *after* rendering the stale value once.
  const [draft, setDraft] = useState<{ value: string; forSize: number } | null>(null);
  const shown = draft !== null && draft.forSize === size ? draft.value : String(size);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    setDraft(null);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
    if (clamped !== size) {
      setFontSize(clamped)(state, dispatch);
    }
  };

  const [presetsOpen, setPresetsOpen] = useState(false);

  const presetItems = FONT_SIZE_PRESETS.map((preset) => ({
    id: String(preset),
    label: String(preset),
    onSelect: () => {
      setFontSize(preset)(state, dispatch);
    },
  }));

  return (
    <ToolbarGroup label="Font size">
      <Tooltip label="Decrease font size">
        <ToolbarButton command={adjustFontSize(-1)} iconName="remove" label="Decrease font size" />
      </Tooltip>

      {/* A plain span, not a button. Wrapping the input in a button gave the
          control two tab stops for one job; making that button `aria-hidden`
          instead would have been worse, since aria-hidden must never contain
          focusable content. So the field is the field, and opening the presets
          is its own control below. */}
      <span className="de-font-size__value">
        <input
          className="de-font-size__input"
          type="text"
          inputMode="numeric"
          aria-label="Font size in points"
          value={shown}
          onChange={(event) => {
            setDraft({ value: event.target.value, forSize: size });
          }}
          onBlur={(event) => {
            if (draft !== null) {
              commit(event.target.value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            } else if (event.key === "Escape") {
              setDraft(null);
            } else if (event.key === "ArrowDown") {
              // Opens the ladder from the field, as a combobox would.
              event.preventDefault();
              setPresetsOpen(true);
            }
          }}
        />
      </span>

      {/* A `ToolbarButton`, so it joins the toolbar's roving focus and costs no
          extra tab stop. */}
      <DropdownMenu
        label="Font size presets"
        items={presetItems}
        open={presetsOpen}
        onOpenChange={setPresetsOpen}
        trigger={
          <Tooltip label="Font size presets">
            <ToolbarButton iconName="chevronDown" label="Font size presets" />
          </Tooltip>
        }
      />

      <Tooltip label="Increase font size">
        <ToolbarButton command={adjustFontSize(1)} iconName="add" label="Increase font size" />
      </Tooltip>
    </ToolbarGroup>
  );
}
