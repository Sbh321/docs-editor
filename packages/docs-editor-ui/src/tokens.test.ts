import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DOCS_EDITOR_TOKENS, NON_TEXT_CONTRAST_PAIRS, TEXT_CONTRAST_PAIRS } from "./tokens";

import type { DocsEditorToken } from "./tokens";

/**
 * Theming verification (ROADMAP Phase 8, Milestone 8.2).
 *
 * These read the **actual stylesheet** rather than a copy of its values in
 * TypeScript. A duplicated palette would pass forever while the shipped CSS
 * drifted, which is the failure mode this milestone most needs to avoid:
 * accessibility is a gate (CLAUDE.md), and a contrast test that checks the
 * wrong artifact is worse than none.
 */

const STYLESHEET = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "public/tokens.css"),
  "utf8",
);

/** Strips comments, so a token mentioned in prose is never mistaken for a declaration. */
const CSS = STYLESHEET.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Reads the declarations of the first rule whose selector list contains
 * `selector`, ignoring nested at-rules by taking the block that follows it.
 */
function declarationsFor(selector: string, source = CSS): Record<string, string> {
  const index = source.indexOf(selector);
  if (index === -1) {
    throw new Error(`Selector not found in stylesheet: ${selector}`);
  }
  const open = source.indexOf("{", index);
  const close = source.indexOf("}", open);
  const block = source.slice(open + 1, close);

  const declarations: Record<string, string> = {};
  for (const line of block.split(";")) {
    const [property, ...rest] = line.split(":");
    if (property && rest.length > 0) {
      declarations[property.trim()] = rest.join(":").trim();
    }
  }
  return declarations;
}

const light = declarationsFor(":root,");
// The explicit-choice block, which is last in the file and therefore the one
// that wins over the media query.
const dark = declarationsFor('[data-docs-editor-theme="dark"] {');

/** Resolves a token to a hex colour, following one level of `var()` indirection. */
function colorOf(token: DocsEditorToken, scheme: Record<string, string>): string {
  const raw = scheme[token] ?? light[token];
  if (!raw) {
    throw new Error(`Token not declared: ${token}`);
  }
  const varMatch = /^var\((--[\w-]+)\)$/.exec(raw);
  if (varMatch?.[1]) {
    return colorOf(varMatch[1] as DocsEditorToken, scheme);
  }
  return raw;
}

/** sRGB channel → linear, per the WCAG relative-luminance definition. */
function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Not a 6-digit hex colour: ${hex}`);
  }
  const int = Number.parseInt(match[1], 16);
  const r = channelLuminance((int >> 16) & 0xff);
  const g = channelLuminance((int >> 8) & 0xff);
  const b = channelLuminance(int & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("token vocabulary", () => {
  it("declares every documented token", () => {
    // A token that is documented but never defined resolves to nothing at
    // runtime, which fails silently — the component just renders unstyled.
    const missing = DOCS_EDITOR_TOKENS.filter((token) => !(token in light));
    expect(missing).toEqual([]);
  });

  it("documents every token the stylesheet declares", () => {
    // The other direction: an undocumented token is one a consumer cannot
    // discover, and one nothing verifies.
    const declared = Object.keys(light).filter((property) => property.startsWith("--de-"));
    const undocumented = declared.filter(
      (token) => !(DOCS_EDITOR_TOKENS as readonly string[]).includes(token),
    );
    expect(undocumented).toEqual([]);
  });

  it("defines no dark-only colour token", () => {
    // A token that exists only in dark is undefined in light, so a component
    // using it renders correctly in one scheme and breaks in the other.
    const darkOnly = Object.keys(dark).filter(
      (property) => property.startsWith("--de-") && !(property in light),
    );
    expect(darkOnly).toEqual([]);
  });

  it("overrides every colour token that needs to differ in dark", () => {
    // Anything left at its light value in dark is a bug waiting to be seen —
    // these are the ones that must be re-stated.
    const mustDiffer: readonly DocsEditorToken[] = [
      "--de-background",
      "--de-foreground",
      "--de-surface",
      "--de-muted",
      "--de-border",
      "--de-page",
      "--de-canvas",
    ];
    for (const token of mustDiffer) {
      expect(dark[token], `${token} is not overridden in dark`).toBeDefined();
      expect(dark[token]).not.toBe(light[token]);
    }
  });
});

describe("contrast — WCAG AA", () => {
  const schemes: readonly (readonly [string, Record<string, string>])[] = [
    ["light", light],
    ["dark", dark],
  ];

  for (const [name, scheme] of schemes) {
    describe(name, () => {
      for (const [foreground, background] of TEXT_CONTRAST_PAIRS) {
        it(`${foreground} on ${background} meets 4.5:1`, () => {
          const ratio = contrastRatio(colorOf(foreground, scheme), colorOf(background, scheme));
          expect(
            ratio,
            `${foreground} on ${background} in ${name} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }

      for (const [foreground, background] of NON_TEXT_CONTRAST_PAIRS) {
        it(`${foreground} against ${background} meets 3:1`, () => {
          const ratio = contrastRatio(colorOf(foreground, scheme), colorOf(background, scheme));
          expect(
            ratio,
            `${foreground} against ${background} in ${name} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }

  it("keeps selected text readable in both schemes", () => {
    // Selection sits *behind* text, so the pair that matters is the document's
    // foreground against the selection tint — not the selection against the page.
    for (const [name, scheme] of schemes) {
      const ratio = contrastRatio(
        colorOf("--de-page-foreground", scheme),
        colorOf("--de-selection", scheme),
      );
      expect(ratio, `selected text in ${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("light and dark switching", () => {
  it("lets an explicit choice override the system preference in both directions", () => {
    // The common bug is supporting "follow the system" but not "dark even
    // though my OS is light". Both selectors must exist for that to work.
    expect(CSS).toContain(':root:not([data-docs-editor-theme="light"])');
    expect(CSS).toContain('[data-docs-editor-theme="dark"]');
  });

  it("puts the explicit-choice block after the media query, so it wins", () => {
    const mediaIndex = CSS.indexOf("@media (prefers-color-scheme: dark)");
    const explicitIndex = CSS.lastIndexOf('[data-docs-editor-theme="dark"] {');
    expect(mediaIndex).toBeGreaterThan(-1);
    // Same specificity, so source order is the whole mechanism.
    expect(explicitIndex).toBeGreaterThan(mediaIndex);
  });

  it("honours reduced-motion", () => {
    expect(CSS).toContain("prefers-reduced-motion: reduce");
  });

  it("scopes the focus ring to keyboard users", () => {
    // A ring on every mouse click reads as a bug and trains people to ignore it.
    expect(CSS).toContain(":focus-visible");
  });
});

describe("colour tokens come in pairs", () => {
  it("declares a foreground for every surface that carries text", () => {
    // Spelled out rather than derived by appending "-foreground": the page
    // background's partner is `--de-foreground`, not
    // `--de-background-foreground`, and a naming rule that does not hold is
    // worse than no rule.
    const pairs: readonly (readonly [string, string])[] = [
      ["--de-background", "--de-foreground"],
      ["--de-surface", "--de-surface-foreground"],
      ["--de-muted", "--de-muted-foreground"],
      ["--de-primary", "--de-primary-foreground"],
      ["--de-destructive", "--de-destructive-foreground"],
      ["--de-accent", "--de-accent-foreground"],
      ["--de-accent-subtle", "--de-accent-subtle-foreground"],
      ["--de-page", "--de-page-foreground"],
    ];
    for (const [surface, foreground] of pairs) {
      expect(light[surface], `${surface} is not declared`).toBeDefined();
      expect(light[foreground], `${surface} has no foreground`).toBeDefined();
    }
  });
});
