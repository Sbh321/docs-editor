import { findText } from "@sbh321/docs-editor-core";
import { useEditor, useSearchHighlight } from "@sbh321/docs-editor-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../class-names";
import { Button } from "../primitives/button";
import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

export interface FindBarProps {
  /** Controlled open state. Omit to let the bar manage its own. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /**
   * Bind Ctrl/Cmd+F to open it. Defaults to `true`, which also suppresses the
   * browser's own find — the browser searches the *rendered* page, so it cannot
   * see text scrolled out of a virtualised region and cannot replace anything.
   */
  readonly shortcut?: boolean;
  readonly className?: string;
}

const ARROW_UP = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden>
    <path d="M4 10l4-4 4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ARROW_DOWN = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden>
    <path d="M4 6l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MORE = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
    <circle cx="8" cy="3" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="13" r="1.5" />
  </svg>
);

const CLOSE = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Find and replace, as a bar in the corner of the document.
 *
 * Modelled on Word and Google Docs, and for the same reason they settled there:
 * search is a *transient* task performed while reading the document, so it
 * belongs floating over the page rather than in a permanent panel that steals
 * width from the text for the 99% of the time nobody is searching.
 *
 * It opens as **plain find** — a field, a match count, and next/previous.
 * Replace is one level down behind the overflow button, because replacing is
 * both rarer and more dangerous than finding, and putting a "replace all"
 * button next to the search field invites the accident.
 *
 * Matching and replacing are core operations (`findText`, `Transaction`); this
 * owns only which match is current and what the fields contain.
 */
export function FindBar({
  open: controlledOpen,
  onOpenChange,
  shortcut = true,
  className,
}: FindBarProps): ReactNode {
  const { state, dispatch } = useEditor();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Read by the document listener, which is registered once and must not close
  // over a stale `open`.
  const openRef = useRef(false);

  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (!shortcut || typeof document === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openRef.current) {
        event.preventDefault();
        setOpen(false);
        setShowReplace(false);
        return;
      }
      if (event.key !== "f" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      // Suppresses the browser's own find deliberately: it searches rendered
      // text only, cannot replace, and having both open at once is confusing.
      event.preventDefault();
      setOpen(true);
      // Re-focus and select even when already open, so a second Ctrl+F starts a
      // fresh search rather than doing nothing.
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shortcut, setOpen]);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const matches = query === "" || !open ? [] : findText(state.doc, query);

  // Clamped rather than reset: editing can shrink the match list under a cursor
  // that was pointing past the new end.
  const current = matches.length === 0 ? 0 : Math.min(index, matches.length - 1);

  // A decoration, not a document change — so searching never touches the
  // document or the undo history. `activeIndex` is what lets the match you are
  // standing on look different from the rest.
  useSearchHighlight(open ? query : "", { activeIndex: current });

  const goTo = (next: number) => {
    if (matches.length === 0) {
      return;
    }
    // Wraps both ways, as every other editor's find does.
    const wrapped = (next + matches.length) % matches.length;
    setIndex(wrapped);
    const match = matches[wrapped];
    if (match) {
      dispatch(state.tr.setSelection({ anchor: match.from, head: match.to }).scrollIntoView());
    }
  };

  const replaceCurrent = () => {
    const match = matches[current];
    if (match) {
      dispatch(state.tr.insertText(replacement, match.from, match.to));
    }
  };

  const replaceAll = () => {
    if (matches.length === 0) {
      return;
    }
    // Back to front, so each replacement cannot shift the positions of the ones
    // still to come.
    let transaction = state.tr;
    for (const match of [...matches].reverse()) {
      transaction = transaction.insertText(replacement, match.from, match.to);
    }
    dispatch(transaction);
  };

  const close = () => {
    setOpen(false);
    setShowReplace(false);
  };

  if (!open) {
    return null;
  }

  const status =
    query === "" ? "" : `${matches.length === 0 ? 0 : current + 1} of ${matches.length}`;

  return (
    <div role="search" aria-label="Find and replace" className={cn("de-find-bar", className)}>
      <div className="de-find-bar__row">
        <input
          ref={inputRef}
          type="text"
          className="de-input de-find-bar__input"
          aria-label="Find"
          placeholder="Find in document"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goTo(event.shiftKey ? current - 1 : current + 1);
            }
          }}
        />

        {/* Polite, so stepping through matches does not interrupt a screen
            reader mid-sentence on every keystroke. */}
        <span className="de-find-bar__status" aria-live="polite">
          {status}
        </span>

        <Tooltip label="Previous match (Shift+Enter)">
          <Button
            size="icon-sm"
            icon={ARROW_UP}
            aria-label="Previous match"
            disabled={matches.length === 0}
            onClick={() => {
              goTo(current - 1);
            }}
          />
        </Tooltip>
        <Tooltip label="Next match (Enter)">
          <Button
            size="icon-sm"
            icon={ARROW_DOWN}
            aria-label="Next match"
            disabled={matches.length === 0}
            onClick={() => {
              goTo(current + 1);
            }}
          />
        </Tooltip>
        <Tooltip label={showReplace ? "Hide replace" : "Show replace"}>
          <Button
            size="icon-sm"
            icon={MORE}
            aria-label={showReplace ? "Hide replace" : "Show replace"}
            aria-expanded={showReplace}
            onClick={() => {
              setShowReplace((shown) => !shown);
            }}
          />
        </Tooltip>
        <Tooltip label="Close (Esc)">
          <Button size="icon-sm" icon={CLOSE} aria-label="Close find" onClick={close} />
        </Tooltip>
      </div>

      {showReplace && (
        <div className="de-find-bar__row">
          <input
            type="text"
            className="de-input de-find-bar__input"
            aria-label="Replace with"
            placeholder="Replace with"
            value={replacement}
            onChange={(event) => {
              setReplacement(event.target.value);
            }}
          />
          <Button size="sm" disabled={matches.length === 0} onClick={replaceCurrent}>
            Replace
          </Button>
          <Button size="sm" variant="outline" disabled={matches.length === 0} onClick={replaceAll}>
            All
          </Button>
        </div>
      )}
    </div>
  );
}
