import { createContext } from "react";

import type {
  PageLayout,
  PageMargins,
  PageOrientation,
  PageSizeName,
  ResolvedPageDimensions,
} from "@sbh321/docs-editor-core";

/**
 * Page layout is transient view state — how the document is displayed and
 * printed, not what it contains — so it belongs to the adapter, not the
 * document model (per ARCHITECTURE.md's State Architecture), exactly like zoom.
 * This context carries the current layout and the controls to change it.
 */
export interface PageLayoutContextValue {
  /** The current page layout. */
  readonly layout: PageLayout;
  /** The current page's outer dimensions, with orientation applied. */
  readonly dimensions: ResolvedPageDimensions;
  /** Replaces the whole layout. */
  readonly setLayout: (layout: PageLayout) => void;
  readonly setSize: (size: PageSizeName) => void;
  readonly setOrientation: (orientation: PageOrientation) => void;
  readonly setMargins: (margins: PageMargins) => void;
  readonly setHeader: (header: string) => void;
  readonly setFooter: (footer: string) => void;
  readonly setShowPageNumbers: (show: boolean) => void;
}

export const PageLayoutContext = createContext<PageLayoutContextValue | null>(null);
