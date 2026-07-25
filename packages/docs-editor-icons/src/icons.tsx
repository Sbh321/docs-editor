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

export function QuoteIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M6 7a3 3 0 0 0 0 6c0 2-1 3-3 3" />
      <path d="M15 7a3 3 0 0 0 0 6c0 2-1 3-3 3" />
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
