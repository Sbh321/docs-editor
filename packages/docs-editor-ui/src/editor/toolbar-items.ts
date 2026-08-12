/**
 * The toolbar's item vocabulary (ROADMAP Phase 9.5, Milestone 9.5.2).
 *
 * The toolbar used to be a fixed sequence of components written into
 * {@link EditorToolbar}'s body. That made it all-or-nothing: an application that
 * wanted the same bar *minus the font picker* had to replace the whole thing and
 * reimplement the rest, which is the opposite of what a batteries-included layer
 * is for.
 *
 * So every control the bar can hold has a **stable id**. A roster of ids decides
 * what appears and in what order; a set of ids decides what is removed; a record
 * of ids decides what an application supplies itself. Ids are data, so all three
 * survive being read from configuration, a feature flag, or a user preference.
 *
 * These are *names of positions*, not of behaviour: nothing here knows what bold
 * means. The controls they resolve to delegate to core commands exactly as
 * before.
 */

import type { ReactNode } from "react";

/**
 * A control the default toolbar knows how to render.
 *
 * Four of these have no component of their own and appear only when something
 * supplies them, which is what keeps `<EditorToolbar />` on its own free of
 * chrome it cannot wire:
 *
 * - `"file"` — the File menu, which needs an import handler
 * - `"layout"` — the sidebar toggle, which needs the panel's open state
 * - `"upload"` — the media picker, which needs an upload registry
 * - `"extras"` — the position of the toolbar's `children`
 *
 * `<DocsEditor />` fills all four.
 */
export type ToolbarItemName =
  | "file"
  | "history"
  | "blockType"
  | "fontFamily"
  | "fontSize"
  | "textFormat"
  | "color"
  | "alignment"
  | "lists"
  | "indent"
  | "link"
  | "clearFormatting"
  | "insert"
  | "table"
  | "media"
  | "layout"
  | "upload"
  | "extras"
  | "colorScheme";

/**
 * A toolbar position: one of the built-in {@link ToolbarItemName}s, or an
 * application's own id backed by a slot.
 *
 * The `string & {}` arm is what keeps editor autocomplete offering the built-in
 * names while still accepting `"share"` — a plain `string` would silence the
 * suggestions, and a bare union would reject custom controls.
 */
export type ToolbarItemId = ToolbarItemName | (string & {});

/**
 * Content for toolbar positions, keyed by id.
 *
 * A key matching a built-in name **replaces** that control; any other key
 * defines a new one, which then has to appear in the roster to be rendered.
 *
 * A key present with a `null` value renders nothing, so a slot table computed
 * from a permission check reads the way it looks — `{ file: canImport ? <FileMenu /> : null }`
 * removes the File menu rather than restoring the built-in one.
 */
export type ToolbarItemSlots = Readonly<Record<string, ReactNode>>;

/**
 * The default bar, in order.
 *
 * `"colorScheme"` is deliberately last. The overflow row drops items from the
 * end, so whatever sits here is first to leave the bar on a narrow window — and
 * of everything present, the theme toggle is what a writer needs least often
 * mid-document.
 */
export const DEFAULT_TOOLBAR_ITEMS: readonly ToolbarItemName[] = [
  "file",
  "history",
  "blockType",
  "fontFamily",
  "fontSize",
  "textFormat",
  "color",
  "alignment",
  "lists",
  "indent",
  "link",
  "clearFormatting",
  "insert",
  // Contextual: each renders nothing unless it applies, so the bar does not
  // carry a row of permanently-disabled buttons.
  "table",
  "media",
  "layout",
  "upload",
  "extras",
  "colorScheme",
];

/**
 * Applies a roster and a hidden set to produce the ids the toolbar renders.
 *
 * `hide` subtracts from whatever roster is in play, so the two compose: pass
 * neither for the default bar, `hide` alone to drop a control from it, `items`
 * alone to state the bar exactly, or both.
 *
 * A duplicated id is kept once, at its first position — a repeated control would
 * otherwise render twice and collide on its React key.
 */
export function resolveToolbarItems(
  items: readonly ToolbarItemId[] = DEFAULT_TOOLBAR_ITEMS,
  hide: readonly ToolbarItemId[] = [],
): readonly ToolbarItemId[] {
  const hidden = new Set<ToolbarItemId>(hide);
  const seen = new Set<ToolbarItemId>();
  const resolved: ToolbarItemId[] = [];

  for (const id of items) {
    if (hidden.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(id);
  }

  return resolved;
}
