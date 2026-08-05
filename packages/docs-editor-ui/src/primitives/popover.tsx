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
  useRole,
} from "@floating-ui/react";
import { useCallback, cloneElement, useState } from "react";

import { cn } from "../class-names";

import type { Placement } from "@floating-ui/react";
import type { ReactElement, ReactNode } from "react";

export interface PopoverProps {
  /** The trigger. Must accept a ref and spread props onto a DOM element. */
  readonly trigger: ReactElement<Record<string, unknown>>;
  readonly placement?: Placement;
  /** Controlled open state. Omit to let the popover manage its own. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Accessible name for the panel, since a popover is a labelled region. */
  readonly label?: string;
  readonly className?: string;
  /** Panel content. Receives a `close` function for a confirm-style action. */
  readonly children: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * A panel anchored to a trigger, for controls too large for a toolbar — a
 * colour picker, a media size form.
 *
 * Focus moves into the panel on open and returns to the trigger on close, which
 * is what makes it usable by keyboard: a panel you can open but not reach is
 * worse than no panel. Escape and an outside click both dismiss it.
 */
export function Popover({
  trigger,
  placement = "bottom-start",
  open: controlledOpen,
  onOpenChange,
  label,
  className,
  children,
}: PopoverProps): ReactNode {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offsetMiddleware(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  const close = () => {
    setOpen(false);
  };

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
          {/* Not modal: the document behind stays readable and interactive,
              which is the difference between a popover and a dialog. */}
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={setFloating}
              className={cn("de-popover", className)}
              style={floatingStyles}
              {...(label !== undefined ? { "aria-label": label } : {})}
              {...getFloatingProps()}
            >
              {typeof children === "function" ? children(close) : children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
