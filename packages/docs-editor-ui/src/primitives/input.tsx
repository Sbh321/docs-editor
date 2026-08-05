import { forwardRef, useId } from "react";

import { cn } from "../class-names";

import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * A visible label. Strongly preferred over `aria-label`: a visible label is
   * usable by everyone, survives translation, and gives a larger click target
   * because clicking it focuses the field.
   */
  readonly label?: ReactNode;
  /** Help text below the field, associated via `aria-describedby`. */
  readonly hint?: ReactNode;
  /** Marks the value invalid and renders `error` in place of the hint. */
  readonly error?: ReactNode;
}

/** A styled text field with its label, hint and error wired up. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  // `error` is a ReactNode, so it can legitimately be `0` or `""` — checking it
  // for truthiness would treat a zero-valued error message as no error at all.
  const hasError = error !== undefined && error !== null;
  const message = hasError ? error : hint;

  return (
    <div className={cn("de-field", hasError && "de-field--invalid")}>
      {label !== undefined && (
        <label className="de-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn("de-input", className)}
        // Announced as invalid, not merely coloured red — colour alone is not
        // information a screen-reader user receives.
        {...(hasError ? { "aria-invalid": true } : {})}
        {...(message !== undefined ? { "aria-describedby": messageId } : {})}
        {...rest}
      />
      {message !== undefined && (
        <p
          className={cn("de-field__message", hasError && "de-field__message--error")}
          id={messageId}
        >
          {message}
        </p>
      )}
    </div>
  );
});
