import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset as offsetMiddleware,
  size as sizeMiddleware,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
} from "@floating-ui/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../class-names";

import type { Placement } from "@floating-ui/react";
import type { CSSProperties, ReactNode } from "react";

/** One choice in a {@link Select}. */
export interface SelectOption {
  readonly value: string;
  /** Text shown in the list, and matched against by type-ahead. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Groups options under a heading. */
  readonly group?: string;
  /** Inline style for the option — how the font picker previews each face. */
  readonly style?: CSSProperties;
  /**
   * Rendered instead of `label` inside the list. Use for a colour swatch or an
   * icon; `label` is still what type-ahead matches and what the trigger shows,
   * so an option is never unreachable by keyboard.
   */
  readonly render?: ReactNode;
}

export interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly label?: ReactNode;
  /** Shown on the trigger when nothing is selected. */
  readonly placeholder?: string;
  /** Accessible name when there is no visible `label`. */
  readonly "aria-label"?: string;
  readonly disabled?: boolean;
  readonly placement?: Placement;
  readonly className?: string;
  /** Width of the trigger. Useful for a fixed-width control in a toolbar. */
  readonly triggerWidth?: number | string;
  readonly id?: string;
}

/**
 * A dropdown built as an ARIA **listbox** (ROADMAP Phase 9, Milestone 9.5).
 *
 * ## Why this replaced the native `<select>`
 *
 * Until Phase 9 this was a styled native `select`, and the reasoning recorded
 * here was that native gets keyboard support, type-ahead and the mobile picker
 * for free and gets them right. That reasoning was sound and the trade stopped
 * being worth it: a native `select`'s **options cannot be styled** across
 * platforms, its popup ignores the page's dark theme almost everywhere, and it
 * cannot render a font name in its own face or a colour as a swatch — which is
 * precisely what a font picker, a size picker and a colour picker need.
 *
 * What native gave away for free is now ours to own, so it is implemented and
 * tested explicitly:
 *
 * - **Arrow keys** move the active option, wrapping at the ends
 * - **Home / End** jump to the first and last
 * - **Type-ahead** jumps to an option by its first letters
 * - **Enter / Space** commit, **Escape** closes and returns focus to the trigger
 * - **Tab** closes and moves on, rather than trapping focus in the list
 *
 * The trigger carries `role="combobox"` with `aria-expanded` and
 * `aria-activedescendant`, so assistive technology reads it as a value picker
 * rather than as an unexplained button.
 */
export function Select({
  options,
  value,
  onValueChange,
  label,
  placeholder,
  "aria-label": ariaLabel,
  disabled = false,
  placement = "bottom-start",
  className,
  triggerWidth,
  id,
}: SelectProps): ReactNode {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const listRef = useRef<(HTMLElement | null)[]>([]);
  // Type-ahead matches the *label*, never the custom `render`, so an option
  // shown as a swatch is still reachable by typing its name. Filled in an
  // effect rather than during render: floating-ui only reads it while handling
  // a keystroke, which is always after commit.
  const labelsRef = useRef<(string | null)[]>([]);
  useEffect(() => {
    labelsRef.current = options.map((option) => option.label);
  }, [options]);

  // Opening lands on the current value rather than on the first option, so
  // arrowing from an open list moves relative to what is selected. Done here
  // rather than in an effect keyed on `open`, which would set state right after
  // a render that had already used the stale index.
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: changeOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetMiddleware(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // The list is at least as wide as its trigger and never taller than the
      // space available, so a long font list scrolls instead of running off
      // the screen.
      sizeMiddleware({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${String(rects.reference.width)}px`,
            maxHeight: `${String(Math.max(160, availableHeight))}px`,
          });
        },
      }),
    ],
  });

  const listNavigation = useListNavigation(context, {
    listRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onNavigate: setActiveIndex,
    loop: true,
    // Virtual focus: the trigger keeps real DOM focus and the active option is
    // pointed at by `aria-activedescendant`. This is what a listbox is supposed
    // to do — moving real focus into the list would take key events away from
    // the trigger, breaking type-ahead and Enter.
    virtual: true,
    focusItemOnOpen: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onMatch: (index) => {
      // Only while open: typing against a closed listbox should not silently
      // move a hidden active option.
      if (open) {
        setActiveIndex(index);
      }
    },
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context),
    useRole(context, { role: "listbox" }),
    listNavigation,
    typeahead,
  ]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled === true) {
      return;
    }
    onValueChange?.(option.value);
    changeOpen(false);
  };

  // Group headings in the order their first member appears, preserving the
  // author's ordering rather than sorting.
  const grouped = useMemo(() => {
    const groups: {
      name: string | undefined;
      entries: { option: SelectOption; index: number }[];
    }[] = [];
    options.forEach((option, index) => {
      const existing = groups.find((entry) => entry.name === option.group);
      if (existing) {
        existing.entries.push({ option, index });
      } else {
        groups.push({ name: option.group, entries: [{ option, index }] });
      }
    });
    return groups;
  }, [options]);

  // Ref *setters*, wrapped in callbacks so they are not read during render.
  // They are stable functions rather than ref reads, but the compiler's
  // "no ref access during render" rule cannot distinguish the two — the same
  // accommodation `Tooltip` and the headless floating components make.
  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
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

  const triggerStyle = triggerWidth === undefined ? undefined : { width: triggerWidth };

  return (
    <div className="de-field">
      {label !== undefined && (
        <label className="de-field__label" htmlFor={controlId}>
          {label}
        </label>
      )}
      <button
        ref={setReference}
        id={controlId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && activeIndex !== null ? `${listId}-${String(activeIndex)}` : undefined
        }
        {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
        {...(triggerStyle ? { style: triggerStyle } : {})}
        className={cn("de-select__trigger", className)}
        {...getReferenceProps({
          onKeyDown: (event) => {
            // Enter and Space commit the *active* option. They are handled here
            // rather than on the option because the trigger holds real focus,
            // so the option never receives the key at all.
            if (!open || (event.key !== "Enter" && event.key !== " ")) {
              return;
            }
            event.preventDefault();
            if (activeIndex !== null) {
              commit(activeIndex);
            }
          },
        })}
      >
        <span className="de-select__value" {...(selected?.style ? { style: selected.style } : {})}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <span className="de-select__chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor">
            <path d="M4 6l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <FloatingPortal>
          {/* No focus manager: `virtual` list navigation above keeps real focus
              on the trigger, and a focus manager here would fight it for the
              focus it is deliberately not moving. */}
          <div
            ref={setFloating}
            id={listId}
            className="de-menu de-select__list"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {grouped.map((group) => (
              <div key={group.name ?? "__ungrouped__"} role="group" aria-label={group.name}>
                {group.name !== undefined && (
                  <div className="de-menu__group-label" aria-hidden="true">
                    {group.name}
                  </div>
                )}
                {group.entries.map(({ option, index }) => (
                  <div
                    key={option.value}
                    id={`${listId}-${String(index)}`}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    role="option"
                    aria-selected={option.value === value}
                    // A custom `render` replaces the visible text, so without
                    // this the option would have no accessible name at all —
                    // the claim that `label` still names it has to be made
                    // true, not merely stated.
                    {...(option.render === undefined ? {} : { "aria-label": option.label })}
                    aria-disabled={option.disabled === true ? true : undefined}
                    className={cn(
                      "de-menu__item",
                      "de-select__option",
                      index === activeIndex && "de-menu__item--active",
                      option.value === value && "de-select__option--selected",
                    )}
                    {...(option.style ? { style: option.style } : {})}
                    {...getItemProps({
                      onClick: () => {
                        commit(index);
                      },
                      onKeyDown: (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          commit(index);
                        }
                      },
                    })}
                  >
                    <span className="de-select__option-label">{option.render ?? option.label}</span>
                    {option.value === value && (
                      <span className="de-select__check" aria-hidden="true">
                        <svg
                          viewBox="0 0 16 16"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M3 8.5l3.5 3.5L13 5"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
