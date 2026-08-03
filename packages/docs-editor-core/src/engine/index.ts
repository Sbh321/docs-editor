// Internal only. Nothing here is exported from the package's public
// `src/index.ts` — ProseMirror is an implementation detail of this engine
// module, never part of docs-editor-core's public API. See
// docs/ARCHITECTURE.md's "Editing Engine" section.
export { EngineConversionError, EngineSchemaError } from "./errors";
export {
  getEngineBaseKeymap,
  runEngineCreateParagraphNear,
  runEngineJoinBackward,
  runEngineJoinDown,
  runEngineJoinForward,
  runEngineJoinUp,
  runEngineLiftEmptyBlock,
  runEngineSelectNodeBackward,
  runEngineSelectNodeForward,
  runEngineSelectParentNode,
  runEngineSplitBlock,
} from "./prosemirror/base-commands";
export type { EngineCommand } from "./prosemirror/base-commands";
export { engineStateCopy, engineTransactionPaste } from "./prosemirror/clipboard";
export { compileEngineSchema } from "./prosemirror/compile-schema";
export { engineParseFromHtml, engineSerializeToHtml } from "./prosemirror/html";
export type { EngineHtmlParseOptions, EngineHtmlSerializeOptions } from "./prosemirror/html";
export { fromEngineNode, toEngineNode } from "./prosemirror/node-conversion";
export { fromEngineSelection, toEngineSelection } from "./prosemirror/selection-conversion";
export {
  runEngineDeleteSelection,
  runEngineExitCode,
  runEngineLift,
  runEngineNewlineInCode,
  runEngineRemoveFormatting,
  runEngineSelectAll,
  runEngineSetBlockType,
  runEngineSetMark,
  runEngineToggleMark,
  runEngineWrapIn,
} from "./prosemirror/commands";
export { runEngineRedo, runEngineUndo } from "./prosemirror/history";
export { createEngineTablePlugin } from "./prosemirror/tables";
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
  engineTransactionSelectNode,
  engineTransactionSelection,
  engineTransactionSetSelection,
} from "./prosemirror/state";
export {
  createEngineView,
  destroyEngineView,
  engineViewCoordsAtPos,
  engineViewDom,
  engineViewHasFocus,
  engineViewPosAtDOM,
  engineViewSetDecorations,
  focusEngineView,
  updateEngineViewState,
} from "./prosemirror/view";

export type { EngineState, EngineStateOptions, EngineTransaction } from "./prosemirror/state";
export type { EngineView, EngineViewOptions } from "./prosemirror/view";
