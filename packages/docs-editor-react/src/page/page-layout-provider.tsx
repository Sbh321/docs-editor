import { defaultPageLayout, resolvePageDimensions } from "@sbh321/docs-editor-core";
import { useCallback, useMemo, useState } from "react";

import { PageLayoutContext } from "./page-layout-context";

import type { PageLayoutContextValue } from "./page-layout-context";
import type {
  PageLayout,
  PageMargins,
  PageOrientation,
  PageSizeName,
} from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

export interface PageLayoutProviderProps {
  /** Initial page layout. Defaults to `defaultPageLayout` (A4 portrait, normal margins). */
  readonly initialLayout?: PageLayout;
  readonly children?: ReactNode;
}

/**
 * Holds page layout state for the setup controls, the page surface, and print
 * export below it — transient view state, kept out of the document model (the
 * same design as `ZoomProvider`).
 */
export function PageLayoutProvider(props: PageLayoutProviderProps): ReactNode {
  const [layout, setLayout] = useState<PageLayout>(props.initialLayout ?? defaultPageLayout);

  const setSize = useCallback((size: PageSizeName) => {
    setLayout((current) => ({ ...current, size }));
  }, []);
  const setOrientation = useCallback((orientation: PageOrientation) => {
    setLayout((current) => ({ ...current, orientation }));
  }, []);
  const setMargins = useCallback((margins: PageMargins) => {
    setLayout((current) => ({ ...current, margins }));
  }, []);
  const setHeader = useCallback((header: string) => {
    setLayout((current) => ({ ...current, header }));
  }, []);
  const setFooter = useCallback((footer: string) => {
    setLayout((current) => ({ ...current, footer }));
  }, []);
  const setShowPageNumbers = useCallback((showPageNumbers: boolean) => {
    setLayout((current) => ({ ...current, showPageNumbers }));
  }, []);

  const value = useMemo<PageLayoutContextValue>(
    () => ({
      layout,
      dimensions: resolvePageDimensions(layout.size, layout.orientation),
      setLayout,
      setSize,
      setOrientation,
      setMargins,
      setHeader,
      setFooter,
      setShowPageNumbers,
    }),
    [layout, setSize, setOrientation, setMargins, setHeader, setFooter, setShowPageNumbers],
  );

  return <PageLayoutContext.Provider value={value}>{props.children}</PageLayoutContext.Provider>;
}
