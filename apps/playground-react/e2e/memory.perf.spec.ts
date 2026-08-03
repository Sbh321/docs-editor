import { expect, test } from "@playwright/test";

import type { CDPSession, Page } from "@playwright/test";

/**
 * Long-session heap behaviour (ROADMAP Phase 6, Milestone 6.5).
 *
 * ARCHITECTURE requires that "large editing sessions should remain stable over
 * extended periods" and that memory grow predictably. Unit tests can prove
 * observers disconnect and history is capped, but only a real browser can show
 * whether a few hundred edit/undo cycles on a 100-page document leave anything
 * behind — including the per-node conversion cache added in Milestone 6.2,
 * whose `WeakMap` keys must become collectable along with the old documents.
 */

const PARAGRAPHS = 1000;
const CYCLES = 120;

/** Used heap in MB, after forcing a collection so the reading is settled. */
async function heapMB(client: CDPSession): Promise<number> {
  await client.send("HeapProfiler.collectGarbage");
  const usage = (await client.send("Runtime.getHeapUsage")) as unknown as { usedSize: number };
  return usage.usedSize / (1024 * 1024);
}

async function loadLargeDocument(page: Page) {
  const markdown = Array.from(
    { length: PARAGRAPHS },
    (_, index) => `Paragraph ${index + 1} of the benchmark document with enough words to wrap.`,
  ).join("\n\n");
  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill(markdown);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForTimeout(2000);
}

test("heap stays flat across a long edit/undo session", async ({ page }) => {
  await page.goto("/");
  await loadLargeDocument(page);

  const client = await page.context().newCDPSession(page);
  await client.send("HeapProfiler.enable");

  const insert = page.getByRole("button", { name: 'Insert "Hi! "' });
  const undo = page.getByRole("button", { name: "Undo" });

  // Warm up so first-run allocations (lazily built caches, JIT) are not counted
  // as growth.
  for (let cycle = 0; cycle < 10; cycle += 1) {
    await insert.click();
    await undo.click();
  }

  const baseline = await heapMB(client);

  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    await insert.click();
    await undo.click();
  }

  const after = await heapMB(client);
  const growth = after - baseline;
  const perCycleKB = (growth * 1024) / CYCLES;

  console.log(
    `\n[memory] ${PARAGRAPHS} paragraphs, ${CYCLES} edit/undo cycles:\n` +
      `[memory]   baseline: ${baseline.toFixed(1)} MB\n` +
      `[memory]   after:    ${after.toFixed(1)} MB\n` +
      `[memory]   growth:   ${growth.toFixed(1)} MB (${perCycleKB.toFixed(1)} KB/cycle)\n`,
  );

  await client.detach();

  // A leak would grow without bound; bounded history plus collectable caches
  // should keep this small relative to the document itself. Generous so it
  // catches a real leak rather than normal allocator noise.
  expect(growth).toBeLessThan(baseline);
});

test("heap returns to baseline after replacing the document repeatedly", async ({ page }) => {
  // Importing replaces the whole document (and remounts the editor), so any
  // per-document retention — caches, decorations, observers — would compound.
  await page.goto("/");
  await loadLargeDocument(page);

  const client = await page.context().newCDPSession(page);
  await client.send("HeapProfiler.enable");
  const baseline = await heapMB(client);

  for (let round = 0; round < 3; round += 1) {
    await loadLargeDocument(page);
  }

  const after = await heapMB(client);
  const growth = after - baseline;

  console.log(
    `[memory] 3 full document replacements: ${baseline.toFixed(1)} MB -> ${after.toFixed(1)} MB ` +
      `(growth ${growth.toFixed(1)} MB)\n`,
  );

  await client.detach();
  expect(growth).toBeLessThan(baseline);
});
