// Internal only. Nothing here is exported from the package's public
// `src/index.ts` — ProseMirror is an implementation detail of this engine
// module, never part of docs-editor-core's public API. See
// docs/ARCHITECTURE.md's "Editing Engine" section.
export { EngineConversionError, EngineSchemaError } from "./errors";
export { engineStateCopy, engineTransactionPaste } from "./prosemirror/clipboard";
export { compileEngineSchema } from "./prosemirror/compile-schema";
export { fromEngineNode, toEngineNode } from "./prosemirror/node-conversion";
export { fromEngineSelection, toEngineSelection } from "./prosemirror/selection-conversion";
export {
  runEngineDeleteSelection,
  runEngineExitCode,
  runEngineLift,
  runEngineNewlineInCode,
  runEngineSelectAll,
  runEngineSetBlockType,
  runEngineToggleMark,
  runEngineWrapIn,
} from "./prosemirror/commands";
export { runEngineRedo, runEngineUndo } from "./prosemirror/history";
export { engineActiveBlock, engineActiveMarks } from "./prosemirror/queries";
export {
  runEngineLiftListItem,
  runEngineSinkListItem,
  runEngineSplitListItem,
  runEngineWrapInList,
} from "./prosemirror/list-commands";
export {
  runEngineAddColumnAfter,
  runEngineAddColumnBefore,
  runEngineAddRowAfter,
  runEngineAddRowBefore,
  runEngineDeleteColumn,
  runEngineDeleteRow,
  runEngineDeleteTable,
  runEngineMergeCells,
  runEngineSplitCell,
  runEngineToggleHeaderColumn,
  runEngineToggleHeaderRow,
} from "./prosemirror/table-commands";
export {
  applyEngineTransaction,
  createEngineState,
  createEngineTransaction,
  engineStateDoc,
  engineStateSelection,
  engineTransactionAddMark,
  engineTransactionBefore,
  engineTransactionDelete,
  engineTransactionDoc,
  engineTransactionDocChanged,
  engineTransactionInsertNode,
  engineTransactionInsertText,
  engineTransactionRemoveMark,
  engineTransactionScrollIntoView,
  engineTransactionSelection,
  engineTransactionSetSelection,
} from "./prosemirror/state";
export {
  createEngineView,
  destroyEngineView,
  engineViewCoordsAtPos,
  engineViewDom,
  engineViewHasFocus,
  engineViewSetDecorations,
  focusEngineView,
  updateEngineViewState,
} from "./prosemirror/view";

export type { EngineState, EngineStateOptions, EngineTransaction } from "./prosemirror/state";
export type { EngineView, EngineViewOptions } from "./prosemirror/view";
