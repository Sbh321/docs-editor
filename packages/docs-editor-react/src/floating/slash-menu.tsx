import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset as offsetMiddleware,
  shift,
  useFloating,
} from "@floating-ui/react";
import { getTextBefore, isSelectionEmpty, selectionTo } from "@sbh321/docs-editor-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useThemeClassName, useThemeIcon } from "../theme/use-theme";
import { useEditor } from "../use-editor";
import { useEditorView } from "../use-editor-view";

import { pointRect } from "./selection-rect";

import type { Command } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

export interface SlashMenuItem {
  readonly id: string;
  /** The visible name, also matched against the typed query. */
  readonly label: string;
  /** Optional secondary text shown beside the label. */
  readonly description?: string;
  /** An icon node for the item. Takes precedence over `iconName`. */
  readonly icon?: ReactNode;
  /** A theme icon intent to resolve when `icon` is absent. */
  readonly iconName?: string;
  /** Extra terms matched against the query beyond `label` (e.g. `["h1", "title"]`). */
  readonly keywords?: readonly string[];
  /** The command run when the item is chosen. */
  readonly command: Command;
}

export interface SlashMenuProps {
  readonly items: readonly SlashMenuItem[];
  /** The character that opens the menu. Defaults to `"/"`. */
  readonly trigger?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Renders one item. Defaults to its icon, label, and description. */
  readonly renderItem?: (item: SlashMenuItem, meta: { readonly active: boolean }) => ReactNode;
  /** Shown when no item matches the query. Defaults to nothing (the menu hides). */
  readonly emptyLabel?: ReactNode;
}

interface TriggerMatch {
  readonly triggerFrom: number;
  readonly query: string;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Detects an open trigger token (`/query`) at a collapsed cursor, requiring it to start a word. */
function detectTrigger(textBefore: string, cursor: number, trigger: string): TriggerMatch | null {
  const pattern = new RegExp(`(?:^|\\s)${escapeForRegExp(trigger)}(\\S*)$`);
  const match = pattern.exec(textBefore);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  return { triggerFrom: cursor - query.length - trigger.length, query };
}

function matchesQuery(item: SlashMenuItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(needle) ||
    (item.keywords?.some((keyword) => keyword.toLowerCase().includes(needle)) ?? false)
  );
}

/**
 * A slash command menu: type the `trigger` (default `/`) to open a filterable
 * list of commands at the caret, arrow keys to move, Enter to run, Escape to
 * dismiss. Choosing an item removes the typed `/query` and runs the command —
 * as two ordered dispatches, so document integrity is preserved.
 *
 * Headless: you supply the `items` and (optionally) how each renders; the menu
 * owns detection, positioning, keyboard handling, and dismissal. Must be
 * rendered within the same `EditorProvider` as an `<Editor />`.
 */
export function SlashMenu(props: SlashMenuProps): ReactNode {
  const { items, trigger = "/", className, style, renderItem, emptyLabel } = props;
  const { state, dispatch } = useEditor();
  const view = useEditorView();
  const themeClassName = useThemeClassName("slashMenu");

  const [activeIndexState, setActiveIndex] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const pendingCommandRef = useRef<Command | null>(null);

  const match = useMemo<TriggerMatch | null>(() => {
    if (!isSelectionEmpty(state.selection) || state.selection.type === "cell") {
      return null;
    }
    const cursor = selectionTo(state.selection);
    return detectTrigger(getTextBefore(state.doc, cursor), cursor, trigger);
  }, [state.doc, state.selection, trigger]);

  const matchKey = match ? `${match.triggerFrom}:${match.query}` : null;
  const filtered = useMemo(
    () => (match ? items.filter((item) => matchesQuery(item, match.query)) : []),
    [items, match],
  );
  const open = match !== null && view !== null && matchKey !== dismissedKey;

  // Clamp the highlighted index into range at read time, so the filtered set
  // shrinking (as the query narrows) never leaves it pointing past the end —
  // no state write during render needed.
  const activeIndex = filtered.length === 0 ? 0 : Math.min(activeIndexState, filtered.length - 1);

  // Latest values for the capture-phase key handler, avoiding stale closures.
  const latest = useRef({ open, filtered, activeIndex });
  useEffect(() => {
    latest.current = { open, filtered, activeIndex };
  });

  const runItem = useCallback(
    (item: SlashMenuItem) => {
      if (!match) {
        return;
      }
      const cursor = selectionTo(state.selection);
      // First remove the typed "/query"; the command then runs against the
      // resulting state in the effect below, so both edits stay valid.
      pendingCommandRef.current = item.command;
      dispatch(state.tr.delete(match.triggerFrom, cursor));
    },
    [match, state, dispatch],
  );

  // Run the queued command once state reflects the "/query" deletion.
  useEffect(() => {
    const command = pendingCommandRef.current;
    if (command) {
      pendingCommandRef.current = null;
      command(state, dispatch);
      view?.focus();
    }
  }, [state, dispatch, view]);

  useEffect(() => {
    if (!open || !view) {
      return undefined;
    }
    const dom = view.dom;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const current = latest.current;
      if (!current.open) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) =>
          current.filtered.length === 0 ? 0 : (index + 1) % current.filtered.length,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) =>
          current.filtered.length === 0
            ? 0
            : (index - 1 + current.filtered.length) % current.filtered.length,
        );
      } else if (event.key === "Enter") {
        const item = current.filtered[current.activeIndex];
        if (item) {
          event.preventDefault();
          event.stopPropagation();
          runItem(item);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissedKey(matchKey);
      }
    };
    // Capture phase so these keys are handled before ProseMirror moves the caret.
    dom.addEventListener("keydown", handleKeyDown, true);
    return () => dom.removeEventListener("keydown", handleKeyDown, true);
  }, [open, view, runItem, matchKey]);

  const { refs: floatingRefs, floatingStyles } = useFloating({
    placement: "bottom-start",
    open,
    middleware: [offsetMiddleware(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (!open || !view || !match) {
      return;
    }
    let rect;
    try {
      const coords = view.coordsAtPos(match.triggerFrom);
      rect = pointRect(coords.left, coords.bottom);
    } catch {
      rect = pointRect(0, 0);
    }
    floatingRefs.setPositionReference({
      getBoundingClientRect: () => rect,
      contextElement: view.dom,
    });
  }, [open, view, match, floatingRefs]);

  // See FloatingToolbar: wrap the ref setter so the member access happens in a
  // callback, not during render (the compiler's ref rule flags the latter).
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => floatingRefs.setFloating(node),
    [floatingRefs],
  );

  if (!open) {
    return null;
  }

  return (
    <FloatingPortal>
      <div
        ref={setFloating}
        role="listbox"
        aria-label="Slash commands"
        className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
        style={{ ...floatingStyles, ...style }}
      >
        {filtered.length === 0
          ? emptyLabel
          : filtered.map((item, index) => (
              <SlashMenuOption
                key={item.id}
                item={item}
                active={index === activeIndex}
                onSelect={runItem}
                onHover={setActiveIndex}
                index={index}
                {...(renderItem ? { render: renderItem } : {})}
              />
            ))}
      </div>
    </FloatingPortal>
  );
}

interface SlashMenuOptionProps {
  readonly item: SlashMenuItem;
  readonly active: boolean;
  readonly index: number;
  readonly onSelect: (item: SlashMenuItem) => void;
  readonly onHover: (index: number) => void;
  readonly render?: (item: SlashMenuItem, meta: { readonly active: boolean }) => ReactNode;
}

function SlashMenuOption(props: SlashMenuOptionProps): ReactNode {
  const { item, active, index, onSelect, onHover, render } = props;
  const optionClassName = useThemeClassName("slashMenuOption");
  const activeClassName = useThemeClassName("slashMenuOptionActive");
  const themeIcon = useThemeIcon(item.iconName);

  return (
    // A button (natively focusable/keyboard-operable) carrying the listbox
    // `option` role. `tabIndex={-1}` keeps it out of the tab order — focus
    // stays in the editor while the user types; Enter is handled there.
    <button
      type="button"
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={
        [optionClassName, active ? activeClassName : undefined].filter(Boolean).join(" ") ||
        undefined
      }
      // Prevent the mousedown from moving the editor caret before the click.
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(item)}
    >
      {render ? (
        render(item, { active })
      ) : (
        <>
          {item.icon ?? themeIcon}
          <span>{item.label}</span>
          {item.description !== undefined ? <span>{item.description}</span> : null}
        </>
      )}
    </button>
  );
}
