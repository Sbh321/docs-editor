/**
 * The default key bindings (ROADMAP Phase 8, Milestone 8.1).
 *
 * `baseKeymap` supplies the structural editing every editor needs (Backspace
 * joins, Mod-a selects all, Escape lifts the selection). This adds the
 * *formatting* and *document* bindings a user expects on top, using the
 * shortcuts they already know from other editors — so the defaults are
 * unsurprising rather than novel.
 */

import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  exitCode,
  liftEmptyBlock,
  liftListItem,
  moveBlock,
  newlineInCode,
  redo,
  sinkListItem,
  splitBlock,
  splitListItem,
  toggleMark,
  undo,
} from "../commands";
import { clearFormatting, indent, outdent, setTextAlign } from "../formatting";
import { toggleList, toggleTaskItem } from "../lists";

import type { Command } from "../commands";
import type { DefaultMarkName, DefaultNodeName } from "./default-schema";

/**
 * Key bindings for {@link defaultSchema}, keyed by `prosemirror-keymap` key
 * strings (`"Mod-b"` — Cmd on macOS, Ctrl elsewhere).
 *
 * Spread it and override to customise:
 *
 * ```ts
 * const keymap = { ...defaultKeymap, "Mod-k": openLinkDialog };
 * ```
 */
export const defaultKeymap: Readonly<Record<string, Command<DefaultNodeName, DefaultMarkName>>> = {
  // Structural editing first, so the specific bindings below win on conflict.
  ...(baseKeymap as Record<string, Command<DefaultNodeName, DefaultMarkName>>),

  "Mod-b": toggleMark("bold"),
  "Mod-i": toggleMark("italic"),
  "Mod-u": toggleMark("underline"),
  "Mod-Shift-x": toggleMark("strikethrough"),
  "Mod-e": toggleMark("code"),
  "Mod-Shift-h": toggleMark("highlight"),
  // The whole-meaning version: `removeFormatting` clears marks only, which
  // would leave a centred, indented paragraph centred and indented.
  "Mod-\\": clearFormatting,

  // Alignment, on the shortcuts Google Docs and Word already use.
  "Mod-Shift-l": setTextAlign("left"),
  "Mod-Shift-e": setTextAlign("center"),
  "Mod-Shift-r": setTextAlign("right"),
  "Mod-Shift-j": setTextAlign("justify"),

  // Lists, on the shortcuts Google Docs uses. Each toggles: pressing it inside
  // a list of another kind converts, and inside its own kind leaves.
  "Mod-Shift-7": toggleList("ordered_list"),
  "Mod-Shift-8": toggleList("bullet_list"),
  "Mod-Shift-9": toggleList("task_list"),
  // Checks or unchecks the task item at the cursor without reaching for it.
  "Mod-Shift-Enter": toggleTaskItem(),

  "Mod-z": undo,
  "Shift-Mod-z": redo,
  // Windows and Linux users reach for this one; macOS uses Shift-Mod-z.
  "Mod-y": redo,

  // Enter is context-dependent, and the order is the behaviour: a newline
  // inside a code block, otherwise a new list item, otherwise escaping an empty
  // list item, otherwise an ordinary paragraph split. Each command declines and
  // falls through to the next.
  Enter: chainCommands(
    newlineInCode,
    splitListItem("list_item"),
    splitListItem("task_item"),
    liftEmptyBlock,
    createParagraphNear,
    splitBlock,
  ),
  // The way out of a code block, where Enter is taken.
  "Mod-Enter": exitCode,

  // Tab stays **list-only**, deliberately. Word and Google Docs indent any
  // paragraph with it, but they own the whole window; an editor embedded in a
  // web page that swallowed Tab everywhere would leave a keyboard user unable
  // to reach anything past it. Declining outside a list is what keeps focus
  // escapable, and CLAUDE.md treats an accessibility regression as a bug.
  Tab: chainCommands(sinkListItem("list_item"), sinkListItem("task_item")),
  "Shift-Tab": chainCommands(liftListItem("list_item"), liftListItem("task_item")),

  // Indentation gets its own bindings instead: they work everywhere, and nest
  // inside a list exactly as Tab does.
  "Mod-]": indent(),
  "Mod-[": outdent(),

  // Reordering blocks from the keyboard. A drag handle is pointer-only, and an
  // editor where blocks can only be reordered by mouse is one a keyboard user
  // cannot fully operate. Alt-Shift is the combination Notion and Obsidian both
  // use, so it is unsurprising as well as available.
  "Alt-Shift-ArrowUp": moveBlock("up"),
  "Alt-Shift-ArrowDown": moveBlock("down"),
};
