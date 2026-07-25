import { createContext } from "react";

import type { Dispatch, EditorState } from "@sbh321/docs-editor-core";

/**
 * React `Context` objects have one fixed type parameter, but `EditorState`/
 * `Dispatch` are generic per schema — there's no way for a single `Context`
 * instance to vary its type per `<EditorProvider>` usage. Typed against the
 * default `<string, string>` instantiation here; `useEditorState`/
 * `useEditorDispatch` accept explicit type parameters and narrow via `as`
 * (a widening-to-narrowing cast TypeScript permits since the narrower type
 * is always assignable to `<string, string>`). This is safe in practice
 * since one app's `EditorProvider` and its hooks always agree on the same
 * schema types, even though the `Context` itself can't express that
 * statically.
 */
export const EditorStateContext = createContext<EditorState<string, string> | null>(null);

export const EditorDispatchContext = createContext<Dispatch<string> | null>(null);
