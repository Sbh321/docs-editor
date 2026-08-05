import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset as offsetMiddleware,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { useCallback, cloneElement, useRef, useState } from "react";

import { cn } from "../class-names";

import type { Placement } from "@floating-ui/react";
import type { ReactElement, ReactNode } from "react";

/** One entry in a {@link DropdownMenu}. */
export interface DropdownMenuItem {
  /** Stable identity, also used as the React key. */
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  /** Right-aligned hint, for a keyboard shortcut. */
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** Renders in the destructive colour — for delete and similar. */
  readonly destructive?: boolean;
  readonly onSelect: () => void;
}

export interface DropdownMenuProps {
  readonly trigger: ReactElement<Record<string, unknown>>;
  readonly items: readonly DropdownMenuItem[];
  readonly placement?: Placement;
  readonly label?: string;
  readonly className?: string;
  /**
   * Controlled open state. Omit to let the menu manage its own — matching
   * `Popover`, so a caller that needs to open a menu from somewhere other than
   * its trigger (a keystroke in an adjacent field) can.
   */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * A menu of actions anchored to a trigger.
 *
 * Arrow keys move between items, Home/End jump to the ends, Escape closes and
 * returns focus to the trigger. Those are the behaviours that make a menu a
 * menu rather than a styled list, so they are built in rather than left to the
 * caller.
 *
 * A disabled item stays focusable so a screen-reader user can discover that it
 * exists and is unavailable — skipping it entirely hides the option and the
 * reason it is off.
 */
export function DropdownMenu({
  trigger,
  items,
  placement = "bottom-start",
  label,
  className,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps): ReactNode {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offsetMiddleware(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "menu" }),
    useListNavigation(context, {
      listRef: itemRefs,
      activeIndex,
      onNavigate: setActiveIndex,
      loop: true,
    }),
  ]);

  // Ref *setters*, wrapped in callbacks so they are not read during render.
  // They are stable functions rather than ref reads, but the compiler's
  // "no ref access during render" rule cannot distinguish the two — the same
  // accommodation the headless floating components make.
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  return (
    <>
      {cloneElement(trigger, getReferenceProps({ ref: setReference, ...trigger.props }))}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={setFloating}
              className={cn("de-menu", className)}
              style={floatingStyles}
              {...(label !== undefined ? { "aria-label": label } : {})}
              {...getFloatingProps()}
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "de-menu__item",
                    item.destructive && "de-menu__item--destructive",
                    item.disabled && "de-menu__item--disabled",
                  )}
                  // `aria-disabled` rather than `disabled`: the item stays
                  // reachable so it can be discovered and announced.
                  aria-disabled={item.disabled ?? false}
                  tabIndex={activeIndex === index ? 0 : -1}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  {...getItemProps({
                    onClick: () => {
                      if (item.disabled) {
                        return;
                      }
                      item.onSelect();
                      setOpen(false);
                    },
                  })}
                >
                  {item.icon !== undefined && (
                    <span className="de-menu__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="de-menu__label">{item.label}</span>
                  {item.shortcut !== undefined && (
                    <span className="de-menu__shortcut">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
