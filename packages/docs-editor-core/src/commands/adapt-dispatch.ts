import { Transaction } from "../state";

import type { EngineTransaction } from "../engine";
import type { Dispatch } from "./types";

/** Wraps a docs-editor {@link Dispatch} as the plain engine-transaction callback the engine adapter expects. */
export function adaptDispatch<NodeName extends string>(
  dispatch: Dispatch<NodeName> | undefined,
): ((transaction: EngineTransaction) => void) | undefined {
  if (!dispatch) {
    return undefined;
  }
  return (engineTransaction) => dispatch(new Transaction<NodeName>(engineTransaction));
}
