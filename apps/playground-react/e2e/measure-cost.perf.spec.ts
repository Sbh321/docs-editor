import { expect, test } from "@playwright/test";

import { loadMarkdownDocument } from "./load-document";

/**
 * Isolates the cost of one pagination measurement pass (ROADMAP Phase 6,
 * Milestone 6.4).
 *
 * Inferring it from end-to-end typing deltas proved too noisy (±1 ms run to
 * run), so this times the DOM read loop directly, in-page, over the real
 * rendered document — and compares the two ways of reading block geometry so the
 * choice is made on data rather than folklore.
 */

const PARAGRAPHS = 1000;
const REPEATS = 30;

test("cost of one pagination measurement pass", async ({ page }) => {
  await page.goto("/");

  const markdown = Array.from(
    { length: PARAGRAPHS },
    (_, index) => `Paragraph ${index + 1} of the benchmark document with enough words to wrap.`,
  ).join("\n\n");
  await loadMarkdownDocument(page, markdown);
  // Let pagination measure and converge before measuring anything else.
  await page.waitForTimeout(2000);

  const result = await page.evaluate(
    ({ repeats }) => {
      const container = document.querySelector(
        ".de-editor [contenteditable='true']",
      ) as HTMLElement | null;
      if (!container) {
        return null;
      }
      const blocks = Array.from(container.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );

      /** Forces a fresh layout so each timed pass measures a real read, not a cached one. */
      const invalidate = () => {
        container.style.paddingBottom = `${Math.random() * 0.5}px`;
        return container.offsetHeight;
      };

      const timeRects = () => {
        const started = performance.now();
        let sum = 0;
        for (const el of blocks) {
          const rect = el.getBoundingClientRect();
          sum += rect.top + rect.height;
        }
        return { ms: performance.now() - started, sum };
      };

      const timeOffsets = () => {
        const started = performance.now();
        let sum = 0;
        for (const el of blocks) {
          sum += el.offsetTop + el.offsetHeight;
        }
        return { ms: performance.now() - started, sum };
      };

      let rectTotal = 0;
      let offsetTotal = 0;
      for (let run = 0; run < repeats; run += 1) {
        invalidate();
        rectTotal += timeRects().ms;
        invalidate();
        offsetTotal += timeOffsets().ms;
      }
      container.style.paddingBottom = "";

      return {
        blocks: blocks.length,
        rectMs: rectTotal / repeats,
        offsetMs: offsetTotal / repeats,
      };
    },
    { repeats: REPEATS },
  );

  expect(result).not.toBeNull();
  if (!result) {
    return;
  }

  console.log(
    `\n[measure] one pass over ${result.blocks} blocks (mean of ${REPEATS} runs, layout invalidated each time):`,
  );
  console.log(`[measure]   getBoundingClientRect(): ${result.rectMs.toFixed(2)} ms`);
  console.log(`[measure]   offsetTop/offsetHeight : ${result.offsetMs.toFixed(2)} ms\n`);
});
