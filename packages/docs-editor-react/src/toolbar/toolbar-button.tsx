import { forwardRef, useCallback, useContext, useEffect, useId, useRef } from "react";

import { useThemeClassName, useThemeIcon } from "../theme/use-theme";
import { useCommand } from "../use-command";

import { ToolbarContext } from "./toolbar-context";

import type { Command } from "@sbh321/docs-editor-core";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export interface ToolbarButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed"
> {
  /**
   * The command this button runs. When set, the button's `disabled` state and
   * click handler are wired automatically (from a dry run and `useCommand`);
   * pass a plain `onClick` instead for non-command actions.
   */
  readonly command?: Command;
  /**
   * Whether the button's action is currently applied — rendered as
   * `aria-pressed`, marking this a toggle button. Drive it from
   * `useIsMarkActive`/`useIsBlockActive`. Omit for one-shot actions (undo,
   * insert), which aren't toggles.
   */
  readonly active?: boolean;
  /** An icon node to render before `children`. Takes precedence over `iconName`. */
  readonly icon?: ReactNode;
  /** A theme icon intent to resolve (e.g. `"bold"`), used when `icon` is absent. */
  readonly iconName?: string;
  /** An accessible name — essential for icon-only buttons (sets `aria-label`). */
  readonly label?: string;
}

const NOOP_COMMAND: Command = () => false;

/**
 * A headless toolbar button. Given a `command`, it wires its own enabled state
 * and click handler; given `active`, it becomes an ARIA toggle button. Icons
 * come from `icon` or a theme `iconName`; text comes from `children`. Applies
 * `"toolbarButton"` / `"toolbarButtonActive"` theme classes on top of any
 * `className`. Must be used within an `EditorProvider`.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(props, forwardedRef): ReactNode {
    const {
      command,
      active,
      icon,
      iconName,
      label,
      className,
      children,
      onClick,
      onFocus,
      disabled,
      type,
      ...rest
    } = props;

    const toolbar = useContext(ToolbarContext);
    const id = useId();
    const innerRef = useRef<HTMLButtonElement>(null);

    const hasCommand = command != null;
    const { run, enabled } = useCommand(command ?? NOOP_COMMAND);

    const buttonClassName = useThemeClassName("toolbarButton");
    const activeClassName = useThemeClassName("toolbarButtonActive");
    const themeIcon = useThemeIcon(iconName);

    // Depend on the stable `register` callback, not the whole `toolbar` context
    // value — the latter changes identity on every roving-focus update, which
    // would re-run this effect (and its register/unregister) in a loop.
    const register = toolbar?.register;
    const onItemFocus = toolbar?.onItemFocus;
    useEffect(() => {
      if (!register) {
        return undefined;
      }
      return register(id, innerRef);
    }, [register, id]);

    const setRef = useCallback(
      (node: HTMLButtonElement | null) => {
        innerRef.current = node;
        assignRef(forwardedRef, node);
      },
      [forwardedRef],
    );

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && hasCommand) {
          run();
        }
      },
      [onClick, hasCommand, run],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLButtonElement>) => {
        onFocus?.(event);
        onItemFocus?.(id);
      },
      [onFocus, onItemFocus, id],
    );

    const resolvedDisabled = disabled ?? (hasCommand ? !enabled : false);
    const resolvedIcon = icon ?? themeIcon;
    const combinedClassName =
      [buttonClassName, active ? activeClassName : undefined, className]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <button
        ref={setRef}
        type={type ?? "button"}
        disabled={resolvedDisabled}
        className={combinedClassName}
        onClick={handleClick}
        onFocus={handleFocus}
        {...(active !== undefined ? { "aria-pressed": active } : {})}
        {...(label !== undefined ? { "aria-label": label } : {})}
        {...(toolbar ? { tabIndex: toolbar.tabIndexFor(id) } : {})}
        {...rest}
      >
        {resolvedIcon}
        {children}
      </button>
    );
  },
);

/** Assigns a value to a callback or object ref, tolerating `null`/`undefined`. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as { current: T | null }).current = value;
  }
}
