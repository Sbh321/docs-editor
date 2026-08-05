import { forwardRef, useId } from "react";

import { cn } from "../class-names";

import type { InputHTMLAttributes, ReactNode } from "react";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "size"
> {
  /** Checked state. Pass `"mixed"` for a partially-selected group. */
  readonly checked?: boolean | "mixed";
  readonly label?: ReactNode;
  /** Hides the label visually while keeping it for screen readers. */
  readonly hideLabel?: boolean;
  readonly size?: "sm" | "md";
}

/**
 * A checkbox (ROADMAP Phase 9, Milestone 9.5).
 *
 * Built on a **real `<input type="checkbox">`** rather than a styled `div` with
 * `role="checkbox"`. The native input is what supplies keyboard activation,
 * form participation, the browser's own focus behaviour and correct
 * announcement — all of which a div re-implements and usually gets subtly
 * wrong. It is visually hidden and the styling is painted by a sibling, so the
 * appearance is fully ours while the semantics stay the browser's.
 *
 * `checked="mixed"` maps to the native `indeterminate` property, which is not
 * an attribute and cannot be set from JSX — hence the callback ref below.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked, label, hideLabel = false, size = "md", className, id, disabled, ...rest },
  forwardedRef,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isMixed = checked === "mixed";

  return (
    <span
      className={cn(
        "de-checkbox",
        `de-checkbox--${size}`,
        disabled === true && "de-checkbox--disabled",
        className,
      )}
    >
      <input
        ref={(node) => {
          // `indeterminate` is a DOM property with no HTML attribute, so it can
          // only be set imperatively. Without this a "mixed" checkbox would
          // render as plain unchecked and announce the wrong state.
          if (node) {
            node.indeterminate = isMixed;
          }
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        id={inputId}
        type="checkbox"
        className="de-checkbox__input"
        checked={isMixed ? false : (checked ?? false)}
        aria-checked={isMixed ? "mixed" : undefined}
        disabled={disabled}
        {...rest}
      />
      {/* Decorative: the input above carries every semantic. */}
      <span className="de-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="de-checkbox__mark" fill="none" stroke="currentColor">
          {isMixed ? (
            <path d="M4 8h8" strokeWidth="2.5" strokeLinecap="round" />
          ) : (
            <path
              d="M3.5 8.5l3 3L12.5 5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </span>
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className={cn("de-checkbox__label", hideLabel && "de-visually-hidden")}
        >
          {label}
        </label>
      )}
    </span>
  );
});
