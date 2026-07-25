import { useCallback } from "react";

import { useEditor } from "./use-editor";
import { useEditorView } from "./use-editor-view";

import type { Command } from "@sbh321/docs-editor-core";

export interface UseCommandResult {
  /**
   * Runs the command against the current state and dispatches its transaction,
   * then returns focus to the editor (a toolbar click otherwise leaves focus
   * on the button). A no-op when the command doesn't apply.
   */
  readonly run: () => void;
  /**
   * Whether the command applies in the current state — from a dry run (calling
   * the command with no dispatch has no side effects). Drive a button's
   * `disabled` from this.
   */
  readonly enabled: boolean;
}

/**
 * Bridges a core {@link Command} to a UI control: a `run` handler plus whether
 * the command currently applies. This is the seam between the headless command
 * layer and any button — `ToolbarButton` builds on it, and so can your own
 * controls.
 *
 * Note the two independent facts a formatting button usually needs: `enabled`
 * (can this apply?) comes from here; *active* (is it already applied?) comes
 * from {@link useIsMarkActive}/{@link useIsBlockActive}, which are queries, not
 * command dry runs.
 */
export function useCommand(command: Command): UseCommandResult {
  const { state, dispatch } = useEditor();
  const view = useEditorView();

  const enabled = command(state);
  const run = useCallback(() => {
    command(state, dispatch);
    view?.focus();
  }, [command, state, dispatch, view]);

  return { run, enabled };
}
