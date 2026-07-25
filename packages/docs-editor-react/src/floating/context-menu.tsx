import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset as offsetMiddleware,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useThemeClassName, useThemeIcon } from "../theme/use-theme";
import { useCommand } from "../use-command";
import { useEditorView } from "../use-editor-view";

import { pointRect } from "./selection-rect";

import type { Command } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

interface ContextMenuControl {
  readonly close: () => void;
}

const ContextMenuControlContext = createContext<ContextMenuControl | null>(null);

export interface ContextMenuProps {
  /** The menu contents — `ContextMenuItem`s and/or your own `role="menuitem"` elements. */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  /**
   * Restricts where a right-click opens the menu. Return `false` to let the
   * browser's native menu through (e.g. over an image). Defaults to always.
   */
  readonly shouldOpen?: (event: MouseEvent) => boolean;
}

/**
 * A right-click context menu anchored at the pointer over the editor. Opens on
 * `contextmenu` within the mounted `<Editor />`, traps focus, closes on
 * Escape / outside click / selection, and supports arrow-key navigation.
 * Headless: it owns the menu behavior; you provide the items.
 */
export function ContextMenu(props: ContextMenuProps): ReactNode {
  const { children, className, style, shouldOpen } = props;
  const view = useEditorView();
  const themeClassName = useThemeClassName("contextMenu");

  const [open, setOpen] = useState(false);
  const pointRef = useRef({ x: 0, y: 0 });

  const {
    refs: floatingRefs,
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "right-start",
    middleware: [offsetMiddleware(2), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  useEffect(() => {
    const dom = view?.dom;
    if (!dom) {
      return undefined;
    }
    const handleContextMenu = (event: MouseEvent): void => {
      if (shouldOpen && !shouldOpen(event)) {
        return;
      }
      event.preventDefault();
      pointRef.current = { x: event.clientX, y: event.clientY };
      floatingRefs.setPositionReference({
        getBoundingClientRect: () => pointRect(event.clientX, event.clientY),
      });
      setOpen(true);
    };
    dom.addEventListener("contextmenu", handleContextMenu);
    return () => dom.removeEventListener("contextmenu", handleContextMenu);
  }, [view, floatingRefs, shouldOpen]);

  const close = useCallback(() => setOpen(false), []);

  // See FloatingToolbar: wrap the ref setter so the member access happens in a
  // callback, not during render (the compiler's ref rule flags the latter).
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => floatingRefs.setFloating(node),
    [floatingRefs],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
    if (items.length === 0) {
      return;
    }
    const activeIndex = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") {
      next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      next = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  }, []);

  if (!open) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} initialFocus={0}>
        <div
          ref={setFloating}
          role="menu"
          tabIndex={-1}
          className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
          style={{ ...floatingStyles, ...style }}
          onKeyDown={handleKeyDown}
          {...getFloatingProps()}
        >
          <ContextMenuControlContext.Provider value={{ close }}>
            {children}
          </ContextMenuControlContext.Provider>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}

export interface ContextMenuItemProps {
  /** The command run when chosen. When set, drives `disabled` from a dry run. */
  readonly command?: Command;
  /** Called when chosen, after any `command`. Use for non-command actions. */
  readonly onSelect?: () => void;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly iconName?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

/**
 * A single `role="menuitem"` inside a `ContextMenu`. Runs an optional
 * `command` (and/or `onSelect`), then closes the menu. Keyboard-focusable and
 * arrow-navigable via its parent menu.
 */
export function ContextMenuItem(props: ContextMenuItemProps): ReactNode {
  const { command, onSelect, disabled, icon, iconName, className, children } = props;
  const control = useContext(ContextMenuControlContext);
  const itemClassName = useThemeClassName("contextMenuItem");
  const themeIcon = useThemeIcon(iconName);
  const { run, enabled } = useCommand(command ?? (() => false));

  const hasCommand = command != null;
  const resolvedDisabled = disabled ?? (hasCommand ? !enabled : false);

  const handleSelect = useCallback(() => {
    if (resolvedDisabled) {
      return;
    }
    if (hasCommand) {
      run();
    }
    onSelect?.();
    control?.close();
  }, [resolvedDisabled, hasCommand, run, onSelect, control]);

  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={resolvedDisabled}
      disabled={resolvedDisabled}
      className={[itemClassName, className].filter(Boolean).join(" ") || undefined}
      onClick={handleSelect}
    >
      {icon ?? themeIcon}
      {children}
    </button>
  );
}
