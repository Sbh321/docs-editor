import {
  BoldIcon,
  BulletListIcon,
  ChevronDownIcon,
  CodeIcon,
  DividerIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  MinusIcon,
  OrderedListIcon,
  OutlineIcon,
  ParagraphIcon,
  PlusIcon,
  QuoteIcon,
  RedoIcon,
  SearchIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";

import type { IconProps } from "./icon";
import type { ReactNode } from "react";

/**
 * The semantic action names {@link defaultIcons} provides a glyph for. These
 * are editor *intents*, not glyph names, so a theme can swap the artwork
 * (`link` might render a chain or a globe) without callers changing which key
 * they look up.
 */
export type DocsEditorIconName =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "link"
  | "image"
  | "divider"
  | "table"
  | "undo"
  | "redo"
  | "search"
  | "outline"
  | "chevronDown"
  | "add"
  | "remove"
  | "zoomIn"
  | "zoomOut";

/**
 * Maps each editor {@link DocsEditorIconName intent} to a bundled icon
 * component. Pass it (whole or in part) to `docs-editor-react`'s
 * `ThemeProvider` so headless UI components can look icons up by intent:
 *
 * ```tsx
 * import { defaultIcons } from "@sbh321/docs-editor-icons";
 *
 * <ThemeProvider icons={defaultIcons}>…</ThemeProvider>
 * ```
 *
 * Entirely optional — the components stay headless and render text-only
 * without it — and overridable per key to mix in your own artwork.
 */
export const defaultIcons: Record<DocsEditorIconName, (props: IconProps) => ReactNode> = {
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strikethrough: StrikethroughIcon,
  code: CodeIcon,
  paragraph: ParagraphIcon,
  heading1: Heading1Icon,
  heading2: Heading2Icon,
  heading3: Heading3Icon,
  quote: QuoteIcon,
  bulletList: BulletListIcon,
  orderedList: OrderedListIcon,
  link: LinkIcon,
  image: ImageIcon,
  divider: DividerIcon,
  table: TableIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  search: SearchIcon,
  outline: OutlineIcon,
  chevronDown: ChevronDownIcon,
  add: PlusIcon,
  remove: MinusIcon,
  zoomIn: ZoomInIcon,
  zoomOut: ZoomOutIcon,
};
