import {
  activeLink,
  insertLink,
  normalizeLinkHref,
  removeLink,
  setLink,
} from "@sbh321/docs-editor-core";
import { ToolbarButton, ToolbarGroup, useEditor } from "@sbh321/docs-editor-react";
import { useState } from "react";

import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Dialog } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

/**
 * The link editor (ROADMAP Phase 9, Milestone 9.6).
 *
 * ## What this replaced
 *
 * Until Phase 9 the toolbar's link button ran
 * `toggleMark("link", { href: "" })` — it marked text as a link pointing at
 * **nothing**, with no way to say where it should go and no way to see or
 * change where an existing one already went. This is the dialog that was
 * missing.
 *
 * The dialog is an editor, not a re-entry form: opening it with the cursor
 * inside a link fills in that link's URL, text and target, so changing one
 * field leaves the rest alone.
 */
export function LinkButton(): ReactNode {
  const { state, dispatch } = useEditor();
  const existing = activeLink(state);
  const hasSelection = state.selection.anchor !== state.selection.head;

  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [text, setText] = useState("");
  const [newTab, setNewTab] = useState(false);

  /**
   * Loads the fields from the document and opens the dialog.
   *
   * Done here rather than in an effect keyed on `open`. An effect would render
   * the previous link's details once before correcting them, and would need the
   * dependency list to lie about reading `existing` — re-running on every
   * document change would overwrite whatever the user was typing.
   */
  const openEditor = () => {
    setHref(existing?.href ?? "");
    setText(existing?.text ?? "");
    setNewTab(existing?.target === "_blank");
    setOpen(true);
  };

  // Nothing to link and nothing to edit: no selected text, and no link under
  // the cursor. Disabled rather than hidden, so the control does not appear and
  // disappear as the cursor moves.
  const canOpen = hasSelection || existing !== null;
  const normalized = normalizeLinkHref(href);
  const canApply = normalized !== null && (existing !== null || hasSelection || text.length > 0);

  const apply = () => {
    if (normalized === null) {
      return;
    }
    const attrs = { href: normalized, target: newTab ? "_blank" : null };

    // Three cases, and the dialog picks between them rather than making the
    // user understand the difference: retarget an existing link, link the
    // selected text, or insert new text carrying the link.
    if (existing !== null && text !== existing.text && text.length > 0) {
      // The display text changed, so the link's run is replaced rather than
      // re-marked. The range is passed explicitly so this stays one transaction
      // — moving the selection first would dispatch twice, and the second call
      // would read a state that predates the first.
      insertLink({ ...attrs, text }, { range: { from: existing.from, to: existing.to } })(
        state,
        dispatch,
      );
    } else if (existing !== null || hasSelection) {
      setLink(attrs)(state, dispatch);
    } else {
      insertLink({ ...attrs, text })(state, dispatch);
    }
    setOpen(false);
  };

  const dialogTitle = existing === null ? "Insert link" : "Edit link";

  return (
    <ToolbarGroup label="Link">
      <Tooltip label="Link (Ctrl+K)">
        <ToolbarButton
          iconName="link"
          label="Link"
          active={existing !== null}
          disabled={!canOpen}
          onClick={openEditor}
        />
      </Tooltip>

      <Tooltip label="Remove link">
        <ToolbarButton command={removeLink()} iconName="linkOff" label="Remove link" />
      </Tooltip>

      {/* `Dialog` is controlled and has no trigger of its own, which is what
          lets the trigger live inside the toolbar's roving focus while the
          dialog renders in a portal. */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={dialogTitle}
        footer={
          <>
            {existing !== null && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  removeLink()(state, dispatch);
                  setOpen(false);
                }}
              >
                Remove link
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={!canApply} onClick={apply}>
              {existing === null ? "Insert" : "Save"}
            </Button>
          </>
        }
      >
        <div className="de-link-editor">
          <Input
            label="URL"
            value={href}
            placeholder="example.com"
            // Only once something has been typed, so the field is not marked
            // invalid before the user has had a chance to fill it in.
            {...(href.length > 0 && normalized === null
              ? { "aria-invalid": true, hint: "That does not look like a web address." }
              : {})}
            onChange={(event) => {
              setHref(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />

          {/* Only where it can do anything: with text already selected, the
              document decides the display text, and a field for it would be a
              control that silently does nothing. */}
          {!hasSelection && (
            <Input
              label="Text to display"
              value={text}
              placeholder="Link text"
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          )}

          <Checkbox
            label="Open in a new tab"
            checked={newTab}
            onChange={(event) => {
              setNewTab(event.target.checked);
            }}
          />
        </div>
      </Dialog>
    </ToolbarGroup>
  );
}
