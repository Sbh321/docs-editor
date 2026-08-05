import { Icon } from "./icon";

import type { IconProps } from "./icon";
import type { ReactNode } from "react";

/**
 * The bundled icon glyphs. Each is a thin wrapper over {@link Icon}, so it
 * accepts the same {@link IconProps} (`size`, `title`, and any SVG prop) and
 * inherits the stroked, `currentColor`, `1em` defaults.
 */

export function BoldIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
      <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </Icon>
  );
}

export function ItalicIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="10" y1="5" x2="19" y2="5" />
      <line x1="5" y1="19" x2="14" y2="19" />
      <line x1="14" y1="5" x2="10" y2="19" />
    </Icon>
  );
}

export function UnderlineIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="5" y1="21" x2="19" y2="21" />
    </Icon>
  );
}

export function StrikethroughIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M16 5a5 5 0 0 0-4-2h-1a4 4 0 0 0-1.5 7.5" />
      <path d="M8 19a5 5 0 0 0 4 2h1a4 4 0 0 0 2-7.4" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Icon>
  );
}

export function CodeIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <polyline points="16 6 22 12 16 18" />
      <polyline points="8 6 2 12 8 18" />
    </Icon>
  );
}

export function ParagraphIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M13 4v16" />
      <path d="M17 4v16" />
      <path d="M17 4H9.5a4.5 4.5 0 0 0 0 9H13" />
    </Icon>
  );
}

function heading(digit: ReactNode): (props: IconProps) => ReactNode {
  return function HeadingIcon(props: IconProps): ReactNode {
    return (
      <Icon {...props}>
        <path d="M4 6v12" />
        <path d="M12 6v12" />
        <path d="M4 12h8" />
        {digit}
      </Icon>
    );
  };
}

export const Heading1Icon = heading(<path d="M17 10l2-1.2V18" />);
export const Heading2Icon = heading(<path d="M16.5 10.5a1.8 1.8 0 1 1 3.2 1.1L16.5 18h3.5" />);
export const Heading3Icon = heading(
  <path d="M16.5 10.5a1.8 1.8 0 1 1 2.7 1.6 1.8 1.8 0 0 1-1 3.4 1.9 1.9 0 0 1-2-1.2" />,
);

/**
 * Blockquote: a bar beside indented lines.
 *
 * Not the two curly quote marks it used to be. At 16px those collapsed into a
 * shape that reads as the letters "ss" — legible as *something*, just not as a
 * quote. The bar-and-lines form is what Word and Google Docs use for the same
 * command, and it survives the size.
 */
export function QuoteIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M4 5v14" strokeWidth="2.5" />
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="16" y2="17" />
    </Icon>
  );
}

export function BulletListIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </Icon>
  );
}

export function OrderedListIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <path d="M4 5.5 5.5 5v3.5" />
      <path d="M4 11.5h2l-2 3h2.2" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.7" />
      <path d="M14 11a4 4 0 0 0-5.7-.4l-2.6 2.6a4 4 0 0 0 5.7 5.7L13 17.3" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-4.5-4.5L7 21" />
    </Icon>
  );
}

export function DividerIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="3" y1="12" x2="21" y2="12" />
    </Icon>
  );
}

export function TableIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </Icon>
  );
}

export function UndoIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </Icon>
  );
}

export function RedoIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="m15 7 5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
    </Icon>
  );
}

export function OutlineIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="9" y1="6" x2="21" y2="6" />
      <line x1="13" y1="12" x2="21" y2="12" />
      <line x1="13" y1="18" x2="21" y2="18" />
      <path d="M4 5v4" />
      <path d="M4 12v4a2 2 0 0 0 2 2h2" />
      <path d="M4 12h4" />
    </Icon>
  );
}

/**
 * Page layout: a sheet with its content area inset by the margins.
 *
 * The inner frame is **solid**, though a dashed guide is the more literal way
 * to draw a margin. At the 16px a toolbar renders these, a dash pattern breaks
 * into speckle — and worse, the set's `round` line caps extend every dash by
 * half the stroke width at both ends, so a plausible dash/gap pair closes back
 * into a solid line anyway. Solid at least degrades honestly.
 */
export function PageLayoutIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <rect x="7.5" y="6" width="9" height="12" />
    </Icon>
  );
}

/* Alignment. Four ragged-line glyphs whose *ragged edge* is the message, so
   each is distinguishable at 16px without reading the lines individually. */
export function AlignLeftIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="14" y2="12" />
      <line x1="3" y1="18" x2="18" y2="18" />
    </Icon>
  );
}

export function AlignCenterIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </Icon>
  );
}

export function AlignRightIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="6" y1="18" x2="21" y2="18" />
    </Icon>
  );
}

export function AlignJustifyIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Icon>
  );
}

/* Indent / outdent: lines with an arrow showing which way the text moves. */
export function IndentIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <polyline points="3 8 6 12 3 16" />
    </Icon>
  );
}

export function OutdentIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <polyline points="6 8 3 12 6 16" />
    </Icon>
  );
}

/** A struck-through "A" — clear formatting. */
export function ClearFormattingIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M4 19L10 5l6 14" />
      <line x1="6.5" y1="14" x2="13.5" y2="14" />
      <line x1="15" y1="9" x2="21" y2="15" />
      <line x1="21" y1="9" x2="15" y2="15" />
    </Icon>
  );
}

/** A checklist: boxes rather than bullets. */
export function TaskListIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="5" height="5" rx="1" />
      <rect x="3" y="15" width="5" height="5" rx="1" />
      <line x1="11" y1="6.5" x2="21" y2="6.5" />
      <line x1="11" y1="17.5" x2="21" y2="17.5" />
      <polyline points="4 6.5 5.2 7.7 7 5.5" />
    </Icon>
  );
}

/** A broken chain — remove link. */
export function LinkOffIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M9 15l-1.5 1.5a3.5 3.5 0 0 1-5-5L4 10" />
      <path d="M15 9l1.5-1.5a3.5 3.5 0 0 0-5-5L10 4" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </Icon>
  );
}

/** Two glyphs at different sizes — the text-size control. */
export function FontSizeIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M2 18L7 6l5 12" />
      <line x1="3.6" y1="14" x2="10.4" y2="14" />
      <path d="M14 18l3.5-8 3.5 8" />
      <line x1="15.1" y1="15" x2="19.9" y2="15" />
    </Icon>
  );
}

/** A grip: the handle that drags a block. */
export function DragHandleIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </Icon>
  );
}

/** A marker pen over a stroke of highlight. */
export function HighlightIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M4 20h16" strokeWidth="3" />
      <path d="M8.5 15.5 5.5 16.5l1-3 8-8a2.1 2.1 0 0 1 3 3z" />
      <path d="m13.5 6.5 3 3" />
    </Icon>
  );
}

/**
 * Table operations. Each pairs the *shape* being acted on — a wide bar for a
 * row, a tall one for a column — with a plus or minus, so the pairs stay
 * distinguishable from each other at 16px where the grid detail is lost.
 */
export function AddRowIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="8" rx="1" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </Icon>
  );
}

export function AddColumnIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="18" rx="1" />
      <line x1="18" y1="9" x2="18" y2="15" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </Icon>
  );
}

export function DeleteRowIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="8" rx="1" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </Icon>
  );
}

export function DeleteColumnIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="18" rx="1" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </Icon>
  );
}

/** Two cells closing on each other. */
export function MergeCellsIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <polyline points="8.5 9 5.5 12 8.5 15" />
      <polyline points="15.5 9 18.5 12 15.5 15" />
    </Icon>
  );
}

/** A table whose first row is emphasised. */
export function HeaderRowIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18" strokeWidth="3" />
      <line x1="12" y1="9" x2="12" y2="20" />
    </Icon>
  );
}

/** A waste basket — deleting a table, removing media. */
export function TrashIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7 7.4 20a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1L17.5 7" />
      <line x1="10.5" y1="11" x2="10.5" y2="17" />
      <line x1="13.5" y1="11" x2="13.5" y2="17" />
    </Icon>
  );
}

/** A picture with description lines — alternative text. */
export function AltTextIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <circle cx="8" cy="7.5" r="1.2" />
      <path d="m21 12-4-4-6 6" />
      <line x1="3" y1="19" x2="15" y2="19" />
    </Icon>
  );
}

/** A tray with an arrow rising out of it — upload. */
export function UploadIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 9 12 4 17 9" />
      <line x1="12" y1="4" x2="12" y2="16" />
    </Icon>
  );
}

/** A page with a folded corner — the file menu. */
export function FileIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Icon>
  );
}

/** A printer. */
export function PrintIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

export function ZoomInIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </Icon>
  );
}

export function ZoomOutIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </Icon>
  );
}
