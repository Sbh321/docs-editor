import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useCallback, useId } from "react";

import { cn } from "../class-names";

import { Button } from "./button";

import type { ReactNode } from "react";

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  /** Supporting text, associated as the dialog's description. */
  readonly description?: ReactNode;
  /** Footer actions, laid out end-aligned. */
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
}

/**
 * A modal dialog.
 *
 * Modal in the real sense: focus is trapped inside it, the content behind is
 * hidden from assistive technology, and Escape or a backdrop click closes it.
 * A "dialog" without a focus trap is a box that a keyboard user tabs straight
 * out of and then cannot find their way back into.
 *
 * Always controlled — an application usually needs to know a dialog is open
 * (to block navigation, to warn about unsaved work), and a self-managing
 * dialog hides that.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: DialogProps): ReactNode {
  const titleId = useId();
  const descriptionId = useId();

  const { refs, context } = useFloating({
    open,
    // Wrapped, not passed straight through: the positioning library calls this
    // with `(open, event, reason)`, and letting those extra arguments reach a
    // consumer's handler would leak the dependency into our public API.
    onOpenChange: (next) => {
      onOpenChange(next);
    },
  });
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePressEvent: "mousedown" }),
    useRole(context, { role: "dialog" }),
  ]);

  // A ref *setter*, wrapped so it is not read during render — see the headless
  // floating components for the same accommodation.
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  if (!open) {
    return null;
  }

  return (
    <FloatingPortal>
      {/* `lockScroll` stops the document behind scrolling under the dialog,
          which otherwise looks like the dialog itself is scrolling. */}
      <FloatingOverlay className="de-dialog__overlay" lockScroll>
        <FloatingFocusManager context={context} modal>
          <div
            ref={setFloating}
            className={cn("de-dialog", className)}
            aria-labelledby={titleId}
            {...(description !== undefined ? { "aria-describedby": descriptionId } : {})}
            {...getFloatingProps()}
          >
            <header className="de-dialog__header">
              <h2 className="de-dialog__title" id={titleId}>
                {title}
              </h2>
              <Button
                size="icon-sm"
                aria-label="Close"
                onClick={() => {
                  onOpenChange(false);
                }}
                icon={
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor">
                    <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />
            </header>
            {description !== undefined && (
              <p className="de-dialog__description" id={descriptionId}>
                {description}
              </p>
            )}
            <div className="de-dialog__body">{children}</div>
            {footer !== undefined && <footer className="de-dialog__footer">{footer}</footer>}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}
