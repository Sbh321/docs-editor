import { InvalidContentExpressionError } from "./errors";

/**
 * One term in a content expression: a node/group `name` that must appear
 * between `min` and `max` (inclusive) times at this position in the
 * sequence. `max` is `Number.POSITIVE_INFINITY` for unbounded terms.
 */
export interface ContentTerm {
  readonly name: string;
  readonly min: number;
  readonly max: number;
}

/** A parsed, ready-to-match content expression. */
export interface ContentExpression {
  readonly source: string;
  readonly terms: readonly ContentTerm[];
}

/** What a matcher needs to know about one actual child node. */
export interface ContentDescriptor {
  readonly type: string;
  readonly group?: string;
}

const TERM_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)([*+?])?$/;

/**
 * Parses a content expression such as `"paragraph+"` or `"inline*"` into a
 * sequence of quantified terms. Terms are matched in order; this grammar does
 * not support alternation or parenthesized grouping (e.g. `"(a | b)*"`) — see
 * the limitation noted on {@link NodeSpec.content}.
 */
export function parseContentExpression(nodeType: string, source: string): ContentExpression {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return { source, terms: [] };
  }

  const terms = trimmed.split(/\s+/).map((token) => {
    const match = TERM_PATTERN.exec(token);
    if (!match) {
      throw new InvalidContentExpressionError(nodeType, source, token);
    }
    // Group 1 is mandatory in TERM_PATTERN, so it is always present once
    // `match` succeeds; only the quantifier (group 2) is genuinely optional.
    const name = match[1] as string;
    const quantifier = match[2];
    return { name, ...quantifierRange(quantifier) };
  });

  return { source, terms };
}

function quantifierRange(quantifier: string | undefined): { min: number; max: number } {
  switch (quantifier) {
    case "*":
      return { min: 0, max: Number.POSITIVE_INFINITY };
    case "+":
      return { min: 1, max: Number.POSITIVE_INFINITY };
    case "?":
      return { min: 0, max: 1 };
    default:
      return { min: 1, max: 1 };
  }
}

/**
 * Checks whether an ordered list of child descriptors satisfies a compiled
 * content expression, backtracking across term boundaries so ambiguous
 * cases (e.g. two adjacent unbounded terms) still find a valid split when
 * one exists.
 */
export function matchesContentExpression(
  expression: ContentExpression,
  children: readonly ContentDescriptor[],
): boolean {
  return matchFrom(expression.terms, 0, children, 0);
}

function matchFrom(
  terms: readonly ContentTerm[],
  termIndex: number,
  children: readonly ContentDescriptor[],
  childIndex: number,
): boolean {
  if (termIndex === terms.length) {
    return childIndex === children.length;
  }

  const term = terms[termIndex];
  if (!term) {
    return false;
  }

  let maxRun = 0;
  for (;;) {
    const child = children[childIndex + maxRun];
    if (!child || !matchesTerm(child, term)) {
      break;
    }
    maxRun++;
  }

  const upperBound = Math.min(term.max, maxRun);
  if (upperBound < term.min) {
    return false;
  }

  for (let count = upperBound; count >= term.min; count--) {
    if (matchFrom(terms, termIndex + 1, children, childIndex + count)) {
      return true;
    }
  }

  return false;
}

function matchesTerm(child: ContentDescriptor, term: ContentTerm): boolean {
  return child.type === term.name || child.group === term.name;
}
