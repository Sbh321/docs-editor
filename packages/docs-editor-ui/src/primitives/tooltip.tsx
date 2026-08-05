import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset as offsetMiddleware,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useCallback, cloneElement, forwardRef, useState } from "react";

import { cn } from "../class-names";

import type { Placement } from "@floating-ui/react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";

export interface TooltipOwnProps {
  /** The tooltip text. Keep it short — a tooltip is a hint, not documentation. */
  readonly label: ReactNode;
  /** Where to place it relative to the trigger. Defaults to `"bottom"`. */
  readonly placement?: Placement;
  /** Milliseconds to wait before showing. Defaults to 400. */
  readonly delay?: number;
  readonly className?: string;
  /** The trigger. Must accept a ref and spread props onto a DOM element. */
  readonly children: ReactElement<Record<string, unknown>>;
}

/**
 * Any prop beyond {@link TooltipOwnProps} is forwarded to the trigger.
 *
 * This is what lets a tooltip wrap a control that is *itself* a floating
 * trigger — a dropdown's button, a popover's. Those components clone their
 * trigger to attach a ref and handlers, and without forwarding, the tooltip
 * would absorb them and the dropdown would simply never open. That was a real
 * regression when tooltips went across the toolbar in Phase 9, caught by the
 * insert-menu tests.
 *
 * Typed as real DOM attributes rather than `Record<string, unknown>`: an index
 * signature — however it is spelled — widens every declared prop to `unknown`,
 * and what a floating component actually forwards is handlers and ARIA.
 */
export type TooltipProps = TooltipOwnProps &
  Omit<HTMLAttributes<HTMLElement>, keyof TooltipOwnProps | "children">;

/**
 * A hover/focus hint attached to a control.
 *
 * **Never the only way to read a control.** A tooltip is unavailable to touch
 * users and easy to miss, so an icon-only button still needs an `aria-label`;
 * this adds a visible hint for pointer and keyboard users on top of that. It
 * uses `role="tooltip"` and `aria-describedby` rather than labelling the
 * trigger, so it supplements the name instead of replacing it.
 */
export const Tooltip = forwardRef<HTMLElement, TooltipProps>(function Tooltip(
  { label, placement = "bottom", delay = 400, className, children, ...rest },
  forwardedRef,
): ReactNode {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offsetMiddleware(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { move: false, delay: { open: delay, close: 0 } }),
    // Focus, so a keyboard user reaching the control sees the same hint —
    // `visibleOnly` keeps it from firing on a mouse click.
    useFocus(context, { visibleOnly: true }),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);

  // Ref *setters*, wrapped in callbacks so they are not read during render.
  // They are stable functions rather than ref reads, but the compiler's
  // "no ref access during render" rule cannot distinguish the two — the same
  // accommodation the headless floating components make.
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
      // Passed along, so a wrapping floating component still reaches the real
      // DOM node it needs to anchor to.
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [refs, forwardedRef],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  return (
    <>
      {/* `rest` last: props from an outer floating component (its ref callback,
          its click handler) must win over the child's own, and `getReferenceProps`
          merges the handlers rather than replacing them. */}
      {cloneElement(children, getReferenceProps({ ref: setReference, ...children.props, ...rest }))}
      {open && (
        <FloatingPortal>
          <div
            ref={setFloating}
            className={cn("de-tooltip", className)}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
});
