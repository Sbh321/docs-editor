import { forwardRef } from "react";

import { cn } from "../class-names";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Visual weight, not behaviour (ROADMAP Phase 8, Milestone 8.3).
 *
 * `ghost` is the default because a document editor's chrome is mostly
 * transparent tools sitting over the page — a toolbar of filled buttons would
 * compete with the document for attention.
 *
 * The set reads as a weight ladder rather than a naming scheme:
 *
 * | Variant | Weight | Use |
 * | --- | --- | --- |
 * | `primary` | filled, accent | the one action a surface is for |
 * | `secondary` | filled, muted | a supporting action beside it |
 * | `outline` | bordered | equal-weight choices in a row |
 * | `ghost` | bare | dense chrome — toolbars, icon rows |
 * | `destructive` | filled, red | deletes and other irreversible actions |
 *
 * `secondary` was added in Phase 9. `ghost` and `outline` already covered the
 * two quietest weights — what was missing was a *filled* button that is not the
 * primary one, for a dialog with two committing actions. Renaming the existing
 * variants to `primary`/`secondary`/`tertiary` was considered and rejected: it
 * would break every consumer to fix vocabulary, with no behaviour gained.
 */
export type ButtonVariant = "ghost" | "outline" | "primary" | "secondary" | "destructive";

/**
 * `icon` is square and sized to the icon rather than the text, so a row of
 * icon-only buttons aligns on a grid instead of on their labels.
 */
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Rendered before the label, and centred when there is no label. */
  readonly icon?: ReactNode;
  /**
   * Marks the button as the current state of a toggle, rendering it as pressed
   * and exposing `aria-pressed`. Use for a formatting control that is *on*, not
   * for one that merely has focus.
   */
  readonly pressed?: boolean;
}

/**
 * A styled button.
 *
 * It is a plain `<button>` with classes — no wrapper, no cloned child — so
 * every native attribute, `ref`, and event handler works exactly as expected.
 * An icon-only button still needs an accessible name, which is what
 * `aria-label` is for:
 *
 * ```tsx
 * <Button size="icon" icon={<BoldIcon />} aria-label="Bold" pressed={isBold} />
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", icon, pressed, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // Buttons inside a form default to `submit`, which is almost never what a
      // toolbar control wants — an accidental form submission is a confusing
      // bug to trace back to a missing attribute.
      type={type ?? "button"}
      className={cn(
        "de-button",
        `de-button--${variant}`,
        `de-button--${size}`,
        pressed && "de-button--pressed",
        className,
      )}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      {...rest}
    >
      {icon !== undefined && icon !== null && (
        <span className="de-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});
