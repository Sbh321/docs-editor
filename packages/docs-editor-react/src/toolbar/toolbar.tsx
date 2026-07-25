import { useCallback, useMemo, useReducer, useRef } from "react";

import { useThemeClassName } from "../theme/use-theme";

import { ToolbarContext } from "./toolbar-context";

import type { ToolbarContextValue, ToolbarOrientation } from "./toolbar-context";
import type { HTMLAttributes, ReactNode, RefObject } from "react";

export interface ToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Arrow-key direction and ARIA orientation. Defaults to `"horizontal"`. */
  readonly orientation?: ToolbarOrientation;
  /** An accessible name for the toolbar (sets `aria-label`). */
  readonly label?: string;
  readonly children?: ReactNode;
}

interface RegisteredItem {
  readonly id: string;
  readonly ref: RefObject<HTMLElement | null>;
}

/**
 * A headless toolbar container: `role="toolbar"` with roving-tabindex keyboard
 * navigation (arrow keys move between buttons, Home/End jump to the ends), so
 * the whole group is a single tab stop. Renders an unstyled `<div>` — pass a
 * `className` or set a `"toolbar"` theme class; nothing here forces a look.
 *
 * Compose it with `ToolbarButton`, `ToolbarGroup`, and `ToolbarSeparator`.
 */
export function Toolbar(props: ToolbarProps): ReactNode {
  const { orientation = "horizontal", label, className, children, onKeyDown, ...rest } = props;
  const themeClassName = useThemeClassName("toolbar");

  // Insertion-ordered registry of focusable buttons. A ref (not state) holds
  // it so registration doesn't rerender; a version counter forces the
  // rerender needed to recompute tab stops when the set or current stop
  // changes.
  const itemsRef = useRef<RegisteredItem[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const [version, bumpVersion] = useReducer((current: number) => current + 1, 0);

  const register = useCallback<ToolbarContextValue["register"]>((id, ref) => {
    itemsRef.current = [...itemsRef.current, { id, ref }];
    bumpVersion();
    return () => {
      itemsRef.current = itemsRef.current.filter((item) => item.id !== id);
      if (currentIdRef.current === id) {
        currentIdRef.current = null;
      }
      bumpVersion();
    };
  }, []);

  const tabIndexFor = useCallback<ToolbarContextValue["tabIndexFor"]>((id) => {
    const current = currentIdRef.current ?? itemsRef.current[0]?.id ?? null;
    return id === current ? 0 : -1;
  }, []);

  const onItemFocus = useCallback<ToolbarContextValue["onItemFocus"]>((id) => {
    if (currentIdRef.current !== id) {
      currentIdRef.current = id;
      bumpVersion();
    }
  }, []);

  // `version` is deliberately in the dependency list so the context value
  // changes identity whenever the item set or current tab stop changes,
  // prompting the buttons to recompute their `tabIndex` — they'd otherwise
  // never see registration or focus moves, since the callbacks are stable.
  const contextValue = useMemo<ToolbarContextValue>(
    () => ({ orientation, register, tabIndexFor, onItemFocus }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above.
    [orientation, register, tabIndexFor, onItemFocus, version],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

      const items = itemsRef.current;
      if (items.length === 0) {
        return;
      }
      const activeIndex = items.findIndex((item) => item.ref.current === document.activeElement);

      let targetIndex: number | null = null;
      if (event.key === nextKey) {
        targetIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      } else if (event.key === prevKey) {
        targetIndex =
          activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = items.length - 1;
      }

      if (targetIndex !== null) {
        event.preventDefault();
        const target = items[targetIndex];
        target?.ref.current?.focus();
      }
    },
    [orientation, onKeyDown],
  );

  return (
    <ToolbarContext.Provider value={contextValue}>
      <div
        role="toolbar"
        aria-orientation={orientation}
        {...(label !== undefined ? { "aria-label": label } : {})}
        className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
}
