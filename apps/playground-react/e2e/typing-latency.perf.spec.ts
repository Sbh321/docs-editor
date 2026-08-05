import { expect, test } from "@playwright/test";

import { loadMarkdownDocument } from "./load-document";
import { toolbarControl } from "./toolbar";

import type { Page } from "@playwright/test";

/**
 * End-to-end interaction timing (ROADMAP Phase 6, Milestone 6.1).
 *
 * The core micro-benchmarks measure `EditorState.apply` in isolation; this
 * measures what a user actually feels — a real keystroke in a real browser,
 * including React re-render, ProseMirror DOM update, and (because the playground
 * enables it by default) live pagination.
 *
 * These **measure, they do not assert** a budget: PROJECT_SPEC's "typing
 * performance should never degrade regardless of document size" is judged by
 * comparing the reported numbers across scales, and against the recorded
 * baseline in docs/PERFORMANCE.md. They are excluded from the normal e2e run —
 * use `pnpm test:perf`.
 */

/** Keystrokes per sample. Enough to average out scheduling noise. */
const KEYSTROKES = 40;

/** Document scales, expressed as paragraphs of imported Markdown. */
const SCALES = [
  { name: "small (1 paragraph)", paragraphs: 0 },
  { name: "medium (200 paragraphs)", paragraphs: 200 },
  { name: "large (1000 paragraphs)", paragraphs: 1000 },
] as const;

function markdownDocument(paragraphs: number): string {
  return Array.from(
    { length: paragraphs },
    (_, index) =>
      `Paragraph ${index + 1} of the benchmark document with enough words to fill a line of the page.`,
  ).join("\n\n");
}

/** Loads a document of `paragraphs` length into the editor via Markdown import. */
async function loadDocument(page: Page, paragraphs: number) {
  if (paragraphs === 0) {
    return;
  }
  await loadMarkdownDocument(page, markdownDocument(paragraphs));
  // Let the import settle (pagination measures and converges).
  await page.waitForTimeout(1500);
}

for (const scale of SCALES) {
  test(`typing latency — ${scale.name}`, async ({ page }) => {
    await page.goto("/");
    await loadDocument(page, scale.paragraphs);

    const editable = page.locator(".de-editor [contenteditable='true']");
    await editable.click();
    await page.waitForTimeout(200);

    // Warm-up, so JIT and first-render costs don't land in the sample.
    await page.keyboard.type("warmup", { delay: 0 });
    await page.waitForTimeout(300);

    const started = Date.now();
    await page.keyboard.type("x".repeat(KEYSTROKES), { delay: 0 });
    const elapsed = Date.now() - started;

    const perKeystroke = elapsed / KEYSTROKES;
    // Reported, not asserted — the number is the deliverable.
    console.log(
      `[perf] typing ${scale.name}: ${perKeystroke.toFixed(2)} ms/keystroke ` +
        `(${KEYSTROKES} keystrokes in ${elapsed} ms, includes harness overhead)`,
    );

    // A generous sanity ceiling: catches a catastrophic regression (an editor
    // that has become unusable), not a small one.
    expect(perKeystroke).toBeLessThan(200);
  });
}

test("typing latency — large (1000 paragraphs), live pagination OFF", async ({ page }) => {
  // Isolates what live pagination costs per keystroke: same document, same
  // typing, with the measurement loop disabled. The delta against the
  // pagination-on run above is pagination's share (input for Milestone 6.4).
  await page.goto("/");
  await loadDocument(page, 1000);

  await page.getByLabel("Live pagination").uncheck();
  await page.waitForTimeout(500);

  const editable = page.locator(".de-editor [contenteditable='true']");
  await editable.click();
  await page.waitForTimeout(200);
  await page.keyboard.type("warmup", { delay: 0 });
  await page.waitForTimeout(300);

  const started = Date.now();
  await page.keyboard.type("x".repeat(KEYSTROKES), { delay: 0 });
  const elapsed = Date.now() - started;

  const perKeystroke = elapsed / KEYSTROKES;
  console.log(
    `[perf] typing large (1000 paragraphs), pagination OFF: ${perKeystroke.toFixed(2)} ms/keystroke ` +
      `(${KEYSTROKES} keystrokes in ${elapsed} ms, includes harness overhead)`,
  );

  expect(perKeystroke).toBeLessThan(200);
});

/**
 * Human-speed typing. The full-speed runs above understate pagination's cost:
 * its measurement is coalesced to one pass per animation frame, so a burst of
 * keystrokes collapses into a handful of measurements. A real typist leaves a
 * frame gap between keys, so every keystroke can trigger its own re-measure.
 * This is the realistic number, and the input that decides whether incremental
 * measurement (Milestone 6.4) is worth building.
 */
const HUMAN_DELAY_MS = 80;
const HUMAN_KEYSTROKES = 20;

for (const paginate of [true, false] as const) {
  test(`human-speed typing — 1000 paragraphs, pagination ${paginate ? "ON" : "OFF"}`, async ({
    page,
  }) => {
    await page.goto("/");
    await loadDocument(page, 1000);

    if (!paginate) {
      await page.getByLabel("Live pagination").uncheck();
      await page.waitForTimeout(500);
    }

    const editable = page.locator(".de-editor [contenteditable='true']");
    await editable.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("warm", { delay: HUMAN_DELAY_MS });
    await page.waitForTimeout(300);

    // Measure only the time the page is busy, excluding the deliberate pauses.
    const started = Date.now();
    await page.keyboard.type("x".repeat(HUMAN_KEYSTROKES), { delay: HUMAN_DELAY_MS });
    const elapsed = Date.now() - started;
    const busy = elapsed - HUMAN_KEYSTROKES * HUMAN_DELAY_MS;

    console.log(
      `[perf] human-speed typing, pagination ${paginate ? "ON " : "OFF"}: ` +
        `${(busy / HUMAN_KEYSTROKES).toFixed(2)} ms/keystroke of work ` +
        `(${elapsed} ms total for ${HUMAN_KEYSTROKES} keys at ${HUMAN_DELAY_MS} ms spacing)`,
    );

    expect(elapsed).toBeGreaterThan(0);
  });
}

test("document import + pagination settle time", async ({ page }) => {
  await page.goto("/");

  // Timed from answering the file chooser, which is where a user's wait
  // starts; the sheet class is the package's since the playground stopped
  // owning any page markup.
  await (await toolbarControl(page, "File")).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import…" }).click();

  const started = Date.now();
  await (
    await chooser
  ).setFiles({
    name: "large.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdownDocument(1000), "utf8"),
  });
  // Wait until the multi-page backdrop reflects the imported document.
  await expect(async () => {
    expect(await page.locator(".de-page").count()).toBeGreaterThan(5);
  }).toPass({ timeout: 30_000 });
  const elapsed = Date.now() - started;

  const pages = await page.locator(".de-page").count();
  console.log(`[perf] import 1000 paragraphs + paginate to ${pages} pages: ${elapsed} ms`);

  expect(pages).toBeGreaterThan(5);
});
