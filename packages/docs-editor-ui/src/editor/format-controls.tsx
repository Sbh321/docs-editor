import {
  activeList,
  listStylesFor,
  setBlockType,
  setListStyle,
  setMark,
  toggleList,
  toggleMark,
} from "@sbh321/docs-editor-core";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_TEXT_COLOR,
} from "@sbh321/docs-editor-core/preset";
import {
  ToolbarButton,
  ToolbarGroup,
  useActiveBlockType,
  useActiveMarks,
  useEditor,
  useIsMarkActive,
} from "@sbh321/docs-editor-react";

import { DropdownMenu } from "../primitives/dropdown-menu";
import { Select } from "../primitives/select";
import { Tooltip } from "../primitives/tooltip";

import type { SelectOption } from "../primitives/select";
import type { ReactNode } from "react";

/**
 * Formatting controls (ROADMAP Phase 8, Milestone 8.4).
 *
 * Every one delegates to a **core command** — this layer decides what a control
 * looks like and where it sits, never what bold means. That is the Phase 4 rule
 * that keeps editing behaviour in one place and testable without a browser.
 */

/** A mark toggle wired to its active state. */
function MarkButton(props: {
  readonly mark: string;
  /** A theme icon intent. Omit for a mark the default icon set has none for. */
  readonly iconName?: string;
  readonly label: string;
}): ReactNode {
  return (
    <ToolbarButton
      command={toggleMark(props.mark)}
      active={useIsMarkActive(props.mark)}
      {...(props.iconName === undefined ? {} : { iconName: props.iconName })}
      label={props.label}
    />
  );
}

/** The bold/italic/underline/strikethrough/code/highlight group. */
export function TextFormatControls(): ReactNode {
  return (
    <ToolbarGroup label="Text formatting">
      {/* Shortcut hints in the tooltip: a keyboard user should not have to read
          documentation to discover the binding for a control they are pointing
          at. */}
      <Tooltip label="Bold (Ctrl+B)">
        <MarkButton mark="bold" iconName="bold" label="Bold" />
      </Tooltip>
      <Tooltip label="Italic (Ctrl+I)">
        <MarkButton mark="italic" iconName="italic" label="Italic" />
      </Tooltip>
      <Tooltip label="Underline (Ctrl+U)">
        <MarkButton mark="underline" iconName="underline" label="Underline" />
      </Tooltip>
      <Tooltip label="Strikethrough (Ctrl+Shift+X)">
        <MarkButton mark="strikethrough" iconName="strikethrough" label="Strikethrough" />
      </Tooltip>
      <Tooltip label="Inline code (Ctrl+E)">
        <MarkButton mark="code" iconName="code" label="Inline code" />
      </Tooltip>
      <Tooltip label="Highlight (Ctrl+Shift+H)">
        <MarkButton mark="highlight" iconName="highlight" label="Highlight" />
      </Tooltip>
    </ToolbarGroup>
  );
}

const HEADING_OPTIONS: readonly SelectOption[] = [
  { value: "paragraph", label: "Normal text" },
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
  { value: "4", label: "Heading 4" },
  { value: "5", label: "Heading 5" },
  { value: "6", label: "Heading 6" },
];

/** Switches the block under the cursor between paragraph and heading levels. */
export function BlockTypeSelect(): ReactNode {
  const { state, dispatch } = useEditor();
  // The active block carries its attributes, so the control reflects the
  // document rather than the last thing that was clicked — and no position
  // arithmetic is needed here to find it.
  const block = useActiveBlockType();
  const current =
    block.type === "heading" && typeof block.attrs.level === "number"
      ? String(block.attrs.level)
      : "paragraph";

  return (
    <Select
      aria-label="Block type"
      className="de-block-select"
      options={HEADING_OPTIONS}
      value={current}
      onValueChange={(value) => {
        if (value === "paragraph") {
          setBlockType("paragraph")(state, dispatch);
        } else {
          setBlockType("heading", { level: Number(value) })(state, dispatch);
        }
      }}
    />
  );
}

/**
 * Web-safe families with fallback stacks, so a document renders the same
 * everywhere without shipping a font.
 */
export const FONT_FAMILIES: readonly { readonly label: string; readonly value: string }[] = [
  { label: "Arial", value: DEFAULT_FONT_FAMILY },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
  { label: "Palatino", value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: "Lucida Console", value: '"Lucida Console", Monaco, monospace' },
];

/** Sets the font family of the selection. */
export function FontFamilySelect(): ReactNode {
  const { state, dispatch } = useEditor();
  const active = useActiveMarks();
  const family = active.find((mark) => mark.type === "font_family")?.attrs.family;
  const current = typeof family === "string" ? family : DEFAULT_FONT_FAMILY;

  return (
    <Select
      aria-label="Font"
      className="de-font-select"
      // Each option previews its own face. With the native select this worked on
      // some platforms and not others; a listbox renders it everywhere, which
      // was one of the reasons for the change.
      options={FONT_FAMILIES.map((font) => ({
        value: font.value,
        label: font.label,
        style: { fontFamily: font.value },
      }))}
      value={current}
      onValueChange={(family) => {
        setMark("font_family", { family })(state, dispatch);
      }}
    />
  );
}

/** Text and highlight colour pickers. */
export function ColorControls(): ReactNode {
  const { state, dispatch } = useEditor();
  const active = useActiveMarks();

  const colorOf = (type: string, key: string, fallback: string) => {
    const value = active.find((mark) => mark.type === type)?.attrs[key];
    return typeof value === "string" ? value : fallback;
  };

  return (
    <ToolbarGroup label="Colour">
      {/* The styled tooltip, not the native `title`: `title` renders in the
          OS style after its own fixed delay, so the colour pickers were the
          two controls whose hints matched neither theme nor timing. */}
      <Tooltip label="Text colour">
        <label className="de-color">
          <span
            className="de-color__swatch"
            style={{ background: colorOf("text_color", "color", DEFAULT_TEXT_COLOR) }}
          />
          <input
            type="color"
            aria-label="Text colour"
            value={colorOf("text_color", "color", DEFAULT_TEXT_COLOR)}
            onChange={(event) => {
              setMark("text_color", { color: event.target.value })(state, dispatch);
            }}
          />
        </label>
      </Tooltip>
      <Tooltip label="Highlight colour">
        <label className="de-color">
          <span
            className="de-color__swatch"
            style={{ background: colorOf("highlight", "color", DEFAULT_HIGHLIGHT_COLOR) }}
          />
          <input
            type="color"
            aria-label="Highlight colour"
            value={colorOf("highlight", "color", DEFAULT_HIGHLIGHT_COLOR)}
            onChange={(event) => {
              setMark("highlight", { color: event.target.value })(state, dispatch);
            }}
          />
        </label>
      </Tooltip>
    </ToolbarGroup>
  );
}

/** The list types offered, with the marker styles each one allows. */
const LIST_KINDS = [
  { type: "bullet_list", icon: "bulletList", label: "Bullet list", shortcut: "Ctrl+Shift+8" },
  { type: "ordered_list", icon: "orderedList", label: "Numbered list", shortcut: "Ctrl+Shift+7" },
  { type: "task_list", icon: "taskList", label: "Checklist", shortcut: "Ctrl+Shift+9" },
] as const;

const STYLE_LABELS: Readonly<Record<string, string>> = {
  disc: "Filled circle",
  circle: "Hollow circle",
  square: "Square",
  decimal: "1, 2, 3",
  "lower-alpha": "a, b, c",
  "upper-alpha": "A, B, C",
  "lower-roman": "i, ii, iii",
  "upper-roman": "I, II, III",
};

/**
 * List controls (expanded in ROADMAP Phase 9, Milestone 9.6).
 *
 * Three toggles rather than the previous two `wrapInList` buttons, plus a
 * marker-style menu. The change that matters is `toggleList`: these now
 * *convert* between list kinds and leave a list when pressed again, where
 * `wrapInList` could only ever wrap — so pressing "numbered" inside a bullet
 * list used to nest a second list inside the first.
 */
export function ListControls(): ReactNode {
  const { state, dispatch } = useEditor();
  const current = activeList(state);
  const styles = current === null ? [] : listStylesFor(current.type);

  return (
    <ToolbarGroup label="Lists">
      {LIST_KINDS.map((kind) => (
        <Tooltip key={kind.type} label={`${kind.label} (${kind.shortcut})`}>
          <ToolbarButton
            command={toggleList(kind.type)}
            active={current?.type === kind.type}
            iconName={kind.icon}
            label={kind.label}
          />
        </Tooltip>
      ))}

      {/* Only where it applies: a marker-style menu outside a list would be a
          permanently-disabled control taking up toolbar width. */}
      {styles.length > 0 && (
        <DropdownMenu
          label="List style"
          items={[
            {
              id: "__default__",
              label: "Default",
              onSelect: () => {
                setListStyle(null)(state, dispatch);
              },
            },
            ...styles.map((style) => ({
              id: style,
              label: STYLE_LABELS[style] ?? style,
              onSelect: () => {
                setListStyle(style)(state, dispatch);
              },
            })),
          ]}
          trigger={
            <Tooltip label="List style">
              <ToolbarButton iconName="chevronDown" label="List style" />
            </Tooltip>
          }
        />
      )}
    </ToolbarGroup>
  );
}
