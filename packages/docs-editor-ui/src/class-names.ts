/**
 * Class-name composition (ROADMAP Phase 8, Milestone 8.3).
 *
 * shadcn/ui pairs `clsx` with `tailwind-merge` because Tailwind's utility
 * classes conflict with each other and the later one has to win. This
 * stylesheet uses semantic classes that do not conflict, so joining is enough —
 * two dependencies would buy nothing here.
 */

/** A value that may contribute a class name. */
export type ClassValue = string | false | null | undefined;

/**
 * Joins class names, dropping anything falsy.
 *
 * Falsy values are dropped rather than stringified so a conditional reads
 * naturally and never emits `"false"` or `"undefined"` into the DOM:
 *
 * ```ts
 * cn("de-button", isActive && "de-button--active", className)
 * ```
 *
 * The caller's `className` goes last by convention, so it appears after ours in
 * the attribute — which matters for anyone reading the DOM, though not for the
 * cascade, where source order in the stylesheet decides.
 */
export function cn(...values: readonly ClassValue[]): string {
  let result = "";
  for (const value of values) {
    if (value) {
      result = result === "" ? value : `${result} ${value}`;
    }
  }
  return result;
}
